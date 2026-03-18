from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


LatLng = Tuple[float, float]


def _haversine_m(a: LatLng, b: LatLng) -> float:
    # Great-circle distance on Earth (meters)
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def _bearing_deg(a: LatLng, b: LatLng) -> float:
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    brng = math.degrees(math.atan2(y, x))
    return (brng + 360) % 360


def _bearing_to_turn_phrase(bearing: float) -> str:
    # Very coarse turn instruction for demo / fallback mode
    if 315 <= bearing or bearing < 45:
        return "Head north"
    if 45 <= bearing < 135:
        return "Head east"
    if 135 <= bearing < 225:
        return "Head south"
    return "Head west"


def _http_get_json(url: str, timeout_s: float = 6.0) -> Dict:
    req = urllib.request.Request(url, headers={"User-Agent": "smart-glasses-system/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)


def geocode_place(query: str) -> Optional[LatLng]:
    """
    Geocode using Nominatim if enabled.
    Enable by setting ENABLE_NOMINATIM=1.
    """
    if os.getenv("ENABLE_NOMINATIM", "0") != "1":
        return None

    q = urllib.parse.quote(query)
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    try:
        results = _http_get_json(url)
        if not results:
            return None
        return (float(results[0]["lat"]), float(results[0]["lon"]))
    except Exception:
        return None


def route_osrm(start: LatLng, dest: LatLng) -> Optional[Dict]:
    """
    Route using OSRM public demo server if enabled.
    Enable by setting ENABLE_OSRM=1.
    """
    if os.getenv("ENABLE_OSRM", "0") != "1":
        return None

    # OSRM expects lon,lat
    s_lon, s_lat = start[1], start[0]
    d_lon, d_lat = dest[1], dest[0]
    url = (
        "https://router.project-osrm.org/route/v1/foot/"
        f"{s_lon},{s_lat};{d_lon},{d_lat}"
        "?overview=false&steps=true&alternatives=false"
    )
    try:
        return _http_get_json(url)
    except Exception:
        return None


@dataclass
class NavigationStep:
    instruction: str
    distance_m: float


@dataclass
class NavigationPlan:
    start: LatLng
    dest: LatLng
    steps: List[NavigationStep]
    total_distance_m: float
    provider: str


def plan_navigation(start: LatLng, dest: LatLng) -> NavigationPlan:
    osrm = route_osrm(start, dest)
    if osrm and osrm.get("code") == "Ok":
        try:
            route = osrm["routes"][0]
            steps: List[NavigationStep] = []
            for leg in route.get("legs", []):
                for s in leg.get("steps", []):
                    maneuver = s.get("maneuver", {})
                    instr = maneuver.get("instruction") or s.get("name") or "Continue"
                    steps.append(NavigationStep(instruction=instr, distance_m=float(s.get("distance", 0.0))))
            return NavigationPlan(
                start=start,
                dest=dest,
                steps=steps if steps else [NavigationStep("Proceed to destination.", float(route.get("distance", 0.0)))],
                total_distance_m=float(route.get("distance", 0.0)),
                provider="osrm",
            )
        except Exception:
            pass

    # Fallback: straight-line guidance (offline-safe)
    dist = _haversine_m(start, dest)
    bearing = _bearing_deg(start, dest)
    phrase = _bearing_to_turn_phrase(bearing)
    steps = [
        NavigationStep(f"{phrase} towards destination.", max(dist - 10.0, 0.0)),
        NavigationStep("You have arrived at your destination.", 0.0),
    ]
    return NavigationPlan(start=start, dest=dest, steps=steps, total_distance_m=dist, provider="fallback")


class NavigationSession:
    def __init__(self):
        self.active: bool = False
        self.plan: Optional[NavigationPlan] = None
        self.started_at: float = 0.0
        self.step_index: int = 0

    def start(self, plan: NavigationPlan) -> None:
        self.active = True
        self.plan = plan
        self.started_at = time.time()
        self.step_index = 0

    def stop(self) -> None:
        self.active = False
        self.plan = None
        self.step_index = 0

    def next_instruction(self) -> Optional[str]:
        if not self.active or not self.plan:
            return None
        if self.step_index >= len(self.plan.steps):
            return "Navigation complete."
        instr = self.plan.steps[self.step_index].instruction
        self.step_index += 1
        return instr


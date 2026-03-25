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
    if 315 <= bearing or bearing < 45: return "Head north"
    if 45 <= bearing < 135: return "Head east"
    if 135 <= bearing < 225: return "Head south"
    return "Head west"

def _http_get_json(url: str, timeout_s: float = 6.0) -> Dict:
    req = urllib.request.Request(url, headers={"User-Agent": "smart-glasses-system/1.0"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)

def geocode_place(query: str, current_lat: float = None, current_lon: float = None) -> Optional[Tuple[float, float, str]]:
    q = urllib.parse.quote(query)
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    if current_lat and current_lon:
        url += f"&lat={current_lat}&lon={current_lon}"
    try:
        results = _http_get_json(url)
        if not results: return None
        lat, lon = float(results[0]["lat"]), float(results[0]["lon"])
        name = results[0]["display_name"].split(",")[0]
        return (lat, lon, name)
    except Exception:
        return None

def route_osrm(start: LatLng, dest: LatLng) -> Optional[Dict]:
    s_lon, s_lat = start[1], start[0]
    d_lon, d_lat = dest[1], dest[0]
    url = (
        "http://router.project-osrm.org/route/v1/foot/"
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
    start_lat: float
    start_lon: float

@dataclass
class NavigationPlan:
    start: LatLng
    dest: LatLng
    steps: List[NavigationStep]
    total_distance_m: float
    duration_sec: float
    provider: str
    dest_name: str

def plan_navigation(start: LatLng, dest: LatLng, dest_name: str = "Destination") -> NavigationPlan:
    osrm = route_osrm(start, dest)
    if osrm and osrm.get("code") == "Ok":
        try:
            route = osrm["routes"][0]
            duration = float(route.get("duration", 0.0)) 
            steps: List[NavigationStep] = []
            for leg in route.get("legs", []):
                for s in leg.get("steps", []):
                    maneuver = s.get("maneuver", {})
                    instr = maneuver.get("instruction") or s.get("name") or "Continue"
                    # Extract the [lon, lat] of the turn intersection
                    loc = maneuver.get("location", [start[1], start[0]]) 
                    steps.append(NavigationStep(
                        instruction=instr, 
                        distance_m=float(s.get("distance", 0.0)),
                        start_lat=float(loc[1]),
                        start_lon=float(loc[0])
                    ))
            return NavigationPlan(
                start=start, dest=dest, steps=steps,
                total_distance_m=float(route.get("distance", 0.0)),
                duration_sec=duration, provider="osrm", dest_name=dest_name
            )
        except Exception: pass

    # Fallback mode
    dist = _haversine_m(start, dest)
    duration = dist / 1.4 
    bearing = _bearing_deg(start, dest)
    phrase = _bearing_to_turn_phrase(bearing)
    steps = [
        NavigationStep(f"{phrase} towards destination.", max(dist - 10.0, 0.0), start[0], start[1]),
        NavigationStep("You have arrived at your destination.", 0.0, dest[0], dest[1]),
    ]
    return NavigationPlan(start=start, dest=dest, steps=steps, total_distance_m=dist, duration_sec=duration, provider="fallback", dest_name=dest_name)


# Live-Tracking Engine
class NavigationSession:
    def __init__(self):
        self.active: bool = False
        self.plan: Optional[NavigationPlan] = None
        self.step_index: int = 0
        self.announced_current: bool = False

    def start(self, plan: NavigationPlan) -> None:
        self.active = True
        self.plan = plan
        self.step_index = 0
        self.announced_current = False

    def stop(self) -> None:
        self.active = False
        self.plan = None

    def process_location(self, current_lat: float, current_lon: float) -> Optional[str]:
        """
        Takes the user's live GPS coordinates. Calculates if they are close enough
        to the next turn to trigger the audio instruction. Returns the text if so.
        """
        if not self.active or not self.plan:
            return None

        if self.step_index >= len(self.plan.steps):
            self.stop()
            return "You have arrived at your destination."

        # Always announce the very first step to get them moving
        if not self.announced_current:
            self.announced_current = True
            return self.plan.steps[self.step_index].instruction

        # Calculate distance to the NEXT turn/waypoint
        if self.step_index + 1 < len(self.plan.steps):
            next_step = self.plan.steps[self.step_index + 1]
            dist_to_next = _haversine_m((current_lat, current_lon), (next_step.start_lat, next_step.start_lon))
            
            # If user is within 15 meters of the turn intersection, announce it!
            if dist_to_next <= 15.0:
                self.step_index += 1
                self.announced_current = True
                return next_step.instruction
        else:
            dist_to_dest = _haversine_m((current_lat, current_lon), (self.plan.dest[0], self.plan.dest[1]))
            if dist_to_dest <= 15.0:
                self.stop()
                return "You have arrived at your destination."

        return None
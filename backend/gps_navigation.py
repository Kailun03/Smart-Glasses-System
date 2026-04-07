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
    target_lat: float # FIXED: Renamed to target to clearly mark the destination node
    target_lon: float

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
                    loc = maneuver.get("location", [dest[1], dest[0]]) 
                    steps.append(NavigationStep(
                        instruction=instr, 
                        distance_m=float(s.get("distance", 0.0)),
                        target_lat=float(loc[1]),
                        target_lon=float(loc[0])
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
        NavigationStep(f"{phrase} towards destination.", max(dist - 10.0, 0.0), dest[0], dest[1]),
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
        self.last_announce_time: float = 0.0 # FIXED: Added this variable

    def start(self, plan: NavigationPlan) -> None:
        self.active = True
        self.plan = plan
        self.step_index = 0
        self.announced_current = False
        self.last_announce_time = 0.0 # Reset on start

    def stop(self) -> None:
        self.active = False
        self.plan = None

    def process_location(self, current_lat: float, current_lon: float, current_heading: float = None):
        # FIXED: use self.plan instead of self.route_plan
        if not self.active or not self.plan or not self.plan.steps:
            return None
            
        now = time.time()
        # Prevent spamming audio instructions (every 8 seconds max)
        if now - self.last_announce_time < 8.0:
            return None 

        # FIXED: Pull coordinates from the current step
        current_step = self.plan.steps[0]
        target_lat = current_step.target_lat
        target_lon = current_step.target_lon
        
        # FIXED: Use correct function names (_haversine_m and _bearing_deg)
        distance_to_next = _haversine_m((current_lat, current_lon), (target_lat, target_lon))
        target_bearing = _bearing_deg((current_lat, current_lon), (target_lat, target_lon))

        self.last_announce_time = now
        
        # Default instruction
        turn_instruction = "Proceed forward"

        # If the mobile phone provided the compass heading, we calculate relative turns!
        if current_heading is not None:
            turn_angle = (target_bearing - current_heading + 360) % 360
            if 15 < turn_angle <= 165:
                turn_instruction = "Turn right"
            elif 195 <= turn_angle < 345:
                turn_instruction = "Turn left"
            elif 165 < turn_angle < 195:
                turn_instruction = "Turn around"

        # Arrival check (if user is within 15 meters of the target node)
        if distance_to_next < 15:
            if len(self.plan.steps) == 1:
                self.active = False
                return "You have arrived at your destination."
            else:
                self.plan.steps.pop(0) # FIXED: Move to the next step
                return f"{turn_instruction} for the next step."

        # Normal walking instruction
        dist_rounded = int(distance_to_next)
        return f"{turn_instruction} for {dist_rounded} meters."
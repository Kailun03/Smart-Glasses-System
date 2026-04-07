from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

_last_alert_at: float = 0.0
_last_alert_key: Optional[str] = None

def _hazard_priority(h: Dict[str, Any]) -> Tuple[int, float]:
    """
    Lower tuple sorts first (higher priority).
    - CENTER hazards first
    - Larger hazards next
    """
    pos = str(h.get("pos", "")).upper()
    size = float(h.get("size", 0.0))
    zone_rank = 0 if pos == "CENTER" else 1
    return (zone_rank, -size)

def _build_feedback(obj: str, pos: str, size: float) -> Tuple[str, str]:
    """
    Generates unambiguous, actionable audio commands based on obstacle size and position.
    """
    pos = pos.upper()
    
    # Categorize the obstacle size to determine severity and required maneuver
    is_massive = size >= 60.0
    is_medium = 25.0 <= size < 60.0
    # small is < 25.0

    if pos == "CENTER":
        hardware_cmd = "ALERT: MOTOR_BOTH"
        if is_massive:
            audio_cmd = f"Stop! Massive {obj} blocking your path. Please turn around."
        elif is_medium:
            audio_cmd = f"Stop. {obj} directly ahead. Step carefully to the side to bypass."
        else:
            audio_cmd = f"Caution. Small {obj} ahead. Watch your step."

    elif pos == "LEFT":
        hardware_cmd = "ALERT: MOTOR_LEFT"
        if is_massive:
            audio_cmd = f"Stop. Large {obj} blocking the left. Keep strictly to your right."
        elif is_medium:
            audio_cmd = f"Caution. {obj} on your left. Veer right to avoid."
        else:
            audio_cmd = f"{obj.capitalize()} spotted on your left. Shift slightly right."

    else: # RIGHT
        hardware_cmd = "ALERT: MOTOR_RIGHT"
        if is_massive:
            audio_cmd = f"Stop. Large {obj} blocking the right. Keep strictly to your left."
        elif is_medium:
            audio_cmd = f"Caution. {obj} on your right. Veer left to avoid."
        else:
            audio_cmd = f"{obj.capitalize()} spotted on your right. Shift slightly left."

    return hardware_cmd, audio_cmd

def generate_alerts(
    critical_hazards: List[Dict[str, Any]],
    *,
    cooldown_s: float = 2.0, # Increased cooldown slightly to allow longer TTS sentences to finish
) -> Tuple[str, str, str]:
    """
    Returns (hardware_command, log_message, audio_instruction).
    """
    global _last_alert_at, _last_alert_key

    if not critical_hazards:
        _last_alert_key = None
        return "SAFE", "SAFE: Path is clear.", "Path is clear."

    # Grab the most critical hazard based on position and size
    primary = sorted(critical_hazards, key=_hazard_priority)[0]
    obj = str(primary.get("name", "hazard"))
    pos = str(primary.get("pos", "CENTER")).upper()
    size = float(primary.get("size", 0.0))

    hazard_key = f"{obj}:{pos}"
    now = time.time()
    
    # Cooldown suppresses repeating the exact same hazard spam
    if _last_alert_key == hazard_key and (now - _last_alert_at) < cooldown_s:
        return "NOOP", "INFO: Hazard already reported (cooldown).", ""

    # Pass the size into the feedback builder
    hardware_cmd, audio_cmd = _build_feedback(obj, pos, size)
    log_message = f"HAZARD DETECTED: {obj.upper()} at {pos} ({size:.1f}%)"

    _last_alert_at = now
    _last_alert_key = hazard_key
    
    return hardware_cmd, log_message, audio_cmd
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


def _build_feedback(obj: str, pos: str) -> Tuple[str, str]:
    pos = pos.upper()
    if pos == "CENTER":
        hardware_cmd = "ALERT: MOTOR_BOTH"
        audio_cmd = f"Stop. {obj.capitalize()} directly ahead."
    elif pos == "LEFT":
        hardware_cmd = "ALERT: MOTOR_LEFT"
        audio_cmd = f"Caution. {obj.capitalize()} on your left. Move right."
    else:
        hardware_cmd = "ALERT: MOTOR_RIGHT"
        audio_cmd = f"Caution. {obj.capitalize()} on your right. Move left."
    return hardware_cmd, audio_cmd


def generate_alerts(
    critical_hazards: List[Dict[str, Any]],
    *,
    cooldown_s: float = 0.8,
) -> Tuple[str, str, str]:
    """
    Returns (hardware_command, log_message, audio_instruction).

    A small cooldown is applied to reduce alert spam and information overload.
    """
    global _last_alert_at, _last_alert_key

    if not critical_hazards:
        _last_alert_key = None
        return "SAFE", "SAFE: Path is clear.", "Path is clear."

    primary = sorted(critical_hazards, key=_hazard_priority)[0]
    obj = str(primary.get("name", "hazard"))
    pos = str(primary.get("pos", "CENTER")).upper()
    size = float(primary.get("size", 0.0))

    # Cooldown only suppresses repeating the same primary hazard rapidly.
    hazard_key = f"{obj}:{pos}"
    now = time.time()
    if _last_alert_key == hazard_key and (now - _last_alert_at) < cooldown_s:
        return "NOOP", "INFO: Hazard already reported (cooldown).", ""

    hardware_cmd, audio_cmd = _build_feedback(obj, pos)
    log_message = f"HAZARD DETECTED: {obj.upper()} at {pos} ({size:.1f}%)"

    _last_alert_at = now
    _last_alert_key = hazard_key
    return hardware_cmd, log_message, audio_cmd
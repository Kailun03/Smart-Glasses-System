def generate_alerts(critical_hazards):
    if not critical_hazards:
        return "SAFE", "SAFE: Path is clear.", "Path is clear."

    # Prioritize hazards in the CENTER zone first, then by size
    center_hazards = [h for h in critical_hazards if h['pos'] == "CENTER"]
    if center_hazards:
        primary_hazard = sorted(center_hazards, key=lambda x: x['size'], reverse=True)[0]
    else:
        primary_hazard = sorted(critical_hazards, key=lambda x: x['size'], reverse=True)[0]

    obj = primary_hazard['name']
    pos = primary_hazard['pos']
    size = primary_hazard['size']

    # Context-aware feedback logic
    if pos == "CENTER":
        hardware_cmd = "ALERT: MOTOR_BOTH"
        audio_cmd = f"Stop! {obj.capitalize()} directly ahead."
    elif pos == "LEFT":
        hardware_cmd = "ALERT: MOTOR_LEFT"
        audio_cmd = f"Caution. {obj.capitalize()} on left. Move right."
    else: # RIGHT
        hardware_cmd = "ALERT: MOTOR_RIGHT"
        audio_cmd = f"Caution. {obj.capitalize()} on right. Move left."

    log_message = f"HAZARD DETECTED: {obj.upper()} at {pos} ({size:.1f}%)"
    
    return hardware_cmd, log_message, audio_cmd
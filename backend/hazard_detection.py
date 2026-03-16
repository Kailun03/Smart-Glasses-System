import cv2
import numpy as np
from ultralytics import YOLO

print("Loading Edge-Optimized YOLO Model...")
model = YOLO("yolov8n.pt") 
print("Model Loaded!")

# Global variables for Frame Throttling
frame_counter = 0
PROCESS_EVERY_N_FRAMES = 3 # Process 1 out of every 3 frames (~10 FPS)

# NOTE: We now pass the 'img' matrix directly instead of bytes!
def analyze_frame(img: np.ndarray) -> tuple[np.ndarray, str, str, str]:
    global frame_counter
    frame_counter += 1
    
    # 1. FRAME THROTTLING
    if frame_counter % PROCESS_EVERY_N_FRAMES != 0:
        return img, "SKIP", "", "" # Skip heavy processing, just return the untouched image

    if img is None:
        return img, "SAFE", "Failed to decode image", ""
        
    img_height, img_width = img.shape[:2]
    total_image_area = img_width * img_height
    
    # Define spatial boundaries
    LEFT_ZONE_MAX = img_width * 0.33
    RIGHT_ZONE_MIN = img_width * 0.66
        
    results = model(img, stream=True, verbose=False, conf=0.45)
    
    critical_hazards = []
    
    # 2. DETECTION, FILTERING & DRAWING
    for r in results:
        for box in r.boxes:
            class_id = int(box.cls[0])
            object_name = model.names[class_id]
            
            if object_name in ['car', 'person', 'truck', 'bus', 'motorcycle', 'bicycle']:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Calculate Size
                box_area = (x2 - x1) * (y2 - y1)
                area_percentage = (box_area / total_image_area) * 100
                
                if area_percentage > 15.0:
                    # Calculate Position
                    center_x = (x1 + x2) / 2
                    
                    if center_x < LEFT_ZONE_MAX:
                        position = "LEFT"
                    elif center_x > RIGHT_ZONE_MIN:
                        position = "RIGHT"
                    else:
                        position = "CENTER"
                        
                    critical_hazards.append({
                        "name": object_name, 
                        "pos": position, 
                        "size": area_percentage
                    })
                    
                    # Hazard bounding box with label
                    color = (0, 255, 0) # green color
                    
                    # Draw the bounding box
                    cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)
                    
                    # Create a solid background for the text so it's easy to read
                    label = f"{object_name.upper()} ({position})"
                    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    cv2.rectangle(img, (int(x1), int(y1) - 25), (int(x1) + text_w, int(y1)), color, -1)
                    
                    # Write the white text over the red background
                    cv2.putText(img, label, (int(x1), int(y1) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # 3. ACTION DETERMINATION
    if not critical_hazards:
        return img, "SAFE", "SAFE", "Path is clear."

    center_hazards = [h for h in critical_hazards if h['pos'] == "CENTER"]
    if center_hazards:
        primary_hazard = sorted(center_hazards, key=lambda x: x['size'], reverse=True)[0]
    else:
        primary_hazard = sorted(critical_hazards, key=lambda x: x['size'], reverse=True)[0]

    obj = primary_hazard['name']
    pos = primary_hazard['pos']
    size = primary_hazard['size']

    if pos == "CENTER":
        hardware_cmd = "ALERT: MOTOR_BOTH"
        audio_cmd = f"Stop! {obj.capitalize()} directly ahead."
    elif pos == "LEFT":
        hardware_cmd = "ALERT: MOTOR_LEFT"
        audio_cmd = f"Caution. {obj.capitalize()} on left. Move right."
    else:
        hardware_cmd = "ALERT: MOTOR_RIGHT"
        audio_cmd = f"Caution. {obj.capitalize()} on right. Move left."

    log_message = f"HAZARD DETECTED: {obj.upper()} at {pos} ({size:.1f}%)"
    
    return img, hardware_cmd, log_message, audio_cmd
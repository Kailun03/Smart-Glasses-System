import cv2
import numpy as np
from ultralytics import YOLO

print("[HAZARD DETECTION] Loading Edge-Optimized YOLO Hazard Model...")
model = YOLO("yolov8n.pt") 
print("[HAZARD DETECTION] Hazard Model Loaded!")

frame_counter = 0
PROCESS_EVERY_N_FRAMES = 3

def analyze_frame(img: np.ndarray):
    global frame_counter
    frame_counter += 1
    
    if frame_counter % PROCESS_EVERY_N_FRAMES != 0:
        return img, "SKIP", []

    if img is None:
        return img, "ERROR", []
        
    img_height, img_width = img.shape[:2]
    total_image_area = img_width * img_height
    LEFT_ZONE_MAX = img_width * 0.33
    RIGHT_ZONE_MIN = img_width * 0.66
        
    results = model(img, stream=True, verbose=False, conf=0.45)
    critical_hazards = []
    
    for r in results:
        for box in r.boxes:
            class_id = int(box.cls[0])
            object_name = model.names[class_id]
            
            if object_name in ['car', 'person', 'truck', 'bus', 'motorcycle', 'bicycle']:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # 1. Calculate Area for Depth Estimation
                box_area = (x2 - x1) * (y2 - y1)
                area_percentage = (box_area / total_image_area) * 100
                
                # 2. Determine Urgency Level based on Proximity (Area)
                # Adjust these thresholds based on your ESP32 camera lens field-of-view!
                if area_percentage > 35.0:
                    urgency = "CRITICAL"   # Object is extremely close (< 1 meter)
                    box_color = (0, 0, 255) # Red
                elif area_percentage > 15.0:
                    urgency = "WARNING"    # Object is approaching (1 - 2.5 meters)
                    box_color = (0, 165, 255) # Orange
                else:
                    continue # Object is safely far away, ignore it.

                # 3. Determine Spatial Position
                center_x = (x1 + x2) / 2
                if center_x < LEFT_ZONE_MAX: position = "LEFT"
                elif center_x > RIGHT_ZONE_MIN: position = "RIGHT"
                else: position = "CENTER"
                    
                critical_hazards.append({
                    "name": object_name, 
                    "pos": position, 
                    "size": area_percentage,
                    "urgency": urgency # Pass urgency to the alerting system
                })
                
                # 4. Draw dynamic bounding box and label
                cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), box_color, 3)
                label = f"{urgency}: {object_name.upper()} ({position})"
                (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(img, (int(x1), int(y1) - 25), (int(x1) + text_w, int(y1)), box_color, -1)
                cv2.putText(img, label, (int(x1), int(y1) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return img, "PROCESSED", critical_hazards
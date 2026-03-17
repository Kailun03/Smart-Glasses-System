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
                box_area = (x2 - x1) * (y2 - y1)
                area_percentage = (box_area / total_image_area) * 100
                
                if area_percentage > 15.0:
                    center_x = (x1 + x2) / 2
                    if center_x < LEFT_ZONE_MAX: position = "LEFT"
                    elif center_x > RIGHT_ZONE_MIN: position = "RIGHT"
                    else: position = "CENTER"
                        
                    critical_hazards.append({
                        "name": object_name, 
                        "pos": position, 
                        "size": area_percentage
                    })
                    
                    # Draw green bounding box and label
                    color = (0, 255, 0)
                    cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)
                    label = f"{object_name.upper()} ({position})"
                    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    cv2.rectangle(img, (int(x1), int(y1) - 25), (int(x1) + text_w, int(y1)), color, -1)
                    cv2.putText(img, label, (int(x1), int(y1) - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return img, "PROCESSED", critical_hazards
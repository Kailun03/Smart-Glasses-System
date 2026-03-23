import cv2
import numpy as np
from ultralytics import YOLO

print("[HAZARD DETECTION] Loading Edge-Optimized YOLO Hazard Model...")
model = YOLO("yolov8n.pt") 
print("[HAZARD DETECTION] Hazard Model Loaded!")

frame_counter = 0
PROCESS_EVERY_N_FRAMES = 3

def draw_modern_hud_box(img, x1, y1, x2, y2, color, label):
    """Draws a sleek, modern camera-style HUD bounding box."""
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    
    # 1. Draw a very thin, sleek base box
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
    
    # 2. Draw thick tech/HUD corners
    length = 20
    thickness = 4
    # Top-Left
    cv2.line(img, (x1, y1), (x1 + length, y1), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x1, y1), (x1, y1 + length), color, thickness, cv2.LINE_AA)
    # Top-Right
    cv2.line(img, (x2, y1), (x2 - length, y1), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y1), (x2, y1 + length), color, thickness, cv2.LINE_AA)
    # Bottom-Left
    cv2.line(img, (x1, y2), (x1 + length, y2), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x1, y2), (x1, y2 - length), color, thickness, cv2.LINE_AA)
    # Bottom-Right
    cv2.line(img, (x2, y2), (x2 - length, y2), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y2), (x2, y2 - length), color, thickness, cv2.LINE_AA)

    # 3. Modern sleek label bar
    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.rectangle(img, (x1, y1 - 24), (x1 + text_w + 16, y1), color, -1)
    
    # Auto-adjust text color for readability (Dark text on bright boxes, White text on dark boxes)
    text_color = (0, 0, 0) if sum(color) > 400 else (255, 255, 255)
    cv2.putText(img, label, (x1 + 8, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, text_color, 1, cv2.LINE_AA)

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
                
                if area_percentage > 35.0:
                    urgency = "CRITICAL"   
                    box_color = (40, 40, 255) # Deep Red (BGR)
                elif area_percentage > 15.0:
                    urgency = "WARNING"    
                    box_color = (0, 165, 255) # Bright Orange (BGR)
                else:
                    continue 

                center_x = (x1 + x2) / 2
                if center_x < LEFT_ZONE_MAX: position = "LEFT"
                elif center_x > RIGHT_ZONE_MIN: position = "RIGHT"
                else: position = "CENTER"
                    
                critical_hazards.append({
                    "name": object_name, 
                    "pos": position, 
                    "size": area_percentage,
                    "urgency": urgency
                })
                
                label = f"{urgency}: {object_name.upper()} ({position})"
                draw_modern_hud_box(img, x1, y1, x2, y2, box_color, label)

    return img, "PROCESSED", critical_hazards
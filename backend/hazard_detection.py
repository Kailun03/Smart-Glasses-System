import threading
import cv2
import numpy as np
from ultralytics import YOLO

from database import get_valid_hazard_names

_model = None
_model_lock = threading.Lock()

_valid_hazards = None
_hazards_lock = threading.Lock()

def _get_hazard_model():
    global _model
    with _model_lock:
        if _model is None:
            print("[HAZARD DETECTION] Loading Custom Hazard Model...")
            _model = YOLO("custom_hazard.pt")
            print("[HAZARD DETECTION] Hazard Model Loaded!")
    return _model

def _get_valid_hazards():
    """Ensures we only ask the database for the hazard list ONCE."""
    global _valid_hazards
    
    with _hazards_lock:
        if _valid_hazards is None:
            from database import get_valid_hazard_names
            _valid_hazards = get_valid_hazard_names()
            
    return _valid_hazards

frame_counter = 0
PROCESS_EVERY_N_FRAMES = 3
last_drawn_boxes = []

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

def analyze_frame(img: np.ndarray, conf_threshold=0.75):
    global frame_counter, last_drawn_boxes
    frame_counter += 1

    if img is None:
        return img, "ERROR", []

    if frame_counter % PROCESS_EVERY_N_FRAMES != 0:
        for box_args in last_drawn_boxes:
            draw_modern_hud_box(img, *box_args)
        return img, "SKIP", []
        
    img_height, img_width = img.shape[:2]
    total_image_area = img_width * img_height
    LEFT_ZONE_MAX = img_width * 0.33
    RIGHT_ZONE_MIN = img_width * 0.66
        
    model = _get_hazard_model()
    results = model(img, stream=True, verbose=False, conf=conf_threshold)
    critical_hazards = []
    
    new_drawn_boxes = []

    valid_hazards = _get_valid_hazards()

    for r in results:
        for box in r.boxes:
            class_id = int(box.cls[0])
            object_name = model.names[class_id]
            
            # 1. Let's grab the confidence score to see if YOLO is struggling to see
            confidence = float(box.conf[0])
            
            if object_name in valid_hazards:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                box_area = (x2 - x1) * (y2 - y1)
                area_percentage = (box_area / total_image_area) * 100
                
                # 2. LOWER THE THRESHOLDS FOR TESTING!
                if area_percentage > 35.0:
                    urgency = "CRITICAL"   
                    box_color = (40, 40, 255) 
                elif area_percentage > 5.0:  # Changed from 15.0 to 5.0!
                    urgency = "WARNING"    
                    box_color = (0, 165, 255)
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
                new_drawn_boxes.append((x1, y1, x2, y2, box_color, label))

    last_drawn_boxes = new_drawn_boxes
    
    return img, "PROCESSED", critical_hazards
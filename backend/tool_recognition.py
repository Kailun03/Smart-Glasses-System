from __future__ import annotations
import os
import math
from typing import Any, Dict, List, Tuple
import cv2
import numpy as np
import mediapipe as mp

try:
    from ultralytics import YOLO
except Exception:  
    YOLO = None

DEFAULT_WEIGHTS = os.getenv("TOOLS_MODEL_PATH", "yolov8n.pt")

print("[TOOL RECOGNITION] Initializing Tool Recognition Module...")
_model = None
if YOLO is not None:
    try:
        _model = YOLO(DEFAULT_WEIGHTS)
        print(f"[TOOL RECOGNITION] Model loaded: {DEFAULT_WEIGHTS}")
    except Exception as e:  
        _model = None
        print(f"[TOOL RECOGNITION] WARNING: Failed to load model ({DEFAULT_WEIGHTS}): {e}")

# Initialize MediaPipe Hand Tracking (Legacy API)
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands_tracker = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1, 
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def draw_modern_hud_box(img, x1, y1, x2, y2, color, label):
    """Draws a sleek, modern camera-style HUD bounding box."""
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
    
    length = 20
    thickness = 4
    cv2.line(img, (x1, y1), (x1 + length, y1), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x1, y1), (x1, y1 + length), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y1), (x2 - length, y1), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y1), (x2, y1 + length), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x1, y2), (x1 + length, y2), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x1, y2), (x1, y2 - length), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y2), (x2 - length, y2), color, thickness, cv2.LINE_AA)
    cv2.line(img, (x2, y2), (x2, y2 - length), color, thickness, cv2.LINE_AA)

    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.rectangle(img, (x1, y1 - 24), (x1 + text_w + 16, y1), color, -1)
    text_color = (0, 0, 0) if sum(color) > 400 else (255, 255, 255)
    cv2.putText(img, label, (x1 + 8, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, text_color, 1, cv2.LINE_AA)

def analyze_tools(
    img: np.ndarray,
    target_tool: str = None,
    conf: float = 0.35,
    tool_map: Dict[str, str] | None = None, # NEW: Maps YOLO class to Friendly Name
) -> Tuple[np.ndarray, List[Dict[str, Any]], str]:
    if img is None or _model is None:
        return img, [], ""

    results = _model(img, stream=False, verbose=False, conf=conf)
    detected: List[Dict[str, Any]] = []
    
    target_box = None
    annotated_img = img.copy()

    for r in results:
        for box in getattr(r, "boxes", []):
            class_id = int(box.cls[0])
            name = str(_model.names.get(class_id, class_id)).lower()
            
            display_name = name.upper()
            
            # THE MAGIC: Filter by Database and swap to Friendly Name!
            if tool_map is not None:
                if name not in tool_map:
                    continue # Ignore tools not registered in the cloud
                display_name = tool_map[name].upper()

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)
            
            detected.append({
                "name": display_name.title(), 
                "yolo_class": name, 
                "bbox": [float(x1), float(y1), float(x2), float(y2)]
            })

            color = (255, 160, 50) # Sleek Blue 
            
            if target_tool and target_tool.lower() in display_name.lower():
                target_box = (center_x, center_y, x1, y1, x2, y2)
                color = (0, 255, 255) # Electric Yellow for target

            draw_modern_hud_box(annotated_img, x1, y1, x2, y2, color, display_name)

    if not target_tool:
        return annotated_img, detected, ""

    if target_tool and target_box is None:
        return annotated_img, detected, f"{target_tool} not in view. Scan the area."

    rgb_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
    hand_results = hands_tracker.process(rgb_img)

    if not hand_results.multi_hand_landmarks:
        return annotated_img, detected, "Tool found. Show your hand to begin guidance."

    h, w, c = annotated_img.shape
    hand_landmarks = hand_results.multi_hand_landmarks[0]
    
    custom_node_spec = mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=2)
    custom_line_spec = mp_drawing.DrawingSpec(color=(255, 230, 0), thickness=2) # Cyan (BGR)
    
    mp_drawing.draw_landmarks(annotated_img, hand_landmarks, mp_hands.HAND_CONNECTIONS, custom_node_spec, custom_line_spec)

    index_finger = hand_landmarks.landmark[8]
    thumb_finger = hand_landmarks.landmark[4]
    
    hand_x = int(index_finger.x * w)
    hand_y = int(index_finger.y * h)
    t_cx, t_cy, t_x1, t_y1, t_x2, t_y2 = target_box

    cv2.circle(annotated_img, (hand_x, hand_y), 8, (0, 255, 255), 2, cv2.LINE_AA) 
    cv2.circle(annotated_img, (hand_x, hand_y), 3, (0, 255, 255), -1, cv2.LINE_AA) 
    
    cv2.circle(annotated_img, (t_cx, t_cy), 8, (255, 0, 255), 2, cv2.LINE_AA) 
    cv2.circle(annotated_img, (t_cx, t_cy), 3, (255, 0, 255), -1, cv2.LINE_AA) 
    
    cv2.line(annotated_img, (hand_x, hand_y), (t_cx, t_cy), (0, 255, 255), 1, cv2.LINE_AA)

    pinch_dist = math.hypot(index_finger.x - thumb_finger.x, index_finger.y - thumb_finger.y)

    if t_x1 <= hand_x <= t_x2 and t_y1 <= hand_y <= t_y2:
        if pinch_dist < 0.05:
            return annotated_img, detected, "Tool secured. Grab it now."
        else:
            return annotated_img, detected, "Hand is over the tool. Pinch fingers to grab."

    dx = t_cx - hand_x
    dy = t_cy - hand_y
    
    horizontal_dir = "right" if dx > 0 else "left"
    vertical_dir = "down" if dy > 0 else "up" 
    
    instructions = []
    if abs(dx) > 50: instructions.append(horizontal_dir)
    if abs(dy) > 50: instructions.append(vertical_dir)

    if instructions:
        guidance_text = "Move hand " + " and ".join(instructions)
    else:
        guidance_text = "Move forward."

    return annotated_img, detected, guidance_text
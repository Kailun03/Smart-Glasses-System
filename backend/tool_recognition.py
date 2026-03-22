from __future__ import annotations
import os
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
    max_num_hands=1, # Only track one hand for guidance
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def analyze_tools(
    img: np.ndarray,
    target_tool: str = None,
    conf: float = 0.35,
    allowed_classes: List[str] | None = None,
) -> Tuple[np.ndarray, List[Dict[str, Any]], str]:
    """
    Returns: (annotated_image, detected_tools_list, guidance_instruction_string)
    """
    if img is None or _model is None:
        return img, [], ""

    # 1. Run YOLOv8 Tool Detection
    results = _model(img, stream=False, verbose=False, conf=conf)
    detected: List[Dict[str, Any]] = []
    
    target_box = None
    annotated_img = img.copy()

    for r in results:
        for box in getattr(r, "boxes", []):
            class_id = int(box.cls[0])
            name = str(_model.names.get(class_id, class_id)).lower()
            
            if allowed_classes and name not in allowed_classes:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            center_x = int((x1 + x2) / 2)
            center_y = int((y1 + y2) / 2)
            
            detected.append({"name": name, "bbox": [float(x1), float(y1), float(x2), float(y2)]})

            # Highlight the tool
            color = (255, 120, 50) 
            # If this is the tool we are searching for, highlight it brightly!
            if target_tool and target_tool.lower() in name:
                target_box = (center_x, center_y, x1, y1, x2, y2)
                color = (0, 255, 255) # Yellow for target

            cv2.rectangle(annotated_img, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
            cv2.putText(annotated_img, name.upper(), (int(x1), max(int(y1) - 8, 0)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # If we are NOT in target guidance mode, just return the tools
    if not target_tool:
        return annotated_img, detected, ""

    # If target is requested but not found
    if target_tool and target_box is None:
        return annotated_img, detected, f"{target_tool} not in view. Scan the area."

    # 2. Target found! Run MediaPipe Hand Tracking
    rgb_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
    hand_results = hands_tracker.process(rgb_img)

    if not hand_results.multi_hand_landmarks:
        return annotated_img, detected, "Tool found. Show your hand to begin guidance."

    # 3. Calculate Guidance Vector (Hand to Tool)
    h, w, c = annotated_img.shape
    hand_landmarks = hand_results.multi_hand_landmarks[0]
    
    # Draw hand skeleton for visual feedback on dashboard
    mp_drawing.draw_landmarks(annotated_img, hand_landmarks, mp_hands.HAND_CONNECTIONS)

    # Use the Index Finger Tip (Landmark 8) as the grabbing point
    index_finger = hand_landmarks.landmark[8]
    hand_x = int(index_finger.x * w)
    hand_y = int(index_finger.y * h)
    
    cv2.circle(annotated_img, (hand_x, hand_y), 10, (0, 255, 0), -1) # Draw green dot on finger

    # Unpack target tool coordinates
    t_cx, t_cy, t_x1, t_y1, t_x2, t_y2 = target_box

    # Draw a line from the hand to the tool
    cv2.line(annotated_img, (hand_x, hand_y), (t_cx, t_cy), (0, 255, 0), 2)

    # Check if hand is INSIDE the tool bounding box
    if t_x1 <= hand_x <= t_x2 and t_y1 <= hand_y <= t_y2:
        return annotated_img, detected, "Hand is on the tool. Grab it now."

    # Calculate directions
    dx = t_cx - hand_x
    dy = t_cy - hand_y
    
    horizontal_dir = "right" if dx > 0 else "left"
    vertical_dir = "down" if dy > 0 else "up" # Y-axis is inverted in images
    
    # Threshold to ignore tiny movements (50 pixels)
    instructions = []
    if abs(dx) > 50: instructions.append(horizontal_dir)
    if abs(dy) > 50: instructions.append(vertical_dir)

    if instructions:
        guidance_text = "Move hand " + " and ".join(instructions)
    else:
        guidance_text = "Move forward to grab."

    return annotated_img, detected, guidance_text
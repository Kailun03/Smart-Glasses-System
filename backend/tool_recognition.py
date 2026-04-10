from __future__ import annotations
import os
import math
import threading
from typing import Any, Dict, List, Tuple
import cv2
import numpy as np

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None

# --- DUAL-MODEL ARCHITECTURE ---
BASE_WEIGHTS = "yolov8n.pt"
# Mutable path: auto_trainer assigns DEFAULT_WEIGHTS after training.
DEFAULT_WEIGHTS = os.getenv("TOOLS_MODEL_PATH", "custom_tools_v1.pt")

_load_lock = threading.Lock()
_base_model = None
_custom_model = None
hands_tracker = None
# Set only after lazy init in _ensure_hands() (mediapipe must not touch mp.solutions at import time).
_mp_hands_mod = None
_mp_drawing_mod = None
_hands_init_failed = False


def _ensure_yolo_models() -> None:
    global _base_model, _custom_model
    if YOLO is None:
        return
    with _load_lock:
        if _base_model is None:
            try:
                _base_model = YOLO(BASE_WEIGHTS)
                print(f"[TOOL RECOGNITION] Base COCO model loaded: {BASE_WEIGHTS}")
            except Exception as e:
                print(f"[TOOL RECOGNITION] WARNING: Failed to load base model: {e}")
        if _custom_model is None:
            if os.path.exists(DEFAULT_WEIGHTS):
                try:
                    _custom_model = YOLO(DEFAULT_WEIGHTS)
                except Exception as e:
                    print(f"[TOOL RECOGNITION] WARNING: Failed to load custom model: {e}")


def _ensure_hands():
    """Lazy-init MediaPipe hands. Newer mediapipe (0.10.31+) has no mp.solutions — pin to 0.10.30 or migrate to Tasks API."""
    global hands_tracker, _mp_hands_mod, _mp_drawing_mod, _hands_init_failed
    if _hands_init_failed:
        return None
    with _load_lock:
        if hands_tracker is None and not _hands_init_failed:
            try:
                import mediapipe as mp_pkg
                if not hasattr(mp_pkg, "solutions"):
                    print(
                        "[TOOL RECOGNITION] MediaPipe has no 'solutions' (install mediapipe==0.10.30). "
                        "Hand guidance disabled; server will stay up."
                    )
                    _hands_init_failed = True
                    return None
                _mp_hands_mod = mp_pkg.solutions.hands
                _mp_drawing_mod = mp_pkg.solutions.drawing_utils
                hands_tracker = _mp_hands_mod.Hands(
                    static_image_mode=False,
                    max_num_hands=1,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                print("[TOOL RECOGNITION] MediaPipe hands tracker initialized.")
            except Exception as e:
                print(f"[TOOL RECOGNITION] MediaPipe hands init failed: {e}")
                _hands_init_failed = True
                return None
    return hands_tracker

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

def calculate_iou(box1, box2):
    """Calculates the Intersection over Union (IoU) of two bounding boxes."""
    x_left = max(box1[0], box2[0])
    y_top = max(box1[1], box2[1])
    x_right = min(box1[2], box2[2])
    y_bottom = min(box1[3], box2[3])

    if x_right < x_left or y_bottom < y_top:
        return 0.0

    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])

    return intersection_area / float(box1_area + box2_area - intersection_area)

def analyze_tools(
    img: np.ndarray,
    target_tool: str = None,
    tool_map: Dict[str, str] | None = None,
) -> Tuple[np.ndarray, List[Dict[str, Any]], str]:
    if img is None:
        return img, [], ""

    _ensure_yolo_models()

    detected: List[Dict[str, Any]] = []
    base_boxes = []
    target_box = None
    annotated_img = img.copy()

    # --- AGENT 1: BASE COCO INFERENCE (Finds Laptops, Cups, etc.) ---
    if _base_model is not None:
        results = _base_model(img, stream=False, verbose=False, conf=0.50)
        for r in results:
            for box in getattr(r, "boxes", []):
                class_id = int(box.cls[0])
                name = str(_base_model.names.get(class_id, class_id)).lower()
                
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                base_boxes.append([x1, y1, x2, y2])

                # Filter: ONLY draw it if the user registered it in the database!
                if tool_map is not None and name in tool_map:
                    display_name = tool_map[name].upper()
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    
                    detected.append({"name": display_name.title(), "yolo_class": name, "bbox": [float(x1), float(y1), float(x2), float(y2)]})
                    
                    color = (255, 160, 50)
                    if target_tool and target_tool.lower() in display_name.lower():
                        target_box = (cx, cy, x1, y1, x2, y2)
                        color = (0, 255, 255) # Electric Yellow for target
                    
                    draw_modern_hud_box(annotated_img, x1, y1, x2, y2, color, f"{display_name}")

    # --- AGENT 2: CUSTOM SPECIALIST INFERENCE ---
    if _custom_model is not None:
        # NOTE: Custom models need high confidence (0.80+) to prevent guessing!
        custom_results = _custom_model(img, stream=False, verbose=False, conf=0.5) 
        for r in custom_results:
            for box in getattr(r, "boxes", []):
                class_id = int(box.cls[0])
                name = str(_custom_model.names.get(class_id, class_id)).lower()
                
                # Filter: ONLY draw it if the user registered it in the database!
                if tool_map is not None and name in tool_map:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    custom_box = [x1, y1, x2, y2]
                    
                    # FACT CHECK: Does this overlap with a known base object (like the laptop)?
                    is_hallucination = False
                    for b_box in base_boxes:
                        iou = calculate_iou(custom_box, b_box)
                        if iou > 0.4: # If 40% of the box overlaps with a laptop, it's a hallucination!
                            is_hallucination = True
                            break
                            
                    if is_hallucination:
                        continue # Skip drawing this box!

                    display_name = tool_map[name].upper()
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    detected.append({"name": display_name.title(), "yolo_class": name, "bbox": [float(x1), float(y1), float(x2), float(y2)]})
                    
                    color = (255, 160, 50)
                    if target_tool and target_tool.lower() in display_name.lower():
                        target_box = (cx, cy, x1, y1, x2, y2)
                        color = (0, 255, 255) # Electric Yellow for target
                    
                    draw_modern_hud_box(annotated_img, x1, y1, x2, y2, color, f"{display_name}")

    # --- GUIDANCE LOGIC ---
    if not target_tool:
        return annotated_img, detected, ""

    if target_tool and target_box is None:
        return annotated_img, detected, f"{target_tool} not in view. Scan the area."

    rgb_img = cv2.cvtColor(annotated_img, cv2.COLOR_BGR2RGB)
    tracker = _ensure_hands()
    if tracker is None:
        return (
            annotated_img,
            detected,
            "Tool found. Hand guidance needs MediaPipe <0.10.31 (e.g. mediapipe==0.10.30) on the server.",
        )
    hand_results = tracker.process(rgb_img)

    if not hand_results.multi_hand_landmarks:
        return annotated_img, detected, "Tool found. Show your hand to begin guidance."

    h, w, c = annotated_img.shape
    hand_landmarks = hand_results.multi_hand_landmarks[0]

    custom_node_spec = _mp_drawing_mod.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=2)
    custom_line_spec = _mp_drawing_mod.DrawingSpec(color=(255, 230, 0), thickness=2)
    _mp_drawing_mod.draw_landmarks(
        annotated_img,
        hand_landmarks,
        _mp_hands_mod.HAND_CONNECTIONS,
        custom_node_spec,
        custom_line_spec,
    )

    index_finger = hand_landmarks.landmark[8]
    thumb_finger = hand_landmarks.landmark[4]
    
    hand_x, hand_y = int(index_finger.x * w), int(index_finger.y * h)
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

    dx, dy = t_cx - hand_x, t_cy - hand_y
    horizontal_dir = "right" if dx > 0 else "left"
    vertical_dir = "down" if dy > 0 else "up" 
    
    instructions = []
    if abs(dx) > 50: instructions.append(horizontal_dir)
    if abs(dy) > 50: instructions.append(vertical_dir)

    guidance_text = "Move hand " + " and ".join(instructions) if instructions else "Move forward."
    return annotated_img, detected, guidance_text

def reload_model():
    """Forces the system to drop the old CUSTOM model from RAM and load the newly trained one."""
    global _custom_model
    print(f"[TOOL RECOGNITION] Hot-reloading custom model from {DEFAULT_WEIGHTS}...")
    if YOLO is not None and os.path.exists(DEFAULT_WEIGHTS):
        with _load_lock:
            try:
                _custom_model = YOLO(DEFAULT_WEIGHTS)
                print("[TOOL RECOGNITION] SUCCESS: New tool model hot-swapped into memory!")
                return True
            except Exception as e:
                print(f"[TOOL RECOGNITION ERROR] Failed to hot-reload model: {e}")
                return False
    return False
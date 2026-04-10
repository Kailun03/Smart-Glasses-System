import threading
import easyocr
import cv2
import numpy as np

_reader = None
_reader_lock = threading.Lock()


def _get_reader():
    global _reader
    with _reader_lock:
        if _reader is None:
            print("[OCR] Loading OCR Engine...")
            _reader = easyocr.Reader(["en"], gpu=False)
            print("[OCR] OCR Engine Loaded!")
    return _reader

SAFETY_KEYWORDS = ["danger", "warning", "stop", "caution", "restricted", "hazard"]

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
    
    # Prevent label from clipping off the top of the screen
    label_y1 = max(0, y1 - 24)
    cv2.rectangle(img, (x1, label_y1), (x1 + text_w + 16, label_y1 + 24), color, -1)
    text_color = (0, 0, 0) if sum(color) > 400 else (255, 255, 255)
    cv2.putText(img, label, (x1 + 8, label_y1 + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, text_color, 1, cv2.LINE_AA)


def _preprocess(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def analyze_text(img: np.ndarray):
    """Full OCR scan returning an annotated image."""
    if img is None:
        return img, "", []

    processed = _preprocess(img)
    results = _get_reader().readtext(processed)
    
    annotated_img = img.copy()
    full_text_list = []
    detected_keywords = []

    for (bbox, text, prob) in results:
        full_text_list.append(text)
        lower_text = text.lower()
        
        # Check if it's a safety keyword
        found_kws = [kw for kw in SAFETY_KEYWORDS if kw in lower_text]
        if found_kws:
            detected_keywords.extend(found_kws)
            color = (0, 0, 255) # Red for danger
            label = f"DANGER: {text.upper()}"
        else:
            color = (255, 200, 0) # Cyan/Blue for normal text
            label = text.upper()
            
        # Convert 4-point EasyOCR polygon to standard x1, y1, x2, y2 bounding box
        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]
        x1, y1, x2, y2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
        
        draw_modern_hud_box(annotated_img, x1, y1, x2, y2, color, label)

    full_text = " ".join(full_text_list).strip()
    return annotated_img, full_text, list(set(detected_keywords))


def scan_safety_keywords(img: np.ndarray):
    """Lightweight background scan returning an annotated image."""
    if img is None:
        return img, [], ""

    processed = _preprocess(img)
    allowed_chars = "".join(SAFETY_KEYWORDS).upper() + "".join(SAFETY_KEYWORDS).lower() + " "
    allowlist = "".join(sorted(set(allowed_chars)))
    
    # Changed detail=0 to detail=1 so EasyOCR returns bounding boxes!
    results = _get_reader().readtext(processed, allowlist=allowlist, detail=1)
    
    annotated_img = img.copy()
    detected_keywords = []
    full_text_list = []
    
    for (bbox, text, prob) in results:
        lower_text = text.lower()
        found_kws = [kw for kw in SAFETY_KEYWORDS if kw in lower_text]
        
        if found_kws:
            detected_keywords.extend(found_kws)
            full_text_list.append(text)
            
            xs = [pt[0] for pt in bbox]
            ys = [pt[1] for pt in bbox]
            x1, y1, x2, y2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
            
            draw_modern_hud_box(annotated_img, x1, y1, x2, y2, (0, 0, 255), f"WARNING: {text.upper()}")

    text_str = " ".join(full_text_list).strip()
    return annotated_img, list(set(detected_keywords)), text_str
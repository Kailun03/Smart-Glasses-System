import easyocr
import cv2
import numpy as np

print("[OCR] Loading OCR Engine...")
reader = easyocr.Reader(['en'], gpu=False) 
print("[OCR] OCR Engine Loaded!")

SAFETY_KEYWORDS = ["danger", "warning", "stop", "caution", "restricted", "hazard"]

def _preprocess(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    return cv2.filter2D(gray, -1, kernel)


def analyze_text(img: np.ndarray):
    """
    Full OCR scan (reactive / on-demand friendly).
    Returns (full_text, detected_safety_keywords).
    """
    if img is None:
        return "", []

    processed = _preprocess(img)
    results = reader.readtext(processed)
    full_text = " ".join([res[1] for res in results]).strip()

    lower_text = full_text.lower()
    detected_keywords = [kw for kw in SAFETY_KEYWORDS if kw in lower_text]
    return full_text, detected_keywords


def scan_safety_keywords(img: np.ndarray):
    """
    Lightweight proactive scan focused on safety keywords.
    Returns (detected_keywords, raw_text_snippet).

    Note: easyocr doesn't support true streaming-lite inference, but using an allowlist
    reduces recognition complexity in practice.
    """
    if img is None:
        return [], ""

    processed = _preprocess(img)
    allowlist = "".join(sorted(set("".join(SAFETY_KEYWORDS).upper() + " ")))
    results = reader.readtext(processed, allowlist=allowlist, detail=0)
    text = " ".join(results).strip()
    lower_text = text.lower()
    detected_keywords = [kw for kw in SAFETY_KEYWORDS if kw in lower_text]
    return detected_keywords, text
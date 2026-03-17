import easyocr
import cv2
import numpy as np

print("[OCR] Loading OCR Engine...")
reader = easyocr.Reader(['en'], gpu=False) 
print("[OCR] OCR Engine Loaded!")

SAFETY_KEYWORDS = ["danger", "warning", "stop", "caution", "restricted", "hazard"]

def analyze_text(img: np.ndarray):
    if img is None: return "", []

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    
    results = reader.readtext(sharpened)
    full_text = " ".join([res[1] for res in results])
    
    # Proactive safety keyword scan
    lower_text = full_text.lower()
    detected_keywords = [kw for kw in SAFETY_KEYWORDS if kw in lower_text]
    
    return full_text.strip(), detected_keywords
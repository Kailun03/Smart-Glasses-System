import easyocr
import cv2
import numpy as np

# Initialize the reader (English only for now to keep it fast)
# gpu=False because we are running in WSL/CPU mode
print("Loading OCR Engine...")
reader = easyocr.Reader(['en'], gpu=False) 
print("OCR Engine Loaded!")

def read_text_from_bytes(image_bytes):
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if img is None:
        return ""

    # --- NEW PRE-PROCESSING ---
    # 1. Convert to grayscale (OCR prefers black and white)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Sharpen the image slightly
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(gray, -1, kernel)
    
    # Run OCR on the sharpened image
    results = reader.readtext(sharpened)
    # --------------------------
    
    full_text = " ".join([res[1] for res in results])
    return full_text.strip()
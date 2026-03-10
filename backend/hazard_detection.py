import cv2
import numpy as np
from ultralytics import YOLO

print("Loading YOLO Model...")
model = YOLO("yolov8n.pt") 
print("Model Loaded!")

def analyze_frame(image_bytes: bytes) -> tuple[str, str]:
    # Decode bytes into an OpenCV image array
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    if img is None:
        return "SAFE", "Failed to decode image"
        
    # Get the total area of the camera frame (width * height)
    img_height, img_width = img.shape[:2]
    total_image_area = img_width * img_height
        
    results = model(img, stream=True, verbose=False)
    
    hazard_detected = False
    detected_objects = []
    
    for r in results:
        for box in r.boxes:
            class_id = int(box.cls[0])
            object_name = model.names[class_id]
            
            # Check if it is a hazard category
            if object_name in ['car', 'person', 'truck', 'bus', 'motorcycle']:
                
                # Get bounding box coordinates (x1, y1, x2, y2)
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                # Calculate how much of the screen this object takes up
                box_width = x2 - x1
                box_height = y2 - y1
                box_area = box_width * box_height
                area_percentage = (box_area / total_image_area) * 100
                
                # PROXIMITY FILTER: Only trigger if the object takes up more than 15% of the screen
                if area_percentage > 15.0:
                    hazard_detected = True
                    # Log the object and its size for debugging
                    detected_objects.append(f"{object_name} ({area_percentage:.1f}%)")
    
    if hazard_detected:
        log_message = f"HAZARD DETECTED: {', '.join(detected_objects)}"
        return "ALERT: MOTOR_ON", log_message
    else:
        return "SAFE", "SAFE"
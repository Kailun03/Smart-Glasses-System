import os
import cv2
import yaml
import shutil
import numpy as np
from ultralytics import YOLO
import database 
import tool_recognition
import traceback

MASTER_DATASET_DIR = "custom_datasets/master"

active_training_flags = {}

def get_opencv_box(image_bytes):
    """Runs OpenCV purely in memory and returns box percentages for React."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: return None
    
    img_h, img_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    blurred = cv2.GaussianBlur(gray, (11, 11), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours: return None
        
    valid_contours = []
    screen_area = img_w * img_h
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if area > (screen_area * 0.90): continue
        if area < (screen_area * 0.005): continue
        valid_contours.append(c)

    if not valid_contours: return None

    largest_contour = max(valid_contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest_contour)
    
    pad_w, pad_h = int(w * 0.10), int(h * 0.10)
    x = max(0, x - pad_w)
    y = max(0, y - pad_h)
    w = min(img_w - x, w + (pad_w * 2))
    h = min(img_h - y, h + (pad_h * 2))
    
    return {
        "x": (x / img_w) * 100,
        "y": (y / img_h) * 100,
        "w": (w / img_w) * 100,
        "h": (h / img_h) * 100
    }

def run_training_pipeline(tool_id: int, tool_name: str, yolo_class: str, image_paths: list, boxes: list, user_id: str):
    # Initialize flag for this specific session
    active_training_flags[tool_id] = False
    
    try:
        database.update_tool_status(tool_id, "PROCESSING_DATA")
        print(f"[AUTO-TRAIN] Starting Enhanced Few-Shot Pipeline for {tool_name}...")

        images_dir = os.path.join(MASTER_DATASET_DIR, "images/train")
        labels_dir = os.path.join(MASTER_DATASET_DIR, "labels/train")
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(labels_dir, exist_ok=True)
        
        # Purge YOLO's hidden cache so it doesn't ignore new data
        cache_file = os.path.join(labels_dir, "train.cache")
        if os.path.exists(cache_file):
            os.remove(cache_file)
            print("[AUTO-TRAIN] Purged old YOLO cache.")
        
        # Get the latest tools for this specific user
        all_tools = database.get_all_tools(user_id)
        
        # Create a dictionary to map tool names to their NEW correct index
        valid_classes = {t['tool_name'].lower().replace(" ", "_"): idx for idx, t in enumerate(all_tools)}
        class_id = valid_classes.get(yolo_class, len(all_tools) - 1)
        
        valid_images = 0
        
        # 1. Write the newly uploaded tool's images and labels
        for i, (img_path, box) in enumerate(zip(image_paths, boxes)):
            filename = f"{yolo_class}_{i}" 
            new_img_path = os.path.join(images_dir, f"{filename}.jpg")
            label_path = os.path.join(labels_dir, f"{filename}.txt")
            
            shutil.copy(img_path, new_img_path)
            
            if box is None:
                with open(label_path, "w") as f: pass
            else:
                x_pct = max(0.0, min(box['x'] / 100.0, 1.0))
                y_pct = max(0.0, min(box['y'] / 100.0, 1.0))
                w_pct = max(0.01, min(box['w'] / 100.0, 1.0))
                h_pct = max(0.01, min(box['h'] / 100.0, 1.0))
                
                cx = max(0.001, min(x_pct + (w_pct / 2.0), 0.999))
                cy = max(0.001, min(y_pct + (h_pct / 2.0), 0.999))
                
                with open(label_path, "w") as f:
                    f.write(f"{class_id} {cx:.6f} {cy:.6f} {w_pct:.6f} {h_pct:.6f}\n")
                valid_images += 1
                
        if valid_images < 10:
            print("[AUTO-TRAIN WARNING] Less than 10 valid images detected.")

        # 2. DATASET SELF-HEALING (Fixes the IndexError!)
        print("[AUTO-TRAIN] Cleaning up deleted tools and re-aligning class IDs...")
        for label_file in os.listdir(labels_dir):
            if not label_file.endswith(".txt"): continue
            
            base_name = label_file[:-4] # Remove .txt
            last_us = base_name.rfind('_')
            
            if last_us != -1:
                class_name_in_file = base_name[:last_us]
                
                # If this tool was deleted from the database, wipe its files
                if class_name_in_file not in valid_classes:
                    os.remove(os.path.join(labels_dir, label_file))
                    img_path = os.path.join(images_dir, base_name + ".jpg")
                    if os.path.exists(img_path): 
                        os.remove(img_path)
                else:
                    # If it exists, update the .txt file to guarantee the ID matches the database
                    correct_id = valid_classes[class_name_in_file]
                    filepath = os.path.join(labels_dir, label_file)
                    with open(filepath, "r") as f:
                        lines = f.readlines()
                    
                    if lines:
                        new_lines = []
                        for line in lines:
                            parts = line.strip().split()
                            if len(parts) >= 5:
                                parts[0] = str(correct_id) # Override with correct ID
                                new_lines.append(" ".join(parts) + "\n")
                        with open(filepath, "w") as f:
                            f.writelines(new_lines)

        # 3. Create the data.yaml
        yaml_path = os.path.join(MASTER_DATASET_DIR, "data.yaml")
        yaml_data = {
            "train": "images/train",
            "val": "images/train",
            "nc": len(all_tools),
            "names": [t['tool_name'].lower().replace(" ", "_") for t in all_tools]
        }
        with open(yaml_path, "w") as f:
            yaml.dump(yaml_data, f)

        # 4. Train the Model 
        database.update_tool_status(tool_id, "TRAINING")
        database.add_notification(f"Started advanced neural training for {tool_name}.", user_id, "info")
        
        model = YOLO("yolov8n.pt") 
        project_path = os.path.abspath("SGS_Updates")
        
        # Stop Callback Function
        def on_train_epoch_end(trainer):
            if active_training_flags.get(tool_id):
                print(f"[AUTO-TRAIN] Cancellation signal received for {tool_name}. Aborting...")
                raise Exception("Training Cancelled by User")

        model.add_callback("on_train_epoch_end", on_train_epoch_end)

        # Few-Shot Optimization Hyperparameters
        results = model.train(
            data=yaml_path, 
            epochs=100, 
            patience=15,          # Stop early if not improving
            imgsz=640, 
            batch=4, 
            workers=0, 
            project=project_path,
            name="master_model", 
            exist_ok=True,
            
            # --- The "Magic" Fine-Tuning Settings ---
            freeze=10,            # Locks the backbone so it doesn't forget general shapes
            lr0=0.001,            # Slower learning rate prevents destroying pretrained weights
            dropout=0.15,         # Randomly drops neurons to prevent memorization/overfitting
            mosaic=1.0,           # Forces aggressive image mixing
            degrees=15.0,         # Rotation variation
            
            # Standard augments
            hsv_h=0.015, hsv_s=0.7, hsv_v=0.4, 
            translate=0.1, scale=0.5, fliplr=0.5 
        )
        
        # 5. Hot-Swap
        weights_dir = os.path.join(project_path, "master_model", "weights")
        best_pt = os.path.join(weights_dir, "best.pt")
        last_pt = os.path.join(weights_dir, "last.pt")
        
        new_weights = best_pt if os.path.exists(best_pt) else last_pt
        if not os.path.exists(new_weights):
            raise FileNotFoundError("YOLO training failed to generate weights.")
            
        active_model_path = os.getenv("TOOLS_MODEL_PATH", "custom_tools_v1.pt")
        shutil.copy(new_weights, active_model_path) 
        
        tool_recognition.DEFAULT_WEIGHTS = active_model_path
        tool_recognition.reload_model() 
        
        database.update_tool_status(tool_id, "DEPLOYED")
        database.add_notification(f"Successfully deployed highly robust model for {tool_name}!", user_id, "success")
        print(f"[AUTO-TRAIN] Success! Highly robust HITL model deployed.")
        
    except Exception as e:
        if str(e) == "Training Cancelled by User":
            database.add_notification(f"Training for {tool_name} was aborted.", user_id, "error")
        else:
            print(f"[CRITICAL TRAINING ERROR]: {e}")
            traceback.print_exc()
            database.update_tool_status(tool_id, "FAILED")
            database.add_notification(f"Training failed for {tool_name}.", user_id,"error")
    finally:
        # Clean up the flag
        if tool_id in active_training_flags:
            del active_training_flags[tool_id]
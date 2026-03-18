from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover
    YOLO = None


DEFAULT_WEIGHTS = os.getenv("TOOLS_MODEL_PATH", "yolov8n.pt")

print("[TOOL RECOGNITION] Initializing Tool Recognition Module...")
_model = None
if YOLO is not None:
    try:
        _model = YOLO(DEFAULT_WEIGHTS)
        print(f"[TOOL RECOGNITION] Model loaded: {DEFAULT_WEIGHTS}")
    except Exception as e:  # pragma: no cover
        _model = None
        print(f"[TOOL RECOGNITION] WARNING: Failed to load model ({DEFAULT_WEIGHTS}): {e}")
else:
    print("[TOOL RECOGNITION] WARNING: ultralytics not available.")


def analyze_tools(
    img: np.ndarray,
    *,
    conf: float = 0.35,
    allowed_classes: List[str] | None = None,
) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    """
    On-demand tool recognition.

    - If a custom tools model is available, set TOOLS_MODEL_PATH to that weights file.
    - If not, this will still run with default YOLO weights, but results may not be "tools".
    """
    if img is None:
        return img, []
    if _model is None:
        return img, []

    results = _model(img, stream=True, verbose=False, conf=conf)
    detected: List[Dict[str, Any]] = []

    for r in results:
        for box in getattr(r, "boxes", []):
            class_id = int(box.cls[0])
            name = str(_model.names.get(class_id, class_id))
            if allowed_classes and name not in allowed_classes:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detected.append({"name": name, "bbox": [float(x1), float(y1), float(x2), float(y2)]})

            color = (255, 120, 50)  # blue-ish
            cv2.rectangle(img, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
            cv2.putText(
                img,
                name.upper(),
                (int(x1), max(int(y1) - 8, 0)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )

    return img, detected
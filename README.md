## Smart Glasses System (Assistive Vision)

This repository contains a prototype **Smart Glasses System** for visually impaired users, built around four functional modules:

- **Module 1 – Real-Time Hazard Detection**: real-time CV hazard detection on the live camera stream.
- **Module 2 – Intelligent Hazard Alerting**: context-aware alerts (audio instruction + optional haptic command).
- **Module 3 – OCR (Dual-Mode)**: proactive safety keyword scan + reactive full OCR on demand.
- **Module 4 – Workplace Tool Recognition**: on-demand object/tool recognition (supports custom weights).

### Architecture (current implementation)

- **Edge device (ESP32-CAM)** streams JPEG frames to the backend over WebSocket.
- **Backend (FastAPI)** runs CV/OCR and pushes logs + instructions to the React dashboard.
- **Frontend (React dashboard)** visualizes the video feed and provides **active commands** (Full OCR / Tools scan / Navigation).

### Run the backend

From `backend/`:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

Backend listens on:

- `http://localhost:8000/video_feed` (MJPEG stream)
- `ws://localhost:8000/ws` (edge device)
- `ws://localhost:8000/ws/dashboard` (React dashboard)

### Run the frontend

From `frontend/`:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

### Active interaction commands (from dashboard)

The Vision Console includes buttons for:

- **Full OCR**: runs a full OCR pass on the most recent frame and reads text back as an instruction.
- **Scan Tools**: runs on-demand tool recognition on the most recent frame.
- **Navigation Start/Stop**: starts a navigation session (safe fallback routing by default).

### GPS / routing providers (optional)

The navigation module supports safe defaults (no external calls) and two optional providers:

- **Geocoding (place name → lat/lon)**: set `ENABLE_NOMINATIM=1`
- **Routing (walking route steps)**: set `ENABLE_OSRM=1`

If not enabled, you can still start navigation by sending coordinates (the UI currently sends place text; coordinates are supported via the backend command payload).

### Tool recognition model

Set a custom tools model path:

- `TOOLS_MODEL_PATH=backend/models/yolov8-tools.pt`

If not configured, the system will still run but may return no tool detections.

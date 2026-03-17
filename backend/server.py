from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import uvicorn
import cv2
import numpy as np
import json
import time

# import four core system modules
import hazard_detection as detect_hazard
import alerting_system as alerts
import ocr as recognize_character
import tool_recognition as recognize_tool

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

last_ocr_time = 0
latest_frame = None
is_currently_safe = True

edge_device_ws = None
dashboard_connections = []

@app.get("/video_feed")
async def video_feed():
    async def generate():
        while True:
            if latest_frame is not None:
                success, encoded_img = cv2.imencode('.jpg', latest_frame)
                if success:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + encoded_img.tobytes() + b'\r\n')
            await asyncio.sleep(0.05)
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    global edge_device_ws
    await websocket.accept()
    dashboard_connections.append(websocket)
    print("[INFO] React Dashboard Connected.")

    try:
        await websocket.send_text(json.dumps({"type": "status", "device_connected": edge_device_ws is not None, "log": "Dashboard synced with server."}))
        while True: await websocket.receive_text() 
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)
        print("[INFO] React Dashboard Disconnected.")

@app.websocket("/ws")
async def edge_endpoint(websocket: WebSocket):
    global last_ocr_time, latest_frame, is_currently_safe, edge_device_ws
    await websocket.accept()
    edge_device_ws = websocket
    print("[SUCCESS] ESP32 Edge Device Connected!")
    
    for dash in dashboard_connections:
        try: await dash.send_text(json.dumps({"type": "status", "device_connected": True, "log": "SUCCESS: ESP32 Connected."}))
        except: pass

    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data:
                raw_bytes = data["bytes"]
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                img = cv2.flip(img, 1)

                # MODULE 1: Hazard Detection
                processed_img, status, hazards = detect_hazard.analyze_frame(img)
                latest_frame = processed_img 

                if status == "PROCESSED":
                    # MODULE 2: Intelligent Alerting System
                    action_command, log_message, audio_instruction = alerts.generate_alerts(hazards)

                    if "HAZARD" in log_message:
                        await websocket.send_text(action_command) 
                        payload = {"type": "log", "log": log_message, "instruction": audio_instruction}
                        for dash in dashboard_connections:
                            try: await dash.send_text(json.dumps(payload))
                            except: pass
                        is_currently_safe = False 

                    else:
                        if not is_currently_safe:
                            await websocket.send_text(action_command) 
                            payload = {"type": "log", "log": log_message, "instruction": audio_instruction}
                            for dash in dashboard_connections:
                                try: await dash.send_text(json.dumps(payload))
                                except: pass
                            is_currently_safe = True

                # MODULE 3: Proactive OCR Scanning
                current_time = time.time()
                if current_time - last_ocr_time > 5:
                    extracted_text, safety_keywords = recognize_character.analyze_text(processed_img)
                    
                    if extracted_text:
                        print(f"OCR: {extracted_text}")
                        # Trigger Module 2 Alerting if safety keywords found!
                        if safety_keywords:
                            kw_str = ", ".join(safety_keywords).upper()
                            payload = {"type": "log", "log": f"WARNING SIGN DETECTED: {kw_str}", "instruction": f"Warning sign detected: {kw_str}"}
                            await websocket.send_text("ALERT: MOTOR_BOTH") # Vibrate to warn user
                            for dash in dashboard_connections:
                                try: await dash.send_text(json.dumps(payload))
                                except: pass
                                
                    last_ocr_time = current_time

    except WebSocketDisconnect:
        edge_device_ws = None
        latest_frame = None
        print("[WARNING] ESP32 Gracefully Disconnected.")
        for dash in dashboard_connections:
            try: await dash.send_text(json.dumps({"type": "status", "device_connected": False, "log": "WARNING: ESP32 Disconnected."}))
            except: pass
    except Exception as e:
        edge_device_ws = None
        latest_frame = None
        print(f"[ERROR] ESP32 Connection Lost abruptly: {e}")
        for dash in dashboard_connections:
            try: await dash.send_text(json.dumps({"type": "status", "device_connected": False, "log": "CRITICAL: Hardware Connection Lost."}))
            except: pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import uvicorn
import cv2
import numpy as np
import json
import time

from hazard_detection import analyze_frame
from ocr import read_text_from_bytes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

last_ocr_time = 0
latest_frame = None
is_currently_safe = True

# NEW ARCHITECTURE: Track the ESP32 and React dashboards separately!
edge_device_ws = None
dashboard_connections = []

@app.get("/")
def read_root():
    return {"status": "Smart Glasses AI Server is Running!"}

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


# ---------------------------------------------------------
# ENDPOINT 1: FOR THE REACT DASHBOARD ONLY
# ---------------------------------------------------------
@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    global edge_device_ws
    await websocket.accept()
    dashboard_connections.append(websocket)
    print("[INFO] React Dashboard Connected.")
    
    # The moment React connects, instantly tell it the real truth about the ESP32!
    try:
        await websocket.send_text(json.dumps({
            "type": "status", 
            "device_connected": edge_device_ws is not None,
            "log": "Dashboard synced with server."
        }))
        
        while True:
            # Keep the dashboard connection alive
            await websocket.receive_text() 
            
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)
        print("[INFO] React Dashboard Disconnected.")


# ---------------------------------------------------------
# ENDPOINT 2: FOR THE ESP32 HARDWARE ONLY
# ---------------------------------------------------------
@app.websocket("/ws")
async def edge_endpoint(websocket: WebSocket):
    global last_ocr_time, latest_frame, is_currently_safe, edge_device_ws

    await websocket.accept()
    edge_device_ws = websocket
    print("[SUCCESS] ESP32 Edge Device Connected!")
    
    # Broadcast to all open React dashboards that hardware is ONLINE
    for dash in dashboard_connections:
        try:
            await dash.send_text(json.dumps({"type": "status", "device_connected": True, "log": "SUCCESS: ESP32 Hardware Connected."}))
        except: pass

    try:
        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                raw_bytes = data["bytes"]

                # 1. Decode & Flip
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                img = cv2.flip(img, 1)

                # 2. Hazard Detection (Pass 'img' directly, receive 'processed_img' back)
                processed_img, action_command, log_message, audio_instruction = analyze_frame(img)

                # 3. Update the global video feed with the drawn bounding boxes!
                latest_frame = processed_img 

                # 4. Re-encode to bytes for your OCR module
                _, buffer = cv2.imencode('.jpg', processed_img)
                flipped_bytes = buffer.tobytes()

                # Hazard Detection
                # 1. FRAME THROTTLING CHECK
                # If the engine says "SKIP", we ignore this frame to save battery and keep latency low.
                if action_command == "SKIP":
                    pass # Use 'continue' here if this is inside a while/for loop!

                # 2. HAZARD DETECTED STATE
                elif "HAZARD" in log_message:
                    await websocket.send_text(action_command) # Send vibration command to ESP32 (e.g., MOTOR_LEFT)
                    print(log_message)
                    
                    # Create the enhanced payload for React
                    payload = {
                        "type": "log", 
                        "log": log_message, 
                        "instruction": audio_instruction # NEW: Send the specific movement instruction
                    }
                    
                    for dash in dashboard_connections:
                        try: 
                            await dash.send_text(json.dumps(payload))
                        except: 
                            pass
                            
                    is_currently_safe = False 

                # 3. SAFE STATE (Only triggers once when transitioning from Hazard -> Safe)
                else:
                    if not is_currently_safe:
                        await websocket.send_text(action_command) # Send "SAFE" to ESP32 to stop motors
                        msg = "SAFE: Coast is clear."
                        print(msg)
                        
                        # Create the safe payload for React
                        payload = {
                            "type": "log", 
                            "log": msg, 
                            "instruction": "Path is clear." # Clears the red HUD warning on the dashboard
                        }
                        
                        for dash in dashboard_connections:
                            try: 
                                await dash.send_text(json.dumps(payload))
                            except: 
                                pass
                                
                        is_currently_safe = True
                        
                # OCR
                current_time = time.time()
                if current_time - last_ocr_time > 5:
                    detected_text = read_text_from_bytes(flipped_bytes)
                    if detected_text:
                        print(f"OCR DETECTED: {detected_text}")
                        for dash in dashboard_connections:
                            try: await dash.send_text(json.dumps({"type": "log", "log": f"TEXT READ: {detected_text}"}))
                            except: pass
                    last_ocr_time = current_time

    except WebSocketDisconnect:
        edge_device_ws = None
        print("WARNING: ESP32 Disconnected from Server.")
        for dash in dashboard_connections:
            try: await dash.send_text(json.dumps({"type": "status", "device_connected": False, "log": "WARNING: ESP32 Hardware Disconnected."}))
            except: pass
    except Exception as e:
        edge_device_ws = None
        print(f"Error: {e}")
        for dash in dashboard_connections:
            try: await dash.send_text(json.dumps({"type": "status", "device_connected": False, "log": "WARNING: ESP32 Hardware Error."}))
            except: pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
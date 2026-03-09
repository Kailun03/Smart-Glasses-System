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

# Allow the React frontend to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to track the last OCR time
last_ocr_time = 0

# Global variable to track active WebSocket connections
latest_frame = None
active_connections = []

@app.get("/")
def read_root():
    return {"status": "Smart Glasses AI Server is Running!"}

@app.get("/video_feed")
async def video_feed():
    """Creates a live MJPEG stream for the React dashboard."""
    async def generate():
        while True:
            if latest_frame is not None:
                # Convert the image to JPEG
                success, encoded_img = cv2.imencode('.jpg', latest_frame)
                if success:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + encoded_img.tobytes() + b'\r\n')
        
            # This prevents the server from freezing and limits the video to ~20 FPS!
            await asyncio.sleep(0.05)
            
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global last_ocr_time
    global latest_frame

    # 1. CRITICAL FIX: You must accept the connection first!
    await websocket.accept()

    active_connections.append(websocket)
    print(f"[SUCCESS] New connection! Total active: {len(active_connections)}")
    
    try:
        # Kick off the cycle by asking for the very first frame
        await websocket.send_text("NEXT")

        while True:
            # Wait to receive the JPEG frame from the ESP32
            data = await websocket.receive()
            
            # Check if it's binary image data from the ESP32
            if "bytes" in data:
                raw_bytes = data["bytes"]

                # 1. Decode the raw bytes into an image
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                # 2. FLIP THE IMAGE (1 = Horizontal flip)
                img = cv2.flip(img, 1)
                
                # Update the React Dashboard with the flipped image
                latest_frame = img 

                # 3. Re-encode back to bytes for the AI engines
                _, buffer = cv2.imencode('.jpg', img)
                flipped_bytes = buffer.tobytes()

                '''
                Hazard Detection
                '''
                # Pass the bytes to your AI Brain
                action_command, log_message = analyze_frame(flipped_bytes)
                
                # Print to your PC terminal if a hazard is seen
                if "HAZARD" in log_message:
                    print(log_message)
                    
                # Send the command back to the ESP32 ("ALERT: MOTOR_ON" or "SAFE")
                await websocket.send_text(action_command)

                # Broadcast to the Frontend Dashboard
                for connection in active_connections:
                    if connection != websocket:
                        # We use json.dumps because React expects a JSON object
                        await connection.send_text(json.dumps({"log": log_message}))
                        
                '''
                OCR
                '''
                # Read text (OCR) every 5 seconds
                current_time = time.time()
                if current_time - last_ocr_time > 5:
                    detected_text = read_text_from_bytes(flipped_bytes)
                    if detected_text:
                        print(f"OCR DETECTED: {detected_text}")
                        # You can also broadcast the OCR text to React!
                        for connection in active_connections:
                            if connection != websocket:
                                await connection.send_text(json.dumps({"log": f"TEXT READ: {detected_text}"}))
                    last_ocr_time = current_time
            
                # As soon as we safely receive it, ask for the next one!
                await websocket.send_text("NEXT")

    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print("WARNING: ESP32 Disconnected from Server.")
    except Exception as e:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"Error: {e}")

if __name__ == "__main__":
    # Runs the server locally on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
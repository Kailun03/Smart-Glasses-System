from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
import uvicorn
import cv2
import numpy as np
import json
import time
from typing import Any, Dict, Optional
import pyttsx3
import os
import edge_tts
from pydub import AudioSegment
import wave
import database
import io
from pydantic import BaseModel
from typing import List
import shutil
import jwt

# import four core system modules
import hazard_detection as detect_hazard
import alerting_system as alerts
import ocr as recognize_character
import tool_recognition as recognize_tool
import gps_navigation as gps
from voice_processor import VoiceCommandEngine
import auto_trainer

app = FastAPI(title="AURA Vision API")

security = HTTPBearer()

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

if not SUPABASE_JWT_SECRET:
    raise ValueError("FATAL ERROR: SUPABASE_JWT_SECRET is not set in the .env file.")

def verify_supabase_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verifies the JWT token sent from the React frontend."""
    token = credentials.credentials
    try:
        # Decode the token using the secret from .env
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"], 
            audience="authenticated"
        )
        return payload["sub"] # Returns the securely verified User ID
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")
        
class ToolData(BaseModel):
    name: str
    yolo_class: str
    description: str = ""

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

tts_engine = pyttsx3.init()
tts_engine.setProperty('rate', 160)

last_ocr_time = 0
latest_frame = None
latest_jpeg_bytes = None
latest_frame_seq = 0
is_currently_safe = True

edge_device_ws = None
dashboard_connections = []

active_mode = "NORMAL"  

nav_session = gps.NavigationSession()
last_nav_push = 0.0
DEFAULT_START_LOCATION = (5.41, 100.33)
current_location = DEFAULT_START_LOCATION

target_tool_name = None 
dashboard_awake = False 

last_guidance_time = 0.0
last_guidance_text = ""

raw_frame_buffer = None 
frame_pending = False 

global_ai_task = None 
cached_tool_map = None
voice_engine = VoiceCommandEngine()

edge_ws_lock = asyncio.Lock()
audio_playing_lock = asyncio.Lock()
new_frame_event = asyncio.Event()

last_frame_received_time = 0
hardware_watchdog_task = None

# --- AUDIO & VOICE GLOBALS ---
audio_buffer = bytearray()
last_audio_time = 0

current_audio_task = None
current_audio_text = ""
is_speaking = False
time_since_last_speech = 0
frontend_mic_active = False

is_glasses_awake = False
hardware_wake_timer = 0       # Tracks how long the hardware has been awake
accumulated_command = ""      # Stitches fragmented sentences together
is_processing_audio = False   # Mutex to prevent sleeping while Google is translating

training_queue = asyncio.Queue()

@app.on_event("startup")
async def startup_event():
    """Starts the background queue worker when the server boots."""
    asyncio.create_task(background_training_worker())

async def background_training_worker():
    """Constantly watches the queue and trains one model at a time."""
    print("[SYSTEM] Background Training Worker Initialized.")
    while True:
        job = await training_queue.get()
        tool_id = job["tool_id"]
        
        # Verify the tool still exists in the database before starting
        all_tools = await asyncio.to_thread(database.get_all_tools)
        if not any(t['id'] == tool_id for t in all_tools):
            print(f"[QUEUE] Skipping Tool {tool_id} (Already deleted by user)")
            training_queue.task_done()
            continue

        # Start actual training pipeline
        tool_name = job["tool_name"]
        print(f"[QUEUE] Dequeued tool '{tool_name}'. Starting training...")
        try:
            import auto_trainer
            # Run the heavy YOLO training in a separate thread so it doesn't freeze the server
            await asyncio.to_thread(
                auto_trainer.run_training_pipeline,
                tool_id, 
                tool_name, 
                job["yolo_class"], 
                job["saved_paths"], 
                job["parsed_boxes"]
            )
        except Exception as e:
            print(f"[QUEUE ERROR] Failed to train {tool_name}: {e}")
        finally:
            # Mark the job as finished so the queue can move to the next one
            training_queue.task_done()
            print(f"[QUEUE] Finished processing '{tool_name}'. Waiting for next job...")

async def hardware_watchdog():
    global edge_device_ws, latest_frame, global_ai_task, active_mode
    while True:
        await asyncio.sleep(2) 
        if edge_device_ws is not None:
            time_since_last_frame = time.time() - last_frame_received_time
            if time_since_last_frame > 3.5:
                print(f"[WATCHDOG] ESP32 timed out. No data for {time_since_last_frame:.1f}s.")
                try: await edge_device_ws.close()
                except: pass
                edge_device_ws = None
                latest_frame = None
                if global_ai_task: global_ai_task.cancel()
                disconn_msg = "Hardware connection lost. Navigation paused." if active_mode == "NAVIGATION" else "Hardware connection lost."
                await _broadcast({
                    "type": "status", "device_connected": False, "mode": active_mode, 
                    "log": "CRITICAL: Connection Lost (Timeout).", "instruction": disconn_msg
                })

def _decode_video_frame(raw_bytes: bytes) -> Optional[np.ndarray]:
    np_arr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is not None: return cv2.flip(img, 1)
    return None

def _encode_video_frame(frame: np.ndarray) -> Optional[bytes]:
    success, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
    if success: return encoded.tobytes()
    return None

async def safe_ws_send_text(text: str):
    if edge_device_ws:
        async with edge_ws_lock:
            try: await edge_device_ws.send_text(text)
            except Exception: pass

async def safe_ws_send_bytes(data: bytes):
    if edge_device_ws:
        async with edge_ws_lock:
            try: await edge_device_ws.send_bytes(data)
            except Exception: pass

async def _broadcast(payload: Dict[str, Any]) -> None:
    msg = json.dumps(payload)
    dead_connections = []
    for dash in dashboard_connections:
        try: await dash.send_text(msg)
        except: dead_connections.append(dash)
    for dead in dead_connections:
        if dead in dashboard_connections: dashboard_connections.remove(dead)

tts_pcm_cache = {}

async def generate_speech_pcm(text: str) -> Optional[bytes]:
    try:
        cache_key = text.lower().strip()
        if cache_key in tts_pcm_cache: return tts_pcm_cache[cache_key]
        communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
        mp3_bytes = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                mp3_bytes.extend(chunk["data"])
        def decode_in_memory():
            audio = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
            audio = audio.set_frame_rate(22050).set_channels(1).set_sample_width(2)
            return audio.raw_data
        pcm_data = await asyncio.to_thread(decode_in_memory)
        tts_pcm_cache[cache_key] = pcm_data
        return pcm_data
    except Exception as e:
        print(f"[ERROR] TTS Generation failed: {e}")
        return None

async def _process_and_stream_audio(text: str):
    global current_audio_text
    if not text: return
    try:
        pcm_bytes = await generate_speech_pcm(text)
        if not pcm_bytes: return
        CHUNK_SIZE = 4096 
        BYTES_PER_SEC = 44100.0 
        
        for i in range(0, len(pcm_bytes), CHUNK_SIZE):
            if edge_device_ws is None: break 
            chunk = pcm_bytes[i : i + CHUNK_SIZE]
            async with edge_ws_lock:
                try: await edge_device_ws.send_bytes(chunk)
                except Exception: break 
                
            chunk_duration = len(chunk) / BYTES_PER_SEC
            await asyncio.sleep(chunk_duration * 0.95) 
            
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[WARNING] Audio stream interrupted: {e}")
    finally:
        if current_audio_text == text:
            current_audio_text = ""

async def stream_audio_to_glasses(text: str, preemptive: bool = True):
    global current_audio_task, current_audio_text
    if edge_device_ws is None or not text: return
    
    if current_audio_task is not None and not current_audio_task.done():
        if current_audio_text == text: return 
        if preemptive:
            current_audio_task.cancel()
            try: await current_audio_task 
            except asyncio.CancelledError: pass
        else:
            return

    current_audio_text = text
    current_audio_task = asyncio.create_task(_process_and_stream_audio(text))

async def _background_safety_ocr(clean_frame: np.ndarray, current_mode: str):
    try:
        annotated_ocr_img, safety_keywords, snippet = await asyncio.to_thread(recognize_character.scan_safety_keywords, clean_frame)
        if safety_keywords:
            encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_ocr_img)
            if encoded_bytes:
                global latest_jpeg_bytes, latest_frame_seq
                latest_jpeg_bytes = encoded_bytes; latest_frame_seq += 1; new_frame_event.set()
            kw_str = ", ".join(safety_keywords).upper()
            instruction_str = f"Warning sign detected: {kw_str}"
            payload = {
                "type": "log", "log": f"WARNING SIGN DETECTED: {kw_str}", "instruction": instruction_str, "mode": current_mode, "ocr_snippet": snippet[:160],
            }
            if edge_device_ws: 
                try: await edge_device_ws.send_text("ALERT: MOTOR_BOTH") 
                except: pass
            await stream_audio_to_glasses(instruction_str)
            await _broadcast(payload)
            asyncio.create_task(asyncio.to_thread(database.log_hazard, f"SIGN: {kw_str}", current_location[0], current_location[1]))
    except Exception as e:
        print(f"[OCR ERROR] {e}")

@app.get("/video_feed")
async def video_feed():
    async def generate():
        last_sent_seq = -1
        while True:
            await new_frame_event.wait()
            if latest_jpeg_bytes is not None and latest_frame_seq != last_sent_seq:
                last_sent_seq = latest_frame_seq
                yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + latest_jpeg_bytes + b'\r\n')
            new_frame_event.clear()
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/hazards")
def api_get_hazards(page: int = 1, limit: int = 100):
    return database.get_hazard_history(page=page, page_size=limit)

@app.get("/api/tools")
def api_get_tools(): return database.get_all_tools()

@app.post("/api/tools")
def api_add_tool(tool: ToolData):
    tool_id = database.add_tool(tool.name, tool.yolo_class, tool.description)
    if tool_id: return {"id": tool_id, "message": "Tool added successfully"}
    return {"error": "Failed to add tool"}

@app.delete("/api/tools/{tool_id}")
async def api_delete_tool(tool_id: int):
    # 1. Signal auto_trainer to stop if it's currently training this ID
    if tool_id in auto_trainer.active_training_flags:
        auto_trainer.active_training_flags[tool_id] = True
        print(f"[API] Issued kill signal for Tool ID {tool_id}")

    # 2. Delete from Database
    # This automatically "removes" it from the queue because the 
    # background_training_worker checks the DB before starting.
    success = database.delete_tool(tool_id)
    
    if success:
        database.add_notification(f"Tool record and associated training tasks removed.", "info")
        return {"message": "Tool and training task deleted successfully"}
    return {"error": "Failed to delete tool"}

@app.post("/api/tools/auto_label")
async def api_auto_label(files: List[UploadFile] = File(...)):
    import auto_trainer
    results = []
    for file in files:
        contents = await file.read()
        # Get the OpenCV guess for this image
        box = auto_trainer.get_opencv_box(contents)
        results.append({"filename": file.filename, "box": box})
    return results

@app.post("/api/tools/train")
async def api_train_new_tool(
    # Notice we removed BackgroundTasks from here!
    tool_name: str = Form(...),
    description: str = Form(""),
    boxes: str = Form(...), 
    files: List[UploadFile] = File(...)
):
    import database
    import shutil
    import os

    # 1. Register tool in database (Default status is automatically "QUEUED")
    tool_id = database.add_tool(tool_name, description)
    yolo_class = tool_name.lower().replace(" ", "_")

    # 2. Parse the JSON boxes sent from React
    parsed_boxes = json.loads(boxes)

    # 3. Save uploaded files temporarily
    temp_dir = f"temp_uploads_{tool_id}"
    os.makedirs(temp_dir, exist_ok=True)
    saved_paths = []
    
    for file in files:
        file_path = os.path.join(temp_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_paths.append(file_path)

    # 4. Add the job to our strict FIFO Queue!
    await training_queue.put({
        "tool_id": tool_id,
        "tool_name": tool_name,
        "yolo_class": yolo_class,
        "saved_paths": saved_paths,
        "parsed_boxes": parsed_boxes
    })
    
    # 5. Send a notification to the UI
    database.add_notification(f"'{tool_name}' added to the training queue. [ Position: {training_queue.qsize()} ]", "info")
    
    return {"status": "success", "tool_id": tool_id}

@app.get("/api/notifications")
def api_get_notifications(limit: int = 20, offset: int = 0):
    return database.get_notifications(limit=limit, offset=offset)

@app.put("/api/notifications/read")
def api_mark_notifications_read():
    import database
    database.mark_notifications_read()
    return {"status": "success"}

@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    global edge_device_ws
    await websocket.accept()
    dashboard_connections.append(websocket)
    try:
        await websocket.send_text(json.dumps({
            "type": "status", "device_connected": edge_device_ws is not None, "log": "Dashboard synced with server.", "mode": active_mode, "location": {"lat": current_location[0], "lon": current_location[1]},
        }))
        while True:
            msg = await websocket.receive_text()
            try: data = json.loads(msg)
            except Exception: continue
            if data.get("type") != "command": continue
            await _handle_dashboard_command(websocket, data)
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)

async def background_ai_worker():
    global raw_frame_buffer, latest_frame, latest_jpeg_bytes, latest_frame_seq, is_currently_safe, last_ocr_time, edge_device_ws, last_nav_push, active_mode, target_tool_name, dashboard_awake, last_guidance_time, last_guidance_text
    global is_glasses_awake, frontend_mic_active, is_processing_audio, hardware_wake_timer, accumulated_command
    
    while True:
        try:
            # --- THE NEW MASTER TIMEOUT CHECK ---
            # The backend firmly controls the hardware microphone timeout!
            if is_glasses_awake and not frontend_mic_active and not is_processing_audio:
                if time.time() - hardware_wake_timer > 9.0: # 9 seconds of absolute silence
                    is_glasses_awake = False
                    accumulated_command = ""
                    await stream_audio_to_glasses("Listener went back to sleep.", preemptive=False)
                    await _broadcast({"type": "status", "is_awake": False, "mode": active_mode})
                    print("[SYNC] Hardware Mic timed out (9s silence). Returning to sleep.")
            # ------------------------------------

            if raw_frame_buffer is not None:
                img_to_process = raw_frame_buffer
                raw_frame_buffer = None 
                clean_ocr_frame = img_to_process.copy()

                processed_img, status, hazards = await asyncio.to_thread(detect_hazard.analyze_frame, img_to_process)
                latest_frame = processed_img

                if active_mode in ["TOOL", "GUIDANCE"]:
                    img, tools, guidance_instruction = await asyncio.to_thread(recognize_tool.analyze_tools, latest_frame, target_tool_name, cached_tool_map)
                    latest_frame = img 

                    if active_mode == "TOOL":
                        if tools:
                            names = ", ".join(sorted({t["name"] for t in tools}))
                            await stream_audio_to_glasses(f"Detected: {names}")
                            await _broadcast({"type": "log", "log": f"TOOLS DETECTED: {names}", "mode": active_mode})
                        else:
                            await stream_audio_to_glasses("No tools detected.")
                        active_mode = "NORMAL" 

                    elif active_mode == "GUIDANCE":
                        if not dashboard_awake:
                            if guidance_instruction:
                                current_time = time.time()
                                if guidance_instruction != last_guidance_text or (current_time - last_guidance_time > 2.5):
                                    await _broadcast({
                                        "type": "log", "log": f"GUIDANCE: {guidance_instruction}", "instruction": guidance_instruction, "mode": active_mode
                                    })
                                    await stream_audio_to_glasses(guidance_instruction)
                                    last_guidance_time = current_time
                                    last_guidance_text = guidance_instruction
                            if "Grab it now" in guidance_instruction:
                                active_mode = "NORMAL"
                                target_tool_name = None
                                await _broadcast({"type": "status", "device_connected": True, "mode": active_mode, "log": "Tool secured. Guidance mode deactivated."})

                encoded_bytes = await asyncio.to_thread(_encode_video_frame, latest_frame)
                if encoded_bytes:
                    latest_jpeg_bytes = encoded_bytes; latest_frame_seq += 1; new_frame_event.set()

                if status == "PROCESSED":
                    action_command, log_message, audio_instruction = alerts.generate_alerts(hazards)
                    if log_message.startswith("HAZARD"):
                        await safe_ws_send_text(action_command)
                        await stream_audio_to_glasses(audio_instruction)
                        await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                        if is_currently_safe: 
                            h_type = log_message.replace("HAZARD DETECTED: ", "").split("!")[0]
                            asyncio.create_task(asyncio.to_thread(database.log_hazard, h_type, current_location[0], current_location[1]))
                        is_currently_safe = False 
                    elif log_message.startswith("SAFE"):
                        if not is_currently_safe:
                            await safe_ws_send_text(action_command)
                            await stream_audio_to_glasses(audio_instruction)
                            await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                            is_currently_safe = True

                if nav_session.active:
                    instr = nav_session.process_location(current_location[0], current_location[1])
                    if instr:
                        await stream_audio_to_glasses(instr, preemptive=False)
                        await _broadcast({"type": "log", "log": f"NAVIGATION: {instr}", "instruction": instr, "mode": active_mode})
                        if instr == "You have arrived at your destination.":
                            active_mode = "NORMAL"
                            await _broadcast({"type": "status", "mode": "NORMAL", "device_connected": True})

                current_time = time.time()
                if current_time - last_ocr_time > 2:
                    last_ocr_time = current_time
                    asyncio.create_task(_background_safety_ocr(clean_ocr_frame.copy(), active_mode))
        except Exception as e:
            print(f"\n[CRITICAL ERROR] AI Worker Crashed: {e}")
        await asyncio.sleep(0.005)


@app.websocket("/ws")
async def edge_endpoint(websocket: WebSocket):
    global latest_frame, edge_device_ws, raw_frame_buffer, global_ai_task, last_frame_received_time, hardware_watchdog_task
    global audio_buffer, last_audio_time, is_speaking, time_since_last_speech, hardware_wake_timer
    
    if global_ai_task is not None: global_ai_task.cancel()
    await websocket.accept()
    edge_device_ws = websocket
    print("[SUCCESS] ESP32 Edge Device Connected!")
    
    last_frame_received_time = time.time()
    if hardware_watchdog_task is None or hardware_watchdog_task.done():
        hardware_watchdog_task = asyncio.create_task(hardware_watchdog())

    await _broadcast({"type": "status", "device_connected": True, "mode": active_mode, "log": "SUCCESS: ESP32 Connected."})
    global_ai_task = asyncio.create_task(background_ai_worker())

    try:
        while True:
            try: data = await websocket.receive()
            except RuntimeError: break 

            last_frame_received_time = time.time()

            if "bytes" in data:
                raw_bytes = data["bytes"]
                if len(raw_bytes) > 2000 and raw_bytes.startswith(b'\xff\xd8'):
                    img = await asyncio.to_thread(_decode_video_frame, raw_bytes)
                    if img is not None: raw_frame_buffer = img
                else:
                    if frontend_mic_active:
                        audio_buffer.clear()
                    else:
                        audio_array = np.frombuffer(raw_bytes, dtype=np.int16)
                        energy = np.abs(audio_array).mean() 
                        
                        if energy > 200:
                            time_since_last_speech = time.time()
                            if is_glasses_awake:
                                hardware_wake_timer = time.time() # Refresh backend timer when noise is made!
                            if not is_speaking:
                                is_speaking = True
                                
                        audio_buffer.extend(raw_bytes)
                        process_now = False
                        
                        if is_speaking:
                            time_silent = time.time() - time_since_last_speech
                            silence_threshold = 0.8 if is_glasses_awake else 1.2
                            if time_silent > silence_threshold:
                                process_now = True 
                            elif len(audio_buffer) > 250000: 
                                process_now = True 
                        else:
                            if len(audio_buffer) > 22000:
                                audio_buffer = bytearray(audio_buffer[-22000:])

                        if process_now:
                            current_audio = bytes(audio_buffer)
                            audio_buffer.clear()
                            is_speaking = False
                            time_since_last_speech = time.time()
                            
                            if len(current_audio) > 15000:
                                asyncio.create_task(process_voice_in_background(current_audio, websocket))

            elif "text" in data:
                try:
                    payload = json.loads(data["text"])
                    if payload.get("type") == "gps":
                        global current_location
                        current_location = (payload["lat"], payload["lon"])
                        await _broadcast({
                            "type": "status", "device_connected": True, "mode": active_mode, "location": {"lat": current_location[0], "lon": current_location[1]}
                        })
                except Exception: pass
    except WebSocketDisconnect:
        edge_device_ws = None
        if global_ai_task: global_ai_task.cancel() 
        await _broadcast({"type": "status", "device_connected": False, "log": "WARNING: ESP32 Disconnected."})


async def process_voice_in_background(audio_data, websocket):
    global is_glasses_awake, active_mode, accumulated_command, is_processing_audio, hardware_wake_timer
    
    is_processing_audio = True # Lock out the sleep timer while Google translates
    
    try:
        text = await asyncio.to_thread(voice_engine.process_raw_pcm, audio_data)
        if not text: return
        
        print(f"[VOICE] Heard: '{text}'")
        
        # Removed "hey" and "wake up" to prevent accidental triggers from normal conversation.
        wake_words = ["glasses", "hey", "hey glasses", "play glasses", "okay glasses", "hey glass", "play glass", "okay glass"]
        
        just_woke_up = False
        
        # 1. Look for Wake Word ONLY if we are currently asleep
        if not is_glasses_awake:
            for ww in wake_words:
                if ww in text:
                    is_glasses_awake = True
                    just_woke_up = True
                    hardware_wake_timer = time.time() # Start the absolute 9-second timer
                    await _broadcast({"type": "status", "is_awake": True, "device_connected": True, "mode": active_mode})
                    
                    # Strip the wake word out
                    parts = text.split(ww)
                    text = parts[-1].strip()
                    accumulated_command = "" # Reset the stitcher
                    break 

        # If it's still asleep, ignore the audio completely!
        if not is_glasses_awake:
            return

        if just_woke_up and not text:
            await stream_audio_to_glasses("I am listening.")
            return

        # 2. Command Stitching & Strict Siri-Style Rejection
        if is_glasses_awake and text:
            hardware_wake_timer = time.time() # Reset timer because they spoke
            
            # Stitch the new text onto whatever we've heard so far
            accumulated_command += " " + text
            accumulated_command = accumulated_command.strip()
            
            print(f"[VOICE] Formulating: '{accumulated_command}'")
            
            cmd_payload = voice_engine.parse_command(accumulated_command)
            
            if cmd_payload:
                if cmd_payload.get("command") == "INVALID_SEARCH":
                    pass # Just wait. The user might have said "search for..." and paused.
                else:
                    # SUCCESS! Execute and go straight to sleep.
                    is_glasses_awake = False
                    accumulated_command = ""
                    await _handle_dashboard_command(websocket, cmd_payload)
                    await _broadcast({"type": "status", "is_awake": False, "device_connected": True, "mode": active_mode})
            else:
                # The user finished speaking a sentence (VAD triggered) but it wasn't a valid command.
                # Just like Siri, say "I don't understand" and force the mic BACK TO SLEEP instantly.
                is_glasses_awake = False
                bad_command = accumulated_command
                accumulated_command = "" 
                
                msg = "Sorry, I don't understand your command."
                await stream_audio_to_glasses(msg, preemptive=False)
                await _broadcast({
                    "type": "log", "log": f"VOICE UNRECOGNIZED: '{bad_command}'", 
                    "instruction": msg, "mode": active_mode, "is_awake": False
                })
                await _broadcast({"type": "status", "is_awake": False, "device_connected": True, "mode": active_mode})

    except Exception as e:
        print(f"[VOICE ERROR] {e}")
    finally:
        is_processing_audio = False # Unlock the timer


async def _handle_dashboard_command(websocket: WebSocket, data: Dict[str, Any]) -> None:
    global latest_frame, active_mode, nav_session, current_location, target_tool_name
    global is_glasses_awake, accumulated_command, hardware_wake_timer, frontend_mic_active

    command = str(data.get("command", "")).upper().strip()

    if command in {"MODE_NORMAL", "MODE_NAVIGATION", "MODE_OCR", "MODE_TOOL"}:
        active_mode = command.replace("MODE_", "")
        if active_mode != "NAVIGATION": nav_session.stop()
        await _broadcast({"type": "status", "device_connected": edge_device_ws is not None, "mode": active_mode, "log": f"Mode set to {active_mode}.", "location": {"lat": current_location[0], "lon": current_location[1]}})
        return
    if command == "SET_LOCATION":
        lat = data.get("lat")
        lon = data.get("lon")
        try: current_location = (float(lat), float(lon))
        except Exception: return
        await _broadcast({"type": "status", "device_connected": edge_device_ws is not None, "mode": active_mode, "location": {"lat": current_location[0], "lon": current_location[1]}})
        return
    if command == "FULL_OCR":
        active_mode = "OCR"
        await _broadcast({"type": "log", "log": "VOICE: Starting Full OCR Scan...", "instruction": "Running OCR...", "mode": active_mode})
        if latest_frame is None: return await stream_audio_to_glasses("No camera frame available.")
        annotated_img, text, kws = await asyncio.to_thread(recognize_character.analyze_text, latest_frame.copy())
        encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_img)
        if encoded_bytes:
            global latest_jpeg_bytes, latest_frame_seq
            latest_jpeg_bytes = encoded_bytes; latest_frame_seq += 1; new_frame_event.set()
        if not text:
            msg = "No readable text detected."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": f"OCR: {msg}", "instruction": msg, "mode": active_mode})
        else:
            result_text = text[:240]
            await stream_audio_to_glasses(result_text)
            await _broadcast({"type": "log", "log": f"OCR RESULT: {result_text}", "instruction": result_text, "mode": active_mode})
        active_mode = "NORMAL"
        return
    if command == "TOOLS_SCAN":
        active_mode = "TOOL"
        if latest_frame is None: return
        msg = "Syncing tools with cloud..."
        await stream_audio_to_glasses(msg); await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        db_tools = await asyncio.to_thread(database.get_all_tools)
        global cached_tool_map
        cached_tool_map = {t["tool_name"].lower().replace(" ", "_"):t["tool_name"] for t in db_tools}
        msg = "Scanning area..."
        await stream_audio_to_glasses(msg); await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        annotated_img, tools, guidance_text = await asyncio.to_thread(recognize_tool.analyze_tools, latest_frame.copy(), None, cached_tool_map)
        encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_img)
        if encoded_bytes:
            latest_jpeg_bytes = encoded_bytes; latest_frame_seq += 1; new_frame_event.set()
        if not tools:
            await stream_audio_to_glasses("No tools detected.")
            await _broadcast({"type": "log", "log": "TOOLS: No tools detected.", "instruction": "No tools detected.", "mode": "NORMAL"})
        else:
            names = ", ".join(sorted({t["name"] for t in tools}))
            instruction_str = f"TOOLS DETECTED: {names}"
            await stream_audio_to_glasses(instruction_str)
            await _broadcast({"type": "log", "log": instruction_str, "instruction": instruction_str, "mode": "NORMAL"})
        active_mode = "NORMAL"
        return
    if command == "NAV_START":
        active_mode = "NAVIGATION"
        dest_query = str(data.get("destination", "")).strip()
        dest_coords = None; dest_name = "Destination"
        if dest_query:
            msg = f"Searching for {dest_query}..."
            await stream_audio_to_glasses(msg); await _broadcast({"type": "log", "log": f"NAVIGATION: {msg}", "instruction": msg, "mode": active_mode})
            geo_result = await asyncio.to_thread(gps.geocode_place, dest_query, current_location[0], current_location[1])
            if geo_result: dest_coords = (geo_result[0], geo_result[1]); dest_name = geo_result[2]
            else:
                err_msg = f"Could not find {dest_query}."
                await stream_audio_to_glasses(err_msg)
                await _broadcast({"type": "log", "log": f"NAVIGATION ERROR: {err_msg}", "instruction": err_msg, "mode": "NORMAL"})
                active_mode = "NORMAL"
                return
        else:
            dest_lat, dest_lon = data.get("dest_lat"), data.get("dest_lon")
            if dest_lat is not None and dest_lon is not None:
                try: dest_coords = (float(dest_lat), float(dest_lon)); dest_name = "Custom Coordinates"
                except Exception: pass
        if dest_coords is None:
            err_msg = "Destination not set."
            await stream_audio_to_glasses(err_msg)
            await _broadcast({"type": "log", "log": f"NAVIGATION ERROR: {err_msg}", "instruction": err_msg, "mode": "NORMAL"})
            active_mode = "NORMAL"
            return
        start = current_location
        plan = await asyncio.to_thread(gps.plan_navigation, start, dest_coords, dest_name)
        nav_session.start(plan)
        nav_session.announced_current = True
        mins = int(plan.duration_sec // 60)
        dist = int(plan.total_distance_m)
        first_step_text = plan.steps[0].instruction if plan.steps else "Proceed to destination."
        announcement = f"Route found to {dest_name}. It is {dist} meters away, about a {mins} minute walk. {first_step_text}"
        if edge_device_ws is None: announcement += " Navigation is paused. Hardware is offline."
        await stream_audio_to_glasses(announcement)
        await _broadcast({"type": "log", "log": f"NAVIGATION STARTED: {dist}m, {mins} mins to {dest_name}", "instruction": announcement, "mode": active_mode})
        return
    if command == "NAV_STOP":
        nav_session.stop()
        active_mode = "NORMAL"
        await stream_audio_to_glasses("Navigation stopped.")
        await _broadcast({"type": "log", "log": "NAVIGATION STOPPED.", "instruction": "Navigation stopped.", "mode": active_mode})
        return
    if command == "SEARCH_TOOL":
        target = data.get("target_tool", "").strip().lower()
        if target:
            active_mode = "GUIDANCE"
            target_tool_name = target
            msg = f"Initiating search and guidance for {target}."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
            db_tools = await asyncio.to_thread(database.get_all_tools)
            cached_tool_map = {t["tool_name"].lower().replace(" ", "_"): t["tool_name"] for t in db_tools}
        return
    if command == "SEARCH_STOP":
        if active_mode == "GUIDANCE" or active_mode == "TOOL":
            active_mode = "NORMAL"
            target_tool_name = None
            msg = "Search cancelled."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        return

    # --- THE MUTINY FIX ---
    if command == "DASHBOARD_WAKE":
        awake_state = data.get("state", False)

        # REJECT the frontend's strict timer if we are actively using the hardware mic
        if not awake_state and not frontend_mic_active:
            return # Ignore! The backend's new 9-second loop will handle the sleep timeout.

        if is_glasses_awake and not awake_state:
            await stream_audio_to_glasses("Listener went back to sleep.", preemptive=False)
            accumulated_command = ""
                
        is_glasses_awake = awake_state
        if is_glasses_awake: hardware_wake_timer = time.time()
        print(f"[SYNC] Hardware Mic Wake State set to: {is_glasses_awake}")
        return
    
    if command == "FRONTEND_MIC_STATE":
        frontend_mic_active = data.get("state", False)
        return
        
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
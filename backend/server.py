from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
import os
import database
from pydantic import BaseModel

# import four core system modules
import hazard_detection as detect_hazard
import alerting_system as alerts
import ocr as recognize_character
import tool_recognition as recognize_tool
import gps_navigation as gps

app = FastAPI()

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

# NORMAL | NAVIGATION | OCR | TOOL
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

edge_ws_lock = asyncio.Lock()
audio_playing_lock = asyncio.Lock()

# Zero-Latency Event Trigger for ultra-smooth video
new_frame_event = asyncio.Event()

def _decode_video_frame(raw_bytes: bytes) -> Optional[np.ndarray]:
    np_arr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is not None:
        return cv2.flip(img, 1)
    return None

def _encode_video_frame(frame: np.ndarray) -> Optional[bytes]:
    success, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
    if success:
        return encoded.tobytes()
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
        try:
            await dash.send_text(msg)
        except:
            dead_connections.append(dash)
            
    for dead in dead_connections:
        if dead in dashboard_connections:
            dashboard_connections.remove(dead)


def _convert_mp3_to_pcm(mp3_path: str) -> bytes:
    """Synchronous background worker to decode the MP3 using FFmpeg."""
    audio = AudioSegment.from_mp3(mp3_path)
    # This perfectly matches your ESP32's I2S hardware expectations!
    audio = audio.set_frame_rate(22050).set_channels(1).set_sample_width(2)
    return audio.raw_data

async def generate_speech_pcm(text: str) -> Optional[bytes]:
    """Converts text into ultra-realistic neural speech PCM binary data."""
    try:
        temp_mp3 = f"temp_speech_{id(text)}.mp3" # Unique name to prevent overlap
        
        # 1. Generate the Neural Speech 
        # "en-US-ChristopherNeural" is a professional male voice. 
        # (You can also try "en-US-AriaNeural" for a highly realistic female voice)
        communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
        await communicate.save(temp_mp3)
        
        # 2. Run the heavy FFmpeg decoding in a background thread so video doesn't freeze!
        pcm_data = await asyncio.to_thread(_convert_mp3_to_pcm, temp_mp3)
        
        # 3. Clean up the temp file
        if os.path.exists(temp_mp3):
            os.remove(temp_mp3)
            
        return pcm_data
    except Exception as e:
        print(f"[ERROR] Failed to generate Premium TTS audio: {e}")
        return None

async def _process_and_stream_audio(text: str):
    if not text: return
    async with audio_playing_lock:
        # FIX: We now beautifully await the natively asynchronous neural generation!
        pcm_bytes = await generate_speech_pcm(text)
        if pcm_bytes:
            try:
                CHUNK_SIZE = 4096 
                for i in range(0, len(pcm_bytes), CHUNK_SIZE):
                    chunk = pcm_bytes[i : i + CHUNK_SIZE]
                    await safe_ws_send_bytes(chunk)
                    await asyncio.sleep(0.1) 
            except Exception as e:
                print(f"[WARNING] Audio stream interrupted: {e}")


async def stream_audio_to_glasses(text: str):
    if edge_device_ws is None or not text:
        return
    if audio_playing_lock.locked():
        return 
    asyncio.create_task(_process_and_stream_audio(text))


async def _background_safety_ocr(clean_frame: np.ndarray, current_mode: str):
    try:
        annotated_ocr_img, safety_keywords, snippet = await asyncio.to_thread(recognize_character.scan_safety_keywords, clean_frame)
        
        if safety_keywords:
            encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_ocr_img)
            if encoded_bytes:
                global latest_jpeg_bytes, latest_frame_seq
                latest_jpeg_bytes = encoded_bytes
                latest_frame_seq += 1
                new_frame_event.set()

            kw_str = ", ".join(safety_keywords).upper()
            instruction_str = f"Warning sign detected: {kw_str}"
            payload = {
                "type": "log",
                "log": f"WARNING SIGN DETECTED: {kw_str}",
                "instruction": instruction_str, 
                "mode": current_mode,
                "ocr_snippet": snippet[:160],
            }
            if edge_device_ws: 
                try: await edge_device_ws.send_text("ALERT: MOTOR_BOTH") 
                except: pass
            await stream_audio_to_glasses(instruction_str)
            await _broadcast(payload)
            asyncio.create_task(asyncio.to_thread(
                database.log_hazard, f"SIGN: {kw_str}", current_location[0], current_location[1]
            ))

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
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + latest_jpeg_bytes + b'\r\n')
            
            new_frame_event.clear()
            
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/hazards")
def api_get_hazards():
    """React Frontend calls this to show the hazard history list."""
    return database.get_hazard_history()

@app.get("/api/tools")
def api_get_tools():
    """React Frontend calls this to load the tools list from Supabase."""
    return database.get_all_tools()

@app.post("/api/tools")
def api_add_tool(tool: ToolData):
    """React Frontend calls this to save a new tool to Supabase."""
    tool_id = database.add_tool(tool.name, tool.yolo_class, tool.description)
    if tool_id:
        return {"id": tool_id, "message": "Tool added successfully"}
    return {"error": "Failed to add tool"}

@app.delete("/api/tools/{tool_id}")
def api_delete_tool(tool_id: int):
    """React Frontend calls this to remove a tool from Supabase."""
    success = database.delete_tool(tool_id)
    if success:
        return {"message": "Tool deleted successfully"}
    return {"error": "Failed to delete tool"}


@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    global edge_device_ws
    await websocket.accept()
    dashboard_connections.append(websocket)
    print("[INFO] React Dashboard Connected.")

    try:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "status",
                    "device_connected": edge_device_ws is not None,
                    "log": "Dashboard synced with server.",
                    "mode": active_mode,
                    "location": {"lat": current_location[0], "lon": current_location[1]},
                }
            )
        )
        while True:
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
            except Exception:
                continue

            if data.get("type") != "command":
                continue

            await _handle_dashboard_command(websocket, data)
    except WebSocketDisconnect:
        dashboard_connections.remove(websocket)
        print("[INFO] React Dashboard Disconnected.")


async def background_ai_worker():
    global raw_frame_buffer, latest_frame, latest_jpeg_bytes, latest_frame_seq, is_currently_safe, last_ocr_time, edge_device_ws, last_nav_push, active_mode, target_tool_name, dashboard_awake, last_guidance_time, last_guidance_text

    while True:
        try:
            if raw_frame_buffer is not None:
                img_to_process = raw_frame_buffer
                raw_frame_buffer = None 
                
                clean_ocr_frame = img_to_process.copy()

                # =========================================================
                # THE UNIFIED RENDERING PIPELINE
                # =========================================================
                
                # 1. Base Layer: Always process Hazard Detection
                processed_img, status, hazards = await asyncio.to_thread(detect_hazard.analyze_frame, img_to_process)
                latest_frame = processed_img

                # 2. Top Layer: Add Tool boxes ON TOP of hazard boxes
                if active_mode in ["TOOL", "GUIDANCE"]:
                    img, tools, guidance_instruction = await asyncio.to_thread(
                        recognize_tool.analyze_tools, latest_frame, target_tool_name, 0.35, cached_tool_map
                    )
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
                                        "type": "log", 
                                        "log": f"GUIDANCE: {guidance_instruction}", 
                                        "instruction": guidance_instruction, 
                                        "mode": active_mode
                                    })
                                    await stream_audio_to_glasses(guidance_instruction)
                                    last_guidance_time = current_time
                                    last_guidance_text = guidance_instruction
                                
                            if "Grab it now" in guidance_instruction:
                                active_mode = "NORMAL"
                                target_tool_name = None
                                
                                await _broadcast({
                                    "type": "status",
                                    "device_connected": True,
                                    "mode": active_mode,
                                    "log": "Tool secured. Guidance mode deactivated."
                                })

                # 3. Encode EXACTLY ONCE per loop (Massive FPS boost!)
                encoded_bytes = await asyncio.to_thread(_encode_video_frame, latest_frame)
                if encoded_bytes:
                    latest_jpeg_bytes = encoded_bytes
                    latest_frame_seq += 1
                    new_frame_event.set()

                # =========================================================
                # AUDIO & ALERTS PROCESSING
                # =========================================================

                # Handle Hazard Alerts
                if status == "PROCESSED":
                    action_command, log_message, audio_instruction = alerts.generate_alerts(hazards)

                    if log_message.startswith("HAZARD"):
                        await safe_ws_send_text(action_command)
                        await stream_audio_to_glasses(audio_instruction)
                        await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                        
                        if is_currently_safe: # Only log the FIRST time a hazard appears to avoid spamming the DB
                            # Extract simple name (e.g., "STAIRS") from the log message
                            h_type = log_message.replace("HAZARD DETECTED: ", "").split("!")[0]
                            # Use asyncio.to_thread so the database hit doesn't lag the video
                            asyncio.create_task(asyncio.to_thread(
                                database.log_hazard, h_type, current_location[0], current_location[1]
                            ))

                        is_currently_safe = False 

                    elif log_message.startswith("SAFE"):
                        if not is_currently_safe:
                            await safe_ws_send_text(action_command)
                            await stream_audio_to_glasses(audio_instruction)
                            await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                            is_currently_safe = True
                            
                    elif log_message.startswith("INFO"):
                        pass 

                # Handle Navigation Alerts
                if nav_session.active:
                    # Pass the live coordinates into the engine
                    instr = nav_session.process_location(current_location[0], current_location[1])
                    
                    # If the engine yields an instruction, announce it!
                    if instr:
                        await stream_audio_to_glasses(instr)
                        await _broadcast({"type": "log", "log": f"NAVIGATION: {instr}", "instruction": instr, "mode": active_mode})
                        
                        # Shut down mode if arrived
                        if instr == "You have arrived at your destination.":
                            active_mode = "NORMAL"
                            await _broadcast({"type": "status", "mode": "NORMAL", "device_connected": True})

                # Handle Background OCR (Dispatched instantly so video never freezes)
                current_time = time.time()
                if current_time - last_ocr_time > 2:
                    last_ocr_time = current_time
                    asyncio.create_task(_background_safety_ocr(clean_ocr_frame.copy(), active_mode))
                            
        except Exception as e:
            print(f"\n[CRITICAL ERROR] AI Worker Crashed: {e}")
            import traceback
            traceback.print_exc()
            
        await asyncio.sleep(0.005)


@app.websocket("/ws")
async def edge_endpoint(websocket: WebSocket):
    global latest_frame, edge_device_ws, raw_frame_buffer, global_ai_task
    
    if global_ai_task is not None:
        global_ai_task.cancel()
        
    await websocket.accept()
    edge_device_ws = websocket
    print("[SUCCESS] ESP32 Edge Device Connected!")
    
    # Added 'mode' to the broadcast so the React Dashboard doesn't lose its current state
    await _broadcast({"type": "status", "device_connected": True, "mode": active_mode, "log": "SUCCESS: ESP32 Connected."})

    global_ai_task = asyncio.create_task(background_ai_worker())

    try:
        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                raw_bytes = data["bytes"]
                img = await asyncio.to_thread(_decode_video_frame, raw_bytes)
                
                if img is not None:
                    raw_frame_buffer = img

            elif "text" in data:
                try:
                    payload = json.loads(data["text"])
                    if payload.get("type") == "gps":
                        global current_location
                        current_location = (payload["lat"], payload["lon"])
                        await _broadcast({
                            "type": "status",
                            "device_connected": True,
                            "mode": active_mode,
                            "location": {"lat": current_location[0], "lon": current_location[1]}
                        })
                except Exception as e:
                    print(f"Error parsing text payload from ESP32: {e}")

    except WebSocketDisconnect:
        # Only trigger the disconnect sequence if THIS socket is the current active socket!
        if edge_device_ws == websocket:
            edge_device_ws = None
            latest_frame = None
            if global_ai_task: global_ai_task.cancel() 
            print("[WARNING] ESP32 Gracefully Disconnected.")
            await _broadcast({"type": "status", "device_connected": False, "mode": active_mode, "log": "WARNING: ESP32 Disconnected."})
        else:
            print("[INFO] Ghost connection closed. Active connection remains alive.")
        
    except Exception as e:
        # Same validation check for abrupt hardware crashes
        if edge_device_ws == websocket:
            edge_device_ws = None
            latest_frame = None
            if global_ai_task: global_ai_task.cancel() 
            print(f"[ERROR] ESP32 Connection Lost abruptly: {e}")
            await _broadcast({"type": "status", "device_connected": False, "mode": active_mode, "log": "CRITICAL: Hardware Connection Lost."})
        else:
            print(f"[INFO] Ghost connection threw an error but was safely ignored.")


async def _handle_dashboard_command(websocket: WebSocket, data: Dict[str, Any]) -> None:
    global latest_frame, active_mode, nav_session, current_location, target_tool_name

    command = str(data.get("command", "")).upper().strip()

    if command in {"MODE_NORMAL", "MODE_NAVIGATION", "MODE_OCR", "MODE_TOOL"}:
        active_mode = command.replace("MODE_", "")
        if active_mode != "NAVIGATION":
            nav_session.stop()
        await _broadcast(
            {
                "type": "status",
                "device_connected": edge_device_ws is not None,
                "mode": active_mode,
                "log": f"Mode set to {active_mode}.",
                "location": {"lat": current_location[0], "lon": current_location[1]},
            }
        )
        return

    if command == "SET_LOCATION":
        lat = data.get("lat")
        lon = data.get("lon")
        try:
            current_location = (float(lat), float(lon))
        except Exception:
            await websocket.send_text(json.dumps({"type": "log", "log": "LOCATION: Invalid lat/lon.", "mode": active_mode}))
            return
        await _broadcast(
            {
                "type": "status",
                "device_connected": edge_device_ws is not None,
                "mode": active_mode,
                "log": f"LOCATION UPDATED: {current_location[0]:.5f}, {current_location[1]:.5f}",
                "location": {"lat": current_location[0], "lon": current_location[1]},
            }
        )
        return

    if command == "FULL_OCR":
        active_mode = "OCR"
        if latest_frame is None:
            await websocket.send_text(json.dumps({"type": "log", "log": "OCR: No frame available yet.", "mode": active_mode}))
            return
        annotated_img, text, kws = await asyncio.to_thread(recognize_character.analyze_text, latest_frame.copy())
        
        global latest_jpeg_bytes, latest_frame_seq
        encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_img)
        if encoded_bytes:
            latest_jpeg_bytes = encoded_bytes
            latest_frame_seq += 1
            new_frame_event.set()
            
        if not text:
            await stream_audio_to_glasses("No readable text detected.")
            await websocket.send_text(json.dumps({"type": "log", "log": "OCR: No readable text detected.", "mode": active_mode, "instruction": "No readable text detected."}))
            return
        payload = {
            "type": "log",
            "log": f"OCR RESULT: {text[:240]}",
            "instruction": text[:240],
            "mode": active_mode,
            "ocr_keywords": [k.upper() for k in kws],
        }
        await stream_audio_to_glasses(text[:240])
        await _broadcast(payload)
        active_mode = "NORMAL"
        return

    if command == "TOOLS_SCAN":
        active_mode = "TOOL"
        if latest_frame is None:
            await websocket.send_text(json.dumps({"type": "log", "log": "TOOLS: No frame available yet.", "mode": active_mode}))
            return
            
        msg = "Syncing tools with cloud..."
        await stream_audio_to_glasses(msg)
        await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        
        db_tools = await asyncio.to_thread(database.get_all_tools)
        cached_tool_map = {t["yolo_class"].lower(): t["name"] for t in db_tools}
        
        msg = "Scanning area..."
        await stream_audio_to_glasses(msg)
        await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        
        annotated_img, tools, guidance_text = await asyncio.to_thread(
            recognize_tool.analyze_tools, latest_frame.copy(), None, 0.35, cached_tool_map
        )
        
        encoded_bytes = await asyncio.to_thread(_encode_video_frame, annotated_img)
        if encoded_bytes:
            latest_jpeg_bytes = encoded_bytes
            latest_frame_seq += 1
            new_frame_event.set()

        if not tools:
            await stream_audio_to_glasses("No tools detected.")
            await _broadcast({"type": "log", "log": "TOOLS: No tools detected (or model not configured).", "instruction": "No tools detected.", "mode": "NORMAL"})
        else:
            names = ", ".join(sorted({t["name"] for t in tools}))
            instruction_str = f"TOOLS DETECTED: {names}"
            await stream_audio_to_glasses(instruction_str)
            await _broadcast({
                "type": "log", 
                "log": instruction_str, 
                "instruction": instruction_str, 
                "mode": "NORMAL", 
                "tools": tools
            })

        active_mode = "NORMAL"
        return

    if command == "NAV_START":
        active_mode = "NAVIGATION"
        dest_query = str(data.get("destination", "")).strip()
        
        dest_coords = None
        dest_name = "Destination"

        if dest_query:
            # Send the searching instruction so the dashboard speaks it and updates the HUD
            msg = f"Searching for {dest_query}..."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": f"NAVIGATION: {msg}", "instruction": msg, "mode": active_mode})
            
            geo_result = await asyncio.to_thread(gps.geocode_place, dest_query, current_location[0], current_location[1])
            
            if geo_result:
                dest_coords = (geo_result[0], geo_result[1])
                dest_name = geo_result[2]
            else:
                err_msg = f"Could not find {dest_query}."
                await stream_audio_to_glasses(err_msg)
                await _broadcast({"type": "log", "log": f"NAVIGATION ERROR: {err_msg}", "instruction": err_msg, "mode": "NORMAL"})
                active_mode = "NORMAL"
                return
        else:
            dest_lat, dest_lon = data.get("dest_lat"), data.get("dest_lon")
            if dest_lat is not None and dest_lon is not None:
                try:
                    dest_coords = (float(dest_lat), float(dest_lon))
                    dest_name = "Custom Coordinates"
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
        
        mins = int(plan.duration_sec // 60)
        mins_text = f"{mins} minute" if mins == 1 else f"{mins} minutes"
        dist = int(plan.total_distance_m)
        
        announcement = f"Route found to {dest_name}. It is {dist} meters away, about a {mins_text} walk."
        
        await stream_audio_to_glasses(announcement)
        await _broadcast({
            "type": "log",
            "log": f"NAVIGATION STARTED: {dist}m, {mins} mins to {dest_name}",
            "instruction": announcement,
            "mode": active_mode,
            "nav": {"provider": plan.provider, "total_distance_m": dist, "dest": {"lat": dest_coords[0], "lon": dest_coords[1]}},
        })
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
            cached_tool_map = {t["yolo_class"].lower(): t["name"] for t in db_tools}
            
        return

    if command == "SEARCH_STOP":
        if active_mode == "GUIDANCE" or active_mode == "TOOL":
            active_mode = "NORMAL"
            target_tool_name = None
            msg = "Search cancelled."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        return

    if command == "DASHBOARD_WAKE":
        dashboard_awake = data.get("state", False)
        return

    await websocket.send_text(json.dumps({"type": "log", "log": f"Unknown command: {command}", "mode": active_mode}))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
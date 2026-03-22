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
import wave
import os

# import four core system modules
import hazard_detection as detect_hazard
import alerting_system as alerts
import ocr as recognize_character
import tool_recognition as recognize_tool
import gps_navigation as gps

app = FastAPI()
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

active_mode = "NORMAL"  # NORMAL | NAVIGATION | OCR | TOOL

nav_session = gps.NavigationSession()
last_nav_push = 0.0
DEFAULT_START_LOCATION = (5.41, 100.33)
current_location = DEFAULT_START_LOCATION

target_tool_name = None # Stores the tool we are currently looking for
dashboard_awake = False # Tracks if the UI is actively listening for a command

# Cooldown trackers for guidance so it doesn't spam the audio
last_guidance_time = 0.0
last_guidance_text = ""

raw_frame_buffer = None # The mailbox between the fast WebSocket and the slow AI
frame_pending = False # True when ESP32 sent a frame that is not processed into latest_frame yet

global_ai_task = None # Ensures we never spawn duplicate AI threads


async def _broadcast(payload: Dict[str, Any]) -> None:
    msg = json.dumps(payload)
    dead_connections = []
    
    for dash in dashboard_connections:
        try:
            await dash.send_text(msg)
        except:
            dead_connections.append(dash)
            
    # Prevent memory leaks and duplicate routing by purging dead connections
    for dead in dead_connections:
        if dead in dashboard_connections:
            dashboard_connections.remove(dead)


def generate_speech_pcm(text: str) -> Optional[bytes]:
    """Converts text into raw 16-bit PCM binary audio data."""
    try:
        temp_filename = "temp_speech.wav"
        # 1. Generate the spoken WAV file
        tts_engine.save_to_file(text, temp_filename)
        tts_engine.runAndWait()
        
        # 2. Extract the raw binary audio frames (skipping the WAV header)
        with wave.open(temp_filename, 'rb') as wf:
            pcm_data = wf.readframes(wf.getnframes())
            
        # 3. Clean up the temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        return pcm_data
    except Exception as e:
        print(f"[ERROR] Failed to generate TTS audio: {e}")
        return None

async def stream_audio_to_glasses(text: str):
    """Streams the generated binary audio down the WebSocket to the ESP32."""
    if edge_device_ws is None:
        return
    
    # Run the heavy TTS generation in a background thread so video doesn't lag
    pcm_bytes = await asyncio.to_thread(generate_speech_pcm, text)
    
    if pcm_bytes:
        try:
            # Send the raw audio binary data to the ESP32
            CHUNK_SIZE = 1024

            for i in range(0, len(pcm_bytes), CHUNK_SIZE):
                chunk = pcm_bytes[i : i + CHUNK_SIZE]
                await edge_device_ws.send_bytes(chunk)
                await asyncio.sleep(0.02)

        except Exception as e:
            print(f"[ERROR] Audio Stream Failed: {e}")


@app.get("/video_feed")
async def video_feed():
    async def generate():
        last_sent_seq = -1
        while True:
            if latest_jpeg_bytes is not None and latest_frame_seq != last_sent_seq:
                last_sent_seq = latest_frame_seq
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + latest_jpeg_bytes + b'\r\n')
            await asyncio.sleep(0.01)
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")


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

                processed_img, status, hazards = await asyncio.to_thread(detect_hazard.analyze_frame, img_to_process)
                latest_frame = processed_img

                success, encoded_img = cv2.imencode('.jpg', latest_frame)
                if success:
                    latest_jpeg_bytes = encoded_img.tobytes()
                    latest_frame_seq += 1

                if status == "PROCESSED":
                    action_command, log_message, audio_instruction = alerts.generate_alerts(hazards)

                    if "HAZARD" in log_message:
                        if edge_device_ws:
                            try: await edge_device_ws.send_text(action_command)
                            except: pass
                        await stream_audio_to_glasses(audio_instruction)
                        await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                        is_currently_safe = False 

                    else:
                        if not is_currently_safe:
                            if edge_device_ws:
                                try: await edge_device_ws.send_text(action_command)
                                except: pass
                            await stream_audio_to_glasses(audio_instruction)
                            await _broadcast({"type": "log", "log": log_message, "instruction": audio_instruction, "mode": active_mode})
                            is_currently_safe = True

                if nav_session.active and (time.time() - last_nav_push) > 3.0:
                    instr = nav_session.next_instruction()
                    last_nav_push = time.time()
                    if instr:
                        await stream_audio_to_glasses(instr)
                        await _broadcast({"type": "log", "log": f"NAVIGATION: {instr}", "instruction": instr, "mode": active_mode})

                current_time = time.time()
                if current_time - last_ocr_time > 5:
                    safety_keywords, snippet = await asyncio.to_thread(recognize_character.scan_safety_keywords, processed_img)
                    
                    if safety_keywords:
                        kw_str = ", ".join(safety_keywords).upper()
                        instruction_str = f"Warning sign detected: {kw_str}"
                        payload = {
                            "type": "log",
                            "log": f"WARNING SIGN DETECTED: {kw_str}",
                            "instruction": instruction_str, 
                            "mode": active_mode,
                            "ocr_snippet": snippet[:160],
                        }
                        if edge_device_ws: 
                            try: await edge_device_ws.send_text("ALERT: MOTOR_BOTH") 
                            except: pass
                        await stream_audio_to_glasses(instruction_str)
                        await _broadcast(payload)
                            
                    last_ocr_time = current_time

                if active_mode in ["TOOL", "GUIDANCE"]:
                    img, tools, guidance_instruction = await asyncio.to_thread(
                        recognize_tool.analyze_tools, processed_img.copy(), target_tool_name
                    )
                    latest_frame = img 
                    
                    success, encoded_img = cv2.imencode('.jpg', latest_frame)
                    if success:
                        latest_jpeg_bytes = encoded_img.tobytes()
                        latest_frame_seq += 1

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
                                # FIX: Only speak if the instruction changed OR 2.5 seconds have passed
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
                            
        except Exception as e:
            print(f"\n[CRITICAL ERROR] AI Worker Crashed: {e}")
            import traceback
            traceback.print_exc()
            
        await asyncio.sleep(0.001)


@app.websocket("/ws")
async def edge_endpoint(websocket: WebSocket):
    global latest_frame, edge_device_ws, raw_frame_buffer, global_ai_task
    
    # If the ESP32 reconnects rapidly, murder the old AI thread before spawning a new one.
    if global_ai_task is not None:
        global_ai_task.cancel()
        
    await websocket.accept()
    edge_device_ws = websocket
    print("[SUCCESS] ESP32 Edge Device Connected!")
    await _broadcast({"type": "status", "device_connected": True, "log": "SUCCESS: ESP32 Connected."})

    global_ai_task = asyncio.create_task(background_ai_worker())

    try:
        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                raw_bytes = data["bytes"]
                np_arr = np.frombuffer(raw_bytes, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    img = cv2.flip(img, 1)
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
        edge_device_ws = None
        latest_frame = None
        if global_ai_task: global_ai_task.cancel() 
        print("[WARNING] ESP32 Gracefully Disconnected.")
        await _broadcast({"type": "status", "device_connected": False, "mode": active_mode, "log": "WARNING: ESP32 Disconnected."})
        
    except Exception as e:
        edge_device_ws = None
        latest_frame = None
        if global_ai_task: global_ai_task.cancel() 
        print(f"[ERROR] ESP32 Connection Lost abruptly: {e}")
        await _broadcast({"type": "status", "device_connected": False, "mode": active_mode, "log": "CRITICAL: Hardware Connection Lost."})


async def _handle_dashboard_command(websocket: WebSocket, data: Dict[str, Any]) -> None:
    """
    Commands are executed server-side against the most recent frame.
    This enables "active interaction" without interfering with the passive loop.
    """
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
        text, kws = recognize_character.analyze_text(latest_frame.copy())
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
        return

    if command == "TOOLS_SCAN":
        active_mode = "TOOL"
        if latest_frame is None:
            await websocket.send_text(json.dumps({"type": "log", "log": "TOOLS: No frame available yet.", "mode": active_mode}))
            return
        msg = "Scanning tools..."
        await stream_audio_to_glasses(msg)
        await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        return
        if not tools:
            await stream_audio_to_glasses("No tools detected.")
            await _broadcast({"type": "log", "log": "TOOLS: No tools detected (or model not configured).", "instruction": "No tools detected.", "mode": active_mode})
            return
        names = ", ".join(sorted({t["name"] for t in tools}))
        instruction_str = f"{names} is detected"
        await stream_audio_to_glasses(instruction_str)
        await _broadcast({"type": "log", "log": f"TOOLS DETECTED: {names}", "instruction": f"Detected: {names}", "mode": active_mode, "tools": tools})
        return

    if command == "NAV_START":
        active_mode = "NAVIGATION"
        dest_query = str(data.get("destination", "")).strip()
        dest = gps.geocode_place(dest_query) if dest_query else None
        if dest is None:
            # If geocoding is disabled/unavailable, accept raw lat/lon from UI.
            dest_lat = data.get("dest_lat")
            dest_lon = data.get("dest_lon")
            if dest_lat is not None and dest_lon is not None:
                try:
                    dest = (float(dest_lat), float(dest_lon))
                except Exception:
                    dest = None
        if dest is None:
            await stream_audio_to_glasses("Destination not set.")
            await _broadcast({"type": "log", "log": "NAVIGATION: Destination not set. Provide a place name (enable geocoding) or dest_lat/dest_lon.", "mode": active_mode})
            return

        start = current_location
        plan = gps.plan_navigation(start, dest)
        nav_session.start(plan)
        await stream_audio_to_glasses("Navigation started.")
        await _broadcast(
            {
                "type": "log",
                "log": f"NAVIGATION STARTED ({plan.provider}): {plan.total_distance_m:.0f}m",
                "instruction": "Navigation started.",
                "mode": active_mode,
                "nav": {"provider": plan.provider, "total_distance_m": plan.total_distance_m, "dest": {"lat": dest[0], "lon": dest[1]}},
            }
        )
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
        return

    # Handle the Stop Search Command
    if command == "SEARCH_STOP":
        if active_mode == "GUIDANCE" or active_mode == "TOOL":
            active_mode = "NORMAL"
            target_tool_name = None
            msg = "Search cancelled."
            await stream_audio_to_glasses(msg)
            await _broadcast({"type": "log", "log": msg, "instruction": msg, "mode": active_mode})
        return

    # Sync the "Awake" state from the React Dashboard
    if command == "DASHBOARD_WAKE":
        dashboard_awake = data.get("state", False)
        return

    await websocket.send_text(json.dumps({"type": "log", "log": f"Unknown command: {command}", "mode": active_mode}))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
import speech_recognition as sr
import io
import wave
import re

class VoiceCommandEngine:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 400
        self.recognizer.dynamic_energy_threshold = True

    def process_raw_pcm(self, raw_pcm_data):
        try:
            # Convert raw bytes to AudioData object
            audio_data = sr.AudioData(raw_pcm_data, 22050, 2)
            
            # Use Google's API
            text = self.recognizer.recognize_google(audio_data)
            return text.lower()
        except sr.UnknownValueError:
            return None # Heard sound but couldn't make out words
        except sr.RequestError:
            print("[CRITICAL] Google Speech API is down or No Internet")
            return None
        except Exception as e:
            print(f"[VOICE ENGINE ERROR] {e}")
            return None

    def parse_command(self, text):
        text = text.lower()
        
        # 1. NAVIGATION: Find 'navigate to' or 'go to'
        if "navigate to" in text or "go to" in text:
            target = text.split("to")[-1].strip()
            if target:
                return {"command": "NAV_START", "destination": target}

        # 2. OCR: Find 'read', 'scan', or 'ocr'
        if any(kw in text for kw in ["read", "scan", "ocr", "text"]):
            return {"command": "FULL_OCR"}

        # 3. SEARCH: Find 'search for' or 'find'
        if "search for" in text or "find" in text:
            match = re.search(r"(?:search for|find)\s+(?:my\s+|the\s+)?(.+)", text)
            if match and match.group(1).strip():
                return {"command": "SEARCH_TOOL", "target_tool": match.group(1).strip()}
            else:
                # NEW: Explicitly return a "Partial Command" instead of None
                return {"command": "INVALID_SEARCH"}

        # 4. STOP: Find 'stop' or 'cancel'
        if "stop" in text or "cancel" in text:
            if "navigation" in text:
                return {"command": "NAV_STOP"}
            if "search" in text or "find" in text:
                return {"command": "SEARCH_STOP"}
                
        return None
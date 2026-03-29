import speech_recognition as sr
import re

class VoiceCommandEngine:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        # Lowered threshold slightly since Python is handling the VAD now
        self.recognizer.energy_threshold = 300 
        self.recognizer.dynamic_energy_threshold = True

    def process_raw_pcm(self, raw_pcm_data):
        try:
            audio_data = sr.AudioData(raw_pcm_data, 22050, 2)
            text = self.recognizer.recognize_google(audio_data)
            return text.lower()
        except sr.UnknownValueError:
            return None 
        except sr.RequestError:
            print("[CRITICAL] Google Speech API is down or No Internet")
            return None
        except Exception as e:
            print(f"[VOICE ENGINE ERROR] {e}")
            return None

    def parse_command(self, text):
        text = text.lower()
        
        # 0. CLEANUP: Strip out conversational filler
        fillers = ["help me to ", "can you ", "please ", "i want to ", "help me ", "could you "]
        for filler in fillers:
            text = text.replace(filler, "")

        # 1. NAVIGATION
        nav_keywords = ["navigate to", "go to", "take me to", "directions to"]
        if any(kw in text for kw in nav_keywords):
            for kw in nav_keywords:
                if kw in text:
                    target = text.split(kw)[-1].strip()
                    if target:
                        return {"command": "NAV_START", "destination": target}
            return {"command": "NAV_START", "destination": ""} 

        # 2. OCR
        if any(kw in text for kw in ["read", "scan", "ocr", "text", "what does it say"]):
            return {"command": "FULL_OCR"}

        # 3. SEARCH (Returns INVALID_SEARCH if they haven't finished speaking the object yet)
        if any(kw in text for kw in ["search for", "find", "where is", "looking for"]):
            match = re.search(r"(?:search for|find|where is|looking for)\s+(?:my\s+|the\s+|a\s+)?(.+)", text)
            if match and match.group(1).strip():
                return {"command": "SEARCH_TOOL", "target_tool": match.group(1).strip()}
            else:
                return {"command": "INVALID_SEARCH"}

        # 4. STOP (Prioritized Emergency Brakes)
        if any(kw in text for kw in ["stop", "cancel", "quit", "abort", "shut up"]):
            if "nav" in text: return {"command": "NAV_STOP"}
            if any(k in text for k in ["search", "find", "looking"]): return {"command": "SEARCH_STOP"}
            return {"command": "NAV_STOP"}
            
        return None
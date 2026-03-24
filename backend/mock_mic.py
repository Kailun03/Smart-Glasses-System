import pyaudio
import asyncio
import websockets

async def stream_mic():
    uri = "ws://localhost:8000/ws/audio"
    
    print("[MOCK MIC] Connecting to Server...")
    try:
        async with websockets.connect(uri) as ws:
            print("[MOCK MIC] Connected! Start speaking.")
            print("Try saying: 'Scan the text' or 'Scan tools'")
            
            p = pyaudio.PyAudio()
            # Vosk requires strictly 16000Hz, 1 Channel, 16-bit audio
            stream = p.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=4000)
            
            try:
                while True:
                    data = stream.read(4000, exception_on_overflow=False)
                    await ws.send(data)
                    await asyncio.sleep(0.01)
            except KeyboardInterrupt:
                print("\n[MOCK MIC] Stopping...")
            finally:
                stream.stop_stream()
                stream.close()
                p.terminate()
    except ConnectionRefusedError:
        print("[ERROR] Server is not running. Start server.py first!")

if __name__ == "__main__":
    asyncio.run(stream_mic())
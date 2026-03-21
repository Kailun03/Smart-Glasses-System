import React, { useState, useEffect, useRef } from 'react';
import { Activity, Terminal, Trash2, Server, Cpu, Glasses, LogOut, Battery, Navigation, Command, Volume2, VolumeX, Mic, MicOff } from 'lucide-react'; // Added Mic & MicOff

const SYSTEM_MODES = {
  NORMAL: { id: 'NORMAL', label: 'Normal Mode', color: 'transparent' },
  NAVIGATION: { id: 'NAVIGATION', label: 'Navigation Mode', color: '#22c55e' },
  OCR: { id: 'OCR', label: 'OCR Text Mode', color: '#f59e0b' },                
  TOOL: { id: 'TOOL', label: 'Tool Recognition', color: '#38bdf8' }
};

function VisionDashboard({ onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [videoKey, setVideoKey] = useState(Date.now());
  const [activeMode, setActiveMode] = useState(SYSTEM_MODES.NORMAL);
  const [currentInstruction, setCurrentInstruction] = useState("");
  const logsEndRef = useRef(null);
  const transientModeResetRef = useRef(null);
  const lastOneShotRef = useRef({ kind: null, at: 0 });

  const [backendConnected, setBackendConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const wsRef = useRef(null);
  const [navDestination, setNavDestination] = useState("");
  const navDestRef = useRef("");
  const [location, setLocation] = useState(null); 
  const [navState, setNavState] = useState({ active: false, provider: null, dest: null, pending: false });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false); 
  const lastSpokenTextRef = useRef("");
  
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);
  const recognitionRef = useRef(null);

  const commandsEnabled = backendConnected && deviceConnected;
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // SPEECH-TO-TEXT (VOICE COMMANDS) ENGINE
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        // Guard: Do not listen if the system is currently speaking (Prevents echo loops)
        if (window.speechSynthesis.speaking) return;

        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        
        // Visual feedback in the terminal that the system heard you
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `[Heard] "${transcript}"`, type: "info" }]);

        // Voice Command Routing
        if (transcript.includes("read text") || transcript.includes("full ocr") || transcript.includes("scan text")) {
          sendCommand({ command: "FULL_OCR" });
        } 
        else if (transcript.includes("scan tool") || transcript.includes("find tool")) {
          sendCommand({ command: "TOOLS_SCAN" });
        } 
        else if (transcript.includes("stop navigation") || transcript.includes("cancel navigation")) {
          sendCommand({ command: "NAV_STOP" });
        } 
        else if (transcript.includes("navigate to")) {
          const dest = transcript.split("navigate to")[1].trim();
          if (dest) {
            setNavDestination(dest);
            navDestRef.current = dest; // Sync the ref!
            sendCommand({ command: "NAV_START", destination: dest });
          }
        } 
        else if (transcript.includes("start navigation")) {
          startNavigation();
        }
      };

      recognition.onend = () => {
        // If it drops automatically but the user still wants it on, restart it instantly.
        if (isListeningRef.current) {
           try { recognition.start(); } catch(e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "🎤 Speech Recognition not supported in this browser.", type: "error" }]);
      return;
    }
    const newState = !isListening;
    setIsListening(newState);
    isListeningRef.current = newState;

    if (newState) {
      try { recognitionRef.current.start(); } catch(e) {}
      speakInstruction("Voice commands activated.", true);
    } else {
      recognitionRef.current.stop();
      speakInstruction("Voice commands deactivated.", true);
    }
  };

  // WebSocket Connection
  useEffect(() => {
    shouldReconnectRef.current = true;

    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/dashboard');
      wsRef.current = ws;

      ws.onopen = () => {
        const wasReconnecting = reconnectAttemptsRef.current > 0;
        reconnectAttemptsRef.current = 0;
        setBackendConnected(true);
        if (wasReconnecting) setVideoKey(Date.now());
        setLogs(prev => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            text: wasReconnecting ? "Host reconnected. Resyncing dashboard..." : "System Initialized. AI Backend Online.",
            type: "info",
          },
        ]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "status") {
              setDeviceConnected(data.device_connected);
              if (data.location && typeof data.location.lat === "number" && typeof data.location.lon === "number") {
                setLocation({ lat: data.location.lat, lon: data.location.lon });
              }
              if (data.mode && SYSTEM_MODES[data.mode]) {
                setActiveMode(SYSTEM_MODES[data.mode]);
              }
          }

          // Catch log instruction
          if (data.log) {
            if (data.type !== "status") {
              setDeviceConnected(true); 
            }

            const isHazard = data.log.includes("HAZARD");
            const isWarning = data.log.includes("WARNING");

            if (data.log.startsWith("NAVIGATION STARTED")) {
              setNavState({
                active: true,
                provider: data.nav?.provider || null,
                dest: data.nav?.dest || null,
                pending: false,
              });
            } else if (data.log.startsWith("NAVIGATION STOPPED")) {
              setNavState({ active: false, provider: null, dest: null, pending: false });
            } else if (data.log.startsWith("NAVIGATION: Destination not set")) {
              setNavState({ active: false, provider: null, dest: null, pending: false });
              setActiveMode(SYSTEM_MODES.NORMAL);
            }
            
            setLogs(prev => [...prev, { 
              time: new Date().toLocaleTimeString(), 
              text: data.log, 
              type: isHazard ? "alert" : isWarning ? "error" : "normal" 
            }]);
          }

          // Catch the new instruction field
          if (data.instruction) {
            setCurrentInstruction(data.instruction);
            
            // Speak the instruction
            speakInstruction(data.instruction);

            // Clear the instruction after 3 seconds if no new hazard appears
            setTimeout(() => setCurrentInstruction(""), 3000);
          }

          // Catch mode updates from backend
          if (data.mode && SYSTEM_MODES[data.mode]) {
            setActiveMode(SYSTEM_MODES[data.mode]);

            if (data.mode === "OCR" || data.mode === "TOOL") {
              if (transientModeResetRef.current) clearTimeout(transientModeResetRef.current);
              transientModeResetRef.current = setTimeout(() => {
                setActiveMode(SYSTEM_MODES.NORMAL);
              }, 2600);
            }
          }
        } catch (e) {}
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setBackendConnected(false);
        setDeviceConnected(false); 
        setLogs(prev => [
          ...prev,
          { time: new Date().toLocaleTimeString(), text: "CRITICAL: Backend Disconnected.", type: "error" },
        ]);

        if (!shouldReconnectRef.current) return;

        reconnectAttemptsRef.current += 1;
        const attempt = reconnectAttemptsRef.current;
        const delayMs = Math.min(5000, 600 * attempt); // backoff cap at 5s

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current) connect();
        }, delayMs);
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (transientModeResetRef.current) clearTimeout(transientModeResetRef.current);
      try {
        wsRef.current?.close();
      } catch (e) {}
    };
  }, []);

  const sendCommand = (payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "Backend not connected. Command not sent.", type: "error" }]);
      return;
    }

    const cmd = String(payload?.command || "").toUpperCase();
    if (cmd === "FULL_OCR") {
      lastOneShotRef.current = { kind: "OCR", at: Date.now() };
      setActiveMode(SYSTEM_MODES.OCR);
      setCurrentInstruction("Running OCR...");
      if (transientModeResetRef.current) clearTimeout(transientModeResetRef.current);
    } else if (cmd === "TOOLS_SCAN") {
      lastOneShotRef.current = { kind: "TOOL", at: Date.now() };
      setActiveMode(SYSTEM_MODES.TOOL);
      setCurrentInstruction("Scanning tools...");
      if (transientModeResetRef.current) clearTimeout(transientModeResetRef.current);
    } else if (cmd === "NAV_START") {
      setActiveMode(SYSTEM_MODES.NAVIGATION);
      setNavState(prev => ({ ...prev, pending: true }));
      setCurrentInstruction("Starting navigation...");
      if (transientModeResetRef.current) clearTimeout(transientModeResetRef.current);
    } else if (cmd === "NAV_STOP") {
      setNavState({ active: false, provider: null, dest: null, pending: false });
    }

    ws.send(JSON.stringify({ type: "command", ...payload }));
  };

  const parseLatLon = (raw) => {
    const text = String(raw || "").trim();
    const m = text.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  };

  const startNavigation = () => {
    // FIX: Must use navDestRef.current here so voice commands don't trigger stale state closures!
    const coords = parseLatLon(navDestRef.current);
    if (coords) {
      sendCommand({ command: "NAV_START", dest_lat: coords.lat, dest_lon: coords.lon, destination: navDestRef.current });
      return;
    }
    sendCommand({ command: "NAV_START", destination: navDestRef.current });
  };

  const navPaused = navState.active && !deviceConnected;
  const displayMode = (navState.active || navState.pending) ? SYSTEM_MODES.NAVIGATION : activeMode;

  const formatLatLon = (lat, lon) => {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
  };

  // TEXT-TO-SPEECH (TTS) ENGINE
  const speakInstruction = (text, force = false) => {
    const synth = window.speechSynthesis;
  
    if (!audioEnabledRef.current && !force)  return;
  
    // Normalize text to avoid "Stop" vs "Stop." problem
    const normalize = (t) =>
      String(t).toLowerCase().replace(/[^\w\s]/g, "").trim();
  
    const newText = normalize(text);
    const currentText = normalize(lastSpokenTextRef.current);
  
    if (synth.speaking) {
      if (newText === currentText) return; 
      else synth.cancel();
    } 
  
    lastSpokenTextRef.current = text;
  
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
  
    synth.speak(utterance);
  };

  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    audioEnabledRef.current = newState;

    if (newState) {
      speakInstruction("Voice assistant enabled.", true); 
    } else {
      window.speechSynthesis.cancel(); 
      speakInstruction("Voice assistant muted.", true); 
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0', overflow: 'hidden' }}>
      
      <style>{`
        /* Target only our log container */
          .custom-log-container::-webkit-scrollbar {
              width: 5px; 
              margin-right: -5px; 
          }
          
          .custom-log-container::-webkit-scrollbar-track {
              background: transparent; 
          }
          
          .custom-log-container::-webkit-scrollbar-thumb {
              background-color: #475569; 
              border-radius: 4px; 
              border: 1px solid transparent; 
          }

          .custom-log-container::-webkit-scrollbar-thumb:hover {
              background-color: #64748b; 
          }

          /* Subtle Breathing Animation */
          @keyframes subtleBreathe {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
          }

          /* Custom Animated Tooltip */
          .btn-container {
              position: relative;
              display: inline-flex;
              align-items: center;
          }
          
          .custom-tooltip {
              visibility: hidden;
              opacity: 0;
              background-color: #1e293b;
              color: #f8fafc;
              border: 1px solid #334155;
              text-align: center;
              border-radius: 6px;
              padding: 6px 12px;
              position: absolute;
              z-index: 100;
              top: 130%; 
              right: 0; 
              font-size: 11px;
              white-space: nowrap;
              font-weight: 600;
              letter-spacing: 0.5px;
              transform: translateY(-8px); 
              transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          
          .custom-tooltip::after {
              content: "";
              position: absolute;
              bottom: 100%;
              right: 8px; 
              border-width: 5px;
              border-style: solid;
              border-color: transparent transparent #1e293b transparent;
          }

          .btn-container:hover .custom-tooltip {
              visibility: visible;
              opacity: 1;
              transform: translateY(0); 
          }

          /* Command Palette */
          .cmd-container {
              position: relative;
              display: inline-flex;
              align-items: center;
          }

          .cmd-btn {
              background: none;
              border: none;
              color: #64748b;
              cursor: pointer;
              display: flex;
              align-items: center;
              transition: color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
          }

          .cmd-btn:hover {
              color: #38bdf8;
              transform: translateY(-1px);
          }

          .cmd-btn.disabled {
              cursor: not-allowed;
              opacity: 0.55;
          }

          .cmd-tooltip {
              visibility: hidden;
              opacity: 0;
              background-color: #0b1220;
              color: #f8fafc;
              border: 1px solid rgba(148, 163, 184, 0.22);
              text-align: left;
              border-radius: 10px;
              padding: 8px 12px;
              position: absolute;
              z-index: 120;
              top: 130%;
              right: 0;
              font-size: 11px;
              white-space: nowrap;
              font-weight: 700;
              letter-spacing: 0.2px;
              transform: translateY(-10px);
              transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 10px 30px rgba(0,0,0,0.55);
          }

          .cmd-tooltip::after {
              content: "";
              position: absolute;
              bottom: 100%;
              right: 10px;
              border-width: 6px;
              border-style: solid;
              border-color: transparent transparent #0b1220 transparent;
          }

          .cmd-panel {
              visibility: hidden;
              opacity: 0;
              position: absolute;
              top: 130%;
              right: 0;
              width: 284px;
              background: radial-gradient(1200px 600px at 20% -20%, rgba(56, 189, 248, 0.16), rgba(0,0,0,0)), #0b1220;
              border: 1px solid rgba(148, 163, 184, 0.22);
              border-radius: 14px;
              padding: 12px;
              transform: translateY(-12px) scale(0.98);
              transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
              box-shadow: 0 18px 60px rgba(0,0,0,0.65);
              z-index: 140;
              backdrop-filter: blur(14px);
          }

          .cmd-container.enabled:hover .cmd-panel {
              visibility: visible;
              opacity: 1;
              transform: translateY(0) scale(1);
          }

          .cmd-container.disabled:hover .cmd-tooltip {
              visibility: visible;
              opacity: 1;
              transform: translateY(0);
          }

          .media-btn-container {
              position: relative;
              display: inline-flex;
              align-items: center;
          }

          .media-toggle-btn {
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              justify-content: center;
              align-items: center;
              cursor: pointer;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .media-toggle-btn:hover {
              background: rgba(255, 255, 255, 0.15);
              transform: translateY(-2px) scale(1.02);
          }

          /* Glowing Effects for Active States */
          .media-toggle-btn.mic-active {
              background: rgba(56, 189, 248, 0.15);
              border-color: rgba(56, 189, 248, 0.4);
              box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
          }

          .media-toggle-btn.audio-active {
              background: rgba(34, 197, 94, 0.15);
              border-color: rgba(34, 197, 94, 0.4);
              box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
          }

          /* Upward Tooltip for Bottom Left placement */
          .custom-tooltip-up {
              visibility: hidden;
              opacity: 0;
              background-color: #1e293b;
              color: #f8fafc;
              border: 1px solid #334155;
              text-align: center;
              border-radius: 6px;
              padding: 6px 12px;
              position: absolute;
              z-index: 100;
              bottom: 140%; 
              left: 50%; 
              transform: translateX(-50%) translateY(8px);
              font-size: 11px;
              white-space: nowrap;
              font-weight: 600;
              letter-spacing: 0.5px;
              transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 -4px 12px rgba(0,0,0,0.5);
          }

          .custom-tooltip-up::after {
              content: "";
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              border-width: 5px;
              border-style: solid;
              border-color: #1e293b transparent transparent transparent;
          }

          .media-btn-container:hover .custom-tooltip-up {
              visibility: visible;
              opacity: 1;
              transform: translateX(-50%) translateY(0);
          }

      `}</style>

      {/* LEFT PANEL: Camera Feed & Overlays */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Offline Overlay */}
        {!deviceConnected && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ef4444', zIndex: 10 }}>
                <Activity size={32} style={{ marginBottom: '12px', animation: 'subtleBreathe 3s infinite ease-in-out' }} />
                <h2 style={{ margin: 0, letterSpacing: '2px', fontSize: '18px', animation: 'subtleBreathe 3s infinite ease-in-out', animationDelay: '0.2s' }}>
                  NO VIDEO SIGNAL
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: '8px', animation: 'subtleBreathe 3s infinite ease-in-out', animationDelay: '0.4s' }}>
                  Awaiting ESP32 hardware connection...
                </p>
            </div>
        )}

        {/* Video Feed */}
        {deviceConnected && (
          <img 
            key={videoKey}
            src={`http://localhost:8000/video_feed?t=${videoKey}`} 
            alt="Stream inactive" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        )}
        
        {/* TOP LEFT OVERLAY: HUD Status Bar */}
        <div style={{ 
            position: 'absolute', 
            top: '20px', 
            left: '20px', 
            backgroundColor: 'rgba(0, 0, 0, 0.4)', 
            backdropFilter: 'blur(12px)', 
            padding: '8px 16px', 
            borderRadius: '24px', 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'center', 
            zIndex: 20 
        }}>
            
            {/* Host Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color={backendConnected ? "#22c55e" : "#ef4444"} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: backendConnected ? "#22c55e" : "#ef4444", letterSpacing: '0.5px' }}>
                HOST {backendConnected ? "ON" : "OFF"}
              </span>
            </div>
            
            <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.2)' }}></div>

            {/* Edge Device Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color={deviceConnected ? "#38bdf8" : "#64748b"} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: deviceConnected ? "#38bdf8" : "#64748b", letterSpacing: '0.5px' }}>
                EDGE {deviceConnected ? "SYNC" : "OFF"}
              </span>
            </div>

            {/* Dynamic Hardware Details (Only renders when device is connected) */}
            {deviceConnected && (
              <>
                <div style={{ width: '1px', height: '12px', backgroundColor: 'rgba(255,255,255,0.2)' }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Battery size={14} color="#f8fafc" />
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#f8fafc' }}>98%</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Glasses size={14} color="#f8fafc" />
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#f8fafc' }}>SGS-MLY000001-A</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Navigation size={14} color="#f8fafc" />
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#f8fafc' }}>
                    {location ? formatLatLon(location.lat, location.lon) : "Loc: —"}
                  </span>
                </div>
              </>
            )}
        </div>

        {/* BOTTOM LEFT OVERLAY: Voice & Audio Controls */}
        <div style={{ 
            position: 'absolute', 
            bottom: '24px', 
            left: '24px', 
            backgroundColor: 'rgba(0, 0, 0, 0.4)', 
            backdropFilter: 'blur(12px)', 
            padding: '8px 10px', 
            borderRadius: '28px', 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center', 
            zIndex: 50 
        }}>
            {/* Microphone Toggle Button */}
            <div className="media-btn-container">
              <button 
                onClick={toggleListening}
                className={`media-toggle-btn ${isListening ? 'mic-active' : ''}`}
              >
                {isListening ? <Mic size={18} color="#38bdf8" /> : <MicOff size={18} color="#0277bd" />}
              </button>
              <span className="custom-tooltip-up">{isListening ? "Disable Voice Commands" : "Enable Voice Commands"}</span>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '28px', backgroundColor: 'rgba(255,255,255,0.2)' }}></div>

            {/* Audio Speaker Toggle Button */}
            <div className="media-btn-container">
              <button 
                onClick={toggleAudio}
                className={`media-toggle-btn ${audioEnabled ? 'audio-active' : ''}`}
              >
                {audioEnabled ? <Volume2 size={18} color="#22c55e" /> : <VolumeX size={18} color="#ef4444" />}
              </button>
              <span className="custom-tooltip-up">{audioEnabled ? "Mute Voice Assistant" : "Enable Voice Assistant"}</span>
            </div>
        </div>
        
        {/* High-Priority Instructions */}
        {currentInstruction && currentInstruction !== "Path is clear." && (
          <div style={{ 
              position: 'absolute', 
              bottom: '84px', 
              backgroundColor: 'rgba(239, 68, 68, 0.25)', 
              border: '2px solid #ef4444',
              padding: '12px 48px',
              borderRadius: '8px',
              backdropFilter: 'blur(8px)',
              zIndex: 40,
              textAlign: 'center',
              animation: 'pulseHeartbeat 1s infinite'
          }}>
              <h1 style={{ margin: 0, color: '#fff', fontSize: '12px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {currentInstruction}
              </h1>
          </div>
        )}

        {/* BOTTOM CENTER OVERLAY: Mode Indicator */}
        {displayMode.id !== 'NORMAL' && (
          <div style={{ 
              position: 'absolute', 
              bottom: '24px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              backgroundColor: 'rgba(0, 0, 0, 0.4)', 
              backdropFilter: 'blur(12px)', 
              padding: '8px 20px', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              zIndex: 20 
          }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                backgroundColor: displayMode.color, 
                borderRadius: '50%', 
                boxShadow: `0 0 10px ${displayMode.color}` 
              }}></div>
              <span style={{ fontWeight: '600', fontSize: '12px', letterSpacing: '0.5px', color: '#f8fafc' }}>
                {displayMode.id === "NAVIGATION"
                  ? (navPaused ? "Navigation (paused — edge offline)" : navState.pending ? "Navigation (starting…)" : "Navigation (active)")
                  : displayMode.label}
              </span>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Sidebar Terminal */}
      <div style={{ width: '300px', backgroundColor: '#16161a', display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.05)', padding: '16px', zIndex: 30, boxShadow: '-5px 0 25px rgba(0,0,0,0.5)' }}>
        
        {/* Terminal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px' }}>
            <Terminal size={16} />
            Terminal
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

            {/* Active Commands Palette */}
            <div className={`cmd-container ${commandsEnabled ? "enabled" : "disabled"}`}>
              <button className={`cmd-btn ${commandsEnabled ? "" : "disabled"}`} onClick={(e) => e.preventDefault()} aria-label="Active Commands">
                <Command size={18} />
              </button>

              {!commandsEnabled && (
                <span className="cmd-tooltip">Commands locked: {backendConnected ? "Edge offline" : "Host offline"}.</span>
              )}

              {commandsEnabled && (
                <div className="cmd-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.55)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#e2e8f0' }}>Active Commands</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Hover to keep open</span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      onClick={() => sendCommand({ command: "FULL_OCR" })}
                      style={{ flex: 1, backgroundColor: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#f8fafc', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, transition: 'transform 0.15s ease' }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      Full OCR
                    </button>
                    <button
                      onClick={() => sendCommand({ command: "TOOLS_SCAN" })}
                      style={{ flex: 1, backgroundColor: 'rgba(45, 212, 191, 0.10)', border: '1px solid rgba(45, 212, 191, 0.25)', color: '#f8fafc', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, transition: 'transform 0.15s ease' }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      Scan Tools
                    </button>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input
                      value={navDestination}
                      onChange={(e) => { 
                        setNavDestination(e.target.value); 
                        navDestRef.current = e.target.value; 
                      }}
                      placeholder="Destination: 'lat,lon' or place"
                      style={{ width: '93%', backgroundColor: 'rgba(2, 6, 23, 0.75)', border: '1px solid rgba(148, 163, 184, 0.20)', color: '#f8fafc', padding: '10px 10px', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={startNavigation}
                        disabled={!navDestination.trim() || navState.pending}
                        style={{ flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.28)', color: '#f8fafc', padding: '10px 12px', borderRadius: '10px', cursor: (!navDestination.trim() || navState.pending) ? 'not-allowed' : 'pointer', opacity: (!navDestination.trim() || navState.pending) ? 0.55 : 1, fontSize: '12px', fontWeight: 900, letterSpacing: '0.3px', transition: 'transform 0.15s ease' }}
                        onMouseOver={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        {navState.pending ? "Starting…" : "Start"}
                      </button>
                      <button
                        onClick={() => sendCommand({ command: "NAV_STOP" })}
                        disabled={!navState.active && !navState.pending}
                        style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.10)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f8fafc', padding: '10px 12px', borderRadius: '10px', cursor: (!navState.active && !navState.pending) ? 'not-allowed' : 'pointer', opacity: (!navState.active && !navState.pending) ? 0.55 : 1, fontSize: '12px', fontWeight: 900, letterSpacing: '0.3px', transition: 'transform 0.15s ease' }}
                        onMouseOver={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        Stop
                      </button>
                    </div>
                    {(navState.active || navState.pending) && (
                      <div style={{ marginTop: '10px', fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>
                        {navPaused ? "Navigation paused: EDGE offline." : navState.active ? `Navigation active.` : "Starting navigation…"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Logs */}
            <div className="btn-container">
              <button 
                onClick={() => setLogs([])} 
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 0.2s ease' }} 
                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'} 
                onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
              >
                <Trash2 size={16} />
              </button>
              <span className="custom-tooltip">Clear Logs</span>
            </div>
          </div>

        </div>

        {/* Logs Container */}
        <div className="custom-log-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {logs.map((log, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Glasses size={14} color="#475569" style={{ flexShrink: 0 }} />
              <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '8px 12px', flex: 1, borderLeft: `3px solid ${log.type === 'alert' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : log.type === 'info' ? '#38bdf8' : '#22c55e'}`, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                <span style={{ color: '#64748b', fontSize: '10px', display: 'block', marginBottom: '2px' }}>{log.time}</span>
                <span style={{ wordBreak: 'break-word' }}>{log.text}</span>
              </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Bottom Action Button */}
        <button onClick={onNavigate} style={{ marginTop: '16px', backgroundColor: '#312e81', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.target.style.backgroundColor = '#3730a3'} onMouseOut={(e) => e.target.style.backgroundColor = '#312e81'}>
            <LogOut size={16} />
            Exit Console
        </button>

      </div>
    </div>
  );
}

export default VisionDashboard;
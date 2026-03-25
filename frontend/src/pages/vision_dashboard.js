import React, { useState, useEffect, useRef } from 'react';
import { Activity, Terminal, Trash2, Server, Cpu, Glasses, LogOut, Battery, Navigation, Command, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { WS_BASE_URL } from '../config';

const SYSTEM_MODES = {
  NORMAL: { id: 'NORMAL', label: 'Normal Mode', color: 'transparent' },
  NAVIGATION: { id: 'NAVIGATION', label: 'Navigation Mode', color: '#22c55e' },
  OCR: { id: 'OCR', label: 'OCR Text Mode', color: '#f59e0b' },                
  TOOL: { id: 'TOOL', label: 'Tool Recognition', color: '#38bdf8' },
  GUIDANCE: { id: 'GUIDANCE', label: 'Tool Guidance Active', color: '#8b5cf6' }
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

  const [isTerminalExpanded, setIsTerminalExpanded] = useState(true);

  // ==========================================
  // WAKE WORD ("SIRI") STATE
  // ==========================================
  const [isAwake, setIsAwake] = useState(false);
  const isAwakeRef = useRef(false);
  const sleepTimerRef = useRef(null);

  const commandsEnabled = backendConnected && deviceConnected;
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ==========================================
  // WAKE / SLEEP TIMER FUNCTIONS
  // ==========================================
  const wakeUpSystem = () => {
    setIsAwake(true);
    isAwakeRef.current = true;
    sendCommand({ command: "DASHBOARD_WAKE", state: true }); // Tell server to shush
    speakInstruction("I'm listening.", true); 
    resetSleepTimer();
  };

  const goToSleep = () => {
    setIsAwake(false);
    isAwakeRef.current = false;
    sendCommand({ command: "DASHBOARD_WAKE", state: false }); // Tell server to resume
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
  };

  const resetSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => {
      goToSleep();
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "INFO: Listener went back to sleep.", type: "info" }]);
    }, 6000); // 6 second active window
  };

  // SPEECH-TO-TEXT (VOICE COMMANDS) ENGINE
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        
        // WAKE WORD DETECTION LOGIC
        if (!isAwakeRef.current) {
           if (transcript.includes("hey glasses") || transcript.includes("wake up") || transcript.includes("okay glasses")) {
            window.speechSynthesis.cancel();   
            wakeUpSystem();
           } else {
               // Silently ignore all other background conversation
               console.log("Ignored background speech:", transcript);
           }
           return; 
        }

        // ACTIVE COMMAND PROCESSING (If awake)
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: `[ Command Heard ] "${transcript}"`, type: "info" }]);

        if (transcript.includes("read text") || transcript.includes("full ocr") || transcript.includes("scan text")) {
          sendCommand({ command: "FULL_OCR" });
          goToSleep();
        } 
        else if (transcript.includes("search for") || transcript.includes("find")) {
          // Extract everything after "tool"
          const match = transcript.match(/(?:search for|find )\s+(.+)/);
          if (match && match[1]) {
            const requestedTool = match[1].trim();
            sendCommand({ command: "SEARCH_TOOL", target_tool: requestedTool });
          } else {
             speakInstruction("Please specify which tool to find.");
          }
          goToSleep();
        } 
        else if (transcript.includes("stop searching") || transcript.includes("cancel searching")) {
          window.speechSynthesis.cancel();
          sendCommand({ command: "SEARCH_STOP" });
          goToSleep();
        }
        else if (transcript.includes("stop navigation") || transcript.includes("cancel navigation")) {
          sendCommand({ command: "NAV_STOP" });
          goToSleep();
        } 
        else if (transcript.includes("navigate to")) {
          const dest = transcript.split("navigate to")[1]?.trim();
          
          if (dest) {
            setNavDestination(dest);
            navDestRef.current = dest; 
            sendCommand({ command: "NAV_START", destination: dest });
            goToSleep(); 
          } else {
            speakInstruction("Please specify the destination clearly.");
            resetSleepTimer(); 
          }
        }
        else if (transcript.includes("start navigation")) {
          startNavigation();
          goToSleep();
        }
        else {
          // If they are awake but said something we don't understand, reset the timer to give them more time
          speakInstruction("Sorry, I don't understand your command. Please try again.")
          resetSleepTimer();
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
           try { recognition.start(); } catch(e) {}
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); // Cleanup timer
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
      goToSleep(); // Force sleep if mic is turned off
      speakInstruction("Voice commands deactivated.", true);
    }
  };

  // WebSocket Connection
  useEffect(() => {
    shouldReconnectRef.current = true;

    const connect = () => {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/dashboard`);
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

          if (data.type === "navigation") {
            setNavState({ active: true, pending: false });
            setLogs(prev => {
              const lastLog = prev.length > 0 ? prev[prev.length - 1] : null;
              if (lastLog && lastLog.text === data.instruction && (Date.now() - lastLog.ts < 2000)) return prev;
              return [...prev, { time: new Date().toLocaleTimeString(), text: `NAVIGATION: ${data.instruction}`, type: "info", ts: Date.now() }];
            });
          }

          if (data.log) {
            const isHazard = data.log.includes("HAZARD");
            const isWarning = data.log.includes("WARNING");

            if (data.log.startsWith("NAVIGATION STARTED")) {
              setNavState({ active: true, provider: null, dest: null, pending: false });
            } else if (
                data.log.startsWith("NAVIGATION STOPPED") || 
                data.log.startsWith("NAVIGATION: Destination not set") ||
                data.log.startsWith("NAVIGATION ERROR")
            ) {
              setNavState({ active: false, provider: null, dest: null, pending: false });
              setActiveMode(SYSTEM_MODES.NORMAL);
              
              if (data.log.startsWith("NAVIGATION ERROR")) {
                 // Flash the error on the screen for 3 seconds
                 setCurrentInstruction(data.log.replace("NAVIGATION ERROR: ", ""));
                 setTimeout(() => setCurrentInstruction(""), 3000);
              } else {
                 setCurrentInstruction("");
              }
            }
            
            setLogs(prev => {
              // If the exact same text was logged within the last 2 seconds, ignore it.
              const lastLog = prev.length > 0 ? prev[prev.length - 1] : null;
              if (lastLog && lastLog.text === data.log && (Date.now() - lastLog.ts < 2000)) {
                  return prev; 
              }
              
              return [...prev, { 
                time: new Date().toLocaleTimeString(), 
                text: data.log, 
                type: isHazard ? "alert" : isWarning ? "error" : "normal",
                ts: Date.now() // Internal timestamp for the deduplication check
              }];
            });
          }

          if (data.instruction) {
            setCurrentInstruction(data.instruction);
            speakInstruction(data.instruction);
            setTimeout(() => setCurrentInstruction(""), 3000);
          }

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
        const delayMs = Math.min(5000, 600 * attempt);

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
        if (wsRef.current) {
          // Forcefully detach listeners so ghost connections cannot mutate state
          wsRef.current.onmessage = null; 
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        }
      } catch (e) {}
    };
  }, []);

  const sendCommand = (payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "Backend not connected. Command not sent.", type: "error" }]);
      speakInstruction("Backend not connected. Command not sent.")
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

  const speakInstruction = (text, force = false) => {
    const synth = window.speechSynthesis;
  
    if (!audioEnabledRef.current && !force)  return;
  
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
          .custom-log-container::-webkit-scrollbar { width: 5px; margin-right: -5px; }
          .custom-log-container::-webkit-scrollbar-track { background: transparent; }
          .custom-log-container::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 4px; border: 1px solid transparent; }
          .custom-log-container::-webkit-scrollbar-thumb:hover { background-color: #64748b; }

          @keyframes subtleBreathe {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
          }

          .btn-container { position: relative; display: inline-flex; align-items: center; }
          
          .custom-tooltip {
              visibility: hidden; opacity: 0; background-color: #1e293b; color: #f8fafc; border: 1px solid #334155;
              text-align: center; border-radius: 6px; padding: 6px 12px; position: absolute; z-index: 100;
              top: 130%; right: 0; font-size: 11px; white-space: nowrap; font-weight: 600; letter-spacing: 0.5px;
              transform: translateY(-8px); transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          .custom-tooltip::after {
              content: ""; position: absolute; bottom: 100%; right: 8px; border-width: 5px; border-style: solid; border-color: transparent transparent #1e293b transparent;
          }
          .btn-container:hover .custom-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }

          .cmd-container { position: relative; display: inline-flex; align-items: center; }
          .cmd-btn { background: none; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; transition: color 0.2s ease, transform 0.2s ease, opacity 0.2s ease; }
          .cmd-btn:hover { color: #38bdf8; transform: translateY(-1px); }
          .cmd-btn.disabled { cursor: not-allowed; opacity: 0.55; }

          .cmd-tooltip {
              visibility: hidden; opacity: 0; background-color: #0b1220; color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.22);
              text-align: left; border-radius: 10px; padding: 8px 12px; position: absolute; z-index: 120; top: 130%; right: 0;
              font-size: 11px; white-space: nowrap; font-weight: 700; letter-spacing: 0.2px; transform: translateY(-10px);
              transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s; box-shadow: 0 10px 30px rgba(0,0,0,0.55);
          }
          .cmd-tooltip::after { content: ""; position: absolute; bottom: 100%; right: 10px; border-width: 6px; border-style: solid; border-color: transparent transparent #0b1220 transparent; }

          .cmd-panel {
              visibility: hidden; opacity: 0; position: absolute; top: 130%; right: 0; width: 284px;
              background: radial-gradient(1200px 600px at 20% -20%, rgba(56, 189, 248, 0.16), rgba(0,0,0,0)), #0b1220;
              border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 14px; padding: 12px; transform: translateY(-12px) scale(0.98);
              transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s; box-shadow: 0 18px 60px rgba(0,0,0,0.65);
              z-index: 140; backdrop-filter: blur(14px);
          }
          .cmd-container.enabled:hover .cmd-panel { visibility: visible; opacity: 1; transform: translateY(0) scale(1); }
          .cmd-container.disabled:hover .cmd-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }

          .media-btn-container { position: relative; display: inline-flex; align-items: center; }
          .media-toggle-btn {
              background: rgba(170, 170, 170, 0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%;
              width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; cursor: pointer;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .media-toggle-btn:hover { background: rgba(255, 255, 255, 0.15); transform: translateY(-2px) scale(1.02); }
          .media-toggle-btn.mic-active { background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 0 15px rgba(56, 189, 248, 0.3); }
          .media-toggle-btn.audio-active { background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.4); box-shadow: 0 0 15px rgba(34, 197, 94, 0.3); }

          .custom-tooltip-up {
              visibility: hidden; opacity: 0; background-color: #1e293b; color: #f8fafc; border: 1px solid #334155;
              text-align: center; border-radius: 6px; padding: 6px 12px; position: absolute; z-index: 100;
              bottom: 140%; left: 50%; transform: translateX(-50%) translateY(8px); font-size: 11px; white-space: nowrap;
              font-weight: 600; letter-spacing: 0.5px; transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 -4px 12px rgba(0,0,0,0.5);
          }
          .custom-tooltip-up::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border-width: 5px; border-style: solid; border-color: #1e293b transparent transparent transparent; }
          .media-btn-container:hover .custom-tooltip-up { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }
          .btn-container:hover .custom-tooltip-up { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }

          .floating-bottom-right {
              position: absolute; bottom: 24px; right: 24px; z-index: 50;
              display: flex; gap: 12px; align-items: center;
          }
          .float-control-btn {
              background-color: rgba(18, 84, 119, 0.2); backdrop-filter: blur(12px);
              border: 1px solid rgba(255,255,255,0.1); border-radius: 50%;
              width: 42px; height: 42px; display: flex; justify-content: center; align-items: center;
              cursor: pointer; color: #f8fafc; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .float-control-btn:hover { background-color: rgba(255, 255, 255, 0.15); transform: scale(1.05); }
          .float-control-btn.terminal-active { color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 0 15px rgba(56, 189, 248, 0.3); }
          .float-control-btn.exit-hover:hover { color: #ef4444; border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 15px rgba(239, 68, 68, 0.3); }
      `}</style>

      {/* LEFT PANEL: Camera Feed & Overlays */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        <div className="floating-bottom-right">
            <div className="btn-container">
              <button onClick={onNavigate} className="float-control-btn exit-hover">
                <LogOut size={18} />
              </button>
              <span className="custom-tooltip-up">Exit Console</span>
            </div>

            <div className="btn-container">
              <button onClick={() => setIsTerminalExpanded(!isTerminalExpanded)} className={`float-control-btn ${isTerminalExpanded ? 'terminal-active' : ''}`}>
                <Terminal size={18} />
              </button>
              <span className="custom-tooltip-up">{isTerminalExpanded ? "Hide Terminal" : "Show Terminal"}</span>
            </div>
        </div>

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

            {/* Dynamic Hardware Details */}
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
            backgroundColor: 'rgba(0, 0, 0, 0.15)', 
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
                {isListening ? <Mic size={18} color='rgb(17, 129, 185)' /> : <MicOff size={18} color="rgb(59, 130, 177)" />}
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
                {audioEnabled ? <Volume2 size={18} color='rgb(6, 149, 30)' /> : <VolumeX size={18} color='rgb(227, 71, 71)' />}
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

        {/* Active Listening HUD */}
        {isAwake && (
          <div style={{ 
              position: 'absolute', 
              top: '80px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              backgroundColor: 'rgba(56, 189, 248, 0.15)', 
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '12px 32px', 
              borderRadius: '30px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              zIndex: 60,
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
              animation: 'subtleBreathe 2s infinite ease-in-out'
          }}>
              <Mic size={18} color="#38bdf8" style={{ animation: 'pulseHeartbeat 1.5s infinite' }}/>
              <span style={{ fontWeight: '800', fontSize: '14px', letterSpacing: '1px', color: '#f8fafc', textTransform: 'uppercase' }}>
                Listening...
              </span>
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
      <div style={{ 
          width: isTerminalExpanded ? '300px' : '0px', 
          backgroundColor: '#16161a', 
          display: 'flex', 
          flexDirection: 'column', 
          borderLeft: isTerminalExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', 
          padding: isTerminalExpanded ? '16px' : '16px 0px', 
          zIndex: 30, 
          boxShadow: isTerminalExpanded ? '-5px 0 25px rgba(0,0,0,0.5)' : 'none',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease, border 0.3s ease',
          overflow: isTerminalExpanded ? 'visible' : 'hidden' 
      }}>
        
        {/* Inner container to prevent text squashing and tooltip clipping */}
        <div style={{
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            width: '100%', 
            minWidth: '268px', 
            opacity: isTerminalExpanded ? 1 : 0, 
            transition: 'opacity 0.2s ease', 
            pointerEvents: isTerminalExpanded ? 'auto' : 'none'
        }}>
          
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
          <div className="custom-log-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
            {logs.map((log, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Glasses size={14} color="#475569" style={{ flexShrink: 0 }} />
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '8px', padding: '8px 12px', flex: 1, borderLeft: `3px solid ${log.type === 'alert' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : log.type === 'info' ? '#38bdf8' : '#22c55e'}`, fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  <span style={{ color: '#64748b', fontSize: '10px', display: 'block', marginBottom: '2px' }}>{log.time}</span>
                  <span style={{ wordBreak: 'break-word' }}>{log.text}</span>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default VisionDashboard;
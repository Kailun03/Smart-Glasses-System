import React, { useState, useEffect, useRef } from 'react';
import { Activity, Terminal, Trash2, Server, Cpu, Glasses, LogOut, Battery, Navigation, Command } from 'lucide-react';

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

  const [backendConnected, setBackendConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const wsRef = useRef(null);
  const [navDestination, setNavDestination] = useState("");
  const commandsEnabled = backendConnected && deviceConnected;

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // WebSocket Connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard');
    wsRef.current = ws;

    ws.onopen = () => {
      setBackendConnected(true);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "System Initialized. AI Backend Online.", type: "info" }]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "status") {
            setDeviceConnected(data.device_connected);
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
          
          setLogs(prev => [...prev, { 
            time: new Date().toLocaleTimeString(), 
            text: data.log, 
            type: isHazard ? "alert" : isWarning ? "error" : "normal" 
          }]);
        }

        // Catch the new instruction field
        if (data.instruction) {
          setCurrentInstruction(data.instruction);
          
          // Clear the instruction after 3 seconds if no new hazard appears
          setTimeout(() => setCurrentInstruction(""), 3000);
        }

        // Catch mode updates from backend
        if (data.mode && SYSTEM_MODES[data.mode]) {
          setActiveMode(SYSTEM_MODES[data.mode]);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setBackendConnected(false);
      setDeviceConnected(false); 
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "CRITICAL: Backend Disconnected.", type: "error" }]);
    };

    return () => ws.close();
  }, []);

  const sendCommand = (payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "Backend not connected. Command not sent.", type: "error" }]);
      return;
    }
    ws.send(JSON.stringify({ type: "command", ...payload }));
  };

  const parseLatLon = (raw) => {
    const text = String(raw || "").trim();
    // accepts: "5.41,100.33" or "5.41 100.33"
    const m = text.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  };

  const startNavigation = () => {
    const coords = parseLatLon(navDestination);
    if (coords) {
      sendCommand({ command: "NAV_START", dest_lat: coords.lat, dest_lon: coords.lon, destination: navDestination });
      return;
    }
    sendCommand({ command: "NAV_START", destination: navDestination });
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

          /* NEW: Custom Animated Tooltip */
          .clear-btn-container {
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
              top: 130%; /* Drop it just below the button */
              right: 0; /* Align it to the right edge */
              font-size: 11px;
              white-space: nowrap;
              font-weight: 600;
              letter-spacing: 0.5px;
              transform: translateY(-8px); /* Start slightly high */
              transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          }
          
          /* Tooltip little up-arrow pointer */
          .custom-tooltip::after {
              content: "";
              position: absolute;
              bottom: 100%;
              right: 8px; /* Arrow position */
              border-width: 5px;
              border-style: solid;
              border-color: transparent transparent #1e293b transparent;
          }

          /* Hover triggers the animation */
          .clear-btn-container:hover .custom-tooltip {
              visibility: visible;
              opacity: 1;
              transform: translateY(0); /* Slide down smoothly */
          }

          /* Command Palette (hover dropdown) */
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
      `}</style>

      {/* LEFT PANEL: Camera Feed & Overlays */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        {/* Offline Overlay */}
        {!deviceConnected && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ef4444', zIndex: 10 }}>
                <Activity 
                  size={32} 
                  style={{ marginBottom: '12px', animation: 'subtleBreathe 3s infinite ease-in-out' }} 
                />
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
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#f8fafc' }}>5.41° N, 100.33° W</span>
                </div>
              </>
            )}

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
        {activeMode.id !== 'NORMAL' && (
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
                backgroundColor: activeMode.color, 
                borderRadius: '50%', 
                boxShadow: `0 0 10px ${activeMode.color}` 
              }}></div>
              <span style={{ fontWeight: '600', fontSize: '12px', letterSpacing: '0.5px', color: '#f8fafc' }}>
                {activeMode.label}
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
              <button
                className={`cmd-btn ${commandsEnabled ? "" : "disabled"}`}
                onClick={(e) => e.preventDefault()}
                aria-label="Active Commands"
              >
                <Command size={18} />
              </button>

              {!commandsEnabled && (
                <span className="cmd-tooltip">
                  Commands locked: {backendConnected ? "Edge offline" : "Host offline"}.
                </span>
              )}

              {commandsEnabled && (
                <div className="cmd-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.55)' }} />
                      <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#e2e8f0' }}>
                        Active Commands
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Hover to keep open</span>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                      onClick={() => sendCommand({ command: "FULL_OCR" })}
                      style={{ flex: 1, backgroundColor: 'rgba(56, 189, 248, 0.10)', border: '1px solid rgba(56, 189, 248, 0.25)', color: '#f8fafc', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, transition: 'transform 0.15s ease' }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      Full OCR
                    </button>
                    <button
                      onClick={() => sendCommand({ command: "TOOLS_SCAN" })}
                      style={{ flex: 1, backgroundColor: 'rgba(45, 212, 191, 0.10)', border: '1px solid rgba(45, 212, 191, 0.25)', color: '#f8fafc', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 800, transition: 'transform 0.15s ease' }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      Scan Tools
                    </button>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input
                      value={navDestination}
                      onChange={(e) => setNavDestination(e.target.value)}
                      placeholder="Destination: 'lat,lon' or place (needs geocoding)"
                      style={{ width: '93%', backgroundColor: 'rgba(2, 6, 23, 0.75)', border: '1px solid rgba(148, 163, 184, 0.20)', color: '#f8fafc', padding: '10px 10px', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={startNavigation}
                        style={{ flex: 1, backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.28)', color: '#f8fafc', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 900, letterSpacing: '0.3px', transition: 'transform 0.15s ease' }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        Start
                      </button>
                      <button
                        onClick={() => sendCommand({ command: "NAV_STOP" })}
                        style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.10)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f8fafc', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 900, letterSpacing: '0.3px', transition: 'transform 0.15s ease' }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Clear Logs */}
            <div className="clear-btn-container">
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
            
            // Figma-style Layout: Icon on the left, pill on the right
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              
              {/* Icon sits OUTSIDE the background pill */}
              <Glasses size={14} color="#475569" style={{ flexShrink: 0 }} />
              
              {/* The Log Pill */}
              <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.04)', 
                borderRadius: '8px', 
                padding: '8px 12px', 
                flex: 1,
                borderLeft: `3px solid ${log.type === 'alert' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : log.type === 'info' ? '#38bdf8' : '#22c55e'}`,
                fontSize: '11px',
                color: '#cbd5e1',
                lineHeight: '1.4'
              }}>
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
import React, { useState, useEffect } from 'react';
import { Camera, Cpu, Battery, MapPin, Eye, BrainCircuit, Wifi, ToolboxIcon, Activity, WifiOff } from 'lucide-react';
import { WS_BASE_URL } from '../config';

const WidgetCard = ({ title, icon: Icon, children, className = "", delay = "0s", style = {} }) => (
  <div className={`widget-card animate-slide-up ${className}`} style={{ animationDelay: delay, ...style }}>
    <div className="widget-header">
      <Icon size={18} className="widget-icon" />
      {title}
    </div>
    <div className="widget-content">
      {children}
    </div>
  </div>
);

function MainDashboard({ onNavigateVision }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isHostLoading, setIsHostLoading] = useState(true);
  const [isHostOffline, setIsHostOffline] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  
  const [sysState, setSysState] = useState({
    mode: "NORMAL",
    lat: 5.41,
    lon: 100.33
  });
  
  const [locationName, setLocationName] = useState("Locating...");

  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/dashboard`);

    ws.onopen = () => {
      setIsHostLoading(false);
      setIsHostOffline(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "status" || data.mode) {
          if (data.device_connected !== undefined) {
            setIsDeviceConnected(data.device_connected);
          }
          setSysState(prev => ({
            ...prev,
            mode: data.mode || prev.mode,
            lat: data.location?.lat || prev.lat,
            lon: data.location?.lon || prev.lon
          }));
        }
      } catch (err) {
        console.error("Dashboard WS parse error:", err);
      }
    };

    ws.onclose = () => {
      setIsHostLoading(false);
      setIsHostOffline(true);
      setIsDeviceConnected(false); 
    };
    
    return () => ws.close();
  }, []);

  // Reverse Geocoding
  useEffect(() => {
    const fetchPlaceName = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${sysState.lat}&lon=${sysState.lon}&format=json`);
        const data = await res.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.county || data.address.suburb || "Unknown Area";
          const state = data.address.state || "";
          setLocationName(`${city}${state ? ', ' + state : ''}`);
        } else {
          setLocationName("Unknown Location");
        }
      } catch (e) {
        setLocationName("GPS Coordinates Locked");
      }
    };

    const timeoutId = setTimeout(fetchPlaceName, 1500);
    return () => clearTimeout(timeoutId);
  }, [sysState.lat, sysState.lon]);

  const StatusBadge = ({ condition, activeText, inactiveText, isHostBased = false }) => {
    if (isHostBased && isHostOffline) return <span className="badge-offline">HOST OFFLINE</span>;
    if (!isHostBased && !isDeviceConnected) return <span className="badge-offline">DEVICE OFFLINE</span>;
    if (condition) return <span className="badge-active">{activeText}</span>;
    return <span className="badge-standby">{inactiveText}</span>;
  };

  return (
    <div className="dashboard-container">
      
      <style>{`
        :root {
          --bg-dark: #0f172a; --bg-card: #16161a; --text-primary: #f8fafc; --text-secondary: #94a3b8; --border-color: rgba(255,255,255,0.05);
          --accent-blue: #38bdf8; --accent-blue-glow: rgba(56, 189, 248, 0.4); --accent-teal: #2dd4bf; --accent-purple: #a855f7; --status-active: #22c55e; --status-standby: #f59e0b; --status-error: #ef4444;
        }
        .dashboard-container { height: 100vh; width: 100%; background-color: var(--bg-dark); font-family: system-ui, sans-serif; color: var(--text-primary); display: flex; }
        main { flex: 1; padding: 40px; display: flex; flex-direction: column; box-sizing: border-box; overflow-y: auto; }
        .custom-scroll::-webkit-scrollbar { width: 6px; background: transparent; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #475569; }
        .main-layout-grid { display: grid; grid-template-columns: 2.5fr 1fr; gap: 32px; flex: 1; min-height: 0; }
        .ai-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        .diag-grid { display: flex; flex-direction: column; gap: 32px; }
        @media (max-width: 1200px) { .main-layout-grid { grid-template-columns: 1fr; } .diag-grid { flex-direction: row; } }
        @media (max-width: 800px) { .ai-grid { grid-template-columns: 1fr; } .diag-grid { flex-direction: column; } }
        
        .widget-card { background-color: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-color); padding: 24px; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.2); transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; position: relative; overflow: hidden; }
        .widget-card:hover { transform: translateY(-2px); border-color: var(--accent-blue-glow); box-shadow: 0 12px 40px rgba(56, 189, 248, 0.15); }
        .widget-header { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px; }
        .widget-icon { color: var(--accent-blue); }
        .widget-content { flex: 1; display: flex; flex-direction: column; }
        
        @keyframes breathingGlow { 0% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 0 1px rgba(56, 189, 248, 0.1); } 50% { box-shadow: 0 0 40px rgba(45, 212, 191, 0.4), inset 0 0 0 2px rgba(45, 212, 191, 0.3); } 100% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 0 1px rgba(56, 189, 248, 0.1); } }
        .hero-card { background: linear-gradient(135deg, rgb(51, 78, 99) 0%, rgb(2, 4, 12) 100%); border-radius: 24px; padding: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; overflow: hidden; animation: breathingGlow 6s infinite ease-in-out; }
        .hero-bg-icon { position: absolute; top: -40px; right: -40px; opacity: 0.07; transform: rotate(-15deg); }
        
        .launch-btn { background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-teal) 100%); color: #020617; border: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 12px; z-index: 1; box-shadow: 0 0 20px var(--accent-blue-glow); transition: all 0.2s ease; }
        .launch-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 0 35px var(--accent-blue-glow); }
        .launch-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); box-shadow: none; }

        .badge-active { background: rgba(34, 197, 94, 0.1); color: var(--status-active); border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .badge-standby { background: rgba(245, 158, 11, 0.1); color: var(--status-standby); border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .badge-offline { background: rgba(239, 68, 68, 0.1); color: var(--status-error); border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }

        /* Unified Fixed-Width Status Badge */
        .status-badge { 
          display: flex; align-items: center; gap: 10px; padding: 8px 16px; 
          background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); 
          border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); 
          transition: all 0.3s ease; 
          width: 140px; /* Fixed width ensures perfect vertical alignment */
          box-sizing: border-box;
        }
      `}</style>

      <main className="custom-scroll">
        
        {/* HEADER */}
        <header className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', animationDelay: '0.1s' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '32px', color: '#f8fafc', letterSpacing: '-1px', fontWeight: '800' }}>
              System Control Centre
            </h2>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '15px', fontWeight: '500' }}>
              Assistive Vision Network Interface
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
            
            {/* VERTICALLY STACKED CONNECTION INDICATORS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              
              {/* Host Status */}
              <div className="status-badge" style={{ 
                borderColor: isHostLoading ? 'rgba(161, 159, 159, 0.2)' : isHostOffline ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
              }}>
                <div style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: isHostLoading ? '#808080' : isHostOffline ? '#ef4444' : '#22c55e',
                  boxShadow: `0 0 8px ${isHostLoading ? '#808080' : isHostOffline ? '#ef4444' : '#22c55e'}`
                }} />
                <span style={{ fontSize: '11px', fontWeight: '800', color: isHostLoading ? '#808080' : isHostOffline ? '#ef4444' : '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isHostLoading ? 'Host Sync...' : isHostOffline ? 'Host Offline' : 'Host Online'}
                </span>
              </div>

              {/* Edge Device Status */}
              <div className="status-badge" style={{ 
                borderColor: isDeviceConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              }}>
                <div style={{ 
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: isDeviceConnected ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 8px ${isDeviceConnected ? '#22c55e' : '#ef4444'}`
                }} />
                <span style={{ fontSize: '11px', fontWeight: '800', color: isDeviceConnected ? '#22c55e' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isDeviceConnected ? 'Edge Online' : 'Edge Offline'}
                </span>
              </div>

            </div>

            {/* CLOCK */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right', padding: '0 20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '1px', fontFamily: 'monospace' }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px', fontWeight: '500' }}>
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </header>

        {/* MAIN RESPONSIVE GRID */}
        <div className="main-layout-grid">
          
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div className="hero-card animate-slide-up" style={{ animationDelay: '0.2s', border: isDeviceConnected ? 'none' : '1px solid rgba(239, 68, 68, 0.3)' }}>
              <Eye size={300} color={isDeviceConnected ? "#2dd4bf" : "#ef4444"} className="hero-bg-icon" />

              <h2 style={{ fontSize: '32px', margin: '0 0 16px 0', color: '#f8fafc', zIndex: 1, fontWeight: '900', letterSpacing: '-0.5px' }}>
                Live Vision Engine
              </h2>
              <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '500px', marginBottom: '36px', zIndex: 1, lineHeight: '1.6', fontSize: '15px' }}>
                Initialize the real-time spatial awareness stream. Activates concurrent Object Detection, OCR, and Environmental parsing.
              </p>
              
              <button 
                className="launch-btn" 
                onClick={onNavigateVision}
                disabled={!isDeviceConnected}
              >
                <Camera size={20} color="#020617" />
                {isDeviceConnected ? "Establish Feed Connection" : "Smart Glasses Offline"}
              </button>
            </div>

            <h3 className="animate-slide-up" style={{ margin: '0 0 -16px 0', color: '#f8fafc', fontSize: '18px', fontWeight: '600', animationDelay: '0.3s' }}>Core AI Modules</h3>
            <div className="ai-grid">
              
              <WidgetCard title="Mobility & Safety" icon={BrainCircuit} delay="0.4s">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>YOLO Spatial Engine</span>
                  <StatusBadge condition={!isHostOffline} activeText="ACTIVE" inactiveText="STANDBY" isHostBased={true} />
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Detects vehicles, pedestrians, and obstacles. Inference: ~45ms.</div>
              </WidgetCard>

              <WidgetCard title="Workplace Support" icon={ToolboxIcon} delay="0.5s">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>Custom Tool & OCR</span>
                  <StatusBadge condition={!isHostOffline && (sysState.mode === 'TOOL' || sysState.mode === 'OCR')} activeText="ACTIVE" inactiveText="STANDBY" isHostBased={true} />
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Identifies predefined machinery and reads environmental warning signs.</div>
              </WidgetCard>

            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="diag-grid">
            
            <WidgetCard title="Edge Telemetry" icon={Cpu} style={{ flex: 'unset' }} delay="0.6s">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '8px' }}><Battery size={16} color="#38bdf8" /></div>
                    Device Power
                  </div>
                  <span style={{ fontWeight: 'bold', color: isDeviceConnected ? '#f8fafc' : '#64748b', fontSize: '16px' }}>
                    {isDeviceConnected ? "98%" : "---"}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: isDeviceConnected ? 'rgba(45, 212, 191, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>
                      {isDeviceConnected ? <Wifi size={16} color="#2dd4bf" /> : <WifiOff size={16} color="#ef4444" />}
                    </div>
                    Signal Strength
                  </div>
                  <span style={{ fontWeight: 'bold', color: isDeviceConnected ? '#2dd4bf' : '#ef4444', fontSize: '14px' }}>
                    {isDeviceConnected ? "-42 dBm" : "Offline"}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '8px', borderRadius: '8px' }}><Activity size={16} color="#a855f7" /></div>
                    Haptic Motors
                  </div>
                  <span style={{ fontWeight: 'bold', color: isDeviceConnected ? '#a855f7' : '#64748b', fontSize: '14px' }}>
                    {isDeviceConnected ? "Ready" : "Offline"}
                  </span>
                </div>
              </div>
            </WidgetCard>

            <WidgetCard title="Geospatial Data" icon={MapPin} style={{ flex: 'unset' }} delay="0.7s">
              <div style={{ backgroundColor: '#020617', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #1e293b' }}>
                <span style={{ color: isDeviceConnected ? '#f8fafc' : '#64748b', fontWeight: 'bold', fontSize: '16px' }}>
                  {isDeviceConnected ? locationName : "Location Unavailable"}
                </span>
                <span style={{ color: isDeviceConnected ? '#38bdf8' : '#64748b', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '1px' }}>
                  {isDeviceConnected ? `${sysState.lat.toFixed(5)}° N, ${sysState.lon.toFixed(5)}° E` : "0.00000° N, 0.00000° E"}
                </span>
              </div>
              <div style={{ marginTop: '20px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                  <span>System Mode</span> <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{sysState.mode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tracking Status</span> <span style={{ color: sysState.mode === 'NAVIGATION' ? '#22c55e' : '#e2e8f0', fontWeight: '600' }}>
                    {sysState.mode === 'NAVIGATION' ? "Routing Active" : "Stationary"}
                  </span>
                </div>
              </div>
            </WidgetCard>

          </div>

        </div>
      </main>
    </div>
  );
}

export default MainDashboard;
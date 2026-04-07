import React, { useState, useEffect } from 'react';
import { Camera, Battery, MapPin, BrainCircuit, Wifi, ToolboxIcon, Activity, ShieldCheck } from 'lucide-react';
import { SYSTEM_VERSION, WS_BASE_URL } from '../config';

const WidgetCard = ({ title, icon: Icon, children, className = "", delay = "0s", style = {} }) => (
  <div className={`widget-card animate-slide-up ${className}`} style={{ animationDelay: delay, ...style }}>
    <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}></div>
    <div className="widget-header">
      <Icon size={16} className="widget-icon" />
      {title}
    </div>
    <div className="widget-content">
      {children}
    </div>
  </div>
);

function MainDashboard({ onNavigateVision }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHostOffline, setIsHostOffline] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sysState, setSysState] = useState({ mode: "NORMAL", lat: 5.41, lon: 100.33 });
  const [locationName, setLocationName] = useState("Locating ...");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const ws = new WebSocket(`${WS_BASE_URL}/ws/dashboard`);
    
    ws.onopen = () => {
      setIsLoading(false);
      setIsHostOffline(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status" || data.mode) {
          if (data.device_connected !== undefined) setIsDeviceConnected(data.device_connected);
          setSysState(prev => ({ ...prev, mode: data.mode || prev.mode, lat: data.location?.lat || prev.lat, lon: data.location?.lon || prev.lon }));
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setIsLoading(false);
      setIsHostOffline(true);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const fetchCityName = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${sysState.lat}&lon=${sysState.lon}&zoom=14`);
        const data = await res.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.county;
          const state = data.address.state;
          setLocationName(city && state ? `${city}, ${state}` : "Location Acquired");
        }
      } catch (err) {
        // Silently fail and keep previous location name if API rate limits
      }
    };
    
    // Only fetch if coordinates are valid and not the default 0,0
    if (sysState.lat && sysState.lon) {
        const timer = setTimeout(fetchCityName, 2000);
        return () => clearTimeout(timer);
    }
  }, [sysState.lat, sysState.lon]);

  return (
    <div className="dashboard-container">
      {/* Background Orbs */}
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '70vh', height: '70vh', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '-20%', right: '-5%', width: '60vh', height: '60vh', background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>

      <style>{`
        /* MODERN SCROLLBAR FIX */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        ::-webkit-scrollbar-thumb { 
          background: rgba(51, 65, 85, 0.8); 
          border-radius: 10px; 
          border: 2px solid transparent;
          background-clip: content-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: #00E5FF; }

        .dashboard-container { 
          height: 100vh; width: 100%; background: transparent; 
          color: #f8fafc; display: flex; flex-direction: column; overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
        }
        main { 
          flex: 1; padding: clamp(20px, 4vw, 40px); 
          display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; z-index: 10; 
        }

        .widget-card { 
          background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
          border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); 
          padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
        }
        
        /* HOVER EFFECT FOR WIDGETS */
        .widget-card:hover {
          transform: translateY(-5px);
          border-color: rgba(0, 229, 255, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 15px rgba(0, 229, 255, 0.1);
        }

        .widget-header { display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 12px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; }
        .widget-icon { color: #00E5FF; }

        .hero-showcase {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(0, 229, 255, 0.05) 100%);
          backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 36px;
          padding: clamp(32px, 4vw, 48px) clamp(40px, 6vw, 80px);
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
          gap: 32px; margin-bottom: 32px;
          min-height: fit-content; position: relative; overflow: hidden;
          box-shadow: 0 40px 80px rgba(0,0,0,0.6);
          transition: all 0.4s ease;
        }
        .hero-showcase:hover {
          border-color: rgba(0, 229, 255, 0.2);
          box-shadow: 0 45px 90px rgba(0,0,0,0.7);
        }

        .hero-showcase::before {
          content: ""; position: absolute; inset: 0;
          background-image: radial-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px);
          background-size: 30px 30px; opacity: 0.3; z-index: 0;
        }

        .scan-line {
          position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.05), transparent);
          transform: skewX(-20deg); animation: scanMove 6s infinite linear; z-index: 1;
        }
        @keyframes scanMove { 0% { left: -100%; } 100% { left: 200%; } }

        .showcase-left { flex: 2; display: flex; flex-direction: column; z-index: 2; position: relative; }
        .showcase-center { 
          flex: 2; width: 100%; min-height: 320px;
          display: flex; justify-content: center; align-items: center; 
          position: relative; z-index: 2;
        }
        .showcase-right { flex: 1.5; display: flex; flex-direction: column; gap: 16px; z-index: 2; }

        @media (max-width: 1050px) {
          .hero-showcase { flex-direction: column; text-align: center; }
          .showcase-left, .showcase-center, .showcase-right { align-items: center; text-align: center; flex: 1 1 auto; width: 100%; } 
          .showcase-right { flex-direction: row; justify-content: center; flex-wrap: wrap; }
        }

        .model-aura {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 300px; height: 300px; border-radius: 50%; filter: blur(60px); z-index: 0;
          background: radial-gradient(circle, rgba(0, 229, 255, 0.15) 0%, transparent 70%);
          animation: glowPulse 4s infinite ease-in-out;
        }
        @keyframes glowPulse { 0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.15); } }

        .telemetry-pill {
          background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px;
          padding: 14px 24px; display: flex; align-items: center; gap: 12px;
          backdrop-filter: blur(10px); width: 100%; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .telemetry-pill:hover { border-color: #00E5FF; transform: translateX(-5px) scale(1.02); background: rgba(0, 229, 255, 0.05); }

        .launch-btn { 
          background: #00E5FF; color: #070b14; border: none; 
          padding: 20px 40px; border-radius: 20px; font-size: 14px; 
          font-weight: 900; cursor: pointer; display: flex; align-items: center; 
          gap: 12px; transition: all 0.3s; box-shadow: 0 15px 30px rgba(0, 229, 255, 0.3);
          text-transform: uppercase; margin-top: 32px; width: fit-content; letter-spacing: 1px;
        }
        .launch-btn:disabled { background: #334155; color: #94a3b8; cursor: not-allowed; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.1); }
        .launch-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(0, 229, 255, 0.4); }

        .status-badge { display: flex; align-items: center; gap: 8px; padding: 10px 18px; background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px); border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); }
        .bottom-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }

        .telemetry-header {
           color:rgb(132, 156, 188); font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
           margin-bottom: 8px; text-align: center; width: 100%; opacity: 0.8;
        }
        
        /* ENTER ANIMATIONS */
        @keyframes slideUpFade { 
          from { opacity: 0; transform: translateY(30px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-slide-up { animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        
        @media (max-width: 1050px) { .telemetry-header { text-align: center; margin-top: 20px; } }
      `}</style>

      <main>
        {/* HEADER */}
        <header className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '20px', animationDelay: '0s' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: '900', letterSpacing: '-1.5px' }}>Control <span style={{ color: '#00E5FF' }}>Centre</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: '#94a3b8' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>AURA Vision Streaming Engine Controller</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="status-badge" style={{ borderColor: isLoading ? 'rgba(161, 159, 159, 0.2)' : isHostOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLoading ? '#808080' : isHostOffline ? '#ef4444' : '#10b981', boxShadow: `0 0 10px ${isLoading ? '#808080' : isHostOffline ? '#ef4444' : '#10b981'}` }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: isLoading ? '#808080' : isHostOffline ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {isLoading ? 'Connecting...' : isHostOffline ? 'Host Offline' : 'Host Online'}
                </span>
              </div>
              <div className="status-badge" style={{ borderColor: isLoading ? 'rgba(161, 159, 159, 0.2)' : !isDeviceConnected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLoading ? '#808080' : !isDeviceConnected ? '#ef4444' : '#10b981', boxShadow: `0 0 10px ${isLoading ? '#808080' : !isDeviceConnected ? '#ef4444' : '#10b981'}` }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: isLoading ? '#808080' : !isDeviceConnected ? '#ef4444' : '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {isLoading ? 'Connecting...' : !isDeviceConnected ? 'Edge Lost' : 'Edge Connected'}
                </span>
              </div>
            </div>
            <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#00E5FF', fontFamily: 'monospace' }}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>{currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            </div>
          </div>
        </header>

        {/* HERO SHOWCASE */}
        <div className="hero-showcase animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="scan-line"></div>
          
          <div style={{ position: 'absolute', top: '20px', left: '20px', width: '20px', height: '20px', borderLeft: '2px solid #00E5FF', borderTop: '2px solid #00E5FF', opacity: 0.5 }}></div>
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '20px', height: '20px', borderRight: '2px solid #00E5FF', borderBottom: '2px solid #00E5FF', opacity: 0.5 }}></div>

          <div className="showcase-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
               <div style={{ background: '#00E5FF', padding: '6px 12px', borderRadius: '8px', color: '#070b14', fontSize: '10px', fontWeight: '900' }}>{SYSTEM_VERSION}</div>
               <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: '700' }}>SMART GLASSES SYSTEM</div>
            </div>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', margin: 0, fontWeight: '900', lineHeight: 1, letterSpacing: '-1px' }}>
              Vision Stream<br/><span style={{ color: '#00E5FF' }}>Engine</span>
            </h2>
            <p style={{ color: '#94a3b8', margin: '30px 0 0 0', lineHeight: '1.6', fontSize: '16px', maxWidth: '500px' }}>
              Initialize multi-spectral neural awareness. Seamlessly bridge object detection and environmental telemetry.
            </p>
            <button className="launch-btn" onClick={onNavigateVision} disabled={!isDeviceConnected}>
              <Camera size={20} /> {isDeviceConnected ? "Initialize Vision Dashboard" : "Hardware Offline"}
            </button>
          </div>

          <div className="showcase-center">
            <div className="model-aura"></div>
            <model-viewer
              src="/smart_glasses.glb" auto-rotate='true' rotation-per-second="15deg"
              camera-controls="false" disable-zoom environment-image="neutral" exposure="1.2" shadow-intensity="1.5" interaction-prompt="none"
              style={{ width: '100%', height: '380px', minHeight: '300px', outline: 'none', filter: isDeviceConnected ? 'none' : 'grayscale(1) brightness(0.7)' }}
            ></model-viewer>
          </div>

          <div className="showcase-right">
            <div className="telemetry-header">Smart Glasses Status</div>
            <div className="telemetry-pill">
              <Battery size={20} color="#00E5FF" />
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '900', letterSpacing: '0.5px' }}>BATTERY</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: isDeviceConnected ? '#f8fafc' : '#475569' }}>{isDeviceConnected ? '98%' : '---'}</div>
              </div>
            </div>
            <div className="telemetry-pill">
              <Wifi size={20} color={isDeviceConnected ? '#10b981' : '#ef4444'} />
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '900', letterSpacing: '0.5px' }}>LATENCY</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: isDeviceConnected ? '#f8fafc' : '#475569' }}>{isDeviceConnected ? '14ms' : 'LOSS'}</div>
              </div>
            </div>
            <div className="telemetry-pill">
              <Activity size={20} color="#a855f7" />
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '900', letterSpacing: '0.5px' }}>OS CORE</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: isDeviceConnected ? '#f8fafc' : '#475569' }}>{isDeviceConnected ? 'STABLE' : 'OFF'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM GRID */}
        <div className="bottom-grid">
          <WidgetCard title="Safety & Navigation" icon={BrainCircuit} delay="0.2s">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: '800', fontSize: '12px' }}>Spatial YOLO</span>
              <div style={{ color: '#10b981', fontSize: '10px', fontWeight: '900', border: '1px solid #10b981', padding: '4px 8px', borderRadius: '6px' }}>LIVE</div>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontWeight: '500' }}>Detects vehicles, pedestrians, and obstacles. Latency: ~45ms.</p>
          </WidgetCard>

          <WidgetCard title="Industrial Support" icon={ToolboxIcon} delay="0.3s">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontWeight: '800', fontSize: '12px' }}>Warning Sign OCR</span>
              <div style={{ color: '#38bdf8', fontSize: '10px', fontWeight: '900', border: '1px solid #38bdf8', padding: '4px 8px', borderRadius: '6px' }}>STANDBY</div>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontWeight: '500' }}>Character recognition for workplace safety signs and machinery labels.</p>
          </WidgetCard>

          <WidgetCard title="Telemetry" icon={MapPin} delay="0.4s">
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: isDeviceConnected ? '#f8fafc' : '#475569' }}>{isDeviceConnected ? locationName : "Searching GPS ..."}</div>
              <div style={{ fontSize: '12px', color: '#00E5FF', fontFamily: 'monospace', marginTop: '16px', fontWeight: '600', letterSpacing: '1px' }}>{isDeviceConnected ? `${sysState.lat.toFixed(4)}° N, ${sysState.lon.toFixed(4)}° E` : "0.0000° N, 0.0000° E"}</div>
            </div>
          </WidgetCard>
        </div>
      </main>
    </div>
  );
}

export default MainDashboard;
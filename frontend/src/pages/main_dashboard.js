import React, { useState, useEffect } from 'react';
import { Camera, Cpu, Battery, MapPin, Eye, BrainCircuit, Wifi, ToolboxIcon, Activity, ShieldCheck } from 'lucide-react';
import { WS_BASE_URL } from '../config';

const WidgetCard = ({ title, icon: Icon, children, className = "", delay = "0s", style = {} }) => (
  <div className={`widget-card animate-slide-up ${className}`} style={{ animationDelay: delay, ...style }}>
    {/* High-end glass reflection line */}
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
  const [isHostLoading, setIsHostLoading] = useState(true);
  const [isHostOffline, setIsHostOffline] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const [sysState, setSysState] = useState({ mode: "NORMAL", lat: 5.41, lon: 100.33 });
  const [locationName, setLocationName] = useState("Locating...");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/dashboard`);
    ws.onopen = () => { setIsHostLoading(false); setIsHostOffline(false); };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status" || data.mode) {
          if (data.device_connected !== undefined) setIsDeviceConnected(data.device_connected);
          setSysState(prev => ({
            ...prev,
            mode: data.mode || prev.mode,
            lat: data.location?.lat || prev.lat,
            lon: data.location?.lon || prev.lon
          }));
        }
      } catch (err) { console.error("WS error:", err); }
    };
    ws.onclose = () => { setIsHostLoading(false); setIsHostOffline(true); setIsDeviceConnected(false); };
    return () => ws.close();
  }, []);

  return (
    <div className="dashboard-container">

      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '70vh', height: '70vh', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '-20%', right: '-5%', width: '60vh', height: '60vh', background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>

      <style>{`
        .dashboard-container { 
          height: 100vh; width: 100%; background: transparent; 
          color: #f8fafc; display: flex; overflow: hidden;
        }
        main { flex: 1; padding: 40px; display: flex; flex-direction: column; overflow-y: auto; }
        
        /* Glassmorphism Card Styling */
        .widget-card { 
          background: rgba(15, 23, 42, 0.3); 
          backdrop-filter: blur(20px); 
          border-radius: 24px; 
          border: 1px solid rgba(255, 255, 255, 0.08); 
          padding: 24px; 
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          transition: all 0.3s ease;
          position: relative;
        }
        .widget-card:hover { 
          transform: translateY(-5px); 
          border-color: rgba(0, 229, 255, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 15px rgba(0, 229, 255, 0.1);
        }

        .widget-header { 
          display: flex; align-items: center; gap: 10px; 
          color: #64748b; font-size: 11px; font-weight: 800; 
          letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; 
        }
        .widget-icon { color: #00E5FF; }

        /* Hero Launch Section */
        .hero-card { 
          background: rgba(30, 41, 59, 0.2);
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 32px; padding: 50px; 
          display: flex; flex-direction: column; align-items: center; 
          position: relative; overflow: hidden;
          box-shadow: 0 0 40px rgba(0,0,0,0.5), inset 0 0 30px rgba(0, 229, 255, 0.05);
        }
        
        .launch-btn { 
          background: #00E5FF; color: #0f172a; border: none; 
          padding: 18px 48px; border-radius: 20px; font-size: 15px; 
          font-weight: 900; cursor: pointer; display: flex; align-items: center; 
          gap: 12px; transition: all 0.3s; 
          box-shadow: 0 10px 25px rgba(0, 229, 255, 0.3);
        }
        .launch-btn:hover:not(:disabled) { transform: translateY(-3px) scale(1.02); box-shadow: 0 15px 35px rgba(0, 229, 255, 0.5); }
        .launch-btn:disabled { background: #334155; color: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .status-badge {
          display: flex; align-items: center; gap: 10px; padding: 10px 20px;
          background-color: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px);
          border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease;
        }

        .main-layout-grid { display: grid; grid-template-columns: 2.5fr 1fr; gap: 32px; margin-top: 20px; }
        .ai-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
        
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
      `}</style>

      <main className="custom-scroll">
        <header className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '38px', fontWeight: '900', letterSpacing: '-1.5px' }}>
              Control <span style={{ color: '#00E5FF' }}>Centre</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', color: '#94a3b8' }}>
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Assistive Vision Network Interface</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="status-badge" style={{ borderColor: isHostOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'  }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isHostOffline ? '#ef4444' : '#10b981', boxShadow: `0 0 10px ${isHostOffline ? '#ef4444' : '#10b981'}` }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: isHostOffline ? '#ef4444' : '#10b981' }}>HOST {isHostOffline ? 'OFFLINE' : 'ONLINE'}</span>
              </div>
              <div className="status-badge" style={{ borderColor: isDeviceConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isDeviceConnected ? '#10b981' : '#ef4444', boxShadow: `0 0 10px ${isDeviceConnected ? '#10b981' : '#ef4444'}` }} />
                <span style={{ fontSize: '11px', fontWeight: '900', color: isDeviceConnected ? '#10b981' : '#ef4444' }}>EDGE {isDeviceConnected ? 'READY' : 'DISCONNECT'}</span>
              </div>
            </div>

            <div style={{ padding: '15px 25px', background: 'rgba(255,255,255,0.03)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'monospace', color: '#00E5FF' }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </header>

        <div className="main-layout-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="hero-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Eye size={280} color="#00E5FF" style={{ position: 'absolute', right: '-50px', top: '-50px', opacity: 0.05, transform: 'rotate(-15deg)' }} />
              <div style={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', padding: '12px', borderRadius: '15px', marginBottom: '20px' }}>
                <Camera color="#00E5FF" size={24} />
              </div>
              <h2 style={{ fontSize: '32px', margin: 0, fontWeight: '900' }}>Vision Stream Engine</h2>
              <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '550px', margin: '15px 0 35px 0', lineHeight: '1.7', fontSize: '15px' }}>
                Initialize full-spectrum spatial awareness. Activates neural object detection, warning sign OCR, and haptic environmental feedback.
              </p>
              <button className="launch-btn" onClick={onNavigateVision} disabled={!isDeviceConnected}>
                {isDeviceConnected ? "INITIALIZE VISION DASHBOARD" : "DEVICE DISCONNECTED"}
              </button>
            </div>

            <div className="ai-grid">
              <WidgetCard title="Safety & Navigation" icon={BrainCircuit} delay="0.3s">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>Spatial YOLO V8</span>
                  <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '900', border: '1px solid #10b981', padding: '2px 8px', borderRadius: '5px' }}>LIVE</div>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>Active detection for 80+ object classes including vehicles and hazardous obstacles.</p>
              </WidgetCard>

              <WidgetCard title="Industrial Support" icon={ToolboxIcon} delay="0.4s">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>Warning Sign OCR</span>
                  <div style={{ color: '#38bdf8', fontSize: '11px', fontWeight: '900', border: '1px solid #38bdf8', padding: '2px 8px', borderRadius: '5px' }}>STANDBY</div>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>Instant character recognition for workplace safety signs and machinery labels.</p>
              </WidgetCard>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <WidgetCard title="Hardware Telemetry" icon={Cpu} delay="0.5s">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {[
                  { label: 'Battery Level', val: isDeviceConnected ? '98%' : '--', icon: Battery, color: '#00E5FF' },
                  { label: 'Neural Signal', val: isDeviceConnected ? '-42 dBm' : 'OFF', icon: Wifi, color: '#10b981' },
                  { label: 'Haptic Core', val: isDeviceConnected ? 'READY' : 'OFF', icon: Activity, color: '#a855f7' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px' }}><item.icon size={16} color={item.color} /></div>
                      <span style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '500' }}>{item.label}</span>
                    </div>
                    <span style={{ fontWeight: '900', color: '#fff', fontSize: '15px' }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </WidgetCard>

            <WidgetCard title="Spatial Location" icon={MapPin} delay="0.6s">
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '18px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>{isDeviceConnected ? locationName : "No GPS Found"}</div>
                <div style={{ fontSize: '14px', color: '#00E5FF', fontFamily: 'monospace' }}>
                  {isDeviceConnected ? `${sysState.lat.toFixed(4)}° N, ${sysState.lon.toFixed(4)}° E` : "0.0000° N, 0.0000° E"}
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>System Mode</span>
                  <span style={{ fontWeight: '700' }}>{sysState.mode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Movement</span>
                  <span style={{ color: '#10b981', fontWeight: '700' }}>Stationary</span>
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
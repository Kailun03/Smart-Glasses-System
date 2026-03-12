import React, { useState, useEffect } from 'react';
import { Camera, Cpu, Battery, MapPin, Eye, BrainCircuit, Wifi, ToolboxIcon, Activity } from 'lucide-react';

function MainDashboard({ onNavigateVision }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const WidgetCard = ({ title, icon: Icon, children, className = "" }) => (
    <div className={`widget-card ${className}`}>
      <div className="widget-header">
        <Icon size={18} className="widget-icon" />
        {title}
      </div>
      <div className="widget-content">
        {children}
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      
      {/* --- INJECTED CSS FOR RESPONSIVENESS & ANIMATIONS --- */}
      <style>{`
        /* Global Color Palette */
        :root {
          --bg-dark: #0f172a;
          --bg-card: #16161a;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --border-color: rgba(255,255,255,0.05);
          
          /* Thematic Accent Colors */
          --accent-blue: #38bdf8;
          --accent-blue-glow: rgba(56, 189, 248, 0.4);
          --accent-teal: #2dd4bf;
          --accent-purple: #a855f7;
          --status-active: #22c55e;
          --status-standby: #f59e0b;
        }

        /* Container Setup */
        .dashboard-container {
          height: 100vh;
          width: 100%;
          background-color: var(--bg-dark);
          font-family: system-ui, sans-serif;
          color: var(--text-primary);
          display: flex;
        }

        main {
          flex: 1;
          padding: 40px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow-y: auto;
        }

        /* * CUSTOM SCROLLBAR 
         */
        .custom-scroll::-webkit-scrollbar { 
            width: 6px; 
            background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-track { 
            background: transparent; 
        }
        .custom-scroll::-webkit-scrollbar-thumb { 
            background-color: #334155; 
            border-radius: 4px; 
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover { 
            background-color: #475569; 
        }

        /* * RESPONSIVE GRID SYSTEM 
         */
        .main-layout-grid {
          display: grid;
          /* Default: 2 columns. Left is 2.5x wider than Right */
          grid-template-columns: 2.5fr 1fr; 
          gap: 32px;
          flex: 1;
          min-height: 0;
        }

        /* AI Subsystems Grid (Nested inside Left Column) */
        .ai-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }

        /* Right Column (Diagnostics) */
        .diag-grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* MEDIA QUERY: When screen is smaller than 1200px (Half Screen) */
        @media (max-width: 1200px) {
          .main-layout-grid {
            grid-template-columns: 1fr; /* Stack columns on top of each other */
          }
          
          /* Turn the vertical right column into a horizontal row */
          .diag-grid {
            flex-direction: row; 
          }
        }

        /* MEDIA QUERY: When screen is VERY small (Mobile/Narrow) */
        @media (max-width: 800px) {
          .ai-grid { grid-template-columns: 1fr; }
          .diag-grid { flex-direction: column; }
        }

        /* * CARD STYLING & HOVER EFFECTS 
         */
        .widget-card {
          background-color: var(--bg-card);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .widget-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent-blue-glow);
          box-shadow: 0 12px 40px rgba(56, 189, 248, 0.15);
        }

        .widget-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .widget-icon {
          color: var(--accent-blue);
        }

        .widget-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* * THE "BREATHING" HERO CARD 
         */
        @keyframes breathingGlow {
          0% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 0 1px rgba(56, 189, 248, 0.1); }
          50% { box-shadow: 0 0 40px rgba(45, 212, 191, 0.4), inset 0 0 0 2px rgba(45, 212, 191, 0.3); }
          100% { box-shadow: 0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 0 1px rgba(56, 189, 248, 0.1); }
        }

        .hero-card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 1) 0%, rgba(2, 6, 23, 1) 100%);
          border-radius: 24px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
          animation: breathingGlow 6s infinite ease-in-out;
        }

        .hero-bg-icon {
          position: absolute;
          top: -40px;
          right: -40px;
          opacity: 0.03;
          transform: rotate(-15deg);
        }

        .launch-btn {
          background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
          color: #020617;
          border: none;
          padding: 16px 40px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1;
          box-shadow: 0 0 20px var(--accent-blue-glow);
          transition: all 0.2s ease;
        }

        .launch-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 35px var(--accent-blue-glow);
        }

        /* Utility Classes */
        .badge-active { background: rgba(34, 197, 94, 0.1); color: var(--status-active); border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .badge-standby { background: rgba(245, 158, 11, 0.1); color: var(--status-standby); border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .badge-offline { background: rgba(168, 85, 247, 0.1); color: var(--accent-purple); border: 1px solid rgba(168, 85, 247, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
      `}</style>

      {/* ADDED 'custom-scroll' CLASS HERE */}
      <main className="custom-scroll">
        
        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '32px', color: '#f8fafc', letterSpacing: '-1px', fontWeight: '800' }}>
              System Command
            </h2>
            <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '15px' }}>Assistive Vision Network active.</p>
          </div>
          
          <div style={{ textAlign: 'right', padding: '12px 20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '1px', fontFamily: 'monospace' }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px', fontWeight: '500' }}>
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* MAIN RESPONSIVE GRID */}
        <div className="main-layout-grid">
          
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Premium Hero Launch Card */}
            <div className="hero-card">
              <Eye size={300} color="#2dd4bf" className="hero-bg-icon" />

              <h2 style={{ fontSize: '32px', margin: '0 0 16px 0', color: '#f8fafc', zIndex: 1, fontWeight: '900', letterSpacing: '-0.5px' }}>
                Live Vision Engine
              </h2>
              <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '500px', marginBottom: '36px', zIndex: 1, lineHeight: '1.6', fontSize: '15px' }}>
                Initialize the real-time spatial awareness stream. Activates concurrent Object Detection, OCR, and Environmental parsing.
              </p>
              
              <button className="launch-btn" onClick={onNavigateVision}>
                <Camera size={20} color="#020617" />
                Establish Feed Connection
              </button>
            </div>

            {/* AI Subsystems Grid - Mapped to your 4 FYP Core Modules! */}
            <h3 style={{ margin: '0 0 -16px 0', color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>Core AI Modules</h3>
            <div className="ai-grid">
              
              {/* Module 1: Mobility & Safety */}
              <WidgetCard title="Mobility & Safety" icon={BrainCircuit}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>YOLO Spatial Engine</span>
                  <span className="badge-active">ACTIVE</span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Detects vehicles, pedestrians, and obstacles. Inference: ~45ms.</div>
              </WidgetCard>

              {/* Module 2: Workplace Assistance */}
              <WidgetCard title="Workplace Support" icon={ToolboxIcon}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>Custom Tool & OCR</span>
                  <span className="badge-standby">STANDBY</span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Identifies predefined machinery and reads environmental warning signs.</div>
              </WidgetCard>

            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="diag-grid">
            
            {/* Hardware Telemetry */}
            <WidgetCard title="Edge Telemetry" icon={Cpu} style={{ flex: 'unset' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '8px' }}><Battery size={16} color="#38bdf8" /></div>
                    Device Power
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '16px' }}>98%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(45, 212, 191, 0.1)', padding: '8px', borderRadius: '8px' }}><Wifi size={16} color="#2dd4bf" /></div>
                    Signal Strength
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#2dd4bf', fontSize: '14px' }}>-42 dBm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#cbd5e1', fontSize: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '8px', borderRadius: '8px' }}><Activity size={16} color="#a855f7" /></div>
                    Haptic Motors
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#a855f7', fontSize: '14px' }}>Ready</span>
                </div>
              </div>
            </WidgetCard>

            {/* Location Context */}
            <WidgetCard title="Geospatial Data" icon={MapPin} style={{ flex: 'unset' }}>
              <div style={{ backgroundColor: '#020617', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid #1e293b' }}>
                <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '16px' }}>Kuala Kurau, Perak</span>
                <span style={{ color: '#38bdf8', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '1px' }}>5.41° N, 100.33° W</span>
              </div>
              <div style={{ marginTop: '20px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                  <span>Environment</span> <span style={{ color: '#e2e8f0', fontWeight: '600' }}>Outdoor / Daylight</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Density Profile</span> <span style={{ color: '#e2e8f0', fontWeight: '600' }}>High Pedestrian</span>
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
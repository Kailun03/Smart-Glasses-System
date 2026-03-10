import React, { useState, useEffect } from 'react';
import { Shield, Activity, Camera, Server, Cpu, Battery, MapPin, Eye, BrainCircuit, AlertTriangle, Clock, Wifi } from 'lucide-react';

function MainDashboard({ onNavigateVision, onNavigateTools }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reusable Widget Card Component to keep code clean
  const WidgetCard = ({ title, icon: Icon, children, flex = 1 }) => (
    <div style={{
      backgroundColor: '#16161a',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.05)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      flex: flex,
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '16px', textTransform: 'uppercase' }}>
        <Icon size={16} color="#64748b" />
        {title}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '30px', boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', color: '#f8fafc', letterSpacing: '-0.5px' }}>
            <Shield size={32} color="#38bdf8" /> 
            Assistive Vision OS
          </h1>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>System Control & Diagnostics Center</p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '1px' }}>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* MAIN GRID */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: Launch & AI Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 2 }}>
          
          {/* Hero Launch Card */}
          <div style={{ 
            backgroundColor: 'rgba(56, 189, 248, 0.05)', 
            borderRadius: '20px', 
            border: '1px solid rgba(56, 189, 248, 0.2)', 
            padding: '30px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1.5,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Background decoration */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', opacity: 0.1 }}><Eye size={200} color="#38bdf8" /></div>

            <h2 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#f8fafc', zIndex: 1 }}>Live Vision Engine</h2>
            <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '400px', marginBottom: '30px', zIndex: 1, lineHeight: '1.5' }}>
              Initialize the real-time camera feed, object detection (YOLO), and OCR text recognition for navigational assistance.
            </p>
            
            <button 
              onClick={onNavigateVision}
              style={{ 
                backgroundColor: '#38bdf8', 
                color: '#0f172a', 
                border: 'none', 
                padding: '16px 36px', 
                borderRadius: '30px', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                zIndex: 1,
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={(e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 0 30px rgba(56, 189, 248, 0.6)'; }}
              onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.4)'; }}
            >
              <Camera size={20} />
              Launch Vision Dashboard
            </button>
          </div>

          {/* AI Subsystems Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
            <WidgetCard title="Object Detection" icon={BrainCircuit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: '500' }}>YOLOv8 Engine</span>
                <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>ACTIVE</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Optimized for urban hazards (vehicles, pedestrians). Average inference: ~45ms.</div>
            </WidgetCard>

            <WidgetCard title="Text Recognition" icon={Eye}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#e2e8f0', fontWeight: '500' }}>EasyOCR Engine</span>
                <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>STANDBY</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Fires every 5 seconds. Optimized for signboards and warnings.</div>
            </WidgetCard>
          </div>
        </div>

        {/* Workplace Assistance Entry Point */}
        <div style={{ backgroundColor: '#16161a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '16px' }}>Workplace Tool Management</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Upload datasets and train custom tool recognition models.</p>
            </div>
            <button 
            onClick={onNavigateTools}
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.2)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
            Manage Models
            </button>
        </div>

        {/* RIGHT COLUMN: Diagnostics & Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          
          {/* Hardware Telemetry */}
          <WidgetCard title="Edge Hardware Telemetry" icon={Cpu} flex={0}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13px' }}>
                  <Battery size={16} color="#38bdf8" /> Device Battery
                </div>
                <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>98%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13px' }}>
                  <Wifi size={16} color="#38bdf8" /> Signal Strength
                </div>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>Excellent (-42dBm)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '13px' }}>
                  <Server size={16} color="#38bdf8" /> Host Connection
                </div>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>Connected</span>
              </div>
            </div>
          </WidgetCard>

          {/* Location / Safety Context */}
          <WidgetCard title="Location Context" icon={MapPin} flex={0}>
            <div style={{ backgroundColor: '#020617', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #1e293b' }}>
              <span style={{ color: '#f8fafc', fontWeight: '500', fontSize: '14px' }}>Kuala Kurau, Perak</span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>5.41° N, 100.33° W</span>
            </div>
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
              <strong>Environment:</strong> Outdoor / Daylight<br/>
              <strong>Safety Profile:</strong> High pedestrian traffic expected.
            </div>
          </WidgetCard>

          {/* Session Statistics */}
          <WidgetCard title="Session Statistics" icon={Activity} flex={1}>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#ef4444" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>14</span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Hazards Avoided Today</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Clock size={20} color="#38bdf8" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f8fafc' }}>2.4<span style={{fontSize: '14px'}}>h</span></span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Active Uptime</span>
                </div>
             </div>
          </WidgetCard>

        </div>
      </div>
    </div>
  );
}

export default MainDashboard;
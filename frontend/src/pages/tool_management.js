import React, { useState } from 'react';
import { UploadCloud, Edit2, Trash2, Database, Activity, CheckCircle, Clock } from 'lucide-react';

function ToolManagement() {
  const [tools] = useState([
    { id: 1, name: 'Wrench (Standard)', date: '2026-03-01', status: 'Deployed' },
    { id: 2, name: 'Phillips Screwdriver', date: '2026-03-02', status: 'Deployed' },
    { id: 3, name: 'Claw Hammer', date: '2026-03-05', status: 'Deployed' },
    { id: 4, name: 'Voltage Tester', date: '2026-03-09', status: 'Processing' },
    { id: 5, name: 'Hex Key Set', date: '2026-03-10', status: 'Training Queue' },
    { id: 6, name: 'Cordless Drill', date: '2026-03-11', status: 'Deployed' },
    { id: 7, name: 'Pliers (Needle-nose)', date: '2026-03-11', status: 'Deployed' },
  ]);

  const InfoRow = ({ label, value, highlight = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: highlight ? '#2dd4bf' : '#f8fafc', fontWeight: '600' }}>{value}</span>
    </div>
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Deployed': return <span className="badge-active"><CheckCircle size={12}/> Deployed</span>;
      case 'Processing': return <span className="badge-processing"><Activity size={12}/> Processing</span>;
      case 'Training Queue': return <span className="badge-standby"><Clock size={12}/> Pending</span>;
      default: return null;
    }
  };

  return (
    <div className="dashboard-container">
      
      {/* --- INJECTED CSS FOR RESPONSIVENESS & ANIMATIONS --- */}
      <style>{`
        /* Global Color Palette (Matches Main Dashboard) */
        :root {
          --bg-dark: #0f172a;
          --bg-card: #16161a;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --border-color: rgba(255,255,255,0.05);
          
          --accent-blue: #38bdf8;
          --accent-teal: #2dd4bf;
          --status-active: #22c55e;
          --status-standby: #f59e0b;
        }

        .dashboard-container {
          height: 100vh;
          width: 100%;
          background-color: var(--bg-dark);
          font-family: system-ui, sans-serif;
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          padding: 40px;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* * RESPONSIVE GRID SYSTEM */
        .tool-layout-grid {
          display: grid;
          grid-template-columns: 380px 1fr; /* Fixed left column, flexible right column */
          gap: 32px;
          flex: 1;
          min-height: 0;
        }

        @media (max-width: 1100px) {
          .tool-layout-grid {
            grid-template-columns: 1fr; /* Stack columns on small screens */
            overflow-y: auto; /* Allow scrolling if stacked */
          }
        }

        /* * CARD STYLING & HOVER EFFECTS */
        .widget-card {
          background-color: var(--bg-card);
          border-radius: 16px;
          border: 1px solid var(--border-color);
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .widget-card:hover {
          border-color: rgba(56, 189, 248, 0.3);
          box-shadow: 0 12px 40px rgba(56, 189, 248, 0.1);
        }

        /* * FORM INPUTS */
        .form-input {
          width: 100%;
          background-color: #020617;
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
          font-family: system-ui, sans-serif;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }

        /* * DRAG & DROP ZONE */
        .drop-zone {
          border: 2px dashed #334155;
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          background-color: rgba(255,255,255,0.01);
          cursor: pointer;
          margin-bottom: 24px;
          transition: all 0.2s ease;
        }
        .drop-zone:hover {
          border-color: var(--accent-blue);
          background-color: rgba(56, 189, 248, 0.05);
        }

        /* * ACTION BUTTON */
        .submit-btn {
          width: 100%;
          background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
          color: #020617;
          border: none;
          padding: 14px;
          border-radius: 10px;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5);
        }

        /* * BADGES */
        .badge-active { background: rgba(34, 197, 94, 0.1); color: var(--status-active); border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }
        .badge-processing { background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }
        .badge-standby { background: rgba(245, 158, 11, 0.1); color: var(--status-standby); border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }

        /* * SCROLLBAR */
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #475569; }
      `}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Workplace Tool Training
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '15px' }}>Manage custom datasets and model deployment statuses.</p>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="tool-layout-grid">
        
        {/* LEFT COLUMN: Model Info & Upload Form */}
        <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* Model Specs Card */}
          <div className="widget-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '20px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              <Database size={18} color="#38bdf8" /> Current Model Specs
            </div>
            <InfoRow label="Model ID" value="TRM-MLY000001-A" />
            <InfoRow label="Architecture" value="YOLOv8-Custom" />
            <InfoRow label="Supported Classes" value={`${tools.filter(t => t.status === 'Deployed').length} Tools`} highlight={true} />
            <InfoRow label="Overall mAP Score" value="95.43%" highlight={true} />
            <InfoRow label="Inference Speed" value="32.12 ms" />
            <InfoRow label="Last Update" value="2026-03-01 08:00" />
          </div>

          {/* Upload Form Card */}
          <div className="widget-card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '24px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              <UploadCloud size={18} color="#2dd4bf" /> Upload Dataset
            </div>
            
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tool Name</label>
            <input type="text" className="form-input" placeholder="e.g. Cordless Drill" />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description / Notes</label>
            <textarea className="form-input" placeholder="Describe the tool's visual features..." rows="3" style={{ resize: 'none' }}></textarea>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Training Images (Min 50)</label>
            <div className="drop-zone">
              <UploadCloud size={36} color="#475569" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', color: '#cbd5e1', fontWeight: '500' }}>Drag & Drop images here</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Supports JPG, PNG, ZIP format</div>
            </div>

            <button className="submit-btn">
              Submit to Training Queue
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Tool List Table */}
        <div className="widget-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: '700', letterSpacing: '0.5px' }}>Trained Tool Repository</h2>
          </div>
          
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <tr>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Tool Name</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Date Added</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Model Status</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.03)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '20px 32px', color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{tool.name}</td>
                    <td style={{ padding: '20px 32px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{tool.date}</td>
                    <td style={{ padding: '20px 32px' }}>
                      {getStatusBadge(tool.status)}
                    </td>
                    <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '16px' }}>
                        <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e)=>e.currentTarget.style.color='#38bdf8'} onMouseOut={(e)=>e.currentTarget.style.color='#64748b'} title="Edit"><Edit2 size={16} /></button>
                        <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e)=>e.currentTarget.style.color='#ef4444'} onMouseOut={(e)=>e.currentTarget.style.color='#64748b'} title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ToolManagement;
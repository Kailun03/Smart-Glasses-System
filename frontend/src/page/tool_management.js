import React, { useState } from 'react';
import { ArrowLeft, Wrench, UploadCloud, Edit2, Trash2, Database, Activity, CheckCircle, Clock } from 'lucide-react';

function ToolManagement({ onNavigate }) {
  // Dummy data for the table
  const [tools] = useState([
    { id: 1, name: 'Wrench (Standard)', date: '2026-03-01', status: 'Deployed' },
    { id: 2, name: 'Phillips Screwdriver', date: '2026-03-02', status: 'Deployed' },
    { id: 3, name: 'Claw Hammer', date: '2026-03-05', status: 'Deployed' },
    { id: 4, name: 'Voltage Tester', date: '2026-03-09', status: 'Processing' },
    { id: 5, name: 'Hex Key Set', date: '2026-03-10', status: 'Training Queue' },
  ]);

  const InfoRow = ({ label, value, highlight = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: highlight ? '#38bdf8' : '#f8fafc', fontWeight: '600' }}>{value}</span>
    </div>
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Deployed': return <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><CheckCircle size={12}/> Deployed</span>;
      case 'Processing': return <span style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><Activity size={12}/> Processing</span>;
      case 'Training Queue': return <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}><Clock size={12}/> Pending</span>;
      default: return null;
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0', display: 'flex', flexDirection: 'column', padding: '30px', boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
        <button 
          onClick={onNavigate}
          style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc', padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={24} color="#38bdf8" /> Custom Tool Recognition
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Workplace Assistance Model Management</p>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: Model Info & Upload Form */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '10px' }}>
          
          {/* Model Specs Card */}
          <div style={{ backgroundColor: '#16161a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', marginBottom: '16px' }}>
              <Database size={18} color="#38bdf8" /> Current Model Specs
            </div>
            <InfoRow label="Model ID" value="TRM-MLY000001-A" />
            <InfoRow label="Architecture" value="YOLOv8-Custom" />
            <InfoRow label="Supported Classes" value="32 Tools" highlight={true} />
            <InfoRow label="Overall mAP Score" value="95.43%" highlight={true} />
            <InfoRow label="Inference Speed" value="32.12 ms" />
            <InfoRow label="Last Update" value="2026-03-01 08:00" />
          </div>

          {/* Upload Form Card */}
          <div style={{ backgroundColor: '#16161a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', padding: '24px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontWeight: 'bold', marginBottom: '20px' }}>
              <UploadCloud size={18} color="#22c55e" /> Upload New Tool Dataset
            </div>
            
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Tool Name</label>
            <input type="text" placeholder="e.g. Cordless Drill" style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }} />

            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Description / Use Case</label>
            <textarea placeholder="Describe the tool's visual features..." rows="3" style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box', resize: 'none' }}></textarea>

            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Dataset Images (Min 50)</label>
            <div style={{ border: '2px dashed #334155', borderRadius: '12px', padding: '30px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', cursor: 'pointer', marginBottom: '20px' }}>
              <UploadCloud size={32} color="#64748b" style={{ marginBottom: '10px' }} />
              <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '500' }}>Drag & Drop images here</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Supports JPG, PNG, ZIP</div>
            </div>

            <button style={{ width: '100%', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Submit to Training Queue
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Tool List Table */}
        <div style={{ flex: 1, backgroundColor: '#16161a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>Trained Tool Repository</h2>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #334155' }}>TOOL NAME</th>
                  <th style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #334155' }}>DATE ADDED</th>
                  <th style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #334155' }}>MODEL STATUS</th>
                  <th style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #334155', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px 24px', color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{tool.name}</td>
                    <td style={{ padding: '16px 24px', color: '#94a3b8', fontSize: '13px' }}>{tool.date}</td>
                    <td style={{ padding: '16px 24px' }}>
                      {getStatusBadge(tool.status)}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '12px' }}>
                        <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} title="Edit"><Edit2 size={16} /></button>
                        <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Delete"><Trash2 size={16} /></button>
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
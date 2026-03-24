import React, { useState, useEffect } from 'react';
import { UploadCloud, Trash2, Database, Activity, CheckCircle, Clock } from 'lucide-react';
import { API_BASE_URL } from '../config';

function ToolManagement() {
  // 1. Live State for Tools and Form Inputs
  const [tools, setTools] = useState([]);
  const [toolName, setToolName] = useState("");
  const [yoloClass, setYoloClass] = useState("");
  const [toolDesc, setToolDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2. Fetch Tools from FastAPI / Supabase on Load
  const fetchTools = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tools`);
      if (response.ok) {
        const data = await response.json();
        // Map the database response to our UI format
        const formattedTools = data.map(t => ({
          id: t.id,
          name: t.name,
          yolo_class: t.yolo_class,
          description: t.description,
          status: 'Deployed' // Assuming they are ready immediately for the prototype
        }));
        setTools(formattedTools);
      }
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  // 3. Handle Adding a New Tool
  const handleAddTool = async () => {
    if (!toolName.trim() || !yoloClass.trim()) {
      alert("Tool Name and YOLO Class are required.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toolName,
          yolo_class: yoloClass.toLowerCase(),
          description: toolDesc
        })
      });
      
      if (response.ok) {
        setToolName("");
        setYoloClass("");
        setToolDesc("");
        fetchTools(); // Refresh the table
      }
    } catch (error) {
      console.error("Failed to add tool:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle Deleting a Tool
  const handleDeleteTool = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tool?")) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/tools/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        fetchTools(); // Refresh the table
      }
    } catch (error) {
      console.error("Failed to delete tool:", error);
    }
  };

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
      
      <style>{`
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

        .tool-layout-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 32px;
          flex: 1;
          min-height: 0;
        }

        @media (max-width: 1100px) {
          .tool-layout-grid { grid-template-columns: 1fr; overflow-y: auto; }
        }

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
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5);
        }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .badge-active { background: rgba(34, 197, 94, 0.1); color: var(--status-active); border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }
        .badge-processing { background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }
        .badge-standby { background: rgba(245, 158, 11, 0.1); color: var(--status-standby); border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; }

        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background-color: #475569; }

        /* --- NEW ANIMATION CLASSES --- */
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { 
          animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
          opacity: 0; 
        }
      `}</style>

      <header className="animate-slide-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', flexShrink: 0, animationDelay: '0.1s' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Workplace Tool Training
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '15px' }}>Manage custom datasets and model deployment statuses.</p>
        </div>
      </header>

      <div className="tool-layout-grid">
        
        <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', paddingRight: '4px' }}>
          
          <div className="widget-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '20px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              <Database size={18} color="#38bdf8" /> Current Model Specs
            </div>
            <InfoRow label="Model ID" value="TRM-MLY000001-A" />
            <InfoRow label="Architecture" value="YOLOv8-Custom" />
            <InfoRow label="Supported Classes" value={`${tools.length} Tools`} highlight={true} />
            <InfoRow label="Database Sync" value="Supabase Connected" highlight={true} />
          </div>

          <div className="widget-card animate-slide-up" style={{ flex: 1, animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '24px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              <UploadCloud size={18} color="#2dd4bf" /> Register New Tool
            </div>
            
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Friendly Name (e.g., Mom's Phone)</label>
            <input type="text" className="form-input" value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="Friendly Name" />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>YOLO Detection Class (e.g., cell phone)</label>
            <input type="text" className="form-input" value={yoloClass} onChange={(e) => setYoloClass(e.target.value)} placeholder="YOLO Target Name" />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description / Notes</label>
            <textarea className="form-input" value={toolDesc} onChange={(e) => setToolDesc(e.target.value)} placeholder="Describe the tool's visual features..." rows="2" style={{ resize: 'none' }}></textarea>

            <button className="submit-btn" onClick={handleAddTool} disabled={isSubmitting}>
              {isSubmitting ? "Syncing to Cloud..." : "Register Tool to System"}
            </button>
          </div>

        </div>

        <div className="widget-card animate-slide-up" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.4s' }}>
          <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: '700', letterSpacing: '0.5px' }}>Trained Tool Repository</h2>
          </div>
          
          <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 1, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <tr>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Tool Name</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>YOLO Target</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.length === 0 && (
                  <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No tools registered in database.</td></tr>
                )}
                {tools.map((tool) => (
                  <tr key={tool.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.03)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '20px 32px', color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>
                      {tool.name}
                      {tool.description && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{tool.description}</div>}
                    </td>
                    <td style={{ padding: '20px 32px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{tool.yolo_class}</td>
                    <td style={{ padding: '20px 32px' }}>
                      {getStatusBadge(tool.status)}
                    </td>
                    <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '16px' }}>
                        <button onClick={() => handleDeleteTool(tool.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={(e)=>e.currentTarget.style.color='#ef4444'} onMouseOut={(e)=>e.currentTarget.style.color='#64748b'} title="Delete"><Trash2 size={16} /></button>
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
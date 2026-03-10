// import React, { useState, useEffect, useRef } from 'react';
// import { Shield, Activity, Terminal, Camera, RefreshCw } from 'lucide-react';

// function App() {
//   const [logs, setLogs] = useState([]);
//   const [status, setStatus] = useState("Connecting to Glasses...");
//   const [videoKey, setVideoKey] = useState(Date.now()); // Used to force-reload the video
//   const logsEndRef = useRef(null);

//   // Auto-scroll the terminal
//   useEffect(() => {
//     logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [logs]);

//   // Connect to the Python WebSocket
//   useEffect(() => {
//     const ws = new WebSocket('ws://localhost:8000/ws');

//     ws.onopen = () => {
//       setStatus("System Online & Active");
//       setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "SUCCESS: Connected to AI Backend.", type: "info" }]);
//       // Force the video to reload when we connect
//       setTimeout(() => setVideoKey(Date.now()), 1000); 
//     };

//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         if (data.log) {
//           const isHazard = data.log.includes("HAZARD");
//           setLogs(prev => [...prev, { 
//             time: new Date().toLocaleTimeString(), 
//             text: data.log, 
//             type: isHazard ? "alert" : "normal" 
//           }]);
//         }
//       } catch (e) {}
//     };

//     ws.onclose = () => {
//       setStatus("Offline - Check Connection");
//       setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "WARNING: Connection Lost.", type: "error" }]);
//     };

//     return () => ws.close();
//   }, []);

//   return (
//     // 1. The outer wrapper is strictly locked to 100vh (the exact height of the screen)
//     <div style={{ backgroundColor: '#0f172a', color: '#e2e8f0', height: '100vh', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      
//       {/* Header Section */}
//       <header style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '15px', marginBottom: '20px' }}>
//         <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', color: '#38bdf8' }}>
//           <Shield size={28} /> Smart Glasses System Console
//         </h1>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px' }}>
//           <Activity size={20} color={status.includes("Online") ? "#22c55e" : "#ef4444"} />
//           <span style={{ fontWeight: 'bold', color: status.includes("Online") ? "#22c55e" : "#ef4444" }}>{status}</span>
//         </div>
//       </header>

//       {/* Main Grid - minHeight: 0 is the magic CSS fix that forces children to scroll instead of stretch */}
//       <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', minHeight: 0 }}>
        
//         {/* Left Column: Live Video Feed */}
//         <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
//           <div style={{ flexShrink: 0, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={20} /> LIVE AI VISION FEED</div>
            
//             {/* Added a manual reload button just in case the video stream gets stuck */}
//             <button onClick={() => setVideoKey(Date.now())} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
//               <RefreshCw size={16} /> Reload Video
//             </button>
//           </div>
          
//           <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '2px solid #334155', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
//             <img 
//               key={videoKey} // This forces React to reload the image when the key changes
//               src={`http://localhost:8000/video_feed?t=${videoKey}`} 
//               alt="Waiting for ESP32 feed..." 
//               style={{ width: '100%', height: '100%', objectFit: 'contain' }}
//             />
//           </div>
//         </div>

//         {/* Right Column: System Terminal Log */}
//         <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
//           <div style={{ flexShrink: 0, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Terminal size={20} /> SYSTEM TERMINAL</div>
//             <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Clear Logs</button>
//           </div>
          
//           <div style={{ flex: 1, backgroundColor: '#020617', borderRadius: '12px', border: '2px solid #334155', padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
//             {logs.map((log, index) => (
//               <div key={index} style={{ 
//                 color: log.type === 'alert' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : log.type === 'info' ? '#38bdf8' : '#22c55e',
//                 borderBottom: '1px solid #1e293b',
//                 paddingBottom: '8px',
//                 lineHeight: '1.5',
//                 wordBreak: 'break-word'
//               }}>
//                 <span style={{ color: '#64748b', marginRight: '8px' }}>[{log.time}]</span>
//                 {log.text}
//               </div>
//             ))}
//             <div ref={logsEndRef} />
//           </div>
//         </div>

//       </main>
//     </div>
//   );
// }

// export default App;

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Activity, Terminal, Camera, RefreshCw, Server, Cpu } from 'lucide-react';

function App() {
  const [logs, setLogs] = useState([]);
  const [videoKey, setVideoKey] = useState(Date.now());
  const logsEndRef = useRef(null);

  // New strict connection states
  const [backendConnected, setBackendConnected] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/dashboard');

    ws.onopen = () => {
      setBackendConnected(true);
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "SUCCESS: Connected to AI Backend Server.", type: "info" }]);
      setTimeout(() => setVideoKey(Date.now()), 1000); 
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle explicit status updates from the Python server
        if (data.type === "status") {
            setDeviceConnected(data.device_connected);
        }

        // Handle standard logs
        if (data.log) {
          const isHazard = data.log.includes("HAZARD");
          const isWarning = data.log.includes("WARNING");
          
          setLogs(prev => [...prev, { 
            time: new Date().toLocaleTimeString(), 
            text: data.log, 
            type: isHazard ? "alert" : isWarning ? "error" : "normal" 
          }]);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setBackendConnected(false);
      setDeviceConnected(false); // If backend dies, device connection is implicitly lost
      setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), text: "CRITICAL ERROR: AI Backend Disconnected.", type: "error" }]);
    };

    return () => ws.close();
  }, []);

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#e2e8f0', height: '100vh', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      
      <header style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '15px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '24px', color: '#38bdf8' }}>
          <Shield size={28} /> Assistive Vision AI Console
        </h1>
        
        {/* Professional 2-Part Status Monitor */}
        <div style={{ display: 'flex', gap: '12px' }}>
            
            {/* Backend Server Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${backendConnected ? '#22c55e' : '#ef4444'}` }}>
              <Server size={16} color={backendConnected ? "#22c55e" : "#ef4444"} />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: backendConnected ? "#22c55e" : "#ef4444" }}>
                Host: {backendConnected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            {/* ESP32 Device Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#1e293b', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${deviceConnected ? '#38bdf8' : '#64748b'}` }}>
              <Cpu size={16} color={deviceConnected ? "#38bdf8" : "#64748b"} />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: deviceConnected ? "#38bdf8" : "#64748b" }}>
                Edge Device (need to rename): {deviceConnected ? "STREAMING" : "DISCONNECTED"}
              </span>
            </div>

        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', minHeight: 0 }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flexShrink: 0, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Camera size={20} /> LIVE EDGE VISION</div>
            
            <button onClick={() => setVideoKey(Date.now())} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={16} /> Force Reload Sync
            </button>
          </div>
          
          <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '2px solid #334155', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {/* Show an offline overlay if the device drops out */}
            {!deviceConnected && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ef4444', zIndex: 10 }}>
                    <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h2 style={{ margin: 0 }}>NO VIDEO SIGNAL</h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>Awaiting ESP32 hardware connection...</p>
                </div>
            )}
            <img 
              key={videoKey}
              src={`http://localhost:8000/video_feed?t=${videoKey}`} 
              alt="Stream inactive" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flexShrink: 0, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontWeight: 'bold' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Terminal size={20} /> AI EVENT TERMINAL</div>
            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Clear Output</button>
          </div>
          
          <div style={{ flex: 1, backgroundColor: '#020617', borderRadius: '12px', border: '2px solid #334155', padding: '16px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log, index) => (
              <div key={index} style={{ 
                color: log.type === 'alert' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : log.type === 'info' ? '#38bdf8' : '#22c55e',
                borderBottom: '1px solid #1e293b',
                paddingBottom: '8px',
                lineHeight: '1.5',
                wordBreak: 'break-word'
              }}>
                <span style={{ color: '#64748b', marginRight: '8px' }}>[{log.time}]</span>
                {log.text}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
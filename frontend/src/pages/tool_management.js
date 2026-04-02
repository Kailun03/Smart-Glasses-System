import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Trash2, Database, Activity, CheckCircle, Clock, ServerCrash, RotateCw, AlertTriangle, ChevronRight, ChevronLeft, Check, Move, Maximize, Bell, X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

function ToolManagement() {
  const [tools, setTools] = useState([]);
  const [toolName, setToolName] = useState("");
  const [toolDesc, setToolDesc] = useState("");
  const [files, setFiles] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingToast, setLoadingToast] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [isLoading, setLoading] = useState(true);

  // --- NOTIFICATION STATE ---
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  
  // Drawer Animation States
  const [showAllNotifsModal, setShowAllNotifsModal] = useState(false);
  const [isClosingDrawer, setIsClosingDrawer] = useState(false);
  const [notifTotal, setNotifTotal] = useState(0);
  
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewImages, setReviewImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const imageContainerRef = useRef(null);
  const [dragInfo, setDragInfo] = useState({ isDragging: false, type: null, startX: 0, startY: 0, initBox: null });
  const [imageAspect, setImageAspect] = useState(null);

  useEffect(() => {
    setImageAspect(null);
  }, [currentIndex]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- SMART "MARK AS READ" LOGIC ---
  const prevShowNotifs = useRef(showNotifs);
  useEffect(() => {
    if (prevShowNotifs.current === true && showNotifs === false) {
      if (Array.isArray(notifications) && notifications.some(n => !n.is_read)) {
        fetch(`${API_BASE_URL}/api/notifications/read`, { method: "PUT" }).catch(e => console.error(e));
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    }
    prevShowNotifs.current = showNotifs;
  }, [showNotifs, notifications]);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tools`);
      if (response.ok) {
        const data = await response.json();
        const formattedTools = data.map(t => ({
          id: t.id,
          name: t.tool_name,
          tool_class: t.tool_name.toLowerCase().replace(/ /g, "_"),
          description: t.description,
          status: t.status
        }));
        setTools(formattedTools);
        setIsOffline(false); 
      }

      const notifRes = await fetch(`${API_BASE_URL}/api/notifications?limit=10&offset=0`);
      if (notifRes.ok) {
        const result = await notifRes.json();
        
        if (isBackground) {
          setNotifications(prev => {
            const existingIds = new Set(result.data.map(n => n.id));
            const olderNotifs = prev.filter(n => !existingIds.has(n.id));
            return [...result.data, ...olderNotifs];
          });
        } else {
          setNotifications(result.data || []);
        }
        setNotifTotal(result.total_count || 0); 
      }
    } catch (error) {
      setIsOffline(true);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const intervalId = setInterval(() => fetchData(true), 5000); 
    return () => clearInterval(intervalId);
  }, []);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group Notifications by Date
  const groupNotificationsByDate = (notifs) => {
    const groups = {};

    if (!notifs || !Array.isArray(notifs)) return groups;
  
    notifs.forEach(n => {
      const d = new Date(n.created_at);
      const dateLabel = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(n);
    });
    return groups;
  };

  const groupedNotifications = groupNotificationsByDate(notifications);

  const loadMoreNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications?limit=10&offset=${notifications.length}`);
      if (response.ok) {
        const result = await response.json();
        setNotifications(prev => {
          const newItems = result.data.filter(newItem => !prev.some(p => p.id === newItem.id));
          return [...prev, ...newItems];
        });
        setNotifTotal(result.total_count || 0);
      }
    } catch (error) { 
      console.error("Load more failed:", error); 
    }
  };

  // --- DRAWER CLOSE HANDLER ---
  const handleCloseDrawer = () => {
    setIsClosingDrawer(true);
    setTimeout(() => {
      setShowAllNotifsModal(false);
      setIsClosingDrawer(false);
    }, 300); // Wait for the 0.3s CSS animation to complete
  };

  // -Dragging logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragInfo.isDragging || reviewImages[currentIndex]?.isBackground) return;
      
      const container = imageContainerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragInfo.startX) / container.width) * 100;
      const dy = ((e.clientY - dragInfo.startY) / container.height) * 100;

      let { x, y, w, h } = dragInfo.initBox;

      if (dragInfo.type === 'move') {
        x += dx; y += dy;
      } else {
        if (dragInfo.type.includes('e')) w += dx;
        if (dragInfo.type.includes('s')) h += dy;
        if (dragInfo.type.includes('w')) { const newW = w - dx; if (newW > 2) { x += dx; w = newW; } }
        if (dragInfo.type.includes('n')) { const newH = h - dy; if (newH > 2) { y += dy; h = newH; } }
      }

      w = Math.max(2, w); h = Math.max(2, h);
      x = Math.max(0, Math.min(x, 100 - w));
      y = Math.max(0, Math.min(y, 100 - h));

      const updatedImages = [...reviewImages];
      updatedImages[currentIndex].box = { x, y, w, h };
      setReviewImages(updatedImages);
    };

    const handleMouseUp = () => setDragInfo({ isDragging: false, type: null });

    if (dragInfo.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo, currentIndex, reviewImages]);

  const handleMouseDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragInfo({
      isDragging: true,
      type,
      startX: e.clientX,
      startY: e.clientY,
      initBox: { ...reviewImages[currentIndex].box }
    });
  };

  const handleInitiateReview = async () => {
    if (!toolName.trim() || !files || files.length < 5) return alert("Tool Name and at least 5 images are required.");
    setLoadingToast("Analyzing images with OpenCV...");
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      
      const response = await fetch(`${API_BASE_URL}/api/tools/auto_label`, { method: "POST", body: formData });
      const autoLabels = await response.json();

      const imagePreviews = Array.from(files).map((file, index) => {
        const cvBox = autoLabels[index]?.box;
        return {
          file: file,
          previewUrl: URL.createObjectURL(file),
          isBackground: cvBox === null,
          box: cvBox || { x: 25, y: 25, w: 50, h: 50 } 
        };
      });

      setReviewImages(imagePreviews);
      setCurrentIndex(0);
      setIsReviewing(true);
    } catch (error) {
      alert("Failed to connect to AI Auto-Labeler.");
    } finally {
      setIsSubmitting(false);
      setLoadingToast("");
    }
  };

  const handleFinalSubmit = async () => {
    setIsReviewing(false);
    setLoadingToast("Transferring annotations to pipeline...");
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("tool_name", toolName);
      formData.append("description", toolDesc);
      
      const finalBoxes = reviewImages.map(img => img.isBackground ? null : img.box);
      formData.append("boxes", JSON.stringify(finalBoxes));
      reviewImages.forEach(img => formData.append("files", img.file));

      const response = await fetch(`${API_BASE_URL}/api/tools/train`, { method: "POST", body: formData });
      if (response.ok) {
        setToolName(""); setToolDesc(""); setFiles(null);
        document.getElementById('dataset-upload').value = "";
        reviewImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setReviewImages([]);
        fetchData(true); 
      }
    } catch (error) {
      console.error("Failed to start training pipeline:", error);
    } finally {
      setIsSubmitting(false);
      setLoadingToast("");
    }
  };

  const toggleBackground = () => {
    const updatedImages = [...reviewImages];
    updatedImages[currentIndex].isBackground = !updatedImages[currentIndex].isBackground;
    setReviewImages(updatedImages);
  };

  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    setCurrentIndex(newIndex);
  };

  const handleDeleteTool = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tool?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/tools/${id}`, { method: "DELETE" });
      if (response.ok) fetchData(true); 
    } catch (error) {}
  };

  // Only display UNREAD notifications in the dropdown menu
  const unreadNotifs = notifications.filter(n => !n.is_read);
  const unreadCount = unreadNotifs.length;
  const displayedNotifs = unreadNotifs;

  const InfoRow = ({ label, value, highlight = false }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: isOffline ? '#ef4444' : highlight ? '#2dd4bf'  : '#f8fafc', fontWeight: '600' }}>{value}</span>
    </div>
  );

  const getStatusBadge = (status) => {
    switch(status) {
      case 'DEPLOYED': return <span className="badge-active"><CheckCircle size={12}/> Deployed</span>;
      case 'PROCESSING_DATA': return <span className="badge-processing"><Activity size={12}/> Data Processing</span>;
      case 'TRAINING': return <span className="badge-processing"><RotateCw size={12} className="spinning"/> Training</span>;
      case 'QUEUED': return <span className="badge-standby"><Clock size={12}/> Queued</span>;
      case 'FAILED': return <span className="badge-standby" style={{color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.1)'}}><AlertTriangle size={12}/> Failed</span>;
      default: return null;
    }
  };

  return (
    <div className="dashboard-container">
      <style>{`
        :root { --bg-dark: #0f172a; --bg-card: #16161a; --text-primary: #f8fafc; --text-secondary: #94a3b8; --border-color: rgba(255,255,255,0.05); --accent-blue: #38bdf8; --accent-teal: #2dd4bf; --status-active: #22c55e; --status-standby: #f59e0b; }
        .dashboard-container { height: 100vh; width: 100%; background-color: var(--bg-dark); font-family: system-ui, sans-serif; color: var(--text-primary); display: flex; flex-direction: column; padding: 40px; box-sizing: border-box; overflow: hidden; }
        .tool-layout-grid { display: grid; grid-template-columns: 500px 1fr; gap: 32px; flex: 1; min-height: 0; }
        @media (max-width: 1100px) { .tool-layout-grid { grid-template-columns: 1fr; overflow-y: auto; } }
        
        .widget-card { background-color: var(--bg-card); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); padding: 24px; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.2); transition: all 0.3s ease; }
        .widget-card:hover { border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 12px 40px rgba(56, 189, 248, 0.15); transform: translateY(-2px);}
        .table-row { transition: all 0.2s ease; }
        .table-row:hover { background-color: rgba(56, 189, 248, 0.05); box-shadow: inset 3px 0 0 0 #38bdf8;}
        .form-input { width: 100%; background-color: #020617; border: 1px solid #1e293b; color: #f8fafc; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; box-sizing: border-box; font-family: inherit; font-size: 14px; line-height: 1.5; transition: all 0.2s ease;}
        .form-input:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
        .submit-btn { width: 100%; background: linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-teal) 100%); color: #020617; border: none; padding: 14px; border-radius: 10px; font-weight: bold; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(56, 189, 248, 0.5); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .badge-active { background: rgba(34, 197, 94, 0.1); color: var(--status-active); border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; }
        .badge-processing { background: rgba(56, 189, 248, 0.1); color: var(--accent-blue); border: 1px solid rgba(56, 189, 248, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; }
        .badge-standby { background: rgba(245, 158, 11, 0.1); color: var(--status-standby); border: 1px solid rgba(245, 158, 11, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; }
        
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; }
        
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        
        @keyframes spin { 100% { transform: rotate(360deg); } } .spinning { animation: spin 1s linear infinite; }
        
        .status-badge { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background-color: rgba(15, 23, 42, 0.6); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .file-drop-zone { border: 2px dashed #334155; border-radius: 12px; padding: 32px 20px; text-align: center; cursor: pointer; background-color: rgba(15, 23, 42, 0.4); display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 24px; transition: all 0.2s ease;}
        .file-drop-zone:hover { border-color: var(--accent-blue); background-color: rgba(56, 189, 248, 0.05); }

        /* --- NOTIFICATION DROPDOWN --- */
        .notif-bell-wrapper { position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s; }
        .notif-bell-wrapper:hover { background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.1); }
        .notif-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: 0 0 0 2px #0f172a; }
        .notif-dropdown { position: absolute; top: 56px; right: 0; width: 360px; background: var(--bg-card); border: 1px solid #1e293b; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); z-index: 50; display: flex; flex-direction: column; overflow: hidden; }
        .notif-header { padding: 16px 20px; border-bottom: 1px solid #1e293b; font-weight: 700; display: flex; justify-content: space-between; background: var(--bg-card); z-index: 2; }
        .notif-item { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.02); display: flex; gap: 12px; transition: background 0.2s; }
        .notif-item:hover { background: rgba(255,255,255,0.02); }
        .notif-unread { background: rgba(56, 189, 248, 0.05); }
        .notif-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
        .n-info { background: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        .n-success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .n-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        /* --- DRAWER PANEL FOR NOTIFICATIONS WITH SLIDE IN/OUT --- */
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOutOverlay { from { opacity: 1; } to { opacity: 0; } }
        
        .drawer-overlay { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.75); backdrop-filter: blur(4px); z-index: 2000; animation: fadeInOverlay 0.3s ease-out forwards; }
        .drawer-overlay.closing { animation: fadeOutOverlay 0.3s ease-out forwards; }
        
        .drawer-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 450px; background: var(--bg-card); border-left: 1px solid #1e293b; display: flex; flex-direction: column; z-index: 2001; box-shadow: -20px 0 50px rgba(0,0,0,0.5); animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .drawer-panel.closing { animation: slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .history-item { padding: 20px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; gap: 16px; align-items: flex-start; transition: all 0.2s ease; }
        .history-item:hover { border-color: rgba(56, 189, 248, 0.3); transform: translateX(4px); background: rgba(255,255,255,0.02); }

        /* --- LANDSCAPE HITL MODAL --- */
        .modal-overlay { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.90); backdrop-filter: blur(10px); z-index: 2000; display: flex; justify-content: center; align-items: center; padding: 24px; }
        .modal-content-landscape { background: var(--bg-card); border: 1px solid #1e293b; border-radius: 20px; width: 95vw; max-width: 1400px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); overflow: hidden; }
        .modal-header-landscape { padding: 20px 32px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; background: #0f172a; flex-shrink: 0; }
        .modal-body-landscape { display: flex; flex: 1; min-height: 0; flex-direction: row; }
        .workspace-wrapper { flex: 3; display: flex; flex-direction: column; background: #020617; border-right: 1px solid #1e293b; }
        .workspace-area { flex: 1; position: relative; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 24px; }
        .timeline-container { padding: 20px 32px; background: var(--bg-card); border-top: 1px solid #1e293b; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
        .timeline-slider-wrapper { display: flex; align-items: center; gap: 20px; }
        .timeline-slider { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; background: #1e293b; outline: none; flex: 1; }
        .timeline-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 6px; background: #2dd4bf; cursor: pointer; border: 2px solid #0f172a; box-shadow: 0 0 10px rgba(45, 212, 191, 0.4); transition: transform 0.1s; }
        .timeline-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .btn-nav-timeline { padding: 10px 16px; background: #1e293b; color: #f8fafc; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; transition: all 0.2s; min-width: 100px; }
        .btn-nav-timeline:hover:not(:disabled) { background: #334155; border-color: rgba(255,255,255,0.1); }
        .btn-nav-timeline:disabled { opacity: 0.4; cursor: not-allowed; }
        .interactive-box { position: absolute; border: 2px solid #2dd4bf; background: rgba(45, 212, 191, 0.15); box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); cursor: move; }
        .resize-handle { position: absolute; width: 12px; height: 12px; background: #fff; border: 2px solid #2dd4bf; border-radius: 50%; z-index: 10; }
        .resize-handle:hover { transform: scale(1.2); background: #2dd4bf; }
        .nw { top: -6px; left: -6px; cursor: nwse-resize; } .ne { top: -6px; right: -6px; cursor: nesw-resize; } .sw { bottom: -6px; left: -6px; cursor: nesw-resize; } .se { bottom: -6px; right: -6px; cursor: nwse-resize; } .n { top: -6px; left: calc(50% - 6px); cursor: ns-resize; } .s { bottom: -6px; left: calc(50% - 6px); cursor: ns-resize; } .w { left: -6px; top: calc(50% - 6px); cursor: ew-resize; } .e { right: -6px; top: calc(50% - 6px); cursor: ew-resize; }
        .controls-area { width: 400px; padding: 32px; background: var(--bg-card); display: flex; flex-direction: column; gap: 32px; flex-shrink: 0; overflow-y: auto; }
        .bg-toggle-card { padding: 16px 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 16px; transition: all 0.3s; }
        .readonly-coords { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #0f172a; padding: 16px; border-radius: 8px; border: 1px solid #1e293b; }
        .coord-item { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
        .coord-label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
        .coord-val { color: #f8fafc; font-family: monospace; font-size: 15px; }
        .btn-cancel { background: transparent; border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; padding: 16px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s; text-align: center; }
        .btn-cancel:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }
      
        .load-more-container { padding: 16px 0; display: flex; justify-content: flex-end; }
        .load-more-btn { background: none; border: none;color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 4px; }
        .load-more-btn:hover {color: #38bdf8; transform: translateX(-4px); }
      `}</style>

      {/* --- NEW: RIGHT SIDE DRAWER FOR FULL NOTIFICATION HISTORY --- */}
      {(showAllNotifsModal || isClosingDrawer) && (
        <>
          {/* Dark overlay backdrop - Calls handleCloseDrawer to trigger fade out */}
          <div className={`drawer-overlay ${isClosingDrawer ? 'closing' : ''}`} onClick={handleCloseDrawer} />
          
          {/* Sliding Panel */}
          <div className={`drawer-panel ${isClosingDrawer ? 'closing' : ''}`}>
            <div style={{ padding: '8px 32px', borderBottom: '1px solid #1e293b', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: '14px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '18px' }}>
                  <Bell size={20} color="#38bdf8" /> System Notification History
                </h3>
              </div>
              
              <button 
                onClick={handleCloseDrawer} 
                style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', marginTop: '12px', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', flexShrink: 0 }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(21, 171, 235, 0.1)'; e.currentTarget.style.color = '#38bdf8'; }} 
                onMouseOut={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#f8fafc'; }}
              >
                <ChevronRight size={20}/>
              </button>
            </div>

            <div className="custom-scroll" style={{ flex: 1, padding: '24px', background: '#020617', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>No historical notifications found in the database.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {Object.entries(groupedNotifications).map(([dateLabel, notifsForDate]) => (
                    <div key={dateLabel}>
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '4px' }}>
                        {dateLabel}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {notifsForDate.map(n => (
                          <div key={n.id} className="history-item">
                            <div className={`notif-icon ${n.type === 'success' ? 'n-success' : n.type === 'error' ? 'n-error' : 'n-info'}`} style={{ width: '36px', height: '36px' }}>
                              {n.type === 'success' ? <CheckCircle size={18}/> : n.type === 'error' ? <AlertTriangle size={18}/> : <Activity size={18}/>}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '500', lineHeight: '1.4' }}>{n.message}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={12} /> {formatTime(n.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* LOAD MORE BUTTON */}
                  {notifications.length < notifTotal && (
                    <div className="load-more-container">
                      <button onClick={loadMoreNotifications} className="load-more-btn">
                        View More <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- GLOBAL LOADING TOAST --- */}
      {loadingToast !== "" && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid #334155', padding: '14px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
          <style>{` @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } `}</style>
          <Loader2 size={18} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px' }}>{loadingToast}</span>
        </div>
      )}

      {/* --- SIDE-BY-SIDE HITL REVIEW MODAL --- */}
      {isReviewing && reviewImages.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content-landscape animate-slide-up">
            <div className="modal-header-landscape">
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}><Maximize size={20} color="#38bdf8" /> Dataset Verification Studio</h2>
                <span style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Ensure bounding boxes tightly frame the target tool.</span>
              </div>
              <div style={{ background: '#1e293b', padding: '6px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', color: '#38bdf8' }}>Image {currentIndex + 1} of {reviewImages.length}</div>
            </div>
            <div className="modal-body-landscape">
              <div className="workspace-wrapper">
                <div className="workspace-area">
                  <div ref={imageContainerRef} style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', aspectRatio: imageAspect ? `${imageAspect}` : 'auto', opacity: imageAspect ? 1 : 0, transition: 'opacity 0.2s ease-in' }}>
                    <img src={reviewImages[currentIndex].previewUrl} alt="Review Workspace" style={{ width: '100%', height: '100%', display: 'block' }} onLoad={(e) => setImageAspect(e.target.naturalWidth / e.target.naturalHeight)} />
                    {!reviewImages[currentIndex].isBackground && (
                      <div className="interactive-box" onMouseDown={(e) => handleMouseDown(e, 'move')} style={{ left: `${reviewImages[currentIndex].box.x}%`, top: `${reviewImages[currentIndex].box.y}%`, width: `${reviewImages[currentIndex].box.w}%`, height: `${reviewImages[currentIndex].box.h}%` }}>
                        <div className="resize-handle nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} /> <div className="resize-handle n" onMouseDown={(e) => handleMouseDown(e, 'n')} /> <div className="resize-handle ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                        <div className="resize-handle w" onMouseDown={(e) => handleMouseDown(e, 'w')} /> <div className="resize-handle e" onMouseDown={(e) => handleMouseDown(e, 'e')} /> <div className="resize-handle sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                        <div className="resize-handle s" onMouseDown={(e) => handleMouseDown(e, 's')} /> <div className="resize-handle se" onMouseDown={(e) => handleMouseDown(e, 'se')} /> <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', opacity:0.5 }}><Move size={24} color="#fff"/></div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="timeline-container">
                  <div style={{ textAlign: 'center', color: '#f8fafc', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.5px' }}>Verification Timeline <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>({currentIndex + 1} / {reviewImages.length})</span></div>
                  <div className="timeline-slider-wrapper">
                    <button className="btn-nav-timeline" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}><ChevronLeft size={16} style={{marginRight: '6px'}}/> Prev</button>
                    <input type="range" min="0" max={reviewImages.length - 1} value={currentIndex} onChange={handleSliderChange} className="timeline-slider" style={{ background: `linear-gradient(to right, #38bdf8 ${(currentIndex / (reviewImages.length - 1)) * 100}%, #1e293b ${(currentIndex / (reviewImages.length - 1)) * 100}%)` }} />
                    <button className="btn-nav-timeline" onClick={() => setCurrentIndex(Math.min(reviewImages.length - 1, currentIndex + 1))} disabled={currentIndex === reviewImages.length - 1}>Next <ChevronRight size={16} style={{marginLeft: '6px'}}/></button>
                  </div>
                </div>
              </div>
              <div className="controls-area custom-scroll">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="bg-toggle-card" style={{ background: reviewImages[currentIndex].isBackground ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${reviewImages[currentIndex].isBackground ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>Negative Mining Match</div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px', lineHeight: '1.4' }}>Flag this image as having NO tool present. This is crucial for training the AI to ignore background noise and prevent false positive detections.</div>
                    </div>
                    <button onClick={toggleBackground} style={{ width: '100%', background: reviewImages[currentIndex].isBackground ? '#22c55e' : '#334155', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}>
                      {reviewImages[currentIndex].isBackground ? "BACKGROUND MODE ENABLED" : "ENABLE BACKGROUND MODE"}
                    </button>
                  </div>
                  {!reviewImages[currentIndex].isBackground && (
                    <div className="readonly-coords">
                      <div className="coord-item"><span className="coord-label">X-Axis</span><span className="coord-val">{reviewImages[currentIndex].box.x.toFixed(1)}%</span></div>
                      <div className="coord-item"><span className="coord-label">Y-Axis</span><span className="coord-val">{reviewImages[currentIndex].box.y.toFixed(1)}%</span></div>
                      <div className="coord-item"><span className="coord-label">Width</span><span className="coord-val">{reviewImages[currentIndex].box.w.toFixed(1)}%</span></div>
                      <div className="coord-item"><span className="coord-label">Height</span><span className="coord-val">{reviewImages[currentIndex].box.h.toFixed(1)}%</span></div>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button className="submit-btn" onClick={handleFinalSubmit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', fontSize: '15px' }}><Check size={20} /> Approve & Train Model</button>
                  <button className="btn-cancel" onClick={() => { setIsReviewing(false); setReviewImages([]); }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DASHBOARD HEADER --- */}
      <header className="animate-slide-up" style={{ position: 'relative', zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexShrink: 0, animationDelay: '0.1s' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px', color: '#f8fafc', fontWeight: '800', letterSpacing: '-0.5px' }}>Workplace Intelligence</h1>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '15px' }}>Manage custom vision datasets and trained model support.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          {/* Notification System Dropdown */}
          <div className="notif-container" ref={notifRef} style={{ position: 'relative'}}>
            <div className="notif-bell-wrapper" onClick={() => setShowNotifs(!showNotifs)}>
              <Bell size={20} color="#94a3b8" />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </div>
            
            {showNotifs && (
              <div className="notif-dropdown animate-slide-up">
                <div className="notif-header">
                  <span style={{ fontSize: '13px', fontWeight: '500', paddingTop: '2px' }}>System Events</span>
                  <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16}/></button>
                </div>
                
                <div className="custom-scroll" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {displayedNotifs.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Bell size={28} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>No new notifications.</span>
                    </div>
                  ) : (
                    displayedNotifs.map(n => (
                      <div key={n.id} className={`notif-item ${!n.is_read ? 'notif-unread' : ''}`}>
                        <div className={`notif-icon ${n.type === 'success' ? 'n-success' : n.type === 'error' ? 'n-error' : 'n-info'}`}>
                          {n.type === 'success' ? <CheckCircle size={16}/> : n.type === 'error' ? <AlertTriangle size={16}/> : <Activity size={16}/>}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', color: '#f8fafc', lineHeight: '1.4' }}>{n.message}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{formatTime(n.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* "View Recent Notifications" Footer Button */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #1e293b', textAlign: 'center' }}>
                  <button 
                    onClick={() => { setShowNotifs(false); setShowAllNotifsModal(true); }} 
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '6px' }}
                  >
                    View All Recent Notifications <ChevronRight size={14} />
                  </button>
                </div>

              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLoading && tools.length===0 ? '#808080' : isOffline ? '#ef4444' : '#22c55e', boxShadow: `0 0 8px ${isLoading && tools.length===0 ? '#808080' : isOffline ? '#ef4444' : '#22c55e'}` }} />
            <span style={{ fontSize: '11px', fontWeight: '700', color: isLoading && tools.length===0 ? '#808080' : isOffline ? '#ef4444' : '#22c55e', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {isLoading && tools.length===0 ? 'Connecting...' : isOffline ? ' Host Offline' : 'Host Online'}
            </span>
          </div>
        </div>
      </header>

      {/* --- DASHBOARD WIDGETS --- */}
      <div className="tool-layout-grid">
        <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', paddingRight: '4px' }}>
          
          <div className="widget-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '20px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}><Database size={18} color="#38bdf8" /> Current Model Specs</div>
            <InfoRow label="Model ID" value={ isLoading && tools.length===0 ? "Loading ..." : isOffline ? "Undefined Model" : "Custom-Tool-Recognition-Model-v1" }  />
            <InfoRow label="Architecture" value={ isLoading && tools.length===0 ? "Loading ..." : isOffline ? "Undefined Architecture" : "YOLOv8-Dual-Agent-Ensemble" } />
            <InfoRow label="Supported Classes" value={ isLoading && tools.length===0 ? "Loading ..." : `${tools.length} Tools`} highlight={true} />
            <InfoRow label="Database Sync" value={  isLoading && tools.length===0 ? "Loading ..." : isOffline ? "Database Offline" : "Supabase Connected" } highlight={true} />
          </div>

          <div className="widget-card animate-slide-up" style={{ flex: 1, animationDelay: '0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontWeight: '700', marginBottom: '24px', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}><UploadCloud size={18} color="#2dd4bf" /> Register New Tool</div>
            
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Tool Name</label>
            <input type="text" className="form-input" value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="Enter Tool Name ( e.g. Screw Driver )" />

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description / Notes</label>
            <textarea className="form-input" value={toolDesc} onChange={(e) => setToolDesc(e.target.value)} placeholder="Describe the tool's visual features..." rows="2" style={{ resize: 'none' }}></textarea>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload Dataset (10-30 Images)</label>
            <label htmlFor="dataset-upload" className="file-drop-zone">
              <UploadCloud size={36} color={files && files.length > 0 ? "#2dd4bf" : "#64748b"} style={{ transition: 'color 0.3s' }} />
              <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>
                {files && files.length > 0 ? <span style={{ color: '#2dd4bf' }}>{files.length} images selected</span> : <span>Click to browse for images</span>}
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>Supported formats: JPEG, JPG, PNG</div>
            </label>
            <input id="dataset-upload" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={(e) => setFiles(e.target.files)} />

            <button className="submit-btn" style={{fontSize: '12px'}} onClick={handleInitiateReview} disabled={isSubmitting}>
              {isSubmitting ? "Queueing Pipeline..." : "Review Annotations & Train"}
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
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Class Target</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                  <th style={{ padding: '20px 32px', color: '#64748b', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && tools.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}><RotateCw size={24} className="spinning" style={{ opacity: 0.5, color: '#64748b' }} /><span style={{ color: '#64748b', fontSize: '14px' }}>Fetching telemetry from cloud...</span></div></td></tr>
                ) : isOffline ? (
                  <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}><ServerCrash size={32} style={{ color: '#ef4444', opacity: 0.8 }} /><span style={{ color: '#ef4444', fontSize: '14px' }}>Cannot connect to host server.</span></div></td></tr>
                ) : tools.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>No tools registered in database.</td></tr>
                ) : (
                  tools.map((tool) => (
                    <tr key={tool.id} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '20px 32px', color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{tool.name}{tool.description && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{tool.description}</div>}</td>
                      <td style={{ padding: '20px 32px', color: '#94a3b8', fontSize: '13px', fontFamily: 'monospace' }}>{tool.tool_class}</td>
                      <td style={{ padding: '20px 32px' }}>{getStatusBadge(tool.status)}</td>
                      <td style={{ padding: '20px 32px', textAlign: 'right' }}><button onClick={() => handleDeleteTool(tool.id)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} title="Delete"><Trash2 size={16} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ToolManagement;
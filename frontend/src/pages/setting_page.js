import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Cpu, Bell, ShieldCheck, Camera, Save, Mail, Smartphone, Briefcase, Sliders, Monitor, Volume2, DatabaseBackup, Clock, ChevronDown, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' }); 

  // Expanded State with new settings
  const [formData, setFormData] = useState({
    // Profile
    fullName: '',
    email: '',
    avatarUrl: '',
    jobTitle: 'Safety Inspector', // New
    // Security
    newPassword: '',
    confirmPassword: '',
    sessionTimeout: '30', // New
    // Hardware
    autoConnect: true,
    confidenceThreshold: 75, // New (YOLO AI Confidence)
    streamResolution: '720p', // New
    // Preferences
    notifications: true,
    audioAlerts: true, // New
    dataRetention: '90' // New
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        
        // 1. Fetch Profile Data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('id', session.user.id)
          .single();

        setFormData(prev => ({
          ...prev,
          fullName: profileData?.display_name || '',
          avatarUrl: profileData?.avatar_url || '',
          email: session.user.email || ''
        }));

        // 2. Fetch Hardware Settings from FastAPI
        try {
          const res = await fetch(`${API_BASE_URL}/api/settings`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const settings = await res.json();
            setFormData(prev => ({
              ...prev,
              autoConnect: settings.auto_connect ?? true,
              notifications: settings.notifications ?? true,
              confidenceThreshold: settings.confidence_threshold ?? 75,
              streamResolution: settings.stream_resolution ?? '720p',
              audioAlerts: settings.audio_alerts ?? true,
              sessionTimeout: settings.session_timeout ?? '30',
              dataRetention: settings.data_retention ?? '90',
              jobTitle: settings.job_title ?? 'Safety Inspector'
            }));
          }
        } catch (error) {
          console.error("Failed to load hardware settings:", error);
        }
      }
    };
    fetchUserData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const uploadAvatar = async (event) => {
    try {
      setIsUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('You must select an image to upload.');

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      setMessage({ text: 'Avatar uploaded! Click Save to apply.', type: 'success' });
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsUploadingAvatar(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!session) return;
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (activeTab === 'profile') {
        const { error } = await supabase.from('profiles').upsert({ 
            id: session.user.id, 
            display_name: formData.fullName,
            avatar_url: formData.avatarUrl,
            updated_at: new Date()
          });
        if (error) throw error;
      } 
      else if (activeTab === 'security' && formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) throw new Error("New passwords do not match.");
        if (formData.newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
        const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
        if (error) throw error;
        setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
      } 
      
      // Save ALL preferences to FastAPI
      const payload = { 
        auto_connect: formData.autoConnect, 
        notifications: formData.notifications,
        confidence_threshold: formData.confidenceThreshold,
        stream_resolution: formData.streamResolution,
        audio_alerts: formData.audioAlerts,
        session_timeout: formData.sessionTimeout,
        data_retention: formData.dataRetention,
        job_title: formData.jobTitle
      };
      
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to update system preferences.");
      setMessage({ text: 'Settings synchronized successfully.', type: 'success' });
      
    } catch (error) {
      setMessage({ text: error.message || "An error occurred.", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
  };

  const CustomDropdown = ({ icon: Icon, name, value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
  
    // Close dropdown if user clicks outside of it
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
  
    const selectedOption = options.find(opt => opt.value === value);
  
    return (
      <div className="input-group" ref={dropdownRef} style={{ zIndex: isOpen ? 100 : 1 }}>
        {Icon && <Icon size={18} className="input-icon" />}
        <div 
          className="custom-input" 
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none', borderColor: isOpen ? 'rgba(0, 229, 255, 0.5)' : '' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
          <ChevronDown size={16} color="#64748b" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: '0.3s' }} />
        </div>
  
        {isOpen && (
          <div className="custom-dropdown-menu animate-slide-up" style={{ animationDuration: '0.2s' }}>
            {options.map((opt) => (
              <div 
                key={opt.value}
                className={`custom-dropdown-item ${value === opt.value ? 'selected' : ''}`}
                onClick={() => {
                  // Fake a standard event object so your handleInputChange works perfectly
                  onChange({ target: { name, value: opt.value, type: 'select' } });
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '70vh', height: '70vh', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '-20%', right: '-5%', width: '60vh', height: '60vh', background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }}></div>

      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
        ::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: #00E5FF; }

        .dashboard-container { height: 100vh; width: 100%; background: transparent; color: #f8fafc; display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; }
        main { flex: 1; padding: clamp(20px, 4vw, 40px); display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; z-index: 10; }

        .settings-layout { display: grid; grid-template-columns: 280px 1fr; gap: 32px; margin-top: 20px; }
        @media (max-width: 1050px) { .settings-layout { grid-template-columns: 1fr; } }

        .widget-card { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
        .widget-card:hover { border-color: rgba(0, 229, 255, 0.2); box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 15px rgba(0, 229, 255, 0.05); }

        .nav-item { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 16px; color: #94a3b8; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; }
        .nav-item:hover { background: rgba(255,255,255,0.03); color: #f8fafc; transform: translateX(5px); }
        .nav-item.active { background: rgba(0, 229, 255, 0.1); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.2); box-shadow: inset 0 0 20px rgba(0,229,255,0.05); }

        /* Inputs */
        .input-group { position: relative; margin-bottom: 24px; }
        .input-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #64748b; pointer-events: none;}
        .custom-input, .custom-select { width: 100%; padding: 18px 20px 18px 55px; background-color: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 15px; color: #fff; outline: none; font-size: 15px; box-sizing: border-box; transition: all 0.3s; font-family: inherit; appearance: none; }
        .custom-select { cursor: pointer; }
        .custom-select option { background-color: #0f172a; color: #fff; }
        .custom-input:focus, .custom-select:focus { border-color: rgba(0, 229, 255, 0.5); box-shadow: 0 0 15px rgba(0,229,255,0.1); background-color: rgba(0,0,0,0.4); }
        .input-label { display: block; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }

        /* Range Slider */
        .range-container { margin-bottom: 24px; }
        .custom-range { -webkit-appearance: none; width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 5px; outline: none; margin-top: 10px; }
        .custom-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #00E5FF; cursor: pointer; box-shadow: 0 0 10px rgba(0,229,255,0.5); transition: 0.2s; }
        .custom-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .range-value { float: right; color: #00E5FF; font-weight: 800; font-size: 14px; }

        /* Buttons */
        .launch-btn { background: #00E5FF; color: #070b14; border: none; padding: 16px 36px; border-radius: 18px; font-size: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.3s; box-shadow: 0 10px 25px rgba(0, 229, 255, 0.3); text-transform: uppercase; letter-spacing: 1px; width: 100%; }
        .launch-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0, 229, 255, 0.4); }
        .launch-btn:disabled { background: #334155; color: #94a3b8; cursor: not-allowed; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.1); }

        /* Toggles */
        .toggle-container { display: flex; align-items: center; justify-content: space-between; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 16px; transition: 0.3s;}
        .toggle-container:hover { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.08); }
        .switch { position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: #94a3b8; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: rgba(0, 229, 255, 0.3); border: 1px solid rgba(0,229,255,0.5); }
        input:checked + .slider:before { transform: translateX(22px); background-color: #00E5FF; box-shadow: 0 0 10px #00E5FF; }

        .msg-toast { padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; font-weight: 800; font-size: 13px; text-align: center; letter-spacing: 0.5px; }
        .msg-success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .msg-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        .avatar-upload-wrapper { position: relative; width: 80px; height: 80px; border-radius: 50%; background: rgba(0,229,255,0.1); border: 2px dashed rgba(0,229,255,0.4); display: flex; align-items: center; justify-content: center; color: #00E5FF; cursor: pointer; overflow: hidden; transition: 0.3s; }
        .avatar-upload-wrapper:hover { border-color: #00E5FF; background: rgba(0,229,255,0.2); }
        .avatar-upload-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
      
        .custom-dropdown-menu { position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 8px; z-index: 50; box-shadow: 0 15px 40px rgba(0,0,0,0.6); }
        .custom-dropdown-item { padding: 12px 16px; border-radius: 10px; cursor: pointer; color: #94a3b8; font-size: 14px; font-weight: 600; transition: all 0.2s ease; }
        .custom-dropdown-item:hover { background: rgba(255, 255, 255, 0.05); color: #f8fafc; transform: translateX(4px); }
        .custom-dropdown-item.selected { background: rgba(0, 229, 255, 0.15); color: #00E5FF; border: 1px solid rgba(0, 229, 255, 0.3); }

      `}</style>

      <main>
        <header className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: '900', letterSpacing: '-1.5px' }}>System <span style={{ color: '#00E5FF' }}>Settings</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: '#94a3b8' }}>
              <Settings size={16} color="#10b981" />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Manage preferences and hardware configuration</span>
            </div>
          </div>
        </header>

        <div className="settings-layout">
          {/* LEFT SIDEBAR NAVIGATION */}
          <div className="widget-card animate-slide-up" style={{ animationDelay: '0.1s', height: 'fit-content', padding: '24px' }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}></div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><User size={18} /> Account Profile</div>
              <div className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}><Lock size={18} /> Security & Access</div>
              <div className={`nav-item ${activeTab === 'hardware' ? 'active' : ''}`} onClick={() => setActiveTab('hardware')}><Cpu size={18} /> Hardware Integration</div>
              <div className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}><Bell size={18} /> System Preferences</div>
            </div>
          </div>

          {/* RIGHT CONTENT AREA */}
          <div className="widget-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}></div>

            {message.text && (
               <div className={`msg-toast ${message.type === 'success' ? 'msg-success' : 'msg-error'} animate-slide-up`}>
                 {message.text}
               </div>
            )}

            <form onSubmit={handleSave}>
              
              {/* --- PROFILE TAB --- */}
              {activeTab === 'profile' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>Profile Configuration</h2>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px' }}>
                    <div style={{ position: 'relative' }}>
                      <label className="avatar-upload-wrapper" htmlFor="avatar-upload">
                        {isUploadingAvatar ? (
                           <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid #00E5FF', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : formData.avatarUrl ? (
                           <img src={formData.avatarUrl} alt="Avatar" />
                        ) : (
                           <Camera size={32} />
                        )}
                      </label>
                      <input type="file" id="avatar-upload" accept="image/*" onChange={uploadAvatar} disabled={isUploadingAvatar} style={{ display: 'none' }} />
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', marginBottom: '6px' }}>Upload New Avatar</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Click the circle to browse (JPG or PNG)</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label className="input-label">Display Name</label>
                      <div className="input-group">
                        <User size={18} className="input-icon" />
                        <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="custom-input" placeholder="Enter your full name" required/>
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Job Title / Role</label>
                      <div className="input-group">
                        <Briefcase size={18} className="input-icon" />
                        <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} className="custom-input" placeholder="e.g. Safety Manager" />
                      </div>
                    </div>
                  </div>

                  <label className="input-label">Email Address (Bound to System)</label>
                  <div className="input-group">
                    <Mail size={18} className="input-icon" />
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="custom-input" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  </div>
                </div>
              )}

              {/* --- SECURITY TAB --- */}
              {activeTab === 'security' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>Security & Access</h2>
                  
                  <label className="input-label">Change Password</label>
                  <div className="input-group">
                    <Lock size={18} className="input-icon" />
                    <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} className="custom-input" placeholder="Create your new password ( min. 6 characters required )"/>
                  </div>
                  <div className="input-group">
                    <ShieldCheck size={18} className="input-icon" />
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="custom-input" placeholder="Confirm your new password"/>
                  </div>

                  <div style={{ marginTop: '40px' }}>
                    <label className="input-label">Auto-Lock Session Timeout</label>
                    <div className="input-group">
                      <Clock size={18} className="input-icon" />
                      <CustomDropdown 
                        icon={Clock}
                        name="sessionTimeout"
                        value={formData.sessionTimeout}
                        onChange={handleInputChange}
                        options={[
                          { value: '15', label: '15 Minutes' },
                          { value: '30', label: '30 Minutes (Recommended)' },
                          { value: '60', label: '1 Hour' },
                          { value: 'never', label: 'Never Timeout' }
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- HARDWARE TAB --- */}
              {activeTab === 'hardware' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>Edge Hardware Integration</h2>
                  
                  <div className="toggle-container">
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Smartphone size={16} color="#00E5FF"/> Auto-Connect on Proximity</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Automatically link smart glasses when WebSocket is available.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" name="autoConnect" checked={formData.autoConnect} onChange={handleInputChange} />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="range-container" style={{ marginTop: '30px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#fff' }}>
                      <Sliders size={16} color="#a855f7" /> YOLO Detection Confidence 
                      <span className="range-value">{formData.confidenceThreshold}%</span>
                    </label>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginBottom: '16px' }}>Minimum AI certainty required before triggering a hazard alert.</div>
                    <input type="range" name="confidenceThreshold" min="10" max="95" step="5" value={formData.confidenceThreshold} onChange={handleInputChange} className="custom-range" />
                  </div>

                  <div style={{ marginTop: '30px' }}>
                    <label className="input-label">Camera Stream Resolution</label>
                    <div className="input-group">
                      <Monitor size={18} className="input-icon" />
                      <CustomDropdown 
                        icon={Monitor}
                        name="streamResolution"
                        value={formData.streamResolution}
                        onChange={handleInputChange}
                        options={[
                          { value: '480p', label: '480p (Battery Saver)' },
                          { value: '720p', label: '720p (Balanced)' },
                          { value: '1080p', label: '1080p (High Quality)' }
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* --- PREFERENCES TAB --- */}
              {activeTab === 'preferences' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>System Preferences</h2>
                  
                  <div className="toggle-container">
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Bell size={16} color="#10b981"/> Dashboard Popups</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Show visual toast notifications when modules trigger.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" name="notifications" checked={formData.notifications} onChange={handleInputChange} />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="toggle-container">
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Volume2 size={16} color="#f59e0b"/> Audio Alerts</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Play a warning chime when a CRITICAL hazard is detected.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" name="audioAlerts" checked={formData.audioAlerts} onChange={handleInputChange} />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ marginTop: '30px' }}>
                    <label className="input-label">Hazard Log Retention Policy</label>
                    <div className="input-group">
                      <DatabaseBackup size={18} className="input-icon" />
                      <CustomDropdown 
                        icon={DatabaseBackup}
                        name="dataRetention"
                        value={formData.dataRetention}
                        onChange={handleInputChange}
                        options={[
                          { value: '30', label: 'Delete after 30 Days' },
                          { value: '90', label: 'Delete after 90 Days' },
                          { value: '365', label: 'Delete after 1 Year' },
                          { value: 'forever', label: 'Keep Forever' }
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SAVE BUTTON */}
              <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '250px' }}>
                  <button type="submit" className="launch-btn" disabled={isLoading || isUploadingAvatar}>
                    <Save size={18} /> {isLoading ? 'SYNCING...' : 'SAVE CHANGES'}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      </main>
    </div>
  );
}

export default SettingsPage;
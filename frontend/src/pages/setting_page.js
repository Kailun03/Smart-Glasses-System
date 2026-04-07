import React, { useState, useEffect } from 'react';
import { User, Lock, Cpu, Bell, ShieldCheck, Camera, Save, LogOut, Mail, Smartphone, Activity } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config';

function SettingsPage({ onLogout }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' }); 

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    avatarUrl: '',
    newPassword: '',
    confirmPassword: '',
    autoConnect: true,
    notifications: true
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        
        // 1. Fetch Profile Data from the 'profiles' table
        const { data: profileData, error: profileError } = await supabase
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
              autoConnect: settings.auto_connect,
              notifications: settings.notifications
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

  // --- AVATAR UPLOAD LOGIC ---
  const uploadAvatar = async (event) => {
    try {
      setIsUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage bucket named 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

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
      // 1. Save Profile Data to the 'profiles' table
      if (activeTab === 'profile') {
        const { error } = await supabase
          .from('profiles')
          .upsert({ 
            id: session.user.id, 
            display_name: formData.fullName,
            avatar_url: formData.avatarUrl,
            updated_at: new Date()
          });
          
        if (error) throw error;
        setMessage({ text: 'Profile updated successfully.', type: 'success' });
      } 
      
      // 2. Change Password
      else if (activeTab === 'security') {
        if (formData.newPassword !== formData.confirmPassword) {
            throw new Error("New passwords do not match.");
        }
        if (formData.newPassword.length < 6) {
            throw new Error("Password must be at least 6 characters.");
        }
        const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
        if (error) throw error;
        setFormData(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
        setMessage({ text: 'Password updated successfully.', type: 'success' });
      } 
      
      // 3. Save Hardware Settings to FastAPI
      else if (activeTab === 'hardware' || activeTab === 'preferences') {
        const payload = { auto_connect: formData.autoConnect, notifications: formData.notifications };
        const res = await fetch(`${API_BASE_URL}/api/settings`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Failed to update system preferences.");
        setMessage({ text: 'System preferences saved.', type: 'success' });
      }
    } catch (error) {
      setMessage({ text: error.message || "An error occurred.", type: 'error' });
    } finally {
      setIsLoading(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }
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

        .input-group { position: relative; margin-bottom: 24px; }
        .input-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #64748b; }
        .custom-input { width: 100%; padding: 18px 20px 18px 55px; background-color: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 15px; color: #fff; outline: none; font-size: 15px; box-sizing: border-box; transition: all 0.3s; }
        .custom-input:focus { border-color: rgba(0, 229, 255, 0.5); box-shadow: 0 0 15px rgba(0,229,255,0.1); background-color: rgba(0,0,0,0.4); }
        .input-label { display: block; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }

        .launch-btn { background: #00E5FF; color: #070b14; border: none; padding: 16px 36px; border-radius: 18px; font-size: 14px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; transition: all 0.3s; box-shadow: 0 10px 25px rgba(0, 229, 255, 0.3); text-transform: uppercase; letter-spacing: 1px; width: 100%; }
        .launch-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0, 229, 255, 0.4); }
        .launch-btn:disabled { background: #334155; color: #94a3b8; cursor: not-allowed; box-shadow: none; border: 1px solid rgba(255, 255, 255, 0.1); }

        .btn-secondary { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 16px 24px; border-radius: 16px; font-weight: 800; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 10px; width: 100%; justify-content: center; }
        .btn-secondary:hover { background: rgba(239, 68, 68, 0.2); transform: translateY(-2px); }

        .toggle-container { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(0,0,0,0.2); border-radius: 16px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 16px; }
        .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: #94a3b8; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: rgba(0, 229, 255, 0.3); border: 1px solid rgba(0,229,255,0.5); }
        input:checked + .slider:before { transform: translateX(22px); background-color: #00E5FF; box-shadow: 0 0 10px #00E5FF; }

        .msg-toast { padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; font-weight: 800; font-size: 13px; text-align: center; letter-spacing: 0.5px; }
        .msg-success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .msg-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        .avatar-upload-wrapper {
          position: relative; width: 80px; height: 80px; border-radius: 50%; 
          background: rgba(0,229,255,0.1); border: 2px dashed rgba(0,229,255,0.4); 
          display: flex; align-items: center; justify-content: center; color: #00E5FF;
          cursor: pointer; overflow: hidden; transition: 0.3s;
        }
        .avatar-upload-wrapper:hover { border-color: #00E5FF; background: rgba(0,229,255,0.2); }
        .avatar-upload-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
      `}</style>

      <main>
        <header className="animate-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: '900', letterSpacing: '-1.5px' }}>System <span style={{ color: '#00E5FF' }}>Settings</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: '#94a3b8' }}>
              <ShieldCheck size={16} color="#10b981" />
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
              <div className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}><Lock size={18} /> Security & Passwords</div>
              <div className={`nav-item ${activeTab === 'hardware' ? 'active' : ''}`} onClick={() => setActiveTab('hardware')}><Cpu size={18} /> Hardware Integration</div>
              <div className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}><Bell size={18} /> System Preferences</div>
            </div>

            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button type="button" className="btn-secondary" onClick={onLogout}>
                <LogOut size={18} /> Disconnect Session
              </button>
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
              {/* PROFILE TAB */}
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
                      <input 
                        type="file" 
                        id="avatar-upload" 
                        accept="image/*" 
                        onChange={uploadAvatar} 
                        disabled={isUploadingAvatar}
                        style={{ display: 'none' }} 
                      />
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', marginBottom: '6px' }}>Upload New Avatar</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>Click the circle to browse (JPG or PNG)</div>
                    </div>
                  </div>

                  <label className="input-label">Display Name</label>
                  <div className="input-group">
                    <User size={18} className="input-icon" />
                    <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="custom-input" placeholder="Enter your full name" required/>
                  </div>
                  <label className="input-label">Email Address (Bound to System)</label>
                  <div className="input-group">
                    <Mail size={18} className="input-icon" />
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="custom-input" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                  </div>
                </div>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>Security & Authentication</h2>
                  <label className="input-label">New Password</label>
                  <div className="input-group">
                    <Lock size={18} className="input-icon" />
                    <input type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} className="custom-input" placeholder="Create new password" required/>
                  </div>
                  <label className="input-label">Confirm New Password</label>
                  <div className="input-group">
                    <ShieldCheck size={18} className="input-icon" />
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="custom-input" placeholder="Confirm new password" required/>
                  </div>
                </div>
              )}

              {/* HARDWARE TAB */}
              {activeTab === 'hardware' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>Edge Hardware Integration</h2>
                  <div className="toggle-container">
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Smartphone size={16} color="#00E5FF"/> Auto-Connect on Proximity</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Automatically link glasses when WebSocket is available.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" name="autoConnect" checked={formData.autoConnect} onChange={handleInputChange} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              )}

              {/* PREFERENCES TAB */}
              {activeTab === 'preferences' && (
                <div className="animate-slide-up">
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>System Preferences</h2>
                  <div className="toggle-container">
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}><Bell size={16} color="#10b981"/> Dashboard Notifications</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Show popups when new modules are activated.</div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" name="notifications" checked={formData.notifications} onChange={handleInputChange} />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              )}

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
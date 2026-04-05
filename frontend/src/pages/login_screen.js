import React, { useState, useEffect } from 'react';
import { Lock, Mail, UserPlus, LogIn, User, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function LoginScreen({ onSessionComplete }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isLaunched, setIsLaunched] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => setIsLaunched(true), 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const isLandscape = windowWidth > 1000;

  // Unified function to handle the cinematic transition
  const triggerCinematicExit = (session) => {
    const name = session.user.user_metadata?.display_name || 'User';
    setFullName(name);
    setIsExiting(true); 
    
    // 3-second delay to show the "Welcome" screen before moving to Dashboard
    setTimeout(() => {
      onSessionComplete(session);
    }, 3000); 
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isSignUp) {
      // 1. REGISTRATION
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: fullName } }
      });

      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
      } else if (data.session) {
        // Since Email Verify is OFF, we get a session immediately!
        triggerCinematicExit(data.session);
      } else {
        // Fallback in case Supabase settings weren't saved correctly
        setSuccessMsg('Account created! Please check your email to verify.');
        setIsLoading(false);
      }
    } else {
      // 2. LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
      } else if (data.session) {
        triggerCinematicExit(data.session);
      }
    }
  };

  return (
    <div style={{ 
      height: '100vh', width: '100vw', backgroundColor: '#0b1121', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      overflow: 'hidden', position: 'relative', fontFamily: "'Inter', sans-serif"
    }}>
      
      {/* Background Ambience */}
      <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '70vh', height: '70vh', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '-20%', right: '-5%', width: '60vh', height: '60vh', background: 'radial-gradient(circle, rgba(0,229,255,0.08) 0%, rgba(11,17,33,0) 70%)', borderRadius: '50%', zIndex: 0 }}></div>

      <div style={{ 
        display: 'flex', flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        width: '100%', maxWidth: '1200px', 
        padding: '20px', zIndex: 10
      }}>
        
        {/* LEFT SECTION: 3D MODEL & WELCOME TEXT */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center',
          transform: isExiting ? (isLandscape ? 'translateX(50%)' : 'translateY(20%)') : 'translateX(0)',
          transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
          position: 'relative'
        }}>
          
          {/* Default Branding */}
          <div style={{ 
            textAlign: 'center', marginBottom: '20px',
            opacity: isExiting ? 0 : 1, transition: 'opacity 0.4s ease',
            position: isExiting ? 'absolute' : 'relative',
            pointerEvents: isExiting ? 'none' : 'auto'
          }}>
            <h1 style={{ color: '#f8fafc', fontSize: isLandscape ? '4rem' : '3rem', fontWeight: '900', margin: 0, letterSpacing: '-2px' }}>
              AURA <span style={{ color: '#00E5FF' }}>Vision</span>
            </h1>
            <p style={{ color: '#94a3b8', margin: '10px 0 0 0', fontSize: '1rem', letterSpacing: '5px', textTransform: 'uppercase' }}>
              Hardware Integration
            </p>
          </div>

          {/* 3D Glasses Model */}
          <div style={{ 
              width: isLandscape ? '500px' : '100%', 
              height: isLandscape ? '400px' : '30vh', 
              opacity: isLaunched ? 1 : 0, 
              transform: isExiting ? 'scale(1.4)' : (isLaunched ? 'translateY(0)' : 'translateY(-100vh)'),
              transition: 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s ease', 
          }}>
            <model-viewer
              src="/smart_glasses.glb" auto-rotate rotation-per-second="25deg"
              camera-controls="false" disable-zoom environment-image="neutral"
              exposure="1.2" shadow-intensity="1.5"
              style={{ width: '100%', height: '100%', outline: 'none' }}
            ></model-viewer>
          </div>

          {/* Welcome Text */}
          <div style={{
            opacity: isExiting ? 1 : 0,
            transform: isExiting ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1) 0.4s',
            textAlign: 'center',
            marginTop: '40px',
            position: 'absolute',
            bottom: isLandscape ? '-120px' : '-80px',
            width: '100%'
          }}>
            <h2 style={{ color: '#00E5FF', fontSize: '2rem', fontWeight: '300', margin: 0, letterSpacing: '2px' }}>Welcome,</h2>
            <h1 style={{ color: '#fff', fontSize: '4.5rem', fontWeight: '900', margin: 0, textShadow: '0 0 30px rgba(0,229,255,0.4)' }}>
              {fullName}!
            </h1>
          </div>
        </div>

        {/* RIGHT SECTION: FORM */}
        <div style={{ 
          width: '100%', maxWidth: '440px', marginLeft: isLandscape ? '60px' : '0',
          transform: isExiting ? 'translateX(150vw)' : 'translateX(0)',
          opacity: isExiting ? 0 : 1,
          transition: 'all 0.8s cubic-bezier(0.5, 0, 0.2, 1)',
          pointerEvents: isExiting ? 'none' : 'auto'
        }}>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '30px', padding: '40px', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.6)' }}>
            
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '6px', marginBottom: '30px' }}>
              <button onClick={() => {setIsSignUp(false); setErrorMsg(''); setSuccessMsg('');}} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: !isSignUp ? '#00E5FF' : 'transparent', color: !isSignUp ? '#070b14' : '#94a3b8', border: 'none', fontSize: '13px', fontWeight: '900', cursor: 'pointer', transition: '0.3s' }}>LOGIN</button>
              <button onClick={() => {setIsSignUp(true); setErrorMsg(''); setSuccessMsg('');}} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: isSignUp ? '#00E5FF' : 'transparent', color: isSignUp ? '#070b14' : '#94a3b8', border: 'none', fontSize: '13px', fontWeight: '900', cursor: 'pointer', transition: '0.3s' }}>REGISTER</button>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isSignUp && (
                <div style={{ position: 'relative', animation: 'fadeIn 0.3s ease' }}>
                  <User color="#64748b" size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" placeholder="Your Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: '18px 20px 18px 55px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', color: '#fff', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
                </div>
              )}
              
              <div style={{ position: 'relative' }}>
                <Mail color="#64748b" size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '18px 20px 18px 55px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', color: '#fff', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock color="#64748b" size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '18px 20px 18px 55px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '18px', color: '#fff', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }} />
              </div>

              {errorMsg && <div style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', padding: '12px', borderRadius: '12px', fontSize: '13px', textAlign: 'center', border: '1px solid rgba(255, 77, 77, 0.2)' }}>{errorMsg}</div>}

              <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '20px', backgroundColor: '#00E5FF', color: '#070b14', border: 'none', borderRadius: '18px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 15px 30px -10px rgba(0,229,255,0.4)', marginTop: '5px' }}>
                {isLoading ? 'SYNCING...' : (isSignUp ? 'CREATE ACCOUNT' : 'INITIALIZE SYSTEM')}
                {!isLoading && (isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />)}
              </button>
            </form>

            <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '12px', fontWeight: '700', opacity: 0.8 }}>
              <ShieldCheck size={16} /> ENCRYPTED CONNECTION
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
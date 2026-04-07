import React, { useState, useEffect } from 'react';
import { Lock, Mail, User, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function LoginScreen({ onSessionComplete }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); 
  const [avatarUrl, setAvatarUrl] = useState(null); // NEW: Avatar State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isLaunched, setIsLaunched] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
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

  // NEW: Made this function async to fetch data before animating
  const triggerCinematicExit = async (session) => {
    // 1. Fetch profile data from the database
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', session.user.id)
      .single();

    // 2. Apply DB data, fallback to auth metadata, or fallback to typed name
    const name = data?.display_name || session.user?.user_metadata?.display_name || fullName || 'User';
    setFullName(name);
    
    if (data?.avatar_url) {
      setAvatarUrl(data.avatar_url);
    }
    
    // Phase 1: Center the model & text, hide the form
    setIsExiting(true); 
    
    // Phase 2: Fly up after 1.8 seconds of displaying the welcome message
    setTimeout(() => {
      setIsFinalizing(true);
    }, 1800); 

    // Phase 3: Actually transition to the next screen after the fly up finishes
    setTimeout(() => {
      onSessionComplete(session);
    }, 2200); 
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: fullName } }
      });

      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
      } else if (data.session) {
        triggerCinematicExit(data.session);
      } else {
        setSuccessMsg('Account created! Please verify.');
        setIsLoading(false);
      }
    } else {
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

      {/* CENTRAL STAGE CONTAINER */}
      <div style={{ 
        display: 'flex', flexDirection: isLandscape ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        width: '100%', maxWidth: '1400px', 
        gap: isLandscape ? '40px' : '15px', 
        padding: isLandscape ? '20px' : '15px', 
        zIndex: 10,
        height: '100vh' 
      }}>
        
        {/* =========================================
            LEFT SECTION: 3D MODEL & WELCOME TEXT 
            ========================================= */}
        <div style={{ 
          flex: isLandscape ? 0.75 : 'none',
          display: 'flex', flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          
          // TWO-PHASE ANIMATION LOGIC:
          transform: isFinalizing 
            ? (isLandscape ? 'translateX(35%) translateY(-100vh)' : 'translateY(-100vh)') // Fly up!
            : (isExiting 
                ? (isLandscape ? 'translateX(35%)' : 'translateY(15%)') // Move to center
                : 'translateX(0)'), // Initial state
          opacity: isFinalizing ? 0 : 1, // Fade out while flying up
          transition: isFinalizing 
            ? 'transform 0.8s cubic-bezier(0.5, 0, 0.2, 1), opacity 0.6s ease' 
            : 'transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
          position: 'relative'
        }}>
          
          {/* Default Branding */}
          <div style={{ 
            opacity: isExiting ? 0 : 1, transition: 'opacity 0.4s ease',
            position: isExiting ? 'absolute' : 'relative', 
            pointerEvents: isExiting ? 'none' : 'auto',
            marginBottom: isLandscape ? '0px' : '5px' 
          }}>
            <h1 style={{ 
              color: '#f8fafc', fontSize: isLandscape ? '5rem' : '3.5rem', 
              fontWeight: '900', margin: 0, letterSpacing: '-2px', 
              lineHeight: 0.9, textShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              AURA <span style={{ color: '#00E5FF', textShadow: '0 0 40px rgba(0,229,255,0.4)' }}>Vision</span>
            </h1>
            <p style={{ 
              color: '#94a3b8', margin: isLandscape ? '20px 0 0 0' : '8px 0 0 0', 
              fontSize: isLandscape ? '1.2rem' : '1rem', 
              letterSpacing: isLandscape ? '6px' : '3px', 
              textTransform: 'uppercase', fontWeight: '600',
              paddingTop: isLandscape ? '8px' : '12px'
            }}>
              Augmented User Reality Assistant
            </p>
          </div>

          {/* 3D Glasses Model */}
          <div style={{ 
              width: isLandscape ? '350px' : '100%', 
              height: isLandscape ? '350px' : '250px', 
              minHeight: isLandscape ? 'auto' : '150px',
              opacity: isLaunched ? 1 : 0, 
              // Model scales up locally within its container
              transform: isExiting ? 'scale(1.4)' : (isLaunched ? 'translateY(0)' : 'translateY(-100vh)'),
              transition: 'transform 1.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease', 
          }}>
            <model-viewer
              src="/smart_glasses.glb" auto-rotate rotation-per-second="20deg"
              camera-controls="false" disable-zoom environment-image="neutral"
              exposure="1.2" shadow-intensity="1.5" interaction-prompt="none"
              style={{ width: '100%', height: '100%', outline: 'none' }}
            ></model-viewer>
          </div>

          {/* ANIMATION: Welcome Text with Avatar */}
          <div style={{
            opacity: isExiting ? 1 : 0,
            transform: isExiting 
              ? (isLandscape ? 'translateY(110px)' : 'translateY(0)')
              : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1) 0.4s', 
            textAlign: 'center',
            position: 'absolute',
            bottom: isLandscape ? '-50px' : '-100px', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            zIndex: 20,
          }}>
            {/* Display the avatar */}
            <img 
              src={avatarUrl || '/default_avatar.png'} 
              alt="User Avatar" 
              style={{
                width: isLandscape ? '70px' : '60px', 
                height: isLandscape ? '70px' : '60px',
                borderRadius: '50%',
                border: '3px solid #00E5FF',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.4)',
                objectFit: 'cover'
              }} 
            />
            <div style={{ marginTop: '0px' }}>
              <h2 style={{ 
                color: '#00E5FF', 
                fontSize: isLandscape ? '1.8rem' : '1.3rem', 
                fontWeight: '300', 
                margin: 0, 
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}>
                Welcome,
              </h2>
              <h1 style={{ 
                color: '#fff', 
                fontSize: isLandscape ? '4rem' : '2.5rem', 
                fontWeight: '900', 
                margin: 0, 
                textShadow: '0 0 30px rgba(0,229,255,0.4)',
                lineHeight: 1.1,
                marginTop: '10px'
              }}>
                {fullName}!
              </h1>
            </div>
          </div>
        </div>

        {/* =========================================
            RIGHT SECTION: LOGIN / REGISTER FORM
            ========================================= */}
        <div style={{ 
          width: '100%', maxWidth: isLandscape ? '480px' : '400px', 
          transform: isExiting ? 'translateX(150vw)' : 'translateX(0)',
          opacity: isExiting ? 0 : 1,
          transition: 'all 0.8s cubic-bezier(0.5, 0, 0.2, 1)',
          pointerEvents: isExiting ? 'none' : 'auto'
        }}>
          <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.5)', 
              backdropFilter: 'blur(30px)', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              borderRadius: isLandscape ? '35px' : '25px', 
              padding: isLandscape ? '48px' : '24px 20px',
              boxShadow: '0 50px 100px -20px rgba(0,0,0,0.6)',
              position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent)' }}></div>

            <div style={{ 
              display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '25px', 
              padding: '6px', marginBottom: isLandscape ? '30px' : '15px', position: 'relative', userSelect: 'none'
            }}>
              <div style={{
                position: 'absolute', top: '6px', left: '6px', width: 'calc(50% - 6px)', height: 'calc(100% - 12px)', 
                backgroundColor: '#00E5FF', borderRadius: '20px', transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isSignUp ? 'translateX(100%)' : 'translateX(0%)', zIndex: 1
              }} />

              <button 
                onClick={() => {setIsSignUp(false); setErrorMsg(''); setSuccessMsg('');}} 
                style={{ flex: 1, padding: isLandscape ? '14px' : '10px', borderRadius: '20px', backgroundColor: 'transparent', color: !isSignUp ? '#070b14' : '#94a3b8', border: 'none', fontSize: '13px', fontWeight: '900', cursor: 'pointer', transition: 'color 0.3s', zIndex: 2, position: 'relative' }}
              >LOGIN</button>
              <button 
                onClick={() => {setIsSignUp(true); setErrorMsg(''); setSuccessMsg('');}} 
                style={{ flex: 1, padding: isLandscape ? '14px' : '10px', borderRadius: '20px', backgroundColor: 'transparent', color: isSignUp ? '#070b14' : '#94a3b8', border: 'none', fontSize: '13px', fontWeight: '900', cursor: 'pointer', transition: 'color 0.3s', zIndex: 2, position: 'relative' }}
              >REGISTER</button>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: isLandscape ? '25px' : '12px' }}>
              {isSignUp && (
                <div style={{ position: 'relative', animation: 'fadeIn 0.3s ease' }}>
                  <User color="#64748b" size={isLandscape ? 20 : 16} style={{ position: 'absolute', left: isLandscape ? '22px' : '16px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required 
                    style={{ width: '100%', padding: isLandscape ? '20px 20px 20px 60px' : '14px 14px 14px 45px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: isLandscape ? '16px' : '14px', boxSizing: 'border-box' }} />
                </div>
              )}
              
              <div style={{ position: 'relative' }}>
                <Mail color="#64748b" size={isLandscape ? 20 : 16} style={{ position: 'absolute', left: isLandscape ? '22px' : '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required 
                  style={{ width: '100%', padding: isLandscape ? '20px 20px 20px 60px' : '14px 14px 14px 45px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: isLandscape ? '16px' : '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock color="#64748b" size={isLandscape ? 20 : 16} style={{ position: 'absolute', left: isLandscape ? '22px' : '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required 
                  style={{ width: '100%', padding: isLandscape ? '20px 20px 20px 60px' : '14px 14px 14px 45px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '15px', color: '#fff', outline: 'none', fontSize: isLandscape ? '16px' : '14px', boxSizing: 'border-box' }} />
              </div>

              {errorMsg && <p style={{ color: '#ff6b6b', fontSize: '13px', textAlign: 'center', fontWeight: '500', margin: 0 }}>{errorMsg}</p>}

              <button type="submit" disabled={isLoading} style={{ 
                width: '100%', padding: isLandscape ? '16px' : '14px', backgroundColor: '#00E5FF', color: '#070b14', border: 'none', borderRadius: '30px', 
                fontSize: '14px', fontWeight: '900', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', 
                gap: '12px', boxShadow: '0 20px 40px -10px rgba(0,229,255,0.4)', transition: '0.2s', letterSpacing: '1px', marginTop: '5px'
              }}>
                {isLoading ? (isSignUp ? 'CREATING...' : 'SYNCING...') : (isSignUp ? 'REGISTER ACCOUNT' : 'INITIALIZE SYSTEM')}
              </button>
            </form>

            <div style={{ marginTop: isLandscape ? '30px' : '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '11px', fontWeight: '700', opacity: 0.8 }}>
              <ShieldCheck size={16} /> ENCRYPTION APPLIED
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
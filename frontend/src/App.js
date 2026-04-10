import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from './supabaseClient';

import VisionDashboard from './pages/vision_dashboard';
import MainDashboard from './pages/main_dashboard';
import ToolManagement from './pages/tool_management';
import AnalyticDashboard from './pages/analytic_dashboard';
import SettingsPage from './pages/setting_page';
import LoginScreen from './pages/login_screen';
import Sidebar from './components/Sidebar';

function App() {
  const [, setSession] = useState(null);
  
  // Cleaned up UI State Machine: 'checking' -> 'login' -> 'dashboard'
  const [appPhase, setAppPhase] = useState('checking'); 

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    let timeoutId;
    
    const resetTimer = () => {
      clearTimeout(timeoutId);
      // Fetch the user's timeout setting from localStorage or Context
      const timeoutMinutes = parseInt(localStorage.getItem('sessionTimeout') || '30');
      
      if (timeoutMinutes && timeoutMinutes !== 'never') {
        timeoutId = setTimeout(async () => {
          alert("Session expired due to inactivity.");
          await supabase.auth.signOut();
          window.location.href = "/login"; // Redirect to login
        }, timeoutMinutes * 60 * 1000); // Convert minutes to milliseconds
      }
    };
  
    // Listen for activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer(); // Start the timer
  
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      clearTimeout(timeoutId);
    };
  }, []);
  
  useEffect(() => {
    // Initial Auth Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Skip animations if already logged in (e.g., on page refresh)
      setAppPhase(session ? 'dashboard' : 'login');
    });

    // Listen for Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      // If user logs out, instantly go back to login screen
      if (event === 'SIGNED_OUT') {
        setAppPhase('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getInitialPage = () => {
    const hashMatch = window.location.hash.match(/#([^#]+)$/);
    const page = hashMatch ? hashMatch[1] : 'home';
    
    if (window.location.pathname !== '/' || window.location.hash !== `#${page}`) {
      window.history.replaceState(null, '', `/#${page}`);
    }
    return page;
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage());

  const handleNavigation = (targetPage, message) => {
    setLoadingMessage(message);
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentPage(targetPage);
      window.location.hash = targetPage; 
      setIsTransitioning(false);
    }, 800); 
  };

  const handleLogout = async () => {
    setLoadingMessage('Securing session and logging out...');
    setIsTransitioning(true);
  
    await new Promise(resolve => setTimeout(resolve, 1000));
    await supabase.auth.signOut(); 

    setIsTransitioning(false);
  };
  
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentPage(hash || 'home');
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);


  // PHASE 1: INITIAL CHECK
  if (appPhase === 'checking') {
    return <div style={{ height: '100vh', backgroundColor: '#0b1121' }}></div>;
  }

  // PHASE 2: LOGIN & CINEMATIC WELCOME
  if (appPhase === 'login') {
    return (
      <LoginScreen onSessionComplete={(newSession) => {
        setSession(newSession);
        // Transition directly to the dashboard now
        setAppPhase('dashboard');
      }} />
    );
  }

  // PHASE 3: MAIN DASHBOARD
  const isVisionMode = currentPage === 'vision';

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#0f172a', position: 'relative', display: 'flex', height: '100vh', width: '100vw' }}>
      
      {/* GLOBAL LOADING TOAST (For sidebar navigation) */}
      {isTransitioning && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid #334155', padding: '14px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
          <style>{` 
            @keyframes spin { 100% { transform: rotate(360deg); } } 
            @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } 
          `}</style>
          <Loader2 size={18} color="#00E5FF" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px' }}>{loadingMessage}</span>
        </div>
      )}

      {!isVisionMode && (
        <Sidebar 
          currentPage={currentPage}
          onNavigateHome={() => handleNavigation('home', 'Returning to Control Center...')}
          onNavigateTools={() => handleNavigation('tools', 'Accessing Tool Repository...')}
          onNavigateAnalytics={() => handleNavigation('analytics', 'Generating Safety Reports...')}
          onNavigateSettings={() => handleNavigation('settings', 'Opening System Settings...')}
          onLogout={handleLogout}
        />
      )}

      <div style={{  flex: 1,  paddingLeft: isVisionMode ? '0px' : '56px',  boxSizing: 'border-box',  height: '100vh', position: 'relative'  }}>
        {currentPage === 'home' && (
          <MainDashboard onNavigateVision={() => handleNavigation('vision', 'Initializing Vision Engine...')} />
        )}
        
        {currentPage === 'vision' && (
          <VisionDashboard onNavigate={() => handleNavigation('home', 'Closing Console...')} />
        )}

        {currentPage === 'tools' && (
          <ToolManagement />
        )}

        {currentPage === 'analytics' && (
          <AnalyticDashboard />
        )}

        {currentPage === 'settings' && (
          <SettingsPage />
        )}

      </div>
    </div>
  );
}

export default App;
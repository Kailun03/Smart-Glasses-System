import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import VisionDashboard from './pages/vision_dashboard';
import MainDashboard from './pages/main_dashboard';
import ToolManagement from './pages/tool_management';
import Sidebar from './components/Sidebar';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleNavigation = (targetPage, message) => {
    setLoadingMessage(message);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(targetPage);
      setIsTransitioning(false);
    }, 800); 
  };

  // to differentiate the vision dashboard for content side bar
  const isVisionMode = currentPage === 'vision';

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#0f172a', position: 'relative', display: 'flex', height: '100vh', width: '100vw' }}>
      
      {/* GLOBAL LOADING TOAST */}
      {isTransitioning && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(12px)', border: '1px solid #334155', padding: '14px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
          <style>{` @keyframes spin { 100% { transform: rotate(360deg); } } @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } `}</style>
          <Loader2 size={18} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px' }}>{loadingMessage}</span>
        </div>
      )}

      {/* RENDER SIDEBAR UNLESS IN FULLSCREEN VISION MODE */}
      {!isVisionMode && (
        <Sidebar 
          currentPage={currentPage}
          onNavigateHome={() => handleNavigation('home', 'Returning to Control Center...')}
          onNavigateTools={() => handleNavigation('tools', 'Accessing Tool Repository...')}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div style={{ 
        flex: 1, 
        paddingLeft: isVisionMode ? '0px' : '56px', // Leaves exact space for the collapsed sidebar
        boxSizing: 'border-box', // MAGIC FIX: Forces padding to be calculated inside the width so it never overflows!
        height: '100vh',
        position: 'relative' 
      }}>
        
        {currentPage === 'home' && (
          <MainDashboard onNavigateVision={() => handleNavigation('vision', 'Initializing Vision Engine...')} />
        )}
        
        {currentPage === 'vision' && (
          <VisionDashboard onNavigate={() => handleNavigation('home', 'Closing Console...')} />
        )}

        {currentPage === 'tools' && (
          <ToolManagement />
        )}
      </div>
      
    </div>
  );
}

export default App;
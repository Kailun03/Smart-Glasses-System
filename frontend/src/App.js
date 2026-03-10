import React, { useState } from 'react';
import { Loader2 } from 'lucide-react'; // The spinning loading icon
import VisionDashboard from './page/vision_dashboard';
import MainDashboard from './page/main_dashboard';
import ToolManagement from './page/tool_management';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  
  // New Global States for our Loading Toast
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Universal navigation handler with a simulated loading effect
  const handleNavigation = (targetPage, message) => {
    setLoadingMessage(message);
    setIsTransitioning(true);
    
    // Simulate a brief loading delay before actually switching the page
    setTimeout(() => {
      setCurrentPage(targetPage);
      setIsTransitioning(false);
    }, 800); // 800ms gives the user just enough time to read the notification
  };

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#0f172a', position: 'relative' }}>
      
      {/* GLOBAL LOADING NOTIFICATION TOAST */}
      {isTransitioning && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'rgba(30, 41, 59, 0.9)', // Dark frosted glass
          backdropFilter: 'blur(12px)',
          border: '1px solid #334155',
          padding: '14px 24px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#f8fafc',
          zIndex: 9999, // Ensure it's above EVERYTHING else on the screen
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {/* CSS Animations for the sliding entry and spinning icon */}
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            @keyframes slideIn { 
              from { transform: translateX(120%); opacity: 0; } 
              to { transform: translateX(0); opacity: 1; } 
            }
          `}</style>
          
          <Loader2 size={18} color="#38bdf8" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px' }}>{loadingMessage}</span>
        </div>
      )}

      {/* PAGE ROUTING (Passing the new handleNavigation function) */}
      {currentPage === 'home' && (
        <MainDashboard 
          onNavigateVision={() => handleNavigation('vision', 'Initializing Vision Engine...')} 
          onNavigateTools={() => handleNavigation('tools', 'Accessing Tool Repository...')} 
        />
      )}
      
      {currentPage === 'vision' && (
        <VisionDashboard onNavigate={() => handleNavigation('home', 'Closing Console...')} />
      )}

      {currentPage === 'tools' && (
        <ToolManagement onNavigate={() => handleNavigation('home', 'Returning to Control Center...')} />
      )}
      
    </div>
  );
}

export default App;
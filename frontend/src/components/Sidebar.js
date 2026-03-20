import React, { useState } from 'react';
import { Shield, LayoutDashboard, Database, Settings } from 'lucide-react';

function Sidebar({ currentPage, onNavigateHome, onNavigateTools }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          opacity: isSidebarExpanded ? 1 : 0,
          pointerEvents: isSidebarExpanded ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
          zIndex: 40 // Sits below the sidebar, but above the main content
        }}
      />

      {/* The Collapsible Sidebar */}
      <nav 
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        style={{ 
          position: 'absolute', // Now floats over the content
          top: 0,
          bottom: 0,
          left: 0,
          width: isSidebarExpanded ? '260px' : '40px',
          backgroundColor: 'rgba(5, 29, 37, 0.6)', 
          borderRight: '1px solid #1e293b', 
          padding: '24px 8px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '32px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
          overflowX: 'hidden', 
          whiteSpace: 'nowrap', 
          zIndex: 50
        }}
      >
        
        {/* App Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ backgroundColor: 'rgba(15, 89, 121, 0.5)', padding: '8px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Shield size={24} color="#38bdf8" />
          </div>
          <div style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s ease-in-out' }}>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', letterSpacing: '-0.5px' }}>Assistive OS</h1>
            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '500' }}>v2.0.4-beta</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <span style={{ color: '#475569', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px', opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>
            Main Menu
          </span>
          
          <button 
            onClick={onNavigateHome}
            onMouseOver={(e) => {
              if (currentPage !== 'home') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = '#f8fafc';
              }
            }}
            onMouseOut={(e) => {
              if (currentPage !== 'home') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
            style={{ 
              backgroundColor: currentPage === 'home' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', 
              color: currentPage === 'home' ? '#38bdf8' : '#94a3b8', 
              border: `1px solid ${currentPage === 'home' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}`, 
              padding: '12px 10px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              fontSize: '14px', 
              fontWeight: currentPage === 'home' ? '600' : '500', 
              cursor: 'pointer', 
              textAlign: 'left', 
              transition: 'all 0.2s' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}><LayoutDashboard size={20} /></div>
            <span style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>Control Center</span>
          </button>

          <button 
            onClick={onNavigateTools}
            onMouseOver={(e) => {
              if (currentPage !== 'tools') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = '#f8fafc';
              }
            }}
            onMouseOut={(e) => {
              if (currentPage !== 'tools') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
            style={{ 
              backgroundColor: currentPage === 'tools' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', 
              color: currentPage === 'tools' ? '#38bdf8' : '#94a3b8', 
              border: `1px solid ${currentPage === 'tools' ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}`, 
              padding: '12px 10px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              fontSize: '14px', 
              fontWeight: currentPage === 'tools' ? '600' : '500', 
              cursor: 'pointer', 
              textAlign: 'left', 
              transition: 'all 0.2s' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}><Database size={20} /></div>
            <span style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>Tool Management</span>
          </button>
        </div>

        {/* Bottom Settings Link */}
        <button style={{ backgroundColor: 'transparent', color: '#64748b', border: 'none', padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', fontWeight: '500', cursor: 'not-allowed', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Settings size={20} /></div>
            <span style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>Settings (Locked)</span>
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
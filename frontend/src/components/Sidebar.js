import React, { useState } from 'react';
import { LayoutDashboard, Database, Settings, ShieldAlert, LogOut } from 'lucide-react';
import { SYSTEM_VERSION } from '../config';
import auraLogo from '../components/aura-logo.png';

function Sidebar({ currentPage, onNavigateHome, onNavigateTools, onNavigateAnalytics, onNavigateSettings, onLogout }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const NavButton = ({ id, icon: Icon, label, onClick }) => (
    <button 
      onClick={(e) => {
        onClick(e);
        setIsSidebarExpanded(false);
      }}
      onMouseOver={(e) => {
        if (currentPage !== id) {
          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.color = '#f8fafc';
        }
      }}
      onMouseOut={(e) => {
        if (currentPage !== id) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = '#94a3b8';
        }
      }}
      style={{ 
        backgroundColor: currentPage === id ? 'rgba(56, 189, 248, 0.1)' : 'transparent', 
        color: currentPage === id ? '#38bdf8' : '#94a3b8', 
        border: `1px solid ${currentPage === id ? 'rgba(56, 189, 248, 0.2)' : 'transparent'}`, 
        padding: '12px 10px', 
        borderRadius: '10px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px', 
        fontSize: '14px', 
        fontWeight: currentPage === id ? '600' : '500', 
        cursor: 'pointer', 
        textAlign: 'left', 
        transition: 'all 0.2s',
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}><Icon size={20} /></div>
      <span style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>{label}</span>
    </button>
  );

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', opacity: isSidebarExpanded ? 1 : 0, pointerEvents: isSidebarExpanded ? 'auto' : 'none', transition: 'opacity 0.3s ease-in-out', zIndex: 1000 }} />
      
      <nav 
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: isSidebarExpanded ? '300px' : '42px', backgroundColor: 'rgba(5, 29, 37, 0.6)', borderRight: '1px solid #1e293b', padding: '28px 8px', display: 'flex', flexDirection: 'column', gap: '32px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflowX: 'hidden', whiteSpace: 'nowrap', zIndex: 1100 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ 
          position: 'relative',
          padding: '3px', 
          borderRadius: '10px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(91, 214, 245, 0.3), rgba(6, 26, 51, 0.2))',
          boxShadow: '0 0 20px rgba(176, 231, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.05)',
        }}>
          <img 
            src={auraLogo} 
            alt="AURA Logo" 
            style={{ 
              width: '34px', 
              height: '34px', 
              objectFit: 'contain',
              filter: 'brightness(1.5) contrast(1.5) drop-shadow(0px 0px 0px rgb(0, 0, 0))' 
            }} 
          />
        </div>
          <div style={{ opacity: isSidebarExpanded ? 1 : 0 }}>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>AURA Vision</h1>
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>Augmented User Reality Assistant</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <span style={{ color: '#475569', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px', opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>
            Main Menu
          </span>
          <NavButton id="home" icon={LayoutDashboard} label="Control Centre" onClick={onNavigateHome} />
          <NavButton id="tools" icon={Database} label="Tool Management" onClick={onNavigateTools} />
          <NavButton id="analytics" icon={ShieldAlert} label="Safety Analytics" onClick={onNavigateAnalytics} />
          <NavButton id="settings" icon={Settings} label="System Settings" onClick={onNavigateSettings} />
        </div>

        <span style={{ color: '#64748b', fontSize: '14px', paddingLeft: '54px' }}>System Version : {SYSTEM_VERSION}</span>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
          <button 
            onClick={(e) => {
              onLogout(e);
              setIsSidebarExpanded(false);
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = '#f8fafc';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
            }}
            style={{ 
              backgroundColor: 'transparent', 
              color: '#94a3b8', 
              border: 'transparent', 
              padding: '12px 10px', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              fontSize: '14px', 
              fontWeight: '500', 
              cursor: 'pointer', 
              textAlign: 'left', 
              transition: 'all 0.2s',
              width: '100%'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}><LogOut size={20} /></div>
            <span style={{ opacity: isSidebarExpanded ? 1 : 0, transition: 'opacity 0.2s' }}>Secure Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default Sidebar;
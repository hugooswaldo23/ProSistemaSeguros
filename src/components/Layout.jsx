import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';

const Layout = ({ children, onLogout }) => {
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [esMobile, setEsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setEsMobile(mobile);
      if (mobile) {
        setSidebarColapsado(false);
        setSidebarAbierto(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggleSidebar = () => {
    if (esMobile) {
      setSidebarAbierto(!sidebarAbierto);
    } else {
      setSidebarColapsado(!sidebarColapsado);
    }
  };

  const handleCloseSidebar = () => {
    if (esMobile) {
      setSidebarAbierto(false);
    }
  };

  return (
    <div className="d-flex" style={{ position: 'relative' }}>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      {/* Overlay para cerrar sidebar en móvil */}
      {esMobile && sidebarAbierto && (
        <div 
          className="sidebar-overlay active"
          onClick={handleCloseSidebar}
        />
      )}
      
      <Sidebar 
        onLogout={onLogout} 
        colapsado={sidebarColapsado}
        abierto={sidebarAbierto}
        esMobile={esMobile}
        onToggleColapsar={handleToggleSidebar}
      />
      
      <main 
        className="flex-grow-1" 
        style={{ 
          minHeight: '100vh', 
          backgroundColor: '#f8f9fa',
          width: esMobile ? '100%' : 'auto'
        }}
      >
        {/* Botón hamburguesa para móvil */}
        {esMobile && (
          <button
            onClick={handleToggleSidebar}
            className="btn btn-dark position-fixed"
            style={{
              top: '10px',
              left: '10px',
              zIndex: 998,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        
        {children}
      </main>
    </div>
  );
};

export default Layout;
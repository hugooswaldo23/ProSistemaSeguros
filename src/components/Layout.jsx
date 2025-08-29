import React from 'react';
import Sidebar from '../components/Sidebar';

const Layout = ({ children, onLogout }) => {
  return (
    <div className="d-flex">
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      <Sidebar onLogout={onLogout} />
      <main className="flex-grow-1" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
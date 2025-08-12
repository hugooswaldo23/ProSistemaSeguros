import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';

const Layout = ({ children }) => {
  const [vistaActual, setVistaActual] = useState('dashboard');

  return (
    <div className="d-flex">
        <link 
            href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
            rel="stylesheet" 
        />
        <Sidebar vistaActual={vistaActual} setVistaActual={setVistaActual} />
        <main className="flex-grow-1 p-4" style={{ minHeight: '100vh'}}>
            {children}
        </main>
    </div>
  );
};

export default Layout;

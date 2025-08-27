import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, RefreshCw, Server } from 'lucide-react';
import { testConnection, initializeDatabase } from '../lib/database';
const DatabaseInitializer = ({ children }) => {
  const [dbStatus, setDbStatus] = useState('checking'); // checking, connected, error
  const [message, setMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setDbStatus('checking');
    setMessage('Verificando conexión al servidor backend...');
    
    const result = await testConnection();
    
    if (result.success) {
      setDbStatus('connected');
      setMessage('Conexión exitosa al servidor backend');
    } else {
      setDbStatus('error');
      setMessage(`Error de conexión al servidor: ${result.error}`);
    }
  };

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    setMessage('Inicializando base de datos en el servidor...');
    
    const result = await initializeDatabase();
    
    if (result.success) {
      setMessage('Base de datos inicializada correctamente');
      setTimeout(() => setMessage('Conexión exitosa al servidor backend'), 3000);
    } else {
      setMessage(`Error inicializando base de datos: ${result.error}`);
    }
    
    setIsInitializing(false);
  };

  if (dbStatus === 'checking') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <RefreshCw className="spin mb-3" size={48} />
          <h4>Conectando al servidor...</h4>
          <p className="text-muted">{message}</p>
        </div>
      </div>
    );
  }

  if (dbStatus === 'error') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '500px' }}>
          <div className="card-body text-center">
            <Server className="text-danger mb-3" size={48} />
            <h4 className="text-danger">Servidor Backend No Disponible</h4>
            <p className="text-muted mb-4">{message}</p>
            
            <div className="alert alert-info text-start">
              <strong>Información:</strong>
              <ul className="mb-0 mt-2">
                <li>Esta aplicación requiere un servidor backend para funcionar</li>
                <li>El servidor maneja todas las operaciones de base de datos</li>
                <li>URL del servidor: {import.meta.env.VITE_API_URL}</li>
                <li>Asegúrate de que el servidor backend esté ejecutándose en esa dirección</li>
              </ul>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={checkConnection}
            >
              <RefreshCw size={16} className="me-2" />
              Reintentar Conexión al Servidor
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dbStatus === 'connected') {
    return (
      <>
        {children}
        <style>{`
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  return null;
};

export default DatabaseInitializer;
import React, { useState } from 'react';
import './Login.css';
const API_URL = import.meta.env.VITE_API_URL;


const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 🚨 BYPASS TEMPORAL - SOLO DESARROLLO
    // Descomentar estas líneas para entrar sin autenticación
    
    localStorage.setItem('ss_token', 'bypass-token-dev');
    onLogin && onLogin({ username: 'admin', token: 'bypass-token-dev' });
    return;
    
    /*
    if (!username || !password) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }
    setError('');
    try {
  const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuario: username, contrasena: password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Error de autenticación');
        return;
      }
      localStorage.setItem('ss_token', data.token);
      onLogin && onLogin({ username, token: data.token });
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
    */
  };

  return (
    <div className="ss-login-outer">
      <form className="ss-login-form" onSubmit={handleSubmit}>
        <h2>Iniciar Sesión</h2>
        <div className="ss-login-input-group">
          <label htmlFor="username">Usuario</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="ss-login-input-group">
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <div className="ss-login-error-message">{error}</div>}
        <button type="submit" className="ss-login-btn">Entrar</button>
      </form>
    </div>
  );
};

export default Login;

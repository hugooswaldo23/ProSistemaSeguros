import React, { useState } from 'react';
import './Login.css';
const API_URL = import.meta.env.VITE_API_URL;


const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [promotoria, setPromotoria] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const usernameTrim = username.trim();
    const promotoriaTrim = promotoria.trim().replace(/\s+/g, ' ');

    if (!usernameTrim || !password || !promotoriaTrim) {
      setError('Por favor ingresa usuario, promotoría y contraseña');
      return;
    }

    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuario: usernameTrim, contrasena: password, promotoria: promotoriaTrim })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Error de autenticación');
        return;
      }
      localStorage.setItem('ss_token', data.token);
      localStorage.setItem('ss_user', JSON.stringify({
        username: data.usuario || usernameTrim,
        nombre: data.nombre || usernameTrim,
        promotoria: data.promotoria || promotoriaTrim,
        promotoria_id: data.promotoria_id || null
      }));
      onLogin && onLogin({ username: usernameTrim, promotoria: data.promotoria || promotoriaTrim, token: data.token });
    } catch (err) {
      setError('Error de conexión con el servidor');
    }
  };

  return (
    <div className="ss-login-outer">
      <form className="ss-login-form" onSubmit={handleSubmit}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <img 
            src="/assets/branding/logo-dcpro.png" 
            alt="DCPRO Administración" 
            style={{ width: '340px', height: 'auto' }}
          />
        </div>
        <h2>Iniciar Sesión</h2>
        <div className="ss-login-input-group">
          <label htmlFor="promotoria">Promotoría</label>
          <input
            type="text"
            id="promotoria"
            value={promotoria}
            onChange={(e) => setPromotoria(e.target.value)}
            autoComplete="organization"
          />
        </div>
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

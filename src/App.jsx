import './App.css'
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from "./components/Layout";
import Dashboard from "./screens/Dashboard";
import EquipoDeTrabajo from "./screens/EquipoDeTrabajo";
import Productos from "./screens/Productos";
import Clientes from "./screens/Clientes";
import NvoExpedientes from "./screens/NvoExpedientes";
import Tramites from "./screens/Tramites";
import Aseguradoras from "./screens/Aseguradoras";
import DetallesProducto from "./screens/Productos/Detalles";
import ConfiguracionTablas from "./screens/ConfiguracionTablas";
import Configuracion from "./screens/Configuracion";
import Reportes from "./screens/Reportes";
import Nomina from "./screens/Nomina";
import Prestamos from "./screens/Prestamos";
import {
	BrowserRouter as Router,
	Route,
	Routes,
	useNavigate,
} from "react-router-dom";
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('ss_token'));
  });

  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem('ss_token')));
  }, []);

  const handleLogin = (credentials) => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('ss_token');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard/>}/>
          <Route path="/clientes" element={<Clientes/>}/>
          <Route path="/polizas" element={<NvoExpedientes/>}/>
          <Route path="/tramites" element={<Tramites/>}/>
          <Route path="/equipo-de-trabajo" element={<EquipoDeTrabajo/>}/>
          <Route path="/aseguradoras" element={<Aseguradoras/>}/>
          <Route path="/configuracion-tablas" element={<ConfiguracionTablas/>}/>
          <Route path="/reportes" element={<Reportes/>}/>
          <Route path="/reportes/nomina" element={<Nomina/>}/>
          <Route path="/reportes/prestamos" element={<Prestamos/>}/>
          <Route path="/configuracion" element={<Configuracion/>}/>
        </Routes>
      </Layout>
    </Router>
  );
}

export default App
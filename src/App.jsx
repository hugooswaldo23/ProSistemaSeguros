import './App.css'
import { useState, useEffect, lazy, Suspense } from 'react';
import Login from './components/Login';
import Layout from "./components/Layout";
import {
	BrowserRouter as Router,
	Route,
	Routes,
	useNavigate,
} from "react-router-dom";

// Lazy loading de pantallas para reducir bundle inicial
const Dashboard = lazy(() => import('./screens/Dashboard'));
const Clientes = lazy(() => import('./screens/Clientes'));
const NvoExpedientes = lazy(() => import('./screens/NvoExpedientes'));
const Tramites = lazy(() => import('./screens/Tramites'));
const EquipoDeTrabajo = lazy(() => import('./screens/EquipoDeTrabajo'));
const Aseguradoras = lazy(() => import('./screens/Aseguradoras'));
const ConfiguracionTablas = lazy(() => import('./screens/ConfiguracionTablas'));
const Configuracion = lazy(() => import('./screens/Configuracion'));
const Reportes = lazy(() => import('./screens/Reportes'));
const Nomina = lazy(() => import('./screens/Nomina'));
const Prestamos = lazy(() => import('./screens/Prestamos'));
const CorteDiario = lazy(() => import('./screens/CorteDiario'));
const Productos = lazy(() => import('./screens/Productos'));
const DetallesProducto = lazy(() => import('./screens/Productos/Detalles'));
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
        <Suspense fallback={
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        }>
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
          <Route path="/reportes/corte-diario" element={<CorteDiario/>}/>
          <Route path="/configuracion" element={<Configuracion/>}/>
        </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App
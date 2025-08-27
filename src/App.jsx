import './App.css'
import Dashboard from "./screens/Dashboard";
import EquipoDeTrabajo from "./screens/EquipoDeTrabajo";
import Productos from "./screens/Productos";
import Clientes from "./screens/Clientes";
import Expedientes from "./screens/Expedientes";
import Tramites from "./screens/Tramites";
import Aseguradoras from "./screens/Aseguradoras";
import DetallesProducto from "./screens/Productos/Detalles";
import ConfiguracionTablas from "./screens/ConfiguracionTablas";
import Configuracion from "./screens/Configuracion";
import {
	BrowserRouter as Router,
	Route,
	Routes,
	useNavigate,
} from "react-router-dom";
import Layout from "./components/Layout";

function App() {
  return (
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard/>}/>
            <Route path="/clientes" element={<Clientes/>}/>
            <Route path="/expedientes" element={<Expedientes/>}/>
            <Route path="/tramites" element={<Tramites/>}/>
            <Route path="/equipo-de-trabajo" element={<EquipoDeTrabajo/>}/>
            <Route path="/aseguradoras" element={<Aseguradoras/>}/>
            <Route path="/configuracion-tablas" element={<ConfiguracionTablas/>}/>
            <Route path="/configuracion" element={<Configuracion/>}/>
          </Routes>
        </Layout>
      </Router>
  )
}

export default App
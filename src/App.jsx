import './App.css'
import Dashboard from "./screens/Dashboard";
import Agentes from "./screens/Agentes";
import Productos from "./screens/Productos";
import Clientes from "./screens/Clientes";
import Expedientes from "./screens/Expedientes";
import Configuracion from "./screens/Configuracion";
import DetallesProducto from "./screens/Productos/Detalles";
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
          <Route path="/agentes" element={<Agentes/>}/>
          <Route path="/productos" element={<Productos/>}/>
          <Route path="/configuracion" element={<Configuracion/>}/>
          <Route path="/productos/detalles-producto" element={<DetallesProducto/>}/>
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

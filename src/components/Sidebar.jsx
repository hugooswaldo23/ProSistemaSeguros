import React, { useMemo } from 'react';
import { Shield, User, Home, Users, FileText, UserCheck, Package, PieChart, Settings } from 'lucide-react';
import { useNavigate, useLocation, useParams, redirect } from "react-router-dom";

// Sidebar Component (memoizado)
const Sidebar = ({ vistaActual, setVistaActual }) =>  {
    const navigate = useNavigate();

    const modulos = useMemo(() => [
        { key: '', nombre: 'Dashboard', icono: Home, activo: true },
        { key: 'clientes', nombre: 'Clientes', icono: Users, activo: true },
        { key: 'expedientes', nombre: 'Expedientes', icono: FileText, activo: true },
        { key: 'agentes', nombre: 'Agentes', icono: UserCheck, activo: true },
        { key: 'seguros', nombre: 'Seguros', icono: Shield, activo: false },
        { key: 'productos', nombre: 'Productos', icono: Package, activo: true },
        { key: 'reportes', nombre: 'Reportes', icono: PieChart, activo: false },
        { key: 'configuracion', nombre: 'Configuración', icono: Settings, activo: true }
    ], []);

    return (
        <div className="d-flex flex-column bg-dark text-white" >
            <div className="py-3 px-5 border-bottom border-secondary">
                <h5 className="mb-0 text-center">
                <Shield className="me-2" size={24} />
                    Sistema Seguros
                </h5>
            </div>
        
            <nav className="flex-grow-1 py-3">
                {modulos.map(modulo => {
                    const IconoModulo = modulo.icono;
                    return (
                        <button
                            key={modulo.key}
                            onClick={() => navigate(modulo.key)}
                            className={`btn w-100 text-start text-white d-flex align-items-center px-4 py-2 border-0 ${
                                vistaActual === modulo.key ? 'bg-primary' : 'bg-transparent'
                            } ${!modulo.activo ? 'opacity-50' : ''}`}
                            style={{ borderRadius: '0' }}
                            disabled={!modulo.activo}
                        >
                            <IconoModulo size={18} className="me-3" />
                            {modulo.nombre}
                        </button>
                    );
                })}
            </nav>
        
            <div className="border-top border-secondary p-3">
                <div className="d-flex align-items-center">
                    <User size={20} className="me-2" />
                    <div>
                        <small className="d-block">Admin Usuario</small>
                        <small className="text-muted">Promotoria</small>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default Sidebar;
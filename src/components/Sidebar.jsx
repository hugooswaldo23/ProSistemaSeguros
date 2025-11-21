import React, { useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { Shield, User, Home, Users, FileText, UserCheck, Package, PieChart, Settings, Clipboard, BookOpen, Database, Building2 } from 'lucide-react';
import { useNavigate, useLocation } from "react-router-dom";

// Sidebar Component (memoizado)
const Sidebar = ({ onLogout }) =>  {
    const navigate = useNavigate();
    const location = useLocation();

    const modulos = useMemo(() => [
        { key: '/', nombre: 'Dashboard', icono: Home, activo: true },
        { key: '/clientes', nombre: 'Clientes', icono: Users, activo: true },
        { key: '/polizas', nombre: 'Pólizas', icono: FileText, activo: true },
        { key: '/tramites', nombre: 'Trámites', icono: Clipboard, activo: true },
        { key: '/equipo-de-trabajo', nombre: 'Equipo de Trabajo', icono: UserCheck, activo: true },
        { key: '/aseguradoras', nombre: 'Aseguradoras', icono: Building2, activo: true },
        { key: '/configuracion-tablas', nombre: 'Configuración de Tablas', icono: Database, activo: true },
        { key: '/configuracion', nombre: 'Configuración', icono: Settings, activo: true }
    ], []);

    return (
        <div 
            className="d-flex flex-column bg-dark text-white" 
            style={{ 
                width: '280px', 
                minWidth: '280px',
                maxWidth: '280px',
                minHeight: '100vh',
                flexShrink: 0
            }}
        >
            <div className="py-3 px-4 border-bottom border-secondary">
                <h5 className="mb-0 text-center">
                    <Shield className="me-2" size={24} />
                    Sistema Seguros
                </h5>
            </div>
        
            <nav className="flex-grow-1 py-3">
                {modulos.map(modulo => {
                    const IconoModulo = modulo.icono;
                    const isActive = location.pathname === modulo.key;
                    return (
                        <button
                            key={modulo.key}
                            onClick={() => navigate(modulo.key)}
                            className={`btn w-100 text-start text-white d-flex align-items-center px-4 py-2 border-0 ${
                                isActive ? 'bg-primary' : 'bg-transparent'
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
                <div className="d-flex align-items-center mb-3">
                    <User size={20} className="me-2" />
                    <div>
                        <small className="d-block">Admin Usuario</small>
                        <small className="text-muted">Promotoria</small>
                    </div>
                </div>
                <button
                    className="btn btn-danger w-100 d-flex align-items-center justify-content-center"
                    onClick={onLogout}
                >
                    <LogOut size={18} className="me-2" />
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
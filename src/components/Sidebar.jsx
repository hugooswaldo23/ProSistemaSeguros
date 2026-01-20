import React, { useMemo } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { Shield, User, Home, Users, FileText, UserCheck, Package, PieChart, Settings, Clipboard, BookOpen, Database, Building2, BarChart3 } from 'lucide-react';
import { useNavigate, useLocation } from "react-router-dom";

// Sidebar Component (memoizado)
const Sidebar = ({ onLogout, colapsado = false, abierto = false, esMobile = false, onToggleColapsar }) =>  {
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
        { key: '/reportes', nombre: 'Reportes', icono: BarChart3, activo: true },
        { key: '/configuracion', nombre: 'Configuración', icono: Settings, activo: true }
    ], []);

    const getWidth = () => {
        if (esMobile) return '280px';
        return colapsado ? '80px' : '200px';
    };

    const getTransform = () => {
        if (esMobile) {
            return abierto ? 'translateX(0)' : 'translateX(-100%)';
        }
        return 'translateX(0)';
    };

    return (
        <div 
            className="d-flex flex-column bg-dark text-white sidebar-wrapper" 
            style={{ 
                width: getWidth(),
                minWidth: getWidth(),
                maxWidth: getWidth(),
                minHeight: '100vh',
                flexShrink: 0,
                transition: 'all 0.3s ease',
                transform: getTransform(),
                position: esMobile ? 'fixed' : 'relative',
                left: 0,
                top: 0,
                zIndex: 1000,
                boxShadow: esMobile && abierto ? '2px 0 8px rgba(0,0,0,0.3)' : 'none'
            }}
        >
            <div style={{ 
                backgroundColor: '#ffffff',
                margin: '10px',
                marginBottom: '0',
                borderRadius: '12px',
                padding: colapsado && !esMobile ? '12px 8px' : '16px 12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
                {colapsado && !esMobile ? (
                    <div className="text-center">
                        <img 
                            src="/assets/branding/logo-dcpro.png" 
                            alt="DCPRO" 
                            style={{ width: '55px', height: 'auto' }}
                        />
                    </div>
                ) : (
                    <div className="text-center">
                        <img 
                            src="/assets/branding/logo-dcpro.png" 
                            alt="DCPRO Administración" 
                            style={{ width: '100%', maxWidth: '160px', height: 'auto' }}
                        />
                    </div>
                )}
            </div>
            <div className="py-2">
                {!esMobile && (
                    <button
                        onClick={onToggleColapsar}
                        className="btn btn-sm btn-outline-light position-absolute"
                        style={{ 
                            top: '10px', 
                            right: '10px',
                            zIndex: 1001,
                            padding: '4px 8px'
                        }}
                        title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
                    >
                        {colapsado ? <Menu size={16} /> : <X size={16} />}
                    </button>
                )}
            </div>
        
            <nav className="flex-grow-1 py-3">
                {modulos.map(modulo => {
                    const IconoModulo = modulo.icono;
                    const isActive = location.pathname === modulo.key;
                    const mostrarTexto = esMobile ? true : !colapsado;
                    return (
                        <button
                            key={modulo.key}
                            onClick={() => navigate(modulo.key)}
                            className={`btn w-100 text-white d-flex py-2 border-0 ${
                                isActive ? 'bg-primary' : 'bg-transparent'
                            } ${!modulo.activo ? 'opacity-50' : ''}`}
                            style={{ 
                                borderRadius: '0',
                                justifyContent: (colapsado && !esMobile) ? 'center' : 'flex-start',
                                paddingLeft: (colapsado && !esMobile) ? '0' : '1rem',
                                paddingRight: (colapsado && !esMobile) ? '0' : '1rem',
                                alignItems: 'flex-start',
                                paddingTop: '0.6rem',
                                paddingBottom: '0.6rem'
                            }}
                            disabled={!modulo.activo}
                            title={(colapsado && !esMobile) ? modulo.nombre : ''}
                        >
                            <IconoModulo size={18} className={mostrarTexto ? 'me-2' : ''} style={{ marginTop: '2px', flexShrink: 0 }} />
                            {mostrarTexto && <span style={{ textAlign: 'left', lineHeight: '1.3' }}>{modulo.nombre}</span>}
                        </button>
                    );
                })}
            </nav>
        
            <div className="border-top border-secondary p-3">
                {(esMobile || !colapsado) && (
                    <div className="d-flex align-items-center mb-3">
                        <User size={20} className="me-2" />
                        <div>
                            <small className="d-block">Admin Usuario</small>
                            <small className="text-muted">Promotoria</small>
                        </div>
                    </div>
                )}
                <button
                    className="btn btn-danger w-100 d-flex align-items-center justify-content-center"
                    onClick={onLogout}
                    title={(colapsado && !esMobile) ? 'Cerrar sesión' : ''}
                >
                    <LogOut size={18} className={(colapsado && !esMobile) ? '' : 'me-2'} />
                    {(esMobile || !colapsado) && 'Cerrar sesión'}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
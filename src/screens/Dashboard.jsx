import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from "../components/Sidebar";
import { Download, Upload, Plus, Save, AlertCircle, FileText, UserCheck, Package } from 'lucide-react';
const Dashboard = () => {
    const [expedientes, setExpedientes] = useState([]);
    const [agentes, setAgentes] = useState([]);
    const [productos, setProductos] = useState([]);
    const [productosPersonalizados, setProductosPersonalizados] = useState([]);
    // Cálculos memorizados para estadísticas
    const estadisticas = useMemo(() => [
    { 
        etapa: 'En cotización', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'En cotización').length,
        descripcion: 'Esperando cotización',
        color: '#7c3aed'
    },
    { 
        etapa: 'Cotización enviada', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Cotización enviada').length,
        descripcion: 'Enviadas al cliente',
        color: '#7c3aed'
    },
    { 
        etapa: 'Autorizado', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Autorizado').length,
        descripcion: 'Autorizadas por cliente',
        color: '#7c3aed'
    },
    { 
        etapa: 'En proceso emisión', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'En proceso emisión').length,
        descripcion: 'En proceso de emisión',
        color: '#7c3aed'
    },
    { 
        etapa: 'Emitida', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Emitida').length,
        descripcion: 'Pólizas emitidas',
        color: '#0ea5e9'
    },
    { 
        etapa: 'Pendiente de pago', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Pendiente de pago').length,
        descripcion: 'Esperando pago',
        color: '#f59e0b'
    },
    { 
        etapa: 'Pagado', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Pagado').length,
        descripcion: 'Pólizas vigentes',
        color: '#10b981'
    },
    { 
        etapa: 'Cancelado', 
        cantidad: expedientes.filter(exp => exp.etapaActiva === 'Cancelado').length,
        descripcion: 'Expedientes cancelados',
        color: '#ef4444'
    }
    ], [expedientes]);

    // Cálculos memorizados para resumen
    const resumen = useMemo(() => ({
    totalExpedientes: expedientes.length,
    enProceso: expedientes.filter(exp => ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(exp.etapaActiva)).length,
    vigentes: expedientes.filter(exp => exp.etapaActiva === 'Pagado').length,
    canceladas: expedientes.filter(exp => exp.etapaActiva === 'Cancelado').length,
    totalAgentes: agentes.length,
    agentesActivos: agentes.filter(a => a.activo).length,
    totalProductos: productos.length + productosPersonalizados.length,
    productosActivos: productos.length + productosPersonalizados.filter(p => p.activo).length
    }), [expedientes, agentes, productosPersonalizados, productos]);

    // Cálculos memorizados para alertas de pago
    const alertasPago = useMemo(() => ({
    vencidos: expedientes.filter(exp => exp.estatusPago === 'Vencido').length,
    enGracia: expedientes.filter(exp => exp.estatusPago === 'Pago en período de gracia').length,
    porVencer: expedientes.filter(exp => exp.estatusPago === 'Pago por vencer').length,
    porRenovar: expedientes.filter(exp => exp.estatusPago === 'Por renovar').length
    }), [expedientes]);

    // Función para importar datos (memoizada)
    const importarDatos = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
        try {
            const datos = JSON.parse(e.target.result);
            
            if (!datos.expedientes || !datos.agentes) {
            alert('El archivo no tiene el formato correcto');
            return;
            }
            
            if (confirm('¿Está seguro de importar estos datos? Se sobrescribirán los datos actuales.')) {
            setExpedientes(datos.expedientes);
            setAgentes(datos.agentes);
            setProductosPersonalizados(datos.productosPersonalizados || []);
            alert('Datos importados correctamente');
            }
        } catch (error) {
            alert('Error al leer el archivo. Asegúrese de que sea un archivo JSON válido.');
        }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    }, []);
    
    // Función para exportar datos (memoizada)
    const exportarDatos = useCallback(() => {
        const datos = {
        expedientes,
        agentes,
        productosPersonalizados,
        fechaExportacion: new Date().toISOString(),
        version: '1.0'
        };
        
        const dataStr = JSON.stringify(datos, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `backup_seguros_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }, [expedientes, agentes, productosPersonalizados]);

    return (
        <div>
            <div className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h3 className="mb-1">Dashboard</h3>
                        <p className="text-muted mb-0">Estatus de los Expedientes en Proceso</p>
                    </div>
                    <div className="d-flex gap-2">
                        <div className="btn-group">
                            <button 
                            onClick={exportarDatos}
                            className="btn btn-outline-success"
                            title="Exportar datos como backup"
                            >
                            <Download size={16} className="me-2" />
                            Exportar
                            </button>
                            <label className="btn btn-outline-primary mb-0" title="Importar datos desde backup">
                            <Upload size={16} className="me-2" />
                            Importar
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={importarDatos}
                                style={{ display: 'none' }}
                            />
                            </label>
                        </div>
                    
                        <button 
                            onClick={() => setVistaActual('formulario')}
                            className="btn btn-primary"
                        >
                            <Plus size={16} className="me-2" />
                            Nuevo Expediente
                        </button>
                    </div>
                </div>

                <div className="alert alert-info alert-dismissible fade show mb-4" role="alert">
                    <div className="d-flex align-items-center">
                    <Save className="me-2" size={20} />
                    <div>
                        <strong>Nota:</strong> Los datos se mantienen durante esta sesión. 
                        Usa los botones de Exportar/Importar para guardar y restaurar datos.
                    </div>
                    </div>
                    <button type="button" className="btn-close" data-bs-dismiss="alert"></button>
                </div>

                <div className="row g-3">
                    {estadisticas.map((stat, index) => (
                    <div key={index} className="col-md-6 col-lg-4 col-xl-3">
                        <div 
                            className="card text-white h-100"
                            style={{ 
                                backgroundColor: stat.color,
                                cursor: stat.cantidad > 0 ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                                if (stat.cantidad > 0) {
                                setVistaActual('expedientes');
                                }
                            }}
                        >
                            <div className="card-body d-flex flex-column justify-content-center align-items-center text-center p-4">
                                <div className="display-4 fw-bold mb-2">{stat.cantidad}</div>
                                {/* <h6 className="card-title mb-1">{stat.etapa}</h6> */}
                                <small className="opacity-75">{stat.descripcion}</small>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>

                <div className="row mt-4">
                    <div className="col-12">
                    <div className="card">
                        <div className="card-body">
                        <div className="row text-center">
                            <div className="col-6 col-md-2">
                            <h4 className="text-primary">{resumen.totalExpedientes}</h4>
                            <p className="text-muted mb-0">Total Expedientes</p>
                            </div>
                            <div className="col-6 col-md-2">
                            <h4 className="text-warning">{resumen.enProceso}</h4>
                            <p className="text-muted mb-0">En Proceso</p>
                            </div>
                            <div className="col-6 col-md-2">
                            <h4 className="text-success">{resumen.vigentes}</h4>
                            <p className="text-muted mb-0">Vigentes</p>
                            </div>
                            <div className="col-6 col-md-2">
                            <h4 className="text-danger">{resumen.canceladas}</h4>
                            <p className="text-muted mb-0">Canceladas</p>
                            </div>
                            <div className="col-6 col-md-2">
                            <h4 className="text-info">{resumen.totalAgentes}</h4>
                            <p className="text-muted mb-0">Agentes Total</p>
                            </div>
                            <div className="col-6 col-md-2">
                            <h4 className="text-primary">{resumen.totalProductos}</h4>
                            <p className="text-muted mb-0">Productos Total</p>
                            </div>
                        </div>
                        </div>
                    </div>
                    </div>
                </div>

                {expedientes.length > 0 && (
                    <div className="row mt-4">
                    <div className="col-12">
                        <div className="card border-warning">
                        <div className="card-header bg-warning bg-opacity-10 border-warning">
                            <h5 className="mb-0">
                            <AlertCircle className="me-2" size={20} />
                            Pagos que Requieren Atención
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row">
                            <div className="col-md-3 text-center">
                                <h3 className="text-danger mb-1">{alertasPago.vencidos}</h3>
                                <p className="text-muted mb-0">Pagos Vencidos</p>
                            </div>
                            <div className="col-md-3 text-center">
                                <h3 className="text-warning mb-1">{alertasPago.enGracia}</h3>
                                <p className="text-muted mb-0">En Período de Gracia</p>
                            </div>
                            <div className="col-md-3 text-center">
                                <h3 className="text-info mb-1">{alertasPago.porVencer}</h3>
                                <p className="text-muted mb-0">Por Vencer (30 días)</p>
                            </div>
                            <div className="col-md-3 text-center">
                                <h3 className="text-primary mb-1">{alertasPago.porRenovar}</h3>
                                <p className="text-muted mb-0">Por Renovar</p>
                            </div>
                            </div>
                            {(alertasPago.vencidos + alertasPago.enGracia + alertasPago.porVencer > 0) && (
                            <div className="mt-3">
                                <button 
                                onClick={() => setVistaActual('expedientes')}
                                className="btn btn-warning"
                                >
                                Ver Expedientes con Pagos Pendientes
                                </button>
                            </div>
                            )}
                        </div>
                        </div>
                    </div>
                    </div>
                )}

                {expedientes.length > 0 && (
                    <div className="row mt-4">
                    <div className="col-12">
                        <div className="card">
                        <div className="card-header">
                            <h5 className="mb-0">
                            <Package className="me-2" size={20} />
                            Expedientes por Producto
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row text-center">
                            {/* Productos base */}
                            {productos.map(producto => {
                                const cantidad = expedientes.filter(exp => exp.producto === producto).length;
                                if (cantidad === 0) return null;
                                
                                return (
                                <div key={producto} className="col-md-2">
                                    <h4 className="text-primary">{cantidad}</h4>
                                    <p className="text-muted mb-0">{producto}</p>
                                    {producto === 'Autos' && (
                                    <small className="text-info">
                                        {expedientes.filter(exp => exp.producto === 'Autos' && exp.tipoCobertura === 'Amplia').length} Amplia | 
                                        {expedientes.filter(exp => exp.producto === 'Autos' && exp.tipoCobertura === 'Limitada').length} Limitada
                                    </small>
                                    )}
                                </div>
                                );
                            })}
                            
                        {/* Productos personalizados */}
                        {productosPersonalizados.map(producto => {
                            const cantidad = expedientes.filter(exp => exp.producto === producto.nombre).length;
                            if (cantidad === 0) return null;
                            
                            return (
                            <div key={producto.id} className="col-md-2">
                                <h4 className="text-info">{cantidad}</h4>
                                <p className="text-muted mb-0">{producto.nombre}</p>
                                <small className="text-secondary">{producto.categoria}</small>
                            </div>
                            );
                        })}
                            </div>
                        </div>
                        </div>
                    </div>
                    </div>
                )}

                {expedientes.length === 0 && (
                    <div className="row mt-4">
                    <div className="col-12">
                        <div className="card border-dashed border-2">
                        <div className="card-body text-center py-5">
                            <FileText size={48} className="text-muted mb-3" />
                            <h5>¡Bienvenido al Sistema de Gestión de Seguros!</h5>
                            <p className="text-muted">Para comenzar, crea tu primer expediente</p>
                            <div className="d-flex justify-content-center gap-2 flex-wrap">
                            <button 
                                onClick={() => setVistaActual('formulario')}
                                className="btn btn-primary btn-lg"
                            >
                                <Plus size={20} className="me-2" />
                                Crear Primer Expediente
                            </button>
                            <button 
                                onClick={() => setVistaActual('agentes')}
                                className="btn btn-outline-primary btn-lg"
                            >
                                <UserCheck size={20} className="me-2" />
                                Registrar Agentes
                            </button>
                            <button 
                                onClick={() => setVistaActual('productos')}
                                className="btn btn-outline-primary btn-lg"
                            >
                                <Package size={20} className="me-2" />
                                Gestionar Productos
                            </button>
                            <label className="btn btn-outline-success btn-lg mb-0">
                                <Upload size={20} className="me-2" />
                                Importar Datos
                                <input 
                                type="file" 
                                accept=".json"
                                onChange={importarDatos}
                                style={{ display: 'none' }}
                                />
                            </label>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
export default Dashboard;
import React, { useMemo, useState, useCallback } from 'react';
import { Save, Download, Upload, AlertCircle, Trash2 } from 'lucide-react';
const Configuracion = () => {
    const [expedientes, setExpedientes] = useState([]);
    const [agentes, setAgentes] = useState([]);
    const [productosPersonalizados, setProductosPersonalizados] = useState([]);
    const [productos, setProductos] = useState([]);

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
            <h3 className="mb-4">Configuración del Sistema</h3>
                <div className="card mb-4">
                    <div className="card-header">
                        <h5 className="mb-0">
                        <Save className="me-2" size={20} />
                        Gestión de Datos
                        </h5>
                    </div>
                    <div className="card-body">
                        <div className="row g-3">
                        <div className="col-md-6">
                            <div className="card bg-light">
                            <div className="card-body">
                                <h6 className="card-title">
                                <Download className="me-2" size={18} />
                                Exportar Datos
                                </h6>
                                <p className="card-text text-muted">
                                Descarga un respaldo completo de todos los expedientes y agentes en formato JSON.
                                </p>
                                <button onClick={exportarDatos} className="btn btn-success">
                                <Download className="me-2" size={16} />
                                Exportar Backup
                                </button>
                            </div>
                            </div>
                        </div>
                        
                        <div className="col-md-6">
                            <div className="card bg-light">
                            <div className="card-body">
                                <h6 className="card-title">
                                <Upload className="me-2" size={18} />
                                Importar Datos
                                </h6>
                                <p className="card-text text-muted">
                                Restaura los datos desde un archivo de respaldo JSON previamente exportado.
                                </p>
                                <label className="btn btn-primary mb-0">
                                <Upload className="me-2" size={16} />
                                Importar Backup
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
                </div>

                <div className="card mb-4">
                    <div className="card-header">
                        <h5 className="mb-0">
                        <AlertCircle className="me-2" size={20} />
                        Información del Sistema
                        </h5>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-md-4">
                                <strong>Total de Expedientes:</strong>
                                <p className="mb-2">{expedientes.length} registros</p>
                            </div>
                            <div className="col-md-4">
                                <strong>Total de Agentes:</strong>
                                <p className="mb-2">{agentes.length} registros</p>
                            </div>
                            <div className="col-md-4">
                                <strong>Total de Productos:</strong>
                                <p className="mb-2">{productos.length + productosPersonalizados.length} ({productos.length} base + {productosPersonalizados.length} personalizados)</p>
                            </div>
                        </div>
                        <div className="row mt-3">
                            <div className="col-12">
                                <strong>Tamaño aproximado:</strong>
                                <p className="mb-2">
                                {((JSON.stringify(expedientes).length + JSON.stringify(agentes).length + JSON.stringify(productosPersonalizados).length) / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        </div>
                        <div className="alert alert-info mt-3 mb-0">
                            <small>
                                <strong>Nota:</strong> Los datos se mantienen durante esta sesión. 
                                Se recomienda hacer respaldos periódicos usando la función de exportar.
                            </small>
                        </div>
                    </div>
                </div>

                <div className="card border-danger">
                    <div className="card-header bg-danger text-white">
                        <h5 className="mb-0">
                        <AlertCircle className="me-2" size={20} />
                        Zona de Peligro
                        </h5>
                    </div>
                <div className="card-body">
                    <p className="text-danger">
                    <strong>¡Advertencia!</strong> Esta acción eliminará TODOS los datos del sistema de forma permanente.
                    </p>
                    <button 
                    className="btn btn-danger"
                    >
                    <Trash2 className="me-2" size={16} />
                    Eliminar Todos los Datos
                    </button>
                </div>
            </div>
        </div>
    );
}
export default Configuracion;
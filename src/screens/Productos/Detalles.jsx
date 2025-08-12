import React, { useMemo, useState,useCallback,useEffect } from 'react'; 
import { Edit, Eye } from 'lucide-react';
const DetallesProducto = () => {
    const [expedientes, setExpedientes] = useState([]);
    const companias = useMemo(() => ['Qualitas', 'Banorte', 'HDI', 'El Aguila', 'Mapfre', 'Chubb', 'Afirme'], []);
    const [productoSeleccionado, setProductoSeleccionado] = useState({
        id: `base-0`,
        codigo: `BASE${(0 + 1).toString().padStart(3, '0')}`,
        nombre: "Autos",
        categoria: "Autos" === 'Autos' || "Autos" === 'Equipo pesado' || "Autos" === 'Embarcaciones' ? 'Vehículos' : 
                   "Autos" === 'Vida' || "Autos" === 'Ahorro' ? 'Personas' : 'Patrimoniales',
        descripcion: `Producto base del sistema - ${"Autos"}`,
        companiasDisponibles: companias,
        activo: true,
        esBase: true,
        comisionBase: "Autos" === 'Vida' ? '30' : "Autos" === 'Autos' ? '10' : '15',
        vigenciaDias: 365
      });

    const expedientesDelProducto = useMemo(() => 
      expedientes.filter(exp => 
        exp.producto === productoSeleccionado?.nombre || exp.producto === productoSeleccionado?.codigo
      ),
      [expedientes, productoSeleccionado]
    );

    const estadisticas = useMemo(() => ({
      total: expedientesDelProducto.length,
      vigentes: expedientesDelProducto.filter(exp => exp.etapaActiva === 'Pagado').length,
      enProceso: expedientesDelProducto.filter(exp => 
        ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(exp.etapaActiva)
      ).length,
      cancelados: expedientesDelProducto.filter(exp => exp.etapaActiva === 'Cancelado').length
    }), [expedientesDelProducto]);

    return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="mb-0">Detalles del Producto</h3>
            <div className="d-flex gap-3">
                {!productoSeleccionado?.esBase && (
                    <button onClick={() => editarProducto(productoSeleccionado)} className="btn btn-primary d-flex align-items-center">
                        <Edit size={16} className="me-2" />
                        Editar
                    </button>
                )}
                <button onClick={() => setVistaActual('productos')} className="btn btn-outline-secondary" >
                    Volver
                </button>
            </div>
        </div>
        {productoSeleccionado && (
        <div className="row g-4">
            {/* Información del Producto */}
            <div className="col-md-8">
            <div className="card">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Información del Producto</h5>
                <div className="row g-3">
                    <div className="col-md-6">
                    <strong className="d-block text-muted">Código:</strong>
                    <span className="h5 text-primary">{productoSeleccionado.codigo}</span>
                    {productoSeleccionado.esBase && (
                        <span className="badge bg-secondary ms-2">Producto Base</span>
                    )}
                    </div>
                    <div className="col-md-6">
                    <strong className="d-block text-muted">Estado:</strong>
                    <span className={`badge ${productoSeleccionado.activo ? 'bg-success' : 'bg-secondary'} fs-6`}>
                        {productoSeleccionado.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    </div>
                    <div className="col-12">
                    <strong className="d-block text-muted">Nombre:</strong>
                    <h5>{productoSeleccionado.nombre}</h5>
                    </div>
                    <div className="col-md-6">
                    <strong className="d-block text-muted">Categoría:</strong>
                    <span className={`badge ${
                        productoSeleccionado.categoria === 'Vehículos' ? 'bg-primary' :
                        productoSeleccionado.categoria === 'Personas' ? 'bg-success' :
                        'bg-info'
                    }`}>
                        {productoSeleccionado.categoria}
                    </span>
                    </div>
                    <div className="col-md-6">
                    <strong className="d-block text-muted">Vigencia:</strong>
                    {productoSeleccionado.vigenciaDias} días
                    </div>
                    {productoSeleccionado.descripcion && (
                    <div className="col-12">
                        <strong className="d-block text-muted">Descripción:</strong>
                        <p>{productoSeleccionado.descripcion}</p>
                    </div>
                    )}
                </div>
                </div>
            </div>

            {/* Compañías Disponibles */}
            <div className="card mt-3">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Compañías Disponibles</h5>
                {productoSeleccionado.companiasDisponibles?.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                    {productoSeleccionado.companiasDisponibles.map(compania => (
                        <span key={compania} className="badge bg-primary">
                        {compania}
                        </span>
                    ))}
                    </div>
                ) : (
                    <p className="text-muted mb-0">No hay compañías configuradas</p>
                )}
                </div>
            </div>

            {/* Coberturas */}
            <div className="card mt-3">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Coberturas</h5>
                {productoSeleccionado.coberturaBase && (
                    <div className="mb-3">
                    <strong>Cobertura Base:</strong>
                    <p className="mb-0">{productoSeleccionado.coberturaBase}</p>
                    </div>
                )}
                {productoSeleccionado.coberturasAdicionales?.length > 0 && (
                    <div>
                    <strong>Coberturas Adicionales:</strong>
                    <ul className="mb-0">
                        {productoSeleccionado.coberturasAdicionales.map((cobertura, index) => (
                        <li key={index}>{cobertura}</li>
                        ))}
                    </ul>
                    </div>
                )}
                {!productoSeleccionado.coberturaBase && !productoSeleccionado.coberturasAdicionales?.length && (
                    <p className="text-muted mb-0">No hay coberturas configuradas</p>
                )}
                </div>
            </div>

            {/* Requisitos */}
            <div className="card mt-3">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Requisitos y Restricciones</h5>
                <div className="row">
                    <div className="col-md-6">
                    {(productoSeleccionado.edadMinima || productoSeleccionado.edadMaxima) && (
                        <div className="mb-3">
                        <strong>Rango de Edad:</strong>
                        <p className="mb-0">
                            {productoSeleccionado.edadMinima || '0'} - {productoSeleccionado.edadMaxima || 'Sin límite'} años
                        </p>
                        </div>
                    )}
                    {productoSeleccionado.requiereInspeccion && (
                        <div>
                        <span className="badge bg-warning">
                            <AlertCircle size={14} className="me-1" />
                            Requiere Inspección
                        </span>
                        </div>
                    )}
                    </div>
                    <div className="col-md-6">
                    {productoSeleccionado.documentosRequeridos?.length > 0 && (
                        <div>
                        <strong>Documentos Requeridos:</strong>
                        <ul className="mb-0">
                            {productoSeleccionado.documentosRequeridos.map((doc, index) => (
                            <li key={index}>{doc}</li>
                            ))}
                        </ul>
                        </div>
                    )}
                    </div>
                </div>
                </div>
            </div>
            </div>

            {/* Estadísticas */}
            <div className="col-md-4">
            <div className="card">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Estadísticas</h5>
                <div className="text-center">
                    <div className="mb-3">
                    <div className="h2 text-primary mb-0">{estadisticas.total}</div>
                    <small className="text-muted">Total Expedientes</small>
                    </div>
                    <div className="mb-3">
                    <div className="h4 text-success mb-0">{estadisticas.vigentes}</div>
                    <small className="text-muted">Vigentes</small>
                    </div>
                    <div className="mb-3">
                    <div className="h4 text-warning mb-0">{estadisticas.enProceso}</div>
                    <small className="text-muted">En Proceso</small>
                    </div>
                    <div>
                    <div className="h4 text-danger mb-0">{estadisticas.cancelados}</div>
                    <small className="text-muted">Cancelados</small>
                    </div>
                </div>
                </div>
            </div>

            {/* Información Comercial */}
            <div className="card mt-3">
                <div className="card-body">
                <h5 className="card-title border-bottom pb-2">Información Comercial</h5>
                <div className="mb-3">
                    <strong className="d-block text-muted">Comisión Base:</strong>
                    <span className="h4 text-success">
                    {productoSeleccionado.comisionBase ? `${productoSeleccionado.comisionBase}%` : 'No configurada'}
                    </span>
                </div>
                <div>
                    <strong className="d-block text-muted">Fecha de Creación:</strong>
                    {productoSeleccionado.fechaCreacion || '-'}
                </div>
                </div>
            </div>
            </div>

            {/* Lista de Expedientes */}
            <div className="col-12">
            <div className="card">
                <div className="card-header">
                <h5 className="mb-0">Expedientes con este Producto</h5>
                </div>
                <div className="card-body">
                {expedientesDelProducto.length === 0 ? (
                    <p className="text-muted text-center py-4">No hay expedientes con este producto</p>
                ) : (
                    <div className="table-responsive">
                    <table className="table table-sm">
                        <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Compañía</th>
                            <th>Agente</th>
                            <th>Etapa Activa</th>
                            <th>Estatus Pago</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {expedientesDelProducto.slice(0, 10).map(expediente => (
                            <tr key={expediente.id}>
                            <td>{expediente.nombre} {expediente.apellidoPaterno}</td>
                            <td>{expediente.compania}</td>
                            <td>{expediente.agente || '-'}</td>
                            <td>
                                <span className={`badge ${
                                expediente.etapaActiva === 'Pagado' ? 'bg-success' :
                                expediente.etapaActiva === 'Cancelado' ? 'bg-danger' :
                                expediente.etapaActiva === 'Emitida' ? 'bg-info' :
                                expediente.etapaActiva === 'Autorizado' ? 'bg-primary' :
                                'bg-warning'
                                }`}>
                                {expediente.etapaActiva}
                                </span>
                            </td>
                            <td>
                                <span className={`badge ${
                                expediente.estatusPago === 'Pagado' ? 'bg-success' :
                                expediente.estatusPago === 'Vencido' ? 'bg-danger' :
                                expediente.estatusPago === 'Pago en período de gracia' ? 'bg-warning' :
                                'bg-secondary'
                                }`}>
                                {expediente.estatusPago || 'Sin definir'}
                                </span>
                            </td>
                            <td><small>{expediente.fechaCreacion}</small></td>
                            <td>
                                <button
                                onClick={() => verDetalles(expediente)}
                                className="btn btn-outline-primary btn-sm"
                                title="Ver detalles"
                                >
                                <Eye size={12} />
                                </button>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    {expedientesDelProducto.length > 10 && (
                        <div className="text-center mt-2">
                        <small className="text-muted">
                            Mostrando 10 de {expedientesDelProducto.length} expedientes
                        </small>
                        </div>
                    )}
                    </div>
                )}
                </div>
            </div>
            </div>
        </div>
        )}
        </>
    );
  };
  export default DetallesProducto;
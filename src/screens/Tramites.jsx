const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, FileText, X, Save, ChevronLeft, ChevronRight, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';

// Hook personalizado para paginación
const usePaginacion = (items, itemsPorPagina = 10) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const itemsFiltrados = useMemo(() => {
    if (!busqueda) return items;
    
    const busquedaLower = busqueda.toLowerCase();
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(busquedaLower)
    );
  }, [items, busqueda]);

  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);
  
  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return itemsFiltrados.slice(inicio, fin);
  }, [itemsFiltrados, paginaActual, itemsPorPagina]);

  const irAPagina = useCallback((pagina) => {
    setPaginaActual(Math.max(1, Math.min(pagina, totalPaginas)));
  }, [totalPaginas]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  return {
    itemsPaginados,
    paginaActual,
    totalPaginas,
    setPaginaActual: irAPagina,
    busqueda,
    setBusqueda,
    totalItems: itemsFiltrados.length
  };
};

// Componente de Paginación
const Paginacion = React.memo(({ paginaActual, totalPaginas, setPaginaActual }) => {
  if (totalPaginas <= 1) return null;

  const paginas = [];
  const maxPaginas = 5;
  let inicio = Math.max(1, paginaActual - Math.floor(maxPaginas / 2));
  let fin = Math.min(totalPaginas, inicio + maxPaginas - 1);
  
  if (fin - inicio + 1 < maxPaginas) {
    inicio = Math.max(1, fin - maxPaginas + 1);
  }

  for (let i = inicio; i <= fin; i++) {
    paginas.push(i);
  }

  return (
    <nav>
      <ul className="pagination justify-content-center mb-0">
        <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
          >
            <ChevronLeft size={16} />
          </button>
        </li>
        
        {inicio > 1 && (
          <>
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(1)}>1</button>
            </li>
            {inicio > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
          </>
        )}
        
        {paginas.map(pagina => (
          <li key={pagina} className={`page-item ${paginaActual === pagina ? 'active' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => setPaginaActual(pagina)}
            >
              {pagina}
            </button>
          </li>
        ))}
        
        {fin < totalPaginas && (
          <>
            {fin < totalPaginas - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(totalPaginas)}>{totalPaginas}</button>
            </li>
          </>
        )}
        
        <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
          >
            <ChevronRight size={16} />
          </button>
        </li>
      </ul>
    </nav>
  );
});

// Barra de búsqueda
const BarraBusqueda = React.memo(({ busqueda, setBusqueda, placeholder = "Buscar..." }) => (
  <div className="input-group mb-3">
    <span className="input-group-text">
      <Search size={20} />
    </span>
    <input
      type="text"
      className="form-control"
      placeholder={placeholder}
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    {busqueda && (
      <button 
        className="btn btn-outline-secondary" 
        type="button"
        onClick={() => setBusqueda('')}
      >
        <X size={16} />
      </button>
    )}
  </div>
));

// Lista de Trámites
const ListaTramitesComponent = ({ 
  tramites, 
  limpiarFormularioTramite, 
  setVistaActual, 
  verDetallesTramite, 
  editarTramite, 
  eliminarTramite 
}) => {
  const paginacion = usePaginacion(tramites, 10);

  const getEstatusColor = (estatus) => {
    switch (estatus) {
      case 'Pendiente': return 'bg-warning';
      case 'En proceso': return 'bg-info';
      case 'Completado': return 'bg-success';
      case 'Cancelado': return 'bg-danger';
      case 'Rechazado': return 'bg-secondary';
      default: return 'bg-secondary';
    }
  };

  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'Alta': return 'text-danger';
      case 'Media': return 'text-warning';
      case 'Baja': return 'text-success';
      default: return 'text-secondary';
    }
  };

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">Gestión de Trámites</h3>
            <p className="text-muted mb-0">Administra los trámites y documentos del sistema</p>
          </div>
          <button
            onClick={() => {
              limpiarFormularioTramite();
              setVistaActual('formulario-tramite');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Nuevo Trámite
          </button>
        </div>

        {tramites.length > 0 && (
          <>
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-center">
                <FileText className="me-2" size={20} />
                <div>
                  <strong>Gestión de Trámites:</strong> Aquí puedes administrar todos los trámites, 
                  documentos y procesos administrativos relacionados con los expedientes de seguros.
                </div>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <BarraBusqueda 
                  busqueda={paginacion.busqueda}
                  setBusqueda={paginacion.setBusqueda}
                  placeholder="Buscar trámites..."
                />
              </div>
              <div className="col-md-6 text-end">
                <small className="text-muted">
                  Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} trámites
                </small>
              </div>
            </div>
          </>
        )}

        <div className="card">
          {tramites.length === 0 ? (
            <div className="card-body text-center py-5">
              <FileText size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay trámites registrados</h5>
              <p className="text-muted">Crea tu primer trámite para comenzar a gestionar procesos administrativos</p>
            </div>
          ) : paginacion.itemsPaginados.length === 0 ? (
            <div className="card-body text-center py-5">
              <Search size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No se encontraron resultados</h5>
              <p className="text-muted">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Código</th>
                      <th>Tipo de Trámite</th>
                      <th>Cliente/Expediente</th>
                      <th>Estatus</th>
                      <th>Prioridad</th>
                      <th>Fecha Inicio</th>
                      <th>Fecha Límite</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacion.itemsPaginados.map((tramite) => (
                      <tr key={tramite.id}>
                        <td>
                          <strong className="text-primary">{tramite.codigo}</strong>
                        </td>
                        <td>
                          <div>
                            <div className="fw-semibold">{tramite.tipoTramite}</div>
                            <small className="text-muted">{tramite.descripcion}</small>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div>{tramite.cliente || '-'}</div>
                            <small className="text-muted">Exp: {tramite.expediente || 'N/A'}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getEstatusColor(tramite.estatus)}`}>
                            {tramite.estatus}
                          </span>
                        </td>
                        <td>
                          <span className={`fw-bold ${getPrioridadColor(tramite.prioridad)}`}>
                            {tramite.prioridad}
                          </span>
                        </td>
                        <td>
                          <small>{tramite.fechaInicio}</small>
                        </td>
                        <td>
                          <small className={tramite.fechaLimite && new Date(tramite.fechaLimite) < new Date() ? 'text-danger' : ''}>
                            {tramite.fechaLimite || '-'}
                          </small>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              onClick={() => verDetallesTramite(tramite)}
                              className="btn btn-outline-primary"
                              title="Ver detalles"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => editarTramite(tramite)}
                              className="btn btn-outline-success"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarTramite(tramite.id)}
                              className="btn btn-outline-danger"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paginacion.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion 
                    paginaActual={paginacion.paginaActual}
                    totalPaginas={paginacion.totalPaginas}
                    setPaginaActual={paginacion.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Formulario de Trámite
const FormularioTramite = ({ 
  modoEdicionTramite, 
  formularioTramite, 
  setFormularioTramite, 
  generarCodigoTramite, 
  setVistaActual, 
  guardarTramite 
}) => {
  const siguienteCodigo = !modoEdicionTramite ? generarCodigoTramite() : formularioTramite.codigo;
  
  // Obtener tipos de trámite del localStorage (catálogo de configuración)
  const tiposTramiteGuardados = JSON.parse(localStorage.getItem('sistemaseguros_tiposTramite') || '[]');
  
  // Debug: Mostrar en consola lo que se está leyendo
  console.log('Tipos de trámite guardados:', tiposTramiteGuardados);
  
  const tiposTramite = tiposTramiteGuardados.length > 0 
    ? tiposTramiteGuardados.filter(tipo => tipo.activo !== false).map(tipo => tipo.nombre)
    : [
        'Emisión de póliza',
        'Renovación',
        'Cancelación',
        'Endoso',
        'Reclamación',
        'Inspección',
        'Documentación',
        'Pago de prima',
        'Reembolso',
        'Otro'
      ];

  const estatusTramite = [
    'Pendiente',
    'En proceso',
    'Completado',
    'Cancelado',
    'Rechazado'
  ];

  const prioridades = ['Alta', 'Media', 'Baja'];

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">
            {modoEdicionTramite ? 'Editar Trámite' : 'Nuevo Trámite'}
          </h3>
          <button
            onClick={() => setVistaActual('tramites')}
            className="btn btn-outline-secondary"
          >
            Cancelar
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            {/* Información General */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Información General</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Código de Trámite</label>
                  <input
                    type="text"
                    className="form-control bg-light"
                    value={siguienteCodigo}
                    readOnly
                  />
                  <small className="form-text text-muted">Se asigna automáticamente</small>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Tipo de Trámite <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={formularioTramite.tipoTramite}
                    onChange={(e) => setFormularioTramite({...formularioTramite, tipoTramite: e.target.value})}
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposTramite.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                  {tiposTramiteGuardados.length === 0 && (
                    <small className="form-text text-info">
                      💡 Puedes configurar tipos personalizados en "Configuración de Tablas"
                    </small>
                  )}
                  {tiposTramiteGuardados.length > 0 && (
                    <small className="form-text text-success">
                      ✅ Usando catálogo personalizado ({tiposTramite.length} tipos disponibles de {tiposTramiteGuardados.length} totales)
                    </small>
                  )}
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Estatus</label>
                  <select
                    className="form-select"
                    value={formularioTramite.estatus}
                    onChange={(e) => setFormularioTramite({...formularioTramite, estatus: e.target.value})}
                  >
                    {estatusTramite.map(estatus => (
                      <option key={estatus} value={estatus}>{estatus}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-md-12">
                  <label className="form-label">Descripción <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formularioTramite.descripcion}
                    onChange={(e) => setFormularioTramite({...formularioTramite, descripcion: e.target.value})}
                    placeholder="Describe el trámite a realizar..."
                    required
                  />
                </div>
              </div>
            </div>

            {/* Información del Cliente/Expediente */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Cliente y Póliza</h5>
              
              {/* Selector de Cliente */}
              <div className="row g-3 mb-3">
                <div className="col-12">
                  <label className="form-label">Cliente <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={formularioTramite.clienteId || ''}
                    onChange={(e) => {
                      const clienteId = e.target.value;
                      setFormularioTramite({
                        ...formularioTramite, 
                        clienteId: clienteId,
                        cliente: clienteId ? clientes.find(c => c.id === parseInt(clienteId))?.nombre : '',
                        polizaId: '',
                        expediente: ''
                      });
                      // Cargar pólizas del cliente
                      if (clienteId) {
                        cargarPolizasCliente(clienteId);
                      } else {
                        setPolizasCliente([]);
                      }
                    }}
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.codigo} - {cliente.nombre} {cliente.apellido_paterno}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">Seleccione el cliente para ver sus pólizas vigentes</small>
                </div>
              </div>

              {/* Lista de Pólizas del Cliente */}
              {formularioTramite.clienteId && (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Póliza Vigente <span className="text-danger">*</span></label>
                    {cargandoPolizas ? (
                      <div className="alert alert-info">
                        <Clock size={16} className="me-2" />
                        Cargando pólizas...
                      </div>
                    ) : polizasCliente.length === 0 ? (
                      <div className="alert alert-warning">
                        <AlertCircle size={16} className="me-2" />
                        Este cliente no tiene pólizas vigentes
                      </div>
                    ) : (
                      <div className="list-group">
                        {polizasCliente.map(poliza => (
                          <label 
                            key={poliza.id}
                            className={`list-group-item list-group-item-action ${formularioTramite.polizaId === poliza.id ? 'active' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex align-items-start">
                              <input
                                type="radio"
                                className="form-check-input me-3 mt-1"
                                name="polizaSeleccionada"
                                checked={formularioTramite.polizaId === poliza.id}
                                onChange={() => {
                                  setFormularioTramite({
                                    ...formularioTramite,
                                    polizaId: poliza.id,
                                    expediente: poliza.numero_poliza || poliza.codigo,
                                    aseguradoraId: poliza.aseguradora_id,
                                    productoId: poliza.producto_id,
                                    agenteId: poliza.agente_id
                                  });
                                }}
                              />
                              <div className="flex-grow-1">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <div>
                                    <h6 className="mb-1">
                                      <span className="badge bg-primary me-2">{poliza.numero_poliza || poliza.codigo}</span>
                                      {poliza.compania || poliza.aseguradora}
                                    </h6>
                                    <p className="mb-1 text-muted small">
                                      <strong>Producto:</strong> {poliza.producto}
                                    </p>
                                  </div>
                                  <span className={`badge ${poliza.etapa_activa === 'Emitida' ? 'bg-success' : 'bg-info'}`}>
                                    {poliza.etapa_activa}
                                  </span>
                                </div>
                                <div className="row g-2 small">
                                  <div className="col-md-4">
                                    <strong>Vigencia:</strong><br/>
                                    {poliza.inicio_vigencia ? new Date(poliza.inicio_vigencia).toLocaleDateString() : 'N/A'} - {poliza.termino_vigencia ? new Date(poliza.termino_vigencia).toLocaleDateString() : 'N/A'}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>Prima:</strong> ${parseFloat(poliza.prima_pagada || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>Agente:</strong> {poliza.agente || 'No asignado'}
                                  </div>
                                </div>
                                {poliza.producto === 'Autos' && poliza.marca && (
                                  <div className="mt-2 small text-muted">
                                    <strong>Vehículo:</strong> {poliza.marca} {poliza.modelo} {poliza.anio} - {poliza.placas || 'Sin placas'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Fechas y Prioridad */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Fechas y Prioridad</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Fecha de Inicio</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formularioTramite.fechaInicio}
                    onChange={(e) => setFormularioTramite({...formularioTramite, fechaInicio: e.target.value})}
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Fecha Límite</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formularioTramite.fechaLimite}
                    onChange={(e) => setFormularioTramite({...formularioTramite, fechaLimite: e.target.value})}
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Prioridad</label>
                  <select
                    className="form-select"
                    value={formularioTramite.prioridad}
                    onChange={(e) => setFormularioTramite({...formularioTramite, prioridad: e.target.value})}
                  >
                    {prioridades.map(prioridad => (
                      <option key={prioridad} value={prioridad}>{prioridad}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Responsable y Observaciones */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Responsable y Observaciones</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Responsable</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioTramite.responsable}
                    onChange={(e) => setFormularioTramite({...formularioTramite, responsable: e.target.value})}
                    placeholder="Persona responsable del trámite"
                  />
                </div>
                
                <div className="col-md-6">
                  <label className="form-label">Departamento</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioTramite.departamento}
                    onChange={(e) => setFormularioTramite({...formularioTramite, departamento: e.target.value})}
                    placeholder="Departamento encargado"
                  />
                </div>
                
                <div className="col-md-12">
                  <label className="form-label">Observaciones</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formularioTramite.observaciones}
                    onChange={(e) => setFormularioTramite({...formularioTramite, observaciones: e.target.value})}
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button
                type="button"
                onClick={() => setVistaActual('tramites')}
                className="btn btn-outline-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarTramite}
                className="btn btn-primary"
              >
                <Save size={16} className="me-2" />
                {modoEdicionTramite ? 'Actualizar' : 'Guardar'} Trámite
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Detalles del Trámite
const DetallesTramite = ({ 
  tramiteSeleccionado, 
  editarTramite, 
  setVistaActual 
}) => {
  const getEstatusColor = (estatus) => {
    switch (estatus) {
      case 'Pendiente': return 'bg-warning';
      case 'En proceso': return 'bg-info';
      case 'Completado': return 'bg-success';
      case 'Cancelado': return 'bg-danger';
      case 'Rechazado': return 'bg-secondary';
      default: return 'bg-secondary';
    }
  };

  const getPrioridadColor = (prioridad) => {
    switch (prioridad) {
      case 'Alta': return 'text-danger';
      case 'Media': return 'text-warning';
      case 'Baja': return 'text-success';
      default: return 'text-secondary';
    }
  };

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">Detalles del Trámite</h3>
          <div className="d-flex gap-3">
            <button
              onClick={() => editarTramite(tramiteSeleccionado)}
              className="btn btn-primary d-flex align-items-center"
            >
              <Edit size={16} className="me-2" />
              Editar
            </button>
            <button
              onClick={() => setVistaActual('tramites')}
              className="btn btn-outline-secondary"
            >
              Volver
            </button>
          </div>
        </div>

        {tramiteSeleccionado && (
          <div className="row g-4">
            {/* Información General */}
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Información General</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Código:</strong>
                      <span className="h5 text-primary">{tramiteSeleccionado.codigo}</span>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Estatus:</strong>
                      <span className={`badge ${getEstatusColor(tramiteSeleccionado.estatus)} fs-6`}>
                        {tramiteSeleccionado.estatus}
                      </span>
                    </div>
                    <div className="col-12">
                      <strong className="d-block text-muted">Tipo de Trámite:</strong>
                      <h5>{tramiteSeleccionado.tipoTramite}</h5>
                    </div>
                    <div className="col-12">
                      <strong className="d-block text-muted">Descripción:</strong>
                      <p>{tramiteSeleccionado.descripcion}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cliente y Expediente */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Cliente y Expediente</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Cliente:</strong>
                      {tramiteSeleccionado.cliente || '-'}
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Expediente:</strong>
                      {tramiteSeleccionado.expediente || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsable */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Responsable</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Responsable:</strong>
                      {tramiteSeleccionado.responsable || '-'}
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Departamento:</strong>
                      {tramiteSeleccionado.departamento || '-'}
                    </div>
                    {tramiteSeleccionado.observaciones && (
                      <div className="col-12">
                        <strong className="d-block text-muted">Observaciones:</strong>
                        <p>{tramiteSeleccionado.observaciones}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Fechas y Prioridad */}
            <div className="col-md-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Fechas y Prioridad</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Prioridad:</strong>
                    <span className={`h4 ${getPrioridadColor(tramiteSeleccionado.prioridad)}`}>
                      {tramiteSeleccionado.prioridad}
                    </span>
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Fecha de Inicio:</strong>
                    {tramiteSeleccionado.fechaInicio || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Fecha Límite:</strong>
                    <span className={tramiteSeleccionado.fechaLimite && new Date(tramiteSeleccionado.fechaLimite) < new Date() ? 'text-danger' : ''}>
                      {tramiteSeleccionado.fechaLimite || '-'}
                    </span>
                  </div>
                  <div>
                    <strong className="d-block text-muted">Fecha de Creación:</strong>
                    {tramiteSeleccionado.fechaCreacion}
                  </div>
                </div>
              </div>

              {/* Indicadores */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Indicadores</h5>
                  <div className="text-center">
                    {tramiteSeleccionado.fechaLimite && new Date(tramiteSeleccionado.fechaLimite) < new Date() && (
                      <div className="alert alert-danger">
                        <AlertCircle size={20} className="me-2" />
                        <strong>Vencido</strong>
                      </div>
                    )}
                    {tramiteSeleccionado.estatus === 'Completado' && (
                      <div className="alert alert-success">
                        <CheckCircle size={20} className="me-2" />
                        <strong>Completado</strong>
                      </div>
                    )}
                    {tramiteSeleccionado.estatus === 'En proceso' && (
                      <div className="alert alert-info">
                        <Clock size={20} className="me-2" />
                        <strong>En Proceso</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente principal para la gestión de Trámites
export const Tramites = () => {
  // Estados principales para trámites
  const [tramites, setTramites] = useState([]);
  const [tramiteSeleccionado, setTramiteSeleccionado] = useState(null);
  const [vistaActual, setVistaActual] = useState('tramites');
  const [modoEdicionTramite, setModoEdicionTramite] = useState(false);

  // Estados para clientes y pólizas
  const [clientes, setClientes] = useState([]);
  const [polizasCliente, setPolizasCliente] = useState([]);
  const [cargandoPolizas, setCargandoPolizas] = useState(false);

  // Estado del formulario de trámite
  const [formularioTramite, setFormularioTramite] = useState({
    codigo: '',
    tipoTramite: '',
    descripcion: '',
    clienteId: '',
    cliente: '',
    polizaId: '',
    expediente: '',
    aseguradoraId: '',
    productoId: '',
    agenteId: '',
    ejecutivoId: '',
    estatus: 'Pendiente',
    prioridad: 'Media',
    fechaInicio: new Date().toISOString().split('T')[0],
    fechaLimite: '',
    responsable: '',
    departamento: '',
    observaciones: '',
    fechaCreacion: new Date().toISOString().split('T')[0],
    id: null
  });

  // Cargar trámites desde el backend al montar el componente
  useEffect(() => {
  fetch(`${API_URL}/api/tramites`)
      .then(res => res.json())
      .then(data => setTramites(data))
      .catch(err => console.error('Error al cargar trámites:', err));
  }, []);

  // Cargar clientes al montar el componente
  useEffect(() => {
    fetch(`${API_URL}/api/clientes`)
      .then(res => res.json())
      .then(data => setClientes(data))
      .catch(err => console.error('Error al cargar clientes:', err));
  }, []);

  // Función para cargar pólizas vigentes de un cliente
  const cargarPolizasCliente = useCallback(async (clienteId) => {
    setCargandoPolizas(true);
    try {
      // TODO: Cuando Hugo implemente el endpoint, usar:
      // const response = await fetch(`${API_URL}/api/expedientes/vigentes/${clienteId}`);
      
      // Por ahora, simulamos con todas las pólizas filtradas en frontend
      const response = await fetch(`${API_URL}/api/expedientes`);
      const data = await response.json();
      
      // Filtrar pólizas del cliente y que estén vigentes
      const hoy = new Date();
      const polizasVigentes = data.filter(exp => {
        // Buscar por cliente_id si existe, sino por nombre
        const esDelCliente = exp.cliente_id 
          ? exp.cliente_id === parseInt(clienteId)
          : false; // Por ahora solo si tiene cliente_id
        
        // Verificar que esté emitida y vigente
        const estaEmitida = exp.etapa_activa === 'Emitida' || exp.etapa_activa === 'Autorizado';
        
        // Verificar vigencia por fechas
        const vigente = exp.termino_vigencia 
          ? new Date(exp.termino_vigencia) > hoy
          : true;
        
        return esDelCliente && estaEmitida && vigente;
      });
      
      setPolizasCliente(polizasVigentes);
    } catch (err) {
      console.error('Error al cargar pólizas:', err);
      setPolizasCliente([]);
    } finally {
      setCargandoPolizas(false);
    }
  }, []);

  // Refrescar trámites tras operaciones CRUD
  const cargarTramites = useCallback(() => {
  fetch(`${API_URL}/api/tramites`)
      .then(res => res.json())
      .then(data => setTramites(data))
      .catch(err => console.error('Error al cargar trámites:', err));
  }, []);

  // Función para generar códigos de trámite
  const generarCodigoTramite = useCallback(() => {
    if (tramites.length === 0) {
      return 'TR001';
    }
    const numeros = tramites
      .map(tramite => {
        const match = tramite.codigo.match(/TR(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    return `TR${siguienteNumero.toString().padStart(3, '0')}`;
  }, [tramites]);

  // Funciones CRUD para Trámites
  const limpiarFormularioTramite = useCallback(() => {
    setFormularioTramite({
      codigo: '',
      tipoTramite: '',
      descripcion: '',
      clienteId: '',
      cliente: '',
      polizaId: '',
      expediente: '',
      aseguradoraId: '',
      productoId: '',
      agenteId: '',
      ejecutivoId: '',
      estatus: 'Pendiente',
      prioridad: 'Media',
      fechaInicio: new Date().toISOString().split('T')[0],
      fechaLimite: '',
      responsable: '',
      departamento: '',
      observaciones: '',
      fechaCreacion: new Date().toISOString().split('T')[0],
      id: null
    });
    setModoEdicionTramite(false);
    setTramiteSeleccionado(null);
    setPolizasCliente([]);
  }, []);

  // Crear o actualizar trámite en el backend
  const guardarTramite = useCallback(() => {
    if (!formularioTramite.tipoTramite || !formularioTramite.descripcion) {
      alert('Por favor complete los campos obligatorios: Tipo de Trámite y Descripción');
      return;
    }
    const codigoTramite = formularioTramite.codigo || generarCodigoTramite();
    const tramitePayload = {
      ...formularioTramite,
      codigo: codigoTramite
    };
    if (modoEdicionTramite) {
      // Actualizar
  fetch(`${API_URL}/api/tramites/${formularioTramite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tramitePayload)
      })
        .then(res => res.json())
        .then(() => {
          cargarTramites();
          limpiarFormularioTramite();
          setVistaActual('tramites');
        })
        .catch(err => alert('Error al actualizar trámite'));
    } else {
      // Crear
  fetch(`${API_URL}/api/tramites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tramitePayload)
      })
        .then(res => res.json())
        .then(() => {
          cargarTramites();
          limpiarFormularioTramite();
          setVistaActual('tramites');
        })
        .catch(err => alert('Error al crear trámite'));
    }
  }, [formularioTramite, modoEdicionTramite, generarCodigoTramite, limpiarFormularioTramite, cargarTramites]);

  // Editar trámite (solo cambia la vista y el formulario)
  const editarTramite = useCallback((tramite) => {
    setFormularioTramite(tramite);
    setModoEdicionTramite(true);
    setVistaActual('formulario-tramite');
  }, []);

  // Eliminar trámite en el backend
  const eliminarTramite = useCallback((id) => {
    if (confirm('¿Está seguro de eliminar este trámite?')) {
  fetch(`${API_URL}/api/tramites/${id}`, {
        method: 'DELETE'
      })
        .then(() => cargarTramites())
        .catch(err => alert('Error al eliminar trámite'));
    }
  }, [cargarTramites]);

  // Ver detalles de trámite
  const verDetallesTramite = useCallback((tramite) => {
    setTramiteSeleccionado(tramite);
    setVistaActual('detalles-tramite');
  }, []);

  // Renderizado condicional basado en la vista actual
  return (
    <div>
      {vistaActual === 'tramites' && (
        <ListaTramitesComponent 
          tramites={tramites}
          limpiarFormularioTramite={limpiarFormularioTramite}
          setVistaActual={setVistaActual}
          verDetallesTramite={verDetallesTramite}
          editarTramite={editarTramite}
          eliminarTramite={eliminarTramite}
        />
      )}
      {vistaActual === 'formulario-tramite' && (
        <FormularioTramite 
          modoEdicionTramite={modoEdicionTramite}
          formularioTramite={formularioTramite}
          setFormularioTramite={setFormularioTramite}
          generarCodigoTramite={generarCodigoTramite}
          setVistaActual={setVistaActual}
          guardarTramite={guardarTramite}
        />
      )}
      {vistaActual === 'detalles-tramite' && tramiteSeleccionado && (
        <DetallesTramite 
          tramiteSeleccionado={tramiteSeleccionado}
          editarTramite={editarTramite}
          setVistaActual={setVistaActual}
        />
      )}
    </div>
  );
};

export default Tramites;
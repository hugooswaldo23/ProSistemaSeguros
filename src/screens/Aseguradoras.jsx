import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, Shield, X, Save, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { obtenerTiposProductos } from '../services/tiposProductosService';

// Base URL configurable por env Vite
const API_URL = import.meta.env.VITE_API_URL || '';

const useProductosDB = () => {
  const [productosDB, setProductosDB] = useState([]);
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const res = await obtenerTiposProductos();
        const productos = res?.data?.data || res?.data || [];
        setProductosDB(productos);
      } catch (err) {
        console.error('Error al cargar tipos de productos:', err);
        setProductosDB([]);
      }
    };
    fetchProductos();
  }, []);
  return productosDB;
};

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

// Componente Lista de Aseguradoras
const ListaAseguradorasComponent = ({ 
  aseguradoras, 
  polizas, 
  limpiarFormularioAseguradora, 
  setVistaActual, 
  verDetallesAseguradora, 
  editarAseguradora, 
  eliminarAseguradora 
}) => {
  const paginacion = usePaginacion(aseguradoras, 10);

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">Gestión de Aseguradoras</h3>
            <p className="text-muted mb-0">Administra las compañías aseguradoras del sistema</p>
          </div>
          <button
            onClick={() => {
              limpiarFormularioAseguradora();
              setVistaActual('formulario-aseguradora');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Nueva Aseguradora
          </button>
        </div>

        {aseguradoras.length > 0 && (
          <>
            <div className="alert alert-info mb-4">
              <div className="d-flex align-items-center">
                <Shield className="me-2" size={20} />
                <div>
                  <strong>Gestión de Aseguradoras:</strong> Aquí puedes administrar las compañías con las que trabajas. 
                  Las aseguradoras activas aparecerán automáticamente en los formularios de pólizas.
                </div>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <BarraBusqueda 
                  busqueda={paginacion.busqueda}
                  setBusqueda={paginacion.setBusqueda}
                  placeholder="Buscar aseguradoras..."
                />
              </div>
              <div className="col-md-6 text-end">
                <small className="text-muted">
                  Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} aseguradoras
                </small>
              </div>
            </div>
          </>
        )}

        <div className="card">
          {aseguradoras.length === 0 ? (
            <div className="card-body text-center py-5">
              <Shield size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay aseguradoras registradas</h5>
              <p className="text-muted">Registra las compañías aseguradoras con las que trabajas</p>
              <div className="mt-3">
                <small className="text-info">
                  📋 Al no tener aseguradoras registradas, el sistema usará las compañías predefinidas
                </small>
              </div>
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
                      <th>Aseguradora</th>
                      <th>RFC</th>
                      <th>Contacto</th>
                      <th>Productos</th>
                      <th>Estado</th>
                      <th>Pólizas</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacion.itemsPaginados.map((aseguradora) => {
                      const polizasAseguradora = polizas.filter(exp => exp.compania === aseguradora.nombre).length;
                      return (
                        <tr key={aseguradora.id}>
                          <td>
                            <strong className="text-primary">{aseguradora.codigo}</strong>
                          </td>
                          <td>
                            <div>
                              <div className="fw-semibold">{aseguradora.nombre}</div>
                              <small className="text-muted">{aseguradora.razonSocial || aseguradora.nombre}</small>
                            </div>
                          </td>
                          <td>
                            <small>{aseguradora.rfc}</small>
                          </td>
                          <td>
                            <div>
                              <small className="d-block">{aseguradora.contactoPrincipal || '-'}</small>
                              <small className="text-muted">{aseguradora.telefono || '-'}</small>
                            </div>
                          </td>
                          <td>
                            {aseguradora.productos_disponibles?.length > 0 ? (
                              <div>
                                <span className="badge bg-primary">
                                  {aseguradora.productos_disponibles.length} productos
                                </span>
                              </div>
                            ) : (
                              <small className="text-muted">Sin productos</small>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${aseguradora.activo ? 'bg-success' : 'bg-secondary'}`}>
                              {aseguradora.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-info">{polizasAseguradora}</span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                              <button
                                onClick={() => verDetallesAseguradora(aseguradora)}
                                className="btn btn-outline-primary"
                                title="Ver detalles"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => editarAseguradora(aseguradora)}
                                className="btn btn-outline-success"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => eliminarAseguradora(aseguradora.id)}
                                className="btn btn-outline-danger"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

// Componente Formulario de Aseguradora - COMPLETAMENTE ACTUALIZADO
const FormularioAseguradora = ({
  modoEdicionAseguradora,
  formularioAseguradora,
  setFormularioAseguradora,
  generarCodigoAseguradora,
  setVistaActual,
  guardarAseguradora,
  productos,
}) => {
  const productosDB = useProductosDB();
  const [showProductosModal, setShowProductosModal] = useState(false);
  const [productosSeleccionadosTemp, setProductosSeleccionadosTemp] = useState([]);
  
  // Sincronizar productos seleccionados cuando cambia el formulario
  useEffect(() => {
    if (formularioAseguradora.productos_disponibles) {
      // Si es array de objetos con estructura {producto_id, comision}
      if (formularioAseguradora.productos_disponibles.length > 0 && 
          typeof formularioAseguradora.productos_disponibles[0] === 'object') {
        setProductosSeleccionadosTemp(
          formularioAseguradora.productos_disponibles.map(p => String(p.producto_id))
        );
      } 
      // Si es array simple de IDs
      else {
        setProductosSeleccionadosTemp(
          formularioAseguradora.productos_disponibles.map(id => String(id))
        );
      }
    }
  }, [formularioAseguradora.productos_disponibles]);

  const siguienteCodigo = !modoEdicionAseguradora ? generarCodigoAseguradora() : formularioAseguradora.codigo;
  const estadosMexico = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 
    'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 
    'Guerrero', 'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 
    'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 
    'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
  ];

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">
            {modoEdicionAseguradora ? 'Editar Aseguradora' : 'Nueva Aseguradora'}
          </h3>
          <button
            onClick={() => setVistaActual('aseguradoras')}
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
                  <label className="form-label">Código de Aseguradora</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={siguienteCodigo}
                      readOnly
                    />
                    <span className="input-group-text">
                      {modoEdicionAseguradora ? 
                        <span className="text-warning" title="Código no se puede modificar">🔒</span> : 
                        <span className="text-success" title="Se asignará automáticamente">✓</span>
                      }
                    </span>
                  </div>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Nombre Comercial <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.nombre}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, nombre: e.target.value})}
                    placeholder="Ej: Qualitas"
                    required
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">RFC <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.rfc}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, rfc: e.target.value.toUpperCase()})}
                    placeholder="Ej: QUA990125XX0"
                    maxLength="13"
                    required
                  />
                </div>
                
                <div className="col-md-8">
                  <label className="form-label">Razón Social</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.razonSocial}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, razonSocial: e.target.value})}
                    placeholder="Ej: Quálitas Compañía de Seguros S.A. de C.V."
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={formularioAseguradora.activo}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, activo: e.target.value === 'true'})}
                  >
                    <option value={true}>Activa</option>
                    <option value={false}>Inactiva</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Información de Contacto</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Teléfono Principal</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formularioAseguradora.telefono}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, telefono: e.target.value})}
                    placeholder="Ej: 55 5555 5555"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Email Corporativo</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formularioAseguradora.email}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, email: e.target.value})}
                    placeholder="contacto@aseguradora.com"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Sitio Web</label>
                  <input
                    type="url"
                    className="form-control"
                    value={formularioAseguradora.sitioWeb}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, sitioWeb: e.target.value})}
                    placeholder="https://www.aseguradora.com"
                  />
                </div>
              </div>
            </div>

            {/* Dirección */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Dirección</h5>
              <div className="row g-3">
                <div className="col-md-12">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.direccion}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, direccion: e.target.value})}
                    placeholder="Calle, número, colonia"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Ciudad</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.ciudad}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, ciudad: e.target.value})}
                    placeholder="Ej: Guadalajara"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={formularioAseguradora.estado}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, estado: e.target.value})}
                  >
                    <option value="">Seleccionar estado</option>
                    {estadosMexico.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Código Postal</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.codigoPostal}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, codigoPostal: e.target.value})}
                    placeholder="Ej: 44100"
                    maxLength="5"
                  />
                </div>
              </div>
            </div>

            {/* CONFIGURACIÓN COMERCIAL ACTUALIZADA */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Configuración Comercial</h5>
              
              {/* Selección de Productos y Tiempo de Emisión */}
              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <label className="form-label">Productos Disponibles</label>
                  <div>
                    <button 
                      type="button" 
                      className="btn btn-outline-primary"
                      onClick={() => {
                        // Preparar array temporal con solo IDs
                        const ids = formularioAseguradora.productos_disponibles?.map(p => 
                          typeof p === 'object' ? String(p.producto_id) : String(p)
                        ) || [];
                        setProductosSeleccionadosTemp(ids);
                        setShowProductosModal(true);
                      }}
                    >
                      <Plus size={16} className="me-2" />
                      Seleccionar Productos
                    </button>
                    {formularioAseguradora.productos_disponibles?.length > 0 && (
                      <span className="ms-3 text-muted">
                        {formularioAseguradora.productos_disponibles.length} producto(s) seleccionado(s)
                      </span>
                    )}
                  </div>
                  <small className="form-text text-muted">
                    Seleccione los productos que manejará esta aseguradora
                  </small>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Tiempo Emisión (días)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formularioAseguradora.tiempoEmision}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, tiempoEmision: e.target.value})}
                    min="0"
                    placeholder="Ej: 3"
                  />
                </div>
              </div>

              {/* Tabla de Comisiones - SIEMPRE VISIBLE SI HAY PRODUCTOS */}
              {formularioAseguradora.productos_disponibles?.length > 0 && (
                <div className="mt-4">
                  <div className="d-flex align-items-center mb-3">
                    <Shield size={20} className="text-primary me-2" />
                    <strong>Comisiones por Producto</strong>
                  </div>
                  <div className="alert alert-info">
                    <small>Defina el porcentaje de comisión del agente para cada producto seleccionado</small>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th width="60">#</th>
                          <th>Producto</th>
                          <th width="250">Comisión del Agente (%)</th>
                          <th width="100">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formularioAseguradora.productos_disponibles.map((item, index) => {
                          const productoId = typeof item === 'object' ? item.producto_id : item;
                          const comision = typeof item === 'object' ? item.comision : '0';
                          const producto = productosDB.find(p => String(p.id) === String(productoId));
                          
                          return (
                            <tr key={productoId}>
                              <td className="text-center">{index + 1}</td>
                              <td>
                                <div>
                                  <strong>{producto?.nombre || `Producto ${productoId}`}</strong>
                                  {producto?.descripcion && (
                                    <div className="text-muted small">{producto.descripcion}</div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="input-group">
                                  <input
                                    type="number"
                                    className="form-control"
                                    value={comision}
                                    onChange={(e) => {
                                      const nuevosProductos = [...formularioAseguradora.productos_disponibles];
                                      nuevosProductos[index] = {
                                        producto_id: String(productoId),
                                        comision: e.target.value
                                      };
                                      setFormularioAseguradora({
                                        ...formularioAseguradora,
                                        productos_disponibles: nuevosProductos
                                      });
                                    }}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    placeholder="0.0"
                                  />
                                  <span className="input-group-text">%</span>
                                </div>
                              </td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => {
                                    const nuevosProductos = formularioAseguradora.productos_disponibles.filter(
                                      (_, i) => i !== index
                                    );
                                    setFormularioAseguradora({
                                      ...formularioAseguradora,
                                      productos_disponibles: nuevosProductos
                                    });
                                  }}
                                  title="Eliminar producto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Modal de Selección de Productos */}
              {showProductosModal && (
                <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                  <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                      <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">Seleccionar Productos</h5>
                        <button 
                          type="button" 
                          className="btn-close btn-close-white"
                          onClick={() => setShowProductosModal(false)}
                        ></button>
                      </div>
                      <div className="modal-body">
                        <div className="alert alert-info">
                          <small>Seleccione los productos disponibles para esta aseguradora. Podrá configurar las comisiones después de cerrar este modal.</small>
                        </div>
                        <div className="row g-3">
                          {productosDB.map(producto => (
                            <div key={producto.id} className="col-md-6">
                              <div className={`card ${productosSeleccionadosTemp.includes(String(producto.id)) ? 'border-primary bg-light' : ''}`}>
                                <div className="card-body">
                                  <div className="form-check">
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      id={`producto-${producto.id}`}
                                      checked={productosSeleccionadosTemp.includes(String(producto.id))}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setProductosSeleccionadosTemp([...productosSeleccionadosTemp, String(producto.id)]);
                                        } else {
                                          setProductosSeleccionadosTemp(
                                            productosSeleccionadosTemp.filter(id => id !== String(producto.id))
                                          );
                                        }
                                      }}
                                    />
                                    <label htmlFor={`producto-${producto.id}`} className="form-check-label">
                                      <strong>{producto.nombre}</strong>
                                      {producto.descripcion && (
                                        <div className="text-muted small">{producto.descripcion}</div>
                                      )}
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="modal-footer">
                        <div className="w-100 d-flex justify-content-between align-items-center">
                          <span className="text-muted">
                            {productosSeleccionadosTemp.length} producto(s) seleccionado(s)
                          </span>
                          <div>
                            <button 
                              type="button" 
                              className="btn btn-outline-secondary me-2"
                              onClick={() => setShowProductosModal(false)}
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-primary"
                              onClick={() => {
                                // Crear nueva estructura manteniendo comisiones existentes
                                const nuevosProductos = productosSeleccionadosTemp.map(id => {
                                  const productoExistente = formularioAseguradora.productos_disponibles?.find(p => 
                                    (typeof p === 'object' ? p.producto_id : p) === id
                                  );
                                  
                                  if (productoExistente && typeof productoExistente === 'object') {
                                    return productoExistente; // Mantener comisión existente
                                  }
                                  return {
                                    producto_id: id,
                                    comision: '0' // Comisión por defecto
                                  };
                                });
                                
                                setFormularioAseguradora({
                                  ...formularioAseguradora,
                                  productos_disponibles: nuevosProductos
                                });
                                setShowProductosModal(false);
                              }}
                            >
                              Aceptar Selección
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contacto Principal */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Contacto Principal</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Nombre del Contacto</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioAseguradora.contactoPrincipal}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, contactoPrincipal: e.target.value})}
                    placeholder="Nombre completo"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Teléfono del Contacto</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formularioAseguradora.telefonoContacto}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, telefonoContacto: e.target.value})}
                    placeholder="Ej: 55 5555 5555"
                  />
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Email del Contacto</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formularioAseguradora.emailContacto}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, emailContacto: e.target.value})}
                    placeholder="contacto@email.com"
                  />
                </div>
                
                <div className="col-md-12">
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formularioAseguradora.notas}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, notas: e.target.value})}
                    placeholder="Información adicional sobre la aseguradora..."
                  />
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button
                type="button"
                onClick={() => setVistaActual('aseguradoras')}
                className="btn btn-outline-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarAseguradora}
                className="btn btn-primary"
              >
                <Save size={16} className="me-2" />
                {modoEdicionAseguradora ? 'Actualizar' : 'Guardar'} Aseguradora
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente Detalles de Aseguradora
const DetallesAseguradora = ({ 
  aseguradoraSeleccionada, 
  polizas, 
  productos, 
  editarAseguradora, 
  setVistaActual 
}) => {
  const productosDB = useProductosDB();
  const polizasDeAseguradora = useMemo(() => 
    polizas.filter(exp => exp.compania === aseguradoraSeleccionada?.nombre),
    [polizas, aseguradoraSeleccionada]
  );

  const estadisticas = useMemo(() => ({
    total: polizasDeAseguradora.length,
    vigentes: polizasDeAseguradora.filter(exp => exp.etapaActiva === 'Pagado').length,
    enProceso: polizasDeAseguradora.filter(exp => 
      ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(exp.etapaActiva)
    ).length,
    cancelados: polizasDeAseguradora.filter(exp => exp.etapaActiva === 'Cancelado').length,
    porProducto: productos.reduce((acc, producto) => {
      acc[producto] = polizasDeAseguradora.filter(exp => exp.producto === producto).length;
      return acc;
    }, {})
  }), [polizasDeAseguradora, productos]);

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">Detalles de la Aseguradora</h3>
          <div className="d-flex gap-3">
            <button
              onClick={() => editarAseguradora(aseguradoraSeleccionada)}
              className="btn btn-primary d-flex align-items-center"
            >
              <Edit size={16} className="me-2" />
              Editar
            </button>
            <button
              onClick={() => setVistaActual('aseguradoras')}
              className="btn btn-outline-secondary"
            >
              Volver
            </button>
          </div>
        </div>

        {aseguradoraSeleccionada && (
          <div className="row g-4">
            {/* Información General */}
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Información General</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Código:</strong>
                      <span className="h5 text-primary">{aseguradoraSeleccionada.codigo}</span>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Estado:</strong>
                      <span className={`badge ${aseguradoraSeleccionada.activo ? 'bg-success' : 'bg-secondary'} fs-6`}>
                        {aseguradoraSeleccionada.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <div className="col-12">
                      <strong className="d-block text-muted">Nombre Comercial:</strong>
                      <h5>{aseguradoraSeleccionada.nombre}</h5>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">RFC:</strong>
                      {aseguradoraSeleccionada.rfc}
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Fecha de Registro:</strong>
                      {aseguradoraSeleccionada.fechaRegistro}
                    </div>
                    <div className="col-12">
                      <strong className="d-block text-muted">Razón Social:</strong>
                      {aseguradoraSeleccionada.razonSocial || aseguradoraSeleccionada.nombre}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Estadísticas y Configuración */}
            <div className="col-md-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Estadísticas</h5>
                  <div className="text-center">
                    <div className="mb-3">
                      <div className="h2 text-primary mb-0">{estadisticas.total}</div>
                      <small className="text-muted">Total Pólizas</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuración Comercial */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Configuración Comercial</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Tiempo de Emisión:</strong>
                    {aseguradoraSeleccionada.tiempoEmision ? `${aseguradoraSeleccionada.tiempoEmision} días` : 'No definido'}
                  </div>
                  <div>
                    <strong className="d-block text-muted mb-2">Productos y Comisiones:</strong>
                    {aseguradoraSeleccionada.productos_disponibles?.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>Producto</th>
                              <th>Comisión</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aseguradoraSeleccionada.productos_disponibles.map(item => {
                              const productoId = typeof item === 'object' ? item.producto_id : item;
                              const comision = typeof item === 'object' ? item.comision : '0';
                              const prod = productosDB.find(p => String(p.id) === String(productoId));
                              return (
                                <tr key={productoId}>
                                  <td>{prod ? prod.nombre : 'Producto ' + productoId}</td>
                                  <td>
                                    <span className="badge bg-success">{comision}%</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <span className="text-muted">Sin productos configurados</span>
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

// Componente principal
export default function Aseguradoras() {
  const [aseguradoras, setAseguradoras] = useState([]);
  const [polizas, setPolizas] = useState([]);
  const [aseguradoraSeleccionada, setAseguradoraSeleccionada] = useState(null);
  const [vistaActual, setVistaActual] = useState('aseguradoras');
  const [modoEdicionAseguradora, setModoEdicionAseguradora] = useState(false);
  
  const productos = useMemo(() => ['Autos', 'Vida', 'Daños', 'Equipo pesado', 'Embarcaciones', 'Ahorro'], []);

  const [formularioAseguradora, setFormularioAseguradora] = useState({
    codigo: '',
    nombre: '',
    rfc: '',
    razonSocial: '',
    telefono: '',
    email: '',
    sitioWeb: '',
    direccion: '',
    ciudad: '',
    estado: '',
    codigoPostal: '',
    productos_disponibles: [], // Array de {producto_id, comision}
    tiempoEmision: '',
    contactoPrincipal: '',
    telefonoContacto: '',
    emailContacto: '',
    notas: '',
    activo: true,
    fechaRegistro: new Date().toISOString().split('T')[0],
    id: null
  });

  // Cargar aseguradoras desde la API
  const cargarAseguradoras = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/aseguradoras`);
      const data = await res.json();
      const list = data?.data || data || [];
      setAseguradoras(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error cargando aseguradoras:', err);
    }
  }, []);

  // Opcional: cargar pólizas si existe endpoint
  const cargarPolizas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/expedientes`);
      const data = await res.json();
      const list = data?.data || data || [];
      setPolizas(Array.isArray(list) ? list : []);
    } catch (err) {
      // dejar pólizas vacías si falla
      console.warn('No se pudieron cargar pólizas:', err);
      setPolizas([]);
    }
  }, []);

  useEffect(() => {
    cargarAseguradoras();
    cargarPolizas();
  }, [cargarAseguradoras, cargarPolizas]);

  const generarCodigoAseguradora = useCallback(() => {
    if (aseguradoras.length === 0) {
      return 'AS001';
    }
    
    const numeros = aseguradoras
      .map(aseguradora => {
        const match = aseguradora.codigo.match(/AS(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `AS${siguienteNumero.toString().padStart(3, '0')}`;
  }, [aseguradoras]);

  const limpiarFormularioAseguradora = useCallback(() => {
    setFormularioAseguradora({
      codigo: '',
      nombre: '',
      rfc: '',
      razonSocial: '',
      telefono: '',
      email: '',
      sitioWeb: '',
      direccion: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      productos_disponibles: [],
      tiempoEmision: '',
      contactoPrincipal: '',
      telefonoContacto: '',
      emailContacto: '',
      notas: '',
      activo: true,
      fechaRegistro: new Date().toISOString().split('T')[0],
      id: null
    });
    setModoEdicionAseguradora(false);
    setAseguradoraSeleccionada(null);
  }, []);

  const guardarAseguradora = useCallback(async () => {
    if (!formularioAseguradora.nombre || !formularioAseguradora.rfc) {
      alert('Por favor complete los campos obligatorios: Nombre y RFC');
      return;
    }

    const codigoAseguradora = formularioAseguradora.codigo || generarCodigoAseguradora();
    const payload = {
      ...formularioAseguradora,
      codigo: codigoAseguradora,
      productos_disponibles: (formularioAseguradora.productos_disponibles || []).map(p => {
        // Normalizar a { producto_id, comision }
        return typeof p === 'object' ? p : { producto_id: String(p), comision: '0' };
      })
    };

    if (modoEdicionAseguradora) {
      try {
        const res = await fetch(`${API_URL}/api/aseguradoras/${formularioAseguradora.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Error al actualizar');
        await cargarAseguradoras();
        limpiarFormularioAseguradora();
        setVistaActual('aseguradoras');
      } catch (err) {
        console.error(err);
        alert('Error al actualizar aseguradora');
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/api/aseguradoras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Error al crear');
        await cargarAseguradoras();
        limpiarFormularioAseguradora();
        setVistaActual('aseguradoras');
      } catch (err) {
        console.error(err);
        alert('Error al crear aseguradora');
      }
    }
  }, [formularioAseguradora, modoEdicionAseguradora, generarCodigoAseguradora, limpiarFormularioAseguradora, cargarAseguradoras]);

  const editarAseguradora = useCallback((aseguradora) => {
    setFormularioAseguradora(aseguradora);
    setModoEdicionAseguradora(true);
    setVistaActual('formulario-aseguradora');
  }, []);

  const eliminarAseguradora = useCallback((id) => {
    if (!confirm('¿Está seguro de eliminar esta aseguradora?')) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/aseguradoras/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarAseguradoras();
      } catch (err) {
        console.error(err);
        alert('Error al eliminar aseguradora');
      }
    })();
  }, [cargarAseguradoras]);

  const verDetallesAseguradora = useCallback((aseguradora) => {
    setAseguradoraSeleccionada(aseguradora);
    setVistaActual('detalles-aseguradora');
  }, []);

  return (
    <div>
      {vistaActual === 'aseguradoras' && (
        <ListaAseguradorasComponent 
          aseguradoras={aseguradoras}
          polizas={polizas}
          limpiarFormularioAseguradora={limpiarFormularioAseguradora}
          setVistaActual={setVistaActual}
          verDetallesAseguradora={verDetallesAseguradora}
          editarAseguradora={editarAseguradora}
          eliminarAseguradora={eliminarAseguradora}
        />
      )}
      {vistaActual === 'formulario-aseguradora' && (
        <FormularioAseguradora 
          modoEdicionAseguradora={modoEdicionAseguradora}
          formularioAseguradora={formularioAseguradora}
          setFormularioAseguradora={setFormularioAseguradora}
          generarCodigoAseguradora={generarCodigoAseguradora}
          setVistaActual={setVistaActual}
          guardarAseguradora={guardarAseguradora}
          productos={productos}
        />
      )}
      {vistaActual === 'detalles-aseguradora' && aseguradoraSeleccionada && (
        <DetallesAseguradora 
          aseguradoraSeleccionada={aseguradoraSeleccionada}
          polizas={polizas}
          productos={productos}
          editarAseguradora={editarAseguradora}
          setVistaActual={setVistaActual}
        />
      )}
    </div>
  );
}

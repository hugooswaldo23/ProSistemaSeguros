const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { obtenerTiposProductos } from '../services/tiposProductosService';
import { Plus, Edit, Trash2, Eye, Shield, X, Save, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const useProductosDB = () => {
  const [productosDB, setProductosDB] = useState([]);
  useEffect(() => {
    const fetchProductos = async () => {
      const res = await obtenerTiposProductos();
      // Si la respuesta tiene la estructura { success, data: { success, data: [...] } }
      const productos = res.data?.data || [];
      setProductosDB(productos);
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

// Componente Lista de Aseguradoras (MOVIDO FUERA)
const ListaAseguradorasComponent = ({ 
  aseguradoras, 
  expedientes, 
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
                  Las aseguradoras activas aparecerán automáticamente en los formularios de expedientes.
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
                      <th>Comisión</th>
                      <th>Estado</th>
                      <th>Expedientes</th>
                      <th width="150">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacion.itemsPaginados.map((aseguradora) => {
                      const expedientesAseguradora = expedientes.filter(exp => exp.compania === aseguradora.nombre).length;
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
                              <small>{aseguradora.productos_disponibles.length} productos</small>
                            ) : (
                              <small className="text-muted">Todos</small>
                            )}
                          </td>
                          <td>
                            {aseguradora.comisionBase ? (
                              <span className="badge bg-success">{aseguradora.comisionBase}%</span>
                            ) : '-'}
                          </td>
                          <td>
                            <span className={`badge ${aseguradora.activo ? 'bg-success' : 'bg-secondary'}`}>
                              {aseguradora.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td>
                            <span className="badge bg-info">{expedientesAseguradora}</span>
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

// Componente Formulario de Aseguradora (MOVIDO FUERA)
const FormularioAseguradora = ({
  modoEdicionAseguradora,
  formularioAseguradora,
  setFormularioAseguradora,
  generarCodigoAseguradora,
  setVistaActual,
  guardarAseguradora,
  productos,
  productosSeleccionTemp,
  setProductosSeleccionTemp,
}) => {
  useEffect(() => {
    console.log(formularioAseguradora.productos_disponibles)
    setProductosSeleccionTemp((formularioAseguradora.productos_disponibles || []).map(id => String(id)));
  }, [formularioAseguradora.productos_disponibles, setProductosSeleccionTemp]);
  const productosDB = useProductosDB();
  const [showProductosModal, setShowProductosModal] = useState(false);
  // productosSeleccionTemp y setProductosSeleccionTemp vienen por props
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

            {/* Configuración Comercial */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Configuración Comercial</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Productos Disponibles</label>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <button type="button" className="btn btn-outline-primary" onClick={() => {
                      setProductosSeleccionTemp((formularioAseguradora.productos_disponibles || []).map(id => String(id)));
                      setShowProductosModal(true);
                    }}>
                      Seleccionar productos
                    </button>
                    {formularioAseguradora.productos_disponibles?.length > 0 && (
                      <div className="d-flex flex-wrap gap-1">
                        {formularioAseguradora.productos_disponibles.map(id => {
                          const prod = (Array.isArray(productosDB) ? productosDB : []).find(p => String(p.id) === String(id));
                          return (
                            <span key={id} className="badge bg-info text-dark">
                              {prod ? prod.nombre : id}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <small className="form-text text-muted">
                    Si no selecciona ninguno, la aseguradora estará disponible para todos los productos
                  </small>

                  {/* Modal de selección de productos */}
                  {showProductosModal && (
                    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.4)' }} tabIndex="-1">
                      <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content shadow-lg">
                          <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title">Selecciona los productos disponibles</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={() => setShowProductosModal(false)}></button>
                          </div>
                          <div className="modal-body">
                            <div className="row g-3">
                              {productosDB.length === 0 ? (
                                <div className="text-center w-100 text-muted">No hay productos disponibles</div>
                              ) : (
                                productosDB.map(producto => (
                                  <div key={producto.id} className="col-md-4">
                                    <div className="card card-body border shadow-sm d-flex flex-row align-items-center gap-2">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id={`modal-prod-${producto.id}`}
                                        checked={productosSeleccionTemp.includes(String(producto.id))}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setProductosSeleccionTemp(prev => [...prev, String(producto.id)]);
                                          } else {
                                            setProductosSeleccionTemp(prev => prev.filter(id => id !== String(producto.id)));
                                          }
                                        }}
                                      />
                                      <label htmlFor={`modal-prod-${producto.id}`} className="form-check-label mb-0">
                                        <strong>{producto.nombre}</strong>
                                        <br />
                                        <span className="text-muted small">{producto.descripcion || ''}</span>
                                      </label>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="modal-footer d-flex justify-content-between">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => setShowProductosModal(false)}>
                              Cancelar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => {
                              setFormularioAseguradora({
                                ...formularioAseguradora,
                                productos_disponibles: productosSeleccionTemp
                              });
                              setShowProductosModal(false);
                            }}>
                              Guardar selección
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="col-md-3">
                  <label className="form-label">Comisión Base (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formularioAseguradora.comisionBase}
                    onChange={(e) => setFormularioAseguradora({...formularioAseguradora, comisionBase: e.target.value})}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Ej: 10"
                  />
                </div>
                
                <div className="col-md-3">
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

// Componente Detalles de Aseguradora (MOVIDO FUERA)
const DetallesAseguradora = ({ 
  aseguradoraSeleccionada, 
  expedientes, 
  productos, 
  editarAseguradora, 
  setVistaActual 
}) => {
  const productosDB = useProductosDB();
  const expedientesDeAseguradora = useMemo(() => 
    expedientes.filter(exp => exp.compania === aseguradoraSeleccionada?.nombre),
    [expedientes, aseguradoraSeleccionada]
  );

  const estadisticas = useMemo(() => ({
    total: expedientesDeAseguradora.length,
    vigentes: expedientesDeAseguradora.filter(exp => exp.etapaActiva === 'Pagado').length,
    enProceso: expedientesDeAseguradora.filter(exp => 
      ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(exp.etapaActiva)
    ).length,
    cancelados: expedientesDeAseguradora.filter(exp => exp.etapaActiva === 'Cancelado').length,
    porProducto: productos.reduce((acc, producto) => {
      acc[producto] = expedientesDeAseguradora.filter(exp => exp.producto === producto).length;
      return acc;
    }, {})
  }), [expedientesDeAseguradora, productos]);

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

              {/* Información de Contacto */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Información de Contacto</h5>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <strong className="d-block text-muted">Teléfono:</strong>
                      {aseguradoraSeleccionada.telefono || '-'}
                    </div>
                    <div className="col-md-4">
                      <strong className="d-block text-muted">Email:</strong>
                      {aseguradoraSeleccionada.email || '-'}
                    </div>
                    <div className="col-md-4">
                      <strong className="d-block text-muted">Sitio Web:</strong>
                      {aseguradoraSeleccionada.sitioWeb ? (
                        <a href={aseguradoraSeleccionada.sitioWeb} target="_blank" rel="noopener noreferrer">
                          {aseguradoraSeleccionada.sitioWeb}
                        </a>
                      ) : '-'}
                    </div>
                    {aseguradoraSeleccionada.direccion && (
                      <div className="col-12">
                        <strong className="d-block text-muted">Dirección:</strong>
                        {aseguradoraSeleccionada.direccion}
                        {(aseguradoraSeleccionada.ciudad || aseguradoraSeleccionada.estado || aseguradoraSeleccionada.codigoPostal) && (
                          <div>
                            {aseguradoraSeleccionada.ciudad && `${aseguradoraSeleccionada.ciudad}, `}
                            {aseguradoraSeleccionada.estado} 
                            {aseguradoraSeleccionada.codigoPostal && ` C.P. ${aseguradoraSeleccionada.codigoPostal}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacto Principal */}
              {(aseguradoraSeleccionada.contactoPrincipal || aseguradoraSeleccionada.telefonoContacto || aseguradoraSeleccionada.emailContacto) && (
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Contacto Principal</h5>
                    <div className="row g-3">
                      {aseguradoraSeleccionada.contactoPrincipal && (
                        <div className="col-md-4">
                          <strong className="d-block text-muted">Nombre:</strong>
                          {aseguradoraSeleccionada.contactoPrincipal}
                        </div>
                      )}
                      {aseguradoraSeleccionada.telefonoContacto && (
                        <div className="col-md-4">
                          <strong className="d-block text-muted">Teléfono:</strong>
                          {aseguradoraSeleccionada.telefonoContacto}
                        </div>
                      )}
                      {aseguradoraSeleccionada.emailContacto && (
                        <div className="col-md-4">
                          <strong className="d-block text-muted">Email:</strong>
                          {aseguradoraSeleccionada.emailContacto}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              {aseguradoraSeleccionada.notas && (
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Notas</h5>
                    <p>{aseguradoraSeleccionada.notas}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Estadísticas y Configuración */}
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

              {/* Configuración Comercial */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Configuración Comercial</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Comisión Base:</strong>
                    <span className="h4 text-success">
                      {aseguradoraSeleccionada.comisionBase ? `${aseguradoraSeleccionada.comisionBase}%` : 'No definida'}
                    </span>
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Tiempo de Emisión:</strong>
                    {aseguradoraSeleccionada.tiempoEmision ? `${aseguradoraSeleccionada.tiempoEmision} días` : 'No definido'}
                  </div>
                  <div>
                    <strong className="d-block text-muted">Productos Disponibles:</strong>
                    {aseguradoraSeleccionada.productos_disponibles?.length > 0 ? (
                      <div className="mt-2">
                        {aseguradoraSeleccionada.productos_disponibles.map(id => {
                          const prod = (Array.isArray(productosDB) ? productosDB : []).find(p => String(p.id) === String(id));
                          return (
                            <span key={id} className="badge bg-primary me-1 mb-1">
                              {prod ? prod.nombre : id}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted">Todos los productos</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Distribución por Producto */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Expedientes por Producto</h5>
                  {Object.entries(estadisticas.porProducto).filter(([_, count]) => count > 0).map(([producto, count]) => (
                    <div key={producto} className="d-flex justify-content-between mb-2">
                      <span>{producto}:</span>
                      <span className="badge bg-info">{count}</span>
                    </div>
                  ))}
                  {Object.values(estadisticas.porProducto).every(count => count === 0) && (
                    <p className="text-muted text-center mb-0">Sin expedientes</p>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de Expedientes */}
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">Expedientes con esta Aseguradora</h5>
                </div>
                <div className="card-body">
                  {expedientesDeAseguradora.length === 0 ? (
                    <p className="text-muted text-center py-4">No hay expedientes con esta aseguradora</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Producto</th>
                            <th>Agente</th>
                            <th>Etapa Activa</th>
                            <th>Estatus Pago</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expedientesDeAseguradora.slice(0, 10).map(expediente => (
                            <tr key={expediente.id}>
                              <td>{expediente.nombre} {expediente.apellidoPaterno}</td>
                              <td>{expediente.producto}</td>
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
                      {expedientesDeAseguradora.length > 10 && (
                        <div className="text-center mt-2">
                          <small className="text-muted">
                            Mostrando 10 de {expedientesDeAseguradora.length} expedientes
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
      </div>
    </div>
  );
};

// Componente principal para la gestión de Aseguradoras
export const Aseguradoras = () => {
  // Estado para productos seleccionados en el modal, ahora global
  const [productosSeleccionTemp, setProductosSeleccionTemp] = useState([]);
  // Cargar aseguradoras desde el backend al montar el componente
  useEffect(() => {
  fetch(`${API_URL}/api/aseguradoras`)
      .then(res => res.json())
      .then(data => setAseguradoras(data))
      .catch(err => console.error('Error al cargar aseguradoras:', err));
  }, []);

  // Refrescar aseguradoras tras operaciones CRUD
  const cargarAseguradoras = useCallback(() => {
  fetch(`${API_URL}/api/aseguradoras`)
      .then(res => res.json())
      .then(data => setAseguradoras(data))
      .catch(err => console.error('Error al cargar aseguradoras:', err));
  }, []);
  // Estados principales para aseguradoras
  const [aseguradoras, setAseguradoras] = useState([]);
  const [aseguradoraSeleccionada, setAseguradoraSeleccionada] = useState(null);
  const [vistaActual, setVistaActual] = useState('aseguradoras');
  const [modoEdicionAseguradora, setModoEdicionAseguradora] = useState(false);

  // Estados para datos relacionados
  const [expedientes, setExpedientes] = useState([]);
  const productos = useMemo(() => ['Autos', 'Vida', 'Daños', 'Equipo pesado', 'Embarcaciones', 'Ahorro'], []);

  // Estado del formulario de aseguradora
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
    productos_disponibles: [],
    comisionBase: '',
    tiempoEmision: '',
    contactoPrincipal: '',
    telefonoContacto: '',
    emailContacto: '',
    notas: '',
    activo: true,
    fechaRegistro: new Date().toISOString().split('T')[0],
    id: null
  });

  // Función para generar códigos de aseguradora
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

  // Funciones CRUD para Aseguradoras
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
      comisionBase: '',
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

  // Guardar aseguradora en el backend
  const guardarAseguradora = useCallback(() => {
    if (!formularioAseguradora.nombre || !formularioAseguradora.rfc) {
      alert('Por favor complete los campos obligatorios: Nombre y RFC');
      return;
    }
    const codigoAseguradora = formularioAseguradora.codigo || generarCodigoAseguradora();
    const codigoExiste = aseguradoras.some(aseguradora => 
      aseguradora.codigo === codigoAseguradora && 
      aseguradora.id !== formularioAseguradora.id
    );
    if (codigoExiste) {
      alert('El código de aseguradora ya existe. Por favor ingrese uno diferente.');
      return;
    }
    // Guardar productos_disponibles como array de ids (números)
    const productosIds = (formularioAseguradora.productos_disponibles || []).map(id => Number(id));
    const aseguradoraPayload = {
      ...formularioAseguradora,
      productos_disponibles: productosIds,
      codigo: codigoAseguradora
    };
    if (modoEdicionAseguradora) {
  fetch(`${API_URL}/api/aseguradoras/${formularioAseguradora.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aseguradoraPayload)
      })
        .then(() => {
          cargarAseguradoras();
          limpiarFormularioAseguradora();
          setVistaActual('aseguradoras');
        })
        .catch(err => alert('Error al actualizar aseguradora'));
    } else {
  fetch(`${API_URL}/api/aseguradoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aseguradoraPayload)
      })
        .then(() => {
          cargarAseguradoras();
          limpiarFormularioAseguradora();
          setVistaActual('aseguradoras');
        })
        .catch(err => alert('Error al crear aseguradora'));
    }
  }, [formularioAseguradora, aseguradoras, modoEdicionAseguradora, generarCodigoAseguradora, limpiarFormularioAseguradora, cargarAseguradoras]);

  const editarAseguradora = useCallback((aseguradora) => {
    setFormularioAseguradora(aseguradora);
    setModoEdicionAseguradora(true);
    setVistaActual('formulario-aseguradora');
    // Sincroniza productos seleccionados visualmente al editar
    if (aseguradora.productos_disponibles) {
      setProductosSeleccionTemp((aseguradora.productos_disponibles || []).map(id => String(id)));
    } else {
      setProductosSeleccionTemp([]);
    }
  }, []);

  // Eliminar aseguradora en el backend
  const eliminarAseguradora = useCallback((id) => {
    const aseguradoraAEliminar = aseguradoras.find(a => a.id === id);
    const tieneExpedientes = expedientes.some(exp => exp.compania === aseguradoraAEliminar?.nombre);
    if (tieneExpedientes) {
      alert('No se puede eliminar la aseguradora porque tiene expedientes asociados.');
      return;
    }
    if (confirm('¿Está seguro de eliminar esta aseguradora?')) {
  fetch(`${API_URL}/api/aseguradoras/${id}`, {
        method: 'DELETE'
      })
        .then(() => cargarAseguradoras())
        .catch(err => alert('Error al eliminar aseguradora'));
    }
  }, [expedientes, aseguradoras, cargarAseguradoras]);

  const verDetallesAseguradora = useCallback((aseguradora) => {
    setAseguradoraSeleccionada(aseguradora);
    setVistaActual('detalles-aseguradora');
  }, []);

  // Renderizado condicional basado en la vista actual
  return (
    <div>
      {vistaActual === 'aseguradoras' && (
        <ListaAseguradorasComponent 
          aseguradoras={aseguradoras}
          expedientes={expedientes}
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
          productosSeleccionTemp={productosSeleccionTemp}
          setProductosSeleccionTemp={setProductosSeleccionTemp}
        />
      )}
      {vistaActual === 'detalles-aseguradora' && aseguradoraSeleccionada && (
        <DetallesAseguradora 
          aseguradoraSeleccionada={aseguradoraSeleccionada}
          expedientes={expedientes}
          productos={productos}
          editarAseguradora={editarAseguradora}
          setVistaActual={setVistaActual}
        />
      )}
    </div>
  );
};

export default Aseguradoras;
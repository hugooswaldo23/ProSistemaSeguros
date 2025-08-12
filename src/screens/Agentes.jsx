import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, UserCheck, X, Save, ChevronLeft, ChevronRight, Search } from 'lucide-react';

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

// Componente principal para la gestión de Agentes
export const Agentes = () => {
  // Estados principales para agentes
  const [agentes, setAgentes] = useState([]);
  const [agenteSeleccionado, setAgenteSeleccionado] = useState(null);
  const [vistaActual, setVistaActual] = useState('agentes');
  const [modoEdicionAgente, setModoEdicionAgente] = useState(false);

  // Estado del formulario de agente
  const [formularioAgente, setFormularioAgente] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    telefono: '',
    codigoAgente: '',
    activo: true,
    fechaRegistro: new Date().toISOString().split('T')[0],
    id: null
  });

  // Función para generar códigos de agente
  const generarCodigoAgente = useCallback(() => {
    if (agentes.length === 0) {
      return 'AG001';
    }
    
    const numeros = agentes
      .map(agente => {
        const match = agente.codigoAgente.match(/AG(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = Math.max(...numeros);
    const siguienteNumero = maxNumero + 1;
    
    return `AG${siguienteNumero.toString().padStart(3, '0')}`;
  }, [agentes]);

  // Funciones CRUD para Agentes
  const limpiarFormularioAgente = useCallback(() => {
    setFormularioAgente({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      email: '',
      telefono: '',
      codigoAgente: '',
      activo: true,
      fechaRegistro: new Date().toISOString().split('T')[0],
      id: null
    });
    setModoEdicionAgente(false);
    setAgenteSeleccionado(null);
  }, []);

  const guardarAgente = useCallback(() => {
    if (!formularioAgente.nombre || !formularioAgente.apellidoPaterno) {
      alert('Por favor complete los campos obligatorios: Nombre y Apellido Paterno');
      return;
    }

    const codigoAgente = formularioAgente.codigoAgente || generarCodigoAgente();

    const codigoExiste = agentes.some(agente => 
      agente.codigoAgente === codigoAgente && 
      agente.id !== formularioAgente.id
    );

    if (codigoExiste) {
      alert('El código de agente ya existe. Por favor ingrese uno diferente.');
      return;
    }

    if (modoEdicionAgente) {
      setAgentes(prev => prev.map(agente => 
        agente.id === formularioAgente.id ? { ...formularioAgente } : agente
      ));
    } else {
      const nuevoAgente = {
        ...formularioAgente,
        codigoAgente: codigoAgente,
        id: Date.now(),
        fechaRegistro: new Date().toISOString().split('T')[0]
      };
      setAgentes(prev => [...prev, nuevoAgente]);
    }
    
    limpiarFormularioAgente();
    setVistaActual('agentes');
  }, [formularioAgente, agentes, modoEdicionAgente, generarCodigoAgente, limpiarFormularioAgente]);

  const editarAgente = useCallback((agente) => {
    setFormularioAgente(agente);
    setModoEdicionAgente(true);
    setVistaActual('formulario-agente');
  }, []);

  const eliminarAgente = useCallback((id) => {
    if (confirm('¿Está seguro de eliminar este agente?')) {
      setAgentes(prev => prev.filter(agente => agente.id !== id));
    }
  }, []);

  const verDetallesAgente = useCallback((agente) => {
    setAgenteSeleccionado(agente);
    setVistaActual('detalles-agente');
  }, []);

  // Lista de Agentes con paginación
  function ListaAgentesComponent() {
    const paginacion = usePaginacion(agentes, 10);

    return (
      <div>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="mb-0">Gestión de Agentes</h3>
            <button
              onClick={() => {
                limpiarFormularioAgente();
                setVistaActual('formulario-agente');
              }}
              className="btn btn-primary"
            >
              <Plus size={16} className="me-2" />
              Nuevo Agente
            </button>
          </div>

          {agentes.length > 0 && (
            <div className="row mb-3">
              <div className="col-md-6">
                <BarraBusqueda 
                  busqueda={paginacion.busqueda}
                  setBusqueda={paginacion.setBusqueda}
                  placeholder="Buscar agentes..."
                />
              </div>
              <div className="col-md-6 text-end">
                <small className="text-muted">
                  Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} agentes
                </small>
              </div>
            </div>
          )}

          <div className="card">
            {agentes.length === 0 ? (
              <div className="card-body text-center py-5">
                <UserCheck size={48} className="text-muted mb-3" />
                <h5 className="text-muted">No hay agentes registrados</h5>
                <p className="text-muted">Crea tu primer agente para comenzar</p>
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
                        <th>Nombre Completo</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Estado</th>
                        <th>Fecha Registro</th>
                        <th width="200">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginacion.itemsPaginados.map((agente) => (
                        <tr key={agente.id}>
                          <td>
                            <span className="badge bg-primary">{agente.codigoAgente}</span>
                          </td>
                          <td>
                            <div>
                              <div className="fw-semibold">{agente.nombre} {agente.apellidoPaterno}</div>
                              {agente.apellidoMaterno && (
                                <small className="text-muted">{agente.apellidoMaterno}</small>
                              )}
                            </div>
                          </td>
                          <td>{agente.email || '-'}</td>
                          <td>{agente.telefono || '-'}</td>
                          <td>
                            <span className={`badge ${agente.activo ? 'bg-success' : 'bg-secondary'}`}>
                              {agente.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <small>{agente.fechaRegistro}</small>
                          </td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              <button
                                onClick={() => verDetallesAgente(agente)}
                                className="btn btn-outline-primary btn-sm"
                                title="Ver detalles"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => editarAgente(agente)}
                                className="btn btn-outline-secondary btn-sm"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => eliminarAgente(agente.id)}
                                className="btn btn-outline-danger btn-sm"
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
  }

  // Formulario de Agentes
  const FormularioAgente = () => {
    const siguienteCodigo = !modoEdicionAgente ? generarCodigoAgente() : formularioAgente.codigoAgente;

    return (
      <div>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="mb-0">
              {modoEdicionAgente ? 'Editar Agente' : 'Nuevo Agente'}
            </h3>
            <button
              onClick={() => setVistaActual('agentes')}
              className="btn btn-outline-secondary"
            >
              Cancelar
            </button>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Información del Agente</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Código de Agente</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioAgente.codigoAgente || siguienteCodigo}
                      onChange={(e) => setFormularioAgente({...formularioAgente, codigoAgente: e.target.value})}
                      placeholder={siguienteCodigo}
                    />
                    <small className="form-text text-muted">
                      {!modoEdicionAgente && 'Se generará automáticamente si se deja vacío'}
                    </small>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Estado</label>
                    <select
                      className="form-select"
                      value={formularioAgente.activo}
                      onChange={(e) => setFormularioAgente({...formularioAgente, activo: e.target.value === 'true'})}
                    >
                      <option value={true}>Activo</option>
                      <option value={false}>Inactivo</option>
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Nombre <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioAgente.nombre}
                      onChange={(e) => setFormularioAgente({...formularioAgente, nombre: e.target.value})}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Paterno <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioAgente.apellidoPaterno}
                      onChange={(e) => setFormularioAgente({...formularioAgente, apellidoPaterno: e.target.value})}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Materno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioAgente.apellidoMaterno}
                      onChange={(e) => setFormularioAgente({...formularioAgente, apellidoMaterno: e.target.value})}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioAgente.email}
                      onChange={(e) => setFormularioAgente({...formularioAgente, email: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioAgente.telefono}
                      onChange={(e) => setFormularioAgente({...formularioAgente, telefono: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-3">
                <button
                  type="button"
                  onClick={() => setVistaActual('agentes')}
                  className="btn btn-outline-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarAgente}
                  className="btn btn-primary"
                >
                  <Save size={16} className="me-2" />
                  {modoEdicionAgente ? 'Actualizar' : 'Guardar'} Agente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Detalles del Agente
  const DetallesAgente = () => (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">Detalles del Agente</h3>
          <div className="d-flex gap-3">
            <button
              onClick={() => editarAgente(agenteSeleccionado)}
              className="btn btn-primary d-flex align-items-center"
            >
              <Edit size={16} className="me-2" />
              Editar
            </button>
            <button
              onClick={() => setVistaActual('agentes')}
              className="btn btn-outline-secondary"
            >
              Volver
            </button>
          </div>
        </div>

        {agenteSeleccionado && (
          <div className="card">
            <div className="card-body">
              <div className="row g-4">
                <div className="col-md-6">
                  <h5 className="card-title border-bottom pb-2">Información Personal</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Código de Agente:</strong>
                    <span className="badge bg-primary fs-6">{agenteSeleccionado.codigoAgente}</span>
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Nombre completo:</strong>
                    {agenteSeleccionado.nombre} {agenteSeleccionado.apellidoPaterno} {agenteSeleccionado.apellidoMaterno}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Email:</strong>
                    {agenteSeleccionado.email || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Teléfono:</strong>
                    {agenteSeleccionado.telefono || '-'}
                  </div>
                </div>

                <div className="col-md-6">
                  <h5 className="card-title border-bottom pb-2">Información de Estado</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Estado:</strong>
                    <span className={`badge ${agenteSeleccionado.activo ? 'bg-success' : 'bg-secondary'} fs-6`}>
                      {agenteSeleccionado.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Fecha de registro:</strong>
                    {agenteSeleccionado.fechaRegistro}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Renderizado condicional basado en la vista actual
  return (
    <div>
      {vistaActual === 'agentes' && <ListaAgentesComponent />}
      {vistaActual === 'formulario-agente' && <FormularioAgente />}
      {vistaActual === 'detalles-agente' && agenteSeleccionado && <DetallesAgente />}
    </div>
  );
};
export default Agentes;
const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit, Trash2, Eye, X, Save, Search, Users,
  Mail, Phone, Calendar, Clock, DollarSign, Shield,
  ChevronLeft, ChevronRight, UserPlus, Building
} from 'lucide-react';

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

  const irAPagina = (pagina) => {
    setPaginaActual(Math.max(1, Math.min(pagina, totalPaginas)));
  };

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

// Componente principal para la gestión del Equipo de Trabajo
export const EquipoDeTrabajo = () => {
  // Estados principales para el equipo de trabajo
  const [equipoDeTrabajo, setEquipoDeTrabajo] = useState([]);
  const [miembroSeleccionado, setMiembroSeleccionado] = useState(null);
  const [vistaActual, setVistaActual] = useState('equipo');
  const [modoEdicion, setModoEdicion] = useState(false);

  // Cargar miembros desde el backend al montar el componente
  useEffect(() => {
  fetch(`${API_URL}/api/equipoDeTrabajo`)
      .then(res => res.json())
      .then(data => setEquipoDeTrabajo(data))
      .catch(err => {
        console.error('Error al cargar equipo de trabajo:', err);
        setEquipoDeTrabajo([]);
      });
  }, []);

  // Estado del formulario de miembro del equipo
  const formularioInicial = {
    codigoAgente: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    telefono: '',
    puesto: 'Agente',
    departamento: 'Ventas',
    fechaIngreso: new Date().toISOString().split('T')[0],
    salario: '',
    comision: '',
    aseguradorasAutorizadas: [],
    comisionesPorProducto: {},
    horarios: {
      lunes: { activo: true, entrada: '09:00', salida: '18:00', comidaInicio: '13:00', comidaFin: '14:00' },
      martes: { activo: true, entrada: '09:00', salida: '18:00', comidaInicio: '13:00', comidaFin: '14:00' },
      miercoles: { activo: true, entrada: '09:00', salida: '18:00', comidaInicio: '13:00', comidaFin: '14:00' },
      jueves: { activo: true, entrada: '09:00', salida: '18:00', comidaInicio: '13:00', comidaFin: '14:00' },
      viernes: { activo: true, entrada: '09:00', salida: '18:00', comidaInicio: '13:00', comidaFin: '14:00' },
      sabado: { activo: false, entrada: '09:00', salida: '14:00', comidaInicio: '', comidaFin: '' },
      domingo: { activo: false, entrada: '09:00', salida: '14:00', comidaInicio: '', comidaFin: '' }
    },
    activo: true,
    notas: '',
    id: null
  };
  const [formularioMiembro, setFormularioMiembro] = useState(formularioInicial);

  // Datos de aseguradoras y productos disponibles
  const aseguradoras = useMemo(() => ['Qualitas', 'Banorte', 'HDI', 'El Aguila', 'Mapfre', 'Chubb', 'Afirme'], []);
  const productos = useMemo(() => ['Autos', 'Vida', 'Daños', 'Equipo pesado', 'Embarcaciones', 'Ahorro'], []);

  // Función para generar códigos de agente
  const generarCodigoAgente = () => {
    if (equipoDeTrabajo.length === 0) {
      return 'AG001';
    }
    
    const numeros = equipoDeTrabajo
      .map(miembro => {
        const match = miembro.codigoAgente.match(/AG(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `AG${siguienteNumero.toString().padStart(3, '0')}`;
  };

  // Funciones CRUD para el Equipo de Trabajo
  const limpiarFormularioMiembro = () => {
  setFormularioMiembro(formularioInicial);
    setModoEdicion(false);
    setMiembroSeleccionado(null);
  };

  const guardarMiembro = () => {
    if (!formularioMiembro.nombre || !formularioMiembro.apellidoPaterno) {
      alert('Por favor complete los campos obligatorios: Nombre y Apellido Paterno');
      return;
    }

    const codigoAgente = formularioMiembro.codigoAgente || generarCodigoAgente();

    try {
      if (modoEdicion && formularioMiembro.id) {
        // Actualizar miembro (asegura que id se envía)
  fetch(`${API_URL}/api/equipoDeTrabajo/${formularioMiembro.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formularioMiembro, codigoAgente, id: formularioMiembro.id })
        })
          .then(res => {
            if (!res.ok) throw new Error('Error al actualizar miembro');
            return res.json();
          })
          .then(actualizado => {
            setEquipoDeTrabajo(prev => prev.map(m => m.id === actualizado.id ? actualizado : m));
            limpiarFormularioMiembro();
            setVistaActual('equipo');
          })
          .catch(err => alert('Error al actualizar miembro: ' + err.message));
      } else {
        // Crear miembro (no envía id)
  fetch(`${API_URL}/api/equipoDeTrabajo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formularioMiembro, codigoAgente })
        })
          .then(res => {
            if (!res.ok) throw new Error('Error al crear miembro');
            return res.json();
          })
          .then(nuevo => {
            setEquipoDeTrabajo(prev => [...prev, nuevo]);
            limpiarFormularioMiembro();
            setVistaActual('equipo');
          })
          .catch(err => alert('Error al crear miembro: ' + err.message));
      }
    } catch (err) {
      alert('Error al guardar miembro: ' + err.message);
    }
  };

  const editarMiembro = (miembro) => {
    setFormularioMiembro({
      ...formularioInicial,
      ...miembro,
      aseguradorasAutorizadas: Array.isArray(miembro.aseguradorasAutorizadas) ? miembro.aseguradorasAutorizadas : [],
      comisionesPorProducto: typeof miembro.comisionesPorProducto === 'object' && miembro.comisionesPorProducto !== null ? miembro.comisionesPorProducto : {},
      horarios: typeof miembro.horarios === 'object' && miembro.horarios !== null ? miembro.horarios : formularioInicial.horarios,
      activo: typeof miembro.activo === 'boolean' ? miembro.activo : true,
    });
    setModoEdicion(true);
    setVistaActual('formulario-miembro');
  };

  const eliminarMiembro = (id) => {
    if (window.confirm('¿Está seguro de eliminar este miembro del equipo?')) {
  fetch(`${API_URL}/api/equipoDeTrabajo/${id}`, {
        method: 'DELETE'
      })
        .then(res => {
          if (!res.ok) throw new Error('Error al eliminar miembro');
          setEquipoDeTrabajo(prev => prev.filter(miembro => miembro.id !== id));
        })
        .catch(err => alert('Error al eliminar miembro: ' + err.message));
    }
  };

  const verDetallesMiembro = (miembro) => {
    setMiembroSeleccionado(miembro);
    setVistaActual('detalles-miembro');
  };

  // Componente Lista del Equipo de Trabajo
  const ListaEquipoComponent = () => {
    const paginacion = usePaginacion(equipoDeTrabajo, 10);

    return (
      <div>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h3 className="mb-1">Gestión del Equipo de Trabajo</h3>
              <p className="text-muted mb-0">Administra los miembros del equipo de trabajo</p>
            </div>
            <button
              onClick={() => {
                limpiarFormularioMiembro();
                setVistaActual('formulario-miembro');
              }}
              className="btn btn-primary"
            >
              <Plus size={16} className="me-2" />
              Nuevo Miembro
            </button>
          </div>

          {equipoDeTrabajo.length > 0 && (
            <>
              <div className="alert alert-info mb-4">
                <div className="d-flex align-items-center">
                  <Users className="me-2" size={20} />
                  <div>
                    <strong>Gestión del Equipo:</strong> Aquí puedes administrar todos los miembros del equipo de trabajo, 
                    incluyendo agentes, supervisores y personal administrativo.
                  </div>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="input-group mb-3">
                    <span className="input-group-text">
                      <Search size={20} />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Buscar miembros del equipo..."
                      value={paginacion.busqueda}
                      onChange={(e) => paginacion.setBusqueda(e.target.value)}
                    />
                    {paginacion.busqueda && (
                      <button 
                        className="btn btn-outline-secondary" 
                        type="button"
                        onClick={() => paginacion.setBusqueda('')}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-6 text-end">
                  <small className="text-muted">
                    Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} miembros
                  </small>
                </div>
              </div>
            </>
          )}

          <div className="card">
            {equipoDeTrabajo.length === 0 ? (
              <div className="card-body text-center py-5">
                <Users size={48} className="text-muted mb-3" />
                <h5 className="text-muted">No hay miembros registrados</h5>
                <p className="text-muted">Registra los miembros de tu equipo de trabajo</p>
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
                        <th>Nombre</th>
                        <th>Puesto</th>
                        <th>Departamento</th>
                        <th>Contacto</th>
                        <th>Estado</th>
                        <th>Fecha Ingreso</th>
                        <th width="150">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginacion.itemsPaginados.map((miembro) => (
                        <tr key={miembro.id}>
                          <td>
                            <strong className="text-primary">{miembro.codigoAgente}</strong>
                          </td>
                          <td>
                            <div>
                              <div className="fw-semibold">
                                {miembro.nombre} {miembro.apellidoPaterno} {miembro.apellidoMaterno}
                              </div>
                              <small className="text-muted">{miembro.email}</small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              miembro.puesto === 'Supervisor' ? 'bg-warning' :
                              miembro.puesto === 'Gerente' ? 'bg-danger' :
                              miembro.puesto === 'Coordinador' ? 'bg-info' :
                              'bg-primary'
                            }`}>
                              {miembro.puesto}
                            </span>
                          </td>
                          <td>{miembro.departamento}</td>
                          <td>
                            <div>
                              <small className="d-block">
                                <Phone size={12} className="me-1" />
                                {miembro.telefono || '-'}
                              </small>
                              <small className="text-muted">
                                <Mail size={12} className="me-1" />
                                {miembro.email || '-'}
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${miembro.activo ? 'bg-success' : 'bg-secondary'}`}>
                              {miembro.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            {miembro.aseguradorasAutorizadas?.length > 0 && (
                              <div className="mt-1">
                                <small className="text-muted">{miembro.aseguradorasAutorizadas.length} aseguradoras</small>
                              </div>
                            )}
                          </td>
                          <td>
                            <small>{miembro.fechaIngreso}</small>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                              <button
                                onClick={() => verDetallesMiembro(miembro)}
                                className="btn btn-outline-primary"
                                title="Ver detalles"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => editarMiembro(miembro)}
                                className="btn btn-outline-success"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => eliminarMiembro(miembro.id)}
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
                    <nav>
                      <ul className="pagination justify-content-center mb-0">
                        <li className={`page-item ${paginacion.paginaActual === 1 ? 'disabled' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => paginacion.setPaginaActual(paginacion.paginaActual - 1)}
                            disabled={paginacion.paginaActual === 1}
                          >
                            <ChevronLeft size={16} />
                          </button>
                        </li>
                        
                        {Array.from({ length: paginacion.totalPaginas }, (_, i) => i + 1).map(pagina => (
                          <li key={pagina} className={`page-item ${paginacion.paginaActual === pagina ? 'active' : ''}`}>
                            <button 
                              className="page-link" 
                              onClick={() => paginacion.setPaginaActual(pagina)}
                            >
                              {pagina}
                            </button>
                          </li>
                        ))}
                        
                        <li className={`page-item ${paginacion.paginaActual === paginacion.totalPaginas ? 'disabled' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => paginacion.setPaginaActual(paginacion.paginaActual + 1)}
                            disabled={paginacion.paginaActual === paginacion.totalPaginas}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </li>
                      </ul>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente Formulario de Miembro
  const FormularioMiembro = () => {
    const siguienteCodigo = !modoEdicion ? generarCodigoAgente() : formularioMiembro.codigoAgente;
    
    const puestos = ['Agente', 'Supervisor', 'Coordinador', 'Gerente', 'Asistente', 'Analista'];
    const departamentos = ['Ventas', 'Administración', 'Operaciones', 'Sistemas', 'Recursos Humanos', 'Contabilidad'];
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    return (
      <div>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="mb-0">
              {modoEdicion ? 'Editar Miembro' : 'Nuevo Miembro del Equipo'}
            </h3>
            <button
              onClick={() => setVistaActual('equipo')}
              className="btn btn-outline-secondary"
            >
              Cancelar
            </button>
          </div>

          <div className="card">
            <div className="card-body">
              {/* Información Personal */}
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Información Personal</h5>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Código de Agente</label>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={siguienteCodigo}
                      readOnly
                    />
                    <small className="form-text text-muted">Se asigna automáticamente</small>
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Nombre <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioMiembro.nombre}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, nombre: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Apellido Paterno <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioMiembro.apellidoPaterno}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, apellidoPaterno: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Apellido Materno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioMiembro.apellidoMaterno}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, apellidoMaterno: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioMiembro.email}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioMiembro.telefono}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, telefono: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Información Laboral */}
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Información Laboral</h5>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Puesto</label>
                    <select
                      className="form-select"
                      value={formularioMiembro.puesto}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, puesto: e.target.value }))}
                    >
                      {puestos.map(puesto => (
                        <option key={puesto} value={puesto}>{puesto}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Departamento</label>
                    <select
                      className="form-select"
                      value={formularioMiembro.departamento}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, departamento: e.target.value }))}
                    >
                      {departamentos.map(depto => (
                        <option key={depto} value={depto}>{depto}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Fecha de Ingreso</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formularioMiembro.fechaIngreso}
                      onChange={e => setFormularioMiembro(prev => ({ ...prev, fechaIngreso: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Salario Base</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={formularioMiembro.salario}
                        onChange={e => setFormularioMiembro(prev => ({ ...prev, salario: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <label className="form-label">Comisión (%)</label>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={formularioMiembro.comision}
                        onChange={e => setFormularioMiembro(prev => ({ ...prev, comision: e.target.value }))}
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aseguradoras Autorizadas y Comisiones */}
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Aseguradoras Autorizadas y Comisiones</h5>
                <div className="row g-3">
                  <div className="col-12">
                    <div className="alert alert-info">
                      <Shield className="me-2" size={16} />
                      <small>Seleccione las aseguradoras que este miembro puede vender y configure las comisiones específicas por producto.</small>
                    </div>
                  </div>
                  
                  <div className="col-12">
                    <label className="form-label">Aseguradoras Autorizadas</label>
                    <div className="row g-2">
                      {aseguradoras.map(aseguradora => (
                        <div key={aseguradora} className="col-md-3">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`aseg-${aseguradora}`}
                              checked={formularioMiembro.aseguradorasAutorizadas.includes(aseguradora)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormularioMiembro(prev => ({
                                    ...prev,
                                    aseguradorasAutorizadas: [...prev.aseguradorasAutorizadas, aseguradora]
                                  }));
                                } else {
                                  setFormularioMiembro(prev => ({
                                    ...prev,
                                    aseguradorasAutorizadas: prev.aseguradorasAutorizadas.filter(a => a !== aseguradora)
                                  }));
                                }
                              }}
                            />
                            <label className="form-check-label" htmlFor={`aseg-${aseguradora}`}>
                              {aseguradora}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {formularioMiembro.aseguradorasAutorizadas.length > 0 && (
                    <div className="col-12">
                      <label className="form-label">Comisiones por Producto (%)</label>
                      <div className="alert alert-warning">
                        <DollarSign className="me-2" size={16} />
                        <small>Configure las comisiones específicas por producto. Si no se especifica, se usará la comisión base del miembro.</small>
                      </div>
                      
                      {productos.map(producto => (
                        <div key={producto} className="card border-light mb-3">
                          <div className="card-body p-3">
                            <h6 className="card-title mb-3">{producto}</h6>
                            <div className="row g-2">
                              {formularioMiembro.aseguradorasAutorizadas.map(aseguradora => (
                                <div key={`${producto}-${aseguradora}`} className="col-md-3">
                                  <label className="form-label small">{aseguradora}</label>
                                  <div className="input-group input-group-sm">
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={formularioMiembro.comisionesPorProducto[`${producto}-${aseguradora}`] || ''}
                                      onChange={(e) => {
                                        setFormularioMiembro({
                                          ...formularioMiembro,
                                          comisionesPorProducto: {
                                            ...formularioMiembro.comisionesPorProducto,
                                            [`${producto}-${aseguradora}`]: e.target.value
                                          }
                                        });
                                      }}
                                      placeholder="0"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                    />
                                    <span className="input-group-text">%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Horario de Trabajo */}
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Horario de Trabajo</h5>
                <div className="row g-3">
                  <div className="col-12">
                    <div className="alert alert-info">
                      <Clock className="me-2" size={16} />
                      <small>Configure los horarios de trabajo para cada día de la semana. Puede definir horarios diferentes para cada día y horarios de comida.</small>
                    </div>
                  </div>
                  
                  {Object.entries(formularioMiembro.horarios).map(([dia, horario]) => (
                    <div key={dia} className="col-12">
                      <div className="card border-light">
                        <div className="card-body p-3">
                          <div className="row g-2 align-items-center">
                            <div className="col-md-2">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`dia-${dia}`}
                                  checked={horario.activo}
                                  onChange={(e) => {
                                    setFormularioMiembro({
                                      ...formularioMiembro,
                                      horarios: {
                                        ...formularioMiembro.horarios,
                                        [dia]: { ...horario, activo: e.target.checked }
                                      }
                                    });
                                  }}
                                />
                                <label className="form-check-label fw-semibold" htmlFor={`dia-${dia}`}>
                                  {dia.charAt(0).toUpperCase() + dia.slice(1)}
                                </label>
                              </div>
                            </div>
                            
                            {horario.activo && (
                              <>
                                <div className="col-md-2">
                                  <label className="form-label small mb-1">Entrada</label>
                                  <input
                                    type="time"
                                    className="form-control form-control-sm"
                                    value={horario.entrada}
                                    onChange={(e) => {
                                      setFormularioMiembro({
                                        ...formularioMiembro,
                                        horarios: {
                                          ...formularioMiembro.horarios,
                                          [dia]: { ...horario, entrada: e.target.value }
                                        }
                                      });
                                    }}
                                  />
                                </div>
                                
                                <div className="col-md-2">
                                  <label className="form-label small mb-1">Salida</label>
                                  <input
                                    type="time"
                                    className="form-control form-control-sm"
                                    value={horario.salida}
                                    onChange={(e) => {
                                      setFormularioMiembro({
                                        ...formularioMiembro,
                                        horarios: {
                                          ...formularioMiembro.horarios,
                                          [dia]: { ...horario, salida: e.target.value }
                                        }
                                      });
                                    }}
                                  />
                                </div>
                                
                                <div className="col-md-2">
                                  <label className="form-label small mb-1">Comida Inicio</label>
                                  <input
                                    type="time"
                                    className="form-control form-control-sm"
                                    value={horario.comidaInicio}
                                    onChange={(e) => {
                                      setFormularioMiembro({
                                        ...formularioMiembro,
                                        horarios: {
                                          ...formularioMiembro.horarios,
                                          [dia]: { ...horario, comidaInicio: e.target.value }
                                        }
                                      });
                                    }}
                                  />
                                </div>
                                
                                <div className="col-md-2">
                                  <label className="form-label small mb-1">Comida Fin</label>
                                  <input
                                    type="time"
                                    className="form-control form-control-sm"
                                    value={horario.comidaFin}
                                    onChange={(e) => {
                                      setFormularioMiembro({
                                        ...formularioMiembro,
                                        horarios: {
                                          ...formularioMiembro.horarios,
                                          [dia]: { ...horario, comidaFin: e.target.value }
                                        }
                                      });
                                    }}
                                  />
                                </div>
                              </>
                            )}
                            
                            {!horario.activo && (
                              <div className="col-md-10">
                                <small className="text-muted">Día no laborable</small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estado y Notas */}
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Estado y Observaciones</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Estado</label>
                    <select
                      className="form-select"
                      value={formularioMiembro.activo}
                      onChange={(e) => setFormularioMiembro({...formularioMiembro, activo: e.target.value === 'true'})}
                    >
                      <option value={true}>Activo</option>
                      <option value={false}>Inactivo</option>
                    </select>
                  </div>
                  
                  <div className="col-md-12">
                    <label className="form-label">Notas</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={formularioMiembro.notas}
                      onChange={(e) => setFormularioMiembro({...formularioMiembro, notas: e.target.value})}
                      placeholder="Observaciones adicionales..."
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-3">
                <button
                  type="button"
                  onClick={() => setVistaActual('equipo')}
                  className="btn btn-outline-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarMiembro}
                  className="btn btn-primary"
                >
                  <Save size={16} className="me-2" />
                  {modoEdicion ? 'Actualizar' : 'Guardar'} Miembro
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Componente Detalles del Miembro
  const DetallesMiembro = () => {
    return (
      <div>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
        
        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="mb-0">Detalles del Miembro</h3>
            <div className="d-flex gap-3">
              <button
                onClick={() => editarMiembro(miembroSeleccionado)}
                className="btn btn-primary d-flex align-items-center"
              >
                <Edit size={16} className="me-2" />
                Editar
              </button>
              <button
                onClick={() => setVistaActual('equipo')}
                className="btn btn-outline-secondary"
              >
                Volver
              </button>
            </div>
          </div>

          {miembroSeleccionado && (
            <div className="row g-4">
              {/* Información Personal */}
              <div className="col-md-8">
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Información Personal</h5>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Código:</strong>
                        <span className="h5 text-primary">{miembroSeleccionado.codigoAgente}</span>
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Estado:</strong>
                        <span className={`badge ${miembroSeleccionado.activo ? 'bg-success' : 'bg-secondary'} fs-6`}>
                          {miembroSeleccionado.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="col-12">
                        <strong className="d-block text-muted">Nombre completo:</strong>
                        <h5>{miembroSeleccionado.nombre} {miembroSeleccionado.apellidoPaterno} {miembroSeleccionado.apellidoMaterno}</h5>
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Email:</strong>
                        {miembroSeleccionado.email || '-'}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Teléfono:</strong>
                        {miembroSeleccionado.telefono || '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información Laboral */}
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Información Laboral</h5>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Puesto:</strong>
                        <span className={`badge ${
                          miembroSeleccionado.puesto === 'Supervisor' ? 'bg-warning' :
                          miembroSeleccionado.puesto === 'Gerente' ? 'bg-danger' :
                          miembroSeleccionado.puesto === 'Coordinador' ? 'bg-info' :
                          'bg-primary'
                        } fs-6`}>
                          {miembroSeleccionado.puesto}
                        </span>
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Departamento:</strong>
                        {miembroSeleccionado.departamento}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Fecha de Ingreso:</strong>
                        {miembroSeleccionado.fechaIngreso}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Fecha de Registro:</strong>
                        {miembroSeleccionado.fechaRegistro}
                      </div>
                      {miembroSeleccionado.salario && (
                        <div className="col-md-6">
                          <strong className="d-block text-muted">Salario Base:</strong>
                          ${miembroSeleccionado.salario}
                        </div>
                      )}
                      {miembroSeleccionado.comision && (
                        <div className="col-md-6">
                          <strong className="d-block text-muted">Comisión:</strong>
                          {miembroSeleccionado.comision}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Aseguradoras Autorizadas */}
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Aseguradoras Autorizadas</h5>
                    {miembroSeleccionado.aseguradorasAutorizadas?.length > 0 ? (
                      <div>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          {miembroSeleccionado.aseguradorasAutorizadas.map(aseguradora => (
                            <span key={aseguradora} className="badge bg-primary">
                              {aseguradora}
                            </span>
                          ))}
                        </div>
                        
                        {Object.keys(miembroSeleccionado.comisionesPorProducto || {}).length > 0 && (
                          <div>
                            <strong className="d-block text-muted mb-2">Comisiones por Producto:</strong>
                            <div className="table-responsive">
                              <table className="table table-sm">
                                <thead>
                                  <tr>
                                    <th>Producto</th>
                                    {miembroSeleccionado.aseguradorasAutorizadas.map(aseg => (
                                      <th key={aseg}>{aseg}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {productos.map(producto => {
                                    const tieneComisiones = miembroSeleccionado.aseguradorasAutorizadas.some(aseg => 
                                      miembroSeleccionado.comisionesPorProducto[`${producto}-${aseg}`]
                                    );
                                    
                                    if (!tieneComisiones) return null;
                                    
                                    return (
                                      <tr key={producto}>
                                        <td><strong>{producto}</strong></td>
                                        {miembroSeleccionado.aseguradorasAutorizadas.map(aseg => (
                                          <td key={aseg}>
                                            {miembroSeleccionado.comisionesPorProducto[`${producto}-${aseg}`] ? 
                                              `${miembroSeleccionado.comisionesPorProducto[`${producto}-${aseg}`]}%` : 
                                              '-'
                                            }
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">No hay aseguradoras autorizadas configuradas</p>
                    )}
                  </div>
                </div>

                {/* Horario de Trabajo */}
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Horario de Trabajo</h5>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Horario:</strong>
                        <div className="d-flex align-items-center">
                          <Clock size={16} className="me-2 text-muted" />
                          {Object.entries(miembroSeleccionado.horarios || {}).filter(([_, horario]) => horario.activo).length > 0 ? (
                            <div>
                              {Object.entries(miembroSeleccionado.horarios || {})
                                .filter(([_, horario]) => horario.activo)
                                .map(([dia, horario]) => (
                                  <div key={dia} className="small">
                                    <strong>{dia.charAt(0).toUpperCase() + dia.slice(1)}:</strong> {horario.entrada} - {horario.salida}
                                    {horario.comidaInicio && horario.comidaFin && (
                                      <span className="text-muted"> (Comida: {horario.comidaInicio} - {horario.comidaFin})</span>
                                    )}
                                  </div>
                                ))
                              }
                            </div>
                          ) : (
                            'No definido'
                          )}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Días de Trabajo:</strong>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {Object.entries(miembroSeleccionado.horarios || {})
                            .filter(([_, horario]) => horario.activo)
                            .map(([dia, _]) => (
                              <span key={dia} className="badge bg-secondary">
                                {dia.charAt(0).toUpperCase() + dia.slice(1)}
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notas */}
                {miembroSeleccionado.notas && (
                  <div className="card mt-3">
                    <div className="card-body">
                      <h5 className="card-title border-bottom pb-2">Notas</h5>
                      <p>{miembroSeleccionado.notas}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Panel lateral con estadísticas */}
              <div className="col-md-4">
                <div className="card">
                  <div className="card-body text-center">
                    <div className="mb-3">
                      <UserPlus size={48} className="text-primary" />
                    </div>
                    <h5 className="card-title">{miembroSeleccionado.nombre}</h5>
                    <p className="text-muted">{miembroSeleccionado.puesto}</p>
                    <hr />
                    <div className="row text-center">
                      <div className="col-6">
                        <div className="h4 text-success">0</div>
                        <small className="text-muted">Expedientes</small>
                      </div>
                      <div className="col-6">
                        <div className="h4 text-info">0</div>
                        <small className="text-muted">Ventas</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información de contacto rápido */}
                <div className="card mt-3">
                  <div className="card-body">
                    <h6 className="card-title">Contacto Rápido</h6>
                    {miembroSeleccionado.telefono && (
                      <div className="mb-2">
                        <Phone size={16} className="me-2 text-muted" />
                        <a href={`tel:${miembroSeleccionado.telefono}`} className="text-decoration-none">
                          {miembroSeleccionado.telefono}
                        </a>
                      </div>
                    )}
                    {miembroSeleccionado.email && (
                      <div>
                        <Mail size={16} className="me-2 text-muted" />
                        <a href={`mailto:${miembroSeleccionado.email}`} className="text-decoration-none">
                          {miembroSeleccionado.email}
                        </a>
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

  // Renderizado condicional basado en la vista actual
  return (
    <div>
      {vistaActual === 'equipo' && <ListaEquipoComponent />}
      {vistaActual === 'formulario-miembro' && <FormularioMiembro />}
      {vistaActual === 'detalles-miembro' && miembroSeleccionado && <DetallesMiembro />}
    </div>
  );
};

export default EquipoDeTrabajo;
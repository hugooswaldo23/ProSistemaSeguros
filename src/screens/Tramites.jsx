const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, FileText, X, Save, ChevronLeft, ChevronRight, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';
// Nuevos imports para habilitar selección de cliente y ejecutivo
import BuscadorCliente from '../components/BuscadorCliente';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';
import { useAseguradoras } from '../hooks/useAseguradoras';  // 🆕 Hook para aseguradoras
import { obtenerTiposTramitesActivos } from '../services/tiposTramitesService';  // 🆕 Servicio para tipos de trámite

const getAuthHeaders = (includeJson = false) => {
  const token = localStorage.getItem('ss_token');
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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

// Lista de Trámites
const ListaTramitesComponent = ({ 
  tramites, 
  limpiarFormularioTramite, 
  setVistaActual, 
  verDetallesTramite, 
  editarTramite, 
  eliminarTramite,
  todosExpedientes = [] 
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
                      <th className="text-center align-middle">Código</th>
                      <th className="text-center align-middle">Tipo de Trámite</th>
                      <th>Aseguradora</th>
                      <th className="text-center">Agente</th>
                      <th>Ejecutivo</th>
                      <th>Estatus</th>
                      <th className="text-center">Fechas</th>
                      <th width="120">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacion.itemsPaginados.map((tramite) => (
                      <tr key={tramite.id}>
                        <td className="text-center align-middle">
                          <strong className="text-primary">{tramite.codigo}</strong>
                        </td>
                        <td className="text-center align-middle">
                          <span className="fw-semibold">{tramite.tipoTramite}</span>
                        </td>
                        <td>
                          {(() => {
                            const exp = todosExpedientes.find(e => 
                              String(e.numero_poliza || e.poliza) === String(tramite.expediente)
                            );
                            const aseg = exp?.compania || exp?.aseguradora || '-';
                            const producto = exp?.producto || exp?.plan || '-';
                            return (
                              <div>
                                <div className="fw-semibold">{aseg}</div>
                                <small className="text-muted">{producto}</small>
                                <small className="d-block text-primary">{tramite.expediente || 'N/A'}</small>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="align-middle">
                          {(() => {
                            const exp = todosExpedientes.find(e => 
                              String(e.numero_poliza || e.poliza) === String(tramite.expediente)
                            );
                            const clave = exp?.clave_agente || exp?.agente?.split('-')[0]?.trim() || '-';
                            // Obtener solo el nombre sin la clave
                            const agenteCompleto = exp?.nombre_agente || exp?.agente || '';
                            const nombreAgenteRaw = agenteCompleto.includes('-') 
                              ? agenteCompleto.split('-').slice(1).join('-').trim() 
                              : (agenteCompleto !== clave ? agenteCompleto : '');
                            // Extraer primer nombre y apellido paterno del agente
                            const palabrasAgente = nombreAgenteRaw.trim().split(/\s+/);
                            const nombreAgente = palabrasAgente.length >= 2 
                              ? `${palabrasAgente[0]} ${palabrasAgente[palabrasAgente.length > 2 ? palabrasAgente.length - 2 : 1]}` 
                              : nombreAgenteRaw;
                            // Buscar vendedor en múltiples campos posibles
                            const vendedorRaw = exp?.vendedor || exp?.subagente || exp?.sub_agente || exp?.ejecutivo_comercial || '';
                            // Extraer primer nombre y apellido paterno del vendedor
                            const palabrasVendedor = vendedorRaw.trim().split(/\s+/);
                            const vendedor = palabrasVendedor.length >= 2 
                              ? `${palabrasVendedor[0]} ${palabrasVendedor[palabrasVendedor.length > 2 ? palabrasVendedor.length - 2 : 1]}` 
                              : vendedorRaw;
                            return (
                              <div style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                <div><strong>{clave}</strong></div>
                                {nombreAgente && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{nombreAgente.toUpperCase()}</div>}
                                {vendedor && <div className="text-warning" style={{ fontSize: '0.75rem' }}>V: {vendedor}</div>}
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <small className="fw-semibold">{tramite.ejecutivoAsignado || '-'}</small>
                        </td>
                        <td>
                          <span className={`badge ${getEstatusColor(tramite.estatus)}`}>
                            {tramite.estatus}
                          </span>
                        </td>
                        <td className="text-center">
                          {(() => {
                            const formatearFecha = (fechaStr) => {
                              if (!fechaStr) return '-';
                              try {
                                // Parsear la fecha - new Date() convierte UTC a hora local automáticamente
                                const fecha = new Date(fechaStr);
                                
                                if (isNaN(fecha.getTime())) return '-';
                                
                                const dia = fecha.getDate().toString().padStart(2, '0');
                                const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
                                const anio = fecha.getFullYear();
                                const hora = fecha.getHours().toString().padStart(2, '0');
                                const min = fecha.getMinutes().toString().padStart(2, '0');
                                
                                return `${dia}/${mes}/${anio} ${hora}:${min}`;
                              } catch { return '-'; }
                            };
                            return (
                              <div style={{ fontSize: '0.75rem' }}>
                                <div><span className="text-muted">Inicio:</span> {formatearFecha(tramite.fechaInicio)}</div>
                                <div className={tramite.fechaLimite && new Date(tramite.fechaLimite) < new Date() ? 'text-danger' : ''}>
                                  <span className="text-muted">Meta:</span> {formatearFecha(tramite.fechaLimite)}
                                </div>
                              </div>
                            );
                          })()}
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
  guardarTramite,
  clienteSeleccionado,
  setClienteSeleccionado,
  expedientesCliente,
  cargandoExpedientesCliente,
  ejecutivoAsignado,
  setEjecutivoAsignado,
  ejecutivos,
  conteoPolizasPorCliente,  // 🆕 Prop para conteo de pólizas
  equipoDeTrabajo,          // 🆕 Equipo completo para buscar agentes
  aseguradoras,             // 🆕 Lista de aseguradoras con productos
  tiposTramiteDisponibles   // 🆕 Tipos de trámite desde el backend
}) => {
  const siguienteCodigo = !modoEdicionTramite ? generarCodigoTramite() : formularioTramite.codigo;
  
  // 🆕 Función para buscar ejecutivo asignado basándose en la póliza seleccionada
  const buscarEjecutivoAsignado = useCallback(async (expediente) => {
    console.log('🔍 Buscando ejecutivo para expediente:', expediente);
    if (!expediente) return null;
    
    try {
      // 1. Obtener la clave del agente de la póliza (puede ser clave ante aseguradora)
      const claveAgente = expediente.agente ? expediente.agente.split('-')[0].trim() : '';
      console.log('1. Clave agente:', claveAgente);
      if (!claveAgente) {
        console.log('❌ No hay clave de agente');
        return null;
      }
      
      // 2. Obtener datos de la póliza
      const compania = (expediente.compania || expediente.aseguradora || '').toLowerCase().trim();
      const producto = (expediente.producto || expediente.plan || '').toLowerCase().trim();
      console.log('2. Compañía:', compania, '| Producto:', producto);
      
      // 3. Buscar la aseguradora
      const aseguradoraEncontrada = aseguradoras?.find(a => 
        (a.nombre || '').toLowerCase().includes(compania) ||
        compania.includes((a.nombre || '').toLowerCase())
      );
      console.log('3. Aseguradora encontrada:', aseguradoraEncontrada?.nombre, '| ID:', aseguradoraEncontrada?.id);
      
      // 4. Buscar en TODOS los agentes del equipo de trabajo
      const { obtenerEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
      
      // Filtrar solo agentes del equipo
      const agentes = equipoDeTrabajo?.filter(m => 
        m.perfil === 'Agente' || m.perfil?.toLowerCase().includes('agente')
      ) || [];
      console.log('4. Agentes en equipo:', agentes.length);
      
      let ejecutivoEncontrado = null;
      
      for (const agente of agentes) {
        console.log('4. Revisando agente:', agente.nombre, '| ID:', agente.id);
        
        const resultado = await obtenerEjecutivosPorProducto(agente.id);
        if (!resultado.success || !resultado.data || resultado.data.length === 0) continue;
        
        console.log('4. Asignaciones del agente:', resultado.data);
        
        // Buscar asignación que coincida con:
        // - La clave del agente ante aseguradora (campo clave)
        // - O la aseguradora y producto
        for (const asignacion of resultado.data) {
          const claveCoincide = asignacion.clave && String(asignacion.clave) === String(claveAgente);
          const aseguradoraCoincide = aseguradoraEncontrada && 
            String(asignacion.aseguradoraId) === String(aseguradoraEncontrada.id);
          
          console.log('5. Evaluando asignación:', {
            clave: asignacion.clave,
            claveCoincide,
            aseguradoraId: asignacion.aseguradoraId,
            aseguradoraCoincide,
            ejecutivoId: asignacion.ejecutivoId
          });
          
          // Si la clave del agente coincide Y hay ejecutivo asignado
          if (claveCoincide && asignacion.ejecutivoId) {
            // Verificar que también coincida la aseguradora si está disponible
            if (!aseguradoraEncontrada || aseguradoraCoincide) {
              ejecutivoEncontrado = asignacion.ejecutivoId;
              console.log('✅ Match por clave de agente:', claveAgente);
              break;
            }
          }
        }
        
        if (ejecutivoEncontrado) break;
      }
      
      if (!ejecutivoEncontrado) {
        console.log('❌ No se encontró ejecutivo asignado');
        return null;
      }
      
      // 6. Buscar el ejecutivo en el equipo de trabajo
      const ejecutivo = equipoDeTrabajo?.find(m => 
        String(m.id) === String(ejecutivoEncontrado)
      );
      console.log('6. Ejecutivo encontrado:', ejecutivo);
      
      if (ejecutivo) {
        const nombreCompleto = `${ejecutivo.nombre} ${ejecutivo.apellidoPaterno || ''}`.trim();
        console.log('✅ Ejecutivo asignado:', nombreCompleto);
        return nombreCompleto;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error buscando ejecutivo asignado:', error);
      return null;
    }
  }, [equipoDeTrabajo, aseguradoras]);
  
  // Helper para etiquetar pólizas con detalles del vehículo
  const etiquetaPoliza = useCallback((exp) => {
    const numero = exp.numero_poliza || `EXP-${exp.id}`;
    const producto = exp.producto || exp.plan || '';
    const modelo = exp.modelo || '';
    const anio = exp.anio || exp.año || '';
    const vin = exp.numero_serie || exp.vin || '';
    const placas = exp.placas || '';
    const partes = [numero];
    if (producto) partes.push(producto);
    // Datos de auto si existen
    const autoPartes = [];
    if (modelo) autoPartes.push(modelo);
    if (anio) autoPartes.push(`(${anio})`);
    if (placas) autoPartes.push(`Placas ${placas}`);
    if (vin) {
      const suf = String(vin).slice(-8); // Mostrar últimos 8 caracteres del VIN
      autoPartes.push(`VIN …${suf}`);
    }
    if (autoPartes.length > 0) partes.push(autoPartes.join(' '));
    return partes.join(' • ');
  }, []);
  
  // 🆕 Usar tipos de trámite desde el backend (prop) - ahora son objetos con nombre y tiempoEstimado
  const tiposTramiteObjetos = tiposTramiteDisponibles && tiposTramiteDisponibles.length > 0 
    ? tiposTramiteDisponibles
    : [
        { nombre: 'Emisión de póliza', tiempoEstimado: 24 },
        { nombre: 'Renovación', tiempoEstimado: 48 },
        { nombre: 'Cancelación', tiempoEstimado: 48 },
        { nombre: 'Endoso', tiempoEstimado: 24 },
        { nombre: 'Reclamación', tiempoEstimado: 72 },
        { nombre: 'Inspección', tiempoEstimado: 48 },
        { nombre: 'Documentación', tiempoEstimado: 24 },
        { nombre: 'Pago de prima', tiempoEstimado: 12 },
        { nombre: 'Reembolso', tiempoEstimado: 72 },
        { nombre: 'Otro', tiempoEstimado: 24 }
      ];
  
  // Para compatibilidad, extraer solo nombres
  const tiposTramite = tiposTramiteObjetos.map(t => typeof t === 'string' ? t : t.nombre);
  
  // 🆕 Función para calcular fecha límite basada en tiempo estimado (HORAS HÁBILES)
  // Horario hábil: Lunes a Viernes, 9:00 AM a 6:00 PM (9 horas por día)
  const calcularFechaLimite = useCallback((fechaInicio, tipoTramiteNombre) => {
    if (!fechaInicio || !tipoTramiteNombre) return '';
    
    const tipoObj = tiposTramiteObjetos.find(t => 
      (typeof t === 'string' ? t : t.nombre) === tipoTramiteNombre
    );
    const horasEstimadas = tipoObj?.tiempoEstimado || 24; // Default 24 horas hábiles
    
    const fecha = new Date(fechaInicio);
    let horasRestantes = horasEstimadas;
    
    // Horario hábil: 9:00 AM a 6:00 PM (hora 9 a hora 18)
    const HORA_INICIO = 9;
    const HORA_FIN = 18;
    const HORAS_POR_DIA = HORA_FIN - HORA_INICIO; // 9 horas hábiles por día
    
    // Ajustar si la hora inicial está fuera del horario hábil
    const ajustarAHorarioHabil = (d) => {
      const dia = d.getDay(); // 0=Domingo, 6=Sábado
      const hora = d.getHours();
      
      // Si es fin de semana, mover al lunes
      if (dia === 0) d.setDate(d.getDate() + 1); // Domingo -> Lunes
      else if (dia === 6) d.setDate(d.getDate() + 2); // Sábado -> Lunes
      
      // Si es antes de las 9 AM, mover a las 9 AM
      if (d.getHours() < HORA_INICIO) {
        d.setHours(HORA_INICIO, 0, 0, 0);
      }
      // Si es después de las 6 PM, mover al siguiente día hábil a las 9 AM
      else if (d.getHours() >= HORA_FIN) {
        d.setDate(d.getDate() + 1);
        d.setHours(HORA_INICIO, 0, 0, 0);
        // Verificar si el nuevo día es fin de semana
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        else if (d.getDay() === 6) d.setDate(d.getDate() + 2);
      }
      return d;
    };
    
    ajustarAHorarioHabil(fecha);
    
    while (horasRestantes > 0) {
      const horaActual = fecha.getHours();
      const horasHastaFinDia = HORA_FIN - horaActual;
      
      if (horasRestantes <= horasHastaFinDia) {
        // Las horas restantes caben en el día actual
        fecha.setHours(fecha.getHours() + horasRestantes);
        horasRestantes = 0;
      } else {
        // Consumir el resto del día y pasar al siguiente día hábil
        horasRestantes -= horasHastaFinDia;
        fecha.setDate(fecha.getDate() + 1);
        fecha.setHours(HORA_INICIO, 0, 0, 0);
        
        // Saltar fines de semana
        while (fecha.getDay() === 0 || fecha.getDay() === 6) {
          fecha.setDate(fecha.getDate() + 1);
        }
      }
    }
    
    // Formatear como YYYY-MM-DDTHH:MM para el input datetime-local
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const hora = String(fecha.getHours()).padStart(2, '0');
    const min = String(fecha.getMinutes()).padStart(2, '0');
    return `${anio}-${mes}-${dia}T${hora}:${min}`;
  }, [tiposTramiteObjetos]);

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
                    onChange={(e) => {
                      const tipoSeleccionado = e.target.value;
                      // Obtener fecha inicio actual o generar una nueva con hora
                      const ahora = new Date();
                      const fechaHoraLocal = ahora.getFullYear() + '-' + 
                        String(ahora.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(ahora.getDate()).padStart(2, '0') + 'T' + 
                        String(ahora.getHours()).padStart(2, '0') + ':' + 
                        String(ahora.getMinutes()).padStart(2, '0');
                      const fechaInicio = formularioTramite.fechaInicio || fechaHoraLocal;
                      const fechaLimite = calcularFechaLimite(fechaInicio, tipoSeleccionado);
                      
                      setFormularioTramite({
                        ...formularioTramite, 
                        tipoTramite: tipoSeleccionado,
                        fechaLimite: fechaLimite
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposTramiteObjetos.map(tipo => {
                      const nombre = typeof tipo === 'string' ? tipo : tipo.nombre;
                      const horas = typeof tipo === 'string' ? 24 : (tipo.tiempoEstimado || 24);
                      return (
                        <option key={nombre} value={nombre}>{nombre} ({horas} hrs)</option>
                      );
                    })}
                  </select>
                  {tiposTramiteDisponibles.length === 0 && (
                    <small className="form-text text-info">
                      💡 Puedes configurar tipos personalizados en "Configuración de Tablas"
                    </small>
                  )}
                  {tiposTramiteDisponibles.length > 0 && (
                    <small className="form-text text-success">
                      ✅ Usando catálogo personalizado ({tiposTramite.length} tipos disponibles)
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
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formularioTramite.descripcion}
                    onChange={(e) => setFormularioTramite({...formularioTramite, descripcion: e.target.value})}
                    placeholder="Describe el trámite a realizar..."
                  />
                </div>
              </div>
            </div>

            {/* Selección de Cliente y Póliza (Expediente) */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Cliente y Póliza</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Seleccionar Cliente <span className="text-danger">*</span></label>
                  <BuscadorCliente 
                    onClienteSeleccionado={(cliente) => {
                      if (cliente && cliente !== 'CREAR_NUEVO') {
                        setClienteSeleccionado(cliente);
                        setFormularioTramite(prev => ({
                          ...prev,
                          cliente: cliente.tipoPersona === 'Persona Moral' ? (cliente.razonSocial || cliente.razon_social || '') : `${cliente.nombre || ''} ${cliente.apellidoPaterno || ''}`.trim(),
                          cliente_id: cliente.id
                        }));
                      } else if (cliente === 'CREAR_NUEVO') {
                        alert('Funcionalidad para crear cliente no implementada en este módulo.');
                      } else {
                        setClienteSeleccionado(null);
                        setFormularioTramite(prev => ({ ...prev, cliente: '', cliente_id: null }));
                      }
                    }}
                    clienteSeleccionado={clienteSeleccionado}
                    conteoPolizasPorCliente={conteoPolizasPorCliente}
                  />
                  {clienteSeleccionado && (
                    <small className="text-success">Cliente seleccionado: {formularioTramite.cliente}</small>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Seleccionar Póliza (Expediente) <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={formularioTramite.expediente_id || ''}
                    onChange={async (e) => {
                      const valor = e.target.value;
                      if (!valor) {
                        setFormularioTramite(prev => ({ ...prev, expediente: '', expediente_id: null }));
                        setEjecutivoAsignado('');
                        return;
                      }
                      const exp = expedientesCliente.find(ex => String(ex.id) === valor);
                      setFormularioTramite(prev => ({
                        ...prev,
                        expediente: exp ? (exp.numero_poliza || `EXP-${exp.id}`) : '',
                        expediente_id: exp ? exp.id : null
                      }));
                      
                      // 🆕 Buscar y asignar ejecutivo automáticamente
                      if (exp) {
                        const ejecutivoEncontrado = await buscarEjecutivoAsignado(exp);
                        if (ejecutivoEncontrado) {
                          setEjecutivoAsignado(ejecutivoEncontrado);
                          setFormularioTramite(prev => ({ ...prev, ejecutivoAsignado: ejecutivoEncontrado }));
                        }
                      }
                    }}
                    disabled={!clienteSeleccionado || cargandoExpedientesCliente}
                  >
                    <option value="">{!clienteSeleccionado ? 'Seleccione un cliente primero' : (cargandoExpedientesCliente ? 'Cargando pólizas...' : 'Seleccionar póliza')}</option>
                    {expedientesCliente.map(exp => (
                      <option key={exp.id} value={exp.id}>
                        {etiquetaPoliza(exp)}
                      </option>
                    ))}
                  </select>
                  {clienteSeleccionado && expedientesCliente.length === 0 && !cargandoExpedientesCliente && (
                    <small className="text-warning">Este cliente no tiene pólizas registradas.</small>
                  )}
                  {formularioTramite.expediente_id && (
                    <small className="text-success d-block mt-1">Póliza seleccionada: {formularioTramite.expediente}</small>
                  )}
                </div>
              </div>
              {formularioTramite.expediente_id && (
                <div className="mt-3 p-3 border rounded bg-light">
                  <strong className="d-block mb-1">Resumen de Póliza:</strong>
                  {(() => {
                    const exp = expedientesCliente.find(ex => ex.id === formularioTramite.expediente_id);
                    if (!exp) return null;
                    return (
                      <div className="small text-muted">
                        <div><strong>Número:</strong> {exp.numero_poliza || 'N/A'}</div>
                        <div><strong>Producto:</strong> {exp.producto || exp.plan || 'N/A'}</div>
                        <div><strong>Aseguradora:</strong> {exp.compania || exp.aseguradora || 'N/A'}</div>
                        <div><strong>Vigencia:</strong> {exp.inicio_vigencia || exp.fecha_emision || '¿?'} - {exp.termino_vigencia || exp.fecha_vencimiento_pago || '¿?'}</div>
                        {(exp.modelo || exp.anio || exp.numero_serie || exp.placas) && (
                          <div>
                            <strong>Vehículo:</strong> {exp.modelo || '-'} {exp.anio ? `(${exp.anio})` : ''} {exp.placas ? `• Placas ${exp.placas}` : ''} {exp.numero_serie ? `• VIN …${String(exp.numero_serie).slice(-8)}` : ''}
                          </div>
                        )}
                        {exp.estatus_pago && <div><strong>Estatus Pago:</strong> {exp.estatus_pago}</div>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Asignación de Ejecutivo */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Asignación</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Ejecutivo Asignado <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={ejecutivoAsignado || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEjecutivoAsignado(val);
                      setFormularioTramite(prev => ({ ...prev, ejecutivoAsignado: val }));
                    }}
                    required
                  >
                    <option value="">Seleccionar ejecutivo</option>
                    {ejecutivos.map(ej => {
                      const nombreCompleto = `${ej.nombre} ${ej.apellidoPaterno || ''}`.trim();
                      return (
                        <option key={ej.id} value={nombreCompleto}>{nombreCompleto}</option>
                      );
                    })}
                  </select>
                  {ejecutivos.length === 0 && (
                    <small className="text-muted">No hay ejecutivos registrados en el equipo de trabajo.</small>
                  )}
                  {formularioTramite.expediente_id && ejecutivoAsignado && (
                    <small className="form-text text-success">✅ Asignado automáticamente según configuración</small>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Prioridad <span className="text-danger">*</span></label>
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

            {/* Fechas */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Fechas</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Fecha de Inicio <span className="text-danger">*</span></label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formularioTramite.fechaInicio}
                    onChange={(e) => {
                      const nuevaFechaInicio = e.target.value;
                      // Recalcular fecha límite si hay tipo de trámite seleccionado
                      const fechaLimite = formularioTramite.tipoTramite 
                        ? calcularFechaLimite(nuevaFechaInicio, formularioTramite.tipoTramite)
                        : formularioTramite.fechaLimite;
                      setFormularioTramite({
                        ...formularioTramite, 
                        fechaInicio: nuevaFechaInicio,
                        fechaLimite: fechaLimite
                      });
                    }}
                    required
                  />
                </div>
                
                <div className="col-md-6">
                  <label className="form-label">Fecha Límite <span className="text-danger">*</span></label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={formularioTramite.fechaLimite}
                    onChange={(e) => setFormularioTramite({...formularioTramite, fechaLimite: e.target.value})}
                    required
                  />
                  {formularioTramite.tipoTramite && (
                    <small className="form-text text-info">
                      ⏱️ Calculada automáticamente según tiempo meta del trámite
                    </small>
                  )}
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

  // Función auxiliar para obtener fecha y hora local en formato datetime-local
  const obtenerFechaHoraLocal = () => {
    const ahora = new Date();
    return ahora.getFullYear() + '-' + 
      String(ahora.getMonth() + 1).padStart(2, '0') + '-' + 
      String(ahora.getDate()).padStart(2, '0') + 'T' + 
      String(ahora.getHours()).padStart(2, '0') + ':' + 
      String(ahora.getMinutes()).padStart(2, '0');
  };

  // Estado del formulario de trámite
  const [formularioTramite, setFormularioTramite] = useState({
    codigo: '',
    tipoTramite: '',
    descripcion: '',
    cliente: '',
    expediente: '',
    estatus: 'Pendiente',
    prioridad: 'Media',
    fechaInicio: obtenerFechaHoraLocal(),
    fechaLimite: '',
    responsable: '',
    departamento: '',
    observaciones: '',
    fechaCreacion: obtenerFechaHoraLocal(),
    id: null
  });

  // Estado para cliente seleccionado y expedientes asociados
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [expedientesCliente, setExpedientesCliente] = useState([]);
  const [cargandoExpedientesCliente, setCargandoExpedientesCliente] = useState(false);
  const [ejecutivoAsignado, setEjecutivoAsignado] = useState('');
  
  // 🆕 Estado para el conteo de pólizas por cliente
  const [todosExpedientes, setTodosExpedientes] = useState([]);
  const conteoPolizasPorCliente = useMemo(() => {
    const listaExpedientes = Array.isArray(todosExpedientes) ? todosExpedientes : [];
    const conteo = {};
    listaExpedientes.forEach(exp => {
      const clienteId = exp.cliente_id;
      if (clienteId) {
        conteo[clienteId] = (conteo[clienteId] || 0) + 1;
      }
    });
    return conteo;
  }, [todosExpedientes]);
  
  // Equipo de trabajo para listar ejecutivos
  const { equipoDeTrabajo } = useEquipoDeTrabajo();
  const ejecutivos = useMemo(() => (equipoDeTrabajo || []).filter(m => (m.perfil || '').toLowerCase().includes('ejecut')) , [equipoDeTrabajo]);

  // 🆕 Aseguradoras para buscar ejecutivos por producto
  const { aseguradoras } = useAseguradoras();

  // 🆕 Estado para tipos de trámite desde el backend (objetos completos con tiempoEstimado)
  const [tiposTramiteDisponibles, setTiposTramiteDisponibles] = useState([]);
  
  // 🆕 Cargar tipos de trámite al montar
  useEffect(() => {
    const cargarTiposTramite = async () => {
      try {
        const resultado = await obtenerTiposTramitesActivos();
        if (resultado.success && resultado.data) {
          // Guardar objetos completos (incluye tiempoEstimado)
          setTiposTramiteDisponibles(resultado.data);
        }
      } catch (e) {
        console.error('Error cargando tipos de trámite:', e);
      }
    };
    cargarTiposTramite();
  }, []);

  // 🆕 Cargar todos los expedientes al montar (para el conteo)
  useEffect(() => {
    const cargarTodosExpedientes = async () => {
      try {
        const res = await fetch(`${API_URL}/api/expedientes`, {
          headers: getAuthHeaders()
        });
        if (!res.ok) {
          setTodosExpedientes([]);
          return;
        }
        const data = await res.json();
        setTodosExpedientes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error cargando expedientes:', e);
        setTodosExpedientes([]);
      }
    };
    cargarTodosExpedientes();
  }, []);

  // Cargar expedientes del cliente seleccionado
  useEffect(() => {
    const cargarExpedientesCliente = async () => {
      if (!clienteSeleccionado) {
        setExpedientesCliente([]);
        return;
      }
      setCargandoExpedientesCliente(true);
      try {
        // Usar los expedientes ya cargados en lugar de hacer otra petición
        const filtrados = todosExpedientes.filter(exp => String(exp.cliente_id) === String(clienteSeleccionado.id));
        setExpedientesCliente(filtrados);
      } catch (e) {
        console.error('Error cargando expedientes del cliente:', e);
        setExpedientesCliente([]);
      } finally {
        setCargandoExpedientesCliente(false);
      }
    };
    cargarExpedientesCliente();
  }, [clienteSeleccionado, todosExpedientes]);

  // Función para transformar trámites de snake_case a camelCase
  const transformarTramites = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data.map(tramite => ({
      id: tramite.id,
      codigo: tramite.codigo,
      tipoTramite: tramite.tipo_tramite || tramite.tipoTramite,
      descripcion: tramite.descripcion,
      cliente: tramite.cliente,
      expediente: tramite.expediente,
      estatus: tramite.estatus,
      prioridad: tramite.prioridad,
      fechaInicio: tramite.fecha_inicio || tramite.fechaInicio,
      fechaLimite: tramite.fecha_limite || tramite.fechaLimite,
      responsable: tramite.responsable,
      ejecutivoAsignado: tramite.ejecutivo_asignado || tramite.ejecutivoAsignado,
      departamento: tramite.departamento,
      observaciones: tramite.observaciones,
      fechaCreacion: tramite.created_at || tramite.fechaCreacion
    }));
  }, []);

  // Cargar trámites desde el backend al montar el componente
  useEffect(() => {
  fetch(`${API_URL}/api/tramites`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setTramites(transformarTramites(data)))
      .catch(err => console.error('Error al cargar trámites:', err));
  }, [transformarTramites]);

  // Refrescar trámites tras operaciones CRUD
  const cargarTramites = useCallback(() => {
  fetch(`${API_URL}/api/tramites`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setTramites(transformarTramites(data)))
      .catch(err => console.error('Error al cargar trámites:', err));
  }, [transformarTramites]);

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
    // Obtener fecha y hora actual en formato datetime-local
    const ahora = new Date();
    const fechaHoraLocal = ahora.getFullYear() + '-' + 
      String(ahora.getMonth() + 1).padStart(2, '0') + '-' + 
      String(ahora.getDate()).padStart(2, '0') + 'T' + 
      String(ahora.getHours()).padStart(2, '0') + ':' + 
      String(ahora.getMinutes()).padStart(2, '0');
    
    setFormularioTramite({
      codigo: '',
      tipoTramite: '',
      descripcion: '',
      cliente: '',
      expediente: '',
      estatus: 'Pendiente',
      prioridad: 'Media',
      fechaInicio: fechaHoraLocal,
      fechaLimite: '',
      responsable: '',
      departamento: '',
      observaciones: '',
      fechaCreacion: fechaHoraLocal,
      id: null
    });
    setModoEdicionTramite(false);
    setTramiteSeleccionado(null);
    setClienteSeleccionado(null);
    setExpedientesCliente([]);
    setEjecutivoAsignado('');
  }, []);

  // Crear o actualizar trámite en el backend
  const guardarTramite = useCallback(() => {
    // Validar campos obligatorios
    const camposFaltantes = [];
    
    if (!formularioTramite.tipoTramite) camposFaltantes.push('Tipo de Trámite');
    if (!clienteSeleccionado) camposFaltantes.push('Cliente');
    if (!formularioTramite.expediente) camposFaltantes.push('Póliza');
    if (!ejecutivoAsignado && !formularioTramite.ejecutivoAsignado) camposFaltantes.push('Ejecutivo Asignado');
    if (!formularioTramite.fechaInicio) camposFaltantes.push('Fecha de Inicio');
    if (!formularioTramite.fechaLimite) camposFaltantes.push('Fecha Límite');
    if (!formularioTramite.prioridad) camposFaltantes.push('Prioridad');
    
    if (camposFaltantes.length > 0) {
      alert(`Por favor complete los campos obligatorios:\n• ${camposFaltantes.join('\n• ')}`);
      return;
    }
    const codigoTramite = formularioTramite.codigo || generarCodigoTramite();
    
    // Payload compatible con API (snake_case SOLO) - campos que la tabla tramites tiene
    const payloadAPI = {
      codigo: codigoTramite,
      tipo_tramite: formularioTramite.tipoTramite,
      descripcion: formularioTramite.descripcion,
      estatus: formularioTramite.estatus || 'Pendiente',
      prioridad: formularioTramite.prioridad || 'Media',
      fecha_inicio: formularioTramite.fechaInicio,
      fecha_limite: formularioTramite.fechaLimite,
      ejecutivo_asignado: formularioTramite.ejecutivoAsignado || ejecutivoAsignado || '',
      cliente: clienteSeleccionado.codigo || clienteSeleccionado.id || '',
      expediente: formularioTramite.expediente || '',
      observaciones: formularioTramite.observaciones || ''
    };
    console.log('📝 Guardando trámite. Payload:', payloadAPI);
    console.log('🕐 fecha_inicio enviada:', payloadAPI.fecha_inicio);
    console.log('🕐 fecha_limite enviada:', payloadAPI.fecha_limite);
    if (modoEdicionTramite) {
      // Actualizar
  fetch(`${API_URL}/api/tramites/${formularioTramite.id}`, {
        method: 'PUT',
      headers: getAuthHeaders(true),
        body: JSON.stringify(payloadAPI)
      })
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            console.error('❌ Error al actualizar trámite:', res.status, text);
            throw new Error(text || 'Error al actualizar trámite');
          }
          try { return JSON.parse(text); } catch { return {}; }
        })
        .then(() => {
          cargarTramites();
          limpiarFormularioTramite();
          setVistaActual('tramites');
        })
        .catch(err => alert('Error al actualizar trámite: ' + (err?.message || '')));
    } else {
      // Crear
  fetch(`${API_URL}/api/tramites`, {
        method: 'POST',
      headers: getAuthHeaders(true),
        body: JSON.stringify(payloadAPI)
      })
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) {
            console.error('❌ Error al crear trámite:', res.status, text);
            throw new Error(text || 'Error al crear trámite');
          }
          try { return JSON.parse(text); } catch { return {}; }
        })
        .then(() => {
          cargarTramites();
          limpiarFormularioTramite();
          setVistaActual('tramites');
        })
        .catch(err => alert('Error al crear trámite: ' + (err?.message || '')));
    }
  }, [formularioTramite, modoEdicionTramite, generarCodigoTramite, limpiarFormularioTramite, cargarTramites, clienteSeleccionado, ejecutivoAsignado]);

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
      method: 'DELETE',
      headers: getAuthHeaders()
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
          todosExpedientes={todosExpedientes}
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
          clienteSeleccionado={clienteSeleccionado}
          setClienteSeleccionado={setClienteSeleccionado}
          expedientesCliente={expedientesCliente}
          cargandoExpedientesCliente={cargandoExpedientesCliente}
          ejecutivoAsignado={ejecutivoAsignado}
          setEjecutivoAsignado={setEjecutivoAsignado}
          ejecutivos={ejecutivos}
          conteoPolizasPorCliente={conteoPolizasPorCliente}
          equipoDeTrabajo={equipoDeTrabajo}
          aseguradoras={aseguradoras}
          tiposTramiteDisponibles={tiposTramiteDisponibles}
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
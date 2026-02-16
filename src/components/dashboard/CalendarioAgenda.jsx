import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, X, Calendar, MapPin, Video, Phone, 
  Trash2, Save, ChevronLeft, ChevronRight,
  CheckCircle, RefreshCw, Clock, MessageSquare, History,
  Users, CalendarRange, TrendingUp, AlertTriangle
} from 'lucide-react';
import { obtenerCitas, crearCita, actualizarCita, eliminarCita as eliminarCitaAPI } from '../../services/citasService';

const API_URL = import.meta.env.VITE_API_URL;

// Tipos de cita con sus colores e iconos
const TIPOS_CITA = {
  presencial: { label: 'Cita Presencial', color: '#3B82F6', bgLight: '#EFF6FF', icon: MapPin },
  web:        { label: 'Cita Web / Videollamada', color: '#8B5CF6', bgLight: '#F5F3FF', icon: Video },
  llamada:    { label: 'Llamada de Seguimiento', color: '#F59E0B', bgLight: '#FFFBEB', icon: Phone }
};

const ESTATUS_CITA = {
  pendiente:  { label: 'Pendiente', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
  atendida:   { label: 'Atendida', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle },
  reagendada: { label: 'Reagendada', color: '#6366F1', bg: '#EEF2FF', icon: RefreshCw }
};

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CITA_VACIA = {
  titulo: '', tipo: 'presencial', fecha: '',
  hora_inicio: '09:00', hora_fin: '10:00',
  cliente: '', notas: '', ubicacion: '',
  estatus: 'pendiente', historial: [],
  asignado_a: '', asignado_a_id: null
};

// ── Helpers de calendario ──
const getDiasDelMes = (anio, mes) => {
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  // lunes=0 … domingo=6
  let diaInicio = primerDia.getDay() - 1;
  if (diaInicio < 0) diaInicio = 6;
  const totalDias = ultimoDia.getDate();
  
  const dias = [];
  // Días del mes anterior (relleno)
  const diasMesAnterior = new Date(anio, mes, 0).getDate();
  for (let i = diaInicio - 1; i >= 0; i--) {
    dias.push({ dia: diasMesAnterior - i, mesActual: false, fecha: formatFecha(anio, mes - 1, diasMesAnterior - i) });
  }
  // Días del mes actual
  for (let d = 1; d <= totalDias; d++) {
    dias.push({ dia: d, mesActual: true, fecha: formatFecha(anio, mes, d) });
  }
  // Relleno final
  const restante = 7 - (dias.length % 7);
  if (restante < 7) {
    for (let d = 1; d <= restante; d++) {
      dias.push({ dia: d, mesActual: false, fecha: formatFecha(anio, mes + 1, d) });
    }
  }
  return dias;
};

const formatFecha = (anio, mes, dia) => {
  const d = new Date(anio, mes, dia);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const CalendarioAgenda = () => {
  const hoy = new Date();
  const [mesActual, setMesActual] = useState(hoy.getMonth());
  const [anioActual, setAnioActual] = useState(hoy.getFullYear());
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [citaActual, setCitaActual] = useState({ ...CITA_VACIA });
  const [modoEdicion, setModoEdicion] = useState(false);
  const [citaIdEditando, setCitaIdEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState('todos'); // 'todos' | 'mis' | id del miembro

  // Rango de fechas para tarjetas de resumen (default: mes actual)
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
  const ultimoDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate()).padStart(2,'0')}`;
  const [statsDesde, setStatsDesde] = useState(primerDiaMes);
  const [statsHasta, setStatsHasta] = useState(ultimoDiaMes);

  // Modal de listado: muestra las citas de un tipo en un día determinado
  const [modalListado, setModalListado] = useState(null); // { fecha, tipo, citas[] }

  // Modal de detalle de tarjeta de estadísticas
  const [modalStatsDetalle, setModalStatsDetalle] = useState(null); // { titulo, color, icon, citas[] }

  // Modales de acciones: reagendar y confirmar atendida
  const [modalReagendar, setModalReagendar] = useState(null); // cita completa
  const [reagendarData, setReagendarData] = useState({ fecha: '', hora_inicio: '09:00', hora_fin: '10:00', comentario: '' });
  const [modalAtendida, setModalAtendida] = useState(null); // cita completa
  const [atendidaComentario, setAtendidaComentario] = useState('');

  // ── Data fetching ──
  const cargarCitas = useCallback(async () => {
    setCargando(true);
    try {
      const res = await obtenerCitas();
      setCitas(res.data || []);
    } catch {
      setCitas([]);
    } finally { setCargando(false); }
  }, []);

  const cargarClientes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/clientes?t=${Date.now()}`);
      if (res.ok) { const data = await res.json(); setClientes(Array.isArray(data) ? data : []); }
    } catch { /* silencioso */ }
  }, []);

  const cargarEquipo = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/equipoDeTrabajo?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const miembros = (Array.isArray(data) ? data : []).filter(m => m.activo !== false).map(m => ({
          id: m.id,
          nombre: [m.nombre, m.apellido_paterno || m.apellidoPaterno].filter(Boolean).join(' '),
          perfil: m.perfil || m.rol || ''
        }));
        setEquipo(miembros);
      }
    } catch { /* silencioso */ }
  }, []);

  // Obtener nombre del usuario actual
  const usuarioActualNombre = useMemo(() => {
    try {
      const raw = localStorage.getItem('usuarioActual');
      if (raw) { const p = JSON.parse(raw); return p.nombre || p.username || 'Sistema'; }
      return localStorage.getItem('usuario_nombre') || 'Sistema';
    } catch { return 'Sistema'; }
  }, []);

  useEffect(() => { cargarCitas(); cargarClientes(); cargarEquipo(); }, [cargarCitas, cargarClientes, cargarEquipo]);

  // ── Filtrar citas por usuario seleccionado ──
  const citasFiltradas = useMemo(() => {
    if (filtroUsuario === 'todos') return citas;
    if (filtroUsuario === 'mis') {
      return citas.filter(c => !c.asignado_a || c.asignado_a === usuarioActualNombre);
    }
    // Filtrar por id de miembro
    const miembro = equipo.find(m => String(m.id) === String(filtroUsuario));
    if (miembro) {
      return citas.filter(c => c.asignado_a === miembro.nombre || String(c.asignado_a_id) === String(miembro.id));
    }
    return citas;
  }, [citas, filtroUsuario, equipo, usuarioActualNombre]);

  // ── Estadísticas por rango de fecha ──
  const statsResumen = useMemo(() => {
    const enRango = citasFiltradas.filter(c => c.fecha && c.fecha >= statsDesde && c.fecha <= statsHasta);
    const total = enRango.length;
    // Pendientes = pendiente + reagendada (ambas requieren atención), futuras/hoy
    const porAtender = enRango.filter(c => c.estatus !== 'atendida' && c.fecha >= hoyStr);
    const pendientes = porAtender.length;
    const atendidas = enRango.filter(c => c.estatus === 'atendida').length;
    const reagendadas = enRango.filter(c => c.estatus === 'reagendada').length;
    const porTipo = {
      presencial: enRango.filter(c => (c.tipo || 'presencial') === 'presencial').length,
      web: enRango.filter(c => c.tipo === 'web').length,
      llamada: enRango.filter(c => c.tipo === 'llamada').length
    };
    // Vencidas = pendiente o reagendada cuya fecha ya pasó y no fueron atendidas
    const vencidas = enRango.filter(c => c.estatus !== 'atendida' && c.fecha < hoyStr).length;
    const tasaAtencion = total > 0 ? Math.round((atendidas / total) * 100) : 0;
    // Helper: contar por tipo en una lista
    const contarPorTipo = (lista) => ({
      presencial: lista.filter(c => (c.tipo || 'presencial') === 'presencial').length,
      web: lista.filter(c => c.tipo === 'web').length,
      llamada: lista.filter(c => c.tipo === 'llamada').length
    });
    const listas = {
      total: enRango,
      pendientes: porAtender,
      atendidas: enRango.filter(c => c.estatus === 'atendida'),
      reagendadas: enRango.filter(c => c.estatus === 'reagendada'),
      vencidas: enRango.filter(c => c.estatus !== 'atendida' && c.fecha < hoyStr)
    };
    const tipoPor = {
      total: contarPorTipo(listas.total),
      pendientes: contarPorTipo(listas.pendientes),
      atendidas: contarPorTipo(listas.atendidas),
      reagendadas: contarPorTipo(listas.reagendadas),
      vencidas: contarPorTipo(listas.vencidas)
    };
    return { total, pendientes, atendidas, reagendadas, vencidas, porTipo, tasaAtencion, listas, tipoPor };
  }, [citasFiltradas, statsDesde, statsHasta, hoyStr]);

  // Label del filtro actual
  const labelFiltro = useMemo(() => {
    if (filtroUsuario === 'todos') return 'Todas';
    if (filtroUsuario === 'mis') return 'Mis Citas';
    const m = equipo.find(m => String(m.id) === String(filtroUsuario));
    return m?.nombre || 'Todas';
  }, [filtroUsuario, equipo]);

  // ── Detectar traslape de horarios ──
  const detectarTraslape = (fecha, horaInicio, horaFin, idExcluir = null) => {
    return citas.filter(c => {
      if (c.id === idExcluir) return false;
      if (c.fecha !== fecha) return false;
      if (c.estatus === 'atendida') return false; // no contar atendidas
      const inicioA = c.hora_inicio || '00:00';
      const finA = c.hora_fin || '23:59';
      // Hay traslape si: inicioA < horaFin && finA > horaInicio
      return inicioA < horaFin && finA > horaInicio;
    });
  };

  // ── CRUD citas ──
  const guardarCita = async () => {
    if (!citaActual.titulo.trim() || !citaActual.fecha) return;

    // Validar traslape
    const conflictos = detectarTraslape(
      citaActual.fecha, citaActual.hora_inicio, citaActual.hora_fin,
      modoEdicion ? citaIdEditando : null
    );
    if (conflictos.length > 0) {
      const detalle = conflictos.map(c => {
        const tipo = TIPOS_CITA[c.tipo]?.label || 'Cita';
        return `• ${c.hora_inicio}-${c.hora_fin} — ${c.titulo} (${tipo})`;
      }).join('\n');
      const continuar = confirm(
        `⚠️ Hay ${conflictos.length} cita(s) en horario similar:\n\n${detalle}\n\n¿Deseas agendar de todas formas?`
      );
      if (!continuar) return;
    }

    setGuardando(true);
    const citaData = {
      ...citaActual,
      id: modoEdicion ? citaIdEditando : undefined,
      estatus: citaActual.estatus || 'pendiente',
      historial: citaActual.historial || [],
      fecha_creacion: modoEdicion ? citaActual.fecha_creacion : new Date().toISOString(),
      fecha_modificacion: new Date().toISOString()
    };
    if (modoEdicion) {
      await actualizarCita(citaIdEditando, citaData);
    } else {
      await crearCita(citaData);
    }
    await cargarCitas();
    setGuardando(false);
    cerrarModal();
  };

  const eliminarCitaHandler = async (citaId) => {
    if (!confirm('¿Eliminar esta cita?')) return;
    await eliminarCitaAPI(citaId);
    await cargarCitas();
    cerrarModal();
  };

  // ── Reagendar cita ──
  const abrirReagendar = (cita) => {
    setModalReagendar(cita);
    setReagendarData({ fecha: '', hora_inicio: cita.hora_inicio || '09:00', hora_fin: cita.hora_fin || '10:00', comentario: '' });
    setModalListado(null);
  };

  const ejecutarReagendar = async () => {
    if (!reagendarData.fecha || !reagendarData.comentario.trim()) return;
    const cita = modalReagendar;

    // Validar traslape en la nueva fecha
    const conflictos = detectarTraslape(
      reagendarData.fecha, reagendarData.hora_inicio, reagendarData.hora_fin, cita.id
    );
    if (conflictos.length > 0) {
      const detalle = conflictos.map(c => {
        const tipo = TIPOS_CITA[c.tipo]?.label || 'Cita';
        return `• ${c.hora_inicio}-${c.hora_fin} — ${c.titulo} (${tipo})`;
      }).join('\n');
      const continuar = confirm(
        `⚠️ Hay ${conflictos.length} cita(s) en horario similar en la nueva fecha:\n\n${detalle}\n\n¿Deseas reagendar de todas formas?`
      );
      if (!continuar) return;
    }
    const nuevoHistorial = [
      ...(cita.historial || []),
      {
        accion: 'reagendada',
        fecha_anterior: cita.fecha,
        hora_anterior: `${cita.hora_inicio} - ${cita.hora_fin}`,
        fecha_nueva: reagendarData.fecha,
        hora_nueva: `${reagendarData.hora_inicio} - ${reagendarData.hora_fin}`,
        comentario: reagendarData.comentario.trim(),
        fecha_accion: new Date().toISOString()
      }
    ];
    const citaActualizada = {
      ...cita,
      fecha: reagendarData.fecha,
      hora_inicio: reagendarData.hora_inicio,
      hora_fin: reagendarData.hora_fin,
      estatus: 'reagendada',
      historial: nuevoHistorial,
      fecha_modificacion: new Date().toISOString()
    };
    await guardarCitaDirecta(citaActualizada);
    setModalReagendar(null);
  };

  // ── Confirmar atendida ──
  const abrirConfirmarAtendida = (cita) => {
    setModalAtendida(cita);
    setAtendidaComentario('');
    setModalListado(null);
  };

  const ejecutarConfirmarAtendida = async () => {
    const cita = modalAtendida;
    const nuevoHistorial = [
      ...(cita.historial || []),
      {
        accion: 'atendida',
        comentario: atendidaComentario.trim() || 'Cita confirmada como atendida',
        fecha_accion: new Date().toISOString()
      }
    ];
    const citaActualizada = {
      ...cita,
      estatus: 'atendida',
      historial: nuevoHistorial,
      fecha_modificacion: new Date().toISOString()
    };
    await guardarCitaDirecta(citaActualizada);
    setModalAtendida(null);
  };

  // Helper: guardar cita directamente (para reagendar/atendida)
  const guardarCitaDirecta = async (citaData) => {
    await actualizarCita(citaData.id, citaData);
    await cargarCitas();
  };

  // ── Modales ──
  const getNombreAsignado = () => {
    if (filtroUsuario === 'todos' || filtroUsuario === 'mis') return usuarioActualNombre;
    const m = equipo.find(m => String(m.id) === String(filtroUsuario));
    return m?.nombre || usuarioActualNombre;
  };
  const getIdAsignado = () => {
    if (filtroUsuario === 'todos' || filtroUsuario === 'mis') return null;
    const m = equipo.find(m => String(m.id) === String(filtroUsuario));
    return m?.id || null;
  };

  const abrirNuevaCita = (fecha = null, tipo = 'presencial') => {
    setCitaActual({ ...CITA_VACIA, fecha: fecha || hoyStr, tipo, asignado_a: getNombreAsignado(), asignado_a_id: getIdAsignado() });
    setModoEdicion(false);
    setCitaIdEditando(null);
    setModalAbierto(true);
    setModalListado(null);
  };

  const abrirEditarCita = (cita) => {
    setCitaActual({
      titulo: cita.titulo || '', tipo: cita.tipo || 'presencial',
      fecha: cita.fecha || '', hora_inicio: cita.hora_inicio || '09:00',
      hora_fin: cita.hora_fin || '10:00', cliente: cita.cliente || '',
      notas: cita.notas || '', ubicacion: cita.ubicacion || '',
      fecha_creacion: cita.fecha_creacion,
      estatus: cita.estatus || 'pendiente',
      historial: cita.historial || [],
      asignado_a: cita.asignado_a || '', asignado_a_id: cita.asignado_a_id || null
    });
    setModoEdicion(true);
    setCitaIdEditando(cita.id);
    setModalAbierto(true);
    setModalListado(null);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setCitaActual({ ...CITA_VACIA });
    setModoEdicion(false);
    setCitaIdEditando(null);
  };

  // ── Índice de citas por fecha → { presencial: n, web: n, llamada: n, items: [] } ──
  // Excluye atendidas del conteo y badges del calendario (se ven solo en tarjetas de resumen)
  const citasPorFecha = useMemo(() => {
    const mapa = {};
    citasFiltradas.forEach(c => {
      if (!c.fecha) return;
      if (c.estatus === 'atendida') return; // no mostrar atendidas en el grid
      if (!mapa[c.fecha]) mapa[c.fecha] = { presencial: 0, web: 0, llamada: 0, items: [] };
      const tipo = c.tipo || 'presencial';
      if (mapa[c.fecha][tipo] !== undefined) mapa[c.fecha][tipo]++;
      mapa[c.fecha].items.push(c);
    });
    return mapa;
  }, [citasFiltradas]);

  // ── Navegación de mes ──
  const mesAnterior = () => {
    if (mesActual === 0) { setMesActual(11); setAnioActual(a => a - 1); }
    else setMesActual(m => m - 1);
  };
  const mesSiguiente = () => {
    if (mesActual === 11) { setMesActual(0); setAnioActual(a => a + 1); }
    else setMesActual(m => m + 1);
  };
  const irAHoy = () => { setMesActual(hoy.getMonth()); setAnioActual(hoy.getFullYear()); };

  // Días del mes para la grilla
  const diasGrid = useMemo(() => getDiasDelMes(anioActual, mesActual), [anioActual, mesActual]);

  // Contadores globales
  const citasHoy = citasPorFecha[hoyStr]?.items || [];
  const totalSemana = useMemo(() => {
    const inicio = new Date(hoy); inicio.setDate(hoy.getDate() - hoy.getDay() + 1);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      count += (citasPorFecha[key]?.items?.length || 0);
    }
    return count;
  }, [citasPorFecha, hoy]);

  // Handler: click en un icono-count dentro de la celda del día
  const abrirListadoPorTipo = (fecha, tipo) => {
    const data = citasPorFecha[fecha];
    if (!data) return;
    const citasFiltradas = data.items.filter(c => (c.tipo || 'presencial') === tipo);
    if (citasFiltradas.length === 0) return;
    setModalListado({ fecha, tipo, citas: citasFiltradas });
  };

  return (
    <>
      {/* Título, filtro de usuario y botón */}
      <div className="mb-3 mt-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 className="fw-bold mb-0" style={{ color: '#111827' }}>
            <Calendar size={18} className="me-2" style={{ color: '#3B82F6' }} />
            Agenda de Citas
            {filtroUsuario !== 'todos' && filtroUsuario !== 'mis' && (
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}> — {labelFiltro}</span>
            )}
          </h5>
          <small className="text-muted" style={{ fontSize: '12px' }}>
            {citasHoy.length > 0
              ? `${citasHoy.length} cita(s) hoy • ${totalSemana} esta semana`
              : totalSemana > 0 ? `${totalSemana} cita(s) esta semana` : 'Sin citas programadas'}
          </small>
        </div>
        <div className="d-flex align-items-center gap-2">
          <div className="d-flex align-items-center gap-1" style={{ position: 'relative' }}>
            <Users size={14} style={{ color: '#6B7280' }} />
            <select
              className="form-select form-select-sm"
              value={filtroUsuario}
              onChange={e => setFiltroUsuario(e.target.value)}
              style={{ borderRadius: '8px', fontSize: '12px', minWidth: '140px', border: '1px solid #E5E7EB', color: '#374151', paddingRight: '28px' }}
            >
              <option value="todos">Todas las citas</option>
              <option value="mis">Mis Citas</option>
              {equipo.length > 0 && <option disabled>───────────</option>}
              {equipo.map(m => (
                <option key={m.id} value={m.id}>{m.nombre}{m.perfil ? ` (${m.perfil})` : ''}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => abrirNuevaCita()}>
            <Plus size={14} className="me-1" /> Nueva Cita
          </button>
        </div>
      </div>

      {/* ── TARJETAS DE RESUMEN ── */}
      <div className="mb-3">
        {/* Selector de rango */}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <CalendarRange size={14} style={{ color: '#6B7280' }} />
          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>Período:</span>
          <input type="date" className="form-control form-control-sm" value={statsDesde}
            onChange={e => setStatsDesde(e.target.value)}
            style={{ width: '140px', fontSize: '12px', borderRadius: '6px', border: '1px solid #E5E7EB' }} />
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>a</span>
          <input type="date" className="form-control form-control-sm" value={statsHasta}
            onChange={e => setStatsHasta(e.target.value)}
            style={{ width: '140px', fontSize: '12px', borderRadius: '6px', border: '1px solid #E5E7EB' }} />
          <button className="btn btn-sm" onClick={() => { setStatsDesde(primerDiaMes); setStatsHasta(ultimoDiaMes); }}
            style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', borderRadius: '6px' }}>
            Mes actual
          </button>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
          {[
            { key: 'total', label: 'Total', value: statsResumen.total, Icon: Calendar, color: '#3B82F6', darkColor: '#1E40AF', bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '#BFDBFE' },
            { key: 'pendientes', label: 'Por Atender', value: statsResumen.pendientes, Icon: Clock, color: '#D97706', darkColor: '#92400E', bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '#FDE68A' },
            { key: 'atendidas', label: 'Atendidas', value: statsResumen.atendidas, Icon: CheckCircle, color: '#059669', darkColor: '#065F46', bg: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: '#A7F3D0' },
            { key: 'reagendadas', label: 'Reagendadas', value: statsResumen.reagendadas, Icon: RefreshCw, color: '#4F46E5', darkColor: '#3730A3', bg: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', border: '#C7D2FE' },
            { key: 'vencidas', label: 'Vencidas', value: statsResumen.vencidas, Icon: AlertTriangle, color: '#DC2626', darkColor: '#991B1B', bg: 'linear-gradient(135deg, #FEF2F2 0%, #FECACA 100%)', border: '#FCA5A5' },
          ].map(card => (
            <div key={card.key}
              onClick={() => setModalStatsDetalle({ titulo: `Citas ${card.label}`, color: card.color, icon: card.Icon, citas: statsResumen.listas[card.key] })}
              style={{ background: card.bg, borderRadius: '10px', padding: '12px 14px', border: `1px solid ${card.border}`, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}30`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div style={{ fontSize: '11px', color: card.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: card.darkColor, lineHeight: 1.1, marginTop: '2px' }}>{card.value}</div>
                </div>
                <card.Icon size={20} style={{ color: card.color, opacity: 0.6 }} />
              </div>
              {/* Desglose por tipo */}
              {card.value > 0 && (
                <div className="d-flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                  {Object.entries(TIPOS_CITA).map(([tipo, config]) => {
                    const count = statsResumen.tipoPor[card.key]?.[tipo] || 0;
                    if (count === 0) return null;
                    const Ic = config.icon;
                    return (
                      <span key={tipo} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', color: config.color, opacity: 0.85 }}>
                        <Ic size={10} />{count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Tasa de atención (no clickeable) */}
          <div style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', borderRadius: '10px', padding: '12px 14px', border: '1px solid #BBF7D0' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>% Atención</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803D', lineHeight: 1.1, marginTop: '2px' }}>{statsResumen.tasaAtencion}%</div>
              </div>
              <TrendingUp size={20} style={{ color: '#22C55E', opacity: 0.6 }} />
            </div>
          </div>
        </div>

      </div>

      {/* ── CALENDARIO GRID ── */}
      <div className="executive-card mb-4" style={{ overflow: 'hidden' }}>
        {/* Header de navegación */}
        <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm" style={{ border: '1px solid #E5E7EB', background: 'white', lineHeight: 1, padding: '4px 8px' }} onClick={mesAnterior}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-sm" style={{ border: '1px solid #E5E7EB', background: 'white', lineHeight: 1, padding: '4px 8px' }} onClick={mesSiguiente}>
              <ChevronRight size={16} />
            </button>
            <button className="btn btn-sm" style={{ border: '1px solid #E5E7EB', background: 'white', fontSize: '12px', padding: '4px 10px' }} onClick={irAHoy}>
              Hoy
            </button>
          </div>
          <h6 className="mb-0 fw-bold" style={{ color: '#111827', fontSize: '15px', textTransform: 'capitalize' }}>
            {MESES[mesActual]} {anioActual}
          </h6>
          {/* Leyenda */}
          <div className="d-flex gap-3 d-none d-md-flex">
            {Object.entries(TIPOS_CITA).map(([key, t]) => {
              const Ic = t.icon;
              return (
                <span key={key} className="d-flex align-items-center gap-1" style={{ fontSize: '11px', color: '#6B7280' }}>
                  <Ic size={12} style={{ color: t.color }} /> {t.label.split(' ')[1] || t.label.split('/')[0]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Encabezados de día */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E5E7EB' }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '6px 0', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#F9FAFB' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {diasGrid.map((diaObj, i) => {
            const esHoy = diaObj.fecha === hoyStr;
            const data = citasPorFecha[diaObj.fecha];
            const tieneAlgo = data && (data.presencial > 0 || data.web > 0 || data.llamada > 0);

            return (
              <div
                key={i}
                style={{
                  minHeight: '70px',
                  padding: '4px 6px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid #F3F4F6' : 'none',
                  borderBottom: '1px solid #F3F4F6',
                  background: esHoy ? '#EFF6FF' : !diaObj.mesActual ? '#FAFAFA' : 'white',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onClick={() => abrirNuevaCita(diaObj.fecha)}
                onMouseEnter={e => { if (!esHoy) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { if (!esHoy) e.currentTarget.style.background = !diaObj.mesActual ? '#FAFAFA' : 'white'; }}
              >
                {/* Número del día */}
                <div style={{
                  fontSize: '12px',
                  fontWeight: esHoy ? 700 : 500,
                  color: !diaObj.mesActual ? '#D1D5DB' : esHoy ? '#2563EB' : '#374151',
                  marginBottom: '4px'
                }}>
                  {esHoy ? (
                    <span style={{
                      background: '#2563EB', color: 'white', borderRadius: '50%',
                      width: '22px', height: '22px', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '11px'
                    }}>
                      {diaObj.dia}
                    </span>
                  ) : diaObj.dia}
                </div>

                {/* Iconos con conteo */}
                {tieneAlgo && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                    {Object.entries(TIPOS_CITA).map(([tipo, config]) => {
                      const count = data[tipo] || 0;
                      if (count === 0) return null;
                      const Icono = config.icon;
                      return (
                        <div
                          key={tipo}
                          title={`${count} ${config.label}`}
                          onClick={(e) => { e.stopPropagation(); abrirListadoPorTipo(diaObj.fecha, tipo); }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            background: config.bgLight, color: config.color,
                            borderRadius: '4px', padding: '1px 5px',
                            fontSize: '11px', fontWeight: 600,
                            cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                            border: `1px solid ${config.color}25`
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 2px 6px ${config.color}30`; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <Icono size={11} />
                          <span>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL LISTADO DE CITAS POR TIPO ── */}
      {modalListado && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} onClick={() => setModalListado(null)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="modal-header py-2" style={{ background: TIPOS_CITA[modalListado.tipo]?.color, color: 'white', borderRadius: '12px 12px 0 0' }}>
                <div>
                  <h6 className="mb-0 fw-bold">{TIPOS_CITA[modalListado.tipo]?.label}</h6>
                  <small style={{ opacity: 0.9 }}>
                    {new Date(modalListado.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' • '}{modalListado.citas.length} cita(s)
                  </small>
                </div>
                <button className="btn btn-sm" style={{ color: 'white' }} onClick={() => setModalListado(null)}><X size={18} /></button>
              </div>
              <div className="modal-body p-0" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {modalListado.citas
                  .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
                  .map((cita, idx) => {
                    const tipoCita = TIPOS_CITA[cita.tipo] || TIPOS_CITA.presencial;
                    const estatus = ESTATUS_CITA[cita.estatus] || ESTATUS_CITA.pendiente;
                    const EstatusIcon = estatus.icon;
                    const esAtendida = cita.estatus === 'atendida';
                    return (
                      <div key={cita.id || idx} style={{ borderBottom: idx < modalListado.citas.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        {/* Info de la cita */}
                        <div className="d-flex align-items-start gap-3 px-3 pt-3 pb-2"
                          style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => abrirEditarCita(cita)}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: esAtendida ? '#D1D5DB' : tipoCita.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            opacity: esAtendida ? 0.6 : 1
                          }}>
                            {React.createElement(tipoCita.icon, { size: 18, style: { color: 'white' } })}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="d-flex align-items-center gap-2">
                              <span style={{
                                fontSize: '13px', fontWeight: 600,
                                color: esAtendida ? '#9CA3AF' : '#111827',
                                textDecoration: esAtendida ? 'line-through' : 'none',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {cita.titulo}
                              </span>
                              <span style={{
                                fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                borderRadius: '10px', background: estatus.bg, color: estatus.color,
                                whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px'
                              }}>
                                <EstatusIcon size={10} /> {estatus.label}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#6B7280' }}>
                              {cita.hora_inicio} - {cita.hora_fin}
                              {cita.cliente && ` • ${cita.cliente}`}
                            </div>
                            {cita.ubicacion && (
                              <div style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cita.ubicacion}
                              </div>
                            )}
                            {/* Último comentario del historial */}
                            {cita.historial?.length > 0 && (
                              <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px', fontStyle: 'italic' }}>
                                <MessageSquare size={9} className="me-1" />
                                {cita.historial[cita.historial.length - 1].comentario}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Botones de acción (solo si no está atendida) */}
                        {!esAtendida && (
                          <div className="d-flex gap-2 px-3 pb-3" style={{ paddingLeft: '60px' }}>
                            <button className="btn btn-sm d-flex align-items-center gap-1"
                              style={{ fontSize: '11px', padding: '3px 10px', border: '1px solid #6366F120', background: '#EEF2FF', color: '#6366F1', borderRadius: '6px', fontWeight: 600 }}
                              onClick={(e) => { e.stopPropagation(); abrirReagendar(cita); }}
                            >
                              <RefreshCw size={12} /> Reagendar
                            </button>
                            <button className="btn btn-sm d-flex align-items-center gap-1"
                              style={{ fontSize: '11px', padding: '3px 10px', border: '1px solid #10B98120', background: '#ECFDF5', color: '#10B981', borderRadius: '6px', fontWeight: 600 }}
                              onClick={(e) => { e.stopPropagation(); abrirConfirmarAtendida(cita); }}
                            >
                              <CheckCircle size={12} /> Atendida
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="modal-footer py-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setModalListado(null)}>Cerrar</button>
                <button className="btn btn-sm btn-primary" onClick={() => abrirNuevaCita(modalListado.fecha, modalListado.tipo)}>
                  <Plus size={14} className="me-1" /> Agregar {TIPOS_CITA[modalListado.tipo]?.label.split(' ')[1] || 'Cita'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE DE TARJETA STATS ── */}
      {modalStatsDetalle && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }} onClick={() => setModalStatsDetalle(null)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="modal-header py-2" style={{ background: modalStatsDetalle.color, color: 'white', borderRadius: '12px 12px 0 0' }}>
                <div>
                  <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    {React.createElement(modalStatsDetalle.icon, { size: 16 })}
                    {modalStatsDetalle.titulo}
                  </h6>
                  <small style={{ opacity: 0.9 }}>
                    {modalStatsDetalle.citas.length} cita(s) &bull; {statsDesde.split('-').reverse().join('/')} al {statsHasta.split('-').reverse().join('/')}
                  </small>
                </div>
                <button className="btn btn-sm" style={{ color: 'white' }} onClick={() => setModalStatsDetalle(null)}><X size={18} /></button>
              </div>
              <div className="modal-body p-0" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {modalStatsDetalle.citas.length === 0 ? (
                  <div className="text-center py-5" style={{ color: '#9CA3AF' }}>
                    <Calendar size={32} style={{ opacity: 0.3 }} />
                    <p className="mt-2 mb-0" style={{ fontSize: '13px' }}>No hay citas en esta categoría</p>
                  </div>
                ) : (
                  modalStatsDetalle.citas
                    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''))
                    .map((cita, idx) => {
                      const tipoCita = TIPOS_CITA[cita.tipo] || TIPOS_CITA.presencial;
                      const estatus = ESTATUS_CITA[cita.estatus] || ESTATUS_CITA.pendiente;
                      const EstatusIcon = estatus.icon;
                      const esVencida = (cita.estatus || 'pendiente') === 'pendiente' && cita.fecha < hoyStr;
                      const fechaDisplay = cita.fecha ? new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
                      return (
                        <div key={cita.id || idx}
                          style={{ borderBottom: idx < modalStatsDetalle.citas.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                          onClick={() => { setModalStatsDetalle(null); abrirEditarCita(cita); }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <div className="d-flex align-items-start gap-3 px-3 py-2">
                            <div style={{
                              width: '34px', height: '34px', borderRadius: '8px',
                              background: esVencida ? '#DC2626' : tipoCita.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              opacity: cita.estatus === 'atendida' ? 0.5 : 1
                            }}>
                              {React.createElement(tipoCita.icon, { size: 16, style: { color: 'white' } })}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div className="d-flex align-items-center gap-2">
                                <span style={{
                                  fontSize: '13px', fontWeight: 600,
                                  color: cita.estatus === 'atendida' ? '#9CA3AF' : '#111827',
                                  textDecoration: cita.estatus === 'atendida' ? 'line-through' : 'none',
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                  {cita.titulo}
                                </span>
                                <span style={{
                                  fontSize: '10px', fontWeight: 600, padding: '1px 6px',
                                  borderRadius: '10px',
                                  background: esVencida ? '#FEF2F2' : estatus.bg,
                                  color: esVencida ? '#DC2626' : estatus.color,
                                  whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px'
                                }}>
                                  {esVencida ? <><AlertTriangle size={10} /> Vencida</> : <><EstatusIcon size={10} /> {estatus.label}</>}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                <span style={{ fontWeight: 600, color: esVencida ? '#DC2626' : '#374151' }}>{fechaDisplay}</span>
                                {' \u2022 '}{cita.hora_inicio} - {cita.hora_fin}
                                {cita.cliente && ` \u2022 ${cita.cliente}`}
                              </div>
                              {cita.asignado_a && (
                                <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>
                                  <Users size={9} className="me-1" />{cita.asignado_a}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
              <div className="modal-footer py-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setModalStatsDetalle(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL REAGENDAR ── */}
      {modalReagendar && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1065 }} onClick={() => setModalReagendar(null)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="modal-header py-3" style={{ background: '#6366F1', borderRadius: '12px 12px 0 0', color: 'white' }}>
                <div>
                  <h6 className="mb-0 fw-bold"><RefreshCw size={16} className="me-2" />Reagendar Cita</h6>
                  <small style={{ opacity: 0.9 }}>{modalReagendar.titulo}</small>
                </div>
                <button className="btn btn-sm" style={{ color: 'white' }} onClick={() => setModalReagendar(null)}><X size={18} /></button>
              </div>
              <div className="modal-body p-4">
                {/* Datos originales */}
                <div className="p-2 rounded mb-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <div className="fw-semibold text-muted mb-1" style={{ fontSize: '11px', textTransform: 'uppercase' }}>Fecha original</div>
                  <div style={{ color: '#374151' }}>
                    {new Date(modalReagendar.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' • '}{modalReagendar.hora_inicio} - {modalReagendar.hora_fin}
                  </div>
                </div>

                {/* Nueva fecha */}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Nueva Fecha *</label>
                    <input type="date" className="form-control" value={reagendarData.fecha}
                      onChange={e => setReagendarData(prev => ({ ...prev, fecha: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                  <div className="col-6 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Hora Inicio</label>
                    <input type="time" className="form-control" value={reagendarData.hora_inicio}
                      onChange={e => setReagendarData(prev => ({ ...prev, hora_inicio: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                  <div className="col-6 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Hora Fin</label>
                    <input type="time" className="form-control" value={reagendarData.hora_fin}
                      onChange={e => setReagendarData(prev => ({ ...prev, hora_fin: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                </div>

                {/* Comentario */}
                <div className="mb-2">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Motivo / Comentario *</label>
                  <textarea className="form-control" rows={2} placeholder="Ej: Cliente pidió cambio por conflicto de horario..."
                    value={reagendarData.comentario} onChange={e => setReagendarData(prev => ({ ...prev, comentario: e.target.value }))}
                    style={{ borderRadius: '8px', fontSize: '13px', resize: 'none' }} autoFocus />
                </div>
              </div>
              <div className="modal-footer py-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setModalReagendar(null)}>Cancelar</button>
                <button className="btn btn-sm" onClick={ejecutarReagendar}
                  disabled={!reagendarData.fecha || !reagendarData.comentario.trim()}
                  style={{ background: '#6366F1', color: 'white', borderRadius: '6px' }}>
                  <RefreshCw size={14} className="me-1" /> Confirmar Reagenda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ATENDIDA ── */}
      {modalAtendida && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1065 }} onClick={() => setModalAtendida(null)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div className="modal-header py-3" style={{ background: '#10B981', borderRadius: '12px 12px 0 0', color: 'white' }}>
                <div>
                  <h6 className="mb-0 fw-bold"><CheckCircle size={16} className="me-2" />Confirmar Atendida</h6>
                  <small style={{ opacity: 0.9 }}>{modalAtendida.titulo}</small>
                </div>
                <button className="btn btn-sm" style={{ color: 'white' }} onClick={() => setModalAtendida(null)}><X size={18} /></button>
              </div>
              <div className="modal-body p-4">
                <div className="p-2 rounded mb-3" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <div style={{ color: '#374151' }}>
                    {new Date(modalAtendida.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' • '}{modalAtendida.hora_inicio} - {modalAtendida.hora_fin}
                    {modalAtendida.cliente && <span className="fw-semibold"> • {modalAtendida.cliente}</span>}
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Comentario de cierre (opcional)</label>
                  <textarea className="form-control" rows={2} placeholder="Ej: Se revisó póliza, cliente quedó satisfecho..."
                    value={atendidaComentario} onChange={e => setAtendidaComentario(e.target.value)}
                    style={{ borderRadius: '8px', fontSize: '13px', resize: 'none' }} autoFocus />
                </div>
              </div>
              <div className="modal-footer py-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setModalAtendida(null)}>Cancelar</button>
                <button className="btn btn-sm" onClick={ejecutarConfirmarAtendida}
                  style={{ background: '#10B981', color: 'white', borderRadius: '6px' }}>
                  <CheckCircle size={14} className="me-1" /> Confirmar Atendida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL NUEVA / EDITAR CITA ── */}
      {modalAbierto && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} onClick={cerrarModal}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              {/* Header */}
              <div className="modal-header py-3" style={{ background: TIPOS_CITA[citaActual.tipo]?.color || '#3B82F6', borderRadius: '12px 12px 0 0', color: 'white' }}>
                <div>
                  <h5 className="modal-title mb-0 fw-bold">{modoEdicion ? 'Editar Cita' : 'Nueva Cita'}</h5>
                  <small style={{ opacity: 0.9 }}>{TIPOS_CITA[citaActual.tipo]?.label || 'Cita'}</small>
                </div>
                <button className="btn btn-sm" onClick={cerrarModal} style={{ color: 'white' }}><X size={20} /></button>
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                {/* Tipo de cita */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Tipo de Cita</label>
                  <div className="d-flex gap-2">
                    {Object.entries(TIPOS_CITA).map(([key, tipo]) => {
                      const Icono = tipo.icon;
                      const sel = citaActual.tipo === key;
                      return (
                        <button key={key} type="button" className="btn btn-sm flex-fill d-flex align-items-center justify-content-center gap-1"
                          style={{ background: sel ? tipo.color : 'white', color: sel ? 'white' : tipo.color, border: `2px solid ${tipo.color}`, borderRadius: '8px', fontSize: '11px', fontWeight: 600, padding: '8px 6px', transition: 'all 0.2s' }}
                          onClick={() => setCitaActual(prev => ({ ...prev, tipo: key }))}
                        >
                          <Icono size={14} />
                          <span className="d-none d-sm-inline">{key === 'web' ? 'Web' : key === 'llamada' ? 'Llamada' : 'Presencial'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Título */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Título / Asunto *</label>
                  <input type="text" className="form-control" placeholder="Ej: Revisión de póliza, Cotización auto..."
                    value={citaActual.titulo} onChange={e => setCitaActual(prev => ({ ...prev, titulo: e.target.value }))}
                    style={{ borderRadius: '8px', fontSize: '13px' }} autoFocus />
                </div>

                {/* Fecha y horas */}
                <div className="row g-2 mb-3">
                  <div className="col-12 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Fecha *</label>
                    <input type="date" className="form-control" value={citaActual.fecha}
                      onChange={e => setCitaActual(prev => ({ ...prev, fecha: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                  <div className="col-6 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Hora Inicio</label>
                    <input type="time" className="form-control" value={citaActual.hora_inicio}
                      onChange={e => setCitaActual(prev => ({ ...prev, hora_inicio: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                  <div className="col-6 col-sm-4">
                    <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Hora Fin</label>
                    <input type="time" className="form-control" value={citaActual.hora_fin}
                      onChange={e => setCitaActual(prev => ({ ...prev, hora_fin: e.target.value }))}
                      style={{ borderRadius: '8px', fontSize: '13px' }} />
                  </div>
                </div>

                {/* Cliente */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Cliente (opcional)</label>
                  <input type="text" className="form-control" list="lista-clientes-citas" placeholder="Nombre del cliente..."
                    value={citaActual.cliente} onChange={e => setCitaActual(prev => ({ ...prev, cliente: e.target.value }))}
                    style={{ borderRadius: '8px', fontSize: '13px' }} />
                  <datalist id="lista-clientes-citas">
                    {clientes.map((c, i) => <option key={i} value={c.nombre || `${c.nombre_completo || ''}`} />)}
                  </datalist>
                </div>

                {/* Asignado a */}
                <div className="mb-3">
                  <label className="form-label fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '12px', color: '#374151' }}>
                    <Users size={12} /> Asignado a
                  </label>
                  <select className="form-select" value={citaActual.asignado_a_id || ''}
                    onChange={e => {
                      const selId = e.target.value;
                      if (!selId) { setCitaActual(prev => ({ ...prev, asignado_a: usuarioActualNombre, asignado_a_id: null })); return; }
                      const m = equipo.find(m => String(m.id) === selId);
                      if (m) setCitaActual(prev => ({ ...prev, asignado_a: m.nombre, asignado_a_id: m.id }));
                    }}
                    style={{ borderRadius: '8px', fontSize: '13px' }}>
                    <option value="">Yo ({usuarioActualNombre})</option>
                    {equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.perfil ? ` (${m.perfil})` : ''}</option>)}
                  </select>
                </div>

                {/* Ubicación / Link */}
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>
                    {citaActual.tipo === 'presencial' ? 'Ubicación' : citaActual.tipo === 'web' ? 'Link de reunión' : 'Teléfono'} (opcional)
                  </label>
                  <input type="text" className="form-control"
                    placeholder={citaActual.tipo === 'presencial' ? 'Dirección o lugar...' : citaActual.tipo === 'web' ? 'https://meet.google.com/...' : 'Número de teléfono...'}
                    value={citaActual.ubicacion} onChange={e => setCitaActual(prev => ({ ...prev, ubicacion: e.target.value }))}
                    style={{ borderRadius: '8px', fontSize: '13px' }} />
                </div>

                {/* Notas */}
                <div className="mb-2">
                  <label className="form-label fw-semibold" style={{ fontSize: '12px', color: '#374151' }}>Notas (opcional)</label>
                  <textarea className="form-control" rows={2} placeholder="Notas adicionales..."
                    value={citaActual.notas} onChange={e => setCitaActual(prev => ({ ...prev, notas: e.target.value }))}
                    style={{ borderRadius: '8px', fontSize: '13px', resize: 'none' }} />
                </div>

                {/* Estatus actual (solo en edición) */}
                {modoEdicion && (
                  <div className="mt-3 p-2 rounded" style={{ background: (ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).bg, border: `1px solid ${(ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).color}20` }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      {React.createElement((ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).icon, { size: 14, style: { color: (ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).color } })}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: (ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).color }}>
                        Estatus: {(ESTATUS_CITA[citaActual.estatus] || ESTATUS_CITA.pendiente).label}
                      </span>
                    </div>
                  </div>
                )}

                {/* Historial (solo en edición y si hay historial) */}
                {modoEdicion && citaActual.historial?.length > 0 && (
                  <div className="mt-3">
                    <label className="form-label fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '12px', color: '#374151' }}>
                      <History size={13} /> Historial
                    </label>
                    <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                      {citaActual.historial.map((h, i) => (
                        <div key={i} className="d-flex gap-2 mb-2" style={{ fontSize: '11px' }}>
                          <div style={{
                            width: '6px', height: '6px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                            background: h.accion === 'atendida' ? '#10B981' : '#6366F1'
                          }} />
                          <div>
                            <div style={{ color: '#374151' }}>
                              <span className="fw-semibold" style={{ color: h.accion === 'atendida' ? '#10B981' : '#6366F1' }}>
                                {h.accion === 'atendida' ? 'Confirmada atendida' : 'Reagendada'}
                              </span>
                              {h.fecha_anterior && (
                                <span className="text-muted"> — de {h.fecha_anterior} a {h.fecha_nueva}</span>
                              )}
                            </div>
                            <div style={{ color: '#6B7280', fontStyle: 'italic' }}>"{h.comentario}"</div>
                            <div style={{ color: '#9CA3AF', fontSize: '10px' }}>
                              {new Date(h.fecha_accion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="modal-footer py-2" style={{ borderTop: '1px solid #E5E7EB' }}>
                {modoEdicion && (
                  <button className="btn btn-outline-danger btn-sm me-auto" onClick={() => eliminarCitaHandler(citaIdEditando)}>
                    <Trash2 size={14} className="me-1" /> Eliminar
                  </button>
                )}
                <button className="btn btn-outline-secondary btn-sm" onClick={cerrarModal}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={guardarCita}
                  disabled={!citaActual.titulo.trim() || !citaActual.fecha || guardando}>
                  {guardando
                    ? <><span className="spinner-border spinner-border-sm me-1" /> Guardando...</>
                    : <><Save size={14} className="me-1" /> {modoEdicion ? 'Actualizar' : 'Guardar Cita'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarioAgenda;

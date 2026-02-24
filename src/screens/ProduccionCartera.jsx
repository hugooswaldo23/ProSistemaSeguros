import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase, Calendar, TrendingUp, FileText, RefreshCw, XCircle,
  Filter, Users, User, Building2, Package, Award, ArrowUpRight,
  ArrowDownRight, Minus, ChevronLeft, ChevronRight, X, Eye,
  ArrowUp, ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';

const API_URL = import.meta.env.VITE_API_URL;
const PAGE_SIZE = 50;

// ─── Helper puro: normalizar texto para comparaciones ───
const norm = (t) => (t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ─── Clasificadores puros (sin estado) ───
const esRenovacion = (exp) => norm(exp.tipo_movimiento) === 'RENOVACION' || !!exp.renovacion_de || norm(exp.etapa_activa).includes('RENOVACION EMITIDA');
const esEndoso = (exp) => norm(exp.tipo_movimiento) === 'ENDOSO';
const esNueva = (exp) => !esRenovacion(exp) && !esEndoso(exp) && (norm(exp.tipo_movimiento) === 'NUEVA' || !exp.tipo_movimiento);
const esCancelada = (exp) => {
  const e = norm(exp.estatus || exp.etapa_activa);
  return e === 'CANCELADA' || e === 'CANCELADO';
};
const getPrima = (exp) => parseFloat(exp.total) || parseFloat(exp.prima_total) || 0;
const getFecha = (exp) => {
  const fe = exp.fecha_emision ? exp.fecha_emision.split('T')[0] : null;
  const fc = (exp.fecha_creacion || exp.created_at || '');
  return fe || (fc ? fc.split('T')[0] : null);
};
const formatMoney = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const formatFechaCorta = (f) => {
  if (!f) return '—';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Componente principal ───
const ProduccionCartera = () => {
  const [loading, setLoading] = useState(false);
  const [expedientes, setExpedientes] = useState([]);
  const { equipoDeTrabajo } = useEquipoDeTrabajo();

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1).toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroRapido, setFiltroRapido] = useState('mes-actual');
  const [filtroAgente, setFiltroAgente] = useState('todos');
  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [filtroRamo, setFiltroRamo] = useState('todos');
  const [filtroAseguradora, setFiltroAseguradora] = useState('todos');

  // Drill-down state
  const [drillDown, setDrillDown] = useState(null); // { tipo, dimension, valor, titulo }
  const [drillPage, setDrillPage] = useState(0);
  const [drillSort, setDrillSort] = useState({ campo: 'fecha', dir: 'desc' });

  // Agrupación de tabla resumen
  const [agrupacion, setAgrupacion] = useState('ramo');

  // ─── Filtros rápidos de fecha ───
  const aplicarFiltroRapido = useCallback((tipo) => {
    const h = new Date();
    let ini, fin;
    switch (tipo) {
      case 'hoy': ini = fin = h.toISOString().split('T')[0]; break;
      case 'semana': {
        const s = new Date(h); s.setDate(h.getDate() - h.getDay() + 1);
        ini = s.toISOString().split('T')[0]; fin = h.toISOString().split('T')[0]; break;
      }
      case 'mes-actual':
        ini = new Date(h.getFullYear(), h.getMonth(), 1).toISOString().split('T')[0];
        fin = h.toISOString().split('T')[0]; break;
      case 'mes-anterior':
        ini = new Date(h.getFullYear(), h.getMonth() - 1, 1).toISOString().split('T')[0];
        fin = new Date(h.getFullYear(), h.getMonth(), 0).toISOString().split('T')[0]; break;
      case 'trimestre': {
        const m = h.getMonth();
        ini = new Date(h.getFullYear(), m - (m % 3), 1).toISOString().split('T')[0];
        fin = h.toISOString().split('T')[0]; break;
      }
      case 'anio':
        ini = new Date(h.getFullYear(), 0, 1).toISOString().split('T')[0];
        fin = h.toISOString().split('T')[0]; break;
      default: return;
    }
    setFiltroRapido(tipo);
    setFechaInicio(ini);
    setFechaFin(fin);
    cerrarDrillDown();
  }, []);

  // ─── Cargar datos ───
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ss_token');
      const res = await fetch(`${API_URL}/api/expedientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error');
      const reales = await res.json();

      setExpedientes(Array.isArray(reales) ? reales : []);
    } catch {
      toast.error('Error al cargar datos de producción');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ─── Catálogo de equipo de trabajo por perfil ───
  const { catalogoAgentes, catalogoVendedores, equipoMap } = useMemo(() => {
    const m = {};
    const agentes = [];
    const vendedores = [];
    (equipoDeTrabajo || []).forEach(v => {
      const nombre = `${v.nombre || ''} ${v.apellidoPaterno || ''}`.trim();
      const nombreCompleto = `${v.nombre || ''} ${v.apellidoPaterno || ''} ${v.apellidoMaterno || ''}`.trim();
      m[v.id] = nombre;
      if (v.perfil === 'Agente' && v.activo) {
        agentes.push({ id: String(v.id), nombre, nombreCompleto, codigo: v.codigo || '' });
      }
      if (v.perfil === 'Vendedor' && v.activo) {
        vendedores.push({ id: String(v.id), nombre, nombreCompleto, codigo: v.codigo || '' });
      }
    });
    agentes.sort((a, b) => a.nombre.localeCompare(b.nombre));
    vendedores.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { catalogoAgentes: agentes, catalogoVendedores: vendedores, equipoMap: m };
  }, [equipoDeTrabajo]);

  // ─── Resolver agente de un expediente ───
  // El campo exp.agente viene como texto: "AG003 - RITA DINGLER CHAIRES" o solo nombre
  // Necesitamos matchear contra el catálogo por código o nombre
  const resolverAgenteId = useCallback((exp) => {
    // 1) Si ya tiene agente_id numérico, usarlo directamente
    if (exp.agente_id) return String(exp.agente_id);
    // 2) Matchear campo texto "agente" contra catálogo
    const txt = (exp.agente || '').trim();
    if (!txt) return 'sin-agente';
    const txtUpper = txt.toUpperCase();
    // Intentar extraer código: "AG003 - RITA DINGLER" → code="AG003", name="RITA DINGLER"
    const partes = txt.split(' - ');
    const code = partes.length > 1 ? partes[0].trim() : '';
    const name = partes.length > 1 ? partes.slice(1).join(' - ').trim().toUpperCase() : txtUpper;

    for (const ag of catalogoAgentes) {
      // Match por código exacto
      if (code && ag.codigo && ag.codigo.toUpperCase() === code.toUpperCase()) return ag.id;
      // Match por nombre
      const agNombre = ag.nombreCompleto.toUpperCase();
      if (agNombre === name || agNombre === txtUpper || name.includes(agNombre) || agNombre.includes(name)) return ag.id;
    }
    // Fallback: usar el texto como clave
    return `txt_${txt}`;
  }, [catalogoAgentes]);

  const getNombreAgente = useCallback((exp) => {
    const id = resolverAgenteId(exp);
    if (id.startsWith('txt_')) return id.replace('txt_', '');
    if (id === 'sin-agente') return 'Sin agente';
    return equipoMap[id] || exp.agente || 'Sin agente';
  }, [resolverAgenteId, equipoMap]);

  // ─── Vendedor (sub-agente): resolver del expediente ───
  const resolverVendedorId = useCallback((exp) => {
    if (exp.vendedor_id) return String(exp.vendedor_id);
    if (exp.subagente_id) return String(exp.subagente_id);
    const txt = (exp.sub_agente || '').trim();
    if (!txt) return 'sin-vendedor';
    const txtUpper = txt.toUpperCase();
    for (const v of catalogoVendedores) {
      const vNombre = v.nombreCompleto.toUpperCase();
      if (vNombre === txtUpper || txtUpper.includes(vNombre) || vNombre.includes(txtUpper)) return v.id;
      // Match parcial: "mariana" vs "mariana sanchez torres"
      const vCorto = v.nombre.toUpperCase();
      if (vCorto === txtUpper || txtUpper.includes(vCorto) || vCorto.includes(txtUpper)) return v.id;
    }
    return `txt_${txt}`;
  }, [catalogoVendedores]);

  const getNombreVendedor = useCallback((exp) => {
    const id = resolverVendedorId(exp);
    if (id.startsWith('txt_')) return id.replace('txt_', '');
    if (id === 'sin-vendedor') return 'Sin vendedor';
    return equipoMap[id] || exp.sub_agente || 'Sin vendedor';
  }, [resolverVendedorId, equipoMap]);

  // ─── Opciones de filtros ───
  const opcionesFiltros = useMemo(() => {
    const ra = new Set(), as_ = new Set();

    // Vendedores con expedientes bajo el agente seleccionado
    const vendedoresConExp = new Set();
    expedientes.forEach(e => {
      if (e.producto) ra.add(e.producto);
      if (e.compania) as_.add(e.compania);
      if (filtroAgente !== 'todos' && resolverAgenteId(e) === filtroAgente) {
        const cv = resolverVendedorId(e);
        if (cv !== 'sin-vendedor') vendedoresConExp.add(cv);
      }
    });

    // Vendedores: del catálogo + textuales, filtrados por agente
    const vendsFiltrados = [];
    if (filtroAgente !== 'todos') {
      // Agregar vendedores del catálogo que tienen expedientes
      catalogoVendedores.forEach(v => {
        if (vendedoresConExp.has(v.id)) vendsFiltrados.push(v);
      });
      // Agregar vendedores textuales (no en catálogo)
      const idsEnCatalogo = new Set(vendsFiltrados.map(v => v.id));
      vendedoresConExp.forEach(cv => {
        if (!idsEnCatalogo.has(cv) && cv.startsWith('txt_')) {
          vendsFiltrados.push({ id: cv, nombre: cv.replace('txt_', ''), nombreCompleto: cv.replace('txt_', ''), codigo: '' });
        }
      });
      vendsFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    return {
      agentes: catalogoAgentes,
      vendedores: vendsFiltrados,
      ramos: [...ra].sort(),
      aseguradoras: [...as_].sort()
    };
  }, [expedientes, catalogoAgentes, catalogoVendedores, filtroAgente, resolverAgenteId, resolverVendedorId]);

  // ─── Expedientes filtrados (core memoization) ───
  const expedientesFiltrados = useMemo(() => {
    return expedientes.filter(exp => {
      const f = getFecha(exp);
      if (!f || f < fechaInicio || f > fechaFin) return false;
      if (filtroAgente !== 'todos' && resolverAgenteId(exp) !== filtroAgente) return false;
      if (filtroVendedor !== 'todos' && resolverVendedorId(exp) !== filtroVendedor) return false;
      if (filtroRamo !== 'todos' && exp.producto !== filtroRamo) return false;
      if (filtroAseguradora !== 'todos' && exp.compania !== filtroAseguradora) return false;
      return true;
    });
  }, [expedientes, fechaInicio, fechaFin, filtroAgente, filtroVendedor, filtroRamo, filtroAseguradora, resolverAgenteId, resolverVendedorId]);

  // ─── KPIs ───
  const kpis = useMemo(() => {
    let nuevas = 0, renov = 0, cancel = 0, endos = 0;
    let prima = 0, primaN = 0, primaR = 0, primaCancel = 0;
    expedientesFiltrados.forEach(e => {
      const p = getPrima(e);
      prima += p;
      if (esRenovacion(e)) { renov++; primaR += p; }
      else if (esEndoso(e)) { endos++; }
      else { nuevas++; primaN += p; }
      if (esCancelada(e)) { cancel++; primaCancel += p; }
    });

    // Tasa de renovación
    const debeRenovar = expedientes.filter(e => {
      const t = e.termino_vigencia ? e.termino_vigencia.split('T')[0] : null;
      return t && t >= fechaInicio && t <= fechaFin;
    }).length;
    const tasaRen = debeRenovar > 0 ? ((renov / debeRenovar) * 100).toFixed(1) : null;

    // Prima neta = producción total menos cancelaciones
    const primaNeta = prima - primaCancel;
    const primaNetaN = primaN - expedientesFiltrados.filter(e => esNueva(e) && esCancelada(e)).reduce((s, e) => s + getPrima(e), 0);
    const primaNetaR = primaR - expedientesFiltrados.filter(e => esRenovacion(e) && esCancelada(e)).reduce((s, e) => s + getPrima(e), 0);

    return { nuevas, renov, cancel, endos, prima, primaN, primaR, primaCancel, primaNeta, primaNetaN, primaNetaR, debeRenovar, tasaRen, perdidas: Math.max(0, debeRenovar - renov), total: expedientesFiltrados.length };
  }, [expedientesFiltrados, expedientes, fechaInicio, fechaFin]);

  // ─── Tabla resumen agrupada ───
  const tablaResumen = useMemo(() => {
    const mapa = new Map();
    expedientesFiltrados.forEach(exp => {
      let key, label;
      if (agrupacion === 'ramo') {
        key = exp.producto || 'Sin clasificar';
        label = key;
      } else if (agrupacion === 'agente') {
        key = resolverAgenteId(exp);
        label = getNombreAgente(exp);
      } else {
        key = exp.compania || 'Sin aseguradora';
        label = key;
      }
      if (!mapa.has(key)) mapa.set(key, { key, label, nuevas: 0, renov: 0, endosos: 0, cancel: 0, prima: 0, primaCancel: 0 });
      const row = mapa.get(key);
      if (esRenovacion(exp)) row.renov++;
      else if (esEndoso(exp)) row.endosos++;
      else row.nuevas++;
      if (esCancelada(exp)) { row.cancel++; row.primaCancel += getPrima(exp); }
      row.prima += getPrima(exp);
    });
    return [...mapa.values()].sort((a, b) => b.prima - a.prima);
  }, [expedientesFiltrados, agrupacion, resolverAgenteId, getNombreAgente]);

  // ─── Drill-down: filtrar + paginar ───
  const drillDownData = useMemo(() => {
    if (!drillDown) return { items: [], total: 0 };

    // Filtrar por tipo de movimiento
    let filtered = expedientesFiltrados;
    if (drillDown.dimension && drillDown.valor) {
      filtered = filtered.filter(exp => {
        if (drillDown.dimension === 'ramo') return (exp.producto || 'Sin clasificar') === drillDown.valor;
        if (drillDown.dimension === 'agente') return resolverAgenteId(exp) === drillDown.valor;
        if (drillDown.dimension === 'aseguradora') return (exp.compania || 'Sin aseguradora') === drillDown.valor;
        return true;
      });
    }
    if (drillDown.tipo === 'nuevas') filtered = filtered.filter(esNueva);
    else if (drillDown.tipo === 'renov') filtered = filtered.filter(esRenovacion);
    else if (drillDown.tipo === 'endosos') filtered = filtered.filter(esEndoso);
    else if (drillDown.tipo === 'cancel') filtered = filtered.filter(esCancelada);
    // 'total' = no filter by tipo

    // Ordenar
    const { campo, dir } = drillSort;
    const mul = dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (campo === 'fecha') return mul * ((getFecha(a) || '').localeCompare(getFecha(b) || ''));
      if (campo === 'prima') return mul * (getPrima(a) - getPrima(b));
      if (campo === 'poliza') return mul * ((a.numero_poliza || '').localeCompare(b.numero_poliza || ''));
      if (campo === 'vendedor') return mul * (getNombreVendedor(a).localeCompare(getNombreVendedor(b)));
      if (campo === 'agente') return mul * (getNombreAgente(a).localeCompare(getNombreAgente(b)));
      if (campo === 'aseguradora') return mul * ((a.compania || '').localeCompare(b.compania || ''));
      return 0;
    });

    const total = filtered.length;
    const start = drillPage * PAGE_SIZE;
    return { items: filtered.slice(start, start + PAGE_SIZE), total };
  }, [drillDown, drillPage, drillSort, expedientesFiltrados, resolverAgenteId, getNombreVendedor, getNombreAgente]);

  // ─── Drill-down handlers ───
  const abrirDrillDown = useCallback((tipo, dimension, valor, label) => {
    const titulosMap = { nuevas: 'Pólizas Nuevas', renov: 'Renovaciones', endosos: 'Endosos', cancel: 'Cancelaciones', total: 'Total Expedientes' };
    const titulo = `${titulosMap[tipo] || tipo}${label ? ` — ${label}` : ''}`;
    setDrillDown({ tipo, dimension, valor, titulo });
    setDrillPage(0);
    setDrillSort({ campo: 'fecha', dir: 'desc' });
  }, []);

  const cerrarDrillDown = useCallback(() => {
    setDrillDown(null);
    setDrillPage(0);
  }, []);

  const toggleSort = useCallback((campo) => {
    setDrillSort(prev => ({
      campo,
      dir: prev.campo === campo && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
    setDrillPage(0);
  }, []);

  // ─── Drill-down por vendedor (cuando dimension === 'agente') ───
  const vendorDrillDown = useMemo(() => {
    if (!drillDown || drillDown.dimension !== 'agente') return null;

    // Filtrar expedientes del agente + tipo
    let filtered = expedientesFiltrados.filter(exp => resolverAgenteId(exp) === drillDown.valor);
    if (drillDown.tipo === 'nuevas') filtered = filtered.filter(esNueva);
    else if (drillDown.tipo === 'renov') filtered = filtered.filter(esRenovacion);
    else if (drillDown.tipo === 'endosos') filtered = filtered.filter(esEndoso);
    else if (drillDown.tipo === 'cancel') filtered = filtered.filter(esCancelada);

    const primaTotal = filtered.reduce((s, e) => s + getPrima(e), 0);

    // Agrupar por vendedor
    const mapa = new Map();
    filtered.forEach(exp => {
      const vid = resolverVendedorId(exp);
      const vname = getNombreVendedor(exp);
      // Es "directo" del agente si no tiene vendedor o el vendedor es el mismo agente
      const esDirecto = vid === 'sin-vendedor';
      const key = esDirecto ? '__directo__' : vid;
      const label = esDirecto ? (drillDown.titulo.split(' — ')[1] || 'Agente (directo)') : vname;

      if (!mapa.has(key)) mapa.set(key, { key, label, esDirecto, nuevas: 0, renov: 0, endosos: 0, cancel: 0, prima: 0, polizas: [] });
      const row = mapa.get(key);
      if (esRenovacion(exp)) row.renov++;
      else if (esEndoso(exp)) row.endosos++;
      else row.nuevas++;
      if (esCancelada(exp)) row.cancel++;
      row.prima += getPrima(exp);
      row.polizas.push(exp);
    });

    // Ordenar: directo primero, luego por prima desc
    const rows = [...mapa.values()].sort((a, b) => {
      if (a.esDirecto && !b.esDirecto) return -1;
      if (!a.esDirecto && b.esDirecto) return 1;
      return b.prima - a.prima;
    });

    return { rows, primaTotal, totalPolizas: filtered.length };
  }, [drillDown, expedientesFiltrados, resolverAgenteId, resolverVendedorId, getNombreVendedor]);

  // ─── Colores de ramo ───
  const coloresRamo = { 'Autos': '#0d6efd', 'Vida': '#198754', 'Daños': '#dc3545', 'GMM': '#6f42c1', 'Equipo pesado': '#fd7e14', 'Embarcaciones': '#0dcaf0', 'Ahorro': '#20c997' };

  // ─── Cell clickeable ───
  const CeldaCount = ({ count, tipo, dimension, valor, label, color = 'primary' }) => {
    if (!count) return <td className="text-center text-muted" style={{ fontSize: '0.9em' }}>—</td>;
    return (
      <td className="text-center">
        <button
          className={`btn btn-sm btn-outline-${color} px-2 py-0 fw-bold`}
          style={{ fontSize: '0.85em', minWidth: '36px', borderRadius: '6px' }}
          onClick={() => abrirDrillDown(tipo, dimension, valor, label)}
          title={`Ver detalle: ${count}`}
        >
          {count}
        </button>
      </td>
    );
  };

  // Sort icon
  const SortIcon = ({ campo }) => {
    if (drillSort.campo !== campo) return <ArrowUp size={12} className="opacity-25" />;
    return drillSort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div className="p-4">
      {/* ═══ Header ═══ */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-2">
          <Briefcase size={28} className="text-primary" />
          <div>
            <h4 className="mb-0 fw-bold">Producción y Cartera</h4>
            <small className="text-muted">Vista consolidada · Click en los números para ver detalle</small>
          </div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={cargarDatos} disabled={loading}>
          <RefreshCw size={16} className={`me-1 ${loading ? 'spin' : ''}`} />Actualizar
        </button>
      </div>

      {/* ═══ Filtros ═══ */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body py-3">
          {/* Período */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <Filter size={15} className="text-muted" />
            <span className="fw-semibold text-muted" style={{ fontSize: '0.8em' }}>Período:</span>
            <div className="btn-group btn-group-sm">
              {[
                { k: 'hoy', l: 'Hoy' }, { k: 'semana', l: 'Semana' }, { k: 'mes-actual', l: 'Mes' },
                { k: 'mes-anterior', l: 'Mes Ant.' }, { k: 'trimestre', l: 'Trim.' }, { k: 'anio', l: 'Año' }
              ].map(f => (
                <button key={f.k} className={`btn ${filtroRapido === f.k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => aplicarFiltroRapido(f.k)}>{f.l}</button>
              ))}
            </div>
            <div className="d-flex align-items-center gap-1 ms-auto">
              <input type="date" className="form-control form-control-sm" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setFiltroRapido('custom'); cerrarDrillDown(); }} style={{ width: '140px' }} />
              <span className="text-muted small">a</span>
              <input type="date" className="form-control form-control-sm" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setFiltroRapido('custom'); cerrarDrillDown(); }} style={{ width: '140px' }} />
            </div>
          </div>
          {/* Dimensiones */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Users size={14} className="text-muted" />
            <select className="form-select form-select-sm" value={filtroAgente} onChange={e => { setFiltroAgente(e.target.value); setFiltroVendedor('todos'); cerrarDrillDown(); }} style={{ width: '170px', fontSize: '0.85em' }}>
              <option value="todos">Todos los agentes</option>
              {opcionesFiltros.agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}{a.codigo ? ` (${a.codigo})` : ''}</option>)}
            </select>
            <User size={14} className={filtroAgente === 'todos' ? 'text-muted opacity-50' : 'text-muted'} />
            <select
              className="form-select form-select-sm"
              value={filtroVendedor}
              onChange={e => { setFiltroVendedor(e.target.value); cerrarDrillDown(); }}
              disabled={filtroAgente === 'todos'}
              style={{ width: '170px', fontSize: '0.85em', opacity: filtroAgente === 'todos' ? 0.5 : 1 }}
              title={filtroAgente === 'todos' ? 'Selecciona un agente primero' : ''}
            >
              <option value="todos">Todos los vendedores</option>
              {opcionesFiltros.vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}{v.codigo ? ` (${v.codigo})` : ''}</option>)}
            </select>
            <Package size={14} className="text-muted" />
            <select className="form-select form-select-sm" value={filtroRamo} onChange={e => { setFiltroRamo(e.target.value); cerrarDrillDown(); }} style={{ width: '150px', fontSize: '0.85em' }}>
              <option value="todos">Todos los ramos</option>
              {opcionesFiltros.ramos.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <Building2 size={14} className="text-muted" />
            <select className="form-select form-select-sm" value={filtroAseguradora} onChange={e => { setFiltroAseguradora(e.target.value); cerrarDrillDown(); }} style={{ width: '170px', fontSize: '0.85em' }}>
              <option value="todos">Todas las aseguradoras</option>
              {opcionesFiltros.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {(filtroAgente !== 'todos' || filtroVendedor !== 'todos' || filtroRamo !== 'todos' || filtroAseguradora !== 'todos') && (
              <button className="btn btn-outline-danger btn-sm ms-auto" onClick={() => { setFiltroAgente('todos'); setFiltroVendedor('todos'); setFiltroRamo('todos'); setFiltroAseguradora('todos'); cerrarDrillDown(); }}>
                <XCircle size={14} className="me-1" />Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2 text-muted">Cargando...</p>
        </div>
      ) : (
        <>
          {/* ═══ KPIs ═══ */}
          <div className="row g-3 mb-4">
            {[
              { label: 'Total', val: kpis.total, color: '#0d6efd', icon: FileText, sub: formatMoney(kpis.primaNeta), tipo: 'total' },
              { label: 'Nuevas', val: kpis.nuevas, color: '#198754', icon: TrendingUp, sub: formatMoney(kpis.primaNetaN), tipo: 'nuevas' },
              { label: 'Renovaciones', val: kpis.renov, color: '#0dcaf0', icon: RefreshCw, sub: formatMoney(kpis.primaNetaR), tipo: 'renov' },
              { label: 'Cancelaciones', val: kpis.cancel, color: '#dc3545', icon: XCircle, sub: kpis.primaCancel > 0 ? formatMoney(kpis.primaCancel) : null, tipo: 'cancel' }
            ].map(k => {
              const Ic = k.icon;
              return (
                <div key={k.tipo} className="col-6 col-lg">
                  <div
                    className="card border-0 shadow-sm h-100"
                    style={{ cursor: 'pointer', transition: 'box-shadow .15s', borderLeft: `4px solid ${k.color}` }}
                    onClick={() => abrirDrillDown(k.tipo, null, null, null)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,.12)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
                  >
                    <div className="card-body p-3">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="text-muted" style={{ fontSize: '0.78em' }}>{k.label}</span>
                        <Ic size={17} style={{ color: k.color }} />
                      </div>
                      <h3 className="mb-0 fw-bold" style={{ color: k.color }}>{k.val}</h3>
                      {k.sub && <small className="text-muted" style={{ fontSize: '0.78em' }}>{k.sub}</small>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ Tasa de Renovación ═══ */}
          {kpis.tasaRen !== null && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body py-3">
                <div className="row align-items-center gx-4">
                  <div className="col-auto">
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      backgroundColor: parseFloat(kpis.tasaRen) >= 70 ? '#d1e7dd' : parseFloat(kpis.tasaRen) >= 40 ? '#fff3cd' : '#f8d7da',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {parseFloat(kpis.tasaRen) >= 70 ? <ArrowUpRight size={22} className="text-success" /> :
                       parseFloat(kpis.tasaRen) >= 40 ? <Minus size={22} className="text-warning" /> :
                       <ArrowDownRight size={22} className="text-danger" />}
                    </div>
                  </div>
                  <div className="col-auto">
                    <small className="text-muted d-block" style={{ fontSize: '0.75em' }}>Tasa de Renovación</small>
                    <span className="fw-bold fs-5" style={{
                      color: parseFloat(kpis.tasaRen) >= 70 ? '#198754' : parseFloat(kpis.tasaRen) >= 40 ? '#ffc107' : '#dc3545'
                    }}>{kpis.tasaRen}%</span>
                  </div>
                  <div className="col">
                    <div className="d-flex gap-4 mb-1">
                      <small className="text-muted">Debían: <strong>{kpis.debeRenovar}</strong></small>
                      <small className="text-success">Renovadas: <strong>{kpis.renov}</strong></small>
                      <small className="text-danger">Pendientes: <strong>{kpis.perdidas}</strong></small>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar bg-success" style={{ width: `${kpis.tasaRen}%` }} />
                      <div className="progress-bar bg-danger bg-opacity-50" style={{ width: `${100 - parseFloat(kpis.tasaRen)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Tabla Resumen Consolidada ═══ */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom py-2 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold" style={{ fontSize: '0.95em' }}>
                Resumen por:
              </h6>
              <div className="btn-group btn-group-sm">
                {[
                  { k: 'ramo', l: 'Ramo', ic: Package },
                  { k: 'agente', l: 'Agente', ic: Users },
                  { k: 'aseguradora', l: 'Aseguradora', ic: Building2 }
                ].map(t => {
                  const I = t.ic;
                  return (
                    <button key={t.k} className={`btn ${agrupacion === t.k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setAgrupacion(t.k); cerrarDrillDown(); }}>
                      <I size={13} className="me-1" />{t.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="card-body p-0">
              {tablaResumen.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <Briefcase size={40} className="mb-2 opacity-25" />
                  <p className="mb-0">No hay expedientes en este período</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle" style={{ fontSize: '0.88em' }}>
                    <thead className="table-light">
                      <tr>
                        {agrupacion === 'agente' && <th style={{ width: 32 }}>#</th>}
                        <th>{agrupacion === 'ramo' ? 'Ramo' : agrupacion === 'agente' ? 'Agente' : 'Aseguradora'}</th>
                        <th className="text-center">Nuevas</th>
                        <th className="text-center">Renov.</th>
                        <th className="text-center">Cancel.</th>
                        <th className="text-end">Prima</th>
                        <th style={{ width: 100 }}>% Prima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablaResumen.map((row, idx) => {
                        const primaNeta = row.prima - row.primaCancel;
                        const pct = kpis.primaNeta > 0 ? ((primaNeta / kpis.primaNeta) * 100).toFixed(1) : 0;
                        const dotColor = agrupacion === 'ramo' ? (coloresRamo[row.label] || '#6c757d') : '#0d6efd';
                        return (
                          <tr key={row.key}>
                            {agrupacion === 'agente' && (
                              <td>{idx < 3 ? <Award size={16} style={{ color: ['#ffd700','#c0c0c0','#cd7f32'][idx] }} /> : <span className="text-muted">{idx + 1}</span>}</td>
                            )}
                            <td className="fw-semibold">
                              <div className="d-flex align-items-center gap-2">
                                {agrupacion === 'ramo' && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />}
                                {row.label}
                              </div>
                            </td>
                            <CeldaCount count={row.nuevas} tipo="nuevas" dimension={agrupacion} valor={row.key} label={row.label} color="success" />
                            <CeldaCount count={row.renov} tipo="renov" dimension={agrupacion} valor={row.key} label={row.label} color="info" />
                            <CeldaCount count={row.cancel} tipo="cancel" dimension={agrupacion} valor={row.key} label={row.label} color="danger" />
                            <td className="text-end fw-semibold">{formatMoney(primaNeta)}</td>
                            <td>
                              <div className="d-flex align-items-center gap-1">
                                <div className="progress flex-grow-1" style={{ height: 5 }}>
                                  <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: dotColor }} />
                                </div>
                                <small className="text-muted" style={{ fontSize: '0.75em', minWidth: 30 }}>{pct}%</small>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="table-light fw-bold">
                      <tr>
                        {agrupacion === 'agente' && <td></td>}
                        <td>Total</td>
                        <td className="text-center">{kpis.nuevas}</td>
                        <td className="text-center">{kpis.renov}</td>
                        <td className="text-center">{kpis.cancel}</td>
                        <td className="text-end">{formatMoney(kpis.primaNeta)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Panel Drill-Down ═══ */}
          {drillDown && drillDown.dimension === 'agente' && vendorDrillDown && (
            <div className="card border-0 shadow-sm mb-4" style={{ borderTop: '3px solid #0d6efd' }}>
              <div className="card-header bg-white border-bottom py-2 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <Eye size={16} className="text-primary" />
                  <h6 className="mb-0 fw-bold" style={{ fontSize: '0.9em' }}>{drillDown.titulo}</h6>
                  <span className="badge bg-primary">{vendorDrillDown.totalPolizas} pólizas</span>
                  <span className="badge bg-secondary">{vendorDrillDown.rows.length} vendedor{vendorDrillDown.rows.length !== 1 ? 'es' : ''}</span>
                </div>
                <button className="btn btn-sm btn-outline-secondary" onClick={cerrarDrillDown}>
                  <X size={14} className="me-1" />Cerrar
                </button>
              </div>
              <div className="card-body p-0">
                {vendorDrillDown.totalPolizas === 0 ? (
                  <div className="text-center py-4 text-muted">Sin registros</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle" style={{ fontSize: '0.85em' }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: 32 }}></th>
                          <th>Vendedor</th>
                          <th className="text-center">Nuevas</th>
                          <th className="text-center">Renov.</th>
                          <th className="text-center">Cancel.</th>
                          <th className="text-end">Prima</th>
                          <th style={{ width: 130 }}>% del Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorDrillDown.rows.map((row, idx) => {
                          const pct = vendorDrillDown.primaTotal > 0 ? ((row.prima / vendorDrillDown.primaTotal) * 100).toFixed(1) : 0;
                          const barColor = row.esDirecto ? '#0d6efd' : ['#198754', '#6f42c1', '#fd7e14', '#dc3545', '#0dcaf0'][idx % 5];
                          return (
                            <tr key={row.key}>
                              <td className="text-center">
                                {row.esDirecto
                                  ? <Briefcase size={15} className="text-primary" />
                                  : <User size={15} style={{ color: barColor }} />}
                              </td>
                              <td className="fw-semibold">
                                <div className="d-flex align-items-center gap-2">
                                  {row.label}
                                  {row.esDirecto && <span className="badge bg-primary bg-opacity-10 text-primary" style={{ fontSize: '0.7em' }}>Directo</span>}
                                </div>
                              </td>
                              <td className="text-center">{row.nuevas || <span className="text-muted">—</span>}</td>
                              <td className="text-center">{row.renov || <span className="text-muted">—</span>}</td>
                              <td className="text-center">{row.cancel ? <span className="text-danger fw-bold">{row.cancel}</span> : <span className="text-muted">—</span>}</td>
                              <td className="text-end fw-semibold">{formatMoney(row.prima)}</td>
                              <td>
                                <div className="d-flex align-items-center gap-1">
                                  <div className="progress flex-grow-1" style={{ height: 8, borderRadius: 4 }}>
                                    <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: barColor, borderRadius: 4 }} />
                                  </div>
                                  <span className="fw-bold" style={{ fontSize: '0.8em', minWidth: 40, color: barColor }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-light fw-bold">
                        <tr>
                          <td></td>
                          <td>Total</td>
                          <td className="text-center">{vendorDrillDown.rows.reduce((s, r) => s + r.nuevas, 0)}</td>
                          <td className="text-center">{vendorDrillDown.rows.reduce((s, r) => s + r.renov, 0)}</td>
                          <td className="text-center">{vendorDrillDown.rows.reduce((s, r) => s + r.cancel, 0)}</td>
                          <td className="text-end">{formatMoney(vendorDrillDown.primaTotal)}</td>
                          <td><span className="fw-bold" style={{ fontSize: '0.8em' }}>100%</span></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ Panel Drill-Down (genérico: ramo/aseguradora/KPI) ═══ */}
          {drillDown && drillDown.dimension !== 'agente' && (
            <div className="card border-0 shadow-sm mb-4" style={{ borderTop: '3px solid #0d6efd' }}>
              <div className="card-header bg-white border-bottom py-2 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <Eye size={16} className="text-primary" />
                  <h6 className="mb-0 fw-bold" style={{ fontSize: '0.9em' }}>{drillDown.titulo}</h6>
                  <span className="badge bg-primary">{drillDownData.total} registros</span>
                </div>
                <button className="btn btn-sm btn-outline-secondary" onClick={cerrarDrillDown}>
                  <X size={14} className="me-1" />Cerrar
                </button>
              </div>
              <div className="card-body p-0">
                {drillDownData.total === 0 ? (
                  <div className="text-center py-4 text-muted">Sin registros</div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <table className="table table-hover table-sm mb-0 align-middle" style={{ fontSize: '0.83em' }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('fecha')}>
                              Fecha <SortIcon campo="fecha" />
                            </th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('poliza')}>
                              Póliza <SortIcon campo="poliza" />
                            </th>
                            <th>Cliente</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('aseguradora')}>
                              Aseguradora <SortIcon campo="aseguradora" />
                            </th>
                            <th>Ramo</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('agente')}>
                              Agente <SortIcon campo="agente" />
                            </th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('vendedor')}>
                              Vendedor <SortIcon campo="vendedor" />
                            </th>
                            <th>Tipo</th>
                            <th className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('prima')}>
                              Prima <SortIcon campo="prima" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillDownData.items.map((exp, i) => {
                            const tipo = esRenovacion(exp) ? 'Renov.' : esEndoso(exp) ? 'Endoso' : 'Nueva';
                            const tipoColor = tipo === 'Renov.' ? 'info' : tipo === 'Endoso' ? 'purple' : 'success';
                            return (
                              <tr key={exp.id || i}>
                                <td>{formatFechaCorta(getFecha(exp))}</td>
                                <td className="fw-semibold">{exp.numero_poliza || '—'}</td>
                                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {exp.nombre || exp.razon_social || exp.cliente_nombre || '—'} {exp.apellido_paterno || ''}
                                </td>
                                <td>{exp.compania || '—'}</td>
                                <td>{exp.producto || '—'}</td>
                                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {getNombreAgente(exp)}
                                </td>
                                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {getNombreVendedor(exp)}
                                </td>
                                <td>
                                  <span className={`badge bg-${tipoColor}`} style={tipoColor === 'purple' ? { backgroundColor: '#6f42c1', color: 'white' } : {}}>
                                    {tipo}
                                  </span>
                                  {esCancelada(exp) && <span className="badge bg-danger ms-1">Cancel.</span>}
                                </td>
                                <td className="text-end fw-semibold">{formatMoney(getPrima(exp))}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Paginación */}
                    {drillDownData.total > PAGE_SIZE && (
                      <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top bg-light">
                        <small className="text-muted">
                          {drillPage * PAGE_SIZE + 1}–{Math.min((drillPage + 1) * PAGE_SIZE, drillDownData.total)} de {drillDownData.total}
                        </small>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" disabled={drillPage === 0} onClick={() => setDrillPage(p => p - 1)}>
                            <ChevronLeft size={14} />
                          </button>
                          <button className="btn btn-outline-secondary" disabled={(drillPage + 1) * PAGE_SIZE >= drillDownData.total} onClick={() => setDrillPage(p => p + 1)}>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProduccionCartera;

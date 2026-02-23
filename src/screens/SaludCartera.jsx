import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  TrendingUp, Activity, PieChart, Building2, Package,
  UserCheck, ArrowUpRight, ArrowDownRight, Filter, Ban
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL;

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
const getPrima = (e) => parseFloat(e.prima_total) || parseFloat(e.total) || 0;
const norm = (t) => (t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const COLORES_RAMO = ['#0d6efd','#198754','#fd7e14','#6f42c1','#dc3545','#0dcaf0','#ffc107','#20c997','#d63384','#6610f2'];

/** "YYYY-MM" */
const toYM = (d) => { if (!d) return null; const s = typeof d === 'string' ? d : d.toISOString(); return s.slice(0, 7); };

// ─── Clasificación corregida (usa tipo_movimiento, NO movimiento de vehículo) ─
const esRenovacion = (e) => norm(e.tipo_movimiento) === 'RENOVACION' || !!e.renovacion_de;
const esCancelada = (e) => { const et = norm(e.etapa_activa); const es = norm(e.estatus); return et === 'CANCELADA' || et === 'CANCELADO' || es === 'CANCELADA' || es === 'CANCELADO'; };
const esEndoso = (e) => norm(e.tipo_movimiento) === 'ENDOSO';
const clasificar = (e) => { if (esCancelada(e)) return 'cancelacion'; if (esEndoso(e)) return 'endoso'; if (esRenovacion(e)) return 'renovacion'; return 'nueva'; };

const getFechaExp = (e) => { const fe = e.fecha_emision ? e.fecha_emision.split('T')[0] : null; const fc = (e.fecha_creacion || e.created_at || ''); return fe || (fc ? fc.split('T')[0] : null); };
const mesExp = (e) => toYM(getFechaExp(e));

// ─── Semáforo ────
const Semaforo = ({ valor, umbrales, invertir = false }) => {
  if (invertir) {
    if (valor <= umbrales[0]) return <span>🟢</span>;
    if (valor <= umbrales[1]) return <span>🟡</span>;
    return <span>🔴</span>;
  }
  if (valor >= umbrales[1]) return <span>🟢</span>;
  if (valor >= umbrales[0]) return <span>🟡</span>;
  return <span>🔴</span>;
};

// ─── vs Año Anterior ────
const VsAnterior = ({ actual, anterior, esPct = false, invertir = false }) => {
  if (anterior === null || anterior === undefined) return <small className="text-muted" style={{ fontSize: '0.75em' }}>Sin datos año anterior</small>;
  const diff = anterior === 0 ? (actual > 0 ? 100 : 0) : (((actual - anterior) / anterior) * 100);
  const subio = diff > 0;
  const bueno = invertir ? !subio : subio;
  const color = diff === 0 ? '#6c757d' : bueno ? '#198754' : '#dc3545';
  const emoji = diff === 0 ? '' : bueno ? ' 🟢' : ' 🔴';
  return (
    <small style={{ fontSize: '0.75em', color }} className="d-flex align-items-center justify-content-center gap-1">
      {subio ? <ArrowUpRight size={12}/> : diff < 0 ? <ArrowDownRight size={12}/> : null}
      {diff !== 0 ? `${subio ? '↑' : '↓'}${Math.abs(diff).toFixed(0)}%` : '= igual'}
      {' '}vs año ant.{!esPct && anterior !== null && ` (${anterior})`}
      {esPct && anterior !== null && ` (${anterior}%)`}
      {emoji}
    </small>
  );
};

// ═══════════════════════════════════════════════════════════════════
const SaludCartera = () => {
  const [loading, setLoading] = useState(false);
  const [expedientes, setExpedientes] = useState([]);
  const [recibos, setRecibos] = useState([]);

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());

  // Filtros globales
  const [filtroRamo, setFiltroRamo] = useState('todos');
  const [filtroAseguradora, setFiltroAseguradora] = useState('todos');
  const [filtroAgente, setFiltroAgente] = useState('todos');
  const [vistaDetalle, setVistaDetalle] = useState('producto');

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ss_token');
      const [expRes, recRes] = await Promise.all([
        fetch(`${API_URL}/api/expedientes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/recibos`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);
      if (expRes.ok) { const d = await expRes.json(); setExpedientes(Array.isArray(d) ? d : []); }
      if (recRes?.ok) { const d = await recRes.json(); setRecibos(Array.isArray(d) ? d : []); }
    } catch (err) { console.error(err); toast.error('Error al cargar datos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargarDatos(); }, []);

  // ─── Opciones para filtros ───
  const opcionesFiltro = useMemo(() => ({
    ramos: [...new Set(expedientes.map(e => e.producto || e.ramo).filter(Boolean))].sort(),
    aseguradoras: [...new Set(expedientes.map(e => e.compania || e.aseguradora).filter(Boolean))].sort(),
    agentes: [...new Set(expedientes.map(e => e.agente || e.vendedor_id).filter(Boolean))].sort(),
  }), [expedientes]);

  // ─── Filtrado global ───
  const expedientesFiltrados = useMemo(() => expedientes.filter(e => {
    if (filtroRamo !== 'todos' && (e.producto || e.ramo) !== filtroRamo) return false;
    if (filtroAseguradora !== 'todos' && (e.compania || e.aseguradora) !== filtroAseguradora) return false;
    if (filtroAgente !== 'todos' && (e.agente || e.vendedor_id) !== filtroAgente) return false;
    return true;
  }), [expedientes, filtroRamo, filtroAseguradora, filtroAgente]);

  // ═══ CÁLCULOS ═══
  const data = useMemo(() => {
    const ymActual = `${anio}-${String(mes + 1).padStart(2, '0')}`;
    const ymAnterior = `${anio - 1}-${String(mes + 1).padStart(2, '0')}`;
    const hoyDate = new Date();
    const hoyStr = hoyDate.toISOString().split('T')[0];

    const delMes = expedientesFiltrados.filter(e => mesExp(e) === ymActual);
    const delMesAnt = expedientesFiltrados.filter(e => mesExp(e) === ymAnterior);

    const nuevasMes = delMes.filter(e => clasificar(e) === 'nueva');
    const renovMes = delMes.filter(e => clasificar(e) === 'renovacion');
    const cancelMes = delMes.filter(e => clasificar(e) === 'cancelacion');

    const nuevasAnt = delMesAnt.filter(e => clasificar(e) === 'nueva');
    const renovAnt = delMesAnt.filter(e => clasificar(e) === 'renovacion');
    const cancelAnt = delMesAnt.filter(e => clasificar(e) === 'cancelacion');

    // Vigentes al cierre del mes seleccionado
    const vigentes = expedientesFiltrados.filter(e => {
      const tv = (e.fin_vigencia || e.termino_vigencia || '').split('T')[0];
      return tv >= hoyStr && !esCancelada(e);
    });
    const carteraVigente = vigentes.length;
    const primaTotalVigente = vigentes.reduce((s, e) => s + getPrima(e), 0);

    // Vigentes al cierre del mes anterior (para medir crecimiento)
    const mesAntDate = new Date(anio, mes, 0); // último día del mes anterior
    const mesAntStr = mesAntDate.toISOString().split('T')[0];
    const vigMesAnt = expedientesFiltrados.filter(e => {
      const fe = getFechaExp(e);
      if (!fe || fe > mesAntStr) return false; // emitida después del mes anterior → no cuenta
      const tv = (e.fin_vigencia || e.termino_vigencia || '').split('T')[0];
      return tv >= mesAntStr && !esCancelada(e);
    });
    const primaVigMesAnt = vigMesAnt.reduce((s, e) => s + getPrima(e), 0);
    const polizasVigMesAnt = vigMesAnt.length;

    // Crecimiento en prima vs mes anterior
    const deltaPrima = primaTotalVigente - primaVigMesAnt;
    const pctCrecimientoPrima = primaVigMesAnt > 0
      ? ((deltaPrima / primaVigMesAnt) * 100).toFixed(1)
      : (primaTotalVigente > 0 ? '100.0' : '0.0');
    const deltaPolizas = carteraVigente - polizasVigMesAnt;

    // Retención
    const debianRenovar = expedientesFiltrados.filter(e => {
      const tv = e.fin_vigencia || e.termino_vigencia;
      return tv && toYM(tv) === ymActual && !esCancelada(e);
    });
    const debianRenovarAnt = expedientesFiltrados.filter(e => {
      const tv = e.fin_vigencia || e.termino_vigencia;
      return tv && toYM(tv) === ymAnterior;
    });
    const tasaRetencion = debianRenovar.length > 0 ? ((renovMes.length / debianRenovar.length) * 100).toFixed(1) : null;
    const tasaRetencionAnt = debianRenovarAnt.length > 0 ? ((renovAnt.length / debianRenovarAnt.length) * 100).toFixed(1) : null;

    // Cancelaciones desglose
    const cancelEnVigor = cancelMes.filter(e => { const et = norm(e.etapa_activa); return !et.includes('COTIZACION') && !et.includes('PROCESO'); }).length;

    // ── Índice de salud: 50% Crecimiento (prima) + 50% Renovación ──
    const crecimientoNeto = nuevasMes.length - cancelMes.length;
    const emisiones = nuevasMes.length + renovMes.length;

    // Sub-score Crecimiento: basado en % cambio de prima vigente vs mes anterior
    // Si no hay prima en ninguno de los dos meses → null (sin actividad)
    // Si había prima y creció → clamp entre 0-100 (50 = sin cambio, 100 = +100% o más)
    let saludCrecimiento = null;
    if (primaTotalVigente > 0 || primaVigMesAnt > 0) {
      if (primaVigMesAnt === 0) {
        saludCrecimiento = 100; // creció de 0 a algo = excelente
      } else {
        const pctCambio = (deltaPrima / primaVigMesAnt) * 100;
        // Escala: -100% o peor = 0, 0% = 50, +100% o más = 100
        saludCrecimiento = Math.max(0, Math.min(100, 50 + (pctCambio / 2)));
      }
    }

    // Sub-score Renovación: renovadas / debían renovar * 100
    // Nada por renovar → null (sin actividad)
    const saludRenovacion = debianRenovar.length > 0
      ? Math.max(0, Math.min(100, (renovMes.length / debianRenovar.length) * 100))
      : null;

    // Score final: si ambos son null → null (sin actividad)
    // Si solo uno tiene dato → ese vale 100%
    // Si ambos tienen dato → 50/50
    let indiceSalud = null;
    if (saludCrecimiento !== null && saludRenovacion !== null) {
      indiceSalud = Math.round(saludCrecimiento * 0.50 + saludRenovacion * 0.50);
    } else if (saludCrecimiento !== null) {
      indiceSalud = Math.round(saludCrecimiento);
    } else if (saludRenovacion !== null) {
      indiceSalud = Math.round(saludRenovacion);
    }

    // Prima vigente mismo mes año anterior
    const primaVigenteAnioAnt = expedientesFiltrados.filter(e => {
      const tv = (e.fin_vigencia || e.termino_vigencia || '').split('T')[0];
      return tv >= `${anio - 1}-${String(mes + 1).padStart(2, '0')}-28` && !esCancelada(e);
    }).reduce((s, e) => s + getPrima(e), 0);

    // Morosos
    const idsActivos = new Set(expedientesFiltrados.map(e => String(e.id)));
    const recibosMorosos = recibos.filter(r => {
      if (!idsActivos.has(String(r.expediente_id))) return false;
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      const est = (r.estatus || '').toLowerCase();
      return fv && fv < hoyStr && (est === 'pendiente' || est === 'vencido');
    });

    // Gráfica 12 meses
    const datosMensuales = [];
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(anio, mes - i, 1);
      const ym = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const label = MESES_CORTO[fecha.getMonth()] + (fecha.getFullYear() !== anio ? ` ${String(fecha.getFullYear()).slice(2)}` : '');
      const exps = expedientesFiltrados.filter(e => mesExp(e) === ym);
      datosMensuales.push({
        mes: label,
        Nuevas: exps.filter(e => clasificar(e) === 'nueva').length,
        Renovaciones: exps.filter(e => clasificar(e) === 'renovacion').length,
        Cancelaciones: -(exps.filter(e => clasificar(e) === 'cancelacion').length),
      });
    }

    // Dona por ramo
    const distRamo = {};
    vigentes.forEach(e => {
      const ramo = e.producto || e.ramo || 'Sin clasificar';
      if (!distRamo[ramo]) distRamo[ramo] = { nombre: ramo, polizas: 0, prima: 0 };
      distRamo[ramo].polizas++;
      distRamo[ramo].prima += getPrima(e);
    });

    // Tabla pivoteable
    const buildDetalle = (campo) => {
      const grupos = {};
      expedientesFiltrados.forEach(e => {
        let key;
        if (campo === 'producto') key = e.producto || e.ramo || 'Sin producto';
        else if (campo === 'aseguradora') key = e.compania || e.aseguradora || 'Sin aseguradora';
        else key = e.agente || e.vendedor_id || 'Sin agente';
        if (!grupos[key]) grupos[key] = { emitidas: 0, porVencer: 0, renovadas: 0, canceladas: 0, prima: 0, total: 0, _debianRenovar: 0 };
        const g = grupos[key];
        const tv = (e.fin_vigencia || e.termino_vigencia || '').split('T')[0];
        const esVig = tv >= hoyStr && !esCancelada(e);
        if (esVig) { g.total++; g.prima += getPrima(e); }
        const ym = mesExp(e);
        if (ym === ymActual) {
          const tipo = clasificar(e);
          if (tipo === 'nueva' || tipo === 'renovacion') g.emitidas++;
          if (tipo === 'renovacion') g.renovadas++;
          if (tipo === 'cancelacion') g.canceladas++;
        }
        if (toYM(e.fin_vigencia || e.termino_vigencia) === ymActual && !esCancelada(e)) { g.porVencer++; g._debianRenovar++; }
      });
      return Object.entries(grupos).map(([nombre, d]) => ({
        nombre, ...d,
        pctCartera: carteraVigente > 0 ? ((d.total / carteraVigente) * 100).toFixed(1) : '0.0',
        pctRetencion: d._debianRenovar > 0 ? ((d.renovadas / d._debianRenovar) * 100).toFixed(0) : '—',
      })).filter(d => d.total > 0 || d.emitidas > 0 || d.canceladas > 0).sort((a, b) => b.prima - a.prima);
    };

    // Alertas
    const porVencer30 = expedientesFiltrados.filter(e => {
      const tv = e.fin_vigencia || e.termino_vigencia;
      if (!tv) return false;
      const diff = (new Date(tv) - hoyDate) / 864e5;
      return diff >= 0 && diff <= 30 && !esCancelada(e);
    }).sort((a, b) => getPrima(b) - getPrima(a));

    const cancelPorCliente = {};
    expedientesFiltrados.filter(esCancelada).forEach(e => {
      const cid = e.cliente_id || 'sin-id';
      const nombre = [e.nombre, e.apellido_paterno, e.apellido_materno].filter(Boolean).join(' ') || e.asegurado || 'Sin nombre';
      if (!cancelPorCliente[cid]) cancelPorCliente[cid] = { nombre, cancelaciones: 0, polizas: [] };
      cancelPorCliente[cid].cancelaciones++;
      cancelPorCliente[cid].polizas.push(e);
    });
    const clientesConCancelMultiple = Object.values(cancelPorCliente).filter(c => c.cancelaciones >= 2).sort((a, b) => b.cancelaciones - a.cancelaciones);

    return {
      nuevasMes: nuevasMes.length, nuevasAnt: nuevasAnt.length,
      renovMes: renovMes.length, renovAnt: renovAnt.length,
      cancelMes: cancelMes.length, cancelAnt: cancelAnt.length,
      crecimientoNeto, emisiones, tasaRetencion,
      tasaRetencionAnt: tasaRetencionAnt !== null ? parseFloat(tasaRetencionAnt) : null,
      indiceSalud,
      saludCrecimiento: saludCrecimiento !== null ? Math.round(saludCrecimiento) : null,
      saludRenovacion: saludRenovacion !== null ? Math.round(saludRenovacion) : null,
      carteraVigente, primaTotalVigente,
      primaVigMesAnt, polizasVigMesAnt,
      deltaPrima, pctCrecimientoPrima: parseFloat(pctCrecimientoPrima), deltaPolizas,
      primaVigenteAnioAnt,
      debianRenovar: debianRenovar.length,
      cancelEnVigor, cancelEnRenovacion: cancelMes.length - cancelEnVigor,
      recibosMorosos: recibosMorosos.length,
      montoMoroso: recibosMorosos.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0),
      datosMensuales,
      datosRamo: Object.values(distRamo).sort((a, b) => b.polizas - a.polizas),
      buildDetalle, porVencer30, clientesConCancelMultiple,
    };
  }, [expedientesFiltrados, recibos, mes, anio]);

  const sinActividad = data.indiceSalud === null;
  const colorSalud = sinActividad ? '#6c757d' : data.indiceSalud >= 75 ? '#198754' : data.indiceSalud >= 50 ? '#ffc107' : '#dc3545';
  const emojiSalud = sinActividad ? '⏸️' : data.indiceSalud >= 75 ? '🟢' : data.indiceSalud >= 50 ? '🟡' : '🔴';
  const textoSalud = sinActividad ? 'Sin actividad' : data.indiceSalud >= 75 ? 'Saludable' : data.indiceSalud >= 50 ? 'Atención' : 'Crítico';
  const detalle = useMemo(() => data.buildDetalle(vistaDetalle), [data, vistaDetalle]);

  const CustomBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white shadow rounded p-2 border" style={{ fontSize: '0.8em' }}>
        <strong>{label}</strong>
        {payload.map((entry, i) => (
          <div key={i} style={{ color: entry.color }}>
            {entry.name}: {entry.name === 'Cancelaciones' ? Math.abs(entry.value) : entry.value}
          </div>
        ))}
      </div>
    );
  };

  // ═══ RENDER ═══
  return (
    <div className="p-4" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <ShieldCheck size={28} className="text-primary" />
          <div>
            <h4 className="mb-0 fw-bold">Salud de Cartera</h4>
            <small className="text-muted">¿Cuánto retenemos? ¿Cuánto crecemos?</small>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-outline-primary btn-sm" onClick={cargarDatos} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtros globales */}
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        <Filter size={14} className="text-muted" />
        <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 140 }} value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}>
          <option value="todos">Todos los ramos</option>
          {opcionesFiltro.ramos.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 150 }} value={filtroAseguradora} onChange={e => setFiltroAseguradora(e.target.value)}>
          <option value="todos">Todas las aseguradoras</option>
          {opcionesFiltro.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 130 }} value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)}>
          <option value="todos">Todos los agentes</option>
          {opcionesFiltro.agentes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(filtroRamo !== 'todos' || filtroAseguradora !== 'todos' || filtroAgente !== 'todos') && (
          <button className="btn btn-outline-secondary btn-sm" onClick={() => { setFiltroRamo('todos'); setFiltroAseguradora('todos'); setFiltroAgente('todos'); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /><p className="mt-2 text-muted">Analizando cartera...</p></div>
      ) : (
        <>
          {/* ═══ FILA 1: 5 TARJETAS ═══ */}
          <div className="row g-3 mb-4">

            {/* 1. Crecimiento del Mes */}
            <div className="col-xl col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ borderTop: `3px solid ${data.deltaPrima >= 0 ? '#198754' : '#dc3545'}` }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-1 mb-2">
                    <TrendingUp size={16} style={{ color: data.deltaPrima >= 0 ? '#198754' : '#dc3545' }} />
                    <small className="text-muted fw-semibold">Crecimiento del Mes</small>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: data.deltaPrima >= 0 ? '#198754' : '#dc3545', lineHeight: 1 }}>
                    {data.deltaPrima >= 0 ? '+' : ''}{fmt(data.deltaPrima)}
                  </div>
                  <small className="text-muted d-block mb-1">
                    en prima vigente (de {fmt(data.primaVigMesAnt)} → {fmt(data.primaTotalVigente)})
                  </small>
                  <div className="d-flex align-items-center gap-1 mb-1" style={{ fontSize: '0.75em' }}>
                    <span className="text-muted">vs mes anterior:</span>
                    <span style={{ fontWeight: 'bold', color: data.pctCrecimientoPrima >= 0 ? '#198754' : '#dc3545' }}>
                      {data.pctCrecimientoPrima >= 0 ? '+' : ''}{data.pctCrecimientoPrima}%
                    </span>
                    {data.pctCrecimientoPrima > 0 ? ' 🟢' : data.pctCrecimientoPrima < 0 ? ' 🔴' : ''}
                  </div>
                  <small className="text-muted d-block" style={{ fontSize: '0.75em' }}>
                    {data.carteraVigente} pólizas vigentes ({data.deltaPolizas >= 0 ? '+' : ''}{data.deltaPolizas} vs mes ant.)
                  </small>
                </div>
              </div>
            </div>

            {/* 2. Retención */}
            <div className="col-xl col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ borderTop: '3px solid #0d6efd' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-1 mb-2">
                    <CheckCircle2 size={16} className="text-primary" />
                    <small className="text-muted fw-semibold">Retención del Mes</small>
                  </div>
                  {data.tasaRetencion !== null ? (
                    <>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#333', lineHeight: 1.4 }}>
                        {data.renovMes} renovadas de {data.debianRenovar} que vencían
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span style={{
                          fontSize: '2rem', fontWeight: 'bold', lineHeight: 1,
                          color: parseFloat(data.tasaRetencion) >= 80 ? '#198754' : parseFloat(data.tasaRetencion) >= 60 ? '#ffc107' : '#dc3545'
                        }}>
                          {data.tasaRetencion}%
                        </span>
                        <span style={{ fontSize: '0.85em' }}>de retención</span>
                        <Semaforo valor={parseFloat(data.tasaRetencion)} umbrales={[60, 80]} />
                      </div>
                      <VsAnterior actual={parseFloat(data.tasaRetencion)} anterior={data.tasaRetencionAnt} esPct />
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#6c757d', lineHeight: 1 }}>—</div>
                      <small className="text-muted d-block">Sin vencimientos este mes</small>
                      {data.renovMes > 0 && <small className="text-muted">{data.renovMes} renovaciones registradas</small>}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Cancelaciones */}
            <div className="col-xl col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ borderTop: '3px solid #dc3545' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-1 mb-2">
                    <XCircle size={16} className="text-danger" />
                    <small className="text-muted fw-semibold">Cancelaciones del Mes</small>
                  </div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#dc3545', lineHeight: 1 }}>{data.cancelMes}</div>
                  <small className="text-muted d-block">cancelaciones</small>
                  <VsAnterior actual={data.cancelMes} anterior={data.cancelAnt > 0 ? data.cancelAnt : null} invertir />
                  {data.cancelMes > 0 && (
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75em' }}>
                      Desglose: {data.cancelEnVigor} en vigor / {data.cancelEnRenovacion} en renovación
                    </small>
                  )}
                </div>
              </div>
            </div>

            {/* 4. % Salud */}
            <div className="col-xl col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-3 text-center">
                  <div className="d-flex align-items-center justify-content-center gap-1 mb-2">
                    <Activity size={16} style={{ color: colorSalud }} />
                    <small className="text-muted fw-semibold">% Salud de Cartera</small>
                  </div>
                  <div className="d-flex align-items-center justify-content-center gap-2">
                    <span>{emojiSalud}</span>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: colorSalud, lineHeight: 1 }}>
                      {sinActividad ? '—' : `${data.indiceSalud}%`}
                    </span>
                  </div>
                  {/* Sub-scores */}
                  <div className="d-flex justify-content-center gap-3 mt-2 mb-1" style={{ fontSize: '0.75em' }}>
                    <div>
                      <span className="text-muted">Crecimiento </span>
                      {data.saludCrecimiento !== null ? (
                        <span className="fw-bold" style={{ color: data.saludCrecimiento >= 75 ? '#198754' : data.saludCrecimiento >= 50 ? '#ffc107' : '#dc3545' }}>
                          {data.saludCrecimiento}%
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </div>
                    <div style={{ borderLeft: '1px solid #dee2e6', paddingLeft: 12 }}>
                      <span className="text-muted">Renovación </span>
                      {data.saludRenovacion !== null ? (
                        <span className="fw-bold" style={{ color: data.saludRenovacion >= 75 ? '#198754' : data.saludRenovacion >= 50 ? '#ffc107' : '#dc3545' }}>
                          {data.saludRenovacion}%
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </div>
                  </div>
                  <div className="progress mx-auto" style={{ height: '6px', maxWidth: 150 }}>
                    <div className="progress-bar" style={{ width: `${data.indiceSalud || 0}%`, backgroundColor: colorSalud }} />
                  </div>
                  <span className="badge rounded-pill mt-1" style={{ backgroundColor: colorSalud, fontSize: '0.7em' }}>{textoSalud}</span>
                </div>
              </div>
            </div>

            {/* 5. Prima Vigente */}
            <div className="col-xl col-md-6">
              <div className="card border-0 shadow-sm h-100" style={{ borderTop: '3px solid #6f42c1' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-1 mb-2">
                    <span style={{ color: '#6f42c1', fontSize: '1.1em' }}>$</span>
                    <small className="text-muted fw-semibold">Prima Vigente Total</small>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#6f42c1', lineHeight: 1 }}>{fmt(data.primaTotalVigente)}</div>
                  <small className="text-muted d-block mb-1">en cartera activa ({data.carteraVigente} pólizas)</small>
                  <VsAnterior actual={data.primaTotalVigente} anterior={data.primaVigenteAnioAnt > 0 ? data.primaVigenteAnioAnt : null} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ FILA 2: GRÁFICAS ═══ */}
          <div className="row g-3 mb-4">
            {/* Barras 12 meses */}
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3">
                  <h6 className="mb-0 fw-bold"><TrendingUp size={16} className="me-2 text-success" />Tendencia 12 Meses</h6>
                </div>
                <div className="card-body p-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.datosMensuales} stackOffset="sign" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomBarTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '0.8em' }} />
                      <Bar dataKey="Nuevas" stackId="a" fill="#198754" radius={[2,2,0,0]} />
                      <Bar dataKey="Renovaciones" stackId="a" fill="#0d6efd" radius={[2,2,0,0]} />
                      <Bar dataKey="Cancelaciones" stackId="a" fill="#dc3545" radius={[0,0,2,2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Dona por ramo */}
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3">
                  <h6 className="mb-0 fw-bold"><PieChart size={16} className="me-2 text-info" />Distribución por Ramo (Vigentes)</h6>
                </div>
                <div className="card-body p-2 d-flex align-items-center">
                  {data.datosRamo.length === 0 ? (
                    <div className="text-center w-100 text-muted py-4">Sin pólizas vigentes</div>
                  ) : (
                    <div className="d-flex w-100 align-items-center">
                      <ResponsiveContainer width="55%" height={260}>
                        <RePieChart>
                          <Pie data={data.datosRamo} cx="50%" cy="50%" innerRadius={55} outerRadius={100} dataKey="polizas" nameKey="nombre" paddingAngle={2}>
                            {data.datosRamo.map((_, idx) => <Cell key={idx} fill={COLORES_RAMO[idx % COLORES_RAMO.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v, n) => [`${v} pólizas`, n]} contentStyle={{ fontSize: '0.8em' }} />
                        </RePieChart>
                      </ResponsiveContainer>
                      <div style={{ width: '45%', fontSize: '0.8em' }}>
                        {data.datosRamo.map((ramo, idx) => (
                          <div key={idx} className="d-flex align-items-center gap-2 mb-1">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORES_RAMO[idx % COLORES_RAMO.length], flexShrink: 0 }} />
                            <span className="text-truncate" style={{ maxWidth: 120 }}>{ramo.nombre}</span>
                            <span className="fw-semibold ms-auto">{ramo.polizas}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ FILA 3: TABLA PIVOTEABLE ═══ */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h6 className="mb-0 fw-bold"><Package size={16} className="me-2 text-primary" />Detalle del Mes — {MESES[mes]} {anio}</h6>
                <div className="btn-group btn-group-sm">
                  {[{ key: 'producto', label: 'Producto', icon: Package },
                    { key: 'aseguradora', label: 'Aseguradora', icon: Building2 },
                    { key: 'agente', label: 'Agente', icon: UserCheck }
                  ].map(({ key, label, icon: Icon }) => (
                    <button key={key} className={`btn ${vistaDetalle === key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setVistaDetalle(key)}>
                      <Icon size={14} className="me-1" />{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="card-body p-0">
              {detalle.length === 0 ? (
                <div className="text-center py-4 text-muted">Sin datos para este período</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ fontSize: '0.8em' }}>{vistaDetalle === 'producto' ? 'Producto' : vistaDetalle === 'aseguradora' ? 'Aseguradora' : 'Agente'}</th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}>Emitidas</th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}>% Cartera</th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}>Por Vencer</th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}><span className="text-primary">Renovadas</span></th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}>% Retención</th>
                        <th className="text-center" style={{ fontSize: '0.8em' }}><span className="text-danger">Canceladas</span></th>
                        <th className="text-end" style={{ fontSize: '0.8em' }}>Prima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.map((row, idx) => (
                        <tr key={idx}>
                          <td className="fw-semibold" style={{ fontSize: '0.85em' }}>{row.nombre.length > 40 ? row.nombre.slice(0, 40) + '...' : row.nombre}</td>
                          <td className="text-center">{row.emitidas > 0 ? <span className="badge bg-success">{row.emitidas}</span> : <span className="text-muted">0</span>}</td>
                          <td className="text-center" style={{ fontSize: '0.85em' }}>{row.pctCartera}%</td>
                          <td className="text-center">{row.porVencer > 0 ? <span className="badge bg-warning text-dark">{row.porVencer}</span> : <span className="text-muted">0</span>}</td>
                          <td className="text-center">{row.renovadas > 0 ? <span className="badge bg-primary">{row.renovadas}</span> : <span className="text-muted">0</span>}</td>
                          <td className="text-center">
                            {row.pctRetencion === '—' ? <span className="text-muted">—</span> : (
                              <span className="d-inline-flex align-items-center gap-1">
                                <span style={{ color: parseFloat(row.pctRetencion) >= 80 ? '#198754' : parseFloat(row.pctRetencion) >= 60 ? '#ffc107' : '#dc3545', fontWeight: 'bold' }}>
                                  {row.pctRetencion}%
                                </span>
                                <Semaforo valor={parseFloat(row.pctRetencion)} umbrales={[60, 80]} />
                              </span>
                            )}
                          </td>
                          <td className="text-center">{row.canceladas > 0 ? <span className="badge bg-danger">{row.canceladas}</span> : <span className="text-muted">0</span>}</td>
                          <td className="text-end" style={{ fontSize: '0.85em' }}>{fmt(row.prima)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr className="fw-bold">
                        <td>Total</td>
                        <td className="text-center text-success">{detalle.reduce((s, r) => s + r.emitidas, 0)}</td>
                        <td className="text-center">100%</td>
                        <td className="text-center text-warning">{detalle.reduce((s, r) => s + r.porVencer, 0)}</td>
                        <td className="text-center text-primary">{detalle.reduce((s, r) => s + r.renovadas, 0)}</td>
                        <td className="text-center">{data.tasaRetencion !== null ? <span>{data.tasaRetencion}%</span> : '—'}</td>
                        <td className="text-center text-danger">{detalle.reduce((s, r) => s + r.canceladas, 0)}</td>
                        <td className="text-end">{fmt(detalle.reduce((s, r) => s + r.prima, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ═══ FILA 4: ALERTAS ACCIONABLES ═══ */}
          <div className="row g-3">
            {/* Vencimientos próximos 30 días */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold"><AlertTriangle size={16} className="me-2 text-warning" />Vencimientos Próximos 30 Días</h6>
                  {data.porVencer30.length > 0 && <span className="badge bg-warning text-dark">{data.porVencer30.length}</span>}
                </div>
                <div className="card-body p-0" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {data.porVencer30.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <CheckCircle2 size={28} className="text-success opacity-50 mb-2" />
                      <p className="mb-0" style={{ fontSize: '0.9em' }}>Sin vencimientos próximos</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {data.porVencer30.map((exp, idx) => {
                        const tv = exp.fin_vigencia || exp.termino_vigencia;
                        const dias = Math.ceil((new Date(tv) - new Date()) / 864e5);
                        const nombre = [exp.nombre, exp.apellido_paterno].filter(Boolean).join(' ') || exp.asegurado || 'Sin nombre';
                        return (
                          <div key={idx} className="list-group-item px-3 py-2">
                            <div className="d-flex justify-content-between align-items-start">
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="fw-semibold text-truncate" style={{ fontSize: '0.85em' }}>{exp.numero_poliza || `Exp. ${exp.id}`}</div>
                                <small className="text-muted text-truncate d-block">{nombre} — {exp.compania || exp.aseguradora || ''}</small>
                                <small className="fw-semibold" style={{ color: '#198754' }}>{fmt(getPrima(exp))}</small>
                              </div>
                              <span className={`badge ms-2 ${dias <= 7 ? 'bg-danger' : dias <= 15 ? 'bg-warning text-dark' : 'bg-secondary'}`}>{dias}d</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {data.porVencer30.length > 0 && (
                  <div className="card-footer bg-light text-center" style={{ fontSize: '0.75em' }}>Ordenados por prima (mayor a menor)</div>
                )}
              </div>
            </div>

            {/* Clientes con cancelaciones múltiples */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold"><Ban size={16} className="me-2 text-danger" />Cancelaciones Múltiples por Cliente</h6>
                  {data.clientesConCancelMultiple.length > 0 && <span className="badge bg-danger">{data.clientesConCancelMultiple.length}</span>}
                </div>
                <div className="card-body p-0" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {data.clientesConCancelMultiple.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <CheckCircle2 size={28} className="text-success opacity-50 mb-2" />
                      <p className="mb-0" style={{ fontSize: '0.9em' }}>Sin clientes con cancelaciones repetidas</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {data.clientesConCancelMultiple.map((cliente, idx) => (
                        <div key={idx} className="list-group-item px-3 py-2">
                          <div className="d-flex justify-content-between align-items-start">
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="fw-semibold" style={{ fontSize: '0.85em' }}>{cliente.nombre}</div>
                              <small className="text-muted d-block">{cliente.polizas.map(p => p.numero_poliza || `Exp.${p.id}`).join(', ')}</small>
                            </div>
                            <span className="badge bg-danger ms-2">{cliente.cancelaciones} cancel.</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {data.clientesConCancelMultiple.length > 0 && (
                  <div className="card-footer bg-light text-center" style={{ fontSize: '0.75em' }}>Clientes con 2+ cancelaciones — atención de retención urgente</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SaludCartera;
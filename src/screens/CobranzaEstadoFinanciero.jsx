import React, { useState, useEffect, useMemo } from 'react';
import { HandCoins, DollarSign, AlertTriangle, CheckCircle2, Clock, RefreshCw, Filter, TrendingUp, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const CobranzaEstadoFinanciero = () => {
  const [loading, setLoading] = useState(false);
  const [recibos, setRecibos] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroRapido, setFiltroRapido] = useState('mes-actual');
  const [seccionAbierta, setSeccionAbierta] = useState(null); // 'pagados' | 'pendientes' | 'vencidos'

  const aplicarFiltroRapido = (tipo) => {
    const hoy = new Date();
    let inicio, fin;
    switch (tipo) {
      case 'hoy':
        inicio = fin = hoy.toISOString().split('T')[0];
        break;
      case 'semana': {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
        inicio = inicioSemana.toISOString().split('T')[0];
        fin = hoy.toISOString().split('T')[0];
        break;
      }
      case 'mes-actual':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        fin = hoy.toISOString().split('T')[0];
        break;
      case 'mes-anterior':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().split('T')[0];
        fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0];
        break;
      default: return;
    }
    setFiltroRapido(tipo);
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ss_token');
      const [recibosRes, expedientesRes] = await Promise.all([
        fetch(`${API_URL}/api/recibos`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/expedientes`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
      ]);
      if (!recibosRes.ok) throw new Error('Error al cargar recibos');
      const recibosData = await recibosRes.json();
      setRecibos(Array.isArray(recibosData) ? recibosData : []);

      if (expedientesRes && expedientesRes.ok) {
        const expData = await expedientesRes.json();
        setExpedientes(Array.isArray(expData) ? expData : []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos de cobranza');
      setRecibos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Mapa expediente_id → info del expediente
  const expedienteMap = useMemo(() => {
    const map = {};
    expedientes.forEach(exp => { map[exp.id] = exp; });
    return map;
  }, [expedientes]);

  // Solo recibos de expedientes que existen (ignorar huérfanos de pólizas eliminadas)
  const recibosActivos = useMemo(() => {
    if (expedientes.length === 0) return []; // Aún no cargan los expedientes
    const idsActivos = new Set(expedientes.map(e => String(e.id)));
    return recibos.filter(r => idsActivos.has(String(r.expediente_id)));
  }, [recibos, expedientes]);

  // ===== LÓGICA CORREGIDA DE KPIs =====
  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().split('T')[0];

    // ── COBRADO EN EL PERÍODO ──
    // Recibos cuyo fecha_pago_real cae dentro del rango seleccionado.
    // Esto refleja cuánto dinero realmente se cobró en el período,
    // independientemente de cuándo vencía el recibo.
    const pagados = recibosActivos.filter(r => {
      const fp = r.fecha_pago_real ? r.fecha_pago_real.split('T')[0] : null;
      if (!fp) return false;
      return fp >= fechaInicio && fp <= fechaFin;
    });

    // ── CARTERA VENCIDA (ACUMULADA) ──
    // TODOS los recibos que están vencidos y no pagados hasta la fecha de corte.
    // Esto es acumulativo: incluye deuda de meses anteriores que sigue sin pagarse.
    const vencidos = recibosActivos.filter(r => {
      // Si ya tiene fecha_pago_real, no es deuda pendiente
      if (r.fecha_pago_real) return false;
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      if (!fv) return false;
      // Vencido = fecha de vencimiento ya pasó (hasta la fecha de corte del filtro)
      const estaVencido = (r.estatus || '').toLowerCase() === 'vencido';
      const vencioAntesDeFin = fv <= fechaFin;
      // Usar estatus del backend si dice Vencido, o si la fecha ya pasó y no está pagado
      return (estaVencido || fv < hoy) && vencioAntesDeFin;
    });

    // ── PENDIENTE POR COBRAR ──
    // Recibos sin pagar cuyo vencimiento cae dentro del período seleccionado
    // y que aún no están vencidos (fecha_vencimiento >= hoy).
    const pendientes = recibosActivos.filter(r => {
      if (r.fecha_pago_real) return false; // Ya pagado
      const est = (r.estatus || '').toLowerCase();
      if (est === 'pagado') return false;
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      if (!fv) return false;
      // Solo los que vencen dentro del período y aún no están vencidos
      const enPeriodo = fv >= fechaInicio && fv <= fechaFin;
      const noVencido = est !== 'vencido' && fv >= hoy;
      return enPeriodo && noVencido;
    });

    const montoPagado = pagados.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoVencido = vencidos.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoPendiente = pendientes.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoSinCobrar = montoVencido + montoPendiente;

    // ── % COBRANZA DEL PERÍODO ──
    // De los recibos que vencían en el rango de fechas, qué porcentaje
    // (en monto) ya se cobró. Responde: "¿qué tan bien cobramos lo que debíamos cobrar?"
    const recibosDelPeriodo = recibosActivos.filter(r => {
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      return fv && fv >= fechaInicio && fv <= fechaFin;
    });
    const montoPagadoPeriodo = recibosDelPeriodo
      .filter(r => !!r.fecha_pago_real)
      .reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoTotalPeriodo = recibosDelPeriodo.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const porcentajeCobranza = montoTotalPeriodo > 0
      ? ((montoPagadoPeriodo / montoTotalPeriodo) * 100).toFixed(1)
      : 0;

    return {
      pagados, vencidos, pendientes,
      montoPagado, montoVencido, montoPendiente, montoSinCobrar,
      montoPagadoPeriodo, montoTotalPeriodo,
      recibosDelPeriodo: recibosDelPeriodo.length,
      porcentajeCobranza
    };
  }, [recibosActivos, fechaInicio, fechaFin]);

  const formatMoney = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

  const formatFecha = (fecha) => {
    if (!fecha) return '—';
    // Agregar T12:00 para evitar desfase de zona horaria al parsear fechas YYYY-MM-DD
    const d = new Date(fecha + (fecha.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getNombreTitular = (expedienteId) => {
    const exp = expedienteMap[expedienteId];
    if (!exp) return `Exp. ${expedienteId}`;
    const nombre = exp.nombre || '';
    const ap = exp.apellido_paterno || '';
    const razon = exp.razon_social || '';
    return razon || `${nombre} ${ap}`.trim() || `Exp. ${expedienteId}`;
  };

  const getInfoExpediente = (expedienteId) => {
    const exp = expedienteMap[expedienteId];
    return exp || {};
  };

  const toggleSeccion = (seccion) => {
    setSeccionAbierta(prev => prev === seccion ? null : seccion);
  };

  // Tabla de detalle de recibos
  const TablaDetalleRecibos = ({ recibosLista, titulo, colorClase }) => {
    if (!recibosLista || recibosLista.length === 0) return null;
    // Agrupar por expediente
    const agrupados = {};
    recibosLista.forEach(r => {
      const key = r.expediente_id;
      if (!agrupados[key]) agrupados[key] = [];
      agrupados[key].push(r);
    });

    const expedientesOrdenados = Object.keys(agrupados).sort((a, b) => {
      const fechaA = agrupados[a][0]?.fecha_vencimiento || '';
      const fechaB = agrupados[b][0]?.fecha_vencimiento || '';
      return fechaA.localeCompare(fechaB);
    });

    return (
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-bottom py-3">
          <h6 className={`mb-0 fw-bold ${colorClase}`}>
            <FileText size={16} className="me-2" />
            {titulo} ({recibosLista.length} recibos de {expedientesOrdenados.length} pólizas)
          </h6>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.85em' }}>
              <thead className="table-light">
                <tr>
                  <th>Expediente</th>
                  <th>Titular / Razón Social</th>
                  <th>Aseguradora</th>
                  <th>No. Póliza</th>
                  <th className="text-center">Recibo #</th>
                  <th>Vencimiento</th>
                  <th className="text-end">Monto</th>
                  <th className="text-center">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {expedientesOrdenados.map(expId => {
                  const recibosExp = agrupados[expId];
                  const exp = getInfoExpediente(expId);
                  return recibosExp.map((r, idx) => (
                    <tr key={r.id}>
                      {idx === 0 && (
                        <>
                          <td rowSpan={recibosExp.length} className="align-middle fw-semibold">{expId}</td>
                          <td rowSpan={recibosExp.length} className="align-middle">{getNombreTitular(expId)}</td>
                          <td rowSpan={recibosExp.length} className="align-middle">{exp.compania || '—'}</td>
                          <td rowSpan={recibosExp.length} className="align-middle">{exp.numero_poliza || '—'}</td>
                        </>
                      )}
                      <td className="text-center">{r.numero_recibo}</td>
                      <td>{formatFecha(r.fecha_vencimiento)}</td>
                      <td className="text-end fw-semibold">{formatMoney(parseFloat(r.monto) || 0)}</td>
                      <td className="text-center">
                        <span className={`badge ${
                          (r.estatus || '').toLowerCase() === 'pagado' ? 'bg-success' :
                          (r.estatus || '').toLowerCase() === 'vencido' ? 'bg-danger' :
                          'bg-warning text-dark'
                        }`}>
                          {r.estatus}
                        </span>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-2">
          <HandCoins size={28} className="text-primary" />
          <div>
            <h4 className="mb-0 fw-bold">Cobranza y Estado Financiero</h4>
            <small className="text-muted">Seguimiento de cobranza y recibos del período</small>
          </div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={cargarDatos} disabled={loading}>
          <RefreshCw size={16} className={`me-1 ${loading ? 'spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div className="d-flex align-items-center gap-1">
              <Filter size={16} className="text-muted" />
              <span className="fw-semibold text-muted" style={{ fontSize: '0.85em' }}>Período:</span>
            </div>
            <div className="btn-group btn-group-sm">
              {[
                { key: 'hoy', label: 'Hoy' },
                { key: 'semana', label: 'Esta Semana' },
                { key: 'mes-actual', label: 'Mes Actual' },
                { key: 'mes-anterior', label: 'Mes Anterior' }
              ].map(f => (
                <button key={f.key} className={`btn ${filtroRapido === f.key ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => aplicarFiltroRapido(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              <input type="date" className="form-control form-control-sm" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setFiltroRapido('custom'); }} style={{ width: '150px' }} />
              <span className="text-muted">a</span>
              <input type="date" className="form-control form-control-sm" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setFiltroRapido('custom'); }} style={{ width: '150px' }} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2 text-muted">Cargando datos de cobranza...</p>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div className="row g-3 mb-4">
            {/* Cobrado */}
            <div className="col-md-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#198754', cursor: 'pointer' }}
                onClick={() => toggleSeccion('pagados')}
              >
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Cobrado en el período</span>
                    <CheckCircle2 size={18} className="text-success" />
                  </div>
                  <h4 className="mb-0 fw-bold text-success">{formatMoney(kpis.montoPagado)}</h4>
                  <small className="text-muted">{kpis.pagados.length} recibos cobrados</small>
                  <div className="text-end">
                    {seccionAbierta === 'pagados' ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>
              </div>
            </div>
            {/* Pendiente */}
            <div className="col-md-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#ffc107', cursor: 'pointer' }}
                onClick={() => toggleSeccion('pendientes')}
              >
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Pendiente por cobrar</span>
                    <Clock size={18} className="text-warning" />
                  </div>
                  <h4 className="mb-0 fw-bold text-warning">{formatMoney(kpis.montoPendiente)}</h4>
                  <small className="text-muted">{kpis.pendientes.length} recibos por cobrar</small>
                  <div className="text-end">
                    {seccionAbierta === 'pendientes' ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>
              </div>
            </div>
            {/* Vencido */}
            <div className="col-md-3">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#dc3545', cursor: 'pointer' }}
                onClick={() => toggleSeccion('vencidos')}
              >
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Cartera vencida (acumulada)</span>
                    <AlertTriangle size={18} className="text-danger" />
                  </div>
                  <h4 className="mb-0 fw-bold text-danger">{formatMoney(kpis.montoVencido)}</h4>
                  <small className="text-muted">{kpis.vencidos.length} recibos sin cobrar</small>
                  <div className="text-end">
                    {seccionAbierta === 'vencidos' ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>
              </div>
            </div>
            {/* % Cobranza */}
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100" style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#0d6efd' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>% Cobranza del período</span>
                    <TrendingUp size={18} className="text-primary" />
                  </div>
                  <h4 className="mb-0 fw-bold text-primary">{kpis.porcentajeCobranza}%</h4>
                  <small className="text-muted">{formatMoney(kpis.montoPagadoPeriodo)} de {formatMoney(kpis.montoTotalPeriodo)} ({kpis.recibosDelPeriodo} recibos)</small>
                </div>
              </div>
            </div>
          </div>

          {/* Detalle expandible según tarjeta clickeada */}
          {seccionAbierta === 'pagados' && (
            <TablaDetalleRecibos
              recibosLista={kpis.pagados}
              titulo="Recibos Cobrados en el Período (por fecha de pago)"
              colorClase="text-success"
            />
          )}
          {seccionAbierta === 'pendientes' && (
            <TablaDetalleRecibos
              recibosLista={kpis.pendientes}
              titulo="Recibos Pendientes por Cobrar"
              colorClase="text-warning"
            />
          )}
          {seccionAbierta === 'vencidos' && (
            <TablaDetalleRecibos
              recibosLista={kpis.vencidos}
              titulo="Cartera Vencida Acumulada (toda la deuda atrasada)"
              colorClase="text-danger"
            />
          )}

          {/* Barra de progreso visual */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Estado General de Cobranza del Período</h6>
              <small className="text-muted d-block mb-2">
                Recibos con vencimiento entre {formatFecha(fechaInicio)} y {formatFecha(fechaFin)}
              </small>
              {(() => {
                const total = kpis.recibosDelPeriodo;
                if (total === 0) return <div className="text-center text-muted mt-2">Sin recibos en el período seleccionado</div>;
                // Contar por estatus dentro de los recibos del período
                const recsPeriodo = recibosActivos.filter(r => {
                  const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
                  return fv && fv >= fechaInicio && fv <= fechaFin;
                });
                const pagPeriodo = recsPeriodo.filter(r => (r.estatus || '').toLowerCase() === 'pagado').length;
                const venPeriodo = recsPeriodo.filter(r => (r.estatus || '').toLowerCase() === 'vencido').length;
                const penPeriodo = recsPeriodo.filter(r => (r.estatus || '').toLowerCase() === 'pendiente').length;
                return (
                  <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                    <div className="progress-bar bg-success" style={{ width: `${(pagPeriodo / total) * 100}%` }}>
                      {pagPeriodo > 0 && `${pagPeriodo} Pagados`}
                    </div>
                    <div className="progress-bar bg-warning" style={{ width: `${(penPeriodo / total) * 100}%` }}>
                      {penPeriodo > 0 && `${penPeriodo} Pendientes`}
                    </div>
                    <div className="progress-bar bg-danger" style={{ width: `${(venPeriodo / total) * 100}%` }}>
                      {venPeriodo > 0 && `${venPeriodo} Vencidos`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="mb-0 fw-bold">
                <DollarSign size={16} className="me-2 text-primary" />
                Resumen Financiero del Período
              </h6>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table mb-0">
                  <tbody>
                    <tr>
                      <td className="fw-semibold">Total cobrado en el período (por fecha de pago real)</td>
                      <td className="text-end fw-bold text-success">{formatMoney(kpis.montoPagado)}</td>
                    </tr>
                    <tr className="table-light">
                      <td className="fw-semibold" colSpan={2}>Deuda pendiente al corte ({formatFecha(fechaFin)})</td>
                    </tr>
                    <tr className="table-danger">
                      <td className="fw-semibold text-danger ps-4">Cartera vencida acumulada ({kpis.vencidos.length} recibos)</td>
                      <td className="text-end fw-bold text-danger">{formatMoney(kpis.montoVencido)}</td>
                    </tr>
                    <tr className="table-warning">
                      <td className="fw-semibold text-warning ps-4">Pendiente por cobrar ({kpis.pendientes.length} recibos)</td>
                      <td className="text-end fw-bold text-warning">{formatMoney(kpis.montoPendiente)}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #dee2e6' }}>
                      <td className="fw-bold">Total sin cobrar</td>
                      <td className="text-end fw-bold">{formatMoney(kpis.montoSinCobrar)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CobranzaEstadoFinanciero;

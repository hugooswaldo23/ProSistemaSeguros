import React, { useState, useEffect, useMemo } from 'react';
import { HandCoins, Calendar, DollarSign, AlertTriangle, CheckCircle2, Clock, RefreshCw, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const CobranzaEstadoFinanciero = () => {
  const [loading, setLoading] = useState(false);
  const [recibos, setRecibos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroRapido, setFiltroRapido] = useState('mes-actual');

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
      // Intentar cargar recibos de todos los expedientes
      const response = await fetch(`${API_URL}/api/recibos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar recibos');
      const data = await response.json();
      setRecibos(Array.isArray(data) ? data : []);
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

  // Filtrar recibos por rango
  const recibosFiltrados = useMemo(() => {
    return recibos.filter(r => {
      const fecha = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      if (!fecha) return false;
      return fecha >= fechaInicio && fecha <= fechaFin;
    });
  }, [recibos, fechaInicio, fechaFin]);

  // KPIs de cobranza
  const kpis = useMemo(() => {
    const pagados = recibosFiltrados.filter(r => 
      (r.estatus || '').toLowerCase() === 'pagado'
    );
    const pendientes = recibosFiltrados.filter(r => 
      (r.estatus || '').toLowerCase() === 'pendiente'
    );
    const hoy = new Date().toISOString().split('T')[0];
    const vencidos = pendientes.filter(r => {
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      return fv && fv < hoy;
    });
    const porVencer = pendientes.filter(r => {
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      return fv && fv >= hoy;
    });

    const montoPagado = pagados.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoPendiente = pendientes.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const montoVencido = vencidos.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);

    const totalRecibos = recibosFiltrados.length;
    const porcentajeCobranza = totalRecibos > 0 ? ((pagados.length / totalRecibos) * 100).toFixed(1) : 0;

    return {
      totalRecibos,
      pagados: pagados.length,
      pendientes: pendientes.length,
      vencidos: vencidos.length,
      porVencer: porVencer.length,
      montoPagado,
      montoPendiente,
      montoVencido,
      porcentajeCobranza
    };
  }, [recibosFiltrados]);

  const formatMoney = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

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
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #198754 !important', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#198754' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Cobrado</span>
                    <CheckCircle2 size={18} className="text-success" />
                  </div>
                  <h4 className="mb-0 fw-bold text-success">{formatMoney(kpis.montoPagado)}</h4>
                  <small className="text-muted">{kpis.pagados} recibos pagados</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100" style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#ffc107' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Pendiente</span>
                    <Clock size={18} className="text-warning" />
                  </div>
                  <h4 className="mb-0 fw-bold text-warning">{formatMoney(kpis.montoPendiente)}</h4>
                  <small className="text-muted">{kpis.pendientes} recibos por cobrar</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100" style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#dc3545' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>Vencido</span>
                    <AlertTriangle size={18} className="text-danger" />
                  </div>
                  <h4 className="mb-0 fw-bold text-danger">{formatMoney(kpis.montoVencido)}</h4>
                  <small className="text-muted">{kpis.vencidos} recibos vencidos</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm h-100" style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: '#0d6efd' }}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8em' }}>% Cobranza</span>
                    <TrendingUp size={18} className="text-primary" />
                  </div>
                  <h4 className="mb-0 fw-bold text-primary">{kpis.porcentajeCobranza}%</h4>
                  <small className="text-muted">{kpis.pagados} de {kpis.totalRecibos} recibos</small>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de progreso visual */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Estado General de Cobranza</h6>
              <div className="progress" style={{ height: '30px', borderRadius: '8px' }}>
                {kpis.totalRecibos > 0 && (
                  <>
                    <div className="progress-bar bg-success" style={{ width: `${(kpis.pagados / kpis.totalRecibos) * 100}%` }}>
                      {kpis.pagados > 0 && `${kpis.pagados} Pagados`}
                    </div>
                    <div className="progress-bar bg-warning" style={{ width: `${(kpis.porVencer / kpis.totalRecibos) * 100}%` }}>
                      {kpis.porVencer > 0 && `${kpis.porVencer} Por vencer`}
                    </div>
                    <div className="progress-bar bg-danger" style={{ width: `${(kpis.vencidos / kpis.totalRecibos) * 100}%` }}>
                      {kpis.vencidos > 0 && `${kpis.vencidos} Vencidos`}
                    </div>
                  </>
                )}
              </div>
              {kpis.totalRecibos === 0 && (
                <div className="text-center text-muted mt-2">Sin recibos en el período seleccionado</div>
              )}
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="card border-0 shadow-sm">
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
                      <td className="fw-semibold">Prima total en recibos del período</td>
                      <td className="text-end fw-bold">{formatMoney(kpis.montoPagado + kpis.montoPendiente)}</td>
                    </tr>
                    <tr className="table-success">
                      <td className="fw-semibold text-success">(-) Cobrado</td>
                      <td className="text-end fw-bold text-success">{formatMoney(kpis.montoPagado)}</td>
                    </tr>
                    <tr className="table-warning">
                      <td className="fw-semibold text-warning">(=) Pendiente de cobro</td>
                      <td className="text-end fw-bold text-warning">{formatMoney(kpis.montoPendiente)}</td>
                    </tr>
                    <tr className="table-danger">
                      <td className="fw-semibold text-danger">  De lo cual está vencido</td>
                      <td className="text-end fw-bold text-danger">{formatMoney(kpis.montoVencido)}</td>
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

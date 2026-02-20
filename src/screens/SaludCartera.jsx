import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCw, Filter, TrendingUp, TrendingDown, Activity, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const SaludCartera = () => {
  const [loading, setLoading] = useState(false);
  const [expedientes, setExpedientes] = useState([]);
  const [recibos, setRecibos] = useState([]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ss_token');
      const [expRes, recRes] = await Promise.all([
        fetch(`${API_URL}/api/expedientes`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/recibos`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
      ]);

      if (expRes.ok) {
        const expData = await expRes.json();
        setExpedientes(Array.isArray(expData) ? expData : []);
      }
      if (recRes && recRes.ok) {
        const recData = await recRes.json();
        setRecibos(Array.isArray(recData) ? recData : []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Análisis de salud de cartera
  const salud = useMemo(() => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Clasificar expedientes por estatus de vigencia
    const vigentes = expedientes.filter(e => {
      const terminoStr = e.fin_vigencia || e.termino_vigencia;
      if (!terminoStr) return false;
      const termino = terminoStr.split('T')[0];
      return termino >= hoyStr && (e.estatus || '').toLowerCase() !== 'cancelada';
    });

    const porVencer30 = vigentes.filter(e => {
      const terminoStr = e.fin_vigencia || e.termino_vigencia;
      if (!terminoStr) return false;
      const termino = new Date(terminoStr);
      const diff = (termino - hoy) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    });

    const porVencer60 = vigentes.filter(e => {
      const terminoStr = e.fin_vigencia || e.termino_vigencia;
      if (!terminoStr) return false;
      const termino = new Date(terminoStr);
      const diff = (termino - hoy) / (1000 * 60 * 60 * 24);
      return diff > 30 && diff <= 60;
    });

    const vencidas = expedientes.filter(e => {
      const terminoStr = e.fin_vigencia || e.termino_vigencia;
      if (!terminoStr) return false;
      const termino = terminoStr.split('T')[0];
      return termino < hoyStr && (e.estatus || '').toLowerCase() !== 'cancelada';
    });

    const canceladas = expedientes.filter(e => 
      (e.estatus || '').toLowerCase() === 'cancelada'
    );

    // Prima en riesgo (pólizas por vencer próximos 30 días)
    const primaEnRiesgo = porVencer30.reduce((s, e) => s + (parseFloat(e.prima_total) || 0), 0);
    const primaVigente = vigentes.reduce((s, e) => s + (parseFloat(e.prima_total) || 0), 0);
    const primaVencida = vencidas.reduce((s, e) => s + (parseFloat(e.prima_total) || 0), 0);

    // Distribución por aseguradora
    const porAseguradora = {};
    vigentes.forEach(e => {
      const aseg = e.aseguradora || e.compania || 'Sin aseguradora';
      if (!porAseguradora[aseg]) porAseguradora[aseg] = { conteo: 0, prima: 0 };
      porAseguradora[aseg].conteo++;
      porAseguradora[aseg].prima += parseFloat(e.prima_total) || 0;
    });

    // Tasa de retención (renovaciones vs vencimientos)
    // Se estima: pólizas renovadas / total que debieron renovarse
    const renovadas = expedientes.filter(e => {
      const tipo = (e.tipo_movimiento || '').toUpperCase();
      return tipo === 'RENOVACION' || tipo === 'RENOVACIÓN';
    }).length;

    const totalParaRenovar = vencidas.length + renovadas;
    const tasaRetencion = totalParaRenovar > 0 ? ((renovadas / totalParaRenovar) * 100).toFixed(1) : 0;

    // Recibos vencidos sin pagar
    const recibosVencidos = recibos.filter(r => {
      const fv = r.fecha_vencimiento ? r.fecha_vencimiento.split('T')[0] : null;
      return fv && fv < hoyStr && (r.estatus || '').toLowerCase() === 'pendiente';
    });
    const montoRecibosMorosos = recibosVencidos.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);

    // Índice de salud (0-100)
    const totalExp = expedientes.length || 1;
    const pctVigentes = (vigentes.length / totalExp) * 100;
    const pctCanceladas = (canceladas.length / totalExp) * 100;
    const pctVencidas = (vencidas.length / totalExp) * 100;
    const indiceSalud = Math.max(0, Math.min(100, 
      (pctVigentes * 0.6) + (parseFloat(tasaRetencion) * 0.25) - (pctCanceladas * 0.1) - (pctVencidas * 0.05)
    )).toFixed(0);

    return {
      totalExpedientes: expedientes.length,
      vigentes: vigentes.length,
      porVencer30: porVencer30.length,
      porVencer60: porVencer60.length,
      vencidas: vencidas.length,
      canceladas: canceladas.length,
      primaVigente,
      primaEnRiesgo,
      primaVencida,
      porAseguradora: Object.entries(porAseguradora)
        .sort(([, a], [, b]) => b.conteo - a.conteo),
      tasaRetencion,
      renovadas,
      recibosVencidos: recibosVencidos.length,
      montoRecibosMorosos,
      indiceSalud,
      porVencer30List: porVencer30
    };
  }, [expedientes, recibos]);

  const formatMoney = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

  const getColorSalud = (indice) => {
    if (indice >= 75) return '#198754';
    if (indice >= 50) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-2">
          <ShieldCheck size={28} className="text-primary" />
          <div>
            <h4 className="mb-0 fw-bold">Salud de Cartera</h4>
            <small className="text-muted">Diagnóstico integral del estado de la cartera</small>
          </div>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={cargarDatos} disabled={loading}>
          <RefreshCw size={16} className={`me-1 ${loading ? 'spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2 text-muted">Analizando cartera...</p>
        </div>
      ) : (
        <>
          {/* Indicador de Salud General */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center p-4">
                  <Activity size={24} className="mb-2" style={{ color: getColorSalud(salud.indiceSalud) }} />
                  <h6 className="text-muted mb-2">Índice de Salud</h6>
                  <div style={{ 
                    fontSize: '3rem', 
                    fontWeight: 'bold', 
                    color: getColorSalud(salud.indiceSalud),
                    lineHeight: 1
                  }}>
                    {salud.indiceSalud}
                  </div>
                  <small className="text-muted">de 100 puntos</small>
                  <div className="progress mt-3" style={{ height: '8px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ width: `${salud.indiceSalud}%`, backgroundColor: getColorSalud(salud.indiceSalud) }} 
                    />
                  </div>
                  <small className="text-muted d-block mt-2">
                    {salud.indiceSalud >= 75 ? 'Cartera saludable' : salud.indiceSalud >= 50 ? 'Requiere atención' : 'Estado crítico'}
                  </small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center p-4">
                  <TrendingUp size={24} className="text-info mb-2" />
                  <h6 className="text-muted mb-2">Tasa de Retención</h6>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#0dcaf0', lineHeight: 1 }}>
                    {salud.tasaRetencion}%
                  </div>
                  <small className="text-muted">{salud.renovadas} renovaciones realizadas</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body text-center p-4">
                  <AlertTriangle size={24} className="text-danger mb-2" />
                  <h6 className="text-muted mb-2">Cartera Morosa</h6>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545', lineHeight: 1 }}>
                    {formatMoney(salud.montoRecibosMorosos)}
                  </div>
                  <small className="text-muted">{salud.recibosVencidos} recibos vencidos sin pagar</small>
                </div>
              </div>
            </div>
          </div>

          {/* Distribución de pólizas */}
          <div className="row g-3 mb-4">
            {[
              { label: 'Vigentes', valor: salud.vigentes, color: '#198754', icono: CheckCircle2, prima: salud.primaVigente },
              { label: 'Por vencer (30d)', valor: salud.porVencer30, color: '#ffc107', icono: Clock, prima: salud.primaEnRiesgo },
              { label: 'Por vencer (60d)', valor: salud.porVencer60, color: '#fd7e14', icono: Clock, prima: null },
              { label: 'Vencidas', valor: salud.vencidas, color: '#dc3545', icono: XCircle, prima: salud.primaVencida },
              { label: 'Canceladas', valor: salud.canceladas, color: '#6c757d', icono: XCircle, prima: null }
            ].map((item, idx) => {
              const Icono = item.icono;
              return (
                <div key={idx} className="col-6 col-lg">
                  <div className="card border-0 shadow-sm h-100" style={{ borderTopWidth: '3px', borderTopStyle: 'solid', borderTopColor: item.color }}>
                    <div className="card-body p-3 text-center">
                      <Icono size={20} style={{ color: item.color }} />
                      <h3 className="fw-bold mb-0 mt-1" style={{ color: item.color }}>{item.valor}</h3>
                      <small className="text-muted d-block">{item.label}</small>
                      {item.prima !== null && <small className="fw-semibold" style={{ color: item.color, fontSize: '0.75em' }}>{formatMoney(item.prima)}</small>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row g-3">
            {/* Distribución por Aseguradora */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3">
                  <h6 className="mb-0 fw-bold">
                    <PieChart size={16} className="me-2 text-primary" />
                    Distribución por Aseguradora
                  </h6>
                </div>
                <div className="card-body p-0">
                  {salud.porAseguradora.length === 0 ? (
                    <div className="text-center py-4 text-muted">Sin datos</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ fontSize: '0.8em' }}>Aseguradora</th>
                            <th className="text-center" style={{ fontSize: '0.8em' }}>Pólizas</th>
                            <th className="text-end" style={{ fontSize: '0.8em' }}>Prima</th>
                            <th style={{ fontSize: '0.8em', width: '100px' }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salud.porAseguradora.map(([aseg, datos]) => {
                            const pct = salud.vigentes > 0 ? ((datos.conteo / salud.vigentes) * 100).toFixed(1) : 0;
                            return (
                              <tr key={aseg}>
                                <td className="fw-semibold" style={{ fontSize: '0.85em' }}>{aseg}</td>
                                <td className="text-center">{datos.conteo}</td>
                                <td className="text-end" style={{ fontSize: '0.85em' }}>{formatMoney(datos.prima)}</td>
                                <td>
                                  <div className="d-flex align-items-center gap-1">
                                    <div className="progress flex-grow-1" style={{ height: '6px' }}>
                                      <div className="progress-bar bg-primary" style={{ width: `${pct}%` }} />
                                    </div>
                                    <small className="text-muted" style={{ fontSize: '0.75em', minWidth: '32px' }}>{pct}%</small>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pólizas por vencer próximos 30 días */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h6 className="mb-0 fw-bold">
                    <AlertTriangle size={16} className="me-2 text-warning" />
                    Pólizas por Vencer (30 días)
                  </h6>
                  <span className="badge bg-warning text-dark">{salud.porVencer30} pólizas</span>
                </div>
                <div className="card-body p-0" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {salud.porVencer30List.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <CheckCircle2 size={32} className="mb-2 text-success opacity-50" />
                      <p className="mb-0">No hay pólizas por vencer en 30 días</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {salud.porVencer30List.slice(0, 20).map((exp, idx) => {
                        const termino = exp.fin_vigencia || exp.termino_vigencia || '';
                        const dias = Math.ceil((new Date(termino) - new Date()) / (1000 * 60 * 60 * 24));
                        return (
                          <div key={idx} className="list-group-item px-3 py-2">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="fw-semibold" style={{ fontSize: '0.85em' }}>
                                  {exp.numero_poliza || `Exp. ${exp.id}`}
                                </div>
                                <small className="text-muted">
                                  {exp.asegurado || exp.nombre_cliente || 'Sin nombre'} | {exp.aseguradora || exp.compania || ''}
                                </small>
                              </div>
                              <span className={`badge ${dias <= 7 ? 'bg-danger' : dias <= 15 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                {dias}d
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {salud.porVencer30List.length > 20 && (
                        <div className="list-group-item text-center text-muted py-2" style={{ fontSize: '0.85em' }}>
                          + {salud.porVencer30List.length - 20} pólizas más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SaludCartera;

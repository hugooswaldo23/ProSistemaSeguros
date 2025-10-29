import React, { useState, useMemo } from 'react';
import { 
  Plus, FileText, DollarSign, AlertCircle, 
  RefreshCw, Send, CheckCircle, Clock, Edit,
  CreditCard, Calendar, TrendingUp, AlertTriangle,
  ArrowRight, Activity, Award, X, User, Shield, 
  Package, Paperclip, MessageSquare, CheckCircle2, 
  XCircle, Eye, UserCheck, Users, BarChart2, 
  Building2, Briefcase, FileCheck, Filter, Download
} from 'lucide-react';

const DashboardComponent = () => {
  // Estados
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroTramites, setFiltroTramites] = useState('todos');
  
  // Tipos de trámite - diseño ejecutivo
  const tiposTramite = [
    { nombre: 'Cambio de beneficiario', codigo: 'CB', color: '#3B82F6' },
    { nombre: 'Actualización de datos', codigo: 'AD', color: '#06B6D4' },
    { nombre: 'Cambio de forma de pago', codigo: 'FP', color: '#8B5CF6' },
    { nombre: 'Solicitud de cancelación', codigo: 'SC', color: '#EF4444' },
    { nombre: 'Reexpedición de póliza', codigo: 'RP', color: '#EC4899' },
    { nombre: 'Cambio de cobertura', codigo: 'CC', color: '#10B981' },
    { nombre: 'Inclusión/Exclusión', codigo: 'IE', color: '#F59E0B' },
    { nombre: 'Cambio suma asegurada', codigo: 'SA', color: '#F97316' },
    { nombre: 'Rehabilitación', codigo: 'RH', color: '#6366F1' },
    { nombre: 'Endoso', codigo: 'EN', color: '#14B8A6' }
  ];

  // Estados - Listos para conectar con la base de datos
  const [expedientes, setExpedientes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [nuevasPolizas, setNuevasPolizas] = useState([]);

  // Función para abrir modal con detalles
  const abrirDetalleTramite = (tramite) => {
    setModalDetalle(tramite);
  };

  // Estadísticas calculadas - se actualizarán cuando se carguen los datos
  const estadisticasTramites = useMemo(() => {
    const tramitesActivos = expedientes.filter(exp => exp.tipo === 'tramite');
    const agrupados = {};
    
    tiposTramite.forEach(tipo => {
      agrupados[tipo.nombre] = tramitesActivos.filter(t => t.tramite === tipo.nombre).length;
    });
    
    return {
      total: tramitesActivos.length,
      porTipo: agrupados,
      tramites: tramitesActivos
    };
  }, [expedientes]);

  // Etapas de nuevas pólizas - diseño ejecutivo
  const etapasNuevasPolizas = [
    { 
      nombre: 'Solicitud de cotización',
      codigo: 'COT',
      color: '#1e40af',
      icono: FileText
    },
    { 
      nombre: 'Cotización enviada',
      codigo: 'ENV',
      color: '#0e7490',
      icono: Send
    },
    { 
      nombre: 'Solicitar emisión',
      codigo: 'EMI',
      color: '#7c2d12',
      icono: Edit
    },
    { 
      nombre: 'Emitida pendiente de pago',
      codigo: 'PEN',
      color: '#6b21a8',
      icono: Clock
    },
    { 
      nombre: 'Pagada',
      codigo: 'PAG',
      color: '#166534',
      icono: CheckCircle
    }
  ];

  const estadisticasNuevasPolizas = useMemo(() => {
    const nuevas = expedientes.filter(exp => exp.tipo === 'nueva');
    return etapasNuevasPolizas.map(etapa => ({
      ...etapa,
      cantidad: nuevas.filter(exp => exp.etapa === etapa.nombre).length
    }));
  }, [expedientes]);

  // Estadísticas de Pagos
  const estadisticasPagos = useMemo(() => {
    const pagos = expedientes.filter(exp => exp.tipo === 'pago');
    return {
      vencidos: pagos.filter(p => p.estatusPago === 'Vencido'),
      porVencer: pagos.filter(p => p.estatusPago === 'Por vencer'),
      enGracia: pagos.filter(p => p.estatusPago === 'En período de gracia'),
      montoTotal: pagos.reduce((sum, p) => sum + (p.monto || 0), 0)
    };
  }, [expedientes]);

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <style>
        {`
          .executive-card {
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            transition: all 0.2s ease;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .executive-card:hover {
            box-shadow: 0 4px 6px rgba(0,0,0,0.07);
            border-color: #D1D5DB;
          }
          .kpi-card {
            background: white;
            border-radius: 6px;
            border: 1px solid #E5E7EB;
            position: relative;
            overflow: hidden;
          }
          .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--accent-color);
          }
          .metric-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .compact-table {
            font-size: 13px;
          }
          .compact-table th {
            background: #F9FAFB;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6B7280;
            padding: 8px 12px;
            border-bottom: 2px solid #E5E7EB;
          }
          .compact-table td {
            padding: 10px 12px;
            vertical-align: middle;
            border-bottom: 1px solid #F3F4F6;
          }
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
          }
          .data-row:hover {
            background-color: #F9FAFB;
          }
          .section-header {
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .mini-chart {
            height: 40px;
            display: flex;
            align-items: flex-end;
            gap: 2px;
          }
          .mini-chart-bar {
            flex: 1;
            background: #E5E7EB;
            border-radius: 2px 2px 0 0;
            transition: background 0.2s;
          }
          .mini-chart-bar:hover {
            background: #3B82F6;
          }
        `}
      </style>
      
      <div className="p-0" style={{ backgroundColor: '#F3F4F6', minHeight: '100vh' }}>
        {/* Header Ejecutivo Compacto */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB' }} className="py-3 px-4">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h4 className="mb-0 fw-bold" style={{ color: '#111827' }}>Dashboard Ejecutivo</h4>
                <small className="text-muted" style={{ fontSize: '12px' }}>
                  {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </small>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm" style={{ border: '1px solid #E5E7EB', background: 'white' }}>
                  <Download size={14} className="me-1" />
                  Exportar
                </button>
                <button className="btn btn-sm" style={{ border: '1px solid #E5E7EB', background: 'white' }}>
                  <RefreshCw size={14} className="me-1" />
                  Actualizar
                </button>
                <button className="btn btn-primary btn-sm">
                  <Plus size={14} className="me-1" />
                  Nueva Póliza
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container-fluid px-4 py-3">
          {/* KPIs Ejecutivos - Compactos */}
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <div className="kpi-card p-3" style={{ '--accent-color': '#3B82F6' }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ flex: 1 }}>
                    <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Total Operaciones
                    </div>
                    <h2 className="mb-0 fw-bold" style={{ fontSize: '28px', color: '#111827' }}>
                      {expedientes.length}
                    </h2>
                  </div>
                  <div style={{ padding: '8px', background: '#EFF6FF', borderRadius: '6px' }}>
                    <BarChart2 size={20} style={{ color: '#3B82F6' }} />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="metric-badge" style={{ background: '#D1FAE5', color: '#065F46' }}>
                    <TrendingUp size={10} className="me-1" />
                    +12%
                  </span>
                  <small className="text-muted" style={{ fontSize: '11px' }}>vs mes anterior</small>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="kpi-card p-3" style={{ '--accent-color': '#F59E0B' }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ flex: 1 }}>
                    <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Trámites Activos
                    </div>
                    <h2 className="mb-0 fw-bold" style={{ fontSize: '28px', color: '#111827' }}>
                      {estadisticasTramites.total}
                    </h2>
                  </div>
                  <div style={{ padding: '8px', background: '#FEF3C7', borderRadius: '6px' }}>
                    <FileCheck size={20} style={{ color: '#F59E0B' }} />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="metric-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    <Activity size={10} className="me-1" />
                    {estadisticasTramites.tramites.filter(t => t.estado === 'Pendiente').length} pendientes
                  </span>
                  <small className="text-muted" style={{ fontSize: '11px' }}>en proceso</small>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="kpi-card p-3" style={{ '--accent-color': '#10B981' }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ flex: 1 }}>
                    <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Por Cobrar
                    </div>
                    <h2 className="mb-0 fw-bold" style={{ fontSize: '28px', color: '#111827' }}>
                      ${estadisticasPagos.montoTotal.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h2>
                  </div>
                  <div style={{ padding: '8px', background: '#D1FAE5', borderRadius: '6px' }}>
                    <DollarSign size={20} style={{ color: '#10B981' }} />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="metric-badge" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    <AlertTriangle size={10} className="me-1" />
                    {estadisticasPagos.vencidos.length} vencidos
                  </span>
                  <small className="text-muted" style={{ fontSize: '11px' }}>urgente</small>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="kpi-card p-3" style={{ '--accent-color': '#8B5CF6' }}>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div style={{ flex: 1 }}>
                    <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Tasa Conversión
                    </div>
                    <h2 className="mb-0 fw-bold" style={{ fontSize: '28px', color: '#111827' }}>
                      87.3%
                    </h2>
                  </div>
                  <div style={{ padding: '8px', background: '#EDE9FE', borderRadius: '6px' }}>
                    <TrendingUp size={20} style={{ color: '#8B5CF6' }} />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="metric-badge" style={{ background: '#D1FAE5', color: '#065F46' }}>
                    <Award size={10} className="me-1" />
                    Excelente
                  </span>
                  <small className="text-muted" style={{ fontSize: '11px' }}>cotización → póliza</small>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 1: Gestión de Trámites */}
          <div className="row g-4 mb-4">
            <div className="col-12">
              <div className="corporate-card p-0">
                <div className="card-header bg-white border-bottom p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <Briefcase size={20} className="text-secondary me-2" />
                      <h5 className="mb-0 fw-normal">Gestión de Trámites - Pólizas Vigentes</h5>
                    </div>
                    <span className="badge bg-secondary px-3 py-2">
                      {estadisticasTramites.total} Activos
                    </span>
                  </div>
                </div>
                
                <div className="card-body p-4">
                  <div className="row g-3">
                    {/* Panel de resumen */}
                    <div className="col-md-4">
                      <div className="border rounded p-3 bg-light">
                        <h6 className="text-muted mb-3">Resumen Ejecutivo</h6>
                        <div className="mb-4">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Total procesado:</span>
                            <strong>{estadisticasTramites.total}</strong>
                          </div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div className="progress-bar bg-primary" style={{ width: '65%' }}></div>
                          </div>
                          <small className="text-muted">65% completado este mes</small>
                        </div>
                        
                        {/* Últimos trámites */}
                        {estadisticasTramites.tramites.length > 0 && (
                          <div>
                            <h6 className="text-muted mb-2">Actividad Reciente</h6>
                            {estadisticasTramites.tramites.slice(0, 3).map(t => (
                              <div key={t.id} 
                                   className="d-flex justify-content-between align-items-center py-2 border-bottom data-row"
                                   style={{ cursor: 'pointer', fontSize: '14px' }}
                                   onClick={() => abrirDetalleTramite(t)}>
                                <div>
                                  <div className="fw-semibold">{t.tramite}</div>
                                  <small className="text-muted">{t.cliente}</small>
                                </div>
                                <Eye size={14} className="text-secondary" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Grid de tipos de trámite */}
                    <div className="col-md-8">
                      <div className="row g-2">
                        {tiposTramite.map(tipo => {
                          const cantidad = estadisticasTramites.porTipo[tipo.nombre] || 0;
                          const tramitesDelTipo = estadisticasTramites.tramites.filter(t => t.tramite === tipo.nombre);
                          
                          return (
                            <div key={tipo.nombre} className="col-md-6">
                              <div 
                                className="border rounded p-3 d-flex align-items-center justify-content-between"
                                style={{ 
                                  cursor: tramitesDelTipo.length > 0 ? 'pointer' : 'default',
                                  borderLeft: `3px solid ${tipo.color}`
                                }}
                                onClick={() => {
                                  if (tramitesDelTipo.length > 0) {
                                    abrirDetalleTramite(tramitesDelTipo[0]);
                                  }
                                }}>
                                <div className="d-flex align-items-center">
                                  <div className="me-3">
                                    <div className="fw-bold" style={{ color: tipo.color, fontSize: '18px' }}>
                                      {tipo.codigo}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="fw-semibold" style={{ fontSize: '14px' }}>
                                      {tipo.nombre}
                                    </div>
                                    {cantidad > 0 && (
                                      <small className="text-muted">
                                        {cantidad} {cantidad === 1 ? 'trámite' : 'trámites'}
                                      </small>
                                    )}
                                  </div>
                                </div>
                                {cantidad > 0 && (
                                  <span className="badge rounded-pill" 
                                        style={{ backgroundColor: tipo.color }}>
                                    {cantidad}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Nuevas Pólizas */}
          <div className="row g-4 mb-4">
            <div className="col-12">
              <div className="corporate-card p-0">
                <div className="card-header bg-white border-bottom p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <FileText size={20} className="text-secondary me-2" />
                      <h5 className="mb-0 fw-normal">Pipeline de Nuevas Pólizas</h5>
                    </div>
                    <span className="badge bg-primary px-3 py-2">
                      {expedientes.filter(e => e.tipo === 'nueva').length} En Proceso
                    </span>
                  </div>
                </div>
                
                <div className="card-body p-4">
                  <div className="row g-3">
                    {estadisticasNuevasPolizas.map((etapa, index) => {
                      const Icono = etapa.icono;
                      return (
                        <div key={index} className="col">
                          <div className="text-center">
                            <div className="metric-card p-3" style={{ borderLeftColor: etapa.color }}>
                              <div className="mb-2">
                                <Icono size={24} style={{ color: etapa.color }} />
                              </div>
                              <h2 className="mb-1" style={{ color: etapa.color }}>
                                {etapa.cantidad}
                              </h2>
                              <p className="text-muted mb-1" style={{ fontSize: '13px' }}>
                                {etapa.nombre}
                              </p>
                              <small className="text-muted fw-bold">
                                {etapa.codigo}
                              </small>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pipeline visual */}
                  <div className="mt-4 p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center position-relative">
                      <div className="position-absolute w-100" 
                           style={{ 
                             height: '2px',
                             backgroundColor: '#e0e0e0',
                             top: '50%',
                             transform: 'translateY(-50%)',
                             zIndex: 0
                           }} />
                      {estadisticasNuevasPolizas.map((etapa, index) => (
                        <div key={index} className="text-center position-relative bg-light px-2"
                             style={{ zIndex: 1 }}>
                          <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${etapa.cantidad > 0 ? 'bg-white border' : 'bg-secondary bg-opacity-10'}`}
                               style={{ 
                                 width: '36px', 
                                 height: '36px',
                                 borderColor: etapa.cantidad > 0 ? etapa.color : 'transparent',
                                 color: etapa.cantidad > 0 ? etapa.color : '#999',
                                 fontWeight: '600',
                                 fontSize: '14px'
                               }}>
                            {etapa.cantidad}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Control de Pagos */}
          <div className="row g-4">
            <div className="col-12">
              <div className="corporate-card p-0">
                <div className="card-header bg-white border-bottom p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <CreditCard size={20} className="text-secondary me-2" />
                      <h5 className="mb-0 fw-normal">Control Financiero de Pagos</h5>
                    </div>
                    <span className="badge bg-warning px-3 py-2">
                      {estadisticasPagos.vencidos.length + estadisticasPagos.porVencer.length + estadisticasPagos.enGracia.length} Requieren Atención
                    </span>
                  </div>
                </div>
                
                <div className="card-body p-4">
                  <div className="row g-3">
                    {/* Pagos vencidos */}
                    <div className="col-md-3">
                      <div className="metric-card p-3" style={{ borderLeftColor: '#dc2626' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                              Pagos Vencidos
                            </p>
                            <h3 className="mb-0 text-danger">{estadisticasPagos.vencidos.length}</h3>
                          </div>
                          <AlertTriangle size={20} className="text-danger" />
                        </div>
                        
                        <div className="border-top pt-3">
                          <small className="text-muted d-block mb-1">Monto total</small>
                          <h5 className="text-danger mb-0">
                            ${estadisticasPagos.vencidos.reduce((sum, p) => sum + p.monto, 0).toLocaleString('es-MX')}
                          </h5>
                        </div>
                        
                        {estadisticasPagos.vencidos.length > 0 && (
                          <div className="mt-3">
                            <button className="btn btn-sm btn-outline-danger w-100">
                              Gestionar Vencidos
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Por vencer */}
                    <div className="col-md-3">
                      <div className="metric-card p-3" style={{ borderLeftColor: '#f59e0b' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                              Por Vencer
                            </p>
                            <h3 className="mb-0 text-warning">{estadisticasPagos.porVencer.length}</h3>
                          </div>
                          <Clock size={20} className="text-warning" />
                        </div>
                        
                        <div className="border-top pt-3">
                          <small className="text-muted d-block mb-1">Monto total</small>
                          <h5 className="text-warning mb-0">
                            ${estadisticasPagos.porVencer.reduce((sum, p) => sum + p.monto, 0).toLocaleString('es-MX')}
                          </h5>
                        </div>
                        
                        {estadisticasPagos.porVencer.length > 0 && (
                          <div className="mt-3">
                            <button className="btn btn-sm btn-outline-warning w-100">
                              Enviar Recordatorios
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* En período de gracia */}
                    <div className="col-md-3">
                      <div className="metric-card p-3" style={{ borderLeftColor: '#3b82f6' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                              En Período de Gracia
                            </p>
                            <h3 className="mb-0 text-info">{estadisticasPagos.enGracia.length}</h3>
                          </div>
                          <Calendar size={20} className="text-info" />
                        </div>
                        
                        <div className="border-top pt-3">
                          <small className="text-muted d-block mb-1">Monto total</small>
                          <h5 className="text-info mb-0">
                            ${estadisticasPagos.enGracia.reduce((sum, p) => sum + p.monto, 0).toLocaleString('es-MX')}
                          </h5>
                        </div>
                        
                        {estadisticasPagos.enGracia.length > 0 && (
                          <div className="mt-3">
                            <button className="btn btn-sm btn-outline-info w-100">
                              Notificar Clientes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumen financiero */}
                    <div className="col-md-3">
                      <div className="metric-card p-3" style={{ borderLeftColor: '#10b981' }}>
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                              Total Por Cobrar
                            </p>
                            <h3 className="mb-0 text-success">
                              ${estadisticasPagos.montoTotal.toLocaleString('es-MX')}
                            </h3>
                          </div>
                          <TrendingUp size={20} className="text-success" />
                        </div>
                        
                        <div className="border-top pt-3">
                          <div className="d-flex justify-content-between mb-2">
                            <small>Eficiencia cobro:</small>
                            <strong className="text-success">78%</strong>
                          </div>
                          <div className="progress" style={{ height: '4px' }}>
                            <div className="progress-bar bg-success" style={{ width: '78%' }}></div>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <button className="btn btn-sm btn-success w-100">
                            Registrar Pago
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALLE DE TRÁMITE - Diseño Corporativo */}
      {modalDetalle && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              {/* Header del modal */}
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-normal">
                  Detalle del Trámite - Folio #{modalDetalle.id}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setModalDetalle(null)}>
                </button>
              </div>
              
              {/* Body del modal */}
              <div className="modal-body">
                <div className="row g-3">
                  {/* SECCIÓN ROLES - Diseño ejecutivo */}
                  <div className="col-12">
                    <h6 className="text-muted mb-3 fw-normal">
                      <Users size={18} className="me-2" />
                      Partes Involucradas
                    </h6>
                    <div className="row g-2">
                      {/* Cliente */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-primary"></span>
                            <small className="text-muted fw-bold">CLIENTE</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.cliente}</h6>
                          <small className="text-muted d-block">{modalDetalle.telefono}</small>
                          <small className="text-primary" style={{ fontSize: '11px' }}>{modalDetalle.email}</small>
                        </div>
                      </div>
                      
                      {/* Agente */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-success"></span>
                            <small className="text-muted fw-bold">AGENTE</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.agente || 'No asignado'}</h6>
                          <small className="text-muted d-block">{modalDetalle.agenteTelefono || '-'}</small>
                          <small className="text-success" style={{ fontSize: '11px' }}>{modalDetalle.agenteEmail || '-'}</small>
                        </div>
                      </div>
                      
                      {/* Vendedor */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-info"></span>
                            <small className="text-muted fw-bold">VENDEDOR</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.vendedor || 'No aplica'}</h6>
                          <small className="text-muted d-block">{modalDetalle.vendedorTelefono || '-'}</small>
                          <small className="text-info" style={{ fontSize: '11px' }}>{modalDetalle.vendedorEmail || '-'}</small>
                        </div>
                      </div>
                      
                      {/* Ejecutivo */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-warning"></span>
                            <small className="text-muted fw-bold">EJECUTIVO</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.ejecutivo || 'Por asignar'}</h6>
                          <small className="text-muted d-block">{modalDetalle.ejecutivoTelefono || '-'}</small>
                          <small className="text-warning" style={{ fontSize: '11px' }}>{modalDetalle.ejecutivoEmail || '-'}</small>
                        </div>
                      </div>
                    </div>
                    {modalDetalle.solicitadoPor && (
                      <div className="mt-2 text-end">
                        <small className="text-muted">
                          Iniciado por: <strong>{modalDetalle.solicitadoPor}</strong>
                        </small>
                      </div>
                    )}
                  </div>
                  
                  {/* Información de la póliza y trámite */}
                  <div className="col-md-6">
                    <div className="border rounded p-3">
                      <h6 className="mb-3 fw-normal">Información de la Póliza</h6>
                      <table className="table table-sm table-borderless">
                        <tbody>
                          <tr>
                            <td className="text-muted">Número:</td>
                            <td className="fw-semibold">{modalDetalle.poliza}</td>
                          </tr>
                          <tr>
                            <td className="text-muted">Aseguradora:</td>
                            <td>{modalDetalle.aseguradora}</td>
                          </tr>
                          <tr>
                            <td className="text-muted">Producto:</td>
                            <td>{modalDetalle.producto}</td>
                          </tr>
                          {modalDetalle.vehiculo && (
                            <tr>
                              <td className="text-muted">Vehículo:</td>
                              <td>{modalDetalle.vehiculo} - {modalDetalle.placas}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="border rounded p-3">
                      <h6 className="mb-3 fw-normal">Detalles del Trámite</h6>
                      <div className="mb-3">
                        <span className="badge bg-primary me-2">{modalDetalle.tramite}</span>
                        <span className={`badge ${
                          modalDetalle.estado === 'Autorizado' ? 'bg-success' :
                          modalDetalle.estado === 'En proceso' ? 'bg-warning' :
                          'bg-secondary'
                        }`}>
                          {modalDetalle.estado || 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-muted small mb-2">
                        <strong>Fecha:</strong> {modalDetalle.fechaSolicitud}
                      </p>
                      <p className="small">{modalDetalle.descripcion}</p>
                    </div>
                  </div>
                  
                  {/* Observaciones y archivos */}
                  {modalDetalle.observaciones && (
                    <div className="col-12">
                      <div className="alert alert-light border">
                        <strong>Observaciones:</strong> {modalDetalle.observaciones}
                      </div>
                    </div>
                  )}
                  
                  {modalDetalle.archivos && modalDetalle.archivos.length > 0 && (
                    <div className="col-12">
                      <div className="border rounded p-3">
                        <h6 className="mb-3 fw-normal">Documentos Adjuntos</h6>
                        <div className="list-group list-group-flush">
                          {modalDetalle.archivos.map((archivo, index) => (
                            <a key={index} href="#" className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <Paperclip size={14} className="me-2 text-muted" />
                                <span>{archivo}</span>
                              </div>
                              <Eye size={14} className="text-primary" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer del modal */}
              <div className="modal-footer bg-light">
                <button 
                  type="button" 
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <XCircle size={14} className="me-1" />
                  Rechazar
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-warning btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <Clock size={14} className="me-1" />
                  Pendiente
                </button>
                <button 
                  type="button" 
                  className="btn btn-success btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <CheckCircle2 size={14} className="me-1" />
                  Autorizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardComponent;

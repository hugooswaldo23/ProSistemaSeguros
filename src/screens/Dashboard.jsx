import React, { useState, useMemo } from 'react';
import { 
  Plus, FileText, DollarSign, AlertCircle, 
  RefreshCw, Send, CheckCircle, Clock, Edit,
  CreditCard, Calendar, TrendingUp, AlertTriangle,
  ArrowRight, Activity, Award, X, User, Shield, 
  Package, Paperclip, MessageSquare, CheckCircle2, 
  XCircle, Eye, UserCheck, Users, BarChart2, 
  Building2, Briefcase, FileCheck
} from 'lucide-react';

const DashboardComponent = () => {
  // Estados
  const [modalDetalle, setModalDetalle] = useState(null);
  
  // Tipos de trámite - diseño profesional sin emojis
  const tiposTramite = [
    { nombre: 'Cambio de beneficiario', codigo: 'CB', color: '#1e40af' },
    { nombre: 'Actualización de datos', codigo: 'AD', color: '#0f766e' },
    { nombre: 'Cambio de forma de pago', codigo: 'FP', color: '#7c2d12' },
    { nombre: 'Solicitud de cancelación', codigo: 'SC', color: '#991b1b' },
    { nombre: 'Reexpedición de póliza', codigo: 'RP', color: '#6b21a8' },
    { nombre: 'Cambio de cobertura', codigo: 'CC', color: '#0e7490' },
    { nombre: 'Inclusión/Exclusión', codigo: 'IE', color: '#166534' },
    { nombre: 'Cambio suma asegurada', codigo: 'SA', color: '#92400e' },
    { nombre: 'Rehabilitación', codigo: 'RH', color: '#1e3a8a' },
    { nombre: 'Endoso', codigo: 'EN', color: '#4c1d95' }
  ];

  // Estados para demostración con más detalles
  const [expedientes] = useState([
    // Nuevas pólizas
    { id: 1, tipo: 'nueva', etapa: 'Solicitud de cotización', producto: 'Autos', cliente: 'Juan Pérez García', empresa: 'Grupo Industrial Norte SA' },
    { id: 2, tipo: 'nueva', etapa: 'Cotización enviada', producto: 'Vida', cliente: 'María García López', empresa: 'Consultores Asociados' },
    { id: 3, tipo: 'nueva', etapa: 'Solicitar emisión', producto: 'Daños', cliente: 'Carlos López Martín', empresa: 'Logística Internacional' },
    { id: 4, tipo: 'nueva', etapa: 'Emitida pendiente de pago', producto: 'Autos', cliente: 'Ana Martínez Ruiz', empresa: 'Servicios Corporativos' },
    { id: 5, tipo: 'nueva', etapa: 'Pagada', producto: 'Vida', cliente: 'Roberto Silva Torres', empresa: 'Manufactura Global' },
    // Trámites con información completa incluyendo roles
    { 
      id: 6, 
      tipo: 'tramite', 
      tramite: 'Cambio de beneficiario',
      poliza: 'POL-2024-001',
      // Roles en el trámite
      cliente: 'Luis Rodríguez',
      telefono: '33-1234-5678',
      email: 'luis.rodriguez@email.com',
      agente: 'Patricia Mendoza',
      agenteEmail: 'patricia.mendoza@seguros.com',
      agenteTelefono: '33-1111-2222',
      vendedor: 'Roberto Sánchez',
      vendedorEmail: 'roberto.sanchez@seguros.com',
      vendedorTelefono: '33-3333-4444',
      ejecutivo: 'María Elena Torres',
      ejecutivoEmail: 'elena.torres@seguros.com',
      ejecutivoTelefono: '33-5555-6666',
      // Información de la póliza
      aseguradora: 'Qualitas',
      producto: 'Vida',
      sumaAsegurada: 500000,
      fechaSolicitud: '2024-01-15',
      estado: 'En proceso',
      descripcion: 'El cliente solicita cambiar el beneficiario de su póliza de vida debido a cambio en su estado civil',
      beneficiarioActual: 'María López Hernández',
      beneficiarioNuevo: 'Carmen Rodríguez Martín',
      archivos: ['INE_nuevo_beneficiario.pdf', 'Acta_matrimonio.pdf'],
      observaciones: 'Documentación completa, pendiente validación',
      solicitadoPor: 'Cliente'
    },
    { 
      id: 7, 
      tipo: 'tramite', 
      tramite: 'Actualización de datos',
      poliza: 'POL-2024-002',
      cliente: 'Patricia Gómez',
      telefono: '33-9876-5432',
      email: 'patricia.gomez@email.com',
      agente: 'Carlos Ramírez',
      agenteEmail: 'carlos.ramirez@seguros.com',
      agenteTelefono: '33-7777-8888',
      vendedor: null,
      ejecutivo: 'Fernando López',
      ejecutivoEmail: 'fernando.lopez@seguros.com',
      ejecutivoTelefono: '33-9999-0000',
      aseguradora: 'Banorte',
      producto: 'Autos',
      vehiculo: 'Honda CRV 2023',
      placas: 'JKL-123-A',
      fechaSolicitud: '2024-01-16',
      estado: 'Pendiente',
      descripcion: 'Cambio de domicilio y actualización de teléfono de contacto',
      domicilioAnterior: 'Av. Patria 1234, Zapopan',
      domicilioNuevo: 'Av. López Mateos 5678, Guadalajara',
      archivos: ['Comprobante_domicilio.pdf'],
      observaciones: 'Falta comprobante de domicilio actualizado',
      solicitadoPor: 'Agente'
    },
    { 
      id: 8, 
      tipo: 'tramite', 
      tramite: 'Cambio de cobertura',
      poliza: 'POL-2024-003',
      cliente: 'Miguel Herrera',
      telefono: '33-5555-1234',
      email: 'miguel.herrera@email.com',
      agente: 'Ana Flores',
      agenteEmail: 'ana.flores@seguros.com',
      agenteTelefono: '33-2222-3333',
      vendedor: 'José Luis Martínez',
      vendedorEmail: 'jose.martinez@seguros.com',
      vendedorTelefono: '33-4444-5555',
      ejecutivo: 'María Elena Torres',
      ejecutivoEmail: 'elena.torres@seguros.com',
      ejecutivoTelefono: '33-5555-6666',
      aseguradora: 'HDI',
      producto: 'Autos',
      vehiculo: 'Toyota Corolla 2022',
      placas: 'ABC-789-B',
      fechaSolicitud: '2024-01-17',
      estado: 'Autorizado',
      descripcion: 'Cambio de cobertura de Limitada a Amplia',
      coberturaActual: 'Limitada',
      coberturaNueva: 'Amplia',
      primaMensualActual: 1200,
      primaMensualNueva: 1800,
      archivos: ['Cotizacion_nueva.pdf', 'Autorizacion_cliente.pdf'],
      observaciones: 'Cliente autorizó el incremento en prima',
      solicitadoPor: 'Vendedor'
    },
    // Pagos
    { id: 9, tipo: 'pago', estatusPago: 'Vencido', poliza: 'POL-2024-003', monto: 5000, cliente: 'José Hernández', diasVencido: 5 },
    { id: 10, tipo: 'pago', estatusPago: 'Por vencer', poliza: 'POL-2024-004', monto: 3500, cliente: 'Laura Díaz', diasParaVencer: 3 },
    { id: 11, tipo: 'pago', estatusPago: 'En período de gracia', poliza: 'POL-2024-005', monto: 7800, cliente: 'Miguel Torres', diasGracia: 7 }
  ]);

  // Función para abrir modal con detalles
  const abrirDetalleTramite = (tramite) => {
    setModalDetalle(tramite);
  };

  // Estadísticas calculadas
  const estadisticasTramites = useMemo(() => {
    const tramites = expedientes.filter(exp => exp.tipo === 'tramite');
    const agrupados = {};
    
    tiposTramite.forEach(tipo => {
      agrupados[tipo.nombre] = tramites.filter(t => t.tramite === tipo.nombre).length;
    });
    
    return {
      total: tramites.length,
      porTipo: agrupados,
      tramites: tramites
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
          .corporate-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            transition: all 0.2s ease;
            background: white;
          }
          .corporate-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            transform: translateY(-2px);
          }
          .metric-card {
            border-left: 4px solid;
            background: white;
            border-radius: 4px;
          }
          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
          }
          .professional-header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
          }
          .data-row:hover {
            background-color: #f8f9fa;
          }
        `}
      </style>
      
      <div className="p-0">
        {/* Header Profesional */}
        <div className="professional-header p-4">
          <div className="container-fluid">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-1 fw-normal">Sistema de Gestión de Seguros</h3>
                <p className="mb-0 opacity-75" style={{ fontSize: '14px' }}>
                  Panel de Control Ejecutivo - {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-light btn-sm">
                  <RefreshCw size={14} className="me-1" />
                  Actualizar
                </button>
                <button className="btn btn-light btn-sm">
                  <Plus size={14} className="me-1" />
                  Nueva Operación
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="container-fluid p-4">
          {/* Indicadores Clave - KPIs */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="corporate-card p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Operaciones Totales
                    </p>
                    <h3 className="mb-0 fw-bold">{expedientes.length}</h3>
                    <small className="text-success">
                      <TrendingUp size={14} className="me-1" />
                      +12% vs mes anterior
                    </small>
                  </div>
                  <div className="p-2 bg-primary bg-opacity-10 rounded">
                    <BarChart2 size={20} className="text-primary" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="corporate-card p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Trámites Activos
                    </p>
                    <h3 className="mb-0 fw-bold">{estadisticasTramites.total}</h3>
                    <small className="text-warning">
                      <Activity size={14} className="me-1" />
                      {estadisticasTramites.tramites.filter(t => t.estado === 'Pendiente').length} pendientes
                    </small>
                  </div>
                  <div className="p-2 bg-warning bg-opacity-10 rounded">
                    <FileCheck size={20} className="text-warning" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="corporate-card p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Monto Por Cobrar
                    </p>
                    <h3 className="mb-0 fw-bold">
                      ${estadisticasPagos.montoTotal.toLocaleString('es-MX')}
                    </h3>
                    <small className="text-danger">
                      <AlertTriangle size={14} className="me-1" />
                      {estadisticasPagos.vencidos.length} vencidos
                    </small>
                  </div>
                  <div className="p-2 bg-success bg-opacity-10 rounded">
                    <DollarSign size={20} className="text-success" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-3">
              <div className="corporate-card p-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <p className="text-muted mb-1" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Eficiencia Operativa
                    </p>
                    <h3 className="mb-0 fw-bold">87.3%</h3>
                    <small className="text-success">
                      <Award size={14} className="me-1" />
                      Óptimo
                    </small>
                  </div>
                  <div className="p-2 bg-info bg-opacity-10 rounded">
                    <Activity size={20} className="text-info" />
                  </div>
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

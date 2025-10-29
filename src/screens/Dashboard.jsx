import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, FileText, DollarSign, AlertCircle, 
  RefreshCw, Send, CheckCircle, Clock, Edit,
  CreditCard, Calendar, TrendingUp, AlertTriangle,
  ArrowRight, Activity, Award, X, User, Shield, 
  Package, Paperclip, MessageSquare, CheckCircle2, 
  XCircle, Eye, UserCheck, Users, BarChart2, 
  Building2, Briefcase, FileCheck, Filter, Download
} from 'lucide-react';
import { API_URL } from '../constants/apiUrl';

const DashboardComponent = () => {
  // Estados
  const [modalDetalle, setModalDetalle] = useState(null);
  const [filtroTramites, setFiltroTramites] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [modalDesglose, setModalDesglose] = useState(null); // { tipo: 'emitidas|porVencer|vencidas|canceladas', datos: [] }
  
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

  // Cargar expedientes desde el backend
  useEffect(() => {
    const cargarExpedientes = async () => {
      try {
        setCargando(true);
        console.log('🔄 Cargando expedientes desde:', `${API_URL}/api/expedientes`);
        const response = await fetch(`${API_URL}/api/expedientes`);
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Expedientes cargados:', data.length, 'registros');
          console.log('📊 Datos:', data);
          setExpedientes(data);
        } else {
          console.error('❌ Error al cargar expedientes:', response.statusText);
        }
      } catch (error) {
        console.error('❌ Error en la petición:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarExpedientes();
  }, []);

  // Función para recargar datos
  const recargarDatos = () => {
    window.location.reload();
  };

  // Función para abrir modal con detalles
  const abrirDetalleTramite = (tramite) => {
    setModalDetalle(tramite);
  };

  // Función para abrir modal de desglose
  const abrirDesglose = (tipo) => {
    let polizasFiltradas = [];
    let titulo = '';
    let color = '';

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const esMesActual = (fecha) => {
      if (!fecha) return false;
      const fechaObj = new Date(fecha);
      return fechaObj.getMonth() === mesActual && fechaObj.getFullYear() === añoActual;
    };

    switch(tipo) {
      case 'emitidas':
        polizasFiltradas = expedientes.filter(exp => 
          esMesActual(exp.fecha_emision) && (
            exp.etapa_activa === 'Pagado' || 
            exp.etapa_activa === 'Emitida' || 
            exp.etapa_activa === 'Pendiente de pago'
          )
        );
        titulo = 'Primas Emitidas - Mes Actual';
        color = '#3B82F6';
        break;

      case 'porVencer':
        polizasFiltradas = expedientes.filter(p => 
          p.fecha_vencimiento_pago && p.estatusPago === 'Pago por vencer'
        );
        titulo = 'Primas Por Vencer - Acumulado';
        color = '#F59E0B';
        break;

      case 'vencidas':
        polizasFiltradas = expedientes.filter(p => 
          p.fecha_vencimiento_pago && p.estatusPago === 'Vencido'
        );
        titulo = 'Primas Vencidas - Acumulado';
        color = '#EF4444';
        break;

      case 'canceladas':
        polizasFiltradas = expedientes.filter(exp => 
          exp.etapa_activa === 'Cancelado' && esMesActual(exp.fecha_cancelacion)
        );
        titulo = 'Primas Canceladas - Mes Actual';
        color = '#6B7280';
        break;
    }

    // Agrupar por producto
    const porProducto = polizasFiltradas.reduce((acc, poliza) => {
      const producto = poliza.producto || 'Sin producto';
      if (!acc[producto]) {
        acc[producto] = {
          polizas: [],
          total: 0,
          cantidad: 0
        };
      }
      acc[producto].polizas.push(poliza);
      acc[producto].total += parseFloat(poliza.importe_total) || 0;
      acc[producto].cantidad += 1;
      return acc;
    }, {});

    setModalDesglose({
      tipo,
      titulo,
      color,
      porProducto,
      totalGeneral: polizasFiltradas.reduce((sum, p) => sum + (parseFloat(p.importe_total) || 0), 0),
      cantidadTotal: polizasFiltradas.length
    });
  };

  // Estadísticas Financieras - Calculadas desde expedientes (MES EN CURSO)
  const estadisticasFinancieras = useMemo(() => {
    console.log('📈 Calculando estadísticas con', expedientes.length, 'expedientes');
    
    // Obtener mes y año actual
    const hoy = new Date();
    const mesActual = hoy.getMonth(); // 0-11
    const añoActual = hoy.getFullYear();
    
    console.log(`📅 Filtrando datos del mes: ${mesActual + 1}/${añoActual}`);
    
    // Función helper para verificar si una fecha está en el mes actual
    const esMesActual = (fecha) => {
      if (!fecha) return false;
      const fechaObj = new Date(fecha);
      return fechaObj.getMonth() === mesActual && fechaObj.getFullYear() === añoActual;
    };
    
    // Filtrar solo pólizas del mes actual
    const expedientesMesActual = expedientes.filter(exp => {
      // Verificar si fue emitida en el mes actual
      const emitidaMesActual = esMesActual(exp.fecha_emision);
      // O si tiene movimiento de pago en el mes actual
      const pagoMesActual = esMesActual(exp.fecha_vencimiento_pago);
      
      return emitidaMesActual || pagoMesActual;
    });
    
    console.log('✅ Expedientes del mes actual:', expedientesMesActual.length);
    
    // PRIMAS EMITIDAS - Separar entre Venta Nueva y Renovación
    const polizasEmitidas = expedientesMesActual.filter(exp => 
      esMesActual(exp.fecha_emision) && (
        exp.etapa_activa === 'Pagado' || 
        exp.etapa_activa === 'Emitida' || 
        exp.etapa_activa === 'Pendiente de pago'
      )
    );
    
    const ventasNuevas = polizasEmitidas.filter(p => p.tipo_movimiento === 'nueva' || p.tipo_movimiento === 'Nueva');
    const renovaciones = polizasEmitidas.filter(p => p.tipo_movimiento === 'renovacion' || p.tipo_movimiento === 'Renovación');
    
    const primasVentasNuevas = ventasNuevas.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasRenovaciones = renovaciones.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasEmitidas = primasVentasNuevas + primasRenovaciones;
    
    console.log('💰 Ventas Nuevas:', ventasNuevas.length, '- $', primasVentasNuevas);
    console.log('🔄 Renovaciones:', renovaciones.length, '- $', primasRenovaciones);

    // PRIMAS POR VENCER - Separar mes actual y anteriores
    const polizasPorVencerTodas = expedientes.filter(p => 
      p.fecha_vencimiento_pago && p.estatusPago === 'Pago por vencer'
    );
    
    const porVencerMesActual = polizasPorVencerTodas.filter(p => esMesActual(p.fecha_vencimiento_pago));
    const porVencerAnteriores = polizasPorVencerTodas.filter(p => {
      const fechaVencimiento = new Date(p.fecha_vencimiento_pago);
      const ultimoDiaMesAnterior = new Date(añoActual, mesActual, 0);
      return fechaVencimiento <= ultimoDiaMesAnterior;
    });
    
    const primasPorVencerMesActual = porVencerMesActual.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasPorVencerAnteriores = porVencerAnteriores.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasPorVencerTotal = primasPorVencerMesActual + primasPorVencerAnteriores;
    
    console.log('⏰ Por Vencer Mes Actual:', porVencerMesActual.length, '- $', primasPorVencerMesActual);
    console.log('⏰ Por Vencer Anteriores:', porVencerAnteriores.length, '- $', primasPorVencerAnteriores);

    // PRIMAS VENCIDAS - Separar mes actual y anteriores
    const polizasVencidasTodas = expedientes.filter(p => 
      p.fecha_vencimiento_pago && p.estatusPago === 'Vencido'
    );
    
    const vencidasMesActual = polizasVencidasTodas.filter(p => esMesActual(p.fecha_vencimiento_pago));
    const vencidasAnteriores = polizasVencidasTodas.filter(p => {
      const fechaVencimiento = new Date(p.fecha_vencimiento_pago);
      const ultimoDiaMesAnterior = new Date(añoActual, mesActual, 0);
      return fechaVencimiento <= ultimoDiaMesAnterior;
    });
    
    const primasVencidasMesActual = vencidasMesActual.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasVencidasAnteriores = vencidasAnteriores.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );
    
    const primasVencidasTotal = primasVencidasMesActual + primasVencidasAnteriores;
    
    console.log('🚨 Vencidas Mes Actual:', vencidasMesActual.length, '- $', primasVencidasMesActual);
    console.log('🚨 Vencidas Anteriores:', vencidasAnteriores.length, '- $', primasVencidasAnteriores);

    // PRIMAS CANCELADAS - Cancelaciones del mes actual
    const polizasCanceladas = expedientesMesActual.filter(exp => {
      const canceladaMesActual = esMesActual(exp.fecha_cancelacion);
      return exp.etapa_activa === 'Cancelado' && canceladaMesActual;
    });
    
    const primasCanceladas = polizasCanceladas.reduce((sum, p) => 
      sum + (parseFloat(p.importe_total) || 0), 0
    );

    const stats = {
      primasEmitidas: {
        monto: primasEmitidas,
        cantidad: polizasEmitidas.length,
        ventasNuevas: {
          monto: primasVentasNuevas,
          cantidad: ventasNuevas.length
        },
        renovaciones: {
          monto: primasRenovaciones,
          cantidad: renovaciones.length
        }
      },
      primasPorVencer: {
        monto: primasPorVencerTotal,
        cantidad: porVencerMesActual.length + porVencerAnteriores.length,
        mesActual: {
          monto: primasPorVencerMesActual,
          cantidad: porVencerMesActual.length
        },
        anteriores: {
          monto: primasPorVencerAnteriores,
          cantidad: porVencerAnteriores.length
        }
      },
      primasVencidas: {
        monto: primasVencidasTotal,
        cantidad: vencidasMesActual.length + vencidasAnteriores.length,
        mesActual: {
          monto: primasVencidasMesActual,
          cantidad: vencidasMesActual.length
        },
        anteriores: {
          monto: primasVencidasAnteriores,
          cantidad: vencidasAnteriores.length
        }
      },
      primasCanceladas: {
        monto: primasCanceladas,
        cantidad: polizasCanceladas.length
      }
    };
    
    console.log('💰 Estadísticas calculadas (MES ACTUAL):', stats);
    return stats;
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
            transform: translateY(-2px);
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
          .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s ease-in-out infinite;
            border-radius: 4px;
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
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
                <button 
                  className="btn btn-sm" 
                  style={{ border: '1px solid #E5E7EB', background: 'white' }}
                  onClick={recargarDatos}
                  disabled={cargando}>
                  <RefreshCw size={14} className={`me-1 ${cargando ? 'spinner-border spinner-border-sm' : ''}`} />
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
          {/* SECCIÓN ECONÓMICA - Tarjetas Financieras */}
          <div className="mb-3">
            <h5 className="fw-bold mb-0" style={{ color: '#111827' }}>Panel Financiero</h5>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
              Resumen de primas del mes en curso ({new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })})
              {cargando && <span className="ms-2"><span className="spinner-border spinner-border-sm me-1" /> Cargando...</span>}
              {!cargando && expedientes.length > 0 && <span className="ms-2 text-success">• {expedientes.length} pólizas en base de datos</span>}
            </p>
          </div>

          <div className="row g-3 mb-4">
            {/* Primas Emitidas */}
            <div className="col-md-3">
              <div 
                className="executive-card p-3" 
                style={{ cursor: 'pointer' }}
                onClick={() => abrirDesglose('emitidas')}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileCheck size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Primas Emitidas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#3B82F6' }}>
                      ${estadisticasFinancieras.primasEmitidas.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#10B981' }}></span>
                      Nuevas: {estadisticasFinancieras.primasEmitidas.ventasNuevas.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#10B981', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasEmitidas.ventasNuevas.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#06B6D4' }}></span>
                      Renovaciones: {estadisticasFinancieras.primasEmitidas.renovaciones.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#06B6D4', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasEmitidas.renovaciones.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primas Por Vencer */}
            <div className="col-md-3">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer' }}
                onClick={() => abrirDesglose('porVencer')}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Clock size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Por Vencer
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#F59E0B' }}>
                      ${estadisticasFinancieras.primasPorVencer.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#F59E0B' }}></span>
                      Mes actual: {estadisticasFinancieras.primasPorVencer.mesActual.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasPorVencer.mesActual.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#D97706' }}></span>
                      Anteriores: {estadisticasFinancieras.primasPorVencer.anteriores.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#D97706', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasPorVencer.anteriores.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primas Vencidas */}
            <div className="col-md-3">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer' }}
                onClick={() => abrirDesglose('vencidas')}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Vencidas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#EF4444' }}>
                      ${estadisticasFinancieras.primasVencidas.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#EF4444' }}></span>
                      Mes actual: {estadisticasFinancieras.primasVencidas.mesActual.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasVencidas.mesActual.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      <span className="status-dot" style={{ background: '#DC2626' }}></span>
                      Anteriores: {estadisticasFinancieras.primasVencidas.anteriores.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '600' }}>
                      ${estadisticasFinancieras.primasVencidas.anteriores.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primas Canceladas */}
            <div className="col-md-3">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer' }}
                onClick={() => abrirDesglose('canceladas')}
              >
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <XCircle size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Canceladas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#6B7280' }}>
                      ${estadisticasFinancieras.primasCanceladas.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    {estadisticasFinancieras.primasCanceladas.cantidad} pólizas
                  </span>
                  <span className="metric-badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                    <X size={10} className="me-1" />
                    Perdidas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mensaje cuando no hay datos */}
          {!cargando && expedientes.length === 0 && (
            <div className="row g-3 mb-4">
              <div className="col-12">
                <div className="executive-card p-5 text-center">
                  <FileText size={48} className="text-muted mb-3" />
                  <h5 className="text-muted mb-2">No hay pólizas registradas</h5>
                  <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                    Comienza creando tu primera póliza para ver las estadísticas financieras
                  </p>
                  <button className="btn btn-primary btn-sm">
                    <Plus size={14} className="me-1" />
                    Crear Primera Póliza
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Próximamente: Más secciones del dashboard */}
          <div className="row g-3">
            <div className="col-12">
              <div className="executive-card p-4 text-center">
                <Activity size={48} className="text-muted mb-3" />
                <h5 className="text-muted">Secciones adicionales en desarrollo</h5>
                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                  Próximamente: Trámites, Pipeline de Ventas, y más métricas operativas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE DESGLOSE - Por Producto */}
      {modalDesglose && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setModalDesglose(null)}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              {/* Header del modal */}
              <div className="modal-header" style={{ background: modalDesglose.color, color: 'white' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-1">{modalDesglose.titulo}</h5>
                  <small style={{ opacity: 0.9 }}>
                    {modalDesglose.cantidadTotal} pólizas • ${modalDesglose.totalGeneral.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                  </small>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setModalDesglose(null)}>
                </button>
              </div>
              
              {/* Body del modal */}
              <div className="modal-body p-0">
                {Object.keys(modalDesglose.porProducto).length === 0 ? (
                  <div className="text-center py-5">
                    <FileText size={48} className="text-muted mb-3" />
                    <h6 className="text-muted">No hay pólizas en esta categoría</h6>
                  </div>
                ) : (
                  Object.entries(modalDesglose.porProducto).map(([producto, data], idx) => (
                    <div key={idx} className="border-bottom">
                      {/* Header por producto */}
                      <div className="p-3" style={{ background: '#F9FAFB' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <h6 className="mb-1 fw-bold" style={{ color: '#111827' }}>
                              <Package size={18} className="me-2" style={{ color: modalDesglose.color }} />
                              {producto}
                            </h6>
                            <small className="text-muted">
                              {data.cantidad} póliza{data.cantidad !== 1 ? 's' : ''}
                            </small>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold" style={{ color: modalDesglose.color, fontSize: '18px' }}>
                              ${data.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                            </div>
                            <small className="text-muted">Total</small>
                          </div>
                        </div>
                      </div>

                      {/* Tabla de pólizas */}
                      <div className="table-responsive">
                        <table className="table table-hover mb-0 compact-table">
                          <thead>
                            <tr>
                              <th>Póliza</th>
                              <th>Cliente</th>
                              <th>Aseguradora</th>
                              <th>Fecha Emisión</th>
                              {modalDesglose.tipo !== 'emitidas' && <th>Fecha Vencimiento</th>}
                              <th>Estado</th>
                              <th className="text-end">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.polizas.map((poliza, pIdx) => (
                              <tr key={pIdx} className="data-row">
                                <td>
                                  <span className="fw-semibold" style={{ color: '#111827' }}>
                                    {poliza.numero_poliza || 'Sin número'}
                                  </span>
                                </td>
                                <td>
                                  <div>
                                    <div className="fw-medium" style={{ fontSize: '13px' }}>
                                      {poliza.cliente_nombre || 'Sin nombre'}
                                    </div>
                                    <small className="text-muted">
                                      {poliza.cliente_id}
                                    </small>
                                  </div>
                                </td>
                                <td>{poliza.aseguradora || '-'}</td>
                                <td>
                                  <small>
                                    {poliza.fecha_emision 
                                      ? new Date(poliza.fecha_emision).toLocaleDateString('es-MX')
                                      : '-'
                                    }
                                  </small>
                                </td>
                                {modalDesglose.tipo !== 'emitidas' && (
                                  <td>
                                    <small>
                                      {poliza.fecha_vencimiento_pago 
                                        ? new Date(poliza.fecha_vencimiento_pago).toLocaleDateString('es-MX')
                                        : '-'
                                      }
                                    </small>
                                  </td>
                                )}
                                <td>
                                  <span className={`badge ${
                                    poliza.etapa_activa === 'Pagado' ? 'bg-success' :
                                    poliza.etapa_activa === 'Emitida' ? 'bg-info' :
                                    poliza.etapa_activa === 'Pendiente de pago' ? 'bg-warning' :
                                    poliza.etapa_activa === 'Cancelado' ? 'bg-secondary' :
                                    'bg-primary'
                                  }`} style={{ fontSize: '10px' }}>
                                    {poliza.etapa_activa || poliza.estatusPago || 'Sin estado'}
                                  </span>
                                  {poliza.tipo_movimiento && (
                                    <div>
                                      <small className="text-muted" style={{ fontSize: '10px' }}>
                                        {poliza.tipo_movimiento}
                                      </small>
                                    </div>
                                  )}
                                </td>
                                <td className="text-end">
                                  <span className="fw-bold" style={{ color: modalDesglose.color }}>
                                    ${parseFloat(poliza.importe_total || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ background: '#F9FAFB' }}>
                            <tr>
                              <td colSpan={modalDesglose.tipo !== 'emitidas' ? 6 : 5} className="text-end fw-bold">
                                Subtotal {producto}:
                              </td>
                              <td className="text-end fw-bold" style={{ color: modalDesglose.color }}>
                                ${data.total.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Footer del modal */}
              <div className="modal-footer" style={{ background: '#F9FAFB' }}>
                <div className="d-flex justify-content-between w-100 align-items-center">
                  <div>
                    <strong style={{ fontSize: '16px', color: '#111827' }}>Total General:</strong>
                    <span className="ms-2 text-muted">{modalDesglose.cantidadTotal} pólizas</span>
                  </div>
                  <h4 className="mb-0 fw-bold" style={{ color: modalDesglose.color }}>
                    ${modalDesglose.totalGeneral.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE - Comentado temporalmente */}
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

/**
 * ====================================================================
 * COMPONENTE: Gestión de Expedientes (Pólizas)
 * TRAZABILIDAD COMPLETA DEL CICLO DE VIDA
 * ====================================================================
 * 
 * FLUJO DE EVENTOS REGISTRADOS EN HISTORIAL:
 * 
 * 1️⃣ COTIZACIÓN CREADA (COTIZACION_CREADA)
 *    - Al crear nuevo expediente vía POST /api/expedientes
 *    - Línea ~6309: registrarEvento con tipo COTIZACION_CREADA
 * 
 * 2️⃣ CAMBIOS DE ETAPA (vía registrarCambioEtapa automático)
 *    - 'En cotización' → COTIZACION_CREADA
 *    - 'Cotización enviada' → COTIZACION_ENVIADA
 *    - 'Autorizado' → COTIZACION_AUTORIZADA
 *    - 'En proceso emisión' → EMISION_INICIADA
 *    - 'Emitida' → POLIZA_EMITIDA
 *    - 'Enviada al Cliente' → POLIZA_ENVIADA_EMAIL (si manual)
 *    - 'Renovada' → POLIZA_RENOVADA
 *    - 'Cancelada' → POLIZA_CANCELADA
 *    - Línea ~5151: función cambiarEstadoExpediente llama registrarCambioEtapa
 *    - Línea ~6260: al editar expediente detecta cambio de etapa
 * 
 * 3️⃣ ENVÍO AL CLIENTE (POLIZA_ENVIADA_EMAIL / POLIZA_ENVIADA_WHATSAPP)
 *    - Al compartir póliza por Email: línea ~5466
 *    - Al compartir póliza por WhatsApp: línea ~5365
 *    - Ambos llaman registrarEnvioDocumento con destinatario y mensaje
 * 
 * 4️⃣ PAGOS REGISTRADOS (PAGO_REGISTRADO)
 *    - Al aplicar pago con comprobante: línea ~5730
 *    - Incluye monto, siguiente vencimiento, nombre archivo, nuevo estatus
 * 
 * 5️⃣ ACTUALIZACIONES DE DATOS (DATOS_ACTUALIZADOS)
 *    - Al editar expediente SIN cambio de etapa: línea ~6260
 *    - Incluye número de póliza y marcador de campos modificados
 * 
 * SERVICIOS UTILIZADOS:
 * - historialExpedienteService.js: 26 tipos de eventos, helpers para etapas y envíos
 * - TimelineExpediente.jsx: Visualización del historial con filtros y exportación
 * - DetalleExpediente.jsx: Integra TimelineExpediente en acordeón de historial
 * 
 * BASE DE DATOS:
 * - Tabla: historial_expedientes (expediente_id, tipo_evento, etapa_anterior, 
 *   etapa_nueva, usuario_id, descripcion, datos_adicionales JSON, metodo_contacto,
 *   destinatario, documento_url, fecha_evento)
 * 
 * PENDIENTES:
 * - TODO: Reemplazar usuario_nombre 'Sistema' por usuario autenticado actual
 * - TODO: Capturar diferencias exactas de campos en DATOS_ACTUALIZADOS
 * ====================================================================
 */

const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X, XCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Save, Upload, CheckCircle, Loader, Share2, Mail, Bell, Clock } from 'lucide-react';
import DetalleExpediente from '../components/DetalleExpediente';
import BuscadorCliente from '../components/BuscadorCliente';
import ModalCapturarContacto from '../components/ModalCapturarContacto';
import { obtenerAgentesEquipo } from '../services/equipoDeTrabajoService';
import { obtenerTiposProductosActivos } from '../services/tiposProductosService';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfService from '../services/pdfService';
import * as notificacionesService from '../services/notificacionesService';
import * as clientesService from '../services/clientesService';
import * as historialService from '../services/historialExpedienteService';
import TimelineExpediente from '../components/TimelineExpediente';

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

// ============= CONSTANTES GLOBALES =============
const CONSTANTS = {
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  VIN_LENGTH: 17,
  DIAS_EN_AÑO: 365,
  PAGOS_POR_FRECUENCIA: {
    'Mensual': 12,
    'Trimestral': 4,
    'Semestral': 2
  },
  MESES_POR_FRECUENCIA: {
    'Mensual': 1,
    'Trimestral': 3,
    'Semestral': 6
  }
};

// ============= UTILIDADES =============
const utils = {
  formatearFecha: (fecha, formato = 'corta') => {
    if (!fecha) return '-';
    
    // 🔥 Crear fecha en hora local para evitar problemas de timezone
    let fechaObj;
    if (typeof fecha === 'string' && fecha.includes('-')) {
      const [year, month, day] = fecha.split('-');
      fechaObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      fechaObj = new Date(fecha);
    }
    
    const opciones = {
      corta: { day: '2-digit', month: 'short' },
      cortaY: { day: '2-digit', month: 'short', year: 'numeric' },
      media: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
      larga: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    };
    return fechaObj.toLocaleDateString('es-MX', opciones[formato]);
  },

  formatearMoneda: (monto) => {
    if (!monto) return '-';
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(monto);
  },

  getBadgeClass: (tipo, valor) => {
    const mapas = {
      etapa: {
        'Pagado': 'bg-success',
        'Cancelado': 'bg-danger',
        'Emitida': 'bg-info',
        'Autorizado': 'bg-primary',
        'Cotización enviada': 'bg-warning',
        'En proceso emisión': 'bg-info',
        'Pendiente de pago': 'bg-warning'
      },
      pago: {
        'Pagado': 'bg-success',
        'Vencido': 'bg-danger',
        'Pago por vencer': 'bg-warning',
        'Sin definir': 'bg-secondary'
      },
      tipo_pago: {
        'Fraccionado': 'bg-info',
        'Anual': 'bg-primary'
      }
    };
    return mapas[tipo]?.[valor] || 'bg-secondary';
  },

  calcularDiasRestantes: (fecha) => {
    if (!fecha) return null;
    
    // 🔥 Crear fechas en hora local para evitar problemas de timezone
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    let fechaObjetivo;
    if (typeof fecha === 'string' && fecha.includes('-')) {
      const [year, month, day] = fecha.split('-');
      fechaObjetivo = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      fechaObjetivo = new Date(fecha);
    }
    fechaObjetivo.setHours(0, 0, 0, 0);
    
    return Math.ceil((fechaObjetivo - hoy) / (1000 * 60 * 60 * 24));
  }
};

// ============= COMPONENTES REUTILIZABLES =============

const Badge = React.memo(({ tipo, valor, className = '' }) => {
  const badgeClass = utils.getBadgeClass(tipo, valor);
  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {tipo === 'pago' && valor === 'Vencido' && '⚠️ '}
      {valor}
    </span>
  );
});

const CampoFechaCalculada = React.memo(({ 
  label, 
  value, 
  onChange, 
  onCalculate, 
  disabled = false,
  helpText = ''
}) => (
  <div>
    <label className="form-label">{label}</label>
    <div className="input-group">
      <input
        type="date"
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {onCalculate && (
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCalculate}
          title="Calcular automáticamente"
          disabled={disabled}
        >
          🤖
        </button>
      )}
    </div>
    {helpText && <small className="form-text text-muted">{helpText}</small>}
  </div>
));

const InfoCliente = React.memo(({ expediente, cliente }) => {
  // Mostrar SIEMPRE el nombre del cliente (asegurado/razón social) en la primera línea
  // Debajo, mostrar datos de contacto si existen; si no, datos del propio asegurado

  // 1) Nombre del cliente (asegurado)
  let nombreCliente = '';
  if (cliente) {
    if (cliente.razon_social || cliente.razonSocial) {
      nombreCliente = cliente.razon_social || cliente.razonSocial;
    } else {
      const n = cliente.nombre || '';
      const ap = cliente.apellido_paterno || cliente.apellidoPaterno || '';
      const am = cliente.apellido_materno || cliente.apellidoMaterno || '';
      nombreCliente = `${n} ${ap} ${am}`.trim();
    }
  } else {
    // Fallback si no hay cliente en mapa
    if (expediente.razon_social) {
      nombreCliente = expediente.razon_social;
    } else {
      nombreCliente = `${expediente.nombre || ''} ${expediente.apellido_paterno || ''} ${expediente.apellido_materno || ''}`.trim();
    }
  }

  // 2) Datos de contacto: preferir contacto principal; si no, usar datos del cliente
  const tieneContacto = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
  const contactoNombre = tieneContacto
    ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
    : '';
  const emailMostrar = tieneContacto
    ? (cliente?.contacto_email || cliente?.contactoEmail || '')
    : (cliente?.email || expediente.email || '');

  // Teléfonos: mostrar AMBOS si existen (móvil y fijo). Priorizar contacto_* y si no hay, caer a los del cliente
  const telContactoMovil = cliente?.contacto_telefono_movil || cliente?.contactoTelefonoMovil || '';
  const telContactoFijo = cliente?.contacto_telefono_fijo || cliente?.contactoTelefonoFijo || '';
  const telClienteMovil = cliente?.telefono_movil || cliente?.telefonoMovil || expediente.telefono_movil || '';
  const telClienteFijo = cliente?.telefono_fijo || cliente?.telefonoFijo || expediente.telefono_fijo || '';

  return (
    <div>
      <div className="fw-semibold">{nombreCliente || 'Sin nombre'}</div>
      {tieneContacto && contactoNombre && (
        <div><small className="text-muted">Contacto: {contactoNombre}</small></div>
      )}
      {emailMostrar && (
        <div><small className="text-muted">✉️ {emailMostrar}</small></div>
      )}
      {/* Teléfonos: si hay contacto, mostrar ambos (móvil y fijo). Si no hay contacto, caer a teléfonos del cliente */}
      {tieneContacto ? (
        (telContactoMovil || telContactoFijo) && (
          <div>
            <small className="text-muted">
              {telContactoMovil && (<><span>📱 {telContactoMovil}</span></>)}
              {telContactoMovil && telContactoFijo && <span> • </span>}
              {telContactoFijo && (<><span>☎️ {telContactoFijo}</span></>)}
            </small>
          </div>
        )
      ) : (
        (telClienteMovil || telClienteFijo) && (
          <div>
            <small className="text-muted">
              {telClienteMovil && (<><span>📱 {telClienteMovil}</span></>)}
              {telClienteMovil && telClienteFijo && <span> • </span>}
              {telClienteFijo && (<><span>☎️ {telClienteFijo}</span></>)}
            </small>
          </div>
        )
      )}
    </div>
  );
});

const EstadoPago = React.memo(({ expediente }) => (
  <div>
    <small className="fw-semibold text-primary">{expediente.tipo_pago || 'Sin definir'}</small>
    {expediente.frecuenciaPago && (
      <div><small className="text-muted">{expediente.frecuenciaPago}</small></div>
    )}
    <Badge tipo="pago" valor={expediente.estatusPago || 'Sin definir'} className="badge-sm" />
    {expediente.proximoPago && ((expediente.estatusPago || '').toLowerCase().trim() !== 'pagado' && (expediente.estatusPago || '').toLowerCase().trim() !== 'pagada') && (
      <div>
        <small className={`${
          expediente.estatusPago === 'Vencido' ? 'text-danger fw-bold' :
          expediente.estatusPago === 'Por Vencer' ? 'text-warning' :
          'text-muted'
        }`}>
          Pago: {utils.formatearFecha(expediente.proximoPago)}
        </small>
      </div>
    )}
  </div>
));

const CalendarioPagos = React.memo(({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false 
}) => {
  // Mostrar solo para tipo de pago Fraccionado y con datos básicos
  if (expediente.tipo_pago !== 'Fraccionado' || !expediente.frecuenciaPago || !expediente.inicio_vigencia) {
    return null;
  }

  const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[expediente.frecuenciaPago] || 0;
  const pagos = [];
  
  // 🔧 Obtener periodo de gracia del expediente o calcular según compañía (convertir a número)
  const periodoGracia = expediente.periodo_gracia 
    ? parseInt(expediente.periodo_gracia, 10)
    : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  console.log('📅 CALENDARIO - Periodo de gracia usado:', periodoGracia, '| Del expediente:', expediente.periodo_gracia, '| Tipo:', typeof expediente.periodo_gracia);
  
  // Determinar montos: usar primer_pago y pagos_subsecuentes si están disponibles, sino dividir el total
  const usarMontosExactos = expediente.primer_pago && expediente.pagos_subsecuentes;
  const primerPagoMonto = usarMontosExactos ? parseFloat(expediente.primer_pago) : null;
  const pagosSubsecuentesMonto = usarMontosExactos ? parseFloat(expediente.pagos_subsecuentes) : null;
  const montoPorDefecto = expediente.total ? (parseFloat(expediente.total) / numeroPagos).toFixed(2) : '---';
  
  for (let i = 1; i <= numeroPagos; i++) {
    const fechaPago = calcularProximoPago(
      expediente.inicio_vigencia,
      expediente.tipo_pago,
      expediente.frecuenciaPago,
      expediente.compania,
      i,
      periodoGracia  // 🔥 Pasar periodo de gracia del expediente
    );
    
    if (fechaPago) {
      // Calcular monto según si es primer pago o subsecuente
      let monto = montoPorDefecto;
      if (usarMontosExactos) {
        monto = (i === 1 ? primerPagoMonto : pagosSubsecuentesMonto).toFixed(2);
      }
      
      pagos.push({
        numero: i,
        fecha: fechaPago,
        monto: monto
      });
    }
  }

  const fechaUltimoPago = expediente.fechaUltimoPago ? new Date(expediente.fechaUltimoPago) : null;
  let totalPagado = 0;
  let totalPendiente = 0;
  let pagosRealizados = 0;

  const pagosProcesados = pagos.map((pago) => {
    // 🔥 Crear fecha en hora local para evitar problemas de timezone
    const [year, month, day] = pago.fecha.split('-');
    const fechaPago = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const diasRestantes = utils.calcularDiasRestantes(pago.fecha);
    
    let pagado = false;
    if (fechaUltimoPago && fechaPago <= fechaUltimoPago) {
      pagado = true;
      pagosRealizados++;
      totalPagado += parseFloat(pago.monto) || 0;
    } else {
      totalPendiente += parseFloat(pago.monto) || 0;
    }
    
    let estado = 'Por vencer';
    let badgeClass = 'bg-secondary';
    
    if (pagado) {
      estado = 'Pagado';
      badgeClass = 'bg-success';
    } else if (diasRestantes < 0) {
      estado = 'Vencido';
      badgeClass = 'bg-danger';
    } else if (diasRestantes === 0) {
      estado = 'Vence hoy';
      badgeClass = 'bg-danger';
    } else if (diasRestantes <= 7) {
      estado = `Vence en ${diasRestantes} días`;
      badgeClass = 'bg-warning';
    } else if (diasRestantes <= 30) {
      estado = 'Próximo';
      badgeClass = 'bg-info';
    }
    
    return { ...pago, estado, badgeClass, pagado };
  });

  if (compacto) {
    return (
      <div className="mt-1">
        <small className="text-info">
          📊 {pagosRealizados}/{numeroPagos} pagos
        </small>
      </div>
    );
  }

  return (
    <div className="card border-primary">
      <div className="card-header bg-primary text-white">
        <h6 className="mb-0">
          📅 Calendario de Pagos - {expediente.frecuenciaPago}
          <small className="ms-2">({numeroPagos} pagos en el año)</small>
        </h6>
      </div>
      <div className="card-body p-3">
        {mostrarResumen && (
          <div className="row mb-3">
            <div className="col-md-3">
              <div className="card bg-light">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Total Anual</h6>
                  <h4 className="mb-0 text-primary">{utils.formatearMoneda(expediente.total)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Pagado</h6>
                  <h4 className="mb-0">{utils.formatearMoneda(totalPagado)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Pendiente</h6>
                  <h4 className="mb-0">{utils.formatearMoneda(totalPendiente)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Progreso</h6>
                  <h4 className="mb-0">{pagosRealizados}/{numeroPagos}</h4>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th width="80">Pago #</th>
                <th>Fecha de Pago</th>
                <th>Monto</th>
                <th width="150">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagosProcesados.map((pago) => (
                <tr key={pago.numero} className={pago.pagado ? 'table-success' : ''}>
                  <td><strong>#{pago.numero}</strong></td>
                  <td>{utils.formatearFecha(pago.fecha, 'larga')}</td>
                  <td><strong>${pago.monto}</strong></td>
                  <td>
                    <span className={`badge ${pago.badgeClass}`}>
                      {pago.pagado && '✓ '}
                      {pago.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {expediente.total && (
              <tfoot>
                <tr className="table-info">
                  <td colSpan="2" className="text-end"><strong>Total Anual:</strong></td>
                  <td colSpan="2"><strong>{utils.formatearMoneda(expediente.total)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});

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

// ============= COMPONENTE EXTRACTOR PDF =============
const ExtractorPolizasPDF = React.memo(({ onDataExtracted, onClose, agentes = [], aseguradoras = [], tiposProductos = [] }) => {
  const [estado, setEstado] = useState('esperando'); // esperando, procesando, validando-cliente, validando-agente, preview-datos, error, capturando-rfc
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [informacionArchivo, setInformacionArchivo] = useState(null);
  
  // Estados para el flujo paso a paso
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [agenteEncontrado, setAgenteEncontrado] = useState(null);
  const [decisionCliente, setDecisionCliente] = useState(null); // 'usar-existente', 'crear-nuevo'
  const [decisionAgente, setDecisionAgente] = useState(null); // 'usar-existente', 'crear-nuevo', 'omitir'
  
  // Estados para captura de RFC
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');

  const procesarPDF = useCallback(async (file) => {
    setEstado('procesando');
    setErrores([]);

    try {
      // Extraer texto del PDF usando PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extraer PÁGINAS 1 Y 2 (algunos datos están en página 1)
      console.log('📄 Total de páginas:', pdf.numPages);
      
      if (pdf.numPages < 2) {
        throw new Error('El PDF debe tener al menos 2 páginas');
      }
      
      // PÁGINA 1: Póliza, Endoso, Inciso, Agente
      const page1 = await pdf.getPage(1);
      const textContent1 = await page1.getTextContent();
      
      const lineas1 = {};
      textContent1.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineas1[y]) lineas1[y] = [];
        lineas1[y].push({
          text: item.str,
          x: item.transform[4]
        });
      });
      
      const textoPagina1 = Object.keys(lineas1)
        .sort((a, b) => b - a)
        .map(y => {
          return lineas1[y]
            .sort((a, b) => a.x - b.x)
            .map(item => item.text)
            .join(' ');
        })
        .join('\n');
      
      // PÁGINA 2: Resto de datos
      const page2 = await pdf.getPage(2);
      const textContent = await page2.getTextContent();
      
      const lineas = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineas[y]) lineas[y] = [];
        lineas[y].push({
          text: item.str,
          x: item.transform[4]
        });
      });
      
      const textoCompleto = Object.keys(lineas)
        .sort((a, b) => b - a)
        .map(y => {
          return lineas[y]
            .sort((a, b) => a.x - b.x)
            .map(item => item.text)
            .join(' ');
        })
        .join('\n');
      
      // TAMBIÉN extraer TODO el texto sin ordenar por posición (captura mejor texto en cuadros)
      const textoCompletoSinOrdenar = textContent.items.map(item => item.str).join(' ');

      console.log('📄 Texto página 1 (primeras 20 líneas):\n', textoPagina1.split('\n').slice(0, 20).join('\n'));
      console.log('📄 Texto página 2 (primeras 50 líneas):\n', textoCompleto.split('\n').slice(0, 50).join('\n'));
      console.log('📄 Texto página 2 (ÚLTIMAS 50 líneas):\n', textoCompleto.split('\n').slice(-50).join('\n'));
      
      // DEBUG: Buscar si "TRIMESTRAL" aparece en alguna página
      console.log('🔍 BUSCAR TRIMESTRAL en pág 1:', textoPagina1.includes('TRIMESTRAL') ? '✅ SÍ' : '❌ NO');
      console.log('🔍 BUSCAR TRIMESTRAL en pág 2:', textoCompleto.includes('TRIMESTRAL') ? '✅ SÍ' : '❌ NO');
      console.log('🔍 BUSCAR TRIMESTRAL en texto sin ordenar:', textoCompletoSinOrdenar.includes('TRIMESTRAL') ? '✅ SÍ' : '❌ NO');
      
      // Si existe, mostrar contexto
      if (textoCompleto.includes('TRIMESTRAL')) {
        const idx = textoCompleto.indexOf('TRIMESTRAL');
        console.log('📍 Contexto de TRIMESTRAL (ordenado):', textoCompleto.substring(Math.max(0, idx - 100), idx + 100));
      }
      if (textoCompletoSinOrdenar.includes('TRIMESTRAL')) {
        const idx = textoCompletoSinOrdenar.indexOf('TRIMESTRAL');
        console.log('📍 Contexto de TRIMESTRAL (sin ordenar):', textoCompletoSinOrdenar.substring(Math.max(0, idx - 100), idx + 100));
      }
      if (textoPagina1.includes('TRIMESTRAL')) {
        const idx = textoPagina1.indexOf('TRIMESTRAL');
        console.log('📍 Contexto de TRIMESTRAL (pág 1):', textoPagina1.substring(Math.max(0, idx - 100), idx + 100));
      }

      // Buscar cliente por RFC, CURP o nombre en la base de datos
      const buscarClienteExistente = async (rfc, curp, nombre, apellidoPaterno, apellidoMaterno) => {
        try {
          console.log('🔍 Buscando cliente con:', { rfc, curp, nombre, apellidoPaterno, apellidoMaterno });
          
          const response = await fetch(`${API_URL}/api/clientes`);
          if (!response.ok) {
            console.error('❌ Error al obtener clientes:', response.status);
            return null;
          }
          
          const clientes = await response.json();
          console.log(`📊 Total de clientes en BD: ${clientes.length}`);
          
          // 1. PRIORIDAD 1: Buscar por RFC (más confiable)
          if (rfc && rfc.trim() !== '') {
            const rfcBusqueda = rfc.trim().toUpperCase();
            console.log(`🔍 Buscando por RFC: "${rfcBusqueda}"`);
            
            const clientePorRFC = clientes.find(c => {
              const rfcCliente = (c.rfc || '').trim().toUpperCase();
              return rfcCliente === rfcBusqueda;
            });
            
            if (clientePorRFC) {
              console.log('✅ Cliente encontrado por RFC:', clientePorRFC.id, clientePorRFC.nombre);
              return clientePorRFC;
            } else {
              console.log('⚠️ No se encontró cliente con RFC:', rfcBusqueda);
            }
          }
          
          // 2. PRIORIDAD 2: Buscar por CURP (si no hay RFC)
          if (curp && curp.trim() !== '') {
            const curpBusqueda = curp.trim().toUpperCase();
            console.log(`🔍 Buscando por CURP: "${curpBusqueda}"`);
            
            const clientePorCURP = clientes.find(c => {
              const curpCliente = (c.curp || '').trim().toUpperCase();
              return curpCliente === curpBusqueda;
            });
            
            if (clientePorCURP) {
              console.log('✅ Cliente encontrado por CURP:', clientePorCURP.id, clientePorCURP.nombre);
              return clientePorCURP;
            } else {
              console.log('⚠️ No se encontró cliente con CURP:', curpBusqueda);
            }
          }
          
          // 3. PRIORIDAD 3: Buscar por nombre completo (último recurso)
          if (nombre && apellidoPaterno) {
            const nombreBusqueda = nombre.trim().toUpperCase();
            const apellidoPaternoBusqueda = apellidoPaterno.trim().toUpperCase();
            const apellidoMaternoBusqueda = apellidoMaterno ? apellidoMaterno.trim().toUpperCase() : '';
            
            console.log(`🔍 Buscando por nombre: "${nombreBusqueda} ${apellidoPaternoBusqueda} ${apellidoMaternoBusqueda}"`);
            
            const clientePorNombre = clientes.find(c => {
              const nombreCliente = (c.nombre || '').trim().toUpperCase();
              const apellidoPaternoCliente = (c.apellido_paterno || c.apellidoPaterno || '').trim().toUpperCase();
              const apellidoMaternoCliente = (c.apellido_materno || c.apellidoMaterno || '').trim().toUpperCase();
              
              const coincideNombre = nombreCliente === nombreBusqueda;
              const coincidePaterno = apellidoPaternoCliente === apellidoPaternoBusqueda;
              const coincideMaterno = !apellidoMaternoBusqueda || 
                                     !apellidoMaternoCliente || 
                                     apellidoMaternoCliente === apellidoMaternoBusqueda;
              
              return coincideNombre && coincidePaterno && coincideMaterno;
            });
            
            if (clientePorNombre) {
              console.log('✅ Cliente encontrado por nombre:', clientePorNombre.id, clientePorNombre.nombre);
              return clientePorNombre;
            } else {
              console.log('⚠️ No se encontró cliente con ese nombre');
            }
          }
          
          console.log('❌ Cliente NO encontrado con ningún criterio');
          return null;
        } catch (error) {
          console.error('❌ Error buscando cliente:', error);
          return null;
        }
      };

      // Función para extraer datos usando expresiones regulares
      const extraerDato = (patron, texto, grupo = 1) => {
        try {
          const match = texto.match(patron);
          return match && match[grupo] ? match[grupo].trim() : '';
        } catch (error) {
          console.warn('Error en extraerDato:', error, 'Patrón:', patron);
          return '';
        }
      };

      // Detectar el tipo de aseguradora
      const esQualitas = /qu[aá]litas/i.test(textoCompleto);
      const compania = esQualitas ? 'Qualitas' : 
                       /gnp/i.test(textoCompleto) ? 'GNP' :
                       /mapfre/i.test(textoCompleto) ? 'MAPFRE' :
                       /axa/i.test(textoCompleto) ? 'AXA' :
                       /hdi/i.test(textoCompleto) ? 'HDI' : 'Otra';

      console.log('🏢 Aseguradora detectada:', compania);

      // Extraer datos específicos para Qualitas
      let datosExtraidos = {};
      
      if (esQualitas) {
        console.log('🎯 Aplicando extractor especializado para Qualitas (página 2)');
        
        // ==================== MESES (definir primero) ====================
        const meses = {
          'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
          'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
        };
        
        // ==================== RFC (PRIMERO - para determinar tipo de persona) ====================
        // RFC puede ser:
        // - Persona Física: 4 letras + 6 dígitos + 3 caracteres (AAAA######XXX) - 13 caracteres
        // Persona Moral: 3 letras + 6 dígitos + 3 caracteres (AAA######XXX) - 12 caracteres
        const rfcMatch = textoCompleto.match(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
        let rfcExtraido = rfcMatch ? rfcMatch[1] : '';
        
        // ✅ Si no se encuentra RFC, continuar de todos modos (lo pediremos después si es necesario)
        if (!rfcExtraido || rfcExtraido.trim() === '') {
          console.warn('⚠️ RFC no encontrado en el PDF. Se solicitará después si es necesario.');
          rfcExtraido = ''; // Dejar vacío, se manejará después
        }
        
        const tipoPersona = rfcExtraido.length === 13 ? 'Fisica' : rfcExtraido.length === 12 ? 'Moral' : 'Fisica';
        
        console.log('🔍 RFC extraído:', rfcExtraido, '- Longitud:', rfcExtraido.length, '- Tipo:', tipoPersona);
        
        // ==================== INFORMACIÓN DEL ASEGURADO (según tipo de persona) ====================
        let nombre = '';
        let apellido_paterno = '';
        let apellido_materno = '';
        let razonSocial = '';
        
        const nombreMatch = textoCompleto.match(/INFORMACI[OÓ]N\s+DEL\s+ASEGURADO\s+([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,10})(?=\s*Domicilio|\s*\n)/i);
        if (nombreMatch) {
          const nombreCompleto = nombreMatch[1].trim();
          
          if (tipoPersona === 'Moral') {
            // Persona Moral: TODO es razón social
            razonSocial = nombreCompleto;
            console.log('🏢 Razón Social (Persona Moral):', razonSocial);
          } else {
            // Persona Física: Separar en nombre y apellidos
            const palabras = nombreCompleto.split(/\s+/);
            console.log('📝 Palabras del nombre (Persona Física):', palabras);
            
            if (palabras.length === 4) {
              nombre = `${palabras[0]} ${palabras[1]}`;
              apellido_paterno = palabras[2];
              apellido_materno = palabras[3];
            } else if (palabras.length === 3) {
              nombre = palabras[0];
              apellido_paterno = palabras[1];
              apellido_materno = palabras[2];
            } else if (palabras.length === 2) {
              nombre = palabras[0];
              apellido_paterno = palabras[1];
            } else {
              nombre = palabras[0] || nombreCompleto;
            }
            console.log('👤 Nombre (Persona Física):', { nombre, apellido_paterno, apellido_materno });
          }
        }
        
        // ==================== DOMICILIO COMPLETO ====================
        // Capturar solo hasta antes de "R.F.C:" para evitar incluir el RFC
        const domicilioMatch = textoCompleto.match(/Domicilio:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,\.#\-]+?)(?=\s*R\.F\.C\.|C\.P\.|Estado:|\n\n)/i);
        const domicilio = domicilioMatch ? domicilioMatch[1].trim() : '';
        console.log('🏠 Domicilio extraído:', domicilio);
        
        // ==================== MUNICIPIO, COLONIA, ESTADO, CP Y PAÍS ====================
        // En pólizas de Qualitas, después del domicilio vienen:
        // C.P.: xxxxx Municipio: NOMBRE_MUNICIPIO Estado: NOMBRE_ESTADO Colonia: NOMBRE_COLONIA
        const cpMatch = textoCompleto.match(/C\.P\.:\s*(\d{5})/i);
        const municipioMatch = textoCompleto.match(/Municipio:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Estado:|\n)/i);
        const estadoMatch = textoCompleto.match(/Estado:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Colonia:|\n)/i);
        const coloniaMatch = textoCompleto.match(/Colonia:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s|$|\n)/i);
        const paisMatch = textoCompleto.match(/Pa[ií]s:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s|$|\n)/i);
        
        const cp = cpMatch ? cpMatch[1] : '';
        const municipio = municipioMatch ? municipioMatch[1].trim() : '';
        const estado = estadoMatch ? estadoMatch[1].trim() : '';
        const colonia = coloniaMatch ? coloniaMatch[1].trim() : '';
        const pais = paisMatch ? paisMatch[1].trim() : 'MEXICO';
        
        console.log('📍 Datos de ubicación extraídos:');
        console.log('   - CP:', cp);
        console.log('   - Municipio:', municipio);
        console.log('   - Estado:', estado);
        console.log('   - Colonia:', colonia);
        console.log('   - País:', pais);
        
        // ==================== AGENTE (buscar en ambas páginas) ====================
        let agente = '';
        const agenteMatch1 = textoPagina1.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
        const agenteMatch2 = textoCompleto.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
        
        if (agenteMatch1) {
          agente = `${agenteMatch1[1]} - ${agenteMatch1[2].trim()}`;
          console.log('✅ Agente (pág 1):', agente);
        } else if (agenteMatch2) {
          agente = `${agenteMatch2[1]} - ${agenteMatch2[2].trim()}`;
          console.log('✅ Agente (pág 2):', agente);
        }
        
        // ==================== PÓLIZA (buscar en ambas páginas) ====================
        // Formato: POLIZA    ENDOSO    INCISO
        //          POLIZA DE SEGURO DE AUTOMOVILES  
        //          0971413763  000000    0001
        let polizaNum = '', endosoNum = '', incisoNum = '';
        
        // Buscar patrón simple: 10 dígitos + 6 dígitos + 4 dígitos en una línea
        const lineaNumeros2 = textoCompleto.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
        const lineaNumeros1 = textoPagina1.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
        
        if (lineaNumeros2) {
          polizaNum = lineaNumeros2[1];
          endosoNum = lineaNumeros2[2];
          incisoNum = lineaNumeros2[3];
          console.log('✅ Póliza extraída (pág 2):', { polizaNum, endosoNum, incisoNum });
        } else if (lineaNumeros1) {
          polizaNum = lineaNumeros1[1];
          endosoNum = lineaNumeros1[2];
          incisoNum = lineaNumeros1[3];
          console.log('✅ Póliza extraída (pág 1):', { polizaNum, endosoNum, incisoNum });
        } else {
          console.log('⚠️ No se encontró línea con 10+6+4 dígitos');
        }
        
        const planMatch = textoCompleto.match(/PLAN:\s*([A-Z]+)/i) || textoPagina1.match(/PLAN:\s*([A-Z]+)/i);
        
        // ==================== RFC ====================
        
        // ==================== CURP (solo para Persona Física) ====================
        const curpMatch = textoCompleto.match(/C\.?\s*U\.?\s*R\.?\s*P\.?\s*[:.\s]*([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2})/i);
        
  // ==================== VEHÍCULO ====================
  // Algunos códigos de vehículo vienen con 3, 4, 5 o 6 dígitos. El patrón anterior esperaba exactamente 5.
  // Ejemplos observados: "394 HONDA CIVIC ...", "0971462991 PORSCHE CAYENNE ..." (en otras pólizas el código puede ser largo).
  // Ampliamos el rango y permitimos puntos y guiones en el modelo.
  const descripcionMatch = textoCompleto.match(/(\d{3,6})\s*\(?[A-Z0-9]*\)?\s*([A-Z]+)\s+([A-Z0-9\s\-\.]+?)(?=Tipo:|Serie:|Motor:|Modelo:|$)/i);
  const serieMatch = textoCompleto.match(/Serie[:\s]+([A-Z0-9]{17})/i);
  const motorMatch = textoCompleto.match(/Motor[:\s]+([A-Z0-9\-]{3,})(?=\s|$)/i);
  const modeloAnioMatch = textoCompleto.match(/Modelo:\s*(\d{4})/i);
        
        // MEJORAR EXTRACCIÓN DE PLACAS - Excluir palabras como VIGENCIA
        // Las placas en México suelen tener formato: 3 letras + 3 números (ABC123) o 3 letras + 2 números + 1 letra (ABC12D)
        // También pueden tener guiones: ABC-123 o ABC-12-D
        let placasExtraidas = '';
        const placasMatch = textoCompleto.match(/Placas:\s*([A-Z0-9\-]{3,10})(?=\s|$|\n)/i);
        if (placasMatch) {
          const posiblePlaca = placasMatch[1].toUpperCase();
          // Validar que no sea una palabra común o tenga un formato razonable de placa
          // Placas válidas: ABC123, ABC-123, ABC12D, etc.
          // Excluir: VIGENCIA, AMPARADA, NA, SIN, NINGUNA, palabras largas
          const esPlacaValida = posiblePlaca.length >= 3 && 
                                posiblePlaca.length <= 10 && 
                                !/^(VIGENCIA|AMPARADA|NA|N\/A|SIN|NINGUNA|TEMPORAL|PENDIENTE)$/i.test(posiblePlaca);
          
          if (esPlacaValida) {
            placasExtraidas = posiblePlaca;
            console.log('✅ Placas extraídas:', placasExtraidas);
          } else {
            console.log('⚠️ Placas rechazadas (no válida):', posiblePlaca);
          }
        } else {
          console.log('⚠️ No se encontró patrón de placas en el PDF');
        }
        
        const colorMatch = textoCompleto.match(/Color:\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)*?)(?=\s+Placas|\s+Ocupantes|\n|$)/i);
        
        // =============== EXTRACCIÓN MARCA / MODELO ===============
        // Estrategia escalonada: patrón principal -> alternativo -> fallback por marcas conocidas.
        let marca = '';
        let modeloCompleto = '';

        if (descripcionMatch) {
          marca = descripcionMatch[2];
          modeloCompleto = descripcionMatch[3].trim();
          console.log('🚗 Extracción vehículo (principal) OK:', { marca, modeloCompleto });
        } else {
          const altMatch = textoCompleto.match(/\d{3,6}\s*\(?[A-Z0-9]*\)?\s*([A-Z]+)\s+([A-Z0-9\s\-\.]+?)(?=\s*Tipo:|\s*Serie:|Motor:|Modelo:|\n)/i);
          if (altMatch) {
            marca = altMatch[1];
            modeloCompleto = altMatch[2].trim();
            console.log('🚗 Extracción vehículo (alternativa) OK:', { marca, modeloCompleto });
          } else {
            // Fallback: buscar línea que contenga una marca conocida seguida de más texto antes de "Tipo:" o "Serie:".
            const marcasFallback = [
              'AUDI','BMW','CHEVROLET','CHRYSLER','DODGE','FIAT','FORD','HONDA','HYUNDAI','JEEP','KIA','MAZDA','MERCEDES','MERCEDES-BENZ','MITSUBISHI','NISSAN','PEUGEOT','PORSCHE','RENAULT','SEAT','SUZUKI','TOYOTA','VOLKSWAGEN','VOLVO'
            ];
            const marcasRegex = new RegExp(`\\b(${marcasFallback.join('|')})\\b\\s+([A-Z0-9][A-Z0-9\\s\-\.]{3,})`, 'i');
            const fallbackMatch = textoCompleto.match(marcasRegex);
            if (fallbackMatch) {
              marca = fallbackMatch[1];
              // Cortar el modelo antes de palabras clave si aparecen
              modeloCompleto = fallbackMatch[2]
                .split(/\s+(?:Tipo:|Serie:|Motor:|Modelo:)/i)[0]
                .trim();
              console.log('🚗 Extracción vehículo (fallback) OK:', { marca, modeloCompleto });
            } else {
              console.log('⚠️ No se pudo extraer marca/modelo con ninguno de los patrones');
            }
          }
        }
        
        console.log('🚗 Marca extraída:', marca);
        console.log('🚗 Modelo extraído:', modeloCompleto);
        console.log('🚗 Placas extraídas:', placasExtraidas);
        
        // ==================== VIGENCIA ====================
  const desdeMatch = textoCompleto.match(/Desde\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
  const hastaMatch = textoCompleto.match(/Hasta\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
        
        // ==================== PERIODO DE GRACIA ====================
        // Extraer solo el periodo de gracia, el formulario calculará las fechas de pago
        const plazoMatch = textoCompleto.match(/Plazo\s+de\s+pago:\s*(\d+)\s*d[ií]as/i);
        const periodoGraciaExtraido = plazoMatch ? plazoMatch[1] : '14'; // Default 14 si no se encuentra
        
        console.log('📅 Periodo de gracia extraído:', plazoMatch ? `${plazoMatch[1]} días` : 'NO ENCONTRADO (usando 14 por defecto)');

        // ==================== FORMA DE PAGO Y PARCIALES ====================
        // En Qualitas, la forma de pago aparece DESPUÉS de "Gastos por Expedición" y ANTES de "Pago:"
        // Puede ser: TRIMESTRAL, MENSUAL, SEMESTRAL, ANUAL, CONTADO, etc.
        
        console.log('🔍 DEBUG - Buscando forma de pago entre "Gastos" y "Pago:"...');
        
        // Buscar en textoCompleto (que YA sabemos que contiene TRIMESTRAL según los logs)
        const seccionGastosAPago = textoCompleto.match(/Gastos\s+por\s+Expedici[oó]n[.\s]+[\d,]+\.?\d*\s+([\s\S]{0,100}?)Pago:/i);
        
        let formaPagoEncontrada = null;
        
        if (seccionGastosAPago) {
          const textoEntreGastosYPago = seccionGastosAPago[1].trim();
          console.log('🔍 DEBUG - Texto entre "Gastos Expedición" y "Pago:":', textoEntreGastosYPago);
          
          // Buscar palabras clave de periodicidad o forma de pago
          const match = textoEntreGastosYPago.match(/(TRIMESTRAL|MENSUAL|SEMESTRAL|ANUAL|BIMESTRAL|CUATRIMESTRAL|CONTADO)/i);
          
          if (match) {
            formaPagoEncontrada = match[1].toUpperCase();
            console.log('✅ Forma de pago encontrada:', formaPagoEncontrada);
          } else {
            console.log('⚠️ No se encontró forma de pago en esa sección. Texto:', textoEntreGastosYPago);
          }
        } else {
          console.log('⚠️ No se encontró la sección entre "Gastos Expedición" y "Pago:"');
        }
        
        const formaPagoMatch = formaPagoEncontrada ? [null, formaPagoEncontrada] : null;
        
        const primerPagoMatch = textoCompleto.match(/Primer\s+pago\s+([\d,]+\.?\d*)/i);
        const pagosSubMatch =
          textoCompleto.match(/Pago\(s\)\s*Subsecuente\(s\)\s+([\d,]+\.?\d*)/i) ||
          textoCompleto.match(/Pagos?\s+subsecuentes?\s+([\d,]+\.?\d*)/i);

        const formaPagoDetectada = formaPagoMatch ? formaPagoMatch[1].trim().toUpperCase() : '';
        const primerPago = primerPagoMatch ? primerPagoMatch[1].replace(/,/g, '') : '';
        const pagosSubsecuentes = pagosSubMatch ? pagosSubMatch[1].replace(/,/g, '') : '';

        console.log('💰 Datos de pago extraídos del PDF:');
        console.log('   - Forma de pago (texto PDF):', formaPagoDetectada);
        console.log('   - Primer pago:', primerPago);
        console.log('   - Pagos subsecuentes:', pagosSubsecuentes);

        // Normalizar tipo_pago y frecuenciaPago a partir de la forma de pago extraída
        let tipoPagoDetectado = '';
        let frecuenciaPagoDetectada = '';
        
        if (formaPagoDetectada) {
          const f = formaPagoDetectada.toLowerCase();
          
          // Mapear palabras clave a tipos de pago y frecuencia
          if (f.includes('tri')) {
            tipoPagoDetectado = 'Fraccionado';
            frecuenciaPagoDetectada = 'Trimestral';
          } else if (f.includes('men')) {
            tipoPagoDetectado = 'Fraccionado';
            frecuenciaPagoDetectada = 'Mensual';
          } else if (f.includes('sem')) {
            tipoPagoDetectado = 'Fraccionado';
            frecuenciaPagoDetectada = 'Semestral';
          } else if (f.includes('bim')) {
            tipoPagoDetectado = 'Fraccionado';
            frecuenciaPagoDetectada = 'Bimestral';
          } else if (f.includes('cuat')) {
            tipoPagoDetectado = 'Fraccionado';
            frecuenciaPagoDetectada = 'Cuatrimestral';
          } else if (f.includes('anu') || f.includes('contado')) {
            // CONTADO o ANUAL = pago único
            tipoPagoDetectado = 'Anual';
            frecuenciaPagoDetectada = 'Anual';
          } else {
            // Si no coincide con ningún patrón, asumir Anual
            tipoPagoDetectado = 'Anual';
            frecuenciaPagoDetectada = 'Anual';
          }
          
          console.log('✅ Tipo de pago normalizado:', tipoPagoDetectado);
          console.log('✅ Frecuencia de pago normalizada:', frecuenciaPagoDetectada);
        } else {
          // No se encontró forma de pago, dejar vacío
          console.warn('⚠️ No se encontró forma de pago en PDF');
          tipoPagoDetectado = '';
          frecuenciaPagoDetectada = '';
        }
        
        console.log('💳 RESUMEN NORMALIZACIÓN PAGOS:');
        console.log('   - Forma de pago (PDF original):', formaPagoDetectada);
        console.log('   - Tipo de pago (normalizado):', tipoPagoDetectado || '(VACÍO)');
        console.log('   - Frecuencia de pago (normalizada):', frecuenciaPagoDetectada || '(VACÍO)');

        // ==================== USO / SERVICIO / MOVIMIENTO ====================
        const usoMatch = textoCompleto.match(/Uso:\s*([A-ZÁÉÍÓÚÑ]+)/i);
        const servicioMatch = textoCompleto.match(/Servicio:\s*([A-ZÁÉÍÓÚÑ]+)/i);
        const movimientoMatch = textoCompleto.match(/Movimiento:\s*([A-ZÁÉÍÓÚÑ]+)/i);
        
        // ==================== COBERTURAS ====================
        console.log('🛡️ Extrayendo coberturas...');
        
        // Buscar la sección de coberturas contratadas
        const coberturasSeccion = textoCompleto.match(/COBERTURAS\s+CONTRATADAS\s+SUMA\s+ASEGURADA\s+DEDUCIBLE\s+\$\s+PRIMAS([\s\S]*?)(?=Para\s+RC\s+en\s+el\s+extranjero|Quedan\s+excluidos|Textos:|Forma\s+de|$)/i);
        
        let coberturasExtraidas = [];
        
        if (coberturasSeccion) {
          const textoCobertura = coberturasSeccion[1];
          console.log('📋 Texto de coberturas encontrado:', textoCobertura.substring(0, 500));
          
          // Extraer cada línea de cobertura
          // Formato 1: Nombre $monto deducible% prima
          // Formato 2: Nombre $monto POR EVENTO deducible prima
          // Formato 3: Nombre AMPARADA prima
          
          const lineas = textoCobertura.split('\n').filter(l => l.trim().length > 0);
          
          for (const linea of lineas) {
            const lineaLimpia = linea.trim();
            if (!lineaLimpia) continue;
            
            // Patrón 1: Cobertura con monto y deducible porcentual
            // Ej: "Daños materiales $ 631,350.00 5% 12,972.86"
            let match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+(\d+)%\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: match[3] + '%',
                prima: match[4].replace(/,/g, ''),
                tipo: 'monto'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]} - ${match[3]}%`);
              continue;
            }
            
            // Patrón 2: Cobertura POR EVENTO con deducible
            // Ej: "Responsabilidad Civil por Daños a Terceros $ 3,000,000.00 POR EVENTO 0 uma 1,983.96"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+POR\s+EVENTO\s+(.+?)\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: match[3].trim(),
                prima: match[4].replace(/,/g, ''),
                tipo: 'por_evento'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]} POR EVENTO`);
              continue;
            }
            
            // Patrón 3: Cobertura AMPARADA
            // Ej: "Asistencia Vial Qualitas AMPARADA 565.00"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s.]+?)\s+AMPARADA\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: 'AMPARADA',
                deducible: 'N/A',
                prima: match[2].replace(/,/g, ''),
                tipo: 'amparada'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - AMPARADA`);
              continue;
            }
            
            // Patrón 4: Cobertura con monto específico sin deducible porcentual
            // Ej: "Muerte del Conductor por Accidente Automovilístico $ 100,000.00 122.40"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: 'N/A',
                prima: match[3].replace(/,/g, ''),
                tipo: 'monto'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]}`);
              continue;
            }
          }
          
          console.log(`📊 Total de coberturas extraídas: ${coberturasExtraidas.length}`);
        } else {
          console.log('⚠️ No se encontró la sección de coberturas');
        }
        
        // ==================== MONTOS ====================
        const sumaMatch = textoCompleto.match(/Daños\s+materiales\s+\$\s*([\d,]+\.?\d*)/i);
        const primaMatch = textoCompleto.match(/Prima\s+Neta\s+([\d,]+\.?\d*)/i);
        const tasaFinanciamientoMatch = textoCompleto.match(/Tasa\s+Financiamiento\s+([-]?[\d,]+\.?\d*)/i);
        const gastosExpedicionMatch = textoCompleto.match(/Gastos\s+por\s+Expedici[oó]n[.\s]+([\d,]+\.?\d*)/i);
        const subtotalMatch = textoCompleto.match(/Subtotal\s+([\d,]+\.?\d*)/i);
        const ivaMatch = textoCompleto.match(/I\.V\.A[.\s]*16%\s+([\d,]+\.?\d*)/i);
        const totalMatch = textoCompleto.match(/IMPORTE\s+TOTAL\s+([\d,]+\.?\d*)/i);
        const pagoUnicoMatch = textoCompleto.match(/Pago\s+[UÚ]nico\s+([\d,]+\.?\d*)/i);
        const deducibleMatch = textoCompleto.match(/(\d+)%\s+[\d,]+\.?\d*\s+Robo/i);
        
        console.log('🔍 DEBUG PRE-OBJETO - Valores a asignar:');
        console.log('   tipo_pago:', tipoPagoDetectado);
        console.log('   frecuenciaPago:', frecuenciaPagoDetectada);
        console.log('   forma_pago:', formaPagoDetectada);
        
        datosExtraidos = {
          // ASEGURADO
          tipo_persona: tipoPersona,
          nombre: nombre,
          apellido_paterno: apellido_paterno,
          apellido_materno: apellido_materno,
          razonSocial: razonSocial,
          rfc: rfcExtraido,
          curp: curpMatch ? curpMatch[1] : '',
          domicilio: domicilio,
          municipio: municipio,
          colonia: colonia,
          estado: estado,
          codigo_postal: cp,
          pais: pais,
          email: extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoCompleto),
          
          // PÓLIZA
          compania: compania,
          producto: 'Autos Individual',
          etapa_activa: 'Emitida',
          agente: agente,
          sub_agente: '',
          numero_poliza: polizaNum,
          endoso: endosoNum,
          inciso: incisoNum,
          plan: planMatch ? planMatch[1] : '',
          
          // VIGENCIA
          inicio_vigencia: desdeMatch ? `${desdeMatch[3]}-${meses[desdeMatch[2]]}-${desdeMatch[1]}` : '',
          termino_vigencia: hastaMatch ? `${hastaMatch[3]}-${meses[hastaMatch[2]]}-${hastaMatch[1]}` : '',
          // ✅ NO extraer fecha_pago - será calculada por el formulario usando inicio_vigencia + periodo_gracia
          
          // MONTOS
          prima_pagada: primaMatch ? primaMatch[1].replace(/,/g, '') : '',
          cargo_pago_fraccionado: tasaFinanciamientoMatch ? tasaFinanciamientoMatch[1].replace(/,/g, '') : '',
          gastos_expedicion: gastosExpedicionMatch ? gastosExpedicionMatch[1].replace(/,/g, '') : '',
          subtotal: subtotalMatch ? subtotalMatch[1].replace(/,/g, '') : '',
          iva: ivaMatch ? ivaMatch[1].replace(/,/g, '') : '',
          total: totalMatch ? totalMatch[1].replace(/,/g, '') : '',
          pago_unico: pagoUnicoMatch ? pagoUnicoMatch[1].replace(/,/g, '') : '',
          // FORMA Y TIPO DE PAGO
          tipo_pago: tipoPagoDetectado,
          frecuenciaPago: frecuenciaPagoDetectada, // ✅ Normalizada desde el PDF
          forma_pago: formaPagoDetectada || '',
          primer_pago: primerPago,
          pagos_subsecuentes: pagosSubsecuentes,
          periodo_gracia: periodoGraciaExtraido, // ✅ Del PDF
          suma_asegurada: sumaMatch ? sumaMatch[1].replace(/,/g, '') : '',
          deducible: deducibleMatch ? deducibleMatch[1] : '5',
          
          // VEHÍCULO
          marca: marca,
          modelo: modeloCompleto,
          anio: modeloAnioMatch ? modeloAnioMatch[1] : '',
          numero_serie: serieMatch ? serieMatch[1] : '',
          motor: motorMatch ? motorMatch[1] : '',
          placas: placasExtraidas || '',
          color: colorMatch ? colorMatch[1].trim() : '',
          codigo_vehiculo: descripcionMatch ? descripcionMatch[1] : '',
          tipo_vehiculo: '', // Se debe seleccionar manualmente
          tipo_cobertura: planMatch ? planMatch[1] : '',
          
          // COBERTURAS DETALLADAS
          coberturas: coberturasExtraidas,
          
          // CAMPOS ADICIONALES QUALITAS
          uso: usoMatch ? usoMatch[1].trim() : '',
          servicio: servicioMatch ? servicioMatch[1].trim() : '',
          movimiento: movimientoMatch ? movimientoMatch[1].trim() : '',

          // CONDUCTOR
          conductor_habitual: `${nombre} ${apellido_paterno} ${apellido_materno}`.trim()
        };
        
        // ==================== NORMALIZACIÓN DE VALORES ====================
        // Normalizar marca para que coincida con las opciones disponibles
        const marcasDisponibles = [
          'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
          'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
          'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Renault', 'Seat', 
          'Suzuki', 'Toyota', 'Volkswagen', 'Volvo'
        ];
        
        if (datosExtraidos.marca) {
          const marcaNormalizada = marcasDisponibles.find(
            m => m.toUpperCase() === datosExtraidos.marca.toUpperCase()
          );
          datosExtraidos.marca = marcaNormalizada || 'Otra';
          console.log('✅ Marca normalizada:', datosExtraidos.marca);
        }
        
        // Normalizar tipo de cobertura (Amplia, Limitada, RC)
        if (datosExtraidos.tipo_cobertura) {
          const cobertura = datosExtraidos.tipo_cobertura.toUpperCase();
          if (cobertura.includes('AMPLIA')) {
            datosExtraidos.tipo_cobertura = 'Amplia';
          } else if (cobertura.includes('LIMITADA')) {
            datosExtraidos.tipo_cobertura = 'Limitada';
          } else if (cobertura.includes('RC') || cobertura.includes('RESPONSABILIDAD')) {
            datosExtraidos.tipo_cobertura = 'RC (Responsabilidad Civil)';
          }
          console.log('✅ Tipo de cobertura normalizado:', datosExtraidos.tipo_cobertura);
        }
        
        // ✅ estatusPago será calculado por actualizarCalculosAutomaticos() después
        // No lo calculamos aquí porque no tenemos fecha_pago en la extracción
        
        console.log('📊 Datos extraídos completos:', datosExtraidos);
        console.log('🚗 DEBUG - Datos del vehículo después de extracción:', {
          marca: datosExtraidos.marca,
          modelo: datosExtraidos.modelo,
          anio: datosExtraidos.anio,
          numero_serie: datosExtraidos.numero_serie,
          motor: datosExtraidos.motor,
          placas: datosExtraidos.placas,
          color: datosExtraidos.color,
          tipo_vehiculo: datosExtraidos.tipo_vehiculo,
          tipo_cobertura: datosExtraidos.tipo_cobertura
        });
        
      } else {
        console.log('🔧 Aplicando extractor genérico');
        // Extractor genérico para otras aseguradoras
        datosExtraidos = {
          // INFORMACIÓN DEL ASEGURADO
          nombre: extraerDato(/(?:NOMBRE|ASEGURADO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          apellido_paterno: extraerDato(/(?:APELLIDO\s+PATERNO|AP\.\s*PATERNO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          apellido_materno: extraerDato(/(?:APELLIDO\s+MATERNO|AP\.\s*MATERNO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          rfc: extraerDato(/RFC[:\s]+([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCompleto) || '',
          domicilio: extraerDato(/(?:DOMICILIO|DIRECCI[OÓ]N)[:\s]+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,\.#\-]+?)(?=\s*C\.P\.|CP:|Municipio:|Ciudad:|Estado:|\n\n)/i, textoCompleto) || '',
          municipio: extraerDato(/(?:MUNICIPIO|DELEGACI[OÓ]N)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*Estado:|Colonia:|País:|\n)/i, textoCompleto) || '',
          colonia: extraerDato(/(?:COLONIA)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*C\.P\.|CP:|Estado:|País:|\n)/i, textoCompleto) || '',
          estado: extraerDato(/(?:ESTADO)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*C\.P\.|CP:|Municipio:|Colonia:|País:|\n)/i, textoCompleto) || '',
          codigo_postal: extraerDato(/(?:C\.P\.|CP)[:\s]*(\d{5})/i, textoCompleto) || '',
          pais: extraerDato(/(?:PA[IÍ]S)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s|$|\n)/i, textoCompleto) || 'MEXICO',
          email: extraerDato(/(?:E-?MAIL|CORREO)[:\s]+([\w\.-]+@[\w\.-]+\.\w+)/i, textoCompleto) || '',
          telefono_fijo: extraerDato(/(?:TEL(?:ÉFONO)?\.?\s+(?:FIJO|CASA))[:\s]+([\d\s\-()]+)/i, textoCompleto) || '',
          telefono_movil: extraerDato(/(?:TEL(?:ÉFONO)?\.?\s+(?:M[OÓ]VIL|CELULAR))[:\s]+([\d\s\-()]+)/i, textoCompleto) || '',
          
          // DATOS DE LA PÓLIZA
          compania: compania,
          producto: textoCompleto.match(/AUTOS?|AUTOMÓVIL/i) ? 'Autos Individual' : 'Autos Individual',
          etapa_activa: 'Emitida',
          agente: extraerDato(/(?:AGENTE|PRODUCTOR)[:\s]+([A-ZÁÉÍÓÚÑ\s,\.]+?)(?:\n|PÓLIZA)/i, textoCompleto) || '',
          sub_agente: '',
          numero_poliza: extraerDato(/(?:P[ÓO]LIZA|NO\.\s+DE\s+P[ÓO]LIZA)[:\s#]+(\d+[-\d]*)/i, textoCompleto) || '',
          
          // VIGENCIA
          inicio_vigencia: '',
          termino_vigencia: '',
          
          // INFORMACIÓN FINANCIERA
          prima_pagada: extraerDato(/(?:PRIMA\s+(?:NETA|TOTAL))[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          cargo_pago_fraccionado: extraerDato(/(?:CARGO\s+(?:POR\s+)?FRACCIONAMIENTO)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          iva: extraerDato(/I\.?V\.?A\.?[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          total: extraerDato(/(?:TOTAL|PRIMA\s+TOTAL)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          tipo_pago: textoCompleto.match(/CONTADO/i) ? 'Anual' : textoCompleto.match(/FRACCIONADO/i) ? 'Fraccionado' : 'Anual',
          periodo_gracia: 30,
          
          // DESCRIPCIÓN DEL VEHÍCULO
          marca: extraerDato(/(?:MARCA)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|MODELO|TIPO)/i, textoCompleto) || '',
          modelo: extraerDato(/(?:MODELO|DESCRIPCI[ÓO]N)[:\s]+([A-ZÁÉÍÓÚÑ0-9\s\.\-]+?)(?:\n|AÑO|MOTOR)/i, textoCompleto) || '',
          anio: extraerDato(/(?:AÑO|A[ÑN]O\s+MODELO)[:\s]+(\d{4})/i, textoCompleto) || '',
          numero_serie: extraerDato(/(?:SERIE|VIN|N[UÚ]MERO\s+DE\s+SERIE)[:\s]+([A-Z0-9]{17})/i, textoCompleto) || '',
          placas: extraerDato(/(?:PLACAS?|MATRÍCULA)[:\s]+([A-Z0-9\-]+)/i, textoCompleto) || '',
          color: extraerDato(/(?:COLOR)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|TIPO)/i, textoCompleto) || '',
          tipo_vehiculo: extraerDato(/(?:TIPO\s+DE\s+VEH[IÍ]CULO|USO)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|COBERTURA)/i, textoCompleto) || '',
          
          // COBERTURAS
          tipo_cobertura: extraerDato(/(?:COBERTURA|PLAN)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|DEDUCIBLE)/i, textoCompleto) || '',
          deducible: extraerDato(/(?:DEDUCIBLE)[:\s]+(\d+)%?/i, textoCompleto) || '',
          suma_asegurada: extraerDato(/(?:SUMA\s+ASEGURADA|VALOR)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          
          // CONDUCTOR
          conductor_habitual: extraerDato(/(?:CONDUCTOR\s+HABITUAL)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|EDAD)/i, textoCompleto) || '',
          edad_conductor: extraerDato(/(?:EDAD)[:\s]+(\d+)/i, textoCompleto) || '',
          licencia_conducir: extraerDato(/(?:LICENCIA)[:\s]+([A-Z0-9]+)/i, textoCompleto) || ''
        };

        // 🔄 Normalizar frecuenciaPago cuando tipo_pago es Anual
        if (datosExtraidos.tipo_pago && (datosExtraidos.tipo_pago === 'Anual' || /PAGO\s+ÚNICO|PAGO\s+UNICO|CONTADO/i.test(datosExtraidos.forma_pago || ''))) {
          datosExtraidos.frecuenciaPago = 'Anual';
        }
      }

      console.log('📊 Datos extraídos:', datosExtraidos);

      // Extraer fechas de vigencia
      const fechasMatch = textoCompleto.match(/(?:VIGENCIA|VIGENTE).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4}).*?(?:AL|A).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
      if (fechasMatch) {
        const [, diaIni, mesIni, anioIni, diaFin, mesFin, anioFin] = fechasMatch;
        datosExtraidos.inicio_vigencia = `${anioIni.length === 2 ? '20' + anioIni : anioIni}-${mesIni.padStart(2, '0')}-${diaIni.padStart(2, '0')}`;
        datosExtraidos.termino_vigencia = `${anioFin.length === 2 ? '20' + anioFin : anioFin}-${mesFin.padStart(2, '0')}-${diaFin.padStart(2, '0')}`;
      }

      // Limpiar montos (quitar comas)
      ['prima_pagada', 'cargo_pago_fraccionado', 'iva', 'total', 'suma_asegurada'].forEach(campo => {
        if (datosExtraidos[campo]) {
          datosExtraidos[campo] = datosExtraidos[campo].replace(/,/g, '');
        }
      });

      // Buscar cliente existente
      const clienteExistente = await buscarClienteExistente(
        datosExtraidos.rfc,
        datosExtraidos.curp,
        datosExtraidos.nombre,
        datosExtraidos.apellido_paterno,
        datosExtraidos.apellido_materno
      );

      // Agregar información del cliente al resultado
      const resultado = {
        ...datosExtraidos,
        cliente_existente: clienteExistente,
        cliente_id: clienteExistente?.id || null
      };

      // ==================== VALIDACIÓN DE PAGOS FRACCIONADOS ====================
      // Regla del negocio: En pagos fraccionados, el primer pago suele diferir de los subsecuentes.
      // Además, se valida que la suma: primer_pago + (n-1)*pagos_subsecuentes ≈ total
      try {
        const toNumber = (v) => {
          if (v === undefined || v === null) return null;
          const n = parseFloat(String(v).replace(/,/g, ''));
          return Number.isFinite(n) ? n : null;
        };

        const primer = toNumber(resultado.primer_pago);
        const subsecuentes = toNumber(resultado.pagos_subsecuentes);
        const totalPoliza = toNumber(resultado.total);

        // Inferir número de pagos por la forma/tipo de pago
        const base = `${resultado.forma_pago || resultado.tipo_pago || ''}`.toLowerCase();
        let numeroPagos = 1;
        if (base.includes('men')) numeroPagos = 12;
        else if (base.includes('tri')) numeroPagos = 4;
        else if (base.includes('sem')) numeroPagos = 2;
        else if (base.includes('anu')) numeroPagos = 1;

        const alertas_financieras = [];
        const validacion_pagos = {
          numero_pagos_inferido: numeroPagos,
          primer_pago: primer,
          pagos_subsecuentes: subsecuentes,
          total_pdf: totalPoliza,
          primer_vs_subsecuentes_diferentes: null,
          total_consistente: null,
          total_calculado: null,
          tolerancia: null
        };

        // Validar que primer pago y subsecuentes NO sean iguales (práctica común: difieren)
        if (numeroPagos > 1 && primer !== null && subsecuentes !== null) {
          const iguales = Math.abs(primer - subsecuentes) < 0.005; // tolerancia pequeña por redondeo
          validacion_pagos.primer_vs_subsecuentes_diferentes = !iguales;
          if (iguales) {
            alertas_financieras.push({
              tipo: 'advertencia',
              codigo: 'PAGOS_IGUALES',
              mensaje: 'El primer pago y los pagos subsecuentes son iguales; normalmente deben diferir (primer pago incluye gastos iniciales).',
              detalle: { primer, subsecuentes }
            });
            console.warn('⚠️ Validación pagos: primer pago y subsecuentes son iguales.', { primer, subsecuentes });
          }
        }

        // Validar consistencia contra el total
        if (numeroPagos > 1 && primer !== null && subsecuentes !== null && totalPoliza !== null) {
          const totalCalculado = primer + (numeroPagos - 1) * subsecuentes;
          const tolerancia = Math.max(1, totalPoliza * 0.002); // ±0.2% o $1 mínimo
          const diferencia = Math.abs(totalCalculado - totalPoliza);
          validacion_pagos.total_calculado = Number(totalCalculado.toFixed(2));
          validacion_pagos.tolerancia = tolerancia;
          validacion_pagos.total_consistente = diferencia <= tolerancia;
          if (!validacion_pagos.total_consistente) {
            alertas_financieras.push({
              tipo: 'advertencia',
              codigo: 'TOTAL_NO_COINCIDE',
              mensaje: 'La suma de pagos fraccionados no coincide con el importe total de la póliza.',
              detalle: {
                numeroPagos,
                primer,
                subsecuentes,
                total_pdf: totalPoliza,
                total_calculado: Number(totalCalculado.toFixed(2)),
                diferencia: Number((totalCalculado - totalPoliza).toFixed(2)),
                tolerancia
              }
            });
            console.warn('⚠️ Validación pagos: total no coincide con suma de fraccionados.', validacion_pagos);
          } else {
            console.log('✅ Validación pagos: total consistente con fraccionados.', validacion_pagos);
          }
        }

        // Adjuntar resultados al objeto
        resultado.alertas_financieras = alertas_financieras;
        resultado.validacion_pagos = validacion_pagos;
      } catch (e) {
        console.warn('⚠️ Error durante validación de pagos fraccionados:', e);
      }

      setDatosExtraidos(resultado);
      
      // Guardar información del cliente encontrado (o null si no existe)
      setClienteEncontrado(clienteExistente);
      
      if (clienteExistente) {
        console.log('🔍 Cliente encontrado en BD:', {
          id: clienteExistente.id,
          codigo: clienteExistente.codigo,
          tipoPersona: clienteExistente.tipoPersona,
          razonSocial: clienteExistente.razonSocial,
          nombre: clienteExistente.nombre,
          apellidoPaterno: clienteExistente.apellidoPaterno,
          rfc: clienteExistente.rfc,
          direccion: clienteExistente.direccion,
          email: clienteExistente.email,
          telefonoMovil: clienteExistente.telefonoMovil,
          created_at: clienteExistente.created_at
        });
      }
      
      // Buscar agente en el equipo de trabajo
      let agenteEncontradoEnBD = null;
      if (datosExtraidos.agente && agentes.length > 0) {
        const codigoAgenteMatch = datosExtraidos.agente.match(/^(\d+)/);
        if (codigoAgenteMatch) {
          const codigoAgente = codigoAgenteMatch[1];
          agenteEncontradoEnBD = agentes.find(miembro => 
            miembro.perfil === 'Agente' && 
            miembro.activo &&
            (miembro.codigo === codigoAgente || miembro.codigoAgente === codigoAgente)
          );
        }
      }
      setAgenteEncontrado(agenteEncontradoEnBD);
      
      // Pasar al PASO 1: Validación de Cliente
      setEstado('validando-cliente');
      
      console.log('✅ Datos extraídos. Pasando a validación de cliente...');
      console.log('  Cliente:', clienteExistente ? 'Encontrado' : 'Nuevo');
      console.log('  Agente:', agenteEncontradoEnBD ? 'Encontrado' : 'No encontrado');

    } catch (error) {
      console.error('Error al procesar PDF:', error);
      setEstado('error');
      setErrores(['❌ Error al procesar el archivo PDF: ' + error.message]);
    }
  }, []);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setArchivo(file);
      setInformacionArchivo({
        nombre: file.name,
        tamaño: `${(file.size / 1024).toFixed(2)} KB`,
        tipo: file.type,
        fechaModificacion: new Date(file.lastModified).toLocaleDateString('es-MX')
      });
      procesarPDF(file);
    } else {
      setErrores(['❌ Por favor, seleccione un archivo PDF válido']);
      setEstado('error');
    }
  }, [procesarPDF]);

  // PASO 1: Manejar decisión sobre el cliente
  const handleDecisionCliente = useCallback(async (decision) => {
    setDecisionCliente(decision);
    
    if (decision === 'crear-nuevo') {
      // ✅ VALIDAR RFC ANTES DE CREAR CLIENTE
      if (!datosExtraidos.rfc || datosExtraidos.rfc.trim() === '') {
        console.log('⚠️ RFC no encontrado - Abriendo modal de captura');
        setMostrarModalRFC(true);
        setEstado('capturando-rfc');
        return; // Detener hasta que se capture el RFC
      }
      
      // Si hay RFC, continuar con la creación normal
      console.log('🔄 Creando nuevo cliente...');
      
      // Usar tipo de persona ya detectado en la extracción
      const tipoPersonaDetectado = datosExtraidos.tipo_persona === 'Moral' ? 'Persona Moral' : 'Persona Física';
      
      // Preparar datos según tipo de persona
      let nuevoCliente = {};
      
      if (tipoPersonaDetectado === 'Persona Moral') {
        // Para empresas: usar razón social directamente extraída
        nuevoCliente = {
          tipoPersona: tipoPersonaDetectado,
          razonSocial: datosExtraidos.razonSocial || 'Empresa',
          rfc: datosExtraidos.rfc || '',
          direccion: datosExtraidos.domicilio || '',
          municipio: datosExtraidos.municipio || '',
          colonia: datosExtraidos.colonia || '',
          estado: datosExtraidos.estado || '',
          codigoPostal: datosExtraidos.codigo_postal || '',
          pais: datosExtraidos.pais || 'MEXICO',
          email: datosExtraidos.email || '',
          activo: true
        };
      } else {
        // Para personas físicas: usar nombre y apellidos
        nuevoCliente = {
          tipoPersona: tipoPersonaDetectado,
          nombre: datosExtraidos.nombre || '',
          apellidoPaterno: datosExtraidos.apellido_paterno || '',
          apellidoMaterno: datosExtraidos.apellido_materno || '',
          rfc: datosExtraidos.rfc || '',
          direccion: datosExtraidos.domicilio || '',
          municipio: datosExtraidos.municipio || '',
          colonia: datosExtraidos.colonia || '',
          estado: datosExtraidos.estado || '',
          codigoPostal: datosExtraidos.codigo_postal || '',
          pais: datosExtraidos.pais || 'MEXICO',
          email: datosExtraidos.email || '',
          activo: true
        };
      }
      
      console.log('📋 Datos del cliente a crear:');
      console.log('   - Tipo persona:', tipoPersonaDetectado);
      console.log('   - RFC:', datosExtraidos.rfc, '(longitud:', datosExtraidos.rfc?.length, ')');
      if (tipoPersonaDetectado === 'Persona Moral') {
        console.log('   - Razón Social:', nuevoCliente.razonSocial);
      } else {
        console.log('   - Nombre:', nuevoCliente.nombre);
        console.log('   - Apellidos:', nuevoCliente.apellidoPaterno, nuevoCliente.apellidoMaterno);
      }
      console.log('   - Dirección completa:', nuevoCliente.direccion);
      console.log('   - Colonia:', nuevoCliente.colonia);
      console.log('   - Municipio:', nuevoCliente.municipio);
      console.log('   - Estado:', nuevoCliente.estado);
      console.log('   - CP:', nuevoCliente.codigoPostal);
      console.log('   - País:', nuevoCliente.pais);
      console.log('   - JSON completo:', JSON.stringify(nuevoCliente, null, 2));
      
      const { crearCliente } = await import('../services/clientesService');
      const resultado = await crearCliente(nuevoCliente);
      
      console.log('📡 Respuesta de crearCliente:', resultado);
      
      if (resultado.success && resultado.data) {
        // ⚠️ IMPORTANTE: Normalizar campos del backend (snake_case → camelCase)
        const clienteNormalizado = {
          ...resultado.data,
          razonSocial: resultado.data.razonSocial || resultado.data.razon_social || '',
          nombreComercial: resultado.data.nombreComercial || resultado.data.nombre_comercial || '',
          apellidoPaterno: resultado.data.apellidoPaterno || resultado.data.apellido_paterno || '',
          apellidoMaterno: resultado.data.apellidoMaterno || resultado.data.apellido_materno || '',
          telefonoFijo: resultado.data.telefonoFijo || resultado.data.telefono_fijo || '',
          telefonoMovil: resultado.data.telefonoMovil || resultado.data.telefono_movil || ''
        };
        
        setClienteEncontrado(clienteNormalizado);
        const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
        console.log('✅ Cliente creado correctamente:', nombreCliente, 'ID:', clienteNormalizado.id);
        console.log('✅ Cliente normalizado:', clienteNormalizado);
      } else if (resultado.success && !resultado.data) {
        console.warn('⚠️ El servidor devolvió success pero sin datos. Intentando recargar clientes...');
        
        // Recargar todos los clientes para obtener el recién creado
        const { obtenerClientes } = await import('../services/clientesService');
        const clientesResult = await obtenerClientes();
        
        if (clientesResult.success && clientesResult.data.length > 0) {
          // Buscar el cliente por RFC
          const clienteCreado = clientesResult.data.find(c => c.rfc === nuevoCliente.rfc);
          
          if (clienteCreado) {
            // ⚠️ IMPORTANTE: Normalizar campos del backend
            const clienteNormalizado = {
              ...clienteCreado,
              razonSocial: clienteCreado.razonSocial || clienteCreado.razon_social || '',
              nombreComercial: clienteCreado.nombreComercial || clienteCreado.nombre_comercial || '',
              apellidoPaterno: clienteCreado.apellidoPaterno || clienteCreado.apellido_paterno || '',
              apellidoMaterno: clienteCreado.apellidoMaterno || clienteCreado.apellido_materno || '',
              telefonoFijo: clienteCreado.telefonoFijo || clienteCreado.telefono_fijo || '',
              telefonoMovil: clienteCreado.telefonoMovil || clienteCreado.telefono_movil || ''
            };
            
            setClienteEncontrado(clienteNormalizado);
            const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
            console.log('✅ Cliente recuperado después de creación:', nombreCliente, 'ID:', clienteNormalizado.id);
            console.log('✅ Cliente normalizado:', clienteNormalizado);
          } else {
            console.error('❌ No se pudo encontrar el cliente recién creado');
            setErrores(['El cliente se creó pero no se pudo recuperar. Por favor, reintenta.']);
            setEstado('error');
            return;
          }
        } else {
          console.error('❌ No se pudieron recargar los clientes');
          setErrores(['Error al recargar clientes después de la creación.']);
          setEstado('error');
          return;
        }
      } else {
        console.error('❌ Error al crear cliente:', resultado.error);
        
        // ✅ CASO ESPECIAL: Si el error es por RFC faltante, mostrar modal de captura
        if (resultado.error && resultado.error.includes('RFC')) {
          console.log('⚠️ RFC no encontrado en PDF - Abriendo modal de captura');
          setMostrarModalRFC(true);
          setEstado('capturando-rfc');
          return;
        }
        
        // Si no es error de RFC, mostrar error normal
        setErrores(['❌ Error al crear cliente: ' + resultado.error]);
        setEstado('error');
        return;
      }
    }
    
    // Pasar al PASO 2: Validación de Agente
    setEstado('validando-agente');
  }, [datosExtraidos]);

  // ✅ FUNCIÓN SIMPLIFICADA: Asignar RFC y continuar con creación de cliente
  const handleSeleccionRFC = useCallback(async (opcion, rfcManual = '') => {
    console.log(`✅ Usuario seleccionó: ${opcion}`, rfcManual ? `RFC manual: ${rfcManual}` : '');
    
    let rfcFinal = '';
    let tipoPersonaFinal = '';
    
    if (opcion === 'fisica') {
      rfcFinal = 'XAXX010101000'; // 13 caracteres
      tipoPersonaFinal = 'Fisica';
    } else if (opcion === 'moral') {
      rfcFinal = 'XAXX010101'; // 12 caracteres
      tipoPersonaFinal = 'Moral';
    } else if (opcion === 'capturar' && rfcManual) {
      rfcFinal = rfcManual.toUpperCase().trim();
      tipoPersonaFinal = rfcFinal.length === 13 ? 'Fisica' : 'Moral';
    }
    
    if (!rfcFinal) {
      toast.error('⚠️ RFC inválido');
      return;
    }
    
    console.log(`✅ RFC FINAL asignado: ${rfcFinal} (${tipoPersonaFinal})`);
    
    // Cerrar modal
    setMostrarModalRFC(false);
    setRfcCapturado('');
    
    // ✅ Actualizar datosExtraidos con el RFC asignado
    const datosActualizados = {
      ...datosExtraidos,
      rfc: rfcFinal,
      tipo_persona: tipoPersonaFinal
    };
    setDatosExtraidos(datosActualizados);
    
    // ✅ CONTINUAR con la creación del cliente (copiar lógica de handleDecisionCliente)
    console.log('🔄 Creando nuevo cliente con RFC asignado...');
    
    const tipoPersonaDetectado = tipoPersonaFinal === 'Moral' ? 'Persona Moral' : 'Persona Física';
    
    // Preparar datos según tipo de persona
    let nuevoCliente = {};
    
    if (tipoPersonaDetectado === 'Persona Moral') {
      nuevoCliente = {
        tipoPersona: tipoPersonaDetectado,
        razonSocial: datosActualizados.razonSocial || 'Empresa',
        rfc: rfcFinal,
        direccion: datosActualizados.domicilio || '',
        municipio: datosActualizados.municipio || '',
        colonia: datosActualizados.colonia || '',
        estado: datosActualizados.estado || '',
        codigoPostal: datosActualizados.codigo_postal || '',
        pais: datosActualizados.pais || 'MEXICO',
        email: datosActualizados.email || '',
        activo: true
      };
    } else {
      nuevoCliente = {
        tipoPersona: tipoPersonaDetectado,
        nombre: datosActualizados.nombre || '',
        apellidoPaterno: datosActualizados.apellido_paterno || '',
        apellidoMaterno: datosActualizados.apellido_materno || '',
        rfc: rfcFinal,
        direccion: datosActualizados.domicilio || '',
        municipio: datosActualizados.municipio || '',
        colonia: datosActualizados.colonia || '',
        estado: datosActualizados.estado || '',
        codigoPostal: datosActualizados.codigo_postal || '',
        pais: datosActualizados.pais || 'MEXICO',
        email: datosActualizados.email || '',
        activo: true
      };
    }
    
    console.log('📋 Datos del cliente a crear:', nuevoCliente);
    
    try {
      const { crearCliente } = await import('../services/clientesService');
      const resultado = await crearCliente(nuevoCliente);
      
      console.log('� Respuesta de crearCliente:', resultado);
      
      if (resultado.success && resultado.data) {
        const clienteNormalizado = {
          ...resultado.data,
          razonSocial: resultado.data.razonSocial || resultado.data.razon_social || '',
          nombreComercial: resultado.data.nombreComercial || resultado.data.nombre_comercial || '',
          apellidoPaterno: resultado.data.apellidoPaterno || resultado.data.apellido_paterno || '',
          apellidoMaterno: resultado.data.apellidoMaterno || resultado.data.apellido_materno || '',
          telefonoFijo: resultado.data.telefonoFijo || resultado.data.telefono_fijo || '',
          telefonoMovil: resultado.data.telefonoMovil || resultado.data.telefono_movil || ''
        };
        
        setClienteEncontrado(clienteNormalizado);
        const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
        console.log('✅ Cliente creado correctamente:', nombreCliente, 'ID:', clienteNormalizado.id);
        toast.success('✅ Cliente creado correctamente');
        
        // Pasar a validación de agente
        setEstado('validando-agente');
      } else {
        console.error('❌ Error al crear cliente:', resultado.error);
        toast.error('❌ Error al crear cliente: ' + resultado.error);
        setEstado('error');
      }
    } catch (error) {
      console.error('❌ Error en creación de cliente:', error);
      toast.error('❌ Error al crear cliente');
      setEstado('error');
    }
  }, [datosExtraidos]);

  // PASO 2: Manejar decisión sobre el agente
  const handleDecisionAgente = useCallback(async (decision) => {
    setDecisionAgente(decision);
    
    if (decision === 'crear-nuevo') {
      console.log('🔄 Creando nuevo agente...');
      
      // Extraer código y nombre del agente del string "25576 - ALVARO IVAN GONZALEZ JIMENEZ"
      const agenteTexto = datosExtraidos.agente || '';
      const codigoMatch = agenteTexto.match(/^(\d+)/);
      const nombreCompletoMatch = agenteTexto.match(/\d+\s*-\s*(.+)$/);
      
      if (!codigoMatch || !nombreCompletoMatch) {
        console.error('❌ No se pudo extraer información del agente');
  toast('⚠️ No se pudo extraer la información del agente del PDF. Crea el agente manualmente en Equipo de Trabajo.');
        // Continuar sin crear el agente
        setEstado('preview-datos');
        return;
      }
      
      const codigo = codigoMatch[1];
      const nombreCompleto = nombreCompletoMatch[1].trim();
      const palabras = nombreCompleto.split(/\s+/);
      
      let nombre = '', apellidoPaterno = '', apellidoMaterno = '';
      if (palabras.length >= 4) {
        nombre = palabras.slice(0, -2).join(' ');
        apellidoPaterno = palabras[palabras.length - 2];
        apellidoMaterno = palabras[palabras.length - 1];
      } else if (palabras.length === 3) {
        nombre = palabras[0];
        apellidoPaterno = palabras[1];
        apellidoMaterno = palabras[2];
      } else if (palabras.length === 2) {
        nombre = palabras[0];
        apellidoPaterno = palabras[1];
      }
      
      try {
        const nuevoAgente = {
          codigo: codigo,
          nombre: nombre,
          apellidoPaterno: apellidoPaterno,
          apellidoMaterno: apellidoMaterno,
          perfil: 'Agente',
          activo: true,
          fechaIngreso: new Date().toISOString().split('T')[0],
          productosAseguradoras: []
        };
        
        const { crearMiembroEquipo } = await import('../services/equipoDeTrabajoService');
        const resultado = await crearMiembroEquipo(nuevoAgente);
        
        if (resultado.success) {
          setAgenteEncontrado(resultado.data);
          console.log('✅ Agente creado:', resultado.data.nombre);
          toast.success(`Agente creado: ${nombre} ${apellidoPaterno}`);
        } else {
          throw new Error(resultado.error);
        }
      } catch (error) {
        console.error('❌ Error al crear agente:', error);
  toast(`⚠️ No se pudo crear el agente automáticamente. Agrega manualmente: Código ${codigo} - ${nombre} ${apellidoPaterno} ${apellidoMaterno}`);
        // Continuar sin el agente
      }
    }
    
    // Pasar al PASO 3: Preview de todos los datos
    setEstado('preview-datos');
  }, [datosExtraidos, aseguradoras, tiposProductos]);

  // PASO 3: Aplicar datos al formulario
  const aplicarDatos = useCallback(() => {
    if (datosExtraidos && onDataExtracted) {
      console.log('🔍 DEBUG aplicarDatos:');
      console.log('   - clienteEncontrado:', clienteEncontrado);
      console.log('   - clienteEncontrado.id:', clienteEncontrado?.id);
      console.log('   - datosExtraidos.cliente_id:', datosExtraidos.cliente_id);
      
      // Combinar los datos extraídos del PDF con los datos normalizados del cliente
      const datosConCliente = {
        ...datosExtraidos,
        cliente_id: clienteEncontrado?.id || datosExtraidos.cliente_id || null
      };
      
      console.log('   - datosConCliente.cliente_id FINAL:', datosConCliente.cliente_id);

      // Si tenemos clienteEncontrado, usar sus datos normalizados (ya en camelCase)
      if (clienteEncontrado) {
        console.log('✅ Aplicando datos del cliente normalizado:', {
          razonSocial: clienteEncontrado.razonSocial,
          nombreComercial: clienteEncontrado.nombreComercial,
          rfc: clienteEncontrado.rfc
        });
        
        // Sobrescribir los datos del cliente del PDF con los datos normalizados de BD
        datosConCliente.razonSocial = clienteEncontrado.razonSocial || clienteEncontrado.razon_social || datosConCliente.razonSocial;
        datosConCliente.nombreComercial = clienteEncontrado.nombreComercial || clienteEncontrado.nombre_comercial || datosConCliente.nombreComercial;
        datosConCliente.nombre = clienteEncontrado.nombre || datosConCliente.nombre;
        datosConCliente.apellido_paterno = clienteEncontrado.apellidoPaterno || clienteEncontrado.apellido_paterno || datosConCliente.apellido_paterno;
        datosConCliente.apellido_materno = clienteEncontrado.apellidoMaterno || clienteEncontrado.apellido_materno || datosConCliente.apellido_materno;
        datosConCliente.rfc = clienteEncontrado.rfc || datosConCliente.rfc;
        datosConCliente.email = clienteEncontrado.email || datosConCliente.email;
        datosConCliente.telefono_fijo = clienteEncontrado.telefonoFijo || clienteEncontrado.telefono_fijo || datosConCliente.telefono_fijo;
        datosConCliente.telefono_movil = clienteEncontrado.telefonoMovil || clienteEncontrado.telefono_movil || datosConCliente.telefono_movil;
      }
      // Adjuntar archivo PDF seleccionado para subirlo automáticamente tras crear el expediente
      if (archivo) {
        try {
          datosConCliente.__pdfFile = archivo;
          if (informacionArchivo?.nombre) datosConCliente.__pdfNombre = informacionArchivo.nombre;
          if (archivo?.size) datosConCliente.__pdfSize = archivo.size;
        } catch (e) {
          console.warn('No se pudo adjuntar el archivo PDF al payload de datos extraídos:', e);
        }
      }

      // ================== AJUSTES DE PAGO FRACCIONADO ==================
      // Si la extracción detectó forma_pago y no se ha definido en el formulario, mapear:
      // tipo_pago: 'Fraccionado' si la frecuencia no es anual
      // ✅ Normalización DEFENSIVA adicional: si tipo_pago o frecuenciaPago vienen vacíos pero tenemos forma_pago
      if (!datosConCliente.tipo_pago || !datosConCliente.frecuenciaPago) {
        const fp = (datosConCliente.forma_pago || '').toLowerCase();
        if (fp) {
          if (fp.includes('tri')) {
            datosConCliente.tipo_pago = 'Fraccionado';
            datosConCliente.frecuenciaPago = 'Trimestral';
          } else if (fp.includes('men')) {
            datosConCliente.tipo_pago = 'Fraccionado';
            datosConCliente.frecuenciaPago = 'Mensual';
          } else if (fp.includes('sem')) {
            datosConCliente.tipo_pago = 'Fraccionado';
            datosConCliente.frecuenciaPago = 'Semestral';
          } else if (fp.includes('bim')) {
            datosConCliente.tipo_pago = 'Fraccionado';
            datosConCliente.frecuenciaPago = 'Bimestral';
          } else if (fp.includes('cuat')) {
            datosConCliente.tipo_pago = 'Fraccionado';
            datosConCliente.frecuenciaPago = 'Cuatrimestral';
          } else if (fp.includes('anu') || fp.includes('contado') || fp.includes('unico') || fp.includes('único')) {
            datosConCliente.tipo_pago = 'Anual';
            datosConCliente.frecuenciaPago = 'Anual';
          }
          console.log('🛠 Normalización defensiva aplicada (faltaban tipo_pago / frecuenciaPago):', {
            forma_pago: datosConCliente.forma_pago,
            tipo_pago: datosConCliente.tipo_pago,
            frecuenciaPago: datosConCliente.frecuenciaPago
          });
        }
      }
      if (datosConCliente.forma_pago) {
        const forma = datosConCliente.forma_pago.toLowerCase();
        console.log('💳 Detectada forma de pago:', datosConCliente.forma_pago);
        // Determinar frecuenciaPago según forma
        if (forma.includes('tri')) datosConCliente.frecuenciaPago = 'Trimestral';
        else if (forma.includes('men')) datosConCliente.frecuenciaPago = 'Mensual';
        else if (forma.includes('sem')) datosConCliente.frecuenciaPago = 'Semestral';
        else if (forma.includes('bim')) datosConCliente.frecuenciaPago = 'Bimestral';
        else if (forma.includes('cuat')) datosConCliente.frecuenciaPago = 'Cuatrimestral';
        else if (forma.includes('anu') || forma.includes('contado') || forma.includes('unico') || forma.includes('único')) datosConCliente.frecuenciaPago = 'Anual';

        // Solo marcar Fraccionado si la frecuencia NO es anual
        if (datosConCliente.frecuenciaPago && datosConCliente.frecuenciaPago !== 'Anual') {
          datosConCliente.tipo_pago = 'Fraccionado';
          console.log('✅ Asignado tipo_pago=Fraccionado, frecuenciaPago=', datosConCliente.frecuenciaPago);
        } else if (datosConCliente.frecuenciaPago === 'Anual' && !datosConCliente.tipo_pago) {
          datosConCliente.tipo_pago = 'Anual';
          console.log('✅ Confirmado tipo_pago=Anual (no fraccionado)');
        }
      }

      // Calendario sugerido de pagos basado en primer_pago y pagos_subsecuentes (solo si fraccionado y hay monto)
      if (datosConCliente.tipo_pago === 'Fraccionado' && datosConCliente.frecuenciaPago && datosConCliente.inicio_vigencia) {
        try {
          const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[datosConCliente.frecuenciaPago] || 0;
          const mesesSalto = CONSTANTS.MESES_POR_FRECUENCIA[datosConCliente.frecuenciaPago] || 0;
          const inicio = new Date(datosConCliente.inicio_vigencia);
          const pagos = [];
          for (let i = 0; i < numeroPagos; i++) {
            const fechaPago = new Date(inicio);
            fechaPago.setMonth(fechaPago.getMonth() + i * mesesSalto);
            pagos.push({
              numero: i + 1,
              fecha: fechaPago.toISOString().split('T')[0],
              monto: i === 0 ? datosConCliente.primer_pago || '' : datosConCliente.pagos_subsecuentes || datosConCliente.primer_pago || '',
              estado: '' // Se calculará después en interfaz
            });
          }
          datosConCliente.calendario_pagos_sugerido = pagos;
        } catch (e) {
          console.warn('No se pudo generar calendario de pagos sugerido:', e);
        }
      }

      // ================== CAMPOS ADICIONALES POLIZA (Uso/Servicio/Movimiento) ==================
      // Si existen y el formulario espera camelCase, mantenerlos así.
      if (datosConCliente.uso) datosConCliente.uso_poliza = datosConCliente.uso;
      if (datosConCliente.servicio) datosConCliente.servicio_poliza = datosConCliente.servicio;
      if (datosConCliente.movimiento) datosConCliente.movimiento_poliza = datosConCliente.movimiento;
      
      console.log('📤 Aplicando datos completos al formulario:', datosConCliente);
      onDataExtracted(datosConCliente);
      onClose();
    }
  }, [datosExtraidos, clienteEncontrado, onDataExtracted, onClose]);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <FileText className="me-2" size={20} />
              Extractor Inteligente de Pólizas PDF
            </h5>
            <button 
              type="button" 
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          
          <div className="modal-body">
            {estado === 'esperando' && (
              <div className="text-center py-5">
                <Upload size={48} className="text-muted mb-3" />
                <h6 className="mb-3">Seleccione el archivo PDF de la póliza</h6>
                <p className="text-muted mb-4">
                  Sistema de extracción inteligente optimizado para pólizas mexicanas
                </p>
                <label className="btn btn-primary btn-lg">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="d-none"
                  />
                  <Upload className="me-2" size={20} />
                  Seleccionar Póliza PDF
                </label>
              </div>
            )}

            {estado === 'procesando' && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Procesando...</span>
                </div>
                <h6 className="mb-3">Procesando PDF...</h6>
                <p className="text-muted">Extrayendo información de la póliza</p>
              </div>
            )}

            {/* PASO 1: VALIDACIÓN DE CLIENTE */}
            {estado === 'validando-cliente' && datosExtraidos && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                    <strong>1/3</strong>
                  </div>
                  <h5 className="mt-3">Validación de Cliente</h5>
                </div>

                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">👤 Datos del Cliente Extraídos</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <strong className="d-block mb-1">
                          {datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social:' : 'Nombre Completo:'}
                        </strong>
                        <p className="mb-0">
                          {datosExtraidos.tipo_persona === 'Moral' 
                            ? datosExtraidos.razonSocial 
                            : `${datosExtraidos.nombre || ''} ${datosExtraidos.apellido_paterno || ''} ${datosExtraidos.apellido_materno || ''}`.trim()
                          }
                        </p>
                      </div>
                      {datosExtraidos.rfc && (
                        <div className="col-md-6">
                          <strong className="d-block mb-1">RFC:</strong>
                          <p className="mb-0">{datosExtraidos.rfc}</p>
                        </div>
                      )}
                      {datosExtraidos.domicilio && (
                        <div className="col-12">
                          <strong className="d-block mb-1">Dirección:</strong>
                          <p className="mb-0">{datosExtraidos.domicilio}</p>
                        </div>
                      )}
                      {datosExtraidos.email && (
                        <div className="col-md-6">
                          <strong className="d-block mb-1">Email:</strong>
                          <p className="mb-0">{datosExtraidos.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {clienteEncontrado ? (
                  <div className="alert alert-success">
                    <div className="d-flex align-items-center mb-3">
                      <CheckCircle className="me-2" size={24} />
                      <strong>✅ Cliente ENCONTRADO en base de datos</strong>
                    </div>
                    
                    <div className="card border-success">
                      <div className="card-body">
                        <h6 className="card-subtitle mb-3 text-success">Datos en Base de Datos</h6>
                        
                        <div className="row g-3">
                          <div className="col-md-6">
                            <small className="text-muted d-block">ID Cliente</small>
                            <strong>{clienteEncontrado.codigo || clienteEncontrado.id}</strong>
                          </div>
                          
                          <div className="col-md-6">
                            <small className="text-muted d-block">Fecha de Registro</small>
                            <strong>{clienteEncontrado.created_at ? new Date(clienteEncontrado.created_at).toLocaleDateString('es-MX') : 'N/A'}</strong>
                          </div>

                          <div className="col-12">
                            <small className="text-muted d-block">
                              {clienteEncontrado.tipoPersona === 'Persona Moral' ? 'Razón Social' : 'Nombre Completo'}
                            </small>
                            <strong>
                              {clienteEncontrado.tipoPersona === 'Persona Moral' 
                                ? (clienteEncontrado.razonSocial || clienteEncontrado.nombre || 'N/A')
                                : `${clienteEncontrado.nombre || ''} ${clienteEncontrado.apellido_paterno || clienteEncontrado.apellidoPaterno || ''} ${clienteEncontrado.apellido_materno || clienteEncontrado.apellidoMaterno || ''}`.trim()
                              }
                            </strong>
                          </div>

                          {clienteEncontrado.rfc && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">RFC</small>
                              <strong>{clienteEncontrado.rfc}</strong>
                            </div>
                          )}

                          {clienteEncontrado.curp && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">CURP</small>
                              <strong>{clienteEncontrado.curp}</strong>
                            </div>
                          )}

                          {clienteEncontrado.email && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Email</small>
                              <strong>{clienteEncontrado.email}</strong>
                            </div>
                          )}

                          {clienteEncontrado.telefono_movil && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono Móvil</small>
                              <strong>{clienteEncontrado.telefono_movil}</strong>
                            </div>
                          )}

                          {clienteEncontrado.telefono_fijo && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono Fijo</small>
                              <strong>{clienteEncontrado.telefono_fijo}</strong>
                            </div>
                          )}

                          {clienteEncontrado.direccion && (
                            <div className="col-12">
                              <small className="text-muted d-block">Dirección</small>
                              <strong>{clienteEncontrado.direccion}</strong>
                            </div>
                          )}

                          {(clienteEncontrado.ciudad || clienteEncontrado.estado) && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Ubicación</small>
                              <strong>{clienteEncontrado.ciudad}{clienteEncontrado.ciudad && clienteEncontrado.estado ? ', ' : ''}{clienteEncontrado.estado}</strong>
                            </div>
                          )}

                          {clienteEncontrado.codigo_postal && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Código Postal</small>
                              <strong>{clienteEncontrado.codigo_postal}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-3" />
                    <p className="mb-3"><strong>¿Qué deseas hacer?</strong></p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-success flex-fill"
                        onClick={() => handleDecisionCliente('usar-existente')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Usar Cliente Existente
                      </button>
                      <button 
                        className="btn btn-outline-primary flex-fill"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
                      >
                        Crear Cliente Nuevo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <div className="d-flex align-items-center mb-2">
                      <AlertCircle className="me-2" size={24} />
                      <strong>⚠️ Cliente NO encontrado en base de datos</strong>
                    </div>
                    <p className="mb-3">Se creará un nuevo cliente con los datos extraídos del PDF.</p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary flex-fill"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Crear Cliente y Continuar
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={onClose}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 2: VALIDACIÓN DE AGENTE */}
            {estado === 'validando-agente' && datosExtraidos && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                    <strong>2/3</strong>
                  </div>
                  <h5 className="mt-3">Validación de Agente</h5>
                </div>

                {datosExtraidos.agente ? (
                  <div className="card mb-4">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">👔 Agente Extraído del PDF</h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-0"><strong>{datosExtraidos.agente}</strong></p>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info mb-4">
                    <AlertCircle className="me-2" size={20} />
                    No se pudo extraer información del agente del PDF
                  </div>
                )}

                {agenteEncontrado ? (
                  <div className="alert alert-success">
                    <div className="d-flex align-items-center mb-3">
                      <CheckCircle className="me-2" size={24} />
                      <strong>✅ Agente ENCONTRADO en Equipo de Trabajo</strong>
                    </div>
                    
                    <div className="card border-success">
                      <div className="card-body">
                        <h6 className="card-subtitle mb-3 text-success">Datos en Equipo de Trabajo</h6>
                        
                        <div className="row g-3">
                          <div className="col-md-6">
                            <small className="text-muted d-block">Código Agente</small>
                            <strong>{agenteEncontrado.codigo || agenteEncontrado.codigoAgente}</strong>
                          </div>
                          
                          <div className="col-md-6">
                            <small className="text-muted d-block">Nombre Completo</small>
                            <strong>{agenteEncontrado.nombre}</strong>
                          </div>

                          {agenteEncontrado.email && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Email</small>
                              <strong>{agenteEncontrado.email}</strong>
                            </div>
                          )}

                          {agenteEncontrado.telefono && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono</small>
                              <strong>{agenteEncontrado.telefono}</strong>
                            </div>
                          )}

                          <div className="col-md-6">
                            <small className="text-muted d-block">Estado</small>
                            <span className="badge bg-success">Activo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-3" />
                    <p className="mb-3"><strong>¿Qué deseas hacer?</strong></p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-success flex-fill"
                        onClick={() => handleDecisionAgente('usar-existente')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Usar Este Agente
                      </button>
                      <button 
                        className="btn btn-outline-primary flex-fill"
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Seleccionar Después
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <div className="d-flex align-items-center mb-2">
                      <AlertCircle className="me-2" size={24} />
                      <strong>⚠️ Agente NO encontrado en Equipo de Trabajo</strong>
                    </div>
                    <p className="mb-3">
                      El agente con código <strong>{datosExtraidos.agente?.match(/^(\d+)/)?.[1] || 'N/A'}</strong> no está registrado.
                    </p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary flex-fill"
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary flex-fill"
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Continuar sin Agente
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={onClose}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 3: PREVIEW DE TODOS LOS DATOS */}
            {estado === 'preview-datos' && datosExtraidos && (
              <div>
                <div className="alert alert-success mb-3">
                  <CheckCircle className="me-2" size={20} />
                  <strong>¡Extracción completada!</strong>
                </div>

                {informacionArchivo && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <strong>Archivo:</strong> {informacionArchivo.nombre} ({informacionArchivo.tamaño})
                    </div>
                  </div>
                )}

                {errores.length > 0 && (
                  <div className="alert alert-info mb-3">
                    <h6 className="alert-heading">📊 Reporte de Extracción:</h6>
                    {errores.map((error, idx) => (
                      <div key={idx} className="small">{error}</div>
                    ))}
                  </div>
                )}

                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">🎯 Datos Extraídos del PDF</h6>
                  </div>
                  <div className="card-body" style={{ padding: '0.5rem' }}>
                    {/* DEBUG: Verificar datos antes de renderizar */}
                    {console.log('🔍 DEBUG - datosExtraidos antes de DetalleExpediente:', {
                      marca: datosExtraidos?.marca,
                      modelo: datosExtraidos?.modelo,
                      anio: datosExtraidos?.anio,
                      numero_serie: datosExtraidos?.numero_serie,
                      placas: datosExtraidos?.placas,
                      color: datosExtraidos?.color,
                      producto: datosExtraidos?.producto
                    })}
                    {/* Usar únicamente el componente DetalleExpediente unificado */}
                    <DetalleExpediente
                      datos={datosExtraidos}
                      coberturas={datosExtraidos.coberturas || []}
                      mensajes={datosExtraidos.mensajes || []}
                      utils={utils}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* MODAL DE CAPTURA RFC */}
            {estado === 'capturando-rfc' && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-warning text-dark rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', fontSize: '28px' }}>
                    ⚠️
                  </div>
                  <h5 className="mt-3 mb-2">RFC no encontrado en el PDF</h5>
                  <p className="text-muted">Seleccione el tipo de persona o capture el RFC manualmente</p>
                </div>

                <div className="row g-3 mb-4">
                  {/* Opción Persona Física */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary text-center p-4" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalRFC(false);
                        handleSeleccionRFC('fisica');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,110,253,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          👤
                        </div>
                        <h5 className="card-title text-primary mb-2">Persona Física</h5>
                        <p className="card-text text-muted small mb-3">
                          Se asignará un RFC genérico de 13 caracteres
                        </p>
                        <button 
                          className="btn btn-primary w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('fisica');
                          }}
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opción Persona Moral */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-success text-center p-4" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalRFC(false);
                        handleSeleccionRFC('moral');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,135,84,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          🏢
                        </div>
                        <h5 className="card-title text-success mb-2">Persona Moral</h5>
                        <p className="card-text text-muted small mb-3">
                          Se asignará un RFC genérico de 12 caracteres
                        </p>
                        <button 
                          className="btn btn-success w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('moral');
                          }}
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opción Captura Manual */}
                <div className="card border-info">
                  <div className="card-header bg-info bg-opacity-10 text-center">
                    <h6 className="mb-0 text-info">
                      ✍️ O capture el RFC manualmente si lo conoce
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3 align-items-end">
                      <div className="col-md-8">
                        <label className="form-label small text-muted">RFC (12 o 13 caracteres)</label>
                        <input
                          type="text"
                          className="form-control form-control-lg text-uppercase"
                          placeholder="Ejemplo: XAXX010101000"
                          value={rfcCapturado}
                          onChange={(e) => setRfcCapturado(e.target.value.toUpperCase())}
                          maxLength={13}
                          style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                        />
                        <small className="form-text text-muted">
                          {rfcCapturado.length > 0 && (
                            <span>
                              Longitud actual: <strong>{rfcCapturado.length}</strong> caracteres
                              {rfcCapturado.length === 12 && <span className="text-success ms-2">✓ Persona Moral</span>}
                              {rfcCapturado.length === 13 && <span className="text-primary ms-2">✓ Persona Física</span>}
                              {rfcCapturado.length > 0 && rfcCapturado.length !== 12 && rfcCapturado.length !== 13 && (
                                <span className="text-warning ms-2">⚠ Debe ser 12 o 13 caracteres</span>
                              )}
                            </span>
                          )}
                        </small>
                      </div>
                      <div className="col-md-4">
                        <button
                          className="btn btn-info w-100 btn-lg"
                          disabled={!rfcCapturado || (rfcCapturado.length !== 12 && rfcCapturado.length !== 13)}
                          onClick={() => {
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('capturar', rfcCapturado);
                          }}
                        >
                          Continuar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-4 mb-0">
                  <small>
                    <strong>ℹ️ Nota:</strong> Los RFC genéricos son identificadores temporales válidos. 
                    Podrá editar el RFC correcto después de crear el expediente.
                  </small>
                </div>
              </div>
            )}

            {estado === 'error' && (
              <div className="text-center py-5">
                <XCircle size={48} className="text-danger mb-3" />
                <h6 className="mb-3 text-danger">Error al procesar el archivo</h6>
                <div className="alert alert-danger">
                  {errores.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
                <button 
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    setEstado('esperando');
                    setErrores([]);
                  }}
                >
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            {estado === 'preview-datos' && datosExtraidos && (
              <button
                type="button"
                className="btn btn-success"
                onClick={aplicarDatos}
              >
                <CheckCircle className="me-2" size={16} />
                Aplicar al Formulario
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============= COMPONENTES DE VISTA =============

const ModalCancelacion = React.memo(({ 
  mostrarModalCancelacion,
  setMostrarModalCancelacion,
  expedienteACancelar,
  motivoCancelacion,
  setMotivoCancelacion,
  motivosCancelacion,
  confirmarCancelacion
}) => (
  <div>
    {mostrarModalCancelacion && (
      <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Cancelar Expediente</h5>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setMostrarModalCancelacion(false)}
              ></button>
            </div>
            <div className="modal-body">
              <p>¿Está seguro de cancelar el expediente de <strong>{expedienteACancelar?.nombre} {expedienteACancelar?.apellido_paterno}</strong>?</p>
              
              <div className="mb-3">
                <label className="form-label">Motivo de cancelación *</label>
                <select 
                  className="form-select"
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                >
                  <option value="">Seleccionar motivo</option>
                  {motivosCancelacion.map(motivo => (
                    <option key={motivo} value={motivo}>{motivo}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setMostrarModalCancelacion(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={confirmarCancelacion}
                disabled={!motivoCancelacion}
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
));

const ListaExpedientes = React.memo(({ 
  expedientes,
  agentes,
  limpiarFormulario,
  setVistaActual,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  verDetalles,
  editarExpediente,
  eliminarExpediente,
  calcularProximoPago,
  clientesMap,
  abrirModalCompartir
}) => {
  const paginacion = usePaginacion(expedientes, 10);

  // Detectar 3 tipos de duplicados
  const analisisDuplicados = React.useMemo(() => {
    const polizasDuplicadas = [];
    const vinsDuplicados = [];
    const polizasVinDistinto = [];

    expedientes.forEach((exp, index) => {
      // Solo analizar si tiene número de póliza
      if (!exp.numero_poliza) return;

      const vin = exp.numero_serie?.trim() || '';

      // Buscar otros expedientes
      expedientes.forEach((otro, otroIndex) => {
        if (index >= otroIndex || !otro.numero_poliza) return;

        const otroVin = otro.numero_serie?.trim() || '';

        // Regla 1: Misma póliza + mismo VIN (duplicada completa)
        if (exp.numero_poliza === otro.numero_poliza &&
            exp.compania === otro.compania &&
            vin !== '' && otroVin !== '' &&
            vin === otroVin) {
          if (!polizasDuplicadas.find(d => d.id === exp.id)) {
            polizasDuplicadas.push({ id: exp.id, tipo: 'completa', poliza: exp.numero_poliza, vin });
          }
          if (!polizasDuplicadas.find(d => d.id === otro.id)) {
            polizasDuplicadas.push({ id: otro.id, tipo: 'completa', poliza: otro.numero_poliza, vin: otroVin });
          }
        }
        // Regla 2: Mismo VIN, diferente póliza
        else if (vin !== '' && otroVin !== '' &&
                 vin === otroVin &&
                 exp.numero_poliza !== otro.numero_poliza) {
          if (!vinsDuplicados.find(d => d.id === exp.id)) {
            vinsDuplicados.push({ id: exp.id, vin, poliza: exp.numero_poliza });
          }
          if (!vinsDuplicados.find(d => d.id === otro.id)) {
            vinsDuplicados.push({ id: otro.id, vin: otroVin, poliza: otro.numero_poliza });
          }
        }
        // Regla 3: Misma póliza, diferente VIN
        else if (exp.numero_poliza === otro.numero_poliza &&
                 exp.compania === otro.compania &&
                 vin !== '' && otroVin !== '' &&
                 vin !== otroVin) {
          if (!polizasVinDistinto.find(d => d.id === exp.id)) {
            polizasVinDistinto.push({ id: exp.id, poliza: exp.numero_poliza, vin });
          }
          if (!polizasVinDistinto.find(d => d.id === otro.id)) {
            polizasVinDistinto.push({ id: otro.id, poliza: otro.numero_poliza, vin: otroVin });
          }
        }
      });
    });

    return { polizasDuplicadas, vinsDuplicados, polizasVinDistinto };
  }, [expedientes]);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">Gestión de Pólizas</h3>
        <button
          onClick={() => {
            limpiarFormulario();
            setVistaActual('formulario');
          }}
          className="btn btn-primary"
        >
          <Plus size={16} className="me-2" />
          Nueva Póliza
        </button>
      </div>

      {/* Alertas de duplicados */}
      {(analisisDuplicados.polizasDuplicadas.length > 0 || 
        analisisDuplicados.vinsDuplicados.length > 0 || 
        analisisDuplicados.polizasVinDistinto.length > 0) && (
        <div className="mb-3">
          {analisisDuplicados.polizasDuplicadas.length > 0 && (
            <div className="alert alert-warning mb-2" role="alert">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Pólizas Duplicadas:</strong> {analisisDuplicados.polizasDuplicadas.length} registro(s) con misma póliza y mismo VIN
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver pólizas duplicadas
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.polizasDuplicadas.forEach(d => {
                      const clave = `${d.poliza}-${d.vin}`;
                      if (!grupos[clave]) grupos[clave] = [];
                      grupos[clave].push(d);
                    });
                    return Object.entries(grupos).map(([clave, items]) => (
                      <li key={clave} className="mb-1">
                        <strong>Póliza: {items[0].poliza}</strong> | VIN: {items[0].vin} 
                        <span className="text-muted"> ({items.length} registros)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
          {analisisDuplicados.vinsDuplicados.length > 0 && (
            <div className="alert alert-warning mb-2" role="alert" style={{borderLeft: '4px solid #fd7e14'}}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ VINs Duplicados:</strong> {analisisDuplicados.vinsDuplicados.length} registro(s) con VIN repetido en diferentes pólizas
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver VINs duplicados - revisar
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.vinsDuplicados.forEach(d => {
                      if (!grupos[d.vin]) grupos[d.vin] = [];
                      grupos[d.vin].push(d);
                    });
                    return Object.entries(grupos).map(([vin, items]) => (
                      <li key={vin} className="mb-1">
                        <strong>VIN: {vin}</strong> aparece en pólizas: {items.map(i => i.poliza).join(', ')}
                        <span className="text-muted"> ({items.length} pólizas)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
          {analisisDuplicados.polizasVinDistinto.length > 0 && (
            <div className="alert alert-danger mb-2" role="alert">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Pólizas con VIN Distinto:</strong> {analisisDuplicados.polizasVinDistinto.length} registro(s) con mismo número de póliza pero VIN diferente
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver pólizas con VIN distinto - revisar urgente
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.polizasVinDistinto.forEach(d => {
                      if (!grupos[d.poliza]) grupos[d.poliza] = [];
                      grupos[d.poliza].push(d);
                    });
                    return Object.entries(grupos).map(([poliza, items]) => (
                      <li key={poliza} className="mb-1">
                        <strong>Póliza: {poliza}</strong> tiene VINs: {items.map(i => i.vin).join(', ')}
                        <span className="text-muted"> ({items.length} VINs diferentes)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {expedientes.length > 0 && (
        <div className="row mb-3">
          <div className="col-md-6">
            <BarraBusqueda 
              busqueda={paginacion.busqueda}
              setBusqueda={paginacion.setBusqueda}
              placeholder="Buscar pólizas..."
            />
          </div>
          <div className="col-md-6 text-end">
            <small className="text-muted">
              Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} pólizas
            </small>
          </div>
        </div>
      )}

      <div className="card">
        {expedientes.length === 0 ? (
          <div className="card-body text-center py-5">
            <FileText size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No hay pólizas registradas</h5>
            <p className="text-muted">Crea tu primera póliza para comenzar</p>
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
              <table className="table table-hover table-sm mb-0">
                <thead className="table-light">
                  <tr style={{ fontSize: '0.75rem' }}>
                    <th style={{ width: '100px', verticalAlign: 'middle' }}>Póliza</th>
                    <th style={{ width: '180px', verticalAlign: 'middle' }}>Cliente</th>
                    <th style={{ width: '100px', verticalAlign: 'middle' }}>Compañía</th>
                    <th style={{ width: '200px', verticalAlign: 'middle' }}>Producto</th>
                    <th style={{ width: '80px' }}>
                      <div>Etapa</div>
                      <div>Activa</div>
                    </th>
                    <th style={{ width: '100px', verticalAlign: 'middle' }}>Agente</th>
                    <th style={{ width: '100px' }}>
                      <div>Tipo</div>
                      <div>Estatus Pago</div>
                    </th>
                    <th style={{ width: '100px' }}>
                      <div>Vigencia</div>
                      <div>Pago</div>
                    </th>
                    <th width="180" style={{ verticalAlign: 'middle' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacion.itemsPaginados.map((expediente) => {
                    const agenteInfo = agentes.find(a => a.codigoAgente === expediente.agente);
                    
                    // Detectar tipo de duplicado para este expediente
                    const esDuplicadaCompleta = analisisDuplicados.polizasDuplicadas.find(d => d.id === expediente.id);
                    const esVinDuplicado = analisisDuplicados.vinsDuplicados.find(d => d.id === expediente.id);
                    const esPolizaVinDistinto = analisisDuplicados.polizasVinDistinto.find(d => d.id === expediente.id);
                    
                    return (
                      <tr key={expediente.id} style={{ fontSize: '0.8rem', verticalAlign: 'middle' }}>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div>
                            <strong className="text-primary">{expediente.numero_poliza || '-'}</strong>
                            {esDuplicadaCompleta && (
                              <div>
                                <span className="badge bg-warning text-dark" style={{ fontSize: '0.7rem' }} title="Póliza duplicada (misma póliza + mismo VIN)">
                                  ⚠️ Duplicada
                                </span>
                              </div>
                            )}
                            {esVinDuplicado && (
                              <div>
                                <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: '#fd7e14', color: 'white' }} title="VIN duplicado en otra póliza - Revisar">
                                  ⚠️ VIN Duplicado
                                </span>
                              </div>
                            )}
                            {esPolizaVinDistinto && (
                              <div>
                                <span className="badge bg-danger" style={{ fontSize: '0.7rem' }} title="Mismo número de póliza con VIN diferente - Revisar urgente">
                                  ⚠️ Póliza VIN Distinto
                                </span>
                              </div>
                            )}
                            {expediente.endoso && (
                              <div><small className="text-muted" style={{ fontSize: '0.7rem' }}>End: {expediente.endoso}</small></div>
                            )}
                            {expediente.inciso && (
                              <div><small className="text-muted" style={{ fontSize: '0.7rem' }}>Inc: {expediente.inciso}</small></div>
                            )}
                          </div>
                        </td>
                        <td><InfoCliente expediente={expediente} cliente={clientesMap[expediente.cliente_id]} /></td>
                        <td>{expediente.compania}</td>
                        <td>
                          <div>
                            <strong>{expediente.producto}</strong>
                            {(expediente.producto === 'Autos' || expediente.producto?.includes('Autos')) && (
                              <>
                                {expediente.tipo_cobertura && (
                                  <div className="text-muted">
                                    {expediente.tipo_cobertura}
                                  </div>
                                )}
                                {(expediente.marca || expediente.modelo) && (
                                  <div>
                                    {expediente.marca} {expediente.modelo}
                                  </div>
                                )}
                                {(expediente.anio || expediente.numero_serie) && (
                                  <div className="text-muted">
                                    {expediente.anio && <>Año: {expediente.anio}</>}
                                    {expediente.anio && expediente.numero_serie && <> | </>}
                                    {expediente.numero_serie && <>VIN: {expediente.numero_serie}</>}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge tipo="etapa" valor={expediente.etapa_activa} />
                          {expediente.motivoCancelacion && (
                            <div><small className="text-muted" style={{ fontSize: '0.7rem' }}>Motivo: {expediente.motivoCancelacion}</small></div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{agenteInfo ? `${agenteInfo.codigoAgente} - ${agenteInfo.nombre}` : expediente.agente || '-'}</td>
                        <td>
                          <EstadoPago expediente={expediente} />
                          <CalendarioPagos 
                            expediente={expediente} 
                            calcularProximoPago={calcularProximoPago}
                            compacto={true}
                          />
                        </td>
                        <td style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                          <div>
                            {expediente.inicio_vigencia ? utils.formatearFecha(expediente.inicio_vigencia, 'cortaY') : '-'}
                          </div>
                          <div>
                            {expediente.termino_vigencia ? utils.formatearFecha(expediente.termino_vigencia, 'cortaY') : '-'}
                          </div>
                          <div className="fw-semibold" style={{ marginTop: '2px', color: '#f59e0b' }}>
                            {expediente.fecha_vencimiento_pago ? utils.formatearFecha(expediente.fecha_vencimiento_pago, 'cortaY') : 
                             expediente.proximoPago ? utils.formatearFecha(expediente.proximoPago, 'cortaY') :
                             expediente.fecha_pago ? utils.formatearFecha(expediente.fecha_pago, 'cortaY') : '-'}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap align-items-start">
                            {(expediente.etapa_activa === 'Emitida' || expediente.etapa_activa === 'Enviada al Cliente') && (
                              <button
                                onClick={() => abrirModalCompartir(expediente)}
                                className="btn btn-success btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                title="Compartir"
                              >
                                <Share2 size={12} />
                              </button>
                            )}

                            {(() => {
                              // Permitir aplicar pago en estas etapas
                              const etapasValidasParaPago = ['Emitida', 'Renovada', 'Enviada al Cliente'];
                              const etapaValida = etapasValidasParaPago.includes(expediente.etapa_activa);
                              const estatusPagoNorm = (expediente.estatusPago || '').toLowerCase().trim();
                              const noPagado = estatusPagoNorm !== 'pagado' && estatusPagoNorm !== 'pagada';
                              
                              return etapaValida && noPagado ? (
                                <button
                                  onClick={() => aplicarPago(expediente.id)}
                                  className="btn btn-success btn-sm"
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                  title="Aplicar Pago"
                                >
                                  <DollarSign size={12} />
                                </button>
                              ) : null;
                            })()}

                            
                            {expediente.etapa_activa !== 'Cancelada' && (
                              <button
                                onClick={() => iniciarCancelacion(expediente)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                title="Cancelar Póliza"
                              >
                                <XCircle size={12} />
                              </button>
                            )}
                            
                            <button
                              onClick={() => verDetalles(expediente)}
                              className="btn btn-outline-primary btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Ver detalles"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              onClick={() => editarExpediente(expediente)}
                              className="btn btn-outline-secondary btn-sm"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarExpediente(expediente.id)}
                              className="btn btn-outline-danger btn-sm"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
  );
});

const Formulario = React.memo(({ 
  modoEdicion,
  setVistaActual,
  formulario,
  setFormulario,
  actualizarCalculosAutomaticos,
  guardarExpediente,
  companias,
  productos,
  etapasActivas,
  agentes,
  tiposPago,
  frecuenciasPago,
  periodosGracia,
  estatusPago,
  marcasVehiculo,
  tiposVehiculo,
  tiposCobertura,
  calculartermino_vigencia,
  calcularProximoPago,
  CONSTANTS,
  handleClienteSeleccionado,
  clienteSeleccionado,
  handleSeleccionarPDF,
  archivoSeleccionado,
  subiendoPDF,
  subirPDFPoliza
}) => {
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);
  const [infoImportacion, setInfoImportacion] = useState(null);
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');
  const [datosTemporales, setDatosTemporales] = useState(null);

  const handleDataExtracted = useCallback(async (datosExtraidos) => {
    try {
      // 1. USAR EL CLIENTE QUE YA FUE CREADO EN EL EXTRACTOR PDF
      let clienteSeleccionadoFinal = null;
      
      if (datosExtraidos.cliente_id) {
        // El cliente ya fue creado o encontrado en el extractor PDF
        // Buscar el cliente en la base de datos usando el cliente_id
        console.log('� Buscando cliente con ID:', datosExtraidos.cliente_id);
        
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          clienteSeleccionadoFinal = clientes.find(c => c.id === datosExtraidos.cliente_id);
          
          if (clienteSeleccionadoFinal) {
            handleClienteSeleccionado(clienteSeleccionadoFinal);
            console.log('✅ Cliente vinculado:', clienteSeleccionadoFinal.nombre || clienteSeleccionadoFinal.razonSocial, 'ID:', clienteSeleccionadoFinal.id);
          } else {
            console.error('❌ No se encontró el cliente con ID:', datosExtraidos.cliente_id);
          }
        } catch (error) {
          console.error('❌ Error al buscar cliente:', error);
        }
      } else {
        console.warn('⚠️ No se proporcionó cliente_id. El cliente debe ser seleccionado manualmente.');
      }
      
      // 2. BUSCAR AGENTE POR CÓDIGO Y COMPAÑÍA
      // El agente extraído viene en formato: "25576 - ALVARO IVAN GONZALEZ JIMENEZ"
      let agenteCodigo = null;
      if (datosExtraidos.agente && agentes.length > 0) {
        // Extraer código del agente del formato "25576 - NOMBRE"
        const codigoAgenteMatch = datosExtraidos.agente.match(/^(\d+)/);
        if (codigoAgenteMatch) {
          const codigoAgente = codigoAgenteMatch[1];
          
          // Buscar agente en el equipo de trabajo que tenga ese código
          // Nota: Un agente puede tener diferentes códigos según la compañía
          const agenteEncontrado = agentes.find(miembro => 
            miembro.perfil === 'Agente' && 
            miembro.activo &&
            (miembro.codigo === codigoAgente || miembro.codigoAgente === codigoAgente)
          );
          
          if (agenteEncontrado) {
            agenteCodigo = agenteEncontrado.codigo || agenteEncontrado.codigoAgente;
            console.log('✅ Agente encontrado en equipo:', agenteEncontrado.nombre, 'Código:', agenteCodigo);
          } else {
            console.warn('⚠️ Agente no encontrado en equipo. Código:', codigoAgente, 'Compañía:', datosExtraidos.compania);
            console.log('💡 El agente debe ser agregado al Equipo de Trabajo antes de asignar pólizas');
          }
        }
      }
      
      // 3. BUSCAR VENDEDOR/SUB-AGENTE (si aplica)
      // Los vendedores usan la misma clave que el agente al que están ligados
      // Por ahora lo dejamos vacío, se puede seleccionar manualmente
      let subAgenteId = null;
      
      // 4. POPULAR FORMULARIO CON DATOS DE LA PÓLIZA (NO sobrescribir datos del cliente)
      // handleClienteSeleccionado YA aplicó los datos del cliente correctamente
      console.log('📋 Datos de la póliza a aplicar:', {
        compania: datosExtraidos.compania,
        producto: datosExtraidos.producto,
        numero_poliza: datosExtraidos.numero_poliza
      });
      
      // EXCLUIR campos del cliente para NO sobrescribirlos con valores undefined del PDF
      const { 
        // Campos del cliente que NO deben sobrescribirse
        nombre, apellido_paterno, apellido_materno, 
        razonSocial, razon_social, 
        nombreComercial, nombre_comercial,
        rfc, tipo_persona,
        email, telefono_fijo, telefono_movil,
        // El resto son datos de la póliza
        ...datosPoliza 
      } = datosExtraidos;
      
      // DEBUG: Verificar datos del vehículo
      console.log('🚗 DEBUG - Datos del vehículo en datosPoliza:', {
        marca: datosPoliza.marca,
        modelo: datosPoliza.modelo,
        anio: datosPoliza.anio,
        numero_serie: datosPoliza.numero_serie,
        placas: datosPoliza.placas,
        color: datosPoliza.color
      });
      
      // Usar setFormulario con callback para hacer UPDATE PARCIAL
      setFormulario(prev => {
        // ✅ LÓGICA MEJORADA: Solo aplicar datos del PDF si el campo actual está vacío o es null
        const aplicarSiVacio = (valorPDF, valorActual) => {
          // Si el valor actual tiene contenido válido, mantenerlo
          if (valorActual && valorActual !== '' && valorActual !== null) {
            return valorActual;
          }
          // Si el valor del PDF está vacío o es string vacío, usar null
          if (!valorPDF || valorPDF === '') {
            return null;
          }
          // Usar valor del PDF
          return valorPDF;
        };

        const nuevoFormulario = {
          ...prev, // Mantener TODO (incluye datos del cliente que ya están bien)
          ...datosPoliza, // Aplicar datos de la póliza base
          // Mantener cliente_id
          cliente_id: datosExtraidos.cliente_id || prev.cliente_id,
          
          // ✅ PROTEGER campos críticos que el usuario pudo haber llenado manualmente
          cargo_pago_fraccionado: aplicarSiVacio(datosPoliza.cargo_pago_fraccionado, prev.cargo_pago_fraccionado),
          gastos_expedicion: aplicarSiVacio(datosPoliza.gastos_expedicion, prev.gastos_expedicion),
          subtotal: aplicarSiVacio(datosPoliza.subtotal, prev.subtotal),
          uso: aplicarSiVacio(datosPoliza.uso, prev.uso),
          servicio: aplicarSiVacio(datosPoliza.servicio, prev.servicio),
          movimiento: aplicarSiVacio(datosPoliza.movimiento, prev.movimiento),
          // Si no tiene fecha_emision, usar fecha actual como valor inicial
          fecha_emision: datosPoliza.fecha_emision || prev.fecha_emision || new Date().toISOString().split('T')[0],
          // Forzar valores de la póliza
          agente: agenteCodigo || '',
          sub_agente: '',
          etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
          compania: datosExtraidos.compania,
          producto: datosExtraidos.producto,
          // ====== CONFIGURACIÓN DE PAGOS FRACCIONADOS ======
          // Mapear tipo_pago y frecuenciaPago desde forma_pago si existe
          tipo_pago: datosExtraidos.tipo_pago || prev.tipo_pago,
          frecuenciaPago: datosExtraidos.frecuenciaPago || prev.frecuenciaPago,
          forma_pago: datosExtraidos.forma_pago || prev.forma_pago,
          primer_pago: datosExtraidos.primer_pago || prev.primer_pago,
          pagos_subsecuentes: datosExtraidos.pagos_subsecuentes || prev.pagos_subsecuentes,
          periodo_gracia: datosExtraidos.periodo_gracia || datosExtraidos.plazo_pago_dias || prev.periodo_gracia,
          // Guardar temporalmente el archivo PDF traído desde el extractor (no se envía al backend)
          __pdfFile: datosExtraidos.__pdfFile || prev.__pdfFile,
          __pdfNombre: datosExtraidos.__pdfNombre || prev.__pdfNombre,
          __pdfSize: datosExtraidos.__pdfSize || prev.__pdfSize
        };
        
        console.log('✅ Formulario actualizado - Datos del cliente preservados:', {
          cliente_id: nuevoFormulario.cliente_id,
          razon_social: nuevoFormulario.razon_social,
          rfc: nuevoFormulario.rfc,
          email: nuevoFormulario.email,
          telefono_movil: nuevoFormulario.telefono_movil
        });
        
        console.log('✅ Formulario actualizado - Datos de la póliza aplicados:', {
          compania: nuevoFormulario.compania,
          producto: nuevoFormulario.producto,
          numero_poliza: nuevoFormulario.numero_poliza,
          inicio_vigencia: nuevoFormulario.inicio_vigencia
        });
        
        console.log('🚗 DEBUG - Datos del vehículo en nuevoFormulario:', {
          marca: nuevoFormulario.marca,
          modelo: nuevoFormulario.modelo,
          anio: nuevoFormulario.anio,
          numero_serie: nuevoFormulario.numero_serie,
          placas: nuevoFormulario.placas,
          color: nuevoFormulario.color
        });
        
        return nuevoFormulario;
      });
      
      // 5. RECALCULAR FECHAS Y MONTOS AUTOMÁTICOS (incluye estatusPago)
      if (datosExtraidos.inicio_vigencia) {
        setTimeout(() => {
          setFormulario(prev => {
            const formularioConCalculos = actualizarCalculosAutomaticos(prev);
            // ✅ SOLO aplicar los cálculos automáticos, NO sobrescribir datos del PDF
            // Los datos del PDF ya están en 'prev' del setFormulario anterior
            return {
              ...prev,
              ...formularioConCalculos
              // NO sobrescribir nada más - los datos del PDF ya están en 'prev'
            };
          });
          console.log('✅ Cálculos automáticos aplicados (preservando datos del PDF)');
        }, 150);
      } else {
        // FORZAR la actualización después de un pequeño delay
        setTimeout(() => {
          setFormulario(prev => ({
            ...prev,
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteCodigo || '',
            // Preservar datos del vehículo también en este caso
            marca: datosExtraidos.marca,
            modelo: datosExtraidos.modelo,
            anio: datosExtraidos.anio,
            numero_serie: datosExtraidos.numero_serie,
            motor: datosExtraidos.motor,
            placas: datosExtraidos.placas,
            color: datosExtraidos.color,
            tipo_vehiculo: datosExtraidos.tipo_vehiculo,
            tipo_cobertura: datosExtraidos.tipo_cobertura,
            codigo_vehiculo: datosExtraidos.codigo_vehiculo,
            // Preservar campos adicionales de pago y póliza
            tipo_pago: datosExtraidos.tipo_pago,
            frecuenciaPago: datosExtraidos.frecuenciaPago,
            primer_pago: datosExtraidos.primer_pago,
            pagos_subsecuentes: datosExtraidos.pagos_subsecuentes,
            forma_pago: datosExtraidos.forma_pago,
            uso: datosExtraidos.uso,
            servicio: datosExtraidos.servicio,
            movimiento: datosExtraidos.movimiento
          }));
          console.log('✅ Valores forzados después del render (incluyendo vehículo)');
        }, 100);
      }
      
      // 6. MOSTRAR MENSAJE DE CONFIRMACIÓN
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
      
      // Guardar información de la importación para mostrar en UI
      setInfoImportacion({
        clienteCreado: clienteSeleccionadoFinal && !datosExtraidos.cliente_existente,
        clienteEncontrado: !!datosExtraidos.cliente_existente,
        nombreCliente: clienteSeleccionadoFinal?.nombre || 'N/A',
        agenteAsignado: !!agenteCodigo,
        poliza: datosExtraidos.numero_poliza || 'N/A',
        compania: datosExtraidos.compania || 'N/A'
      });
      
      // Mostrar resumen de lo que se importó
      console.log('📊 Resumen de importación:');
      if (clienteSeleccionadoFinal) {
        const esNuevo = !datosExtraidos.cliente_existente;
        console.log('  Cliente:', esNuevo ? '🆕 Creado automáticamente' : '✅ Encontrado', '-', clienteSeleccionadoFinal.nombre);
        console.log('  ID Cliente:', clienteSeleccionadoFinal.id);
      } else {
        console.log('  Cliente: ⚠️ No pudo crearse - revisar datos');
      }
      console.log('  Agente:', agenteCodigo ? '✅ Asignado' : '⚠️ No encontrado (revisar código)');
      console.log('  Póliza:', datosExtraidos.numero_poliza || 'N/A');
      console.log('  Compañía:', datosExtraidos.compania || 'N/A');
      
    } catch (error) {
      console.error('Error al procesar datos extraídos:', error);
      // Aún así intentar popular el formulario con lo que se pueda
      setFormulario(prev => ({
        ...prev,
        ...datosExtraidos,
        fecha_creacion: prev.fecha_creacion,
        id: prev.id
      }));
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
    }
  }, [formulario, actualizarCalculosAutomaticos, setFormulario, handleClienteSeleccionado, agentes]);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          {modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente'}
        </h3>
        <div className="d-flex gap-2">
          {!modoEdicion && (
            <button
              onClick={() => {
                console.log('🔵 Abriendo extractor PDF...');
                setMostrarExtractorPDF(true);
              }}
              className="btn btn-outline-primary"
              title="Extraer datos automáticamente desde una póliza PDF"
            >
              <Upload size={16} className="me-2" />
              Importar PDF
            </button>
          )}
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {datosImportadosDesdePDF && !modoEdicion && infoImportacion && (
            <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
              <CheckCircle className="me-2" size={20} />
              <div>
                <strong>✅ Datos importados desde PDF exitosamente</strong>
                <ul className="mb-0 mt-2" style={{ fontSize: '0.9rem' }}>
                  {infoImportacion.clienteCreado && (
                    <li>🆕 <strong>Cliente creado automáticamente:</strong> {infoImportacion.nombreCliente}</li>
                  )}
                  {infoImportacion.clienteEncontrado && (
                    <li>✅ <strong>Cliente encontrado:</strong> {infoImportacion.nombreCliente}</li>
                  )}
                  {!infoImportacion.clienteCreado && !infoImportacion.clienteEncontrado && (
                    <li>⚠️ <strong>Cliente no pudo crearse</strong> - Verifica los datos extraídos</li>
                  )}
                  <li>📄 <strong>Póliza:</strong> {infoImportacion.poliza}</li>
                  <li>🏢 <strong>Compañía:</strong> {infoImportacion.compania}</li>
                  {infoImportacion.agenteAsignado ? (
                    <li>✅ <strong>Agente asignado automáticamente</strong></li>
                  ) : (
                    <li>⚠️ <strong>Agente no encontrado</strong> - Selecciónalo manualmente</li>
                  )}
                </ul>
                <small className="text-muted mt-2 d-block">
                  💡 Revisa la información y completa los campos faltantes antes de guardar
                </small>
              </div>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => {
                  setDatosImportadosDesdePDF(false);
                  setInfoImportacion(null);
                }}
              ></button>
            </div>
          )}

          {/* Datos del Cliente */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">
              {clienteSeleccionado?.tipoPersona === 'Persona Moral' ? 'Datos de la Empresa' : 'Datos del Cliente'}
            </h5>
            
            {/* Buscador de Cliente */}
            <BuscadorCliente
              onClienteSeleccionado={handleClienteSeleccionado}
              clienteSeleccionado={clienteSeleccionado}
              datosIniciales={{
                nombre: formulario.nombre,
                apellido_paterno: formulario.apellido_paterno,
                apellido_materno: formulario.apellido_materno,
                rfc: formulario.rfc
              }}
              mostrarBotonNuevo={true}
            />

            {/* Datos del cliente (solo lectura si está seleccionado) */}
            {clienteSeleccionado && (
              <div className="row g-3 mt-2" key={clienteSeleccionado.id}>
                {clienteSeleccionado.tipoPersona === 'Persona Moral' ? (
                  // Campos para Persona Moral (Empresa)
                  <>
                    <div className="col-md-12">
                      <label className="form-label">Razón Social</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.razon_social || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Nombre Comercial</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.nombre_comercial || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">RFC</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.rfc || ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Datos de Contacto - Editables */}
                    <div className="col-12">
                      <hr className="my-3" />
                      <h6 className="text-muted mb-2">
                        💼 Datos del Contacto Principal
                        <small className="ms-2" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                          (Editable - Se actualizará el cliente)
                        </small>
                      </h6>
                      <div className="alert alert-info py-2 px-3 mb-3" role="alert" style={{ fontSize: '0.85rem' }}>
                        Requisito mínimo para guardar póliza (PM): <strong>Nombre</strong> y <strong>Email</strong> o <strong>Teléfono Móvil</strong>.
                      </div>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label">Nombre del Contacto <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_nombre || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_nombre: e.target.value})}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_paterno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_paterno: e.target.value})}
                        placeholder="Apellido Paterno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_materno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_materno: e.target.value})}
                        placeholder="Apellido Materno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Email del Contacto <span className="text-muted">(uno de estos)</span></label>
                      <input
                        type="email"
                        className="form-control"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Móvil <span className="text-muted">(uno de estos)</span></label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.contacto_telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                  </>
                ) : (
                  // Campos para Persona Física
                  <>
                    {/* Datos del Cliente (Solo lectura) */}
                    <div className="col-12">
                      <h6 className="text-muted mb-3">
                        👤 Datos del Cliente
                        <small className="ms-2" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                          (Solo lectura)
                        </small>
                      </h6>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label">Nombre</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.nombre ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.apellido_paterno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.apellido_materno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">RFC</label>
                      <input
                        type="text"
                        className="form-control bg-light"
                        value={formulario.rfc ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formulario.email || ''}
                        onChange={(e) => setFormulario({...formulario, email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_fijo: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    
                    {/* Datos de Contacto Adicional/Gestor - Editables */}
                    <div className="col-12">
                      <hr className="my-3" />
                      <h6 className="text-muted mb-3">
                        💼 Contacto Adicional / Gestor
                        <small className="ms-2" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                          (Opcional - Editable)
                        </small>
                      </h6>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label">Nombre del Contacto</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_nombre || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_nombre: e.target.value})}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_paterno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_paterno: e.target.value})}
                        placeholder="Apellido Paterno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_materno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_materno: e.target.value})}
                        placeholder="Apellido Materno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Email del Contacto</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={formulario.contacto_telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Datos del Seguro */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos del Seguro</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Compañía <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formulario.compania}
                  onChange={(e) => {
                    const nuevaCompania = e.target.value;
                    const nuevoFormulario = { ...formulario, compania: nuevaCompania };
                    // Recalcular automáticamente con la nueva compañía
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                  required
                >
                  <option value="">Seleccionar compañía</option>
                  {companias.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Producto <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formulario.producto}
                  onChange={(e) => {
                    const nuevoProducto = e.target.value;
                    if (formulario.producto === 'Autos Individual' && nuevoProducto !== 'Autos') {
                      setFormulario(prev => ({
                        ...prev, 
                        producto: nuevoProducto,
                        marca: '',
                        modelo: '',
                        anio: '',
                        numero_serie: '',
                        placas: '',
                        color: '',
                        tipo_vehiculo: '',
                        numero_poliza: '',
                        tipo_cobertura: '',
                        deducible: '',
                        suma_asegurada: '',
                        conductor_habitual: '',
                        edad_conductor: '',
                        licencia_conducir: ''
                      }));
                    } else {
                      setFormulario(prev => ({ ...prev, producto: nuevoProducto }));
                    }
                  }}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(prod => (
                    <option key={prod} value={prod}>{prod}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Etapa Activa</label>
                <select
                  className="form-select"
                  value={formulario.etapa_activa}
                  onChange={(e) => setFormulario(prev => ({ ...prev, etapa_activa: e.target.value }))}
                >
                  {etapasActivas.map(etapa => (
                    <option key={etapa} value={etapa}>{etapa}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {formulario.producto && formulario.producto.toLowerCase().includes('autos') && (
            <div className="alert alert-info mb-4">
              <h6 className="alert-heading">
                <AlertCircle className="me-2" size={20} />
                Información Adicional Requerida para Seguros de Autos
              </h6>
              <p className="mb-0">
                Se han habilitado campos adicionales específicos para el seguro de automóviles.
              </p>
            </div>
          )}

          {/* Datos del Vehículo - Solo si es Autos */}
          {formulario.producto && formulario.producto.toLowerCase().includes('autos') && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos del Vehículo</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <select
                    className="form-select"
                    value={formulario.marca}
                    onChange={(e) => setFormulario(prev => ({ ...prev, marca: e.target.value }))}
                  >
                    <option value="">Seleccionar marca</option>
                    {marcasVehiculo.map(marca => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modelo</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.modelo}
                    onChange={(e) => setFormulario(prev => ({ ...prev, modelo: e.target.value }))}
                    placeholder="Ej: Civic, Jetta, etc."
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Año</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.anio}
                    onChange={(e) => setFormulario(prev => ({ ...prev, anio: e.target.value }))}
                    min={CONSTANTS.MIN_YEAR}
                    max={CONSTANTS.MAX_YEAR}
                    placeholder="Ej: 2023"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Número de Serie (VIN)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.numero_serie}
                    onChange={(e) => setFormulario(prev => ({ ...prev, numero_serie: e.target.value.toUpperCase() }))}
                    placeholder={`${CONSTANTS.VIN_LENGTH} caracteres`}
                    maxLength={CONSTANTS.VIN_LENGTH}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Placas</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.placas}
                    onChange={(e) => setFormulario(prev => ({ ...prev, placas: e.target.value.toUpperCase() }))}
                    placeholder="Ej: ABC-123"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Color</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.color}
                    onChange={(e) => setFormulario(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="Ej: Rojo, Azul, etc."
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Tipo de Vehículo</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_vehiculo}
                    onChange={(e) => setFormulario(prev => ({ ...prev, tipo_vehiculo: e.target.value }))}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposVehiculo.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Datos de la Póliza - Visible para Autos o si ya existen valores (edición) */}
          {(formulario.producto === 'Autos Individual' || formulario.uso || formulario.servicio || formulario.movimiento) && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos de la Póliza</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Número de Póliza</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.numero_poliza ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, numero_poliza: e.target.value }))}
                    placeholder="Número asignado por la aseguradora"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Tipo de Cobertura</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_cobertura}
                    onChange={(e) => setFormulario(prev => ({ ...prev, tipo_cobertura: e.target.value }))}
                  >
                    <option value="">Seleccionar cobertura</option>
                    {tiposCobertura.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Deducible</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      value={formulario.deducible ?? ''}
                      onChange={(e) => setFormulario(prev => ({ ...prev, deducible: e.target.value }))}
                      placeholder="Porcentaje o monto"
                      step="0.01"
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Suma Asegurada</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      value={formulario.suma_asegurada ?? ''}
                      onChange={(e) => setFormulario(prev => ({ ...prev, suma_asegurada: e.target.value }))}
                      placeholder="Valor del vehículo"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Uso</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.uso || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      uso: e.target.value, 
                      // Mantener alias para backend si lo utiliza
                      uso_poliza: e.target.value 
                    }))}
                    placeholder="Ej: PARTICULAR"
                  />
                  <small className="form-text text-muted">Uso del vehículo según póliza</small>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Servicio</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.servicio || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      servicio: e.target.value,
                      servicio_poliza: e.target.value
                    }))}
                    placeholder="Ej: PRIVADO"
                  />
                  <small className="form-text text-muted">Servicio del vehículo</small>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Movimiento</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.movimiento || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      movimiento: e.target.value,
                      movimiento_poliza: e.target.value
                    }))}
                    placeholder="Ej: NACIONAL"
                  />
                  <small className="form-text text-muted">Movimiento permitido</small>
                </div>
              </div>
            </div>
          )}

          {/* Datos del Conductor - Solo si es Autos */}
          {formulario.producto === 'Autos Individual' && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos del Conductor</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Conductor Habitual</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.conductor_habitual ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, conductor_habitual: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Edad del Conductor</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.edad_conductor ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, edad_conductor: e.target.value }))}
                    placeholder="Años"
                    min="18"
                    max="99"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Licencia de Conducir</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.licencia_conducir ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, licencia_conducir: e.target.value.toUpperCase() }))}
                    placeholder="Número de licencia"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Datos Adicionales */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos Adicionales</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Agente</label>
                <select
                  className="form-select"
                  value={formulario.agente ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, agente: e.target.value }))}
                >
                  <option value="">Seleccionar agente</option>
                  {agentes.map(agente => (
                    <option key={agente.id} value={agente.codigo}>
                      {agente.codigo} - {agente.nombre} {agente.apellido_paterno} {agente.apellido_materno}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Sub Agente</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.sub_agente ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, sub_agente: e.target.value }))}
                  placeholder="Código o nombre del sub agente"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Prima Pagada</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.prima_pagada ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, prima_pagada: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Tasa / Cargo Pago Fraccionado</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.cargo_pago_fraccionado || ''}
                    onChange={(e) => {
                      console.log('🔍 DEBUG cargo_pago_fraccionado onChange:', e.target.value);
                      setFormulario(prev => {
                        const nuevo = { 
                          ...prev, 
                          cargo_pago_fraccionado: e.target.value || ''
                        };
                        console.log('🔍 DEBUG estado actualizado:', nuevo.cargo_pago_fraccionado);
                        return nuevo;
                      });
                    }}
                    placeholder="0.00"
                  />
                </div>
                <small className="text-muted">Importe adicional por fraccionar el pago (si aplica)</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Gastos por Expedición</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.gastos_expedicion || ''}
                    onChange={(e) => {
                      console.log('🔍 DEBUG gastos_expedicion onChange:', e.target.value);
                      setFormulario(prev => {
                        const nuevo = { 
                          ...prev, 
                          gastos_expedicion: e.target.value || ''
                        };
                        console.log('🔍 DEBUG estado actualizado:', nuevo.gastos_expedicion);
                        return nuevo;
                      });
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">IVA</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.iva ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, iva: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Subtotal</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.subtotal ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, subtotal: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Importe Total</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.total ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, total: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fechas y Vigencia - SIEMPRE VISIBLE */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Fechas y Vigencia</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Fecha de Emisión</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.fecha_emision || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_emision: e.target.value }))}
                />
                <small className="form-text text-muted">
                  Fecha en que se emitió la póliza
                </small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Inicio de Vigencia</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.inicio_vigencia ?? ''}
                  onChange={(e) => {
                    const nuevoFormulario = { ...formulario, inicio_vigencia: e.target.value };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                />
              </div>
              <div className="col-md-4">
                <CampoFechaCalculada
                  label="Término de Vigencia"
                  value={formulario.termino_vigencia}
                  onChange={(valor) => setFormulario(prev => ({ ...prev, termino_vigencia: valor }))}
                  onCalculate={() => {
                    const formularioActualizado = actualizarCalculosAutomaticos(formulario);
                    setFormulario(formularioActualizado);
                  }}
                  disabled={!formulario.inicio_vigencia}
                  helpText="La vigencia siempre es de 1 año"
                />
              </div>
            </div>
          </div>

          {/* Configuración de Pagos */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Configuración de Pagos</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Tipo de Pago</label>
                <select
                  className="form-select"
                  value={formulario.tipo_pago ?? ''}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    const esAnual = tipo === 'Anual' || /pago\s+unico|pago\s+único/i.test(tipo);
                    const nuevoFormulario = {
                      ...formulario,
                      tipo_pago: tipo,
                      // Forzar frecuenciaPago = 'Anual' para tipo anual o pago único
                      frecuenciaPago: esAnual ? 'Anual' : formulario.frecuenciaPago
                    };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                >
                  {tiposPago.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              
              {formulario.tipo_pago === 'Fraccionado' && (
                <div className="col-md-3">
                  <label className="form-label">Frecuencia de Pago</label>
                  <select
                    className="form-select"
                    value={formulario.frecuenciaPago}
                    onChange={(e) => {
                      const nuevoFormulario = { ...formulario, frecuenciaPago: e.target.value };
                      const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                      setFormulario(formularioActualizado);
                    }}
                  >
                    <option value="">Seleccionar frecuencia</option>
                    {frecuenciasPago.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>
              )}
              {formulario.tipo_pago && formulario.tipo_pago !== 'Fraccionado' && (
                <div className="col-md-3 d-flex flex-column">
                  <label className="form-label">Frecuencia de Pago</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.frecuenciaPago || 'Anual'}
                    readOnly
                    disabled
                  />
                  <small className="text-muted">Frecuencia fija para pago {formulario.tipo_pago === 'Anual' ? 'Anual' : 'Único'}.</small>
                </div>
              )}
              
              <div className="col-md-3">
                <label className="form-label">Período de Gracia</label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.periodo_gracia ?? ''}
                    onChange={(e) => {
                      const valor = e.target.value;
                      const numero = valor === '' ? '' : Math.max(0, parseInt(valor, 10) || 0);
                      const nuevoFormulario = { ...formulario, periodo_gracia: numero };
                      const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                      setFormulario(formularioActualizado);
                    }}
                    min={0}
                  />
                  <span className="input-group-text">
                    días naturales
                  </span>
                </div>
                <small className="text-muted">
                  {formulario.compania?.toLowerCase().includes('qualitas') 
                    ? 'Sugerido Qualitas: 14 días' 
                    : formulario.compania 
                      ? 'Sugerido otras aseguradoras: 30 días'
                      : 'Seleccione una compañía'}
                </small>
              </div>
              
              <div className="col-md-3">
                <label className="form-label">Fecha de Pago</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.fecha_vencimiento_pago || ''}
                  onChange={(e) => {
                    const nuevaFecha = e.target.value;
                    setFormulario(prev => {
                      const nuevoEstatus = calcularEstatusPago(nuevaFecha, prev.estatusPago);
                      return {
                        ...prev,
                        fecha_vencimiento_pago: nuevaFecha,
                        fecha_pago: nuevaFecha,
                        estatusPago: nuevoEstatus
                      };
                    });
                  }}
                />
              </div>
              
              <div className="col-md-6">
                <label className="form-label">Estatus del Pago</label>
                <select
                  className="form-select"
                  value={formulario.estatusPago ?? ''}
                  onChange={(e) => {
                    setFormulario(prev => ({ ...prev, estatusPago: e.target.value }));
                  }}
                >
                  {estatusPago.map(estatus => (
                    <option key={estatus} value={estatus}>{estatus}</option>
                  ))}
                </select>
              </div>

              {formulario.tipo_pago === 'Fraccionado' && formulario.frecuenciaPago && formulario.inicio_vigencia && (
                <div className="col-12 mt-3">
                  <CalendarioPagos 
                    expediente={formulario} 
                    calcularProximoPago={calcularProximoPago}
                    mostrarResumen={false}
                  />
                </div>
              )}
            </div>
          </div>

            {/* Sección de Documento PDF - PREPARADA PARA CUANDO HUGO IMPLEMENTE EL BACKEND */}
            {modoEdicion && formulario.id && (
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Documento de Póliza (PDF)</h5>
                <div className="alert alert-info" role="alert">
                  <AlertCircle size={16} className="me-2" />
                  <strong>Funcionalidad en preparación:</strong> Esta sección estará disponible cuando Hugo complete la implementación del backend y AWS S3.
                  Ver documento: <code>docs/IMPLEMENTACION-PDF-POLIZAS-AWS.md</code>
                </div>
              
                {/* Mostrar PDF actual si existe */}
                {formulario.pdf_nombre && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <FileText size={20} className="me-2 text-primary" />
                          <strong>{formulario.pdf_nombre}</strong>
                          {formulario.pdf_size && (
                            <span className="text-muted ms-2">
                              ({pdfService.formatearTamañoArchivo(formulario.pdf_size)})
                            </span>
                          )}
                          {formulario.pdf_fecha_subida && (
                            <div className="text-muted small mt-1">
                              Subido el {new Date(formulario.pdf_fecha_subida).toLocaleDateString('es-MX')}
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const pdfData = await pdfService.obtenerURLFirmadaPDF(formulario.id);
                                window.open(pdfData.signed_url, '_blank');
                              } catch (error) {
                                toast.error('Error al abrir PDF: ' + error.message);
                              }
                            }}
                            className="btn btn-sm btn-outline-primary"
                            disabled
                            title="Disponible cuando se implemente el backend"
                          >
                            <Eye size={14} className="me-1" />
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarPDFPoliza(formulario.id)}
                            className="btn btn-sm btn-outline-danger"
                            disabled
                            title="Disponible cuando se implemente el backend"
                          >
                            <Trash2 size={14} className="me-1" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Formulario para subir PDF */}
                {!formulario.pdf_nombre && (
                  <div className="card">
                    <div className="card-body">
                      <div className="mb-3">
                        <label className="form-label">Seleccionar archivo PDF de la póliza</label>
                        <input
                          type="file"
                          className="form-control"
                          accept=".pdf,application/pdf"
                          onChange={handleSeleccionarPDF}
                        />
                        <small className="form-text text-muted">
                          Tamaño máximo: 10MB. Solo archivos PDF.
                        </small>
                      </div>
                    
                      {archivoSeleccionado && (
                        <div className="alert alert-success mb-3">
                          <FileText size={16} className="me-2" />
                          <strong>Archivo seleccionado:</strong> {archivoSeleccionado.name}
                          <span className="ms-2">
                            ({pdfService.formatearTamañoArchivo(archivoSeleccionado.size)})
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => subirPDFPoliza(formulario.id)}
                        className="btn btn-primary"
                        disabled={!archivoSeleccionado || subiendoPDF}
                      >
                        {subiendoPDF ? (
                          <>
                            <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="me-2" />
                            Subir PDF
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          <div className="d-flex justify-content-end gap-3">
            <button
              type="button"
              onClick={() => setVistaActual('lista')}
              className="btn btn-outline-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarExpediente}
              className="btn btn-primary"
            >
              {modoEdicion ? 'Actualizar' : 'Guardar'} Expediente
            </button>
          </div>
        </div>
      </div>

        

      {mostrarExtractorPDF && (
        <>
          {console.log('🟢 Renderizando ExtractorPolizasPDF...')}
          <ExtractorPolizasPDF 
            onDataExtracted={handleDataExtracted}
            onClose={() => setMostrarExtractorPDF(false)}
            agentes={agentes}
            aseguradoras={companias}
            tiposProductos={productos}
          />
        </>
      )}
    </div>
  );
});

const DetallesExpediente = React.memo(({ 
  expedienteSeleccionado,
  setExpedienteSeleccionado,
  setVistaActual,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  editarExpediente,
  calcularSiguientePago,
  calculartermino_vigencia,
  calcularProximoPago,
  abrirModalCompartir
}) => {
  const [clienteInfo, setClienteInfo] = useState(null);
  
  // Estados para controlar secciones colapsables (todas cerradas por defecto)
  const [mostrarAsegurado, setMostrarAsegurado] = useState(false);
  const [mostrarPoliza, setMostrarPoliza] = useState(false);
  const [mostrarVigencia, setMostrarVigencia] = useState(false);
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [mostrarFinanciera, setMostrarFinanciera] = useState(false);
  const [mostrarCoberturas, setMostrarCoberturas] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  
  // Helper: parsear coberturas de forma segura
  const obtenerCoberturas = useMemo(() => {
    if (!expedienteSeleccionado?.coberturas) return [];
    
    // Si ya es un array, devolverlo
    if (Array.isArray(expedienteSeleccionado.coberturas)) {
      return expedienteSeleccionado.coberturas;
    }
    
    // Si es un string JSON, parsearlo
    if (typeof expedienteSeleccionado.coberturas === 'string') {
      try {
        const parsed = JSON.parse(expedienteSeleccionado.coberturas);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parseando coberturas:', e);
        return [];
      }
    }
    
    return [];
  }, [expedienteSeleccionado?.coberturas]);
  
  // Debug: ver qué coberturas tiene el expediente
  useEffect(() => {
    if (expedienteSeleccionado) {
      console.log('🔍 Expediente seleccionado para detalles:', {
        numero_poliza: expedienteSeleccionado.numero_poliza,
        tiene_coberturas: !!expedienteSeleccionado.coberturas,
        cantidad_coberturas: expedienteSeleccionado.coberturas?.length || 0,
        coberturas: expedienteSeleccionado.coberturas,
        tipo_cobertura: expedienteSeleccionado.tipo_cobertura,
        suma_asegurada: expedienteSeleccionado.suma_asegurada,
        deducible: expedienteSeleccionado.deducible
      });
    }
  }, [expedienteSeleccionado]);
  
  // Cargar información del cliente cuando se selecciona un expediente
  useEffect(() => {
    const cargarCliente = async () => {
      if (expedienteSeleccionado?.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          const cliente = clientes.find(c => c.id === expedienteSeleccionado.cliente_id);
          setClienteInfo(cliente);
        } catch (error) {
          console.error('Error al cargar cliente:', error);
        }
      } else {
        setClienteInfo(null);
      }
    };
    
    cargarCliente();
  }, [expedienteSeleccionado?.cliente_id]);
  
  return (
  <div className="p-4">
    <div className="d-flex justify-content-between align-items-center mb-4">
      <h3 className="mb-0">Detalles del Expediente</h3>
      <div className="d-flex gap-3">
        {expedienteSeleccionado && 
         ['Emitida', 'Renovada', 'Enviada al Cliente'].includes(expedienteSeleccionado.etapa_activa) && 
         ((expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagado' && (expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagada') && (
          <button
            onClick={() => {
              aplicarPago(expedienteSeleccionado.id);
              const fechaActual = new Date().toISOString().split('T')[0];
              const proximoPagoNuevo = calcularSiguientePago(expedienteSeleccionado);
              
              setExpedienteSeleccionado({
                ...expedienteSeleccionado,
                estatusPago: 'Pagado',
                fechaUltimoPago: fechaActual,
                proximoPago: proximoPagoNuevo
              });
              
              if (proximoPagoNuevo) {
                toast.success(`Pago aplicado. Próximo pago: ${new Date(proximoPagoNuevo).toLocaleDateString('es-MX')}`);
              } else {
                toast.success('Pago aplicado. No hay más pagos pendientes');
              }
            }}
            className="btn btn-success d-flex align-items-center"
          >
            <DollarSign size={16} className="me-2" />
            Aplicar Pago
          </button>
        )}

        {expedienteSeleccionado && 
         (expedienteSeleccionado.etapa_activa === 'Emitida' || 
          expedienteSeleccionado.etapa_activa === 'Enviada al Cliente') && (
          <button
            onClick={() => abrirModalCompartir(expedienteSeleccionado)}
            className="btn btn-success d-flex align-items-center"
          >
            <Share2 size={16} className="me-2" />
            Compartir
          </button>
        )}

        {expedienteSeleccionado && expedienteSeleccionado.etapa_activa !== 'Cancelada' && (
          <button
            onClick={() => iniciarCancelacion(expedienteSeleccionado)}
            className="btn btn-danger d-flex align-items-center"
          >
            <XCircle size={16} className="me-2" />
            Cancelar Póliza
          </button>
        )}
        
        <button
          onClick={() => editarExpediente(expedienteSeleccionado)}
          className="btn btn-primary d-flex align-items-center"
        >
          <Edit size={16} className="me-2" />
          Editar
        </button>
        <button
          onClick={() => setVistaActual('lista')}
          className="btn btn-outline-secondary"
        >
          Volver
        </button>
      </div>
    </div>

    {expedienteSeleccionado && (
      <div className="card">
        <div className="card-body p-3">
          <div className="row g-3">
            <div className="col-12">
              <DetalleExpediente
                datos={expedienteSeleccionado}
                coberturas={obtenerCoberturas}
                utils={utils}
                modo="caratula"
                historialSlot={(
                  <>
                    {/* SECCIÓN ÚNICA: Timeline Unificado (Trazabilidad + Comunicaciones) */}
                    <div className="mb-3">
                      <TimelineExpediente 
                        expedienteId={expedienteSeleccionado.id}
                        expedienteData={expedienteSeleccionado}
                      />
                    </div>
                  </>
                )}
              />
            </div>
            {expedienteSeleccionado.tipo_pago === 'Fraccionado' && 
             expedienteSeleccionado.frecuenciaPago && 
             expedienteSeleccionado.inicio_vigencia && (
              <div className="col-12">
                <CalendarioPagos 
                  expediente={expedienteSeleccionado}
                  calcularProximoPago={calcularProximoPago}
                  mostrarResumen={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  );
});

// ============= COMPONENTE PRINCIPAL =============
const ModuloExpedientes = () => {
  const [expedientes, setExpedientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [agentes, setAgentes] = useState([]);
  useEffect(() => {
    const fetchAgentes = async () => {
      const resultado = await obtenerAgentesEquipo();
      if (resultado.success) {
        // Ordenar agentes alfabéticamente por nombre
        const agentesOrdenados = resultado.data.sort((a, b) => {
          const nombreA = `${a.nombre} ${a.apellido_paterno}`.toLowerCase();
          const nombreB = `${b.nombre} ${b.apellido_paterno}`.toLowerCase();
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
        });
        setAgentes(agentesOrdenados);
      }
    };
    fetchAgentes();
  }, []);
  
  // Cargar expedientes y clientes desde el backend
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        // 1. Obtener expedientes
        const resExpedientes = await fetch(`${API_URL}/api/expedientes`);
        const expedientesData = await resExpedientes.json();
        
        // 2. Obtener todos los clientes
        const resClientes = await fetch(`${API_URL}/api/clientes`);
        const clientesData = await resClientes.json();
        
        // 3. Crear un mapa de clientes por ID para búsqueda rápida
        const mapa = {};
        clientesData.forEach(cliente => {
          mapa[cliente.id] = cliente;
        });
        
        setClientes(clientesData);
        setClientesMap(mapa);
        
        // 4. Calcular estatusPago en los expedientes basándose en la fecha de vencimiento
        const expedientesProcesados = expedientesData.map(exp => {
          let estatusPagoCalculado = exp.estatusPago || exp.estatus_pago;
          
          // Normalizar para comparación (case-insensitive)
          const estatusNormalizado = (estatusPagoCalculado || '').toLowerCase().trim();
          
          // Si el estatus es 'Pagado' (cualquier variación), mantenerlo
          if (estatusNormalizado === 'pagado' || estatusNormalizado === 'pagada') {
            console.log('✅ Póliza pagada encontrada:', exp.numero_poliza, '- Manteniendo estatus:', estatusPagoCalculado);
            return {
              ...exp,
              estatusPago: 'Pagado'  // Normalizar a "Pagado" con mayúscula
            };
          }
          
          // Para cualquier otro estatus, recalcular basándose en la fecha
          const fechaVencimiento = exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago;
          if (fechaVencimiento) {
            const fechaVenc = new Date(fechaVencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            fechaVenc.setHours(0, 0, 0, 0);
            
            if (fechaVenc < hoy) {
              estatusPagoCalculado = 'Vencido';
            } else {
              estatusPagoCalculado = 'Pendiente';
            }
          } else {
            estatusPagoCalculado = 'Pendiente';
          }
          
          return {
            ...exp,
            estatusPago: estatusPagoCalculado
          };
        });
        
        setExpedientes(expedientesProcesados);
        
        // Detectar pólizas duplicadas
        if (expedientesProcesados.length > 0) {
          const grupos = {};
          expedientesProcesados.forEach(exp => {
            if (exp.numero_poliza && exp.compania && exp.inicio_vigencia) {
              const clave = `${exp.numero_poliza}-${exp.compania}-${exp.inicio_vigencia}`;
              if (!grupos[clave]) {
                grupos[clave] = [];
              }
              grupos[clave].push(exp);
            }
          });
          
          const duplicados = Object.entries(grupos).filter(([_, exps]) => exps.length > 1);
          
          if (duplicados.length > 0) {
            console.warn('⚠️ Se encontraron pólizas duplicadas:');
            duplicados.forEach(([clave, exps]) => {
              console.warn(`  📋 ${clave}:`, exps.map(e => ({
                id: e.id,
                cliente_id: e.cliente_id,
                etapa: e.etapa_activa
              })));
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar datos:', err);
      }
    };
    
    cargarDatos();
  }, []);
  
  const [vistaActual, setVistaActual] = useState('lista');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [expedienteACancelar, setExpedienteACancelar] = useState(null);
  
    // Estados para manejo de PDFs
    const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
    const [subiendoPDF, setSubiendoPDF] = useState(false);

  // Modal de compartir
  const [mostrarModalCompartir, setMostrarModalCompartir] = useState(false);
  const [expedienteParaCompartir, setExpedienteParaCompartir] = useState(null);
  const abrirModalCompartir = useCallback((expediente) => {
    setExpedienteParaCompartir(expediente);
    setMostrarModalCompartir(true);
  }, []);
  const cerrarModalCompartir = useCallback(() => {
    setMostrarModalCompartir(false);
    setExpedienteParaCompartir(null);
  }, []);

  // ✨ NUEVO: Modal para capturar contacto faltante
  const [mostrarModalContacto, setMostrarModalContacto] = useState(false);
  const [clienteParaActualizar, setClienteParaActualizar] = useState(null);
  const [tipoDatoFaltante, setTipoDatoFaltante] = useState(null); // 'email' o 'telefono_movil'
  const [canalEnvio, setCanalEnvio] = useState(null); // 'Email' o 'WhatsApp'
  const [expedienteEnEspera, setExpedienteEnEspera] = useState(null); // Expediente que está esperando el dato

  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  
  // Estados para modal de aplicar pago
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [expedienteParaPago, setExpedienteParaPago] = useState(null);
  const [comprobantePago, setComprobantePago] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  
  useEffect(() => {
  fetch(`${API_URL}/api/aseguradoras`)
      .then(res => res.json())
      .then(data => {
        // Filtrar solo aseguradoras activas
        const aseguradorasActivas = Array.isArray(data) ? data.filter(a => a.activo === 1 || a.activo === true) : [];
        setAseguradoras(aseguradorasActivas);
      })
      .catch(err => console.error('Error al cargar aseguradoras:', err));
  }, []);

  useEffect(() => {
    const cargarTiposProductos = async () => {
      try {
        const resultado = await obtenerTiposProductosActivos();
        if (resultado.success) {
          setTiposProductos(resultado.data);
        } else {
          console.error('Error al cargar tipos de productos:', resultado.error);
          // Fallback a productos estáticos si hay error
          setTiposProductos([
            { id: 1, nombre: 'Autos' },
            { id: 2, nombre: 'Vida' },
            { id: 3, nombre: 'Daños' },
            { id: 4, nombre: 'Equipo pesado' },
            { id: 5, nombre: 'Embarcaciones' },
            { id: 6, nombre: 'Ahorro' }
          ]);
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
        // Fallback a productos estáticos si hay error
        setTiposProductos([
          { id: 1, nombre: 'Autos' },
          { id: 2, nombre: 'Vida' },
          { id: 3, nombre: 'Daños' },
          { id: 4, nombre: 'Equipo pesado' },
          { id: 5, nombre: 'Embarcaciones' },
          { id: 6, nombre: 'Ahorro' }
        ]);
      }
    };

    cargarTiposProductos();
  }, []);

  // Recargar solo CLIENTES y su mapa cuando alguien emita el evento 'clientes-actualizados'
  const recargarClientes = useCallback(async () => {
    try {
      const resClientes = await fetch(`${API_URL}/api/clientes?t=${Date.now()}`);
      const clientesData = await resClientes.json();
      const mapa = {};
      clientesData.forEach(c => { mapa[c.id] = c; });
  setClientes(clientesData);
  setClientesMap(mapa);
    } catch (error) {
      console.error('❌ Error recargando clientes tras evento:', error);
    }
  }, []);

  useEffect(() => {
    const handler = () => recargarClientes();
    window.addEventListener('clientes-actualizados', handler);
    return () => window.removeEventListener('clientes-actualizados', handler);
  }, [recargarClientes]);

  const companias = useMemo(() => {
    return aseguradoras
      .map(a => a.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [aseguradoras]);
  
  const productos = useMemo(() => {
    return tiposProductos
      .map(p => p.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiposProductos]);
  
  const etapasActivas = useMemo(() => [
    'En cotización',
    'Cotización enviada',
    'Autorizado',
    'En proceso emisión',
    'Emitida',
    'Enviada al Cliente',
    'Renovada',
    'Cancelada'
  ], []);


  const tiposPago = useMemo(() => ['Anual', 'Fraccionado'], []);
  const frecuenciasPago = useMemo(() => Object.keys(CONSTANTS.PAGOS_POR_FRECUENCIA).sort(), []);
  const periodosGracia = useMemo(() => [14, 30], []);
  const estatusPago = useMemo(() => ['Pendiente', 'Por Vencer', 'Vencido', 'Pagado'], []);
  const motivosCancelacion = useMemo(() => [
    'Cliente desistió',
    'Documentación incompleta',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Precio muy alto',
    'Otro'
  ], []);

  const tiposVehiculo = useMemo(() => ['Deportivo', 'Hatchback', 'Pickup', 'Sedán', 'SUV', 'Vagoneta', 'Otro'].sort(), []);
  const tiposCobertura = useMemo(() => ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)'].sort(), []);
  const marcasVehiculo = useMemo(() => [
    'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
    'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Renault', 'Seat', 
    'Suzuki', 'Toyota', 'Volkswagen', 'Volvo', 'Otra'
  ], []);
const estadoInicialFormulario = {
  cliente_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  razon_social: '',
  nombre_comercial: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  rfc: '',
  // Campos de contacto adicional (Persona Física) o contacto principal (Persona Moral)
  contacto_nombre: '',
  contacto_apellido_paterno: '',
  contacto_apellido_materno: '',
  contacto_email: '',
  contacto_telefono_fijo: '',
  contacto_telefono_movil: '',
  compania: '',
  producto: '',
  etapa_activa: 'Emitida',
  agente: '',
  sub_agente: null,
  fecha_emision: new Date().toISOString().split('T')[0],
  inicio_vigencia: '',
  termino_vigencia: '',
  prima_pagada: '',
  cargo_pago_fraccionado: '',
  cargoPagoFraccionado: '',
  iva: '',
  total: '',
  motivo_cancelacion: null,
  motivoCancelacion: null,
  tipo_pago: 'Anual',
  frecuencia_pago: null,
  frecuenciaPago: null,
  periodo_gracia: 14,
  proximo_pago: null,
  proximoPago: null,
  estatus_pago: 'Pendiente',
  estatusPago: 'Pendiente',
  fecha_ultimo_pago: '',
  fecha_pago: '',
  plazo_pago_dias: '',
  gastos_expedicion: '',
  gastosExpedicion: '',
  subtotal: null,
  pago_unico: '',
  marca: '',
  modelo: '',
  anio: '',
  numero_serie: '',
  motor: '',
  placas: '',
  color: '',
  tipo_vehiculo: '',
  codigo_vehiculo: '',
  numero_poliza: '',
  endoso: '000000',
  inciso: '0001',
  plan: '',
  tipo_cobertura: '',
  deducible: '',
  suma_asegurada: '',
  conductor_habitual: '',
  edad_conductor: '',
  licencia_conducir: '',
  coberturas: null,
  tipo_persona: '',
  razonSocial: '',
  curp: '',
  domicilio: '',
  fecha_creacion: new Date().toISOString().split('T')[0],
  id: null,
  // Campos adicionales para pagos fraccionados y datos de póliza
  primer_pago: '',
  pagos_subsecuentes: '',
  forma_pago: '',
  uso: null,
  servicio: null,
  movimiento: null
};

  const [formulario, setFormulario] = useState(estadoInicialFormulario);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const debugLogOnceRef = useRef(false);

  // Debug solicitado: imprimir TODOS los campos visibles del editor con su valor actual
  useEffect(() => {
    if (vistaActual === 'formulario' && modoEdicion && !debugLogOnceRef.current) {
      const f = formulario || {};
      const resumen = {
        // Identificación cliente
        cliente_id: f.cliente_id ?? '',
        tipoPersona: clienteSeleccionado?.tipoPersona ?? '',
        // Datos del cliente
        nombre: f.nombre ?? '',
        apellido_paterno: f.apellido_paterno ?? '',
        apellido_materno: f.apellido_materno ?? '',
        razon_social: f.razon_social ?? '',
        nombre_comercial: f.nombre_comercial ?? '',
        email: f.email ?? '',
        telefono_fijo: f.telefono_fijo ?? '',
        telefono_movil: f.telefono_movil ?? '',
        rfc: f.rfc ?? '',
        // Contacto / Gestor
        contacto_nombre: f.contacto_nombre ?? '',
        contacto_apellido_paterno: f.contacto_apellido_paterno ?? '',
        contacto_apellido_materno: f.contacto_apellido_materno ?? '',
        contacto_email: f.contacto_email ?? '',
        contacto_telefono_fijo: f.contacto_telefono_fijo ?? '',
        contacto_telefono_movil: f.contacto_telefono_movil ?? '',
        // Seguro
        compania: f.compania ?? '',
        producto: f.producto ?? '',
        etapa_activa: f.etapa_activa ?? '',
        // Vehículo
        marca: f.marca ?? '',
        modelo: f.modelo ?? '',
        anio: f.anio ?? '',
        numero_serie: f.numero_serie ?? '',
        placas: f.placas ?? '',
        color: f.color ?? '',
        tipo_vehiculo: f.tipo_vehiculo ?? '',
        // Póliza
        numero_poliza: f.numero_poliza ?? '',
        tipo_cobertura: f.tipo_cobertura ?? '',
        deducible: f.deducible ?? '',
        suma_asegurada: f.suma_asegurada ?? '',
        uso: f.uso ?? f.uso_poliza ?? '',
        servicio: f.servicio ?? f.servicio_poliza ?? '',
        movimiento: f.movimiento ?? f.movimiento_poliza ?? '',
        // Fechas
        fecha_emision: f.fecha_emision ?? '',
        inicio_vigencia: f.inicio_vigencia ?? '',
        termino_vigencia: f.termino_vigencia ?? '',
        // Pago
        tipo_pago: f.tipo_pago ?? '',
        frecuenciaPago: f.frecuenciaPago ?? '',
        periodo_gracia: f.periodo_gracia ?? '',
        fecha_vencimiento_pago: f.fecha_vencimiento_pago ?? f.fecha_pago ?? '',
        estatusPago: f.estatusPago ?? '',
        // Montos
        prima_pagada: f.prima_pagada ?? '',
        cargo_pago_fraccionado: f.cargo_pago_fraccionado ?? '',
        gastos_expedicion: f.gastos_expedicion ?? '',
        subtotal: f.subtotal ?? '',
        iva: f.iva ?? '',
        total: f.total ?? '',
        // Conductor
        conductor_habitual: f.conductor_habitual ?? '',
        edad_conductor: f.edad_conductor ?? '',
        licencia_conducir: f.licencia_conducir ?? '',
        // Agentes
        agente: f.agente ?? '',
        sub_agente: f.sub_agente ?? ''
      };

      const tabla = Object.entries(resumen).map(([campo, valor]) => ({ campo, valor }));
      console.groupCollapsed('🧾 Formulario (Editar) — Campos y valores');
      console.table(tabla);
      const vacios = Object.keys(resumen).filter(k => resumen[k] === '' || resumen[k] === null || resumen[k] === undefined);
      if (vacios.length) console.info('Campos vacíos:', vacios);
      console.groupEnd();
      debugLogOnceRef.current = true;
    }
  }, [vistaActual, modoEdicion, formulario, clienteSeleccionado]);

  // Resetear el flag cuando salgamos de la vista de formulario o del modo edición
  useEffect(() => {
    if (!(vistaActual === 'formulario' && modoEdicion)) {
      debugLogOnceRef.current = false;
    }
  }, [vistaActual, modoEdicion]);

  const calculartermino_vigencia = useCallback((inicio_vigencia) => {
    if (!inicio_vigencia) return '';
    
    const fechaInicio = new Date(inicio_vigencia);
    const fechaTermino = new Date(fechaInicio);
    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
    
    return fechaTermino.toISOString().split('T')[0];
  }, []);

  const calcularProximoPago = useCallback((inicio_vigencia, tipo_pago, frecuenciaPago, compania, numeroPago = 1, periodoGraciaCustom = null) => {
    if (!inicio_vigencia) return '';
    
    // 🔧 Usar periodo de gracia personalizado (del PDF) o calcular según la compañía
    const periodoGracia = periodoGraciaCustom !== null 
      ? periodoGraciaCustom 
      : (compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    // 🔥 Crear fecha en hora local para evitar problemas de timezone
    const [year, month, day] = inicio_vigencia.split('-');
    const fechaInicio = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (numeroPago === 1) {
      // ✅ Primer pago: fecha inicio + periodo de gracia (DÍAS)
      const fechaPago = new Date(fechaInicio);
      fechaPago.setDate(fechaPago.getDate() + periodoGracia);
      const resultado = fechaPago.toISOString().split('T')[0];
      console.log(`📅 Pago #1: ${inicio_vigencia} + ${periodoGracia} días = ${resultado}`);
      return resultado;
    }
    
    if (tipo_pago === 'Anual') return '';
    
    if (tipo_pago === 'Fraccionado' && frecuenciaPago) {
      // ✅ Pagos subsecuentes: fecha inicio + N meses (SIN periodo de gracia)
      // Trimestral: Pago #2 = inicio + 3 meses, Pago #3 = inicio + 6 meses, etc.
      const fechaPagoSubsecuente = new Date(fechaInicio);
      const mesesAAgregar = (numeroPago - 1) * CONSTANTS.MESES_POR_FRECUENCIA[frecuenciaPago];
      fechaPagoSubsecuente.setMonth(fechaPagoSubsecuente.getMonth() + mesesAAgregar);
      
      const resultado = fechaPagoSubsecuente.toISOString().split('T')[0];
      console.log(`📅 Pago #${numeroPago}: ${inicio_vigencia} + ${mesesAAgregar} meses = ${resultado}`);
      
      return resultado;
    }
    
    return '';
  }, []);

  const calcularEstatusPago = useCallback((proximoPago, estatusActual) => {
    // Si ya está marcado como pagado completamente, mantener ese estado
    if (estatusActual === 'Pagado') return 'Pagado';
    
    // Si no hay fecha de pago, el estado es Pendiente
    if (!proximoPago) return 'Pendiente';
    
    // Calcular días restantes
    const fechaPago = new Date(proximoPago);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaPago.setHours(0, 0, 0, 0);
    
    const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
    
    // Si la fecha ya pasó, está vencido
    if (diasRestantes < 0) return 'Vencido';
    
    // Si faltan 15 días o menos, está por vencer (para alertar)
    if (diasRestantes <= 15) return 'Por Vencer';
    
    // Si aún faltan más de 15 días, está pendiente
    return 'Pendiente';
  }, []);

  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    // 🚨 DEBUG: Verificar campos problemáticos al ENTRAR a actualizarCalculosAutomaticos
    console.log('🔧 DEBUG actualizarCalculosAutomaticos ENTRADA:');
    console.log('🔧   cargo_pago_fraccionado:', formularioActual.cargo_pago_fraccionado);
    console.log('🔧   gastos_expedicion:', formularioActual.gastos_expedicion);
    
    // Siempre recalcular el término de vigencia a partir del inicio
    const termino_vigencia = calculartermino_vigencia(formularioActual.inicio_vigencia);
    
    // 🔧 Calcular periodo de gracia: usar valor extraído del PDF si existe (convertir a número), sino aplicar regla de negocio
    const periodoGracia = formularioActual.periodo_gracia 
      ? parseInt(formularioActual.periodo_gracia, 10)
      : (formularioActual.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    console.log('🔧 actualizarCalculosAutomaticos - Periodo de gracia:', periodoGracia, '| Del formulario:', formularioActual.periodo_gracia, '| Tipo:', typeof formularioActual.periodo_gracia);
    
    // Calcular proximoPago según el tipo de pago
    let proximoPago = '';
    
    if (formularioActual.tipo_pago === 'Fraccionado') {
      // ✅ Fraccionado: primer pago = inicio + periodo de gracia
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        formularioActual.tipo_pago,
        formularioActual.frecuenciaPago,
        formularioActual.compania,
        1,
        periodoGracia
      );
    } else if (formularioActual.tipo_pago === 'Anual') {
      // ✅ Anual: aplicar periodo de gracia para el primer pago siempre que cambie inicio
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        'Anual',
        null,
        formularioActual.compania,
        1,
        periodoGracia
      );
    }
    
    // Calcular estatusPago basado en la fecha de vencimiento
    const fechaParaCalculo = formularioActual.fecha_vencimiento_pago || proximoPago;
    const estatusPago = calcularEstatusPago(fechaParaCalculo, formularioActual.estatusPago);
    
    // Retornar con todos los campos sincronizados
    const resultado = { 
      ...formularioActual, 
      termino_vigencia, 
      proximoPago, 
      fecha_pago: proximoPago, // Sincronizar fecha_pago con proximoPago
      fecha_vencimiento_pago: proximoPago, // Asegurar que fecha_vencimiento_pago esté sincronizada
      estatusPago, 
      periodo_gracia: periodoGracia 
    };
    
    // 🚨 DEBUG: Verificar campos problemáticos al SALIR de actualizarCalculosAutomaticos
    console.log('🔧 DEBUG actualizarCalculosAutomaticos SALIDA:');
    console.log('🔧   cargo_pago_fraccionado:', resultado.cargo_pago_fraccionado);
    console.log('🔧   gastos_expedicion:', resultado.gastos_expedicion);
    
    return resultado;
  }, [calculartermino_vigencia, calcularProximoPago, calcularEstatusPago]);

  const obtenerSiguienteEstado = useCallback((estadoActual) => {
    const flujo = {
      'En cotización': 'Cotización enviada',
      'Cotización enviada': 'Autorizado',
      'Autorizado': 'En proceso emisión',
      'En proceso emisión': 'Emitida',
      'Emitida': 'Pendiente de pago',
      'Pendiente de pago': 'Pagado'
    };
    return flujo[estadoActual];
  }, []);

  const puedeAvanzarEstado = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(estado);
  }, []);

  const puedeCancelar = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Pendiente de pago'].includes(estado);
  }, []);

  const cambiarEstadoExpediente = useCallback(async (expedienteId, nuevoEstado, motivo = '') => {
    try {
      // Obtener expediente actual para conocer la etapa anterior
      const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
      const etapaAnterior = expedienteActual?.etapa_activa;

      // Solo campos de gestión que cambian
      const datosActualizacion = {
        etapa_activa: nuevoEstado,
        fecha_actualizacion: new Date().toISOString().split('T')[0]
      };
      
      if (motivo) {
        datosActualizacion.motivoCancelacion = motivo;
      }

      console.log('🔄 Cambiando etapa:', { expedienteId, etapaAnterior, nuevoEstado });

      // Actualizar en BD (solo enviar los campos que cambian)
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Etapa actualizada en BD');

      // ✨ NUEVO: Registrar cambio de etapa en historial de trazabilidad
      try {
        let descripcion = motivo ? `Cambio de etapa. Motivo: ${motivo}` : undefined;
        await historialService.registrarCambioEtapa(
          expedienteId,
          expedienteActual?.cliente_id,
          etapaAnterior,
          nuevoEstado,
          'Sistema', // TODO: Obtener nombre del usuario actual
          descripcion
        );
        console.log('✅ Cambio de etapa registrado en historial de trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar cambio de etapa en historial:', error);
      }

      // Actualizar localmente
      setExpedientes(prev => prev.map(exp => 
        exp.id === expedienteId 
          ? { ...exp, ...datosActualizacion }
          : exp
      ));
    } catch (error) {
      console.error('❌ Error al cambiar etapa:', error);
  toast.error('Error al actualizar: ' + error.message);
    }
  }, [expedientes]);

  const avanzarEstado = useCallback((expediente) => {
    const siguienteEstado = obtenerSiguienteEstado(expediente.etapa_activa);
    if (siguienteEstado) {
      cambiarEstadoExpediente(expediente.id, siguienteEstado);
    }
  }, [obtenerSiguienteEstado, cambiarEstadoExpediente]);

  const iniciarCancelacion = useCallback((expediente) => {
    setExpedienteACancelar(expediente);
    setMostrarModalCancelacion(true);
  }, []);

  const confirmarCancelacion = useCallback(() => {
    if (motivoCancelacion && expedienteACancelar) {
      cambiarEstadoExpediente(expedienteACancelar.id, 'Cancelada', motivoCancelacion);
      setMostrarModalCancelacion(false);
      setMotivoCancelacion('');
      setExpedienteACancelar(null);
    }
  }, [motivoCancelacion, expedienteACancelar, cambiarEstadoExpediente]);

  // ✨ NUEVO: Manejar guardado de contacto faltante
  const handleGuardarContactoFaltante = useCallback(async (valorContacto) => {
    try {
      if (!clienteParaActualizar || !tipoDatoFaltante) {
        throw new Error('Datos incompletos para actualizar cliente');
      }

      console.log('💾 Actualizando cliente con contacto faltante:', {
        cliente_id: clienteParaActualizar.id,
        campo: tipoDatoFaltante,
        valor: valorContacto
      });

      // Preparar datos según tipo de persona
      const datosActualizacion = {};
      
      if (clienteParaActualizar.tipoPersona === 'Persona Moral') {
        // Persona Moral: actualizar contacto_* (contacto principal)
        if (tipoDatoFaltante === 'email') {
          datosActualizacion.contacto_email = valorContacto;
        } else if (tipoDatoFaltante === 'telefono_movil') {
          datosActualizacion.contacto_telefono_movil = valorContacto;
        }
      } else {
        // Persona Física: actualizar campos principales del cliente
        if (tipoDatoFaltante === 'email') {
          datosActualizacion.email = valorContacto;
        } else if (tipoDatoFaltante === 'telefono_movil') {
          datosActualizacion.telefonoMovil = valorContacto;
        }
      }

      // Actualizar en BD
      const response = await fetch(`${API_URL}/api/clientes/${clienteParaActualizar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error al actualizar cliente: ${response.status}`);
      }

      const resultado = await response.json();
      console.log('✅ Cliente actualizado exitosamente:', resultado);

      // Actualizar clientesMap local
      const clienteActualizado = resultado.data || resultado;
      setClientesMap(prevMap => ({
        ...prevMap,
        [clienteParaActualizar.id]: {
          ...prevMap[clienteParaActualizar.id],
          ...clienteActualizado,
          // Normalizar campos
          email: clienteActualizado.email,
          telefono_movil: clienteActualizado.telefono_movil || clienteActualizado.telefonoMovil,
          contacto_email: clienteActualizado.contacto_email,
          contacto_telefono_movil: clienteActualizado.contacto_telefono_movil
        }
      }));

  // Cerrar modal
  setMostrarModalContacto(false);

  // Notificar éxito (si hay canalEnvio y expedienteEnEspera, se hará reintento automático vía onGuardarYContinuar)
  const tipoContacto = tipoDatoFaltante === 'email' ? 'Correo electrónico' : 'Teléfono de contacto';
  toast.success(`${tipoContacto} actualizado correctamente${canalEnvio ? '. Reintentando envío…' : '. Puedes continuar con el envío.'}`);

  // Limpiar parcialmente (dejamos canalEnvio y expedienteEnEspera para el reintento automático)
  setClienteParaActualizar(null);
  setTipoDatoFaltante(null);

      // ⚠️ NO reintentar automáticamente aquí para evitar referencia circular
      // El usuario deberá hacer clic nuevamente en compartir
      // (El dato ya está actualizado, así que ahora funcionará)

    } catch (error) {
      console.error('❌ Error al guardar contacto:', error);
      throw error; // Propagar error para que el modal lo muestre
    }
  }, [clienteParaActualizar, tipoDatoFaltante, canalEnvio, expedienteEnEspera]);

  const compartirPorWhatsApp = useCallback(async (expediente) => {
    try {
      // Obtener datos del cliente
      const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
      if (!respCliente?.success) {
  toast.error('No se pudo obtener la información del cliente');
        return;
      }
      const cliente = respCliente.data;
      
      // Verificar que el cliente tenga teléfono móvil
      const telefono = cliente?.contacto_telefono_movil || cliente?.telefonoMovil || cliente?.telefono_movil;
      
      // ✨ NUEVO: Si no tiene teléfono, abrir modal para capturarlo
      if (!telefono) {
        console.log('⚠️ Cliente sin teléfono móvil, abriendo modal de captura');
        setClienteParaActualizar(cliente);
        setTipoDatoFaltante('telefono_movil');
        setCanalEnvio('WhatsApp');
        setExpedienteEnEspera(expediente);
        setMostrarModalContacto(true);
        return; // Detener ejecución hasta que se capture el dato
      }

      // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Obtener URL firmada del PDF si existe
      let pdfUrl = null;
      let pdfExpiracion = null;
      if (expediente.pdf_key) {
        try {
          const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400); // 24 horas
          pdfUrl = pdfData.signed_url;
          // Calcular fecha de expiración (24 horas desde ahora)
          pdfExpiracion = new Date(Date.now() + 86400 * 1000).toISOString();
        } catch (error) {
          console.warn('No se pudo obtener URL del PDF:', error);
        }
      }
      
      // Generar mensaje dinámico según el estado usando el servicio
      const { tipoMensaje, mensaje } = notificacionesService.generarMensajeWhatsApp(
        expediente, 
        utils, 
        pdfUrl
      );

      // Obtener nombre del cliente
      const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
        ? cliente.razonSocial || cliente.razon_social
        : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;

      // Crear la URL de WhatsApp
      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      
      // Abrir WhatsApp
      window.open(url, '_blank');
      
      // Registrar la notificación en el historial
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.WHATSAPP,
          tipo_mensaje: tipoMensaje,
          destinatario_nombre: nombreCliente,
          destinatario_contacto: telefono,
          mensaje: mensaje,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: expediente.estatusPago,
          fecha_vencimiento_pago: expediente.fecha_vencimiento_pago,
          pdf_url: pdfUrl,
          pdf_expiracion: pdfExpiracion,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación registrada en el historial');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
        // No interrumpir el flujo si falla el registro
      }

      // ✨ NUEVO: Registrar evento en el historial de trazabilidad
      try {
        await historialService.registrarEnvioDocumento(
          expediente.id,
          expediente.cliente_id,
          'WhatsApp',
          { nombre: nombreCliente, contacto: telefono },
          mensaje,
          pdfUrl
        );
        console.log('✅ Evento registrado en historial de trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      // Actualizar la etapa a "Enviada al Cliente" solo si es emisión
      if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.EMISION) {
        await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
      }
      
    } catch (error) {
      console.error('Error al compartir por WhatsApp:', error);
  toast.error('Error al compartir por WhatsApp. Intenta nuevamente.');
    }
  }, [cambiarEstadoExpediente]);

    // Compartir póliza por Email - PREPARADA PARA IMPLEMENTACIÓN FUTURA
    const compartirPorEmail = useCallback(async (expediente) => {
      try {
        // Obtener datos del cliente
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (!respCliente?.success) {
          toast.error('No se pudo obtener la información del cliente');
          return;
        }
        const cliente = respCliente.data;
      
        // Verificar que el cliente tenga email
        const email = cliente?.contacto_email || cliente?.email;
        
        // ✨ NUEVO: Si no tiene email, abrir modal para capturarlo
        if (!email) {
          console.log('⚠️ Cliente sin email, abriendo modal de captura');
          setClienteParaActualizar(cliente);
          setTipoDatoFaltante('email');
          setCanalEnvio('Email');
          setExpedienteEnEspera(expediente);
          setMostrarModalContacto(true);
          return; // Detener ejecución hasta que se capture el dato
        }

        // Obtener URL firmada del PDF si existe
        let pdfUrl = null;
        let pdfExpiracion = null;
        if (expediente.pdf_key) {
          try {
            const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400); // 24 horas
            pdfUrl = pdfData.signed_url;
            pdfExpiracion = new Date(Date.now() + 86400 * 1000).toISOString();
          } catch (error) {
            console.warn('No se pudo obtener URL del PDF:', error);
          }
        }

        // Generar mensaje dinámico según el estado
        const { tipoMensaje, asunto, cuerpo } = notificacionesService.generarMensajeEmail(expediente, pdfUrl);

        // Obtener nombre del cliente
        const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;

        // Opción 1: Usar mailto (cliente de correo local)
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        window.location.href = mailtoUrl;
      
        // Registrar la notificación en el historial
        try {
          await notificacionesService.registrarNotificacion({
            expediente_id: expediente.id,
            cliente_id: expediente.cliente_id,
            tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.EMAIL,
            tipo_mensaje: tipoMensaje,
            destinatario_nombre: nombreCliente,
            destinatario_contacto: email,
            asunto: asunto,
            mensaje: cuerpo,
            numero_poliza: expediente.numero_poliza,
            compania: expediente.compania,
            producto: expediente.producto,
            estatus_pago: expediente.estatusPago,
            fecha_vencimiento_pago: expediente.fecha_vencimiento_pago,
            pdf_url: pdfUrl,
            pdf_expiracion: pdfExpiracion,
            estado_envio: 'enviado'
          });
          console.log('✅ Notificación registrada en el historial');
        } catch (error) {
          console.error('⚠️ Error al registrar notificación (no crítico):', error);
        }

        // ✨ NUEVO: Registrar evento en el historial de trazabilidad
        try {
          await historialService.registrarEnvioDocumento(
            expediente.id,
            expediente.cliente_id,
            'Email',
            { nombre: nombreCliente, contacto: email },
            cuerpo,
            pdfUrl
          );
          console.log('✅ Evento registrado en historial de trazabilidad');
        } catch (error) {
          console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
        }
      
        // TODO: Implementar envío real mediante backend (SendGrid, Mailgun, etc.)
        // const response = await fetch(`${API_URL}/expedientes/${expediente.id}/enviar-email`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ email, asunto, cuerpo, pdfUrl })
        // });
      
        // Actualizar la etapa a "Enviada al Cliente" solo si es emisión
        if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.EMISION) {
          await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
        }
      
      } catch (error) {
        console.error('Error al compartir por Email:', error);
  toast.error('Error al compartir por Email. Intenta nuevamente.');
      }
    }, [cambiarEstadoExpediente]);

    // Manejar selección de archivo PDF
    const handleSeleccionarPDF = useCallback((event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validacion = pdfService.validarArchivoPDF(file);
      if (!validacion.valid) {
  toast.error(validacion.error);
        event.target.value = '';
        return;
      }

      setArchivoSeleccionado(file);
    }, []);

    // Subir PDF de póliza
    const subirPDFPoliza = useCallback(async (expedienteId) => {
      if (!archivoSeleccionado) {
  toast('⚠️ Por favor seleccione un archivo PDF');
        return;
      }

      setSubiendoPDF(true);
      try {
        const pdfData = await pdfService.subirPDFPoliza(expedienteId, archivoSeleccionado);
      
        // Actualizar expediente con datos del PDF
        setExpedientes(prevExpedientes =>
          prevExpedientes.map(exp =>
            exp.id === expedienteId
              ? {
                  ...exp,
                  pdf_url: pdfData.pdf_url,
                  pdf_nombre: pdfData.pdf_nombre,
                  pdf_key: pdfData.pdf_key,
                  pdf_size: pdfData.pdf_size,
                  pdf_fecha_subida: pdfData.pdf_fecha_subida
                }
              : exp
          )
        );

        // Si estamos en vista de detalle, actualizar también
        if (expedienteSeleccionado?.id === expedienteId) {
          setExpedienteSeleccionado(prev => ({
            ...prev,
            pdf_url: pdfData.pdf_url,
            pdf_nombre: pdfData.pdf_nombre,
            pdf_key: pdfData.pdf_key,
            pdf_size: pdfData.pdf_size,
            pdf_fecha_subida: pdfData.pdf_fecha_subida
          }));
        }

        setArchivoSeleccionado(null);
  toast.success('PDF subido correctamente');
      } catch (error) {
        console.error('Error al subir PDF:', error);
  toast.error('Error al subir el PDF: ' + error.message);
      } finally {
        setSubiendoPDF(false);
      }
    }, [archivoSeleccionado, expedienteSeleccionado]);

    // Eliminar PDF de póliza
    const eliminarPDFPoliza = useCallback(async (expedienteId) => {
      if (!confirm('¿Está seguro de eliminar el PDF de esta póliza?')) {
        return;
      }

      try {
        await pdfService.eliminarPDFPoliza(expedienteId);

        // Actualizar expediente removiendo datos del PDF
        setExpedientes(prevExpedientes =>
          prevExpedientes.map(exp =>
            exp.id === expedienteId
              ? {
                  ...exp,
                  pdf_url: null,
                  pdf_nombre: null,
                  pdf_key: null,
                  pdf_size: null,
                  pdf_fecha_subida: null
                }
              : exp
          )
        );

        // Si estamos en vista de detalle, actualizar también
        if (expedienteSeleccionado?.id === expedienteId) {
          setExpedienteSeleccionado(prev => ({
            ...prev,
            pdf_url: null,
            pdf_nombre: null,
            pdf_key: null,
            pdf_size: null,
            pdf_fecha_subida: null
          }));
        }

  toast.success('PDF eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar PDF:', error);
  toast.error('Error al eliminar el PDF: ' + error.message);
      }
    }, [expedienteSeleccionado]);

  const calcularSiguientePago = useCallback((expediente) => {
    if (!expediente.inicio_vigencia || expediente.tipo_pago === 'Anual') return '';
    
    if (expediente.tipo_pago === 'Fraccionado' && expediente.frecuenciaPago) {
      // 🔧 Usar periodo de gracia del expediente (convertir a número) o calcular según compañía
      const periodoGracia = expediente.periodo_gracia 
        ? parseInt(expediente.periodo_gracia, 10)
        : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
      
      const fechaInicio = new Date(expediente.inicio_vigencia);
      const fechaPrimerPago = new Date(fechaInicio);
      fechaPrimerPago.setDate(fechaPrimerPago.getDate() + periodoGracia);
      
      if (!expediente.fechaUltimoPago) {
        // ✅ Si no hay último pago registrado, calcular el pago #2 (el primero después del inicial)
        return calcularProximoPago(
          expediente.inicio_vigencia, 
          expediente.tipo_pago, 
          expediente.frecuenciaPago, 
          expediente.compania, 
          2,
          periodoGracia  // 🔥 Pasar periodo de gracia
        );
      }
      
      const fechaUltimoPago = new Date(expediente.fechaUltimoPago);
      const mesesTranscurridos = (fechaUltimoPago.getFullYear() - fechaPrimerPago.getFullYear()) * 12 + 
                                 (fechaUltimoPago.getMonth() - fechaPrimerPago.getMonth());
      
      const mesesPorPago = CONSTANTS.MESES_POR_FRECUENCIA[expediente.frecuenciaPago];
      const numeroPagoActual = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
      
      return calcularProximoPago(
        expediente.inicio_vigencia,
        expediente.tipo_pago,
        expediente.frecuenciaPago,
        expediente.compania,
        numeroPagoActual + 1,
        periodoGracia  // 🔥 Pasar periodo de gracia
      );
    }
    
    return '';
  }, [calcularProximoPago]);

  // Función para abrir modal de pago
  const aplicarPago = useCallback((expedienteId) => {
    const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
    if (!expedienteActual) return;
    
    setExpedienteParaPago(expedienteActual);
    setComprobantePago(null);
    setMostrarModalPago(true);
  }, [expedientes]);

  // Función para procesar el pago con comprobante
  const procesarPagoConComprobante = useCallback(async () => {
    if (!expedienteParaPago) return;
    if (!comprobantePago) {
      toast.error('Debe seleccionar un comprobante de pago');
      return;
    }

    setProcesandoPago(true);

    try {
      const fechaActual = new Date().toISOString().split('T')[0];
      const proximoPago = calcularSiguientePago(expedienteParaPago);

      // Determinar el nuevo estatus basado en si hay o no próximo pago
      let nuevoEstatusPago = 'Pagado';
      let nuevaFechaVencimiento = null;
      
      if (proximoPago && proximoPago.trim() !== '') {
        // Hay un siguiente pago pendiente
        nuevoEstatusPago = 'Pendiente';
        nuevaFechaVencimiento = proximoPago;
        console.log('✅ Pago aplicado. Siguiente pago pendiente:', proximoPago);
      } else {
        // No hay más pagos (Anual o último pago de fraccionado)
        nuevoEstatusPago = 'Pagado';
        nuevaFechaVencimiento = null;
        console.log('✅ Pago aplicado. Póliza completamente pagada.');
      }

      // 1. Actualizar el expediente con el nuevo estatus
      const datosActualizacion = {
        estatus_pago: nuevoEstatusPago,
        fecha_vencimiento_pago: nuevaFechaVencimiento,
        fecha_pago: fechaActual,
        fecha_ultimo_pago: fechaActual,
        proximo_pago: proximoPago
      };

      console.log('💰 Aplicando pago:', { 
        expedienteId: expedienteParaPago.id, 
        fechaActual, 
        proximoPago,
        nuevoEstatusPago,
        nuevaFechaVencimiento,
        datos: datosActualizacion
      });

      const updateResponse = await fetch(`${API_URL}/api/expedientes/${expedienteParaPago.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('Error en actualización:', errorText);
        throw new Error(`Error al actualizar el expediente`);
      }

      console.log('✅ Pago registrado en BD');

      // 2. Agregar comentario al historial con información del comprobante
      try {
        const comentario = proximoPago && proximoPago.trim() !== ''
          ? `💰 Pago aplicado. Comprobante: ${comprobantePago.name}. Siguiente vencimiento: ${new Date(proximoPago).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`
          : `💰 Pago aplicado. Comprobante: ${comprobantePago.name}. Póliza completamente pagada`;

        // Registrar evento estructurado de pago en historial trazabilidad
        try {
          await historialService.registrarEvento({
            expediente_id: expedienteParaPago.id,
            cliente_id: expedienteParaPago.cliente_id,
            tipo_evento: historialService.TIPOS_EVENTO.PAGO_REGISTRADO,
            usuario_nombre: 'Sistema', // TODO: reemplazar por usuario autenticado
            descripcion: comentario,
            datos_adicionales: {
              numero_poliza: expedienteParaPago.numero_poliza,
              compania: expedienteParaPago.compania,
              producto: expedienteParaPago.producto,
              monto_total: expedienteParaPago.total || null,
              comprobante_nombre: comprobantePago.name,
              siguiente_vencimiento: proximoPago || null,
              estatus_pago_nuevo: nuevoEstatusPago
            }
          });
          console.log('✅ Evento PAGO_REGISTRADO agregado a historial trazabilidad');
        } catch (errorRegistroPago) {
          console.warn('⚠️ No se pudo registrar evento de pago en historial:', errorRegistroPago);
        }
      } catch (errorHistorial) {
        console.error('⚠️ Error al agregar comentario al historial:', errorHistorial);
        // No bloquear el proceso si falla el historial
      }

      // 3. Actualizar el expediente en el estado local
      setExpedientes(prev => prev.map(exp => {
        if (exp.id === expedienteParaPago.id) {
          return {
            ...exp,
            estatusPago: nuevoEstatusPago,
            estatus_pago: nuevoEstatusPago,
            fecha_vencimiento_pago: nuevaFechaVencimiento,
            proximoPago: proximoPago,
            proximo_pago: proximoPago,
            fechaUltimoPago: fechaActual,
            fecha_ultimo_pago: fechaActual,
            fecha_pago: fechaActual
          };
        }
        return exp;
      }));

      toast.success('✅ Pago aplicado correctamente');
      
      setMostrarModalPago(false);
      setExpedienteParaPago(null);
      setComprobantePago(null);
      
      console.log('✅ Lista actualizada localmente de forma inmediata');
    } catch (error) {
      console.error('❌ Error al aplicar pago:', error);
      toast.error('Error al aplicar el pago: ' + error.message);
    } finally {
      setProcesandoPago(false);
    }
  }, [expedienteParaPago, comprobantePago, calcularSiguientePago]);

  // Función para manejar selección de cliente
  const handleClienteSeleccionado = useCallback((cliente) => {
    if (cliente === 'CREAR_NUEVO') {
      // TODO: Abrir modal para crear nuevo cliente
  toast('⚠️ Funcionalidad de crear nuevo cliente en desarrollo');
      return;
    }

    if (cliente) {
      setClienteSeleccionado(cliente);
      
      // Auto-llenar datos del cliente en el formulario
      // Manejar tanto camelCase como snake_case del backend
      const datosFormulario = {
        cliente_id: cliente.id,
        // Datos principales del cliente (solo lectura)
        nombre: cliente.nombre || '',
        apellido_paterno: cliente.apellido_paterno || cliente.apellidoPaterno || '',
        apellido_materno: cliente.apellido_materno || cliente.apellidoMaterno || '',
        razon_social: cliente.razon_social || cliente.razonSocial || '',
        nombre_comercial: cliente.nombre_comercial || cliente.nombreComercial || '',
        email: cliente.email || '',
        telefono_fijo: cliente.telefono_fijo || cliente.telefonoFijo || '',
        telefono_movil: cliente.telefono_movil || cliente.telefonoMovil || '',
        rfc: cliente.rfc || '',
        // Datos de contacto adicional/gestor (editables)
        contacto_nombre: cliente.contacto_nombre || cliente.contactoNombre || '',
        contacto_apellido_paterno: cliente.contacto_apellido_paterno || cliente.contactoApellidoPaterno || '',
        contacto_apellido_materno: cliente.contacto_apellido_materno || cliente.contactoApellidoMaterno || '',
        contacto_email: cliente.contacto_email || cliente.contactoEmail || '',
        contacto_telefono_fijo: cliente.contacto_telefono_fijo || cliente.contactoTelefonoFijo || '',
        contacto_telefono_movil: cliente.contacto_telefono_movil || cliente.contactoTelefonoMovil || ''
      };

      setFormulario(prev => ({
        ...prev,
        ...datosFormulario
      }));
    } else {
      setClienteSeleccionado(null);
      setFormulario(prev => ({
        ...prev,
        cliente_id: null,
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        razon_social: '',
        nombre_comercial: '',
        email: '',
        telefono_fijo: '',
        telefono_movil: '',
        rfc: '',
        contacto_nombre: '',
        contacto_apellido_paterno: '',
        contacto_apellido_materno: '',
        contacto_email: '',
        contacto_telefono_fijo: '',
        contacto_telefono_movil: ''
      }));
    }
  }, []);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setClienteSeleccionado(null);
    setModoEdicion(false);
    setExpedienteSeleccionado(null);
  }, [estadoInicialFormulario]);

  const validarFormulario = useCallback(() => {
    // Validar que haya cliente seleccionado
    if (!formulario.cliente_id && !clienteSeleccionado) {
  toast('⚠️ Por favor seleccione un cliente');
      return false;
    }

    if (!formulario.compania || !formulario.producto) {
  toast('⚠️ Complete: Compañía y Producto');
      return false;
    }

    // Validar duplicados (solo si NO estamos editando)
    if (!modoEdicion && formulario.numero_poliza) {
      const vinFormulario = formulario.numero_serie?.trim() || '';
      
      // Buscar duplicados con las 3 reglas
      const polizaDuplicadaCompleta = expedientes.find(exp => 
        exp.numero_poliza === formulario.numero_poliza &&
        exp.compania === formulario.compania &&
        exp.numero_serie === vinFormulario &&
        vinFormulario !== ''
      );
      
      const vinDuplicado = vinFormulario !== '' && expedientes.find(exp => 
        exp.numero_serie === vinFormulario &&
        exp.numero_poliza !== formulario.numero_poliza
      );
      
      const polizaDuplicadaVinDistinto = expedientes.find(exp => 
        exp.numero_poliza === formulario.numero_poliza &&
        exp.compania === formulario.compania &&
        exp.numero_serie !== vinFormulario &&
        (exp.numero_serie?.trim() || '') !== ''
      );
      
      // Prioridad de alertas: 1) Póliza completa, 2) VIN duplicado, 3) Póliza VIN distinto
      if (polizaDuplicadaCompleta) {
        const mensaje = 
          '⚠️ ATENCIÓN: PÓLIZA DUPLICADA DETECTADA\n\n' +
          'Ya existe un registro en el sistema con estos datos:\n\n' +
          '📋 Póliza: ' + polizaDuplicadaCompleta.numero_poliza + '\n' +
          '🏢 Compañía: ' + polizaDuplicadaCompleta.compania + '\n' +
          '🚗 VIN: ' + (polizaDuplicadaCompleta.numero_serie || 'N/A') + '\n' +
          '👤 Cliente: ' + polizaDuplicadaCompleta.nombre + ' ' + polizaDuplicadaCompleta.apellido_paterno + '\n' +
          '📊 Etapa: ' + polizaDuplicadaCompleta.etapa_activa + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará como duplicada en el listado)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      } else if (vinDuplicado) {
        const mensaje = 
          '⚠️ ATENCIÓN: VIN DUPLICADO DETECTADO\n\n' +
          'Este VIN ya está registrado en otra póliza:\n\n' +
          '🚗 VIN: ' + vinFormulario + '\n' +
          '📋 Póliza existente: ' + vinDuplicado.numero_poliza + '\n' +
          '🏢 Compañía: ' + vinDuplicado.compania + '\n' +
          '👤 Cliente: ' + vinDuplicado.nombre + ' ' + vinDuplicado.apellido_paterno + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará como VIN duplicado para revisión)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      } else if (polizaDuplicadaVinDistinto) {
        const mensaje = 
          '⚠️ ADVERTENCIA: PÓLIZA DUPLICADA CON VIN DISTINTO\n\n' +
          'Esta póliza ya existe con un VIN diferente:\n\n' +
          '📋 Póliza: ' + formulario.numero_poliza + '\n' +
          '🚗 VIN actual: ' + vinFormulario + '\n' +
          '🚗 VIN existente: ' + (polizaDuplicadaVinDistinto.numero_serie || 'N/A') + '\n' +
          '🏢 Compañía: ' + formulario.compania + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará para revisión en el listado)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      }
    }

    if (formulario.producto === 'Autos Individual') {
      if (!formulario.marca || !formulario.modelo || !formulario.anio) {
  toast('⚠️ Para Autos: complete Marca, Modelo y Año');
        return false;
      }
      
      const anioVehiculo = parseInt(formulario.anio);
      if (anioVehiculo < CONSTANTS.MIN_YEAR || anioVehiculo > CONSTANTS.MAX_YEAR) {
  toast('⚠️ Ingrese un año válido para el vehículo');
        return false;
      }
      
      if (formulario.numero_serie && formulario.numero_serie.length !== CONSTANTS.VIN_LENGTH) {
  toast(`⚠️ El VIN debe tener ${CONSTANTS.VIN_LENGTH} caracteres`);
        return false;
      }
    }

    // Regla de negocio: En Persona Moral debe existir Contacto Principal (nombre) y al menos Email o Teléfono Móvil
    if (clienteSeleccionado?.tipoPersona === 'Persona Moral') {
      const nombreContacto = (formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
      const tieneEmailOMovil = !!(
        (formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim() ||
        (formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim()
      );
      if (!nombreContacto || !tieneEmailOMovil) {
  toast('⚠️ Persona Moral: capture Contacto Principal con nombre y al menos Email o Teléfono Móvil');
        return false;
      }
    }

    // Regla de negocio: En Persona Física debe tener al menos Email o Teléfono Móvil (propio o del contacto principal)
    if (clienteSeleccionado?.tipoPersona === 'Persona Física') {
      // Verificar datos propios del cliente
      const tieneEmailPropio = !!(formulario.email || clienteSeleccionado.email || '').trim();
      const tieneMovilPropio = !!(formulario.telefono_movil || clienteSeleccionado.telefono_movil || clienteSeleccionado.telefonoMovil || '').trim();
      
      // Verificar datos del contacto principal (si existe)
      const tieneContactoPrincipal = !!(formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
      const tieneEmailContacto = !!(formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim();
      const tieneMovilContacto = !!(formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim();
      
      // Debe tener al menos un email o móvil (propio o del contacto)
      const tieneContactoValido = tieneEmailPropio || tieneMovilPropio || 
                                  (tieneContactoPrincipal && (tieneEmailContacto || tieneMovilContacto));
      
      if (!tieneContactoValido) {
  toast('⚠️ Persona Física: se requiere Email o Teléfono Móvil (cliente o contacto)');
        return false;
      }
    }

    return true;
  }, [formulario, clienteSeleccionado, modoEdicion, expedientes]);

  const guardarExpediente = useCallback(async () => {
    // 🚨 DEBUG: Estado del formulario al hacer click en guardar
    console.log('🚀 [GUARDAR EXPEDIENTE] Iniciando proceso de guardado');
    console.log('🚀 [GUARDAR EXPEDIENTE] Estado actual del formulario:', formulario);
    console.log('🚀 [GUARDAR EXPEDIENTE] cargo_pago_fraccionado:', formulario.cargo_pago_fraccionado);
    console.log('🚀 [GUARDAR EXPEDIENTE] gastos_expedicion:', formulario.gastos_expedicion);
    
    if (!validarFormulario()) return;

    // ✅ VALIDAR FECHA DE EMISIÓN - Preguntar al usuario si desea usar fecha actual
    if (!modoEdicion && (!formulario.fecha_emision || formulario.fecha_emision === new Date().toISOString().split('T')[0])) {
      const usarFechaActual = window.confirm(
        '¿Desea utilizar la fecha actual como fecha de emisión?\n\n' +
        `Fecha actual: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
        'Presione "Aceptar" para continuar con esta fecha\n' +
        'Presione "Cancelar" para poder editarla'
      );
      
      if (!usarFechaActual) {
        toast.info('📅 Por favor, edite la Fecha de Emisión en el formulario antes de guardar');
        // Hacer scroll hacia el campo de fecha_emision
        const campoFechaEmision = document.querySelector('input[type="date"][value*="' + formulario.fecha_emision + '"]');
        if (campoFechaEmision) {
          campoFechaEmision.scrollIntoView({ behavior: 'smooth', block: 'center' });
          campoFechaEmision.focus();
        }
        return; // Detener el guardado
      }
    }

    // Si hay un cliente seleccionado, actualizar sus datos de contacto según su tipo
    if (clienteSeleccionado && formulario.cliente_id) {
      try {
        console.log('💼 Actualizando datos de contacto del cliente...', {
          cliente_id: clienteSeleccionado.id,
          tipoPersona: clienteSeleccionado.tipoPersona
        });
        
        // LÓGICA CORRECTA:
        // - Persona Moral: usa contacto_* para el contacto principal
        // - Persona Física: usa email/telefono_* para el cliente + contacto_* para el gestor (opcional)
        
        let datosActualizados = {};
        
        if (clienteSeleccionado.tipoPersona === 'Persona Moral') {
          // Persona Moral: solo actualizar contacto_* (contacto principal)
          datosActualizados = {
            contacto_nombre: formulario.contacto_nombre || null,
            contacto_apellido_paterno: formulario.contacto_apellido_paterno || null,
            contacto_apellido_materno: formulario.contacto_apellido_materno || null,
            contacto_email: formulario.contacto_email || null,
            contacto_telefono_fijo: formulario.contacto_telefono_fijo || null,
            contacto_telefono_movil: formulario.contacto_telefono_movil || null
          };
        } else {
          // Persona Física: actualizar campos principales DEL CLIENTE + contacto_* del gestor
          datosActualizados = {
            // Datos principales del cliente (editables desde póliza)
            email: formulario.email || null,
            telefonoMovil: formulario.telefono_movil || null,
            telefonoFijo: formulario.telefono_fijo || null,
            // Datos del gestor/contacto adicional (opcional)
            contacto_nombre: formulario.contacto_nombre || null,
            contacto_apellido_paterno: formulario.contacto_apellido_paterno || null,
            contacto_apellido_materno: formulario.contacto_apellido_materno || null,
            contacto_email: formulario.contacto_email || null,
            contacto_telefono_fijo: formulario.contacto_telefono_fijo || null,
            contacto_telefono_movil: formulario.contacto_telefono_movil || null
          };
        }
        
        const response = await fetch(`${API_URL}/api/clientes/${clienteSeleccionado.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosActualizados)
        });

        if (response.ok) {
          const resultado = await response.json();
          
          // ⚠️ IMPORTANTE: Actualizar clientesMap inmediatamente para que InfoCliente vea los cambios
          const clienteActualizado = resultado.data || resultado;
          setClientesMap(prevMap => ({
            ...prevMap,
            [clienteSeleccionado.id]: {
              ...prevMap[clienteSeleccionado.id],
              ...clienteActualizado,
              // Normalizar campos en camelCase para compatibilidad
              contacto_nombre: clienteActualizado.contacto_nombre || clienteActualizado.contactoNombre,
              contacto_apellido_paterno: clienteActualizado.contacto_apellido_paterno || clienteActualizado.contactoApellidoPaterno,
              contacto_apellido_materno: clienteActualizado.contacto_apellido_materno || clienteActualizado.contactoApellidoMaterno,
              contacto_email: clienteActualizado.contacto_email || clienteActualizado.contactoEmail,
              contacto_telefono_fijo: clienteActualizado.contacto_telefono_fijo || clienteActualizado.contactoTelefonoFijo,
              contacto_telefono_movil: clienteActualizado.contacto_telefono_movil || clienteActualizado.contactoTelefonoMovil,
              email: clienteActualizado.email,
              telefono_movil: clienteActualizado.telefono_movil || clienteActualizado.telefonoMovil,
              telefono_fijo: clienteActualizado.telefono_fijo || clienteActualizado.telefonoFijo
            }
          }));
          console.log('✅ ClientesMap actualizado con nuevos datos de contacto');
          // Notificar globalmente para que otros módulos (Clientes) recarguen su lista
          try {
            window.dispatchEvent(new CustomEvent('clientes-actualizados', { detail: { origen: 'Expedientes.jsx', tipo: 'update', id: clienteSeleccionado.id, ts: Date.now() } }));
          } catch (_) { /* noop */ }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ No se pudo actualizar el cliente:', errorText);
        }
      } catch (error) {
        console.error('❌ Error al actualizar cliente:', error);
        // Continuar con el guardado del expediente aunque falle la actualización del cliente
      }
    }

    const formularioConCalculos = actualizarCalculosAutomaticos(formulario);
    
    // ✅ FUNCIÓN para convertir camelCase a snake_case
    const camelToSnake = (str) => {
      return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    };

    // ✅ CONVERSIÓN COMPLETA a snake_case para el backend
    const convertirASnakeCase = (obj) => {
      const resultado = {};
      
        // Mapeo específico de campos conocidos
        const mapeoEspecifico = {
          // Identificación
          numeroPoliza: 'numero_poliza',
          clienteId: 'cliente_id',
          agenteId: 'agente_id',
          vendedorId: 'vendedor_id',
          claveAseguradora: 'clave_aseguradora',
          
          // Datos Cliente
          apellidoPaterno: 'apellido_paterno',
          apellidoMaterno: 'apellido_materno',
          razonSocial: 'razon_social',
          nombreComercial: 'nombre_comercial',
          numeroIdentificacion: 'numero_identificacion',
          telefonoFijo: 'telefono_fijo',
          telefonoMovil: 'telefono_movil',
          
          // Póliza
          cargoPagoFraccionado: 'cargo_pago_fraccionado',
          motivoCancelacion: 'motivo_cancelacion',
          frecuenciaPago: 'frecuencia_pago',
          proximoPago: 'proximo_pago',
          estatusPago: 'estatus_pago',
          gastosExpedicion: 'gastos_expedicion',
          subAgente: 'sub_agente',
          
          // Vehículo
          numeroSerie: 'numero_serie',
          tipoVehiculo: 'tipo_vehiculo',
          tipoCobertura: 'tipo_cobertura',
          sumaAsegurada: 'suma_asegurada',
          conductorHabitual: 'conductor_habitual',
          edadConductor: 'edad_conductor',
          licenciaConducir: 'licencia_conducir',
          
          // Financiero
          primaPagada: 'prima_pagada',
          periodoGracia: 'periodo_gracia',
          fechaUltimoPago: 'fecha_ultimo_pago',
          fechaVencimientoPago: 'fecha_vencimiento_pago',
          
          // Vigencia
          inicioVigencia: 'inicio_vigencia',
          terminoVigencia: 'termino_vigencia',
          
          // Estado
          etapaActiva: 'etapa_activa',
          tipoPago: 'tipo_pago',
          fechaCreacion: 'fecha_creacion'
        };

        Object.keys(obj).forEach(key => {
          // Usar mapeo específico si existe, sino conversión automática
          const snakeKey = mapeoEspecifico[key] || camelToSnake(key);
          
          // ✅ CORRECCIÓN CRÍTICA: Solo aplicar si el campo snake_case no existe ya o está vacío
          // Esto evita que campos camelCase vacíos sobrescriban campos snake_case con valores
          const existeEnSnake = resultado.hasOwnProperty(snakeKey);
          const valorActualSnake = resultado[snakeKey];
          const valorNuevo = obj[key];
          
          if (!existeEnSnake || 
              (valorActualSnake === '' || valorActualSnake === null || valorActualSnake === undefined) ||
              (valorNuevo !== '' && valorNuevo !== null && valorNuevo !== undefined)) {
            resultado[snakeKey] = valorNuevo;
          }
          
          // Debug específico para campos problemáticos
          if (key.includes('cargo_pago_fraccionado') || key.includes('gastos_expedicion') || snakeKey.includes('cargo_pago_fraccionado') || snakeKey.includes('gastos_expedicion')) {
            console.log(`🔍 DEBUG convertirASnakeCase: ${key} = "${obj[key]}" → ${snakeKey} = "${resultado[snakeKey]}" (existía: ${existeEnSnake})`);
          }
        });      return resultado;
    };

    // 🚨 DEBUG: Verificar formulario ANTES de conversión
    console.log('🚨 [FORMULARIO ANTES] cargo_pago_fraccionado:', formularioConCalculos.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] gastos_expedicion:', formularioConCalculos.gastos_expedicion);
    console.log('🚨 [FORMULARIO ANTES] tipo valor cargo_pago_fraccionado:', typeof formularioConCalculos.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] tipo valor gastos_expedicion:', typeof formularioConCalculos.gastos_expedicion);
    
    // ✅ SOLUCIÓN DIRECTA: Crear payload básico y forzar los campos problemáticos
    let expedientePayload = {
      ...formularioConCalculos,
      // Forzar estos campos específicos sin conversión compleja
      cargo_pago_fraccionado: formularioConCalculos.cargo_pago_fraccionado || '',
      gastos_expedicion: formularioConCalculos.gastos_expedicion || '',
    };
    
    // Solo hacer conversión básica de campos que no sean problemáticos
    const convertirSoloNecesario = (obj) => {
      const resultado = { ...obj };
      
      // Solo campos esenciales que necesitan conversión
      if (resultado.clienteId) {
        resultado.cliente_id = resultado.clienteId;
        delete resultado.clienteId;
      }
      if (resultado.numeroPoliza) {
        resultado.numero_poliza = resultado.numeroPoliza;
        delete resultado.numeroPoliza;
      }
      if (resultado.inicioVigencia) {
        resultado.inicio_vigencia = resultado.inicioVigencia;
        delete resultado.inicioVigencia;
      }
      if (resultado.terminoVigencia) {
        resultado.termino_vigencia = resultado.terminoVigencia;
        delete resultado.terminoVigencia;
      }
      
      return resultado;
    };
    
    expedientePayload = convertirSoloNecesario(expedientePayload);
    
    // ✅ GARANTIZAR que estos campos problemáticos estén presentes
    expedientePayload.cargo_pago_fraccionado = formularioConCalculos.cargo_pago_fraccionado || '';
    expedientePayload.gastos_expedicion = formularioConCalculos.gastos_expedicion || '';
    
    console.log('🚨 [PAYLOAD SIMPLE] cargo_pago_fraccionado FORZADO:', expedientePayload.cargo_pago_fraccionado);
    console.log('🚨 [PAYLOAD SIMPLE] gastos_expedicion FORZADO:', expedientePayload.gastos_expedicion);
    
    // Limpiar campos innecesarios
    delete expedientePayload.__pdf_file;
    delete expedientePayload.__pdf_nombre;
    delete expedientePayload.__pdf_size;
    delete expedientePayload.contacto_nombre;
    delete expedientePayload.contacto_apellido_paterno;
    delete expedientePayload.contacto_apellido_materno;
    delete expedientePayload.contacto_email;
    delete expedientePayload.contacto_telefono_fijo;
    delete expedientePayload.contacto_telefono_movil;
    
    // Limpiar duplicados camelCase
    delete expedientePayload.cargoPagoFraccionado;
    delete expedientePayload.gastosExpedicion;
    delete expedientePayload.proximoPago;
    delete expedientePayload.estatusPago;
    delete expedientePayload.motivoCancelacion;
    delete expedientePayload.razonSocial;
    delete expedientePayload.tasaFinanciamiento;
    delete expedientePayload.subTotal;

    
    // ✅ CAMBIO IMPORTANTE: Sí enviamos campos del cliente (nombre, apellidos, rfc, email, etc.)
    // El backend los necesita para enriquecer el expediente
    // Solo enviamos lo que el usuario puede editar
    
    // Convertir coberturas a JSON string si existen (para compatibilidad con SQL)
    if (expedientePayload.coberturas && Array.isArray(expedientePayload.coberturas)) {
      expedientePayload.coberturas = JSON.stringify(expedientePayload.coberturas);
    }

    // DEBUG: Verificar los campos al momento de GUARDAR
    try {
      const k = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
      console.groupCollapsed('🧪 DEBUG Guardar Expediente — Campos clave');
      console.log('📊 Formulario original (formularioConCalculos):');
      console.table([
        { campo: 'uso', valor: k(formularioConCalculos.uso) },
        { campo: 'servicio', valor: k(formularioConCalculos.servicio) },
        { campo: 'movimiento', valor: k(formularioConCalculos.movimiento) },
        { campo: 'cargo_pago_fraccionado', valor: k(formularioConCalculos.cargo_pago_fraccionado) },
        { campo: 'gastos_expedicion', valor: k(formularioConCalculos.gastos_expedicion) },
        { campo: 'subtotal', valor: k(formularioConCalculos.subtotal) }
      ]);
      console.log('📤 Payload final (expedientePayload):');
      console.table([
        { campo: 'uso', valor: k(expedientePayload.uso) },
        { campo: 'servicio', valor: k(expedientePayload.servicio) },
        { campo: 'movimiento', valor: k(expedientePayload.movimiento) },
        { campo: 'cargo_pago_fraccionado', valor: k(expedientePayload.cargo_pago_fraccionado) },
        { campo: 'gastos_expedicion', valor: k(expedientePayload.gastos_expedicion) },
        { campo: 'subtotal', valor: k(expedientePayload.subtotal) }
      ]);
      
      // 🚨 DEBUG CRÍTICO: Verificar el JSON que se envía al backend
      console.log('🚨 JSON FINAL que se enviará al backend:');
      console.log(JSON.stringify(expedientePayload, null, 2));
      console.log('🚨 cargo_pago_fraccionado en JSON:', JSON.stringify(expedientePayload.cargo_pago_fraccionado));
      console.log('🚨 gastos_expedicion en JSON:', JSON.stringify(expedientePayload.gastos_expedicion));
      
      console.groupEnd();
    } catch (_) { /* noop */ }

    if (modoEdicion) {
      // ✅ VERIFICACIÓN FINAL OBLIGATORIA - Asegurar que los campos estén ahí
      if (!expedientePayload.hasOwnProperty('cargo_pago_fraccionado')) {
        console.error('❌ FALTA cargo_pago_fraccionado en payload!');
        expedientePayload.cargo_pago_fraccionado = formularioConCalculos.cargo_pago_fraccionado || '';
      }
      if (!expedientePayload.hasOwnProperty('gastos_expedicion')) {
        console.error('❌ FALTA gastos_expedicion en payload!');
        expedientePayload.gastos_expedicion = formularioConCalculos.gastos_expedicion || '';
      }
      
      // 🚨 DEBUG CRÍTICO: Verificar el JSON exacto que se enviará
      console.log('🚨 [FETCH PUT] FINAL VERIFICADO:');
      console.log('🚨 cargo_pago_fraccionado:', expedientePayload.cargo_pago_fraccionado);
      console.log('🚨 gastos_expedicion:', expedientePayload.gastos_expedicion);
      console.log('🚨 [FETCH PUT] JSON.stringify del payload:');
      console.log(JSON.stringify(expedientePayload, null, 2));
      
      fetch(`${API_URL}/api/expedientes/${formularioConCalculos.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expedientePayload)
      })
        .then(response => response.json())
        .then(async (data) => {
          // DEBUG: Verificar respuesta del backend tras UPDATE
          try {
            const registro = data?.data || data;
            const k = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
            console.groupCollapsed('🧪 DEBUG Respuesta PUT — Campos clave en registro devuelto');
            console.table([
              { campo: 'uso | variantes', valor: k(registro?.uso || registro?.uso_poliza || registro?.Uso || registro?.usoVehiculo) },
              { campo: 'servicio | variantes', valor: k(registro?.servicio || registro?.servicio_poliza || registro?.Servicio || registro?.servicioVehiculo) },
              { campo: 'movimiento | variantes', valor: k(registro?.movimiento || registro?.movimiento_poliza || registro?.Movimiento) },
              { campo: 'cargo_pago_fraccionado | camel', valor: k(registro?.cargo_pago_fraccionado ?? registro?.cargoPagoFraccionado) },
              { campo: 'gastos_expedicion | camel', valor: k(registro?.gastos_expedicion ?? registro?.gastosExpedicion) },
              { campo: 'subtotal | variantes', valor: k(registro?.subtotal ?? registro?.sub_total ?? registro?.subTotal) }
            ]);
            console.groupEnd();
          } catch (_) { /* noop */ }
          // ✨ Registrar actualización de datos en historial (trazabilidad)
          try {
            const expedienteId = formularioConCalculos.id;
            const expedienteAnterior = expedientes.find(exp => exp.id === expedienteId);
            
            // Verificar si hubo cambio de etapa para registrar evento específico
            if (expedienteAnterior && expedienteAnterior.etapa_activa !== formularioConCalculos.etapa_activa) {
              await historialService.registrarCambioEtapa(
                expedienteId,
                formularioConCalculos.cliente_id,
                expedienteAnterior.etapa_activa,
                formularioConCalculos.etapa_activa,
                'Sistema', // TODO: usuario actual
                'Cambio manual desde formulario de edición'
              );
            } else {
              // Si NO hubo cambio de etapa, registrar actualización genérica
              await historialService.registrarEvento({
                expediente_id: expedienteId,
                cliente_id: formularioConCalculos.cliente_id,
                tipo_evento: historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS,
                usuario_nombre: 'Sistema', // TODO: usuario actual
                descripcion: `Expediente actualizado: ${formularioConCalculos.compania} - ${formularioConCalculos.producto}`,
                datos_adicionales: {
                  numero_poliza: formularioConCalculos.numero_poliza,
                  campos_modificados: true // marcador simple; idealmente diferencias
                }
              });
            }
          } catch (e) {
            console.warn('⚠️ No se pudo registrar evento de actualización:', e);
          }

          limpiarFormulario();
          recargarExpedientes();
          setVistaActual('lista');
        })
        .catch(err => {
          console.error('❌ Error al actualizar expediente:', err);
          toast.error('Error al actualizar expediente: ' + err.message);
        });
    } else {
      // 🚨 DEBUG CRÍTICO: Verificar el payload final del POST
      const payloadFinal = {
        ...expedientePayload,
        fecha_creacion: new Date().toISOString().split('T')[0]
      };
      
      console.log('🚨 [FETCH POST] Payload final antes de JSON.stringify:');
      console.log('🚨 [FETCH POST] cargo_pago_fraccionado:', payloadFinal.cargo_pago_fraccionado);
      console.log('🚨 [FETCH POST] gastos_expedicion:', payloadFinal.gastos_expedicion);
      console.log('🚨 [FETCH POST] JSON.stringify completo:');
      console.log(JSON.stringify(payloadFinal, null, 2));
      
  fetch(`${API_URL}/api/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFinal)
      })
        .then(response => response.json())
        .then(async (data) => {
          // DEBUG: Verificar respuesta del backend tras CREATE
          try {
            const registro = data?.data || data;
            const k = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
            console.groupCollapsed('🧪 DEBUG Respuesta POST — Campos clave en registro devuelto');
            console.table([
              { campo: 'uso | variantes', valor: k(registro?.uso || registro?.uso_poliza || registro?.Uso || registro?.usoVehiculo) },
              { campo: 'servicio | variantes', valor: k(registro?.servicio || registro?.servicio_poliza || registro?.Servicio || registro?.servicioVehiculo) },
              { campo: 'movimiento | variantes', valor: k(registro?.movimiento || registro?.movimiento_poliza || registro?.Movimiento) },
              { campo: 'cargo_pago_fraccionado | camel', valor: k(registro?.cargo_pago_fraccionado ?? registro?.cargoPagoFraccionado) },
              { campo: 'gastos_expedicion | camel', valor: k(registro?.gastos_expedicion ?? registro?.gastosExpedicion) },
              { campo: 'subtotal | variantes', valor: k(registro?.subtotal ?? registro?.sub_total ?? registro?.subTotal) }
            ]);
            console.groupEnd();
          } catch (_) { /* noop */ }
          // ✨ Registrar creación en historial de trazabilidad
          try {
            const nuevoId = data?.id || data?.data?.id;
            if (nuevoId) {
              // Determinar tipo de evento según la etapa actual
              const etapaActual = expedientePayload.etapa_activa || 'En cotización';
              let tipoEvento = historialService.TIPOS_EVENTO.COTIZACION_CREADA;
              let descripcionEvento = `Cotización creada: ${expedientePayload.compania} - ${expedientePayload.producto}`;
              
              // Si se crea directo en etapa "Emitida", registrar como póliza emitida
              if (etapaActual === 'Emitida') {
                tipoEvento = historialService.TIPOS_EVENTO.POLIZA_EMITIDA;
                descripcionEvento = `Póliza emitida y capturada: ${expedientePayload.compania} - ${expedientePayload.producto}`;
              } else if (etapaActual === 'Enviada al Cliente') {
                tipoEvento = historialService.TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL;
                descripcionEvento = `Póliza capturada como enviada: ${expedientePayload.compania} - ${expedientePayload.producto}`;
              }
              
              await historialService.registrarEvento({
                expediente_id: nuevoId,
                cliente_id: expedientePayload.cliente_id,
                tipo_evento: tipoEvento,
                etapa_nueva: etapaActual,
                usuario_nombre: 'Sistema', // TODO: Obtener usuario actual
                descripcion: descripcionEvento,
                datos_adicionales: {
                  numero_poliza: expedientePayload.numero_poliza,
                  compania: expedientePayload.compania,
                  producto: expedientePayload.producto,
                  origen: 'captura_manual'
                }
              });
              console.log(`✅ Evento ${tipoEvento} registrado en historial`);
            }
          } catch (error) {
            console.warn('⚠️ Historial no disponible (backend endpoint pendiente):', error.message);
            toast('⚠️ Expediente creado correctamente. Historial temporal no disponible hasta que se implemente el backend.', {
              duration: 4000,
              icon: 'ℹ️'
            });
          }

          try {
            // Obtener ID del expediente creado (compatibilidad con posibles estructuras)
            const nuevoId = data?.id || data?.data?.id;
            if (nuevoId && formulario.__pdfFile) {
              console.log('📤 Subiendo PDF automáticamente para expediente recién creado:', nuevoId);
              setSubiendoPDF(true);
              try {
                const pdfData = await pdfService.subirPDFPoliza(nuevoId, formulario.__pdfFile);
                // Refrescar listado para reflejar metadatos del PDF
                await recargarExpedientes();
                console.log('✅ PDF subido automáticamente:', pdfData?.pdf_nombre || formulario.__pdfNombre || 'PDF');
              } catch (error) {
                console.error('⚠️ Error al subir automáticamente el PDF:', error);
                toast('⚠️ Expediente creado, pero no se pudo subir el PDF automáticamente: ' + error.message);
              } finally {
                setSubiendoPDF(false);
              }
            }
          } catch (e) {
            console.warn('No fue posible realizar la subida automática del PDF:', e);
          }
          limpiarFormulario();
          recargarExpedientes();
          setVistaActual('lista');
        })
        .catch(err => {
          console.error('❌ Error al crear expediente:', err);
          toast.error('Error al crear expediente: ' + err.message);
        });
    }
  }, [formulario, modoEdicion, actualizarCalculosAutomaticos, limpiarFormulario, validarFormulario, clienteSeleccionado]);
  const recargarExpedientes = useCallback(async () => {
    try {
      // Obtener expedientes frescos SIN cache
      const resExpedientes = await fetch(`${API_URL}/api/expedientes?t=${Date.now()}`);
      const expedientes = await resExpedientes.json();
      
      // 2. Obtener todos los clientes
      const resClientes = await fetch(`${API_URL}/api/clientes`);
      const clientesData = await resClientes.json();
      
      // 3. Crear un mapa de clientes por ID para búsqueda rápida
      const mapa = {};
      clientesData.forEach(cliente => {
        mapa[cliente.id] = cliente;
      });
      
      // 4. Actualizar estados de clientes
      setClientes(clientesData);
      setClientesMap(mapa);
      
      // 5. Parsear coberturas si vienen como string JSON y normalizar alias (uso/servicio/movimiento)
      const expedientesConCoberturasParsadas = expedientes.map(exp => {
        if (exp.coberturas && typeof exp.coberturas === 'string') {
          try {
            exp.coberturas = JSON.parse(exp.coberturas);
          } catch (error) {
            console.error(`❌ Error parseando coberturas para ${exp.numero_poliza}:`, error);
            exp.coberturas = null;
          }
        }
        // Normalizar alias para que edición y detalle los tengan listos
        exp.uso = exp.uso || exp.uso_poliza || exp.Uso || exp.usoVehiculo || '';
        exp.servicio = exp.servicio || exp.servicio_poliza || exp.Servicio || exp.servicioVehiculo || '';
        exp.movimiento = exp.movimiento || exp.movimiento_poliza || exp.Movimiento || '';
        // Montos y financieros: cubrir alias comunes del backend
        exp.cargo_pago_fraccionado =
          exp.cargo_pago_fraccionado ?? exp.cargoPagoFraccionado ?? exp.tasa_financiamiento ?? exp.tasaFinanciamiento ?? 0;
        exp.gastos_expedicion =
          exp.gastos_expedicion ?? exp.gastosExpedicion ?? exp.gastos ?? 0;
        exp.subtotal = exp.subtotal ?? exp.sub_total ?? exp.subTotal ?? 0;
        return exp;
      });
      
      setExpedientes(expedientesConCoberturasParsadas);
    } catch (err) {
      console.error('Error al recargar expedientes:', err);
    }
  }, []);
  // ✅ FUNCIÓN para convertir snake_case a camelCase
  const snakeToCamel = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  };

  // ✅ CONVERSIÓN de snake_case a camelCase para uso interno del frontend
  const convertirACamelCase = (obj) => {
    console.log('🔄 [convertirACamelCase] ENTRADA - obj:', obj);
    console.log('🔄 [convertirACamelCase] cargo_pago_fraccionado entrante:', obj.cargo_pago_fraccionado);
    console.log('🔄 [convertirACamelCase] gastos_expedicion entrante:', obj.gastos_expedicion);
    
    const resultado = {};
    
    // Mapeo específico de campos conocidos (inverso del anterior)
    const mapeoEspecifico = {
      // Identificación
      numero_poliza: 'numeroPoliza',
      cliente_id: 'clienteId', 
      agente_id: 'agenteId',
      vendedor_id: 'vendedorId',
      clave_aseguradora: 'claveAseguradora',
      
      // Datos Cliente
      apellido_paterno: 'apellidoPaterno',
      apellido_materno: 'apellidoMaterno',
      razon_social: 'razonSocial',
      nombre_comercial: 'nombreComercial',
      numero_identificacion: 'numeroIdentificacion',
      telefono_fijo: 'telefonoFijo',
      telefono_movil: 'telefonoMovil',
      
      // Póliza
      cargo_pago_fraccionado: 'cargoPagoFraccionado',
      motivo_cancelacion: 'motivoCancelacion',
      frecuencia_pago: 'frecuenciaPago',
      proximo_pago: 'proximoPago',
      estatus_pago: 'estatusPago',
      gastos_expedicion: 'gastosExpedicion',
      sub_agente: 'subAgente',
      
      // Vehículo
      numero_serie: 'numeroSerie',
      tipo_vehiculo: 'tipoVehiculo',
      tipo_cobertura: 'tipoCobertura',
      suma_asegurada: 'sumaAsegurada',
      conductor_habitual: 'conductorHabitual',
      edad_conductor: 'edadConductor',
      licencia_conducir: 'licenciaConducir',
      
      // Financiero
      prima_pagada: 'primaPagada',
      periodo_gracia: 'periodoGracia',
      fecha_ultimo_pago: 'fechaUltimoPago',
      fecha_vencimiento_pago: 'fechaVencimientoPago',
      
      // Vigencia
      inicio_vigencia: 'inicioVigencia',
      termino_vigencia: 'terminoVigencia',
      
      // Estado
      etapa_activa: 'etapaActiva',
      tipo_pago: 'tipoPago',
      fecha_creacion: 'fechaCreacion'
    };

    Object.keys(obj).forEach(key => {
      // Usar mapeo específico si existe, sino conversión automática
      const camelKey = mapeoEspecifico[key] || snakeToCamel(key);
      resultado[camelKey] = obj[key];
      
      // También mantener la versión original para compatibilidad
      resultado[key] = obj[key];
      
      // Debug específico para campos problemáticos
      if (key === 'cargo_pago_fraccionado' || key === 'gastos_expedicion') {
        console.log(`🔄 [convertirACamelCase] ${key} → ${camelKey}: "${obj[key]}" (tipo: ${typeof obj[key]})`);
      }
    });

    console.log('🔄 [convertirACamelCase] SALIDA - resultado:', resultado);
    console.log('🔄 [convertirACamelCase] cargo_pago_fraccionado final:', resultado.cargo_pago_fraccionado);
    console.log('🔄 [convertirACamelCase] cargoPagoFraccionado final:', resultado.cargoPagoFraccionado);
    console.log('🔄 [convertirACamelCase] gastos_expedicion final:', resultado.gastos_expedicion);
    console.log('🔄 [convertirACamelCase] gastosExpedicion final:', resultado.gastosExpedicion);
    
    return resultado;
  };

  const editarExpediente = useCallback(async (expediente) => {
    // Traer el expediente completo por ID para garantizar que vengan todos los campos (incluye uso y cargo_pago_fraccionado)
    let expedienteCompleto = expediente;
    try {
      const resp = await fetch(`${API_URL}/api/expedientes/${expediente.id}`);
      if (resp.ok) {
        const data = await resp.json();
        const desdeApi = data?.data ?? data;
        if (desdeApi && typeof desdeApi === 'object') {
          // Convertir snake_case a camelCase para uso interno del frontend
          const datosConvertidos = convertirACamelCase(desdeApi);
          // Merge no destructivo: los campos del detalle tienen prioridad
          expedienteCompleto = { ...expediente, ...datosConvertidos };
        }
        try {
          console.groupCollapsed('🌐 API GET /api/expedientes/:id — payload crudo');
          console.log(desdeApi);
          console.groupEnd();
        } catch (_) {}
      }
    } catch (e) {
      console.warn('⚠️ No se pudo obtener el expediente por ID, se usará el de la lista:', e);
    }

    // DEBUG: Verificar los 6 campos al ENTRAR A EDITAR (ya con datos del GET si estuvo disponible)
    try {
      const k = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
      console.groupCollapsed('🧪 DEBUG Editar Expediente — Datos desde BD');
      console.table([
        { campo: 'uso | variantes', valor: k(expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo) },
        { campo: 'servicio | variantes', valor: k(expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo) },
        { campo: 'movimiento | variantes', valor: k(expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento) },
        { campo: 'cargo_pago_fraccionado | camel', valor: k(expedienteCompleto.cargo_pago_fraccionado ?? expedienteCompleto.cargoPagoFraccionado) },
        { campo: 'gastos_expedicion | camel', valor: k(expedienteCompleto.gastos_expedicion ?? expedienteCompleto.gastosExpedicion) },
        { campo: 'subtotal | variantes', valor: k(expedienteCompleto.subtotal ?? expedienteCompleto.sub_total ?? expedienteCompleto.subTotal) }
      ]);
      console.groupEnd();
    } catch (_) { /* noop */ }

    // Helper para convertir fechas ISO a formato YYYY-MM-DD
    const formatearFechaParaInput = (fecha) => {
      if (!fecha) return '';
      try {
        // Si viene en formato ISO (2025-11-12T00:00:00.000Z), extraer solo la fecha
        return fecha.split('T')[0];
      } catch {
        return fecha;
      }
    };
    
    // Construir formulario base normalizado
    const formularioBase = {
      ...expedienteCompleto,
      // Normalizar fechas que vienen en formato ISO a YYYY-MM-DD
  fecha_emision: formatearFechaParaInput(expedienteCompleto.fecha_emision) || formatearFechaParaInput(expedienteCompleto.created_at) || new Date().toISOString().split('T')[0],
  inicio_vigencia: formatearFechaParaInput(expedienteCompleto.inicio_vigencia) || '',
  termino_vigencia: formatearFechaParaInput(expedienteCompleto.termino_vigencia) || '',
      // NOTA: fecha_pago y fecha_vencimiento_pago se recalcularán automáticamente según inicio_vigencia + periodo_gracia.
      // Se cargan temporalmente por si el backend trae valores; luego se sincronizan.
  fecha_pago: formatearFechaParaInput(expedienteCompleto.fecha_pago) || '',
  fecha_vencimiento_pago: formatearFechaParaInput(expedienteCompleto.fecha_vencimiento_pago) || '',
      // Unificar nombre de campo: backend puede enviar proximo_pago; el estado interno usa proximoPago
  proximoPago: formatearFechaParaInput(expedienteCompleto.proximo_pago || expedienteCompleto.proximoPago) || '',
  fecha_cancelacion: formatearFechaParaInput(expedienteCompleto.fecha_cancelacion) || '',
  // Asegurar que campos numéricos no sean undefined (aceptar snake_case y camelCase del backend)
  prima_pagada: (expedienteCompleto.prima_pagada ?? expedienteCompleto.primaPagada ?? 0),
  
  // 🚨 DEBUG específico para cargo_pago_fraccionado
  cargo_pago_fraccionado: (() => {
    const valores = {
      snake: expedienteCompleto.cargo_pago_fraccionado,
      camel: expedienteCompleto.cargoPagoFraccionado,
      tasa_snake: expedienteCompleto.tasa_financiamiento,
      tasa_camel: expedienteCompleto.tasaFinanciamiento
    };
    console.log('🚨 [FORMULARIO INIT] cargo_pago_fraccionado - valores disponibles:', valores);
    // ✅ Convertir null a string vacío para evitar problemas en inputs
    const valor = valores.snake ?? valores.camel ?? valores.tasa_snake ?? valores.tasa_camel;
    const resultado = (valor === null || valor === undefined) ? '' : String(valor);
    console.log('🚨 [FORMULARIO INIT] cargo_pago_fraccionado - valor final:', resultado);
    return resultado;
  })(),
  
  // 🚨 DEBUG específico para gastos_expedicion
  gastos_expedicion: (() => {
    const valores = {
      snake: expedienteCompleto.gastos_expedicion,
      camel: expedienteCompleto.gastosExpedicion,
      gastos: expedienteCompleto.gastos
    };
    console.log('🚨 [FORMULARIO INIT] gastos_expedicion - valores disponibles:', valores);
    // ✅ Convertir null a string vacío para evitar problemas en inputs
    const valor = valores.snake ?? valores.camel ?? valores.gastos;
    const resultado = (valor === null || valor === undefined) ? '' : String(valor);
    console.log('🚨 [FORMULARIO INIT] gastos_expedicion - valor final:', resultado);
    return resultado;
  })(),
  
  subtotal: (expedienteCompleto.subtotal ?? expedienteCompleto.sub_total ?? expedienteCompleto.subTotal ?? 0),
    iva: (expedienteCompleto.iva ?? expedienteCompleto.IVA ?? 0),
    total: (expedienteCompleto.total ?? expedienteCompleto.importe_total ?? expedienteCompleto.importeTotal ?? 0),
      // Normalizar alias de campos USO / SERVICIO / MOVIMIENTO que pueden venir con distintos nombres
  uso: expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo || '',
  servicio: expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo || '',
  movimiento: expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento || '',
      // Sincronizar también los alias *_poliza para que el formulario los tenga disponibles
      uso_poliza: expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo || '',
      servicio_poliza: expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo || '',
      movimiento_poliza: expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento || ''
    };

    // 🔄 Forzar frecuenciaPago='Anual' para tipo de pago Anual o Pago Único si no viene
    if (formularioBase.tipo_pago && (formularioBase.tipo_pago === 'Anual' || /PAGO\s+ÚNICO|PAGO\s+UNICO/i.test(formularioBase.tipo_pago))) {
      formularioBase.frecuenciaPago = 'Anual';
    }

    // Si hay inicio de vigencia, recalcular automáticamente proximoPago/fecha_pago/estatus
    const formularioConCalculos = formularioBase.inicio_vigencia
      ? actualizarCalculosAutomaticos(formularioBase)
      : formularioBase;

    // Aplicar al estado en un solo set para evitar inconsistencias por batching
    setFormulario(formularioConCalculos);
    
    // Restaurar cliente seleccionado si el expediente tiene cliente_id
    if (expediente.cliente_id) {
      try {
        // Obtener cliente completo (cache o API) y normalizar a camelCase para evitar duplicados
        let cliente = clientesMap[expediente.cliente_id];

        if (!cliente) {
          const response = await fetch(`${API_URL}/api/clientes/${expediente.cliente_id}`);
          if (response.ok) {
            const data = await response.json();
            cliente = data.data || data;
          }
        }

        if (cliente) {
          // Normalización única: elegir camelCase como representación interna
          const normalizarCliente = (c) => ({
            id: c.id,
            tipoPersona: c.tipoPersona || c.tipo_persona || '',
            nombre: c.nombre || '',
            apellidoPaterno: c.apellidoPaterno || c.apellido_paterno || '',
            apellidoMaterno: c.apellidoMaterno || c.apellido_materno || '',
            razonSocial: c.razonSocial || c.razon_social || '',
            nombreComercial: c.nombreComercial || c.nombre_comercial || '',
            email: c.email || '',
            telefonoFijo: c.telefonoFijo || c.telefono_fijo || '',
            telefonoMovil: c.telefonoMovil || c.telefono_movil || '',
            rfc: c.rfc || '',
            contactoNombre: c.contactoNombre || c.contacto_nombre || '',
            contactoApellidoPaterno: c.contactoApellidoPaterno || c.contacto_apellido_paterno || '',
            contactoApellidoMaterno: c.contactoApellidoMaterno || c.contacto_apellido_materno || '',
            contactoEmail: c.contactoEmail || c.contacto_email || '',
            contactoTelefonoFijo: c.contactoTelefonoFijo || c.contacto_telefono_fijo || '',
            contactoTelefonoMovil: c.contactoTelefonoMovil || c.contacto_telefono_movil || ''
          });

          const clienteNormalizado = normalizarCliente(cliente);

          // Merge no destructivo: solo rellenar si el formulario aún no tenía esos datos
          setFormulario(prev => ({
            ...prev,
            nombre: prev.nombre || clienteNormalizado.nombre,
            apellido_paterno: prev.apellido_paterno || clienteNormalizado.apellidoPaterno,
            apellido_materno: prev.apellido_materno || clienteNormalizado.apellidoMaterno,
            razon_social: prev.razon_social || clienteNormalizado.razonSocial,
            nombre_comercial: prev.nombre_comercial || clienteNormalizado.nombreComercial,
            email: prev.email || clienteNormalizado.email,
            telefono_fijo: prev.telefono_fijo || clienteNormalizado.telefonoFijo,
            telefono_movil: prev.telefono_movil || clienteNormalizado.telefonoMovil,
            rfc: prev.rfc || clienteNormalizado.rfc,
            contacto_nombre: prev.contacto_nombre || clienteNormalizado.contactoNombre,
            contacto_apellido_paterno: prev.contacto_apellido_paterno || clienteNormalizado.contactoApellidoPaterno,
            contacto_apellido_materno: prev.contacto_apellido_materno || clienteNormalizado.contactoApellidoMaterno,
            contacto_email: prev.contacto_email || clienteNormalizado.contactoEmail,
            contacto_telefono_fijo: prev.contacto_telefono_fijo || clienteNormalizado.contactoTelefonoFijo,
            contacto_telefono_movil: prev.contacto_telefono_movil || clienteNormalizado.contactoTelefonoMovil
          }));

          // Guardar referencia simplificada
          setClienteSeleccionado(clienteNormalizado);
        }
      } catch (error) {
        console.error('⚠️ Error al recuperar cliente completo:', error);
      }
    }
    
    setModoEdicion(true);
    setVistaActual('formulario');
  }, [clientesMap, actualizarCalculosAutomaticos]);

const eliminarExpediente = useCallback((id) => {
  if (confirm('¿Está seguro de eliminar este expediente?')) {
    fetch(`${API_URL}/api/expedientes/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (res.ok) {
          setExpedientes(prev => prev.filter(exp => exp.id !== id));
        } else {
          toast.error('Error al eliminar expediente en la base de datos');
        }
      })
  .catch(() => toast.error('Error de conexión al eliminar expediente'));
  }
}, []);

  const verDetalles = useCallback((expediente) => {
    setExpedienteSeleccionado(expediente);
    setVistaActual('detalles');
  }, []);

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="container-fluid">
        {vistaActual === 'lista' && (
          <ListaExpedientes 
            expedientes={expedientes}
            agentes={agentes}
            limpiarFormulario={limpiarFormulario}
            setVistaActual={setVistaActual}
            aplicarPago={aplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            verDetalles={verDetalles}
            editarExpediente={editarExpediente}
            eliminarExpediente={eliminarExpediente}
            calcularProximoPago={calcularProximoPago}
            clientesMap={clientesMap}
            abrirModalCompartir={abrirModalCompartir}
          />
        )}
        
        {vistaActual === 'formulario' && (
          <Formulario 
            modoEdicion={modoEdicion}
            setVistaActual={setVistaActual}
            formulario={formulario}
            setFormulario={setFormulario}
            actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
            guardarExpediente={guardarExpediente}
            companias={companias}
            productos={productos}
            etapasActivas={etapasActivas}
            agentes={agentes}
            tiposPago={tiposPago}
            frecuenciasPago={frecuenciasPago}
            periodosGracia={periodosGracia}
            estatusPago={estatusPago}
            marcasVehiculo={marcasVehiculo}
            tiposVehiculo={tiposVehiculo}
            tiposCobertura={tiposCobertura}
            calculartermino_vigencia={calculartermino_vigencia}
            calcularProximoPago={calcularProximoPago}
            CONSTANTS={CONSTANTS}
            handleClienteSeleccionado={handleClienteSeleccionado}
            clienteSeleccionado={clienteSeleccionado}
            handleSeleccionarPDF={handleSeleccionarPDF}
            archivoSeleccionado={archivoSeleccionado}
            subiendoPDF={subiendoPDF}
            subirPDFPoliza={subirPDFPoliza}
          />
        )}
        
        {vistaActual === 'detalles' && (
          <DetallesExpediente 
            expedienteSeleccionado={expedienteSeleccionado}
            setExpedienteSeleccionado={setExpedienteSeleccionado}
            setVistaActual={setVistaActual}
            aplicarPago={aplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            editarExpediente={editarExpediente}
            calcularSiguientePago={calcularSiguientePago}
            calculartermino_vigencia={calculartermino_vigencia}
            calcularProximoPago={calcularProximoPago}
            abrirModalCompartir={abrirModalCompartir}
          />
        )}
      </div>
      
      {/* Modal Compartir - global al módulo */}
      {mostrarModalCompartir && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Compartir póliza</h5>
                <button type="button" className="btn-close" onClick={cerrarModalCompartir} aria-label="Cerrar"></button>
              </div>
              <div className="modal-body">
                {expedienteParaCompartir && (
                  <div className="mb-3 small text-muted">
                    <div><strong>Póliza:</strong> {expedienteParaCompartir.numero_poliza || 'Sin número'}</div>
                    <div><strong>Aseguradora:</strong> {expedienteParaCompartir.compania || 'N/A'}</div>
                  </div>
                )}

                <div className="d-grid gap-2">
                  <button
                    className="btn btn-success d-flex align-items-center justify-content-center"
                    onClick={() => { compartirPorWhatsApp(expedienteParaCompartir); cerrarModalCompartir(); }}
                  >
                    <Share2 size={16} className="me-2" /> WhatsApp
                  </button>
                  <button
                    className="btn btn-info d-flex align-items-center justify-content-center"
                    onClick={() => { compartirPorEmail(expedienteParaCompartir); cerrarModalCompartir(); }}
                    title="Envío por correo"
                  >
                    <Mail size={16} className="me-2" /> Email
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cerrarModalCompartir}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NUEVO: Modal para capturar contacto faltante */}
      <ModalCapturarContacto
        show={mostrarModalContacto}
        onClose={() => {
          setMostrarModalContacto(false);
          setClienteParaActualizar(null);
          setTipoDatoFaltante(null);
          setCanalEnvio(null);
          setExpedienteEnEspera(null);
        }}
        onGuardar={handleGuardarContactoFaltante}
        onGuardarYContinuar={() => {
          // Después de guardar, reintentar el envío conservando estado necesario
          if (expedienteEnEspera && canalEnvio) {
            const loadingId = toast.loading(`Abriendo ${canalEnvio}…`);
            setTimeout(() => {
              console.log('🔄 Reintentando envío por', canalEnvio);
              if (canalEnvio === 'WhatsApp') {
                compartirPorWhatsApp(expedienteEnEspera);
              } else if (canalEnvio === 'Email') {
                compartirPorEmail(expedienteEnEspera);
              }
              // Limpieza diferida tras el reintento
              setTimeout(() => {
                toast.dismiss(loadingId);
                setCanalEnvio(null);
                setExpedienteEnEspera(null);
              }, 300);
            }, 500);
          }
        }}
        cliente={clienteParaActualizar}
        tipoDatoFaltante={tipoDatoFaltante}
        canalEnvio={canalEnvio}
      />

      <ModalCancelacion 
        mostrarModalCancelacion={mostrarModalCancelacion}
        setMostrarModalCancelacion={setMostrarModalCancelacion}
        expedienteACancelar={expedienteACancelar}
        motivoCancelacion={motivoCancelacion}
        setMotivoCancelacion={setMotivoCancelacion}
        motivosCancelacion={motivosCancelacion}
        confirmarCancelacion={confirmarCancelacion}
      />

      {/* Modal Aplicar Pago con Comprobante */}
      {mostrarModalPago && expedienteParaPago && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <DollarSign size={20} className="me-2" />
                  Aplicar Pago
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                  }}
                  disabled={procesandoPago}
                ></button>
              </div>
              
              <div className="modal-body">
                {/* Información del expediente */}
                <div className="alert alert-info mb-3">
                  <h6 className="mb-2">
                    <strong>Póliza:</strong> {expedienteParaPago.numero_poliza || 'Sin número'}
                  </h6>
                  <div className="small">
                    <div><strong>Cliente:</strong> {expedienteParaPago.cliente_nombre || 'Sin nombre'}</div>
                    <div><strong>Aseguradora:</strong> {expedienteParaPago.compania || 'N/A'}</div>
                    <div><strong>Producto:</strong> {expedienteParaPago.producto || 'N/A'}</div>
                    {expedienteParaPago.importe_total && (
                      <div className="mt-2">
                        <strong>Monto a pagar:</strong> <span className="badge bg-success">${parseFloat(expedienteParaPago.importe_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campo para subir comprobante */}
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <Upload size={16} className="me-2" />
                    Comprobante de Pago *
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      const archivo = e.target.files[0];
                      if (archivo) {
                        // Validar tamaño (máximo 10MB)
                        if (archivo.size > 10 * 1024 * 1024) {
                          toast.error('El archivo no debe superar 10MB');
                          e.target.value = '';
                          return;
                        }
                        setComprobantePago(archivo);
                      }
                    }}
                    disabled={procesandoPago}
                  />
                  <small className="text-muted d-block mt-1">
                    Formatos permitidos: PDF, JPG, PNG, WEBP (máximo 10MB)
                  </small>
                  
                  {comprobantePago && (
                    <div className="alert alert-success mt-2 mb-0 d-flex align-items-center justify-content-between">
                      <div>
                        <CheckCircle size={16} className="me-2" />
                        <strong>{comprobantePago.name}</strong>
                        <small className="d-block ms-4 text-muted">
                          {(comprobantePago.size / 1024).toFixed(2)} KB
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setComprobantePago(null)}
                        disabled={procesandoPago}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Información adicional */}
                <div className="alert alert-warning mb-0">
                  <small>
                    <AlertCircle size={14} className="me-1" />
                    <strong>Importante:</strong> El comprobante de pago se guardará en el expediente 
                    y se agregará un comentario automático en el historial.
                  </small>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                  }}
                  disabled={procesandoPago}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={procesarPagoConComprobante}
                  disabled={!comprobantePago || procesandoPago}
                >
                  {procesandoPago ? (
                    <>
                      <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="me-2" />
                      Confirmar Pago
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuloExpedientes;

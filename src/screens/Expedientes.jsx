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
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X, XCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Save, Upload, CheckCircle, Loader, Share2, Mail, Bell, Clock, RefreshCw, Calendar } from 'lucide-react';
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
import { registrarNotificacion, TIPOS_NOTIFICACION, TIPOS_MENSAJE } from '../services/notificacionesService';
import TimelineExpediente from '../components/TimelineExpediente';

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

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

// ============= VARIABLES GLOBALES PARA SNAPSHOT =============
// Flag global para indicar que se debe capturar un snapshot del formulario
// Se usa para capturar el estado completo después de extraer PDF + cargar BD + calcular automáticos
let globalSnapshotPendiente = false;

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
        'Pendiente de pago': 'bg-warning',
        'En Vigencia': 'bg-success',
        'Vencida': 'bg-danger'
      },
      pago: {
        'Pagado': 'bg-success',
        'Vencido': 'bg-danger',
        'Por Vencer': 'bg-warning',
        'Pendiente': 'bg-info',
        'Cancelado': 'bg-dark',
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
        <div><small className="text-muted">{emailMostrar}</small></div>
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
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <small className="fw-semibold text-primary">{expediente.tipo_pago || 'Sin definir'}</small>
    {expediente.frecuenciaPago && (
      <div><small className="text-muted">{expediente.frecuenciaPago}</small></div>
    )}
    <div className="mt-1">
      <Badge tipo="pago" valor={expediente.estatusPago || 'Sin definir'} className="badge-sm" />
    </div>
  </div>
));

const CalendarioPagos = React.memo(({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false,
  onEnviarAviso, // Callback para enviar avisos de pago
  historial = [] // Historial de eventos para encontrar comprobantes
}) => {
  // Normalizar campos (aceptar múltiples nombres)
  const tipoPago = expediente.tipo_pago || expediente.forma_pago;
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  
  // Validar que tenga los datos mínimos necesarios
  if (!expediente.inicio_vigencia) {
    return null;
  }
  
  // Determinar si es Anual o Fraccionado
  const esAnual = tipoPago?.toUpperCase() === 'ANUAL' || tipoPago?.toUpperCase() === 'CONTADO';
  const esFraccionado = tipoPago?.toUpperCase() === 'FRACCIONADO';
  
  // Si no es ninguno de los dos, no mostrar
  if (!esAnual && !esFraccionado) {
    return null;
  }
  
  // Para fraccionado, validar que tenga frecuencia
  if (esFraccionado && !frecuencia) {
    return null;
  }

  // Determinar número de pagos: 1 para Anual, según frecuencia para Fraccionado
  const numeroPagos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
  const pagos = [];
  
  // 🔧 Obtener periodo de gracia del expediente o calcular según compañía (convertir a número)
  const periodoGracia = expediente.periodo_gracia 
    ? parseInt(expediente.periodo_gracia, 10)
    : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  console.log('📅 CALENDARIO - Periodo de gracia usado:', periodoGracia, '| Del expediente:', expediente.periodo_gracia, '| Tipo:', typeof expediente.periodo_gracia);
  
  // Determinar montos: usar primer_pago y pagos_subsecuentes si están disponibles, sino dividir el total
  // 🔥 Compatibilidad con snake_case y camelCase
  const primerPagoField = expediente.primer_pago || expediente.primerPago;
  const pagosSubsecuentesField = expediente.pagos_subsecuentes || expediente.pagosSubsecuentes;
  
  const usarMontosExactos = primerPagoField && pagosSubsecuentesField;
  const primerPagoMonto = usarMontosExactos ? parseFloat(primerPagoField) : null;
  const pagosSubsecuentesMonto = usarMontosExactos ? parseFloat(pagosSubsecuentesField) : null;
  const montoPorDefecto = expediente.total ? (parseFloat(expediente.total) / numeroPagos).toFixed(2) : '---';
  
  for (let i = 1; i <= numeroPagos; i++) {
    const fechaPago = calcularProximoPago(
      expediente.inicio_vigencia,
      tipoPago,
      frecuencia,
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

  const fechaUltimoPago = expediente.fechaUltimoPago || expediente.fecha_ultimo_pago
    ? new Date(expediente.fechaUltimoPago || expediente.fecha_ultimo_pago)
    : null;
  let totalPagado = 0;
  let totalPendiente = 0;
  let totalPorVencer = 0;
  let totalVencido = 0;
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
      // Clasificar según estado
      if (diasRestantes < 0) {
        totalVencido += parseFloat(pago.monto) || 0;
      } else if (diasRestantes <= 15) {
        totalPorVencer += parseFloat(pago.monto) || 0;
      } else {
        totalPendiente += parseFloat(pago.monto) || 0;
      }
    }
    
    let estado = 'Pendiente';
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
    } else if (diasRestantes <= 15) {
      // Por vencer: cuando faltan 15 días o menos
      estado = diasRestantes <= 7 ? `Vence en ${diasRestantes} días` : 'Por vencer';
      badgeClass = 'bg-warning';
    } else {
      // Pendiente: cuando falta más de 15 días
      estado = 'Pendiente';
      badgeClass = 'bg-secondary';
    }
    
    return { ...pago, estado, badgeClass, pagado, totalPagos: numeroPagos };
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
          📅 Calendario de Pagos - {esAnual ? 'Anual' : frecuencia}
          <small className="ms-2">({numeroPagos} {numeroPagos === 1 ? 'pago' : 'pagos'} en el año)</small>
        </h6>
      </div>
      <div className="card-body p-3">
        {mostrarResumen && (
          <div className="row mb-3 g-2">
            {/* Total Anual */}
            <div className="col">
              <div className="card bg-light h-100">
                <div className="card-body text-center p-2">
                  <small className="text-muted d-block mb-1">Total Anual</small>
                  <h5 className="mb-0 text-primary">{utils.formatearMoneda(expediente.total)}</h5>
                </div>
              </div>
            </div>
            
            {/* Pagado */}
            <div className="col">
              <div className="card bg-success text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">✅ Pagado</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPagado)}</h5>
                  <small className="d-block mt-1">{pagosRealizados} de {numeroPagos}</small>
                </div>
              </div>
            </div>
            
            {/* Por Vencer */}
            <div className="col">
              <div className="card bg-warning text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">⚠️ Por Vencer</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPorVencer)}</h5>
                  <small className="d-block mt-1">≤ 15 días</small>
                </div>
              </div>
            </div>
            
            {/* Vencido */}
            <div className="col">
              <div className="card bg-danger text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">❌ Vencido</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalVencido)}</h5>
                  <small className="d-block mt-1">Atrasado</small>
                </div>
              </div>
            </div>
            
            {/* Pendiente */}
            <div className="col">
              <div className="card bg-secondary text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">📅 Pendiente</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPendiente)}</h5>
                  <small className="d-block mt-1">Sin riesgo</small>
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
                <th width="200">Acciones</th>
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
                  <td>
                    {pago.pagado ? (
                      // Botón para ver comprobante de pago
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => {
                          // Normalizar fechas para comparación (solo YYYY-MM-DD)
                          const normalizarFecha = (fecha) => {
                            if (!fecha) return null;
                            const d = new Date(fecha);
                            return d.toISOString().split('T')[0]; // Solo YYYY-MM-DD
                          };
                          
                          const fechaBuscada = normalizarFecha(pago.fecha);
                          console.log('🔍 Buscando comprobante para fecha:', fechaBuscada);
                          console.log('📋 Historial disponible:', historial?.length || 0, 'eventos');
                          
                          // Buscar en el historial el evento de pago correspondiente
                          const eventoPago = historial.find(evento => {
                            const fechaEvento = normalizarFecha(evento.datos_adicionales?.fecha_pago);
                            const coincide = evento.tipo_evento === 'pago_registrado' &&
                              fechaEvento === fechaBuscada &&
                              evento.datos_adicionales?.comprobante_url;
                            
                            if (coincide) {
                              console.log('✅ Comprobante encontrado:', evento.datos_adicionales.comprobante_url);
                            }
                            return coincide;
                          });
                          
                          if (eventoPago?.datos_adicionales?.comprobante_url) {
                            // Abrir comprobante en nueva pestaña
                            window.open(eventoPago.datos_adicionales.comprobante_url, '_blank');
                          } else {
                            console.warn('❌ No se encontró comprobante. Eventos de pago:', 
                              historial.filter(e => e.tipo_evento === 'pago_registrado').map(e => ({
                                fecha: e.datos_adicionales?.fecha_pago,
                                tiene_url: !!e.datos_adicionales?.comprobante_url
                              }))
                            );
                            alert('No se encontró el comprobante de pago para esta fecha');
                          }
                        }}
                        title="Ver comprobante de pago"
                      >
                        <FileText size={14} className="me-1" />
                        Ver Comprobante
                      </button>
                    ) : (
                      // Botón para enviar aviso/recordatorio
                      <button 
                        className={`btn btn-sm ${pago.estado === 'Vencido' ? 'btn-danger' : 'btn-outline-info'}`}
                        onClick={() => onEnviarAviso && onEnviarAviso(pago, expediente)}
                        title={pago.estado === 'Vencido' ? 'Enviar recordatorio de pago vencido' : 'Enviar aviso de pago'}
                      >
                        <Mail size={14} className="me-1" />
                        {pago.estado === 'Vencido' ? 'Recordatorio' : 'Enviar Aviso'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {expediente.total && (
              <tfoot>
                <tr className="table-info">
                  <td colSpan="3" className="text-end"><strong>Total Anual:</strong></td>
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
  const [estado, setEstado] = useState('seleccionando-metodo'); // seleccionando-metodo, esperando, procesando, validando-cliente, validando-agente, preview-datos, error, capturando-rfc
  const [metodoExtraccion, setMetodoExtraccion] = useState(null); // 'auto' o 'openai'
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [informacionArchivo, setInformacionArchivo] = useState(null);
  
  // Estados para el flujo paso a paso
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [agenteEncontrado, setAgenteEncontrado] = useState(null);
  const [claveYaExiste, setClaveYaExiste] = useState(false); // true si el agente ya tiene esta clave+aseguradora
  const [decisionCliente, setDecisionCliente] = useState(null); // 'usar-existente', 'crear-nuevo'
  const [decisionAgente, setDecisionAgente] = useState(null); // 'usar-existente', 'crear-nuevo', 'omitir'
  
  // Estados para captura de RFC
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');
  
  // Ref para el input file
  const fileInputRef = useRef(null);
  const yaAbriSelectorRef = useRef(false); // Bandera para evitar abrir selector múltiples veces
  
  // Si hay un archivo pre-seleccionado, procesarlo inmediatamente
  useEffect(() => {
    // Verificar si ya hay un archivo seleccionado desde el modal anterior
    if (window._selectedPDFFile && window._autoExtractorMode) {
      const file = window._selectedPDFFile;
      delete window._selectedPDFFile; // Limpiar
      delete window._autoExtractorMode; // Limpiar flag
      
      // Configurar método automático y procesar directamente
      setMetodoExtraccion('auto');
      setArchivo(file);
      setInformacionArchivo({
        nombre: file.name,
        tamaño: `${(file.size / 1024).toFixed(2)} KB`,
        tipo: file.type,
        fechaModificacion: new Date(file.lastModified).toLocaleDateString('es-MX')
      });
      // Procesar inmediatamente sin esperar
      setEstado('procesando');
      setTimeout(() => procesarPDF(file), 100);
    }
  }, []);
  
  // Abrir selector automáticamente solo cuando se haya elegido el método manualmente
  useEffect(() => {
    // Solo abrir selector si ya se eligió método y no se ha abierto antes
    if (metodoExtraccion && !yaAbriSelectorRef.current && estado === 'esperando') {
      yaAbriSelectorRef.current = true;
      
      if (fileInputRef.current) {
        // Abrir selector de archivo
        const timer = setTimeout(() => {
          fileInputRef.current?.click();
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [metodoExtraccion, estado]);

  const procesarPDF = useCallback(async (file) => {
    setEstado('procesando');
    setErrores([]);

    try {
      // Extraer texto del PDF usando PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log('📄 Total de páginas:', pdf.numPages);
      
      if (pdf.numPages < 1) {
        throw new Error('El PDF debe tener al menos 1 página');
      }
      
      // ==================== EXTRAER TODAS LAS PÁGINAS ====================
      const todasLasPaginas = [];
      let textoPagina1 = '';
      let textoAvisoDeCobro = '';
      let textoPaginaCaratula = '';
      
      for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
        const page = await pdf.getPage(numPagina);
        const textContent = await page.getTextContent();
        
        const lineas = {};
        textContent.items.forEach(item => {
          const y = Math.round(item.transform[5]);
          if (!lineas[y]) lineas[y] = [];
          lineas[y].push({
            text: item.str,
            x: item.transform[4]
          });
        });
        
        const textoPagina = Object.keys(lineas)
          .sort((a, b) => b - a)
          .map(y => {
            return lineas[y]
              .sort((a, b) => a.x - b.x)
              .map(item => item.text)
              .join(' ');
          })
          .join('\n');
        
        todasLasPaginas.push({
          numero: numPagina,
          texto: textoPagina
        });
        
        // Guardar página 1 para detección de aseguradora
        if (numPagina === 1) {
          textoPagina1 = textoPagina;
        }
        
        // Buscar página con "AVISO DE COBRO" o "Prima Neta"
        if (textoPagina.match(/AVISO\s+DE\s+COBRO|Prima\s+Neta|PRIMA\s+NETA/i)) {
          textoAvisoDeCobro = textoPagina;
        }
        
        // Buscar página con "CARÁTULA" o datos del vehículo
        if (textoPagina.match(/CARÁTULA|CAR[AÁ]TULA|Descripción\s+del\s+vehículo|DESCRIPCI[ÓO]N\s+DEL\s+VEH[ÍI]CULO/i)) {
          textoPaginaCaratula = textoPagina;
        }
      }
      
      // Si no encontramos aviso de cobro, usar página 2 como fallback
      if (!textoAvisoDeCobro && todasLasPaginas.length >= 2) {
        textoAvisoDeCobro = todasLasPaginas[1].texto;
      }
      
      // Si no encontramos carátula, usar página 2 como fallback
      if (!textoPaginaCaratula && todasLasPaginas.length >= 2) {
        textoPaginaCaratula = todasLasPaginas[1].texto;
      }
      
      // Crear textoCompleto con todas las páginas
      const textoCompleto = todasLasPaginas.map(p => p.texto).join('\n\n');
      
      // Buscar cliente por RFC, CURP o nombre en la base de datos
      const buscarClienteExistente = async (rfc, curp, nombre, apellidoPaterno, apellidoMaterno) => {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          if (!response.ok) {
            console.error('❌ Error al obtener clientes:', response.status);
            return null;
          }
          
          const clientes = await response.json();
          
          // 1. PRIORIDAD 1: Buscar por RFC (más confiable)
          if (rfc && rfc.trim() !== '') {
            const rfcBusqueda = rfc.trim().toUpperCase();
            const clientePorRFC = clientes.find(c => {
              const rfcCliente = (c.rfc || '').trim().toUpperCase();
              return rfcCliente === rfcBusqueda;
            });
            
            if (clientePorRFC) return clientePorRFC;
          }
          
          // 2. PRIORIDAD 2: Buscar por CURP (si no hay RFC)
          if (curp && curp.trim() !== '') {
            const curpBusqueda = curp.trim().toUpperCase();
            const clientePorCURP = clientes.find(c => {
              const curpCliente = (c.curp || '').trim().toUpperCase();
              return curpCliente === curpBusqueda;
            });
            
            if (clientePorCURP) return clientePorCURP;
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
            
            if (clientePorNombre) return clientePorNombre;
          }
          
          return null;
        } catch (error) {
          console.error('❌ Error buscando cliente:', error);
          return null;
        }
      };

      // ==================== SISTEMA AUTOMÁTICO DE EXTRACCIÓN ====================
      let datosExtraidos = {};
      
      try {
        // Usar el sistema automático (regex)
        console.log('⚙️ Usando extractor automático...');
        const { detectarAseguradoraYProducto } = await import('../lib/pdf/detectorLigero.js');
        const { loadExtractor } = await import('../lib/pdf/extractors/registry.js');
        
        const deteccion = detectarAseguradoraYProducto(textoPagina1);
        const moduloExtractor = await loadExtractor(deteccion.aseguradora, deteccion.producto);
        
        if (moduloExtractor && moduloExtractor.extraer) {
          datosExtraidos = await moduloExtractor.extraer({
            textoCompleto,
            textoPagina1,
            textoPagina2: textoPaginaCaratula,
            textoAvisoDeCobro,
            todasLasPaginas
          });
        } else {
          console.error('❌ No se encontró extractor para:', deteccion);
          setEstado('error');
          setErrores([{
            tipo: 'error',
            mensaje: `No hay extractor disponible para ${deteccion.aseguradora} - ${deteccion.producto}`,
            detalle: 'Esta aseguradora aún no está soportada. Disponibles: Qualitas, Chubb.'
          }]);
          return;
        }
      } catch (error) {
        console.error('❌ Error en sistema de extracción:', error);
        setEstado('error');
        setErrores([{
          tipo: 'error',
          mensaje: 'Error al procesar el PDF',
          detalle: error.message
        }]);
        return;
      }

      // Limpiar montos (quitar comas) y asegurar defaults "0.00" si faltan
      const camposMontos = [
        'prima_pagada',
        'otros_descuentos',
        'cargo_pago_fraccionado',
        'gastos_expedicion',
        'iva',
        'total',
        'suma_asegurada'
      ];
      camposMontos.forEach(campo => {
        if (datosExtraidos[campo] !== undefined && datosExtraidos[campo] !== null && datosExtraidos[campo] !== '') {
          datosExtraidos[campo] = String(datosExtraidos[campo]).replace(/,/g, '');
        } else {
          datosExtraidos[campo] = '0.00';
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
          }
        }

        // Adjuntar resultados al objeto
        resultado.alertas_financieras = alertas_financieras;
        resultado.validacion_pagos = validacion_pagos;
      } catch (e) {
        console.warn('⚠️ Error durante validación de pagos fraccionados:', e);
      }

      console.log('📋 ========== DATOS EXTRAÍDOS COMPLETOS ==========');
      console.log('👤 CLIENTE:', {
        tipo_persona: resultado.tipo_persona,
        nombre: resultado.nombre,
        apellido_paterno: resultado.apellido_paterno,
        apellido_materno: resultado.apellido_materno,
        razonSocial: resultado.razonSocial,
        rfc: resultado.rfc,
        rfcLength: resultado.rfc?.length,
        curp: resultado.curp
      });
      console.log('📍 DIRECCIÓN:', {
        domicilio: resultado.domicilio,
        municipio: resultado.municipio,
        estado: resultado.estado,
        codigo_postal: resultado.codigo_postal
      });
      console.log('📞 CONTACTO:', {
        email: resultado.email,
        telefono_movil: resultado.telefono_movil,
        telefono_fijo: resultado.telefono_fijo
      });
      console.log('📄 PÓLIZA:', {
        numero_poliza: resultado.numero_poliza,
        compania: resultado.compania,
        producto: resultado.producto,
        tipo_cobertura: resultado.tipo_cobertura
      });
      console.log('📅 FECHAS:', {
        fecha_emision: resultado.fecha_emision,
        fecha_captura: resultado.fecha_captura,
        inicio_vigencia: resultado.inicio_vigencia,
        termino_vigencia: resultado.termino_vigencia
      });
      console.log('💰 MONTOS:', {
        prima_pagada: resultado.prima_pagada,
        gastos_expedicion: resultado.gastos_expedicion,
        cargo_pago_fraccionado: resultado.cargo_pago_fraccionado,
        iva: resultado.iva,
        total: resultado.total,
        primer_pago: resultado.primer_pago,
        pagos_subsecuentes: resultado.pagos_subsecuentes
      });
      console.log('🚗 VEHÍCULO:', {
        marca: resultado.marca,
        modelo: resultado.modelo,
        anio: resultado.anio,
        placas: resultado.placas,
        serie: resultado.serie,
        vin: resultado.vin
      });
      console.log('👨‍💼 AGENTE:', {
        clave_agente: resultado.clave_agente,
        agente: resultado.agente
      });
      console.log('================================================');

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
      
      // Buscar agente en el equipo de trabajo (búsqueda preliminar)
      let agenteEncontradoEnBD = null;
      let claveYaExisteEnBD = false;
      
      if (datosExtraidos.clave_agente && datosExtraidos.agente && agentes.length > 0) {
        // Buscar por nombre completo
        const nombreExtraido = datosExtraidos.agente.trim().toUpperCase();
        agenteEncontradoEnBD = agentes.find(miembro => {
          if (miembro.perfil !== 'Agente' || !miembro.activo) return false;
          
          const nombreBD = (miembro.nombre || '').trim().toUpperCase();
          const nombreCompleto = `${miembro.nombre || ''} ${miembro.apellidoPaterno || miembro.apellido_paterno || ''} ${miembro.apellidoMaterno || miembro.apellido_materno || ''}`.trim().toUpperCase();
          
          return nombreBD === nombreExtraido || nombreCompleto === nombreExtraido;
        });
        
        // Si encontramos el agente, verificar si ya tiene esta clave
        if (agenteEncontradoEnBD) {
          try {
            const { obtenerEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
            const asignacionesResult = await obtenerEjecutivosPorProducto(agenteEncontradoEnBD.id);
            
            if (asignacionesResult.success && asignacionesResult.data) {
              // Buscar si ya tiene esta clave
              claveYaExisteEnBD = asignacionesResult.data.some(asig => 
                String(asig.clave) === String(datosExtraidos.clave_agente)
              );
              
              console.log(`🔍 Agente: ${agenteEncontradoEnBD.nombre} | Clave ${datosExtraidos.clave_agente}: ${claveYaExisteEnBD ? 'YA EXISTE' : 'NUEVA'}`);
            }
          } catch (error) {
            console.error('Error al verificar claves del agente:', error);
          }
        }
      }
      
      setAgenteEncontrado(agenteEncontradoEnBD);
      setClaveYaExiste(claveYaExisteEnBD);
      
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
  }, [metodoExtraccion]); // Agregar metodoExtraccion como dependencia

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
    } else if (!file) {
      // Usuario canceló la selección del archivo, cerrar el modal
      console.log('⚠️ Usuario canceló la selección de archivo');
      onClose();
    } else {
      setErrores(['❌ Por favor, seleccione un archivo PDF válido']);
      setEstado('error');
    }
  }, [procesarPDF, onClose]);

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
      
      // ✅ VALIDAR DATOS DE CONTACTO PRINCIPAL
      const tieneNombre = datosExtraidos.tipo_persona === 'Moral' 
        ? (datosExtraidos.razonSocial && datosExtraidos.razonSocial.trim() !== '')
        : (datosExtraidos.nombre && datosExtraidos.nombre.trim() !== '');
      
      const tieneRFC = datosExtraidos.rfc && datosExtraidos.rfc.trim() !== '';
      
      if (!tieneNombre || !tieneRFC) {
        setErrores(['❌ Faltan datos principales del cliente. Se requiere al menos: ' + 
          (datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social' : 'Nombre') + 
          ' y RFC para crear el cliente.']);
        setEstado('error');
        return;
      }
      
      // Si hay RFC y nombre, continuar con la creación normal
      console.log('🔄 Creando nuevo cliente...');
      
      // Usar tipo de persona ya detectado en la extracción
      const tipoPersonaDetectado = datosExtraidos.tipo_persona === 'Moral' ? 'Persona Moral' : 'Persona Física';
      
      // Preparar datos según tipo de persona (SIN email ni teléfono)
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
          activo: true
        };
      }
      
      console.log(`📋 Creando cliente (${tipoPersonaDetectado}) | RFC: ${datosExtraidos.rfc} | ${tipoPersonaDetectado === 'Persona Moral' ? nuevoCliente.razonSocial : nuevoCliente.nombre}`);
      
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
    console.log('🎯 handleDecisionAgente:', decision);
    setDecisionAgente(decision);
    
    if (decision === 'usar-existente') {
      console.log(`✅ Usando agente: ${agenteEncontrado?.nombre} | Clave ${datosExtraidos.clave_agente}: ${claveYaExiste ? 'existente' : 'nueva'}`);
      
      // Si la clave NO existe, agregarla
      if (!claveYaExiste && datosExtraidos.clave_agente && agenteEncontrado) {
        
        try {
          // Identificar aseguradora
          const companiaExtraida = datosExtraidos.compania;
          let aseguradoraId = null;
          
          if (companiaExtraida && aseguradoras.length > 0) {
            const normalizarNombre = (nombre) => {
              return nombre
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/\s+/g, ' ')
                .replace(/^(EL|LA|LOS|LAS)\s+/i, '')
                .replace(/\s+(SEGUROS|SEGURO|S\.A\.|SA|DE\s+CV)$/i, '')
                .trim();
            };
            
            const companiaExtraidaNormalizada = normalizarNombre(companiaExtraida);
            let mejorScore = 0;
            let aseguradoraMatch = null;
            
            for (const aseg of aseguradoras) {
              if (!aseg.nombre) continue;
              const nombreAsegNormalizado = normalizarNombre(aseg.nombre);
              let score = 0;
              
              if (nombreAsegNormalizado === companiaExtraidaNormalizada) {
                score = 100;
              } else if (nombreAsegNormalizado.includes(companiaExtraidaNormalizada) || 
                         companiaExtraidaNormalizada.includes(nombreAsegNormalizado)) {
                score = 80;
              }
              
              if (score > mejorScore) {
                mejorScore = score;
                aseguradoraMatch = aseg;
              }
            }
            
            if (aseguradoraMatch && mejorScore >= 60) {
              aseguradoraId = aseguradoraMatch.id;
            }
          }
          
          // Buscar producto
          const productoExtraido = datosExtraidos.producto;
          let productoMatch = null;
          
          if (productoExtraido && tiposProductos.length > 0) {
            productoMatch = tiposProductos.find(prod =>
              prod.nombre && productoExtraido.toLowerCase().includes(prod.nombre.toLowerCase())
            );
            
            if (!productoMatch) {
              productoMatch = tiposProductos.find(prod =>
                prod.nombre && prod.nombre.toLowerCase().includes(productoExtraido.toLowerCase())
              );
            }
            
            if (!productoMatch && productoExtraido.toLowerCase().includes('auto')) {
              productoMatch = tiposProductos.find(prod => 
                prod.nombre && prod.nombre.toLowerCase().includes('auto')
              );
            }
          }
          
          // Vincular agente con nueva clave
          if (aseguradoraId && productoMatch) {
            const { guardarEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
            const asignacion = {
              usuarioId: agenteEncontrado.id,
              aseguradoraId: aseguradoraId,
              productoId: productoMatch.id,
              ejecutivoId: agenteEncontrado.id,
              clave: datosExtraidos.clave_agente,
              comisionPersonalizada: 0
            };
            
            const resultadoAsignacion = await guardarEjecutivosPorProducto(asignacion);
            
            if (resultadoAsignacion.success) {
              console.log('✅ Nueva clave agregada al agente');
              toast.success(`Clave ${datosExtraidos.clave_agente} agregada al agente ${agenteEncontrado.nombre}`);
            } else {
              console.error('❌ Error al agregar clave:', resultadoAsignacion.error);
              toast.error('No se pudo agregar la clave al agente');
            }
          } else {
            console.warn('⚠️ No se pudo vincular: falta aseguradoraId o producto');
          }
        } catch (error) {
          console.error('❌ Error al agregar clave:', error);
          toast.error('Error al agregar la clave al agente');
        }
      }
      
      // Continuar al preview
      setEstado('preview-datos');
    } else if (decision === 'crear-nuevo') {
      // Obtener clave y nombre ya separados desde el extractor
      const codigo = datosExtraidos.clave_agente; // La clave de la aseguradora (ej: 25576, 776024)
      const nombreCompleto = datosExtraidos.agente; // El nombre del agente sin la clave
      console.log('🔍 Nombre agente:', nombreCompleto);
      
      if (!codigo || !nombreCompleto) {
        console.error('❌ No se pudo extraer información del agente');
        toast('⚠️ No se pudo extraer la información del agente del PDF. Crea el agente manualmente en Equipo de Trabajo.');
        // Continuar sin crear el agente
        setEstado('preview-datos');
        return;
      }
      
      // Detectar si es persona moral (empresa)
      const palabrasEmpresa = ['ASOCIADOS', 'Y CIA', 'S.A.', 'SA DE CV', 'S DE RL', 'SC', 'AGTE DE SEGU', 'AGENTE DE SEGUROS', 'ASESORES', 'CONSULTORES', 'GRUPO', 'CORPORATIVO'];
      const esPersonaMoral = palabrasEmpresa.some(palabra => nombreCompleto.toUpperCase().includes(palabra));
      
      let nombre = '', apellidoPaterno = '', apellidoMaterno = '';
      
      if (esPersonaMoral) {
        // Persona Moral: Usar el nombre completo como "nombre" y dejar apellidos vacíos
        nombre = nombreCompleto;
        apellidoPaterno = '';
        apellidoMaterno = '';
      } else {
        // Persona Física: Dividir en nombre y apellidos
        const palabras = nombreCompleto.split(/\s+/);
        
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
      }
      
      try {
        // PRIMERO: Identificar la aseguradora antes de buscar al agente
        const companiaExtraida = datosExtraidos.compania;
        let aseguradoraId = null;
        
        if (companiaExtraida && aseguradoras.length > 0) {
          // Normalizar nombre de aseguradora
          const normalizarNombre = (nombre) => {
            return nombre
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/\s+/g, ' ')
              .replace(/^(EL|LA|LOS|LAS)\s+/i, '')
              .replace(/\s+(SEGUROS|SEGURO|S\.A\.|SA|DE\s+CV)$/i, '')
              .trim();
          };
          
          const companiaExtraidaNormalizada = normalizarNombre(companiaExtraida);
          
          // Buscar aseguradora con fuzzy matching
          let mejorScore = 0;
          let aseguradoraMatch = null;
          
          for (const aseg of aseguradoras) {
            if (!aseg.nombre) continue;
            const nombreAsegNormalizado = normalizarNombre(aseg.nombre);
            let score = 0;
            
            if (nombreAsegNormalizado === companiaExtraidaNormalizada) {
              score = 100;
            } else if (nombreAsegNormalizado.includes(companiaExtraidaNormalizada) || 
                       companiaExtraidaNormalizada.includes(nombreAsegNormalizado)) {
              score = 80;
            }
            
            if (score > mejorScore) {
              mejorScore = score;
              aseguradoraMatch = aseg;
            }
          }
          
          if (aseguradoraMatch && mejorScore >= 60) {
            aseguradoraId = aseguradoraMatch.id;
            console.log('🏢 Aseguradora identificada:', aseguradoraMatch.nombre, 'ID:', aseguradoraId);
          } else {
            console.warn('⚠️ No se pudo identificar la aseguradora:', companiaExtraida);
          }
        }
        
        // PASO 1: Buscar agente por ASEGURADORA + CLAVE (combinación única)
        const { obtenerEquipoDeTrabajo, obtenerEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
        const equipoResult = await obtenerEquipoDeTrabajo();
        
        console.log('📋 Equipo obtenido. Total miembros:', equipoResult.data?.length || 0);
        console.log('📋 Success:', equipoResult.success);
        if (equipoResult.data && equipoResult.data.length > 0) {
          console.log('📋 Primeros 3 miembros:', equipoResult.data.slice(0, 3).map(m => ({ 
            id: m.id, 
            nombre: m.nombre, 
            perfil: m.perfil,
            activo: m.activo,
            apellidoPaterno: m.apellidoPaterno || m.apellido_paterno
          })));
          
          // Buscar específicamente ALVARO
          const alvaro = equipoResult.data.find(m => m.nombre?.includes('ALVARO'));
          if (alvaro) {
            console.log('👤 ALVARO encontrado en BD:', {
              id: alvaro.id,
              nombre: alvaro.nombre,
              apellidoPaterno: alvaro.apellidoPaterno || alvaro.apellido_paterno,
              apellidoMaterno: alvaro.apellidoMaterno || alvaro.apellido_materno,
              perfil: alvaro.perfil,
              activo: alvaro.activo
            });
          } else {
            console.log('❌ ALVARO NO encontrado en el equipo');
          }
        }
        
        let agenteExistente = null;
        if (equipoResult.success && equipoResult.data && aseguradoraId) {
          console.log('🔎 Buscando por ASEGURADORA + CLAVE:', aseguradoraId, '+', codigo);
          // PASO 1A: Buscar por ASEGURADORA + CLAVE (la clave solo es única dentro de cada aseguradora)
          for (const miembro of equipoResult.data) {
            if (miembro.perfil !== 'Agente' || !miembro.activo) continue;
            
            const asignacionesResult = await obtenerEjecutivosPorProducto(miembro.id);
            if (asignacionesResult.success && asignacionesResult.data) {
              console.log(`  Revisando agente ${miembro.nombre}, asignaciones:`, asignacionesResult.data.length);
              // Buscar combinación: misma aseguradora Y misma clave
              const tieneAseguradoraYClave = asignacionesResult.data.some(asig => {
                const match = String(asig.aseguradoraId) === String(aseguradoraId) && 
                              String(asig.clave) === String(codigo);
                if (match) {
                  console.log('    ✅ MATCH! asegId:', asig.aseguradoraId, 'clave:', asig.clave);
                }
                return match;
              });
              
              if (tieneAseguradoraYClave) {
                agenteExistente = miembro;
                console.log('✅ Agente encontrado por ASEGURADORA + CLAVE:', aseguradoraId, '+', codigo, '→', miembro.nombre);
                break;
              }
            }
          }
        }
        
        // PASO 1B: Si no se encontró por aseguradora+clave, buscar por NOMBRE
        if (!agenteExistente && equipoResult.success && equipoResult.data) {
          console.log('🔎 No encontrado por aseg+clave. Buscando por NOMBRE:', `${nombre} ${apellidoPaterno} ${apellidoMaterno}`);
          agenteExistente = equipoResult.data.find(miembro => {
            if (miembro.perfil !== 'Agente' || !miembro.activo) return false;
            
            // Opción 1: Nombre compuesto desde campos separados (apellidoPaterno, apellidoMaterno)
            const nombreCompleto1 = `${miembro.nombre} ${miembro.apellidoPaterno || miembro.apellido_paterno || ''} ${miembro.apellidoMaterno || miembro.apellido_materno || ''}`.trim().toUpperCase();
            const nombreCompleto2 = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`.trim().toUpperCase();
            
            // Opción 2: Nombre completo todo en un solo campo (para agentes guardados con nombre completo)
            const nombreSoloCampo = (miembro.nombre || '').trim().toUpperCase();
            const nombreExtraido = nombreCompleto2;
            
            console.log(`  Comparando opción 1: "${nombreCompleto1}" === "${nombreCompleto2}"`, nombreCompleto1 === nombreCompleto2);
            console.log(`  Comparando opción 2: "${nombreSoloCampo}" === "${nombreExtraido}"`, nombreSoloCampo === nombreExtraido);
            
            return nombreCompleto1 === nombreCompleto2 || nombreSoloCampo === nombreExtraido;
          });
          
          if (agenteExistente) {
            console.log('✅ Agente encontrado por NOMBRE:', agenteExistente.nombre);
          } else {
            console.log('❌ No se encontró agente por nombre');
          }
        }
        
        let agenteId;
        let yaExisteAsignacion = false;
        
        if (agenteExistente) {
          agenteId = agenteExistente.id;
          console.log('✅ Agente ya existe en equipo:', agenteExistente.nombre, 'ID:', agenteId);
          
          // PASO 2: Verificar si YA TIENE esta combinación aseguradora+clave asignada
          const asignacionesResult = await obtenerEjecutivosPorProducto(agenteId);
          if (asignacionesResult.success && asignacionesResult.data) {
            if (aseguradoraId) {
              // Buscar si ya existe esta combinación específica
              yaExisteAsignacion = asignacionesResult.data.some(asig => 
                String(asig.aseguradoraId) === String(aseguradoraId) &&
                String(asig.clave) === String(codigo)
              );
              
              if (yaExisteAsignacion) {
                console.log('⚠️ El agente YA TIENE la clave', codigo, 'en esta aseguradora');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(true); // Marcar que la clave ya existe
                toast.info(`El agente ya tiene la clave ${codigo} registrada en esta aseguradora`);
              } else {
                console.log('ℹ️ Se agregará nueva clave', codigo, 'al agente existente para esta aseguradora');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(false); // Marcar que la clave NO existe
                toast.success(`Agente encontrado: ${esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`}`);
              }
            } else {
              // No se pudo identificar la aseguradora, buscar solo por clave
              console.log('⚠️ No se identificó aseguradora, buscando solo por clave');
              yaExisteAsignacion = asignacionesResult.data.some(asig => 
                String(asig.clave) === String(codigo)
              );
              
              if (yaExisteAsignacion) {
                console.log('⚠️ El agente YA TIENE la clave', codigo);
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(true);
                toast.info(`El agente ya tiene la clave ${codigo} registrada`);
              } else {
                console.log('ℹ️ Se agregará nueva clave', codigo, 'al agente existente');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(false);
                toast.success(`Agente encontrado: ${esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`}`);
              }
            }
          } else {
            // No se pudieron obtener las asignaciones, marcar como agente encontrado sin validar clave
            console.log('⚠️ No se pudieron obtener las asignaciones del agente');
            setAgenteEncontrado(agenteExistente);
            setClaveYaExiste(false);
          }
        } else {
          // El agente NO EXISTE - Crear nuevo
          // Generar código consecutivo para el equipo (AG001, AG002, etc.)
          const prefijo = 'AG';
          const agentesExistentes = equipoResult.data.filter(m => 
            m.perfil === 'Agente' && m.codigo && m.codigo.startsWith(prefijo)
          );
          
          let maxNumero = 0;
          for (const ag of agentesExistentes) {
            const num = parseInt(ag.codigo.replace(prefijo, ''), 10);
            if (!isNaN(num) && num > maxNumero) maxNumero = num;
          }
          
          const siguienteNumero = maxNumero + 1;
          const codigoConsecutivo = prefijo + String(siguienteNumero).padStart(3, '0'); // AG001, AG002, etc.
          
          const nuevoAgente = {
            codigo: codigoConsecutivo, // Código del equipo, NO la clave de aseguradora
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
            agenteId = resultado.data.id;
            setAgenteEncontrado(resultado.data);
            console.log('✅ Agente creado exitosamente:', resultado.data.nombre, 'ID:', resultado.data.id);
            const nombreMostrar = esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`;
            toast.success(`Agente creado: ${nombreMostrar}`);
            
            // RECARGAR LISTA DE AGENTES para que aparezca en el componente principal
            try {
              const { obtenerAgentesEquipo } = await import('../services/equipoDeTrabajoService');
              const resultadoAgentes = await obtenerAgentesEquipo();
              if (resultadoAgentes.success && window.recargarAgentes) {
                window.recargarAgentes(resultadoAgentes.data);
                console.log('✅ Lista de agentes recargada');
              }
            } catch (errorRecarga) {
              console.warn('⚠️ No se pudo recargar la lista de agentes:', errorRecarga);
            }
          } else {
            throw new Error(resultado.error);
          }
        }
        
        // VINCULAR AGENTE CON ASEGURADORA Y PRODUCTO
        const productoExtraido = datosExtraidos.producto;
        
        console.log('🔗 INICIO VINCULACIÓN:');
        console.log('   aseguradoraId:', aseguradoraId);
        console.log('   productoExtraido:', productoExtraido);
        console.log('   agenteId:', agenteId);
        console.log('   yaExisteAsignacion:', yaExisteAsignacion);
        
        if (aseguradoraId && productoExtraido && tiposProductos.length > 0) {
          // Ya tenemos la aseguradora identificada arriba
          console.log('🔗 Vinculando agente con aseguradora ID:', aseguradoraId);
          
          // Buscar producto
          let productoMatch = tiposProductos.find(prod =>
            prod.nombre && productoExtraido.toLowerCase().includes(prod.nombre.toLowerCase())
          );
          
          if (!productoMatch) {
            productoMatch = tiposProductos.find(prod =>
              prod.nombre && prod.nombre.toLowerCase().includes(productoExtraido.toLowerCase())
            );
          }
          
          if (!productoMatch && productoExtraido.toLowerCase().includes('auto')) {
            productoMatch = tiposProductos.find(prod => 
              prod.nombre && prod.nombre.toLowerCase().includes('auto')
            );
          }
          
          console.log('📦 Producto encontrado:', productoMatch ? productoMatch.nombre : 'NO ENCONTRADO');
          
          if (productoMatch) {
            console.log('✅ Verificando si ya existe asignación:', yaExisteAsignacion);
            // Verificar si ya existe esta asignación
            if (!yaExisteAsignacion) {
              console.log('💾 Guardando nueva asignación...');
              // Guardar la asociación agente-aseguradora-producto-clave
              try {
                const { guardarEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
                const asignacion = {
                  usuarioId: agenteId,
                  aseguradoraId: aseguradoraId,
                  productoId: productoMatch.id,
                  ejecutivoId: agenteId,
                  clave: codigo, // La clave específica para esta aseguradora
                  comisionPersonalizada: 0
                };
                
                
                const resultadoAsignacion = await guardarEjecutivosPorProducto(asignacion);
                
                if (resultadoAsignacion.success) {
                  console.log('✅ Agente vinculado con aseguradora - Clave:', codigo);
                } else {
                  console.warn('⚠️ No se pudo vincular agente con producto:', resultadoAsignacion.error);
                }
              } catch (errorAsignacion) {
                console.error('❌ Error al vincular agente:', errorAsignacion);
              }
            } else {
              console.log('ℹ️ El agente ya tiene asignada esta clave para esta aseguradora, se omite vinculación');
            }
          } else {
            console.warn('⚠️ No se encontró producto matching para:', productoExtraido);
          }
        } else {
          console.warn('⚠️ No se pudo vincular: falta aseguradoraId o productoExtraido');
        }
      } catch (error) {
        console.error('❌ Error al procesar agente:', error);
        const nombreMostrar = esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno} ${apellidoMaterno}`;
        toast(`⚠️ No se pudo crear el agente automáticamente. Agrega manualmente: Código ${codigo} - ${nombreMostrar}`);
        // Continuar sin el agente
      }
    }
    
    // Pasar al PASO 3: Preview de todos los datos
    setEstado('preview-datos');
  }, [datosExtraidos, aseguradoras, tiposProductos, agenteEncontrado, claveYaExiste]);

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
      // Normalización: Mapear forma_pago a tipo_pago y frecuenciaPago
      // El extractor de PDF debe proveer tipo_pago y frecuenciaPago correctos desde la Serie del aviso
      // Este código es un FALLBACK por si el extractor no los detectó
      
      if (!datosConCliente.tipo_pago || !datosConCliente.frecuenciaPago) {
        const fp = (datosConCliente.forma_pago || '').toLowerCase();
        
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
        
        if (datosConCliente.tipo_pago) {
          console.log('✅ Normalización aplicada:', {
            forma_pago: datosConCliente.forma_pago,
            tipo_pago: datosConCliente.tipo_pago,
            frecuenciaPago: datosConCliente.frecuenciaPago
          });
        } else {
          console.log('⚠️ No se pudo determinar tipo_pago desde forma_pago:', datosConCliente.forma_pago);
        }
      } else {
        console.log('✅ tipo_pago y frecuenciaPago ya vienen del extractor:', {
          tipo_pago: datosConCliente.tipo_pago,
          frecuenciaPago: datosConCliente.frecuenciaPago
        });
      }

      // ⚠️ NOTA: El calendario de pagos NO se genera aquí.
      // El formulario principal tiene funciones dedicadas que:
      //   1. Calculan fechas de pago con periodo de gracia (calcularProximoPago)
      //   2. Determinan estados (pagado, vencido, por vencer)
      //   3. Generan el calendario visual completo (CalendarioPagos component)
      // Solo pasamos los datos básicos: tipo_pago, frecuenciaPago, primer_pago, pagos_subsecuentes
      
      console.log('📋 Datos de pago para formulario:', {
        tipo_pago: datosConCliente.tipo_pago,
        frecuenciaPago: datosConCliente.frecuenciaPago,
        primer_pago: datosConCliente.primer_pago,
        pagos_subsecuentes: datosConCliente.pagos_subsecuentes
      });

      // Log financiero para verificar que todos los campos lleguen (aun en 0.00)
      console.log('📋 Desglose financiero (preview) - 6 campos en orden:');
      console.log('─────────────────────────────────────────────────');
      console.log('1. Prima Neta:                          $', datosConCliente.prima_pagada || '0.00');
      console.log('2. Otros Descuentos:                    $', datosConCliente.otros_descuentos || '0.00');
      console.log('3. Financiamiento por pago fraccionado: $', datosConCliente.cargo_pago_fraccionado || '0.00');
      console.log('4. Gastos de expedición:                $', datosConCliente.gastos_expedicion || '0.00');
      console.log('5. I.V.A.:                              $', datosConCliente.iva || '0.00');
      console.log('6. Total a pagar:                       $', datosConCliente.total || '0.00');
      console.log('─────────────────────────────────────────────────');

      // ================== CAMPOS ADICIONALES POLIZA (Uso/Servicio/Movimiento) ==================
      // Si existen y el formulario espera camelCase, mantenerlos así.
      if (datosConCliente.uso) datosConCliente.uso_poliza = datosConCliente.uso;
      if (datosConCliente.servicio) datosConCliente.servicio_poliza = datosConCliente.servicio;
      if (datosConCliente.movimiento) datosConCliente.movimiento_poliza = datosConCliente.movimiento;
      
      // ================== TIPO DE COBERTURA / PLAN ==================
      // Si viene "plan" del extractor (ej: INTEGRAL de Chubb), usarlo como tipo_cobertura
      if (datosConCliente.plan && !datosConCliente.tipo_cobertura) {
        // Normalizar el plan a formato title case para que coincida con el select
        const planNormalizado = datosConCliente.plan.charAt(0).toUpperCase() + datosConCliente.plan.slice(1).toLowerCase();
        datosConCliente.tipo_cobertura = planNormalizado;
        console.log('📋 Tipo de cobertura asignado desde plan:', planNormalizado);
      } else if (datosConCliente.tipo_cobertura) {
        // Normalizar tipo_cobertura si ya viene
        datosConCliente.tipo_cobertura = datosConCliente.tipo_cobertura.charAt(0).toUpperCase() + datosConCliente.tipo_cobertura.slice(1).toLowerCase();
      }
      
      // ================== FECHA LÍMITE DE PAGO ==================
      // Si el extractor trae fecha_limite_pago (como Chubb), usarla como fecha_vencimiento_pago
      if (datosConCliente.fecha_limite_pago) {
        datosConCliente.fecha_vencimiento_pago = datosConCliente.fecha_limite_pago;
        datosConCliente.fecha_pago = datosConCliente.fecha_limite_pago;
        console.log('📅 Fecha límite de pago extraída del PDF:', datosConCliente.fecha_limite_pago);
      }
      
      // ================== PERÍODO DE GRACIA ==================
      // Si no viene del PDF, usar valores sugeridos por aseguradora
      if (!datosConCliente.periodo_gracia) {
        const aseguradora = (datosConCliente.compania || '').toLowerCase();
        if (aseguradora.includes('qualitas')) {
          datosConCliente.periodo_gracia = 14; // Qualitas: 14 días
        } else if (aseguradora) {
          datosConCliente.periodo_gracia = 30; // Otras: 30 días
        }
        console.log('📆 Período de gracia sugerido:', datosConCliente.periodo_gracia, 'días');
      }
      
      // ================== ESTATUS DE PAGO INICIAL ==================
      // Calcular el estatus de pago basado en la fecha de vencimiento
      if (datosConCliente.fecha_vencimiento_pago) {
        const fechaVencimiento = new Date(datosConCliente.fecha_vencimiento_pago);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaVencimiento.setHours(0, 0, 0, 0);
        
        const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes < 0) {
          datosConCliente.estatusPago = 'Vencido';
        } else if (diasRestantes <= 15) {
          datosConCliente.estatusPago = 'Por Vencer';
        } else {
          datosConCliente.estatusPago = 'Pendiente';
        }
        console.log('💳 Estatus de pago calculado:', datosConCliente.estatusPago, '(días restantes:', diasRestantes, ')');
      } else {
        // Si no hay fecha de vencimiento, el pago está pendiente
        datosConCliente.estatusPago = 'Pendiente';
        console.log('💳 Estatus de pago por defecto: Pendiente (sin fecha de vencimiento)');
      }
      
      // ✨ Agregar bandera para identificar que fue capturado con extractor PDF
      datosConCliente._capturado_con_extractor_pdf = true;
      datosConCliente._nombre_archivo_pdf = archivo?.name || informacionArchivo?.nombre || 'PDF importado';
      
      // 🔍 Guardar "huella digital" de los datos originales del PDF para detectar cambios manuales
      datosConCliente._datos_originales_pdf = {
        numero_poliza: datosConCliente.numero_poliza,
        compania: datosConCliente.compania,
        producto: datosConCliente.producto,
        cliente_id: datosConCliente.cliente_id,
        prima_pagada: datosConCliente.prima_pagada,
        total: datosConCliente.total,
        fecha_emision: datosConCliente.fecha_emision,
        inicio_vigencia: datosConCliente.inicio_vigencia,
        termino_vigencia: datosConCliente.termino_vigencia,
        etapa_activa: datosConCliente.etapa_activa,
        tipo_pago: datosConCliente.tipo_pago,
        agente: datosConCliente.agente
      };
      
      console.log('📤 Aplicando datos completos al formulario:', datosConCliente);
      onDataExtracted(datosConCliente);
      onClose();
    }
  }, [datosExtraidos, clienteEncontrado, onDataExtracted, onClose, archivo, informacionArchivo]);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header py-2 px-3">
            <small className="modal-title mb-0 fw-semibold" style={{ fontSize: '0.85rem' }}>
              <FileText className="me-1" size={14} />
              Extractor Inteligente de Pólizas PDF
            </small>
            <button 
              type="button" 
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          
          {/* Input file oculto que se activa automáticamente */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          
          <div className="modal-body p-3" style={{ overflowY: 'auto', flex: 1 }}>
            {/* SELECCIÓN DE MÉTODO DE EXTRACCIÓN */}
            {estado === 'seleccionando-metodo' && (
              <div className="py-2">
                <div className="text-center mb-3">
                  <h6 className="mb-1">Extractor Automático de Pólizas</h6>
                  <p className="text-muted small mb-0" style={{ fontSize: '0.75rem' }}>
                    Extracción instantánea y gratuita por patrones de texto
                  </p>
                </div>
                
                <div className="row g-3 justify-content-center">
                  {/* ÚNICO Extractor Automático */}
                  <div className="col-md-8 col-lg-6">
                    <div 
                      className="card h-100 border-primary cursor-pointer shadow-sm" 
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setMetodoExtraccion('auto');
                        setEstado('esperando');
                      }}
                    >
                      <div className="card-body text-center p-4">
                        <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" 
                             style={{ width: '70px', height: '70px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                            <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                            <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                          </svg>
                        </div>
                        <h5 className="card-title mb-3">Continuar</h5>
                        <p className="card-text text-muted mb-4">
                          Extrae datos de pólizas de forma instantánea usando patrones específicos para cada aseguradora.
                        </p>
                        <div className="d-flex justify-content-center gap-2 flex-wrap mb-3">
                          <span className="badge bg-success">✓ Gratis</span>
                          <span className="badge bg-success">⚡ Instantáneo</span>
                          <span className="badge bg-success">🎯 Preciso</span>
                        </div>
                        <div className="text-muted mt-3" style={{ fontSize: '0.9rem' }}>
                          <strong>Aseguradoras disponibles:</strong><br/>
                          <small>Qualitas • Chubb</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mt-4">
                  <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            
            {estado === 'esperando' && (
              <div className="text-center py-5">
                <div className="mb-3">
                  <FileText size={48} className="text-muted" />
                </div>
                <p className="mb-2 fw-semibold">Esperando archivo PDF...</p>
                <small className="text-muted">
                  Método: Extractor Automático
                </small>
                <div className="mt-3">
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Seleccionar PDF
                  </button>
                </div>
              </div>
            )}
            
            {estado === 'procesando' && (
              <div className="text-center py-3">
                <div className="spinner-border text-primary mb-2" role="status" style={{ width: '2rem', height: '2rem' }}>
                  <span className="visually-hidden">Procesando...</span>
                </div>
                <p className="mb-1 fw-semibold">Procesando PDF...</p>
                <small className="text-muted">Extrayendo información de la póliza</small>
              </div>
            )}

            {/* PASO 1: VALIDACIÓN DE CLIENTE */}
            {estado === 'validando-cliente' && datosExtraidos && (
              <div className="py-1">
                <div className="text-center mb-2">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px', fontSize: '0.7rem' }}>
                    <strong>1/3</strong>
                  </div>
                  <small className="d-block mt-1 fw-semibold" style={{ fontSize: '0.75rem' }}>Validación de Cliente</small>
                </div>

                <div className="card mb-2">
                  <div className="card-header bg-light py-1 px-2">
                    <small className="mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>👤 Datos del Cliente Extraídos</small>
                  </div>
                  <div className="card-body p-2">
                    <div className="row g-1">
                      {/* COLUMNA IZQUIERDA: Nombre y RFC */}
                      <div className="col-md-6 col-12">
                        {/* Nombre/Razón Social */}
                        <div className="mb-1">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social/Empresa:' : 'Nombre Completo:'}
                          </small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.tipo_persona === 'Moral' 
                              ? (datosExtraidos.razonSocial || <span className="text-muted">No encontrado</span>)
                              : (`${datosExtraidos.nombre || ''} ${datosExtraidos.apellido_paterno || ''} ${datosExtraidos.apellido_materno || ''}`.trim() || <span className="text-muted">No encontrado</span>)
                            }
                          </small>
                        </div>
                        
                        {/* RFC */}
                        <div>
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>RFC:</small>
                          {datosExtraidos.rfc ? (
                            <small className="mb-0" style={{ fontSize: '0.7rem' }}>{datosExtraidos.rfc}</small>
                          ) : (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.6rem' }}>
                              <i className="bi bi-exclamation-triangle me-1"></i>No encontrado
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUMNA DERECHA: Dirección y Ciudad/Estado */}
                      <div className="col-md-6 col-12">
                        {/* Dirección */}
                        <div className="mb-1">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Dirección:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.domicilio || <span className="text-muted">No encontrada</span>}
                          </small>
                        </div>
                        
                        {/* Ciudad/Estado */}
                        <div>
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Ciudad/Estado:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {(datosExtraidos.municipio || datosExtraidos.estado) 
                              ? [datosExtraidos.municipio, datosExtraidos.estado].filter(Boolean).join(', ')
                              : <span className="text-muted">No encontrado</span>
                            }
                          </small>
                        </div>
                      </div>
                      
                      {/* Email - SOLO si cliente existe en BD */}
                      {clienteEncontrado && datosExtraidos.email && (
                        <div className="col-md-6 col-12">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Email:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>{datosExtraidos.email}</small>
                        </div>
                      )}
                      
                      {/* Teléfono - SOLO si cliente existe en BD */}
                      {clienteEncontrado && datosExtraidos.telefono_movil && (
                        <div className="col-md-3">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>Teléfono:</small>
                          <small className="mb-0" style={{ fontSize: '0.75rem' }}>{datosExtraidos.telefono_movil}</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {clienteEncontrado ? (
                  <div className="alert alert-success py-1 px-2 mb-2">
                    <div className="d-flex align-items-center">
                      <CheckCircle className="me-2" size={16} />
                      <small className="mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>✅ Cliente ENCONTRADO en base de datos</small>
                    </div>
                    
                    <div className="card border-success mt-1">
                      <div className="card-body p-2">
                        <div className="row g-1">
                          {/* FILA 1: ID Cliente, Fecha Registro, Nombre Completo */}
                          <div className="col-md-2 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>ID</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.codigo || clienteEncontrado.id}</small>
                          </div>
                          
                          <div className="col-md-2 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Registro</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.created_at ? new Date(clienteEncontrado.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}</small>
                          </div>

                          <div className="col-md-4 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                              {clienteEncontrado.tipoPersona === 'Persona Moral' 
                                ? (clienteEncontrado.razonSocial || clienteEncontrado.nombre || 'N/A')
                                : `${clienteEncontrado.nombre || ''} ${clienteEncontrado.apellido_paterno || clienteEncontrado.apellidoPaterno || ''}`.trim()
                              }
                            </small>
                          </div>

                          {/* RFC */}
                          {clienteEncontrado.rfc && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>RFC</small>
                              <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.rfc}</small>
                            </div>
                          )}
                          
                          {/* Email */}
                          {clienteEncontrado.email && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Email</small>
                              <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={clienteEncontrado.email}>{clienteEncontrado.email}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <hr className="my-1" />
                      <small className="mb-1 fw-semibold d-block" style={{ fontSize: '0.75rem' }}>¿Qué deseas hacer?</small>
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-success btn-sm flex-fill py-1"
                          onClick={() => handleDecisionCliente('usar-existente')}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <CheckCircle className="me-1" size={14} />
                          Usar Cliente Existente
                        </button>
                        <button 
                          className="btn btn-outline-primary btn-sm flex-fill py-1"
                          onClick={() => handleDecisionCliente('crear-nuevo')}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Crear Cliente Nuevo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-1 px-2">
                    <div className="d-flex align-items-center mb-1">
                      <AlertCircle className="me-2" size={18} />
                      <small className="fw-semibold" style={{ fontSize: '0.75rem' }}>⚠️ Cliente NO encontrado en base de datos</small>
                    </div>
                    <small className="mb-2 d-block" style={{ fontSize: '0.7rem' }}>Se creará un nuevo cliente con los datos extraídos del PDF.</small>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary btn-sm flex-fill py-1"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
                        style={{ fontSize: '0.75rem' }}
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
              <div className="py-2">
                <div className="text-center mb-2">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px', fontSize: '0.75rem' }}>
                    <strong>2/3</strong>
                  </div>
                  <h6 className="mt-2 mb-0" style={{ fontSize: '0.9rem' }}>Validación de Agente</h6>
                </div>

                {datosExtraidos.agente ? (
                  <div className="card mb-2">
                    <div className="card-header bg-light py-1 px-2">
                      <small className="mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>👔 Agente Extraído del PDF</small>
                    </div>
                    <div className="card-body p-2">
                      <div className="row g-1">
                        <div className="col-md-3 col-6">
                          <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Clave Agente</small>
                          <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.clave_agente || <span className="text-muted">No encontrado</span>}
                          </small>
                        </div>
                        <div className="col-md-9 col-6">
                          <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre del Agente</small>
                          <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.agente}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info mb-2 py-1 px-2">
                    <small style={{ fontSize: '0.7rem' }}>
                      <AlertCircle className="me-1" size={14} />
                      No se pudo extraer información del agente del PDF
                    </small>
                  </div>
                )}

                {agenteEncontrado ? (
                  <div className="alert alert-success py-2 px-2">
                    <div className="d-flex align-items-center mb-2">
                      <CheckCircle className="me-1" size={16} />
                      <strong style={{ fontSize: '0.8rem' }}>✅ Agente ENCONTRADO en Equipo de Trabajo</strong>
                    </div>
                    
                    {claveYaExiste && (
                      <div className="alert alert-info mb-2 py-1 px-2">
                        <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                          <strong>ℹ️ Este agente ya tiene la clave {datosExtraidos.clave_agente} registrada para esta aseguradora.</strong>
                          {' '}La póliza se vinculará al agente existente sin crear duplicados.
                        </small>
                      </div>
                    )}
                    
                    {!claveYaExiste && (
                      <div className="alert alert-warning mb-2 py-1 px-2">
                        <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                          <strong>📋 Se agregará la nueva clave {datosExtraidos.clave_agente} a este agente.</strong>
                          {' '}El agente existe pero no tiene esta clave registrada para esta aseguradora.
                        </small>
                      </div>
                    )}
                    
                    <div className="card border-success">
                      <div className="card-body p-2">
                        <small className="card-subtitle mb-1 d-block text-success fw-semibold" style={{ fontSize: '0.7rem' }}>Datos en Equipo de Trabajo</small>
                        
                        <div className="row g-1">
                          <div className="col-md-2 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Código</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{agenteEncontrado.codigo || agenteEncontrado.codigoAgente}</small>
                          </div>
                          
                          <div className="col-md-4 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre</small>
                            <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={agenteEncontrado.nombre}>{agenteEncontrado.nombre}</small>
                          </div>

                          {agenteEncontrado.email && (
                            <div className="col-md-3 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Email</small>
                              <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={agenteEncontrado.email}>{agenteEncontrado.email}</small>
                            </div>
                          )}

                          {agenteEncontrado.telefono && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Teléfono</small>
                              <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{agenteEncontrado.telefono}</small>
                            </div>
                          )}

                          <div className="col-md-1 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Estado</small>
                            <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>Activo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-1" />
                    <small className="d-block mb-1 fw-semibold" style={{ fontSize: '0.7rem' }}>¿Qué deseas hacer?</small>
                    <div className="d-flex gap-1">
                      <button 
                        className="btn btn-success btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('usar-existente')}
                      >
                        <CheckCircle className="me-1" size={14} />
                        Usar Este Agente
                      </button>
                      <button 
                        className="btn btn-outline-primary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Seleccionar Después
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-2 px-2">
                    <div className="d-flex align-items-center mb-1">
                      <AlertCircle className="me-1" size={16} />
                      <strong style={{ fontSize: '0.8rem' }}>⚠️ Agente NO encontrado en Equipo de Trabajo</strong>
                    </div>
                    <small className="d-block mb-2" style={{ fontSize: '0.7rem' }}>
                      El agente con código <strong>{datosExtraidos.agente?.match(/^(\d+)/)?.[1] || 'N/A'}</strong> no está registrado.
                    </small>
                    <div className="d-flex gap-1">
                      <button 
                        className="btn btn-primary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        <CheckCircle className="me-1" size={14} />
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Continuar sin Agente
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm py-1"
                        style={{ fontSize: '0.75rem' }}
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
                <div className="alert alert-success mb-2 py-1 px-2">
                  <CheckCircle className="me-1" size={16} />
                  <strong style={{ fontSize: '0.8rem' }}>¡Extracción completada!</strong>
                </div>

                {informacionArchivo && (
                  <div className="card mb-2">
                    <div className="card-body py-1 px-2">
                      <small style={{ fontSize: '0.7rem' }}>
                        <strong>Archivo:</strong> {informacionArchivo.nombre} ({informacionArchivo.tamaño})
                      </small>
                    </div>
                  </div>
                )}

                {errores.length > 0 && (
                  <div className="alert alert-info mb-2 py-1 px-2">
                    <small className="fw-semibold d-block mb-1" style={{ fontSize: '0.7rem' }}>📊 Reporte de Extracción:</small>
                    {errores.map((error, idx) => (
                      <small key={idx} className="d-block" style={{ fontSize: '0.65rem' }}>{error}</small>
                    ))}
                  </div>
                )}

                <div className="card">
                  <div className="card-header bg-primary text-white py-1 px-2">
                    <small className="mb-0 fw-semibold" style={{ fontSize: '0.8rem' }}>🎯 Datos Extraídos del PDF</small>
                  </div>
                  <div className="card-body" style={{ padding: '0.25rem' }}>
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
                <div className="alert alert-danger text-start">
                  {errores.map((error, idx) => (
                    <div key={idx}>
                      <strong>{error.mensaje}</strong>
                      {error.detalle && (
                        <div className="small text-muted mt-1">{error.detalle}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    setEstado('seleccionando-metodo');
                    setErrores([]);
                    setMetodoExtraccion(null);
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
  setModoEdicion,
  mostrarModalMetodoCaptura,
  setMostrarModalMetodoCaptura,
  mostrarExtractorPDF,
  setMostrarExtractorPDF,
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
  // Estado para carpeta/categoría seleccionada
  const [carpetaSeleccionada, setCarpetaSeleccionada] = React.useState('en_proceso');
  
  // Filtrar expedientes según la carpeta seleccionada
  const expedientesFiltrados = React.useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    switch (carpetaSeleccionada) {
      case 'en_proceso':
        // 1. Pólizas con estatus anterior al primer pago (nuevas o renovaciones)
        // 2. Pólizas fraccionadas que regresan dinámicamente (próximo pago ≤ 15 días)
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
          
          // Para pago único (Anual): mostrar si no está pagado
          if (!esFraccionado) {
            return estatusPago !== 'pagado';
          }
          
          // Para pago fraccionado: verificar si hay recibos pendientes o próximos
          const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
          if (!frecuencia || !exp.inicio_vigencia) return estatusPago !== 'pagado';
          
          const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
          const mesesPorFrecuencia = {
            'Mensual': 1,
            'Trimestral': 3,
            'Semestral': 6
          };
          const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
          
          // 🔥 Usar ultimo_recibo_pagado en lugar de calcular por fechas
          const pagosRealizados = exp.ultimo_recibo_pagado || 0;
          
          // Si ya pagó todos los recibos, NO va a "En Proceso"
          if (pagosRealizados >= numeroPagos) return false;
          
          // Calcular fecha del próximo recibo
          const proximoRecibo = pagosRealizados + 1;
          const fechaInicio = new Date(exp.inicio_vigencia);
          const fechaProximoRecibo = new Date(fechaInicio);
          fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
          
          // Calcular días hasta el vencimiento
          const hoyLocal = new Date();
          hoyLocal.setHours(0, 0, 0, 0);
          fechaProximoRecibo.setHours(0, 0, 0, 0);
          const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
          
          // Mostrar en "En Proceso" si está vencido o por vencer (≤ 15 días)
          return diasRestantes <= 15;
        });
      
      case 'vigentes':
        // Pólizas NUEVAS pagadas con próximo pago > 15 días (o totalmente pagadas)
        // NO están en periodo de renovación (> 30 días para término)
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          if (exp.etapa_activa === 'Renovada') return false; // Renovadas van a su propia carpeta
          
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
          
          // Para pago único: debe estar pagado
          if (!esFraccionado) {
            if (estatusPago !== 'pagado') return false;
          } else {
            // Para fraccionado: verificar que próximo pago > 15 días
            const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
            if (!frecuencia || !exp.inicio_vigencia) return estatusPago === 'pagado';
            
            const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
            
            // 🔥 Usar ultimo_recibo_pagado en lugar de calcular por fechas
            const pagosRealizados = exp.ultimo_recibo_pagado || 0;
            
            // Si no ha pagado nada, no está en vigentes
            if (pagosRealizados === 0) return false;
            
            const mesesPorFrecuencia = {
              'Mensual': 1,
              'Trimestral': 3,
              'Semestral': 6
            };
            
            const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
            
            // Si ya pagó todos, está en vigentes
            if (pagosRealizados >= numeroPagos) {
              // Continuar para verificar si no está en periodo de renovación
            } else {
              // Calcular días hasta próximo pago
              const proximoRecibo = pagosRealizados + 1;
              const fechaInicio = new Date(exp.inicio_vigencia);
              const fechaProximoRecibo = new Date(fechaInicio);
              fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
              
              const hoyLocal = new Date();
              hoyLocal.setHours(0, 0, 0, 0);
              fechaProximoRecibo.setHours(0, 0, 0, 0);
              const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
              
              // Solo está en vigentes si faltan > 15 días
              if (diasRestantes <= 15) return false;
            }
          }
          
          // Verificar que NO esté en periodo de renovación (> 30 días para término)
          if (!exp.termino_vigencia) return true;
          
          let fechaAviso;
          if (exp.fecha_aviso_renovacion) {
            fechaAviso = new Date(exp.fecha_aviso_renovacion);
          } else {
            const fechaTermino = new Date(exp.termino_vigencia);
            fechaAviso = new Date(fechaTermino);
            fechaAviso.setDate(fechaAviso.getDate() - 30);
          }
          
          return hoy < fechaAviso; // Solo si AÚN no llegó al periodo de renovación
        });
      
      case 'renovadas':
        // Pólizas RENOVADAS pagadas con próximo pago > 15 días
        // NO están en periodo de renovación (> 30 días para término)
        return expedientes.filter(exp => {
          if (exp.etapa_activa !== 'Renovada') return false;
          if (exp.etapa_activa === 'Cancelada') return false;
          
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
          
          // Para pago único: debe estar pagado
          if (!esFraccionado) {
            if (estatusPago !== 'pagado') return false;
          } else {
            // Para fraccionado: verificar que próximo pago > 15 días
            const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
            if (!frecuencia || !exp.inicio_vigencia) return estatusPago === 'pagado';
            
            const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
            
            // 🔥 Usar ultimo_recibo_pagado en lugar de calcular por fechas
            const pagosRealizados = exp.ultimo_recibo_pagado || 0;
            
            // Si no ha pagado nada, no está en renovadas
            if (pagosRealizados === 0) return false;
            
            const mesesPorFrecuencia = {
              'Mensual': 1,
              'Trimestral': 3,
              'Semestral': 6
            };
            
            const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
            
            // Si ya pagó todos, está en renovadas
            if (pagosRealizados >= numeroPagos) {
              // Continuar para verificar si no está en periodo de renovación
            } else {
              // Calcular días hasta próximo pago
              const proximoRecibo = pagosRealizados + 1;
              const fechaInicio = new Date(exp.inicio_vigencia);
              const fechaProximoRecibo = new Date(fechaInicio);
              fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
              
              const hoyLocal = new Date();
              hoyLocal.setHours(0, 0, 0, 0);
              fechaProximoRecibo.setHours(0, 0, 0, 0);
              const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
              
              // Solo está en renovadas si faltan > 15 días
              if (diasRestantes <= 15) return false;
            }
          }
          
          // Verificar que NO esté en periodo de renovación (> 30 días para término)
          if (!exp.termino_vigencia) return true;
          
          let fechaAviso;
          if (exp.fecha_aviso_renovacion) {
            fechaAviso = new Date(exp.fecha_aviso_renovacion);
          } else {
            const fechaTermino = new Date(exp.termino_vigencia);
            fechaAviso = new Date(fechaTermino);
            fechaAviso.setDate(fechaAviso.getDate() - 30);
          }
          
          return hoy < fechaAviso; // Solo si AÚN no llegó al periodo de renovación
        });
      
      case 'por_renovar':
        // Pólizas (nuevas o renovadas) que ya llegaron a su fecha de aviso de renovación
        // Criterio: hoy >= fecha_aviso_renovacion && hoy < termino_vigencia
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          if (!exp.termino_vigencia) return false;
          
          const fechaTermino = new Date(exp.termino_vigencia);
          
          // Obtener fecha de aviso: usar la de BD o calcular (término - 30 días)
          let fechaAviso;
          if (exp.fecha_aviso_renovacion) {
            fechaAviso = new Date(exp.fecha_aviso_renovacion);
          } else {
            // Fallback: calcular 30 días antes del término
            fechaAviso = new Date(fechaTermino);
            fechaAviso.setDate(fechaAviso.getDate() - 30);
          }
          
          return hoy >= fechaAviso && hoy < fechaTermino;
        });
      
      case 'vencidas':
        // Pólizas vencidas (termino_vigencia < hoy)
        return expedientes.filter(exp => {
          if (!exp.termino_vigencia || exp.etapa_activa === 'Cancelada') return false;
          const fechaVencimiento = new Date(exp.termino_vigencia);
          return fechaVencimiento < hoy;
        });
      
      case 'canceladas':
        return expedientes.filter(exp => exp.etapa_activa === 'Cancelada');
      
      case 'todas':
      default:
        return expedientes;
    }
  }, [expedientes, carpetaSeleccionada]);
  
  // Contadores para cada carpeta
  const contadores = React.useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    return {
      todas: expedientes.length,
      
      en_proceso: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        
        const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
        const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
        
        // Para pago único (Anual): mostrar si no está pagado
        if (!esFraccionado) {
          return estatusPago !== 'pagado';
        }
        
        // Para pago fraccionado: verificar si hay recibos vencidos o por vencer
        const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
        if (!frecuencia || !exp.inicio_vigencia) return estatusPago !== 'pagado';
        
        const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
        
        // 🔥 Usar ultimo_recibo_pagado en lugar de calcular por fechas
        const pagosRealizados = exp.ultimo_recibo_pagado || 0;
        
        // Si ya pagó todos los recibos, NO va a "En Proceso"
        if (pagosRealizados >= numeroPagos) return false;
        
        const mesesPorFrecuencia = {
          'Mensual': 1,
          'Trimestral': 3,
          'Semestral': 6
        };
        
        const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
        
        // Calcular fecha del próximo recibo
        const proximoRecibo = pagosRealizados + 1;
        const fechaInicio = new Date(exp.inicio_vigencia);
        const fechaProximoRecibo = new Date(fechaInicio);
        fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
        
        // Calcular días hasta el vencimiento
        const hoyLocal = new Date();
        hoyLocal.setHours(0, 0, 0, 0);
        fechaProximoRecibo.setHours(0, 0, 0, 0);
        const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
        
        // Mostrar en "En Proceso" si está vencido o por vencer (≤ 15 días)
        return diasRestantes <= 15;
      }).length,
      
      vigentes: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        if (exp.etapa_activa === 'Renovada') return false;
        
        const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
        const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
        
        if (!esFraccionado) {
          if (estatusPago !== 'pagado') return false;
        } else {
          const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
          if (!frecuencia || !exp.inicio_vigencia) return estatusPago === 'pagado';
          
          const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
          // 🔥 Usar el contador directo de recibos pagados
          const pagosRealizados = exp.ultimo_recibo_pagado || 0;
          const mesesPorFrecuencia = { 'Mensual': 1, 'Trimestral': 3, 'Semestral': 6 };
          const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
          
          if (pagosRealizados === 0) {
            return false;
          }
          
          if (pagosRealizados < numeroPagos) {
            const proximoRecibo = pagosRealizados + 1;
            const fechaInicio = new Date(exp.inicio_vigencia);
            const fechaProximoRecibo = new Date(fechaInicio);
            fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
            
            const hoyLocal = new Date();
            hoyLocal.setHours(0, 0, 0, 0);
            fechaProximoRecibo.setHours(0, 0, 0, 0);
            const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes <= 15) return false;
          }
        }
        
        if (!exp.termino_vigencia) return true;
        
        let fechaAviso;
        if (exp.fecha_aviso_renovacion) {
          fechaAviso = new Date(exp.fecha_aviso_renovacion);
        } else {
          const fechaTermino = new Date(exp.termino_vigencia);
          fechaAviso = new Date(fechaTermino);
          fechaAviso.setDate(fechaAviso.getDate() - 30);
        }
        
        return hoy < fechaAviso;
      }).length,
      
      renovadas: expedientes.filter(exp => {
        if (exp.etapa_activa !== 'Renovada') return false;
        if (exp.etapa_activa === 'Cancelada') return false;
        
        const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
        const esFraccionado = (exp.tipo_pago === 'Fraccionado') || (exp.forma_pago?.toUpperCase() === 'FRACCIONADO');
        
        if (!esFraccionado) {
          if (estatusPago !== 'pagado') return false;
        } else {
          const frecuencia = exp.frecuenciaPago || exp.frecuencia_pago;
          if (!frecuencia || !exp.inicio_vigencia) return estatusPago === 'pagado';
          
          const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
          // 🔥 Usar el contador directo de recibos pagados
          const pagosRealizados = exp.ultimo_recibo_pagado || 0;
          
          const mesesPorFrecuencia = { 'Mensual': 1, 'Trimestral': 3, 'Semestral': 6 };
          const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
          
          if (pagosRealizados === 0) {
            return false;
          }
          
          if (pagosRealizados < numeroPagos) {
            const proximoRecibo = pagosRealizados + 1;
            const fechaInicio = new Date(exp.inicio_vigencia);
            const fechaProximoRecibo = new Date(fechaInicio);
            fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
            
            const hoyLocal = new Date();
            hoyLocal.setHours(0, 0, 0, 0);
            fechaProximoRecibo.setHours(0, 0, 0, 0);
            const diasRestantes = Math.floor((fechaProximoRecibo - hoyLocal) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes <= 15) return false;
          }
        }
        
        if (!exp.termino_vigencia) return true;
        
        let fechaAviso;
        if (exp.fecha_aviso_renovacion) {
          fechaAviso = new Date(exp.fecha_aviso_renovacion);
        } else {
          const fechaTermino = new Date(exp.termino_vigencia);
          fechaAviso = new Date(fechaTermino);
          fechaAviso.setDate(fechaAviso.getDate() - 30);
        }
        
        return hoy < fechaAviso;
      }).length,
      
      por_renovar: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        if (!exp.termino_vigencia) return false;
        
        const fechaTermino = new Date(exp.termino_vigencia);
        
        let fechaAviso;
        if (exp.fecha_aviso_renovacion) {
          fechaAviso = new Date(exp.fecha_aviso_renovacion);
        } else {
          fechaAviso = new Date(fechaTermino);
          fechaAviso.setDate(fechaAviso.getDate() - 30);
        }
        
        return hoy >= fechaAviso && hoy < fechaTermino;
      }).length,
      
      vencidas: expedientes.filter(exp => {
        if (!exp.termino_vigencia || exp.etapa_activa === 'Cancelada') return false;
        const fechaVencimiento = new Date(exp.termino_vigencia);
        return fechaVencimiento < hoy;
      }).length,
      
      canceladas: expedientes.filter(exp => exp.etapa_activa === 'Cancelada').length
    };
  }, [expedientes]);
  
  const paginacion = usePaginacion(expedientesFiltrados, 10);

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
    <div className="p-3">
      {/* Estilos globales para normalizar fuentes */}
      <style>{`
        .table-sm { font-size: 0.875rem !important; }
        .table-sm small { font-size: 0.75rem !important; }
        .table-sm .badge { font-size: 0.75rem !important; }
        .table-sm .text-muted { font-size: 0.75rem !important; }
      `}</style>
      
      {/* Header Compacto */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Gestión de Pólizas</h4>
        <button
          onClick={() => {
            setMostrarModalMetodoCaptura(true);
          }}
          className="btn btn-primary"
        >
          <Plus size={16} className="me-2" />
          Nueva Póliza
        </button>
      </div>

      {/* Carpetas Horizontales */}
      <div className="mb-3" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <div className="d-inline-flex gap-2">
          <button
            className={`btn ${carpetaSeleccionada === 'todas' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('todas')}
            style={{ whiteSpace: 'nowrap' }}
          >
            📋 Todas
            <span className="badge bg-white text-dark ms-2">{contadores.todas}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'en_proceso' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('en_proceso')}
            style={{ whiteSpace: 'nowrap' }}
          >
            📝 En Proceso
            <span className="badge bg-secondary ms-2">{contadores.en_proceso}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'vigentes' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setCarpetaSeleccionada('vigentes')}
            style={{ whiteSpace: 'nowrap' }}
          >
            ✅ Vigentes
            <span className={`badge ${carpetaSeleccionada === 'vigentes' ? 'bg-white text-success' : 'bg-success text-white'} ms-2`}>{contadores.vigentes}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'renovadas' ? 'btn-info' : 'btn-outline-info'}`}
            onClick={() => setCarpetaSeleccionada('renovadas')}
            style={{ whiteSpace: 'nowrap' }}
          >
            🔄 Renovadas
            <span className={`badge ${carpetaSeleccionada === 'renovadas' ? 'bg-white text-info' : 'bg-info text-white'} ms-2`}>{contadores.renovadas}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'por_renovar' ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={() => setCarpetaSeleccionada('por_renovar')}
            style={{ whiteSpace: 'nowrap' }}
          >
            ⏰ Por Renovar
            <span className={`badge ${carpetaSeleccionada === 'por_renovar' ? 'bg-white text-warning' : 'bg-warning text-white'} ms-2`}>{contadores.por_renovar}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'vencidas' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setCarpetaSeleccionada('vencidas')}
            style={{ whiteSpace: 'nowrap' }}
          >
            ⚠️ Vencidas
            <span className={`badge ${carpetaSeleccionada === 'vencidas' ? 'bg-white text-danger' : 'bg-danger text-white'} ms-2`}>{contadores.vencidas}</span>
          </button>
          <button
            className={`btn ${carpetaSeleccionada === 'canceladas' ? 'btn-secondary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('canceladas')}
            style={{ whiteSpace: 'nowrap' }}
          >
            🚫 Canceladas
            <span className={`badge ${carpetaSeleccionada === 'canceladas' ? 'bg-white text-dark' : 'bg-secondary text-white'} ms-2`}>{contadores.canceladas}</span>
          </button>
        </div>
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
        <div className="row mb-3 g-2">
          <div className="col-12 col-md-8">
            <BarraBusqueda 
              busqueda={paginacion.busqueda}
              setBusqueda={paginacion.setBusqueda}
              placeholder="Buscar pólizas..."
            />
          </div>
          <div className="col-12 col-md-4 text-md-end">
            <small className="text-muted d-block mt-2 mt-md-0">
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
            {/* Vista Desktop - Tabla */}
            <div className="table-responsive d-none d-lg-block">
              <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '100px', verticalAlign: 'middle', textAlign: 'center' }}>Póliza</th>
                    <th style={{ width: '240px', verticalAlign: 'middle', textAlign: 'center' }}>Cliente</th>
                    <th style={{ width: '100px', verticalAlign: 'middle', textAlign: 'center' }}>Compañía</th>
                    <th style={{ width: '210px', verticalAlign: 'middle', textAlign: 'center' }}>Producto</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>
                      <div>Etapa</div>
                      <div>Activa</div>
                    </th>
                    <th style={{ width: '100px', verticalAlign: 'middle', textAlign: 'center' }}>Agente</th>
                    <th style={{ width: '200px', textAlign: 'center' }}>
                      <div>Estatus Pago</div>
                      <div>y Progreso</div>
                    </th>
                    <th style={{ width: '100px', textAlign: 'center' }}>
                      <div>Vigencia</div>
                      <div>Pago</div>
                    </th>
                    <th width="150" style={{ verticalAlign: 'middle', textAlign: 'center' }}>Acciones</th>
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
                      <tr key={expediente.id} style={{ verticalAlign: 'middle' }}>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div>
                            <strong className="text-primary">{expediente.numero_poliza || '-'}</strong>
                            {esDuplicadaCompleta && (
                              <div>
                                <span className="badge bg-warning text-dark" title="Póliza duplicada (misma póliza + mismo VIN)">
                                  ⚠️ Duplicada
                                </span>
                              </div>
                            )}
                            {esVinDuplicado && (
                              <div>
                                <span className="badge" style={{ backgroundColor: '#fd7e14', color: 'white' }} title="VIN duplicado en otra póliza - Revisar">
                                  ⚠️ VIN Duplicado
                                </span>
                              </div>
                            )}
                            {esPolizaVinDistinto && (
                              <div>
                                <span className="badge bg-danger" title="Mismo número de póliza con VIN diferente - Revisar urgente">
                                  ⚠️ Póliza VIN Distinto
                                </span>
                              </div>
                            )}
                            {expediente.endoso && (
                              <div><small className="text-muted">End: {expediente.endoso}</small></div>
                            )}
                            {expediente.inciso && (
                              <div><small className="text-muted">Inc: {expediente.inciso}</small></div>
                            )}
                            {/* Fechas de captura y emisión */}
                            <div style={{ marginTop: '4px', fontSize: '0.7rem', lineHeight: '1.3' }}>
                              {expediente.created_at && (
                                <div>
                                  <div className="text-muted">Captura</div>
                                  <div>{utils.formatearFecha(expediente.created_at, 'cortaY')}</div>
                                </div>
                              )}
                              {expediente.fecha_emision && (
                                <div style={{ marginTop: '2px' }}>
                                  <div className="text-muted">Emisión</div>
                                  <div>{utils.formatearFecha(expediente.fecha_emision, 'cortaY')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td><InfoCliente expediente={expediente} cliente={clientesMap[expediente.cliente_id]} /></td>
                        <td style={{ textAlign: 'center' }}>{expediente.compania}</td>
                        <td style={{ fontSize: '0.7rem' }}>
                          <div>
                            <strong>{expediente.producto}</strong>
                            {(expediente.producto === 'Autos' || expediente.producto?.includes('Autos') || expediente.producto?.includes('Auto')) && (
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
                        <td style={{ textAlign: 'center', fontSize: '0.7rem' }}>
                          <Badge tipo="etapa" valor={expediente.etapa_activa} />
                          {expediente.motivoCancelacion && (
                            <div><small className="text-muted">Motivo: {expediente.motivoCancelacion}</small></div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                          {(() => {
                            if (agenteInfo) {
                              const nombreCompleto = agenteInfo.nombre || '';
                              const palabras = nombreCompleto.trim().split(/\s+/);
                              const primerNombre = palabras[0] || '';
                              const primerApellido = palabras.length >= 3 ? palabras[2] : palabras[1] || '';
                              return `${agenteInfo.codigoAgente} - ${primerNombre} ${primerApellido}`.trim();
                            } else if (expediente.agente) {
                              // Si no hay agenteInfo, procesar el texto del expediente
                              const textoAgente = expediente.agente || '';
                              const partes = textoAgente.split('-');
                              if (partes.length >= 2) {
                                const codigo = partes[0].trim();
                                const nombreCompleto = partes.slice(1).join('-').trim();
                                const palabras = nombreCompleto.split(/\s+/);
                                const primerNombre = palabras[0] || '';
                                const primerApellido = palabras.length >= 3 ? palabras[2] : palabras[1] || '';
                                return `${codigo} - ${primerNombre} ${primerApellido}`.trim();
                              }
                              return textoAgente;
                            }
                            return '-';
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div>
                            {/* Tipo y Estatus de Pago */}
                            <EstadoPago expediente={expediente} />
                            
                            {/* Estado del próximo recibo pendiente (solo para fraccionado) */}
                            {((expediente.tipo_pago === 'Fraccionado') || (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO')) && 
                             (expediente.frecuenciaPago || expediente.frecuencia_pago) && 
                             expediente.inicio_vigencia && (
                              (() => {
                                // Normalizar campos
                                const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
                                const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                                
                                // 🔥 Usar ultimo_recibo_pagado en lugar de calcular por fechas
                                const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
                                
                                const mesesPorFrecuencia = {
                                  'Mensual': 1,
                                  'Trimestral': 3,
                                  'Semestral': 6
                                };
                                
                                const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
                                
                                // Determinar el próximo recibo pendiente
                                const proximoRecibo = pagosRealizados + 1;
                                
                                // Si ya se pagaron todos los recibos
                                if (pagosRealizados >= numeroPagos) {
                                  return (
                                    <div className="mt-1" style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                                      <span className="text-success fw-bold">{numeroPagos}/{numeroPagos} Pagado</span>
                                    </div>
                                  );
                                }
                                
                                // Calcular fecha de vencimiento del próximo recibo
                                const fechaInicio = new Date(expediente.inicio_vigencia);
                                const fechaProximoRecibo = new Date(fechaInicio);
                                fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
                                
                                // Calcular días restantes
                                const hoy = new Date();
                                hoy.setHours(0, 0, 0, 0);
                                fechaProximoRecibo.setHours(0, 0, 0, 0);
                                const diasRestantes = Math.floor((fechaProximoRecibo - hoy) / (1000 * 60 * 60 * 24));
                                
                                // Determinar estado y color
                                let estado = '';
                                let colorClass = '';
                                
                                if (diasRestantes < 0) {
                                  estado = 'Vencido';
                                  colorClass = 'text-danger fw-bold';
                                } else if (diasRestantes === 0) {
                                  estado = 'Vence Hoy';
                                  colorClass = 'text-danger fw-bold';
                                } else if (diasRestantes <= 15) {
                                  estado = 'Por Vencer';
                                  colorClass = 'text-warning fw-bold';
                                } else {
                                  estado = 'Pendiente';
                                  colorClass = 'text-info';
                                }
                                
                                return (
                                  <div className="mt-1" style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                                    <span className={colorClass}>{proximoRecibo}/{numeroPagos} {estado}</span>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.7rem', lineHeight: '1.4', textAlign: 'center' }}>
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxWidth: '120px' }}>
                            {/* === BOTONES DE RENOVACIÓN === */}
                            {(() => {
                              const estaPorRenovar = carpetaSeleccionada === 'por_renovar' || carpetaSeleccionada === 'vencidas';
                              
                              if (!estaPorRenovar) return null;
                              
                              const etapaActual = expediente.etapa_activa || '';
                              
                              // Puede iniciar cotización si está en Por Renovar o Vencida y NO está en ninguna etapa del flujo de renovación
                              const puedeIniciarCotizacion = (etapaActual === 'Por Renovar' || etapaActual === 'Vencida') &&
                                                              !etapaActual.includes('Cotización') && 
                                                              !etapaActual.includes('Enviada') &&
                                                              !etapaActual.includes('Pendiente de Emisión');
                              
                              const puedeMarcarAutorizado = etapaActual === 'En Cotización - Renovación' || 
                                                             etapaActual === 'Renovación Enviada';
                              
                              const puedeAgregarRenovada = etapaActual === 'Pendiente de Emisión - Renovación';
                              
                              return (
                                <>
                                  {puedeIniciarCotizacion && (
                                    <button
                                      onClick={() => iniciarCotizacionRenovacion(expediente)}
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Cotizar Renovación"
                                    >
                                      <FileText size={12} />
                                    </button>
                                  )}
                                  
                                  {puedeMarcarAutorizado && (
                                    <button
                                      onClick={() => marcarRenovacionAutorizada(expediente)}
                                      className="btn btn-success btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Marcar como Autorizado"
                                    >
                                      <CheckCircle size={12} />
                                    </button>
                                  )}
                                  
                                  {puedeAgregarRenovada && (
                                    <button
                                      onClick={() => abrirModalPolizaRenovada(expediente)}
                                      className="btn btn-info btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Agregar Póliza Renovada"
                                    >
                                      <RefreshCw size={12} />
                                    </button>
                                  )}
                                </>
                              );
                            })()}

                            <button
                              onClick={() => abrirModalCompartir(expediente)}
                              className="btn btn-success btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Compartir"
                            >
                              <Share2 size={12} />
                            </button>

                            {(() => {
                              // ✅ El botón de pago debe estar disponible independientemente de la etapa
                              // Solo se oculta si ya está pagado o si la póliza está cancelada
                              const etapaValida = expediente.etapa_activa !== 'Cancelada';
                              
                              // ✅ Verificar estatus_pago tanto en camelCase como snake_case
                              const estatusPagoDB = (expediente.estatus_pago || '').toLowerCase().trim();
                              const estatusPagoNorm = (expediente.estatusPago || '').toLowerCase().trim();
                              
                              // 🔥 Para pagos fraccionados, verificar si hay pagos pendientes usando contador directo
                              const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
                              let tienePagosPendientes = false;
                              
                              if (esFraccionado && (expediente.frecuenciaPago || expediente.frecuencia_pago)) {
                                const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
                                const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                                const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
                                
                                // Si no ha completado todos los pagos, tiene pendientes
                                tienePagosPendientes = pagosRealizados < numeroPagos;
                              }
                              
                              // ✅ CRÍTICO: No mostrar botón si el pago YA está aplicado (preservar integridad financiera)
                              // Para fraccionados: mostrar si tiene pagos pendientes
                              // Para pago único: mostrar si no está pagado
                              const noPagado = esFraccionado 
                                ? tienePagosPendientes
                                : (estatusPagoDB !== 'pagado' && estatusPagoNorm !== 'pagado');
                              
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
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Editar"
                            >
                              <Edit size={12} />
                            </button>
                            
                            <button
                              onClick={() => eliminarExpediente(expediente.id)}
                              className="btn btn-outline-danger btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Eliminar"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil - Cards */}
            <div className="d-lg-none p-3">
              {paginacion.itemsPaginados.map((expediente) => {
                const agenteInfo = agentes.find(a => a.codigoAgente === expediente.agente);
                const esDuplicadaCompleta = analisisDuplicados.polizasDuplicadas.find(d => d.id === expediente.id);
                const esVinDuplicado = analisisDuplicados.vinsDuplicados.find(d => d.id === expediente.id);
                const esPolizaVinDistinto = analisisDuplicados.polizasVinDistinto.find(d => d.id === expediente.id);
                
                return (
                  <div key={expediente.id} className="card mb-3 shadow-sm">
                    <div className="card-body p-3">
                      {/* Header - Número de Póliza */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-1">
                            <strong className="text-primary">{expediente.numero_poliza || 'Sin número'}</strong>
                          </h6>
                          {(expediente.endoso || expediente.inciso) && (
                            <small className="text-muted">
                              {expediente.endoso && `End: ${expediente.endoso}`}
                              {expediente.endoso && expediente.inciso && ' | '}
                              {expediente.inciso && `Inc: ${expediente.inciso}`}
                            </small>
                          )}
                        </div>
                        <Badge tipo="etapa" valor={expediente.etapa_activa} />
                      </div>

                      {/* Alertas de duplicados */}
                      {(esDuplicadaCompleta || esVinDuplicado || esPolizaVinDistinto) && (
                        <div className="mb-2">
                          {esDuplicadaCompleta && (
                            <span className="badge bg-warning text-dark me-1" style={{ fontSize: '0.7rem' }}>
                              ⚠️ Duplicada
                            </span>
                          )}
                          {esVinDuplicado && (
                            <span className="badge me-1" style={{ fontSize: '0.7rem', backgroundColor: '#fd7e14', color: 'white' }}>
                              ⚠️ VIN Duplicado
                            </span>
                          )}
                          {esPolizaVinDistinto && (
                            <span className="badge bg-danger" style={{ fontSize: '0.7rem' }}>
                              ⚠️ Póliza VIN Distinto
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cliente */}
                      <div className="mb-2 pb-2 border-bottom">
                        <small className="text-muted d-block">Cliente</small>
                        <InfoCliente expediente={expediente} cliente={clientesMap[expediente.cliente_id]} />
                      </div>

                      {/* Compañía y Producto */}
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <small className="text-muted d-block">Compañía</small>
                          <strong style={{ fontSize: '0.875rem' }}>{expediente.compania}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Producto</small>
                          <strong style={{ fontSize: '0.875rem' }}>{expediente.producto}</strong>
                          {(expediente.producto === 'Autos' || expediente.producto?.includes('Autos') || expediente.producto?.includes('Auto')) && (
                            <>
                              {expediente.tipo_cobertura && (
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                  {expediente.tipo_cobertura}
                                </div>
                              )}
                              {(expediente.marca || expediente.modelo) && (
                                <div style={{ fontSize: '0.75rem' }}>
                                  {expediente.marca} {expediente.modelo}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Agente */}
                      {expediente.agente && (
                        <div className="mb-2">
                          <small className="text-muted d-block">Agente</small>
                          <span style={{ fontSize: '0.875rem' }}>
                            {agenteInfo ? `${agenteInfo.codigoAgente} - ${agenteInfo.nombre}` : expediente.agente}
                          </span>
                        </div>
                      )}

                      {/* Estado de Pago */}
                      <div className="mb-2">
                        <small className="text-muted d-block">Estado de Pago</small>
                        <EstadoPago expediente={expediente} />
                        <CalendarioPagos 
                          expediente={expediente} 
                          calcularProximoPago={calcularProximoPago}
                          compacto={true}
                        />
                      </div>

                      {/* Vigencia */}
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <small className="text-muted d-block">Inicio Vigencia</small>
                          <span style={{ fontSize: '0.875rem' }}>
                            {expediente.inicio_vigencia ? utils.formatearFecha(expediente.inicio_vigencia, 'cortaY') : '-'}
                          </span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Fin Vigencia</small>
                          <span style={{ fontSize: '0.875rem' }}>
                            {expediente.termino_vigencia ? utils.formatearFecha(expediente.termino_vigencia, 'cortaY') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Fechas */}
                      {(expediente.created_at || expediente.fecha_emision) && (
                        <div className="mb-3" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                          {expediente.created_at && (
                            <div>📝 Capturada: {utils.formatearFecha(expediente.created_at, 'cortaY')}</div>
                          )}
                          {expediente.fecha_emision && (
                            <div>📄 Emitida: {utils.formatearFecha(expediente.fecha_emision, 'cortaY')}</div>
                          )}
                        </div>
                      )}

                      {/* Botones de Acción */}
                      <div className="d-flex flex-wrap gap-2">
                        {/* Botones de renovación */}
                        {(() => {
                          const estaPorRenovar = carpetaSeleccionada === 'por_renovar' || carpetaSeleccionada === 'vencidas';
                          if (!estaPorRenovar) return null;
                          
                          const etapaActual = expediente.etapa_activa || '';
                          const puedeIniciarCotizacion = (etapaActual === 'Por Renovar' || etapaActual === 'Vencida') &&
                                                          !etapaActual.includes('Cotización') && 
                                                          !etapaActual.includes('Enviada') &&
                                                          !etapaActual.includes('Pendiente de Emisión');
                          
                          const puedeMarcarAutorizado = etapaActual === 'En Cotización - Renovación' || 
                                                         etapaActual === 'Renovación Enviada';
                          
                          const puedeAgregarRenovada = etapaActual === 'Pendiente de Emisión - Renovación';
                          
                          return (
                            <>
                              {puedeIniciarCotizacion && (
                                <button
                                  onClick={() => iniciarCotizacionRenovacion(expediente)}
                                  className="btn btn-primary btn-sm"
                                  title="Cotizar Renovación"
                                >
                                  <FileText size={14} className="me-1" />
                                  Cotizar
                                </button>
                              )}
                              {puedeMarcarAutorizado && (
                                <button
                                  onClick={() => marcarRenovacionAutorizada(expediente)}
                                  className="btn btn-success btn-sm"
                                  title="Marcar como Autorizado"
                                >
                                  <CheckCircle size={14} className="me-1" />
                                  Autorizar
                                </button>
                              )}
                              {puedeAgregarRenovada && (
                                <button
                                  onClick={() => abrirModalPolizaRenovada(expediente)}
                                  className="btn btn-info btn-sm"
                                  title="Agregar Póliza Renovada"
                                >
                                  <RefreshCw size={14} className="me-1" />
                                  Renovar
                                </button>
                              )}
                            </>
                          );
                        })()}

                        <button
                          onClick={() => abrirModalCompartir(expediente)}
                          className="btn btn-success btn-sm"
                          title="Compartir"
                        >
                          <Share2 size={14} className="me-1" />
                          Compartir
                        </button>

                        {(() => {
                          const etapaValida = expediente.etapa_activa !== 'Cancelada';
                          const estatusPagoDB = (expediente.estatus_pago || '').toLowerCase().trim();
                          const estatusPagoNorm = (expediente.estatusPago || '').toLowerCase().trim();
                          
                          // 🔥 Para pagos fraccionados, verificar si hay pagos pendientes
                          const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
                          let tienePagosPendientes = false;
                          
                          if (esFraccionado && (expediente.frecuenciaPago || expediente.frecuencia_pago)) {
                            const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
                            const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                            const fechaUltimoPago = expediente.fechaUltimoPago || expediente.fecha_ultimo_pago;
                            
                            let pagosRealizados = 0;
                            if (fechaUltimoPago && expediente.inicio_vigencia) {
                              const fechaUltimo = new Date(fechaUltimoPago);
                              const fechaInicio = new Date(expediente.inicio_vigencia);
                              
                              const mesesPorFrecuencia = {
                                'Mensual': 1,
                                'Trimestral': 3,
                                'Semestral': 6
                              };
                              
                              const mesesPorPago = mesesPorFrecuencia[frecuencia] || 1;
                              const mesesTranscurridos = (fechaUltimo.getFullYear() - fechaInicio.getFullYear()) * 12 + 
                                                          (fechaUltimo.getMonth() - fechaInicio.getMonth());
                              
                              pagosRealizados = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
                              pagosRealizados = Math.min(pagosRealizados, numeroPagos);
                            }
                            
                            // Si no ha completado todos los pagos, tiene pendientes
                            tienePagosPendientes = pagosRealizados < numeroPagos;
                          }
                          
                          // Para fraccionados: mostrar si tiene pagos pendientes
                          // Para pago único: mostrar si no está pagado
                          const noPagado = esFraccionado 
                            ? tienePagosPendientes
                            : (estatusPagoDB !== 'pagado' && estatusPagoNorm !== 'pagado');
                          
                          return etapaValida && noPagado ? (
                            <button
                              onClick={() => aplicarPago(expediente.id)}
                              className="btn btn-success btn-sm"
                              title="Aplicar Pago"
                            >
                              <DollarSign size={14} className="me-1" />
                              Pagar
                            </button>
                          ) : null;
                        })()}

                        <button
                          onClick={() => verDetalles(expediente)}
                          className="btn btn-outline-primary btn-sm"
                          title="Ver detalles"
                        >
                          <Eye size={14} className="me-1" />
                          Ver
                        </button>
                        
                        <button
                          onClick={() => editarExpediente(expediente)}
                          className="btn btn-outline-secondary btn-sm"
                          title="Editar"
                        >
                          <Edit size={14} className="me-1" />
                          Editar
                        </button>

                        {expediente.etapa_activa !== 'Cancelada' && (
                          <button
                            onClick={() => iniciarCancelacion(expediente)}
                            className="btn btn-danger btn-sm"
                            title="Cancelar Póliza"
                          >
                            <XCircle size={14} className="me-1" />
                            Cancelar
                          </button>
                        )}

                        <button
                          onClick={() => eliminarExpediente(expediente.id)}
                          className="btn btn-outline-danger btn-sm"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Modal de Selección de Método de Captura */}
      {mostrarModalMetodoCaptura && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title w-100 text-center">
                  📋 Selecciona el Método de Captura
                </h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setMostrarModalMetodoCaptura(false)}
                ></button>
              </div>
              
              <div className="modal-body pt-2">
                <p className="text-center text-muted mb-4">
                  ¿Cómo deseas agregar la nueva póliza?
                </p>

                {/* Input file oculto para PDF */}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="pdfFileInput"
                  ref={(input) => {
                    if (input) {
                      input.onclick = () => {
                        // Guardar referencia para poder procesar el archivo después
                        window._pdfInputForExtractor = input;
                      };
                    }
                  }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'application/pdf') {
                      // Cerrar modal de selección
                      setMostrarModalMetodoCaptura(false);
                      // Cambiar a vista formulario
                      setVistaActual('formulario');
                      setModoEdicion(false);
                      limpiarFormulario();
                      // Guardar archivo y abrir el extractor directamente en modo automático
                      window._selectedPDFFile = file;
                      window._autoExtractorMode = true;
                      setTimeout(() => {
                        setMostrarExtractorPDF(true);
                      }, 100);
                    }
                    // NO resetear el input todavía
                  }}
                />

                <div className="row g-3">
                  {/* Opción Captura Manual */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary text-center p-3" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalMetodoCaptura(false);
                        setVistaActual('formulario');
                        setModoEdicion(false);
                        limpiarFormulario();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,110,253,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          ✍️
                        </div>
                        <h5 className="card-title text-primary mb-2">Captura Manual</h5>
                        <p className="card-text text-muted small mb-3">
                          Llena el formulario campo por campo
                        </p>
                        <button 
                          className="btn btn-primary w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalMetodoCaptura(false);
                            setVistaActual('formulario');
                            setModoEdicion(false);
                            limpiarFormulario();
                          }}
                        >
                          Captura Manual
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opción Extractor PDF */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-success text-center p-3" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        document.getElementById('pdfFileInput')?.click();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,135,84,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          📄
                        </div>
                        <h5 className="card-title text-success mb-2">Extractor PDF</h5>
                        <p className="card-text text-muted small mb-3">
                          Importa datos automáticamente desde el PDF
                        </p>
                        <button 
                          className="btn btn-success w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById('pdfFileInput')?.click();
                          }}
                        >
                          <Upload size={16} className="me-2" />
                          Importar PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-4 mb-0">
                  <small>
                    <strong>💡 Recomendación:</strong> Usa el extractor PDF para mayor velocidad y precisión. 
                    La captura manual es útil cuando no tienes el PDF de la póliza.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  aseguradoras,
  tiposProductos,
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
  subirPDFPoliza,
  mostrarExtractorPDF,
  setMostrarExtractorPDF
}) => {
  // Estados movidos al componente padre
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
        
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          clienteSeleccionadoFinal = clientes.find(c => c.id === datosExtraidos.cliente_id);
          
          if (clienteSeleccionadoFinal) {
            handleClienteSeleccionado(clienteSeleccionadoFinal);
            console.log('✅ Cliente vinculado:', clienteSeleccionadoFinal.nombre || clienteSeleccionadoFinal.razonSocial);
          } else {
            console.error('❌ No se encontró el cliente con ID:', datosExtraidos.cliente_id);
          }
        } catch (error) {
          console.error('❌ Error al buscar cliente:', error);
        }
      } else {
        console.warn('⚠️ No se proporcionó cliente_id. El cliente debe ser seleccionado manualmente.');
      }
      
      // 2. PREPARAR NOMBRE DEL AGENTE PARA MOSTRAR EN EL FORMULARIO
      // Los extractores ahora envían clave_agente y agente por separado
      // El modal de agentes ya valida y vincula al agente en el equipo de trabajo
      let agenteDisplay = '';
      if (datosExtraidos.clave_agente && datosExtraidos.agente) {
        agenteDisplay = `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}`;
        console.log('✅ Agente extraído:', agenteDisplay);
      } else if (datosExtraidos.agente) {
        agenteDisplay = datosExtraidos.agente;
        console.log('✅ Agente extraído:', agenteDisplay);
      }
      
      // 3. BUSCAR VENDEDOR/SUB-AGENTE (si aplica)
      // Los vendedores usan la misma clave que el agente al que están ligados
      // Por ahora lo dejamos vacío, se puede seleccionar manualmente
      let subAgenteId = null;
      
      // 4. POPULAR FORMULARIO CON DATOS DE LA PÓLIZA (NO sobrescribir datos del cliente)
      console.log(`📋 Extracción completa | Póliza: ${datosExtraidos.numero_poliza} | Vehículo: ${datosExtraidos.marca} ${datosExtraidos.modelo}`);
      
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

        // Concatenar agente para el formulario
        const agenteParaFormulario = datosExtraidos.clave_agente && datosExtraidos.agente 
          ? `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}` 
          : (datosExtraidos.agente || agenteDisplay || prev.agente || '');
        
        console.log('🔍 Aplicando agente al formulario:', agenteParaFormulario);

        // ✅ NORMALIZACIÓN DE COMPAÑÍA: Buscar coincidencia case-insensitive
        let companiaNormalizada = datosExtraidos.compania || prev.compania;
        if (datosExtraidos.compania) {
          const companiaEncontrada = aseguradoras.find(a => 
            a.nombre.toLowerCase() === datosExtraidos.compania.toLowerCase()
          );
          if (companiaEncontrada) {
            companiaNormalizada = companiaEncontrada.nombre;
            console.log('✅ Compañía normalizada:', datosExtraidos.compania, '→', companiaNormalizada);
          }
        }

        // ✅ NORMALIZACIÓN DE PRODUCTO: Buscar coincidencia parcial o exacta
        let productoNormalizado = datosExtraidos.producto || prev.producto;
        if (datosExtraidos.producto) {
          // Primero buscar coincidencia exacta
          let productoEncontrado = tiposProductos.find(p => 
            p.nombre.toLowerCase() === datosExtraidos.producto.toLowerCase()
          );
          
          // Si no hay coincidencia exacta, buscar coincidencia parcial (ej: "Autos" en "Tu Auto Seguro Más")
          if (!productoEncontrado) {
            productoEncontrado = tiposProductos.find(p => 
              datosExtraidos.producto.toLowerCase().includes(p.nombre.toLowerCase()) ||
              p.nombre.toLowerCase().includes(datosExtraidos.producto.toLowerCase())
            );
          }
          
          if (productoEncontrado) {
            productoNormalizado = productoEncontrado.nombre;
            console.log('✅ Producto normalizado:', datosExtraidos.producto, '→', productoNormalizado);
          }
        }

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
          // Forzar valores críticos de la póliza que vienen del PDF
          agente: agenteParaFormulario,
          clave_agente: datosExtraidos.clave_agente || prev.clave_agente || '',
          sub_agente: '',
          etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
          // Usar datos normalizados del PDF
          compania: companiaNormalizada,
          producto: productoNormalizado,
          tipo_cobertura: datosExtraidos.tipo_cobertura || datosPoliza.tipo_cobertura || prev.tipo_cobertura,
          deducible: datosExtraidos.deducible || datosPoliza.deducible || prev.deducible,
          suma_asegurada: datosExtraidos.suma_asegurada || datosPoliza.suma_asegurada || prev.suma_asegurada,
          // Vehículo
          marca: datosExtraidos.marca || datosPoliza.marca || prev.marca,
          modelo: datosExtraidos.modelo || datosPoliza.modelo || prev.modelo,
          anio: datosExtraidos.anio || datosPoliza.anio || prev.anio,
          numero_serie: datosExtraidos.numero_serie || datosPoliza.numero_serie || prev.numero_serie,
          placas: datosExtraidos.placas || datosPoliza.placas || prev.placas,
          color: datosExtraidos.color || datosPoliza.color || prev.color,
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
        
        console.log(`✅ Formulario actualizado | Cliente: ${nuevoFormulario.cliente_id || 'N/A'} | Póliza: ${nuevoFormulario.numero_poliza || 'N/A'} | Vehículo: ${nuevoFormulario.marca} ${nuevoFormulario.modelo} ${nuevoFormulario.anio}`);
        
        return nuevoFormulario;
      });
      
      // 5. RECALCULAR FECHAS Y MONTOS AUTOMÁTICOS (incluye estatusPago)
      if (datosExtraidos.inicio_vigencia) {
        setTimeout(() => {
          setFormulario(prev => {
            const formularioConCalculos = actualizarCalculosAutomaticos(prev);
            // ✅ SOLO aplicar los cálculos automáticos, NO sobrescribir datos del PDF
            // Los datos del PDF ya están en 'prev' del setFormulario anterior
            const formularioFinal = {
              ...prev,
              ...formularioConCalculos
              // NO sobrescribir nada más - los datos del PDF ya están en 'prev'
            };
            
            return formularioFinal;
          });
          console.log('✅ Cálculos automáticos aplicados (preservando datos del PDF)');
          
          // 🔍 MARCAR que el snapshot debe guardarse después de que el formulario termine de actualizarse
          setTimeout(() => {
            globalSnapshotPendiente = true;
            console.log('📸 Snapshot pendiente - se guardará en próximo render');
          }, 200);
        }, 150);
      } else {
        // FORZAR la actualización después de un pequeño delay
        setTimeout(() => {
          setFormulario(prev => ({
            ...prev,
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteDisplay || '',
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
          
          // 🔍 MARCAR que el snapshot debe guardarse (modo fallback)
          setTimeout(() => {
            globalSnapshotPendiente = true;
            console.log('📸 Snapshot pendiente (fallback) - se guardará en próximo render');
          }, 150);
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
        agenteAsignado: !!agenteDisplay,
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
      console.log('  Agente:', agenteDisplay ? `✅ ${agenteDisplay}` : '⚠️ No extraído del PDF');
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
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0" style={{ fontSize: '1.1rem' }}>
          {modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente'}
        </h5>
        <div className="d-flex gap-2">
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary btn-sm"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ fontSize: '0.85rem' }}>
          <style>{`
            .card-body .form-label { margin-bottom: 0.25rem; font-size: 0.8rem; }
            .card-body .form-control, 
            .card-body .form-select { 
              padding: 0.25rem 0.5rem; 
              font-size: 0.85rem;
              height: calc(1.5em + 0.5rem + 2px);
            }
            .card-body .row { margin-bottom: 0.5rem; }
            .card-body h6.card-title { font-size: 0.9rem; }
            .card-body h6 { font-size: 0.85rem; }
            .card-body .alert { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
            .card-body hr { margin: 0.5rem 0; }
          `}</style>
          {datosImportadosDesdePDF && !modoEdicion && infoImportacion && (
            <div className="alert alert-success alert-dismissible fade show mb-2 py-2 px-3" role="alert" style={{ fontSize: '0.8rem' }}>
              <CheckCircle className="me-2" size={16} />
              <div>
                <strong>✅ Datos importados desde PDF exitosamente</strong>
                <ul className="mb-0 mt-1" style={{ fontSize: '0.75rem' }}>
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
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>
              {clienteSeleccionado?.tipoPersona === 'Persona Moral' ? 'Datos de la Empresa' : 'Datos del Cliente'}
            </h6>
            
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
              <div className="row g-2 mt-1" key={clienteSeleccionado.id}>
                {clienteSeleccionado.tipoPersona === 'Persona Moral' ? (
                  // Campos para Persona Moral (Empresa)
                  <>
                    <div className="col-md-12">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Razón Social</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.razon_social || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre Comercial</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.nombre_comercial || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>RFC</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.rfc || ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Datos de Contacto - Editables */}
                    <div className="col-12">
                      <hr className="my-2" />
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        💼 Datos del Contacto Principal
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Editable - Se actualizará el cliente)
                        </span>
                      </small>
                      <div className="alert alert-info py-1 px-2 mb-2" role="alert" style={{ fontSize: '0.7rem' }}>
                        Requisito mínimo para guardar póliza (PM): <strong>Nombre</strong> y <strong>Email</strong> o <strong>Teléfono Móvil</strong>.
                      </div>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre del Contacto <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
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
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email del Contacto <span className="text-muted" style={{ fontSize: '0.7rem' }}>(uno de estos)</span></label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil <span className="text-muted" style={{ fontSize: '0.7rem' }}>(uno de estos)</span></label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
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
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        👤 Datos del Cliente
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Solo lectura)
                        </span>
                      </small>
                    </div>
                    
                    {/* Primera fila: Nombre, Apellidos y RFC */}
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.nombre ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.apellido_paterno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.apellido_materno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>RFC</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.rfc ?? ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Segunda fila: Email y Teléfonos */}
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.email || ''}
                        onChange={(e) => setFormulario({...formulario, email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_fijo: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    
                    {/* Datos de Contacto Adicional/Gestor - Editables */}
                    <div className="col-12">
                      <hr className="my-2" />
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        💼 Contacto Adicional / Gestor
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Opcional - Editable)
                        </span>
                      </small>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre del Contacto</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_nombre || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_nombre: e.target.value})}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_apellido_paterno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_paterno: e.target.value})}
                        placeholder="Apellido Paterno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_apellido_materno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_materno: e.target.value})}
                        placeholder="Apellido Materno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email del Contacto</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
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
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Datos del Seguro</h6>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Compañía <span className="text-danger">*</span></label>
                <select
                  className="form-select form-select-sm"
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

          {(() => {
            // Verificar si el producto es de tipo autos
            if (!formulario.producto) return false;
            const producto = tiposProductos.find(p => p.id === formulario.producto);
            return producto && producto.nombre && producto.nombre.toUpperCase().includes('AUTO');
          })() && (
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
          {(() => {
            // Verificar si el producto es de tipo autos
            if (!formulario.producto) return false;
            const producto = tiposProductos.find(p => p.id === formulario.producto);
            return producto && producto.nombre && producto.nombre.toUpperCase().includes('AUTO');
          })() && (
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
                <div className="col-md-4">
                  <label className="form-label">Número de Motor</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.motor || ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, motor: e.target.value.toUpperCase() }))}
                    placeholder="Número de motor"
                  />
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

          {/* Datos de la Póliza - Visible para Autos o si ya existen valores (edición) */}
          {(formulario.producto === 'Autos Individual' || formulario.uso || formulario.servicio || formulario.movimiento) && (
            <div className="mb-2">
              <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Datos de la Póliza</h6>
              <div className="row g-2">
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
                <input
                  type="text"
                  className="form-control"
                  value={formulario.agente ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, agente: e.target.value }))}
                  placeholder="Clave y nombre del agente"
                />
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
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Fechas y Vigencia</h6>
            <div className="row g-2">
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Fecha de Emisión</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formulario.fecha_emision || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_emision: e.target.value }))}
                />
                <small className="form-text text-muted" style={{ fontSize: '0.65rem' }}>
                  Fecha en que se emitió la póliza
                </small>
              </div>
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Fecha de Captura</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formulario.fecha_captura || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_captura: e.target.value }))}
                />
                <small className="form-text text-muted" style={{ fontSize: '0.65rem' }}>
                  Fecha de registro en el sistema
                </small>
              </div>
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Inicio de Vigencia</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formulario.inicio_vigencia ?? ''}
                  onChange={(e) => {
                    const nuevoFormulario = { ...formulario, inicio_vigencia: e.target.value };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                />
              </div>
              <div className="col-md-3">
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
              <div className="col-md-3">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>📅 Aviso de Renovación</label>
                <input
                  type="date"
                  className="form-control form-control-sm bg-light"
                  value={formulario.fecha_aviso_renovacion || ''}
                  readOnly
                  disabled
                  style={{ cursor: 'not-allowed' }}
                />
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>Se calcula automáticamente (Término - 30 días)</small>
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
                      const diasGracia = valor === '' ? 0 : Math.max(0, parseInt(valor, 10) || 0);
                      
                      setFormulario(prev => {
                        // Si tiene inicio_vigencia, recalcular fecha_pago
                        let nuevaFechaPago = prev.fecha_vencimiento_pago || prev.fecha_pago;
                        
                        if (prev.inicio_vigencia) {
                          const fechaInicio = new Date(prev.inicio_vigencia);
                          fechaInicio.setDate(fechaInicio.getDate() + diasGracia);
                          nuevaFechaPago = fechaInicio.toISOString().split('T')[0];
                        }
                        
                        // Calcular estatus de pago inline
                        let nuevoEstatus = prev.estatusPago;
                        if (nuevoEstatus !== 'Pagado' && nuevaFechaPago) {
                          const fechaPago = new Date(nuevaFechaPago);
                          const hoy = new Date();
                          hoy.setHours(0, 0, 0, 0);
                          fechaPago.setHours(0, 0, 0, 0);
                          const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
                          
                          if (diasRestantes < 0) {
                            nuevoEstatus = 'Vencido';
                          } else if (diasRestantes <= 15) {
                            nuevoEstatus = 'Por Vencer';
                          } else {
                            nuevoEstatus = 'Pendiente';
                          }
                        }
                        
                        return {
                          ...prev,
                          periodo_gracia: diasGracia,
                          fecha_vencimiento_pago: nuevaFechaPago,
                          fecha_pago: nuevaFechaPago,
                          estatusPago: nuevoEstatus
                        };
                      });
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
                      : 'Editable para pruebas'}
                </small>
              </div>
              
              <div className="col-md-3">
                <label className="form-label">Fecha Límite de Pago</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.fecha_vencimiento_pago || ''}
                  onChange={(e) => {
                    const nuevaFecha = e.target.value;
                    
                    setFormulario(prev => {
                      // Calcular periodo de gracia basado en la diferencia con inicio_vigencia
                      let nuevoPeriodoGracia = prev.periodo_gracia || 0;
                      
                      if (prev.inicio_vigencia && nuevaFecha) {
                        const fechaInicio = new Date(prev.inicio_vigencia);
                        const fechaPago = new Date(nuevaFecha);
                        fechaInicio.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        
                        const diferenciaDias = Math.ceil((fechaPago - fechaInicio) / (1000 * 60 * 60 * 24));
                        nuevoPeriodoGracia = Math.max(0, diferenciaDias);
                      }
                      
                      // Calcular estatus de pago inline
                      let nuevoEstatus = prev.estatusPago;
                      if (nuevoEstatus !== 'Pagado' && nuevaFecha) {
                        const fechaPago = new Date(nuevaFecha);
                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
                        
                        if (diasRestantes < 0) {
                          nuevoEstatus = 'Vencido';
                        } else if (diasRestantes <= 15) {
                          nuevoEstatus = 'Por Vencer';
                        } else {
                          nuevoEstatus = 'Pendiente';
                        }
                      }
                      
                      return {
                        ...prev,
                        fecha_vencimiento_pago: nuevaFecha,
                        fecha_pago: nuevaFecha,
                        periodo_gracia: nuevoPeriodoGracia,
                        estatusPago: nuevoEstatus,
                        _fechaManual: true // Bandera para evitar recálculo automático
                      };
                    });
                  }}
                />
                <small className="text-muted">
                  Editable - Recalcula periodo de gracia
                </small>
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

              {/* Campo de Fecha de Pago - Solo si está marcado como Pagado */}
              {formulario.estatusPago === 'Pagado' && (
                <div className="col-md-6">
                  <label className="form-label">
                    Fecha de Pago
                    <small className="text-muted ms-2">(¿Cuándo se pagó?)</small>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formulario.fecha_ultimo_pago || ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, fecha_ultimo_pago: e.target.value }))}
                  />
                  <small className="text-muted d-block mt-1">
                    Si no se especifica, se usará la fecha de captura
                  </small>
                </div>
              )}

              {/* Mostrar calendario para Fraccionado y Anual */}
              {formulario.inicio_vigencia && (
                (formulario.tipo_pago === 'Fraccionado' && formulario.frecuenciaPago) || 
                formulario.tipo_pago === 'Anual'
              ) && (
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
              className="btn btn-outline-secondary btn-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarExpediente}
              className="btn btn-primary btn-sm"
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
            aseguradoras={aseguradoras}
            tiposProductos={tiposProductos}
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
  abrirModalCompartir,
  enviarAvisoPago,
  historial = [] // Historial del expediente
}) => {
  const [clienteInfo, setClienteInfo] = useState(null);
  
  // Debug: verificar que el historial llega correctamente
  useEffect(() => {
    console.log('🔍 DetallesExpediente - Historial recibido:', {
      cantidad: historial?.length || 0,
      historial: historial,
      expediente_id: expedienteSeleccionado?.id
    });
  }, [historial, expedienteSeleccionado?.id]);
  
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
         ['Emitida', 'Renovada', 'Enviada al Cliente', 'Vencida'].includes(expedienteSeleccionado.etapa_activa) && 
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

        {expedienteSeleccionado && (
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
            {/* Mostrar calendario para Fraccionado y Anual */}
            {expedienteSeleccionado.inicio_vigencia && (
              (expedienteSeleccionado.tipo_pago === 'Fraccionado' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
              expedienteSeleccionado.tipo_pago === 'Anual' ||
              (expedienteSeleccionado.forma_pago?.toUpperCase() === 'FRACCIONADO' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
              expedienteSeleccionado.forma_pago?.toUpperCase() === 'ANUAL'
            ) && (
              <div className="col-12">
                <CalendarioPagos 
                  key={`calendario-${expedienteSeleccionado?.id}-${historial?.length || 0}`}
                  expediente={expedienteSeleccionado}
                  calcularProximoPago={calcularProximoPago}
                  mostrarResumen={true}
                  onEnviarAviso={enviarAvisoPago}
                  historial={historial}
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
  
  // 💰 Estados para aviso/recordatorio de pago
  const [pagoParaNotificar, setPagoParaNotificar] = useState(null);
  const [expedienteDelPago, setExpedienteDelPago] = useState(null);
  const [mostrarModalAvisoPago, setMostrarModalAvisoPago] = useState(false);
  
  // Estados para flujo de renovación
  const [mostrarModalCotizarRenovacion, setMostrarModalCotizarRenovacion] = useState(false);
  const [mostrarModalAutorizarRenovacion, setMostrarModalAutorizarRenovacion] = useState(false);
  const [mostrarModalPolizaRenovada, setMostrarModalPolizaRenovada] = useState(false);
  const [expedienteParaRenovacion, setExpedienteParaRenovacion] = useState(null);
  const [datosRenovacion, setDatosRenovacion] = useState({
    numeroPolizaNueva: '',
    primaNueva: '',
    totalNuevo: '',
    fechaEmisionNueva: '',
    inicioVigenciaNueva: '',
    terminoVigenciaNueva: '',
    observaciones: ''
  });
  
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
    
    // Exponer función global para recargar agentes desde el modal de extracción
    window.recargarAgentes = (nuevosAgentes) => {
      const agentesOrdenados = nuevosAgentes.sort((a, b) => {
        const nombreA = `${a.nombre} ${a.apellido_paterno}`.toLowerCase();
        const nombreB = `${b.nombre} ${b.apellido_paterno}`.toLowerCase();
        return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
      });
      setAgentes(agentesOrdenados);
    };
    
    // Cleanup
    return () => {
      delete window.recargarAgentes;
    };
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
        
        // 4. Normalizar estatusPago respetando el valor de la BD
        const expedientesProcesados = expedientesData.map(exp => {
          // ✅ RESPETAR EL ESTATUS QUE VIENE DE LA BASE DE DATOS
          let estatusPagoCalculado = exp.estatus_pago || exp.estatusPago;
          
          // Normalizar para comparación (case-insensitive)
          const estatusNormalizado = (estatusPagoCalculado || '').toLowerCase().trim();
          
          // Normalizar variaciones a formato estándar
          if (estatusNormalizado === 'pagado' || estatusNormalizado === 'pagada') {
            estatusPagoCalculado = 'Pagado';
          } else if (estatusNormalizado === 'cancelado' || estatusNormalizado === 'cancelada') {
            estatusPagoCalculado = 'Cancelado';
          } else if (estatusNormalizado === 'vencido' || estatusNormalizado === 'vencida') {
            estatusPagoCalculado = 'Vencido';
          } else if (estatusNormalizado === 'por vencer') {
            estatusPagoCalculado = 'Por Vencer';
          } else if (estatusNormalizado === 'pendiente') {
            estatusPagoCalculado = 'Pendiente';
          } else if (estatusPagoCalculado) {
            // Si tiene algún valor que no reconocemos, mantenerlo y solo normalizar capitalización
            estatusPagoCalculado = estatusPagoCalculado.charAt(0).toUpperCase() + estatusPagoCalculado.slice(1).toLowerCase();
            console.log(`⚠️ Estatus no reconocido pero preservado: "${estatusPagoCalculado}" en póliza ${exp.numero_poliza}`);
          } else {
            // Solo si NO viene ningún estatus, calcular basándose en la fecha
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
  
  // 💰 Funciones para aviso/recordatorio de pago
  const enviarAvisoPago = useCallback((pago, expediente) => {
    setPagoParaNotificar(pago);
    setExpedienteDelPago(expediente);
    setMostrarModalAvisoPago(true);
  }, []);
  
  const cerrarModalAvisoPago = useCallback(() => {
    setMostrarModalAvisoPago(false);
    setPagoParaNotificar(null);
    setExpedienteDelPago(null);
  }, []);
  
  const [vistaActual, setVistaActual] = useState('lista');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [expedienteACancelar, setExpedienteACancelar] = useState(null);
  const [mostrarModalMetodoCaptura, setMostrarModalMetodoCaptura] = useState(false);
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  
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
  const [fechaUltimoPago, setFechaUltimoPago] = useState(''); // Fecha en que realmente se pagó
  const [numeroReciboPago, setNumeroReciboPago] = useState(1); // Número de recibo a pagar (para fraccionados)
  const [historialExpediente, setHistorialExpediente] = useState([]); // Historial del expediente seleccionado
  
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
    'En Vigencia',
    'Renovación en Proceso',
    'Renovada',
    'Vencida',
    'Cancelada'
  ], []);


  const tiposPago = useMemo(() => ['Anual', 'Fraccionado'], []);
  const frecuenciasPago = useMemo(() => Object.keys(CONSTANTS.PAGOS_POR_FRECUENCIA).sort(), []);
  const periodosGracia = useMemo(() => [14, 30], []);
  const estatusPago = useMemo(() => ['Pendiente', 'Por Vencer', 'Vencido', 'Pagado', 'Cancelado'], []);
  const motivosCancelacion = useMemo(() => [
    'Cliente desistió',
    'Documentación incompleta',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Precio muy alto',
    'Otro'
  ], []);

  const tiposVehiculo = useMemo(() => ['Deportivo', 'Hatchback', 'Pickup', 'Sedán', 'SUV', 'Vagoneta', 'Otro'].sort(), []);
  const tiposCobertura = useMemo(() => ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)', 'Integral'].sort(), []);
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
  const [formularioOriginal, setFormularioOriginal] = useState(null); // Snapshot al abrir edición
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const debugLogOnceRef = useRef(false);

  // 📸 Capturar snapshot cuando el formulario esté completamente cargado en modo edición
  // 📸 CAPTURAR SNAPSHOT cuando el formulario termine de cargarse (PDF + BD + Cálculos)
  useEffect(() => {
    // Si hay un snapshot pendiente Y el formulario está listo
    if (globalSnapshotPendiente && formulario) {
      // Verificar que los datos están completos (o al menos tiene algo cargado)
      const tieneNumeroPoliza = formulario.numero_poliza;
      const tieneCompania = formulario.compania;
      
      if (tieneNumeroPoliza && tieneCompania) {
        console.log('📸 Capturando snapshot del formulario completo:', {
          numero_poliza: formulario.numero_poliza,
          compania: formulario.compania,
          contacto_nombre: formulario.contacto_nombre,
          fecha_emision: formulario.fecha_emision,
          total_campos: Object.keys(formulario).filter(k => !k.startsWith('_')).length
        });
        setFormularioOriginal(JSON.parse(JSON.stringify(formulario)));
        globalSnapshotPendiente = false;
      }
    }
  }, [formulario]); // Se ejecuta cada vez que el formulario cambia
  
  // Limpiar flag cuando se cambia de vista
  useEffect(() => {
    if (vistaActual !== 'formulario') {
      globalSnapshotPendiente = false;
    }
  }, [modoEdicion]);

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

  // 🎯 RECALCULAR automáticamente campos derivados cuando cambian las fechas de vigencia
  useEffect(() => {
    // Solo recalcular si estamos en el formulario y hay fechas válidas
    if (vistaActual !== 'formulario' || !formulario.inicio_vigencia) return;
    
    const recalcularCamposDependientes = () => {
      // 1. Calcular término de vigencia (inicio + 1 año)
      const fechaInicio = new Date(formulario.inicio_vigencia);
      const fechaTermino = new Date(fechaInicio);
      fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
      const nuevoTermino = fechaTermino.toISOString().split('T')[0];
      
      // 2. Calcular aviso de renovación (30 días antes del término)
      const fechaAviso = new Date(nuevoTermino);
      fechaAviso.setDate(fechaAviso.getDate() - 30);
      const nuevoAviso = fechaAviso.toISOString().split('T')[0];
      
      // 3. Calcular próximo pago (inicio + periodo de gracia)
      const periodoGracia = formulario.periodo_gracia 
        ? parseInt(formulario.periodo_gracia, 10)
        : (formulario.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
      
      const fechaPago = new Date(fechaInicio);
      fechaPago.setDate(fechaPago.getDate() + periodoGracia);
      const nuevoProximoPago = fechaPago.toISOString().split('T')[0];
      
      // 4. Calcular estatus de pago
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaVenc = new Date(nuevoProximoPago);
      fechaVenc.setHours(0, 0, 0, 0);
      
      let nuevoEstatus = 'Pendiente';
      if (formulario.estatusPago === 'Pagado') {
        nuevoEstatus = 'Pagado';
      } else if (fechaVenc < hoy) {
        nuevoEstatus = 'Vencido';
      } else if (Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24)) <= 15) {
        nuevoEstatus = 'Por Vencer';
      }
      
      // Solo actualizar si cambió algo
      if (formulario.termino_vigencia !== nuevoTermino ||
          formulario.fecha_aviso_renovacion !== nuevoAviso ||
          formulario.proximoPago !== nuevoProximoPago ||
          formulario.fecha_pago !== nuevoProximoPago ||
          formulario.fecha_vencimiento_pago !== nuevoProximoPago ||
          formulario.estatusPago !== nuevoEstatus) {
        
        setFormulario(prev => ({
          ...prev,
          termino_vigencia: nuevoTermino,
          fecha_aviso_renovacion: nuevoAviso,
          proximoPago: nuevoProximoPago,
          fecha_pago: nuevoProximoPago,
          fecha_vencimiento_pago: nuevoProximoPago,
          estatusPago: nuevoEstatus
        }));
      }
    };
    
    recalcularCamposDependientes();
  }, [formulario.inicio_vigencia, formulario.compania, formulario.periodo_gracia, vistaActual]);

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
    // Cálculos automáticos de vigencias y fechas
    
    // ✅ Siempre recalcular el término de vigencia a partir del inicio
    // Esto permite que el formulario reaccione cuando el usuario edita inicio_vigencia
    const termino_vigencia = calculartermino_vigencia(formularioActual.inicio_vigencia);
    
    
    // Calcular periodo de gracia: usar valor extraído del PDF si existe (convertir a número), sino aplicar regla de negocio
    const periodoGracia = formularioActual.periodo_gracia 
      ? parseInt(formularioActual.periodo_gracia, 10)
      : (formularioActual.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    // ⚠️ Si la fecha fue editada manualmente, NO recalcular
    if (formularioActual._fechaManual) {
      console.log('⏭️ Saltando recálculo automático - Fecha editada manualmente');
      const resultado = {
        ...formularioActual,
        termino_vigencia,
        periodo_gracia: periodoGracia
      };
      delete resultado._fechaManual; // Limpiar bandera temporal
      return resultado;
    }
    
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
    
    // ✨ Calcular fecha_aviso_renovacion (30 días antes del término de vigencia)
    let fechaAvisoRenovacion = null;
    if (termino_vigencia) {
      const fechaTermino = new Date(termino_vigencia);
      fechaTermino.setDate(fechaTermino.getDate() - 30);
      fechaAvisoRenovacion = fechaTermino.toISOString().split('T')[0];
    }
    
    // Retornar con todos los campos sincronizados
    const resultado = { 
      ...formularioActual, 
      termino_vigencia, 
      proximoPago, 
      fecha_pago: proximoPago, // Sincronizar fecha_pago con proximoPago
      fecha_vencimiento_pago: proximoPago, // Asegurar que fecha_vencimiento_pago esté sincronizada
      estatusPago, 
      periodo_gracia: periodoGracia,
      fecha_aviso_renovacion: fechaAvisoRenovacion // Precalcular fecha de aviso
    };
    

    
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
      
      // ✅ IMPORTANTE: Si se cancela la póliza, asignar fecha_cancelacion Y cambiar estatus de pago
      if (nuevoEstado === 'Cancelada') {
        datosActualizacion.fecha_cancelacion = new Date().toISOString().split('T')[0];
        datosActualizacion.estatus_pago = 'Cancelado';
        console.log('📅 Asignando fecha_cancelacion:', datosActualizacion.fecha_cancelacion);
        console.log('💳 Cambiando estatus_pago a: Cancelado');
      }
      
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
        // Determinar el tipo de evento según el cambio de etapa
        let tipoEvento = historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS; // Default
        let descripcion = motivo ? `Motivo: ${motivo}` : undefined;
        
        // Mapear etapas a eventos específicos
        // TODO: Cuando implementemos módulo de cotizaciones, agregar aquí:
        // - Botón "Enviar cotización" → cambia a 'Cotización enviada' + COTIZACION_ENVIADA
        // - Botón "Autorizar" → cambia a 'Autorizado' + COTIZACION_AUTORIZADA
        // - Botón "Iniciar emisión" → cambia a 'En proceso emisión' + EMISION_INICIADA
        
        if (nuevoEstado === 'Cotización enviada' && etapaAnterior === 'En cotización') {
          tipoEvento = historialService.TIPOS_EVENTO.COTIZACION_ENVIADA;
          descripcion = 'Cotización enviada al cliente para revisión';
        } else if (nuevoEstado === 'Autorizado' && etapaAnterior === 'Cotización enviada') {
          tipoEvento = historialService.TIPOS_EVENTO.COTIZACION_AUTORIZADA;
          descripcion = 'Cotización autorizada por el cliente';
        } else if (nuevoEstado === 'En proceso emisión') {
          tipoEvento = historialService.TIPOS_EVENTO.EMISION_INICIADA;
          descripcion = 'Proceso de emisión de póliza iniciado';
        } else if (nuevoEstado === 'Emitida' && etapaAnterior !== 'Enviada al Cliente') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_EMITIDA;
          descripcion = 'Póliza emitida correctamente';
        } else if (nuevoEstado === 'Renovación en Proceso') {
          tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_INICIADA;
          descripcion = 'Renovación de póliza iniciada - pendiente de pago';
        } else if (nuevoEstado === 'Renovada') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_RENOVADA;
          descripcion = 'Póliza renovada exitosamente - pago aplicado';
        } else if (nuevoEstado === 'Cancelada') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_CANCELADA;
          descripcion = motivo ? `Motivo: ${motivo}` : 'Póliza cancelada sin especificar motivo';
        }
        
        await historialService.registrarCambioEtapa(
          expedienteId,
          expedienteActual?.cliente_id,
          etapaAnterior,
          nuevoEstado,
          'Sistema', // TODO: Obtener nombre del usuario actual
          descripcion,
          tipoEvento
        );
        console.log(`✅ Evento "${tipoEvento}" registrado en historial de trazabilidad`);
      } catch (error) {
        console.error('⚠️ Error al registrar cambio de etapa en historial:', error);
      }

      // Actualizar localmente
      setExpedientes(prev => prev.map(exp => {
        if (exp.id === expedienteId) {
          // Combinar los datos actualizados y normalizar nombres de campos
          const expedienteActualizado = { ...exp, ...datosActualizacion };
          
          // Si se actualizó estatus_pago, también actualizar estatusPago para el frontend
          if (datosActualizacion.estatus_pago) {
            expedienteActualizado.estatusPago = datosActualizacion.estatus_pago;
          }
          
          return expedienteActualizado;
        }
        return exp;
      }));
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

  // ✨ Verificar vigencias y registrar eventos automáticos
  const verificarVigenciasAutomaticas = useCallback(async (expedientesLista) => {
    // TODO: Implementar como job programado en el backend
    // Por ahora solo registra eventos si detecta cambios
    console.log('🔍 Verificación de vigencias pendiente (implementar en backend)');
    
    // La lógica ya existe en:
    // - utils.calcularDiasRestantes() para calcular días
    // - useEstatusExpediente para calcular estatus de pago
    // Solo falta conectar con eventos de historial cuando se implemente job automático
  }, []);

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
      
      // ✅ VALIDAR que el número tenga al menos 10 dígitos y solo contenga números
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        toast.error(`❌ El número de teléfono "${telefono}" no es válido para WhatsApp.\n\nDebe contener entre 10 y 15 dígitos.\n\nPor favor, actualiza el teléfono del cliente.`);
        console.error('❌ Número de teléfono inválido:', telefono, '→', telefonoLimpio);
        return;
      }
      
      console.log('✅ Número de teléfono válido:', telefonoLimpio);
      
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

      // Obtener nombre del cliente (empresa o persona física)
      const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
        ? cliente.razonSocial || cliente.razon_social
        : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;

      // Obtener nombre del contacto principal (si existe)
      const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
      const nombreContactoPrincipal = tieneContactoPrincipal
        ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
        : '';

      // Construir el nombre del destinatario: Empresa (Contacto) o solo Nombre
      const nombreDestinatario = nombreContactoPrincipal 
        ? `${nombreCliente} (${nombreContactoPrincipal})`
        : nombreCliente;

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
          destinatario_nombre: nombreDestinatario,
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
          { nombre: nombreDestinatario, contacto: telefono },
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

        // Obtener nombre del cliente (empresa o persona física)
        const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;

        // Obtener nombre del contacto principal (si existe)
        const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
        const nombreContactoPrincipal = tieneContactoPrincipal
          ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
          : '';

        // Construir el nombre del destinatario: Empresa (Contacto) o solo Nombre
        const nombreDestinatario = nombreContactoPrincipal 
          ? `${nombreCliente} (${nombreContactoPrincipal})`
          : nombreCliente;

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
            destinatario_nombre: nombreDestinatario,
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
            { nombre: nombreDestinatario, contacto: email },
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

  // 💰 Enviar aviso de pago por WhatsApp
  const enviarAvisoPagoWhatsApp = useCallback(async (pago, expediente) => {
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
      
      if (!telefono) {
        toast.error('El cliente no tiene teléfono móvil registrado');
        return;
      }

      // Limpiar el número de teléfono
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Validar formato
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        toast.error(`El número de teléfono "${telefono}" no es válido para WhatsApp`);
        return;
      }
      
      // Generar mensaje personalizado
      const esVencido = pago.estado === 'Vencido';
      const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
        ? cliente.razonSocial || cliente.razon_social
        : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;
      
      const mensaje = `Hola ${nombreCliente},\n\n` +
        `${esVencido ? '⚠️ *RECORDATORIO DE PAGO VENCIDO*' : '📋 *AVISO DE PAGO PRÓXIMO*'}\n\n` +
        `Póliza: *${expediente.numero_poliza || 'Sin número'}*\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `*Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}*\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: *$${pago.monto}*\n` +
        `Estado: ${pago.estado}\n\n` +
        `${esVencido 
          ? '⚠️ *IMPORTANTE:* Este pago está vencido. En caso de algún siniestro, *no tendremos cobertura de la compañía aseguradora*. Por favor, regulariza tu situación lo antes posible para reactivar tu protección.' 
          : '📅 *IMPORTANTE:* Te recordamos que tu próximo pago está próximo a vencer. Es fundamental registrar tu pago a tiempo para *no perder la cobertura* de tu póliza y mantener tu protección activa.'
        }\n\n` +
        `Para cualquier duda o realizar tu pago, estamos a tus órdenes.\n\n` +
        `Saludos cordiales`;
      
      // Crear URL de WhatsApp
      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      
      // Abrir WhatsApp
      window.open(url, '_blank');
      
      // Obtener nombre del contacto principal
      const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
      const nombreContactoPrincipal = tieneContactoPrincipal
        ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
        : '';
      
      const nombreDestinatario = nombreContactoPrincipal 
        ? `${nombreCliente} (${nombreContactoPrincipal})`
        : nombreCliente;
      
      // Registrar la notificación en el sistema de notificaciones
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.WHATSAPP,
          tipo_mensaje: esVencido 
            ? notificacionesService.TIPOS_MENSAJE.PAGO_VENCIDO 
            : notificacionesService.TIPOS_MENSAJE.RECORDATORIO_PAGO,
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          mensaje: mensaje,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: pago.estado,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación de pago registrada');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
      }
      
      // Registrar evento en el historial de trazabilidad
      try {
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: esVencido 
            ? historialService.TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO 
            : historialService.TIPOS_EVENTO.AVISO_PAGO_ENVIADO,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por WhatsApp (${telefono})`,
          metodo_contacto: 'WhatsApp',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          datos_adicionales: {
            canal: 'WhatsApp',
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'recordatorio' : 'aviso'
          }
        });
        console.log('✅ Evento de pago registrado en trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      toast.success(`✅ ${esVencido ? 'Recordatorio' : 'Aviso'} enviado por WhatsApp a ${nombreCliente}`);
      cerrarModalAvisoPago();
      
      // 🔄 Recargar historial automáticamente después de 1.5 segundos
      setTimeout(() => {
        // Disparar evento personalizado para que TimelineExpediente recargue
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada');
      }, 1500);
      
    } catch (error) {
      console.error('Error al enviar aviso por WhatsApp:', error);
      toast.error('Error al enviar aviso por WhatsApp');
    }
  }, [cerrarModalAvisoPago]);

  // 💰 Enviar aviso de pago por Email
  const enviarAvisoPagoEmail = useCallback(async (pago, expediente) => {
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
      
      if (!email) {
        toast.error('El cliente no tiene email registrado');
        return;
      }
      
      // Generar mensaje personalizado
      const esVencido = pago.estado === 'Vencido';
      const nombreCliente = cliente.tipoPersona === 'Persona Moral' 
        ? cliente.razonSocial || cliente.razon_social
        : `${cliente.nombre} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`;
      
      const asunto = esVencido 
        ? `⚠️ Recordatorio: Pago Vencido - Póliza ${expediente.numero_poliza}`
        : `📋 Aviso: Próximo Pago - Póliza ${expediente.numero_poliza}`;
      
      const cuerpo = `Estimado/a ${nombreCliente},\n\n` +
        `${esVencido ? 'Le recordamos que tiene un pago vencido:' : 'Le notificamos sobre su próximo pago:'}\n\n` +
        `Póliza: ${expediente.numero_poliza || 'Sin número'}\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: $${pago.monto}\n` +
        `Estado: ${pago.estado}\n\n` +
        `${esVencido 
          ? '⚠️ IMPORTANTE: Este pago está vencido. En caso de presentarse algún siniestro, NO TENDREMOS COBERTURA de la compañía aseguradora. Le solicitamos regularizar su situación lo antes posible para reactivar su protección y evitar inconvenientes.' 
          : '📋 IMPORTANTE: Le recordamos que este pago está próximo a vencer. Es fundamental realizar su pago en tiempo y forma para NO PERDER LA COBERTURA de su póliza y mantener su protección activa sin interrupciones.'
        }\n\n` +
        `Para realizar su pago o cualquier aclaración, estamos a sus órdenes.\n\n` +
        `Saludos cordiales`;
      
      // Obtener nombre del contacto principal
      const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
      const nombreContactoPrincipal = tieneContactoPrincipal
        ? `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim()
        : '';
      
      const nombreDestinatario = nombreContactoPrincipal 
        ? `${nombreCliente} (${nombreContactoPrincipal})`
        : nombreCliente;
      
      // Registrar la notificación en el sistema de notificaciones
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.EMAIL,
          tipo_mensaje: esVencido 
            ? notificacionesService.TIPOS_MENSAJE.PAGO_VENCIDO 
            : notificacionesService.TIPOS_MENSAJE.RECORDATORIO_PAGO,
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: email,
          asunto: asunto,
          mensaje: cuerpo,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: pago.estado,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación de pago registrada');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
      }
      
      // Registrar evento en el historial de trazabilidad
      try {
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: esVencido 
            ? historialService.TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO 
            : historialService.TIPOS_EVENTO.AVISO_PAGO_ENVIADO,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por Email (${email})`,
          metodo_contacto: 'Email',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: email,
          datos_adicionales: {
            canal: 'Email',
            asunto: asunto,
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'recordatorio' : 'aviso'
          }
        });
        console.log('✅ Evento de pago registrado en trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      // Abrir cliente de email con mailto
      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.location.href = mailtoUrl;
      
      toast.success(`✅ ${esVencido ? 'Recordatorio' : 'Aviso'} enviado por Email a ${nombreCliente}`);
      cerrarModalAvisoPago();
      
      // 🔄 Recargar historial automáticamente después de 1.5 segundos
      setTimeout(() => {
        // Disparar evento personalizado para que TimelineExpediente recargue
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada');
      }, 1500);
      
    } catch (error) {
      console.error('Error al enviar aviso por Email:', error);
      toast.error('Error al enviar aviso por Email');
    }
  }, [cerrarModalAvisoPago]);

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
      
      // 🔥 Usar el número de recibo pagado directamente
      const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
      
      if (ultimoReciboPagado === 0) {
        // ✅ Si no hay recibos pagados, calcular el pago #1
        return calcularProximoPago(
          expediente.inicio_vigencia, 
          expediente.tipo_pago, 
          expediente.frecuenciaPago, 
          expediente.compania, 
          1,
          periodoGracia  // 🔥 Pasar periodo de gracia
        );
      }
      
      // El siguiente recibo es el número siguiente al último pagado
      const siguienteNumeroRecibo = ultimoReciboPagado + 1;
      
      return calcularProximoPago(
        expediente.inicio_vigencia,
        expediente.tipo_pago,
        expediente.frecuenciaPago,
        expediente.compania,
        siguienteNumeroRecibo,
        periodoGracia  // 🔥 Pasar periodo de gracia
      );
    }
    
    return '';
  }, [calcularProximoPago]);

  // Función para abrir modal de pago
  const aplicarPago = useCallback((expedienteId) => {
    const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
    if (!expedienteActual) return;
    
    // Calcular fecha límite del pago pendiente (default para fecha de pago)
    const fechaLimite = expedienteActual.fecha_vencimiento_pago || 
                        expedienteActual.proximo_pago || 
                        new Date().toISOString().split('T')[0];
    
    // 🔥 Calcular el próximo recibo pendiente para pagos fraccionados usando el contador directo
    let proximoReciboPendiente = 1;
    const esFraccionado = (expedienteActual.tipo_pago === 'Fraccionado') || (expedienteActual.forma_pago?.toUpperCase() === 'FRACCIONADO');
    
    if (esFraccionado && (expedienteActual.frecuenciaPago || expedienteActual.frecuencia_pago)) {
      const frecuencia = expedienteActual.frecuenciaPago || expedienteActual.frecuencia_pago;
      const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
      const ultimoReciboPagado = expedienteActual.ultimo_recibo_pagado || 0;
      
      // El próximo recibo es simplemente el siguiente al último pagado
      proximoReciboPendiente = Math.min(ultimoReciboPagado + 1, numeroPagos);
    }
    
    setExpedienteParaPago(expedienteActual);
    setComprobantePago(null);
    setFechaUltimoPago(fechaLimite); // Default: fecha límite del pago pendiente
    setNumeroReciboPago(proximoReciboPendiente); // Default: próximo recibo pendiente
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
      const esFraccionado = (expedienteParaPago.tipo_pago === 'Fraccionado') || (expedienteParaPago.forma_pago?.toUpperCase() === 'FRACCIONADO');
      
      // 🔥 Calcular el próximo pago basándose en el número de recibo que se acaba de pagar
      const proximoPago = calcularSiguientePago({
        ...expedienteParaPago,
        ultimo_recibo_pagado: esFraccionado ? numeroReciboPago : null
      });

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
        fecha_ultimo_pago: fechaUltimoPago, // 🔥 Fecha REAL en que se pagó
        ultimo_recibo_pagado: esFraccionado ? numeroReciboPago : null, // 🔥 Número del recibo que se pagó
        proximo_pago: proximoPago
      };
      
      // Si está completamente pagado, cambiar etapa a "En Vigencia"
      if (nuevoEstatusPago === 'Pagado' && expedienteParaPago.etapa_activa !== 'En Vigencia') {
        datosActualizacion.etapa_activa = 'En Vigencia';
        console.log('✅ Cambiando etapa a "En Vigencia" porque póliza está completamente pagada');
      }

      console.log('💰 Aplicando pago:', { 
        expedienteId: expedienteParaPago.id, 
        fechaRealPago: fechaUltimoPago,
        fechaReciboPagado: fechaDelReciboPagado,
        numeroReciboPagado: numeroReciboPago,
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

      // 2. Subir comprobante de pago a S3
      let comprobanteUrl = null;
      try {
        console.log('📤 Subiendo comprobante a S3...');
        console.log('📄 Archivo:', comprobantePago?.name, 'Tamaño:', comprobantePago?.size, 'bytes');
        console.log('🔗 Endpoint:', `${API_URL}/api/expedientes/${expedienteParaPago.id}/comprobante`);
        
        const formData = new FormData();
        formData.append('file', comprobantePago);
        formData.append('tipo', 'comprobante-pago');
        formData.append('expediente_id', expedienteParaPago.id);
        
        const uploadResponse = await fetch(`${API_URL}/api/expedientes/${expedienteParaPago.id}/comprobante`, {
          method: 'POST',
          body: formData
        });
        
        console.log('📡 Respuesta del servidor:', uploadResponse.status, uploadResponse.statusText);
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          comprobanteUrl = uploadData.data?.pdf_url || uploadData.data?.url;
          console.log('✅ Comprobante subido a S3:', comprobanteUrl);
          console.log('📦 Respuesta completa:', uploadData);
        } else {
          const errorText = await uploadResponse.text();
          console.error('❌ Error del servidor:', errorText);
          console.warn('⚠️ No se pudo subir comprobante a S3, continuando sin URL');
        }
      } catch (errorUpload) {
        console.error('❌ Error al subir comprobante:', errorUpload);
        console.error('Stack:', errorUpload.stack);
        // Continuar sin bloquear el proceso
      }

      // 3. Agregar comentario al historial con información del comprobante
      try {
        // Construir descripción consolidada con formato en columna
        const etapaFinal = datosActualizacion.etapa_activa || expedienteParaPago.etapa_activa;
        
        // 🔥 Usar el número de recibo seleccionado por el usuario
        const calcularNumeroPago = () => {
          if (expedienteParaPago.tipo_pago === 'Anual') return 'Único';
          
          // Para pagos fraccionados, usar el número seleccionado en el modal
          const frecuencia = expedienteParaPago.frecuenciaPago || expedienteParaPago.frecuencia_pago;
          const totalPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
          
          return `${numeroReciboPago} de ${totalPagos}`;
        };
        
        const numeroPago = calcularNumeroPago();
        const fechaPagoFormateada = new Date(fechaUltimoPago).toLocaleDateString('es-MX', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
        
        let comentario;
        if (proximoPago && proximoPago.trim() !== '') {
          // Hay siguiente pago pendiente
          comentario = `💰 Pago Registrado\n` +
                      `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                      `📄 Recibo/Pago: ${numeroPago}\n` +
                      `🧾 Comprobante: ${comprobantePago.name}\n` +
                      `💵 Monto: $${parseFloat(expedienteParaPago.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                      `📅 Siguiente vencimiento: ${new Date(proximoPago).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
                      `📊 Estado: ${etapaFinal} | ${nuevoEstatusPago}`;
        } else {
          // Póliza completamente pagada
          comentario = `💰 Pago Registrado (Final)\n` +
                      `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                      `📄 Recibo/Pago: ${numeroPago}\n` +
                      `🧾 Comprobante: ${comprobantePago.name}\n` +
                      `💵 Monto: $${parseFloat(expedienteParaPago.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                      `✅ Póliza completamente pagada → ${etapaFinal} | ${nuevoEstatusPago}\n` +
                      `📂 Movida a carpeta: Vigentes Pagadas`;
        }

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
              monto_pagado: expedienteParaPago.total || null,
              fecha_pago: fechaUltimoPago,
              numero_pago: numeroPago,
              numero_recibo: numeroReciboPago, // 🔥 Número específico del recibo pagado
              comprobante_nombre: comprobantePago.name,
              comprobante_url: comprobanteUrl, // URL del comprobante en S3
              siguiente_vencimiento: proximoPago || null,
              estatus_pago_nuevo: nuevoEstatusPago,
              etapa_activa: etapaFinal,
              tipo_pago: expedienteParaPago.tipo_pago,
              frecuencia_pago: expedienteParaPago.frecuenciaPago
            }
          });
          console.log('✅ Evento PAGO_REGISTRADO agregado a historial trazabilidad (con detalles completos)');
        } catch (errorRegistroPago) {
          console.error('❌ Error al registrar pago en historial:', errorRegistroPago);
          toast.error('⚠️ Pago aplicado pero no se pudo registrar en el historial: ' + errorRegistroPago.message);
        }
      } catch (errorHistorial) {
        console.error('⚠️ Error al agregar comentario al historial:', errorHistorial);
        // No bloquear el proceso si falla el historial
      }

      // 🔍 VERIFICAR estado de vigencia solo si NO se cambió la etapa a "En Vigencia"
      // Esto evita logs redundantes cuando el pago completa la póliza
      if (!(nuevoEstatusPago === 'Pagado' && datosActualizacion.etapa_activa === 'En Vigencia')) {
        try {
          await verificarYRegistrarEstadoVigencia({
            ...expedienteParaPago,
            estatus_pago: nuevoEstatusPago,
            fecha_vencimiento_pago: nuevaFechaVencimiento
          });
        } catch (errorVigencia) {
          console.warn('⚠️ No se pudo verificar estado de vigencia:', errorVigencia);
        }
      }

      // 🔄 RECARGAR expedientes desde BD para reflejar cambios en etapa_activa
      await recargarExpedientes();
      console.log('✅ Expedientes recargados desde BD');
      
      toast.success('✅ Pago aplicado correctamente');
      
      setMostrarModalPago(false);
      setExpedienteParaPago(null);
      setComprobantePago(null);
      setNumeroReciboPago(1);
      
      // 🔄 Refrescar página completa para mostrar cambios
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
      console.log('✅ Pago aplicado - Refrescando página');
    } catch (error) {
      console.error('❌ Error al aplicar pago:', error);
      toast.error('Error al aplicar el pago: ' + error.message);
    } finally {
      setProcesandoPago(false);
    }
  }, [expedienteParaPago, comprobantePago, calcularSiguientePago, numeroReciboPago, fechaUltimoPago]);

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
    setFormularioOriginal(null); // Limpiar snapshot
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

  // 📍 Función para verificar y registrar el estado de vigencia de una póliza
  // Esta función determina en qué carpeta debe estar (Vencida, Por Renovar, En Vigencia)
  // y registra el evento correspondiente SI NO EXISTE ya en el historial
  // ⭐ ADEMÁS actualiza la etapa_activa en BD para mantener coherencia
  const verificarYRegistrarEstadoVigencia = useCallback(async (expediente, historialActual = null) => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const inicio = expediente.inicio_vigencia ? new Date(expediente.inicio_vigencia) : null;
      const termino = expediente.termino_vigencia ? new Date(expediente.termino_vigencia) : null;
      const fechaAviso = expediente.fecha_aviso_renovacion ? new Date(expediente.fecha_aviso_renovacion) : null;
      
      if (inicio) inicio.setHours(0, 0, 0, 0);
      if (termino) termino.setHours(0, 0, 0, 0);
      if (fechaAviso) fechaAviso.setHours(0, 0, 0, 0);
      
      // Si no tenemos historial, intentar obtenerlo
      let historial = historialActual;
      if (!historial) {
        try {
          const response = await fetch(`${API_URL}/api/historial-expedientes/${expediente.id}`);
          if (response.ok) {
            const data = await response.json();
            historial = data?.data || data || [];
            // ✅ VALIDAR que historial sea un array
            if (!Array.isArray(historial)) {
              console.warn('⚠️ Historial no es un array, convirtiendo:', historial);
              historial = [];
            }
          }
        } catch (e) {
          console.warn('⚠️ No se pudo obtener historial para verificar eventos existentes');
          historial = [];
        }
      }
      
      // ✅ Asegurar que historial sea un array
      if (!Array.isArray(historial)) {
        console.warn('⚠️ Historial no es un array, convirtiendo:', historial);
        historial = [];
      }
      
      console.log('🔍 [VIGENCIA] Verificando estado de vigencia para expediente:', expediente.id);
      console.log('🔍 [VIGENCIA] Historial cargado:', historial.length, 'eventos');
      
      // 1️⃣ VENCIDA (mayor prioridad)
      if (termino && termino < hoy) {
        // ⭐ Solo actualizar etapa_activa a "Vencida" (el evento se integra en log de edición)
        if (expediente.etapa_activa !== 'Vencida') {
          try {
            await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ etapa_activa: 'Vencida' })
            });
            console.log('✅ Etapa actualizada a "Vencida" (el evento se integra en log de edición)');
          } catch (e) {
            console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
          }
        }
        return;
      }
      
      // 2️⃣ POR RENOVAR (30 días antes de vencer)
      if (fechaAviso && termino && fechaAviso <= hoy && termino >= hoy) {
        // ⭐ Solo actualizar etapa_activa a "Por Renovar" (el evento se integra en log de edición)
        if (expediente.etapa_activa !== 'Por Renovar') {
          try {
            await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ etapa_activa: 'Por Renovar' })
            });
            console.log('✅ Etapa actualizada a "Por Renovar" (el evento se integra en log de edición)');
          } catch (e) {
            console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
          }
        }
        return;
      }
      
      // 3️⃣ EN VIGENCIA (dentro del periodo, sin estar próxima a renovar)
      // ⚠️ IMPORTANTE: Solo si está PAGADA
      if (inicio && termino && inicio <= hoy && termino >= hoy) {
        const estaPagada = (expediente.estatus_pago || expediente.estatusPago || '').toLowerCase() === 'pagado';
        
        // Solo registrar evento y actualizar etapa si está pagada
        if (estaPagada) {
          const yaRegistrado = historial.some(h => h.tipo_evento === historialService.TIPOS_EVENTO.POLIZA_EN_VIGENCIA);
          
          if (!yaRegistrado) {
            await historialService.registrarEvento({
              expediente_id: expediente.id,
              cliente_id: expediente.cliente_id,
              tipo_evento: historialService.TIPOS_EVENTO.POLIZA_EN_VIGENCIA,
              usuario_nombre: 'Sistema',
              descripcion: `Póliza en vigencia desde ${expediente.inicio_vigencia} hasta ${expediente.termino_vigencia} (Estatus pago: Pagado)`,
              datos_adicionales: {
                numero_poliza: expediente.numero_poliza,
                compania: expediente.compania,
                inicio_vigencia: expediente.inicio_vigencia,
                termino_vigencia: expediente.termino_vigencia,
                estatus_pago: 'Pagado'
              }
            });
            console.log('✅ Evento "Póliza en Vigencia" registrado');
          } else {
            console.log('ℹ️ Evento "Póliza en Vigencia" ya existe en historial');
          }
          
          // ⭐ Actualizar etapa_activa a "En Vigencia"
          if (expediente.etapa_activa !== 'En Vigencia') {
            try {
              await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etapa_activa: 'En Vigencia' })
              });
              console.log('✅ Etapa actualizada a "En Vigencia"');
            } catch (e) {
              console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
            }
          }
        } else {
          console.log('ℹ️ Póliza en rango de vigencia pero NO pagada. No se actualiza a "En Vigencia"');
        }
        return;
      }
      
      console.log('ℹ️ Póliza no cumple condiciones para eventos automáticos de vigencia');
      
    } catch (error) {
      console.error('❌ Error al verificar y registrar estado de vigencia:', error);
    }
  }, []);

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

    // 🎯 CRÍTICO: NO recalcular antes de guardar
    // Guardar EXACTAMENTE lo que el usuario tiene en el formulario
    const formularioParaGuardar = { ...formulario };
    
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
    console.log('🚨 [FORMULARIO ANTES] cargo_pago_fraccionado:', formularioParaGuardar.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] gastos_expedicion:', formularioParaGuardar.gastos_expedicion);
    console.log('🚨 [FORMULARIO ANTES] tipo valor cargo_pago_fraccionado:', typeof formularioParaGuardar.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] tipo valor gastos_expedicion:', typeof formularioParaGuardar.gastos_expedicion);
    
    // 🚨 DEBUG CRÍTICO: Verificar fechas en el formulario
    console.log('📅 [FORMULARIO] fecha_emision:', formularioParaGuardar.fecha_emision);
    console.log('📅 [FORMULARIO] inicio_vigencia:', formularioParaGuardar.inicio_vigencia);
    console.log('📅 [FORMULARIO] termino_vigencia:', formularioParaGuardar.termino_vigencia);
    
    // ✅ SOLUCIÓN DIRECTA: Crear payload básico y forzar los campos problemáticos
    let expedientePayload = {
      ...formularioParaGuardar,
      // Forzar estos campos específicos sin conversión compleja
      cargo_pago_fraccionado: formularioParaGuardar.cargo_pago_fraccionado || '',
      gastos_expedicion: formularioParaGuardar.gastos_expedicion || '',
      estatus_pago: formularioParaGuardar.estatusPago || 'Pendiente', // ✅ FORZAR estatus_pago
      frecuencia_pago: formularioParaGuardar.frecuenciaPago || formularioParaGuardar.frecuencia_pago || null, // ✅ FORZAR frecuencia_pago
      // 💰 FORZAR montos de pagos fraccionados
      primer_pago: formularioParaGuardar.primer_pago || formularioParaGuardar.primerPago || null,
      pagos_subsecuentes: formularioParaGuardar.pagos_subsecuentes || formularioParaGuardar.pagosSubsecuentes || null,
      // 🎯 CRÍTICO: Forzar fechas en snake_case
      fecha_emision: formularioParaGuardar.fecha_emision,
      inicio_vigencia: formularioParaGuardar.inicio_vigencia,
      termino_vigencia: formularioParaGuardar.termino_vigencia,
      fecha_vencimiento_pago: formularioParaGuardar.fecha_vencimiento_pago,
      fecha_aviso_renovacion: formularioParaGuardar.fecha_aviso_renovacion
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
      if (resultado.estatusPago) {
        resultado.estatus_pago = resultado.estatusPago;
        delete resultado.estatusPago;
      }
      
      return resultado;
    };
    
    expedientePayload = convertirSoloNecesario(expedientePayload);
    
    // ✅ GARANTIZAR que estos campos problemáticos estén presentes
    expedientePayload.cargo_pago_fraccionado = formularioParaGuardar.cargo_pago_fraccionado || '';
    expedientePayload.gastos_expedicion = formularioParaGuardar.gastos_expedicion || '';
    // ✅ CRÍTICO: Usar 'formulario' (estado actual) para estatus_pago, no 'formularioParaGuardar'
    expedientePayload.estatus_pago = formulario.estatusPago || formulario.estatus_pago || 'Pendiente';
    expedientePayload.fecha_aviso_renovacion = formularioParaGuardar.fecha_aviso_renovacion || null; // ✅ GARANTIZAR fecha_aviso_renovacion
    
    // 💰 FECHA DE PAGO: Si está marcado como "Pagado", usar fecha_ultimo_pago o fecha actual
    if (expedientePayload.estatus_pago === 'Pagado') {
      expedientePayload.fecha_ultimo_pago = formularioParaGuardar.fecha_ultimo_pago || new Date().toISOString().split('T')[0];
      console.log('💰 Póliza marcada como Pagado. Fecha de pago:', expedientePayload.fecha_ultimo_pago);
    }
    
    // 🎯 CRÍTICO: GARANTIZAR que las fechas estén en el payload (segunda vez por seguridad)
    expedientePayload.fecha_emision = formularioParaGuardar.fecha_emision;
    expedientePayload.inicio_vigencia = formularioParaGuardar.inicio_vigencia;
    expedientePayload.termino_vigencia = formularioParaGuardar.termino_vigencia;
    expedientePayload.fecha_vencimiento_pago = formularioParaGuardar.fecha_vencimiento_pago;
    expedientePayload.fecha_aviso_renovacion = formularioParaGuardar.fecha_aviso_renovacion;
    
    console.log('🚨 [PAYLOAD SIMPLE] cargo_pago_fraccionado FORZADO:', expedientePayload.cargo_pago_fraccionado);
    console.log('🚨 [PAYLOAD SIMPLE] gastos_expedicion FORZADO:', expedientePayload.gastos_expedicion);
    console.log('🚨 [PAYLOAD SIMPLE] estatus_pago FORZADO:', expedientePayload.estatus_pago);
    console.log('📅 [PAYLOAD SIMPLE] fecha_aviso_renovacion:', expedientePayload.fecha_aviso_renovacion);
    console.log('📅 [PAYLOAD FINAL] fecha_emision:', expedientePayload.fecha_emision);
    console.log('📅 [PAYLOAD FINAL] inicio_vigencia:', expedientePayload.inicio_vigencia);
    console.log('📅 [PAYLOAD FINAL] termino_vigencia:', expedientePayload.termino_vigencia);
    console.log('📅 [PAYLOAD FINAL] fecha_aviso_renovacion:', expedientePayload.fecha_aviso_renovacion);
    
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
    delete expedientePayload.frecuenciaPago; // ✅ Eliminar camelCase, ya está como frecuencia_pago
    delete expedientePayload.primerPago; // ✅ Eliminar camelCase, ya está como primer_pago
    delete expedientePayload.pagosSubsecuentes; // ✅ Eliminar camelCase, ya está como pagos_subsecuentes

    
    // ✅ CAMBIO IMPORTANTE: Sí enviamos campos del cliente (nombre, apellidos, rfc, email, etc.)
    // El backend los necesita para enriquecer el expediente
    // Solo enviamos lo que el usuario puede editar
    
    // Convertir coberturas a JSON string si existen (para compatibilidad con SQL)
    if (expedientePayload.coberturas && Array.isArray(expedientePayload.coberturas)) {
      expedientePayload.coberturas = JSON.stringify(expedientePayload.coberturas);
    }

    // Debug: Verificar campos clave antes de guardar
    console.log(`💾 Guardando expediente | Cliente: ${formularioParaGuardar.cliente_id} | Póliza: ${formularioParaGuardar.numero_poliza}`);

    if (modoEdicion) {
      // ✅ VERIFICACIÓN FINAL OBLIGATORIA - Asegurar que los campos estén ahí
      if (!expedientePayload.hasOwnProperty('cargo_pago_fraccionado')) {
        console.error('❌ FALTA cargo_pago_fraccionado en payload!');
        expedientePayload.cargo_pago_fraccionado = formularioParaGuardar.cargo_pago_fraccionado || '';
      }
      if (!expedientePayload.hasOwnProperty('gastos_expedicion')) {
        console.error('❌ FALTA gastos_expedicion en payload!');
        expedientePayload.gastos_expedicion = formularioParaGuardar.gastos_expedicion || '';
      }
      
      // 💰 VALIDAR cambios en fechas de pago - Preguntar si mantener estatus actual
      let estatusRecalculado = null; // Para detectar cambios automáticos de estatus
      
      if (formularioOriginal) {
        const fechasOriginal = {
          inicio_vigencia: formularioOriginal.inicio_vigencia,
          termino_vigencia: formularioOriginal.termino_vigencia,
          fecha_vencimiento_pago: formularioOriginal.fecha_vencimiento_pago
        };
        
        const fechasNuevas = {
          inicio_vigencia: formularioParaGuardar.inicio_vigencia,
          termino_vigencia: formularioParaGuardar.termino_vigencia,
          fecha_vencimiento_pago: formularioParaGuardar.fecha_vencimiento_pago
        };
        
        const cambiaronFechasPago = 
          fechasOriginal.inicio_vigencia !== fechasNuevas.inicio_vigencia ||
          fechasOriginal.termino_vigencia !== fechasNuevas.termino_vigencia ||
          fechasOriginal.fecha_vencimiento_pago !== fechasNuevas.fecha_vencimiento_pago;
        
        const estatusOriginal = formularioOriginal.estatusPago || formularioOriginal.estatus_pago || 'Pendiente';
        const estatusActual = formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago || 'Pendiente';
        
        // Si cambiaron fechas Y el usuario NO cambió manualmente el estatus
        if (cambiaronFechasPago && estatusOriginal === estatusActual) {
          const mantenerEstatus = window.confirm(
            `🔄 Has modificado fechas de vigencia o pago.\n\n` +
            `Estatus de pago actual: "${estatusActual}"\n\n` +
            `¿Deseas MANTENER el estatus de pago actual?\n\n` +
            `• Presiona "Aceptar" para mantener: "${estatusActual}"\n` +
            `• Presiona "Cancelar" para recalcular automáticamente según la fecha de vencimiento`
          );
          
          if (!mantenerEstatus) {
            // Recalcular estatus basado en fecha_vencimiento_pago usando la misma lógica
            if (fechasNuevas.fecha_vencimiento_pago) {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const fechaVenc = new Date(fechasNuevas.fecha_vencimiento_pago);
              fechaVenc.setHours(0, 0, 0, 0);
              
              const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
              
              // Usar la misma lógica que calcularEstatusPago
              let nuevoEstatus;
              if (diasRestantes < 0) {
                nuevoEstatus = 'Vencido';
              } else if (diasRestantes <= 15) {
                nuevoEstatus = 'Por Vencer';
              } else {
                nuevoEstatus = 'Pendiente';
              }
              
              expedientePayload.estatus_pago = nuevoEstatus;
              expedientePayload.estatusPago = nuevoEstatus;
              
              // ✅ Guardar para detectar cambio más adelante
              estatusRecalculado = { anterior: estatusOriginal, nuevo: nuevoEstatus };
              
              // ✅ CRÍTICO: Actualizar también el estado 'formulario' para que se detecte el cambio
              setFormulario(prev => ({
                ...prev,
                estatus_pago: nuevoEstatus,
                estatusPago: nuevoEstatus
              }));
              
              console.log(`📊 Estatus de pago recalculado: ${estatusOriginal} → ${nuevoEstatus} (${diasRestantes} días restantes)`);
            }
          } else {
            console.log(`📊 Manteniendo estatus de pago: ${estatusActual}`);
          }
        }
      }
      
      console.log(`✅ PUT Expediente ${formularioParaGuardar.id} | Estatus: ${expedientePayload.estatus_pago || 'N/A'}`);
      
      // ✅ Si el estatus cambió a "Pagado", actualizar etapa a "En Vigencia"
      const expedienteEnBD = expedientes.find(exp => exp.id === formularioParaGuardar.id);
      const estatusBD = expedienteEnBD?.estatus_pago || expedienteEnBD?.estatusPago;
      const estatusNuevo = expedientePayload.estatus_pago;
      
      if (estatusBD && estatusNuevo && 
          estatusBD.toLowerCase() !== 'pagado' && 
          estatusNuevo.toLowerCase() === 'pagado' &&
          expedientePayload.etapa_activa !== 'En Vigencia') {
        expedientePayload.etapa_activa = 'En Vigencia';
        console.log('✅ Cambiando etapa a "En Vigencia" porque estatus cambió a Pagado');
      }
      
      fetch(`${API_URL}/api/expedientes/${formularioParaGuardar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expedientePayload)
      })
        .then(response => response.json())
        .then(async (data) => {
          // Debug: Verificar respuesta tras UPDATE
          if (data?.data || data) {
            console.log('✅ PUT completado | ID:', formularioParaGuardar.id);
          }
          // ✨ Registrar actualización de datos en historial (trazabilidad)
          try {
            const expedienteId = formularioParaGuardar.id;
            
            // 🔧 Helper para comparar valores, manejando null/undefined/empty
            // ⚠️ IMPORTANTE: Definir ANTES de usar para que esté disponible en todo el scope
            const normalizar = (valor, esFecha = false) => {
              if (valor === null || valor === undefined || valor === '') return '';
              if (typeof valor === 'object') return JSON.stringify(valor);
              
              // Normalizar fechas eliminando la parte de hora para comparación
              if (esFecha && valor) {
                try {
                  // Si es una fecha ISO con hora, extraer solo la fecha
                  if (valor.includes('T') || valor.includes(':')) {
                    return new Date(valor).toISOString().split('T')[0];
                  }
                  return String(valor).trim();
                } catch (e) {
                  return String(valor).trim();
                }
              }
              
              return String(valor).trim();
            };
            
            // ✅ SOLUCIÓN DEFINITIVA: Comparar BD actual vs lo que se va a guardar
            // Ignorar todo lo que pasó en el formulario (auto-fills, cálculos, etc.)
            const expedienteEnBD = expedientes.find(exp => exp.id === formularioParaGuardar.id);
            
            // 🔍 Obtener datos actuales del cliente desde la tabla de clientes
            let clienteActual = null;
            if (formularioParaGuardar.cliente_id && clientesMap[formularioParaGuardar.cliente_id]) {
              clienteActual = clientesMap[formularioParaGuardar.cliente_id];
              console.log('🔍 [COMPARACIÓN] Cliente actual desde BD:', clienteActual);
            }
            
            // Detectar cambios REALES comparando BD vs payload que se guardará
            const camposModificados = [];
            
            if (expedienteEnBD) {
              const camposAComparar = [
                // Datos básicos de póliza
                { key: 'numero_poliza', label: 'Número de póliza' },
                { key: 'compania', label: 'Aseguradora' },
                { key: 'producto', label: 'Producto' },
                { key: 'tipo_seguro', label: 'Tipo de seguro' },
                { key: 'etapa_activa', label: 'Etapa' },
                
                // Fechas (marcar como esFecha para normalización correcta)
                { key: 'fecha_emision', label: 'Fecha de emisión', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'fecha_captura', label: 'Fecha de captura', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'inicio_vigencia', label: 'Inicio de vigencia', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'termino_vigencia', label: 'Término de vigencia', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'fecha_vencimiento_pago', label: 'Vencimiento de pago', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                
                // Montos
                { key: 'prima_pagada', label: 'Prima', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'total', label: 'Total', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'subtotal', label: 'Subtotal', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'derecho_poliza', label: 'Derecho de póliza', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'iva', label: 'IVA', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'recargo', label: 'Recargo', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'cargo_pago_fraccionado', label: 'Cargo por pago fraccionado', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'gastos_expedicion', label: 'Gastos de expedición', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                
                // Pago
                { key: 'tipo_pago', label: 'Tipo de pago' },
                { key: 'forma_pago', label: 'Forma de pago' },
                { key: 'estatusPago', label: 'Estatus de pago' },
                { key: 'periodo_gracia', label: 'Periodo de gracia', formatter: (v) => `${v || 0} días` },
                
                // Agente y comisiones
                { key: 'agente', label: 'Agente' },
                { key: 'comision_agente', label: 'Comisión agente', formatter: (v) => `${parseFloat(v || 0).toFixed(2)}%` },
                { key: 'porcentaje_comision_plataforma', label: 'Comisión plataforma', formatter: (v) => `${parseFloat(v || 0).toFixed(2)}%` },
                
                // Vehículo (para autos)
                { key: 'marca', label: 'Marca' },
                { key: 'modelo', label: 'Modelo' },
                { key: 'anio', label: 'Año' },
                { key: 'tipo', label: 'Tipo de vehículo' },
                { key: 'numero_serie', label: 'Número de serie' },
                { key: 'placas', label: 'Placas' },
                { key: 'uso', label: 'Uso' },
                { key: 'servicio', label: 'Servicio' },
                { key: 'movimiento', label: 'Movimiento' },
                
                // Conductor
                { key: 'conductor_habitual', label: 'Conductor habitual' },
                { key: 'edad_conductor', label: 'Edad del conductor' },
                
                // Datos del cliente
                { key: 'nombre', label: 'Nombre' },
                { key: 'apellido_paterno', label: 'Apellido paterno' },
                { key: 'apellido_materno', label: 'Apellido materno' },
                { key: 'email', label: 'Email' },
                { key: 'telefono_fijo', label: 'Teléfono fijo' },
                { key: 'telefono_movil', label: 'Teléfono móvil' },
                { key: 'rfc', label: 'RFC' },
                
                // Contactos principales (campos planos)
                { key: 'contacto_nombre', label: 'Nombre del contacto' },
                { key: 'contacto_apellido_paterno', label: 'Apellido paterno del contacto' },
                { key: 'contacto_apellido_materno', label: 'Apellido materno del contacto' },
                { key: 'contacto_email', label: 'Email del contacto' },
                { key: 'contacto_telefono_fijo', label: 'Teléfono fijo del contacto' },
                { key: 'contacto_telefono_movil', label: 'Teléfono móvil del contacto' },
                
                // Otros
                { key: 'observaciones', label: 'Observaciones' }
              ];
              
              // Comparar campos simples
              camposAComparar.forEach(({ key, label, formatter, esFecha }) => {
                // ⚠️ EXCLUIR campos que se calculan automáticamente O están en solo lectura
                const camposExcluidos = [
                  'agente', 
                  'tipo_pago', 
                  'fecha_vencimiento_pago', 
                  'proximoPago',
                  'estatusPago', // Se maneja por separado
                  'estatus_pago', // Se maneja por separado
                  // 🔒 EXCLUIR campos del cliente en SOLO LECTURA (nunca se pueden editar desde el formulario)
                  'nombre',
                  'apellido_paterno',
                  'apellido_materno',
                  'rfc'
                ];
                if (camposExcluidos.includes(key)) return;
                
                // 🔍 CAMPOS EDITABLES DEL CLIENTE: email, teléfonos
                // Comparar contra tabla de clientes para detectar cambios reales
                const camposClienteEditables = ['email', 'telefono_fijo', 'telefono_movil'];
                
                // Campos del contacto adicional/gestor (siempre editables)
                const camposContacto = [
                  'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno',
                  'contacto_email', 'contacto_telefono_fijo', 'contacto_telefono_movil'
                ];
                
                let valorAnterior, valorNuevo;
                
                if (camposClienteEditables.includes(key) || camposContacto.includes(key)) {
                  // Comparar contra datos actuales del cliente en la BD
                  if (!clienteActual) return; // No podemos comparar sin datos del cliente
                  
                  // Mapear nombres de campos del expediente a nombres en tabla clientes
                  const mapeoCliente = {
                    'telefono_fijo': 'telefonoFijo',
                    'telefono_movil': 'telefonoMovil'
                  };
                  const keyCliente = mapeoCliente[key] || key;
                  
                  valorAnterior = normalizar(clienteActual[keyCliente], esFecha);
                  valorNuevo = normalizar(formularioParaGuardar[key], esFecha);
                } else {
                  // Comparar campos de póliza normalmente (contra expediente anterior)
                  valorAnterior = normalizar(expedienteEnBD[key], esFecha);
                  valorNuevo = normalizar(formularioParaGuardar[key], esFecha);
                }
                
                // Solo registrar cambios REALES (ignorar cambios entre valores vacíos: null, undefined, '')
                if (valorAnterior !== valorNuevo) {
                  // Ambos valores están vacíos -> NO es un cambio real
                  if ((valorAnterior === '' || !valorAnterior) && (valorNuevo === '' || !valorNuevo)) {
                    return; // Skip - no es cambio real
                  }
                  
                  const valorAnteriorFormateado = formatter && expedienteEnBD[key] 
                    ? formatter(expedienteEnBD[key]) 
                    : (valorAnterior || 'vacío');
                  const valorNuevoFormateado = formatter && formularioParaGuardar[key]
                    ? formatter(formularioParaGuardar[key]) 
                    : (valorNuevo || 'vacío');
                  
                  camposModificados.push(`• ${label}: "${valorAnteriorFormateado}" → "${valorNuevoFormateado}"`);
                }
              });
              
              // ✅ Agregar estatus_pago si fue recalculado automáticamente
              if (estatusRecalculado && estatusRecalculado.anterior !== estatusRecalculado.nuevo) {
                camposModificados.push(`• Estatus de pago: "${estatusRecalculado.anterior}" → "${estatusRecalculado.nuevo}" (recalculado automáticamente)`);
              }
            }
            
            // 💰 DETECTAR cambio manual en estatus de pago para agregarlo a camposModificados
            let cambioEstatusPago = null;
            let etapaAfectadaPorPago = null;
            
            if (expedienteEnBD) {
              console.log('🔍 [PAGO LOG] Verificando cambio en estatus de pago...');
              console.log('🔍 [PAGO LOG] expedienteEnBD:', expedienteEnBD);
              console.log('🔍 [PAGO LOG] expedientePayload:', expedientePayload);
              console.log('🔍 [PAGO LOG] estatusRecalculado:', estatusRecalculado);
              
              // Comparar BD actual vs lo que se va a guardar
              // USAR formularioParaGuardar en lugar de expedientePayload
              const estatusPagoAnterior = estatusRecalculado 
                ? normalizar(estatusRecalculado.anterior)
                : normalizar(expedienteEnBD.estatusPago || expedienteEnBD.estatus_pago);
              const estatusPagoNuevo = estatusRecalculado
                ? normalizar(estatusRecalculado.nuevo)
                : normalizar(formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago);
              
              console.log('🔍 [PAGO LOG] estatusPagoAnterior (normalizado):', estatusPagoAnterior);
              console.log('🔍 [PAGO LOG] estatusPagoNuevo (normalizado):', estatusPagoNuevo);
              console.log('🔍 [PAGO LOG] Son diferentes?:', estatusPagoAnterior !== estatusPagoNuevo);
              console.log('🔍 [PAGO LOG] Ambos tienen valor?:', !!(estatusPagoAnterior && estatusPagoNuevo));
              
              if (estatusPagoAnterior !== estatusPagoNuevo && estatusPagoAnterior && estatusPagoNuevo) {
                const pagoAplicado = estatusPagoNuevo.toLowerCase() === 'pagado';
                const pagoRemovido = estatusPagoAnterior.toLowerCase() === 'pagado' && estatusPagoNuevo.toLowerCase() !== 'pagado';
                
                // Si se removió el pago y estaba "En Vigencia", revertir a "Emitida"
                if (pagoRemovido && expedienteEnBD.etapa_activa === 'En Vigencia') {
                  try {
                    await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ etapa_activa: 'Emitida' })
                    });
                    etapaAfectadaPorPago = 'Emitida';
                    console.log('✅ Etapa revertida de "En Vigencia" → "Emitida"');
                  } catch (e) {
                    console.warn('⚠️ No se pudo revertir etapa:', e);
                  }
                }
                
                // Guardar info del cambio para incluir en el log consolidado
                cambioEstatusPago = {
                  anterior: estatusPagoAnterior,
                  nuevo: estatusPagoNuevo,
                  pagoAplicado,
                  pagoRemovido
                };
                
                // ⚠️ NO agregar a camposModificados aquí - se mostrará en el badge destacado
                // Solo agregamos si es un cambio entre estados no-pagado (ej: Pendiente → Vencido)
                if (!pagoAplicado && !pagoRemovido) {
                  camposModificados.push(`• Estatus de pago: "${estatusPagoAnterior}" → "${estatusPagoNuevo}"`);
                }
              }
            }
            
            // Registrar evento consolidado si hubo cambios O si hubo cambio de pago manual
            if (camposModificados.length > 0 || cambioEstatusPago) {
              // 🔍 PRIMERO: Ejecutar verificación de vigencia para obtener la etapa FINAL
              let etapaFinalReal = formularioParaGuardar.etapa_activa;
              
              if (!cambioEstatusPago || (!cambioEstatusPago.pagoAplicado && !cambioEstatusPago.pagoRemovido)) {
                try {
                  const expedienteActualizado = {
                    ...formularioParaGuardar,
                    estatus_pago: formulario.estatusPago || formulario.estatus_pago,
                    estatusPago: formulario.estatusPago || formulario.estatus_pago
                  };
                  await verificarYRegistrarEstadoVigencia(expedienteActualizado, data?.historial);
                  
                  // Recargar el expediente para obtener la etapa_activa REAL después de la verificación
                  const respuestaFresh = await fetch(`${API_URL}/api/expedientes/${expedienteId}`);
                  if (respuestaFresh.ok) {
                    const datosFresh = await respuestaFresh.json();
                    const expFresh = datosFresh.data || datosFresh;
                    etapaFinalReal = expFresh.etapa_activa;
                    console.log('✅ Etapa final obtenida después de verificación:', etapaFinalReal);
                  }
                } catch (errorVigencia) {
                  console.warn('⚠️ No se pudo verificar estado de vigencia:', errorVigencia);
                }
              }
              
              // Verificar si cambió la etapa (comparar BD vs etapa FINAL REAL)
              const cambioEtapa = expedienteEnBD && expedienteEnBD.etapa_activa !== etapaFinalReal;
              const etapaFinal = etapaAfectadaPorPago || etapaFinalReal;
              
              // 🔍 Detectar si el cambio de etapa fue automático por vigencia
              const cambioAutomaticoPorVigencia = cambioEtapa && !etapaAfectadaPorPago && 
                (etapaFinalReal === 'Por Renovar' || etapaFinalReal === 'Vencida');
              
              // Construir descripción consolidada con destacado de pago/vigencia si aplica
              let descripcion = '';
              
              // 🎯 DESTACAR cambios automáticos importantes al inicio
              if (cambioEstatusPago) {
                if (cambioEstatusPago.pagoAplicado) {
                  descripcion = '🟢 PAGO APLICADO MANUALMENTE';
                } else if (cambioEstatusPago.pagoRemovido) {
                  descripcion = '⚠️ PAGO REMOVIDO';
                  // Si además cambió a vencida automáticamente, agregar ese badge también
                  if (cambioAutomaticoPorVigencia && etapaFinalReal === 'Vencida') {
                    descripcion += '\n🚨 PÓLIZA VENCIDA\n(Automático: Término de vigencia alcanzado)';
                  }
                }
              } else if (cambioAutomaticoPorVigencia) {
                if (etapaFinalReal === 'Por Renovar') {
                  descripcion = '⏰ PÓLIZA PRÓXIMA A VENCER\n(Automático: 30 días antes del vencimiento)';
                } else if (etapaFinalReal === 'Vencida') {
                  descripcion = '🚨 PÓLIZA VENCIDA\n(Automático: Término de vigencia alcanzado)';
                }
              }
              
              // Solo mostrar resumen de campos si hay cambios adicionales
              if (camposModificados.length > 0) {
                if (descripcion) descripcion += '\n\n'; // Separador solo si hay badge
                descripcion += `Póliza editada - ${camposModificados.length} campo(s) modificado(s)\n\nCampos modificados:\n${camposModificados.join('\n')}`;
              }
              
              // 📂 SIEMPRE agregar información de carpeta y estatus de pago
              if (descripcion) descripcion += '\n\n';
              
              // Mostrar movimiento de carpeta o carpeta actual
              if (cambioEtapa || etapaAfectadaPorPago) {
                // Hubo movimiento de carpeta
                descripcion += `📂 Póliza movida a: ${etapaFinal}`;
              } else {
                // No hubo movimiento - mostrar carpeta actual
                descripcion += `📂 Carpeta actual: ${formularioParaGuardar.etapa_activa}`;
              }
              
              // 💳 SIEMPRE agregar estatus de pago FINAL (después de todos los cambios)
              // Usar el estatus que se guardó en la BD, no el del formulario original
              let estatusPagoFinal;
              if (cambioEstatusPago) {
                estatusPagoFinal = cambioEstatusPago.nuevo; // Usar el nuevo estatus después del cambio
              } else {
                estatusPagoFinal = formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago || 'Sin estatus';
              }
              descripcion += `\n💳 Estatus de pago: ${estatusPagoFinal}`;
              
              // Registrar los cambios de datos (consolidado)
              await historialService.registrarEvento({
                expediente_id: expedienteId,
                cliente_id: formularioParaGuardar.cliente_id,
                tipo_evento: historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS,
                usuario_nombre: 'Sistema', // TODO: usuario actual
                descripcion,
                datos_adicionales: {
                  numero_poliza: formularioParaGuardar.numero_poliza,
                  compania: formularioParaGuardar.compania,
                  producto: formularioParaGuardar.producto,
                  campos_modificados: camposModificados,
                  cantidad_cambios: camposModificados.length,
                  modificaciones_manuales: camposModificados.length > 0, // ✅ Marcar como modificación manual
                  ...(cambioEtapa && {
                    etapa_anterior: expedienteEnBD.etapa_activa,
                    etapa_nueva: formularioParaGuardar.etapa_activa
                  }),
                  ...(cambioEstatusPago && {
                    cambio_pago: {
                      anterior: cambioEstatusPago.anterior,
                      nuevo: cambioEstatusPago.nuevo,
                      tipo: cambioEstatusPago.pagoAplicado ? 'aplicado_manual' : cambioEstatusPago.pagoRemovido ? 'removido_manual' : 'cambio_estatus'
                    }
                  })
                }
              });
              console.log(`✅ Evento consolidado "Edición" registrado con ${camposModificados.length} cambios${cambioEtapa ? ' (incluye cambio de etapa)' : ''}${cambioEstatusPago ? ' (incluye cambio de pago)' : ''}`);
              
              // 🎯 Detectar cambios automáticos de vigencia/renovación por edición de fechas
              if (expedienteAnterior) {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                
                // ⚠️ PENDIENTE: Flujo completo de renovación con módulo de cotizaciones
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // CONTEXTO: Cuando se habilite el módulo de cotizaciones, completar el
                // flujo de renovación con los siguientes estados y eventos:
                //
                // CARPETAS Y FLUJO:
                // ─────────────────────────────────────────────────────────────────
                // 📂 "Por Renovar" o "Vencidas" → Usuario hace clic en botón "Cotizar"
                //    ↓
                // 📂 "En Proceso" (desde que inicia cotización hasta que se paga)
                //    ↓
                // 📂 "Renovadas" (cuando se aplica el pago)
                //
                // EVENTOS Y ESTADOS:
                // ─────────────────────────────────────────────────────────────────
                // 1. ⏰ POLIZA_PROXIMA_VENCER - Ya implementado ✅
                //    └─> Automático: fecha_aviso_renovacion <= hoy
                //    └─> Carpeta: "Por Renovar"
                //    └─> Estado: etapa_activa sin cambios
                //
                // 2. ❌ POLIZA_VENCIDA - Ya implementado ✅
                //    └─> Automático: termino_vigencia < hoy
                //    └─> Carpeta: "Vencidas"
                //    └─> Estado: etapa_activa = "Vencida" (opcional)
                //
                // 3. 📝 COTIZACION_RENOVACION_INICIADA - Pendiente
                //    └─> Trigger: Botón "Cotizar" en listado (carpetas Por Renovar/Vencidas)
                //    └─> Acción: Abrir modal/formulario de cotización
                //    └─> Cambio: etapa_activa = "En Cotización - Renovación"
                //    └─> Carpeta: "En Proceso"
                //
                // 4. 📧 COTIZACION_RENOVACION_ENVIADA - Pendiente
                //    └─> Trigger: Se envía cotización de renovación al cliente
                //    └─> Cambio: etapa_activa = "Renovación Enviada"
                //    └─> Carpeta: "En Proceso"
                //    └─> Registrar: destinatario, monto, PDF, fecha de envío
                //
                // 5. ⏳ RENOVACION_PENDIENTE_EMISION - Pendiente
                //    └─> Trigger: Cliente autoriza cotización
                //    └─> Cambio: etapa_activa = "Pendiente de Emisión - Renovación"
                //    └─> Carpeta: "En Proceso"
                //
                // 6. 📄 RENOVACION_EMITIDA - Pendiente
                //    └─> Trigger: Aseguradora emite la póliza renovada
                //    └─> Cambio: etapa_activa = "Renovación Emitida"
                //    └─> Carpeta: "En Proceso"
                //    └─> Actualizar: nuevo numero_poliza (si aplica), nuevas vigencias
                //
                // 7. 💰 PAGO_RENOVACION_REGISTRADO - Pendiente
                //    └─> Trigger: Se registra pago de la renovación
                //    └─> Cambio: estatus_pago = "Pagado"
                //    └─> Registrar: monto, método, comprobante
                //
                // 8. 🔁 RENOVACION_VIGENTE - Pendiente
                //    └─> Trigger: Pago completado (automático tras registrar pago)
                //    └─> Cambio: etapa_activa = "Renovada"
                //    └─> Carpeta: "Renovadas" (NO va a "Vigentes", va a carpeta especial)
                //    └─> Actualizar: inicio_vigencia (nuevo inicio)
                //    └─> Actualizar: termino_vigencia (nuevo inicio + 1 año)
                //    └─> Actualizar: fecha_aviso_renovacion (nuevo término - 30 días)
                //    └─> Nota: tipo_movimiento = "renovacion" (para distinguir de nuevas)
                //
                // CONSIDERACIONES TÉCNICAS:
                // ─────────────────────────────────────────────────────────────────
                // - Crear eventos específicos para renovación (COTIZACION_RENOVACION_*, etc.)
                //   para mantener claridad en el historial y poder filtrar/analizar renovaciones
                // - El campo tipo_movimiento = "renovacion" permite diferenciar en reportes
                // - La carpeta "Renovadas" mantiene pólizas renovadas separadas de nuevas
                // - Considerar si crear nueva fila en BD o actualizar la existente
                //   (Recomendado: actualizar existente y mantener historial en tabla de eventos)
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                
                // ✅ La verificación de vigencia ya se ejecutó ANTES de registrar el log
                // (Ver líneas arriba, se ejecuta antes de generar el log para obtener etapa_activa FINAL)
              }
            } else {
              console.log('ℹ️ No se detectaron cambios reales, no se registra evento de edición');
            }
          } catch (e) {
            console.warn('⚠️ No se pudo registrar evento de actualización:', e);
          }

          limpiarFormulario();
          await recargarExpedientes(); // Esperar a que se recarguen los datos
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
      
      console.log(`✅ POST Expediente | Póliza: ${payloadFinal.numero_poliza || 'N/A'} | Cliente: ${payloadFinal.cliente_id || 'N/A'}`);
      
  fetch(`${API_URL}/api/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFinal)
      })
        .then(response => response.json())
        .then(async (data) => {
          // Debug: Verificar respuesta tras CREATE
          if (data?.id || data?.data?.id) {
            console.log('✅ POST completado | ID:', data?.id || data?.data?.id);
          }
          // ✨ Registrar creación en historial de trazabilidad
          try {
            const nuevoId = data?.id || data?.data?.id;
            if (nuevoId) {
              const etapaActual = expedientePayload.etapa_activa || 'En cotización';
              const capturadoConExtractorPDF = formularioParaGuardar._capturado_con_extractor_pdf === true;
              const nombreArchivoPDF = formularioParaGuardar._nombre_archivo_pdf || 'PDF importado';
              
              console.log('🔍 DEBUG captura evento:', {
                capturadoConExtractorPDF,
                nombreArchivoPDF,
                tiene_datos_originales: !!formularioParaGuardar._datos_originales_pdf
              });
              
              // 🔍 DETECTAR CAMPOS MODIFICADOS MANUALMENTE
              // ✅ LÓGICA SIMPLE: Si existe snapshot (formularioOriginal), comparar todo el formulario
              const camposModificados = [];
              let huboModificacionesManuales = false;
              
              if (formularioOriginal) {
                console.log('✅ Snapshot disponible - detectando cambios desde el estado inicial completo');
                console.log('📸 Campos en snapshot:', Object.keys(formularioOriginal).filter(k => !k.startsWith('_')).length);
                console.log('🔍 DEBUG - Valores clave en snapshot:', {
                  contacto_nombre: formularioOriginal.contacto_nombre,
                  contacto_telefono_fijo: formularioOriginal.contacto_telefono_fijo,
                  conductor_habitual: formularioOriginal.conductor_habitual,
                  fecha_emision: formularioOriginal.fecha_emision,
                  fecha_captura: formularioOriginal.fecha_captura
                });
                console.log('🔍 DEBUG - Valores clave en formulario actual:', {
                  contacto_nombre: formularioParaGuardar.contacto_nombre,
                  contacto_telefono_fijo: formularioParaGuardar.contacto_telefono_fijo,
                  conductor_habitual: formularioParaGuardar.conductor_habitual,
                  fecha_emision: formularioParaGuardar.fecha_emision,
                  fecha_captura: formularioParaGuardar.fecha_captura
                });
                
                // Normalizar valores para comparación
                const normalizar = (valor) => {
                  if (valor === null || valor === undefined) return '';
                  if (typeof valor === 'object') return JSON.stringify(valor);
                  return String(valor).trim();
                };
                
                // Lista de campos editables a comparar
                const camposEditables = [
                  // === DATOS DEL CLIENTE ===
                  { key: 'nombre', label: 'Nombre del cliente' },
                  { key: 'apellido_paterno', label: 'Apellido paterno del cliente' },
                  { key: 'apellido_materno', label: 'Apellido materno del cliente' },
                  { key: 'razon_social', label: 'Razón social' },
                  { key: 'nombre_comercial', label: 'Nombre comercial' },
                  { key: 'rfc', label: 'RFC' },
                  { key: 'curp', label: 'CURP' },
                  { key: 'email', label: 'Email del cliente' },
                  { key: 'telefono_fijo', label: 'Teléfono fijo del cliente' },
                  { key: 'telefono_movil', label: 'Teléfono móvil del cliente' },
                  { key: 'domicilio', label: 'Domicilio' },
                  
                  // === CONTACTO ADICIONAL ===
                  { key: 'contacto_nombre', label: 'Nombre del contacto' },
                  { key: 'contacto_apellido_paterno', label: 'Apellido paterno del contacto' },
                  { key: 'contacto_apellido_materno', label: 'Apellido materno del contacto' },
                  { key: 'contacto_email', label: 'Email del contacto' },
                  { key: 'contacto_telefono_fijo', label: 'Teléfono fijo del contacto' },
                  { key: 'contacto_telefono_movil', label: 'Teléfono móvil del contacto' },
                  
                  // === DATOS BÁSICOS DE PÓLIZA ===
                  { key: 'numero_poliza', label: 'Número de póliza' },
                  { key: 'compania', label: 'Aseguradora' },
                  { key: 'producto', label: 'Producto' },
                  { key: 'tipo_seguro', label: 'Tipo de seguro' },
                  { key: 'endoso', label: 'Endoso' },
                  { key: 'inciso', label: 'Inciso' },
                  
                  // === FECHAS ===
                  { key: 'fecha_emision', label: 'Fecha de emisión' },
                  { key: 'fecha_captura', label: 'Fecha de captura' },
                  { key: 'inicio_vigencia', label: 'Inicio de vigencia' },
                  { key: 'termino_vigencia', label: 'Término de vigencia' },
                  
                  // === MONTOS ===
                  { key: 'prima_pagada', label: 'Prima' },
                  { key: 'cargo_pago_fraccionado', label: 'Cargo pago fraccionado' },
                  { key: 'gastos_expedicion', label: 'Gastos de expedición' },
                  { key: 'iva', label: 'IVA' },
                  { key: 'recargo', label: 'Recargo' },
                  { key: 'total', label: 'Total' },
                  { key: 'subtotal', label: 'Subtotal' },
                  { key: 'suma_asegurada', label: 'Suma asegurada' },
                  { key: 'deducible', label: 'Deducible' },
                  
                  // === PAGO ===
                  { key: 'forma_pago', label: 'Forma de pago' },
                  { key: 'tipo_pago', label: 'Tipo de pago' },
                  { key: 'frecuenciaPago', label: 'Frecuencia de pago' },
                  { key: 'primer_pago', label: 'Primer pago' },
                  { key: 'pagos_subsecuentes', label: 'Pagos subsecuentes' },
                  { key: 'periodo_gracia', label: 'Período de gracia' },
                  
                  // === VEHÍCULO (PARA AUTOS) ===
                  { key: 'marca', label: 'Marca' },
                  { key: 'modelo', label: 'Modelo' },
                  { key: 'anio', label: 'Año' },
                  { key: 'tipo_vehiculo', label: 'Tipo de vehículo' },
                  { key: 'numero_serie', label: 'Número de serie' },
                  { key: 'motor', label: 'Motor' },
                  { key: 'placas', label: 'Placas' },
                  { key: 'color', label: 'Color' },
                  { key: 'codigo_vehiculo', label: 'Código de vehículo' },
                  { key: 'tipo_cobertura', label: 'Tipo de cobertura' },
                  { key: 'plan', label: 'Plan' },
                  
                  // === USO Y SERVICIO ===
                  { key: 'uso', label: 'Uso' },
                  { key: 'servicio', label: 'Servicio' },
                  { key: 'movimiento', label: 'Movimiento' },
                  
                  // === CONDUCTOR ===
                  { key: 'conductor_habitual', label: 'Conductor habitual' },
                  { key: 'edad_conductor', label: 'Edad del conductor' },
                  { key: 'licencia_conducir', label: 'Licencia de conducir' },
                  
                  // === OTROS ===
                  { key: 'observaciones', label: 'Observaciones' }
                ];
                
                // Comparar cada campo
                camposEditables.forEach(({ key, label }) => {
                  const valorOriginal = normalizar(formularioOriginal[key]);
                  const valorActual = normalizar(formularioParaGuardar[key]);
                  
                  if (valorOriginal !== valorActual) {
                    // Ignorar cambios de vacío a vacío
                    if (!valorOriginal && !valorActual) return;
                    
                    camposModificados.push(
                      `• ${label}: "${valorOriginal || 'vacío'}" → "${valorActual || 'vacío'}"`
                    );
                    console.log(`  ✏️ ${label}: "${valorOriginal || 'vacío'}" → "${valorActual || 'vacío'}"`);
                  }
                });
                
                huboModificacionesManuales = camposModificados.length > 0;
                console.log(`✅ ${camposModificados.length} campo(s) modificado(s) manualmente`);
              } else {
                console.log('⚠️ No hay snapshot - no se pueden detectar cambios manuales');
              }
              
              // 🎯 EVENTO CAPTURA: Registrar en el nuevo sistema de historial
              const metodCaptura = capturadoConExtractorPDF ? 'Extractor PDF' : 'Captura Manual';
              const aseguradoraNombre = expedientePayload.compania || 'Aseguradora';
              const fechaCaptura = new Date().toISOString().split('T')[0];
              
              // Registrar en el sistema de historial (nueva tabla)
              const fechaEmision = expedientePayload.fecha_emision || 'No especificada';
              const inicioVigencia = expedientePayload.inicio_vigencia || 'No especificada';
              
              // Construir descripción con información relevante
              let descripcionEvento = '';
              if (capturadoConExtractorPDF) {
                // Incluir nombre de la aseguradora para identificar qué extractor se usó
                descripcionEvento = `Póliza extraída con Extractor PDF ${aseguradoraNombre} • Archivo: ${nombreArchivoPDF}`;
                if (huboModificacionesManuales && camposModificados.length > 0) {
                  descripcionEvento += `\n\n${camposModificados.length} campo(s) modificado(s) manualmente:\n${camposModificados.join('\n')}`;
                }
              } else {
                descripcionEvento = `Póliza capturada manualmente`;
                if (huboModificacionesManuales && camposModificados.length > 0) {
                  descripcionEvento += `\n\nCampos capturados:\n${camposModificados.join('\n')}`;
                }
              }
              
              // Agregar información de fechas si están disponibles
              const infoFechas = [];
              if (fechaEmision && fechaEmision !== 'No especificada') {
                infoFechas.push(`Emisión: ${fechaEmision}`);
              }
              if (inicioVigencia && inicioVigencia !== 'No especificada') {
                infoFechas.push(`Vigencia: ${inicioVigencia}`);
              }
              if (infoFechas.length > 0) {
                descripcionEvento += ` • ${infoFechas.join(' • ')}`;
              }
              
              const eventoData = {
                expediente_id: String(nuevoId), // Convertir a string para coincidir con VARCHAR(50)
                cliente_id: String(expedientePayload.cliente_id),
                tipo_evento: capturadoConExtractorPDF 
                  ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
                  : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
                usuario_nombre: 'Sistema',
                descripcion: descripcionEvento,
                datos_adicionales: {
                  metodo: metodCaptura,
                  numero_poliza: expedientePayload.numero_poliza,
                  compania: aseguradoraNombre,
                  producto: expedientePayload.producto || '',
                  etapa_inicial: etapaActual,
                  fecha_emision: fechaEmision,
                  inicio_vigencia: inicioVigencia,
                  ...(capturadoConExtractorPDF && {
                    nombre_archivo_pdf: nombreArchivoPDF,
                    modificaciones_manuales: huboModificacionesManuales,
                    ...(huboModificacionesManuales && camposModificados.length > 0 && {
                      campos_modificados: camposModificados
                    })
                  })
                }
              };
              
              console.log('🔍 DEBUG: Registrando evento en historial con datos:', eventoData);
              await historialService.registrarEvento(eventoData);
              
              console.log(`✅ Captura registrada en historial: ${metodCaptura} - ${aseguradoraNombre}`);
              
              // 💰 REGISTRAR PAGO INICIAL si la póliza fue marcada como "Pagado" al momento de captura
              const estatusPago = expedientePayload.estatus_pago || expedientePayload.estatusPago;
              if (estatusPago === 'Pagado') {
                console.log('💰 Detectado pago aplicado en captura inicial, registrando evento...');
                try {
                  const fechaPago = expedientePayload.fecha_ultimo_pago || expedientePayload.fecha_vencimiento_pago || new Date().toISOString().split('T')[0];
                  const fechaPagoFormateada = new Date(fechaPago).toLocaleDateString('es-MX', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  });
                  
                  const comentarioPago = `💰 Pago Registrado en Captura Inicial\n` +
                    `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                    `💵 Monto: $${parseFloat(expedientePayload.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                    `✅ Póliza marcada como pagada desde la captura`;
                  
                  await historialService.registrarEvento({
                    expediente_id: String(nuevoId),
                    cliente_id: String(expedientePayload.cliente_id),
                    tipo_evento: historialService.TIPOS_EVENTO.PAGO_REGISTRADO,
                    usuario_nombre: 'Sistema',
                    descripcion: comentarioPago,
                    datos_adicionales: {
                      numero_poliza: expedientePayload.numero_poliza,
                      compania: aseguradoraNombre,
                      producto: expedientePayload.producto || '',
                      monto_total: expedientePayload.total || null,
                      monto_pagado: expedientePayload.total || null,
                      fecha_pago: fechaPago,
                      tipo_pago: expedientePayload.tipo_pago,
                      frecuencia_pago: expedientePayload.frecuenciaPago,
                      aplicado_en_captura: true
                    }
                  });
                  console.log('✅ Evento de pago inicial registrado en historial');
                } catch (errorPagoInicial) {
                  console.warn('⚠️ No se pudo registrar evento de pago inicial:', errorPagoInicial);
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ Error al registrar captura:', error.message);
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
        
        // ✅ NORMALIZAR ESTATUS DE PAGO (igual que en cargarDatos)
        let estatusPagoCalculado = exp.estatus_pago || exp.estatusPago;
        const estatusNormalizado = (estatusPagoCalculado || '').toLowerCase().trim();
        
        if (estatusNormalizado === 'pagado' || estatusNormalizado === 'pagada') {
          estatusPagoCalculado = 'Pagado';
        } else if (estatusNormalizado === 'cancelado' || estatusNormalizado === 'cancelada') {
          estatusPagoCalculado = 'Cancelado';
        } else if (estatusNormalizado === 'vencido' || estatusNormalizado === 'vencida') {
          estatusPagoCalculado = 'Vencido';
        } else if (estatusNormalizado === 'por vencer') {
          estatusPagoCalculado = 'Por Vencer';
        } else if (estatusNormalizado === 'pendiente') {
          estatusPagoCalculado = 'Pendiente';
        } else if (estatusPagoCalculado) {
          // Preservar valores no reconocidos
          estatusPagoCalculado = estatusPagoCalculado.charAt(0).toUpperCase() + estatusPagoCalculado.slice(1).toLowerCase();
        } else {
          // Solo calcular si viene vacío
          const fechaVencimiento = exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago;
          if (fechaVencimiento) {
            const fechaVenc = new Date(fechaVencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            fechaVenc.setHours(0, 0, 0, 0);
            estatusPagoCalculado = fechaVenc < hoy ? 'Vencido' : 'Pendiente';
          } else {
            estatusPagoCalculado = 'Pendiente';
          }
        }
        
        exp.estatusPago = estatusPagoCalculado;
        
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
  
  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES PARA FLUJO DE RENOVACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * 1. Iniciar Cotización de Renovación
   */
  const iniciarCotizacionRenovacion = useCallback(async (expediente) => {
    try {
      setExpedienteParaRenovacion(expediente);
      setMostrarModalCotizarRenovacion(true);
    } catch (error) {
      console.error('Error al abrir modal de cotización:', error);
      toast.error('Error al iniciar cotización de renovación');
    }
  }, []);

  const guardarCotizacionRenovacion = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      await cambiarEstadoExpediente(expedienteParaRenovacion.id, 'En Cotización - Renovación');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA,
        usuario_nombre: 'Sistema',
        descripcion: 'Cotización de renovación iniciada',
        datos_adicionales: {
          numero_poliza: expedienteParaRenovacion.numero_poliza,
          compania: expedienteParaRenovacion.compania
        }
      });
      
      toast.success('Cotización de renovación iniciada');
      setMostrarModalCotizarRenovacion(false);
      setExpedienteParaRenovacion(null);
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      toast.error('Error al guardar cotización de renovación');
    }
  }, [cambiarEstadoExpediente, recargarExpedientes]);

  /**
   * 2. Marcar como Autorizado
   */
  const marcarRenovacionAutorizada = useCallback(async (expediente) => {
    try {
      setExpedienteParaRenovacion(expediente);
      setMostrarModalAutorizarRenovacion(true);
    } catch (error) {
      console.error('Error al abrir modal autorizar:', error);
      toast.error('Error al marcar renovación como autorizada');
    }
  }, []);

  const confirmarRenovacionAutorizada = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      await cambiarEstadoExpediente(expedienteParaRenovacion.id, 'Pendiente de Emisión - Renovación');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION,
        usuario_nombre: 'Sistema',
        descripcion: 'Cliente autorizó la renovación - Pendiente de emisión',
        datos_adicionales: {
          numero_poliza: expedienteParaRenovacion.numero_poliza,
          compania: expedienteParaRenovacion.compania
        }
      });
      
      toast.success('Renovación marcada como autorizada');
      setMostrarModalAutorizarRenovacion(false);
      setExpedienteParaRenovacion(null);
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al marcar como autorizada:', error);
      toast.error('Error al marcar renovación como autorizada');
    }
  }, [cambiarEstadoExpediente, recargarExpedientes]);

  /**
   * 3. Agregar Póliza Renovada
   */
  const abrirModalPolizaRenovada = useCallback((expediente) => {
    setExpedienteParaRenovacion(expediente);
    
    const hoy = new Date();
    const inicioVigencia = new Date(hoy);
    const terminoVigencia = new Date(inicioVigencia);
    terminoVigencia.setFullYear(terminoVigencia.getFullYear() + 1);
    
    setDatosRenovacion({
      numeroPolizaNueva: expediente.numero_poliza || '',
      primaNueva: expediente.prima_pagada || '',
      totalNuevo: expediente.total || '',
      fechaEmisionNueva: hoy.toISOString().split('T')[0],
      inicioVigenciaNueva: inicioVigencia.toISOString().split('T')[0],
      terminoVigenciaNueva: terminoVigencia.toISOString().split('T')[0],
      observaciones: ''
    });
    
    setMostrarModalPolizaRenovada(true);
  }, []);

  const guardarPolizaRenovada = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      const terminoVigencia = new Date(datosRenovacion.terminoVigenciaNueva);
      const fechaAviso = new Date(terminoVigencia);
      fechaAviso.setDate(fechaAviso.getDate() - 30);
      
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_poliza: datosRenovacion.numeroPolizaNueva,
          prima_pagada: parseFloat(datosRenovacion.primaNueva) || 0,
          total: parseFloat(datosRenovacion.totalNuevo) || 0,
          fecha_emision: datosRenovacion.fechaEmisionNueva,
          inicio_vigencia: datosRenovacion.inicioVigenciaNueva,
          termino_vigencia: datosRenovacion.terminoVigenciaNueva,
          fecha_aviso_renovacion: fechaAviso.toISOString().split('T')[0],
          etapa_activa: 'Renovación Emitida',
          tipo_movimiento: 'renovacion'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.RENOVACION_EMITIDA,
        usuario_nombre: 'Sistema',
        descripcion: `Póliza renovada emitida - Nueva vigencia: ${datosRenovacion.inicioVigenciaNueva} a ${datosRenovacion.terminoVigenciaNueva}`,
        datos_adicionales: {
          numero_poliza: datosRenovacion.numeroPolizaNueva,
          compania: expedienteParaRenovacion.compania,
          prima_nueva: datosRenovacion.primaNueva,
          total_nuevo: datosRenovacion.totalNuevo,
          observaciones: datosRenovacion.observaciones
        }
      });
      
      toast.success('Póliza renovada registrada exitosamente');
      setMostrarModalPolizaRenovada(false);
      setExpedienteParaRenovacion(null);
      setDatosRenovacion({
        numeroPolizaNueva: '',
        primaNueva: '',
        totalNuevo: '',
        fechaEmisionNueva: '',
        inicioVigenciaNueva: '',
        terminoVigenciaNueva: '',
        observaciones: ''
      });
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al guardar póliza renovada:', error);
      toast.error('Error al guardar póliza renovada');
    }
  }, [recargarExpedientes]);
  
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
    // Traer el expediente completo por ID para garantizar datos frescos de la BD
    let expedienteCompleto = expediente;
    try {
      console.log('🔄 Recargando expediente fresco desde API:', expediente.id);
      const resp = await fetch(`${API_URL}/api/expedientes/${expediente.id}`);
      if (resp.ok) {
        const data = await resp.json();
        const desdeApi = data?.data ?? data;
        if (desdeApi && typeof desdeApi === 'object') {
          console.log('📅 Fechas RAW desde API:', {
            fecha_emision: desdeApi.fecha_emision,
            inicio_vigencia: desdeApi.inicio_vigencia,
            termino_vigencia: desdeApi.termino_vigencia
          });
          
          // Convertir snake_case a camelCase para uso interno del frontend
          const datosConvertidos = convertirACamelCase(desdeApi);
          
          console.log('📅 Fechas DESPUÉS de convertir:', {
            fecha_emision: datosConvertidos.fecha_emision,
            inicio_vigencia: datosConvertidos.inicio_vigencia,
            termino_vigencia: datosConvertidos.termino_vigencia
          });
          
          console.log('💰 [EDITAR] Estatus de pago RAW desde API:', {
            estatus_pago: desdeApi.estatus_pago,
            estatusPago: desdeApi.estatusPago
          });
          
          console.log('💰 [EDITAR] Estatus de pago DESPUÉS de convertir:', {
            estatus_pago: datosConvertidos.estatus_pago,
            estatusPago: datosConvertidos.estatusPago
          });
          
          console.log('💰 [EDITAR] Montos de pagos fraccionados desde API:', {
            primer_pago: desdeApi.primer_pago,
            primerPago: desdeApi.primerPago,
            pagos_subsecuentes: desdeApi.pagos_subsecuentes,
            pagosSubsecuentes: desdeApi.pagosSubsecuentes,
            convertidos: {
              primer_pago: datosConvertidos.primer_pago,
              primerPago: datosConvertidos.primerPago,
              pagos_subsecuentes: datosConvertidos.pagos_subsecuentes,
              pagosSubsecuentes: datosConvertidos.pagosSubsecuentes
            }
          });
          
          // ✅ IMPORTANTE: Datos de API tienen prioridad sobre datos en memoria
          expedienteCompleto = { ...datosConvertidos };
          console.log('✅ Expediente recargado desde API con datos frescos');
        }
        try {
          console.groupCollapsed('🌐 API GET /api/expedientes/:id — payload crudo');
          console.log(desdeApi);
          console.groupEnd();
        } catch (_) {}
      } else {
        console.warn('⚠️ No se pudo recargar expediente desde API, usando datos en memoria');
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

    console.log('📅 ANTES de actualizarCalculosAutomaticos:', {
      inicio_vigencia: formularioBase.inicio_vigencia,
      termino_vigencia: formularioBase.termino_vigencia
    });

    // 🎯 CRÍTICO: NO recalcular fechas ni estatus al cargar datos guardados
    // SIEMPRE respetar el estatus_pago de la base de datos
    let formularioConCalculos = { ...formularioBase };
    
    // ✅ IMPORTANTE: Cargar el estatus de pago TAL CUAL está en la BD (sin recalcular)
    // Esto permite al usuario tener control manual del estatus sin interferencia automática
    // Priorizar estatus_pago (snake_case de BD) sobre estatusPago (camelCase convertido)
    const estatusPagoDesdeBD = formularioBase.estatus_pago || formularioBase.estatusPago || 'Pendiente';
    formularioConCalculos.estatusPago = estatusPagoDesdeBD;
    formularioConCalculos.estatus_pago = estatusPagoDesdeBD;
    
    console.log('📊 [EDITAR] Estatus de pago cargado desde BD:', {
      estatus_pago_bd: formularioBase.estatus_pago,
      estatusPago_bd: formularioBase.estatusPago,
      valor_final: estatusPagoDesdeBD
    });

    console.log('📅 DESPUÉS de actualizarCalculosAutomaticos:', {
      inicio_vigencia: formularioConCalculos.inicio_vigencia,
      termino_vigencia: formularioConCalculos.termino_vigencia
    });

    // 📸 CAPTURAR SNAPSHOT INMEDIATAMENTE con los datos de BD (antes de cualquier useEffect)
    // Esto asegura que el snapshot tenga exactamente lo que está en la base de datos
    console.log('📸 [SNAPSHOT] Capturando snapshot INMEDIATO con datos de BD:', {
      id: formularioConCalculos.id,
      estatusPago: formularioConCalculos.estatusPago,
      estatus_pago: formularioConCalculos.estatus_pago
    });
    setFormularioOriginal(JSON.parse(JSON.stringify(formularioConCalculos)));

    // Aplicar al estado en un solo set para evitar inconsistencias por batching
    setFormulario(formularioConCalculos);
    
    // 📸 Capturar snapshot después de cargar TODOS los datos (incluyendo cliente)
    // NO capturamos aquí porque el cliente aún no se ha cargado completamente
    
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
    
    // ⚠️ COMENTADO: Ya no usamos el flag porque capturamos el snapshot inmediatamente
    // snapshotPendiente.current = true;
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

  const verDetalles = useCallback(async (expediente) => {
    setExpedienteSeleccionado(expediente);
    setVistaActual('detalles');
    
    // Primero limpiamos el historial anterior
    setHistorialExpediente([]);
    
    // Luego cargamos el nuevo historial del expediente
    try {
      const response = await fetch(`${API_URL}/api/historial-expedientes/${expediente.id}`);
      if (response.ok) {
        const data = await response.json();
        const historial = data?.data || data || [];
        const historialArray = Array.isArray(historial) ? historial : [];
        setHistorialExpediente(historialArray);
        console.log('📋 Historial cargado para CalendarioPagos:', historialArray.length, 'eventos', historialArray);
      } else {
        setHistorialExpediente([]);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar historial:', error);
      setHistorialExpediente([]);
    }
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
            setModoEdicion={setModoEdicion}
            mostrarModalMetodoCaptura={mostrarModalMetodoCaptura}
            setMostrarModalMetodoCaptura={setMostrarModalMetodoCaptura}
            mostrarExtractorPDF={mostrarExtractorPDF}
            setMostrarExtractorPDF={setMostrarExtractorPDF}
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
            aseguradoras={aseguradoras}
            tiposProductos={tiposProductos}
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
            mostrarExtractorPDF={mostrarExtractorPDF}
            setMostrarExtractorPDF={setMostrarExtractorPDF}
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
            enviarAvisoPago={enviarAvisoPago}
            historial={historialExpediente}
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

      {/* 💰 Modal Aviso/Recordatorio de Pago */}
      {mostrarModalAvisoPago && pagoParaNotificar && expedienteDelPago && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className={`modal-header text-white ${pagoParaNotificar.estado === 'Vencido' ? 'bg-danger' : 'bg-info'}`}>
                <h5 className="modal-title">
                  {pagoParaNotificar.estado === 'Vencido' ? '⚠️ Recordatorio de Pago' : '📧 Aviso de Pago'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModalAvisoPago}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 small">
                  <div><strong>Póliza:</strong> {expedienteDelPago.numero_poliza || 'Sin número'}</div>
                  <div><strong>Cliente:</strong> {expedienteDelPago.cliente_nombre || 'N/A'}</div>
                  <div className="mt-2">
                    <strong>Pago #{pagoParaNotificar.numero}</strong>
                  </div>
                  <div><strong>Fecha:</strong> {utils.formatearFecha(pagoParaNotificar.fecha, 'larga')}</div>
                  <div><strong>Monto:</strong> <span className="badge bg-primary">${pagoParaNotificar.monto}</span></div>
                  <div className="mt-2">
                    <strong>Estado:</strong> <span className={`badge ${pagoParaNotificar.badgeClass}`}>{pagoParaNotificar.estado}</span>
                  </div>
                </div>

                <div className="d-grid gap-2">
                  <button
                    className="btn btn-success d-flex align-items-center justify-content-center"
                    onClick={() => enviarAvisoPagoWhatsApp(pagoParaNotificar, expedienteDelPago)}
                  >
                    <Share2 size={16} className="me-2" /> WhatsApp
                  </button>
                  <button
                    className="btn btn-info text-white d-flex align-items-center justify-content-center"
                    onClick={() => enviarAvisoPagoEmail(pagoParaNotificar, expedienteDelPago)}
                  >
                    <Mail size={16} className="me-2" /> Email
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cerrarModalAvisoPago}>Cerrar</button>
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
              <div className="modal-header bg-success text-white py-2 px-3">
                <h6 className="modal-title mb-0" style={{ fontSize: '0.95rem' }}>
                  <DollarSign size={18} className="me-2" />
                  Aplicar Pago
                </h6>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                    setFechaUltimoPago('');
                    setNumeroReciboPago(1);
                  }}
                  disabled={procesandoPago}
                ></button>
              </div>
              
              <div className="modal-body py-2 px-3">
                {/* Información del expediente */}
                <div className="alert alert-info mb-2 py-2 px-2">
                  <div className="mb-1">
                    <strong style={{ fontSize: '0.85rem' }}>Póliza:</strong> <span style={{ fontSize: '0.85rem' }}>{expedienteParaPago.numero_poliza || 'Sin número'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    <div><strong>Cliente:</strong> {expedienteParaPago.cliente_nombre || 'Sin nombre'}</div>
                    <div><strong>Aseguradora:</strong> {expedienteParaPago.compania || 'N/A'}</div>
                    <div><strong>Producto:</strong> {expedienteParaPago.producto || 'N/A'}</div>
                    {expedienteParaPago.importe_total && (
                      <div className="mt-1">
                        <strong>Monto a pagar:</strong> <span className="badge bg-success" style={{ fontSize: '0.7rem' }}>${parseFloat(expedienteParaPago.importe_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campo para fecha real de pago */}
                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                    <Calendar size={14} className="me-1" />
                    Fecha en que se realizó el pago *
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fechaUltimoPago}
                    onChange={(e) => setFechaUltimoPago(e.target.value)}
                    disabled={procesandoPago}
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    {(() => {
                      const fechaLimite = expedienteParaPago.fecha_vencimiento_pago || expedienteParaPago.proximo_pago;
                      if (fechaLimite) {
                        return `Fecha límite de pago: ${new Date(fechaLimite).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                      }
                      return 'Seleccione la fecha en que el cliente realizó el pago';
                    })()}
                  </small>
                </div>

                {/* Selector de recibo (solo para pagos fraccionados) */}
                {(() => {
                  const esFraccionado = (expedienteParaPago.tipo_pago === 'Fraccionado') || (expedienteParaPago.forma_pago?.toUpperCase() === 'FRACCIONADO');
                  const frecuencia = expedienteParaPago.frecuenciaPago || expedienteParaPago.frecuencia_pago;
                  
                  if (esFraccionado && frecuencia) {
                    const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                    const opciones = [];
                    for (let i = 1; i <= numeroPagos; i++) {
                      opciones.push(i);
                    }
                    
                    return (
                      <div className="mb-2">
                        <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                          <FileText size={14} className="me-1" />
                          Recibo a aplicar pago *
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={numeroReciboPago}
                          onChange={(e) => setNumeroReciboPago(parseInt(e.target.value))}
                          disabled={procesandoPago}
                        >
                          {opciones.map(num => (
                            <option key={num} value={num}>
                              Recibo #{num} de {numeroPagos}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                          Seleccione el número de recibo al que corresponde este pago
                        </small>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Campo para subir comprobante */}
                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                    <Upload size={14} className="me-1" />
                    Comprobante de Pago *
                  </label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
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
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    Formatos permitidos: PDF, JPG, PNG, WEBP (máximo 10MB)
                  </small>
                  
                  {comprobantePago && (
                    <div className="alert alert-success mt-2 mb-0 py-1 px-2 d-flex align-items-center justify-content-between">
                      <div style={{ fontSize: '0.75rem' }}>
                        <CheckCircle size={14} className="me-1" />
                        <strong>{comprobantePago.name}</strong>
                        <small className="d-block ms-3 text-muted" style={{ fontSize: '0.7rem' }}>
                          {(comprobantePago.size / 1024).toFixed(2)} KB
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-1"
                        onClick={() => setComprobantePago(null)}
                        disabled={procesandoPago}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Información adicional */}
                <div className="alert alert-warning mb-0 py-1 px-2">
                  <small style={{ fontSize: '0.7rem' }}>
                    <AlertCircle size={12} className="me-1" />
                    <strong>Importante:</strong> El comprobante de pago se guardará en el expediente 
                    y se agregará un comentario automático en el historial.
                  </small>
                </div>
              </div>
              
              <div className="modal-footer py-2 px-3">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary btn-sm" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                    setFechaUltimoPago('');
                    setNumeroReciboPago(1);
                  }}
                  disabled={procesandoPago}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-success btn-sm"
                  onClick={procesarPagoConComprobante}
                  disabled={!comprobantePago || !fechaUltimoPago || procesandoPago}
                >
                  {procesandoPago ? (
                    <>
                      <Loader size={14} className="me-1 spinner-border spinner-border-sm" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} className="me-1" />
                      Confirmar Pago
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALES DE RENOVACIÓN
          ═══════════════════════════════════════════════════════════════ */}

      {/* Modal 1: Iniciar Cotización de Renovación */}
      {mostrarModalCotizarRenovacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <FileText size={20} className="me-2" />
                  Iniciar Cotización de Renovación
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalCotizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <h6 className="mb-2">
                    <strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza || 'Sin número'}
                  </h6>
                  <p className="mb-1"><strong>Cliente:</strong> {expedienteParaRenovacion.nombre_cliente || 'N/A'}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania || 'N/A'}</p>
                </div>
                
                <p className="text-muted">
                  Se iniciará el proceso de cotización para la renovación de esta póliza. 
                  El expediente se moverá a la carpeta <strong>"En Proceso"</strong> con estado 
                  <strong>"En Cotización - Renovación"</strong>.
                </p>
                
                <p className="text-muted mb-0">
                  <strong>Próximos pasos:</strong>
                </p>
                <ol className="text-muted small">
                  <li>Preparar cotización con la aseguradora</li>
                  <li>Enviar cotización al cliente</li>
                  <li>Esperar autorización del cliente</li>
                </ol>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalCotizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarCotizacionRenovacion}
                >
                  <FileText size={16} className="me-2" />
                  Iniciar Cotización
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Marcar como Autorizado */}
      {mostrarModalAutorizarRenovacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <CheckCircle size={20} className="me-2" />
                  Confirmar Autorización
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalAutorizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <p className="mb-0">
                  ¿Confirmas que el cliente <strong>autorizó</strong> la cotización de renovación?
                </p>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalAutorizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={confirmarRenovacionAutorizada}
                >
                  <CheckCircle size={16} className="me-2" />
                  Sí, Autorizado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Agregar Póliza Renovada */}
      {mostrarModalPolizaRenovada && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <RefreshCw size={20} className="me-2" />
                  Registrar Póliza Renovada
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalPolizaRenovada(false);
                    setExpedienteParaRenovacion(null);
                    setDatosRenovacion({
                      numeroPolizaNueva: '',
                      primaNueva: '',
                      totalNuevo: '',
                      fechaEmisionNueva: '',
                      inicioVigenciaNueva: '',
                      terminoVigenciaNueva: '',
                      observaciones: ''
                    });
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <p className="mb-1"><strong>Póliza Original:</strong> {expedienteParaRenovacion.numero_poliza}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania}</p>
                </div>
                
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Número de Póliza Renovada *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={datosRenovacion.numeroPolizaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, numeroPolizaNueva: e.target.value }))}
                      placeholder="Número de póliza renovada"
                    />
                    <small className="text-muted">Puede ser el mismo o un nuevo número</small>
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Prima *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={datosRenovacion.primaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, primaNueva: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Total *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={datosRenovacion.totalNuevo}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, totalNuevo: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Fecha Emisión *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.fechaEmisionNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, fechaEmisionNueva: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Inicio Vigencia *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.inicioVigenciaNueva}
                      onChange={(e) => {
                        const inicio = e.target.value;
                        if (inicio) {
                          const fechaInicio = new Date(inicio);
                          const fechaTermino = new Date(fechaInicio);
                          fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
                          setDatosRenovacion(prev => ({ 
                            ...prev, 
                            inicioVigenciaNueva: inicio,
                            terminoVigenciaNueva: fechaTermino.toISOString().split('T')[0]
                          }));
                        } else {
                          setDatosRenovacion(prev => ({ ...prev, inicioVigenciaNueva: inicio }));
                        }
                      }}
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Término Vigencia *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.terminoVigenciaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, terminoVigenciaNueva: e.target.value }))}
                    />
                    <small className="text-muted">Auto-calculado (1 año)</small>
                  </div>
                  
                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={datosRenovacion.observaciones}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Comentarios sobre la renovación..."
                    ></textarea>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPolizaRenovada(false);
                    setExpedienteParaRenovacion(null);
                    setDatosRenovacion({
                      numeroPolizaNueva: '',
                      primaNueva: '',
                      totalNuevo: '',
                      fechaEmisionNueva: '',
                      inicioVigenciaNueva: '',
                      terminoVigenciaNueva: '',
                      observaciones: ''
                    });
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-info"
                  onClick={guardarPolizaRenovada}
                  disabled={
                    !datosRenovacion.numeroPolizaNueva ||
                    !datosRenovacion.primaNueva ||
                    !datosRenovacion.totalNuevo ||
                    !datosRenovacion.fechaEmisionNueva ||
                    !datosRenovacion.inicioVigenciaNueva ||
                    !datosRenovacion.terminoVigenciaNueva
                  }
                >
                  <RefreshCw size={16} className="me-2" />
                  Guardar Póliza Renovada
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

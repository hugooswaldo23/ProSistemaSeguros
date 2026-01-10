/**
 * ====================================================================
 * COMPONENTES UI REUTILIZABLES PARA EXPEDIENTES
 * ====================================================================
 * Componentes pequeños de interfaz para el módulo de expedientes
 */

import React from 'react';
import { Search, X } from 'lucide-react';
import utils from '../../utils/expedientesUtils';

/**
 * Badge - Insignia de estado con color dinámico
 * @param {string} tipo - 'etapa', 'pago', 'tipo_pago'
 * @param {string} valor - Valor del estado
 * @param {string} className - Clases CSS adicionales
 */
export const Badge = React.memo(({ tipo, valor, className = '' }) => {
  const badgeClass = utils.getBadgeClass(tipo, valor);
  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {tipo === 'pago' && valor === 'Vencido' && '⚠️ '}
      {valor}
    </span>
  );
});

Badge.displayName = 'Badge';

/**
 * CampoFechaCalculada - Input de fecha con botón de cálculo automático
 * @param {string} label - Etiqueta del campo
 * @param {string} value - Valor de la fecha (YYYY-MM-DD)
 * @param {function} onChange - Callback al cambiar el valor
 * @param {function} onCalculate - Callback para calcular automáticamente
 * @param {boolean} disabled - Si el campo está deshabilitado
 * @param {string} helpText - Texto de ayuda
 */
export const CampoFechaCalculada = React.memo(({ 
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

CampoFechaCalculada.displayName = 'CampoFechaCalculada';

/**
 * InfoCliente - Muestra información del cliente/contacto en tabla
 * @param {object} expediente - Datos del expediente
 * @param {object} cliente - Datos completos del cliente
 */
export const InfoCliente = React.memo(({ expediente, cliente }) => {
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

InfoCliente.displayName = 'InfoCliente';

/**
 * obtenerEstatusPagoDesdeBackend - Calcula el estatus de pago desde el backend
 * @param {object} expediente - Datos del expediente
 * @returns {string} Estatus de pago calculado
 */
export const obtenerEstatusPagoDesdeBackend = (expediente) => {
  // NUEVA LÓGICA: Si tiene recibos, usar la misma lógica que en ListaExpedientes
  if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
    const recibosTotal = expediente.recibos.length;
    const recibosPagados = expediente.recibos.filter(r => r.fecha_pago_real).length;
    
    // Si todos están pagados
    if (recibosPagados >= recibosTotal) {
      return 'Pagado';
    }
    
    // Si no todos están pagados, buscar el primer recibo pendiente
    const primerReciboPendiente = expediente.recibos
      .filter(r => !r.fecha_pago_real)
      .sort((a, b) => a.numero_recibo - b.numero_recibo)[0];
    
    if (primerReciboPendiente && primerReciboPendiente.fecha_vencimiento) {
      const fechaVencimiento = new Date(primerReciboPendiente.fecha_vencimiento);
      const hoy = new Date();
      fechaVencimiento.setHours(0, 0, 0, 0);
      hoy.setHours(0, 0, 0, 0);
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      
      let estatus;
      if (diasRestantes < 0) {
        estatus = 'Vencido';
      } else if (diasRestantes <= 5) {
        estatus = 'Por vencer';
      } else {
        estatus = 'Pendiente';
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Badge estatus calculado:', estatus);
        console.groupEnd();
      }
      return estatus;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Badge: Sin fecha_vencimiento en primer recibo pendiente');
      console.groupEnd();
    }
    return 'Pendiente';
  }

  // FALLBACK: Lógica original para expedientes sin recibos
  const estatusBackend = (expediente.estatus_pago || expediente.estatusPago || '').toLowerCase().trim();
  
  if (estatusBackend) {
    // Normalizar y retornar el estatus del backend
    let estatusNormalizado;
    if (estatusBackend === 'pagado') {
      estatusNormalizado = 'Pagado';
    } else if (estatusBackend === 'vencido') {
      estatusNormalizado = 'Vencido';
    } else if (estatusBackend === 'por vencer' || estatusBackend === 'pago por vencer') {
      estatusNormalizado = 'Por Pagar';
    } else if (estatusBackend === 'pendiente') {
      estatusNormalizado = 'Pendiente';
    } else if (estatusBackend === 'cancelado') {
      estatusNormalizado = 'Cancelado';
    } else {
      estatusNormalizado = estatusBackend.charAt(0).toUpperCase() + estatusBackend.slice(1);
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Badge: Usando estatus del backend:', estatusNormalizado);
      console.groupEnd();
    }
    return estatusNormalizado;
  }
  
  // Solo calcular si NO hay estatus en el backend
  if (expediente.fecha_vencimiento_pago) {
    const fechaVencimiento = new Date(expediente.fecha_vencimiento_pago);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVencimiento.setHours(0, 0, 0, 0);
    
    const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📅 Calculando (sin estatus en BD):', {
        poliza: expediente.numero_poliza,
        fecha_vencimiento: expediente.fecha_vencimiento_pago,
        diasRestantes,
        hoy: hoy.toISOString().split('T')[0]
      });
    }
    
    let nuevoEstatus;
    if (diasRestantes < 0) {
      nuevoEstatus = 'Vencido';
    } else if (diasRestantes <= 15) {
      nuevoEstatus = 'Por Pagar';
    } else {
      nuevoEstatus = 'Pendiente';
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Resultado calculado:', nuevoEstatus);
      console.groupEnd();
    }
    return nuevoEstatus;
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('⚠️ Sin estatus ni fecha, usando Pendiente por defecto');
    console.groupEnd();
  }
  
  // Por defecto
  return 'Pendiente';
};

/**
 * EstadoPago - Muestra el tipo de pago y su estado
 * @param {object} expediente - Datos del expediente
 */
export const EstadoPago = React.memo(({ expediente }) => {
  // 🔥 Leer estatus directamente del backend (NO calcular)
  const estatusDesdeBackend = obtenerEstatusPagoDesdeBackend(expediente);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <small className="fw-semibold text-primary">{expediente.tipo_pago || 'Sin definir'}</small>
      {expediente.frecuenciaPago && (
        <div><small className="text-muted">{expediente.frecuenciaPago}</small></div>
      )}
      <div className="mt-1">
        <Badge tipo="pago" valor={estatusDesdeBackend} className="badge-sm" />
      </div>
    </div>
  );
});

EstadoPago.displayName = 'EstadoPago';

/**
 * BarraBusqueda - Barra de búsqueda con botón de limpiar
 * @param {string} busqueda - Valor de búsqueda actual
 * @param {function} setBusqueda - Callback para actualizar búsqueda
 * @param {string} placeholder - Texto placeholder
 */
export const BarraBusqueda = React.memo(({ busqueda, setBusqueda, placeholder = "Buscar..." }) => (
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

BarraBusqueda.displayName = 'BarraBusqueda';

/**
 * ====================================================================
 * SERVICIO: Historial de Expedientes
 * PROPÓSITO: Gestionar la trazabilidad completa del ciclo de vida
 * FECHA: 2025-11-10
 * ====================================================================
 */

import { API_URL } from '../constants/apiUrl';

/**
 * Tipos de eventos predefinidos para mantener consistencia
 */
export const TIPOS_EVENTO = {
  // Ciclo de cotización
  COTIZACION_CREADA: 'cotizacion_creada',
  COTIZACION_ENVIADA: 'cotizacion_enviada',
  COTIZACION_AUTORIZADA: 'cotizacion_autorizada',
  COTIZACION_RECHAZADA: 'cotizacion_rechazada',
  
  // Ciclo de emisión
  EMISION_INICIADA: 'emision_iniciada',
  POLIZA_EMITIDA: 'poliza_emitida',
  POLIZA_ENVIADA_EMAIL: 'poliza_enviada_email',
  POLIZA_ENVIADA_WHATSAPP: 'poliza_enviada_whatsapp',
  
  // Pagos
  PAGO_REGISTRADO: 'pago_registrado',
  PAGO_VENCIDO: 'pago_vencido',
  RECORDATORIO_PAGO_ENVIADO: 'recordatorio_pago_enviado',
  
  // Renovaciones
  RENOVACION_INICIADA: 'renovacion_iniciada',
  POLIZA_RENOVADA: 'poliza_renovada',
  RECORDATORIO_RENOVACION_ENVIADO: 'recordatorio_renovacion_enviado',
  
  // Cancelaciones
  POLIZA_CANCELADA: 'poliza_cancelada',
  SOLICITUD_CANCELACION: 'solicitud_cancelacion',
  
  // Modificaciones
  ENDOSO_APLICADO: 'endoso_aplicado',
  DATOS_ACTUALIZADOS: 'datos_actualizados',
  
  // Documentos
  DOCUMENTO_CARGADO: 'documento_cargado',
  DOCUMENTO_ENVIADO: 'documento_enviado',
  
  // Comunicaciones generales
  NOTA_AGREGADA: 'nota_agregada',
  LLAMADA_REGISTRADA: 'llamada_registrada',
  REUNION_REGISTRADA: 'reunion_registrada'
};

/**
 * Obtener el icono y color para cada tipo de evento
 */
export const obtenerEstiloEvento = (tipoEvento) => {
  const estilos = {
    [TIPOS_EVENTO.COTIZACION_CREADA]: { icon: '📝', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.COTIZACION_ENVIADA]: { icon: '📧', color: '#ffc107', bgColor: '#fff3cd' },
    [TIPOS_EVENTO.COTIZACION_AUTORIZADA]: { icon: '✅', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.COTIZACION_RECHAZADA]: { icon: '❌', color: '#dc3545', bgColor: '#f8d7da' },
    
    [TIPOS_EVENTO.EMISION_INICIADA]: { icon: '🔄', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.POLIZA_EMITIDA]: { icon: '📄', color: '#007bff', bgColor: '#cce5ff' },
    [TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL]: { icon: '📨', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP]: { icon: '💬', color: '#25d366', bgColor: '#d4f4dd' },
    
    [TIPOS_EVENTO.PAGO_REGISTRADO]: { icon: '💰', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.PAGO_VENCIDO]: { icon: '⚠️', color: '#dc3545', bgColor: '#f8d7da' },
    [TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO]: { icon: '🔔', color: '#ffc107', bgColor: '#fff3cd' },
    
    [TIPOS_EVENTO.RENOVACION_INICIADA]: { icon: '🔄', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.POLIZA_RENOVADA]: { icon: '🔁', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.RECORDATORIO_RENOVACION_ENVIADO]: { icon: '🔔', color: '#ffc107', bgColor: '#fff3cd' },
    
    [TIPOS_EVENTO.POLIZA_CANCELADA]: { icon: '🚫', color: '#dc3545', bgColor: '#f8d7da' },
    [TIPOS_EVENTO.SOLICITUD_CANCELACION]: { icon: '⚠️', color: '#ffc107', bgColor: '#fff3cd' },
    
    [TIPOS_EVENTO.ENDOSO_APLICADO]: { icon: '📝', color: '#007bff', bgColor: '#cce5ff' },
    [TIPOS_EVENTO.DATOS_ACTUALIZADOS]: { icon: '✏️', color: '#6c757d', bgColor: '#e2e3e5' },
    
    [TIPOS_EVENTO.DOCUMENTO_CARGADO]: { icon: '📎', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.DOCUMENTO_ENVIADO]: { icon: '📤', color: '#28a745', bgColor: '#d4edda' },
    
    [TIPOS_EVENTO.NOTA_AGREGADA]: { icon: '📌', color: '#6c757d', bgColor: '#e2e3e5' },
    [TIPOS_EVENTO.LLAMADA_REGISTRADA]: { icon: '📞', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.REUNION_REGISTRADA]: { icon: '👥', color: '#007bff', bgColor: '#cce5ff' }
  };
  
  return estilos[tipoEvento] || { icon: '📋', color: '#6c757d', bgColor: '#e2e3e5' };
};

/**
 * Obtener título legible para cada tipo de evento
 */
export const obtenerTituloEvento = (tipoEvento) => {
  const titulos = {
    [TIPOS_EVENTO.COTIZACION_CREADA]: 'Cotización Creada',
    [TIPOS_EVENTO.COTIZACION_ENVIADA]: 'Cotización Enviada al Cliente',
    [TIPOS_EVENTO.COTIZACION_AUTORIZADA]: 'Cotización Autorizada',
    [TIPOS_EVENTO.COTIZACION_RECHAZADA]: 'Cotización Rechazada',
    
    [TIPOS_EVENTO.EMISION_INICIADA]: 'Emisión de Póliza Iniciada',
    [TIPOS_EVENTO.POLIZA_EMITIDA]: 'Póliza Emitida',
    [TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL]: 'Póliza Enviada por Email',
    [TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP]: 'Póliza Enviada por WhatsApp',
    
    [TIPOS_EVENTO.PAGO_REGISTRADO]: 'Pago Registrado',
    [TIPOS_EVENTO.PAGO_VENCIDO]: 'Pago Vencido',
    [TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO]: 'Recordatorio de Pago Enviado',
    
    [TIPOS_EVENTO.RENOVACION_INICIADA]: 'Proceso de Renovación Iniciado',
    [TIPOS_EVENTO.POLIZA_RENOVADA]: 'Póliza Renovada',
    [TIPOS_EVENTO.RECORDATORIO_RENOVACION_ENVIADO]: 'Recordatorio de Renovación Enviado',
    
    [TIPOS_EVENTO.POLIZA_CANCELADA]: 'Póliza Cancelada',
    [TIPOS_EVENTO.SOLICITUD_CANCELACION]: 'Solicitud de Cancelación',
    
    [TIPOS_EVENTO.ENDOSO_APLICADO]: 'Endoso Aplicado',
    [TIPOS_EVENTO.DATOS_ACTUALIZADOS]: 'Datos Actualizados',
    
    [TIPOS_EVENTO.DOCUMENTO_CARGADO]: 'Documento Cargado',
    [TIPOS_EVENTO.DOCUMENTO_ENVIADO]: 'Documento Enviado',
    
    [TIPOS_EVENTO.NOTA_AGREGADA]: 'Nota Agregada',
    [TIPOS_EVENTO.LLAMADA_REGISTRADA]: 'Llamada Registrada',
    [TIPOS_EVENTO.REUNION_REGISTRADA]: 'Reunión Registrada'
  };
  
  return titulos[tipoEvento] || tipoEvento.replace(/_/g, ' ').toUpperCase();
};

/**
 * Registrar un evento en el historial del expediente
 */
export const registrarEvento = async (datos) => {
  try {
    console.log('📝 Registrando evento en historial:', datos);
    
    const response = await fetch(`${API_URL}/api/historial-expedientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expediente_id: datos.expediente_id,
        cliente_id: datos.cliente_id || null,
        tipo_evento: datos.tipo_evento,
        etapa_anterior: datos.etapa_anterior || null,
        etapa_nueva: datos.etapa_nueva || null,
        usuario_id: datos.usuario_id || null,
        usuario_nombre: datos.usuario_nombre || 'Sistema',
        descripcion: datos.descripcion || '',
        datos_adicionales: datos.datos_adicionales || null,
        metodo_contacto: datos.metodo_contacto || null,
        destinatario_nombre: datos.destinatario_nombre || null,
        destinatario_contacto: datos.destinatario_contacto || null,
        documento_url: datos.documento_url || null,
        documento_tipo: datos.documento_tipo || null,
        fecha_evento: datos.fecha_evento || new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const resultado = await response.json();
    console.log('✅ Evento registrado exitosamente:', resultado);
    return resultado;
    
  } catch (error) {
    console.error('❌ Error al registrar evento:', error);
    throw error;
  }
};

/**
 * Obtener historial completo de un expediente
 */
export const obtenerHistorialExpediente = async (expedienteId) => {
  try {
    console.log('🔍 Obteniendo historial del expediente:', expedienteId);
    
    const response = await fetch(`${API_URL}/api/historial-expedientes/expediente/${expedienteId}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const historial = await response.json();
    console.log(`✅ Historial obtenido: ${historial.length} eventos`);
    return historial;
    
  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    return [];
  }
};

/**
 * Obtener historial de un cliente (todos sus expedientes)
 */
export const obtenerHistorialCliente = async (clienteId) => {
  try {
    console.log('🔍 Obteniendo historial del cliente:', clienteId);
    
    const response = await fetch(`${API_URL}/api/historial-expedientes/cliente/${clienteId}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const historial = await response.json();
    console.log(`✅ Historial obtenido: ${historial.length} eventos`);
    return historial;
    
  } catch (error) {
    console.error('❌ Error al obtener historial del cliente:', error);
    return [];
  }
};

/**
 * Obtener eventos por tipo
 */
export const obtenerEventosPorTipo = async (expedienteId, tipoEvento) => {
  try {
    const response = await fetch(`${API_URL}/api/historial-expedientes/expediente/${expedienteId}?tipo=${tipoEvento}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('❌ Error al obtener eventos por tipo:', error);
    return [];
  }
};

/**
 * Helper: Registrar cambio de etapa automáticamente
 */
export const registrarCambioEtapa = async (expedienteId, clienteId, etapaAnterior, etapaNueva, usuarioNombre, descripcionAdicional = '') => {
  let tipoEvento = TIPOS_EVENTO.DATOS_ACTUALIZADOS;
  let descripcion = `Cambio de etapa: ${etapaAnterior} → ${etapaNueva}`;
  
  // Mapear etapa a tipo de evento específico
  if (etapaNueva === 'En cotización') {
    tipoEvento = TIPOS_EVENTO.COTIZACION_CREADA;
    descripcion = 'Cotización creada y en proceso';
  } else if (etapaNueva === 'Cotización enviada') {
    tipoEvento = TIPOS_EVENTO.COTIZACION_ENVIADA;
    descripcion = 'Cotización enviada al cliente';
  } else if (etapaNueva === 'Autorizado') {
    tipoEvento = TIPOS_EVENTO.COTIZACION_AUTORIZADA;
    descripcion = 'Cotización autorizada por el cliente';
  } else if (etapaNueva === 'En proceso emisión') {
    tipoEvento = TIPOS_EVENTO.EMISION_INICIADA;
    descripcion = 'Proceso de emisión de póliza iniciado';
  } else if (etapaNueva === 'Emitida') {
    tipoEvento = TIPOS_EVENTO.POLIZA_EMITIDA;
    descripcion = 'Póliza emitida exitosamente';
  } else if (etapaNueva === 'Cancelado') {
    tipoEvento = TIPOS_EVENTO.POLIZA_CANCELADA;
    descripcion = 'Póliza cancelada';
  }
  
  if (descripcionAdicional) {
    descripcion += `. ${descripcionAdicional}`;
  }
  
  return await registrarEvento({
    expediente_id: expedienteId,
    cliente_id: clienteId,
    tipo_evento: tipoEvento,
    etapa_anterior: etapaAnterior,
    etapa_nueva: etapaNueva,
    usuario_nombre: usuarioNombre,
    descripcion: descripcion
  });
};

/**
 * Helper: Registrar envío de documento
 */
export const registrarEnvioDocumento = async (expedienteId, clienteId, canal, destinatario, mensaje, documentoUrl = null) => {
  const tipoEvento = canal === 'Email' 
    ? TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL 
    : TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP;
  
  return await registrarEvento({
    expediente_id: expedienteId,
    cliente_id: clienteId,
    tipo_evento: tipoEvento,
    usuario_nombre: 'Sistema',
    descripcion: `Documento enviado por ${canal}`,
    metodo_contacto: canal,
    destinatario_nombre: destinatario.nombre,
    destinatario_contacto: destinatario.contacto,
    documento_url: documentoUrl,
    documento_tipo: 'poliza',
    datos_adicionales: {
      mensaje: mensaje,
      fecha_envio: new Date().toISOString()
    }
  });
};

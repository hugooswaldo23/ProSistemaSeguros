/**
 * ====================================================================
 * SERVICIO: Historial de Expedientes
 * PROPÓSITO: Gestionar la trazabilidad completa del ciclo de vida
 * FECHA: 2025-11-10
 * ACTUALIZADO: 2026-01-09 - Sistema de etapas renovado
 * ====================================================================
 * 
 * 🔄 NUEVO FLUJO DE ETAPAS:
 * 1. Emitida → 2. Enviada al Cliente → 3. Pagada → 4. Por Renovar →
 * 5. Renovación Emitida → 6. Renovación Enviada → 7. Renovación Pagada
 * 
 * ⚠️ IMPORTANTE - CAMBIO ETAPA AUTOMÁTICA "Por Renovar":
 * El backend debe calcular dinámicamente cuando una póliza "Pagada" debe
 * cambiar a "Por Renovar" basándose en fecha_aviso_renovacion.
 * Ver documentación: docs/BACKEND-CALCULO-DINAMICO-ETAPA-POR-RENOVAR.md
 * 
 * El frontend ya está preparado para usar campo 'etapa_calculada' del backend.
 * ====================================================================
 */

import { API_URL } from '../constants/apiUrl';

/**
 * Tipos de eventos predefinidos para mantener consistencia
 */
export const TIPOS_EVENTO = {
  // Captura y creación
  CAPTURA_MANUAL: 'captura_manual',
  CAPTURA_EXTRACTOR_PDF: 'captura_extractor_pdf',
  
  // Ciclo de cotización
  COTIZACION_SOLICITADA: 'cotizacion_solicitada',
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
  AVISO_PAGO_ENVIADO: 'aviso_pago_enviado',
  PAGO_APLICADO_MANUALMENTE: 'pago_aplicado_manualmente',
  PAGO_REMOVIDO: 'pago_removido',
  POLIZA_PAGADA: 'poliza_pagada', // 🆕 Cambio de etapa a "Pagada"
  
  // Renovaciones
  RENOVACION_INICIADA: 'renovacion_iniciada',
  POLIZA_RENOVADA: 'poliza_renovada',
  RECORDATORIO_RENOVACION_ENVIADO: 'recordatorio_renovacion_enviado',
  POLIZA_POR_RENOVAR: 'poliza_por_renovar', // 🆕 30 días antes del vencimiento
  
  // 🆕 NUEVOS EVENTOS DE RENOVACIÓN (Flujo completo)
  COTIZACION_RENOVACION_INICIADA: 'cotizacion_renovacion_iniciada',
  COTIZACION_RENOVACION_ENVIADA: 'cotizacion_renovacion_enviada',
  RENOVACION_PENDIENTE_EMISION: 'renovacion_pendiente_emision',
  RENOVACION_EMITIDA: 'renovacion_emitida',
  RENOVACION_ENVIADA: 'renovacion_enviada', // 🆕 Renovación enviada al cliente
  RENOVACION_PAGADA: 'renovacion_pagada', // 🆕 Renovación pagada
  PAGO_RENOVACION_REGISTRADO: 'pago_renovacion_registrado',
  RENOVACION_VIGENTE: 'renovacion_vigente',
  
  // Vigencia y vencimientos
  POLIZA_EN_VIGENCIA: 'poliza_en_vigencia',
  POLIZA_PROXIMA_VENCER: 'poliza_proxima_vencer',
  POLIZA_VENCIDA: 'poliza_vencida',
  
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
    [TIPOS_EVENTO.CAPTURA_MANUAL]: { icon: '✍️', color: '#6c757d', bgColor: '#e2e3e5' },
    [TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF]: { icon: '📄', color: '#6f42c1', bgColor: '#e7d9f7' },
    
    [TIPOS_EVENTO.COTIZACION_SOLICITADA]: { icon: '📞', color: '#6c757d', bgColor: '#e2e3e5' },
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
    [TIPOS_EVENTO.AVISO_PAGO_ENVIADO]: { icon: '📢', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.PAGO_APLICADO_MANUALMENTE]: { icon: '✏️', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.PAGO_REMOVIDO]: { icon: '🔙', color: '#fd7e14', bgColor: '#ffe5d0' },
    [TIPOS_EVENTO.POLIZA_PAGADA]: { icon: '✅', color: '#28a745', bgColor: '#d4edda' },
    
    [TIPOS_EVENTO.RENOVACION_INICIADA]: { icon: '🔄', color: '#17a2b8', bgColor: '#d1ecf1' },
    [TIPOS_EVENTO.POLIZA_RENOVADA]: { icon: '🔁', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.RECORDATORIO_RENOVACION_ENVIADO]: { icon: '🔔', color: '#ffc107', bgColor: '#fff3cd' },
    [TIPOS_EVENTO.POLIZA_POR_RENOVAR]: { icon: '⏰', color: '#ffc107', bgColor: '#fff3cd' },
    
    // 🆕 NUEVOS ESTILOS DE RENOVACIÓN
    [TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA]: { icon: '📝', color: '#3b82f6', bgColor: '#dbeafe' },
    [TIPOS_EVENTO.COTIZACION_RENOVACION_ENVIADA]: { icon: '📧', color: '#10b981', bgColor: '#d1fae5' },
    [TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION]: { icon: '⏳', color: '#f59e0b', bgColor: '#fef3c7' },
    [TIPOS_EVENTO.RENOVACION_EMITIDA]: { icon: '📄', color: '#8b5cf6', bgColor: '#ede9fe' },
    [TIPOS_EVENTO.RENOVACION_ENVIADA]: { icon: '📨', color: '#10b981', bgColor: '#d1fae5' },
    [TIPOS_EVENTO.RENOVACION_PAGADA]: { icon: '✅', color: '#059669', bgColor: '#d1fae5' },
    [TIPOS_EVENTO.PAGO_RENOVACION_REGISTRADO]: { icon: '💰', color: '#10b981', bgColor: '#d1fae5' },
    [TIPOS_EVENTO.RENOVACION_VIGENTE]: { icon: '🔁', color: '#059669', bgColor: '#d1fae5' },
    
    [TIPOS_EVENTO.POLIZA_EN_VIGENCIA]: { icon: '✅', color: '#28a745', bgColor: '#d4edda' },
    [TIPOS_EVENTO.POLIZA_PROXIMA_VENCER]: { icon: '⏰', color: '#ffc107', bgColor: '#fff3cd' },
    [TIPOS_EVENTO.POLIZA_VENCIDA]: { icon: '❌', color: '#dc3545', bgColor: '#f8d7da' },
    
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
    [TIPOS_EVENTO.CAPTURA_MANUAL]: 'Captura Manual',
    [TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF]: 'Captura con Extractor PDF',
    
    [TIPOS_EVENTO.COTIZACION_SOLICITADA]: 'Cotización Solicitada',
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
    [TIPOS_EVENTO.POLIZA_PAGADA]: 'Póliza Pagada',
    
    [TIPOS_EVENTO.RENOVACION_INICIADA]: 'Proceso de Renovación Iniciado',
    [TIPOS_EVENTO.POLIZA_RENOVADA]: 'Póliza Renovada',
    [TIPOS_EVENTO.RECORDATORIO_RENOVACION_ENVIADO]: 'Recordatorio de Renovación Enviado',
    [TIPOS_EVENTO.POLIZA_POR_RENOVAR]: 'Póliza Por Renovar',
    
    // 🆕 NUEVOS TÍTULOS DE RENOVACIÓN
    [TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA]: 'Cotización de Renovación Iniciada',
    [TIPOS_EVENTO.COTIZACION_RENOVACION_ENVIADA]: 'Cotización de Renovación Enviada',
    [TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION]: 'Renovación Pendiente de Emisión',
    [TIPOS_EVENTO.RENOVACION_EMITIDA]: 'Renovación Emitida',
    [TIPOS_EVENTO.RENOVACION_ENVIADA]: 'Renovación Enviada al Cliente',
    [TIPOS_EVENTO.RENOVACION_PAGADA]: 'Renovación Pagada',
    [TIPOS_EVENTO.PAGO_RENOVACION_REGISTRADO]: 'Pago de Renovación Registrado',
    [TIPOS_EVENTO.RENOVACION_VIGENTE]: 'Renovación Vigente',
    
    [TIPOS_EVENTO.POLIZA_EN_VIGENCIA]: 'Póliza en Vigencia',
    [TIPOS_EVENTO.POLIZA_PROXIMA_VENCER]: 'Póliza Próxima a Vencer',
    [TIPOS_EVENTO.POLIZA_VENCIDA]: 'Póliza Vencida',
    
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
    
    const payload = {
      expediente_id: datos.expediente_id,
      cliente_id: datos.cliente_id || null,
      tipo_evento: datos.tipo_evento,
      etapa_anterior: datos.etapa_anterior || null,
      etapa_nueva: datos.etapa_nueva || null,
      usuario_id: datos.usuario_id || obtenerUsuarioActual().id || null,
      usuario_nombre: datos.usuario_nombre || obtenerUsuarioActual().nombre || 'Sistema',
      descripcion: datos.descripcion || '',
      datos_adicionales: datos.datos_adicionales ? JSON.stringify(datos.datos_adicionales) : null,
      metodo_contacto: datos.metodo_contacto || null,
      destinatario_nombre: datos.destinatario_nombre || null,
      destinatario_contacto: datos.destinatario_contacto || null,
      documento_url: datos.documento_url || null,
      documento_tipo: datos.documento_tipo || null
      // ✅ NO enviamos fecha_evento - el backend la genera con su hora del servidor
    };
    
    console.log('📤 Payload final enviado al backend:', payload);
    
    const response = await fetch(`${API_URL}/api/historial-expedientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ Error del backend:', response.status, errorBody);
      throw new Error(`Error HTTP: ${response.status} - ${errorBody}`);
    }
    
    const data = await response.json();
    console.log('✅ Evento registrado exitosamente:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error al registrar evento:', error);
    throw error;
  }
};

/**
 * Obtener usuario actual desde almacenamiento local (placeholder simple).
 * Convención: localStorage.setItem('usuarioActual', JSON.stringify({ id, nombre }))
 */
export const obtenerUsuarioActual = () => {
  try {
    const raw = localStorage.getItem('usuarioActual');
    if (!raw) return { id: null, nombre: 'Sistema' };
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || null,
      nombre: parsed.nombre || parsed.username || 'Sistema'
    };
  } catch (_) {
    return { id: null, nombre: 'Sistema' };
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
    
    const result = await response.json();
    console.log('📦 Respuesta del backend:', result);
    
    // Manejar diferentes formatos de respuesta del backend
    const historial = result.data || result;
    console.log(`✅ Historial obtenido: ${Array.isArray(historial) ? historial.length : 0} eventos`, historial);
    
    return Array.isArray(historial) ? historial : [];
    
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
 * MAPEO COMPLETO DEL FLUJO:
 * 1. En cotización → COTIZACION_CREADA
 * 2. Cotización enviada → COTIZACION_ENVIADA
 * 3. Autorizado → COTIZACION_AUTORIZADA
 * 4. En proceso emisión → EMISION_INICIADA
 * 5. Emitida → POLIZA_EMITIDA
 * 6. Enviada al Cliente → (se registra con registrarEnvioDocumento en WhatsApp/Email)
 * 7. Renovada → POLIZA_RENOVADA
 * 8. Cancelada → POLIZA_CANCELADA
 */
export const registrarCambioEtapa = async (expedienteId, clienteId, etapaAnterior, etapaNueva, usuarioNombre, descripcionAdicional = '', tipoEventoPersonalizado = null) => {
  let tipoEvento = tipoEventoPersonalizado || TIPOS_EVENTO.DATOS_ACTUALIZADOS;
  let descripcion = `Cambio de etapa: ${etapaAnterior} → ${etapaNueva}`;
  
  // Si no se especificó tipo de evento personalizado, mapear etapa a tipo de evento específico
  if (!tipoEventoPersonalizado) {
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
    } else if (etapaNueva === 'Enviada al Cliente') {
      // Nota: Este cambio normalmente se registra con registrarEnvioDocumento,
      // pero si se cambia manualmente la etapa, lo registramos aquí
      tipoEvento = TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL; // Por defecto email
      descripcion = 'Póliza marcada como enviada al cliente';
    } else if (etapaNueva === 'En Vigencia') {
      tipoEvento = TIPOS_EVENTO.POLIZA_EN_VIGENCIA;
      descripcion = 'Póliza en vigencia activa';
    } else if (etapaNueva === 'Vencida') {
      tipoEvento = TIPOS_EVENTO.POLIZA_VENCIDA;
      descripcion = 'Póliza vencida';
    } else if (etapaNueva === 'Renovada') {
      tipoEvento = TIPOS_EVENTO.POLIZA_RENOVADA;
      descripcion = 'Póliza renovada exitosamente';
    } else if (etapaNueva === 'Cancelada' || etapaNueva === 'Cancelado') {
      tipoEvento = TIPOS_EVENTO.POLIZA_CANCELADA;
      descripcion = 'Póliza cancelada';
    }
  }
  
  if (descripcionAdicional) {
    descripcion = descripcionAdicional; // Usar la descripción personalizada completa
  }
  
  const usuario = obtenerUsuarioActual();
  return await registrarEvento({
    expediente_id: expedienteId,
    cliente_id: clienteId,
    tipo_evento: tipoEvento,
    etapa_anterior: etapaAnterior,
    etapa_nueva: etapaNueva,
    usuario_id: usuario.usuario_id || usuario.id || null,
    usuario_nombre: usuarioNombre || usuario.nombre,
    descripcion: descripcion
  });
};

/**
 * Helper: Registrar envío de documento
 * 
 * @param {number} expedienteId - ID del expediente
 * @param {number} clienteId - ID del cliente
 * @param {string} canal - 'Email' o 'WhatsApp'
 * @param {Object} destinatario - { nombre, contacto }
 * @param {string} mensaje - Mensaje completo (se descartará, solo para compatibilidad)
 * @param {string} documentoUrl - URL del documento (opcional)
 */
export const registrarEnvioDocumento = async (expedienteId, clienteId, canal, destinatario, mensaje, documentoUrl = null) => {
  const tipoEvento = canal === 'Email' 
    ? TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL 
    : TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP;
  
  const usuario = obtenerUsuarioActual();
  
  // 📝 Descripción simplificada: Solo lo esencial
  const descripcion = `Enviado a ${destinatario.nombre} por ${canal} (${destinatario.contacto})`;
  
  return await registrarEvento({
    expediente_id: expedienteId,
    cliente_id: clienteId,
    tipo_evento: tipoEvento,
    usuario_id: usuario.id || null,
    usuario_nombre: usuario.nombre || 'Sistema',
    descripcion: descripcion,
    metodo_contacto: canal,
    destinatario_nombre: destinatario.nombre,
    destinatario_contacto: destinatario.contacto,
    documento_url: documentoUrl,
    documento_tipo: 'poliza',
    datos_adicionales: {
      // ✅ NO guardamos el mensaje completo, solo metadata esencial
      canal: canal,
      tiene_documento: !!documentoUrl
    }
  });
};

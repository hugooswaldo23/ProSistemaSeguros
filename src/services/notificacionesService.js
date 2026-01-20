/**
 * Servicio para gestión de notificaciones/comunicaciones con clientes
 * 
 * Funcionalidades:
 * - Registrar envío de notificaciones (WhatsApp, Email, SMS)
 * - Obtener historial de notificaciones por expediente o cliente
 * - Generar mensajes dinámicos según el estado de la póliza
 */

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Tipos de notificación soportados
 */
export const TIPOS_NOTIFICACION = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms'
};

/**
 * Tipos de mensaje según el propósito
 */
export const TIPOS_MENSAJE = {
  EMISION: 'emision',
  RENOVACION_EMISION: 'renovacion_emision',
  RECORDATORIO_PAGO: 'recordatorio_pago',
  PAGO_VENCIDO: 'pago_vencido',
  PAGO_RECIBIDO: 'pago_recibido',
  RENOVACION: 'renovacion',
  CANCELACION: 'cancelacion',
  MODIFICACION: 'modificacion',
  OTRO: 'otro'
};

/**
 * Registrar una notificación enviada
 * @param {Object} datos - Datos de la notificación
 * @returns {Promise<Object>} Notificación registrada
 */
export async function registrarNotificacion(datos) {
  try {
    const response = await fetch(`${API_URL}/api/notificaciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(datos)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al registrar notificación');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error en registrarNotificacion:', error);
    throw error;
  }
}

/**
 * Obtener historial de notificaciones por expediente
 * @param {number} expedienteId - ID del expediente
 * @returns {Promise<Array>} Lista de notificaciones
 */
export async function obtenerNotificacionesPorExpediente(expedienteId) {
  try {
    const response = await fetch(`${API_URL}/api/notificaciones/expediente/${expedienteId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener notificaciones');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error en obtenerNotificacionesPorExpediente:', error);
    throw error;
  }
}

/**
 * Obtener historial de notificaciones por cliente
 * @param {string} clienteId - ID del cliente
 * @returns {Promise<Array>} Lista de notificaciones
 */
export async function obtenerNotificacionesPorCliente(clienteId) {
  try {
    const response = await fetch(`${API_URL}/api/notificaciones/cliente/${clienteId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener notificaciones');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error en obtenerNotificacionesPorCliente:', error);
    throw error;
  }
}

/**
 * Determinar el tipo de mensaje según el estado del expediente
 * @param {Object} expediente - Datos del expediente
 * @returns {string} Tipo de mensaje
 */
export function determinarTipoMensaje(expediente) {
  // PRIORIDAD 1: Si está cancelada
  if (expediente.etapa_activa === 'Cancelada') {
    return TIPOS_MENSAJE.CANCELACION;
  }

  // PRIORIDAD 2: Verificar estatus de pago (más importante que la etapa)
  // Si el pago está vencido, es urgente comunicarlo
  if (expediente.estatusPago === 'Vencido') {
    return TIPOS_MENSAJE.PAGO_VENCIDO;
  }

  // Si el pago está por vencer, es recordatorio
  if (expediente.estatusPago === 'Por Vencer') {
    return TIPOS_MENSAJE.RECORDATORIO_PAGO;
  }

  // PRIORIDAD 3: Si es renovación emitida o enviada
  if (expediente.etapa_activa === 'Renovación Emitida' || expediente.etapa_activa === 'Renovación Enviada') {
    return TIPOS_MENSAJE.RENOVACION_EMISION;
  }

  // PRIORIDAD 4: Si es emisión o envío al cliente (solo si pagos están OK)
  if (expediente.etapa_activa === 'Emitida' || expediente.etapa_activa === 'Enviada al Cliente') {
    // Si el pago está al día, mostrar mensaje de emisión
    if (expediente.estatusPago === 'Pagado' || expediente.estatusPago === 'Pendiente') {
      return TIPOS_MENSAJE.EMISION;
    }
  }

  // PRIORIDAD 5: Si ya está pagado
  if (expediente.estatusPago === 'Pagado') {
    return TIPOS_MENSAJE.PAGO_RECIBIDO;
  }

  // Por defecto
  return TIPOS_MENSAJE.OTRO;
}

/**
 * Generar mensaje dinámico para WhatsApp según el estado
 * @param {Object} expediente - Datos del expediente
 * @param {Object} utils - Utilidades de formateo
 * @param {string} pdfUrl - URL del PDF (opcional)
 * @param {boolean} esCompartirPoliza - Si es true, usa formato "Te compartimos tu póliza..." sin importar el estado
 * @returns {Object} { tipoMensaje, mensaje }
 */
export function generarMensajeWhatsApp(expediente, utils, pdfUrl = null, esCompartirPoliza = true) {
  const tipoMensaje = determinarTipoMensaje(expediente);
  
  const numeroPoliza = expediente.numero_poliza || 'Sin número';
  const compania = expediente.compania || 'N/A';
  const producto = expediente.producto || 'N/A';
  const esAuto = (producto || '').toLowerCase().includes('auto');
  const esMoto = (producto || '').toLowerCase().includes('moto');
  const tipoVehiculo = esAuto ? 'auto' : esMoto ? 'moto' : 'vehículo';
  const marca = expediente.marca || expediente.marcaVehiculo || '';
  const modelo = expediente.modelo || '';
  const anio = expediente.año || expediente.anio || '';
  const placas = expediente.placas || expediente.placa || expediente.placa_vehicular || '';
  const inicioVig = utils.formatearFecha(expediente.inicio_vigencia, 'cortaY');
  const finVig = utils.formatearFecha(expediente.termino_vigencia, 'cortaY');
  const primaTotal = utils.formatearMoneda(expediente.total || 0);
  const fechaPagoFmt = utils.formatearFecha(expediente.fecha_vencimiento_pago, 'cortaY');
  const diasRest = utils.calcularDiasRestantes(expediente.fecha_vencimiento_pago);

  let mensaje = '';
  let lineaPago = '';

  // Verificar si la póliza está vencida (término de vigencia)
  const fechaTermino = new Date(expediente.termino_vigencia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fechaTermino.setHours(0, 0, 0, 0);
  const polizaVencida = fechaTermino < hoy;
  const diasVencidosPoliza = polizaVencida ? Math.floor((hoy - fechaTermino) / (1000 * 60 * 60 * 24)) : 0;

  // Construir línea de pago
  if (expediente.estatusPago === 'Pagado') {
    lineaPago = `📆 *Pago:* ${fechaPagoFmt}  ✅ *Pagado*`;
  } else if (typeof diasRest === 'number') {
    lineaPago = `📆 *Fecha de pago:* ${fechaPagoFmt}`;
    if (diasRest > 0) lineaPago += `  ⏳ Vence en ${diasRest} día(s)`;
    if (diasRest === 0) lineaPago += `  ⚠️ *Vence HOY*`;
    if (diasRest < 0) lineaPago += `  🚨 *VENCIDO* hace ${Math.abs(diasRest)} día(s)`;
  }

  // Información común del vehículo (si aplica)
  const infoVehiculo = (esAuto || esMoto || marca || modelo || anio || placas) ? [
    `🚗 *Vehículo:* ${[marca, modelo, anio].filter(Boolean).join(' ')}` + (placas ? `  •  Placas: ${placas}` : '')
  ] : [];

  // 🆕 Si es acción de "Compartir Póliza", usar formato consistente
  if (esCompartirPoliza && (tipoMensaje === TIPOS_MENSAJE.EMISION || tipoMensaje === TIPOS_MENSAJE.PAGO_VENCIDO || tipoMensaje === TIPOS_MENSAJE.RECORDATORIO_PAGO)) {
    // Determinar contexto adicional según el estado
    let contextoEstado = '';
    
    if (expediente.estatusPago === 'Vencido' || (diasRest < 0)) {
      contextoEstado = `Sin embargo, es importante considerar que *tu pago se encuentra vencido*, es urgente que regularices tu situación para mantener tu cobertura activa y evitar problemas en caso de siniestro.`;
    } else if (expediente.estatusPago === 'Por Vencer' || (diasRest >= 0 && diasRest <= 5)) {
      contextoEstado = `Te recordamos que *tu próximo pago está próximo a vencer*. Por favor realiza tu pago a tiempo para mantener tu cobertura sin interrupciones.`;
    } else if (polizaVencida) {
      contextoEstado = `Sin embargo, es importante considerar que *tu póliza venció hace ${diasVencidosPoliza} día(s)*, lo que significa que *NO CUENTAS CON COBERTURA*. Es urgente renovar tu póliza para estar protegido.`;
    }

    // TODO: Pendiente arreglo de Hugo en BD - recibos y estatus
    // Una vez que Hugo corrija la tabla recibos_pago y la sincronización de estatus,
    // regresar aquí para validar y ajustar esta lógica según la estructura final de datos
    
    // Construir información de recibos si es fraccionado
    let infoRecibos = [];
    if (expediente.tipo_pago === 'Fraccionado' && expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
      infoRecibos = [
        '',
        '*📋 Recibos de pago:*'
      ];
      
      expediente.recibos.forEach((recibo, index) => {
        const fechaRecibo = utils.formatearFecha(recibo.fecha_vencimiento, 'cortaY');
        const montoRecibo = utils.formatearMoneda(recibo.monto);
        let estadoIcon = '';
        
        if (recibo.estado_pago === 'Pagado') {
          estadoIcon = '✅';
        } else if (recibo.estado_pago === 'Vencido') {
          estadoIcon = '🚨';
        } else if (recibo.estado_pago === 'Por Vencer') {
          estadoIcon = '⏰';
        } else {
          estadoIcon = '⏳';
        }
        
        infoRecibos.push(`${estadoIcon} Pago ${recibo.numero_recibo}/${expediente.recibos.length}: $${montoRecibo} - Vence ${fechaRecibo} - ${recibo.estado_pago}`);
      });
    }

    mensaje = [
      `*📋 Póliza • ${numeroPoliza}*`,
      '',
      'Estimado cliente,',
      `Te compartimos la póliza de tu ${tipoVehiculo}.`,
      '',
      ...(contextoEstado ? [contextoEstado, ''] : []),
      '*Detalles de tu póliza:*',
      `🏢 *Aseguradora:* ${compania}`,
      `📦 *Producto:* ${producto}`,
      ...infoVehiculo,
      `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
      `💵 *Prima total:* ${primaTotal}`,
      `💳 *Forma de pago:* ${expediente.tipo_pago || 'N/A'}`,
      ...(expediente.fecha_vencimiento_pago ? [`📆 *Fecha límite de pago:* ${fechaPagoFmt}`] : []),
      ...(expediente.estatusPago ? [`💳 *Estatus del pago:* ${expediente.estatusPago}`] : []),
      ...infoRecibos,
      '',
      ...(pdfUrl ? [
        `📄 *Descarga tu póliza aquí:*`,
        `👉 ${pdfUrl}`
      ] : []),
      '',
      '◆ Cualquier duda, estamos para servirte.',
      '',
      'Saludos cordiales,',
      '*DCPRO Administración* 🏢'
    ].filter(Boolean).join('\n');
    
    return { tipoMensaje, mensaje };
  }

  // Generar mensaje según el tipo (para notificaciones directas, no compartir póliza)
  switch (tipoMensaje) {
    case TIPOS_MENSAJE.EMISION:
      mensaje = [
        `*✅ Póliza emitida • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        'Te compartimos los detalles de tu póliza:',
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
        ...(polizaVencida ? [``, `🚨 *IMPORTANTE: Póliza vencida hace ${diasVencidosPoliza} día(s)*`, `⚠️ *NO CUENTAS CON COBERTURA.* Es urgente renovar tu póliza para estar protegido.`] : []),
        `💵 *Prima total:* ${primaTotal}`,
        lineaPago
      ].join('\n');
      break;

    case TIPOS_MENSAJE.RECORDATORIO_PAGO:
      mensaje = [
        `*⏰ Recordatorio de pago • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        `Te recordamos que tu pago está próximo a vencer:`,
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
        ...(polizaVencida ? [``, `🚨 *IMPORTANTE: Póliza vencida hace ${diasVencidosPoliza} día(s)*`, `⚠️ *NO CUENTAS CON COBERTURA.* Es urgente renovar tu póliza para estar protegido.`, ``] : []),
        lineaPago,
        '',
        '💡 *Por favor realiza tu pago a tiempo para mantener tu cobertura activa.*'
      ].join('\n');
      break;

    case TIPOS_MENSAJE.PAGO_VENCIDO:
      mensaje = [
        `*🚨 Pago vencido • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        `Tu pago se encuentra vencido:`,
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
        ...(polizaVencida ? [``, `🚨 *IMPORTANTE: Póliza vencida hace ${diasVencidosPoliza} día(s)*`, `⚠️ *NO CUENTAS CON COBERTURA.* Es urgente renovar tu póliza para estar protegido.`, ``] : []),
        lineaPago,
        '',
        '⚠️ *IMPORTANTE: Tu cobertura puede estar en riesgo.*',
        '💡 Por favor ponte al corriente a la brevedad para mantener tu protección activa.'
      ].join('\n');
      break;

    case TIPOS_MENSAJE.PAGO_RECIBIDO:
      mensaje = [
        `*✅ Pago recibido • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        `Hemos recibido tu pago. ¡Gracias por tu preferencia!`,
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        lineaPago,
        `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
        '',
        ...(polizaVencida ? [`🚨 *IMPORTANTE: Póliza vencida hace ${diasVencidosPoliza} día(s)*`, `⚠️ Aunque recibimos tu pago, la póliza ya no tiene vigencia. Es necesario renovarla.`] : ['✅ Tu cobertura continúa activa.'])
      ].join('\n');
      break;

    case TIPOS_MENSAJE.CANCELACION:
      mensaje = [
        `*❌ Póliza cancelada • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        `Te informamos que tu póliza ha sido cancelada:`,
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vigencia original:* ${inicioVig} → ${finVig}`,
        '',
        expediente.motivoCancelacion ? `📝 *Motivo:* ${expediente.motivoCancelacion}` : '',
        '',
        '💡 Si tienes dudas o deseas reactivarla, contáctanos.'
      ].filter(Boolean).join('\n');
      break;

    case TIPOS_MENSAJE.RENOVACION:
      mensaje = [
        `*🔄 Renovación de póliza • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        `Tu póliza está próxima a vencer. Te invitamos a renovarla:`,
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vence:* ${finVig}`,
        '',
        '💡 Renueva antes del vencimiento para mantener tu cobertura sin interrupciones.'
      ].join('\n');
      break;

    default:
      mensaje = [
        `*📋 Información de póliza • ${numeroPoliza}*`,
        '',
        'Estimado cliente,',
        'Te compartimos información de tu póliza:',
        '',
        `🏢 *Aseguradora:* ${compania}`,
        `📦 *Producto:* ${producto}`,
        ...infoVehiculo,
        `📅 *Vigencia:* ${inicioVig} → ${finVig}`,
        lineaPago
      ].join('\n');
  }

  // Agregar enlace al PDF si existe
  if (pdfUrl) {
    mensaje += `\n\n📄 *Descarga tu póliza aquí:*\n${pdfUrl}\n\n_(Haz clic en el enlace para descargar)_`;
  }

  mensaje += `\n\n📌 Cualquier duda, estamos para servirte.\n\nSaludos cordiales,\n*DCPRO Administración* 🏢`;

  return {
    tipoMensaje,
    mensaje
  };
}

/**
 * Generar mensaje para Email según el estado
 * @param {Object} expediente - Datos del expediente
 * @param {string} pdfUrl - URL del PDF (opcional)
 * @param {boolean} esCompartirPoliza - Si es true, usa formato "Le compartimos su póliza..."
 * @returns {Object} { tipoMensaje, asunto, cuerpo }
 */
export function generarMensajeEmail(expediente, pdfUrl = null, esCompartirPoliza = true) {
  const tipoMensaje = determinarTipoMensaje(expediente);
  
  const numeroPoliza = expediente.numero_poliza || 'Sin número';
  const compania = expediente.compania || 'N/A';
  const producto = expediente.producto || 'N/A';
  const esAuto = (producto || '').toLowerCase().includes('auto');
  const esMoto = (producto || '').toLowerCase().includes('moto');
  const tipoVehiculo = esAuto ? 'automóvil' : esMoto ? 'motocicleta' : 'vehículo';
  const inicioVig = expediente.inicio_vigencia || 'N/A';
  const finVig = expediente.termino_vigencia || 'N/A';
  const primaTotal = expediente.total ? Number(expediente.total).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '0.00';
  const fechaPago = expediente.fecha_vencimiento_pago || 'N/A';

  // Verificar si la póliza está vencida (término de vigencia)
  const fechaTermino = new Date(expediente.termino_vigencia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fechaTermino.setHours(0, 0, 0, 0);
  const polizaVencida = fechaTermino < hoy;
  const diasVencidosPoliza = polizaVencida ? Math.floor((hoy - fechaTermino) / (1000 * 60 * 60 * 24)) : 0;

  let asunto = '';
  let cuerpo = '';

  // 🆕 Si es acción de "Compartir Póliza", usar formato consistente
  if (esCompartirPoliza && (tipoMensaje === TIPOS_MENSAJE.EMISION || tipoMensaje === TIPOS_MENSAJE.PAGO_VENCIDO || tipoMensaje === TIPOS_MENSAJE.RECORDATORIO_PAGO)) {
    asunto = `Póliza de Seguro - ${numeroPoliza}`;
    
    // Determinar contexto adicional según el estado
    let contextoEstado = '';
    
    if (expediente.estatusPago === 'Vencido') {
      contextoEstado = `Sin embargo, es importante considerar que su pago se encuentra vencido. Es urgente que regularice su situación para mantener su cobertura activa y evitar problemas en caso de siniestro.`;
    } else if (expediente.estatusPago === 'Por Vencer') {
      contextoEstado = `Le recordamos que su próximo pago está próximo a vencer. Por favor realice su pago a tiempo para mantener su cobertura sin interrupciones.`;
    } else if (polizaVencida) {
      contextoEstado = `Sin embargo, es importante considerar que su póliza venció hace ${diasVencidosPoliza} día(s), lo que significa que NO CUENTA CON COBERTURA. Es urgente renovar su póliza para estar protegido.`;
    }

    cuerpo = `Estimado cliente,

Le compartimos la póliza de su ${tipoVehiculo}.

${contextoEstado ? contextoEstado + '\n' : ''}
DETALLES DE SU PÓLIZA:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Producto: ${producto}
Vigencia: ${inicioVig} al ${finVig}
Prima Total: $${primaTotal}
Fecha de pago: ${fechaPago}${pdfUrl ? `

📄 Descargue su póliza aquí:
${pdfUrl}` : ''}

Cualquier duda, estamos a sus órdenes.

Saludos cordiales,
DCPRO Administración`;
    
    return { tipoMensaje, asunto, cuerpo };
  }

  // Generar mensaje según el tipo (para notificaciones directas, no compartir póliza)
  switch (tipoMensaje) {
    case TIPOS_MENSAJE.EMISION:
      asunto = `Póliza Emitida - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Le informamos que su póliza ha sido emitida exitosamente:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Producto: ${producto}
Vigencia: ${inicioVig} al ${finVig}${polizaVencida ? `

⚠️ IMPORTANTE: PÓLIZA VENCIDA hace ${diasVencidosPoliza} día(s)
NO CUENTA CON COBERTURA. Es urgente renovar su póliza para estar protegido.` : ''}
Prima Total: $${primaTotal}
Fecha de pago: ${fechaPago}`;
      break;

    case TIPOS_MENSAJE.RECORDATORIO_PAGO:
      asunto = `Recordatorio de Pago - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Le recordamos que su pago está próximo a vencer:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Vigencia: ${inicioVig} al ${finVig}${polizaVencida ? `

⚠️ IMPORTANTE: PÓLIZA VENCIDA hace ${diasVencidosPoliza} día(s)
NO CUENTA CON COBERTURA. Es urgente renovar su póliza para estar protegido.
` : ''}
Fecha de pago: ${fechaPago}
Monto: $${primaTotal}

Por favor realice su pago a tiempo para mantener su cobertura activa.`;
      break;

    case TIPOS_MENSAJE.PAGO_VENCIDO:
      asunto = `URGENTE: Pago Vencido - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Su pago se encuentra VENCIDO:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Vigencia: ${inicioVig} al ${finVig}${polizaVencida ? `

⚠️ IMPORTANTE: PÓLIZA VENCIDA hace ${diasVencidosPoliza} día(s)
NO CUENTA CON COBERTURA. Es urgente renovar su póliza para estar protegido.
` : ''}
Fecha de vencimiento: ${fechaPago}
Monto pendiente: $${primaTotal}

IMPORTANTE: Su cobertura puede estar en riesgo. Por favor póngase al corriente a la brevedad.`;
      break;

    case TIPOS_MENSAJE.PAGO_RECIBIDO:
      asunto = `Pago Recibido - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Hemos recibido su pago. ¡Gracias por su preferencia!

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Monto pagado: $${primaTotal}
${polizaVencida ? `
⚠️ IMPORTANTE: Aunque recibimos su pago, la póliza venció hace ${diasVencidosPoliza} día(s).
Es necesario renovarla para contar con cobertura.` : `
Su cobertura continúa activa hasta ${finVig}.`}`;
      break;

    case TIPOS_MENSAJE.CANCELACION:
      asunto = `Póliza Cancelada - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Le informamos que su póliza ha sido cancelada:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Vigencia original: ${inicioVig} al ${finVig}${expediente.motivoCancelacion ? `\nMotivo: ${expediente.motivoCancelacion}` : ''}

Si tiene dudas o desea reactivarla, por favor contáctenos.`;
      break;

    default:
      asunto = `Información de Póliza - ${numeroPoliza}`;
      cuerpo = `Estimado cliente,

Le compartimos información de su póliza:

Póliza: ${numeroPoliza}
Aseguradora: ${compania}
Producto: ${producto}
Vigencia: ${inicioVig} al ${finVig}`;
  }

  if (pdfUrl) {
    cuerpo += `\n\nDescargue su póliza aquí:\n${pdfUrl}`;
  }

  cuerpo += `\n\nCualquier duda estamos para servirle.\n\nSaludos cordiales,\nDCPRO Administración`;

  return {
    tipoMensaje,
    asunto,
    cuerpo
  };
}

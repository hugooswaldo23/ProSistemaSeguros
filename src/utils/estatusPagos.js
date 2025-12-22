/**
 * Utilidades centralizadas para cálculo de estatus de pagos
 * FUENTE ÚNICA DE VERDAD para todas las reglas de estatus
 */

/**
 * Normaliza el estatus del backend al formato del frontend
 * Backend usa: 'Pago por vencer' | 'Pendiente' | 'Vencido' | 'Pagado'
 * Frontend usa: 'Por Vencer' | 'Pendiente' | 'Vencido' | 'Pagado'
 */
export function normalizarEstatusBackend(estatusBackend) {
  if (!estatusBackend) return 'Pendiente';
  
  const estatusLower = estatusBackend.toLowerCase();
  
  // Mapeo de variantes del backend
  if (estatusLower === 'pago por vencer' || estatusLower === 'por vencer') {
    return 'Por Vencer';
  }
  
  // Capitalizar primera letra para consistencia
  return estatusBackend.charAt(0).toUpperCase() + estatusBackend.slice(1).toLowerCase();
}

/**
 * Convierte estatus del frontend al formato del backend
 * Para cuando necesitamos enviar datos al backend
 */
export function convertirEstatusParaBackend(estatusFrontend) {
  if (!estatusFrontend) return 'Pendiente';
  
  const estatusLower = estatusFrontend.toLowerCase();
  
  if (estatusLower === 'por vencer') {
    return 'Pago por vencer'; // Backend espera este formato
  }
  
  return estatusFrontend;
}

/**
 * Calcula días restantes hasta una fecha
 * @param {string|Date} fechaVencimiento - Fecha de vencimiento
 * @returns {number} Días restantes (negativo si ya pasó)
 */
export function calcularDiasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return null;
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaVenc = new Date(fechaVencimiento);
  fechaVenc.setHours(0, 0, 0, 0);
  
  return Math.floor((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el estatus de un recibo individual
 * @param {string} fecha_vencimiento - Fecha de vencimiento del recibo
 * @param {string} fecha_pago_real - Fecha en que se pagó (null si no está pagado)
 * @returns {string} 'Pagado' | 'Vencido' | 'Por Vencer' | 'Pendiente'
 */
export function calcularEstatusRecibo(fecha_vencimiento, fecha_pago_real) {
  // 1. Si está pagado, siempre es "Pagado"
  if (fecha_pago_real) {
    return 'Pagado';
  }
  
  // 2. Calcular días restantes
  const diasRestantes = calcularDiasRestantes(fecha_vencimiento);
  
  if (diasRestantes === null) {
    return 'Sin fecha';
  }
  
  // 3. Evaluar según días restantes
  if (diasRestantes < 0) {
    return 'Vencido';
  } else if (diasRestantes <= 15) {
    return 'Por Vencer';
  } else {
    return 'Pendiente';
  }
}

/**
 * Constantes de frecuencias de pago
 */
export const PAGOS_POR_FRECUENCIA = {
  'Mensual': 12,
  'Trimestral': 4,
  'Semestral': 2,
  'Anual': 1
};

export const MESES_POR_FRECUENCIA = {
  'Mensual': 1,
  'Trimestral': 3,
  'Semestral': 6,
  'Anual': 12
};

/**
 * Calcula la fecha del próximo recibo de una póliza fraccionada
 * @param {object} expediente - Objeto del expediente
 * @param {number} numeroRecibo - Número del recibo a calcular (1-indexed)
 * @returns {Date|null} Fecha del recibo o null si no se puede calcular
 */
export function calcularFechaRecibo(expediente, numeroRecibo) {
  if (!expediente.inicio_vigencia) return null;
  
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  if (!frecuencia) return null;
  
  const mesesPorPago = MESES_POR_FRECUENCIA[frecuencia];
  if (!mesesPorPago) return null;
  
  const fechaInicio = new Date(expediente.inicio_vigencia);
  const fechaRecibo = new Date(fechaInicio);
  fechaRecibo.setMonth(fechaRecibo.getMonth() + (numeroRecibo - 1) * mesesPorPago);
  
  return fechaRecibo;
}

/**
 * Verifica si una póliza tiene pagos vencidos
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si tiene pagos vencidos
 */
export function tienePagosVencidos(expediente) {
  // Opción 1: Usar fecha_vencimiento_pago del expediente
  if (expediente.fecha_vencimiento_pago) {
    const diasRestantes = calcularDiasRestantes(expediente.fecha_vencimiento_pago);
    if (diasRestantes !== null && diasRestantes < 0) {
      return true;
    }
  }
  
  // Opción 2: Revisar recibos individuales
  if (expediente.recibos && Array.isArray(expediente.recibos)) {
    return expediente.recibos.some(recibo => {
      if (recibo.fecha_pago_real) return false; // Ya pagado
      const estatus = calcularEstatusRecibo(recibo.fecha_vencimiento, null);
      return estatus === 'Vencido';
    });
  }
  
  return false;
}

/**
 * Verifica si una póliza tiene pagos por vencer (≤ 15 días)
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si tiene pagos por vencer
 */
export function tienePagosPorVencer(expediente) {
  const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || 
                        (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
  
  if (!esFraccionado) return false;
  
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  if (!frecuencia || !expediente.inicio_vigencia) return false;
  
  const numeroPagos = PAGOS_POR_FRECUENCIA[frecuencia] || 0;
  const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
  
  if (pagosRealizados >= numeroPagos) return false; // Todos pagados
  
  const proximoRecibo = pagosRealizados + 1;
  const fechaProximoRecibo = calcularFechaRecibo(expediente, proximoRecibo);
  
  if (!fechaProximoRecibo) return false;
  
  const diasRestantes = calcularDiasRestantes(fechaProximoRecibo);
  return diasRestantes !== null && diasRestantes <= 15;
}

/**
 * Verifica si la vigencia de una póliza está vencida
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si la vigencia terminó
 */
export function estaVigenciaVencida(expediente) {
  if (!expediente.termino_vigencia) return false;
  
  const diasRestantes = calcularDiasRestantes(expediente.termino_vigencia);
  return diasRestantes !== null && diasRestantes < 0;
}

/**
 * Verifica si una póliza está al corriente con sus pagos
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si está al corriente
 */
export function estaAlCorriente(expediente) {
  const estatusPago = (expediente.estatusPago || expediente.estatus_pago || '').toLowerCase().trim();
  const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || 
                        (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
  
  if (!esFraccionado) {
    // Póliza anual: debe estar pagada
    return estatusPago === 'pagado';
  }
  
  // Póliza fraccionada: verificar recibos
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  if (!frecuencia || !expediente.inicio_vigencia) {
    return estatusPago === 'pagado';
  }
  
  const numeroPagos = PAGOS_POR_FRECUENCIA[frecuencia] || 0;
  const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
  
  // Sin pagos realizados = no está al corriente
  if (pagosRealizados === 0) return false;
  
  // Todos los pagos realizados = al corriente
  if (pagosRealizados >= numeroPagos) return true;
  
  // Verificar que el próximo pago no esté vencido ni por vencer
  const proximoRecibo = pagosRealizados + 1;
  const fechaProximoRecibo = calcularFechaRecibo(expediente, proximoRecibo);
  
  if (!fechaProximoRecibo) return true;
  
  const diasRestantes = calcularDiasRestantes(fechaProximoRecibo);
  // Está al corriente si el próximo pago está a más de 15 días
  return diasRestantes !== null && diasRestantes > 15;
}

/**
 * Calcula si una póliza está en periodo de renovación (30 días antes de vencer)
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si está en periodo de renovación
 */
export function estaEnPeriodoRenovacion(expediente) {
  if (!expediente.termino_vigencia) return false;
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaTermino = new Date(expediente.termino_vigencia);
  fechaTermino.setHours(0, 0, 0, 0);
  
  // Calcular fecha de aviso (30 días antes o usar campo específico)
  let fechaAviso;
  if (expediente.fecha_aviso_renovacion) {
    fechaAviso = new Date(expediente.fecha_aviso_renovacion);
  } else {
    fechaAviso = new Date(fechaTermino);
    fechaAviso.setDate(fechaAviso.getDate() - 30);
  }
  fechaAviso.setHours(0, 0, 0, 0);
  
  // Está en periodo de renovación si:
  // - Ya llegó la fecha de aviso
  // - Aún no vence la póliza
  return hoy >= fechaAviso && hoy < fechaTermino;
}

/**
 * Obtiene el estatus general de pago de una póliza
 * SOLO DEBE LEER DEL BACKEND, NO CALCULAR
 * @param {object} expediente - Objeto del expediente
 * @returns {string} Estatus de pago
 */
export function obtenerEstatusGeneralPago(expediente) {
  return expediente.estatus_pago || expediente.estatusPago || 'Sin calcular';
}

/**
 * Verifica si una póliza debe ir a carpeta VIGENTES
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si debe ir a vigentes
 */
export function esVigente(expediente) {
  if (expediente.etapa_activa === 'Cancelada') return false;
  if (expediente.etapa_activa === 'Renovada') return false; // Las renovadas van a su carpeta
  
  // Debe estar al corriente
  if (!estaAlCorriente(expediente)) return false;
  
  // No debe estar en periodo de renovación
  if (estaEnPeriodoRenovacion(expediente)) return false;
  
  return true;
}

/**
 * Verifica si una póliza debe ir a carpeta RENOVADAS
 * @param {object} expediente - Objeto del expediente
 * @returns {boolean} true si debe ir a renovadas
 */
export function esRenovada(expediente) {
  if (expediente.etapa_activa !== 'Renovada') return false;
  if (expediente.etapa_activa === 'Cancelada') return false;
  
  // Debe estar al corriente
  if (!estaAlCorriente(expediente)) return false;
  
  // No debe estar en periodo de renovación
  if (estaEnPeriodoRenovacion(expediente)) return false;
  
  return true;
}

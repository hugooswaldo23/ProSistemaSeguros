/**
 * Utilidades para cálculos de fechas y pagos de pólizas
 */

const CONSTANTS = {
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

/**
 * Calcula el término de vigencia (1 año después del inicio)
 */
export const calcularTerminoVigencia = (inicio_vigencia) => {
  if (!inicio_vigencia) return '';
  
  const fechaInicio = new Date(inicio_vigencia);
  const fechaTermino = new Date(fechaInicio);
  fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
  
  return fechaTermino.toISOString().split('T')[0];
};

/**
 * Calcula la fecha de próximo pago según tipo de pago y frecuencia
 * @param {string} inicio_vigencia - Fecha de inicio de vigencia (YYYY-MM-DD)
 * @param {string} tipo_pago - 'Anual' o 'Fraccionado'
 * @param {string} frecuenciaPago - 'Mensual', 'Trimestral', 'Semestral'
 * @param {string} compania - Nombre de la aseguradora
 * @param {number} numeroPago - Número de pago a calcular (1, 2, 3, ...)
 * @param {number} periodoGraciaCustom - Periodo de gracia personalizado (opcional)
 * @returns {string} Fecha del pago en formato YYYY-MM-DD
 */
export const calcularProximoPago = (
  inicio_vigencia, 
  tipo_pago, 
  frecuenciaPago, 
  compania, 
  numeroPago = 1, 
  periodoGraciaCustom = null
) => {
  if (!inicio_vigencia) return '';
  
  // Usar periodo de gracia personalizado o calcular según la compañía
  const periodoGracia = periodoGraciaCustom !== null 
    ? periodoGraciaCustom 
    : (compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  // Crear fecha en hora local para evitar problemas de timezone
  const [year, month, day] = inicio_vigencia.split('-');
  const fechaInicio = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  if (numeroPago === 1) {
    // Primer pago: fecha inicio + periodo de gracia (DÍAS)
    const fechaPago = new Date(fechaInicio);
    fechaPago.setDate(fechaPago.getDate() + periodoGracia);
    return fechaPago.toISOString().split('T')[0];
  }
  
  if (tipo_pago === 'Anual') return '';
  
  if (tipo_pago === 'Fraccionado' && frecuenciaPago) {
    // Verificar que no exceda el número total de pagos permitidos
    const numeroPagosMaximo = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuenciaPago] || 0;
    
    if (numeroPago > numeroPagosMaximo) {
      return ''; // No hay más pagos después del último
    }
    
    // Pagos subsecuentes: fecha inicio + N meses (SIN periodo de gracia)
    const fechaPagoSubsecuente = new Date(fechaInicio);
    const mesesAAgregar = (numeroPago - 1) * CONSTANTS.MESES_POR_FRECUENCIA[frecuenciaPago];
    fechaPagoSubsecuente.setMonth(fechaPagoSubsecuente.getMonth() + mesesAAgregar);
    
    return fechaPagoSubsecuente.toISOString().split('T')[0];
  }
  
  return '';
};

/**
 * Calcula el estatus de pago según la fecha de vencimiento
 * @param {string} proximoPago - Fecha de próximo pago (YYYY-MM-DD)
 * @param {string} estatusActual - Estatus actual del pago
 * @returns {string} 'Pagado', 'Vencido', 'Por Pagar', 'Pendiente'
 */
export const calcularEstatusPago = (proximoPago, estatusActual) => {
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
  
  // Si faltan 15 días o menos, está por pagar
  if (diasRestantes <= 15) return 'Por Pagar';
  
  // Si aún faltan más de 15 días, está pendiente
  return 'Pendiente';
};

/**
 * Calcula el siguiente pago de un expediente
 * @param {Object} expediente - Objeto expediente con datos de póliza
 * @returns {Object} { fecha, numero, monto }
 */
export const calcularSiguientePago = (expediente) => {
  const tipoPago = expediente.tipo_pago || expediente.forma_pago;
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  
  if (!expediente.inicio_vigencia) {
    return { fecha: null, numero: null, monto: null };
  }
  
  const esAnual = tipoPago?.toUpperCase() === 'ANUAL' || tipoPago?.toUpperCase() === 'CONTADO';
  const esFraccionado = tipoPago?.toUpperCase() === 'FRACCIONADO';
  
  if (!esAnual && !esFraccionado) {
    return { fecha: null, numero: null, monto: null };
  }
  
  const numeroPagos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
  const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
  
  // Si ya pagó todos los recibos, no hay siguiente pago
  if (ultimoReciboPagado >= numeroPagos) {
    return { fecha: null, numero: null, monto: null };
  }
  
  const siguienteNumero = ultimoReciboPagado + 1;
  
  // Calcular fecha del siguiente pago
  const periodoGracia = expediente.periodo_gracia 
    ? parseInt(expediente.periodo_gracia, 10)
    : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  const fechaSiguiente = calcularProximoPago(
    expediente.inicio_vigencia,
    tipoPago,
    frecuencia,
    expediente.compania,
    siguienteNumero,
    periodoGracia
  );
  
  // Calcular monto
  let monto = null;
  if (esAnual) {
    monto = expediente.total;
  } else if (esFraccionado) {
    const primerPago = expediente.primer_pago || expediente.primerPago;
    const pagosSubsecuentes = expediente.pagos_subsecuentes || expediente.pagosSubsecuentes;
    
    if (primerPago && pagosSubsecuentes) {
      monto = siguienteNumero === 1 ? parseFloat(primerPago) : parseFloat(pagosSubsecuentes);
    } else if (expediente.total) {
      monto = parseFloat(expediente.total) / numeroPagos;
    }
  }
  
  return {
    fecha: fechaSiguiente,
    numero: siguienteNumero,
    monto: monto ? monto.toFixed(2) : null
  };
};

/**
 * Calcula los valores automáticos del formulario (término vigencia, próximo pago, etc.)
 * @param {Object} formularioActual - Objeto con datos del formulario
 * @param {Function} calcularProximoPagoFn - Función para calcular próximo pago
 * @returns {Object} Formulario actualizado con campos calculados
 */
export const actualizarCalculosAutomaticos = (formularioActual) => {
  // Calcular término de vigencia
  const termino_vigencia = calcularTerminoVigencia(formularioActual.inicio_vigencia);
  
  // Calcular periodo de gracia
  const periodoGracia = formularioActual.periodo_gracia 
    ? parseInt(formularioActual.periodo_gracia, 10)
    : (formularioActual.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  // Si la fecha fue editada manualmente, NO recalcular
  if (formularioActual._fechaManual) {
    const resultado = {
      ...formularioActual,
      termino_vigencia,
      periodo_gracia: periodoGracia
    };
    delete resultado._fechaManual;
    return resultado;
  }
  
  // Si la fecha viene de recibo real, NO recalcular
  if (formularioActual._no_recalcular_fecha_vencimiento) {
    return {
      ...formularioActual,
      termino_vigencia,
      periodo_gracia: periodoGracia
    };
  }
  
  // Calcular próximo pago según el tipo de pago
  let proximoPago = '';
  
  if (formularioActual.tipo_pago === 'Fraccionado') {
    proximoPago = calcularProximoPago(
      formularioActual.inicio_vigencia,
      formularioActual.tipo_pago,
      formularioActual.frecuenciaPago,
      formularioActual.compania,
      1,
      periodoGracia
    );
  } else if (formularioActual.tipo_pago === 'Anual') {
    proximoPago = calcularProximoPago(
      formularioActual.inicio_vigencia,
      'Anual',
      null,
      formularioActual.compania,
      1,
      periodoGracia
    );
  }
  
  // Calcular estatus de pago
  const estatusPago = calcularEstatusPago(proximoPago, formularioActual.estatus_pago);
  
  return {
    ...formularioActual,
    termino_vigencia,
    periodo_gracia: periodoGracia,
    fecha_vencimiento_pago: proximoPago,
    estatus_pago: estatusPago
  };
};

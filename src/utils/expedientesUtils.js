/**
 * ====================================================================
 * UTILIDADES PARA MÓDULO DE EXPEDIENTES
 * ====================================================================
 * Funciones de formateo, cálculo y transformación de datos
 */

/**
 * Formatea una fecha en diferentes formatos
 * @param {string|Date} fecha - Fecha a formatear
 * @param {string} formato - 'corta', 'cortaY', 'media', 'larga'
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (fecha, formato = 'corta') => {
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
};

/**
 * Formatea un monto como moneda mexicana
 * @param {number} monto - Monto a formatear
 * @returns {string} Monto formateado
 */
export const formatearMoneda = (monto) => {
  if (!monto) return '-';
  return new Intl.NumberFormat('es-MX', { 
    style: 'currency', 
    currency: 'MXN' 
  }).format(monto);
};

/**
 * Obtiene la clase CSS del badge según el tipo y valor
 * @param {string} tipo - 'etapa', 'pago', 'tipo_pago'
 * @param {string} valor - Valor del estado
 * @returns {string} Clase CSS de Bootstrap
 */
export const getBadgeClass = (tipo, valor) => {
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
      'Por Pagar': 'bg-warning',
      'Cancelado': 'bg-dark',
      'Sin definir': 'bg-secondary'
    },
    tipo_pago: {
      'Fraccionado': 'bg-info',
      'Anual': 'bg-primary'
    }
  };
  return mapas[tipo]?.[valor] || 'bg-secondary';
};

/**
 * Calcula los días restantes hasta una fecha
 * @param {string|Date} fecha - Fecha objetivo
 * @returns {number|null} Días restantes (negativo si ya pasó)
 */
export const calcularDiasRestantes = (fecha) => {
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
};

/**
 * Objeto con todas las utilidades (para compatibilidad con código existente)
 */
export const utils = {
  formatearFecha,
  formatearMoneda,
  getBadgeClass,
  calcularDiasRestantes
};

export default utils;

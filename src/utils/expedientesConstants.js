/**
 * ====================================================================
 * CONSTANTES GLOBALES PARA MÓDULO DE EXPEDIENTES
 * ====================================================================
 */

export const CONSTANTS = {
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

// Variables globales para snapshot
// Flag global para indicar que se debe capturar un snapshot del formulario
// Se usa para capturar el estado completo después de extraer PDF + cargar BD + calcular automáticos
export let globalSnapshotPendiente = false;

export const setGlobalSnapshotPendiente = (value) => {
  globalSnapshotPendiente = value;
};

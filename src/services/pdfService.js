/**
 * Servicio para gestión de PDFs de pólizas en AWS S3
 * 
 * Funcionalidades:
 * - Subir PDF de póliza
 * - Obtener URL firmada para compartir
 * - Eliminar PDF
 */

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Subir PDF de póliza al servidor (S3)
 * @param {number} expedienteId - ID del expediente
 * @param {File} file - Archivo PDF a subir
 * @returns {Promise<Object>} Datos del PDF subido
 */
export async function subirPDFPoliza(expedienteId, file) {
  try {
    // Validar que sea un PDF
    if (file.type !== 'application/pdf') {
      throw new Error('El archivo debe ser un PDF');
    }

    // Validar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('El archivo no debe superar los 10MB');
    }

    const formData = new FormData();
    formData.append('file', file);

  const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}/pdf`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al subir el PDF');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error en subirPDFPoliza:', error);
    throw error;
  }
}

/**
 * Obtener URL firmada para acceder al PDF
 * @param {number} expedienteId - ID del expediente
 * @param {number} expiration - Tiempo de expiración en segundos (default: 3600)
 * @returns {Promise<Object>} URL firmada y tiempo de expiración
 */
export async function obtenerURLFirmadaPDF(expedienteId, expiration = 3600) {
  try {
    const response = await fetch(
  `${API_URL}/api/expedientes/${expedienteId}/pdf-url?expiration=${expiration}`,
      {
        method: 'GET'
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener URL del PDF');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error en obtenerURLFirmadaPDF:', error);
    throw error;
  }
}

/**
 * Eliminar PDF de póliza
 * @param {number} expedienteId - ID del expediente
 * @returns {Promise<Object>} Respuesta del servidor
 */
export async function eliminarPDFPoliza(expedienteId) {
  try {
  const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}/pdf`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar el PDF');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error en eliminarPDFPoliza:', error);
    throw error;
  }
}

/**
 * Validar archivo PDF antes de subir
 * @param {File} file - Archivo a validar
 * @returns {Object} { valid: boolean, error: string }
 */
export function validarArchivoPDF(file) {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo' };
  }

  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'El archivo debe ser un PDF' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'El archivo no debe superar los 10MB' };
  }

  return { valid: true, error: null };
}

/**
 * Formatear tamaño de archivo
 * @param {number} bytes - Tamaño en bytes
 * @returns {string} Tamaño formateado (ej: "2.5 MB")
 */
export function formatearTamañoArchivo(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

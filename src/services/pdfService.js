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
    console.log('📤 Iniciando subida de PDF...', {
      expedienteId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

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

    const url = `${API_URL}/api/expedientes/${expedienteId}/pdf`;
    console.log('📍 URL del endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    console.log('📨 Respuesta del servidor:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      let errorMessage = 'Error al subir el PDF';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ PDF subido exitosamente:', data);
    return data.data;
  } catch (error) {
    console.error('❌ Error en subirPDFPoliza:', error);
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

/**
 * Subir PDF de cotización al servidor (S3)
 * @param {number} expedienteId - ID del expediente
 * @param {File} file - Archivo PDF a subir
 * @returns {Promise<Object>} Datos del PDF subido { url, filename, uploadedAt }
 */
export async function subirCotizacionPDF(expedienteId, file) {
  try {
    console.log('📤 Iniciando subida de cotización...', {
      expedienteId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

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
    formData.append('tipo', 'cotizacion');

    const url = `${API_URL}/api/expedientes/${expedienteId}/documentos`;
    console.log('📍 URL del endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    console.log('📨 Respuesta del servidor:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      let errorMessage = 'Error al subir la cotización';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Cotización subida exitosamente:', data);
    return data.data;
  } catch (error) {
    console.error('❌ Error en subirCotizacionPDF:', error);
    throw error;
  }
}

/**
 * Obtener cotizaciones de un expediente
 * @param {number} expedienteId - ID del expediente
 * @returns {Promise<Array>} Lista de cotizaciones [{ id, url, filename, uploadedAt }]
 */
export async function obtenerCotizaciones(expedienteId) {
  try {
    const response = await fetch(
      `${API_URL}/api/expedientes/${expedienteId}/documentos?tipo=cotizacion`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener cotizaciones');
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error en obtenerCotizaciones:', error);
    return [];
  }
}

// ====================================================================
// RECIBOS DE PAGO DE ASEGURADORA
// ====================================================================

/**
 * Subir recibo de pago de la aseguradora (PDF/imagen por número de recibo)
 * @param {number} expedienteId - ID del expediente
 * @param {number} numeroRecibo - Número de recibo (1, 2, 3...)
 * @param {File} file - Archivo PDF o imagen a subir
 * @returns {Promise<Object>} Datos del archivo subido { url, filename }
 */
export async function subirReciboPago(expedienteId, numeroRecibo, file) {
  try {
    console.log('📤 Subiendo recibo de pago de aseguradora...', {
      expedienteId,
      numeroRecibo,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Validar tipo de archivo (PDF o imagen)
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(file.type)) {
      throw new Error('El archivo debe ser un PDF o imagen (JPG, PNG, WebP)');
    }

    // Validar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('El archivo no debe superar los 10MB');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', 'recibo-pago');
    formData.append('numero_recibo', numeroRecibo);

    const url = `${API_URL}/api/expedientes/${expedienteId}/recibos/${numeroRecibo}/recibo-pago`;
    console.log('📍 URL del endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', errorText);
      let errorMessage = 'Error al subir el recibo de pago';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('✅ Recibo de pago subido exitosamente:', data);
    return data.data;
  } catch (error) {
    console.error('❌ Error en subirReciboPago:', error);
    throw error;
  }
}

/**
 * Obtener URL firmada del recibo de pago de aseguradora
 * @param {number} expedienteId - ID del expediente
 * @param {number} numeroRecibo - Número de recibo
 * @param {number} expiration - Tiempo de expiración en segundos (default: 3600)
 * @returns {Promise<Object>} URL firmada { url, expiresAt }
 */
export async function obtenerReciboPagoURL(expedienteId, numeroRecibo, expiration = 3600) {
  try {
    const response = await fetch(
      `${API_URL}/api/expedientes/${expedienteId}/recibos/${numeroRecibo}/recibo-pago-url?expiration=${expiration}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener URL del recibo');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error en obtenerReciboPagoURL:', error);
    throw error;
  }
}

/**
 * Obtener URL firmada de una cotización
 * @param {number} expedienteId - ID del expediente
 * @param {number} documentoId - ID del documento de cotización
 * @param {number} expiration - Tiempo de expiración en segundos (default: 3600)
 * @returns {Promise<Object>} URL firmada { url, expiresAt }
 */
export async function obtenerURLCotizacion(expedienteId, documentoId, expiration = 3600) {
  try {
    const response = await fetch(
      `${API_URL}/api/expedientes/${expedienteId}/documentos/${documentoId}/url?expiration=${expiration}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener URL de cotización');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error en obtenerURLCotizacion:', error);
    throw error;
  }
}

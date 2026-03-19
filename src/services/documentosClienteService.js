/**
 * Servicio para gestión de documentos de clientes (Persona Física / Moral / Otros)
 * Subida a S3 vía backend, con tabla documentos_clientes
 *
 * Endpoints requeridos en backend:
 *   POST   /api/clientes/:clienteId/documentos          → Subir documento (multipart: file + tipo + nombre)
 *   GET    /api/clientes/:clienteId/documentos           → Listar documentos del cliente
 *   GET    /api/clientes/:clienteId/documentos/:docId/url → URL firmada para ver/descargar
 *   PUT    /api/clientes/:clienteId/documentos/:docId    → Reemplazar archivo (multipart: file)
 *   DELETE /api/clientes/:clienteId/documentos/:docId    → Eliminar documento
 */

const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('ss_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Validar archivo antes de subir
 * @param {File} file
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validarArchivo(file) {
  if (!file) return { valid: false, error: 'No se seleccionó ningún archivo' };

  const tiposPermitidos = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (!tiposPermitidos.includes(file.type)) {
    return { valid: false, error: 'Formato no permitido. Use PDF, JPG, PNG, DOC o DOCX' };
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return { valid: false, error: 'El archivo no debe superar los 10 MB' };
  }

  return { valid: true, error: null };
}

/**
 * Formatear tamaño de archivo
 */
export function formatearTamaño(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Subir documento de cliente
 * @param {number} clienteId
 * @param {File} file - Archivo a subir
 * @param {string} tipo - Tipo/nombre del documento (ej: 'INE', 'Acta Constitutiva', 'Carta poder')
 * @returns {Promise<Object>} Documento creado
 */
export async function subirDocumentoCliente(clienteId, file, tipo) {
  const validacion = validarArchivo(file);
  if (!validacion.valid) throw new Error(validacion.error);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('tipo', tipo);

  const response = await fetch(`${API_URL}/api/clientes/${clienteId}/documentos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al subir el documento');
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Listar documentos de un cliente
 * @param {number} clienteId
 * @returns {Promise<Array>} Lista de documentos
 */
export async function obtenerDocumentosCliente(clienteId) {
  const response = await fetch(`${API_URL}/api/clientes/${clienteId}/documentos`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener documentos');
  }

  const data = await response.json();
  return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
}

/**
 * Obtener URL firmada para ver/descargar un documento
 * @param {number} clienteId
 * @param {number} docId
 * @returns {Promise<Object>} { signed_url, expires_in }
 */
export async function obtenerURLDocumento(clienteId, docId) {
  const response = await fetch(
    `${API_URL}/api/clientes/${clienteId}/documentos/${docId}/url`,
    { headers: getAuthHeaders() }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al obtener URL del documento');
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Reemplazar/actualizar archivo de un documento existente
 * @param {number} clienteId
 * @param {number} docId
 * @param {File} file - Nuevo archivo
 * @returns {Promise<Object>} Documento actualizado
 */
export async function actualizarDocumentoCliente(clienteId, docId, file) {
  const validacion = validarArchivo(file);
  if (!validacion.valid) throw new Error(validacion.error);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/clientes/${clienteId}/documentos/${docId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al actualizar el documento');
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Eliminar documento de cliente
 * @param {number} clienteId
 * @param {number} docId
 * @returns {Promise<Object>}
 */
export async function eliminarDocumentoCliente(clienteId, docId) {
  const response = await fetch(`${API_URL}/api/clientes/${clienteId}/documentos/${docId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error al eliminar el documento');
  }

  const data = await response.json();
  return data;
}

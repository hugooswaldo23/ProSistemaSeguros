// ============================================================================
// Service: Tipos de Documentos
// Descripción: Manejo de tipos de documentos para personas físicas y morales
// ============================================================================

import API_URL from '../constants/apiUrl.js';

// Obtener todos los tipos de documentos
export const obtenerTiposDocumentos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de documentos');
    }
    
    const data = await response.json();
    console.log('Respuesta completa del backend (tipos documentos):', data);
    
    // Verificar si la respuesta tiene la estructura esperada
    if (data.success && Array.isArray(data.data)) {
      return { success: true, data: data.data };
    } else if (data.success && data.data && Array.isArray(data.data.data)) {
      // Caso de respuesta anidada
      return { success: true, data: data.data.data };
    } else if (Array.isArray(data)) {
      // Si viene directamente como array
      return { success: true, data };
    } else {
      console.error('Estructura de respuesta inesperada:', data);
      return { success: false, error: 'Formato de respuesta inválido' };
    }
  } catch (error) {
    console.error('Error en obtenerTiposDocumentos:', error);
    return { success: false, error: error.message };
  }
};

// Obtener tipos de documentos por tipo de persona
export const obtenerTiposDocumentosPorTipo = async (tipoPersona) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/tipo/${encodeURIComponent(tipoPersona)}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de documentos por tipo');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposDocumentosPorTipo:', error);
    return { success: false, error: error.message };
  }
};

// Obtener tipos de documentos activos
export const obtenerTiposDocumentosActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/activos`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de documentos activos');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposDocumentosActivos:', error);
    return { success: false, error: error.message };
  }
};

// Obtener tipo de documento por ID
export const obtenerTipoDocumentoPorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipo de documento');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTipoDocumentoPorId:', error);
    return { success: false, error: error.message };
  }
};

// Crear nuevo tipo de documento
export const crearTipoDocumento = async (tipoDocumento) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tipoDocumento)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al crear tipo de documento');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en crearTipoDocumento:', error);
    return { success: false, error: error.message };
  }
};

// Actualizar tipo de documento
export const actualizarTipoDocumento = async (id, tipoDocumento) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tipoDocumento)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al actualizar tipo de documento');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en actualizarTipoDocumento:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar tipo de documento
export const eliminarTipoDocumento = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al eliminar tipo de documento');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en eliminarTipoDocumento:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado (activo/inactivo) de tipo de documento
export const cambiarEstadoTipoDocumento = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposDocumentos/${id}/toggle-activo`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al cambiar estado del tipo de documento');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en cambiarEstadoTipoDocumento:', error);
    return { success: false, error: error.message };
  }
};

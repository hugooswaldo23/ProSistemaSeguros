// ============================================================================
// Service: Tipos de Documentos
// Descripción: Manejo de tipos de documentos para personas físicas y morales
// ============================================================================

import { API_URL } from '../constants/apiUrl';

// Obtener todos los tipos de documentos
export const obtenerTiposDocumentos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-documentos`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de documentos');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposDocumentos:', error);
    return { success: false, error: error.message };
  }
};

// Obtener tipos de documentos por tipo de persona
export const obtenerTiposDocumentosPorTipo = async (tipoPersona) => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-documentos?tipo_persona=${encodeURIComponent(tipoPersona)}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de documentos');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposDocumentosPorTipo:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo documentos activos
export const obtenerTiposDocumentosActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-documentos?activo=true`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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

// Obtener un tipo de documento por ID
export const obtenerTipoDocumentoPorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-documentos/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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
    const response = await fetch(`${API_URL}/api/tipos-documentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
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
    const response = await fetch(`${API_URL}/api/tipos-documentos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
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
    const response = await fetch(`${API_URL}/api/tipos-documentos/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
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

// Cambiar estado de tipo de documento (activo/inactivo)
export const cambiarEstadoTipoDocumento = async (id, activo) => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-documentos/${id}/estado`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify({ activo })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al cambiar estado');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en cambiarEstadoTipoDocumento:', error);
    return { success: false, error: error.message };
  }
};

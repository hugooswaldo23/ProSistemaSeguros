// ============================================================================
// Service: Tipos de Trámites
// Descripción: Manejo de tipos de trámites disponibles en el sistema
// ============================================================================

import API_URL from '../constants/apiUrl.js';

// Obtener todos los tipos de trámites
export const obtenerTiposTramites = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de trámites');
    }
    
    const data = await response.json();
    
    // Manejar diferentes formatos de respuesta
    if (data.success && Array.isArray(data.data)) {
      return { success: true, data: data.data };
    } else if (Array.isArray(data)) {
      return { success: true, data };
    } else {
      return { success: true, data: [] };
    }
  } catch (error) {
    console.error('Error en obtenerTiposTramites:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo trámites activos
export const obtenerTiposTramitesActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/activos`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de trámites activos');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposTramitesActivos:', error);
    return { success: false, error: error.message };
  }
};

// Obtener un tipo de trámite por ID
export const obtenerTipoTramitePorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipo de trámite');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTipoTramitePorId:', error);
    return { success: false, error: error.message };
  }
};

// Obtener un tipo de trámite por código
export const obtenerTipoTramitePorCodigo = async (codigo) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/codigo/${codigo}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener tipo de trámite por código');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTipoTramitePorCodigo:', error);
    return { success: false, error: error.message };
  }
};

// Crear nuevo tipo de trámite
export const crearTipoTramite = async (tipoTramite) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tipoTramite)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear tipo de trámite');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en crearTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

// Actualizar tipo de trámite
export const actualizarTipoTramite = async (id, tipoTramite) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tipoTramite)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar tipo de trámite');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en actualizarTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar tipo de trámite
export const eliminarTipoTramite = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar tipo de trámite');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error en eliminarTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de tipo de trámite (activo/inactivo)
export const cambiarEstadoTipoTramite = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/${id}/toggle-activo`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al cambiar estado');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en cambiarEstadoTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

// Obtener estadísticas de tipos de trámites
export const obtenerEstadisticasTiposTramites = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tiposTramites/estadisticas`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerEstadisticasTiposTramites:', error);
    return { success: false, error: error.message };
  }
};

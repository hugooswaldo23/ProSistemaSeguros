// ============================================================================
// Service: Tipos de Trámites
// Descripción: Manejo de tipos de trámites disponibles en el sistema
// ============================================================================

import { API_URL } from '../constants/apiUrl';

// Obtener todos los tipos de trámites
export const obtenerTiposTramites = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-tramites`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener tipos de trámites');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerTiposTramites:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo trámites activos
export const obtenerTiposTramitesActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-tramites?activo=true`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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
    const response = await fetch(`${API_URL}/api/tipos-tramites/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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

// Crear nuevo tipo de trámite
export const crearTipoTramite = async (tipoTramite) => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-tramites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(tipoTramite)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al crear tipo de trámite');
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
    const response = await fetch(`${API_URL}/api/tipos-tramites/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(tipoTramite)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al actualizar tipo de trámite');
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
    const response = await fetch(`${API_URL}/api/tipos-tramites/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al eliminar tipo de trámite');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en eliminarTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de tipo de trámite (activo/inactivo)
export const cambiarEstadoTipoTramite = async (id, activo) => {
  try {
    const response = await fetch(`${API_URL}/api/tipos-tramites/${id}/estado`, {
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
    console.error('Error en cambiarEstadoTipoTramite:', error);
    return { success: false, error: error.message };
  }
};

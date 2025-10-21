// ============================================================================
// Service: Canales de Venta
// Descripción: Manejo de canales de venta u origen de clientes
// ============================================================================

import { API_URL } from '../constants/apiUrl';

// Obtener todos los canales de venta
export const obtenerCanalesVenta = async () => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener canales de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCanalesVenta:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo canales activos
export const obtenerCanalesVentaActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta?activo=true`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener canales de venta activos');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCanalesVentaActivos:', error);
    return { success: false, error: error.message };
  }
};

// Obtener un canal de venta por ID
export const obtenerCanalVentaPorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener canal de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCanalVentaPorId:', error);
    return { success: false, error: error.message };
  }
};

// Crear nuevo canal de venta
export const crearCanalVenta = async (canalVenta) => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(canalVenta)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al crear canal de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en crearCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

// Actualizar canal de venta
export const actualizarCanalVenta = async (id, canalVenta) => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(canalVenta)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al actualizar canal de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en actualizarCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar canal de venta
export const eliminarCanalVenta = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al eliminar canal de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en eliminarCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de canal de venta (activo/inactivo)
export const cambiarEstadoCanalVenta = async (id, activo) => {
  try {
    const response = await fetch(`${API_URL}/api/canales-venta/${id}/estado`, {
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
    console.error('Error en cambiarEstadoCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

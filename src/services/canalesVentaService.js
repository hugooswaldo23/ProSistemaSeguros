// ============================================================================
// Service: Canales de Venta
// Descripción: Manejo de canales de venta u origen de clientes
// ============================================================================

import API_URL from '../constants/apiUrl.js';

// Obtener todos los canales de venta
export const obtenerCanalesVenta = async () => {
  try {
    const response = await fetch(`${API_URL}/api/canalesVenta`);
    
    if (!response.ok) {
      throw new Error('Error al obtener canales de venta');
    }
    
    const data = await response.json();
    console.log('Respuesta completa del backend (canales):', data);
    
    // Verificar si la respuesta tiene la estructura esperada
    if (data.success && Array.isArray(data.data)) {
      return { success: true, data: data.data };
    } else if (data.success && data.data && Array.isArray(data.data.data)) {
      // Caso de respuesta anidada
      return { success: true, data: data.data.data };
    } else {
      console.error('Estructura de respuesta inesperada:', data);
      return { success: false, error: 'Formato de respuesta inválido' };
    }
  } catch (error) {
    console.error('Error en obtenerCanalesVenta:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo canales activos
export const obtenerCanalesVentaActivos = async () => {
  try {
    const response = await fetch(`${API_URL}/api/canalesVenta/activos`);
    
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
    const response = await fetch(`${API_URL}/api/canalesVenta/${id}`);
    
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
    const response = await fetch(`${API_URL}/api/canalesVenta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(canalVenta)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear canal de venta');
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
    const response = await fetch(`${API_URL}/api/canalesVenta/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(canalVenta)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar canal de venta');
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
    const response = await fetch(`${API_URL}/api/canalesVenta/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar canal de venta');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en eliminarCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de canal de venta (activo/inactivo)
export const cambiarEstadoCanalVenta = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/canalesVenta/${id}/toggle-activo`, {
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
    console.error('Error en cambiarEstadoCanalVenta:', error);
    return { success: false, error: error.message };
  }
};

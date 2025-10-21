// ============================================================================
// Service: Categorías de Clientes
// Descripción: Manejo de categorías o segmentación de clientes
// ============================================================================

import API_URL from '../constants/apiUrl.js';

// Obtener todas las categorías de clientes
export const obtenerCategoriasClientes = async () => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`);
    
    if (!response.ok) {
      throw new Error('Error al obtener categorías de clientes');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCategoriasClientes:', error);
    return { success: false, error: error.message };
  }
};

// Obtener solo categorías activas
export const obtenerCategoriasClientesActivas = async () => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/activas`);
    
    if (!response.ok) {
      throw new Error('Error al obtener categorías activas');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCategoriasClientesActivas:', error);
    return { success: false, error: error.message };
  }
};

// Obtener una categoría por ID
export const obtenerCategoriaClientePorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener categoría de cliente');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCategoriaClientePorId:', error);
    return { success: false, error: error.message };
  }
};

// Obtener una categoría por código
export const obtenerCategoriaClientePorCodigo = async (codigo) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/codigo/${codigo}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener categoría por código');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerCategoriaClientePorCodigo:', error);
    return { success: false, error: error.message };
  }
};

// Crear nueva categoría de cliente
export const crearCategoriaCliente = async (categoria) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoria)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear categoría');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en crearCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

// Actualizar categoría de cliente
export const actualizarCategoriaCliente = async (id, categoria) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(categoria)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar categoría');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en actualizarCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar categoría de cliente
export const eliminarCategoriaCliente = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar categoría');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error en eliminarCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de categoría (activo/inactivo)
export const cambiarEstadoCategoriaCliente = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}/toggle-activo`, {
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
    console.error('Error en cambiarEstadoCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

// Obtener estadísticas de categorías
export const obtenerEstadisticasCategorias = async () => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/estadisticas`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en obtenerEstadisticasCategorias:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// Service: Categorías de Clientes
// Descripción: Manejo de categorías o segmentación de clientes
// ============================================================================

import { API_URL } from '../constants/apiUrl';

// Obtener todas las categorías de clientes
export const obtenerCategoriasClientes = async () => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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
    const response = await fetch(`${API_URL}/api/categorias-clientes?activo=true`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
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

// Crear nueva categoría de cliente
export const crearCategoriaCliente = async (categoria) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(categoria)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al crear categoría');
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
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      },
      body: JSON.stringify(categoria)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al actualizar categoría');
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
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ss_token')}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al eliminar categoría');
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error en eliminarCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

// Cambiar estado de categoría (activo/inactivo)
export const cambiarEstadoCategoriaCliente = async (id, activo) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes/${id}/estado`, {
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
    console.error('Error en cambiarEstadoCategoriaCliente:', error);
    return { success: false, error: error.message };
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Obtener todos los clientes
export const obtenerClientes = async () => {
  try {
    const response = await fetch(`${API_URL}/api/clientes`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return { success: false, error: error.message };
  }
};

// Obtener cliente por ID
export const obtenerClientePorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/clientes/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Cliente no encontrado');
      }
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    return { success: false, error: error.message };
  }
};

// Crear nuevo cliente
export const crearCliente = async (cliente) => {
  try {
    const response = await fetch(`${API_URL}/api/clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cliente),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al crear cliente:', error);
    return { success: false, error: error.message };
  }
};

// Actualizar cliente
export const actualizarCliente = async (id, cliente) => {
  try {
    const response = await fetch(`${API_URL}/api/clientes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cliente),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    return { success: false, error: error.message };
  }
};

// Eliminar cliente
export const eliminarCliente = async (id) => {
  try {
    const response = await fetch(`${API_URL}/api/clientes/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    return { success: false, error: error.message };
  }
};

// Obtener categorías de clientes
export const obtenerCategoriasClientes = async () => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    // Valores por defecto en caso de error
    const categoriasDefault = [
      { id: 1, nombre: 'Normal' },
      { id: 2, nombre: 'VIP' },
      { id: 3, nombre: 'Premium' },
      { id: 4, nombre: 'Digital' },
      { id: 5, nombre: 'Empresarial' },
      { id: 6, nombre: 'Gobierno' }
    ];
    return { success: true, data: categoriasDefault };
  }
};

// Crear nueva categoría de cliente
export const crearCategoriaCliente = async (categoria) => {
  try {
    const response = await fetch(`${API_URL}/api/categorias-clientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoria),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error al crear categoría:', error);
    return { success: false, error: error.message };
  }
};
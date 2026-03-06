// API endpoints for database operations
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  try {
    const token = localStorage.getItem('ss_token');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const authError = new Error('Sesion expirada. Inicia sesion nuevamente.');
        authError.code = 401;
        throw authError;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('API request error:', error);
    let errorMessage = error.message;
    
    // Provide more specific error messages for common issues
    if (error.code === 401) {
      errorMessage = 'Sesion expirada. Inicia sesion nuevamente.';
    } else if (error.message === 'Failed to fetch') {
      errorMessage = `No se puede conectar al servidor backend en ${API_BASE_URL}. Asegúrate de que el servidor esté ejecutándose.`;
    } else if (error.message.includes('NetworkError')) {
      errorMessage = `Error de red al conectar con el servidor backend. Verifica la URL: ${API_BASE_URL}`;
    }
    
    return { success: false, error: errorMessage };
  }
};


// Initialize database tables via API
export const initializeDatabase = async () => {
  try {
    console.log('🔄 Inicializando base de datos...');
    const result = await apiRequest('/database/initialize', {
      method: 'POST',
    });

    if (result.success) {
      console.log('✅ Base de datos inicializada correctamente');
      return { success: true, message: 'Base de datos inicializada' };
    } else {
      console.error('❌ Error inicializando base de datos:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    return { success: false, error: error.message };
  }
};

// Generic API functions for CRUD operations
export const apiGet = async (endpoint) => {
  return await apiRequest(endpoint, { method: 'GET' });
};

export const apiPost = async (endpoint, data) => {
  return await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const apiPut = async (endpoint, data) => {
  return await apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const apiDelete = async (endpoint) => {
  return await apiRequest(endpoint, { method: 'DELETE' });
};

// Helper functions for error handling
export const handleDatabaseError = (error) => {
  console.error('Error de API:', error);
  return {
    success: false,
    error: error.message || 'Error desconocido en la API'
  };
};

export const handleDatabaseSuccess = (data) => {
  return {
    success: true,
    data
  };
};
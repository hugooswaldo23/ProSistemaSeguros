const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getAuthHeaders = (includeJson = false) => {
  const token = localStorage.getItem('ss_token');
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// Normalizar fecha ISO ("2026-02-20T06:00:00.000Z") a "YYYY-MM-DD"
const normalizarCita = (c) => ({
  ...c,
  fecha: c.fecha ? c.fecha.split('T')[0] : c.fecha
});

// Obtener todas las citas
export const obtenerCitas = async () => {
  try {
    const res = await fetch(`${API_URL}/api/citas?t=${Date.now()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const citas = (Array.isArray(data) ? data : []).map(normalizarCita);
    return { success: true, data: citas };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'No se pudieron obtener las citas'
    };
  }
};

// Crear nueva cita
export const crearCita = async (cita) => {
  const citaData = {
    ...cita,
    estatus: cita.estatus || 'pendiente',
    historial: cita.historial || [],
    fecha_creacion: cita.fecha_creacion || new Date().toISOString(),
    fecha_modificacion: new Date().toISOString()
  };
  try {
    const res = await fetch(`${API_URL}/api/citas`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(citaData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data: normalizarCita(data || citaData) };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'No se pudo crear la cita'
    };
  }
};

// Actualizar cita existente
export const actualizarCita = async (id, cita) => {
  const citaData = {
    ...cita,
    id,
    fecha_modificacion: new Date().toISOString()
  };
  try {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify(citaData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data: normalizarCita(data || citaData) };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'No se pudo actualizar la cita'
    };
  }
};

// Eliminar cita
export const eliminarCita = async (id) => {
  try {
    const res = await fetch(`${API_URL}/api/citas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'No se pudo eliminar la cita'
    };
  }
};

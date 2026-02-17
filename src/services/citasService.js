const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LOCAL_KEY = 'prosistema_citas';

// ── Helpers de localStorage (fallback mientras no exista API) ──
const getLocal = () => JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
const setLocal = (citas) => localStorage.setItem(LOCAL_KEY, JSON.stringify(citas));

// Normalizar fecha ISO ("2026-02-20T06:00:00.000Z") a "YYYY-MM-DD"
const normalizarCita = (c) => ({
  ...c,
  fecha: c.fecha ? c.fecha.split('T')[0] : c.fecha
});

// Obtener todas las citas
export const obtenerCitas = async () => {
  try {
    const res = await fetch(`${API_URL}/api/citas?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const citas = (Array.isArray(data) ? data : []).map(normalizarCita);
    return { success: true, data: citas };
  } catch {
    // Fallback a localStorage
    return { success: true, data: getLocal(), local: true };
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(citaData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data: normalizarCita(data || citaData) };
  } catch {
    // Fallback a localStorage
    const local = getLocal();
    local.push(citaData);
    setLocal(local);
    return { success: true, data: citaData, local: true };
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(citaData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, data: normalizarCita(data || citaData) };
  } catch {
    // Fallback a localStorage
    const local = getLocal();
    const idx = local.findIndex(c => c.id === id);
    if (idx >= 0) local[idx] = citaData;
    setLocal(local);
    return { success: true, data: citaData, local: true };
  }
};

// Eliminar cita
export const eliminarCita = async (id) => {
  try {
    const res = await fetch(`${API_URL}/api/citas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch {
    // Fallback a localStorage
    const local = getLocal().filter(c => c.id !== id);
    setLocal(local);
    return { success: true, local: true };
  }
};

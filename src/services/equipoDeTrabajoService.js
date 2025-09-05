const BASE = import.meta.env.VITE_API_URL || '';
const API_URL = `${BASE.replace(/\/$/, '')}/api/equipoDeTrabajo`;
// Obtener asignaciones de ejecutivos por producto
export const obtenerEjecutivosPorProducto = async (usuarioId) => {
  try {
    console.log('Fetching ejecutivosPorProducto for usuarioId:', `${API_URL}/ejecutivosPorProducto/${usuarioId}`);
    const res = await fetch(`${API_URL}/ejecutivosPorProducto/${usuarioId}`);
    if (!res.ok) throw new Error('Error al obtener asignaciones');
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
// Nota: no hay ruta separada para "ejecutivosPorProductoEjecutivo" — usar obtenerEjecutivosPorProducto
// Guardar asignaciones de ejecutivos por producto
export const guardarEjecutivosPorProducto = async (asignaciones) => {
  try {
    const res = await fetch(`${API_URL}/ejecutivosPorProducto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asignaciones)
    });
    if (!res.ok) throw new Error('Error al guardar asignaciones');
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
// Obtener solo los agentes del equipo de trabajo
export const obtenerAgentesEquipo = async () => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Error al obtener agentes');
    const data = await res.json();
    // Filtrar solo los que tengan perfil 'Agente' (mayúscula)
    const agentes = data.filter(miembro => miembro.perfil === 'Agente' && miembro.activo)
      .map(miembro => ({
        id: miembro.id,
        codigo: miembro.codigo || miembro.codigoAgente,
        nombre: miembro.nombre,
        apellidoPaterno: miembro.apellidoPaterno,
        apellidoMaterno: miembro.apellidoMaterno,
        email: miembro.email,
        usuario: miembro.usuario,
        activo: miembro.activo,
        perfil: miembro.perfil
      }));
    return { success: true, data: agentes };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const obtenerEquipoDeTrabajo = async () => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Error al obtener equipo de trabajo');
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const crearMiembroEquipo = async (miembro) => {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(miembro)
    });
    if (!res.ok) throw new Error('Error al crear miembro');
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const actualizarMiembroEquipo = async (id, miembro) => {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(miembro)
    });
    if (!res.ok) throw new Error('Error al actualizar miembro');
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const eliminarMiembroEquipo = async (id) => {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar miembro');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
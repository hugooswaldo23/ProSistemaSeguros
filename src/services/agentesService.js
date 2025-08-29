import { executeQuery, handleDatabaseError, handleDatabaseSuccess } from '../lib/database'

// Obtener todos los miembros del equipo de trabajo
export const obtenerEquipoDeTrabajo = async () => {
  try {
    const query = 'SELECT * FROM agentes ORDER BY created_at DESC';
    const resultado = await executeQuery(query);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data || []);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear nuevo miembro del equipo
export const crearMiembroEquipo = async (miembro) => {
  try {
    const query = `
      INSERT INTO agentes (codigo_agente, nombre, apellido_paterno, apellido_materno, email, telefono, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      miembro.codigoAgente,
      miembro.nombre,
      miembro.apellidoPaterno,
      miembro.apellidoMaterno,
      miembro.email,
      miembro.telefono,
      miembro.activo
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id: resultado.data.insertId, ...miembro });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Actualizar miembro del equipo
export const actualizarMiembroEquipo = async (id, miembro) => {
  try {
    const query = `
      UPDATE agentes SET
        nombre = ?, apellido_paterno = ?, apellido_materno = ?, email = ?, telefono = ?, activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const params = [
      miembro.nombre,
      miembro.apellidoPaterno,
      miembro.apellidoMaterno,
      miembro.email,
      miembro.telefono,
      miembro.activo,
      id
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id, ...miembro });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Eliminar miembro del equipo
export const eliminarMiembroEquipo = async (id) => {
  try {
    const query = 'DELETE FROM agentes WHERE id = ?';
    const resultado = await executeQuery(query, [id]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(true);
  } catch (error) {
    return handleDatabaseError(error);
  }
}
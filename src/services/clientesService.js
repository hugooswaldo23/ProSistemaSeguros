import { executeQuery, handleDatabaseError, handleDatabaseSuccess } from '../lib/database'

// Obtener todos los clientes
export const obtenerClientes = async () => {
  try {
    const query = 'SELECT * FROM clientes ORDER BY created_at DESC';
    const resultado = await executeQuery(query);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data || []);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear nuevo cliente
export const crearCliente = async (cliente) => {
  try {
    const query = `
      INSERT INTO clientes (
        nombre, apellido_paterno, apellido_materno, email, telefono_fijo, telefono_movil,
        direccion, ciudad, estado, codigo_postal, rfc, fecha_nacimiento, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      cliente.nombre,
      cliente.apellidoPaterno,
      cliente.apellidoMaterno,
      cliente.email,
      cliente.telefonoFijo,
      cliente.telefonoMovil,
      cliente.direccion,
      cliente.ciudad,
      cliente.estado,
      cliente.codigoPostal,
      cliente.rfc,
      cliente.fechaNacimiento,
      cliente.activo
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id: resultado.data.insertId, ...cliente });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Actualizar cliente
export const actualizarCliente = async (id, cliente) => {
  try {
    const query = `
      UPDATE clientes SET
        nombre = ?, apellido_paterno = ?, apellido_materno = ?, email = ?,
        telefono_fijo = ?, telefono_movil = ?, direccion = ?, ciudad = ?, estado = ?,
        codigo_postal = ?, rfc = ?, fecha_nacimiento = ?, activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const params = [
      cliente.nombre,
      cliente.apellidoPaterno,
      cliente.apellidoMaterno,
      cliente.email,
      cliente.telefonoFijo,
      cliente.telefonoMovil,
      cliente.direccion,
      cliente.ciudad,
      cliente.estado,
      cliente.codigoPostal,
      cliente.rfc,
      cliente.fechaNacimiento,
      cliente.activo,
      id
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id, ...cliente });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Eliminar cliente
export const eliminarCliente = async (id) => {
  try {
    const query = 'DELETE FROM clientes WHERE id = ?';
    const resultado = await executeQuery(query, [id]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(true);
  } catch (error) {
    return handleDatabaseError(error);
  }
}
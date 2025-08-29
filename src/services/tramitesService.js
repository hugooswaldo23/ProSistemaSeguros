import { executeQuery, handleDatabaseError, handleDatabaseSuccess } from '../lib/database';

// Obtener todos los trámites
export const obtenerTramites = async () => {
  try {
    const query = 'SELECT * FROM tramites ORDER BY created_at DESC';
    const resultado = await executeQuery(query);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    // Transformar datos de MySQL al formato del frontend
    const tramites = resultado.data.map(tramite => ({
      id: tramite.id,
      codigo: tramite.codigo,
      tipoTramite: tramite.tipo_tramite,
      descripcion: tramite.descripcion,
      cliente: tramite.cliente,
      expediente: tramite.expediente,
      estatus: tramite.estatus,
      prioridad: tramite.prioridad,
      fechaInicio: tramite.fecha_inicio,
      fechaLimite: tramite.fecha_limite,
      responsable: tramite.responsable,
      departamento: tramite.departamento,
      observaciones: tramite.observaciones,
      fechaCreacion: tramite.created_at ? new Date(tramite.created_at).toISOString().split('T')[0] : null
    }));

    return handleDatabaseSuccess(tramites);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear nuevo trámite
export const crearTramite = async (tramite) => {
  try {
    const query = `
      INSERT INTO tramites (
        codigo, tipo_tramite, descripcion, cliente, expediente, estatus,
        prioridad, fecha_inicio, fecha_limite, responsable, departamento, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      tramite.codigo,
      tramite.tipoTramite,
      tramite.descripcion,
      tramite.cliente,
      tramite.expediente,
      tramite.estatus,
      tramite.prioridad,
      tramite.fechaInicio,
      tramite.fechaLimite,
      tramite.responsable,
      tramite.departamento,
      tramite.observaciones
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id: resultado.data.insertId, ...tramite });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Actualizar trámite
export const actualizarTramite = async (id, tramite) => {
  try {
    const query = `
      UPDATE tramites SET
        tipo_tramite = ?, descripcion = ?, cliente = ?, expediente = ?, estatus = ?,
        prioridad = ?, fecha_inicio = ?, fecha_limite = ?, responsable = ?,
        departamento = ?, observaciones = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const params = [
      tramite.tipoTramite,
      tramite.descripcion,
      tramite.cliente,
      tramite.expediente,
      tramite.estatus,
      tramite.prioridad,
      tramite.fechaInicio,
      tramite.fechaLimite,
      tramite.responsable,
      tramite.departamento,
      tramite.observaciones,
      id
    ];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id, ...tramite });
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Eliminar trámite
export const eliminarTramite = async (id) => {
  try {
    const query = 'DELETE FROM tramites WHERE id = ?';
    const resultado = await executeQuery(query, [id]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(true);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener trámite por ID
export const obtenerTramitePorId = async (id) => {
  try {
    const query = 'SELECT * FROM tramites WHERE id = ?';
    const resultado = await executeQuery(query, [id]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    if (resultado.data.length === 0) {
      return handleDatabaseSuccess(null);
    }

    const t = resultado.data[0];
    const tramite = {
      id: t.id,
      codigo: t.codigo,
      tipoTramite: t.tipo_tramite,
      descripcion: t.descripcion,
      cliente: t.cliente,
      expediente: t.expediente,
      estatus: t.estatus,
      prioridad: t.prioridad,
      fechaInicio: t.fecha_inicio,
      fechaLimite: t.fecha_limite,
      responsable: t.responsable,
      departamento: t.departamento,
      observaciones: t.observaciones,
      fechaCreacion: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : null
    };

    return handleDatabaseSuccess(tramite);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener trámites por estatus
export const obtenerTramitesPorEstatus = async (estatus) => {
  try {
    const query = 'SELECT * FROM tramites WHERE estatus = ? ORDER BY created_at DESC';
    const resultado = await executeQuery(query, [estatus]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    const tramites = resultado.data.map(tramite => ({
      id: tramite.id,
      codigo: tramite.codigo,
      tipoTramite: tramite.tipo_tramite,
      descripcion: tramite.descripcion,
      cliente: tramite.cliente,
      expediente: tramite.expediente,
      estatus: tramite.estatus,
      prioridad: tramite.prioridad,
      fechaInicio: tramite.fecha_inicio,
      fechaLimite: tramite.fecha_limite,
      responsable: tramite.responsable,
      departamento: tramite.departamento,
      observaciones: tramite.observaciones,
      fechaCreacion: tramite.created_at ? new Date(tramite.created_at).toISOString().split('T')[0] : null
    }));

    return handleDatabaseSuccess(tramites);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener trámites por prioridad
export const obtenerTramitesPorPrioridad = async (prioridad) => {
  try {
    const query = 'SELECT * FROM tramites WHERE prioridad = ? ORDER BY created_at DESC';
    const resultado = await executeQuery(query, [prioridad]);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    const tramites = resultado.data.map(tramite => ({
      id: tramite.id,
      codigo: tramite.codigo,
      tipoTramite: tramite.tipo_tramite,
      descripcion: tramite.descripcion,
      cliente: tramite.cliente,
      expediente: tramite.expediente,
      estatus: tramite.estatus,
      prioridad: tramite.prioridad,
      fechaInicio: tramite.fecha_inicio,
      fechaLimite: tramite.fecha_limite,
      responsable: tramite.responsable,
      departamento: tramite.departamento,
      observaciones: tramite.observaciones,
      fechaCreacion: tramite.created_at ? new Date(tramite.created_at).toISOString().split('T')[0] : null
    }));

    return handleDatabaseSuccess(tramites);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener trámites vencidos
export const obtenerTramitesVencidos = async () => {
  try {
    const query = `
      SELECT * FROM tramites 
      WHERE fecha_limite < CURDATE() 
      AND estatus NOT IN ('Completado', 'Cancelado')
      ORDER BY fecha_limite ASC
    `;
    const resultado = await executeQuery(query);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    const tramites = resultado.data.map(tramite => ({
      id: tramite.id,
      codigo: tramite.codigo,
      tipoTramite: tramite.tipo_tramite,
      descripcion: tramite.descripcion,
      cliente: tramite.cliente,
      expediente: tramite.expediente,
      estatus: tramite.estatus,
      prioridad: tramite.prioridad,
      fechaInicio: tramite.fecha_inicio,
      fechaLimite: tramite.fecha_limite,
      responsable: tramite.responsable,
      departamento: tramite.departamento,
      observaciones: tramite.observaciones,
      fechaCreacion: tramite.created_at ? new Date(tramite.created_at).toISOString().split('T')[0] : null
    }));

    return handleDatabaseSuccess(tramites);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener tipos de trámite
export const obtenerTiposTramite = async () => {
  try {
    const query = 'SELECT * FROM tipos_tramite WHERE activo = 1 ORDER BY nombre';
    const resultado = await executeQuery(query);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    const tipos = resultado.data.map(tipo => ({
      id: tipo.id,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      activo: Boolean(tipo.activo)
    }));

    return handleDatabaseSuccess(tipos);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear tipo de trámite
export const crearTipoTramite = async (tipo) => {
  try {
    const query = 'INSERT INTO tipos_tramite (nombre, descripcion, activo) VALUES (?, ?, ?)';
    const params = [tipo.nombre, tipo.descripcion || '', tipo.activo ? 1 : 0];

    const resultado = await executeQuery(query, params);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess({ id: resultado.data.insertId, ...tipo });
  } catch (error) {
    return handleDatabaseError(error);
  }
};
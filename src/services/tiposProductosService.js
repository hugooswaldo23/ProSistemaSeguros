import { apiGet, apiPost, apiPut, apiDelete, handleDatabaseError, handleDatabaseSuccess } from '../lib/database';

// Obtener todos los tipos de productos
export const obtenerTiposProductos = async () => {
  try {
  const resultado = await apiGet('/api/tiposProductos');

  if (!resultado.success) return handleDatabaseError(resultado.error);

  // Algunos endpoints devuelven { success: true, data: [...] } desde el backend
  // y apiGet devuelve { success: true, data: <respuesta_backend> }.
  // Normalizamos para devolver directamente el array de tipos de producto.
  const payload = resultado.data;
  const productos = (payload && payload.data) ? payload.data : payload;
  return handleDatabaseSuccess(productos);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear nuevo tipo de producto
export const crearTipoProducto = async (tipoProducto) => {
  try {
    // Validaciones básicas
    if (!tipoProducto.nombre?.trim()) {
      return handleDatabaseError('El nombre del producto es obligatorio');
    }

  const resultado = await apiPost('/api/tiposProductos', tipoProducto);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Actualizar tipo de producto
export const actualizarTipoProducto = async (id, tipoProducto) => {
  try {
    // Validaciones básicas
    if (!tipoProducto.nombre?.trim()) {
      return handleDatabaseError('El nombre del producto es obligatorio');
    }

  const resultado = await apiPut(`/api/tiposProductos/${id}`, tipoProducto);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Eliminar tipo de producto
export const eliminarTipoProducto = async (id) => {
  try {
  const resultado = await apiDelete(`/api/tiposProductos/${id}`);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(true);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener tipo de producto por ID
export const obtenerTipoProductoPorId = async (id) => {
  try {
  const resultado = await apiGet(`/api/tiposProductos/${id}`);

  if (!resultado.success) return handleDatabaseError(resultado.error);

  const payload = resultado.data;
  const tipo = (payload && payload.data) ? payload.data : payload;
  return handleDatabaseSuccess(tipo);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener solo tipos de productos activos
export const obtenerTiposProductosActivos = async () => {
  try {
  const resultado = await apiGet('/api/tiposProductos/activos');

  if (!resultado.success) return handleDatabaseError(resultado.error);

  const payload = resultado.data;
  const productos = (payload && payload.data) ? payload.data : payload;
  return handleDatabaseSuccess(productos);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Cambiar estado de un tipo de producto (activar/desactivar)
export const cambiarEstadoTipoProducto = async (id, activo) => {
  try {
    const resultado = await apiPut(`/tiposProductos/${id}/estado`, { activo });
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener tipos de productos por código
export const obtenerTipoProductoPorCodigo = async (codigo) => {
  try {
    const resultado = await apiGet(`/tiposProductos/codigo/${codigo}`);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Reordenar tipos de productos
export const reordenarTiposProductos = async (productos) => {
  try {
    // Validar que se envíe un array con id y orden
    if (!Array.isArray(productos) || productos.length === 0) {
      return handleDatabaseError('Se requiere un array de productos con id y orden');
    }

    const resultado = await apiPut('/tiposProductos/reordenar', { productos });
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};
import { apiGet, apiPost, apiPut, apiDelete, handleDatabaseError, handleDatabaseSuccess } from '../lib/database';

// Obtener todas las aseguradoras
export const obtenerAseguradoras = async () => {
  try {
  const resultado = await apiGet('/api/aseguradoras');

    if (!resultado.success) return handleDatabaseError(resultado.error);

    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Crear nueva aseguradora
export const crearAseguradora = async (aseguradora) => {
  try {

  const resultado = await apiPost('/api/aseguradoras', aseguradora);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Actualizar aseguradora
export const actualizarAseguradora = async (id, aseguradora) => {
  try {

  const resultado = await apiPut(`/api/aseguradoras/${id}`, aseguradora);
    
    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Eliminar aseguradora
export const eliminarAseguradora = async (id) => {
  try {
  const resultado = await apiDelete(`/api/aseguradoras/${id}`);

    if (!resultado.success) return handleDatabaseError(resultado.error);
    return handleDatabaseSuccess(true);
  } catch (error) {
    return handleDatabaseError(error);
  }
};

// Obtener aseguradora por ID
export const obtenerAseguradoraPorId = async (id) => {
  try {
  const resultado = await apiGet(`/api/aseguradoras/${id}`);

    if (!resultado.success) return handleDatabaseError(resultado.error);


    return handleDatabaseSuccess(resultado.data);
  } catch (error) {
    return handleDatabaseError(error);
  }
};
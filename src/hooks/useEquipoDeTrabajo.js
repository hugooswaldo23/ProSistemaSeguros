import { useState, useEffect, useCallback } from 'react';
import { 
  obtenerEquipoDeTrabajo, 
  crearMiembroEquipo, 
  actualizarMiembroEquipo, 
  eliminarMiembroEquipo 
} from '../services/equipoDeTrabajoService';

export const useEquipoDeTrabajo = () => {
  const [equipoDeTrabajo, setEquipoDeTrabajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar equipo de trabajo
  const cargarEquipoDeTrabajo = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const resultado = await obtenerEquipoDeTrabajo();
    
    if (resultado.success) {
      // Transformar datos de la BD al formato del frontend
      const equipoTransformado = resultado.data.map(miembro => ({
        id: miembro.id,
        codigoAgente: miembro.codigo_agente,
        nombre: miembro.nombre,
        apellidoPaterno: miembro.apellido_paterno,
        apellidoMaterno: miembro.apellido_materno,
        email: miembro.email,
        telefono: miembro.telefono,
        activo: miembro.activo,
        fechaRegistro: new Date(miembro.created_at).toISOString().split('T')[0]
      }));
      
      setEquipoDeTrabajo(equipoTransformado);
    } else {
      setError(resultado.error);
    }
    
    setLoading(false);
  }, []);

  // Crear miembro del equipo
  const crear = useCallback(async (miembro) => {
    const resultado = await crearMiembroEquipo(miembro);
    
    if (resultado.success) {
      await cargarEquipoDeTrabajo(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarEquipoDeTrabajo]);

  // Actualizar miembro del equipo
  const actualizar = useCallback(async (id, miembro) => {
    const resultado = await actualizarMiembroEquipo(id, miembro);
    
    if (resultado.success) {
      await cargarEquipoDeTrabajo(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarEquipoDeTrabajo]);

  // Eliminar miembro del equipo
  const eliminar = useCallback(async (id) => {
    const resultado = await eliminarMiembroEquipo(id);
    
    if (resultado.success) {
      await cargarEquipoDeTrabajo(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarEquipoDeTrabajo]);

  // Generar código automático
  const generarCodigo = useCallback(() => {
    if (equipoDeTrabajo.length === 0) {
      return 'AG001';
    }
    
    const numeros = equipoDeTrabajo
      .map(miembro => {
        const match = miembro.codigoAgente.match(/AG(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `AG${siguienteNumero.toString().padStart(3, '0')}`;
  }, [equipoDeTrabajo]);

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarEquipoDeTrabajo();
  }, [cargarEquipoDeTrabajo]);

  return {
    equipoDeTrabajo,
    loading,
    error,
    cargarEquipoDeTrabajo,
    crear,
    actualizar,
    eliminar,
    generarCodigo
  };
};
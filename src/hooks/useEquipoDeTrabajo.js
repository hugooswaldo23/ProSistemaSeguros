import { useState, useEffect, useCallback } from 'react';
import { 
  obtenerEquipoDeTrabajo, 
  crearMiembroEquipo, 
  actualizarMiembroEquipo, 
  eliminarMiembroEquipo 
} from '../services/equipoDeTrabajoService';

export const useEquipoDeTrabajo = () => {
  // Obtener asignaciones de ejecutivos por producto
  const obtenerEjecutivosPorProducto = useCallback(async (usuarioId) => {
    const { obtenerEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
    return await obtenerEjecutivosPorProducto(usuarioId);
  }, []);
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
      const equipoTransformado = resultado.data.map(miembro => {
        let fechaRegistro = null;
        if (miembro.created_at && !isNaN(new Date(miembro.created_at))) {
          fechaRegistro = new Date(miembro.created_at).toISOString().split('T')[0];
        }
        return {
          id: miembro.id,
          codigo: miembro.codigo,
          nombre: miembro.nombre,
          apellidoPaterno: miembro.apellidoPaterno,
          apellidoMaterno: miembro.apellidoMaterno,
          email: miembro.email,
          telefono: miembro.telefono,
          activo: miembro.activo,
          fechaNacimiento: miembro.fechaNacimiento,
          fechaIngreso: miembro.fechaIngreso,
          fechaRegistro: miembro.fechaRegistro,
          perfil: miembro.perfil,
          usuario: miembro.usuario,
          horarioEntrada: miembro.horarioEntrada,
          horarioSalida: miembro.horarioSalida,
          diasTrabajo: miembro.diasTrabajo ? JSON.parse(miembro.diasTrabajo) : [],
          sueldoDiario: miembro.sueldoDiario,
          tipoPago: miembro.tipoPago,
          metodoPago: miembro.metodoPago,
          banco: miembro.banco,
          cuentaBancaria: miembro.cuentaBancaria,
          notas: miembro.notas,
          agentesSupervisados: miembro.agentesSupervisados ? JSON.parse(miembro.agentesSupervisados) : [],
          ejecutivoAsignado: miembro.ejecutivoAsignado,
          ejecutivosPorProducto: miembro.ejecutivosPorProducto,
          tiposProductosDisponibles: miembro.tiposProductosDisponibles
        };
      });
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
        const match = miembro.codigoAgente ? miembro.codigoAgente.match(/AG(\d+)/) : null;
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

  // Guardar asignaciones de ejecutivos por producto
  const guardarEjecutivosPorProducto = useCallback(async (asignaciones) => {
    const { guardarEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
    return await guardarEjecutivosPorProducto(asignaciones);
  }, []);

  return {
  equipoDeTrabajo,
  loading,
  error,
  cargarEquipoDeTrabajo,
  crear,
  actualizar,
  eliminar,
  generarCodigo,
  guardarEjecutivosPorProducto,
  obtenerEjecutivosPorProducto
  };
};
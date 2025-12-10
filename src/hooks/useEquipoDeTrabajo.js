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
        // Fecha de registro preferible desde created_at si existe
        let fechaRegistro = null;
        if (miembro.created_at && !isNaN(new Date(miembro.created_at))) {
          fechaRegistro = new Date(miembro.created_at).toISOString().split('T')[0];
        }

        // Parsear campos que pueden venir como JSON strings desde la BD
        let diasTrabajo = [];
        try { diasTrabajo = miembro.diasTrabajo ? (typeof miembro.diasTrabajo === 'string' ? JSON.parse(miembro.diasTrabajo) : miembro.diasTrabajo) : []; } catch (e) { diasTrabajo = []; }
        let agentesSupervisados = [];
        try { agentesSupervisados = miembro.agentesSupervisados ? (typeof miembro.agentesSupervisados === 'string' ? JSON.parse(miembro.agentesSupervisados) : miembro.agentesSupervisados) : []; } catch (e) { agentesSupervisados = []; }
        let tiposProductosDisponibles = [];
        try { tiposProductosDisponibles = miembro.tiposProductosDisponibles ? (typeof miembro.tiposProductosDisponibles === 'string' ? JSON.parse(miembro.tiposProductosDisponibles) : miembro.tiposProductosDisponibles) : []; } catch (e) { tiposProductosDisponibles = []; }
        let ejecutivosPorProducto = {};
        try { ejecutivosPorProducto = miembro.ejecutivosPorProducto ? (typeof miembro.ejecutivosPorProducto === 'string' ? JSON.parse(miembro.ejecutivosPorProducto) : miembro.ejecutivosPorProducto) : {}; } catch (e) { ejecutivosPorProducto = {}; }
        let productosAseguradoras = [];
        try { productosAseguradoras = miembro.productosAseguradoras ? (typeof miembro.productosAseguradoras === 'string' ? JSON.parse(miembro.productosAseguradoras) : miembro.productosAseguradoras) : []; } catch (e) { productosAseguradoras = []; }
        let comisionesCompartidas = [];
        try { comisionesCompartidas = miembro.comisionesCompartidas ? (typeof miembro.comisionesCompartidas === 'string' ? JSON.parse(miembro.comisionesCompartidas) : miembro.comisionesCompartidas) : []; } catch (e) { comisionesCompartidas = []; }

        return {
          id: miembro.id,
          codigo: miembro.codigo || miembro.codigoAgente || '',
          nombre: miembro.nombre,
          apellidoPaterno: miembro.apellidoPaterno,
          apellidoMaterno: miembro.apellidoMaterno,
          email: miembro.email,
          telefono: miembro.telefono,
          activo: miembro.activo,
          fechaNacimiento: miembro.fechaNacimiento,
          fechaIngreso: miembro.fechaIngreso,
          fechaRegistro: fechaRegistro,
          perfil: miembro.perfil,
          usuario: miembro.usuario,
          horarioEntrada: miembro.horarioEntrada,
          horarioSalida: miembro.horarioSalida,
          diasTrabajo: diasTrabajo,
          sueldoDiario: miembro.sueldoDiario,
          tipoPago: miembro.tipoPago,
          metodoPago: miembro.metodoPago,
          banco: miembro.banco,
          cuentaBancaria: miembro.cuentaBancaria,
          notas: miembro.notas,
          agentesSupervisados: agentesSupervisados,
          ejecutivoAsignado: miembro.ejecutivoAsignado,
          ejecutivosPorProducto: ejecutivosPorProducto,
          tiposProductosDisponibles: tiposProductosDisponibles,
          productosAseguradoras: productosAseguradoras,
          comisionesCompartidas: comisionesCompartidas
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
  const generarCodigo = useCallback((perfil = 'Agente') => {
    // Determinar prefijo según el perfil
    const prefijos = {
      'Agente': 'AG',
      'Vendedor': 'VE',
      'Ejecutivo': 'EJ',
      'Administrador': 'AD'
    };
    
    const prefijo = prefijos[perfil] || 'AG';
    
    // Filtrar miembros con el mismo prefijo
    const miembrosConPrefijo = equipoDeTrabajo.filter(m => 
      m.codigo && m.codigo.startsWith(prefijo)
    );
    
    if (miembrosConPrefijo.length === 0) {
      return `${prefijo}001`;
    }
    
    const numeros = miembrosConPrefijo
      .map(miembro => {
        const match = miembro.codigo ? miembro.codigo.match(new RegExp(`${prefijo}(\\d+)`)) : null;
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `${prefijo}${siguienteNumero.toString().padStart(3, '0')}`;
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
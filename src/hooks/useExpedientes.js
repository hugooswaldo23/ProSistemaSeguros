import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Hook personalizado para manejo de expedientes
 * Encapsula la lógica de carga, actualización y operaciones CRUD de expedientes
 */
export const useExpedientes = () => {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar expedientes desde el backend
  const cargarExpedientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/expedientes`);
      if (!response.ok) {
        throw new Error('Error al cargar expedientes');
      }
      
      let data = await response.json();
      
      console.log('📋 Expedientes cargados:', data.length);
      
      // ✅ NUEVO: Backend NO envía recibos en el listado
      // Se usan campos del expediente: fecha_vencimiento_pago, estatus_pago
      if (data.length > 0) {
        const primeraPoliza = data[0];
        console.log('🔍 Primera póliza (sin recibos):', {
          id: primeraPoliza.id,
          numero_poliza: primeraPoliza.numero_poliza,
          estatus_pago: primeraPoliza.estatus_pago,
          fecha_vencimiento_pago: primeraPoliza.fecha_vencimiento_pago,
          ultimo_recibo_pagado: primeraPoliza.ultimo_recibo_pagado
        });
      }
      
      setExpedientes(data);
      
      // Detectar pólizas duplicadas
      if (data.length > 0) {
        const grupos = {};
        data.forEach(exp => {
          if (exp.numero_poliza && exp.compania && exp.inicio_vigencia) {
            const clave = `${exp.numero_poliza}-${exp.compania}-${exp.inicio_vigencia}`;
            if (!grupos[clave]) {
              grupos[clave] = [];
            }
            grupos[clave].push(exp);
          }
        });
        
        const duplicados = Object.entries(grupos).filter(([_, exps]) => exps.length > 1);
        
        if (duplicados.length > 0) {
          console.warn('⚠️ Se encontraron pólizas duplicadas:');
          duplicados.forEach(([clave, exps]) => {
            console.warn(`  📋 ${clave}:`, exps.map(e => ({
              id: e.id,
              cliente_id: e.cliente_id,
              etapa: e.etapa_activa
            })));
          });
        }
      }
      
      return data;
    } catch (err) {
      console.error('Error al cargar expedientes:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar al montar
  useEffect(() => {
    cargarExpedientes();
  }, [cargarExpedientes]);

  // Eliminar expediente
  const eliminarExpediente = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/expedientes/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Error al eliminar expediente');
      }
      
      setExpedientes(prev => prev.filter(exp => exp.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error al eliminar expediente:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Actualizar expediente localmente (después de guardarlo)
  const actualizarExpediente = useCallback((expedienteActualizado) => {
    setExpedientes(prev => 
      prev.map(exp => 
        exp.id === expedienteActualizado.id ? expedienteActualizado : exp
      )
    );
  }, []);

  // Agregar expediente localmente (después de crearlo)
  const agregarExpediente = useCallback((nuevoExpediente) => {
    setExpedientes(prev => [...prev, nuevoExpediente]);
  }, []);

  return {
    expedientes,
    loading,
    error,
    cargarExpedientes,
    eliminarExpediente,
    actualizarExpediente,
    agregarExpediente,
    setExpedientes
  };
};

/**
 * Hook para manejo de clientes
 */
export const useClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/clientes`);
      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }
      
      const data = await response.json();
      
      // Crear mapa de clientes por ID
      const mapa = {};
      data.forEach(cliente => {
        mapa[cliente.id] = cliente;
      });
      
      setClientes(data);
      setClientesMap(mapa);
      
      return data;
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  return {
    clientes,
    clientesMap,
    loading,
    error,
    cargarClientes,
    setClientes,
    setClientesMap
  };
};

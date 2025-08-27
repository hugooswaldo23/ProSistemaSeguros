import { useState, useEffect, useCallback } from 'react';
import { 
  obtenerAseguradoras,
  crearAseguradora, 
  actualizarAseguradora, 
  eliminarAseguradora 
} from '../services/aseguradorasService';

export const useAseguradoras = () => {
  const [aseguradoras, setAseguradoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar aseguradoras
  const cargarAseguradoras = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const resultado = await obtenerAseguradoras();
    
    if (resultado.success) {
      setAseguradoras(resultado.data);
    } else {
      setError(resultado.error);
    }
    
    setLoading(false);
  }, []);

  // Crear aseguradora
  const crear = useCallback(async (aseguradora) => {
    const resultado = await crearAseguradora(aseguradora);
    
    if (resultado.success) {
      await cargarAseguradoras(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarAseguradoras]);

  // Actualizar aseguradora
  const actualizar = useCallback(async (id, aseguradora) => {
    const resultado = await actualizarAseguradora(id, aseguradora);
    
    if (resultado.success) {
      await cargarAseguradoras(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarAseguradoras]);

  // Eliminar aseguradora
  const eliminar = useCallback(async (id) => {
    const resultado = await eliminarAseguradora(id);
    
    if (resultado.success) {
      await cargarAseguradoras(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarAseguradoras]);

  // Generar código automático
  const generarCodigo = useCallback(() => {
    if (aseguradoras.length === 0) {
      return 'AS001';
    }
    
    const numeros = aseguradoras
      .map(aseguradora => {
        const match = aseguradora.codigo.match(/AS(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `AS${siguienteNumero.toString().padStart(3, '0')}`;
  }, [aseguradoras]);

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarAseguradoras();
  }, [cargarAseguradoras]);

  return {
    aseguradoras,
    loading,
    error,
    cargarAseguradoras,
    crear,
    actualizar,
    eliminar,
    generarCodigo
  };
};
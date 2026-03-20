/**
 * ====================================================================
 * HOOK DE PAGINACIÓN
 * ====================================================================
 * Hook personalizado para manejo de paginación y búsqueda en listas
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Hook para paginación con búsqueda integrada
 * @param {Array} items - Array de items a paginar
 * @param {number} itemsPorPagina - Cantidad de items por página
 * @param {object} [opciones] - Opciones de búsqueda
 * @param {string[]} [opciones.camposBusqueda] - Campos específicos donde buscar (si no se pasa, busca en todo el objeto)
 * @returns {object} Estado y funciones de paginación
 */
export const usePaginacion = (items, itemsPorPagina = 10, opciones = {}) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const { camposBusqueda } = opciones;

  const itemsFiltrados = useMemo(() => {
    if (!busqueda) return items;
    
    const busquedaLower = busqueda.toLowerCase();

    if (camposBusqueda && camposBusqueda.length > 0) {
      return items.filter(item =>
        camposBusqueda.some(campo => {
          const valor = item[campo];
          return valor != null && String(valor).toLowerCase().includes(busquedaLower);
        })
      );
    }

    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(busquedaLower)
    );
  }, [items, busqueda, camposBusqueda]);

  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);
  
  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return itemsFiltrados.slice(inicio, fin);
  }, [itemsFiltrados, paginaActual, itemsPorPagina]);

  const irAPagina = useCallback((pagina) => {
    setPaginaActual(Math.max(1, Math.min(pagina, totalPaginas)));
  }, [totalPaginas]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  return {
    itemsPaginados,
    paginaActual,
    totalPaginas,
    setPaginaActual: irAPagina,
    busqueda,
    setBusqueda,
    totalItems: itemsFiltrados.length
  };
};

export default usePaginacion;

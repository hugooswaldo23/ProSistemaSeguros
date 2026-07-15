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
 * @param {boolean} [opciones.normalizarEspacios=false] - Colapsa espacios repetidos y aplica trim antes de buscar
 * @returns {object} Estado y funciones de paginación
 */
export const usePaginacion = (items, itemsPorPagina = 10, opciones = {}) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const { camposBusqueda, normalizarEspacios = false } = opciones;

  const normalizarTextoBusqueda = useCallback((valor) => {
    const texto = String(valor ?? '').toLowerCase();
    return normalizarEspacios ? texto.replace(/\s+/g, ' ').trim() : texto;
  }, [normalizarEspacios]);

  const itemsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return items;
    
    const busquedaLower = normalizarTextoBusqueda(busqueda);

    if (camposBusqueda && camposBusqueda.length > 0) {
      return items.filter(item =>
        camposBusqueda.some(campo => {
          const valor = item[campo];
          return valor != null && normalizarTextoBusqueda(valor).includes(busquedaLower);
        })
      );
    }

    return items.filter(item => 
      normalizarTextoBusqueda(JSON.stringify(item)).includes(busquedaLower)
    );
  }, [items, busqueda, camposBusqueda, normalizarTextoBusqueda]);

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

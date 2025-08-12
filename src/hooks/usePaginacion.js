import { useState, useMemo } from 'react';

export const usePaginacion = (items, itemsPorPagina = 10) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const itemsFiltrados = useMemo(() => {
    if (!busqueda) return items;
    
    const busquedaLower = busqueda.toLowerCase();
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(busquedaLower)
    );
  }, [items, busqueda]);

  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);

  const paginas = useMemo(() => {
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, inicio + 4);
    
    if (fin - inicio < 4) {
      inicio = Math.max(1, fin - 4);
    }
    
    return Array.from({length: fin - inicio + 1}, (_, i) => inicio + i);
  }, [paginaActual, totalPaginas]);

  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    return itemsFiltrados.slice(inicio, inicio + itemsPorPagina);
  }, [itemsFiltrados, paginaActual, itemsPorPagina]);

  return {
    paginaActual,
    setPaginaActual,
    totalPaginas,
    paginas,
    itemsPaginados,
    busqueda,
    setBusqueda,
    totalItems: itemsFiltrados.length
  };
};

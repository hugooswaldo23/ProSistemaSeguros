import React, { useMemo, useState,useCallback,useEffect } from 'react'; 
import { Plus, Eye, Home, Users, FileText, UserCheck, Package, PieChart, Settings } from 'lucide-react';
import { useNavigate, useLocation, useParams, redirect } from "react-router-dom";

// Hook personalizado para paginación
const usePaginacion = (items, itemsPorPagina = 10) => {
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

const Productos = () => {
  const navigate = useNavigate();
  const [productosPersonalizados, setProductosPersonalizados] = useState([]);
  const paginacion = usePaginacion(productosPersonalizados, 10);
  const productos = useMemo(() => ['Autos', 'Vida', 'Daños', 'Equipo pesado', 'Embarcaciones', 'Ahorro'], []);
  const companias = useMemo(() => ['Qualitas', 'Banorte', 'HDI', 'El Aguila', 'Mapfre', 'Chubb', 'Afirme'], []);
  const [expedientes, setExpedientes] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    
  // Agregar productos base predefinidos a los personalizados
  const todosLosProductos = useMemo(() => {
    const productosBase = productos.map((prod, index) => ({
      id: `base-${index}`,
      codigo: `BASE${(index + 1).toString().padStart(3, '0')}`,
      nombre: prod,
      categoria: prod === 'Autos' || prod === 'Equipo pesado' || prod === 'Embarcaciones' ? 'Vehículos' : 
                  prod === 'Vida' || prod === 'Ahorro' ? 'Personas' : 'Patrimoniales',
      descripcion: `Producto base del sistema - ${prod}`,
      companiasDisponibles: companias,
      activo: true,
      esBase: true,
      comisionBase: prod === 'Vida' ? '30' : prod === 'Autos' ? '10' : '15',
      vigenciaDias: 365
    }));
    return [...productosBase, ...paginacion.itemsPaginados];
  }, [paginacion.itemsPaginados, productos, companias]);

  const verDetallesProducto = useCallback((producto) => {
    setProductoSeleccionado(producto);
    navigate('detalles-producto');
  }, []);
  return (
    <>
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">Gestión de Productos</h3>
            <p className="text-muted mb-0">Administra los productos de seguros disponibles</p>
          </div>
          <button
            onClick={() => {
              limpiarFormularioProducto();
              setVistaActual('formulario-producto');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Nuevo Producto
          </button>
        </div>

        {productosPersonalizados.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda 
                busqueda={paginacion.busqueda}
                setBusqueda={paginacion.setBusqueda}
                placeholder="Buscar productos..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {todosLosProductos.length} productos ({productos.length} base + {productosPersonalizados.length} personalizados)
              </small>
            </div>
          </div>
        )}

        <div className="alert alert-info mb-4">
          <div className="d-flex align-items-center">
            <Package className="me-2" size={20} />
            <div>
              <strong>Productos Base del Sistema:</strong> Los productos marcados como "BASE" son parte del sistema y no pueden ser eliminados.
              Puedes crear productos personalizados adicionales según tus necesidades.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Compañías</th>
                  <th>Comisión Base</th>
                  <th>Estado</th>
                  <th>Expedientes</th>
                  <th width="150">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {todosLosProductos.map((producto) => {
                  const expedientesProducto = expedientes.filter(exp => 
                    exp.producto === producto.nombre || exp.producto === producto.codigo
                  ).length;
                  
                  return (
                    <tr key={producto.id}>
                      <td>
                        <strong className={producto.esBase ? 'text-secondary' : 'text-primary'}>
                          {producto.codigo}
                        </strong>
                        {producto.esBase && (
                          <div>
                            <small className="text-muted">Producto base</small>
                          </div>
                        )}
                      </td>
                      <td>
                        <div>
                          <div className="fw-semibold">{producto.nombre}</div>
                          {producto.descripcion && (
                            <small className="text-muted">{producto.descripcion}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          producto.categoria === 'Vehículos' ? 'bg-primary' :
                          producto.categoria === 'Personas' ? 'bg-success' :
                          'bg-info'
                        }`}>
                          {producto.categoria}
                        </span>
                      </td>
                      <td>
                        {producto.companiasDisponibles?.length > 0 ? (
                          <small>{producto.companiasDisponibles.length} compañías</small>
                        ) : '-'}
                      </td>
                      <td>{producto.comisionBase ? `${producto.comisionBase}%` : '-'}</td>
                      <td>
                        <span className={`badge ${producto.activo ? 'bg-success' : 'bg-secondary'}`}>
                          {producto.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-info">{expedientesProducto}</span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            onClick={() => verDetallesProducto(producto)}
                            className="btn btn-outline-primary"
                            title="Ver detalles"
                          >
                            <Eye size={14} />
                          </button>
                          {!producto.esBase && (
                            <>
                              <button
                                onClick={() => editarProducto(producto)}
                                className="btn btn-outline-success"
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => eliminarProducto(producto.id)}
                                className="btn btn-outline-danger"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {paginacion.totalPaginas > 1 && (
            <div className="card-footer">
              <Paginacion 
                paginaActual={paginacion.paginaActual}
                totalPaginas={paginacion.totalPaginas}
                setPaginaActual={paginacion.setPaginaActual}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
export default Productos;   
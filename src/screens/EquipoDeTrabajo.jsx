import React, { useState, useMemo, useEffect } from 'react';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';
import { obtenerAseguradoras } from '../services/aseguradorasService';
import { obtenerTiposProductos } from '../services/tiposProductosService';
import { 
  Plus, Edit, Trash2, Eye, X, Save, Search, Users, 
  Mail, Phone, Calendar, Clock, DollarSign, Shield,
  MapPin, User, Lock, Briefcase, Hash, FileText,
  CheckCircle, AlertCircle, ChevronDown, UserCheck,
  Building2, Package, ChevronRight, Percent, Calculator,
  TrendingUp, Wallet
} from 'lucide-react';

// useEquipoDeTrabajo provisto por ../hooks/useEquipoDeTrabajo

// Las listas de aseguradoras y tipos de producto se cargan desde el backend

// Componente para mostrar tabla de comisiones
const TablaComisionesProductos = ({ productosAseguradoras, porcentajeCompartido = 0, aseguradoras = [], tiposProductos = [] }) => {
  if (!productosAseguradoras || productosAseguradoras.length === 0) {
    return (
      <div className="alert alert-info">
        <AlertCircle size={20} className="me-2" />
        No hay productos asignados aún. Asigne productos en la pestaña "Perfil y Asignaciones".
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered align-middle">
        <thead className="table-light">
          <tr>
            <th>Aseguradora</th>
            <th>Producto</th>
            <th>Comisión Base</th>
            <th>Comisión del Agente</th>
            <th>Ganancia Estimada</th>
          </tr>
        </thead>
        <tbody>
          {productosAseguradoras.map((item, index) => {
            const aseguradora = aseguradoras.find(a => String(a.id) === String(item.aseguradoraId));
            const producto = tiposProductos.find(p => String(p.id) === String(item.productoId));
            const comisionBase = item.comisionPersonalizada || producto?.comisionBase || 0;
            const comisionAgente = (comisionBase * porcentajeCompartido) / 100;
            
            return (
              <tr key={index}>
                <td>
                  <span className="badge bg-info me-2">{aseguradora?.codigo}</span>
                  {aseguradora?.nombre}
                </td>
                <td>
                  <span className="badge bg-success me-2">{producto?.codigo}</span>
                  {producto?.nombre}
                </td>
                <td className="text-center">
                  <span className="badge bg-primary">{comisionBase}%</span>
                </td>
                <td className="text-center">
                  <span className="badge bg-warning">{comisionAgente.toFixed(2)}%</span>
                </td>
                <td className="text-center">
                  <span className="text-success fw-bold">
                    ${(1000 * comisionAgente / 100).toFixed(2)}
                  </span>
                  <small className="text-muted d-block">por cada $1,000</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {porcentajeCompartido > 0 && (
        <div className="alert alert-success mt-3">
          <strong>Resumen:</strong> El agente recibirá el {porcentajeCompartido}% de las comisiones base de cada producto.
        </div>
      )}
    </div>
  );
};

// Componente para asignar ejecutivo por producto-aseguradora
const AsignarEjecutivoPorProductoAseguradora = ({ productosAseguradoras, ejecutivosDisponibles, onChange, onComisionChange, usuarioId, onAsignarEjecutivo, aseguradoras = [], tiposProductos = [] }) => {
  if (!productosAseguradoras || productosAseguradoras.length === 0) {
    return <span className="text-muted">No hay productos seleccionados</span>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered align-middle">
        <thead className="table-light">
          <tr>
            <th width="20%">Aseguradora</th>
            <th width="10%">Clave</th>
            <th width="20%">Producto</th>
            <th width="10%">Comisión Base</th>
            <th width="10%">Comisión Personalizada</th>
            <th width="20%">Ejecutivo Asignado</th>
          </tr>
        </thead>
        <tbody>
          {productosAseguradoras.map((item, index) => {
            const aseguradora = aseguradoras.find(a => String(a.id) === String(item.aseguradoraId));
            const producto = tiposProductos.find(p => String(p.id) === String(item.productoId));
            console.log('DEBUG item.aseguradoraId:', item.aseguradoraId);
            console.log('DEBUG aseguradora encontrada:', aseguradora);
            console.log('DEBUG aseguradoras disponibles:', aseguradoras.map(a => ({id: a.id, nombre: a.nombre})));
            return (
              <tr key={index}>
                  <td>
                    <div className="d-flex align-items-center">
                      <Building2 size={16} className="me-2 text-primary" />
                      <div>
                        <span className="badge bg-info me-2">{aseguradora?.codigo}</span>
                        <span className="fw-semibold">{aseguradora?.nombre}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={item.clave || ''}
                      onChange={e => onChange(index, 'clave', e.target.value)}
                      placeholder="Clave (opcional)"
                    />
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      <Package size={16} className="me-2 text-success" />
                      <span className="badge bg-success me-2">{producto?.codigo}</span>
                      {producto?.nombre}
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="badge bg-secondary">{producto?.comisionBase || 0}%</span>
                  </td>
                  <td>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        className="form-control"
                        value={item.comisionPersonalizada || producto?.comisionBase || 0}
                        onChange={e => onComisionChange(index, parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.5"
                      />
                      <span className="input-group-text">%</span>
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={item.ejecutivoId || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        onChange(index, 'ejecutivoId', val);
                        if (onAsignarEjecutivo && usuarioId) {
                          try {
                            await onAsignarEjecutivo({ usuarioId, productoId: item.productoId, ejecutivoId: val, comisionPersonalizada: item.comisionPersonalizada || 0, clave: item.clave || null });
                          } catch (err) {
                            console.error('Error al asignar ejecutivo por producto:', err);
                          }
                        }
                      }}
                    >
                      <option value="">Sin asignar</option>
                      {ejecutivosDisponibles.map(ejecutivo => (
                        <option key={ejecutivo.id} value={ejecutivo.id}>
                          {ejecutivo.codigo} - {ejecutivo.nombre} {ejecutivo.apellidoPaterno}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Modal para seleccionar aseguradora y productos
const ModalSeleccionAseguradoraProductos = ({ show, onClose, onSave, productosAseguradoras, aseguradoras = [], tiposProductos = [] }) => {
  const [aseguradoraSeleccionada, setAseguradoraSeleccionada] = useState(null);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [productosTemporales, setProductosTemporales] = useState([]);

  // Productos permitidos por la aseguradora seleccionada (normaliza diferentes formatos)
  const productosPermitidos = useMemo(() => {
    if (!aseguradoraSeleccionada) return null;
    const aseguradora = aseguradoras.find(a => String(a.id) === String(aseguradoraSeleccionada));
    if (!aseguradora) return [];
    const lista = aseguradora.productos_disponibles || [];
    // elementos pueden ser ids (number|string) o objetos { producto_id }
    const ids = lista.map(item => {
      if (item && typeof item === 'object') return Number(item.producto_id || item.productoId || item.id);
      return Number(item);
    }).filter(n => !isNaN(n));
    return ids;
  }, [aseguradoraSeleccionada, aseguradoras]);

  // Agrupar productos por categoría, filtrando por los permitidos si aplica
  const productosPorCategoria = useMemo(() => {
    const grupos = {};
    // Normalizar set de permitidos como strings para comparación robusta
    const permitidosSet = Array.isArray(productosPermitidos) ? new Set(productosPermitidos.map(id => String(id))) : null;
    tiposProductos.forEach(producto => {
      // Si hay un filtro de aseguradora, excluir productos no permitidos (comparando como strings)
      if (permitidosSet && permitidosSet.size > 0 && !permitidosSet.has(String(producto.id))) {
        return;
      }

      const categoriaKey = producto.categoria || 'General';
      if (!grupos[categoriaKey]) {
        grupos[categoriaKey] = [];
      }
      grupos[categoriaKey].push(producto);
    });
    return grupos;
  }, [tiposProductos, productosPermitidos]);

  const handleAgregarProductos = () => {
    if (!aseguradoraSeleccionada || productosSeleccionados.length === 0) {
      alert('Seleccione una aseguradora y al menos un producto');
      return;
    }

    const nuevosProductos = productosSeleccionados.map(productoId => {
      const producto = tiposProductos.find(p => p.id === productoId);
      return {
        aseguradoraId: aseguradoraSeleccionada,
        productoId: productoId,
        ejecutivoId: null,
        comisionPersonalizada: producto?.comisionBase || 0
      };
    });

    setProductosTemporales([...productosTemporales, ...nuevosProductos]);
    setProductosSeleccionados([]);
    setAseguradoraSeleccionada(null);
  };

  const handleEliminarProducto = (index) => {
    setProductosTemporales(productosTemporales.filter((_, i) => i !== index));
  };

  const handleGuardar = () => {
    onSave(productosTemporales);
    setProductosTemporales([]);
    setAseguradoraSeleccionada(null);
    setProductosSeleccionados([]);
  };

  const toggleProducto = (productoId) => {
    if (productosSeleccionados.includes(productoId)) {
      setProductosSeleccionados(productosSeleccionados.filter(id => id !== productoId));
    } else {
      setProductosSeleccionados([...productosSeleccionados, productoId]);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Building2 size={24} className="me-2" />
              Seleccionar Aseguradora y Productos
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row">
              {/* Panel izquierdo - Selección */}
              <div className="col-md-7">
                {/* Paso 1: Seleccionar Aseguradora */}
                <div className="card mb-3">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">Paso 1: Seleccionar Aseguradora</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-2">
                      {aseguradoras.map(aseguradora => (
                        <div key={aseguradora.id} className="col-md-4">
                          <div 
                            className={`card border-2 cursor-pointer ${aseguradoraSeleccionada === aseguradora.id ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setAseguradoraSeleccionada(aseguradora.id)}
                          >
                            <div className="card-body p-2 text-center">
                              <input
                                type="radio"
                                className="form-check-input me-2"
                                checked={aseguradoraSeleccionada === aseguradora.id}
                                onChange={() => setAseguradoraSeleccionada(aseguradora.id)}
                              />
                              <div>
                                <small className="fw-bold">{aseguradora.nombre}</small>
                                <div className="mt-1">
                                  <span className="badge bg-light text-dark">Productos: {(aseguradora.productos_disponibles || []).length}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Paso 2: Seleccionar Productos */}
                <div className="card">
                  <div className="card-header bg-success text-white">
                    <h6 className="mb-0">Paso 2: Seleccionar Productos</h6>
                  </div>
                  <div className="card-body">
                    {!aseguradoraSeleccionada ? (
                      <div className="text-center text-muted py-3">
                        <Package size={48} className="mb-2 opacity-50" />
                        <p>Primero seleccione una aseguradora</p>
                      </div>
                    ) : (
                      <div>
                        {Object.keys(productosPorCategoria).length === 0 ? (
                          <div className="text-center py-4 text-muted">
                            <p>No se encontraron productos para la aseguradora seleccionada.</p>
                          </div>
                        ) : (
                          Object.entries(productosPorCategoria).map(([categoria, productos]) => {
                            return (
                              <div key={categoria} className="mb-3">
                                <h6 className="text-muted mb-2">{categoria}</h6>
                                <div className="row g-2">
                                  {productos.map(producto => {
                                    const yaExiste = productosTemporales.some(
                                      p => p.aseguradoraId === aseguradoraSeleccionada && p.productoId === producto.id
                                    );

                                    return (
                                      <div key={producto.id} className="col-md-6">
                                        <div 
                                          className={`card border ${productosSeleccionados.includes(producto.id) ? 'border-success bg-success bg-opacity-10' : 'border-light'} ${yaExiste ? 'opacity-50' : ''}`}
                                          style={{ cursor: yaExiste ? 'not-allowed' : 'pointer' }}
                                          onClick={() => !yaExiste && toggleProducto(producto.id)}
                                        >
                                          <div className="card-body p-2">
                                            <div className="form-check">
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={productosSeleccionados.includes(producto.id)}
                                                onChange={() => !yaExiste && toggleProducto(producto.id)}
                                                disabled={yaExiste}
                                              />
                                              <label className="form-check-label w-100">
                                                <span className="badge bg-secondary me-1">{producto.codigo}</span>
                                                <small>{producto.nombre}</small>
                                                <span className="badge bg-primary ms-2">{producto.comisionBase}%</span>
                                                {yaExiste && <span className="badge bg-warning ms-2">Ya agregado</span>}
                                              </label>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        )}
                        
                        <button 
                          className="btn btn-primary w-100 mt-3"
                          onClick={handleAgregarProductos}
                          disabled={productosSeleccionados.length === 0}
                        >
                          <Plus size={20} className="me-2" />
                          Agregar Productos Seleccionados
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel derecho - Lista de productos agregados */}
              <div className="col-md-5">
                <div className="card">
                  <div className="card-header bg-info text-white">
                    <h6 className="mb-0">Productos Agregados ({productosTemporales.length})</h6>
                  </div>
                  <div className="card-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {productosTemporales.length === 0 ? (
                      <div className="text-center text-muted py-5">
                        <Package size={48} className="mb-2 opacity-50" />
                        <p>No hay productos agregados</p>
                      </div>
                    ) : (
                      <div className="list-group">
                        {productosTemporales.map((item, index) => {
                          const aseguradora = aseguradoras.find(a => a.id === item.aseguradoraId);
                          const producto = tiposProductos.find(p => p.id === item.productoId);
                          
                          return (
                            <div key={index} className="list-group-item">
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <div className="fw-bold text-primary">
                                    <Building2 size={14} className="me-1" />
                                    {aseguradora?.nombre}
                                  </div>
                                  <div className="text-success">
                                    <Package size={14} className="me-1" />
                                    {producto?.nombre}
                                    <span className="badge bg-primary ms-2">{producto?.comisionBase}%</span>
                                  </div>
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleEliminarProducto(index)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="button" 
              className="btn btn-success"
              onClick={handleGuardar}
              disabled={productosTemporales.length === 0}
            >
              <Save size={20} className="me-2" />
              Guardar Selección ({productosTemporales.length} productos)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sistema de Gestión de Personal Principal
const SistemaGestionPersonal = () => {
  const [mostrarModalAseguradoras, setMostrarModalAseguradoras] = useState(false);
  const { equipoDeTrabajo: usuarios, crear, actualizar, eliminar, loading, error, generarCodigo, obtenerEjecutivosPorProducto, guardarEjecutivosPorProducto } = useEquipoDeTrabajo();
  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [filtroPerfil, setFiltroPerfil] = useState('todos');
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [asignacionesUsuario, setAsignacionesUsuario] = useState([]);
  const [cargandoAsignaciones, setCargandoAsignaciones] = useState(false);
  const [mostrarAlerta, setMostrarAlerta] = useState({ show: false, message: '', type: 'success' });
  const [tabActiva, setTabActiva] = useState('general');
  
  // Estado para comisiones compartidas (relación agente-vendedor)
  const [comisionesCompartidas, setComisionesCompartidas] = useState([]);
  
  // Estado para modal de selección de agente y claves (para vendedores)
  const [mostrarModalAgenteClave, setMostrarModalAgenteClave] = useState(false);
  const [agenteSeleccionadoTemp, setAgenteSeleccionadoTemp] = useState('');
  const [clavesSeleccionadasTemp, setClavesSeleccionadasTemp] = useState([]);
  
  // Estado para vendedores autorizados (para agentes)
  const [vendedoresAutorizados, setVendedoresAutorizados] = useState([]);
  const [mostrarModalVendedor, setMostrarModalVendedor] = useState(false);
  const [vendedorSeleccionadoTemp, setVendedorSeleccionadoTemp] = useState('');
  const [clavesVendedorTemp, setClavesVendedorTemp] = useState([]);

  // Estado del formulario con campos de compensación
  const [formulario, setFormulario] = useState({
    id: null,
    codigo: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    fechaNacimiento: '',
    sexo: 'Masculino',
    curp: '',
    rfc: '',
    nss: '',
    email: '',
    telefono: '',
    telefonoEmergencia: '',
    direccion: '',
    ciudad: '',
    estado: '',
    codigoPostal: '',
    perfil: 'Agente',
    productosAseguradoras: [],
    horarioEntrada: '09:00',
    horarioSalida: '18:00',
    diasTrabajo: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    // Campos de compensación
    esquemaCompensacion: 'mixto', // 'sueldo', 'comision', 'mixto'
    tieneSueldo: true,
    sueldoDiario: '',
    tipoPago: 'Quincenal',
    metodoPago: 'Transferencia',
    banco: '',
    cuentaBancaria: '',
    porcentajeComisionCompartida: 50, // Porcentaje de la comisión base que recibe el agente
    // Acceso
    usuario: '',
    contrasena: '',
    confirmarContrasena: '',
    activo: true,
    fechaIngreso: new Date().toISOString().split('T')[0],
    fechaRegistro: new Date().toISOString().split('T')[0],
    notas: ''
  });

  // Definición de perfiles
  const perfilesSistema = {
    'Agente': {
      descripcion: 'Puede ver y gestionar solo sus propias pólizas y trámites',
      permisos: ['ver_propias_polizas', 'crear_polizas', 'editar_propias_polizas'],
      color: 'success',
      icono: UserCheck
    },
    'Vendedor': {
      descripcion: 'Puede ver y gestionar solo sus propias ventas y clientes',
      permisos: ['ver_propias_ventas', 'crear_ventas', 'editar_propias_ventas'],
      color: 'info',
      icono: Users
    },
    'Ejecutivo': {
      descripcion: 'Supervisa múltiples agentes/vendedores y ve sus operaciones',
      permisos: ['ver_equipo_polizas', 'supervisar_equipo', 'generar_reportes_equipo'],
      color: 'warning',
      icono: Briefcase
    },
    'Administrador': {
      descripcion: 'Acceso completo al sistema y todas las operaciones',
      permisos: ['acceso_total', 'gestionar_usuarios', 'configuracion_sistema'],
      color: 'danger',
      icono: Shield
    }
  };

  // Función para manejar la actualización de productos-aseguradoras
  const handleProductosAseguradorasChange = (index, field, value) => {
    const nuevosProductos = [...formulario.productosAseguradoras];
    nuevosProductos[index][field] = value;
    setFormulario({ ...formulario, productosAseguradoras: nuevosProductos });
    // Si cambiamos la clave, persistirla en la tabla normalizada
    if (field === 'clave') {
      const item = nuevosProductos[index];
      if (formulario.id && item) {
        (async () => {
          try {
            const res = await guardarEjecutivosPorProducto({ usuarioId: formulario.id, productoId: item.productoId, ejecutivoId: item.ejecutivoId || null, comisionPersonalizada: Number(item.comisionPersonalizada || 0), clave: item.clave || null });
            if (res && res.success) mostrarAlertaTemp('Clave guardada', 'success');
            else mostrarAlertaTemp('Error al guardar clave', 'danger');
          } catch (err) {
            console.error('Error guardando clave:', err);
            mostrarAlertaTemp('Error al guardar clave', 'danger');
          }
        })();
      }
    }
  };

  // Función para actualizar comisión personalizada
  const handleComisionChange = (index, value) => {
    const nuevosProductos = [...formulario.productosAseguradoras];
    nuevosProductos[index].comisionPersonalizada = value;
    setFormulario({ ...formulario, productosAseguradoras: nuevosProductos });
    // Persistir inmediatamente la comisión personalizada para este producto si hay usuarioId
    const item = nuevosProductos[index];
    if (formulario.id && item) {
      (async () => {
        try {
          const res = await guardarEjecutivosPorProducto({ usuarioId: formulario.id, productoId: item.productoId, ejecutivoId: item.ejecutivoId || null, comisionPersonalizada: Number(item.comisionPersonalizada || 0) });
          if (res && res.success) mostrarAlertaTemp('Comisión personalizada guardada', 'success');
          else mostrarAlertaTemp('Error al guardar comisión', 'danger');
        } catch (err) {
          console.error('Error guardando comisionPersonalizada:', err);
          mostrarAlertaTemp('Error al guardar comisión', 'danger');
        }
      })();
    }
  };

  // Función para guardar productos desde el modal
  const handleGuardarProductosAseguradoras = (productos) => {
    setFormulario({ 
      ...formulario, 
      productosAseguradoras: [...formulario.productosAseguradoras, ...productos] 
    });
    setMostrarModalAseguradoras(false);
  };

  // Función para eliminar un producto-aseguradora
  const handleEliminarProductoAseguradora = (index) => {
    const nuevosProductos = formulario.productosAseguradoras.filter((_, i) => i !== index);
    setFormulario({ ...formulario, productosAseguradoras: nuevosProductos });
  };

  // Funciones para gestionar comisiones compartidas
  const agregarComisionCompartida = () => {
    if (formulario.perfil === 'Vendedor') {
      // Para vendedores, abrir modal para seleccionar agente y claves
      setMostrarModalAgenteClave(true);
      setAgenteSeleccionadoTemp('');
      setClavesSeleccionadasTemp([]);
    } else {
      // Para agentes, agregar vendedor directamente
      setComisionesCompartidas([...comisionesCompartidas, {
        id: Date.now(),
        agenteId: formulario.id,
        vendedorId: '',
        porcentajeVendedor: 50,
        activo: true
      }]);
    }
  };
  
  // Función para guardar claves seleccionadas del modal
  const guardarClavesSeleccionadas = () => {
    if (!agenteSeleccionadoTemp || clavesSeleccionadasTemp.length === 0) {
      mostrarAlertaTemp('Selecciona un agente y al menos una clave', 'warning');
      return;
    }
    
    // Agregar cada clave seleccionada a la tabla
    const nuevasComisiones = clavesSeleccionadasTemp.map(clave => ({
      id: Date.now() + Math.random(),
      agenteId: agenteSeleccionadoTemp,
      vendedorId: formulario.id,
      claveId: clave.id,
      clave: clave.clave,
      aseguradoraId: clave.aseguradoraId,
      comisionBase: clave.comisionBase,
      porcentajeVendedor: 50, // Default 50%
      ejecutivoId: '',
      activo: true
    }));
    
    setComisionesCompartidas([...comisionesCompartidas, ...nuevasComisiones]);
    setMostrarModalAgenteClave(false);
    setAgenteSeleccionadoTemp('');
    setClavesSeleccionadasTemp([]);
  };

  const actualizarComisionCompartida = (index, field, value) => {
    const nuevasComisiones = [...comisionesCompartidas];
    nuevasComisiones[index][field] = value;
    setComisionesCompartidas(nuevasComisiones);
  };

  const eliminarComisionCompartida = (index) => {
    setComisionesCompartidas(comisionesCompartidas.filter((_, i) => i !== index));
  };

  // Funciones para vendedores autorizados (Agentes)
  const agregarVendedorAutorizado = () => {
    setVendedorSeleccionadoTemp('');
    setClavesVendedorTemp([]);
    setMostrarModalVendedor(true);
  };

  const guardarVendedorAutorizado = () => {
    if (!vendedorSeleccionadoTemp || clavesVendedorTemp.length === 0) {
      mostrarAlertaTemp('Selecciona un vendedor y al menos una clave', 'warning');
      return;
    }

    const nuevasAutorizaciones = clavesVendedorTemp.map(clave => ({
      id: Date.now() + Math.random(),
      vendedorId: vendedorSeleccionadoTemp,
      claveId: clave.id,
      clave: clave.clave,
      aseguradoraId: clave.aseguradoraId,
      productoId: clave.productoId,
      comisionBase: clave.comisionBase || 0,
      porcentajeVendedor: clave.porcentajeVendedor || 50,
      ejecutivoId: clave.ejecutivoId || '',
      activo: true
    }));

    setVendedoresAutorizados([...vendedoresAutorizados, ...nuevasAutorizaciones]);
    setMostrarModalVendedor(false);
    setVendedorSeleccionadoTemp('');
    setClavesVendedorTemp([]);
  };

  const actualizarVendedorAutorizado = (index, field, value) => {
    const nuevosVendedores = [...vendedoresAutorizados];
    nuevosVendedores[index][field] = value;
    setVendedoresAutorizados(nuevosVendedores);
  };

  const eliminarVendedorAutorizado = (index) => {
    setVendedoresAutorizados(vendedoresAutorizados.filter((_, i) => i !== index));
  };

  // Calcular ingresos estimados
  const calcularIngresosEstimados = () => {
    let ingresoMensualSueldo = 0;
    let ingresoMensualComisiones = 0;

    // Calcular sueldo mensual
    if (formulario.tieneSueldo && formulario.sueldoDiario) {
      ingresoMensualSueldo = parseFloat(formulario.sueldoDiario) * 30;
    }

    // Calcular comisiones estimadas (basado en un volumen de ventas hipotético)
    formulario.productosAseguradoras.forEach(item => {
      const producto = tiposProductos.find(p => p.id === item.productoId);
      const comisionBase = item.comisionPersonalizada || producto?.comisionBase || 0;
      const comisionAgente = (comisionBase * formulario.porcentajeComisionCompartida) / 100;
      // Estimación basada en ventas promedio de $100,000 por mes por producto
      ingresoMensualComisiones += (100000 * comisionAgente) / 100;
    });

    return {
      sueldo: ingresoMensualSueldo,
      comisiones: ingresoMensualComisiones,
      total: ingresoMensualSueldo + ingresoMensualComisiones
    };
  };

  // Filtrar usuarios
  const usuariosFiltrados = useMemo(() => {
    let resultado = usuarios;
    
    if (busqueda) {
      resultado = resultado.filter(u => 
        `${u.nombre} ${u.apellidoPaterno} ${u.apellidoMaterno}`.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.codigo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    
    if (filtroActivo !== 'todos') {
      resultado = resultado.filter(u => filtroActivo === 'activos' ? u.activo : !u.activo);
    }
    
    if (filtroPerfil !== 'todos') {
      resultado = resultado.filter(u => u.perfil === filtroPerfil);
    }
    
    return resultado;
  }, [usuarios, busqueda, filtroActivo, filtroPerfil]);

  // Obtener ejecutivos disponibles
  const ejecutivosDisponibles = useMemo(() => {
    return usuarios.filter(u => u.perfil === 'Ejecutivo' && u.activo && u.id !== formulario.id);
  }, [usuarios, formulario.id]);

  // Cargar catálogos desde el backend
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const resA = await obtenerAseguradoras();
        if (resA && resA.success && Array.isArray(resA.data)) setAseguradoras(resA.data);

        const resP = await obtenerTiposProductos();
        if (resP && resP.success && Array.isArray(resP.data)) setTiposProductos(resP.data);
      } catch (err) {
        console.error('Error cargando catálogos:', err);
      }
    };

    loadCatalogs();
  }, []);

  // Limpiar formulario
  const limpiarFormulario = () => {
    setFormulario({
      id: null,
      codigo: '',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      fechaNacimiento: '',
      sexo: 'Masculino',
      curp: '',
      rfc: '',
      nss: '',
      email: '',
      telefono: '',
      telefonoEmergencia: '',
      direccion: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      perfil: 'Agente',
      productosAseguradoras: [],
      horarioEntrada: '09:00',
      horarioSalida: '18:00',
      diasTrabajo: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
      esquemaCompensacion: 'mixto',
      tieneSueldo: true,
      sueldoDiario: '',
      tipoPago: 'Quincenal',
      metodoPago: 'Transferencia',
      banco: '',
      cuentaBancaria: '',
      porcentajeComisionCompartida: 50,
      usuario: '',
      contrasena: '',
      confirmarContrasena: '',
      activo: true,
      fechaIngreso: new Date().toISOString().split('T')[0],
      fechaRegistro: new Date().toISOString().split('T')[0],
      notas: ''
    });
    setComisionesCompartidas([]);
    setVendedoresAutorizados([]);
  };

  // Mostrar alerta
  const mostrarAlertaTemp = (message, type = 'success') => {
    setMostrarAlerta({ show: true, message, type });
    setTimeout(() => setMostrarAlerta({ show: false, message: '', type: 'success' }), 3000);
  };

  // Abrir formulario para nuevo usuario
  const abrirFormularioNuevo = () => {
    limpiarFormulario();
    setModoEdicion(false);
    setMostrarFormulario(true);
    setTabActiva('general');
    setFormulario(prev => ({ 
      ...prev, 
      codigo: generarCodigo(prev.perfil)
    }));
  };

  // Guardar usuario
  const guardarUsuario = async () => {
    // Validaciones básicas
    if (!formulario.nombre || !formulario.apellidoPaterno) {
      mostrarAlertaTemp('Por favor complete el nombre y apellido paterno', 'error');
      return;
    }
    
    if (!formulario.usuario) {
      mostrarAlertaTemp('Por favor ingrese un nombre de usuario', 'error');
      return;
    }

    const payload = { 
      ...formulario,
      comisionesCompartidas: comisionesCompartidas, // Para Vendedores
      vendedoresAutorizados: vendedoresAutorizados  // Para Agentes
    };
    // No enviar campos auxiliares ni el mapping legacy de ejecutivosPorProducto
    delete payload.confirmarContrasena;
    delete payload.ejecutivosPorProducto;

    console.log('=== GUARDANDO USUARIO ===');
    console.log('Perfil:', payload.perfil);
    console.log('Esquema compensación:', payload.esquemaCompensacion);
    console.log('Comisiones compartidas (Vendedor):', payload.comisionesCompartidas);
    console.log('Vendedores autorizados (Agente):', payload.vendedoresAutorizados);
    console.log('Payload completo:', payload);

    if (modoEdicion) {
      const res = await actualizar(formulario.id, payload);
      if (res.success) mostrarAlertaTemp('Usuario actualizado exitosamente', 'success');
      else mostrarAlertaTemp('Error al actualizar usuario', 'danger');
    } else {
      const res = await crear(payload);
      if (res.success) mostrarAlertaTemp('Usuario creado exitosamente', 'success');
      else mostrarAlertaTemp('Error al crear usuario', 'danger');
    }
    
    setMostrarFormulario(false);
    limpiarFormulario();
  };

  // Editar usuario: cargar en el formulario y abrir modal en modo edición
  const editarUsuario = (usuario) => {
    // Fusionar valores mínimos que el formulario espera
    setFormulario({
      id: usuario.id,
      codigo: usuario.codigo || '',
      nombre: usuario.nombre || '',
      apellidoPaterno: usuario.apellidoPaterno || '',
      apellidoMaterno: usuario.apellidoMaterno || '',
      fechaNacimiento: usuario.fechaNacimiento || '',
      sexo: usuario.sexo || 'Masculino',
      curp: usuario.curp || '',
      rfc: usuario.rfc || '',
      nss: usuario.nss || '',
      email: usuario.email || '',
      telefono: usuario.telefono || '',
      telefonoEmergencia: usuario.telefonoEmergencia || '',
      direccion: usuario.direccion || '',
      ciudad: usuario.ciudad || '',
      estado: usuario.estado || '',
      codigoPostal: usuario.codigoPostal || '',
      perfil: usuario.perfil || 'Agente',
      productosAseguradoras: usuario.productosAseguradoras || usuario.tiposProductosDisponibles || [],
      horarioEntrada: usuario.horarioEntrada || '09:00',
      horarioSalida: usuario.horarioSalida || '18:00',
      diasTrabajo: usuario.diasTrabajo || ['Lunes','Martes','Miércoles','Jueves','Viernes'],
      esquemaCompensacion: usuario.esquemaCompensacion || 'mixto',
      tieneSueldo: usuario.tieneSueldo !== undefined ? usuario.tieneSueldo : true,
      sueldoDiario: usuario.sueldoDiario || '',
      tipoPago: usuario.tipoPago || 'Quincenal',
      metodoPago: usuario.metodoPago || 'Transferencia',
      banco: usuario.banco || '',
      cuentaBancaria: usuario.cuentaBancaria || '',
      porcentajeComisionCompartida: usuario.porcentajeComisionCompartida || 50,
      usuario: usuario.usuario || '',
      contrasena: '',
      confirmarContrasena: '',
      activo: usuario.activo === undefined ? true : Boolean(usuario.activo),
      fechaIngreso: usuario.fechaIngreso || new Date().toISOString().split('T')[0],
      fechaRegistro: usuario.fechaRegistro || new Date().toISOString().split('T')[0],
      notas: usuario.notas || ''
    });

    setModoEdicion(true);
    setMostrarFormulario(true);
    setTabActiva('general'); // Abrir en Datos Generales al editar
    // Cargar asignaciones desde la tabla ejecutivos_por_producto para poblar el formulario
    (async () => {
      try {
        const res = await obtenerEjecutivosPorProducto(usuario.id);
        console.log('obtenerEjecutivosPorProducto (editarUsuario) res=', res);
        let asigns = [];
        if (res && res.success) asigns = res.data || [];
        else if (res && Array.isArray(res)) asigns = res;

        // Mapear asignaciones al formato productoAseguradora esperado
        const productosMapeados = asigns.map(a => {
          // Usar el aseguradoraId que viene de la base de datos, no recalcular
          let aseguradoraId = a.aseguradoraId;
          
          // Solo como fallback, si no viene aseguradoraId, intentar deducir a partir de productos_disponibles
          if (!aseguradoraId) {
            for (const as of aseguradoras) {
              const lista = as.productos_disponibles || [];
              const ids = lista.map(it => (typeof it === 'object' ? (it.producto_id || it.productoId || it.id) : it));
              if (ids.map(String).includes(String(a.productoId))) { aseguradoraId = as.id; break; }
            }
          }

          return {
            aseguradoraId: aseguradoraId,
            productoId: a.productoId,
            ejecutivoId: a.ejecutivoId,
            comisionPersonalizada: a.comisionPersonalizada || 0,
            clave: a.clave || null
          };
        });

        setFormulario(prev => ({ ...prev, productosAseguradoras: productosMapeados }));
      } catch (err) {
        console.error('Error cargando asignaciones en editarUsuario:', err);
      }
    })();
    
    // Cargar comisiones compartidas desde el usuario (Vendedores)
    let comisiones = [];
    try {
      if (usuario.comisionesCompartidas) {
        if (typeof usuario.comisionesCompartidas === 'string') {
          comisiones = JSON.parse(usuario.comisionesCompartidas);
        } else if (Array.isArray(usuario.comisionesCompartidas)) {
          comisiones = usuario.comisionesCompartidas;
        } else if (typeof usuario.comisionesCompartidas === 'object') {
          comisiones = Object.values(usuario.comisionesCompartidas);
        }
      }
    } catch (e) {
      console.error('Error parseando comisionesCompartidas:', e);
      comisiones = [];
    }
    
    // 🔥 FIX: Reconstruir comisionBase desde las claves del agente
    const comisionesConBase = comisiones.map(comision => {
      // Si ya tiene comisionBase, usarlo
      if (comision.comisionBase && comision.comisionBase > 0) {
        return comision;
      }
      
      // Si no, buscarlo en las claves del agente correspondiente
      const agente = usuarios.find(u => String(u.id) === String(comision.agenteId));
      if (agente && agente.productosAseguradoras) {
        const claveAgente = agente.productosAseguradoras.find(pa => 
          String(pa.aseguradoraId) === String(comision.aseguradoraId) && 
          pa.clave === comision.clave
        );
        
        if (claveAgente) {
          const producto = tiposProductos.find(p => String(p.id) === String(claveAgente.productoId));
          const comisionBase = claveAgente.comisionPersonalizada || producto?.comisionBase || 0;
          return {
            ...comision,
            comisionBase: comisionBase
          };
        }
      }
      
      return comision;
    });
    
    setComisionesCompartidas(comisionesConBase);

    // Cargar vendedores autorizados para este agente
    let vendedores = [];
    if (usuario.perfil === 'Agente') {
      // Buscar en todos los vendedores cuáles tienen comisiones con este agente
      usuarios.forEach(u => {
        if (u.perfil === 'Vendedor' && u.comisionesCompartidas) {
          let comisionesVendedor = [];
          try {
            if (typeof u.comisionesCompartidas === 'string') {
              comisionesVendedor = JSON.parse(u.comisionesCompartidas);
            } else if (Array.isArray(u.comisionesCompartidas)) {
              comisionesVendedor = u.comisionesCompartidas;
            }
          } catch (e) {}
          
          // Filtrar las que pertenecen a este agente
          const comisionesDeEsteAgente = comisionesVendedor.filter(
            c => String(c.agenteId) === String(usuario.id)
          );
          
          // 🔥 FIX: Reconstruir comisionBase desde las claves del agente
          const comisionesConBase = comisionesDeEsteAgente.map(comision => {
            // Si ya tiene comisionBase, usarlo
            if (comision.comisionBase && comision.comisionBase > 0) {
              return comision;
            }
            
            // Si no, buscarlo en las claves del agente
            const claveAgente = usuario.productosAseguradoras?.find(pa => 
              String(pa.aseguradoraId) === String(comision.aseguradoraId) && 
              pa.clave === comision.clave
            );
            
            if (claveAgente) {
              const producto = tiposProductos.find(p => String(p.id) === String(claveAgente.productoId));
              const comisionBase = claveAgente.comisionPersonalizada || producto?.comisionBase || 0;
              return {
                ...comision,
                comisionBase: comisionBase
              };
            }
            
            return comision;
          });
          
          vendedores.push(...comisionesConBase);
        }
      });
    }
    setVendedoresAutorizados(vendedores);

    console.log('Usuario completo:', usuario);
    console.log('Comisiones compartidas cargadas:', comisiones);
    console.log('Vendedores autorizados cargados:', vendedores);
  };

  // Cargar y mostrar detalles (incluye registros de ejecutivos_por_producto)
  useEffect(() => {
    const cargarAsignaciones = async () => {
      if (!mostrarDetalles || !usuarioSeleccionado) return;
      setCargandoAsignaciones(true);
      try {
        const res = await obtenerEjecutivosPorProducto(usuarioSeleccionado.id);
        console.log('obtenerEjecutivosPorProducto (detalles) res=', res);
        // servicio devuelve { success, data } o directamente data según implementación
        if (res && res.success) setAsignacionesUsuario(res.data || []);
        else if (res && Array.isArray(res)) setAsignacionesUsuario(res);
        else setAsignacionesUsuario([]);
      } catch (err) {
        console.error('Error cargando asignaciones:', err);
        setAsignacionesUsuario([]);
      } finally {
        setCargandoAsignaciones(false);
      }
    };

    cargarAsignaciones();
  }, [mostrarDetalles, usuarioSeleccionado, obtenerEjecutivosPorProducto]);

  // Confirmar y eliminar usuario
  const confirmarEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    const res = await eliminar(id);
    if (res && res.success) mostrarAlertaTemp('Usuario eliminado', 'success');
    else mostrarAlertaTemp('Error al eliminar usuario', 'danger');
  };

  const ingresos = calcularIngresosEstimados();

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      {/* Header Principal */}
      <div className="bg-white shadow-sm mb-4">
        <div className="container-fluid">
          <div className="row align-items-center py-3">
            <div className="col">
              <h3 className="mb-0 text-dark d-flex align-items-center">
                <Users size={28} className="me-2 text-primary" />
                Sistema de Gestión de Personal - Agencia de Seguros
              </h3>
              <small className="text-muted">Gestión de Agentes, Vendedores, Ejecutivos y Administradores</small>
            </div>
            <div className="col-auto">
              <button 
                className="btn btn-primary d-flex align-items-center"
                onClick={abrirFormularioNuevo}
              >
                <Plus size={20} className="me-2" />
                Agregar Usuario
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="container-fluid">
        {/* Estadísticas */}
        <div className="row mb-4">
          {Object.entries(perfilesSistema).map(([perfil, info]) => {
            const IconoPerfil = info.icono;
            return (
              <div key={perfil} className="col-md-3 mb-3">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex align-items-center">
                      <div className={`p-3 rounded bg-${info.color} bg-opacity-10 me-3`}>
                        <IconoPerfil size={24} className={`text-${info.color}`} />
                      </div>
                      <div>
                        <h6 className="mb-0">{perfil}s</h6>
                        <h4 className="mb-0">0</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <Search size={20} />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Buscar por nombre, código o email..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <select 
                  className="form-select"
                  value={filtroPerfil}
                  onChange={(e) => setFiltroPerfil(e.target.value)}
                >
                  <option value="todos">Todos los perfiles</option>
                  <option value="Agente">Solo Agentes</option>
                  <option value="Vendedor">Solo Vendedores</option>
                  <option value="Ejecutivo">Solo Ejecutivos</option>
                  <option value="Administrador">Solo Administradores</option>
                </select>
              </div>
              <div className="col-md-3">
                <select 
                  className="form-select"
                  value={filtroActivo}
                  onChange={(e) => setFiltroActivo(e.target.value)}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos">Solo Activos</option>
                  <option value="inactivos">Solo Inactivos</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="bg-light">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="py-3">Nombre Completo</th>
                    <th className="py-3">Perfil</th>
                    <th className="py-3">Usuario</th>
                    <th className="py-3">Contacto</th>
                    <th className="py-3 text-center">Claves</th>
                    <th className="py-3 text-center">Vendedores</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5">Cargando...</td>
                    </tr>
                  ) : usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <Users size={48} className="text-muted mb-3" />
                        <p className="text-muted mb-0">No hay usuarios registrados</p>
                        <button 
                          className="btn btn-primary mt-3"
                          onClick={abrirFormularioNuevo}
                        >
                          Agregar primer usuario
                        </button>
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map(u => {
                      // Contar claves del agente (de productosAseguradoras si existe)
                      const numClaves = u.perfil === 'Agente' ? (u.productosAseguradoras?.length || 0) : 0;
                      
                      // Contar vendedores asociados a este agente (revisar comisionesCompartidas de otros usuarios)
                      const numVendedores = u.perfil === 'Agente' 
                        ? usuarios.filter(vendedor => 
                            vendedor.perfil === 'Vendedor' && 
                            vendedor.comisionesCompartidas?.some(c => String(c.agenteId) === String(u.id))
                          ).length
                        : 0;
                      
                      return (
                      <tr key={u.id}>
                        <td className="align-middle">{u.codigo}</td>
                        <td className="align-middle">{`${u.nombre} ${u.apellidoPaterno} ${u.apellidoMaterno}`}</td>
                        <td className="align-middle">{u.perfil}</td>
                        <td className="align-middle">{u.usuario}</td>
                        <td className="align-middle">{u.email || u.telefono || '-'}</td>
                        <td className="align-middle text-center">
                          {u.perfil === 'Agente' ? (
                            <span className="badge bg-info">
                              <Hash size={12} className="me-1" />
                              {numClaves}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="align-middle text-center">
                          {u.perfil === 'Agente' ? (
                            <span className="badge bg-primary">
                              <Users size={12} className="me-1" />
                              {numVendedores}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="align-middle">{u.activo ? <span className="badge bg-success">Activo</span> : <span className="badge bg-secondary">Inactivo</span>}</td>
                        <td className="align-middle text-center">
                          <div className="btn-group" role="group">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => editarUsuario(u)} title="Editar">
                              <Edit size={14} />
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => { setUsuarioSeleccionado(u); setMostrarDetalles(true); }} title="Ver">
                              <Eye size={14} />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => confirmarEliminar(u.id)} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Formulario */}
      {mostrarFormulario && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modoEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarFormulario(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Tabs */}
                <ul className="nav nav-tabs mb-4">
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'general' ? 'active' : ''}`}
                      onClick={() => setTabActiva('general')}
                      type="button"
                    >
                      <User size={18} className="me-2" />
                      Datos Generales
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'compensacion' ? 'active' : ''}`}
                      onClick={() => setTabActiva('compensacion')}
                      type="button"
                    >
                      <DollarSign size={18} className="me-2" />
                      Compensación y Comisiones
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'acceso' ? 'active' : ''}`}
                      onClick={() => setTabActiva('acceso')}
                      type="button"
                    >
                      <Lock size={18} className="me-2" />
                      Acceso al Sistema
                    </button>
                  </li>
                </ul>

                {/* Contenido de tabs */}
                <div className="tab-content">
                  {/* Tab Datos Generales */}
                  {tabActiva === 'general' && (
                    <div className="tab-pane fade show active">
                      <div className="row g-3">
                        {/* Perfil del Usuario - Primero */}
                        <div className="col-md-4">
                          <label className="form-label">Perfil del Usuario *</label>
                          <select 
                            className="form-select"
                            value={formulario.perfil}
                            onChange={(e) => {
                              const nuevoPerfil = e.target.value;
                              setFormulario({
                                ...formulario, 
                                perfil: nuevoPerfil,
                                codigo: generarCodigo(nuevoPerfil),
                                productosAseguradoras: []
                              });
                            }}
                          >
                            <option value="Agente">Agente</option>
                            <option value="Vendedor">Vendedor</option>
                            <option value="Ejecutivo">Ejecutivo</option>
                            <option value="Administrador">Administrador</option>
                          </select>
                        </div>
                        
                        <div className="col-md-8">
                          <label className="form-label">Descripción del Perfil</label>
                          <div className="alert alert-info mb-0">
                            <small>{perfilesSistema[formulario.perfil]?.descripcion}</small>
                          </div>
                        </div>

                        <div className="col-md-3">
                          <label className="form-label">Código *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formulario.codigo}
                            onChange={(e) => setFormulario({...formulario, codigo: e.target.value})}
                            readOnly={modoEdicion}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Nombre *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formulario.nombre}
                            onChange={(e) => setFormulario({...formulario, nombre: e.target.value})}
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Apellido Paterno *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formulario.apellidoPaterno}
                            onChange={(e) => setFormulario({...formulario, apellidoPaterno: e.target.value})}
                            required
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Apellido Materno</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formulario.apellidoMaterno}
                            onChange={(e) => setFormulario({...formulario, apellidoMaterno: e.target.value})}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Email</label>
                          <input
                            type="email"
                            className="form-control"
                            value={formulario.email}
                            onChange={(e) => setFormulario({...formulario, email: e.target.value})}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Teléfono</label>
                          <input
                            type="tel"
                            className="form-control"
                            value={formulario.telefono}
                            onChange={(e) => setFormulario({...formulario, telefono: e.target.value})}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label">Estado del Usuario</label>
                          <div className="form-check form-switch mt-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formulario.activo}
                              onChange={(e) => setFormulario({...formulario, activo: e.target.checked})}
                            />
                            <label className="form-check-label">
                              {formulario.activo ? 'Activo' : 'Inactivo'}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}



                  {/* Tab Compensación y Comisiones */}
                  {tabActiva === 'compensacion' && (
                    <div className="tab-pane fade show active">
                      <div className="row g-3">
                        {/* Esquema de Compensación */}
                        <div className="col-12">
                          <h6 className="mb-3">
                            <Calculator size={20} className="me-2" />
                            Esquema de Compensación
                          </h6>
                          <div className="row g-3">
                            <div className="col-md-4">
                              <div 
                                className={`card border-2 ${formulario.esquemaCompensacion === 'sueldo' ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setFormulario({...formulario, esquemaCompensacion: 'sueldo', tieneSueldo: true})}
                              >
                                <div className="card-body text-center">
                                  <Wallet size={24} className="mb-2 text-primary" />
                                  <h6>Solo Sueldo</h6>
                                  <small>Sueldo fijo sin comisiones</small>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div 
                                className={`card border-2 ${formulario.esquemaCompensacion === 'comision' ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setFormulario({...formulario, esquemaCompensacion: 'comision', tieneSueldo: false})}
                              >
                                <div className="card-body text-center">
                                  <Percent size={24} className="mb-2 text-success" />
                                  <h6>Solo Comisiones</h6>
                                  <small>Sin sueldo, solo comisiones</small>
                                </div>
                              </div>
                            </div>
                            <div className="col-md-4">
                              <div 
                                className={`card border-2 ${formulario.esquemaCompensacion === 'mixto' ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setFormulario({...formulario, esquemaCompensacion: 'mixto', tieneSueldo: true})}
                              >
                                <div className="card-body text-center">
                                  <TrendingUp size={24} className="mb-2 text-warning" />
                                  <h6>Mixto</h6>
                                  <small>Sueldo base + Comisiones</small>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sueldo Base - Solo si aplica */}
                        {formulario.tieneSueldo && (
                          <>
                            <div className="col-12 mt-4">
                              <h6 className="mb-3">
                                <DollarSign size={20} className="me-2" />
                                Sueldo Base
                              </h6>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Sueldo Diario *</label>
                              <div className="input-group">
                                <span className="input-group-text">$</span>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={formulario.sueldoDiario}
                                  onChange={(e) => setFormulario({...formulario, sueldoDiario: e.target.value})}
                                  placeholder="0.00"
                                  step="0.01"
                                />
                              </div>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Tipo de Pago</label>
                              <select 
                                className="form-select"
                                value={formulario.tipoPago}
                                onChange={(e) => setFormulario({...formulario, tipoPago: e.target.value})}
                              >
                                <option value="Semanal">Semanal</option>
                                <option value="Quincenal">Quincenal</option>
                                <option value="Mensual">Mensual</option>
                              </select>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Método de Pago</label>
                              <select 
                                className="form-select"
                                value={formulario.metodoPago}
                                onChange={(e) => setFormulario({...formulario, metodoPago: e.target.value})}
                              >
                                <option value="Transferencia">Transferencia</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Deposito">Depósito</option>
                              </select>
                            </div>
                            <div className="col-md-3">
                              <label className="form-label">Banco</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formulario.banco}
                                onChange={(e) => setFormulario({...formulario, banco: e.target.value})}
                                placeholder="Nombre del banco"
                              />
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">Cuenta Bancaria</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formulario.cuentaBancaria}
                                onChange={(e) => setFormulario({...formulario, cuentaBancaria: e.target.value})}
                                placeholder="Número de cuenta o CLABE"
                              />
                            </div>
                            
                            {/* Cálculo de sueldo */}
                            {formulario.sueldoDiario && (
                              <div className="col-12 mt-3">
                                <div className="alert alert-success">
                                  <h6>Cálculo de Sueldo:</h6>
                                  <div className="row">
                                    <div className="col-md-4">
                                      <strong>Sueldo Semanal:</strong> ${(formulario.sueldoDiario * 7).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                    </div>
                                    <div className="col-md-4">
                                      <strong>Sueldo Quincenal:</strong> ${(formulario.sueldoDiario * 15).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                    </div>
                                    <div className="col-md-4">
                                      <strong>Sueldo Mensual:</strong> ${(formulario.sueldoDiario * 30).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Claves y Aseguradoras - Solo para Agentes */}
                        {formulario.perfil === 'Agente' && (
                          <div className="col-12 mt-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">
                                <Hash size={20} className="me-2" />
                                Claves y Aseguradoras
                              </h6>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setMostrarModalAseguradoras(true)}
                              >
                                <Plus size={16} className="me-2" />
                                {formulario.productosAseguradoras?.length > 0 ? 'Modificar Claves' : 'Agregar Claves'}
                              </button>
                            </div>

                            {!formulario.productosAseguradoras || formulario.productosAseguradoras.length === 0 ? (
                              <div className="alert alert-info">
                                <AlertCircle size={20} className="me-2" />
                                No hay claves registradas. Agrega las aseguradoras y claves con las que trabajarás.
                              </div>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-bordered">
                                  <thead className="table-light">
                                    <tr>
                                      <th width="20%">Aseguradora</th>
                                      <th width="20%">Clave</th>
                                      <th width="25%">Producto</th>
                                      <th width="15%">Comisión Base</th>
                                      <th width="20%">Ejecutivo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {formulario.productosAseguradoras.map((item, index) => {
                                      const aseguradora = aseguradoras.find(a => String(a.id) === String(item.aseguradoraId));
                                      const producto = tiposProductos.find(p => String(p.id) === String(item.productoId));
                                      const ejecutivo = usuarios.filter(u => u.perfil === 'Ejecutivo' && u.activo);
                                      
                                      return (
                                        <tr key={index}>
                                          <td>
                                            <span className={`badge bg-${aseguradora?.nombre.toLowerCase() === 'qualitas' ? 'primary' : aseguradora?.nombre.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                              {aseguradora?.nombre || 'N/A'}
                                            </span>
                                          </td>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control form-control-sm"
                                              value={item.clave || ''}
                                              onChange={(e) => {
                                                const nuevosProductos = [...formulario.productosAseguradoras];
                                                nuevosProductos[index].clave = e.target.value;
                                                setFormulario({...formulario, productosAseguradoras: nuevosProductos});
                                              }}
                                              placeholder="Clave del agente"
                                            />
                                          </td>
                                          <td>
                                            <small>{producto?.nombre || 'N/A'}</small>
                                          </td>
                                          <td>
                                            <div className="input-group input-group-sm">
                                              <input
                                                type="number"
                                                className="form-control"
                                                value={item.comisionPersonalizada || 0}
                                                onChange={(e) => {
                                                  const nuevosProductos = [...formulario.productosAseguradoras];
                                                  nuevosProductos[index].comisionPersonalizada = parseFloat(e.target.value) || 0;
                                                  setFormulario({...formulario, productosAseguradoras: nuevosProductos});
                                                }}
                                                min="0"
                                                max="100"
                                                step="0.5"
                                              />
                                              <span className="input-group-text">%</span>
                                            </div>
                                          </td>
                                          <td>
                                            <select
                                              className="form-select form-select-sm"
                                              value={item.ejecutivoId || ''}
                                              onChange={(e) => {
                                                const nuevosProductos = [...formulario.productosAseguradoras];
                                                nuevosProductos[index].ejecutivoId = e.target.value;
                                                setFormulario({...formulario, productosAseguradoras: nuevosProductos});
                                              }}
                                            >
                                              <option value="">Sin ejecutivo</option>
                                              {ejecutivo.map(u => (
                                                <option key={u.id} value={u.id}>
                                                  {u.codigo} - {u.nombre} {u.apellidoPaterno}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Vendedores Autorizados - Solo para Agentes */}
                        {formulario.perfil === 'Agente' && (
                          <div className="col-12 mt-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">
                                <Percent size={20} className="me-2" />
                                Vendedores autorizados a usar tu clave
                              </h6>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={agregarVendedorAutorizado}
                              >
                                <Plus size={16} className="me-2" />
                                Agregar Vendedor
                              </button>
                            </div>

                            {vendedoresAutorizados.length === 0 ? (
                              <div className="alert alert-info">
                                <AlertCircle size={20} className="me-2" />
                                No hay vendedores configurados. Agrega los vendedores que pueden usar tu clave y define su porcentaje de comisión.
                              </div>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-bordered">
                                  <thead className="table-light">
                                    <tr>
                                      <th width="20%">Vendedor</th>
                                      <th width="12%">Aseguradora</th>
                                      <th width="12%">Clave</th>
                                      <th width="10%">Comisión Base</th>
                                      <th width="12%">Comisión Vendedor</th>
                                      <th width="10%">Tú recibes</th>
                                      <th width="18%">Ejecutivo</th>
                                      <th width="6%" className="text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vendedoresAutorizados.map((autorizacion, index) => {
                                      console.log('🔍 [VENDEDOR AUTORIZADO]', autorizacion);
                                      console.log('📋 Lista de usuarios disponibles:', usuarios.map(u => ({ id: u.id, codigo: u.codigo, nombre: u.nombre, perfil: u.perfil })));
                                      console.log('🔎 Buscando vendedorId:', autorizacion.vendedorId, 'Tipo:', typeof autorizacion.vendedorId);
                                      const vendedor = usuarios.find(u => String(u.id) === String(autorizacion.vendedorId));
                                      console.log('✅ Vendedor encontrado:', vendedor);
                                      const aseguradora = aseguradoras.find(a => String(a.id) === String(autorizacion.aseguradoraId));
                                      
                                      // 🔥 CONSULTAR COMISIÓN BASE ACTUAL desde las claves del agente (formulario actual)
                                      let comisionBaseActual = autorizacion.comisionBase || 0;
                                      const claveAgente = formulario.productosAseguradoras?.find(pa => 
                                        String(pa.aseguradoraId) === String(autorizacion.aseguradoraId) && 
                                        pa.clave === autorizacion.clave
                                      );
                                      if (claveAgente) {
                                        const producto = tiposProductos.find(p => String(p.id) === String(claveAgente.productoId));
                                        comisionBaseActual = claveAgente.comisionPersonalizada || producto?.comisionBase || 0;
                                      }
                                      
                                      const porcentajeVendedor = parseFloat(autorizacion.porcentajeVendedor) || 0;
                                      const porcentajeAgente = comisionBaseActual - porcentajeVendedor;
                                      console.log('💰 Cálculo:', { comisionBaseActual, porcentajeVendedor, porcentajeAgente });
                                      
                                      return (
                                        <tr key={index}>
                                          <td>
                                            <strong>{vendedor ? `${vendedor.codigo} - ${vendedor.nombre} ${vendedor.apellidoPaterno}` : 'N/A'}</strong>
                                          </td>
                                          <td>
                                            {aseguradora ? (
                                              <span className={`badge bg-${aseguradora.nombre.toLowerCase() === 'qualitas' ? 'primary' : aseguradora.nombre.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                                {aseguradora.nombre}
                                              </span>
                                            ) : 'N/A'}
                                          </td>
                                          <td>
                                            <code>{autorizacion.clave || 'N/A'}</code>
                                          </td>
                                          <td className="text-center">
                                            <span className="badge bg-info fs-6">{comisionBaseActual}%</span>
                                          </td>
                                          <td>
                                            <div className="input-group input-group-sm">
                                              <input
                                                type="number"
                                                className="form-control"
                                                value={autorizacion.porcentajeVendedor}
                                                onChange={(e) => actualizarVendedorAutorizado(index, 'porcentajeVendedor', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max={comisionBaseActual || 100}
                                                step="1"
                                              />
                                              <span className="input-group-text">%</span>
                                            </div>
                                          </td>
                                          <td className="text-center">
                                            <span className="badge bg-success fs-6">{porcentajeAgente}%</span>
                                          </td>
                                          <td>
                                            <select
                                              className="form-select form-select-sm"
                                              value={autorizacion.ejecutivoId || ''}
                                              onChange={(e) => actualizarVendedorAutorizado(index, 'ejecutivoId', e.target.value)}
                                            >
                                              <option value="">Sin ejecutivo</option>
                                              {usuarios.filter(u => u.perfil === 'Ejecutivo' && u.activo).map(u => (
                                                <option key={u.id} value={u.id}>
                                                  {u.codigo} - {u.nombre} {u.apellidoPaterno}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="text-center">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-danger"
                                              onClick={() => eliminarVendedorAutorizado(index)}
                                              title="Eliminar"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            
                            {vendedoresAutorizados.length > 0 && (
                              <div className="alert alert-success mt-3">
                                <strong>Nota:</strong> Estos porcentajes se aplicarán por defecto cuando estos vendedores capturen pólizas con tu clave. Podrás ajustarlo en cada póliza individual si es necesario.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Agentes con los que puede trabajar - Solo para Vendedores */}
                        {((formulario.esquemaCompensacion === 'comision' || formulario.esquemaCompensacion === 'mixto' || comisionesCompartidas.length > 0) && 
                         formulario.perfil === 'Vendedor') && (
                          <div className="col-12 mt-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">
                                <Percent size={20} className="me-2" />
                                Agentes con los que puedes trabajar
                              </h6>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={agregarComisionCompartida}
                              >
                                <Plus size={16} className="me-2" />
                                Agregar Agente
                              </button>
                            </div>

                            {comisionesCompartidas.length === 0 ? (
                              <div className="alert alert-info">
                                <AlertCircle size={20} className="me-2" />
                                No hay agentes configurados. Agrega los agentes con los que trabajarás y define tu porcentaje de comisión.
                              </div>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-bordered">
                                  <thead className="table-light">
                                    <tr>
                                      <th width="20%">Agente</th>
                                      <th width="15%">Aseguradora</th>
                                      <th width="15%">Clave</th>
                                      <th width="10%">Comisión Base</th>
                                      <th width="10%">Comisión Vendedor</th>
                                      <th width="20%">Ejecutivo</th>
                                      <th width="10%" className="text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {comisionesCompartidas.map((comision, index) => {
                                      const agente = usuarios.find(u => String(u.id) === String(comision.agenteId));
                                      
                                      // 🔥 CONSULTAR COMISIÓN BASE ACTUAL desde las claves del agente
                                      let comisionBaseActual = comision.comisionBase || 0;
                                      if (agente && agente.productosAseguradoras) {
                                        const claveAgente = agente.productosAseguradoras.find(pa => 
                                          String(pa.aseguradoraId) === String(comision.aseguradoraId) && 
                                          pa.clave === comision.clave
                                        );
                                        if (claveAgente) {
                                          const producto = tiposProductos.find(p => String(p.id) === String(claveAgente.productoId));
                                          comisionBaseActual = claveAgente.comisionPersonalizada || producto?.comisionBase || 0;
                                        }
                                      }

                                      return (
                                        <tr key={comision.id || index}>
                                          <td>
                                            <strong>{agente ? `${agente.codigo} - ${agente.nombre} ${agente.apellidoPaterno}` : 'N/A'}</strong>
                                          </td>
                                          <td>
                                            {(() => {
                                              const aseguradora = aseguradoras.find(a => String(a.id) === String(comision.aseguradoraId));
                                              return aseguradora ? (
                                                <span className={`badge bg-${aseguradora.nombre.toLowerCase() === 'qualitas' ? 'primary' : aseguradora.nombre.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                                  {aseguradora.nombre}
                                                </span>
                                              ) : 'N/A';
                                            })()}
                                          </td>
                                          <td>
                                            <code>{comision.clave || 'N/A'}</code>
                                          </td>
                                          <td>
                                            <span className="badge bg-secondary fs-6">{comisionBaseActual}%</span>
                                          </td>
                                          <td>
                                            <div className="input-group input-group-sm">
                                              <input
                                                type="number"
                                                className="form-control"
                                                value={comision.porcentajeVendedor}
                                                onChange={(e) => actualizarComisionCompartida(index, 'porcentajeVendedor', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max={comisionBaseActual || 100}
                                                step="5"
                                              />
                                              <span className="input-group-text">%</span>
                                            </div>
                                          </td>
                                          <td>
                                            <select
                                              className="form-select form-select-sm"
                                              value={comision.ejecutivoId || ''}
                                              onChange={(e) => actualizarComisionCompartida(index, 'ejecutivoId', e.target.value)}
                                            >
                                              <option value="">Sin ejecutivo</option>
                                              {usuarios.filter(u => u.perfil === 'Ejecutivo' && u.activo).map(u => (
                                                <option key={u.id} value={u.id}>
                                                  {u.codigo} - {u.nombre} {u.apellidoPaterno}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="text-center">
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-outline-danger"
                                              onClick={() => eliminarComisionCompartida(index)}
                                              title="Eliminar"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {comisionesCompartidas.length > 0 && (
                              <div className="alert alert-success mt-3">
                                <strong>Nota:</strong> Solo podrás capturar pólizas usando las claves autorizadas de estos agentes. El porcentaje de comisión se calculará automáticamente según lo configurado.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab Acceso al Sistema */}
                  {tabActiva === 'acceso' && (
                    <div className="tab-pane fade show active">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">Usuario *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={formulario.usuario}
                            onChange={(e) => setFormulario({...formulario, usuario: e.target.value})}
                            placeholder="Nombre de usuario único"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Contraseña *</label>
                          <input
                            type="password"
                            className="form-control"
                            value={formulario.contrasena}
                            onChange={(e) => setFormulario({...formulario, contrasena: e.target.value})}
                            placeholder="Mínimo 6 caracteres"
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Confirmar Contraseña</label>
                          <input
                            type="password"
                            className="form-control"
                            value={formulario.confirmarContrasena}
                            onChange={(e) => setFormulario({...formulario, confirmarContrasena: e.target.value})}
                            placeholder="Repetir contraseña"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setMostrarFormulario(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarUsuario}
                >
                  <Save size={18} className="me-2" />
                  {modoEdicion ? 'Actualizar' : 'Guardar'} Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aseguradoras y Productos */}
      <ModalSeleccionAseguradoraProductos
        show={mostrarModalAseguradoras}
        onClose={() => setMostrarModalAseguradoras(false)}
    onSave={handleGuardarProductosAseguradoras}
    productosAseguradoras={formulario.productosAseguradoras}
    aseguradoras={aseguradoras}
    tiposProductos={tiposProductos}
      />
      
      {/* Modal de Selección de Agente y Claves - Para Vendedores */}
      {mostrarModalAgenteClave && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Seleccionar Agente y Claves</h5>
                <button className="btn-close" onClick={() => setMostrarModalAgenteClave(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Seleccionar Agente</label>
                    <select
                      className="form-select"
                      value={agenteSeleccionadoTemp}
                      onChange={(e) => {
                        setAgenteSeleccionadoTemp(e.target.value);
                        setClavesSeleccionadasTemp([]);
                      }}
                    >
                      <option value="">Seleccionar agente...</option>
                      {usuarios.filter(u => u.perfil === 'Agente' && u.activo).map(agente => (
                        <option key={agente.id} value={agente.id}>
                          {agente.codigo} - {agente.nombre} {agente.apellidoPaterno}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {agenteSeleccionadoTemp && (() => {
                    const agenteObj = usuarios.find(u => String(u.id) === String(agenteSeleccionadoTemp));
                    const clavesAgente = agenteObj?.productosAseguradoras || [];
                    
                    return (
                    <div className="col-12 mt-3">
                      <h6>Claves disponibles del agente:</h6>
                      {clavesAgente.length === 0 ? (
                        <div className="alert alert-warning">
                          <AlertCircle size={16} className="me-2" />
                          Este agente no tiene claves registradas. Debe agregar claves en la pestaña "Claves y Aseguradoras" del agente.
                        </div>
                      ) : (
                        <>
                          {/* Lista de claves del agente - Datos reales de BD */}
                          <div className="list-group">
                            {clavesAgente.map((productoAseg, index) => {
                              const aseguradora = aseguradoras.find(a => String(a.id) === String(productoAseg.aseguradoraId));
                              const producto = tiposProductos.find(p => String(p.id) === String(productoAseg.productoId));
                              const clave = productoAseg.clave || 'Sin clave';
                              const comisionBase = productoAseg.comisionPersonalizada || producto?.comisionBase || 0;
                              
                              const claveData = {
                                id: productoAseg.id || index,
                                aseguradoraId: productoAseg.aseguradoraId,
                                aseguradora: aseguradora?.nombre || 'Sin aseguradora',
                                clave: clave,
                                comisionBase: comisionBase,
                                productoId: productoAseg.productoId
                              };
                              
                              // Verificar si esta clave ya está asignada al vendedor actual
                              const yaAsignada = comisionesCompartidas.some(c => 
                                String(c.agenteId) === String(agenteSeleccionadoTemp) &&
                                String(c.aseguradoraId) === String(claveData.aseguradoraId) && 
                                c.clave === claveData.clave
                              );
                              
                              // No mostrar claves ya asignadas
                              if (yaAsignada) return null;
                              
                              const isSelected = clavesSeleccionadasTemp.some(c => 
                                String(c.aseguradoraId) === String(claveData.aseguradoraId) && 
                                c.clave === claveData.clave
                              );
                              
                              return (
                                <div 
                                  key={`${productoAseg.aseguradoraId}-${clave}-${index}`}
                                  className={`list-group-item list-group-item-action ${isSelected ? 'active' : ''}`}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    if (isSelected) {
                                      setClavesSeleccionadasTemp(clavesSeleccionadasTemp.filter(c => 
                                        !(String(c.aseguradoraId) === String(claveData.aseguradoraId) && c.clave === claveData.clave)
                                      ));
                                    } else {
                                      setClavesSeleccionadasTemp([...clavesSeleccionadasTemp, claveData]);
                                    }
                                  }}
                                >
                                  <div className="d-flex w-100 justify-content-between align-items-center">
                                    <div>
                                      <input
                                        type="checkbox"
                                        className="form-check-input me-2"
                                        checked={isSelected}
                                        readOnly
                                      />
                                      <strong>{claveData.aseguradora}</strong> - <code>{clave}</code>
                                    </div>
                                    <span className="badge bg-primary">Comisión: {comisionBase}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {clavesAgente.every(productoAseg => {
                            const clave = productoAseg.clave || 'Sin clave';
                            return comisionesCompartidas.some(c => 
                              String(c.agenteId) === String(agenteSeleccionadoTemp) &&
                              String(c.aseguradoraId) === String(productoAseg.aseguradoraId) && 
                              c.clave === clave
                            );
                          }) && (
                            <div className="alert alert-info mt-3">
                              <AlertCircle size={16} className="me-2" />
                              Ya tienes acceso a todas las claves disponibles de este agente.
                            </div>
                          )}
                        </>
                      )}
                      
                      
                      {clavesSeleccionadasTemp.length > 0 && (
                        <div className="alert alert-success mt-3">
                          <strong>{clavesSeleccionadasTemp.length}</strong> clave(s) seleccionada(s)
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalAgenteClave(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarClavesSeleccionadas}
                  disabled={!agenteSeleccionadoTemp || clavesSeleccionadasTemp.length === 0}
                >
                  <Plus size={18} className="me-2" />
                  Agregar Seleccionadas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Agente: Seleccionar Vendedor y Claves */}
      {mostrarModalVendedor && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Autorizar Vendedor para usar tus Claves</h5>
                <button className="btn-close" onClick={() => setMostrarModalVendedor(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Seleccionar Vendedor</label>
                    <select
                      className="form-select"
                      value={vendedorSeleccionadoTemp}
                      onChange={(e) => {
                        setVendedorSeleccionadoTemp(e.target.value);
                        setClavesVendedorTemp([]);
                      }}
                    >
                      <option value="">Seleccionar vendedor...</option>
                      {usuarios.filter(u => u.perfil === 'Vendedor' && u.activo).map(vendedor => (
                        <option key={vendedor.id} value={vendedor.id}>
                          {vendedor.codigo} - {vendedor.nombre} {vendedor.apellidoPaterno}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {vendedorSeleccionadoTemp && formulario.productosAseguradoras && formulario.productosAseguradoras.length > 0 && (
                    <div className="col-12 mt-3">
                      <h6>Tus claves disponibles para autorizar:</h6>
                      <div className="list-group">
                        {formulario.productosAseguradoras.map((productoAseg, index) => {
                          const aseguradora = aseguradoras.find(a => String(a.id) === String(productoAseg.aseguradoraId));
                          const producto = tiposProductos.find(p => String(p.id) === String(productoAseg.productoId));
                          const clave = productoAseg.clave || 'Sin clave';
                          const comisionBase = productoAseg.comisionPersonalizada || producto?.comisionBase || 0;
                          
                          const claveData = {
                            id: productoAseg.id || index,
                            aseguradoraId: productoAseg.aseguradoraId,
                            aseguradora: aseguradora?.nombre || 'Sin aseguradora',
                            clave: clave,
                            comisionBase: comisionBase,
                            productoId: productoAseg.productoId
                          };
                          
                          // Verificar si esta clave ya está asignada al vendedor seleccionado
                          const yaAsignada = vendedoresAutorizados.some(v => 
                            String(v.vendedorId) === String(vendedorSeleccionadoTemp) &&
                            String(v.aseguradoraId) === String(claveData.aseguradoraId) && 
                            v.clave === claveData.clave
                          );
                          
                          const isSelected = clavesVendedorTemp.some(c => 
                            String(c.aseguradoraId) === String(claveData.aseguradoraId) && 
                            c.clave === claveData.clave
                          );
                          
                          // No mostrar claves ya asignadas
                          if (yaAsignada) return null;
                          
                          return (
                            <div key={index} className="list-group-item">
                              <div className="d-flex align-items-start gap-3">
                                <div className="form-check mt-1">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setClavesVendedorTemp([...clavesVendedorTemp, { 
                                          ...claveData,
                                          porcentajeVendedor: 50
                                        }]);
                                      } else {
                                        setClavesVendedorTemp(clavesVendedorTemp.filter(c => 
                                          !(String(c.aseguradoraId) === String(claveData.aseguradoraId) && c.clave === claveData.clave)
                                        ));
                                      }
                                    }}
                                  />
                                </div>
                                <div className="flex-grow-1">
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <span className={`badge bg-${aseguradora?.nombre.toLowerCase() === 'qualitas' ? 'primary' : aseguradora?.nombre.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                      {claveData.aseguradora}
                                    </span>
                                    <code className="bg-light px-2 py-1 rounded">{clave}</code>
                                    <span className="badge bg-secondary">{comisionBase}%</span>
                                  </div>
                                  <small className="text-muted">{producto?.nombre || 'Producto'}</small>
                                  
                                  {isSelected && (
                                    <div className="mt-2">
                                      <label className="form-label mb-1">Comisión para el vendedor:</label>
                                      <div className="input-group input-group-sm" style={{maxWidth: '200px'}}>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={clavesVendedorTemp.find(c => 
                                            String(c.aseguradoraId) === String(claveData.aseguradoraId) && c.clave === claveData.clave
                                          )?.porcentajeVendedor ?? 50}
                                          onChange={(e) => {
                                            const inputValue = e.target.value;
                                            let valor = inputValue === '' ? 0 : Number(inputValue);
                                            valor = Math.min(Math.max(valor, 0), comisionBase);
                                            setClavesVendedorTemp(clavesVendedorTemp.map(c => 
                                              (String(c.aseguradoraId) === String(claveData.aseguradoraId) && c.clave === claveData.clave)
                                                ? { ...c, porcentajeVendedor: valor }
                                                : c
                                            ));
                                          }}
                                          min="0"
                                          max={comisionBase}
                                          step="1"
                                        />
                                        <span className="input-group-text">%</span>
                                      </div>
                                      <small className="text-muted">
                                        Tú recibirás: {comisionBase - (clavesVendedorTemp.find(c => 
                                          String(c.aseguradoraId) === String(claveData.aseguradoraId) && c.clave === claveData.clave
                                        )?.porcentajeVendedor ?? 50)}%
                                      </small>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {vendedorSeleccionadoTemp && formulario.productosAseguradoras.every((productoAseg) => {
                        const clave = productoAseg.clave || 'Sin clave';
                        return vendedoresAutorizados.some(v => 
                          String(v.vendedorId) === String(vendedorSeleccionadoTemp) &&
                          String(v.aseguradoraId) === String(productoAseg.aseguradoraId) && 
                          v.clave === clave
                        );
                      }) && (
                        <div className="alert alert-info mt-3">
                          <AlertCircle size={16} className="me-2" />
                          Este vendedor ya tiene acceso a todas tus claves disponibles.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {vendedorSeleccionadoTemp && (!formulario.productosAseguradoras || formulario.productosAseguradoras.length === 0) && (
                    <div className="col-12 mt-3">
                      <div className="alert alert-warning">
                        <AlertCircle size={16} className="me-2" />
                        No tienes claves registradas. Debes agregar claves en la pestaña "Claves y Aseguradoras" antes de autorizar vendedores.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalVendedor(false);
                    setVendedorSeleccionadoTemp('');
                    setClavesVendedorTemp([]);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarVendedorAutorizado}
                  disabled={!vendedorSeleccionadoTemp || clavesVendedorTemp.length === 0}
                >
                  <Plus size={18} className="me-2" />
                  Agregar Seleccionadas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Detalles - Mostrar registros de ejecutivos_por_producto */}
      {mostrarDetalles && usuarioSeleccionado && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalle: {`${usuarioSeleccionado.nombre} ${usuarioSeleccionado.apellidoPaterno}`}</h5>
                <button className="btn-close" onClick={() => { setMostrarDetalles(false); setAsignacionesUsuario([]); }}></button>
              </div>
              <div className="modal-body">
                {cargandoAsignaciones ? (
                  <div className="text-center py-4">Cargando asignaciones...</div>
                ) : asignacionesUsuario.length === 0 ? (
                  <div className="alert alert-info">No hay asignaciones en la tabla <code>ejecutivos_por_producto</code> para este usuario.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                            <th>Producto ID</th>
                            <th>Aseguradora</th>
                            <th>Clave</th>
                            <th>Producto</th>
                            <th>Ejecutivo ID</th>
                            <th>Ejecutivo</th>
                            <th>Comisión</th>
                          </tr>
                      </thead>
                      <tbody>
                        {asignacionesUsuario.map((a, i) => {
                          const producto = tiposProductos.find(p => String(p.id) === String(a.productoId));
                          // Usar aseguradoraId directamente de la asignación
                          const aseguradora = aseguradoras.find(aseg => String(aseg.id) === String(a.aseguradoraId));
                          const ejecutivo = usuarios.find(u => String(u.id) === String(a.ejecutivoId));

                          return (
                            <tr key={i}>
                              <td>{a.productoId}</td>
                              <td>{aseguradora ? `${aseguradora.codigo} - ${aseguradora.nombre}` : '-'}</td>
                              <td>{a.clave || '-'}</td>
                              <td>{producto ? `${producto.codigo} - ${producto.nombre}` : a.productoId}</td>
                              <td>{a.ejecutivoId}</td>
                              <td>{ejecutivo ? `${ejecutivo.codigo} ${ejecutivo.nombre} ${ejecutivo.apellidoPaterno}` : a.ejecutivoId}</td>
                              <td>{a.comisionPersonalizada != null ? `${a.comisionPersonalizada}%` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => { setMostrarDetalles(false); setAsignacionesUsuario([]); }}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SistemaGestionPersonal;
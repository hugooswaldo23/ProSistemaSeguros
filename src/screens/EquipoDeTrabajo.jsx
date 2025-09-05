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

    const payload = { ...formulario };
    // No enviar campos auxiliares ni el mapping legacy de ejecutivosPorProducto
    delete payload.confirmarContrasena;
    delete payload.ejecutivosPorProducto;

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
          // intentar deducir aseguradoraId a partir de aseguradoras.productos_disponibles
          let aseguradoraId = null;
          for (const as of aseguradoras) {
            const lista = as.productos_disponibles || [];
            const ids = lista.map(it => (typeof it === 'object' ? (it.producto_id || it.productoId || it.id) : it));
            if (ids.map(String).includes(String(a.productoId))) { aseguradoraId = as.id; break; }
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
                    <th className="py-3">Estado</th>
                    <th className="py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">Cargando...</td>
                    </tr>
                  ) : usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">
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
                    usuariosFiltrados.map(u => (
                      <tr key={u.id}>
                        <td className="align-middle">{u.codigo}</td>
                        <td className="align-middle">{`${u.nombre} ${u.apellidoPaterno} ${u.apellidoMaterno}`}</td>
                        <td className="align-middle">{u.perfil}</td>
                        <td className="align-middle">{u.usuario}</td>
                        <td className="align-middle">{u.email || u.telefono || '-'}</td>
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
                    ))
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
                      className={`nav-link ${tabActiva === 'perfil' ? 'active' : ''}`}
                      onClick={() => setTabActiva('perfil')}
                      type="button"
                    >
                      <Shield size={18} className="me-2" />
                      Perfil y Asignaciones
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'compensacion' ? 'active' : ''}`}
                      onClick={() => setTabActiva('compensacion')}
                      type="button"
                    >
                      <DollarSign size={18} className="me-2" />
                      Compensación
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

                  {/* Tab Perfil y Asignaciones */}
                  {tabActiva === 'perfil' && (
                    <div className="tab-pane fade show active">
                      <div className="row g-3">
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
                        
                        {/* Si es Agente o Vendedor */}
                        {(formulario.perfil === 'Agente' || formulario.perfil === 'Vendedor') && (
                          <div className="col-12">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">
                                <Package size={20} className="me-2" />
                                Productos y Aseguradoras
                              </h6>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setMostrarModalAseguradoras(true)}
                              >
                                <Plus size={16} className="me-2" />
                                Agregar Aseguradora y Productos
                              </button>
                            </div>
                            
                            {formulario.productosAseguradoras.length === 0 ? (
                              <div className="alert alert-warning">
                                <AlertCircle size={20} className="me-2" />
                                No hay productos asignados. Haga clic en "Agregar Aseguradora y Productos" para comenzar.
                              </div>
                            ) : (
                              <>
                                <AsignarEjecutivoPorProductoAseguradora
                                  productosAseguradoras={formulario.productosAseguradoras}
                                  ejecutivosDisponibles={ejecutivosDisponibles}
                                  onChange={handleProductosAseguradorasChange}
                                  onComisionChange={handleComisionChange}
                                  usuarioId={formulario.id}
                                  onAsignarEjecutivo={async ({ usuarioId, productoId, ejecutivoId, comisionPersonalizada = 0, clave = null }) => {
                                    const res = await guardarEjecutivosPorProducto({ usuarioId, productoId, ejecutivoId, comisionPersonalizada, clave });
                                    if (res && res.success) mostrarAlertaTemp('Asignación guardada', 'success');
                                    else mostrarAlertaTemp('Error al guardar asignación', 'danger');
                                  }}
                                  aseguradoras={aseguradoras}
                                  tiposProductos={tiposProductos}
                                />
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => setFormulario({ ...formulario, productosAseguradoras: [] })}
                                  >
                                    <Trash2 size={16} className="me-2" />
                                    Limpiar todo
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab Compensación */}
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

                        {/* Tabla Informativa de Comisiones - Solo lectura */}
                        {(formulario.esquemaCompensacion === 'comision' || formulario.esquemaCompensacion === 'mixto') && (
                          <>
                            <div className="col-12 mt-4">
                              <h6 className="mb-3">
                                <Percent size={20} className="me-2" />
                                Resumen de Comisiones Configuradas
                              </h6>
                              {formulario.productosAseguradoras.length === 0 ? (
                                <div className="alert alert-warning">
                                  <AlertCircle size={20} className="me-2" />
                                  No hay productos asignados. Configure los productos y sus comisiones en la pestaña "Perfil y Asignaciones".
                                </div>
                              ) : (
                                <div className="table-responsive">
                                  <table className="table table-bordered table-striped">
                                    <thead className="table-light">
                                      <tr>
                                        <th>Aseguradora</th>
                                        <th>Producto</th>
                                        <th className="text-center">Comisión Configurada</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {formulario.productosAseguradoras.map((item, index) => {
                                        const aseguradora = aseguradoras.find(a => a.id === item.aseguradoraId);
                                        const producto = tiposProductos.find(p => p.id === item.productoId);
                                        const comision = item.comisionPersonalizada || producto?.comisionBase || 0;
                                        
                                        return (
                                          <tr key={index}>
                                            <td>
                                              <Building2 size={16} className="me-2 text-primary" />
                                              <span className="badge bg-info me-2">{aseguradora?.codigo}</span>
                                              {aseguradora?.nombre}
                                            </td>
                                            <td>
                                              <Package size={16} className="me-2 text-success" />
                                              {producto?.nombre}
                                            </td>
                                            <td className="text-center">
                                              <span className="badge bg-primary fs-6">{comision}%</span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                  <div className="alert alert-info mt-2">
                                    <small>
                                      <strong>Nota:</strong> Las comisiones se configuran en la pestaña "Perfil y Asignaciones". 
                                      El agente recibirá el porcentaje completo configurado para cada producto.
                                    </small>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
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
                          // intentar resolver aseguradora a partir de aseguradoras.productos_disponibles
                          let aseguradora = null;
                          for (const as of aseguradoras) {
                            const lista = as.productos_disponibles || [];
                            const ids = lista.map(it => (typeof it === 'object' ? (it.producto_id || it.productoId || it.id) : it));
                            if (ids.map(String).includes(String(a.productoId))) { aseguradora = as; break; }
                          }

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
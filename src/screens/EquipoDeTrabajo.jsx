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
  TrendingUp, Wallet, ToggleLeft, ToggleRight
} from 'lucide-react';

// useEquipoDeTrabajo provisto por ../hooks/useEquipoDeTrabajo

// Las listas de aseguradoras y tipos de producto se cargan desde el backend

// Helper: obtener comisión que la aseguradora paga por un producto específico
const obtenerComisionAseguradora = (aseguradoraId, productoId, aseguradoras = []) => {
  const aseguradora = aseguradoras.find(a => String(a.id) === String(aseguradoraId));
  if (!aseguradora?.productos_disponibles) return 0;
  const prod = aseguradora.productos_disponibles.find(
    p => String(typeof p === 'object' ? p.producto_id : p) === String(productoId)
  );
  return prod && typeof prod === 'object' ? parseFloat(prod.comision) || 0 : 0;
};

// Componente para mostrar tabla de comisiones
const TablaComisionesProductos = ({ productosAseguradoras, porcentajeCompartido = 0, aseguradoras = [], tiposProductos = [] }) => {
  // Filtrar solo entradas con productoId definido (las auto-detectadas de pólizas)
  const conProducto = (productosAseguradoras || []).filter(item => item.productoId);
  
  if (conProducto.length === 0) {
    return (
      <div className="alert alert-info">
        <AlertCircle size={20} className="me-2" />
        No hay productos asignados aún. Los productos se agregarán automáticamente al capturar pólizas.
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
          {conProducto.map((item, index) => {
            const aseguradora = aseguradoras.find(a => String(a.id) === String(item.aseguradoraId));
            const producto = tiposProductos.find(p => String(p.id) === String(item.productoId));
            const comisionDeAseguradora = obtenerComisionAseguradora(item.aseguradoraId, item.productoId, aseguradoras);
            const comisionBase = item.comisionPersonalizada || comisionDeAseguradora || 0;
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

// Componente para asignar producto-aseguradora con comisiones
const AsignarEjecutivoPorProductoAseguradora = ({ productosAseguradoras, ejecutivosDisponibles, onChange, onComisionChange, usuarioId, onAsignarEjecutivo, aseguradoras = [], tiposProductos = [] }) => {
  const conProducto = (productosAseguradoras || []).filter(item => item.productoId);
  
  if (conProducto.length === 0) {
    return <span className="text-muted">No hay productos asignados aún. Se agregarán al capturar pólizas.</span>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered align-middle">
        <thead className="table-light">
          <tr>
            <th width="25%">Aseguradora</th>
            <th width="15%">Clave</th>
            <th width="25%">Producto</th>
            <th width="15%">Comisión Base</th>
            <th width="20%">Comisión Personalizada</th>
          </tr>
        </thead>
        <tbody>
          {conProducto.map((item, index) => {
            const aseguradora = aseguradoras.find(a => String(a.id) === String(item.aseguradoraId));
            const producto = tiposProductos.find(p => String(p.id) === String(item.productoId));
            const comisionDeAseguradora = obtenerComisionAseguradora(item.aseguradoraId, item.productoId, aseguradoras);
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
                    <span className="badge bg-secondary">{comisionDeAseguradora}%</span>
                  </td>
                  <td>
                    <div className="input-group input-group-sm">
                      <input
                        type="number"
                        className="form-control"
                        value={item.comisionPersonalizada || comisionDeAseguradora || 0}
                        onChange={e => onComisionChange(index, parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.5"
                      />
                      <span className="input-group-text">%</span>
                    </div>
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
  const [claveInput, setClaveInput] = useState('');
  const [clavesTemporales, setClavesTemporales] = useState([]);

  const handleAgregarClave = () => {
    if (!aseguradoraSeleccionada) {
      alert('Seleccione una aseguradora');
      return;
    }
    if (!claveInput.trim()) {
      alert('Ingrese la clave del agente');
      return;
    }

    // Verificar duplicado: misma aseguradora ya en temporales o guardados
    const yaExisteTemp = clavesTemporales.some(
      p => String(p.aseguradoraId) === String(aseguradoraSeleccionada)
    );
    const yaExisteGuardado = (productosAseguradoras || []).some(
      p => String(p.aseguradoraId) === String(aseguradoraSeleccionada)
    );
    if (yaExisteTemp || yaExisteGuardado) {
      alert('Ya existe una clave para esta aseguradora');
      return;
    }

    setClavesTemporales([...clavesTemporales, {
      aseguradoraId: aseguradoraSeleccionada,
      productoId: null,
      ejecutivoId: null,
      comisionPersonalizada: 0,
      clave: claveInput.trim()
    }]);
    setClaveInput('');
    setAseguradoraSeleccionada(null);
  };

  const handleEliminarClave = (index) => {
    setClavesTemporales(clavesTemporales.filter((_, i) => i !== index));
  };

  const handleGuardar = () => {
    onSave(clavesTemporales);
    setClavesTemporales([]);
    setAseguradoraSeleccionada(null);
    setClaveInput('');
  };

  if (!show) return null;

  // Aseguradoras que ya tienen clave (guardadas o temporales)
  const aseguradorasConClave = new Set([
    ...(productosAseguradoras || []).map(p => String(p.aseguradoraId)),
    ...clavesTemporales.map(p => String(p.aseguradoraId))
  ]);

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <Building2 size={24} className="me-2" />
              Agregar Clave por Aseguradora
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info mb-3">
              <AlertCircle size={16} className="me-2" />
              Selecciona la aseguradora e ingresa la clave del agente. Los productos se agregarán automáticamente al capturar pólizas.
            </div>
            <div className="row">
              {/* Panel izquierdo - Selección */}
              <div className="col-md-7">
                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">Aseguradora y Clave</h6>
                  </div>
                  <div className="card-body">
                    {/* Seleccionar Aseguradora */}
                    <label className="form-label fw-semibold mb-2">Aseguradora</label>
                    <div className="row g-2 mb-3">
                      {aseguradoras.map(aseguradora => {
                        const yaRegistrada = aseguradorasConClave.has(String(aseguradora.id));
                        return (
                          <div key={aseguradora.id} className="col-md-4">
                            <div 
                              className={`card border-2 ${yaRegistrada ? 'opacity-50' : 'cursor-pointer'} ${aseguradoraSeleccionada === aseguradora.id ? 'border-primary bg-primary bg-opacity-10' : 'border-light'}`}
                              style={{ cursor: yaRegistrada ? 'not-allowed' : 'pointer' }}
                              onClick={() => !yaRegistrada && setAseguradoraSeleccionada(aseguradora.id)}
                            >
                              <div className="card-body p-2 text-center">
                                <input
                                  type="radio"
                                  className="form-check-input me-2"
                                  checked={aseguradoraSeleccionada === aseguradora.id}
                                  onChange={() => !yaRegistrada && setAseguradoraSeleccionada(aseguradora.id)}
                                  disabled={yaRegistrada}
                                />
                                <div>
                                  <small className="fw-bold">{aseguradora.nombre}</small>
                                  {yaRegistrada && <div><span className="badge bg-warning mt-1">Ya registrada</span></div>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Clave del agente */}
                    <label className="form-label fw-semibold">Clave del Agente</label>
                    <div className="input-group mb-3">
                      <span className="input-group-text"><Hash size={16} /></span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: 12345, AG-001"
                        value={claveInput}
                        onChange={(e) => setClaveInput(e.target.value)}
                        disabled={!aseguradoraSeleccionada}
                        onKeyDown={(e) => e.key === 'Enter' && handleAgregarClave()}
                      />
                    </div>

                    <button 
                      className="btn btn-primary w-100"
                      onClick={handleAgregarClave}
                      disabled={!aseguradoraSeleccionada || !claveInput.trim()}
                    >
                      <Plus size={20} className="me-2" />
                      Agregar Clave
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel derecho - Lista de claves agregadas */}
              <div className="col-md-5">
                <div className="card">
                  <div className="card-header bg-info text-white">
                    <h6 className="mb-0">Claves Agregadas ({clavesTemporales.length})</h6>
                  </div>
                  <div className="card-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {clavesTemporales.length === 0 ? (
                      <div className="text-center text-muted py-4">
                        <Hash size={48} className="mb-2 opacity-50" />
                        <p>No hay claves agregadas</p>
                      </div>
                    ) : (
                      <div className="list-group">
                        {clavesTemporales.map((item, index) => {
                          const aseguradora = aseguradoras.find(a => a.id === item.aseguradoraId);
                          return (
                            <div key={index} className="list-group-item">
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <div className="fw-bold text-primary">
                                    <Building2 size={14} className="me-1" />
                                    {aseguradora?.nombre}
                                  </div>
                                  <div className="text-dark">
                                    <Hash size={14} className="me-1" />
                                    Clave: <strong>{item.clave}</strong>
                                  </div>
                                </div>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleEliminarClave(index)}
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
              disabled={clavesTemporales.length === 0}
            >
              <Save size={20} className="me-2" />
              Guardar ({clavesTemporales.length} {clavesTemporales.length === 1 ? 'clave' : 'claves'})
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
  
  // Estado para modal de selección de agente (para vendedores)
  const [mostrarModalAgenteClave, setMostrarModalAgenteClave] = useState(false);
  const [agenteSeleccionadoTemp, setAgenteSeleccionadoTemp] = useState('');
  const [porcentajeAgenteTemp, setPorcentajeAgenteTemp] = useState(50);
  
  // Estado para vendedores autorizados (para agentes)
  const [vendedoresAutorizados, setVendedoresAutorizados] = useState([]);
  const [mostrarModalVendedor, setMostrarModalVendedor] = useState(false);
  const [vendedorSeleccionadoTemp, setVendedorSeleccionadoTemp] = useState('');
  const [porcentajeVendedorTemp, setPorcentajeVendedorTemp] = useState(50);
  const [productosSeleccionadosTemp, setProductosSeleccionadosTemp] = useState([]);

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
    // Para vendedores, abrir modal para seleccionar agente
    setAgenteSeleccionadoTemp('');
    setPorcentajeAgenteTemp(50);
    setMostrarModalAgenteClave(true);
  };
  
  // Función para guardar agente seleccionado del modal
  const guardarClavesSeleccionadas = () => {
    if (!agenteSeleccionadoTemp) {
      mostrarAlertaTemp('Selecciona un agente', 'warning');
      return;
    }

    // Verificar si ya está agregado
    const yaExiste = comisionesCompartidas.some(c => String(c.agenteId) === String(agenteSeleccionadoTemp));
    if (yaExiste) {
      mostrarAlertaTemp('Este agente ya está asignado', 'warning');
      return;
    }

    const nuevaComision = {
      id: Date.now() + Math.random(),
      agenteId: agenteSeleccionadoTemp,
      vendedorId: formulario.id,
      porcentajeVendedor: porcentajeAgenteTemp || 50,
      ejecutivoId: '',
      activo: true
    };
    
    setComisionesCompartidas([...comisionesCompartidas, nuevaComision]);
    setMostrarModalAgenteClave(false);
    setAgenteSeleccionadoTemp('');
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
    setPorcentajeVendedorTemp(50);
    setProductosSeleccionadosTemp([]);
    setMostrarModalVendedor(true);
  };

  const guardarVendedorAutorizado = () => {
    if (!vendedorSeleccionadoTemp) {
      mostrarAlertaTemp('Selecciona un vendedor', 'warning');
      return;
    }

    // Generar una fila por cada producto/aseguradora del agente (solo los que no estén ya asignados)
    const productosAgente = formulario.productosAseguradoras || [];
    if (productosAgente.length === 0) {
      mostrarAlertaTemp('Primero agrega claves y aseguradoras al agente', 'warning');
      return;
    }

    if (productosSeleccionadosTemp.length === 0) {
      mostrarAlertaTemp('Selecciona al menos un producto para asignar', 'warning');
      return;
    }

    const nuevasAutorizaciones = productosSeleccionadosTemp.map(key => {
      const [aseguradoraId, productoId] = key.split('|');
      const tieneProducto = productoId && productoId !== 'null' && productoId !== 'undefined';
      // Buscar la clave del agente para esta aseguradora
      const prodAseg = (formulario.productosAseguradoras || []).find(
        pa => String(pa.aseguradoraId) === String(aseguradoraId) && (!tieneProducto || String(pa.productoId) === String(productoId))
      );
      const comisionBase = tieneProducto ? obtenerComisionAseguradora(aseguradoraId, productoId, aseguradoras) : 0;
      return {
        id: Date.now() + Math.random(),
        vendedorId: vendedorSeleccionadoTemp,
        agenteId: String(formulario.id),
        aseguradoraId,
        productoId,
        clave: prodAseg?.clave || '',
        comisionBase: comisionBase || 0,
        porcentajeVendedor: porcentajeVendedorTemp || 50,
        ejecutivoId: '',
        activo: true
      };
    });

    setVendedoresAutorizados([...vendedoresAutorizados, ...nuevasAutorizaciones]);
    setMostrarModalVendedor(false);
    setVendedorSeleccionadoTemp('');
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
    // Solo considerar entradas con productoId (auto-detectadas de pólizas)
    formulario.productosAseguradoras.filter(item => item.productoId).forEach(item => {
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
    
    // Usuario obligatorio solo al crear; al editar es opcional (ya tiene uno en BD)
    if (!modoEdicion && !formulario.usuario) {
      mostrarAlertaTemp('Por favor ingrese un nombre de usuario', 'error');
      return;
    }

    // Contraseña obligatoria solo al crear
    if (!modoEdicion && !formulario.contrasena) {
      mostrarAlertaTemp('Por favor ingrese una contraseña', 'error');
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
    // Al editar, no enviar contraseña vacía (para no sobreescribir la existente)
    if (modoEdicion && !payload.contrasena) {
      delete payload.contrasena;
    }

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
    
    setComisionesCompartidas(comisiones);

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
          
          // Normalizar campos del backend
          comisionesDeEsteAgente.forEach(c => {
            vendedores.push({
              ...c,
              vendedorId: u.id,
              aseguradoraId: String(c.aseguradoraId || c.aseguradora_id || ''),
              productoId: String(c.productoId || c.producto_id || ''),
              porcentajeVendedor: c.porcentajeVendedor || 50,
              activo: c.activo !== undefined ? c.activo : true
            });
          });
        }
      });
    }
    // Deduplicar: si hay entradas CON productoId, descartar las sin productoId para el mismo vendedor+aseguradora
    const conProducto = vendedores.filter(v => v.productoId && v.productoId !== '' && v.productoId !== 'undefined');
    const sinProducto = vendedores.filter(v => !v.productoId || v.productoId === '' || v.productoId === 'undefined');
    
    // Solo mantener entradas sin productoId si no hay ninguna con productoId para esa combinación
    const vendedoresLimpios = [...conProducto];
    sinProducto.forEach(v => {
      const tieneConProducto = conProducto.some(
        cp => String(cp.vendedorId) === String(v.vendedorId) && String(cp.aseguradoraId) === String(v.aseguradoraId)
      );
      if (!tieneConProducto) {
        vendedoresLimpios.push(v);
      }
    });
    
    // Deduplicar por key única
    const vistos = new Set();
    const vendedoresUnicos = [];
    vendedoresLimpios.forEach(v => {
      const key = `${v.vendedorId}|${v.aseguradoraId}|${v.productoId}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        vendedoresUnicos.push(v);
      }
    });
    setVendedoresAutorizados(vendedoresUnicos);

    console.log('Vendedores autorizados cargados (dedup):', vendedoresUnicos);
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

  // Confirmar y desactivar usuario (soft-delete para no romper relaciones)
  const confirmarEliminar = async (id) => {
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;
    const accion = usuario.activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿${accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} este usuario?`)) return;
    const res = await actualizar(id, { ...usuario, activo: !usuario.activo });
    if (res && res.success) mostrarAlertaTemp(`Usuario ${accion === 'desactivar' ? 'desactivado' : 'reactivado'}`, 'success');
    else mostrarAlertaTemp(`Error al ${accion} usuario`, 'danger');
  };

  // Eliminar usuario permanentemente (o desactivar si el backend no soporta DELETE)
  const confirmarEliminarDefinitivo = async (id) => {
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;
    if (!window.confirm(`¿Eliminar PERMANENTEMENTE a ${usuario.nombre} ${usuario.apellidoPaterno}? Esta acción no se puede deshacer.`)) return;
    const res = await eliminar(id);
    if (res && res.success) {
      mostrarAlertaTemp('Usuario eliminado permanentemente', 'success');
    } else {
      // Fallback: si DELETE no existe en el backend (404), desactivar en su lugar
      console.warn('DELETE no disponible, desactivando usuario como fallback');
      const resFallback = await actualizar(id, { ...usuario, activo: false });
      if (resFallback && resFallback.success) {
        mostrarAlertaTemp('El usuario fue desactivado (el servidor no permite eliminación permanente)', 'warning');
      } else {
        mostrarAlertaTemp(res?.error || 'Error al eliminar usuario. Puede tener registros asociados (nóminas, comisiones). Desactívelo en su lugar.', 'danger');
      }
    }
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
                            <button className={`btn btn-sm ${u.activo ? 'btn-outline-warning' : 'btn-outline-success'}`} onClick={() => confirmarEliminar(u.id)} title={u.activo ? 'Desactivar' : 'Reactivar'}>
                              {u.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => confirmarEliminarDefinitivo(u.id)} title="Eliminar permanentemente">
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
                            ) : (() => {
                              // Agrupar por aseguradoraId para mostrar una fila por aseguradora
                              const porAseguradora = {};
                              formulario.productosAseguradoras.forEach((item, index) => {
                                const key = String(item.aseguradoraId);
                                if (!porAseguradora[key]) {
                                  porAseguradora[key] = { clave: item.clave || '', indices: [index], productos: [] };
                                } else {
                                  porAseguradora[key].indices.push(index);
                                  if (!porAseguradora[key].clave && item.clave) porAseguradora[key].clave = item.clave;
                                }
                                if (item.productoId) {
                                  const prod = tiposProductos.find(p => String(p.id) === String(item.productoId));
                                  if (prod) porAseguradora[key].productos.push(prod.nombre);
                                }
                              });

                              return (
                                <div className="table-responsive">
                                  <table className="table table-bordered">
                                    <thead className="table-light">
                                      <tr>
                                        <th width="30%">Aseguradora</th>
                                        <th width="30%">Clave</th>
                                        <th width="30%">Productos</th>
                                        <th width="10%" className="text-center">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Object.entries(porAseguradora).map(([asegId, grupo]) => {
                                        const aseguradora = aseguradoras.find(a => String(a.id) === asegId);
                                        const primerIndex = grupo.indices[0];
                                        return (
                                          <tr key={asegId}>
                                            <td>
                                              <span className={`badge bg-${aseguradora?.nombre?.toLowerCase() === 'qualitas' ? 'primary' : aseguradora?.nombre?.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                                {aseguradora?.nombre || 'N/A'}
                                              </span>
                                            </td>
                                            <td>
                                              <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={grupo.clave}
                                                onChange={(e) => {
                                                  const nuevosProductos = [...formulario.productosAseguradoras];
                                                  // Actualizar clave en TODAS las entradas de esta aseguradora
                                                  grupo.indices.forEach(idx => {
                                                    nuevosProductos[idx].clave = e.target.value;
                                                  });
                                                  setFormulario({...formulario, productosAseguradoras: nuevosProductos});
                                                }}
                                                placeholder="Clave del agente"
                                              />
                                            </td>
                                            <td>
                                              {grupo.productos.length > 0 ? (
                                                <div className="d-flex flex-wrap gap-1">
                                                  {grupo.productos.map((nombre, i) => (
                                                    <span key={i} className="badge bg-success bg-opacity-75">{nombre}</span>
                                                  ))}
                                                </div>
                                              ) : (
                                                <small className="text-muted fst-italic">Se agregarán al capturar pólizas</small>
                                              )}
                                            </td>
                                            <td className="text-center">
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                title="Eliminar clave"
                                                onClick={() => {
                                                  const nuevosProductos = formulario.productosAseguradoras.filter(
                                                    (_, idx) => !grupo.indices.includes(idx)
                                                  );
                                                  setFormulario({...formulario, productosAseguradoras: nuevosProductos});
                                                }}
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
                              );
                            })()}
                          </div>
                        )}

                        {/* Vendedores Autorizados - Solo para Agentes */}
                        {formulario.perfil === 'Agente' && (
                          <div className="col-12 mt-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">
                                <Percent size={20} className="me-2" />
                                Vendedores autorizados
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
                                No hay vendedores configurados. Agrega los vendedores autorizados para vender bajo tu nombre.
                              </div>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-bordered">
                                  <thead className="table-light">
                                    <tr>
                                      <th width="18%">Vendedor</th>
                                      <th width="13%">Aseguradora</th>
                                      <th width="10%">Clave</th>
                                      <th width="13%">Producto</th>
                                      <th width="16%">Comisión Vendedor</th>
                                      <th width="16%">Ejecutivo</th>
                                      <th width="7%" className="text-center">Estado</th>
                                      <th width="7%" className="text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {vendedoresAutorizados.map((autorizacion, index) => {
                                      const vendedor = usuarios.find(u => String(u.id) === String(autorizacion.vendedorId));
                                      const aseguradora = aseguradoras.find(a => String(a.id) === String(autorizacion.aseguradoraId));
                                      const tieneProductoId = autorizacion.productoId && autorizacion.productoId !== '' && autorizacion.productoId !== 'undefined';
                                      const producto = tieneProductoId ? tiposProductos.find(p => String(p.id) === String(autorizacion.productoId)) : null;
                                      const comisionDeAseguradora = tieneProductoId ? obtenerComisionAseguradora(autorizacion.aseguradoraId, autorizacion.productoId, aseguradoras) : 0;
                                      // Buscar la clave del agente para esta aseguradora/producto
                                      const claveAgente = (formulario.productosAseguradoras || []).find(
                                        pa => String(pa.aseguradoraId) === String(autorizacion.aseguradoraId) && (!tieneProductoId || String(pa.productoId) === String(autorizacion.productoId))
                                      );
                                      
                                      return (
                                        <tr key={index}>
                                          <td>
                                            <strong>{vendedor ? `${vendedor.codigo} - ${vendedor.nombre} ${vendedor.apellidoPaterno}` : 'N/A'}</strong>
                                          </td>
                                          <td>
                                            <span className={`badge bg-${aseguradora?.nombre?.toLowerCase() === 'qualitas' ? 'primary' : aseguradora?.nombre?.toLowerCase() === 'hdi' ? 'danger' : 'info'}`}>
                                              {aseguradora?.nombre || 'N/A'}
                                            </span>
                                          </td>
                                          <td>
                                            <small className="fw-semibold">{claveAgente?.clave || '-'}</small>
                                          </td>
                                          <td>
                                            <small>{producto?.nombre || (tieneProductoId ? 'N/A' : 'Todos los productos')}</small>
                                            {tieneProductoId && <div><small className="text-muted">Base: {comisionDeAseguradora}%</small></div>}
                                          </td>
                                          <td>
                                            <div className="input-group input-group-sm">
                                              <input
                                                type="number"
                                                className="form-control"
                                                value={autorizacion.porcentajeVendedor}
                                                onChange={(e) => actualizarVendedorAutorizado(index, 'porcentajeVendedor', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max="100"
                                                step="1"
                                              />
                                              <span className="input-group-text">%</span>
                                            </div>
                                            <small className="text-muted">% de la comisión base</small>
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
                                            <span className={`badge bg-${autorizacion.activo !== false ? 'success' : 'secondary'}`}>
                                              {autorizacion.activo !== false ? 'Activo' : 'Inactivo'}
                                            </span>
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
                                      <th width="30%">Agente</th>
                                      <th width="20%">Comisión Vendedor</th>
                                      <th width="25%">Ejecutivo</th>
                                      <th width="10%">Estado</th>
                                      <th width="15%" className="text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {comisionesCompartidas.map((comision, index) => {
                                      const agente = usuarios.find(u => String(u.id) === String(comision.agenteId));

                                      return (
                                        <tr key={comision.id || index}>
                                          <td>
                                            <strong>{agente ? `${agente.codigo} - ${agente.nombre} ${agente.apellidoPaterno}` : 'N/A'}</strong>
                                          </td>
                                          <td>
                                            <div className="input-group input-group-sm">
                                              <input
                                                type="number"
                                                className="form-control"
                                                value={comision.porcentajeVendedor}
                                                onChange={(e) => actualizarComisionCompartida(index, 'porcentajeVendedor', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max="100"
                                                step="1"
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
                                          <td>
                                            <span className={`badge bg-${comision.activo ? 'success' : 'secondary'}`}>
                                              {comision.activo ? 'Activo' : 'Inactivo'}
                                            </span>
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
                                <strong>Nota:</strong> El vendedor podrá vender con cualquier clave de los agentes asignados. El porcentaje de comisión se calculará automáticamente.
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
                            autoComplete="off"
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
                            autoComplete="new-password"
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
                            autoComplete="new-password"
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
      
      {/* Modal de Selección de Agente - Para Vendedores */}
      {mostrarModalAgenteClave && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Agregar Agente</h5>
                <button className="btn-close" onClick={() => setMostrarModalAgenteClave(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Seleccionar Agente</label>
                    <select
                      className="form-select"
                      value={agenteSeleccionadoTemp}
                      onChange={(e) => setAgenteSeleccionadoTemp(e.target.value)}
                    >
                      <option value="">Seleccionar agente...</option>
                      {usuarios.filter(u => u.perfil === 'Agente' && u.activo && !comisionesCompartidas.some(c => String(c.agenteId) === String(u.id))).map(agente => (
                        <option key={agente.id} value={agente.id}>
                          {agente.codigo} - {agente.nombre} {agente.apellidoPaterno}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {agenteSeleccionadoTemp && (
                    <div className="col-12 mt-3">
                      <label className="form-label fw-semibold">Porcentaje de comisión para el vendedor</label>
                      <div className="input-group" style={{ maxWidth: '200px' }}>
                        <input
                          type="number"
                          className="form-control"
                          value={porcentajeAgenteTemp}
                          onChange={(e) => setPorcentajeAgenteTemp(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))}
                          min="0"
                          max="100"
                          step="1"
                        />
                        <span className="input-group-text">%</span>
                      </div>
                      <small className="text-muted d-block mt-1">
                        El vendedor recibirá este porcentaje de la comisión base de cada póliza que venda bajo este agente.
                        Podrá usar cualquier clave del agente.
                      </small>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalAgenteClave(false);
                    setAgenteSeleccionadoTemp('');
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarClavesSeleccionadas}
                  disabled={!agenteSeleccionadoTemp}
                >
                  <Plus size={18} className="me-2" />
                  Agregar Agente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Agente: Seleccionar Vendedor */}
      {mostrarModalVendedor && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Agregar Vendedor Autorizado</h5>
                <button className="btn-close" onClick={() => setMostrarModalVendedor(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Seleccionar Vendedor</label>
                    <select
                      className="form-select"
                      value={vendedorSeleccionadoTemp}
                      onChange={(e) => {
                        const nuevoVendedorId = e.target.value;
                        setVendedorSeleccionadoTemp(nuevoVendedorId);
                        // Auto-seleccionar productos disponibles (no ya asignados)
                        if (nuevoVendedorId) {
                          const disponibles = (formulario.productosAseguradoras || [])
                            .filter(prod => !vendedoresAutorizados.some(v => 
                              String(v.vendedorId) === String(nuevoVendedorId) && 
                              String(v.aseguradoraId) === String(prod.aseguradoraId) && 
                              (String(v.productoId) === String(prod.productoId) || !v.productoId || v.productoId === '' || v.productoId === 'undefined')
                            ))
                            .map(prod => `${prod.aseguradoraId}|${prod.productoId}`);
                          setProductosSeleccionadosTemp(disponibles);
                        } else {
                          setProductosSeleccionadosTemp([]);
                        }
                      }}
                    >
                      <option value="">Seleccionar vendedor...</option>
                      {usuarios.filter(u => u.perfil === 'Vendedor' && u.activo).map(vendedor => {
                        // Verificar si ya tiene TODOS los productos asignados
                        const productosAgente = formulario.productosAseguradoras || [];
                        const productosYaAsignados = vendedoresAutorizados.filter(v => String(v.vendedorId) === String(vendedor.id));
                        const todosAsignados = productosAgente.length > 0 && productosAgente.every(pa => 
                          productosYaAsignados.some(v => String(v.aseguradoraId) === String(pa.aseguradoraId) && (String(v.productoId) === String(pa.productoId) || !v.productoId || v.productoId === '' || v.productoId === 'undefined'))
                        );
                        return (
                          <option key={vendedor.id} value={vendedor.id} disabled={todosAsignados}>
                            {vendedor.codigo} - {vendedor.nombre} {vendedor.apellidoPaterno} {todosAsignados ? '(todos los productos asignados)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  {vendedorSeleccionadoTemp && (
                    <>
                      <div className="col-12 mt-3">
                        <label className="form-label fw-semibold">Porcentaje de comisión inicial para el vendedor</label>
                        <div className="input-group" style={{ maxWidth: '200px' }}>
                          <input
                            type="number"
                            className="form-control"
                            value={porcentajeVendedorTemp}
                            onChange={(e) => setPorcentajeVendedorTemp(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))}
                            min="0"
                            max="100"
                            step="1"
                          />
                          <span className="input-group-text">%</span>
                        </div>
                        <small className="text-muted d-block mt-1">
                          Se asignará este porcentaje a todos los productos. Podrás ajustar por producto después.
                        </small>
                      </div>
                      <div className="col-12 mt-2">
                        <label className="form-label fw-semibold">Productos que se asignarán</label>
                        <div className="list-group">
                          {(formulario.productosAseguradoras || []).map((prod, i) => {
                            const aseg = aseguradoras.find(a => String(a.id) === String(prod.aseguradoraId));
                            const tipo = tiposProductos.find(p => String(p.id) === String(prod.productoId));
                            const yaAsignado = vendedoresAutorizados.some(v => 
                              String(v.vendedorId) === String(vendedorSeleccionadoTemp) && 
                              String(v.aseguradoraId) === String(prod.aseguradoraId) && 
                              (String(v.productoId) === String(prod.productoId) || !v.productoId || v.productoId === '' || v.productoId === 'undefined')
                            );
                            const prodKey = `${prod.aseguradoraId}|${prod.productoId}`;
                            const isChecked = productosSeleccionadosTemp.includes(prodKey);
                            return (
                              <div key={i} className={`list-group-item d-flex justify-content-between align-items-center ${yaAsignado ? 'opacity-50' : ''}`}>
                                <div className="d-flex align-items-center">
                                  <input
                                    type="checkbox"
                                    className="form-check-input me-2"
                                    checked={yaAsignado || isChecked}
                                    disabled={yaAsignado}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setProductosSeleccionadosTemp(prev => [...prev, prodKey]);
                                      } else {
                                        setProductosSeleccionadosTemp(prev => prev.filter(k => k !== prodKey));
                                      }
                                    }}
                                  />
                                  <span className="badge bg-info me-2">{aseg?.nombre}</span>
                                  <span>{tipo?.nombre}</span>
                                </div>
                                {yaAsignado ? (
                                  <span className="badge bg-warning">Ya asignado</span>
                                ) : isChecked ? (
                                  <span className="badge bg-success">Se asignará</span>
                                ) : (
                                  <span className="badge bg-secondary">No seleccionado</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
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
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarVendedorAutorizado}
                  disabled={!vendedorSeleccionadoTemp}
                >
                  <Plus size={18} className="me-2" />
                  Agregar Vendedor
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
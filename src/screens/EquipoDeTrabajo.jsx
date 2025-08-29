import React, { useState, useMemo, useEffect } from 'react';
import { useEquipoDeTrabajo } from '../hooks/useEquipoDeTrabajo';
import { 
  Plus, Edit, Trash2, Eye, X, Save, Search, Users, 
  Mail, Phone, Calendar, Clock, DollarSign, Shield,
  MapPin, User, Lock, Briefcase, Hash, FileText,
  CheckCircle, AlertCircle, ChevronDown, UserCheck
} from 'lucide-react';

const AsignarEjecutivoPorProducto = ({ tiposProductos, ejecutivosDisponibles, usuarioId, tiposProductosDisponibles }) => {
  // El servicio ya está conectado al backend nuevo (ejecutivo por producto)
  const { obtenerEjecutivosPorProducto, guardarEjecutivosPorProducto } = useEquipoDeTrabajo();
  const [asignaciones, setAsignaciones] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function cargar() {
      if (!usuarioId) return;
      setLoading(true);
      const res = await obtenerEjecutivosPorProducto(usuarioId);
      if (res.success && Array.isArray(res.data)) {
        // Convertir array a objeto { productoId: ejecutivoId }
        const asignObj = {};
        res.data.forEach(a => {
          asignObj[a.productoId] = a.ejecutivoId;
        });
        setAsignaciones(asignObj);
      } else {
        setAsignaciones({});
      }
      setLoading(false);
    }
    cargar();
  }, [usuarioId, obtenerEjecutivosPorProducto]);

  const handleChange = async (productoId, ejecutivoId) => {
    const nuevasAsignaciones = { ...asignaciones, [productoId]: ejecutivoId };
    setAsignaciones(nuevasAsignaciones);
    // Guardar en la base de datos usando el nuevo servicio
    await guardarEjecutivosPorProducto({ usuarioId, productoId, ejecutivoId });
  };

  if (!tiposProductosDisponibles || tiposProductosDisponibles.length === 0) {
    return <span className="text-muted">No hay productos seleccionados</span>;
  }

  return (
    <table className="table table-bordered align-middle">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Ejecutivo</th>
        </tr>
      </thead>
      <tbody>
        {tiposProductosDisponibles.map(id => {
          const tipo = tiposProductos.find(tp => tp.id === id);
          if (!tipo) return null;
          return (
            <tr key={id}>
              <td>
                <span className="badge bg-primary me-2">{tipo.nombre}</span>
              </td>
              <td>
                <select
                  className="form-select"
                  value={asignaciones[id] || ''}
                  onChange={e => handleChange(id, e.target.value)}
                  disabled={loading}
                >
                  <option value="">Selecciona un ejecutivo</option>
                  {ejecutivosDisponibles.map(ejecutivo => (
                    <option key={ejecutivo.id} value={ejecutivo.id}>
                      {ejecutivo.nombre} {ejecutivo.apellidoPaterno}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
// Componente para mostrar asignaciones guardadas en la nueva tabla
const MostrarAsignacionesEjecutivo = ({ usuarioId, usuarios, tiposProductos }) => {
  const [asignaciones, setAsignaciones] = useState([]);
  const { obtenerEjecutivosPorProducto } = useEquipoDeTrabajo();

  useEffect(() => {
    async function cargar() {
      const res = await obtenerEjecutivosPorProducto(usuarioId);
      if (res.success) setAsignaciones(res.data);
      else setAsignaciones([]);
    }
    if (usuarioId) cargar();
  }, [usuarioId, obtenerEjecutivosPorProducto]);

  if (!asignaciones || asignaciones.length === 0) return null;

  return (
    <div className="mt-3">
      <h6 className="text-muted">Agentes/Vendedores Asignados</h6>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead>
            <tr>
              <th>Agente/Vendedor</th>
              <th>Producto Asignado</th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map(asig => {
              const agente = usuarios.find(u => u.id == asig.usuarioId);
              const producto = tiposProductos.find(tp => tp.id == asig.productoId);
              if (!agente) return null;
              return (
                <tr key={asig.id}>
                  <td>
                    <span className={`badge bg-${agente.perfil === 'Agente' ? 'success' : 'info'} me-2`}>
                      {agente.codigo}
                    </span>
                    {agente.nombre} {agente.apellidoPaterno} ({agente.perfil})
                  </td>
                  <td>
                    {producto ? (
                      <span className="badge bg-primary">{producto.nombre}</span>
                    ) : (
                      <span className="text-muted">Producto no encontrado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// Sistema de Gestión de Personal - Agencia de Seguros
const SistemaGestionPersonal = () => {
  // Estado para mostrar el modal de tipos de productos
  const [mostrarModalTiposProductos, setMostrarModalTiposProductos] = useState(false);
  const { equipoDeTrabajo: usuarios, crear, actualizar, eliminar, loading, error, generarCodigo } = useEquipoDeTrabajo();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('todos');
  const [filtroPerfil, setFiltroPerfil] = useState('todos');
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [mostrarAlerta, setMostrarAlerta] = useState({ show: false, message: '', type: 'success' });
  const [tabActiva, setTabActiva] = useState('general');

  // Estado del formulario completo
  // Hook para tipos de productos disponibles
  const [tiposProductos, setTiposProductos] = useState([]);
  useEffect(() => {
    async function cargarTiposProductos() {
      try {
        const resultado = await import('../services/tiposProductosService');
        const res = await resultado.obtenerTiposProductos();
        if (res.success) {
          setTiposProductos(res.data?.data || []);
        }
      } catch (err) {
        setTiposProductos([]);
      }
    }
    cargarTiposProductos();
  }, []);
  const [formulario, setFormulario] = useState({
    // Información General
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
    
    // Contacto
    email: '',
    telefono: '',
    telefonoEmergencia: '',
    direccion: '',
    ciudad: '',
    estado: '',
    codigoPostal: '',
    
    // Perfil y Asignaciones
    perfil: 'Agente', // Agente, Vendedor, Ejecutivo, Administrador
    agentesSupervisados: [], // Para Ejecutivos - IDs de agentes/vendedores que supervisa
    ejecutivoAsignado: null, // Para Agentes/Vendedores - ID del ejecutivo que los supervisa
    ejecutivosPorProducto: {}, // Nuevo estado para asignar ejecutivo por producto
    
    // Horario
    horarioEntrada: '09:00',
    horarioSalida: '18:00',
    diasTrabajo: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    
    // Compensación
    sueldoDiario: '',
    tipoPago: 'Quincenal',
    metodoPago: 'Transferencia',
    banco: '',
    cuentaBancaria: '',
    
    // Acceso al Sistema
    usuario: '',
    contrasena: '',
    confirmarContrasena: '',
    
    // Estado y notas
    activo: true,
    fechaIngreso: new Date().toISOString().split('T')[0],
    fechaRegistro: new Date().toISOString().split('T')[0],
    notas: ''
  });

  // Definición de perfiles y sus permisos
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


// Función para formatear fechas DD-MM-YYYY
function formatFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (isNaN(d)) return fecha;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
  // Filtrar usuarios
  const usuariosFiltrados = useMemo(() => {
    let resultado = usuarios;
    
    // Filtro por búsqueda
    if (busqueda) {
      resultado = resultado.filter(u => 
        `${u.nombre} ${u.apellidoPaterno} ${u.apellidoMaterno}`.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.usuario?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }
    
    // Filtro por estado
    if (filtroActivo !== 'todos') {
      resultado = resultado.filter(u => filtroActivo === 'activos' ? u.activo : !u.activo);
    }
    
    // Filtro por perfil
    if (filtroPerfil !== 'todos') {
      resultado = resultado.filter(u => u.perfil === filtroPerfil);
    }
    
    return resultado;
  }, [usuarios, busqueda, filtroActivo, filtroPerfil]);

  // ...eliminada función local generarCodigo, se usa la del hook

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
      agentesSupervisados: [],
      ejecutivoAsignado: null,
      ejecutivosPorProducto: {},
      horarioEntrada: '09:00',
      horarioSalida: '18:00',
      diasTrabajo: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
      sueldoDiario: '',
      tipoPago: 'Quincenal',
      metodoPago: 'Transferencia',
      banco: '',
      cuentaBancaria: '',
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
    setTabActiva('general'); // Resetear a la primera tab
    // Generar código automático según el perfil seleccionado
    setFormulario(prev => ({ 
      ...prev, 
      codigo: generarCodigo(prev.perfil)
    }));
  };

  // Abrir formulario para editar
  const editarUsuario = (usuario) => {
    setFormulario({
      ...usuario,
      confirmarContrasena: '' // No mostramos la contraseña existente
    });
    setModoEdicion(true);
    setMostrarFormulario(true);
    setTabActiva('general'); // Resetear a la primera tab
  };

  // Guardar usuario usando API
  const guardarUsuario = async () => {
    // Validaciones
    if (!formulario.nombre || !formulario.apellidoPaterno) {
      mostrarAlertaTemp('Por favor complete el nombre y apellido paterno', 'error');
      return;
    }
    if (!formulario.usuario) {
      mostrarAlertaTemp('Por favor ingrese un nombre de usuario', 'error');
      return;
    }
    if (!modoEdicion || formulario.contrasena) {
      if (!formulario.contrasena) {
        mostrarAlertaTemp('Por favor ingrese una contraseña', 'error');
        return;
      }
      if (formulario.contrasena !== formulario.confirmarContrasena) {
        mostrarAlertaTemp('Las contraseñas no coinciden', 'error');
        return;
      }
      if (formulario.contrasena.length < 6) {
        mostrarAlertaTemp('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }
    }
    const usuarioExiste = usuarios.some(u => u.usuario === formulario.usuario && u.id !== formulario.id);
    if (usuarioExiste) {
      mostrarAlertaTemp('El nombre de usuario ya existe', 'error');
      return;
    }
    const codigoFinal = formulario.codigo || generarCodigo(formulario.perfil);
    // Si ejecutivoAsignado es vacío, null o string 'null', lo convertimos a null
    let ejecutivoAsignadoFinal = formulario.ejecutivoAsignado;
    if (ejecutivoAsignadoFinal === '' || ejecutivoAsignadoFinal === null || ejecutivoAsignadoFinal === 'null') {
      ejecutivoAsignadoFinal = null;
    }
    if (modoEdicion) {
      // Eliminar confirmarContrasena antes de enviar
      const { confirmarContrasena, ...payload } = { 
        ...formulario, 
        codigo: codigoFinal, 
        ejecutivoAsignado: ejecutivoAsignadoFinal,
        ejecutivosPorProducto: formulario.ejecutivosPorProducto // <-- Agregado aquí
      };
      const res = await actualizar(formulario.id, payload);
      if (res.success) mostrarAlertaTemp('Usuario actualizado exitosamente', 'success');
      else mostrarAlertaTemp('Error al actualizar usuario', 'danger');
    } else {
      // Mapear los campos al formato de la BD
      // Validar fechas
      const fechaIngresoValida = formulario.fechaIngreso && !isNaN(new Date(formulario.fechaIngreso))
        ? formulario.fechaIngreso
        : new Date().toISOString().split('T')[0];
      const fechaRegistroValida = formulario.fechaRegistro && !isNaN(new Date(formulario.fechaRegistro))
        ? formulario.fechaRegistro
        : new Date().toISOString().split('T')[0];
      const nuevoUsuario = { 
        codigo: codigoFinal,
        nombre: formulario.nombre,
        apellidoPaterno: formulario.apellidoPaterno,
        apellidoMaterno: formulario.apellidoMaterno,
        fechaNacimiento: formulario.fechaNacimiento,
        sexo: formulario.sexo,
        curp: formulario.curp,
        rfc: formulario.rfc,
        nss: formulario.nss,
        email: formulario.email,
        telefono: formulario.telefono,
        telefonoEmergencia: formulario.telefonoEmergencia,
        direccion: formulario.direccion,
        ciudad: formulario.ciudad,
        estado: formulario.estado,
        codigoPostal: formulario.codigoPostal,
        perfil: formulario.perfil,
        agentesSupervisados: formulario.agentesSupervisados,
        ejecutivoAsignado: ejecutivoAsignadoFinal,
        ejecutivosPorProducto: formulario.ejecutivosPorProducto, // <-- Agregado aquí
        horarioEntrada: formulario.horarioEntrada,
        horarioSalida: formulario.horarioSalida,
        diasTrabajo: formulario.diasTrabajo,
        sueldoDiario: formulario.sueldoDiario,
        tipoPago: formulario.tipoPago,
        metodoPago: formulario.metodoPago,
        banco: formulario.banco,
        cuentaBancaria: formulario.cuentaBancaria,
        usuario: formulario.usuario,
        contrasena: formulario.contrasena,
        activo: formulario.activo,
        fechaIngreso: fechaIngresoValida,
        fechaRegistro: fechaRegistroValida,
        notas: formulario.notas
      };
      // Eliminar confirmarContrasena antes de enviar
      const { confirmarContrasena, ...payload } = nuevoUsuario;
      const res = await crear(payload);
      if (res.success) mostrarAlertaTemp('Usuario creado exitosamente', 'success');
      else mostrarAlertaTemp('Error al crear usuario', 'danger');
    }
    setMostrarFormulario(false);
    setTabActiva('general');
    limpiarFormulario();
  };

  // Eliminar usuario usando API
  const eliminarUsuario = async (id) => {
    if (confirm('¿Está seguro de eliminar este empleado? Esta acción no se puede deshacer.')) {
      const res = await eliminar(id);
      if (res.success) mostrarAlertaTemp('Usuario eliminado exitosamente', 'success');
      else mostrarAlertaTemp('Error al eliminar usuario', 'danger');
    }
  };

  // Ver detalles
  const verDetalles = (usuario) => {
    console.log(usuario)
    setUsuarioSeleccionado(usuario);
    setMostrarDetalles(true);
  };

  // Cambiar día de trabajo
  const toggleDiaTrabajo = (dia) => {
    setFormulario(prev => ({
      ...prev,
      diasTrabajo: (prev.diasTrabajo || []).includes(dia)
        ? (prev.diasTrabajo || []).filter(d => d !== dia)
        : [...(prev.diasTrabajo || []), dia]
    }));
  };

  // Obtener agentes y vendedores disponibles para asignar
  const agentesVendedoresDisponibles = useMemo(() => {
    return usuarios.filter(u => 
      (u.perfil === 'Agente' || u.perfil === 'Vendedor') && 
      u.activo &&
      u.id !== formulario.id
    );
  }, [usuarios, formulario.id]);

  // Obtener ejecutivos disponibles
  const ejecutivosDisponibles = useMemo(() => {
    return usuarios.filter(u => u.perfil === 'Ejecutivo' && u.activo && u.id !== formulario.id);
  }, [usuarios, formulario.id]);

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

      {/* Alertas */}
      {mostrarAlerta.show && (
        <div className="container-fluid mb-3">
          <div className={`alert alert-${mostrarAlerta.type === 'error' ? 'danger' : mostrarAlerta.type} alert-dismissible fade show`}>
            {mostrarAlerta.type === 'success' ? <CheckCircle size={20} className="me-2" /> : <AlertCircle size={20} className="me-2" />}
            {mostrarAlerta.message}
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <div className="container-fluid">
        {/* Estadísticas rápidas */}
        <div className="row mb-4">
          {Object.entries(perfilesSistema).map(([perfil, info]) => {
            const cantidad = usuarios.filter(u => u.perfil === perfil).length;
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
                        <h4 className="mb-0">{cantidad}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de Filtros y Búsqueda */}
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
                    placeholder="Buscar por nombre, código, email o usuario..."
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
              <div className="col-md-2 text-end">
                <span className="badge bg-secondary">
                  {usuariosFiltrados.length} usuarios encontrados
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Usuarios */}
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
                    <th className="py-3">Horario</th>
                    <th className="py-3">Sueldo Diario</th>
                    <th className="py-3">Estado</th>
                    <th className="py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
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
                    usuariosFiltrados.map((usuario) => {
                      const infoPerfil = perfilesSistema[usuario.perfil];
                      const IconoPerfil = infoPerfil?.icono || User;
                      
                      return (
                        <tr key={usuario.id}>
                          <td className="px-4">
                            <span className="badge bg-primary">{usuario.codigo}</span>
                          </td>
                          <td>
                            <div>
                              <div className="fw-semibold">
                                {usuario.nombre} {usuario.apellidoPaterno} {usuario.apellidoMaterno}
                              </div>
                              <small className="text-muted">
                                Ingreso: {usuario.fechaIngreso ? formatFecha(usuario.fechaIngreso) : 'No registrada'}
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge bg-${infoPerfil?.color || 'secondary'} d-flex align-items-center gap-1`} style={{width: 'fit-content'}}>
                              <IconoPerfil size={14} />
                              {usuario.perfil}
                            </span>
                          </td>
                          <td>
                            <span className="fw-semibold">{usuario.usuario}</span>
                          </td>
                          <td>
                            <div className="small">
                              {usuario.email && (
                                <div>
                                  <Mail size={14} className="me-1" />
                                  {usuario.email}
                                </div>
                              )}
                              {usuario.telefono && (
                                <div>
                                  <Phone size={14} className="me-1" />
                                  {usuario.telefono}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="small">
                              <div>
                                <Clock size={14} className="me-1" />
                                {usuario.horarioEntrada} - {usuario.horarioSalida}
                              </div>
                              <div className="text-muted">
                                {usuario.diasTrabajo?.length || 0} días/semana
                              </div>
                            </div>
                          </td>
                          <td>
                            {usuario.sueldoDiario && (
                              <div>
                                <span className="fw-semibold">
                                  ${Number(usuario.sueldoDiario).toLocaleString('es-MX')}
                                </span>
                                <small className="text-muted d-block">
                                  {usuario.tipoPago}
                                </small>
                              </div>
                            )}
                          </td>
                          <td>
                            {usuario.activo ? (
                              <span className="badge bg-success">
                                <CheckCircle size={14} className="me-1" />
                                Activo
                              </span>
                            ) : (
                              <span className="badge bg-secondary">
                                <AlertCircle size={14} className="me-1" />
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-1 justify-content-center">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => verDetalles(usuario)}
                                title="Ver detalles"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => editarUsuario(usuario)}
                                title="Editar"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => eliminarUsuario(usuario.id)}
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
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
                  {modoEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}  {formulario.nombre && `- ${formulario.nombre} ${formulario.apellidoPaterno} ${formulario.perfil ? `(${formulario.perfil})` : ''}`} 
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setMostrarFormulario(false);
                    setTabActiva('general');
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Alerta dentro del modal */}
                {mostrarAlerta.show && (
                  <div className={`alert alert-${mostrarAlerta.type === 'error' ? 'danger' : mostrarAlerta.type} alert-dismissible fade show m-3`}>
                    {mostrarAlerta.type === 'success' ? <CheckCircle size={20} className="me-2" /> : <AlertCircle size={20} className="me-2" />}
                    {mostrarAlerta.message}
                  </div>
                )}
                {/* Tabs del formulario */}
                <ul className="nav nav-tabs mb-4">
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'general' ? 'active' : ''}`}
                      onClick={() => setTabActiva('general')}
                      type="button"
                      style={{ cursor: 'pointer', border: 'none', borderBottom: tabActiva === 'general' ? '2px solid #0d6efd' : 'none' }}
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
                      style={{ cursor: 'pointer', border: 'none', borderBottom: tabActiva === 'perfil' ? '2px solid #0d6efd' : 'none' }}
                    >
                      <Shield size={18} className="me-2" />
                      Perfil y Asignaciones
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'horario' ? 'active' : ''}`}
                      onClick={() => setTabActiva('horario')}
                      type="button"
                      style={{ cursor: 'pointer', border: 'none', borderBottom: tabActiva === 'horario' ? '2px solid #0d6efd' : 'none' }}
                    >
                      <Clock size={18} className="me-2" />
                      Horario
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${tabActiva === 'compensacion' ? 'active' : ''}`}
                      onClick={() => setTabActiva('compensacion')}
                      type="button"
                      style={{ cursor: 'pointer', border: 'none', borderBottom: tabActiva === 'compensacion' ? '2px solid #0d6efd' : 'none' }}
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
                      style={{ cursor: 'pointer', border: 'none', borderBottom: tabActiva === 'acceso' ? '2px solid #0d6efd' : 'none' }}
                    >
                      <Lock size={18} className="me-2" />
                      Acceso al Sistema
                    </button>
                  </li>
                </ul>

                {/* Contenido de tabs */}
                <div className="tab-content">
                  {/* Tab Datos Generales */}
                  <div className={`tab-pane fade ${tabActiva === 'general' ? 'show active' : ''}`} style={{ display: tabActiva === 'general' ? 'block' : 'none' }}>
                    <div className="row g-3">
                      <div className="col-md-3">
                        <label className="form-label">Código *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.codigo || generarCodigo(formulario.perfil)}
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
                        <label className="form-label">Fecha de Nacimiento</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formulario.fechaNacimiento}
                          onChange={(e) => setFormulario({...formulario, fechaNacimiento: e.target.value})}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Sexo</label>
                        <select 
                          className="form-select"
                          value={formulario.sexo}
                          onChange={(e) => setFormulario({...formulario, sexo: e.target.value})}
                        >
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">CURP</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.curp}
                          onChange={(e) => setFormulario({...formulario, curp: e.target.value.toUpperCase()})}
                          maxLength="18"
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">RFC</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.rfc}
                          onChange={(e) => setFormulario({...formulario, rfc: e.target.value.toUpperCase()})}
                          maxLength="13"
                        />
                      </div>
                      
                      <div className="col-md-3">
                        <label className="form-label">NSS (IMSS)</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.nss}
                          onChange={(e) => setFormulario({...formulario, nss: e.target.value})}
                          maxLength="11"
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
                        <label className="form-label">Teléfono Emergencia</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={formulario.telefonoEmergencia}
                          onChange={(e) => setFormulario({...formulario, telefonoEmergencia: e.target.value})}
                        />
                      </div>
                      
                      <div className="col-md-6">
                        <label className="form-label">Dirección</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.direccion}
                          onChange={(e) => setFormulario({...formulario, direccion: e.target.value})}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Ciudad</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.ciudad}
                          onChange={(e) => setFormulario({...formulario, ciudad: e.target.value})}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">Estado</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.estado}
                          onChange={(e) => setFormulario({...formulario, estado: e.target.value})}
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label">C.P.</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formulario.codigoPostal}
                          onChange={(e) => setFormulario({...formulario, codigoPostal: e.target.value})}
                          maxLength="5"
                        />
                      </div>
                      
                      <div className="col-md-3">
                        <label className="form-label">Fecha de Ingreso</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formulario.fechaIngreso}
                          onChange={(e) => setFormulario({...formulario, fechaIngreso: e.target.value})}
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
                      
                      <div className="col-md-6">
                        <label className="form-label">Notas / Observaciones</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={formulario.notas}
                          onChange={(e) => setFormulario({...formulario, notas: e.target.value})}
                          placeholder="Información adicional..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tab Perfil y Asignaciones */}
                  <div className={`tab-pane fade ${tabActiva === 'perfil' ? 'show active' : ''}`} style={{ display: tabActiva === 'perfil' ? 'block' : 'none' }}>
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
                              agentesSupervisados: [],
                              ejecutivoAsignado: null
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
                      
                      {/* Si es Ejecutivo, puede supervisar agentes/vendedores */}
                      {formulario.perfil === 'Ejecutivo' && (
                        <div className="col-12">
                          <label className="form-label">Agentes/Vendedores Asignados</label>
                          <MostrarSupervisadosPorEjecutivo 
                            ejecutivoId={formulario.id}
                            usuarios={usuarios}
                            tiposProductos={tiposProductos}
                          />
                        </div>
                      )}
                      
                      {/* Si es Agente o Vendedor, puede ser supervisado por un ejecutivo */}
                      {(formulario.perfil === 'Agente' || formulario.perfil === 'Vendedor') && (
                       
                        <div className="col-md-12">
                          <button
                            type="button"
                            className="btn btn-outline-primary mb-2"
                            onClick={() => setMostrarModalTiposProductos(true)}
                          >
                            Seleccionar Tipos de Productos
                          </button>
                        <div className="row mt-3">
                          <div className="col-12">
                            <h6>Asignar ejecutivo por producto seleccionado</h6>
                            <AsignarEjecutivoPorProducto
                              tiposProductos={tiposProductos}
                              ejecutivosDisponibles={ejecutivosDisponibles}
                              usuarioId={formulario.id}
                              tiposProductosDisponibles={formulario.tiposProductosDisponibles}
                            />
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tab Horario */}
                  <div className={`tab-pane fade ${tabActiva === 'horario' ? 'show active' : ''}`} style={{ display: tabActiva === 'horario' ? 'block' : 'none' }}>
                    <div className="row g-3">
                      <div className="col-md-3">
                        <label className="form-label">Hora de Entrada</label>
                        <input
                          type="time"
                          className="form-control"
                          value={formulario.horarioEntrada}
                          onChange={(e) => setFormulario({...formulario, horarioEntrada: e.target.value})}
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Hora de Salida</label>
                        <input
                          type="time"
                          className="form-control"
                          value={formulario.horarioSalida}
                          onChange={(e) => setFormulario({...formulario, horarioSalida: e.target.value})}
                        />
                      </div>
                      
                      <div className="col-12">
                        <label className="form-label">Días de Trabajo</label>
                        <div className="d-flex gap-3 flex-wrap">
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(dia => (
                            <div key={dia} className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`dia-${dia}`}
                                checked={(formulario.diasTrabajo || []).includes(dia)}
                                onChange={() => toggleDiaTrabajo(dia)}
                              />
                              <label className="form-check-label" htmlFor={`dia-${dia}`}>
                                {dia}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-12">
                        <div className="alert alert-info">
                          <strong>Resumen de Horario:</strong> {formulario.horarioEntrada} a {formulario.horarioSalida}, 
                          {' '}{(formulario.diasTrabajo || []).length} días a la semana
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Compensación */}
                  <div className={`tab-pane fade ${tabActiva === 'compensacion' ? 'show active' : ''}`} style={{ display: tabActiva === 'compensacion' ? 'block' : 'none' }}>
                    <div className="row g-3">
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
                      
                      {formulario.sueldoDiario && (
                        <div className="col-12">
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
                    </div>
                  </div>

                  {/* Tab Acceso al Sistema */}
                  <div className={`tab-pane fade ${tabActiva === 'acceso' ? 'show active' : ''}`} style={{ display: tabActiva === 'acceso' ? 'block' : 'none' }}>
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
                        <label className="form-label">
                          Contraseña {!modoEdicion && '*'}
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          value={formulario.contrasena}
                          onChange={(e) => setFormulario({...formulario, contrasena: e.target.value})}
                          placeholder={modoEdicion ? "Dejar vacío para mantener la actual" : "Mínimo 6 caracteres"}
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
                      
                      <div className="col-12">
                        <h6>Permisos del Perfil: {formulario.perfil}</h6>
                        <div className="alert alert-light">
                          <div className="row">
                            {perfilesSistema[formulario.perfil]?.permisos.map(permiso => (
                              <div key={permiso} className="col-md-4 mb-2">
                                <div className="d-flex align-items-center">
                                  <CheckCircle size={16} className="text-success me-2" />
                                  <small>{permiso.replace(/_/g, ' ').toUpperCase()}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setMostrarFormulario(false);
                    setTabActiva('general');
                  }}
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

            {/* Modal para seleccionar tipos de productos */}
            {mostrarModalTiposProductos && (
              <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog modal-lg">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Seleccionar Tipos de Productos</h5>
                      <button type="button" className="btn-close" onClick={() => setMostrarModalTiposProductos(false)}></button>
                    </div>
                    <div className="modal-body">
                      {tiposProductos.length === 0 ? (
                        <p className="text-muted mb-0">No hay tipos de productos disponibles</p>
                      ) : (
                        <>
                        <div className="row">
                          {tiposProductos.map(tipo => (
                            <div key={tipo.id} className="col-md-6 mb-3">
                              <div className={`card shadow-sm border-primary ${formulario.tiposProductosDisponibles?.includes(tipo.id) ? 'border-2' : ''}`}
                                style={{ cursor: 'pointer', background: formulario.tiposProductosDisponibles?.includes(tipo.id) ? '#eaf4ff' : '#fff' }}
                                onClick={() => {
                                  if (formulario.tiposProductosDisponibles?.includes(tipo.id)) {
                                    setFormulario({
                                      ...formulario,
                                      tiposProductosDisponibles: (formulario.tiposProductosDisponibles || []).filter(id => id !== tipo.id)
                                    });
                                  } else {
                                    setFormulario({
                                      ...formulario,
                                      tiposProductosDisponibles: [...(formulario.tiposProductosDisponibles || []), tipo.id]
                                    });
                                  }
                                }}
                              >
                                <div className="card-body d-flex align-items-center gap-3">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={formulario.tiposProductosDisponibles?.includes(tipo.id) || false}
                                    onChange={e => {
                                      e.stopPropagation();
                                      if (e.target.checked) {
                                        setFormulario({
                                          ...formulario,
                                          tiposProductosDisponibles: [...(formulario.tiposProductosDisponibles || []), tipo.id]
                                        });
                                      } else {
                                        setFormulario({
                                          ...formulario,
                                          tiposProductosDisponibles: (formulario.tiposProductosDisponibles || []).filter(id => id !== tipo.id)
                                        });
                                      }
                                    }}
                                    style={{ marginRight: '1rem' }}
                                  />
                                  <div>
                                    <span className="badge bg-primary me-2">{tipo.codigo || tipo.id}</span>
                                    <strong>{tipo.nombre}</strong>
                                    <div className="text-muted small">{tipo.descripcion || ''}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setMostrarModalTiposProductos(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Detalles */}
      {mostrarDetalles && usuarioSeleccionado && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalles del Usuario</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setMostrarDetalles(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Información Personal</h6>
                    <p><strong>Código:</strong> {usuarioSeleccionado.codigo}</p>
                    <p><strong>Nombre:</strong> {usuarioSeleccionado.nombre} {usuarioSeleccionado.apellidoPaterno} {usuarioSeleccionado.apellidoMaterno}</p>
                      <p><strong>Fecha de Nacimiento:</strong> {usuarioSeleccionado.fechaNacimiento ? formatFecha(usuarioSeleccionado.fechaNacimiento) : 'No registrada'}</p>
                    <p><strong>CURP:</strong> {usuarioSeleccionado.curp || 'No registrado'}</p>
                    <p><strong>RFC:</strong> {usuarioSeleccionado.rfc || 'No registrado'}</p>
                    <p><strong>Email:</strong> {usuarioSeleccionado.email || 'No registrado'}</p>
                    <p><strong>Teléfono:</strong> {usuarioSeleccionado.telefono || 'No registrado'}</p>
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted mb-3">Información Laboral</h6>
                    <p><strong>Perfil:</strong> 
                      <span className={`badge bg-${perfilesSistema[usuarioSeleccionado.perfil]?.color} ms-2`}>
                        {usuarioSeleccionado.perfil}
                      </span>
                    </p>
                    <p><strong>Usuario:</strong> {usuarioSeleccionado.usuario}</p>
                      <p><strong>Fecha Ingreso:</strong> {usuarioSeleccionado.fechaIngreso ? formatFecha(usuarioSeleccionado.fechaIngreso) : 'No registrada'}</p>
                    <p><strong>Horario:</strong> {usuarioSeleccionado.horarioEntrada} - {usuarioSeleccionado.horarioSalida}</p>
                    <p><strong>Días laborales:</strong> {usuarioSeleccionado.diasTrabajo?.join(', ')}</p>
                    <p><strong>Sueldo Diario:</strong> ${Number(usuarioSeleccionado.sueldoDiario || 0).toLocaleString('es-MX')}</p>

                  </div>
                </div>
                
                {/* Mostrar supervisión si aplica */}
                {usuarioSeleccionado.perfil === 'Ejecutivo' && (
                  <MostrarAsignacionesEjecutivo usuarioId={usuarioSeleccionado.id} usuarios={usuarios} tiposProductos={tiposProductos} />
                )}

                
                {(usuarioSeleccionado.perfil === 'Agente' || usuarioSeleccionado.perfil === 'Vendedor') && usuarioSeleccionado.ejecutivoAsignado && (
                  <div className="mt-3">
                    <h6 className="text-muted">Ejecutivo Supervisor</h6>
                    {(() => {
                      const ejecutivo = usuarios.find(u => u.id === usuarioSeleccionado.ejecutivoAsignado);
                      return ejecutivo ? (
                        <span className="badge bg-warning">
                          {ejecutivo.codigo} - {ejecutivo.nombre} {ejecutivo.apellidoPaterno}
                        </span>
                      ) : (
                        <span className="text-muted">No encontrado</span>
                      );
                    })()}
                  </div>
                )}
                
                {/* Mostrar productos y ejecutivos asignados */}
                {(usuarioSeleccionado.tiposProductosDisponibles?.length > 0) && (
                  <div className="mt-3">
                    <h6 className="text-muted">Productos y Ejecutivo Asignado</h6>
                    <table className="table table-bordered align-middle">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Ejecutivo Asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarioSeleccionado.tiposProductosDisponibles.map(id => {
                          const tipo = tiposProductos.find(tp => tp.id === id);
                          const ejecutivoId = usuarioSeleccionado && usuarioSeleccionado.ejecutivosPorProducto ? usuarioSeleccionado.ejecutivosPorProducto[id] : undefined;
                          const ejecutivo = usuarios.find(u => u.id === ejecutivoId);
                          return (
                            <tr key={id}>
                              <td>{tipo ? tipo.nombre : id}</td>
                              <td>
                                {ejecutivo ? (
                                  <span className="badge bg-warning">
                                    {ejecutivo.nombre} {ejecutivo.apellidoPaterno}
                                  </span>
                                ) : (
                                  <span className="text-muted">No asignado</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {usuarioSeleccionado.notas && (
                  <div className="mt-3">
                    <h6 className="text-muted">Notas</h6>
                    <p>{usuarioSeleccionado.notas}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setMostrarDetalles(false)}
                >
                  Cerrar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    setMostrarDetalles(false);
                    editarUsuario(usuarioSeleccionado);
                  }}
                >
                  <Edit size={18} className="me-2" />
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SistemaGestionPersonal;
const MostrarSupervisadosPorEjecutivo = ({ ejecutivoId, usuarios, tiposProductos }) => {
  const [asignaciones, setAsignaciones] = useState([]);

  useEffect(() => {
    async function cargar() {
      console.log('Cargando asignaciones para ejecutivoId:', ejecutivoId);
      if (!ejecutivoId) return;
      // Consultar todos los registros donde ejecutivoId = formulario.id
      const res = await fetch(`http://localhost:3000/api/equipoDeTrabajo/ejecutivosPorProductoEjecutivo/${ejecutivoId}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Asignaciones recibidas:', data);
        // Filtrar por ejecutivoId
        const supervisados = data.filter(a => String(a.ejecutivoId) === String(ejecutivoId));
        setAsignaciones(data);
      } else {
        setAsignaciones([]);
      }
    }
    cargar();
  }, [ejecutivoId]);

  if (!asignaciones || asignaciones.length === 0) {
    return <span className="text-muted">No tiene agentes/vendedores asignados</span>;
  }

  return (
    <div className="border rounded p-3 mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead>
            <tr>
              <th>Agente/Vendedor</th>
              <th>Producto Asignado</th>
            </tr>
          </thead>
          <tbody>
            {asignaciones.map(asig => {
              const agente = usuarios.find(u => u.id == asig.usuarioId);
              const producto = tiposProductos.find(tp => tp.id == asig.productoId);
              if (!agente) return null;
              return (
                <tr key={asig.id}>
                  <td>
                    <span className={`badge bg-${agente.perfil === 'Agente' ? 'success' : 'info'} me-2`}>
                      {agente.codigo}
                    </span>
                    {agente.nombre} {agente.apellidoPaterno} ({agente.perfil})
                  </td>
                  <td>
                    {producto ? (
                      <span className="badge bg-primary">{producto.nombre}</span>
                    ) : (
                      <span className="text-muted">Producto no encontrado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

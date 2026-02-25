const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, FileText, Users, BarChart3, ArrowRight, X, CheckCircle, XCircle, Clock, DollarSign, AlertCircle, Home, UserCheck, Shield, Package, PieChart, Settings, User, Download, Upload, Save, ChevronLeft, ChevronRight, Search, Building2, UserCircle, FolderOpen, FileUp, File, Calendar, Phone, Mail, MapPin, CreditCard, Hash, AlertTriangle, CheckCircle2, FileCheck, ExternalLink } from 'lucide-react';
import DetalleExpediente from '../components/DetalleExpediente';
import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente } from '../services/clientesService';
import * as pdfService from '../services/pdfService';

// Hook personalizado para paginación (reutilizado del código original)
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

// Componente de Paginación (reutilizado)
const Paginacion = React.memo(({ paginaActual, totalPaginas, setPaginaActual }) => {
  if (totalPaginas <= 1) return null;

  const paginas = [];
  const maxPaginas = 5;
  let inicio = Math.max(1, paginaActual - Math.floor(maxPaginas / 2));
  let fin = Math.min(totalPaginas, inicio + maxPaginas - 1);
  
  if (fin - inicio + 1 < maxPaginas) {
    inicio = Math.max(1, fin - maxPaginas + 1);
  }

  for (let i = inicio; i <= fin; i++) {
    paginas.push(i);
  }

  return (
    <nav>
      <ul className="pagination justify-content-center mb-0">
        <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
          >
            <ChevronLeft size={16} />
          </button>
        </li>
        
        {inicio > 1 && (
          <>
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(1)}>1</button>
            </li>
            {inicio > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
          </>
        )}
        
        {paginas.map(pagina => (
          <li key={pagina} className={`page-item ${paginaActual === pagina ? 'active' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => setPaginaActual(pagina)}
            >
              {pagina}
            </button>
          </li>
        ))}
        
        {fin < totalPaginas && (
          <>
            {fin < totalPaginas - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(totalPaginas)}>{totalPaginas}</button>
            </li>
          </>
        )}
        
        <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
          >
            <ChevronRight size={16} />
          </button>
        </li>
      </ul>
    </nav>
  );
});

// Barra de búsqueda (reutilizada)
const BarraBusqueda = React.memo(({ busqueda, setBusqueda, placeholder = "Buscar..." }) => (
  <div className="input-group mb-3">
    <span className="input-group-text">
      <Search size={20} />
    </span>
    <input
      type="text"
      className="form-control"
      placeholder={placeholder}
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    {busqueda && (
      <button 
        className="btn btn-outline-secondary" 
        type="button"
        onClick={() => setBusqueda('')}
      >
        <X size={16} />
      </button>
    )}
  </div>
));

const ModuloClientes = () => {
  // Helper: normaliza un registro de cliente a las claves que usa la UI
  const normalizarCliente = useCallback((cliente) => ({
    ...cliente,
    // Normalizar campos de contacto principal (snake_case → camelCase estable en este módulo)
    contacto_nombre: cliente.contacto_nombre || cliente.contactoNombre || '',
    contacto_apellido_paterno: cliente.contacto_apellido_paterno || cliente.contactoApellidoPaterno || '',
    contacto_apellido_materno: cliente.contacto_apellido_materno || cliente.contactoApellidoMaterno || '',
    contacto_email: cliente.contacto_email || cliente.contactoEmail || '',
    contacto_telefono_fijo: cliente.contacto_telefono_fijo || cliente.contactoTelefonoFijo || '',
    contacto_telefono_movil: cliente.contacto_telefono_movil || cliente.contactoTelefonoMovil || '',
    contacto_puesto: cliente.contacto_puesto || cliente.contactoPuesto || '',
    // Normalizar fechaRegistro (usar created_at como respaldo)
    fechaRegistro: cliente.fecha_registro || cliente.fechaRegistro || cliente.created_at || cliente.fecha_alta || cliente.fechaAlta || '',
    // Normalizar categoria (puede venir como objeto o string)
    categoria: (() => {
      if (cliente.categoria && typeof cliente.categoria === 'object') {
        return cliente.categoria.nombre || cliente.categoria.name || 'Normal';
      }
      if (typeof cliente.categoria === 'string') return cliente.categoria;
      if (cliente.segmento) return cliente.segmento;
      return 'Normal';
    })(),
    // Normalizar arreglos serializados
    contactos: (() => {
      if (!cliente.contactos) return [];
      if (Array.isArray(cliente.contactos)) return cliente.contactos;
      if (typeof cliente.contactos === 'string') {
        try { return JSON.parse(cliente.contactos); } catch { return []; }
      }
      return [];
    })()
  }), []);
  // Estados principales del módulo de clientes
  const [clientes, setClientes] = useState([]);
  const [expedientes, setExpedientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  
  // Cargar clientes y expedientes desde el backend al montar el componente
  useEffect(() => {
    const cargarDatos = async () => {
      setCargando(true);
      
      try {
        // Cargar clientes
        const resultadoClientes = await obtenerClientes();
        
        if (resultadoClientes.success) {
          const clientesParseados = resultadoClientes.data.map(normalizarCliente);
          setClientes(clientesParseados);
        } else {
          setClientes([]);
        }
        
        // Cargar expedientes (pólizas)
        const resExpedientes = await fetch(`${API_URL}/api/expedientes`);
        const expedientesData = await resExpedientes.json();
        setExpedientes(expedientesData);
        
      } catch (err) {
        setClientes([]);
        setExpedientes([]);
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, []);
  const [vistaActual, setVistaActual] = useState('clientes');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalDocumento, setMostrarModalDocumento] = useState(false);
  const [tipoDocumentoASubir, setTipoDocumentoASubir] = useState('');
  const [mostrarModalRelacionar, setMostrarModalRelacionar] = useState(false);
  const [mostrarModalVerDocumento, setMostrarModalVerDocumento] = useState(false);
  const [documentoAVer, setDocumentoAVer] = useState(null);
  const [mostrarModalConfirmarEliminar, setMostrarModalConfirmarEliminar] = useState(false);
  const [documentoAEliminar, setDocumentoAEliminar] = useState(null);
  const [mostrarModalPolizas, setMostrarModalPolizas] = useState(false);
  const [polizasClienteSeleccionado, setPolizasClienteSeleccionado] = useState([]);
  const [mostrarVisorPDF, setMostrarVisorPDF] = useState(false);
  const [pdfUrlActual, setPdfUrlActual] = useState(null);
  const [pdfNombreActual, setPdfNombreActual] = useState(null);
  const [mostrarDetallePoliza, setMostrarDetallePoliza] = useState(false);
  const [polizaParaDetalle, setPolizaParaDetalle] = useState(null);

  // Subir PDF desde Clientes (modal/listado)
  const subirPDFDesdeClientes = useCallback(async (expedienteId, file) => {
    if (!file) return;
    const validacion = pdfService.validarArchivoPDF(file);
    if (!validacion.valid) {
      alert(validacion.error);
      return;
    }
    try {
      const pdfData = await pdfService.subirPDFPoliza(expedienteId, file);
      // Actualizar colección general de expedientes
      setExpedientes(prev => prev.map(exp => exp.id === expedienteId ? {
        ...exp,
        pdf_url: pdfData.pdf_url,
        pdf_nombre: pdfData.pdf_nombre,
        pdf_key: pdfData.pdf_key,
        pdf_size: pdfData.pdf_size,
        pdf_fecha_subida: pdfData.pdf_fecha_subida
      } : exp));
      // Si hay modal abierto, refrescar su arreglo local
      setPolizasClienteSeleccionado(prev => prev.map(p => p.id === expedienteId ? {
        ...p,
        pdf_url: pdfData.pdf_url,
        pdf_nombre: pdfData.pdf_nombre,
        pdf_key: pdfData.pdf_key,
        pdf_size: pdfData.pdf_size,
        pdf_fecha_subida: pdfData.pdf_fecha_subida
      } : p));
      alert('PDF subido correctamente');
    } catch (error) {
      alert('Error al subir PDF: ' + (error?.message || 'desconocido'));
    }
  }, []);

  // ===================== Helpers de clasificación de pólizas =====================
  const getFecha = useCallback((valor) => {
    if (!valor) return null;
    try { return new Date(valor); } catch { return null; }
  }, []);

  const getTerminoVigencia = useCallback((p) => getFecha(p.termino_vigencia || p.terminoVigencia), [getFecha]);
  const getInicioVigencia = useCallback((p) => getFecha(p.inicio_vigencia || p.inicioVigencia), [getFecha]);

  const esCancelada = useCallback((p) => {
    const etapa = (p.etapa_activa || p.etapaActiva || '').toLowerCase();
    return etapa.includes('cancelado');
  }, []);

  const estaVencidaPorVigencia = useCallback((p) => {
    const fin = getTerminoVigencia(p);
    if (!fin) return false; // sin fecha fin, la tratamos como vigente
    const hoy = new Date();
    // Comparación solo por fecha (sin horas)
    const finY = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const hoyY = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return finY < hoyY;
  }, [getTerminoVigencia]);

  const esVigente = useCallback((p) => {
    if (esCancelada(p)) return false;
    return !estaVencidaPorVigencia(p);
  }, [esCancelada, estaVencidaPorVigencia]);

  const diasParaVencer = useCallback((p) => {
    const fin = getTerminoVigencia(p);
    if (!fin) return null;
    const hoy = new Date();
    const diffMs = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate()) - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [getTerminoVigencia]);

  const renovacionPendiente = useCallback((p) => {
    if (!esVigente(p)) return false;
    const dias = diasParaVencer(p);
    return dias !== null && dias <= 30; // 30 días antes del fin de vigencia
  }, [esVigente, diasParaVencer]);

  // Tipos de cliente
  const tiposCliente = useMemo(() => ['Persona Física', 'Persona Moral'], []);
  const segmentosCliente = useMemo(() => ['Premium', 'Estándar', 'Básico', 'VIP'], []);
  
  // Tipos de documentos
  const tiposDocumentosPersonaFisica = useMemo(() => [
    'Identificación Oficial (INE/Pasaporte)',
    'Comprobante de Domicilio',
    'CURP',
    'RFC',
    'Comprobante de Ingresos',
    'Estado de Cuenta Bancario',
    'Referencias Comerciales',
    'Carta de No Antecedentes Penales'
  ], []);

  const tiposDocumentosPersonaMoral = useMemo(() => [
    'Acta Constitutiva',
    'Poder Notarial',
    'Identificación del Representante Legal',
    'Comprobante de Domicilio Fiscal',
    'RFC de la Empresa',
    'Constancia de Situación Fiscal',
    'Estados Financieros',
    'Referencias Comerciales',
    'Opinión de Cumplimiento',
    'Registro Patronal IMSS'
  ], []);

  const tiposPolizas = useMemo(() => [
    'Póliza de Autos',
    'Póliza de Vida',
    'Póliza de Daños',
    'Póliza de Equipo Pesado',
    'Póliza de Embarcaciones',
    'Póliza de Ahorro',
    'Endoso',
    'Anexo',
    'Recibo de Pago'
  ], []);

  // Estado del formulario de cliente
  const [formularioCliente, setFormularioCliente] = useState({
    tipoPersona: 'Persona Física',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    razonSocial: '',
    nombreComercial: '',
    rfc: '',
    curp: '',
    fechaNacimiento: '',
    email: '',
    telefonoFijo: '',
    telefonoMovil: '',
    // Campos del contacto principal (para ambos tipos)
    contacto_nombre: '',
    contacto_apellido_paterno: '',
    contacto_apellido_materno: '',
    contacto_email: '',
    contacto_telefono_fijo: '',
    contacto_telefono_movil: '',
    contacto_puesto: '',
    direccion: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigoPostal: '',
    pais: 'México',
    segmento: 'Estándar',
    fechaAlta: new Date().toISOString().split('T')[0],
    activo: true,
    notas: '',
    documentos: [],
    expedientesRelacionados: [],
    representanteLegal: '',
    puestoRepresentante: '',
    telefonoRepresentante: '',
    emailRepresentante: '',
    contactos: [], // Array para múltiples contactos
    id: null
  });

  // Función para generar código de cliente
  const generarCodigoCliente = useCallback(() => {
    if (clientes.length === 0) {
      return 'CL001';
    }
    
    const numeros = clientes
      .map(cliente => {
        const match = cliente.codigo?.match(/CL(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `CL${siguienteNumero.toString().padStart(3, '0')}`;
  }, [clientes]);

  // Función para limpiar formulario
  const limpiarFormularioCliente = useCallback(() => {
    setFormularioCliente({
      tipoPersona: 'Persona Física',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      razonSocial: '',
      nombreComercial: '',
      rfc: '',
      curp: '',
      fechaNacimiento: '',
      email: '',
      telefonoFijo: '',
      telefonoMovil: '',
      direccion: '',
      colonia: '',
      municipio: '',
      estado: '',
      codigoPostal: '',
      pais: 'México',
      segmento: 'Estándar',
      fechaAlta: new Date().toISOString().split('T')[0],
      activo: true,
      notas: '',
      documentos: [],
      expedientesRelacionados: [],
      representanteLegal: '',
      puestoRepresentante: '',
      telefonoRepresentante: '',
      emailRepresentante: '',
      contactos: [],
      id: null
    });
    setModoEdicion(false);
    setClienteSeleccionado(null);
  }, []);

  // Función para guardar cliente
  const guardarCliente = useCallback(async () => {
    // Validaciones
    if (formularioCliente.tipoPersona === 'Persona Física') {
      if (!formularioCliente.nombre || !formularioCliente.apellidoPaterno) {
        alert('Por favor complete los campos obligatorios: Nombre y Apellido Paterno');
        return;
      }
    } else {
      if (!formularioCliente.razonSocial || !formularioCliente.rfc) {
        alert('Por favor complete los campos obligatorios: Razón Social y RFC');
        return;
      }
      // Persona Moral: contacto principal obligatorio (nombre + [email o móvil])
      const nombreContacto = (formularioCliente.contacto_nombre || '').trim();
      const tieneEmailOMovil = !!(formularioCliente.contacto_email?.trim() || formularioCliente.contacto_telefono_movil?.trim());
      if (!nombreContacto || !tieneEmailOMovil) {
        alert('En Persona Moral es obligatorio capturar el Contacto Principal con nombre y al menos Email o Teléfono Móvil.');
        return;
      }
    }

    // Preparar datos del cliente - SOLO campos que existen en la BD
    const datosCliente = {
      // ID (solo para edición)
      ...(modoEdicion && { id: formularioCliente.id }),
      
      // Básicos
      codigo: formularioCliente.codigo || generarCodigoCliente(),
      tipoPersona: formularioCliente.tipoPersona,
      categoria_id: formularioCliente.categoria_id,
      
      // Persona Física
      nombre: formularioCliente.nombre,
      apellidoPaterno: formularioCliente.apellidoPaterno,
      apellidoMaterno: formularioCliente.apellidoMaterno,
      curp: formularioCliente.curp,
      fechaNacimiento: formularioCliente.fechaNacimiento,
      
      // Persona Moral
      razonSocial: formularioCliente.razonSocial,
      nombreComercial: formularioCliente.nombreComercial,
      representanteLegal: formularioCliente.representanteLegal,
      puestoRepresentante: formularioCliente.puestoRepresentante,
      telefonoRepresentante: formularioCliente.telefonoRepresentante,
      emailRepresentante: formularioCliente.emailRepresentante,
      
      // Contacto
      rfc: formularioCliente.rfc || '',
      email: formularioCliente.email || '',
      telefonoFijo: formularioCliente.telefonoFijo || '',
      telefonoMovil: formularioCliente.telefonoMovil || '',
      
      // Contacto Principal (para ambos tipos de persona)
      contacto_nombre: formularioCliente.contacto_nombre || '',
      contacto_apellido_paterno: formularioCliente.contacto_apellido_paterno || '',
      contacto_apellido_materno: formularioCliente.contacto_apellido_materno || '',
      contacto_email: formularioCliente.contacto_email || '',
      contacto_telefono_fijo: formularioCliente.contacto_telefono_fijo || '',
      contacto_telefono_movil: formularioCliente.contacto_telefono_movil || '',
      contacto_puesto: formularioCliente.contacto_puesto || '',
      
      // Dirección
      direccion: formularioCliente.direccion,
      colonia: formularioCliente.colonia,
      municipio: formularioCliente.municipio,
      estado: formularioCliente.estado,
      codigoPostal: formularioCliente.codigoPostal,
      pais: formularioCliente.pais,
      
      // Clasificación
      segmento: formularioCliente.segmento,
      
      // Control
      activo: formularioCliente.activo,
      notas: formularioCliente.notas,
      fechaAlta: formularioCliente.fechaAlta,
      
      // Arrays convertidos a JSON string
      contactos: formularioCliente.contactos && Array.isArray(formularioCliente.contactos) 
        ? JSON.stringify(formularioCliente.contactos) 
        : formularioCliente.contactos,
      documentos: formularioCliente.documentos && Array.isArray(formularioCliente.documentos)
        ? JSON.stringify(formularioCliente.documentos)
        : formularioCliente.documentos,
      expedientesRelacionados: formularioCliente.expedientesRelacionados && Array.isArray(formularioCliente.expedientesRelacionados)
        ? JSON.stringify(formularioCliente.expedientesRelacionados)
        : formularioCliente.expedientesRelacionados
    };

    // Log detallado ANTES de enviar
    setCargando(true);

    try {
      let resultado;
      
      if (modoEdicion) {
        // Actualizar cliente
        resultado = await actualizarCliente(datosCliente.id, datosCliente);
      } else {
        // Crear cliente
        resultado = await crearCliente(datosCliente);
      }
      
      if (resultado.success) {
        // Verificar que la respuesta tenga datos
        if (!resultado.data) {
          alert('El cliente fue guardado pero no se recibió confirmación completa. Recargando lista...');
          
          // Recargar toda la lista de clientes
          const clientesActualizados = await obtenerClientes();
          if (clientesActualizados.success) {
            setClientes(clientesActualizados.data.map(normalizarCliente));
            // Notificar globalmente que los clientes se actualizaron
            try {
              window.dispatchEvent(new CustomEvent('clientes-actualizados', { detail: { origen: 'Clientes.jsx', tipo: modoEdicion ? 'update' : 'create', ts: Date.now() } }));
            } catch (e) { /* noop */ }
          }
        } else {
          // Parsear arrays si vienen como strings
          const clienteGuardado = {
            ...resultado.data,
            contactos: typeof resultado.data.contactos === 'string' 
              ? JSON.parse(resultado.data.contactos) 
              : resultado.data.contactos,
            documentos: typeof resultado.data.documentos === 'string'
              ? JSON.parse(resultado.data.documentos)
              : resultado.data.documentos,
            expedientesRelacionados: typeof resultado.data.expedientesRelacionados === 'string'
              ? JSON.parse(resultado.data.expedientesRelacionados)
              : resultado.data.expedientesRelacionados
          };
          
          if (modoEdicion) {
            setClientes(prev => prev.map(c => c.id === clienteGuardado.id ? normalizarCliente(clienteGuardado) : c));
          } else {
            setClientes(prev => [...prev, normalizarCliente(clienteGuardado)]);
          }

          // Notificar globalmente que los clientes se actualizaron
          try {
            window.dispatchEvent(new CustomEvent('clientes-actualizados', { detail: { origen: 'Clientes.jsx', tipo: modoEdicion ? 'update' : 'create', id: clienteGuardado.id, ts: Date.now() } }));
          } catch (e) { /* noop */ }
        }
        
        limpiarFormularioCliente();
        setVistaActual('clientes');
      } else {
        alert('Error al guardar cliente: ' + resultado.error);
      }
    } catch (err) {
      alert('Error inesperado al guardar cliente: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [formularioCliente, modoEdicion, limpiarFormularioCliente, generarCodigoCliente]);

  // Recargar clientes cuando otro módulo emita el evento global
  useEffect(() => {
    const recargarClientes = async () => {
      const resultado = await obtenerClientes();
      if (resultado.success) {
        setClientes(resultado.data.map(normalizarCliente));
      }
    };
    const handler = () => recargarClientes();
    window.addEventListener('clientes-actualizados', handler);
    return () => window.removeEventListener('clientes-actualizados', handler);
  }, [normalizarCliente]);

  // Función para normalizar el nombre del estado
  const normalizarEstado = (estado) => {
    if (!estado) return '';
    // Convertir a formato: Primera letra mayúscula, resto minúsculas
    // Excepto "Ciudad de México" que tiene formato especial
    const estadoLower = estado.toLowerCase();
    if (estadoLower === 'ciudad de mexico' || estadoLower === 'ciudad de méxico') {
      return 'Ciudad de México';
    }
    // Para otros estados: Primera letra mayúscula
    return estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
  };

  // Función para editar cliente
  const editarCliente = useCallback((cliente) => {
    // Normalizar el estado antes de setear el formulario
    const clienteNormalizado = {
      ...cliente,
      // Mapear campos de snake_case a camelCase
      nombre: cliente.nombre || '',
      apellidoPaterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
      apellidoMaterno: cliente.apellidoMaterno || cliente.apellido_materno || '',
      razonSocial: cliente.razonSocial || cliente.razon_social || '',
      nombreComercial: cliente.nombreComercial || cliente.nombre_comercial || '',
      fechaNacimiento: cliente.fechaNacimiento || cliente.fecha_nacimiento || '',
      telefonoFijo: cliente.telefonoFijo || cliente.telefono_fijo || '',
      telefonoMovil: cliente.telefonoMovil || cliente.telefono_movil || '',
      codigoPostal: cliente.codigoPostal || cliente.codigo_postal || '',
      tipoPersona: cliente.tipoPersona || cliente.tipo_persona || 'Persona Física',
      segmento: cliente.segmento || 'Estándar', // Asegurar que segmento no sea null
      notas: cliente.notas || '', // Asegurar que notas no sea null
      // Mapear campos de contacto principal (para ambos tipos de persona)
      contacto_nombre: cliente.contacto_nombre || '',
      contacto_apellido_paterno: cliente.contacto_apellido_paterno || '',
      contacto_apellido_materno: cliente.contacto_apellido_materno || '',
      contacto_email: cliente.contacto_email || '',
      contacto_telefono_fijo: cliente.contacto_telefono_fijo || '',
      contacto_telefono_movil: cliente.contacto_telefono_movil || '',
      contacto_puesto: cliente.contacto_puesto || '',
      estado: normalizarEstado(cliente.estado),
      // Asegurar que contactos sea un array
      contactos: (() => {
        if (!cliente.contactos) return [];
        if (Array.isArray(cliente.contactos)) return cliente.contactos;
        if (typeof cliente.contactos === 'string') {
          try {
            return JSON.parse(cliente.contactos);
          } catch (error) {
            console.error('Error al parsear contactos:', error);
            return [];
          }
        }
        return [];
      })()
    };
    
    setFormularioCliente(clienteNormalizado);
    setModoEdicion(true);
    setVistaActual('formulario-cliente');
  }, []);

  // Función para eliminar cliente
  const eliminarClienteLocal = useCallback(async (id) => {
    const cliente = clientes.find(c => c.id === id);
    if (cliente?.expedientesRelacionados?.length > 0) {
      alert('No se puede eliminar el cliente porque tiene expedientes relacionados.');
      return;
    }
    
    const nombreCliente = cliente.tipoPersona === 'Persona Física' ? 
      `${cliente.nombre} ${cliente.apellidoPaterno}` : 
      cliente.razonSocial;
    
    if (!confirm(`¿Está seguro de eliminar el cliente "${nombreCliente}"?`)) {
      return;
    }
    
    setCargando(true);
    
    try {
      const resultado = await eliminarCliente(id);
      
      if (resultado.success) {
        setClientes(prev => prev.filter(c => c.id !== id));
        alert(`✅ Cliente "${nombreCliente}" eliminado correctamente`);
      } else {
        alert('Error al eliminar cliente: ' + resultado.error);
      }
    } catch (err) {
      alert('Error inesperado al eliminar cliente: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [clientes]);

  // Función para ver detalles
  const verDetallesCliente = useCallback((cliente) => {
    // Función helper para sanitizar valores (convertir objetos a strings)
    const sanitizarValor = (valor) => {
      if (valor === null || valor === undefined) return '';
      if (typeof valor === 'object') {
        // Si es un Date, formatear
        if (valor instanceof Date) return valor.toISOString().split('T')[0];
        // Si es otro objeto, convertir a JSON o retornar string vacío
        return '';
      }
      return valor;
    };

    // Parsear contactos si vienen como string Y sanitizar todos los campos
    const clienteConContactos = {
      ...cliente,
      // Sanitizar campos principales
      nombre: sanitizarValor(cliente.nombre),
      apellidoPaterno: sanitizarValor(cliente.apellidoPaterno || cliente.apellido_paterno),
      apellidoMaterno: sanitizarValor(cliente.apellidoMaterno || cliente.apellido_materno),
      razonSocial: sanitizarValor(cliente.razonSocial || cliente.razon_social),
      nombreComercial: sanitizarValor(cliente.nombreComercial || cliente.nombre_comercial),
      email: sanitizarValor(cliente.email),
      telefonoFijo: sanitizarValor(cliente.telefonoFijo || cliente.telefono_fijo),
      telefonoMovil: sanitizarValor(cliente.telefonoMovil || cliente.telefono_movil),
      rfc: sanitizarValor(cliente.rfc),
      curp: sanitizarValor(cliente.curp),
      direccion: sanitizarValor(cliente.direccion),
      municipio: sanitizarValor(cliente.municipio),
      estado: sanitizarValor(cliente.estado),
      codigoPostal: sanitizarValor(cliente.codigoPostal || cliente.codigo_postal),
      // Sanitizar campos de contacto
      contacto_nombre: sanitizarValor(cliente.contacto_nombre),
      contacto_apellido_paterno: sanitizarValor(cliente.contacto_apellido_paterno),
      contacto_apellido_materno: sanitizarValor(cliente.contacto_apellido_materno),
      contacto_email: sanitizarValor(cliente.contacto_email),
      contacto_telefono_fijo: sanitizarValor(cliente.contacto_telefono_fijo),
      contacto_telefono_movil: sanitizarValor(cliente.contacto_telefono_movil),
      // Sanitizar fecha y categoría con lógica correcta
      fechaRegistro: sanitizarValor(cliente.fechaRegistro || cliente.fecha_registro || cliente.created_at || cliente.fechaAlta || cliente.fecha_alta),
      categoria: (() => {
        // Si categoria es un objeto, extraer el nombre
        if (cliente.categoria && typeof cliente.categoria === 'object') {
          return sanitizarValor(cliente.categoria.nombre || cliente.categoria.name || 'Normal');
        }
        // Si es string, usarlo directamente
        return sanitizarValor(cliente.categoria || cliente.segmento) || 'Normal';
      })(),
      contactos: (() => {
        if (!cliente.contactos) return [];
        if (Array.isArray(cliente.contactos)) return cliente.contactos;
        if (typeof cliente.contactos === 'string') {
          try {
            return JSON.parse(cliente.contactos);
          } catch (error) {
            console.error('Error al parsear contactos en detalles:', error);
            return [];
          }
        }
        return [];
      })()
    };
    
    setClienteSeleccionado(clienteConContactos);
    setVistaActual('detalles-cliente');
  }, []);

  // Función para ver pólizas del cliente
  const verPolizasCliente = useCallback((cliente) => {
    // Filtrar pólizas usando cliente_id
    const polizas = expedientes.filter(exp => exp.cliente_id == cliente.id);
    
    // Asegurarse que el cliente tiene todos los campos necesarios
    const clienteConDatos = {
      ...cliente,
      tipoPersona: cliente.tipoPersona || cliente.tipo_persona || 'Persona Física',
      nombre: cliente.nombre || '',
      apellidoPaterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
      razonSocial: cliente.razonSocial || cliente.razon_social || ''
    };
    
    setClienteSeleccionado(clienteConDatos);
    setPolizasClienteSeleccionado(polizas);
    setMostrarModalPolizas(true);
  }, [expedientes]);

  // Función para agregar documento
  const agregarDocumento = useCallback((tipoDocumento, nombreArchivo = null) => {
    // Simular que siempre son PDFs para este ejemplo
    // En un sistema real, esto vendría del input file
    const extension = '.pdf';
    const nombreBase = tipoDocumento.replace(/[^a-zA-Z0-9]/g, '_');
    
    const nuevoDocumento = {
      id: Date.now() + Math.random(), // ID único más robusto
      tipo: tipoDocumento,
      nombre: nombreArchivo || `${nombreBase}_${new Date().toISOString().split('T')[0]}${extension}`,
      fechaSubida: new Date().toISOString().split('T')[0],
      estado: 'Vigente',
      tipoArchivo: 'application/pdf', // En un sistema real vendría del file.type
      tamaño: '2.5 MB' // Simulado
    };

    if (modoEdicion || clienteSeleccionado) {
      const clienteActual = modoEdicion ? formularioCliente : clienteSeleccionado;
      
      // Verificar si ya existe un documento del mismo tipo
      const documentosExistentes = clienteActual.documentos || [];
      const indiceExistente = documentosExistentes.findIndex(doc => doc.tipo === tipoDocumento);
      
      let documentosActualizados;
      let esActualizacion = false;
      
      if (indiceExistente !== -1) {
        // Reemplazar el documento existente
        documentosActualizados = [...documentosExistentes];
        documentosActualizados[indiceExistente] = nuevoDocumento;
        esActualizacion = true;
      } else {
        // Agregar nuevo documento
        documentosActualizados = [...documentosExistentes, nuevoDocumento];
      }
      
      if (modoEdicion) {
        setFormularioCliente(prev => ({
          ...prev,
          documentos: documentosActualizados
        }));
      } else {
        const clienteActualizado = {
          ...clienteSeleccionado,
          documentos: documentosActualizados
        };
        setClienteSeleccionado(clienteActualizado);
        setClientes(prev => prev.map(c => 
          c.id === clienteActualizado.id ? clienteActualizado : c
        ));
      }
      
      // Mensaje de confirmación
      if (esActualizacion) {
        alert(`✅ Documento "${tipoDocumento}" actualizado correctamente`);
      } else {
        alert(`✅ Documento "${tipoDocumento}" agregado correctamente`);
      }
    }
    
    setMostrarModalDocumento(false);
    setTipoDocumentoASubir('');
  }, [modoEdicion, clienteSeleccionado, formularioCliente]);

  // Función para eliminar documento
  const eliminarDocumento = useCallback((documentoId) => {
    if (!clienteSeleccionado) {
      alert('❌ Error: No hay cliente seleccionado');
      return;
    }
    
    if (!clienteSeleccionado.documentos || clienteSeleccionado.documentos.length === 0) {
      alert('❌ Error: No hay documentos para eliminar');
      return;
    }
    
    const documentoAEliminar = clienteSeleccionado.documentos.find(doc => doc.id === documentoId);
    if (!documentoAEliminar) {
      alert('❌ Error: No se encontró el documento a eliminar');
      return;
    }
    
    // Filtrar los documentos para eliminar el seleccionado
    const documentosActualizados = clienteSeleccionado.documentos.filter(doc => doc.id !== documentoId);
    
    // Crear el cliente actualizado con los nuevos documentos
    const clienteActualizado = {
      ...clienteSeleccionado,
      documentos: documentosActualizados
    };
    
    // Actualizar el estado del cliente seleccionado
    setClienteSeleccionado(clienteActualizado);
    
    // Actualizar la lista de clientes
    setClientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.id === clienteActualizado.id ? clienteActualizado : cliente
      )
    );
    
    // Cerrar el modal si estaba abierto
    if (mostrarModalVerDocumento && documentoAVer?.id === documentoId) {
      setMostrarModalVerDocumento(false);
      setDocumentoAVer(null);
    }
    
    // Cerrar modal de confirmación
    setMostrarModalConfirmarEliminar(false);
    setDocumentoAEliminar(null);
    
    // Mensaje de confirmación
    alert(`✅ Documento "${documentoAEliminar.tipo}" eliminado correctamente`);
  }, [clienteSeleccionado, mostrarModalVerDocumento, documentoAVer]);

  // Función para mostrar modal de confirmación de eliminación
  const mostrarConfirmacionEliminar = useCallback((documento) => {
    setDocumentoAEliminar(documento);
    setMostrarModalConfirmarEliminar(true);
  }, []);

  // Función para relacionar expediente
  const relacionarExpediente = useCallback((expedienteId) => {
    if (clienteSeleccionado) {
      const expedientesActualizados = [...(clienteSeleccionado.expedientesRelacionados || []), expedienteId];
      const clienteActualizado = {
        ...clienteSeleccionado,
        expedientesRelacionados: expedientesActualizados
      };
      
      setClienteSeleccionado(clienteActualizado);
      setClientes(prev => prev.map(c => 
        c.id === clienteActualizado.id ? clienteActualizado : c
      ));
    }
    
    setMostrarModalRelacionar(false);
  }, [clienteSeleccionado]);

  // Función para desrelacionar expediente
  const desrelacionarExpediente = useCallback((expedienteId) => {
    if (clienteSeleccionado) {
      const expedientesActualizados = clienteSeleccionado.expedientesRelacionados.filter(id => id !== expedienteId);
      const clienteActualizado = {
        ...clienteSeleccionado,
        expedientesRelacionados: expedientesActualizados
      };
      
      setClienteSeleccionado(clienteActualizado);
      setClientes(prev => prev.map(c => 
        c.id === clienteActualizado.id ? clienteActualizado : c
      ));
      
      alert('✅ Producto desrelacionado correctamente');
    }
  }, [clienteSeleccionado]);

  // Hook de paginación para la lista de clientes (debe estar aquí, no dentro de la función)
  const paginacionClientes = usePaginacion(clientes, 10);

  // Memos para los expedientes
  const expedientesDelCliente = useMemo(() => {
    if (!clienteSeleccionado) return [];
    // Incluir tanto expedientes vinculados explícitamente como los que tienen cliente_id asignado
    const setIdsRelacionados = new Set(clienteSeleccionado.expedientesRelacionados || []);
    return expedientes.filter(exp => {
      const pertenecePorId = exp.cliente_id == clienteSeleccionado.id || exp.clienteId == clienteSeleccionado.id;
      const pertenecePorRelacion = setIdsRelacionados.has(exp.id);
      return pertenecePorId || pertenecePorRelacion;
    });
  }, [expedientes, clienteSeleccionado]);

  // Dividir pólizas del cliente en Vigentes y Anteriores
  const polizasVigentesCliente = useMemo(() =>
    expedientesDelCliente.filter(esVigente),
  [expedientesDelCliente, esVigente]);

  const polizasAnterioresCliente = useMemo(() =>
    expedientesDelCliente.filter(p => !esVigente(p)),
  [expedientesDelCliente, esVigente]);

  const expedientesNoRelacionados = useMemo(() => 
    expedientes.filter(exp => 
      !exp.clienteId && !clienteSeleccionado?.expedientesRelacionados?.includes(exp.id)
    ),
    [expedientes, clienteSeleccionado]
  );

  // Renderizado de Lista de Clientes
  const renderListaClientes = () => {
    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className="mb-1">Cartera de Clientes</h3>
            <p className="text-muted mb-0">Gestión integral de clientes y documentación</p>
          </div>
          <button
            onClick={() => {
              limpiarFormularioCliente();
              setVistaActual('formulario-cliente');
            }}
            className="btn btn-primary"
          >
            <Plus size={16} className="me-2" />
            Nuevo Cliente
          </button>
        </div>

        {clientes.length > 0 && (
          <div className="row mb-3">
            <div className="col-md-6">
              <BarraBusqueda 
                busqueda={paginacionClientes.busqueda}
                setBusqueda={paginacionClientes.setBusqueda}
                placeholder="Buscar clientes..."
              />
            </div>
            <div className="col-md-6 text-end">
              <small className="text-muted">
                Mostrando {paginacionClientes.itemsPaginados.length} de {paginacionClientes.totalItems} clientes
              </small>
            </div>
          </div>
        )}

        <div className="card">
          {clientes.length === 0 ? (
            <div className="card-body text-center py-5">
              <Users size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No hay clientes registrados</h5>
              <p className="text-muted">Comienza agregando tu primer cliente</p>
              <button
                onClick={() => {
                  limpiarFormularioCliente();
                  setVistaActual('formulario-cliente');
                }}
                className="btn btn-primary mt-3"
              >
                <Plus size={16} className="me-2" />
                Agregar Primer Cliente
              </button>
            </div>
          ) : paginacionClientes.itemsPaginados.length === 0 ? (
            <div className="card-body text-center py-5">
              <Search size={48} className="text-muted mb-3" />
              <h5 className="text-muted">No se encontraron resultados</h5>
              <p className="text-muted">Intenta con otros términos de búsqueda</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover mb-0 table-sm">
                  <thead className="table-light">
                    <tr style={{ fontSize: '0.85rem' }}>
                      <th style={{ width: '80px' }}>Código</th>
                      <th>Cliente / Contacto</th>
                      <th style={{ width: '140px' }}>RFC / Tipo</th>
                      <th style={{ width: '100px' }}>Categoría</th>
                      <th>Productos</th>
                      <th style={{ width: '90px' }}>Pólizas</th>
                      <th style={{ width: '90px' }}>Docs</th>
                      <th style={{ width: '80px' }}>Estado</th>
                      <th style={{ width: '130px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginacionClientes.itemsPaginados.map((cliente) => {
                      // Filtrar pólizas que pertenecen a este cliente usando cliente_id
                      const expedientesCliente = expedientes.filter(exp => {
                        // Comparación directa: exp.cliente_id debe ser igual a cliente.id
                        // Soporta comparación flexible (número == string si tienen el mismo valor)
                        return exp.cliente_id == cliente.id;  // Usar == en lugar de === para comparación flexible
                      });
                      
                      // Agrupar pólizas por tipo de producto
                      const productosPorTipo = expedientesCliente.reduce((acc, exp) => {
                        const tipo = exp.tipo_de_poliza || exp.tipoPoliza || exp.producto || 'Otro';
                        acc[tipo] = (acc[tipo] || 0) + 1;
                        return acc;
                      }, {});
                      
                      // Iconos por tipo de producto
                      const iconosPorTipo = {
                        'Autos': '🚗',
                        'Vida': '👤',
                        'Daños': '🏢',
                        'GMM': '🏥',
                        'Equipo Pesado': '🚛',
                        'Embarcaciones': '🚢',
                        'Ahorro': '💰',
                        'RC': '⚖️',
                        'Transporte': '📦',
                        'Viaje': '✈️',
                        'Gastos Funerarios': '🕊️',
                        'Otro': '📋'
                      };
                      
                      return (
                        <tr key={cliente.id} style={{ fontSize: '0.875rem' }}>
                          <td>
                            <strong className="text-primary" style={{ fontSize: '0.85rem' }}>{cliente.codigo}</strong>
                          </td>
                          <td>
                            <div>
                              {/* Nombre del Cliente */}
                              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                                {cliente.tipoPersona === 'Persona Física' ? 
                                  `${cliente.nombre} ${cliente.apellidoPaterno} ${cliente.apellidoMaterno || ''}` :
                                  cliente.razonSocial
                                }
                              </div>
                              
                              {/* Contacto Principal (si existe) o fallback a datos del cliente para PF */}
                              {(
                                cliente.contacto_nombre || cliente.contacto_email || cliente.contacto_telefono_fijo || cliente.contacto_telefono_movil
                              ) ? (
                                <>
                                  <div className="text-muted mt-1" style={{ fontSize: '0.8rem', borderTop: '1px solid #eee', paddingTop: '4px' }}>
                                    <strong>Contacto:</strong> {cliente.contacto_nombre} {cliente.contacto_apellido_paterno || ''} {cliente.contacto_apellido_materno || ''}
                                  </div>
                                  {cliente.contacto_email && (
                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                      📧 {cliente.contacto_email}
                                    </small>
                                  )}
                                  {(cliente.contacto_telefono_movil || cliente.contacto_telefono_fijo) && (
                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                      {cliente.contacto_telefono_movil && `📱 ${cliente.contacto_telefono_movil}`}
                                      {cliente.contacto_telefono_fijo && cliente.contacto_telefono_movil && ' • '}
                                      {cliente.contacto_telefono_fijo && `☎️ ${cliente.contacto_telefono_fijo}`}
                                    </small>
                                  )}
                                </>
                              ) : (
                                // Fallback visible solo para Persona Física: mostrar email/teléfonos del cliente
                                cliente.tipoPersona === 'Persona Física' && (
                                  <>
                                    {(cliente.email || cliente.telefonoMovil || cliente.telefonoFijo) && (
                                      <div className="text-muted mt-1" style={{ fontSize: '0.8rem', borderTop: '1px solid #eee', paddingTop: '4px' }}>
                                        <strong>Datos del cliente</strong>
                                      </div>
                                    )}
                                    {cliente.email && (
                                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                        📧 {cliente.email}
                                      </small>
                                    )}
                                    {(cliente.telefonoMovil || cliente.telefonoFijo) && (
                                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                                        {cliente.telefonoMovil && `📱 ${cliente.telefonoMovil}`}
                                        {cliente.telefonoFijo && cliente.telefonoMovil && ' • '}
                                        {cliente.telefonoFijo && `☎️ ${cliente.telefonoFijo}`}
                                      </small>
                                    )}
                                  </>
                                )
                              )}
                            </div>
                          </td>
                          <td>
                            <div>
                              <small className="d-block fw-semibold" style={{ fontSize: '0.85rem' }}>{cliente.rfc || '-'}</small>
                              <small className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                {cliente.tipoPersona === 'Persona Física' ? 
                                  <><UserCircle size={12} /> Física</> :
                                  <><Building2 size={12} /> Moral</>
                                }
                              </small>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              cliente.segmento === 'VIP' ? 'bg-purple' :
                              cliente.segmento === 'Premium' ? 'bg-warning' :
                              cliente.segmento === 'Estándar' ? 'bg-info' :
                              'bg-secondary'
                            }`} style={{ fontSize: '0.75rem' }}>
                              {cliente.segmento}
                            </span>
                          </td>
                          <td>
                            {Object.keys(productosPorTipo).length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {Object.entries(productosPorTipo).map(([tipo, cantidad]) => (
                                  <span key={tipo} className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>
                                    {iconosPorTipo[tipo] || '📋'} {tipo} ({cantidad})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <small className="text-muted" style={{ fontSize: '0.75rem' }}>Sin productos</small>
                            )}
                          </td>
                          <td className="text-center">
                            <button 
                              className="btn btn-sm btn-primary"
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => verPolizasCliente(cliente)}
                              disabled={expedientesCliente.length === 0}
                              title={expedientesCliente.length === 0 ? "Sin pólizas" : "Ver pólizas de este cliente"}
                            >
                              <Package size={12} className="me-1" />
                              {expedientesCliente.length}
                            </button>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${
                              cliente.documentos?.length > 0 ? 'bg-success' : 'bg-warning'
                            }`} style={{ fontSize: '0.75rem' }}>
                              {cliente.documentos?.length || 0}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${cliente.activo ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.75rem' }}>
                              {cliente.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                              <button
                                onClick={() => verDetallesCliente(cliente)}
                                className="btn btn-outline-primary"
                                style={{ padding: '0.25rem 0.4rem' }}
                                title="Ver detalles"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={() => editarCliente(cliente)}
                                className="btn btn-outline-success"
                                style={{ padding: '0.25rem 0.4rem' }}
                                title="Editar"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => eliminarClienteLocal(cliente.id)}
                                className="btn btn-outline-danger"
                                style={{ padding: '0.25rem 0.4rem' }}
                                title="Eliminar"
                                disabled={cargando}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {paginacionClientes.totalPaginas > 1 && (
                <div className="card-footer">
                  <Paginacion 
                    paginaActual={paginacionClientes.paginaActual}
                    totalPaginas={paginacionClientes.totalPaginas}
                    setPaginaActual={paginacionClientes.setPaginaActual}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Renderizado de Formulario de Cliente
  const renderFormularioCliente = () => {
    const siguienteCodigo = !modoEdicion ? generarCodigoCliente() : formularioCliente.codigo;
    const estadosMexico = [
      'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 
      'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 
      'Guerrero', 'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 
      'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 
      'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
    ];

    // Funciones para manejar múltiples contactos
    const agregarContacto = () => {
      const nuevoContacto = {
        id: Date.now(),
        nombre: '',
        puesto: '',
        email: '',
        telefonoFijo: '',
        telefonoMovil: '',
        esContactoPrincipal: formularioCliente.contactos.length === 0
      };
      setFormularioCliente({
        ...formularioCliente,
        contactos: [...formularioCliente.contactos, nuevoContacto]
      });
    };

    const actualizarContacto = (index, campo, valor) => {
      const contactosActualizados = [...formularioCliente.contactos];
      contactosActualizados[index] = {
        ...contactosActualizados[index],
        [campo]: valor
      };
      setFormularioCliente({
        ...formularioCliente,
        contactos: contactosActualizados
      });
    };

    const eliminarContacto = (index) => {
      const contactosActualizados = formularioCliente.contactos.filter((_, i) => i !== index);
      // Si eliminamos el contacto principal, hacer principal al primero
      if (formularioCliente.contactos[index].esContactoPrincipal && contactosActualizados.length > 0) {
        contactosActualizados[0].esContactoPrincipal = true;
      }
      setFormularioCliente({
        ...formularioCliente,
        contactos: contactosActualizados
      });
    };

    const establecerContactoPrincipal = (index) => {
      const contactosActualizados = formularioCliente.contactos.map((contacto, i) => ({
        ...contacto,
        esContactoPrincipal: i === index
      }));
      setFormularioCliente({
        ...formularioCliente,
        contactos: contactosActualizados
      });
    };

    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">
            {modoEdicion ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h3>
          <button
            onClick={() => setVistaActual('clientes')}
            className="btn btn-outline-secondary"
          >
            Cancelar
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            {/* Tipo de Cliente */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Tipo de Cliente</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Código de Cliente</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={siguienteCodigo}
                      readOnly
                    />
                    <span className="input-group-text">
                      <span className="text-success" title="Se asignará automáticamente">✓</span>
                    </span>
                  </div>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Tipo de Persona <span className="text-danger">*</span></label>
                  <select
                    className="form-select"
                    value={formularioCliente.tipoPersona}
                    onChange={(e) => setFormularioCliente({...formularioCliente, tipoPersona: e.target.value})}
                    disabled={modoEdicion}
                  >
                    {tiposCliente.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-md-4">
                  <label className="form-label">Categoría</label>
                  <select
                    className="form-select"
                    value={formularioCliente.segmento || 'Estándar'}
                    onChange={(e) => setFormularioCliente({...formularioCliente, segmento: e.target.value})}
                  >
                    {segmentosCliente.map(categoria => (
                      <option key={categoria} value={categoria}>{categoria}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: Información Personal/Empresarial */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">
                {formularioCliente.tipoPersona === 'Persona Física' ? 'Información Personal' : 'Información de la Empresa'}
              </h5>
              <div className="row g-3">
                {formularioCliente.tipoPersona === 'Persona Física' ? (
                  <>
                    <div className="col-md-4">
                      <label className="form-label">Nombre <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.nombre}
                        onChange={(e) => setFormularioCliente({...formularioCliente, nombre: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Paterno <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.apellidoPaterno}
                        onChange={(e) => setFormularioCliente({...formularioCliente, apellidoPaterno: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.apellidoMaterno}
                        onChange={(e) => setFormularioCliente({...formularioCliente, apellidoMaterno: e.target.value})}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">CURP</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.curp}
                        onChange={(e) => setFormularioCliente({...formularioCliente, curp: e.target.value.toUpperCase()})}
                        maxLength="18"
                        placeholder="XXXX000000XXXXXX00"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">RFC</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.rfc}
                        onChange={(e) => setFormularioCliente({...formularioCliente, rfc: e.target.value.toUpperCase()})}
                        maxLength="13"
                        placeholder="XXXX000000XXX"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Fecha de Nacimiento</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formularioCliente.fechaNacimiento}
                        onChange={(e) => setFormularioCliente({...formularioCliente, fechaNacimiento: e.target.value})}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-md-6">
                      <label className="form-label">Razón Social <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.razonSocial}
                        onChange={(e) => setFormularioCliente({...formularioCliente, razonSocial: e.target.value})}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Nombre Comercial</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.nombreComercial}
                        onChange={(e) => setFormularioCliente({...formularioCliente, nombreComercial: e.target.value})}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">RFC <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        value={formularioCliente.rfc}
                        onChange={(e) => setFormularioCliente({...formularioCliente, rfc: e.target.value.toUpperCase()})}
                        maxLength="12"
                        placeholder="XXX000000XX0"
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Giro Empresarial</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: Comercio, Servicios, Manufactura, etc."
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Fecha de Constitución</label>
                      <input
                        type="date"
                        className="form-control"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: Dirección */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">
                {formularioCliente.tipoPersona === 'Persona Física' ? 'Dirección' : 'Dirección Fiscal'}
              </h5>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioCliente.direccion}
                    onChange={(e) => setFormularioCliente({...formularioCliente, direccion: e.target.value})}
                    placeholder="Calle y número"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Colonia</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioCliente.colonia}
                    onChange={(e) => setFormularioCliente({...formularioCliente, colonia: e.target.value})}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Municipio</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioCliente.municipio}
                    onChange={(e) => setFormularioCliente({...formularioCliente, municipio: e.target.value})}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={formularioCliente.estado}
                    onChange={(e) => setFormularioCliente({...formularioCliente, estado: e.target.value})}
                  >
                    <option value="">Seleccionar estado</option>
                    {estadosMexico.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Código Postal</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioCliente.codigoPostal}
                    onChange={(e) => setFormularioCliente({...formularioCliente, codigoPostal: e.target.value})}
                    maxLength="5"
                    placeholder="00000"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">País</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formularioCliente.pais}
                    onChange={(e) => setFormularioCliente({...formularioCliente, pais: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: Representante Legal (solo para Persona Moral) */}
            {formularioCliente.tipoPersona === 'Persona Moral' && (
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Representante Legal</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Nombre del Representante</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.representanteLegal}
                      onChange={(e) => setFormularioCliente({...formularioCliente, representanteLegal: e.target.value})}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Puesto</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.puestoRepresentante}
                      onChange={(e) => setFormularioCliente({...formularioCliente, puestoRepresentante: e.target.value})}
                      placeholder="Director General, Apoderado Legal, etc."
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.telefonoRepresentante}
                      onChange={(e) => setFormularioCliente({...formularioCliente, telefonoRepresentante: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioCliente.emailRepresentante}
                      onChange={(e) => setFormularioCliente({...formularioCliente, emailRepresentante: e.target.value})}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Poder Notarial</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Número de escritura"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 3.5: Contacto Principal (solo para Persona Moral - campos individuales) */}
            {formularioCliente.tipoPersona === 'Persona Moral' && (
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">
                  Contacto Principal
                  <span className="badge bg-primary ms-2">Principal</span>
                </h5>
                <div className="alert alert-info py-2 px-3 mb-3" role="alert" style={{ fontSize: '0.85rem' }}>
                  Requisito mínimo para guardar: <strong>Nombre</strong> y <strong>Email</strong> o <strong>Teléfono Móvil</strong>.
                </div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Nombre(s) <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_nombre || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_nombre: e.target.value})}
                      placeholder="Nombre(s) del contacto"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Paterno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_apellido_paterno || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_apellido_paterno: e.target.value})}
                      placeholder="Apellido paterno"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Materno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_apellido_materno || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_apellido_materno: e.target.value})}
                      placeholder="Apellido materno"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Email <span className="text-muted">(uno de estos)</span></label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioCliente.contacto_email || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_email: e.target.value})}
                      placeholder="correo@empresa.com"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Fijo</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.contacto_telefono_fijo || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_telefono_fijo: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Móvil <span className="text-muted">(uno de estos)</span></label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.contacto_telefono_movil || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_telefono_movil: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN 4: Información de Contacto */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">
                  {formularioCliente.tipoPersona === 'Persona Física' ? 'Información de Contacto del Cliente' : 'Contacto Principal de la Empresa'}
                </h5>
                {formularioCliente.tipoPersona === 'Persona Moral' && (
                  <button
                    type="button"
                    onClick={agregarContacto}
                    className="btn btn-success btn-sm"
                  >
                    <Plus size={16} className="me-2" />
                    Agregar Contacto Adicional
                  </button>
                )}
              </div>
              <div className="border-bottom mb-3"></div>
              
              {formularioCliente.tipoPersona === 'Persona Física' ? (
                // Para Persona Física - Contacto del cliente (asegurado)
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Email del Cliente</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioCliente.email}
                      onChange={(e) => setFormularioCliente({...formularioCliente, email: e.target.value})}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Fijo</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.telefonoFijo}
                      onChange={(e) => setFormularioCliente({...formularioCliente, telefonoFijo: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Móvil</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.telefonoMovil}
                      onChange={(e) => setFormularioCliente({...formularioCliente, telefonoMovil: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                </div>
              ) : (
                // Para Persona Moral - Múltiples contactos
                <>
                  {formularioCliente.contactos.length === 0 ? (
                    <div className="alert alert-info">
                      <AlertCircle size={20} className="me-2" />
                      No hay contactos registrados. Haz clic en "Agregar Contacto" para registrar el primer contacto.
                    </div>
                  ) : (
                    <div className="row g-3">
                      {formularioCliente.contactos.map((contacto, index) => (
                        <div key={contacto.id} className="col-12">
                          <div className={`card ${contacto.esContactoPrincipal ? 'border-primary' : ''}`}>
                            <div className="card-header d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <span className="fw-semibold">Contacto {index + 1}</span>
                                {contacto.esContactoPrincipal && (
                                  <span className="badge bg-primary ms-2">Principal</span>
                                )}
                              </div>
                              <div className="d-flex gap-2">
                                {!contacto.esContactoPrincipal && (
                                  <button
                                    type="button"
                                    onClick={() => establecerContactoPrincipal(index)}
                                    className="btn btn-outline-primary btn-sm"
                                    title="Establecer como principal"
                                  >
                                    <CheckCircle size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => eliminarContacto(index)}
                                  className="btn btn-outline-danger btn-sm"
                                  title="Eliminar contacto"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="card-body">
                              <div className="row g-3">
                                <div className="col-md-4">
                                  <label className="form-label">Nombre del Contacto</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={contacto.nombre}
                                    onChange={(e) => actualizarContacto(index, 'nombre', e.target.value)}
                                    placeholder="Nombre completo"
                                  />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">Puesto/Departamento</label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={contacto.puesto}
                                    onChange={(e) => actualizarContacto(index, 'puesto', e.target.value)}
                                    placeholder="Ej: Gerente de Compras"
                                  />
                                </div>
                                <div className="col-md-4">
                                  <label className="form-label">Email</label>
                                  <input
                                    type="email"
                                    className="form-control"
                                    value={contacto.email}
                                    onChange={(e) => actualizarContacto(index, 'email', e.target.value)}
                                    placeholder="correo@empresa.com"
                                  />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Teléfono Fijo</label>
                                  <input
                                    type="tel"
                                    className="form-control"
                                    value={contacto.telefonoFijo}
                                    onChange={(e) => actualizarContacto(index, 'telefonoFijo', e.target.value)}
                                    placeholder="55 5555 5555 Ext. 123"
                                  />
                                </div>
                                <div className="col-md-6">
                                  <label className="form-label">Teléfono Móvil</label>
                                  <input
                                    type="tel"
                                    className="form-control"
                                    value={contacto.telefonoMovil}
                                    onChange={(e) => actualizarContacto(index, 'telefonoMovil', e.target.value)}
                                    placeholder="55 5555 5555"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* SECCIÓN 5: Gestor/Contacto Principal (solo Persona Física) */}
            {formularioCliente.tipoPersona === 'Persona Física' && (
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">
                  Gestor/Contacto Principal 
                  <small className="text-muted ms-2">(Persona que gestiona las pólizas)</small>
                </h5>
                <div className="alert alert-info">
                  <AlertCircle size={16} className="me-2" />
                  Si el cliente gestiona sus propias pólizas, deja estos campos vacíos o repite sus datos.
                </div>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Nombre del Gestor</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_nombre || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_nombre: e.target.value})}
                      placeholder="Nombre"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Paterno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_apellido_paterno || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_apellido_paterno: e.target.value})}
                      placeholder="Apellido Paterno"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Apellido Materno</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_apellido_materno || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_apellido_materno: e.target.value})}
                      placeholder="Apellido Materno"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Email del Gestor</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formularioCliente.contacto_email || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_email: e.target.value})}
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Fijo</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.contacto_telefono_fijo || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_telefono_fijo: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Teléfono Móvil</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formularioCliente.contacto_telefono_movil || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_telefono_movil: e.target.value})}
                      placeholder="55 5555 5555"
                    />
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Puesto/Relación</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formularioCliente.contacto_puesto || ''}
                      onChange={(e) => setFormularioCliente({...formularioCliente, contacto_puesto: e.target.value})}
                      placeholder="Ej: Hijo, Cónyuge, Contador, Asistente, etc."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Información Adicional</h5>
              <div className="row g-3">
                <div className="col-md-12">
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formularioCliente.notas || ''}
                    onChange={(e) => setFormularioCliente({...formularioCliente, notas: e.target.value})}
                    placeholder="Información adicional sobre el cliente..."
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Estado del Cliente</label>
                  <select
                    className="form-select"
                    value={formularioCliente.activo}
                    onChange={(e) => setFormularioCliente({...formularioCliente, activo: e.target.value === 'true'})}
                  >
                    <option value={true}>Activo</option>
                    <option value={false}>Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button
                type="button"
                onClick={() => setVistaActual('clientes')}
                className="btn btn-outline-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarCliente}
                className="btn btn-primary"
              >
                {modoEdicion ? 'Actualizar' : 'Guardar'} Cliente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Renderizado de Detalles del Cliente
  const renderDetallesCliente = () => {
    const tiposDocumentosDisponibles = clienteSeleccionado?.tipoPersona === 'Persona Física' ? 
      tiposDocumentosPersonaFisica : tiposDocumentosPersonaMoral;

    return (
      <div className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">Detalles del Cliente</h3>
          <div className="d-flex gap-3">
            <button
              onClick={() => editarCliente(clienteSeleccionado)}
              className="btn btn-primary d-flex align-items-center"
            >
              <Edit size={16} className="me-2" />
              Editar
            </button>
            <button
              onClick={() => setVistaActual('clientes')}
              className="btn btn-outline-secondary"
            >
              Volver
            </button>
          </div>
        </div>

        {clienteSeleccionado && (
          <div className="row g-4">
            {/* Información General */}
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Información General</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Código:</strong>
                      <span className="h5 text-primary">{clienteSeleccionado.codigo}</span>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Tipo:</strong>
                      <span className="badge bg-info fs-6">
                        {clienteSeleccionado.tipoPersona === 'Persona Física' ? 
                          <UserCircle size={16} className="me-1" /> :
                          <Building2 size={16} className="me-1" />
                        }
                        {clienteSeleccionado.tipoPersona}
                      </span>
                    </div>
                    <div className="col-12">
                      <strong className="d-block text-muted">
                        {clienteSeleccionado.tipoPersona === 'Persona Física' ? 'Nombre Completo:' : 'Razón Social:'}
                      </strong>
                      <h5>
                        {clienteSeleccionado.tipoPersona === 'Persona Física' ? 
                          `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellidoPaterno} ${clienteSeleccionado.apellidoMaterno || ''}` :
                          clienteSeleccionado.razonSocial
                        }
                      </h5>
                      {clienteSeleccionado.nombreComercial && (
                        <small className="text-muted">Nombre Comercial: {clienteSeleccionado.nombreComercial}</small>
                      )}
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">RFC:</strong>
                      {clienteSeleccionado.rfc || '-'}
                    </div>
                    {clienteSeleccionado.tipoPersona === 'Persona Física' && (
                      <div className="col-md-6">
                        <strong className="d-block text-muted">CURP:</strong>
                        {clienteSeleccionado.curp || '-'}
                      </div>
                    )}
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Categoría:</strong>
                      <span className={`badge ${
                        (clienteSeleccionado.categoria || clienteSeleccionado.segmento) === 'VIP' ? 'bg-purple' :
                        (clienteSeleccionado.categoria || clienteSeleccionado.segmento) === 'Premium' ? 'bg-warning' :
                        (clienteSeleccionado.categoria || clienteSeleccionado.segmento) === 'Estándar' ? 'bg-info' :
                        'bg-secondary'
                      }`}>
                        {clienteSeleccionado.categoria || clienteSeleccionado.segmento || 'Normal'}
                      </span>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Estado:</strong>
                      <span className={`badge ${clienteSeleccionado.activo ? 'bg-success' : 'bg-secondary'} fs-6`}>
                        {clienteSeleccionado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="col-md-6">
                      <strong className="d-block text-muted">Fecha de Alta:</strong>
                      {(() => {
                        const fecha = clienteSeleccionado.fechaRegistro || clienteSeleccionado.fecha_registro || clienteSeleccionado.fechaAlta || clienteSeleccionado.fecha_alta;
                        if (!fecha) return '-';
                        // Si es un objeto Date, convertir a string
                        if (fecha instanceof Date) return fecha.toLocaleDateString('es-MX');
                        // Si ya es string, mostrarlo
                        if (typeof fecha === 'string') return new Date(fecha).toLocaleDateString('es-MX');
                        return '-';
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">
                    {clienteSeleccionado.tipoPersona === 'Persona Física' ? 'Información de Contacto' : 'Contactos de la Empresa'}
                  </h5>
                  
                  {clienteSeleccionado.tipoPersona === 'Persona Física' ? (
                    // Para Persona Física - mostrar contacto del cliente + gestor si existe
                    <>
                      <div className="row g-3 mb-3">
                        <div className="col-md-6">
                          <div className="d-flex align-items-center mb-2">
                            <Mail size={16} className="text-muted me-2" />
                            <strong className="text-muted">Email:</strong>
                          </div>
                          {clienteSeleccionado.email || '-'}
                        </div>
                        <div className="col-md-6">
                          <div className="d-flex align-items-center mb-2">
                            <Phone size={16} className="text-muted me-2" />
                            <strong className="text-muted">Teléfonos:</strong>
                          </div>
                          <div>Móvil: {clienteSeleccionado.telefonoMovil || '-'}</div>
                          <div>Fijo: {clienteSeleccionado.telefonoFijo || '-'}</div>
                        </div>
                        <div className="col-12">
                          <div className="d-flex align-items-center mb-2">
                            <MapPin size={16} className="text-muted me-2" />
                            <strong className="text-muted">Dirección:</strong>
                          </div>
                          {clienteSeleccionado.direccion || '-'}
                          {(clienteSeleccionado.municipio || clienteSeleccionado.estado || clienteSeleccionado.codigoPostal) && (
                            <div>
                              {clienteSeleccionado.municipio && `${clienteSeleccionado.municipio}, `}
                              {clienteSeleccionado.estado} 
                              {clienteSeleccionado.codigoPostal && ` C.P. ${clienteSeleccionado.codigoPostal}`}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Gestor/Contacto Principal - Siempre mostrar para diagnosticar */}
                      <div className="card border-info mt-3">
                        <div className="card-header bg-info bg-opacity-10 py-2">
                          <strong className="text-info">
                            <User size={16} className="me-2" />
                            Gestor/Contacto Principal (Persona que gestiona las pólizas)
                          </strong>
                        </div>
                        <div className="card-body">
                          <div className="row g-3">
                            <div className="col-md-6">
                              <div className="d-flex align-items-center mb-1">
                                <User size={14} className="text-muted me-2" />
                                <strong className="text-muted small">Nombre:</strong>
                              </div>
                              <div>
                                {clienteSeleccionado.contacto_nombre || clienteSeleccionado.contactoNombre || '-'} {clienteSeleccionado.contacto_apellido_paterno || clienteSeleccionado.contactoApellidoPaterno || ''} {clienteSeleccionado.contacto_apellido_materno || clienteSeleccionado.contactoApellidoMaterno || ''}
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="d-flex align-items-center mb-1">
                                <Mail size={14} className="text-muted me-2" />
                                <strong className="text-muted small">Email:</strong>
                              </div>
                              <div>{clienteSeleccionado.contacto_email || clienteSeleccionado.contactoEmail || '-'}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="d-flex align-items-center mb-1">
                                <Phone size={14} className="text-muted me-2" />
                                <strong className="text-muted small">Teléfono Móvil:</strong>
                              </div>
                              <div>{clienteSeleccionado.contacto_telefono_movil || clienteSeleccionado.contactoTelefonoMovil || '-'}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="d-flex align-items-center mb-1">
                                <Phone size={14} className="text-muted me-2" />
                                <strong className="text-muted small">Teléfono Fijo:</strong>
                              </div>
                              <div>{clienteSeleccionado.contacto_telefono_fijo || clienteSeleccionado.contactoTelefonoFijo || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Para Persona Moral - mostrar contacto principal + múltiples contactos
                    <>
                      {/* Contacto Principal (campos individuales de la empresa) - Siempre mostrar */}
                      <div className="mb-3">
                        <div className="card border-primary">
                          <div className="card-header bg-primary bg-opacity-10 py-2">
                            <div className="d-flex justify-content-between align-items-center">
                              <strong className="text-primary">
                                <User size={16} className="me-2" />
                                Contacto Principal
                              </strong>
                              <span className="badge bg-primary">Principal</span>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="row g-3">
                              <div className="col-md-6">
                                <div className="d-flex align-items-center mb-1">
                                  <User size={14} className="text-muted me-2" />
                                  <strong className="text-muted small">Nombre:</strong>
                                </div>
                                <div>
                                  {clienteSeleccionado.contacto_nombre || clienteSeleccionado.contactoNombre || '-'} {clienteSeleccionado.contacto_apellido_paterno || clienteSeleccionado.contactoApellidoPaterno || ''} {clienteSeleccionado.contacto_apellido_materno || clienteSeleccionado.contactoApellidoMaterno || ''}
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="d-flex align-items-center mb-1">
                                  <Mail size={14} className="text-muted me-2" />
                                  <strong className="text-muted small">Email:</strong>
                                </div>
                                <div>{clienteSeleccionado.contacto_email || clienteSeleccionado.contactoEmail || '-'}</div>
                              </div>
                              <div className="col-md-6">
                                <div className="d-flex align-items-center mb-1">
                                  <Phone size={14} className="text-muted me-2" />
                                  <strong className="text-muted small">Teléfono Móvil:</strong>
                                </div>
                                <div>{clienteSeleccionado.contacto_telefono_movil || clienteSeleccionado.contactoTelefonoMovil || '-'}</div>
                              </div>
                              <div className="col-md-6">
                                <div className="d-flex align-items-center mb-1">
                                  <Phone size={14} className="text-muted me-2" />
                                  <strong className="text-muted small">Teléfono Fijo:</strong>
                                </div>
                                <div>{clienteSeleccionado.contacto_telefono_fijo || clienteSeleccionado.contactoTelefonoFijo || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Contactos Adicionales (array de contactos) */}
                      {clienteSeleccionado.contactos && clienteSeleccionado.contactos.length > 0 && (
                        <>
                          <h6 className="text-muted mb-2">Contactos Adicionales</h6>
                          <div className="row g-3 mb-3">
                            {clienteSeleccionado.contactos.map((contacto, index) => (
                            <div key={contacto.id || index} className="col-md-6">
                              <div className={`card ${contacto.esContactoPrincipal ? 'border-primary' : 'border-light'}`}>
                                <div className="card-header py-2">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <strong>{contacto.nombre || `Contacto ${index + 1}`}</strong>
                                    {contacto.esContactoPrincipal && (
                                      <span className="badge bg-primary">Principal</span>
                                    )}
                                  </div>
                                  {contacto.puesto && (
                                    <small className="text-muted">{contacto.puesto}</small>
                                  )}
                                </div>
                                <div className="card-body py-2">
                                  {contacto.email && (
                                    <div className="mb-1">
                                      <Mail size={14} className="text-muted me-2" />
                                      <small>{contacto.email}</small>
                                    </div>
                                  )}
                                  {contacto.telefonoFijo && (
                                    <div className="mb-1">
                                      <Phone size={14} className="text-muted me-2" />
                                      <small>Fijo: {contacto.telefonoFijo}</small>
                                    </div>
                                  )}
                                  {contacto.telefonoMovil && (
                                    <div className="mb-1">
                                      <Phone size={14} className="text-muted me-2" />
                                      <small>Móvil: {contacto.telefonoMovil}</small>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        </>
                      )}
                      
                      {/* Dirección de la empresa */}
                      <div className="mt-3 pt-3 border-top">
                        <div className="d-flex align-items-center mb-2">
                          <MapPin size={16} className="text-muted me-2" />
                          <strong className="text-muted">Dirección Fiscal:</strong>
                        </div>
                        {clienteSeleccionado.direccion || '-'}
                        {(clienteSeleccionado.municipio || clienteSeleccionado.estado || clienteSeleccionado.codigoPostal) && (
                          <div>
                            {clienteSeleccionado.municipio && `${clienteSeleccionado.municipio}, `}
                            {clienteSeleccionado.estado} 
                            {clienteSeleccionado.codigoPostal && ` C.P. ${clienteSeleccionado.codigoPostal}`}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Representante Legal */}
              {clienteSeleccionado.tipoPersona === 'Persona Moral' && clienteSeleccionado.representanteLegal && (
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Representante Legal</h5>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Nombre:</strong>
                        {clienteSeleccionado.representanteLegal}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Puesto:</strong>
                        {clienteSeleccionado.puestoRepresentante || '-'}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Teléfono:</strong>
                        {clienteSeleccionado.telefonoRepresentante || '-'}
                      </div>
                      <div className="col-md-6">
                        <strong className="d-block text-muted">Email:</strong>
                        {clienteSeleccionado.emailRepresentante || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notas */}
              {clienteSeleccionado.notas && (
                <div className="card mt-3">
                  <div className="card-body">
                    <h5 className="card-title border-bottom pb-2">Notas</h5>
                    <p>{clienteSeleccionado.notas}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Acciones Rápidas */}
            <div className="col-md-4">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title border-bottom pb-2">Acciones Rápidas</h5>
                  <div className="d-grid gap-2">
                    <button
                      onClick={() => setMostrarModalDocumento(true)}
                      className="btn btn-outline-primary"
                    >
                      <FileUp size={16} className="me-2" />
                      Subir Documento
                    </button>
                    <button
                      onClick={() => setMostrarModalRelacionar(true)}
                      className="btn btn-outline-success"
                      disabled={expedientesNoRelacionados.length === 0}
                    >
                      <Plus size={16} className="me-2" />
                      Relacionar Expediente
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <FolderOpen size={20} className="me-2" />
                    Gestión Documental
                  </h5>
                  <button
                    onClick={() => setMostrarModalDocumento(true)}
                    className="btn btn-sm btn-primary"
                  >
                    <FileUp size={14} className="me-1" />
                    Subir Documento
                  </button>
                </div>
                <div className="card-body">
                  {/* Checklist de Documentos */}
                  <div className="mb-4">
                    <h6 className="text-muted mb-3">
                      <FileCheck size={18} className="me-2" />
                      Checklist de Documentos - {clienteSeleccionado.tipoPersona}
                    </h6>
                    
                    {/* Indicador de progreso */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <small className="text-muted">Documentos completados</small>
                        <small className="fw-bold text-primary">
                          {clienteSeleccionado.documentos?.filter(doc => 
                            tiposDocumentosDisponibles.includes(doc.tipo)
                          ).length || 0} de {tiposDocumentosDisponibles.length}
                        </small>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div 
                          className="progress-bar bg-success" 
                          role="progressbar" 
                          style={{ 
                            width: `${((clienteSeleccionado.documentos?.filter(doc => 
                              tiposDocumentosDisponibles.includes(doc.tipo)
                            ).length || 0) / tiposDocumentosDisponibles.length) * 100}%` 
                          }}
                        />
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead className="table-light">
                          <tr>
                            <th width="40" className="text-center">Estado</th>
                            <th>Tipo de Documento</th>
                            <th>Archivo</th>
                            <th>Última Carga</th>
                            <th width="180" className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tiposDocumentosDisponibles.map(tipoDoc => {
                            const documentoCargado = clienteSeleccionado.documentos?.find(doc => doc.tipo === tipoDoc);
                            const estaCompleto = !!documentoCargado;
                            
                            return (
                              <tr key={tipoDoc} className={estaCompleto ? 'table-success' : ''}>
                                <td className="text-center">
                                  {estaCompleto ? (
                                    <div className="d-flex justify-content-center">
                                      <div 
                                        className="rounded-circle bg-success d-flex align-items-center justify-content-center" 
                                        style={{ width: '28px', height: '28px' }}
                                        title="Documento cargado"
                                      >
                                        <CheckCircle2 size={18} className="text-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="d-flex justify-content-center">
                                      <div 
                                        className="rounded-circle bg-warning bg-opacity-25 d-flex align-items-center justify-content-center" 
                                        style={{ width: '28px', height: '28px' }}
                                        title="Documento pendiente"
                                      >
                                        <AlertCircle size={18} className="text-warning" />
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div className="fw-semibold">{tipoDoc}</div>
                                </td>
                                <td>
                                  {documentoCargado ? (
                                    <div>
                                      <small className="text-success">
                                        <File size={12} className="me-1" />
                                        {documentoCargado.nombre}
                                      </small>
                                      <div>
                                        <span className={`badge ${
                                          documentoCargado.estado === 'Vigente' ? 'bg-success' : 'bg-warning'
                                        } small`}>
                                          {documentoCargado.estado}
                                        </span>
                                        {documentoCargado.tamaño && (
                                          <span className="ms-2 text-muted small">
                                            {documentoCargado.tamaño}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted small">No cargado</span>
                                  )}
                                </td>
                                <td>
                                  {documentoCargado ? (
                                    <div>
                                      <div className="text-muted small">
                                        <Calendar size={12} className="me-1" />
                                        {new Date(documentoCargado.fechaSubida).toLocaleDateString('es-MX', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-muted small">-</span>
                                  )}
                                </td>
                                <td>
                                  <div className="d-flex gap-1 justify-content-center">
                                    {estaCompleto ? (
                                      <>
                                        <button 
                                          className="btn btn-sm btn-outline-primary" 
                                          title="Ver documento"
                                          onClick={() => {
                                            setDocumentoAVer(documentoCargado);
                                            setMostrarModalVerDocumento(true);
                                          }}
                                        >
                                          <Eye size={14} />
                                        </button>
                                        <button 
                                          className="btn btn-sm btn-outline-success" 
                                          title="Actualizar documento"
                                          onClick={() => {
                                            setTipoDocumentoASubir(tipoDoc);
                                            setMostrarModalDocumento(true);
                                          }}
                                        >
                                          <Upload size={14} />
                                        </button>
                                        <button 
                                          className="btn btn-sm btn-outline-danger" 
                                          title="Eliminar documento"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            mostrarConfirmacionEliminar(documentoCargado);
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    ) : (
                                      <button 
                                        className="btn btn-sm btn-warning"
                                        onClick={() => {
                                          setTipoDocumentoASubir(tipoDoc);
                                          setMostrarModalDocumento(true);
                                        }}
                                        title="Subir documento"
                                      >
                                        <FileUp size={14} className="me-1" />
                                        Subir
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Resumen de estado */}
                    <div className="mt-3 p-3 bg-light rounded">
                      <div className="row text-center">
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-center">
                            <CheckCircle2 size={20} className="text-success me-2" />
                            <div>
                              <div className="fw-bold text-success">
                                {clienteSeleccionado.documentos?.filter(doc => 
                                  tiposDocumentosDisponibles.includes(doc.tipo)
                                ).length || 0}
                              </div>
                              <small className="text-muted">Completos</small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-center">
                            <AlertCircle size={20} className="text-warning me-2" />
                            <div>
                              <div className="fw-bold text-warning">
                                {tiposDocumentosDisponibles.length - 
                                  (clienteSeleccionado.documentos?.filter(doc => 
                                    tiposDocumentosDisponibles.includes(doc.tipo)
                                  ).length || 0)}
                              </div>
                              <small className="text-muted">Pendientes</small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex align-items-center justify-content-center">
                            <FileCheck size={20} className="text-primary me-2" />
                            <div>
                              <div className="fw-bold text-primary">
                                {Math.round(((clienteSeleccionado.documentos?.filter(doc => 
                                  tiposDocumentosDisponibles.includes(doc.tipo)
                                ).length || 0) / tiposDocumentosDisponibles.length) * 100)}%
                              </div>
                              <small className="text-muted">Completado</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Productos/Expedientes Relacionados */}
            <div className="col-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <Package size={20} className="me-2" />
                    Productos Contratados
                  </h5>
                  <button
                    onClick={() => setMostrarModalRelacionar(true)}
                    className="btn btn-sm btn-success"
                    disabled={expedientesNoRelacionados.length === 0}
                  >
                    <Plus size={14} className="me-1" />
                    Relacionar Producto
                  </button>
                </div>
                <div className="card-body">
                  {expedientesDelCliente.length === 0 ? (
                    <div className="text-center py-4">
                      <Package size={48} className="text-muted mb-3" />
                      <p className="text-muted">No hay productos relacionados con este cliente</p>
                      {expedientesNoRelacionados.length > 0 && (
                        <button
                          onClick={() => setMostrarModalRelacionar(true)}
                          className="btn btn-outline-success"
                        >
                          Relacionar Primer Producto
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Sección: Vigentes */}
                      <h6 className="mb-2">Vigentes <span className="badge bg-success ms-1">{polizasVigentesCliente.length}</span></h6>
                      <div className="table-responsive mb-4">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>No. Póliza</th>
                              <th>Producto</th>
                              <th>Compañía</th>
                              <th>Prima</th>
                              <th>Vigencia</th>
                              <th>Estado</th>
                              <th style={{minWidth: '200px'}}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {polizasVigentesCliente.map(expediente => (
                              <tr key={expediente.id}>
                                <td>
                                  <strong className="text-primary">{expediente.numero_poliza || expediente.no_poliza || '-'}</strong>
                                  {(() => {
                                    // Buscar póliza anterior vinculada (por campo o por vehículo)
                                    let anterior = null;
                                    if (expediente.renovacion_de) {
                                      anterior = expedientesDelCliente.find(e => e.id === expediente.renovacion_de || e.id === Number(expediente.renovacion_de));
                                    }
                                    if (!anterior) {
                                      // Buscar por mismo vehículo en pólizas anteriores
                                      anterior = polizasAnterioresCliente.find(e => {
                                        if (e.id === expediente.id) return false;
                                        // Match por número de serie (más confiable)
                                        if (expediente.numero_serie && e.numero_serie && expediente.numero_serie === e.numero_serie) return true;
                                        // Match por marca+modelo+año
                                        if (expediente.marca && e.marca && expediente.anio && e.anio &&
                                            expediente.marca === e.marca && expediente.modelo === e.modelo && expediente.anio === e.anio) return true;
                                        return false;
                                      });
                                    }
                                    return anterior ? (
                                      <div><small className="text-muted">🔄 Renueva: <span className="text-info">{anterior.numero_poliza || anterior.no_poliza}</span>
                                        <span className="text-secondary"> ({new Date(anterior.inicio_vigencia || anterior.inicioVigencia).toLocaleDateString('es-MX')} - {new Date(anterior.termino_vigencia || anterior.terminoVigencia).toLocaleDateString('es-MX')})</span>
                                      </small></div>
                                    ) : null;
                                  })()}
                                </td>
                                <td>
                                  <div>
                                    <div>{expediente.producto || expediente.tipo_producto || '-'}</div>
                                    {(expediente.marca || expediente.modelo || expediente.anio) && (
                                      <small className="text-muted">{expediente.marca} {expediente.modelo} {expediente.anio}</small>
                                    )}
                                  </div>
                                </td>
                                <td>{expediente.compania || expediente.aseguradora || '-'}</td>
                                <td>
                                  {(() => {
                                    const valor = parseFloat(expediente.prima_pagada ?? expediente.total);
                                    return isNaN(valor) ? '-' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
                                  })()}
                                </td>
                                <td>
                                  <small>
                                    {(expediente.inicio_vigencia || expediente.inicioVigencia) ? new Date(expediente.inicio_vigencia || expediente.inicioVigencia).toLocaleDateString('es-MX') : '-'}
                                    {' - '}
                                    {(expediente.termino_vigencia || expediente.terminoVigencia) ? new Date(expediente.termino_vigencia || expediente.terminoVigencia).toLocaleDateString('es-MX') : '-'}
                                  </small>
                                </td>
                                <td>
                                  <div className="d-flex flex-column gap-1">
                                    <span className={`badge ${
                                      (expediente.etapa_activa || expediente.etapaActiva) === 'Pagado' ? 'bg-success' :
                                      (expediente.etapa_activa || expediente.etapaActiva) === 'Emitida' ? 'bg-info' :
                                      (expediente.etapa_activa || expediente.etapaActiva)?.toLowerCase().includes('cotizar renovacion') ? 'bg-warning text-dark' :
                                      (expediente.etapa_activa || expediente.etapaActiva)?.toLowerCase().includes('cotización enviada') ? 'bg-primary' :
                                      (expediente.etapa_activa || expediente.etapaActiva)?.toLowerCase().includes('cotización aceptada') ? 'bg-success' :
                                      (expediente.etapa_activa || expediente.etapaActiva)?.toLowerCase().includes('cotización no aceptada') ? 'bg-secondary' :
                                      'bg-secondary'
                                    }`}>
                                      {expediente.etapa_activa || expediente.etapaActiva || '-'}
                                    </span>
                                    {renovacionPendiente(expediente) && (
                                      <span className="badge bg-warning text-dark">Renovación pendiente</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="btn-group" role="group">
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        setPolizaParaDetalle(expediente);
                                        setMostrarDetallePoliza(true);
                                      }}
                                      title="Ver expediente completo"
                                    >
                                      <Eye size={14} />
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-success"
                                      onClick={async () => {
                                        try {
                                          const { signed_url } = await pdfService.obtenerURLFirmadaPDF(expediente.id);
                                          const nueva = window.open(signed_url, '_blank', 'noopener,noreferrer');
                                          if (nueva) nueva.opener = null;
                                        } catch (error) {
                                          alert('PDF no disponible o error al abrirlo: ' + (error?.message || 'desconocido'));
                                        }
                                      }}
                                      title={'Abrir PDF en nueva pestaña'}
                                    >
                                      <Download size={14} />
                                    </button>
                                    {/* Subir PDF */}
                                    <button
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => document.getElementById(`file-exped-${expediente.id}`)?.click()}
                                      title="Subir/Actualizar PDF"
                                    >
                                      <Upload size={14} />
                                    </button>
                                    <input
                                      id={`file-exped-${expediente.id}`}
                                      type="file"
                                      accept=".pdf,application/pdf"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) subirPDFDesdeClientes(expediente.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                    {(clienteSeleccionado?.expedientesRelacionados || []).includes(expediente.id) && (
                                      <button
                                        onClick={() => desrelacionarExpediente(expediente.id)}
                                        className="btn btn-sm btn-outline-danger"
                                        title="Desrelacionar"
                                      >
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Sección: Anteriores */}
                      <h6 className="mb-2">Anteriores <span className="badge bg-secondary ms-1">{polizasAnterioresCliente.length}</span></h6>
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>No. Póliza</th>
                              <th>Producto</th>
                              <th>Compañía</th>
                              <th>Prima</th>
                              <th>Vigencia</th>
                              <th>Estado</th>
                              <th style={{minWidth: '200px'}}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {polizasAnterioresCliente.map(expediente => (
                            <tr key={expediente.id}>
                                <td>
                                  <strong className="text-primary">{expediente.numero_poliza || expediente.no_poliza || '-'}</strong>
                                  {(() => {
                                    // Buscar póliza nueva que la renovó (por campo o por vehículo)
                                    let nueva = null;
                                    if (expediente.renovada_por) {
                                      nueva = expedientesDelCliente.find(e => e.id === expediente.renovada_por || e.id === Number(expediente.renovada_por));
                                    }
                                    if (!nueva) {
                                      // Buscar por mismo vehículo en pólizas vigentes
                                      nueva = polizasVigentesCliente.find(e => {
                                        if (e.id === expediente.id) return false;
                                        if (expediente.numero_serie && e.numero_serie && expediente.numero_serie === e.numero_serie) return true;
                                        if (expediente.marca && e.marca && expediente.anio && e.anio &&
                                            expediente.marca === e.marca && expediente.modelo === e.modelo && expediente.anio === e.anio) return true;
                                        return false;
                                      });
                                    }
                                    return nueva ? (
                                      <div><small className="text-muted">➡️ Renovada por: <span className="text-success">{nueva.numero_poliza || nueva.no_poliza}</span>
                                        <span className="text-secondary"> ({new Date(nueva.inicio_vigencia || nueva.inicioVigencia).toLocaleDateString('es-MX')} - {new Date(nueva.termino_vigencia || nueva.terminoVigencia).toLocaleDateString('es-MX')})</span>
                                      </small></div>
                                    ) : null;
                                  })()}
                                </td>
                                <td>
                                  <div>
                                    <div>{expediente.producto || expediente.tipo_producto || '-'}</div>
                                    {(expediente.marca || expediente.modelo || expediente.anio) && (
                                      <small className="text-muted">{expediente.marca} {expediente.modelo} {expediente.anio}</small>
                                    )}
                                  </div>
                                </td>
                                <td>{expediente.compania || expediente.aseguradora || '-'}</td>
                                <td>
                                  {(() => {
                                    const valor = parseFloat(expediente.prima_pagada ?? expediente.total);
                                    return isNaN(valor) ? '-' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor);
                                  })()}
                                </td>
                                <td>
                                  <small>
                                    {(expediente.inicio_vigencia || expediente.inicioVigencia) ? new Date(expediente.inicio_vigencia || expediente.inicioVigencia).toLocaleDateString('es-MX') : '-'}
                                    {' - '}
                                    {(expediente.termino_vigencia || expediente.terminoVigencia) ? new Date(expediente.termino_vigencia || expediente.terminoVigencia).toLocaleDateString('es-MX') : '-'}
                                  </small>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    (expediente.etapa_activa || expediente.etapaActiva) === 'Cancelado' ? 'bg-danger' :
                                    estaVencidaPorVigencia(expediente) ? 'bg-secondary' : 'bg-secondary'
                                  }`}>
                                    {expediente.etapa_activa || expediente.etapaActiva || (estaVencidaPorVigencia(expediente) ? 'Vencida' : '-')}
                                  </span>
                                </td>
                                <td>
                                  <div className="btn-group" role="group">
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        setPolizaParaDetalle(expediente);
                                        setMostrarDetallePoliza(true);
                                      }}
                                      title="Ver expediente completo"
                                    >
                                      <Eye size={14} />
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-success"
                                      onClick={async () => {
                                        try {
                                          const { signed_url } = await pdfService.obtenerURLFirmadaPDF(expediente.id);
                                          const nueva = window.open(signed_url, '_blank', 'noopener,noreferrer');
                                          if (nueva) nueva.opener = null;
                                        } catch (error) {
                                          alert('PDF no disponible o error al abrirlo: ' + (error?.message || 'desconocido'));
                                        }
                                      }}
                                      title="Abrir PDF en nueva pestaña"
                                    >
                                      <Download size={14} />
                                    </button>
                                    {/* Subir PDF */}
                                    <button
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => document.getElementById(`file-exped-ant-${expediente.id}`)?.click()}
                                      title="Subir/Actualizar PDF"
                                    >
                                      <Upload size={14} />
                                    </button>
                                    <input
                                      id={`file-exped-ant-${expediente.id}`}
                                      type="file"
                                      accept=".pdf,application/pdf"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) subirPDFDesdeClientes(expediente.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                  </div>
                                </td>
                            </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para ver documento */}
        {mostrarModalVerDocumento && documentoAVer && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <FileText size={20} className="me-2" />
                    Visualizar Documento
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => {
                      setMostrarModalVerDocumento(false);
                      setDocumentoAVer(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <h6 className="card-subtitle mb-2 text-muted">Información del Documento</h6>
                          <dl className="row mb-0">
                            <dt className="col-sm-5">Tipo:</dt>
                            <dd className="col-sm-7">{documentoAVer.tipo}</dd>
                            
                            <dt className="col-sm-5">Archivo:</dt>
                            <dd className="col-sm-7">
                              <File size={14} className="me-1 text-primary" />
                              {documentoAVer.nombre}
                            </dd>
                            
                            <dt className="col-sm-5">Tamaño:</dt>
                            <dd className="col-sm-7">{documentoAVer.tamaño || '2.5 MB'}</dd>
                            
                            <dt className="col-sm-5">Fecha de carga:</dt>
                            <dd className="col-sm-7">
                              <Calendar size={14} className="me-1" />
                              {new Date(documentoAVer.fechaSubida).toLocaleDateString('es-MX', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </dd>
                            
                            <dt className="col-sm-5">Estado:</dt>
                            <dd className="col-sm-7">
                              <span className={`badge ${
                                documentoAVer.estado === 'Vigente' ? 'bg-success' : 'bg-warning'
                              }`}>
                                {documentoAVer.estado}
                              </span>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <h6 className="card-subtitle mb-2 text-muted">Acciones Disponibles</h6>
                          <div className="d-grid gap-2">
                            <button 
                              className="btn btn-primary"
                              onClick={() => {
                                alert('Descargando documento: ' + documentoAVer.nombre);
                                // Aquí iría la lógica real de descarga
                              }}
                            >
                              <Download size={16} className="me-2" />
                              Descargar Documento
                            </button>
                            <button 
                              className="btn btn-outline-primary"
                              onClick={() => {
                                setMostrarModalVerDocumento(false);
                                setTipoDocumentoASubir(documentoAVer.tipo);
                                setMostrarModalDocumento(true);
                                setDocumentoAVer(null);
                              }}
                            >
                              <Upload size={16} className="me-2" />
                              Reemplazar con Nueva Versión
                            </button>
                            <button 
                              className="btn btn-outline-danger"
                              onClick={(e) => {
                                e.preventDefault();
                                setMostrarModalVerDocumento(false);
                                mostrarConfirmacionEliminar(documentoAVer);
                              }}
                            >
                              <Trash2 size={16} className="me-2" />
                              Eliminar Documento
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Vista previa del documento */}
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">Vista Previa del Documento</h6>
                    </div>
                    <div className="card-body bg-light" style={{ minHeight: '400px' }}>
                      <div className="text-center py-5">
                        {documentoAVer.nombre.toLowerCase().endsWith('.pdf') || documentoAVer.tipoArchivo === 'application/pdf' ? (
                          <div>
                            <div className="mb-4">
                              <FileText size={64} className="text-danger mb-3" />
                            </div>
                            <h5 className="text-dark mb-3">Documento PDF</h5>
                            <div className="border rounded p-4 bg-white mx-auto" style={{ maxWidth: '600px' }}>
                              {/* Simulación de vista previa de PDF */}
                              <div className="text-start">
                                <div className="border-bottom pb-2 mb-3">
                                  <small className="text-muted">Página 1 de 1</small>
                                </div>
                                
                                {/* Contenido simulado según el tipo de documento */}
                                {documentoAVer.tipo.includes('CURP') && (
                                  <div>
                                    <h6 className="mb-3">CLAVE ÚNICA DE REGISTRO DE POBLACIÓN</h6>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">CURP:</div>
                                      <div className="col-8">XXXX000000XXXXXX00</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Nombre:</div>
                                      <div className="col-8">{clienteSeleccionado?.nombre || 'NOMBRE'} {clienteSeleccionado?.apellidoPaterno || 'APELLIDO'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Fecha Nac:</div>
                                      <div className="col-8">{clienteSeleccionado?.fechaNacimiento || '01/01/1990'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Sexo:</div>
                                      <div className="col-8">-</div>
                                    </div>
                                  </div>
                                )}
                                
                                {documentoAVer.tipo.includes('Comprobante de Domicilio') && (
                                  <div>
                                    <h6 className="mb-3">COMPROBANTE DE DOMICILIO</h6>
                                    <p className="small text-muted mb-2">CFE - Comisión Federal de Electricidad</p>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Servicio:</div>
                                      <div className="col-8">123456789</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Periodo:</div>
                                      <div className="col-8">JUL-AGO 2025</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Dirección:</div>
                                      <div className="col-8">{clienteSeleccionado?.direccion || 'Calle Ejemplo #123'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Municipio:</div>
                                      <div className="col-8">{clienteSeleccionado?.municipio || 'Municipio'}, {clienteSeleccionado?.estado || 'Estado'}</div>
                                    </div>
                                  </div>
                                )}
                                
                                {documentoAVer.tipo.includes('Identificación Oficial') && (
                                  <div>
                                    <h6 className="mb-3">INSTITUTO NACIONAL ELECTORAL</h6>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Nombre:</div>
                                      <div className="col-8">{clienteSeleccionado?.nombre || 'NOMBRE'} {clienteSeleccionado?.apellidoPaterno || 'APELLIDO'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Domicilio:</div>
                                      <div className="col-8">{clienteSeleccionado?.direccion || 'Dirección registrada'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Clave Elector:</div>
                                      <div className="col-8">XXXXXXXXX</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">CURP:</div>
                                      <div className="col-8">{clienteSeleccionado?.curp || 'XXXX000000XXXXXX00'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Vigencia:</div>
                                      <div className="col-8">2034</div>
                                    </div>
                                  </div>
                                )}
                                
                                {documentoAVer.tipo.includes('RFC') && (
                                  <div>
                                    <h6 className="mb-3">CONSTANCIA DE SITUACIÓN FISCAL</h6>
                                    <p className="small text-muted mb-2">Servicio de Administración Tributaria</p>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">RFC:</div>
                                      <div className="col-8">{clienteSeleccionado?.rfc || 'XXXX000000XXX'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Nombre:</div>
                                      <div className="col-8">{clienteSeleccionado?.nombre || 'NOMBRE'} {clienteSeleccionado?.apellidoPaterno || 'APELLIDO'}</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Régimen:</div>
                                      <div className="col-8">Persona Física</div>
                                    </div>
                                    <div className="row mb-2">
                                      <div className="col-4 text-muted">Fecha Alta:</div>
                                      <div className="col-8">01/01/2020</div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Para otros tipos de documentos */}
                                {!documentoAVer.tipo.includes('CURP') && 
                                 !documentoAVer.tipo.includes('Comprobante de Domicilio') && 
                                 !documentoAVer.tipo.includes('Identificación Oficial') &&
                                 !documentoAVer.tipo.includes('RFC') && (
                                  <div>
                                    <p className="mb-2">
                                      <strong>Tipo:</strong> {documentoAVer.tipo}
                                    </p>
                                    <p className="mb-2">
                                      <strong>Archivo:</strong> {documentoAVer.nombre}
                                    </p>
                                    <p className="mb-2">
                                      <strong>Tamaño:</strong> {documentoAVer.tamaño || '2.5 MB'}
                                    </p>
                                    <div className="mt-3 p-3 bg-light rounded">
                                      <p className="text-muted small mb-0">
                                        Este es un documento PDF válido. En un sistema de producción, 
                                        aquí se mostraría el contenido real del documento usando un visor PDF embebido.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="mt-4 pt-3 border-top">
                                <button 
                                  className="btn btn-sm btn-outline-primary me-2"
                                  onClick={() => alert('Función de zoom implementada')}
                                >
                                  <Plus size={14} className="me-1" />
                                  Zoom
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-primary me-2"
                                  onClick={() => alert('Rotación de documento')}
                                >
                                  <ArrowRight size={14} className="me-1" />
                                  Rotar
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => window.print()}
                                >
                                  <FileText size={14} className="me-1" />
                                  Imprimir
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : documentoAVer.nombre.toLowerCase().match(/\.(jpg|jpeg|png)$/) ? (
                          <div>
                            <div className="mb-3">
                              <div className="border rounded p-2 bg-white d-inline-block">
                                <img 
                                  src={`data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMTUwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+SW1hZ2VuIGRlbCBkb2N1bWVudG88L3RleHQ+PC9zdmc+`}
                                  alt="Vista previa"
                                  className="img-fluid"
                                  style={{ maxHeight: '300px' }}
                                />
                              </div>
                            </div>
                            <p className="text-muted">
                              <strong>Imagen:</strong> {documentoAVer.nombre}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <File size={64} className="text-muted mb-3" />
                            <p className="text-muted">
                              <strong>Archivo:</strong> {documentoAVer.nombre}
                            </p>
                            <p className="text-muted small">
                              Vista previa no disponible para este tipo de archivo
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Historial de versiones */}
                  <div className="mt-3">
                    <h6 className="text-muted mb-2">
                      <Clock size={16} className="me-2" />
                      Historial de Versiones
                    </h6>
                    <div className="list-group">
                      <div className="list-group-item">
                        <div className="d-flex w-100 justify-content-between">
                          <div>
                            <strong>Versión actual</strong>
                            <small className="text-muted ms-2">({documentoAVer.nombre})</small>
                          </div>
                          <small className="text-muted">
                            {new Date(documentoAVer.fechaSubida).toLocaleDateString('es-MX')}
                          </small>
                        </div>
                        <small className="text-muted">Subido por: Usuario Admin</small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarModalVerDocumento(false);
                      setDocumentoAVer(null);
                    }}
                  >
                    Cerrar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => {
                      alert('Descargando documento: ' + documentoAVer.nombre);
                      // Aquí iría la lógica real de descarga
                    }}
                  >
                    <Download size={16} className="me-2" />
                    Descargar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para subir documentos */}
        {mostrarModalDocumento && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {clienteSeleccionado?.documentos?.find(doc => doc.tipo === tipoDocumentoASubir) ? 
                      'Actualizar Documento' : 'Subir Documento'}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => {
                      setMostrarModalDocumento(false);
                      setTipoDocumentoASubir('');
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  {clienteSeleccionado?.documentos?.find(doc => doc.tipo === tipoDocumentoASubir) && (
                    <div className="alert alert-info mb-3">
                      <AlertCircle size={16} className="me-2" />
                      Este documento ya existe y será reemplazado con la nueva versión.
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <label className="form-label">Tipo de Documento</label>
                    <select 
                      className="form-select"
                      value={tipoDocumentoASubir}
                      onChange={(e) => setTipoDocumentoASubir(e.target.value)}
                    >
                      <option value="">Seleccionar tipo de documento</option>
                      <optgroup label="Documentos del Cliente">
                        {(clienteSeleccionado?.tipoPersona === 'Persona Física' ? 
                          tiposDocumentosPersonaFisica : 
                          tiposDocumentosPersonaMoral
                        ).map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Pólizas">
                        {tiposPolizas.map(tipo => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Archivo</label>
                    <input 
                      type="file" 
                      className="form-control"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    <small className="text-muted">
                      Formatos aceptados: PDF, JPG, PNG, DOC, DOCX
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarModalDocumento(false);
                      setTipoDocumentoASubir('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => agregarDocumento(tipoDocumentoASubir)}
                    disabled={!tipoDocumentoASubir}
                  >
                    <FileUp size={16} className="me-2" />
                    {clienteSeleccionado?.documentos?.find(doc => doc.tipo === tipoDocumentoASubir) ? 
                      'Actualizar Documento' : 'Subir Documento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para relacionar expedientes */}
        {mostrarModalRelacionar && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Relacionar Expediente/Producto</h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => setMostrarModalRelacionar(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p>Selecciona los expedientes que deseas relacionar con este cliente:</p>
                  
                  {expedientesNoRelacionados.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle2 size={48} className="text-success mb-3" />
                      <p className="text-muted">No hay expedientes disponibles para relacionar</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Cliente en Expediente</th>
                            <th>Producto</th>
                            <th>Compañía</th>
                            <th>Estado</th>
                            <th>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expedientesNoRelacionados.map(expediente => (
                            <tr key={expediente.id}>
                              <td>{expediente.nombre} {expediente.apellidoPaterno}</td>
                              <td>{expediente.producto}</td>
                              <td>{expediente.compania}</td>
                              <td>
                                <span className={`badge ${
                                  expediente.etapaActiva === 'Pagado' ? 'bg-success' :
                                  expediente.etapaActiva === 'Cancelado' ? 'bg-danger' :
                                  'bg-warning'
                                }`}>
                                  {expediente.etapaActiva}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => relacionarExpediente(expediente.id)}
                                  className="btn btn-sm btn-success"
                                >
                                  <Plus size={14} className="me-1" />
                                  Relacionar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setMostrarModalRelacionar(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmación para eliminar documento */}
        {mostrarModalConfirmarEliminar && documentoAEliminar && (
          <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">
                    <AlertTriangle size={20} className="me-2" />
                    Confirmar Eliminación
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close btn-close-white"
                    onClick={() => {
                      setMostrarModalConfirmarEliminar(false);
                      setDocumentoAEliminar(null);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-danger">
                    <AlertTriangle size={20} className="me-2" />
                    <strong>¡Atención!</strong> Esta acción no se puede deshacer.
                  </div>
                  
                  <p className="mb-3">¿Está seguro de que desea eliminar el siguiente documento?</p>
                  
                  <div className="card bg-light">
                    <div className="card-body">
                      <dl className="row mb-0">
                        <dt className="col-sm-4">Tipo:</dt>
                        <dd className="col-sm-8">{documentoAEliminar.tipo}</dd>
                        
                        <dt className="col-sm-4">Archivo:</dt>
                        <dd className="col-sm-8">
                          <File size={14} className="me-1 text-primary" />
                          {documentoAEliminar.nombre}
                        </dd>
                        
                        {documentoAEliminar.tamaño && (
                          <>
                            <dt className="col-sm-4">Tamaño:</dt>
                            <dd className="col-sm-8">{documentoAEliminar.tamaño}</dd>
                          </>
                        )}
                        
                        <dt className="col-sm-4">Fecha de carga:</dt>
                        <dd className="col-sm-8">
                          {new Date(documentoAEliminar.fechaSubida).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarModalConfirmarEliminar(false);
                      setDocumentoAEliminar(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={() => {
                      eliminarDocumento(documentoAEliminar.id);
                    }}
                  >
                    <Trash2 size={16} className="me-2" />
                    Sí, Eliminar Documento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      {vistaActual === 'clientes' && renderListaClientes()}
      {vistaActual === 'formulario-cliente' && renderFormularioCliente()}
      {vistaActual === 'detalles-cliente' && renderDetallesCliente()}

      {/* Modal para ver pólizas del cliente - FUERA de renderDetallesCliente */}
      {mostrarModalPolizas && clienteSeleccionado && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <Package size={20} className="me-2" />
                  Pólizas de {clienteSeleccionado.tipoPersona === 'Persona Física' ? 
                    `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellidoPaterno}` :
                    clienteSeleccionado.razonSocial
                  }
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalPolizas(false);
                    setPolizasClienteSeleccionado([]);
                    setClienteSeleccionado(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {polizasClienteSeleccionado.filter(esVigente).length === 0 ? (
                  <div className="alert alert-info">
                    <AlertCircle size={16} className="me-2" />
                    Este cliente no tiene pólizas registradas.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>No. Póliza</th>
                          <th>Tipo</th>
                          <th>Aseguradora</th>
                          <th>Prima</th>
                          <th>Vigencia</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {polizasClienteSeleccionado.filter(esVigente).map((poliza) => (
                          <tr key={poliza.id}>
                            <td>
                              <strong className="text-primary">{poliza.numero_poliza || '-'}</strong>
                            </td>
                            <td>
                              <div>
                                <div>{poliza.producto || '-'}</div>
                                {(poliza.marca || poliza.modelo || poliza.anio) && (
                                  <small className="text-muted">
                                    {poliza.marca} {poliza.modelo} {poliza.anio}
                                  </small>
                                )}
                              </div>
                            </td>
                            <td>{poliza.compania || '-'}</td>
                            <td>
                              {poliza.prima_pagada ? 
                                new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(poliza.prima_pagada)) :
                                (poliza.total ? 
                                  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(poliza.total)) :
                                  '-'
                                )
                              }
                            </td>
                            <td>
                              <small>
                                {poliza.inicio_vigencia ? new Date(poliza.inicio_vigencia).toLocaleDateString('es-MX') : '-'}
                                {' - '}
                                {poliza.termino_vigencia ? new Date(poliza.termino_vigencia).toLocaleDateString('es-MX') : '-'}
                              </small>
                            </td>
                            <td>
                              <div className="d-flex flex-column gap-1">
                                <span className={`badge ${
                                  poliza.etapa_activa === 'Pagado' ? 'bg-success' :
                                  poliza.etapa_activa === 'Emitida' ? 'bg-info' :
                                  (poliza.etapa_activa || '').toLowerCase().includes('cotizar renovacion') ? 'bg-warning text-dark' :
                                  (poliza.etapa_activa || '').toLowerCase().includes('cotización enviada') ? 'bg-primary' :
                                  (poliza.etapa_activa || '').toLowerCase().includes('cotización aceptada') ? 'bg-success' :
                                  (poliza.etapa_activa || '').toLowerCase().includes('cotización no aceptada') ? 'bg-secondary' :
                                  'bg-secondary'
                                }`}>
                                  {poliza.etapa_activa || '-'}
                                </span>
                                {renovacionPendiente(poliza) && (
                                  <span className="badge bg-warning text-dark">Renovación pendiente</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="btn-group" role="group">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    setPolizaParaDetalle(poliza);
                                    setMostrarDetallePoliza(true);
                                  }}
                                  title="Ver expediente completo"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={async () => {
                                    try {
                                      const { signed_url } = await pdfService.obtenerURLFirmadaPDF(poliza.id);
                                      const nueva = window.open(signed_url, '_blank', 'noopener,noreferrer');
                                      if (nueva) nueva.opener = null;
                                    } catch (error) {
                                      alert('PDF no disponible o error al abrirlo: ' + (error?.message || 'desconocido'));
                                    }
                                  }}
                                  title="Abrir PDF en nueva pestaña"
                                >
                                  <Download size={14} />
                                </button>
                                {/* Subir PDF */}
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => document.getElementById(`file-poliza-${poliza.id}`)?.click()}
                                  title="Subir/Actualizar PDF"
                                >
                                  <Upload size={14} />
                                </button>
                                <input
                                  id={`file-poliza-${poliza.id}`}
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) subirPDFDesdeClientes(poliza.id, file);
                                    e.target.value = '';
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPolizas(false);
                    setPolizasClienteSeleccionado([]);
                    setClienteSeleccionado(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visor de PDF */}
      {mostrarVisorPDF && pdfUrlActual && (
        <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FileText size={20} className="me-2" />
                  Vista Previa de Póliza: {pdfNombreActual}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setMostrarVisorPDF(false);
                    setPdfUrlActual(null);
                    setPdfNombreActual(null);
                  }}
                ></button>
              </div>
              <div className="modal-body p-0" style={{height: '80vh'}}>
                <iframe
                  src={pdfUrlActual}
                  style={{width: '100%', height: '100%', border: 'none'}}
                  title="Visor de Póliza"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarVisorPDF(false);
                    setPdfUrlActual(null);
                    setPdfNombreActual(null);
                  }}
                >
                  Cerrar
                </button>
                <a
                  href={pdfUrlActual}
                  download={pdfNombreActual}
                  className="btn btn-primary"
                >
                  <Download size={16} className="me-2" />
                  Descargar PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Póliza */}
      {mostrarDetallePoliza && polizaParaDetalle && (
        <div className="modal fade show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FileText size={20} className="me-2" />
                  Detalles del Expediente
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setMostrarDetallePoliza(false);
                    setPolizaParaDetalle(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Vista unificada de detalles usando DetalleExpediente */}
                <DetalleExpediente
                  datos={polizaParaDetalle}
                  modo="caratula"
                  coberturas={(() => {
                    try {
                      if (!polizaParaDetalle.coberturas) return [];
                      return typeof polizaParaDetalle.coberturas === 'string'
                        ? JSON.parse(polizaParaDetalle.coberturas)
                        : polizaParaDetalle.coberturas;
                    } catch {
                      return [];
                    }
                  })()}
                  mensajes={polizaParaDetalle.mensajes || []}
                  utils={{
                    formatearMoneda: (valor) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(valor)),
                  }}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarDetallePoliza(false);
                    setPolizaParaDetalle(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuloClientes;
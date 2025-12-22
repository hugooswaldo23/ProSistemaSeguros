/**
 * ====================================================================
 * COMPONENTE: Gestión de Expedientes (Pólizas)
 * TRAZABILIDAD COMPLETA DEL CICLO DE VIDA
 * ====================================================================
 * 
 * FLUJO DE EVENTOS REGISTRADOS EN HISTORIAL:
 * 
 * 1️⃣ COTIZACIÓN CREADA (COTIZACION_CREADA)
 *    - Al crear nuevo expediente vía POST /api/expedientes
 *    - Línea ~6309: registrarEvento con tipo COTIZACION_CREADA
 * 
 * 2️⃣ CAMBIOS DE ETAPA (vía registrarCambioEtapa automático)
 *    - 'En cotización' → COTIZACION_CREADA
 *    - 'Cotización enviada' → COTIZACION_ENVIADA
 *    - 'Autorizado' → COTIZACION_AUTORIZADA
 *    - 'En proceso emisión' → EMISION_INICIADA
 *    - 'Emitida' → POLIZA_EMITIDA
 *    - 'Enviada al Cliente' → POLIZA_ENVIADA_EMAIL (si manual)
 *    - 'Renovada' → POLIZA_RENOVADA
 *    - 'Cancelada' → POLIZA_CANCELADA
 *    - Línea ~5151: función cambiarEstadoExpediente llama registrarCambioEtapa
 *    - Línea ~6260: al editar expediente detecta cambio de etapa
 * 
 * 3️⃣ ENVÍO AL CLIENTE (POLIZA_ENVIADA_EMAIL / POLIZA_ENVIADA_WHATSAPP)
 *    - Al compartir póliza por Email: línea ~5466
 *    - Al compartir póliza por WhatsApp: línea ~5365
 *    - Ambos llaman registrarEnvioDocumento con destinatario y mensaje
 * 
 * 4️⃣ PAGOS REGISTRADOS (PAGO_REGISTRADO)
 *    - Al aplicar pago con comprobante: línea ~5730
 *    - Incluye monto, siguiente vencimiento, nombre archivo, nuevo estatus
 * 
 * 5️⃣ ACTUALIZACIONES DE DATOS (DATOS_ACTUALIZADOS)
 *    - Al editar expediente SIN cambio de etapa: línea ~6260
 *    - Incluye número de póliza y marcador de campos modificados
 * 
 * SERVICIOS UTILIZADOS:
 * - historialExpedienteService.js: 26 tipos de eventos, helpers para etapas y envíos
 * - TimelineExpediente.jsx: Visualización del historial con filtros y exportación
 * - DetalleExpediente.jsx: Integra TimelineExpediente en acordeón de historial
 * 
 * BASE DE DATOS:
 * - Tabla: historial_expedientes (expediente_id, tipo_evento, etapa_anterior, 
 *   etapa_nueva, usuario_id, descripcion, datos_adicionales JSON, metodo_contacto,
 *   destinatario, documento_url, fecha_evento)
 * 
 * PENDIENTES:
 * - TODO: Reemplazar usuario_nombre 'Sistema' por usuario autenticado actual
 * - TODO: Capturar diferencias exactas de campos en DATOS_ACTUALIZADOS
 * ====================================================================
 */

const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X, XCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Save, Upload, CheckCircle, Loader, Share2, Mail, Bell, Clock, RefreshCw, Calendar } from 'lucide-react';
import DetalleExpediente from '../components/DetalleExpediente';
import BuscadorCliente from '../components/BuscadorCliente';
import ModalCapturarContacto from '../components/ModalCapturarContacto';
import { obtenerAgentesEquipo } from '../services/equipoDeTrabajoService';
import { obtenerTiposProductosActivos } from '../services/tiposProductosService';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfService from '../services/pdfService';
import * as notificacionesService from '../services/notificacionesService';
import * as clientesService from '../services/clientesService';
import * as historialService from '../services/historialExpedienteService';
import * as pagosService from '../services/pagosService';
import { registrarNotificacion, TIPOS_NOTIFICACION, TIPOS_MENSAJE } from '../services/notificacionesService';
import TimelineExpediente from '../components/TimelineExpediente';
import * as estatusPagosUtils from '../utils/estatusPagos';
import { useExpedientes } from '../hooks/useExpedientes';
import { useCompartirExpediente } from '../hooks/useCompartirExpediente';
import { usePagos } from '../hooks/usePagos';

// 🚀 MODULARIZACIÓN: Importar constantes y utilidades
import { CONSTANTS, globalSnapshotPendiente, setGlobalSnapshotPendiente } from '../utils/expedientesConstants';
import utils from '../utils/expedientesUtils';

// 🚀 MODULARIZACIÓN: Importar componentes UI
import { Badge, CampoFechaCalculada, InfoCliente, EstadoPago, BarraBusqueda, obtenerEstatusPagoDesdeBackend } from '../components/expedientes/UIComponents';

// 🚀 MODULARIZACIÓN: Importar paginación
import { usePaginacion } from '../hooks/usePaginacion';
import Paginacion from '../components/common/Paginacion';

// 🚀 MODULARIZACIÓN: Importar componentes grandes
import CalendarioPagos from '../components/expedientes/CalendarioPagos';
import ModalCancelacion from '../components/expedientes/ModalCancelacion';
import ListaExpedientes from '../components/expedientes/ListaExpedientes';
import Formulario from '../components/expedientes/FormularioExpediente';
import ExtractorPolizasPDF from '../components/expedientes/ExtractorPolizasPDF';

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';


// ============= COMPONENTES DE VISTA =============



const DetallesExpediente = React.memo(({ 
  expedienteSeleccionado,
  setExpedienteSeleccionado,
  setVistaActual,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  editarExpediente,
  calcularSiguientePago,
  calculartermino_vigencia,
  calcularProximoPago,
  abrirModalCompartir,
  enviarAvisoPago,
  historial = [] // Historial del expediente
}) => {
  const [clienteInfo, setClienteInfo] = useState(null);
  
  // Debug: verificar que el historial llega correctamente
  useEffect(() => {
    console.log('🔍 DetallesExpediente - Historial recibido:', {
      cantidad: historial?.length || 0,
      historial: historial,
      expediente_id: expedienteSeleccionado?.id
    });
  }, [historial, expedienteSeleccionado?.id]);
  
  // Estados para controlar secciones colapsables (todas cerradas por defecto)
  const [mostrarAsegurado, setMostrarAsegurado] = useState(false);
  const [mostrarPoliza, setMostrarPoliza] = useState(false);
  const [mostrarVigencia, setMostrarVigencia] = useState(false);
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [mostrarFinanciera, setMostrarFinanciera] = useState(false);
  const [mostrarCoberturas, setMostrarCoberturas] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  
  // Helper: parsear coberturas de forma segura
  const obtenerCoberturas = useMemo(() => {
    if (!expedienteSeleccionado?.coberturas) return [];
    
    // Si ya es un array, devolverlo
    if (Array.isArray(expedienteSeleccionado.coberturas)) {
      return expedienteSeleccionado.coberturas;
    }
    
    // Si es un string JSON, parsearlo
    if (typeof expedienteSeleccionado.coberturas === 'string') {
      try {
        const parsed = JSON.parse(expedienteSeleccionado.coberturas);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parseando coberturas:', e);
        return [];
      }
    }
    
    return [];
  }, [expedienteSeleccionado?.coberturas]);
  
  // Debug: ver qué coberturas tiene el expediente
  useEffect(() => {
    if (expedienteSeleccionado) {
      console.log('🔍 Expediente seleccionado para detalles:', {
        numero_poliza: expedienteSeleccionado.numero_poliza,
        tiene_coberturas: !!expedienteSeleccionado.coberturas,
        cantidad_coberturas: expedienteSeleccionado.coberturas?.length || 0,
        coberturas: expedienteSeleccionado.coberturas,
        tipo_cobertura: expedienteSeleccionado.tipo_cobertura,
        suma_asegurada: expedienteSeleccionado.suma_asegurada,
        deducible: expedienteSeleccionado.deducible
      });
    }
  }, [expedienteSeleccionado]);
  
  // Cargar información del cliente cuando se selecciona un expediente
  useEffect(() => {
    const cargarCliente = async () => {
      if (expedienteSeleccionado?.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          const cliente = clientes.find(c => c.id === expedienteSeleccionado.cliente_id);
          setClienteInfo(cliente);
        } catch (error) {
          console.error('Error al cargar cliente:', error);
        }
      } else {
        setClienteInfo(null);
      }
    };
    
    cargarCliente();
  }, [expedienteSeleccionado?.cliente_id]);
  
  return (
  <div className="p-4">
    <div className="d-flex justify-content-between align-items-center mb-4">
      <h3 className="mb-0">Detalles del Expediente</h3>
      <div className="d-flex gap-3">
        {expedienteSeleccionado && 
         ['Emitida', 'Renovada', 'Enviada al Cliente', 'Vencida'].includes(expedienteSeleccionado.etapa_activa) && 
         ((expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagado' && (expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagada') && (
          <button
            onClick={() => {
              aplicarPago(expedienteSeleccionado.id);
              const fechaActual = new Date().toISOString().split('T')[0];
              const proximoPagoNuevo = calcularSiguientePago(expedienteSeleccionado);
              
              setExpedienteSeleccionado({
                ...expedienteSeleccionado,
                estatusPago: 'Pagado',
                fechaUltimoPago: fechaActual,
                proximoPago: proximoPagoNuevo
              });
              
              if (proximoPagoNuevo) {
                toast.success(`Pago aplicado. Próximo pago: ${new Date(proximoPagoNuevo).toLocaleDateString('es-MX')}`);
              } else {
                toast.success('Pago aplicado. No hay más pagos pendientes');
              }
            }}
            className="btn btn-success d-flex align-items-center"
          >
            <DollarSign size={16} className="me-2" />
            Aplicar Pago
          </button>
        )}

        {expedienteSeleccionado && (
          <button
            onClick={() => abrirModalCompartir(expedienteSeleccionado)}
            className="btn btn-success d-flex align-items-center"
          >
            <Share2 size={16} className="me-2" />
            Compartir
          </button>
        )}

        {expedienteSeleccionado && expedienteSeleccionado.etapa_activa !== 'Cancelada' && (
          <button
            onClick={() => iniciarCancelacion(expedienteSeleccionado)}
            className="btn btn-danger d-flex align-items-center"
          >
            <XCircle size={16} className="me-2" />
            Cancelar Póliza
          </button>
        )}
        
        <button
          onClick={() => editarExpediente(expedienteSeleccionado)}
          className="btn btn-primary d-flex align-items-center"
        >
          <Edit size={16} className="me-2" />
          Editar
        </button>
        <button
          onClick={() => setVistaActual('lista')}
          className="btn btn-outline-secondary"
        >
          Volver
        </button>
      </div>
    </div>

    {expedienteSeleccionado && (
      <div className="card">
        <div className="card-body p-3">
          <div className="row g-3">
            <div className="col-12">
              <DetalleExpediente
                datos={expedienteSeleccionado}
                coberturas={obtenerCoberturas}
                utils={utils}
                modo="caratula"
                historialSlot={(
                  <>
                    {/* SECCIÓN ÚNICA: Timeline Unificado (Trazabilidad + Comunicaciones) */}
                    <div className="mb-3">
                      <TimelineExpediente 
                        expedienteId={expedienteSeleccionado.id}
                        expedienteData={expedienteSeleccionado}
                      />
                    </div>
                  </>
                )}
              />
            </div>
            {/* Mostrar calendario para Fraccionado y Anual */}
            {expedienteSeleccionado.inicio_vigencia && (
              (expedienteSeleccionado.tipo_pago === 'Fraccionado' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
              expedienteSeleccionado.tipo_pago === 'Anual' ||
              (expedienteSeleccionado.forma_pago?.toUpperCase() === 'FRACCIONADO' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
              expedienteSeleccionado.forma_pago?.toUpperCase() === 'ANUAL'
            ) && (
              <div className="col-12">
                <CalendarioPagos 
                  key={`calendario-${expedienteSeleccionado?.id}-${historial?.length || 0}`}
                  expediente={expedienteSeleccionado}
                  calcularProximoPago={calcularProximoPago}
                  mostrarResumen={true}
                  onEnviarAviso={enviarAvisoPago}
                  historial={historial}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  );
});

// Estado inicial del formulario (definido fuera del componente)
const estadoInicialFormulario = {
  cliente_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  razon_social: '',
  nombre_comercial: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  rfc: '',
  // Campos de contacto adicional (Persona Física) o contacto principal (Persona Moral)
  contacto_nombre: '',
  contacto_apellido_paterno: '',
  contacto_apellido_materno: '',
  contacto_email: '',
  contacto_telefono_fijo: '',
  contacto_telefono_movil: '',
  compania: '',
  producto: '',
  etapa_activa: 'Emitida',
  agente: '',
  sub_agente: null,
  fecha_emision: new Date().toISOString().split('T')[0],
  inicio_vigencia: '',
  termino_vigencia: '',
  prima_pagada: '',
  cargo_pago_fraccionado: '',
  cargoPagoFraccionado: '',
  iva: '',
  total: '',
  motivo_cancelacion: null,
  motivoCancelacion: null,
  tipo_pago: 'Anual',
  frecuencia_pago: null,
  frecuenciaPago: null,
  periodo_gracia: 14,
  proximo_pago: null,
  proximoPago: null,
  estatus_pago: 'Pendiente',
  estatusPago: 'Pendiente',
  fecha_ultimo_pago: '',
  fecha_pago: '',
  plazo_pago_dias: '',
  gastos_expedicion: '',
  gastosExpedicion: '',
  subtotal: null,
  pago_unico: '',
  marca: '',
  modelo: '',
  anio: '',
  numero_serie: '',
  motor: '',
  placas: '',
  color: '',
  tipo_vehiculo: '',
  codigo_vehiculo: '',
  numero_poliza: '',
  endoso: '000000',
  inciso: '0001',
  plan: '',
  tipo_cobertura: '',
  deducible: '',
  suma_asegurada: '',
  conductor_habitual: '',
  edad_conductor: '',
  licencia_conducir: '',
  coberturas: null,
  tipo_persona: '',
  razonSocial: '',
  curp: '',
  domicilio: '',
  fecha_creacion: new Date().toISOString().split('T')[0],
  id: null,
  // Campos adicionales para pagos fraccionados y datos de póliza
  primer_pago: '',
  pagos_subsecuentes: '',
  forma_pago: '',
  uso: null,
  servicio: null,
  movimiento: null
};

// ============= COMPONENTE PRINCIPAL =============
const ModuloExpedientes = () => {
  // 🚀 MODULARIZACIÓN: Hook para manejo de expedientes
  const { 
    expedientes, 
    setExpedientes, 
    loading: loadingExpedientes, 
    error: errorExpedientes,
    cargarExpedientes 
  } = useExpedientes();
  
  const [clientes, setClientes] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [agentes, setAgentes] = useState([]);
  const [todosLosVendedores, setTodosLosVendedores] = useState([]);
  const [vendedoresMap, setVendedoresMap] = useState({});
  
  // 💰 Estados para aviso/recordatorio de pago
  const [pagoParaNotificar, setPagoParaNotificar] = useState(null);
  const [expedienteDelPago, setExpedienteDelPago] = useState(null);
  const [mostrarModalAvisoPago, setMostrarModalAvisoPago] = useState(false);
  
  // 📤 Estados para compartir expedientes
  const [destinatarioCompartirSeleccionado, setDestinatarioCompartirSeleccionado] = useState(null);
  const [destinatarioSeleccionado, setDestinatarioSeleccionado] = useState(null);
  const [clienteParaActualizar, setClienteParaActualizar] = useState(null);
  const [tipoDatoFaltante, setTipoDatoFaltante] = useState(null);
  const [canalEnvio, setCanalEnvio] = useState(null);
  const [expedienteEnEspera, setExpedienteEnEspera] = useState(null);
  const [mostrarModalContacto, setMostrarModalContacto] = useState(false);
  
  // 🚀 MODULARIZACIÓN: Hook para compartir expedientes
  const {
    compartirPorWhatsApp: compartirWhatsApp,
    compartirPorEmail: compartirEmail, 
    enviarAvisoPagoWhatsApp,
    enviarAvisoPagoEmail
  } = useCompartirExpediente({
    destinatarioCompartirSeleccionado,
    destinatarioSeleccionado,
    setClienteParaActualizar,
    setTipoDatoFaltante,
    setCanalEnvio,
    setExpedienteEnEspera,
    setMostrarModalContacto,
    setPagoParaNotificar,
    cerrarModalAvisoPago: () => {
      setPagoParaNotificar(null);
      setExpedienteDelPago(null);
      setMostrarModalAvisoPago(false);
      setDestinatarioSeleccionado(null);
    },
    cambiarEstadoExpediente: (id, nuevaEtapa) => {
      // Función para cambiar estado - implementar según tu lógica actual
      console.log('Cambiar estado expediente:', id, nuevaEtapa);
    },
    utils
  });
  
  // Estados para flujo de renovación
  const [mostrarModalCotizarRenovacion, setMostrarModalCotizarRenovacion] = useState(false);
  const [mostrarModalAutorizarRenovacion, setMostrarModalAutorizarRenovacion] = useState(false);
  const [mostrarModalPolizaRenovada, setMostrarModalPolizaRenovada] = useState(false);
  const [expedienteParaRenovacion, setExpedienteParaRenovacion] = useState(null);
  const [datosRenovacion, setDatosRenovacion] = useState({
    numeroPolizaNueva: '',
    primaNueva: '',
    totalNuevo: '',
    fechaEmisionNueva: '',
    inicioVigenciaNueva: '',
    terminoVigenciaNueva: '',
    observaciones: ''
  });
  
  useEffect(() => {
    const fetchDatos = async () => {
      // 1. Cargar agentes usando el servicio original
      const resultado = await obtenerAgentesEquipo();
      if (resultado.success) {
        const agentesOrdenados = resultado.data.sort((a, b) => {
          const nombreA = `${a.nombre} ${a.apellidoPaterno}`.toLowerCase();
          const nombreB = `${b.nombre} ${b.apellidoPaterno}`.toLowerCase();
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
        });
        setAgentes(agentesOrdenados);
      }
      
      // 2. Cargar todos los vendedores desde el endpoint correcto
      try {
        const resVendedores = await fetch(`${API_URL}/api/equipoDeTrabajo`);
        const equipoData = await resVendedores.json();
        
        // Filtrar solo los vendedores - todos los que NO son Agente
        const vendedoresData = equipoData.filter(miembro => miembro.rol !== 'Agente');
        
        // Crear mapa de vendedores por ID
        const mapaVendedores = {};
        vendedoresData.forEach(vendedor => {
          mapaVendedores[vendedor.id] = vendedor;
        });
        
        setTodosLosVendedores(vendedoresData);
        setVendedoresMap(mapaVendedores);
      } catch (error) {
        console.error('Error al cargar vendedores:', error);
        setTodosLosVendedores([]);
        setVendedoresMap({});
      }

    };
    fetchDatos();
    
    // Exponer función global para recargar agentes desde el modal de extracción
    window.recargarAgentes = (nuevosAgentes) => {
      const agentesOrdenados = nuevosAgentes.sort((a, b) => {
        const nombreA = `${a.nombre} ${a.apellidoPaterno}`.toLowerCase();
        const nombreB = `${b.nombre} ${b.apellidoPaterno}`.toLowerCase();
        return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
      });
      setAgentes(agentesOrdenados);
    };
    
    // Cleanup
    return () => {
      delete window.recargarAgentes;
    };
  }, []);

  // 🚀 MODULARIZACIÓN: Cargar clientes y usar hook para expedientes
  useEffect(() => {
    const cargarClientes = async () => {
      try {
        // 2. Obtener todos los clientes
        const resClientes = await fetch(`${API_URL}/api/clientes`);
        const clientesData = await resClientes.json();
        
        // 3. Crear un mapa de clientes por ID para búsqueda rápida
        const mapa = {};
        clientesData.forEach(cliente => {
          mapa[cliente.id] = cliente;
        });
        
        setClientes(clientesData);
        setClientesMap(mapa);
      } catch (err) {
        console.error('Error al cargar clientes:', err);
      }
    };

    cargarClientes();
    // Los expedientes se cargan automáticamente con useExpedientes
  }, []);
  
  // 💰 Funciones para aviso/recordatorio de pago
  const [destinatariosDisponibles, setDestinatariosDisponibles] = useState([]);

  const enviarAvisoPago = useCallback(async (pago, expediente) => {
    // Validar que el expediente tenga cliente_id
    if (!expediente?.cliente_id) {
      toast.error('Esta póliza no tiene un cliente asociado');
      return;
    }
    
    // Obtener datos del cliente para determinar destinatarios
    try {
      const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
      if (respCliente?.success) {
        const cliente = respCliente.data;
        const destinatarios = [];
        
        // Agregar cliente como opción
        const nombreCliente = cliente.tipoPersona === 'Persona Moral'
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
        
        if (nombreCliente) {
          destinatarios.push({
            id: 'cliente',
            nombre: nombreCliente,
            telefono: cliente.telefonoMovil || cliente.telefono_movil,
            email: cliente.email,
            tipo: 'Cliente'
          });
        }
        
        // Agregar contacto principal si existe
        const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
        if (tieneContactoPrincipal) {
          const nombreContacto = `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim();
          const telefonoContacto = cliente?.contacto_telefono_movil || cliente?.contactoTelefonoMovil;
          const emailContacto = cliente?.contacto_email || cliente?.contactoEmail;
          
          if (nombreContacto) {
            destinatarios.push({
              id: 'contacto',
              nombre: nombreContacto,
              telefono: telefonoContacto,
              email: emailContacto,
              tipo: 'Contacto Principal'
            });
          }
        }
        
        setDestinatariosDisponibles(destinatarios);
        setDestinatarioSeleccionado(destinatarios[0]); // Seleccionar el primero por defecto
        
        setPagoParaNotificar(pago);
        setExpedienteDelPago(expediente);
        setMostrarModalAvisoPago(true);
      } else {
        toast.error('No se pudo obtener la información del cliente');
      }
    } catch (error) {
      console.error('Error al obtener destinatarios:', error);
      toast.error('Error al cargar datos del cliente. Verifica que el cliente exista.');
    }
  }, []);
  
  const cerrarModalAvisoPago = useCallback(() => {
    setMostrarModalAvisoPago(false);
    setPagoParaNotificar(null);
    setExpedienteDelPago(null);
    setDestinatariosDisponibles([]);
    setDestinatarioSeleccionado(null);
  }, []);
  
  const [vistaActual, setVistaActual] = useState('lista');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [expedienteACancelar, setExpedienteACancelar] = useState(null);
  const [mostrarModalMetodoCaptura, setMostrarModalMetodoCaptura] = useState(false);
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  
    // Estados para manejo de PDFs
    const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
    const [subiendoPDF, setSubiendoPDF] = useState(false);

  // Modal de compartir unificado
  const [mostrarModalCompartir, setMostrarModalCompartir] = useState(false);
  const [expedienteParaCompartir, setExpedienteParaCompartir] = useState(null);
  const [destinatariosCompartir, setDestinatariosCompartir] = useState([]);
  const [tipoEnvio, setTipoEnvio] = useState('poliza'); // 'poliza' o 'pago'
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  
  const abrirModalCompartir = useCallback(async (expediente) => {
    // Validar que el expediente tenga cliente_id
    if (!expediente?.cliente_id) {
      toast.error('Esta póliza no tiene un cliente asociado');
      return;
    }
    
  // Obtener datos del cliente para determinar destinatarios
    try {
      const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
      if (respCliente?.success) {
        const cliente = respCliente.data;
        const destinatarios = [];
        
        // Agregar cliente como opción
        const nombreCliente = cliente.tipoPersona === 'Persona Moral'
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
        
        if (nombreCliente) {
          destinatarios.push({
            id: 'cliente',
            nombre: nombreCliente,
            telefono: cliente.telefonoMovil || cliente.telefono_movil,
            email: cliente.email,
            tipo: 'Cliente'
          });
        }
        
        // Agregar contacto principal si existe
        const tieneContactoPrincipal = !!(cliente?.contacto_nombre || cliente?.contactoNombre);
        if (tieneContactoPrincipal) {
          const nombreContacto = `${cliente?.contacto_nombre || cliente?.contactoNombre || ''} ${cliente?.contacto_apellido_paterno || cliente?.contactoApellidoPaterno || ''} ${cliente?.contacto_apellido_materno || cliente?.contactoApellidoMaterno || ''}`.trim();
          const telefonoContacto = cliente?.contacto_telefono_movil || cliente?.contactoTelefonoMovil;
          const emailContacto = cliente?.contacto_email || cliente?.contactoEmail;
          
          if (nombreContacto) {
            destinatarios.push({
              id: 'contacto',
              nombre: nombreContacto,
              telefono: telefonoContacto,
              email: emailContacto,
              tipo: 'Contacto Principal'
            });
          }
        }
        
        setDestinatariosCompartir(destinatarios);
        setDestinatarioCompartirSeleccionado(destinatarios[0]);
        
        // Configurar pago por defecto (primer pendiente)
        const primerPagoPendiente = expediente.recibos?.find(r => r.estado_pago !== 'Pagado');
        setPagoSeleccionado(primerPagoPendiente || expediente.recibos?.[0] || null);
        
        setTipoEnvio('poliza'); // Por defecto mostrar póliza
        setExpedienteParaCompartir(expediente);
        setMostrarModalCompartir(true);
      } else {
        toast.error('No se pudo obtener la información del cliente');
      }
    } catch (error) {
      console.error('Error al obtener destinatarios:', error);
      toast.error('Error al cargar datos del cliente. Verifica que el cliente exista.');
    }
  }, [enviarAvisoPago]);
  
  const cerrarModalCompartir = useCallback(() => {
    setMostrarModalCompartir(false);
    setExpedienteParaCompartir(null);
    setDestinatariosCompartir([]);
    setDestinatarioCompartirSeleccionado(null);
    setTipoEnvio('poliza');
    setPagoSeleccionado(null);
    setPagoSeleccionado(null);
  }, []);

  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  const [historialExpediente, setHistorialExpediente] = useState([]); // Historial del expediente seleccionado
  
  // 🚀 MODULARIZACIÓN: Hook para manejo de pagos
  const {
    mostrarModalPago,
    setMostrarModalPago,
    expedienteParaPago,
    comprobantePago,
    setComprobantePago,
    fechaUltimoPago,
    setFechaUltimoPago,
    numeroReciboPago,
    setNumeroReciboPago,
    procesandoPago,
    abrirModalAplicarPago,
    procesarPagoConComprobante
  } = usePagos({ expedientes, setExpedientes, cargarExpedientes });
  
  useEffect(() => {
  fetch(`${API_URL}/api/aseguradoras`)
      .then(res => res.json())
      .then(data => {
        // Filtrar solo aseguradoras activas
        const aseguradorasActivas = Array.isArray(data) ? data.filter(a => a.activo === 1 || a.activo === true) : [];
        setAseguradoras(aseguradorasActivas);
      })
      .catch(err => console.error('Error al cargar aseguradoras:', err));
  }, []);

  useEffect(() => {
    const cargarTiposProductos = async () => {
      try {
        const resultado = await obtenerTiposProductosActivos();
        if (resultado.success) {
          setTiposProductos(resultado.data);
        } else {
          console.error('Error al cargar tipos de productos:', resultado.error);
          // Fallback a productos estáticos si hay error
          setTiposProductos([
            { id: 1, nombre: 'Autos' },
            { id: 2, nombre: 'Vida' },
            { id: 3, nombre: 'Daños' },
            { id: 4, nombre: 'Equipo pesado' },
            { id: 5, nombre: 'Embarcaciones' },
            { id: 6, nombre: 'Ahorro' }
          ]);
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
        setTiposProductos([
          { id: 1, nombre: 'Autos' },
          { id: 2, nombre: 'Vida' },
          { id: 3, nombre: 'Daños' },
          { id: 4, nombre: 'Equipo pesado' },
          { id: 5, nombre: 'Embarcaciones' },
          { id: 6, nombre: 'Ahorro' }
        ]);
      }
    };

    cargarTiposProductos();
  }, []);

  // Recargar solo CLIENTES y su mapa cuando alguien emita el evento 'clientes-actualizados'
  const recargarClientes = useCallback(async () => {
    try {
      const resClientes = await fetch(`${API_URL}/api/clientes?t=${Date.now()}`);
      const clientesData = await resClientes.json();
      const mapa = {};
      clientesData.forEach(c => { mapa[c.id] = c; });
  setClientes(clientesData);
  setClientesMap(mapa);
    } catch (error) {
      console.error('❌ Error recargando clientes tras evento:', error);
    }
  }, []);

  useEffect(() => {
    const handler = () => recargarClientes();
    window.addEventListener('clientes-actualizados', handler);
    return () => window.removeEventListener('clientes-actualizados', handler);
  }, [recargarClientes]);

  const companias = useMemo(() => {
    return aseguradoras
      .map(a => a.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [aseguradoras]);
  
  const productos = useMemo(() => {
    return tiposProductos
      .map(p => p.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiposProductos]);
  
  const etapasActivas = useMemo(() => [
    'En cotización',
    'Cotización enviada',
    'Autorizado',
    'En proceso emisión',
    'Emitida',
    'Enviada al Cliente',
    'En Vigencia',
    'Renovación en Proceso',
    'Renovada',
    'Vencida',
    'Cancelada'
  ], []);


  const tiposPago = useMemo(() => ['Anual', 'Fraccionado'], []);
  const frecuenciasPago = useMemo(() => Object.keys(CONSTANTS.PAGOS_POR_FRECUENCIA).sort(), []);
  const periodosGracia = useMemo(() => [14, 30], []);
  const estatusPago = useMemo(() => ['Pendiente', 'Por Vencer', 'Vencido', 'Pagado', 'Cancelado'], []);
  const motivosCancelacion = useMemo(() => [
    'Cliente desistió',
    'Documentación incompleta',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Precio muy alto',
    'Otro'
  ], []);

  const tiposVehiculo = useMemo(() => ['Deportivo', 'Hatchback', 'Pickup', 'Sedán', 'SUV', 'Vagoneta', 'Otro'].sort(), []);
  const tiposCobertura = useMemo(() => ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)', 'Integral'].sort(), []);
  const marcasVehiculo = useMemo(() => [
    'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
    'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Renault', 'Seat', 
    'Suzuki', 'Toyota', 'Volkswagen', 'Volvo', 'Otra'
  ], []);

  const [formulario, setFormulario] = useState(estadoInicialFormulario);
  const [formularioOriginal, setFormularioOriginal] = useState(null); // Snapshot al abrir edición
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const debugLogOnceRef = useRef(false);

  /**
   * Remueve un pago desde el calendario del formulario
   * Actualiza el estado local, recalcula estatus y campos derivados
   * Los cambios se guardan al hacer click en "Guardar"
   */
  /**
   * Eliminar un pago del recibo y recalcular estatus
   * Se actualiza solo localmente, los cambios se guardan al hacer clic en "Guardar"
   */
  const handleEliminarPago = useCallback((pago, expediente) => {
    // Solo actualizar el estado local del calendario
    setFormulario(prev => {
      if (!prev.recibos || !Array.isArray(prev.recibos)) {
        return prev;
      }
      
      const recibosActualizados = prev.recibos.map(recibo => {
        if (recibo.numero_recibo === pago.numero) {
          const nuevoEstatus = estatusPagosUtils.calcularEstatusRecibo(
            recibo.fecha_vencimiento, 
            null
          );
          
          return {
            ...recibo,
            fecha_pago_real: null,
            fecha_captura_pago: null,
            comprobante_url: null,
            comprobante_nombre: null,
            estatus: nuevoEstatus
          };
        }
        return recibo;
      });
      
      const recibosPagados = recibosActualizados.filter(r => r.fecha_pago_real).length;
      const totalRecibos = recibosActualizados.length;
      
      let nuevoEstatusPago = 'Pendiente';
      if (recibosPagados === 0) {
        nuevoEstatusPago = 'Pendiente';
      } else if (recibosPagados < totalRecibos) {
        nuevoEstatusPago = 'Pago por vencer';
      } else {
        nuevoEstatusPago = 'Pagado';
      }
      
      return {
        ...prev,
        recibos: recibosActualizados,
        ultimo_recibo_pagado: recibosPagados,
        estatus_pago: nuevoEstatusPago,
        estatusPago: nuevoEstatusPago
      };
    });
  }, [setFormulario]);

  // 📸 Capturar snapshot cuando el formulario esté completamente cargado en modo edición
  // 📸 CAPTURAR SNAPSHOT cuando el formulario termine de cargarse (PDF + BD + Cálculos)
  useEffect(() => {
    // Si hay un snapshot pendiente Y el formulario está listo
    if (globalSnapshotPendiente && formulario) {
      // Verificar que los datos están completos (o al menos tiene algo cargado)
      const tieneNumeroPoliza = formulario.numero_poliza;
      const tieneCompania = formulario.compania;
      
      if (tieneNumeroPoliza && tieneCompania) {
        console.log('📸 Capturando snapshot del formulario completo:', {
          numero_poliza: formulario.numero_poliza,
          compania: formulario.compania,
          contacto_nombre: formulario.contacto_nombre,
          fecha_emision: formulario.fecha_emision,
          total_campos: Object.keys(formulario).filter(k => !k.startsWith('_')).length
        });
        setFormularioOriginal(JSON.parse(JSON.stringify(formulario)));
        setGlobalSnapshotPendiente(false);
      }
    }
  }, [formulario]); // Se ejecuta cada vez que el formulario cambia
  
  // Limpiar flag cuando se cambia de vista
  useEffect(() => {
    if (vistaActual !== 'formulario') {
      setGlobalSnapshotPendiente(false);
    }
  }, [modoEdicion]);

  // Debug solicitado: imprimir TODOS los campos visibles del editor con su valor actual
  useEffect(() => {
    if (vistaActual === 'formulario' && modoEdicion && !debugLogOnceRef.current) {
      const f = formulario || {};
      const resumen = {
        // Identificación cliente
        cliente_id: f.cliente_id ?? '',
        tipoPersona: clienteSeleccionado?.tipoPersona ?? '',
        // Datos del cliente
        nombre: f.nombre ?? '',
        apellido_paterno: f.apellido_paterno ?? '',
        apellido_materno: f.apellido_materno ?? '',
        razon_social: f.razon_social ?? '',
        nombre_comercial: f.nombre_comercial ?? '',
        email: f.email ?? '',
        telefono_fijo: f.telefono_fijo ?? '',
        telefono_movil: f.telefono_movil ?? '',
        rfc: f.rfc ?? '',
        // Contacto / Gestor
        contacto_nombre: f.contacto_nombre ?? '',
        contacto_apellido_paterno: f.contacto_apellido_paterno ?? '',
        contacto_apellido_materno: f.contacto_apellido_materno ?? '',
        contacto_email: f.contacto_email ?? '',
        contacto_telefono_fijo: f.contacto_telefono_fijo ?? '',
        contacto_telefono_movil: f.contacto_telefono_movil ?? '',
        // Seguro
        compania: f.compania ?? '',
        producto: f.producto ?? '',
        etapa_activa: f.etapa_activa ?? '',
        // Vehículo
        marca: f.marca ?? '',
        modelo: f.modelo ?? '',
        anio: f.anio ?? '',
        numero_serie: f.numero_serie ?? '',
        placas: f.placas ?? '',
        color: f.color ?? '',
        tipo_vehiculo: f.tipo_vehiculo ?? '',
        // Póliza
        numero_poliza: f.numero_poliza ?? '',
        tipo_cobertura: f.tipo_cobertura ?? '',
        deducible: f.deducible ?? '',
        suma_asegurada: f.suma_asegurada ?? '',
        uso: f.uso ?? f.uso_poliza ?? '',
        servicio: f.servicio ?? f.servicio_poliza ?? '',
        movimiento: f.movimiento ?? f.movimiento_poliza ?? '',
        // Fechas
        fecha_emision: f.fecha_emision ?? '',
        inicio_vigencia: f.inicio_vigencia ?? '',
        termino_vigencia: f.termino_vigencia ?? '',
        // Pago
        tipo_pago: f.tipo_pago ?? '',
        frecuenciaPago: f.frecuenciaPago ?? '',
        periodo_gracia: f.periodo_gracia ?? '',
        fecha_vencimiento_pago: f.fecha_vencimiento_pago ?? f.fecha_pago ?? '',
        estatusPago: f.estatusPago ?? '',
        // Montos
        prima_pagada: f.prima_pagada ?? '',
        cargo_pago_fraccionado: f.cargo_pago_fraccionado ?? '',
        gastos_expedicion: f.gastos_expedicion ?? '',
        subtotal: f.subtotal ?? '',
        iva: f.iva ?? '',
        total: f.total ?? '',
        // Conductor
        conductor_habitual: f.conductor_habitual ?? '',
        edad_conductor: f.edad_conductor ?? '',
        licencia_conducir: f.licencia_conducir ?? '',
        // Agentes
        agente: f.agente ?? '',
        sub_agente: f.sub_agente ?? ''
      };

      const tabla = Object.entries(resumen).map(([campo, valor]) => ({ campo, valor }));
      console.groupCollapsed('🧾 Formulario (Editar) — Campos y valores');
      console.table(tabla);
      const vacios = Object.keys(resumen).filter(k => resumen[k] === '' || resumen[k] === null || resumen[k] === undefined);
      if (vacios.length) console.info('Campos vacíos:', vacios);
      console.groupEnd();
      debugLogOnceRef.current = true;
    }
  }, [vistaActual, modoEdicion, formulario, clienteSeleccionado]);

  // Resetear el flag cuando salgamos de la vista de formulario o del modo edición
  useEffect(() => {
    if (!(vistaActual === 'formulario' && modoEdicion)) {
      debugLogOnceRef.current = false;
    }
  }, [vistaActual, modoEdicion]);

  // 🎯 RECALCULAR automáticamente campos derivados cuando cambian las fechas de vigencia
  useEffect(() => {
    // Solo recalcular si estamos en el formulario y hay fechas válidas
    if (vistaActual !== 'formulario' || !formulario.inicio_vigencia) return;
    
    // 🔥 NO recalcular si la fecha viene de recibo real
    if (formulario._no_recalcular_fecha_vencimiento) {
      console.log('🔒 [USEEFFECT] Saltando recálculo - fecha viene de recibo real');
      return;
    }
    
    const recalcularCamposDependientes = () => {
      // 1. Calcular término de vigencia (inicio + 1 año)
      const fechaInicio = new Date(formulario.inicio_vigencia);
      const fechaTermino = new Date(fechaInicio);
      fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
      const nuevoTermino = fechaTermino.toISOString().split('T')[0];
      
      // 2. Calcular aviso de renovación (30 días antes del término)
      const fechaAviso = new Date(nuevoTermino);
      fechaAviso.setDate(fechaAviso.getDate() - 30);
      const nuevoAviso = fechaAviso.toISOString().split('T')[0];
      
      // 3. Calcular próximo pago (inicio + periodo de gracia)
      const periodoGracia = formulario.periodo_gracia 
        ? parseInt(formulario.periodo_gracia, 10)
        : (formulario.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
      
      const fechaPago = new Date(fechaInicio);
      fechaPago.setDate(fechaPago.getDate() + periodoGracia);
      const nuevoProximoPago = fechaPago.toISOString().split('T')[0];
      
      // 4. Calcular estatus de pago
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaVenc = new Date(nuevoProximoPago);
      fechaVenc.setHours(0, 0, 0, 0);
      
      let nuevoEstatus = 'Pendiente';
      if (formulario.estatusPago === 'Pagado') {
        nuevoEstatus = 'Pagado';
      } else if (fechaVenc < hoy) {
        nuevoEstatus = 'Vencido';
      } else if (Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24)) <= 15) {
        nuevoEstatus = 'Por Vencer';
      }
      
      // Solo actualizar si cambió algo
      if (formulario.termino_vigencia !== nuevoTermino ||
          formulario.fecha_aviso_renovacion !== nuevoAviso ||
          formulario.proximoPago !== nuevoProximoPago ||
          formulario.fecha_pago !== nuevoProximoPago ||
          formulario.fecha_vencimiento_pago !== nuevoProximoPago ||
          formulario.estatusPago !== nuevoEstatus) {
        
        setFormulario(prev => ({
          ...prev,
          termino_vigencia: nuevoTermino,
          fecha_aviso_renovacion: nuevoAviso,
          proximoPago: nuevoProximoPago,
          fecha_pago: nuevoProximoPago,
          // 🔥 PROTEGER fecha_vencimiento_pago si viene de recibo real
          fecha_vencimiento_pago: prev._no_recalcular_fecha_vencimiento 
            ? prev.fecha_vencimiento_pago 
            : nuevoProximoPago,
          estatusPago: nuevoEstatus
        }));
      }
    };
    
    recalcularCamposDependientes();
  }, [formulario.inicio_vigencia, formulario.compania, formulario.periodo_gracia, vistaActual]);

  const calculartermino_vigencia = useCallback((inicio_vigencia) => {
    if (!inicio_vigencia) return '';
    
    const fechaInicio = new Date(inicio_vigencia);
    const fechaTermino = new Date(fechaInicio);
    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
    
    return fechaTermino.toISOString().split('T')[0];
  }, []);

  const calcularProximoPago = useCallback((inicio_vigencia, tipo_pago, frecuenciaPago, compania, numeroPago = 1, periodoGraciaCustom = null) => {
    if (!inicio_vigencia) return '';
    
    // 🔧 Usar periodo de gracia personalizado (del PDF) o calcular según la compañía
    const periodoGracia = periodoGraciaCustom !== null 
      ? periodoGraciaCustom 
      : (compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    // 🔥 Crear fecha en hora local para evitar problemas de timezone
    const [year, month, day] = inicio_vigencia.split('-');
    const fechaInicio = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (numeroPago === 1) {
      // ✅ Primer pago: fecha inicio + periodo de gracia (DÍAS)
      const fechaPago = new Date(fechaInicio);
      fechaPago.setDate(fechaPago.getDate() + periodoGracia);
      const resultado = fechaPago.toISOString().split('T')[0];
      return resultado;
    }
    
    if (tipo_pago === 'Anual') return '';
    
    if (tipo_pago === 'Fraccionado' && frecuenciaPago) {
      // ✅ Verificar que no exceda el número total de pagos permitidos
      const numeroPagosMaximo = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuenciaPago] || 0;
      console.log('🔥 DEBUG calcularProximoPago - Validando límites:', {
        numeroPago,
        numeroPagosMaximo,
        frecuenciaPago,
        excedeLimite: numeroPago > numeroPagosMaximo
      });
      
      if (numeroPago > numeroPagosMaximo) {
        console.log('🔥 DEBUG calcularProximoPago - Excede límite, retornando vacío');
        return ''; // No hay más pagos después del último
      }
      
      // ✅ Pagos subsecuentes: fecha inicio + N meses (SIN periodo de gracia)
      // Trimestral: Pago #2 = inicio + 3 meses, Pago #3 = inicio + 6 meses, etc.
      const fechaPagoSubsecuente = new Date(fechaInicio);
      const mesesAAgregar = (numeroPago - 1) * CONSTANTS.MESES_POR_FRECUENCIA[frecuenciaPago];
      fechaPagoSubsecuente.setMonth(fechaPagoSubsecuente.getMonth() + mesesAAgregar);
      
      const resultado = fechaPagoSubsecuente.toISOString().split('T')[0];
      return resultado;
    }
    
    return '';
  }, []);

  const calcularEstatusPago = useCallback((proximoPago, estatusActual) => {
    // Si ya está marcado como pagado completamente, mantener ese estado
    if (estatusActual === 'Pagado') return 'Pagado';
    
    // Si no hay fecha de pago, el estado es Pendiente
    if (!proximoPago) return 'Pendiente';
    
    // Calcular días restantes
    const fechaPago = new Date(proximoPago);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaPago.setHours(0, 0, 0, 0);
    
    const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
    
    // Si la fecha ya pasó, está vencido
    if (diasRestantes < 0) return 'Vencido';
    
    // Si faltan 15 días o menos, está por pagar (listo para cobrar)
    if (diasRestantes <= 15) return 'Por Pagar';
    
    // Si aún faltan más de 15 días, está pendiente (aún no urgente)
    return 'Pendiente';
  }, []);

  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    // Cálculos automáticos de vigencias y fechas
    
    // ✅ Siempre recalcular el término de vigencia a partir del inicio
    // Esto permite que el formulario reaccione cuando el usuario edita inicio_vigencia
    const termino_vigencia = calculartermino_vigencia(formularioActual.inicio_vigencia);
    
    
    // Calcular periodo de gracia: usar valor extraído del PDF si existe (convertir a número), sino aplicar regla de negocio
    const periodoGracia = formularioActual.periodo_gracia 
      ? parseInt(formularioActual.periodo_gracia, 10)
      : (formularioActual.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    // ⚠️ Si la fecha fue editada manualmente, NO recalcular
    if (formularioActual._fechaManual) {
      console.log('⏭️ Saltando recálculo automático - Fecha editada manualmente');
      const resultado = {
        ...formularioActual,
        termino_vigencia,
        periodo_gracia: periodoGracia
      };
      delete resultado._fechaManual; // Limpiar bandera temporal
      return resultado;
    }
    
    // 🔥 Si la fecha viene de recibo real, NO recalcular
    if (formularioActual._no_recalcular_fecha_vencimiento) {
      console.log('🔒 [CÁLCULOS] Protegiendo fecha_vencimiento_pago que viene de recibo real:', formularioActual.fecha_vencimiento_pago);
      const resultado = {
        ...formularioActual,
        termino_vigencia,
        periodo_gracia: periodoGracia
      };
      // Mantener las fechas tal como están
      return resultado;
    }
    
    // Calcular proximoPago según el tipo de pago
    let proximoPago = '';
    
    if (formularioActual.tipo_pago === 'Fraccionado') {
      // ✅ Fraccionado: primer pago = inicio + periodo de gracia
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        formularioActual.tipo_pago,
        formularioActual.frecuenciaPago,
        formularioActual.compania,
        1,
        periodoGracia
      );
    } else if (formularioActual.tipo_pago === 'Anual') {
      // ✅ Anual: aplicar periodo de gracia para el primer pago siempre que cambie inicio
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        'Anual',
        null,
        formularioActual.compania,
        1,
        periodoGracia
      );
    }
    
    // Calcular estatusPago basado en la fecha de vencimiento
    const fechaParaCalculo = formularioActual.fecha_vencimiento_pago || proximoPago;
    const estatusPago = calcularEstatusPago(fechaParaCalculo, formularioActual.estatusPago);
    
    // ✨ Calcular fecha_aviso_renovacion (30 días antes del término de vigencia)
    let fechaAvisoRenovacion = null;
    if (termino_vigencia) {
      const fechaTermino = new Date(termino_vigencia);
      fechaTermino.setDate(fechaTermino.getDate() - 30);
      fechaAvisoRenovacion = fechaTermino.toISOString().split('T')[0];
    }
    
    // Retornar con todos los campos sincronizados
    const resultado = { 
      ...formularioActual, 
      termino_vigencia, 
      proximoPago, 
      fecha_pago: proximoPago, // Sincronizar fecha_pago con proximoPago
      // 🔥 PROTEGER fecha_vencimiento_pago si viene de recibo real
      fecha_vencimiento_pago: formularioActual._no_recalcular_fecha_vencimiento 
        ? formularioActual.fecha_vencimiento_pago 
        : proximoPago,
      estatusPago, 
      periodo_gracia: periodoGracia,
      fecha_aviso_renovacion: fechaAvisoRenovacion // Precalcular fecha de aviso
    };
    

    
    return resultado;
  }, [calculartermino_vigencia, calcularProximoPago, calcularEstatusPago]);

  const obtenerSiguienteEstado = useCallback((estadoActual) => {
    const flujo = {
      'En cotización': 'Cotización enviada',
      'Cotización enviada': 'Autorizado',
      'Autorizado': 'En proceso emisión',
      'En proceso emisión': 'Emitida',
      'Emitida': 'Pendiente de pago',
      'Pendiente de pago': 'Pagado'
    };
    return flujo[estadoActual];
  }, []);

  const puedeAvanzarEstado = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(estado);
  }, []);

  const puedeCancelar = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Pendiente de pago'].includes(estado);
  }, []);

  const cambiarEstadoExpediente = useCallback(async (expedienteId, nuevoEstado, motivo = '') => {
    try {
      // Obtener expediente actual para conocer la etapa anterior
      const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
      const etapaAnterior = expedienteActual?.etapa_activa;

      // Solo campos de gestión que cambian
      const datosActualizacion = {
        etapa_activa: nuevoEstado,
        fecha_actualizacion: new Date().toISOString().split('T')[0]
      };
      
      // ✅ IMPORTANTE: Si se cancela la póliza, asignar fecha_cancelacion Y cambiar estatus de pago
      if (nuevoEstado === 'Cancelada') {
        datosActualizacion.fecha_cancelacion = new Date().toISOString().split('T')[0];
        datosActualizacion.estatus_pago = 'Cancelado';
        console.log('📅 Asignando fecha_cancelacion:', datosActualizacion.fecha_cancelacion);
        console.log('💳 Cambiando estatus_pago a: Cancelado');
      }
      
      if (motivo) {
        datosActualizacion.motivoCancelacion = motivo;
      }

      console.log('🔄 Cambiando etapa:', { expedienteId, etapaAnterior, nuevoEstado });

      // Actualizar en BD (solo enviar los campos que cambian)
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Etapa actualizada en BD');

      // ✨ NUEVO: Registrar cambio de etapa en historial de trazabilidad
      try {
        // Determinar el tipo de evento según el cambio de etapa
        let tipoEvento = historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS; // Default
        let descripcion = motivo ? `Motivo: ${motivo}` : undefined;
        
        // Mapear etapas a eventos específicos
        // TODO: Cuando implementemos módulo de cotizaciones, agregar aquí:
        // - Botón "Enviar cotización" → cambia a 'Cotización enviada' + COTIZACION_ENVIADA
        // - Botón "Autorizar" → cambia a 'Autorizado' + COTIZACION_AUTORIZADA
        // - Botón "Iniciar emisión" → cambia a 'En proceso emisión' + EMISION_INICIADA
        
        if (nuevoEstado === 'Cotización enviada' && etapaAnterior === 'En cotización') {
          tipoEvento = historialService.TIPOS_EVENTO.COTIZACION_ENVIADA;
          descripcion = 'Cotización enviada al cliente para revisión';
        } else if (nuevoEstado === 'Autorizado' && etapaAnterior === 'Cotización enviada') {
          tipoEvento = historialService.TIPOS_EVENTO.COTIZACION_AUTORIZADA;
          descripcion = 'Cotización autorizada por el cliente';
        } else if (nuevoEstado === 'En proceso emisión') {
          tipoEvento = historialService.TIPOS_EVENTO.EMISION_INICIADA;
          descripcion = 'Proceso de emisión de póliza iniciado';
        } else if (nuevoEstado === 'Emitida' && etapaAnterior !== 'Enviada al Cliente') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_EMITIDA;
          descripcion = 'Póliza emitida correctamente';
        } else if (nuevoEstado === 'Renovación en Proceso') {
          tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_INICIADA;
          descripcion = 'Renovación de póliza iniciada - pendiente de pago';
        } else if (nuevoEstado === 'Renovada') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_RENOVADA;
          descripcion = 'Póliza renovada exitosamente - pago aplicado';
        } else if (nuevoEstado === 'Cancelada') {
          tipoEvento = historialService.TIPOS_EVENTO.POLIZA_CANCELADA;
          descripcion = motivo ? `Motivo: ${motivo}` : 'Póliza cancelada sin especificar motivo';
        }
        
        await historialService.registrarCambioEtapa(
          expedienteId,
          expedienteActual?.cliente_id,
          etapaAnterior,
          nuevoEstado,
          'Sistema', // TODO: Obtener nombre del usuario actual
          descripcion,
          tipoEvento
        );
        console.log(`✅ Evento "${tipoEvento}" registrado en historial de trazabilidad`);
      } catch (error) {
        console.error('⚠️ Error al registrar cambio de etapa en historial:', error);
      }

      // Actualizar localmente
      setExpedientes(prev => prev.map(exp => {
        if (exp.id === expedienteId) {
          // Combinar los datos actualizados y normalizar nombres de campos
          const expedienteActualizado = { ...exp, ...datosActualizacion };
          
          // Si se actualizó estatus_pago, también actualizar estatusPago para el frontend
          if (datosActualizacion.estatus_pago) {
            expedienteActualizado.estatusPago = datosActualizacion.estatus_pago;
          }
          
          return expedienteActualizado;
        }
        return exp;
      }));
    } catch (error) {
      console.error('❌ Error al cambiar etapa:', error);
  toast.error('Error al actualizar: ' + error.message);
    }
  }, [expedientes]);

  const avanzarEstado = useCallback((expediente) => {
    const siguienteEstado = obtenerSiguienteEstado(expediente.etapa_activa);
    if (siguienteEstado) {
      cambiarEstadoExpediente(expediente.id, siguienteEstado);
    }
  }, [obtenerSiguienteEstado, cambiarEstadoExpediente]);

  const iniciarCancelacion = useCallback((expediente) => {
    setExpedienteACancelar(expediente);
    setMostrarModalCancelacion(true);
  }, []);

  const confirmarCancelacion = useCallback(() => {
    if (motivoCancelacion && expedienteACancelar) {
      cambiarEstadoExpediente(expedienteACancelar.id, 'Cancelada', motivoCancelacion);
      setMostrarModalCancelacion(false);
      setMotivoCancelacion('');
      setExpedienteACancelar(null);
    }
  }, [motivoCancelacion, expedienteACancelar, cambiarEstadoExpediente]);

  // ✨ Verificar vigencias y registrar eventos automáticos
  const verificarVigenciasAutomaticas = useCallback(async (expedientesLista) => {
    // TODO: Implementar como job programado en el backend
    // Por ahora solo registra eventos si detecta cambios
    console.log('🔍 Verificación de vigencias pendiente (implementar en backend)');
    
    // La lógica ya existe en:
    // - utils.calcularDiasRestantes() para calcular días
    // - useEstatusExpediente para calcular estatus de pago
    // Solo falta conectar con eventos de historial cuando se implemente job automático
  }, []);

  // ✨ NUEVO: Manejar guardado de contacto faltante
  const handleGuardarContactoFaltante = useCallback(async (valorContacto) => {
    try {
      if (!clienteParaActualizar || !tipoDatoFaltante) {
        throw new Error('Datos incompletos para actualizar cliente');
      }

      console.log('💾 Actualizando cliente con contacto faltante:', {
        cliente_id: clienteParaActualizar.id,
        campo: tipoDatoFaltante,
        valor: valorContacto
      });

      // Preparar datos según tipo de persona
      const datosActualizacion = {};
      
      if (clienteParaActualizar.tipoPersona === 'Persona Moral') {
        // Persona Moral: actualizar contacto_* (contacto principal)
        if (tipoDatoFaltante === 'email') {
          datosActualizacion.contacto_email = valorContacto;
        } else if (tipoDatoFaltante === 'telefono_movil') {
          datosActualizacion.contacto_telefono_movil = valorContacto;
        }
      } else {
        // Persona Física: actualizar campos principales del cliente
        if (tipoDatoFaltante === 'email') {
          datosActualizacion.email = valorContacto;
        } else if (tipoDatoFaltante === 'telefono_movil') {
          datosActualizacion.telefonoMovil = valorContacto;
        }
      }

      // Actualizar en BD
      const response = await fetch(`${API_URL}/api/clientes/${clienteParaActualizar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error al actualizar cliente: ${response.status}`);
      }

      const resultado = await response.json();
      console.log('✅ Cliente actualizado exitosamente:', resultado);

      // Actualizar clientesMap local
      const clienteActualizado = resultado.data || resultado;
      setClientesMap(prevMap => ({
        ...prevMap,
        [clienteParaActualizar.id]: {
          ...prevMap[clienteParaActualizar.id],
          ...clienteActualizado,
          // Normalizar campos
          email: clienteActualizado.email,
          telefono_movil: clienteActualizado.telefono_movil || clienteActualizado.telefonoMovil,
          contacto_email: clienteActualizado.contacto_email,
          contacto_telefono_movil: clienteActualizado.contacto_telefono_movil
        }
      }));

  // Cerrar modal
  setMostrarModalContacto(false);

  // Notificar éxito (si hay canalEnvio y expedienteEnEspera, se hará reintento automático vía onGuardarYContinuar)
  const tipoContacto = tipoDatoFaltante === 'email' ? 'Correo electrónico' : 'Teléfono de contacto';
  toast.success(`${tipoContacto} actualizado correctamente${canalEnvio ? '. Reintentando envío…' : '. Puedes continuar con el envío.'}`);

  // Limpiar parcialmente (dejamos canalEnvio y expedienteEnEspera para el reintento automático)
  setClienteParaActualizar(null);
  setTipoDatoFaltante(null);

      // ⚠️ NO reintentar automáticamente aquí para evitar referencia circular
      // El usuario deberá hacer clic nuevamente en compartir
      // (El dato ya está actualizado, así que ahora funcionará)

    } catch (error) {
      console.error('❌ Error al guardar contacto:', error);
      throw error; // Propagar error para que el modal lo muestre
    }
  }, [clienteParaActualizar, tipoDatoFaltante, canalEnvio, expedienteEnEspera]);

  const compartirPorWhatsApp = useCallback(async (expediente) => {
    try {
      // Usar destinatario seleccionado si está disponible, sino obtener del cliente
      let telefono, nombreDestinatario;
      
      if (destinatarioCompartirSeleccionado) {
        telefono = destinatarioCompartirSeleccionado.telefono;
        nombreDestinatario = destinatarioCompartirSeleccionado.nombre;
      } else {
        // Obtener datos del cliente (fallback cuando no hay destinatario seleccionado)
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (!respCliente?.success) {
          toast.error('No se pudo obtener la información del cliente');
          return;
        }
        const cliente = respCliente.data;
        telefono = cliente?.telefonoMovil || cliente?.telefono_movil;
        nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
      }
      
      // ✨ NUEVO: Si no tiene teléfono, abrir modal para capturarlo
      if (!telefono) {
        console.log('⚠️ Destinatario sin teléfono móvil, abriendo modal de captura');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (respCliente?.success) {
          setClienteParaActualizar(respCliente.data);
          setTipoDatoFaltante('telefono_movil');
          setCanalEnvio('WhatsApp');
          setExpedienteEnEspera(expediente);
          setMostrarModalContacto(true);
        }
        return; // Detener ejecución hasta que se capture el dato
      }

      // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // ✅ VALIDAR que el número tenga al menos 10 dígitos y solo contenga números
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        toast.error(`❌ El número de teléfono "${telefono}" no es válido para WhatsApp.\n\nDebe contener entre 10 y 15 dígitos.\n\nPor favor, actualiza el teléfono del cliente.`);
        console.error('❌ Número de teléfono inválido:', telefono, '→', telefonoLimpio);
        return;
      }
      
      console.log('✅ Número de teléfono válido:', telefonoLimpio);
      
      // Obtener URL firmada del PDF si existe
      let pdfUrl = null;
      let pdfExpiracion = null;
      if (expediente.pdf_key) {
        try {
          const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400); // 24 horas
          pdfUrl = pdfData.signed_url;
          // Calcular fecha de expiración (24 horas desde ahora)
          pdfExpiracion = new Date(Date.now() + 86400 * 1000).toISOString();
        } catch (error) {
          console.warn('No se pudo obtener URL del PDF:', error);
        }
      }
      
      // Generar mensaje dinámico según el estado usando el servicio
      const { tipoMensaje, mensaje } = notificacionesService.generarMensajeWhatsApp(
        expediente, 
        utils, 
        pdfUrl
      );

      // Crear la URL de WhatsApp
      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      
      // Abrir WhatsApp
      window.open(url, '_blank');
      
      // Registrar la notificación en el historial
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.WHATSAPP,
          tipo_mensaje: tipoMensaje,
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          mensaje: mensaje,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: expediente.estatusPago,
          fecha_vencimiento_pago: expediente.fecha_vencimiento_pago,
          pdf_url: pdfUrl,
          pdf_expiracion: pdfExpiracion,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación registrada en el historial');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
        // No interrumpir el flujo si falla el registro
      }

      // ✨ NUEVO: Registrar evento en el historial de trazabilidad
      try {
        await historialService.registrarEnvioDocumento(
          expediente.id,
          expediente.cliente_id,
          'WhatsApp',
          { nombre: nombreDestinatario, contacto: telefono },
          mensaje,
          pdfUrl
        );
        console.log('✅ Evento registrado en historial de trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      // Actualizar la etapa a "Enviada al Cliente" solo si es emisión
      if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.EMISION) {
        await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
      }
      
    } catch (error) {
      console.error('Error al compartir por WhatsApp:', error);
      toast.error('Error al compartir por WhatsApp. Intenta nuevamente.');
    }
  }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado]);

    // Compartir póliza por Email - PREPARADA PARA IMPLEMENTACIÓN FUTURA
    const compartirPorEmail = useCallback(async (expediente) => {
      try {
        // Usar destinatario seleccionado si está disponible, sino obtener del cliente
        let email, nombreDestinatario;
        
        if (destinatarioCompartirSeleccionado) {
          email = destinatarioCompartirSeleccionado.email;
          nombreDestinatario = destinatarioCompartirSeleccionado.nombre;
        } else {
          // Obtener datos del cliente (fallback cuando no hay destinatario seleccionado)
          const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
          if (!respCliente?.success) {
            toast.error('No se pudo obtener la información del cliente');
            return;
          }
          const cliente = respCliente.data;
          email = cliente?.email;
          nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
            ? cliente.razonSocial || cliente.razon_social
            : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
        }
        
        // ✨ NUEVO: Si no tiene email, abrir modal para capturarlo
        if (!email) {
          console.log('⚠️ Destinatario sin email, abriendo modal de captura');
          const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
          if (respCliente?.success) {
            setClienteParaActualizar(respCliente.data);
            setTipoDatoFaltante('email');
            setCanalEnvio('Email');
            setExpedienteEnEspera(expediente);
            setMostrarModalContacto(true);
          }
          return; // Detener ejecución hasta que se capture el dato
        }

        // Obtener URL firmada del PDF si existe
        let pdfUrl = null;
        let pdfExpiracion = null;
        if (expediente.pdf_key) {
          try {
            const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400); // 24 horas
            pdfUrl = pdfData.signed_url;
            pdfExpiracion = new Date(Date.now() + 86400 * 1000).toISOString();
          } catch (error) {
            console.warn('No se pudo obtener URL del PDF:', error);
          }
        }

        // Generar mensaje dinámico según el estado
        const { tipoMensaje, asunto, cuerpo } = notificacionesService.generarMensajeEmail(expediente, pdfUrl);

        // Opción 1: Usar mailto (cliente de correo local)
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        window.location.href = mailtoUrl;
      
        // Registrar la notificación en el historial
        try {
          await notificacionesService.registrarNotificacion({
            expediente_id: expediente.id,
            cliente_id: expediente.cliente_id,
            tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.EMAIL,
            tipo_mensaje: tipoMensaje,
            destinatario_nombre: nombreDestinatario,
            destinatario_contacto: email,
            asunto: asunto,
            mensaje: cuerpo,
            numero_poliza: expediente.numero_poliza,
            compania: expediente.compania,
            producto: expediente.producto,
            estatus_pago: expediente.estatusPago,
            fecha_vencimiento_pago: expediente.fecha_vencimiento_pago,
            pdf_url: pdfUrl,
            pdf_expiracion: pdfExpiracion,
            estado_envio: 'enviado'
          });
          console.log('✅ Notificación registrada en el historial');
        } catch (error) {
          console.error('⚠️ Error al registrar notificación (no crítico):', error);
        }

        // ✨ NUEVO: Registrar evento en el historial de trazabilidad
        try {
          await historialService.registrarEnvioDocumento(
            expediente.id,
            expediente.cliente_id,
            'Email',
            { nombre: nombreDestinatario, contacto: email },
            cuerpo,
            pdfUrl
          );
          console.log('✅ Evento registrado en historial de trazabilidad');
        } catch (error) {
          console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
        }
      
        // TODO: Implementar envío real mediante backend (SendGrid, Mailgun, etc.)
        // const response = await fetch(`${API_URL}/expedientes/${expediente.id}/enviar-email`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ email, asunto, cuerpo, pdfUrl })
        // });
      
        // Actualizar la etapa a "Enviada al Cliente" solo si es emisión
        if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.EMISION) {
          await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
        }
      
      } catch (error) {
        console.error('Error al compartir por Email:', error);
        toast.error('Error al compartir por Email. Intenta nuevamente.');
      }
    }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado]);

  // 💰 Las funciones enviarAvisoPagoWhatsApp y enviarAvisoPagoEmail vienen del hook useCompartirExpediente
  
    // Manejar selección de archivo PDF
    const handleSeleccionarPDF = useCallback((event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validacion = pdfService.validarArchivoPDF(file);
      if (!validacion.valid) {
        toast.error(validacion.error);
        event.target.value = '';
        return;
      }

      setArchivoSeleccionado(file);
    }, []);

   
    // Subir PDF de póliza
    const subirPDFPoliza = useCallback(async (expedienteId) => {
      if (!archivoSeleccionado) {
  toast('⚠️ Por favor seleccione un archivo PDF');
        return;
      }

      setSubiendoPDF(true);
      try {
        const pdfData = await pdfService.subirPDFPoliza(expedienteId, archivoSeleccionado);
      
        // Actualizar expediente con datos del PDF
        setExpedientes(prevExpedientes =>
          prevExpedientes.map(exp =>
            exp.id === expedienteId
              ? {
                  ...exp,
                  pdf_url: pdfData.pdf_url,
                  pdf_nombre: pdfData.pdf_nombre,
                  pdf_key: pdfData.pdf_key,
                  pdf_size: pdfData.pdf_size,
                  pdf_fecha_subida: pdfData.pdf_fecha_subida
                }
              : exp
          )
        );

        // Si estamos en vista de detalle, actualizar también
        if (expedienteSeleccionado?.id === expedienteId) {
          setExpedienteSeleccionado(prev => ({
            ...prev,
            pdf_url: pdfData.pdf_url,
            pdf_nombre: pdfData.pdf_nombre,
            pdf_key: pdfData.pdf_key,
            pdf_size: pdfData.pdf_size,
            pdf_fecha_subida: pdfData.pdf_fecha_subida
          }));
        }

        setArchivoSeleccionado(null);
  toast.success('PDF subido correctamente');
      } catch (error) {
        console.error('Error al subir PDF:', error);
  toast.error('Error al subir el PDF: ' + error.message);
      } finally {
        setSubiendoPDF(false);
      }
    }, [archivoSeleccionado, expedienteSeleccionado]);

    // Eliminar PDF de póliza
    const eliminarPDFPoliza = useCallback(async (expedienteId) => {
      if (!confirm('¿Está seguro de eliminar el PDF de esta póliza?')) {
        return;
      }

      try {
        await pdfService.eliminarPDFPoliza(expedienteId);

        // Actualizar expediente removiendo datos del PDF
        setExpedientes(prevExpedientes =>
          prevExpedientes.map(exp =>
            exp.id === expedienteId
              ? {
                  ...exp,
                  pdf_url: null,
                  pdf_nombre: null,
                  pdf_key: null,
                  pdf_size: null,
                  pdf_fecha_subida: null
                }
              : exp
          )
        );

        // Si estamos en vista de detalle, actualizar también
        if (expedienteSeleccionado?.id === expedienteId) {
          setExpedienteSeleccionado(prev => ({
            ...prev,
            pdf_url: null,
            pdf_nombre: null,
            pdf_key: null,
            pdf_size: null,
            pdf_fecha_subida: null
          }));
        }

  toast.success('PDF eliminado correctamente');
      } catch (error) {
        console.error('Error al eliminar PDF:', error);
  toast.error('Error al eliminar el PDF: ' + error.message);
      }
    }, [expedienteSeleccionado]);

  const calcularSiguientePago = useCallback((expediente) => {
    console.log('🔥 DEBUG calcularSiguientePago - Entrada:', {
      inicio_vigencia: expediente.inicio_vigencia,
      tipo_pago: expediente.tipo_pago,
      frecuenciaPago: expediente.frecuenciaPago,
      ultimo_recibo_pagado: expediente.ultimo_recibo_pagado
    });
    
    if (!expediente.inicio_vigencia || expediente.tipo_pago === 'Anual') {
      console.log('🔥 DEBUG calcularSiguientePago - Retornando vacío (Anual o sin inicio)');
      return '';
    }
    
    if (expediente.tipo_pago === 'Fraccionado' && expediente.frecuenciaPago) {
      // 🔧 Usar periodo de gracia del expediente (convertir a número) o calcular según compañía
      const periodoGracia = expediente.periodo_gracia 
        ? parseInt(expediente.periodo_gracia, 10)
        : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
      
      // 🔥 Usar el número de recibo pagado directamente
      const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
      
      if (ultimoReciboPagado === 0) {
        // ✅ Si no hay recibos pagados, calcular el pago #1
        return calcularProximoPago(
          expediente.inicio_vigencia, 
          expediente.tipo_pago, 
          expediente.frecuenciaPago, 
          expediente.compania, 
          1,
          periodoGracia  // 🔥 Pasar periodo de gracia
        );
      }
      
      // El siguiente recibo es el número siguiente al último pagado
      const siguienteNumeroRecibo = ultimoReciboPagado + 1;
      
      console.log('🔥 DEBUG calcularSiguientePago - Calculando recibo:', {
        ultimoReciboPagado,
        siguienteNumeroRecibo,
        periodoGracia
      });
      
      const resultado = calcularProximoPago(
        expediente.inicio_vigencia,
        expediente.tipo_pago,
        expediente.frecuenciaPago,
        expediente.compania,
        siguienteNumeroRecibo,
        periodoGracia  // 🔥 Pasar periodo de gracia
      );
      
      console.log('🔥 DEBUG calcularSiguientePago - Resultado final:', resultado);
      return resultado;
    }
    
    return '';
  }, [calcularProximoPago]);

  // ✅ aplicarPago y procesarPagoConComprobante ahora vienen del hook usePagos
  // ✅ Se renombraron a abrirModalAplicarPago y procesarPagoConComprobante para claridad

  // Función para manejar selección de cliente
  const handleClienteSeleccionado = useCallback((cliente) => {
    if (cliente === 'CREAR_NUEVO') {
      // TODO: Abrir modal para crear nuevo cliente
  toast('⚠️ Funcionalidad de crear nuevo cliente en desarrollo');
      return;
    }

    if (cliente) {
      setClienteSeleccionado(cliente);
      
      // Auto-llenar datos del cliente en el formulario
      // Manejar tanto camelCase como snake_case del backend
      const datosFormulario = {
        cliente_id: cliente.id,
        // Datos principales del cliente (solo lectura)
        nombre: cliente.nombre || '',
        apellido_paterno: cliente.apellido_paterno || cliente.apellidoPaterno || '',
        apellido_materno: cliente.apellido_materno || cliente.apellidoMaterno || '',
        razon_social: cliente.razon_social || cliente.razonSocial || '',
        nombre_comercial: cliente.nombre_comercial || cliente.nombreComercial || '',
        email: cliente.email || '',
        telefono_fijo: cliente.telefono_fijo || cliente.telefonoFijo || '',
        telefono_movil: cliente.telefono_movil || cliente.telefonoMovil || '',
        rfc: cliente.rfc || '',
        // Datos de contacto adicional/gestor (editables)
        contacto_nombre: cliente.contacto_nombre || cliente.contactoNombre || '',
        contacto_apellido_paterno: cliente.contacto_apellido_paterno || cliente.contactoApellidoPaterno || '',
        contacto_apellido_materno: cliente.contacto_apellido_materno || cliente.contactoApellidoMaterno || '',
        contacto_email: cliente.contacto_email || cliente.contactoEmail || '',
        contacto_telefono_fijo: cliente.contacto_telefono_fijo || cliente.contactoTelefonoFijo || '',
        contacto_telefono_movil: cliente.contacto_telefono_movil || cliente.contactoTelefonoMovil || ''
      };

      setFormulario(prev => ({
        ...prev,
        ...datosFormulario
      }));
    } else {
      setClienteSeleccionado(null);
      setFormulario(prev => ({
        ...prev,
        cliente_id: null,
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        razon_social: '',
        nombre_comercial: '',
        email: '',
        telefono_fijo: '',
        telefono_movil: '',
        rfc: '',
        contacto_nombre: '',
        contacto_apellido_paterno: '',
        contacto_apellido_materno: '',
        contacto_email: '',
        contacto_telefono_fijo: '',
        contacto_telefono_movil: ''
      }));
    }
  }, []);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setFormularioOriginal(null); // Limpiar snapshot
    setClienteSeleccionado(null);
    setModoEdicion(false);
    setExpedienteSeleccionado(null);
  }, [estadoInicialFormulario]);

  const validarFormulario = useCallback(() => {
    // Validar que haya cliente seleccionado
    if (!formulario.cliente_id && !clienteSeleccionado) {
  toast('⚠️ Por favor seleccione un cliente');
      return false;
    }

    if (!formulario.compania || !formulario.producto) {
  toast('⚠️ Complete: Compañía y Producto');
      return false;
    }

    // Validar duplicados (solo si NO estamos editando)
    if (!modoEdicion && formulario.numero_poliza) {
      const vinFormulario = formulario.numero_serie?.trim() || '';
      
      // Buscar duplicados con las 3 reglas
      const polizaDuplicadaCompleta = expedientes.find(exp => 
        exp.numero_poliza === formulario.numero_poliza &&
        exp.compania === formulario.compania &&
        exp.numero_serie === vinFormulario &&
        vinFormulario !== ''
      );
      
      const vinDuplicado = vinFormulario !== '' && expedientes.find(exp => 
        exp.numero_serie === vinFormulario &&
        exp.numero_poliza !== formulario.numero_poliza
      );
      
      const polizaDuplicadaVinDistinto = expedientes.find(exp => 
        exp.numero_poliza === formulario.numero_poliza &&
        exp.compania === formulario.compania &&
        exp.numero_serie !== vinFormulario &&
        (exp.numero_serie?.trim() || '') !== ''
      );
      
      // Prioridad de alertas: 1) Póliza completa, 2) VIN duplicado, 3) Póliza VIN distinto
      if (polizaDuplicadaCompleta) {
        const mensaje = 
          '⚠️ ATENCIÓN: PÓLIZA DUPLICADA DETECTADA\n\n' +
          'Ya existe un registro en el sistema con estos datos:\n\n' +
          '📋 Póliza: ' + polizaDuplicadaCompleta.numero_poliza + '\n' +
          '🏢 Compañía: ' + polizaDuplicadaCompleta.compania + '\n' +
          '🚗 VIN: ' + (polizaDuplicadaCompleta.numero_serie || 'N/A') + '\n' +
          '👤 Cliente: ' + polizaDuplicadaCompleta.nombre + ' ' + polizaDuplicadaCompleta.apellido_paterno + '\n' +
          '📊 Etapa: ' + polizaDuplicadaCompleta.etapa_activa + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará como duplicada en el listado)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      } else if (vinDuplicado) {
        const mensaje = 
          '⚠️ ATENCIÓN: VIN DUPLICADO DETECTADO\n\n' +
          'Este VIN ya está registrado en otra póliza:\n\n' +
          '🚗 VIN: ' + vinFormulario + '\n' +
          '📋 Póliza existente: ' + vinDuplicado.numero_poliza + '\n' +
          '🏢 Compañía: ' + vinDuplicado.compania + '\n' +
          '👤 Cliente: ' + vinDuplicado.nombre + ' ' + vinDuplicado.apellido_paterno + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará como VIN duplicado para revisión)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      } else if (polizaDuplicadaVinDistinto) {
        const mensaje = 
          '⚠️ ADVERTENCIA: PÓLIZA DUPLICADA CON VIN DISTINTO\n\n' +
          'Esta póliza ya existe con un VIN diferente:\n\n' +
          '📋 Póliza: ' + formulario.numero_poliza + '\n' +
          '🚗 VIN actual: ' + vinFormulario + '\n' +
          '🚗 VIN existente: ' + (polizaDuplicadaVinDistinto.numero_serie || 'N/A') + '\n' +
          '🏢 Compañía: ' + formulario.compania + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Se marcará para revisión en el listado)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        if (!confirmar) {
          toast('Operación cancelada. La póliza no fue guardada');
          return false;
        }
      }
    }

    if (formulario.producto === 'Autos Individual') {
      if (!formulario.marca || !formulario.modelo || !formulario.anio) {
  toast('⚠️ Para Autos: complete Marca, Modelo y Año');
        return false;
      }
      
      const anioVehiculo = parseInt(formulario.anio);
      if (anioVehiculo < CONSTANTS.MIN_YEAR || anioVehiculo > CONSTANTS.MAX_YEAR) {
  toast('⚠️ Ingrese un año válido para el vehículo');
        return false;
      }
      
      if (formulario.numero_serie && formulario.numero_serie.length !== CONSTANTS.VIN_LENGTH) {
  toast(`⚠️ El VIN debe tener ${CONSTANTS.VIN_LENGTH} caracteres`);
        return false;
      }
    }

    // Regla de negocio: En Persona Moral debe existir Contacto Principal (nombre) y al menos Email o Teléfono Móvil
    if (clienteSeleccionado?.tipoPersona === 'Persona Moral') {
      const nombreContacto = (formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
      const tieneEmailOMovil = !!(
        (formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim() ||
        (formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim()
      );
      if (!nombreContacto || !tieneEmailOMovil) {
  toast('⚠️ Persona Moral: capture Contacto Principal con nombre y al menos Email o Teléfono Móvil');
        return false;
      }
    }

    // Regla de negocio: En Persona Física debe tener al menos Email o Teléfono Móvil (propio o del contacto principal)
    if (clienteSeleccionado?.tipoPersona === 'Persona Física') {
      // Verificar datos propios del cliente
      const tieneEmailPropio = !!(formulario.email || clienteSeleccionado.email || '').trim();
      const tieneMovilPropio = !!(formulario.telefono_movil || clienteSeleccionado.telefono_movil || clienteSeleccionado.telefonoMovil || '').trim();
      
      // Verificar datos del contacto principal (si existe)
      const tieneContactoPrincipal = !!(formulario.contacto_nombre || clienteSeleccionado.contacto_nombre || '').trim();
      const tieneEmailContacto = !!(formulario.contacto_email || clienteSeleccionado.contacto_email || '').trim();
      const tieneMovilContacto = !!(formulario.contacto_telefono_movil || clienteSeleccionado.contacto_telefono_movil || '').trim();
      
      // Debe tener al menos un email o móvil (propio o del contacto)
      const tieneContactoValido = tieneEmailPropio || tieneMovilPropio || 
                                  (tieneContactoPrincipal && (tieneEmailContacto || tieneMovilContacto));
      
      if (!tieneContactoValido) {
  toast('⚠️ Persona Física: se requiere Email o Teléfono Móvil (cliente o contacto)');
        return false;
      }
    }

    return true;
  }, [formulario, clienteSeleccionado, modoEdicion, expedientes]);

  // 📍 Función para verificar y registrar el estado de vigencia de una póliza
  // Esta función determina en qué carpeta debe estar (Vencida, Por Renovar, En Vigencia)
  // y registra el evento correspondiente SI NO EXISTE ya en el historial
  // ⭐ ADEMÁS actualiza la etapa_activa en BD para mantener coherencia
  const verificarYRegistrarEstadoVigencia = useCallback(async (expediente, historialActual = null) => {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const inicio = expediente.inicio_vigencia ? new Date(expediente.inicio_vigencia) : null;
      const termino = expediente.termino_vigencia ? new Date(expediente.termino_vigencia) : null;
      const fechaAviso = expediente.fecha_aviso_renovacion ? new Date(expediente.fecha_aviso_renovacion) : null;
      
      if (inicio) inicio.setHours(0, 0, 0, 0);
      if (termino) termino.setHours(0, 0, 0, 0);
      if (fechaAviso) fechaAviso.setHours(0, 0, 0, 0);
      
      // Si no tenemos historial, intentar obtenerlo
      let historial = historialActual;
      if (!historial) {
        try {
          const response = await fetch(`${API_URL}/api/historial-expedientes/${expediente.id}`);
          if (response.ok) {
            const data = await response.json();
            historial = data?.data || data || [];
            // ✅ VALIDAR que historial sea un array
            if (!Array.isArray(historial)) {
              console.warn('⚠️ Historial no es un array, convirtiendo:', historial);
              historial = [];
            }
          }
        } catch (e) {
          console.warn('⚠️ No se pudo obtener historial para verificar eventos existentes');
          historial = [];
        }
      }
      
      // ✅ Asegurar que historial sea un array
      if (!Array.isArray(historial)) {
        console.warn('⚠️ Historial no es un array, convirtiendo:', historial);
        historial = [];
      }
      
      console.log('🔍 [VIGENCIA] Verificando estado de vigencia para expediente:', expediente.id);
      console.log('🔍 [VIGENCIA] Historial cargado:', historial.length, 'eventos');
      
      // 1️⃣ VENCIDA (mayor prioridad)
      if (termino && termino < hoy) {
        // ⭐ Solo actualizar etapa_activa a "Vencida" (el evento se integra en log de edición)
        if (expediente.etapa_activa !== 'Vencida') {
          try {
            await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ etapa_activa: 'Vencida' })
            });
            console.log('✅ Etapa actualizada a "Vencida" (el evento se integra en log de edición)');
          } catch (e) {
            console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
          }
        }
        return;
      }
      
      // 2️⃣ POR RENOVAR (30 días antes de vencer)
      if (fechaAviso && termino && fechaAviso <= hoy && termino >= hoy) {
        // ⭐ Solo actualizar etapa_activa a "Por Renovar" (el evento se integra en log de edición)
        if (expediente.etapa_activa !== 'Por Renovar') {
          try {
            await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ etapa_activa: 'Por Renovar' })
            });
            console.log('✅ Etapa actualizada a "Por Renovar" (el evento se integra en log de edición)');
          } catch (e) {
            console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
          }
        }
        return;
      }
      
      // 3️⃣ EN VIGENCIA (dentro del periodo, sin estar próxima a renovar)
      // ⚠️ IMPORTANTE: Solo si está PAGADA
      if (inicio && termino && inicio <= hoy && termino >= hoy) {
        const estaPagada = (expediente.estatus_pago || expediente.estatusPago || '').toLowerCase() === 'pagado';
        
        // Solo registrar evento y actualizar etapa si está pagada
        if (estaPagada) {
          const yaRegistrado = historial.some(h => h.tipo_evento === historialService.TIPOS_EVENTO.POLIZA_EN_VIGENCIA);
          
          if (!yaRegistrado) {
            await historialService.registrarEvento({
              expediente_id: expediente.id,
              cliente_id: expediente.cliente_id,
              tipo_evento: historialService.TIPOS_EVENTO.POLIZA_EN_VIGENCIA,
              usuario_nombre: 'Sistema',
              descripcion: `Póliza en vigencia desde ${expediente.inicio_vigencia} hasta ${expediente.termino_vigencia} (Estatus pago: Pagado)`,
              datos_adicionales: {
                numero_poliza: expediente.numero_poliza,
                compania: expediente.compania,
                inicio_vigencia: expediente.inicio_vigencia,
                termino_vigencia: expediente.termino_vigencia,
                estatus_pago: 'Pagado'
              }
            });
            console.log('✅ Evento "Póliza en Vigencia" registrado');
          } else {
            console.log('ℹ️ Evento "Póliza en Vigencia" ya existe en historial');
          }
          
          // ⭐ Actualizar etapa_activa a "En Vigencia"
          if (expediente.etapa_activa !== 'En Vigencia') {
            try {
              await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etapa_activa: 'En Vigencia' })
              });
              console.log('✅ Etapa actualizada a "En Vigencia"');
            } catch (e) {
              console.warn('⚠️ No se pudo actualizar etapa_activa:', e);
            }
          }
        } else {
          console.log('ℹ️ Póliza en rango de vigencia pero NO pagada. No se actualiza a "En Vigencia"');
        }
        return;
      }
      
      console.log('ℹ️ Póliza no cumple condiciones para eventos automáticos de vigencia');
      
    } catch (error) {
      console.error('❌ Error al verificar y registrar estado de vigencia:', error);
    }
  }, []);

  const guardarExpediente = useCallback(async () => {
    // 🚨 DEBUG: Estado del formulario al hacer click en guardar
    console.log('🚀 [GUARDAR EXPEDIENTE] Iniciando proceso de guardado');
    console.log('🚀 [GUARDAR EXPEDIENTE] Estado actual del formulario:', formulario);
    console.log('🚀 [GUARDAR EXPEDIENTE] cargo_pago_fraccionado:', formulario.cargo_pago_fraccionado);
    console.log('🚀 [GUARDAR EXPEDIENTE] gastos_expedicion:', formulario.gastos_expedicion);
    
    if (!validarFormulario()) return;

    // ✅ VALIDAR FECHA DE EMISIÓN - Preguntar al usuario si desea usar fecha actual
    if (!modoEdicion && (!formulario.fecha_emision || formulario.fecha_emision === new Date().toISOString().split('T')[0])) {
      const usarFechaActual = window.confirm(
        '¿Desea utilizar la fecha actual como fecha de emisión?\n\n' +
        `Fecha actual: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
        'Presione "Aceptar" para continuar con esta fecha\n' +
        'Presione "Cancelar" para poder editarla'
      );
      
      if (!usarFechaActual) {
        toast.info('📅 Por favor, edite la Fecha de Emisión en el formulario antes de guardar');
        // Hacer scroll hacia el campo de fecha_emision
        const campoFechaEmision = document.querySelector('input[type="date"][value*="' + formulario.fecha_emision + '"]');
        if (campoFechaEmision) {
          campoFechaEmision.scrollIntoView({ behavior: 'smooth', block: 'center' });
          campoFechaEmision.focus();
        }
        return; // Detener el guardado
      }
    }

    // Si hay un cliente seleccionado, actualizar sus datos de contacto según su tipo
    if (clienteSeleccionado && formulario.cliente_id) {
      try {
        console.log('💼 Actualizando datos de contacto del cliente...', {
          cliente_id: clienteSeleccionado.id,
          tipoPersona: clienteSeleccionado.tipoPersona
        });
        
        // LÓGICA CORRECTA:
        // - Persona Moral: usa contacto_* para el contacto principal
        // - Persona Física: usa email/telefono_* para el cliente + contacto_* para el gestor (opcional)
        
        let datosActualizados = {};
        
        if (clienteSeleccionado.tipoPersona === 'Persona Moral') {
          // Persona Moral: solo actualizar contacto_* (contacto principal)
          datosActualizados = {
            contacto_nombre: formulario.contacto_nombre || null,
            contacto_apellido_paterno: formulario.contacto_apellido_paterno || null,
            contacto_apellido_materno: formulario.contacto_apellido_materno || null,
            contacto_email: formulario.contacto_email || null,
            contacto_telefono_fijo: formulario.contacto_telefono_fijo || null,
            contacto_telefono_movil: formulario.contacto_telefono_movil || null
          };
        } else {
          // Persona Física: actualizar campos principales DEL CLIENTE + contacto_* del gestor
          datosActualizados = {
            // Datos principales del cliente (editables desde póliza)
            email: formulario.email || null,
            telefonoMovil: formulario.telefono_movil || null,
            telefonoFijo: formulario.telefono_fijo || null,
            // Datos del gestor/contacto adicional (opcional)
            contacto_nombre: formulario.contacto_nombre || null,
            contacto_apellido_paterno: formulario.contacto_apellido_paterno || null,
            contacto_apellido_materno: formulario.contacto_apellido_materno || null,
            contacto_email: formulario.contacto_email || null,
            contacto_telefono_fijo: formulario.contacto_telefono_fijo || null,
            contacto_telefono_movil: formulario.contacto_telefono_movil || null
          };
        }
        
        const response = await fetch(`${API_URL}/api/clientes/${clienteSeleccionado.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosActualizados)
        });

        if (response.ok) {
          const resultado = await response.json();
          
          // ⚠️ IMPORTANTE: Actualizar clientesMap inmediatamente para que InfoCliente vea los cambios
          const clienteActualizado = resultado.data || resultado;
          setClientesMap(prevMap => ({
            ...prevMap,
            [clienteSeleccionado.id]: {
              ...prevMap[clienteSeleccionado.id],
              ...clienteActualizado,
              // Normalizar campos en camelCase para compatibilidad
              contacto_nombre: clienteActualizado.contacto_nombre || clienteActualizado.contactoNombre,
              contacto_apellido_paterno: clienteActualizado.contacto_apellido_paterno || clienteActualizado.contactoApellidoPaterno,
              contacto_apellido_materno: clienteActualizado.contacto_apellido_materno || clienteActualizado.contactoApellidoMaterno,
              contacto_email: clienteActualizado.contacto_email || clienteActualizado.contactoEmail,
              contacto_telefono_fijo: clienteActualizado.contacto_telefono_fijo || clienteActualizado.contactoTelefonoFijo,
              contacto_telefono_movil: clienteActualizado.contacto_telefono_movil || clienteActualizado.contactoTelefonoMovil,
              email: clienteActualizado.email,
              telefono_movil: clienteActualizado.telefono_movil || clienteActualizado.telefonoMovil,
              telefono_fijo: clienteActualizado.telefono_fijo || clienteActualizado.telefonoFijo
            }
          }));
          console.log('✅ ClientesMap actualizado con nuevos datos de contacto');
          // Notificar globalmente para que otros módulos (Clientes) recarguen su lista
          try {
            window.dispatchEvent(new CustomEvent('clientes-actualizados', { detail: { origen: 'Expedientes.jsx', tipo: 'update', id: clienteSeleccionado.id, ts: Date.now() } }));
          } catch (_) { /* noop */ }
        } else {
          const errorText = await response.text();
          console.warn('⚠️ No se pudo actualizar el cliente:', errorText);
        }
      } catch (error) {
        console.error('❌ Error al actualizar cliente:', error);
        // Continuar con el guardado del expediente aunque falle la actualización del cliente
      }
    }

    // 🎯 CRÍTICO: NO recalcular antes de guardar
    // Guardar EXACTAMENTE lo que el usuario tiene en el formulario
    const formularioParaGuardar = { ...formulario };
    
    // ✅ FUNCIÓN para convertir camelCase a snake_case
    const camelToSnake = (str) => {
      return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    };

    // ✅ CONVERSIÓN COMPLETA a snake_case para el backend
    const convertirASnakeCase = (obj) => {
      const resultado = {};
      
        // Mapeo específico de campos conocidos
        const mapeoEspecifico = {
          // Identificación
          numeroPoliza: 'numero_poliza',
          clienteId: 'cliente_id',
          agenteId: 'agente_id',
          vendedorId: 'vendedor_id',
          claveAseguradora: 'clave_aseguradora',
          
          // Datos Cliente
          apellidoPaterno: 'apellido_paterno',
          apellidoMaterno: 'apellido_materno',
          razonSocial: 'razon_social',
          nombreComercial: 'nombre_comercial',
          numeroIdentificacion: 'numero_identificacion',
          telefonoFijo: 'telefono_fijo',
          telefonoMovil: 'telefono_movil',
          
          // Póliza
          cargoPagoFraccionado: 'cargo_pago_fraccionado',
          motivoCancelacion: 'motivo_cancelacion',
          frecuenciaPago: 'frecuencia_pago',
          proximoPago: 'proximo_pago',
          estatusPago: 'estatus_pago',
          gastosExpedicion: 'gastos_expedicion',
          subAgente: 'sub_agente',
          
          // Vehículo
          numeroSerie: 'numero_serie',
          tipoVehiculo: 'tipo_vehiculo',
          tipoCobertura: 'tipo_cobertura',
          sumaAsegurada: 'suma_asegurada',
          conductorHabitual: 'conductor_habitual',
          edadConductor: 'edad_conductor',
          licenciaConducir: 'licencia_conducir',
          
          // Financiero
          primaPagada: 'prima_pagada',
          periodoGracia: 'periodo_gracia',
          fechaUltimoPago: 'fecha_ultimo_pago',
          fechaVencimientoPago: 'fecha_vencimiento_pago',
          
          // Vigencia
          inicioVigencia: 'inicio_vigencia',
          terminoVigencia: 'termino_vigencia',
          
          // Estado
          etapaActiva: 'etapa_activa',
          tipoPago: 'tipo_pago',
          fechaCreacion: 'fecha_creacion'
        };

        Object.keys(obj).forEach(key => {
          // Usar mapeo específico si existe, sino conversión automática
          const snakeKey = mapeoEspecifico[key] || camelToSnake(key);
          
          // ✅ CORRECCIÓN CRÍTICA: Solo aplicar si el campo snake_case no existe ya o está vacío
          // Esto evita que campos camelCase vacíos sobrescriban campos snake_case con valores
          const existeEnSnake = resultado.hasOwnProperty(snakeKey);
          const valorActualSnake = resultado[snakeKey];
          const valorNuevo = obj[key];
          
          if (!existeEnSnake || 
              (valorActualSnake === '' || valorActualSnake === null || valorActualSnake === undefined) ||
              (valorNuevo !== '' && valorNuevo !== null && valorNuevo !== undefined)) {
            resultado[snakeKey] = valorNuevo;
          }
          
          // Debug específico para campos problemáticos
          if (key.includes('cargo_pago_fraccionado') || key.includes('gastos_expedicion') || snakeKey.includes('cargo_pago_fraccionado') || snakeKey.includes('gastos_expedicion')) {
            console.log(`🔍 DEBUG convertirASnakeCase: ${key} = "${obj[key]}" → ${snakeKey} = "${resultado[snakeKey]}" (existía: ${existeEnSnake})`);
          }
        });      return resultado;
    };

    // 🚨 DEBUG: Verificar formulario ANTES de conversión
    console.log('🚨 [FORMULARIO ANTES] cargo_pago_fraccionado:', formularioParaGuardar.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] gastos_expedicion:', formularioParaGuardar.gastos_expedicion);
    console.log('🚨 [FORMULARIO ANTES] tipo valor cargo_pago_fraccionado:', typeof formularioParaGuardar.cargo_pago_fraccionado);
    console.log('🚨 [FORMULARIO ANTES] tipo valor gastos_expedicion:', typeof formularioParaGuardar.gastos_expedicion);
    
    // 🚨 DEBUG CRÍTICO: Verificar fechas en el formulario
    console.log('📅 [FORMULARIO] fecha_emision:', formularioParaGuardar.fecha_emision);
    console.log('📅 [FORMULARIO] inicio_vigencia:', formularioParaGuardar.inicio_vigencia);
    console.log('📅 [FORMULARIO] termino_vigencia:', formularioParaGuardar.termino_vigencia);
    
    // ✅ SOLUCIÓN DIRECTA: Crear payload básico y forzar los campos problemáticos
    let expedientePayload = {
      ...formularioParaGuardar,
      // Forzar estos campos específicos sin conversión compleja
      cargo_pago_fraccionado: formularioParaGuardar.cargo_pago_fraccionado || '',
      gastos_expedicion: formularioParaGuardar.gastos_expedicion || '',
      estatus_pago: formularioParaGuardar.estatusPago || 'Pendiente', // ✅ FORZAR estatus_pago
      frecuencia_pago: formularioParaGuardar.frecuenciaPago || formularioParaGuardar.frecuencia_pago || null, // ✅ FORZAR frecuencia_pago
      // 💰 FORZAR montos de pagos fraccionados
      primer_pago: formularioParaGuardar.primer_pago || formularioParaGuardar.primerPago || null,
      pagos_subsecuentes: formularioParaGuardar.pagos_subsecuentes || formularioParaGuardar.pagosSubsecuentes || null,
      // 🎯 CRÍTICO: Forzar fechas en snake_case
      fecha_emision: formularioParaGuardar.fecha_emision,
      inicio_vigencia: formularioParaGuardar.inicio_vigencia,
      termino_vigencia: formularioParaGuardar.termino_vigencia,
      fecha_vencimiento_pago: formularioParaGuardar.fecha_vencimiento_pago,
      fecha_aviso_renovacion: formularioParaGuardar.fecha_aviso_renovacion
    };
    
    // Solo hacer conversión básica de campos que no sean problemáticos
    const convertirSoloNecesario = (obj) => {
      const resultado = { ...obj };
      
      // Solo campos esenciales que necesitan conversión
      if (resultado.clienteId) {
        resultado.cliente_id = resultado.clienteId;
        delete resultado.clienteId;
      }
      if (resultado.numeroPoliza) {
        resultado.numero_poliza = resultado.numeroPoliza;
        delete resultado.numeroPoliza;
      }
      if (resultado.inicioVigencia) {
        resultado.inicio_vigencia = resultado.inicioVigencia;
        delete resultado.inicioVigencia;
      }
      if (resultado.terminoVigencia) {
        resultado.termino_vigencia = resultado.terminoVigencia;
        delete resultado.terminoVigencia;
      }
      if (resultado.estatusPago) {
        resultado.estatus_pago = resultado.estatusPago;
        delete resultado.estatusPago;
      }
      
      return resultado;
    };
    
    expedientePayload = convertirSoloNecesario(expedientePayload);
    
    // ✅ GARANTIZAR que estos campos problemáticos estén presentes
    expedientePayload.cargo_pago_fraccionado = formularioParaGuardar.cargo_pago_fraccionado || '';
    expedientePayload.gastos_expedicion = formularioParaGuardar.gastos_expedicion || '';
    // ✅ CRÍTICO: Usar 'formulario' (estado actual) para estatus_pago, no 'formularioParaGuardar'
    expedientePayload.estatus_pago = formulario.estatusPago || formulario.estatus_pago || 'Pendiente';
    expedientePayload.fecha_aviso_renovacion = formularioParaGuardar.fecha_aviso_renovacion || null; // ✅ GARANTIZAR fecha_aviso_renovacion
    // ✅ GARANTIZAR que se guarde el vendedor/sub agente
    expedientePayload.sub_agente = formularioParaGuardar.sub_agente || null;
    
    // ✅ EXTRAER vendedor_id del campo sub_agente (formato: "123 - Nombre Apellido")
    console.log('🔍 [VENDEDOR] sub_agente en formulario:', formularioParaGuardar.sub_agente);
    if (formularioParaGuardar.sub_agente) {
      const vendedorIdMatch = formularioParaGuardar.sub_agente.split('-')[0].trim();
      console.log('🔍 [VENDEDOR] vendedorIdMatch extraído:', vendedorIdMatch);
      if (vendedorIdMatch && !isNaN(vendedorIdMatch)) {
        expedientePayload.vendedor_id = parseInt(vendedorIdMatch);
        console.log('✅ [VENDEDOR] vendedor_id final:', expedientePayload.vendedor_id);
      } else {
        console.log('⚠️ [VENDEDOR] No se pudo extraer ID numérico');
        expedientePayload.vendedor_id = null;
      }
    } else {
      console.log('⚠️ [VENDEDOR] No hay sub_agente en formulario');
      expedientePayload.vendedor_id = null;
    }
    
    // 💰 FECHA DE PAGO: Si está marcado como "Pagado", usar fecha_ultimo_pago o fecha actual
    if (expedientePayload.estatus_pago === 'Pagado') {
      expedientePayload.fecha_ultimo_pago = formularioParaGuardar.fecha_ultimo_pago || new Date().toISOString().split('T')[0];
      console.log('💰 Póliza marcada como Pagado. Fecha de pago:', expedientePayload.fecha_ultimo_pago);
    }
    
    // 🎯 CRÍTICO: GARANTIZAR que las fechas estén en el payload (segunda vez por seguridad)
    expedientePayload.fecha_emision = formularioParaGuardar.fecha_emision;
    expedientePayload.inicio_vigencia = formularioParaGuardar.inicio_vigencia;
    expedientePayload.termino_vigencia = formularioParaGuardar.termino_vigencia;
    expedientePayload.fecha_vencimiento_pago = formularioParaGuardar.fecha_vencimiento_pago;
    expedientePayload.fecha_aviso_renovacion = formularioParaGuardar.fecha_aviso_renovacion;
    
    console.log('🚨 [PAYLOAD SIMPLE] cargo_pago_fraccionado FORZADO:', expedientePayload.cargo_pago_fraccionado);
    console.log('🚨 [PAYLOAD SIMPLE] gastos_expedicion FORZADO:', expedientePayload.gastos_expedicion);
    console.log('🚨 [PAYLOAD SIMPLE] estatus_pago FORZADO:', expedientePayload.estatus_pago);
    console.log('📅 [PAYLOAD SIMPLE] fecha_aviso_renovacion:', expedientePayload.fecha_aviso_renovacion);
    console.log('👤 [PAYLOAD SIMPLE] sub_agente ENVIANDO:', expedientePayload.sub_agente);
    console.log('📅 [PAYLOAD FINAL] fecha_emision:', expedientePayload.fecha_emision);
    console.log('📅 [PAYLOAD FINAL] inicio_vigencia:', expedientePayload.inicio_vigencia);
    console.log('📅 [PAYLOAD FINAL] termino_vigencia:', expedientePayload.termino_vigencia);
    console.log('📅 [PAYLOAD FINAL] fecha_aviso_renovacion:', expedientePayload.fecha_aviso_renovacion);
    
    // Limpiar campos innecesarios
    delete expedientePayload.__pdf_file;
    delete expedientePayload.__pdf_nombre;
    delete expedientePayload.__pdf_size;
    delete expedientePayload.contacto_nombre;
    delete expedientePayload.contacto_apellido_paterno;
    delete expedientePayload.contacto_apellido_materno;
    delete expedientePayload.contacto_email;
    delete expedientePayload.contacto_telefono_fijo;
    delete expedientePayload.contacto_telefono_movil;
    
    // Limpiar duplicados camelCase
    delete expedientePayload.cargoPagoFraccionado;
    delete expedientePayload.gastosExpedicion;
    delete expedientePayload.proximoPago;
    delete expedientePayload.estatusPago;
    delete expedientePayload.motivoCancelacion;
    delete expedientePayload.razonSocial;
    delete expedientePayload.tasaFinanciamiento;
    delete expedientePayload.subTotal;
    delete expedientePayload.frecuenciaPago; // ✅ Eliminar camelCase, ya está como frecuencia_pago
    delete expedientePayload.primerPago; // ✅ Eliminar camelCase, ya está como primer_pago
    delete expedientePayload.pagosSubsecuentes; // ✅ Eliminar camelCase, ya está como pagos_subsecuentes

    
    // ✅ CAMBIO IMPORTANTE: Sí enviamos campos del cliente (nombre, apellidos, rfc, email, etc.)
    // El backend los necesita para enriquecer el expediente
    // Solo enviamos lo que el usuario puede editar
    
    // Convertir coberturas a JSON string si existen (para compatibilidad con SQL)
    if (expedientePayload.coberturas && Array.isArray(expedientePayload.coberturas)) {
      expedientePayload.coberturas = JSON.stringify(expedientePayload.coberturas);
    }

    // Debug: Verificar campos clave antes de guardar
    console.log(`💾 Guardando expediente | Cliente: ${formularioParaGuardar.cliente_id} | Póliza: ${formularioParaGuardar.numero_poliza}`);
    console.log('🔍 PAYLOAD FINAL - sub_agente:', expedientePayload.sub_agente);
    console.log('🔍 FORMULARIO ORIGINAL - sub_agente:', formularioParaGuardar.sub_agente);

    if (modoEdicion) {
      // ✅ VERIFICACIÓN FINAL OBLIGATORIA - Asegurar que los campos estén ahí
      if (!expedientePayload.hasOwnProperty('cargo_pago_fraccionado')) {
        console.error('❌ FALTA cargo_pago_fraccionado en payload!');
        expedientePayload.cargo_pago_fraccionado = formularioParaGuardar.cargo_pago_fraccionado || '';
      }
      if (!expedientePayload.hasOwnProperty('gastos_expedicion')) {
        console.error('❌ FALTA gastos_expedicion en payload!');
        expedientePayload.gastos_expedicion = formularioParaGuardar.gastos_expedicion || '';
      }
      
      // 💰 VALIDAR cambios en fechas de pago - Preguntar si mantener estatus actual
      let estatusRecalculado = null; // Para detectar cambios automáticos de estatus
      
      if (formularioOriginal) {
        const fechasOriginal = {
          inicio_vigencia: formularioOriginal.inicio_vigencia,
          termino_vigencia: formularioOriginal.termino_vigencia,
          fecha_vencimiento_pago: formularioOriginal.fecha_vencimiento_pago
        };
        
        const fechasNuevas = {
          inicio_vigencia: formularioParaGuardar.inicio_vigencia,
          termino_vigencia: formularioParaGuardar.termino_vigencia,
          fecha_vencimiento_pago: formularioParaGuardar.fecha_vencimiento_pago
        };
        
        const cambiaronFechasPago = 
          fechasOriginal.inicio_vigencia !== fechasNuevas.inicio_vigencia ||
          fechasOriginal.termino_vigencia !== fechasNuevas.termino_vigencia ||
          fechasOriginal.fecha_vencimiento_pago !== fechasNuevas.fecha_vencimiento_pago;
        
        const estatusOriginal = formularioOriginal.estatusPago || formularioOriginal.estatus_pago || 'Pendiente';
        const estatusActual = formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago || 'Pendiente';
        
        // Si cambiaron fechas Y el usuario NO cambió manualmente el estatus
        if (cambiaronFechasPago && estatusOriginal === estatusActual) {
          const mantenerEstatus = window.confirm(
            `🔄 Has modificado fechas de vigencia o pago.\n\n` +
            `Estatus de pago actual: "${estatusActual}"\n\n` +
            `¿Deseas MANTENER el estatus de pago actual?\n\n` +
            `• Presiona "Aceptar" para mantener: "${estatusActual}"\n` +
            `• Presiona "Cancelar" para recalcular automáticamente según la fecha de vencimiento`
          );
          
          if (!mantenerEstatus) {
            // Recalcular estatus basado en fecha_vencimiento_pago usando la misma lógica
            if (fechasNuevas.fecha_vencimiento_pago) {
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const fechaVenc = new Date(fechasNuevas.fecha_vencimiento_pago);
              fechaVenc.setHours(0, 0, 0, 0);
              
              const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
              
              // Usar la misma lógica que calcularEstatusPago
              let nuevoEstatus;
              if (diasRestantes < 0) {
                nuevoEstatus = 'Vencido';
              } else if (diasRestantes <= 15) {
                nuevoEstatus = 'Por Vencer';
              } else {
                nuevoEstatus = 'Pendiente';
              }
              
              expedientePayload.estatus_pago = nuevoEstatus;
              expedientePayload.estatusPago = nuevoEstatus;
              
              // ✅ Guardar para detectar cambio más adelante
              estatusRecalculado = { anterior: estatusOriginal, nuevo: nuevoEstatus };
              
              // ✅ CRÍTICO: Actualizar también el estado 'formulario' para que se detecte el cambio
              setFormulario(prev => ({
                ...prev,
                estatus_pago: nuevoEstatus,
                estatusPago: nuevoEstatus
              }));
              
              console.log(`📊 Estatus de pago recalculado: ${estatusOriginal} → ${nuevoEstatus} (${diasRestantes} días restantes)`);
            }
          } else {
            console.log(`📊 Manteniendo estatus de pago: ${estatusActual}`);
          }
        }
      }
      
      console.log(`✅ PUT Expediente ${formularioParaGuardar.id} | Estatus: ${expedientePayload.estatus_pago || 'N/A'}`);
      
      // ✅ Si el estatus cambió a "Pagado", actualizar etapa a "En Vigencia"
      const expedienteEnBD = expedientes.find(exp => exp.id === formularioParaGuardar.id);
      const estatusBD = expedienteEnBD?.estatus_pago || expedienteEnBD?.estatusPago;
      const estatusNuevo = expedientePayload.estatus_pago;
      
      if (estatusBD && estatusNuevo && 
          estatusBD.toLowerCase() !== 'pagado' && 
          estatusNuevo.toLowerCase() === 'pagado' &&
          expedientePayload.etapa_activa !== 'En Vigencia') {
        expedientePayload.etapa_activa = 'En Vigencia';
        console.log('✅ Cambiando etapa a "En Vigencia" porque estatus cambió a Pagado');
      }
      
      fetch(`${API_URL}/api/expedientes/${formularioParaGuardar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expedientePayload)
      })
        .then(response => response.json())
        .then(async (data) => {
          // Debug: Verificar respuesta tras UPDATE
          if (data?.data || data) {
            console.log('✅ PUT completado | ID:', formularioParaGuardar.id);
          }
          
          // 💰 Guardar solo los recibos que tienen pago (fecha_pago_real)
          // Los recibos sin pagar no necesitan POST porque el backend calcula su estatus automáticamente
          if (formularioParaGuardar.recibos && Array.isArray(formularioParaGuardar.recibos)) {
            for (const recibo of formularioParaGuardar.recibos) {
              // Solo enviar POST si el recibo tiene fecha de pago
              if (recibo.fecha_pago_real) {
                try {
                  await fetch(
                    `${API_URL}/api/recibos/${formularioParaGuardar.id}/${recibo.numero_recibo}/pago`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        estatus: recibo.estatus,
                        fecha_pago_real: recibo.fecha_pago_real,
                        comprobante_nombre: recibo.comprobante_nombre || null,
                        comprobante_url: recibo.comprobante_url || null
                      })
                    }
                  );
                } catch (error) {
                  console.error(`Error al guardar recibo ${recibo.numero_recibo}:`, error);
                }
              }
            }
          }
          
          // ✨ Registrar actualización de datos en historial (trazabilidad)
          try {
            const expedienteId = formularioParaGuardar.id;
            
            // 🔧 Helper para comparar valores, manejando null/undefined/empty
            // ⚠️ IMPORTANTE: Definir ANTES de usar para que esté disponible en todo el scope
            const normalizar = (valor, esFecha = false) => {
              if (valor === null || valor === undefined || valor === '') return '';
              if (typeof valor === 'object') return JSON.stringify(valor);
              
              // Normalizar fechas eliminando la parte de hora para comparación
              if (esFecha && valor) {
                try {
                  // Si es una fecha ISO con hora, extraer solo la fecha
                  if (valor.includes('T') || valor.includes(':')) {
                    return new Date(valor).toISOString().split('T')[0];
                  }
                  return String(valor).trim();
                } catch (e) {
                  return String(valor).trim();
                }
              }
              
              return String(valor).trim();
            };
            
            // ✅ SOLUCIÓN DEFINITIVA: Comparar BD actual vs lo que se va a guardar
            // Ignorar todo lo que pasó en el formulario (auto-fills, cálculos, etc.)
            const expedienteEnBD = expedientes.find(exp => exp.id === formularioParaGuardar.id);
            
            // 🔍 Obtener datos actuales del cliente desde la tabla de clientes
            let clienteActual = null;
            if (formularioParaGuardar.cliente_id && clientesMap[formularioParaGuardar.cliente_id]) {
              clienteActual = clientesMap[formularioParaGuardar.cliente_id];
              console.log('🔍 [COMPARACIÓN] Cliente actual desde BD:', clienteActual);
            }
            
            // Detectar cambios REALES comparando BD vs payload que se guardará
            const camposModificados = [];
            
            if (expedienteEnBD) {
              const camposAComparar = [
                // Datos básicos de póliza
                { key: 'numero_poliza', label: 'Número de póliza' },
                { key: 'compania', label: 'Aseguradora' },
                { key: 'producto', label: 'Producto' },
                { key: 'tipo_seguro', label: 'Tipo de seguro' },
                { key: 'etapa_activa', label: 'Etapa' },
                
                // Fechas (marcar como esFecha para normalización correcta)
                { key: 'fecha_emision', label: 'Fecha de emisión', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'fecha_captura', label: 'Fecha de captura', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'inicio_vigencia', label: 'Inicio de vigencia', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'termino_vigencia', label: 'Término de vigencia', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                { key: 'fecha_vencimiento_pago', label: 'Vencimiento de pago', formatter: (v) => v ? new Date(v).toISOString().split('T')[0] : '', esFecha: true },
                
                // Montos
                { key: 'prima_pagada', label: 'Prima', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'total', label: 'Total', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'subtotal', label: 'Subtotal', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'derecho_poliza', label: 'Derecho de póliza', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'iva', label: 'IVA', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'recargo', label: 'Recargo', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'cargo_pago_fraccionado', label: 'Cargo por pago fraccionado', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                { key: 'gastos_expedicion', label: 'Gastos de expedición', formatter: (v) => `$${parseFloat(v || 0).toFixed(2)}` },
                
                // Pago
                { key: 'tipo_pago', label: 'Tipo de pago' },
                { key: 'forma_pago', label: 'Forma de pago' },
                { key: 'estatusPago', label: 'Estatus de pago' },
                { key: 'periodo_gracia', label: 'Periodo de gracia', formatter: (v) => `${v || 0} días` },
                
                // Agente y comisiones
                { key: 'agente', label: 'Agente' },
                { key: 'comision_agente', label: 'Comisión agente', formatter: (v) => `${parseFloat(v || 0).toFixed(2)}%` },
                { key: 'porcentaje_comision_plataforma', label: 'Comisión plataforma', formatter: (v) => `${parseFloat(v || 0).toFixed(2)}%` },
                
                // Vehículo (para autos)
                { key: 'marca', label: 'Marca' },
                { key: 'modelo', label: 'Modelo' },
                { key: 'anio', label: 'Año' },
                { key: 'tipo', label: 'Tipo de vehículo' },
                { key: 'numero_serie', label: 'Número de serie' },
                { key: 'placas', label: 'Placas' },
                { key: 'uso', label: 'Uso' },
                { key: 'servicio', label: 'Servicio' },
                { key: 'movimiento', label: 'Movimiento' },
                
                // Conductor
                { key: 'conductor_habitual', label: 'Conductor habitual' },
                { key: 'edad_conductor', label: 'Edad del conductor' },
                
                // Datos del cliente
                { key: 'nombre', label: 'Nombre' },
                { key: 'apellido_paterno', label: 'Apellido paterno' },
                { key: 'apellido_materno', label: 'Apellido materno' },
                { key: 'email', label: 'Email' },
                { key: 'telefono_fijo', label: 'Teléfono fijo' },
                { key: 'telefono_movil', label: 'Teléfono móvil' },
                { key: 'rfc', label: 'RFC' },
                
                // Contactos principales (campos planos)
                { key: 'contacto_nombre', label: 'Nombre del contacto' },
                { key: 'contacto_apellido_paterno', label: 'Apellido paterno del contacto' },
                { key: 'contacto_apellido_materno', label: 'Apellido materno del contacto' },
                { key: 'contacto_email', label: 'Email del contacto' },
                { key: 'contacto_telefono_fijo', label: 'Teléfono fijo del contacto' },
                { key: 'contacto_telefono_movil', label: 'Teléfono móvil del contacto' },
                
                // Otros
                { key: 'observaciones', label: 'Observaciones' }
              ];
              
              // Comparar campos simples
              camposAComparar.forEach(({ key, label, formatter, esFecha }) => {
                // ⚠️ EXCLUIR campos que se calculan automáticamente O están en solo lectura
                const camposExcluidos = [
                  'agente', 
                  'tipo_pago', 
                  'fecha_vencimiento_pago', 
                  'proximoPago',
                  'estatusPago', // Se maneja por separado
                  'estatus_pago', // Se maneja por separado
                  // 🔒 EXCLUIR campos del cliente en SOLO LECTURA (nunca se pueden editar desde el formulario)
                  'nombre',
                  'apellido_paterno',
                  'apellido_materno',
                  'rfc'
                ];
                if (camposExcluidos.includes(key)) return;
                
                // 🔍 CAMPOS EDITABLES DEL CLIENTE: email, teléfonos
                // Comparar contra tabla de clientes para detectar cambios reales
                const camposClienteEditables = ['email', 'telefono_fijo', 'telefono_movil'];
                
                // Campos del contacto adicional/gestor (siempre editables)
                const camposContacto = [
                  'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno',
                  'contacto_email', 'contacto_telefono_fijo', 'contacto_telefono_movil'
                ];
                
                let valorAnterior, valorNuevo;
                
                if (camposClienteEditables.includes(key) || camposContacto.includes(key)) {
                  // Comparar contra datos actuales del cliente en la BD
                  if (!clienteActual) return; // No podemos comparar sin datos del cliente
                  
                  // Mapear nombres de campos del expediente a nombres en tabla clientes
                  const mapeoCliente = {
                    'telefono_fijo': 'telefonoFijo',
                    'telefono_movil': 'telefonoMovil'
                  };
                  const keyCliente = mapeoCliente[key] || key;
                  
                  valorAnterior = normalizar(clienteActual[keyCliente], esFecha);
                  valorNuevo = normalizar(formularioParaGuardar[key], esFecha);
                } else {
                  // Comparar campos de póliza normalmente (contra expediente anterior)
                  valorAnterior = normalizar(expedienteEnBD[key], esFecha);
                  valorNuevo = normalizar(formularioParaGuardar[key], esFecha);
                }
                
                // Solo registrar cambios REALES (ignorar cambios entre valores vacíos: null, undefined, '')
                if (valorAnterior !== valorNuevo) {
                  // Ambos valores están vacíos -> NO es un cambio real
                  if ((valorAnterior === '' || !valorAnterior) && (valorNuevo === '' || !valorNuevo)) {
                    return; // Skip - no es cambio real
                  }
                  
                  const valorAnteriorFormateado = formatter && expedienteEnBD[key] 
                    ? formatter(expedienteEnBD[key]) 
                    : (valorAnterior || 'vacío');
                  const valorNuevoFormateado = formatter && formularioParaGuardar[key]
                    ? formatter(formularioParaGuardar[key]) 
                    : (valorNuevo || 'vacío');
                  
                  camposModificados.push(`• ${label}: "${valorAnteriorFormateado}" → "${valorNuevoFormateado}"`);
                }
              });
              
              // ✅ Agregar estatus_pago si fue recalculado automáticamente
              if (estatusRecalculado && estatusRecalculado.anterior !== estatusRecalculado.nuevo) {
                camposModificados.push(`• Estatus de pago: "${estatusRecalculado.anterior}" → "${estatusRecalculado.nuevo}" (recalculado automáticamente)`);
              }
            }
            
            // 💰 DETECTAR cambio manual en estatus de pago para agregarlo a camposModificados
            let cambioEstatusPago = null;
            let etapaAfectadaPorPago = null;
            
            if (expedienteEnBD) {
              console.log('🔍 [PAGO LOG] Verificando cambio en estatus de pago...');
              console.log('🔍 [PAGO LOG] expedienteEnBD:', expedienteEnBD);
              console.log('🔍 [PAGO LOG] expedientePayload:', expedientePayload);
              console.log('🔍 [PAGO LOG] estatusRecalculado:', estatusRecalculado);
              
              // Comparar BD actual vs lo que se va a guardar
              // USAR formularioParaGuardar en lugar de expedientePayload
              const estatusPagoAnterior = estatusRecalculado 
                ? normalizar(estatusRecalculado.anterior)
                : normalizar(expedienteEnBD.estatusPago || expedienteEnBD.estatus_pago);
              const estatusPagoNuevo = estatusRecalculado
                ? normalizar(estatusRecalculado.nuevo)
                : normalizar(formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago);
              
              console.log('🔍 [PAGO LOG] estatusPagoAnterior (normalizado):', estatusPagoAnterior);
              console.log('🔍 [PAGO LOG] estatusPagoNuevo (normalizado):', estatusPagoNuevo);
              console.log('🔍 [PAGO LOG] Son diferentes?:', estatusPagoAnterior !== estatusPagoNuevo);
              console.log('🔍 [PAGO LOG] Ambos tienen valor?:', !!(estatusPagoAnterior && estatusPagoNuevo));
              
              if (estatusPagoAnterior !== estatusPagoNuevo && estatusPagoAnterior && estatusPagoNuevo) {
                const pagoAplicado = estatusPagoNuevo.toLowerCase() === 'pagado';
                const pagoRemovido = estatusPagoAnterior.toLowerCase() === 'pagado' && estatusPagoNuevo.toLowerCase() !== 'pagado';
                
                // Si se removió el pago y estaba "En Vigencia", revertir a "Emitida"
                if (pagoRemovido && expedienteEnBD.etapa_activa === 'En Vigencia') {
                  try {
                    await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ etapa_activa: 'Emitida' })
                    });
                    etapaAfectadaPorPago = 'Emitida';
                    console.log('✅ Etapa revertida de "En Vigencia" → "Emitida"');
                  } catch (e) {
                    console.warn('⚠️ No se pudo revertir etapa:', e);
                  }
                }
                
                // Guardar info del cambio para incluir en el log consolidado
                cambioEstatusPago = {
                  anterior: estatusPagoAnterior,
                  nuevo: estatusPagoNuevo,
                  pagoAplicado,
                  pagoRemovido
                };
                
                // ⚠️ NO agregar a camposModificados aquí - se mostrará en el badge destacado
                // Solo agregamos si es un cambio entre estados no-pagado (ej: Pendiente → Vencido)
                if (!pagoAplicado && !pagoRemovido) {
                  camposModificados.push(`• Estatus de pago: "${estatusPagoAnterior}" → "${estatusPagoNuevo}"`);
                }
              }
            }
            
            // Registrar evento consolidado si hubo cambios O si hubo cambio de pago manual
            if (camposModificados.length > 0 || cambioEstatusPago) {
              // 🔍 PRIMERO: Ejecutar verificación de vigencia para obtener la etapa FINAL
              let etapaFinalReal = formularioParaGuardar.etapa_activa;
              
              if (!cambioEstatusPago || (!cambioEstatusPago.pagoAplicado && !cambioEstatusPago.pagoRemovido)) {
                try {
                  const expedienteActualizado = {
                    ...formularioParaGuardar,
                    estatus_pago: formulario.estatusPago || formulario.estatus_pago,
                    estatusPago: formulario.estatusPago || formulario.estatus_pago
                  };
                  await verificarYRegistrarEstadoVigencia(expedienteActualizado, data?.historial);
                  
                  // Recargar el expediente para obtener la etapa_activa REAL después de la verificación
                  const respuestaFresh = await fetch(`${API_URL}/api/expedientes/${expedienteId}`);
                  if (respuestaFresh.ok) {
                    const datosFresh = await respuestaFresh.json();
                    const expFresh = datosFresh.data || datosFresh;
                    etapaFinalReal = expFresh.etapa_activa;
                    console.log('✅ Etapa final obtenida después de verificación:', etapaFinalReal);
                  }
                } catch (errorVigencia) {
                  console.warn('⚠️ No se pudo verificar estado de vigencia:', errorVigencia);
                }
              }
              
              // Verificar si cambió la etapa (comparar BD vs etapa FINAL REAL)
              const cambioEtapa = expedienteEnBD && expedienteEnBD.etapa_activa !== etapaFinalReal;
              const etapaFinal = etapaAfectadaPorPago || etapaFinalReal;
              
              // 🔍 Detectar si el cambio de etapa fue automático por vigencia
              const cambioAutomaticoPorVigencia = cambioEtapa && !etapaAfectadaPorPago && 
                (etapaFinalReal === 'Por Renovar' || etapaFinalReal === 'Vencida');
              
              // Construir descripción consolidada con destacado de pago/vigencia si aplica
              let descripcion = '';
              
              // 🎯 DESTACAR cambios automáticos importantes al inicio
              if (cambioEstatusPago) {
                if (cambioEstatusPago.pagoAplicado) {
                  descripcion = '🟢 PAGO APLICADO MANUALMENTE';
                } else if (cambioEstatusPago.pagoRemovido) {
                  descripcion = '⚠️ PAGO REMOVIDO';
                  // Si además cambió a vencida automáticamente, agregar ese badge también
                  if (cambioAutomaticoPorVigencia && etapaFinalReal === 'Vencida') {
                    descripcion += '\n🚨 PÓLIZA VENCIDA\n(Automático: Término de vigencia alcanzado)';
                  }
                }
              } else if (cambioAutomaticoPorVigencia) {
                if (etapaFinalReal === 'Por Renovar') {
                  descripcion = '⏰ PÓLIZA PRÓXIMA A VENCER\n(Automático: 30 días antes del vencimiento)';
                } else if (etapaFinalReal === 'Vencida') {
                  descripcion = '🚨 PÓLIZA VENCIDA\n(Automático: Término de vigencia alcanzado)';
                }
              }
              
              // Solo mostrar resumen de campos si hay cambios adicionales
              if (camposModificados.length > 0) {
                if (descripcion) descripcion += '\n\n'; // Separador solo si hay badge
                descripcion += `Póliza editada - ${camposModificados.length} campo(s) modificado(s)\n\nCampos modificados:\n${camposModificados.join('\n')}`;
              }
              
              // 📂 SIEMPRE agregar información de carpeta y estatus de pago
              if (descripcion) descripcion += '\n\n';
              
              // Mostrar movimiento de carpeta o carpeta actual
              if (cambioEtapa || etapaAfectadaPorPago) {
                // Hubo movimiento de carpeta
                descripcion += `📂 Póliza movida a: ${etapaFinal}`;
              } else {
                // No hubo movimiento - mostrar carpeta actual
                descripcion += `📂 Carpeta actual: ${formularioParaGuardar.etapa_activa}`;
              }
              
              // 💳 SIEMPRE agregar estatus de pago FINAL (después de todos los cambios)
              // Usar el estatus que se guardó en la BD, no el del formulario original
              let estatusPagoFinal;
              if (cambioEstatusPago) {
                estatusPagoFinal = cambioEstatusPago.nuevo; // Usar el nuevo estatus después del cambio
              } else {
                estatusPagoFinal = formularioParaGuardar.estatusPago || formularioParaGuardar.estatus_pago || 'Sin estatus';
              }
              descripcion += `\n💳 Estatus de pago: ${estatusPagoFinal}`;
              
              // Registrar los cambios de datos (consolidado)
              await historialService.registrarEvento({
                expediente_id: expedienteId,
                cliente_id: formularioParaGuardar.cliente_id,
                tipo_evento: historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS,
                usuario_nombre: 'Sistema', // TODO: usuario actual
                descripcion,
                datos_adicionales: {
                  numero_poliza: formularioParaGuardar.numero_poliza,
                  compania: formularioParaGuardar.compania,
                  producto: formularioParaGuardar.producto,
                  campos_modificados: camposModificados,
                  cantidad_cambios: camposModificados.length,
                  modificaciones_manuales: camposModificados.length > 0, // ✅ Marcar como modificación manual
                  ...(cambioEtapa && {
                    etapa_anterior: expedienteEnBD.etapa_activa,
                    etapa_nueva: formularioParaGuardar.etapa_activa
                  }),
                  ...(cambioEstatusPago && {
                    cambio_pago: {
                      anterior: cambioEstatusPago.anterior,
                      nuevo: cambioEstatusPago.nuevo,
                      tipo: cambioEstatusPago.pagoAplicado ? 'aplicado_manual' : cambioEstatusPago.pagoRemovido ? 'removido_manual' : 'cambio_estatus'
                    }
                  })
                }
              });
              console.log(`✅ Evento consolidado "Edición" registrado con ${camposModificados.length} cambios${cambioEtapa ? ' (incluye cambio de etapa)' : ''}${cambioEstatusPago ? ' (incluye cambio de pago)' : ''}`);
              
              // 🎯 Detectar cambios automáticos de vigencia/renovación por edición de fechas
              if (expedienteAnterior) {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                
                // ⚠️ PENDIENTE: Flujo completo de renovación con módulo de cotizaciones
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // CONTEXTO: Cuando se habilite el módulo de cotizaciones, completar el
                // flujo de renovación con los siguientes estados y eventos:
                //
                // CARPETAS Y FLUJO:
                // ─────────────────────────────────────────────────────────────────
                // 📂 "Por Renovar" o "Vencidas" → Usuario hace clic en botón "Cotizar"
                //    ↓
                // 📂 "En Proceso" (desde que inicia cotización hasta que se paga)
                //    ↓
                // 📂 "Renovadas" (cuando se aplica el pago)
                //
                // EVENTOS Y ESTADOS:
                // ─────────────────────────────────────────────────────────────────
                // 1. ⏰ POLIZA_PROXIMA_VENCER - Ya implementado ✅
                //    └─> Automático: fecha_aviso_renovacion <= hoy
                //    └─> Carpeta: "Por Renovar"
                //    └─> Estado: etapa_activa sin cambios
                //
                // 2. ❌ POLIZA_VENCIDA - Ya implementado ✅
                //    └─> Automático: termino_vigencia < hoy
                //    └─> Carpeta: "Vencidas"
                //    └─> Estado: etapa_activa = "Vencida" (opcional)
                //
                // 3. 📝 COTIZACION_RENOVACION_INICIADA - Pendiente
                //    └─> Trigger: Botón "Cotizar" en listado (carpetas Por Renovar/Vencidas)
                //    └─> Acción: Abrir modal/formulario de cotización
                //    └─> Cambio: etapa_activa = "En Cotización - Renovación"
                //    └─> Carpeta: "En Proceso"
                //
                // 4. 📧 COTIZACION_RENOVACION_ENVIADA - Pendiente
                //    └─> Trigger: Se envía cotización de renovación al cliente
                //    └─> Cambio: etapa_activa = "Renovación Enviada"
                //    └─> Carpeta: "En Proceso"
                //    └─> Registrar: destinatario, monto, PDF, fecha de envío
                //
                // 5. ⏳ RENOVACION_PENDIENTE_EMISION - Pendiente
                //    └─> Trigger: Cliente autoriza cotización
                //    └─> Cambio: etapa_activa = "Pendiente de Emisión - Renovación"
                //    └─> Carpeta: "En Proceso"
                //
                // 6. 📄 RENOVACION_EMITIDA - Pendiente
                //    └─> Trigger: Aseguradora emite la póliza renovada
                //    └─> Cambio: etapa_activa = "Renovación Emitida"
                //    └─> Carpeta: "En Proceso"
                //    └─> Actualizar: nuevo numero_poliza (si aplica), nuevas vigencias
                //
                // 7. 💰 PAGO_RENOVACION_REGISTRADO - Pendiente
                //    └─> Trigger: Se registra pago de la renovación
                //    └─> Cambio: estatus_pago = "Pagado"
                //    └─> Registrar: monto, método, comprobante
                //
                // 8. 🔁 RENOVACION_VIGENTE - Pendiente
                //    └─> Trigger: Pago completado (automático tras registrar pago)
                //    └─> Cambio: etapa_activa = "Renovada"
                //    └─> Carpeta: "Renovadas" (NO va a "Vigentes", va a carpeta especial)
                //    └─> Actualizar: inicio_vigencia (nuevo inicio)
                //    └─> Actualizar: termino_vigencia (nuevo inicio + 1 año)
                //    └─> Actualizar: fecha_aviso_renovacion (nuevo término - 30 días)
                //    └─> Nota: tipo_movimiento = "renovacion" (para distinguir de nuevas)
                //
                // CONSIDERACIONES TÉCNICAS:
                // ─────────────────────────────────────────────────────────────────
                // - Crear eventos específicos para renovación (COTIZACION_RENOVACION_*, etc.)
                //   para mantener claridad en el historial y poder filtrar/analizar renovaciones
                // - El campo tipo_movimiento = "renovacion" permite diferenciar en reportes
                // - La carpeta "Renovadas" mantiene pólizas renovadas separadas de nuevas
                // - Considerar si crear nueva fila en BD o actualizar la existente
                //   (Recomendado: actualizar existente y mantener historial en tabla de eventos)
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                
                // ✅ La verificación de vigencia ya se ejecutó ANTES de registrar el log
                // (Ver líneas arriba, se ejecuta antes de generar el log para obtener etapa_activa FINAL)
              }
            } else {
              console.log('ℹ️ No se detectaron cambios reales, no se registra evento de edición');
            }
          } catch (e) {
            console.warn('⚠️ No se pudo registrar evento de actualización:', e);
          }

          limpiarFormulario();
          await recargarExpedientes(); // Esperar a que se recarguen los datos
          setVistaActual('lista');
        })
        .catch(err => {
          console.error('❌ Error al actualizar expediente:', err);
          toast.error('Error al actualizar expediente: ' + err.message);
        });
    } else {
      // 🚨 DEBUG CRÍTICO: Verificar el payload final del POST
      const payloadFinal = {
        ...expedientePayload,
        fecha_creacion: new Date().toISOString().split('T')[0]
      };
      
      console.log(`✅ POST Expediente | Póliza: ${payloadFinal.numero_poliza || 'N/A'} | Cliente: ${payloadFinal.cliente_id || 'N/A'}`);
      
  fetch(`${API_URL}/api/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFinal)
      })
        .then(response => response.json())
        .then(async (data) => {
          // Debug: Verificar respuesta tras CREATE
          if (data?.id || data?.data?.id) {
            console.log('✅ POST completado | ID:', data?.id || data?.data?.id);
          }
          
          // 💰 CARGAR RECIBOS DEL EXPEDIENTE RECIÉN CREADO
          const nuevoId = data?.id || data?.data?.id;
          if (nuevoId) {
            try {
              console.log('📋 Cargando recibos del expediente recién creado:', nuevoId);
              const recibosResponse = await fetch(`${API_URL}/api/recibos/${nuevoId}`);
              if (recibosResponse.ok) {
                const recibosData = await recibosResponse.json();
                if (recibosData.success && recibosData.data && Array.isArray(recibosData.data)) {
                  console.log(`✅ ${recibosData.data.length} recibos cargados para la nueva póliza`);
                  
                  // Actualizar el formulario con los recibos antes de limpiar
                  setFormulario(prev => ({
                    ...prev,
                    id: nuevoId,
                    recibos: recibosData.data
                  }));
                  
                  console.log('📋 Recibos cargados:', recibosData.data);
                } else {
                  console.warn('⚠️ Backend no devolvió recibos para el nuevo expediente');
                }
              }
            } catch (errorRecibos) {
              console.error('❌ Error al cargar recibos:', errorRecibos);
            }
          }
          
          // ✨ Registrar creación en historial de trazabilidad
          try {
            const nuevoId = data?.id || data?.data?.id;
            if (nuevoId) {
              const etapaActual = expedientePayload.etapa_activa || 'En cotización';
              const capturadoConExtractorPDF = formularioParaGuardar._capturado_con_extractor_pdf === true;
              const nombreArchivoPDF = formularioParaGuardar._nombre_archivo_pdf || 'PDF importado';
              
              console.log('🔍 DEBUG captura evento:', {
                capturadoConExtractorPDF,
                nombreArchivoPDF,
                tiene_datos_originales: !!formularioParaGuardar._datos_originales_pdf
              });
              
              // 🔍 DETECTAR CAMPOS MODIFICADOS MANUALMENTE
              // ✅ LÓGICA SIMPLE: Si existe snapshot (formularioOriginal), comparar todo el formulario
              const camposModificados = [];
              let huboModificacionesManuales = false;
              
              if (formularioOriginal) {
                console.log('✅ Snapshot disponible - detectando cambios desde el estado inicial completo');
                console.log('📸 Campos en snapshot:', Object.keys(formularioOriginal).filter(k => !k.startsWith('_')).length);
                console.log('🔍 DEBUG - Valores clave en snapshot:', {
                  contacto_nombre: formularioOriginal.contacto_nombre,
                  contacto_telefono_fijo: formularioOriginal.contacto_telefono_fijo,
                  conductor_habitual: formularioOriginal.conductor_habitual,
                  fecha_emision: formularioOriginal.fecha_emision,
                  fecha_captura: formularioOriginal.fecha_captura
                });
                console.log('🔍 DEBUG - Valores clave en formulario actual:', {
                  contacto_nombre: formularioParaGuardar.contacto_nombre,
                  contacto_telefono_fijo: formularioParaGuardar.contacto_telefono_fijo,
                  conductor_habitual: formularioParaGuardar.conductor_habitual,
                  fecha_emision: formularioParaGuardar.fecha_emision,
                  fecha_captura: formularioParaGuardar.fecha_captura
                });
                
                // Normalizar valores para comparación
                const normalizar = (valor) => {
                  if (valor === null || valor === undefined) return '';
                  if (typeof valor === 'object') return JSON.stringify(valor);
                  return String(valor).trim();
                };
                
                // Lista de campos editables a comparar
                const camposEditables = [
                  // === DATOS DEL CLIENTE ===
                  { key: 'nombre', label: 'Nombre del cliente' },
                  { key: 'apellido_paterno', label: 'Apellido paterno del cliente' },
                  { key: 'apellido_materno', label: 'Apellido materno del cliente' },
                  { key: 'razon_social', label: 'Razón social' },
                  { key: 'nombre_comercial', label: 'Nombre comercial' },
                  { key: 'rfc', label: 'RFC' },
                  { key: 'curp', label: 'CURP' },
                  { key: 'email', label: 'Email del cliente' },
                  { key: 'telefono_fijo', label: 'Teléfono fijo del cliente' },
                  { key: 'telefono_movil', label: 'Teléfono móvil del cliente' },
                  { key: 'domicilio', label: 'Domicilio' },
                  
                  // === CONTACTO ADICIONAL ===
                  { key: 'contacto_nombre', label: 'Nombre del contacto' },
                  { key: 'contacto_apellido_paterno', label: 'Apellido paterno del contacto' },
                  { key: 'contacto_apellido_materno', label: 'Apellido materno del contacto' },
                  { key: 'contacto_email', label: 'Email del contacto' },
                  { key: 'contacto_telefono_fijo', label: 'Teléfono fijo del contacto' },
                  { key: 'contacto_telefono_movil', label: 'Teléfono móvil del contacto' },
                  
                  // === DATOS BÁSICOS DE PÓLIZA ===
                  { key: 'numero_poliza', label: 'Número de póliza' },
                  { key: 'compania', label: 'Aseguradora' },
                  { key: 'producto', label: 'Producto' },
                  { key: 'tipo_seguro', label: 'Tipo de seguro' },
                  { key: 'endoso', label: 'Endoso' },
                  { key: 'inciso', label: 'Inciso' },
                  
                  // === FECHAS ===
                  { key: 'fecha_emision', label: 'Fecha de emisión' },
                  { key: 'fecha_captura', label: 'Fecha de captura' },
                  { key: 'inicio_vigencia', label: 'Inicio de vigencia' },
                  { key: 'termino_vigencia', label: 'Término de vigencia' },
                  
                  // === MONTOS ===
                  { key: 'prima_pagada', label: 'Prima' },
                  { key: 'cargo_pago_fraccionado', label: 'Cargo pago fraccionado' },
                  { key: 'gastos_expedicion', label: 'Gastos de expedición' },
                  { key: 'iva', label: 'IVA' },
                  { key: 'recargo', label: 'Recargo' },
                  { key: 'total', label: 'Total' },
                  { key: 'subtotal', label: 'Subtotal' },
                  { key: 'suma_asegurada', label: 'Suma asegurada' },
                  { key: 'deducible', label: 'Deducible' },
                  
                  // === PAGO ===
                  { key: 'forma_pago', label: 'Forma de pago' },
                  { key: 'tipo_pago', label: 'Tipo de pago' },
                  { key: 'frecuenciaPago', label: 'Frecuencia de pago' },
                  { key: 'primer_pago', label: 'Primer pago' },
                  { key: 'pagos_subsecuentes', label: 'Pagos subsecuentes' },
                  { key: 'periodo_gracia', label: 'Período de gracia' },
                  
                  // === VEHÍCULO (PARA AUTOS) ===
                  { key: 'marca', label: 'Marca' },
                  { key: 'modelo', label: 'Modelo' },
                  { key: 'anio', label: 'Año' },
                  { key: 'tipo_vehiculo', label: 'Tipo de vehículo' },
                  { key: 'numero_serie', label: 'Número de serie' },
                  { key: 'motor', label: 'Motor' },
                  { key: 'placas', label: 'Placas' },
                  { key: 'color', label: 'Color' },
                  { key: 'codigo_vehiculo', label: 'Código de vehículo' },
                  { key: 'tipo_cobertura', label: 'Tipo de cobertura' },
                  { key: 'plan', label: 'Plan' },
                  
                  // === USO Y SERVICIO ===
                  { key: 'uso', label: 'Uso' },
                  { key: 'servicio', label: 'Servicio' },
                  { key: 'movimiento', label: 'Movimiento' },
                  
                  // === CONDUCTOR ===
                  { key: 'conductor_habitual', label: 'Conductor habitual' },
                  { key: 'edad_conductor', label: 'Edad del conductor' },
                  { key: 'licencia_conducir', label: 'Licencia de conducir' },
                  
                  // === OTROS ===
                  { key: 'observaciones', label: 'Observaciones' }
                ];
                
                // Comparar cada campo
                camposEditables.forEach(({ key, label }) => {
                  const valorOriginal = normalizar(formularioOriginal[key]);
                  const valorActual = normalizar(formularioParaGuardar[key]);
                  
                  if (valorOriginal !== valorActual) {
                    // Ignorar cambios de vacío a vacío
                    if (!valorOriginal && !valorActual) return;
                    
                    camposModificados.push(
                      `• ${label}: "${valorOriginal || 'vacío'}" → "${valorActual || 'vacío'}"`
                    );
                    console.log(`  ✏️ ${label}: "${valorOriginal || 'vacío'}" → "${valorActual || 'vacío'}"`);
                  }
                });
                
                huboModificacionesManuales = camposModificados.length > 0;
                console.log(`✅ ${camposModificados.length} campo(s) modificado(s) manualmente`);
              } else {
                console.log('⚠️ No hay snapshot - no se pueden detectar cambios manuales');
              }
              
              // 🎯 EVENTO CAPTURA: Registrar en el nuevo sistema de historial
              const metodCaptura = capturadoConExtractorPDF ? 'Extractor PDF' : 'Captura Manual';
              const aseguradoraNombre = expedientePayload.compania || 'Aseguradora';
              const fechaCaptura = new Date().toISOString().split('T')[0];
              
              // Registrar en el sistema de historial (nueva tabla)
              const fechaEmision = expedientePayload.fecha_emision || 'No especificada';
              const inicioVigencia = expedientePayload.inicio_vigencia || 'No especificada';
              
              // Construir descripción con información relevante
              let descripcionEvento = '';
              if (capturadoConExtractorPDF) {
                // Incluir nombre de la aseguradora para identificar qué extractor se usó
                descripcionEvento = `Póliza extraída con Extractor PDF ${aseguradoraNombre} • Archivo: ${nombreArchivoPDF}`;
                if (huboModificacionesManuales && camposModificados.length > 0) {
                  descripcionEvento += `\n\n${camposModificados.length} campo(s) modificado(s) manualmente:\n${camposModificados.join('\n')}`;
                }
              } else {
                descripcionEvento = `Póliza capturada manualmente`;
                if (huboModificacionesManuales && camposModificados.length > 0) {
                  descripcionEvento += `\n\nCampos capturados:\n${camposModificados.join('\n')}`;
                }
              }
              
              // Agregar información de fechas si están disponibles
              const infoFechas = [];
              if (fechaEmision && fechaEmision !== 'No especificada') {
                infoFechas.push(`Emisión: ${fechaEmision}`);
              }
              if (inicioVigencia && inicioVigencia !== 'No especificada') {
                infoFechas.push(`Vigencia: ${inicioVigencia}`);
              }
              if (infoFechas.length > 0) {
                descripcionEvento += ` • ${infoFechas.join(' • ')}`;
              }
              
              const eventoData = {
                expediente_id: String(nuevoId), // Convertir a string para coincidir con VARCHAR(50)
                cliente_id: String(expedientePayload.cliente_id),
                tipo_evento: capturadoConExtractorPDF 
                  ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
                  : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
                usuario_nombre: 'Sistema',
                descripcion: descripcionEvento,
                datos_adicionales: {
                  metodo: metodCaptura,
                  numero_poliza: expedientePayload.numero_poliza,
                  compania: aseguradoraNombre,
                  producto: expedientePayload.producto || '',
                  etapa_inicial: etapaActual,
                  fecha_emision: fechaEmision,
                  inicio_vigencia: inicioVigencia,
                  ...(capturadoConExtractorPDF && {
                    nombre_archivo_pdf: nombreArchivoPDF,
                    modificaciones_manuales: huboModificacionesManuales,
                    ...(huboModificacionesManuales && camposModificados.length > 0 && {
                      campos_modificados: camposModificados
                    })
                  })
                }
              };
              
              console.log('🔍 DEBUG: Registrando evento en historial con datos:', eventoData);
              await historialService.registrarEvento(eventoData);
              
              console.log(`✅ Captura registrada en historial: ${metodCaptura} - ${aseguradoraNombre}`);
              
              // 💰 REGISTRAR PAGO INICIAL si la póliza fue marcada como "Pagado" al momento de captura
              const estatusPago = expedientePayload.estatus_pago || expedientePayload.estatusPago;
              if (estatusPago === 'Pagado') {
                console.log('💰 Detectado pago aplicado en captura inicial, registrando evento...');
                try {
                  const fechaPago = expedientePayload.fecha_ultimo_pago || expedientePayload.fecha_vencimiento_pago || new Date().toISOString().split('T')[0];
                  const fechaPagoFormateada = new Date(fechaPago).toLocaleDateString('es-MX', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  });
                  
                  const comentarioPago = `💰 Pago Registrado en Captura Inicial\n` +
                    `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                    `💵 Monto: $${parseFloat(expedientePayload.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                    `✅ Póliza marcada como pagada desde la captura`;
                  
                  await historialService.registrarEvento({
                    expediente_id: String(nuevoId),
                    cliente_id: String(expedientePayload.cliente_id),
                    tipo_evento: historialService.TIPOS_EVENTO.PAGO_REGISTRADO,
                    usuario_nombre: 'Sistema',
                    descripcion: comentarioPago,
                    datos_adicionales: {
                      numero_poliza: expedientePayload.numero_poliza,
                      compania: aseguradoraNombre,
                      producto: expedientePayload.producto || '',
                      monto_total: expedientePayload.total || null,
                      monto_pagado: expedientePayload.total || null,
                      fecha_pago: fechaPago,
                      tipo_pago: expedientePayload.tipo_pago,
                      frecuencia_pago: expedientePayload.frecuenciaPago,
                      aplicado_en_captura: true
                    }
                  });
                  console.log('✅ Evento de pago inicial registrado en historial');
                } catch (errorPagoInicial) {
                  console.warn('⚠️ No se pudo registrar evento de pago inicial:', errorPagoInicial);
                }
              }
            }
          } catch (error) {
            console.warn('⚠️ Error al registrar captura:', error.message);
          }

          try {
            // Obtener ID del expediente creado (compatibilidad con posibles estructuras)
            const nuevoId = data?.id || data?.data?.id;
            if (nuevoId && formulario.__pdfFile) {
              console.log('📤 Subiendo PDF automáticamente para expediente recién creado:', nuevoId);
              setSubiendoPDF(true);
              try {
                const pdfData = await pdfService.subirPDFPoliza(nuevoId, formulario.__pdfFile);
                // Refrescar listado para reflejar metadatos del PDF
                await recargarExpedientes();
                console.log('✅ PDF subido automáticamente:', pdfData?.pdf_nombre || formulario.__pdfNombre || 'PDF');
              } catch (error) {
                console.error('⚠️ Error al subir automáticamente el PDF:', error);
                toast('⚠️ Expediente creado, pero no se pudo subir el PDF automáticamente: ' + error.message);
              } finally {
                setSubiendoPDF(false);
              }
            }
          } catch (e) {
            console.warn('No fue posible realizar la subida automática del PDF:', e);
          }
          limpiarFormulario();
          recargarExpedientes();
          setVistaActual('lista');
        })
        .catch(err => {
          console.error('❌ Error al crear expediente:', err);
          toast.error('Error al crear expediente: ' + err.message);
        });
    }
  }, [formulario, modoEdicion, actualizarCalculosAutomaticos, limpiarFormulario, validarFormulario, clienteSeleccionado]);
  const recargarExpedientes = useCallback(async () => {
    try {
      // Obtener expedientes frescos SIN cache
      const resExpedientes = await fetch(`${API_URL}/api/expedientes?t=${Date.now()}`);
      const expedientes = await resExpedientes.json();
      
      // 2. Obtener todos los clientes
      const resClientes = await fetch(`${API_URL}/api/clientes`);
      const clientesData = await resClientes.json();
      
      // 3. Crear un mapa de clientes por ID para búsqueda rápida
      const mapa = {};
      clientesData.forEach(cliente => {
        mapa[cliente.id] = cliente;
      });
      
      // 4. Actualizar estados de clientes
      setClientes(clientesData);
      setClientesMap(mapa);
      
      // 🔥 Ya no normalizamos estatusPago - se calcula dinámicamente con calcularEstatusPagoActual()
      setExpedientes(expedientes);
    } catch (err) {
      console.error('Error al recargar expedientes:', err);
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES PARA FLUJO DE RENOVACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * 1. Iniciar Cotización de Renovación
   */
  const iniciarCotizacionRenovacion = useCallback(async (expediente) => {
    try {
      setExpedienteParaRenovacion(expediente);
      setMostrarModalCotizarRenovacion(true);
    } catch (error) {
      console.error('Error al abrir modal de cotización:', error);
      toast.error('Error al iniciar cotización de renovación');
    }
  }, []);

  const guardarCotizacionRenovacion = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      await cambiarEstadoExpediente(expedienteParaRenovacion.id, 'En Cotización - Renovación');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA,
        usuario_nombre: 'Sistema',
        descripcion: 'Cotización de renovación iniciada',
        datos_adicionales: {
          numero_poliza: expedienteParaRenovacion.numero_poliza,
          compania: expedienteParaRenovacion.compania
        }
      });
      
      toast.success('Cotización de renovación iniciada');
      setMostrarModalCotizarRenovacion(false);
      setExpedienteParaRenovacion(null);
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      toast.error('Error al guardar cotización de renovación');
    }
  }, [cambiarEstadoExpediente, recargarExpedientes]);

  /**
   * 2. Marcar como Autorizado
   */
  const marcarRenovacionAutorizada = useCallback(async (expediente) => {
    try {
      setExpedienteParaRenovacion(expediente);
      setMostrarModalAutorizarRenovacion(true);
    } catch (error) {
      console.error('Error al abrir modal autorizar:', error);
      toast.error('Error al marcar renovación como autorizada');
    }
  }, []);

  const confirmarRenovacionAutorizada = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      await cambiarEstadoExpediente(expedienteParaRenovacion.id, 'Pendiente de Emisión - Renovación');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION,
        usuario_nombre: 'Sistema',
        descripcion: 'Cliente autorizó la renovación - Pendiente de emisión',
        datos_adicionales: {
          numero_poliza: expedienteParaRenovacion.numero_poliza,
          compania: expedienteParaRenovacion.compania
        }
      });
      
      toast.success('Renovación marcada como autorizada');
      setMostrarModalAutorizarRenovacion(false);
      setExpedienteParaRenovacion(null);
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al marcar como autorizada:', error);
      toast.error('Error al marcar renovación como autorizada');
    }
  }, [cambiarEstadoExpediente, recargarExpedientes]);

  /**
   * 3. Agregar Póliza Renovada
   */
  const abrirModalPolizaRenovada = useCallback((expediente) => {
    setExpedienteParaRenovacion(expediente);
    
    const hoy = new Date();
    const inicioVigencia = new Date(hoy);
    const terminoVigencia = new Date(inicioVigencia);
    terminoVigencia.setFullYear(terminoVigencia.getFullYear() + 1);
    
    setDatosRenovacion({
      numeroPolizaNueva: expediente.numero_poliza || '',
      primaNueva: expediente.prima_pagada || '',
      totalNuevo: expediente.total || '',
      fechaEmisionNueva: hoy.toISOString().split('T')[0],
      inicioVigenciaNueva: inicioVigencia.toISOString().split('T')[0],
      terminoVigenciaNueva: terminoVigencia.toISOString().split('T')[0],
      observaciones: ''
    });
    
    setMostrarModalPolizaRenovada(true);
  }, []);

  const guardarPolizaRenovada = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      const terminoVigencia = new Date(datosRenovacion.terminoVigenciaNueva);
      const fechaAviso = new Date(terminoVigencia);
      fechaAviso.setDate(fechaAviso.getDate() - 30);
      
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_poliza: datosRenovacion.numeroPolizaNueva,
          prima_pagada: parseFloat(datosRenovacion.primaNueva) || 0,
          total: parseFloat(datosRenovacion.totalNuevo) || 0,
          fecha_emision: datosRenovacion.fechaEmisionNueva,
          inicio_vigencia: datosRenovacion.inicioVigenciaNueva,
          termino_vigencia: datosRenovacion.terminoVigenciaNueva,
          fecha_aviso_renovacion: fechaAviso.toISOString().split('T')[0],
          etapa_activa: 'Renovación Emitida',
          tipo_movimiento: 'renovacion'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.RENOVACION_EMITIDA,
        usuario_nombre: 'Sistema',
        descripcion: `Póliza renovada emitida - Nueva vigencia: ${datosRenovacion.inicioVigenciaNueva} a ${datosRenovacion.terminoVigenciaNueva}`,
        datos_adicionales: {
          numero_poliza: datosRenovacion.numeroPolizaNueva,
          compania: expedienteParaRenovacion.compania,
          prima_nueva: datosRenovacion.primaNueva,
          total_nuevo: datosRenovacion.totalNuevo,
          observaciones: datosRenovacion.observaciones
        }
      });
      
      toast.success('Póliza renovada registrada exitosamente');
      setMostrarModalPolizaRenovada(false);
      setExpedienteParaRenovacion(null);
      setDatosRenovacion({
        numeroPolizaNueva: '',
        primaNueva: '',
        totalNuevo: '',
        fechaEmisionNueva: '',
        inicioVigenciaNueva: '',
        terminoVigenciaNueva: '',
        observaciones: ''
      });
      await recargarExpedientes();
      
    } catch (error) {
      console.error('Error al guardar póliza renovada:', error);
      toast.error('Error al guardar póliza renovada');
    }
  }, [recargarExpedientes]);
  
  // ✅ FUNCIÓN para convertir snake_case a camelCase
  const snakeToCamel = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  };

  // ✅ CONVERSIÓN de snake_case a camelCase para uso interno del frontend
  const convertirACamelCase = (obj) => {
    console.log('🔄 [convertirACamelCase] ENTRADA - obj:', obj);
    console.log('🔄 [convertirACamelCase] cargo_pago_fraccionado entrante:', obj.cargo_pago_fraccionado);
    console.log('🔄 [convertirACamelCase] gastos_expedicion entrante:', obj.gastos_expedicion);
    
    const resultado = {};
    
    // Mapeo específico de campos conocidos (inverso del anterior)
    const mapeoEspecifico = {
      // Identificación
      numero_poliza: 'numeroPoliza',
      cliente_id: 'clienteId', 
      agente_id: 'agenteId',
      vendedor_id: 'vendedorId',
      clave_aseguradora: 'claveAseguradora',
      
      // Datos Cliente
      apellido_paterno: 'apellidoPaterno',
      apellido_materno: 'apellidoMaterno',
      razon_social: 'razonSocial',
      nombre_comercial: 'nombreComercial',
      numero_identificacion: 'numeroIdentificacion',
      telefono_fijo: 'telefonoFijo',
      telefono_movil: 'telefonoMovil',
      
      // Póliza
      cargo_pago_fraccionado: 'cargoPagoFraccionado',
      motivo_cancelacion: 'motivoCancelacion',
      frecuencia_pago: 'frecuenciaPago',
      proximo_pago: 'proximoPago',
      estatus_pago: 'estatusPago',
      gastos_expedicion: 'gastosExpedicion',
      sub_agente: 'subAgente',
      
      // Vehículo
      numero_serie: 'numeroSerie',
      tipo_vehiculo: 'tipoVehiculo',
      tipo_cobertura: 'tipoCobertura',
      suma_asegurada: 'sumaAsegurada',
      conductor_habitual: 'conductorHabitual',
      edad_conductor: 'edadConductor',
      licencia_conducir: 'licenciaConducir',
      
      // Financiero
      prima_pagada: 'primaPagada',
      periodo_gracia: 'periodoGracia',
      fecha_ultimo_pago: 'fechaUltimoPago',
      fecha_vencimiento_pago: 'fechaVencimientoPago',
      
      // Vigencia
      inicio_vigencia: 'inicioVigencia',
      termino_vigencia: 'terminoVigencia',
      
      // Estado
      etapa_activa: 'etapaActiva',
      tipo_pago: 'tipoPago',
      fecha_creacion: 'fechaCreacion'
    };

    Object.keys(obj).forEach(key => {
      // Usar mapeo específico si existe, sino conversión automática
      const camelKey = mapeoEspecifico[key] || snakeToCamel(key);
      resultado[camelKey] = obj[key];
      
      // También mantener la versión original para compatibilidad
      resultado[key] = obj[key];
      
      // Debug específico para campos problemáticos
      if (key === 'cargo_pago_fraccionado' || key === 'gastos_expedicion') {
        console.log(`🔄 [convertirACamelCase] ${key} → ${camelKey}: "${obj[key]}" (tipo: ${typeof obj[key]})`);
      }
    });

    console.log('🔄 [convertirACamelCase] SALIDA - resultado:', resultado);
    console.log('🔄 [convertirACamelCase] cargo_pago_fraccionado final:', resultado.cargo_pago_fraccionado);
    console.log('🔄 [convertirACamelCase] cargoPagoFraccionado final:', resultado.cargoPagoFraccionado);
    console.log('🔄 [convertirACamelCase] gastos_expedicion final:', resultado.gastos_expedicion);
    console.log('🔄 [convertirACamelCase] gastosExpedicion final:', resultado.gastosExpedicion);
    
    return resultado;
  };

  const editarExpediente = useCallback(async (expediente) => {
    // Traer el expediente completo por ID para garantizar datos frescos de la BD
    let expedienteCompleto = expediente;
    try {
      console.log('🔄 Recargando expediente fresco desde API:', expediente.id);
      const resp = await fetch(`${API_URL}/api/expedientes/${expediente.id}`);
      if (resp.ok) {
        const data = await resp.json();
        const desdeApi = data?.data ?? data;
        if (desdeApi && typeof desdeApi === 'object') {
          console.log('📅 Fechas RAW desde API:', {
            fecha_emision: desdeApi.fecha_emision,
            inicio_vigencia: desdeApi.inicio_vigencia,
            termino_vigencia: desdeApi.termino_vigencia
          });
          
          // Convertir snake_case a camelCase para uso interno del frontend
          const datosConvertidos = convertirACamelCase(desdeApi);
          
          console.log('📅 Fechas DESPUÉS de convertir:', {
            fecha_emision: datosConvertidos.fecha_emision,
            inicio_vigencia: datosConvertidos.inicio_vigencia,
            termino_vigencia: datosConvertidos.termino_vigencia
          });
          
          console.log('💰 [EDITAR] Estatus de pago RAW desde API:', {
            estatus_pago: desdeApi.estatus_pago,
            estatusPago: desdeApi.estatusPago
          });
          
          console.log('💰 [EDITAR] Estatus de pago DESPUÉS de convertir:', {
            estatus_pago: datosConvertidos.estatus_pago,
            estatusPago: datosConvertidos.estatusPago
          });
          
          console.log('💰 [EDITAR] Montos de pagos fraccionados desde API:', {
            primer_pago: desdeApi.primer_pago,
            primerPago: desdeApi.primerPago,
            pagos_subsecuentes: desdeApi.pagos_subsecuentes,
            pagosSubsecuentes: desdeApi.pagosSubsecuentes,
            convertidos: {
              primer_pago: datosConvertidos.primer_pago,
              primerPago: datosConvertidos.primerPago,
              pagos_subsecuentes: datosConvertidos.pagos_subsecuentes,
              pagosSubsecuentes: datosConvertidos.pagosSubsecuentes
            }
          });
          
          // ✅ IMPORTANTE: Datos de API tienen prioridad sobre datos en memoria
          expedienteCompleto = { ...datosConvertidos };
          console.log('✅ Expediente recargado desde API con datos frescos');
        }
        try {
          console.groupCollapsed('🌐 API GET /api/expedientes/:id — payload crudo');
          console.log(desdeApi);
          console.groupEnd();
        } catch (_) {}
      } else {
        console.warn('⚠️ No se pudo recargar expediente desde API, usando datos en memoria');
      }
    } catch (e) {
      console.warn('⚠️ No se pudo obtener el expediente por ID, se usará el de la lista:', e);
    }

    // DEBUG: Verificar los 6 campos al ENTRAR A EDITAR (ya con datos del GET si estuvo disponible)
    try {
      const k = (v) => (v === undefined || v === null || v === '' ? '(vacío)' : v);
      console.groupCollapsed('🧪 DEBUG Editar Expediente — Datos desde BD');
      console.table([
        { campo: 'uso | variantes', valor: k(expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo) },
        { campo: 'servicio | variantes', valor: k(expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo) },
        { campo: 'movimiento | variantes', valor: k(expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento) },
        { campo: 'cargo_pago_fraccionado | camel', valor: k(expedienteCompleto.cargo_pago_fraccionado ?? expedienteCompleto.cargoPagoFraccionado) },
        { campo: 'gastos_expedicion | camel', valor: k(expedienteCompleto.gastos_expedicion ?? expedienteCompleto.gastosExpedicion) },
        { campo: 'subtotal | variantes', valor: k(expedienteCompleto.subtotal ?? expedienteCompleto.sub_total ?? expedienteCompleto.subTotal) }
      ]);
      console.groupEnd();
    } catch (_) { /* noop */ }

    // Helper para convertir fechas ISO a formato YYYY-MM-DD
    const formatearFechaParaInput = (fecha) => {
      if (!fecha) return '';
      try {
        // Si viene en formato ISO (2025-11-12T00:00:00.000Z), extraer solo la fecha
        return fecha.split('T')[0];
      } catch {
        return fecha;
      }
    };

    // 🎯 CARGA LAZY: Obtener recibos solo cuando se necesita (editar)
    let fechaVencimientoPagoReal = formatearFechaParaInput(expedienteCompleto.fecha_vencimiento_pago) || '';
    let recibosDelExpediente = [];
    
    try {
      console.log('🔍 [EDITAR] Cargando recibos con GET /api/recibos/:id...');
      const recibosResponse = await fetch(`${API_URL}/api/recibos/${expedienteCompleto.id}`);
      if (recibosResponse.ok) {
        const recibosData = await recibosResponse.json();
        console.log('📦 [EDITAR] Respuesta cruda del backend:', recibosData);
        const recibosArray = recibosData?.data || recibosData || [];
        
        if (Array.isArray(recibosArray)) {
          console.log('✅ [EDITAR] Recibos cargados:', recibosArray.length);
          console.log('📋 [EDITAR] Recibos:', recibosArray);
          recibosDelExpediente = recibosArray;
          
          // Encontrar primer recibo pendiente
          const recibosPendientes = recibosArray
            .filter(r => !r.fecha_pago_real)
            .sort((a, b) => a.numero_recibo - b.numero_recibo);
          
          if (recibosPendientes.length > 0) {
            fechaVencimientoPagoReal = formatearFechaParaInput(recibosPendientes[0].fecha_vencimiento);
            console.log('📅 [EDITAR] Próximo vencimiento:', fechaVencimientoPagoReal);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [EDITAR] Error al cargar recibos:', error);
    }
    
    // Construir formulario base normalizado
    const formularioBase = {
      ...expedienteCompleto,
      // ✅ Incluir recibos cargados
      recibos: recibosDelExpediente,
      // Normalizar fechas que vienen en formato ISO a YYYY-MM-DD
  fecha_emision: formatearFechaParaInput(expedienteCompleto.fecha_emision) || formatearFechaParaInput(expedienteCompleto.created_at) || new Date().toISOString().split('T')[0],
  inicio_vigencia: formatearFechaParaInput(expedienteCompleto.inicio_vigencia) || '',
  termino_vigencia: formatearFechaParaInput(expedienteCompleto.termino_vigencia) || '',
      // 🔥 USAR FECHA LÍMITE REAL DEL RECIBO PENDIENTE
  fecha_vencimiento_pago: fechaVencimientoPagoReal,
      // 🔥 USAR LA MISMA FECHA LÍMITE REAL PARA PRÓXIMO PAGO
  proximoPago: fechaVencimientoPagoReal,
  fecha_cancelacion: formatearFechaParaInput(expedienteCompleto.fecha_cancelacion) || '',
  // Asegurar que campos numéricos no sean undefined (aceptar snake_case y camelCase del backend)
  prima_pagada: (expedienteCompleto.prima_pagada ?? expedienteCompleto.primaPagada ?? 0),
  
  // 🚨 DEBUG específico para sub_agente
  sub_agente: (() => {
    const valor = expedienteCompleto.sub_agente;
    console.log('👤 [FORMULARIO INIT] sub_agente - valor desde BD:', valor);
    return valor || '';
  })(),
  
  // 🚨 DEBUG específico para cargo_pago_fraccionado
  cargo_pago_fraccionado: (() => {
    const valores = {
      snake: expedienteCompleto.cargo_pago_fraccionado,
      camel: expedienteCompleto.cargoPagoFraccionado,
      tasa_snake: expedienteCompleto.tasa_financiamiento,
      tasa_camel: expedienteCompleto.tasaFinanciamiento
    };
    console.log('🚨 [FORMULARIO INIT] cargo_pago_fraccionado - valores disponibles:', valores);
    // ✅ Convertir null a string vacío para evitar problemas en inputs
    const valor = valores.snake ?? valores.camel ?? valores.tasa_snake ?? valores.tasa_camel;
    const resultado = (valor === null || valor === undefined) ? '' : String(valor);
    console.log('🚨 [FORMULARIO INIT] cargo_pago_fraccionado - valor final:', resultado);
    return resultado;
  })(),
  
  // 🚨 DEBUG específico para gastos_expedicion
  gastos_expedicion: (() => {
    const valores = {
      snake: expedienteCompleto.gastos_expedicion,
      camel: expedienteCompleto.gastosExpedicion,
      gastos: expedienteCompleto.gastos
    };
    console.log('🚨 [FORMULARIO INIT] gastos_expedicion - valores disponibles:', valores);
    // ✅ Convertir null a string vacío para evitar problemas en inputs
    const valor = valores.snake ?? valores.camel ?? valores.gastos;
    const resultado = (valor === null || valor === undefined) ? '' : String(valor);
    console.log('🚨 [FORMULARIO INIT] gastos_expedicion - valor final:', resultado);
    return resultado;
  })(),
  
  subtotal: (expedienteCompleto.subtotal ?? expedienteCompleto.sub_total ?? expedienteCompleto.subTotal ?? 0),
    iva: (expedienteCompleto.iva ?? expedienteCompleto.IVA ?? 0),
    total: (expedienteCompleto.total ?? expedienteCompleto.importe_total ?? expedienteCompleto.importeTotal ?? 0),
      // Normalizar alias de campos USO / SERVICIO / MOVIMIENTO que pueden venir con distintos nombres
  uso: expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo || '',
  servicio: expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo || '',
  movimiento: expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento || '',
      // Sincronizar también los alias *_poliza para que el formulario los tenga disponibles
      uso_poliza: expedienteCompleto.uso || expedienteCompleto.uso_poliza || expedienteCompleto.Uso || expedienteCompleto.usoVehiculo || '',
      servicio_poliza: expedienteCompleto.servicio || expedienteCompleto.servicio_poliza || expedienteCompleto.Servicio || expedienteCompleto.servicioVehiculo || '',
      movimiento_poliza: expedienteCompleto.movimiento || expedienteCompleto.movimiento_poliza || expedienteCompleto.Movimiento || ''
    };

    // 🔄 Forzar frecuenciaPago='Anual' para tipo de pago Anual o Pago Único si no viene
    if (formularioBase.tipo_pago && (formularioBase.tipo_pago === 'Anual' || /PAGO\s+ÚNICO|PAGO\s+UNICO/i.test(formularioBase.tipo_pago))) {
      formularioBase.frecuenciaPago = 'Anual';
    }

    console.log('📅 ANTES de actualizarCalculosAutomaticos:', {
      inicio_vigencia: formularioBase.inicio_vigencia,
      termino_vigencia: formularioBase.termino_vigencia
    });

    // 🎯 CRÍTICO: NO recalcular fechas ni estatus al cargar datos guardados
    // SIEMPRE respetar el estatus_pago de la base de datos
    let formularioConCalculos = { ...formularioBase };
    
    // ✅ IMPORTANTE: Cargar el estatus de pago TAL CUAL está en la BD (sin recalcular)
    // Esto permite al usuario tener control manual del estatus sin interferencia automática
    // Priorizar estatus_pago (snake_case de BD) sobre estatusPago (camelCase convertido)
    const estatusPagoDesdeBD = formularioBase.estatus_pago || formularioBase.estatusPago || 'Pendiente';
    formularioConCalculos.estatusPago = estatusPagoDesdeBD;
    formularioConCalculos.estatus_pago = estatusPagoDesdeBD;
    
    // 🔥 PROTEGER LA FECHA DE VENCIMIENTO REAL DEL RECIBO
    // Marcar que la fecha viene de un recibo real para evitar recálculos automáticos
    formularioConCalculos._fecha_vencimiento_desde_recibo = true;
    formularioConCalculos._no_recalcular_fecha_vencimiento = true;
    
    console.log('📊 [EDITAR] Estatus de pago cargado desde BD:', {
      estatus_pago_bd: formularioBase.estatus_pago,
      estatusPago_bd: formularioBase.estatusPago,
      valor_final: estatusPagoDesdeBD
    });

    console.log('📅 DESPUÉS de actualizarCalculosAutomaticos:', {
      inicio_vigencia: formularioConCalculos.inicio_vigencia,
      termino_vigencia: formularioConCalculos.termino_vigencia
    });

    // 📸 CAPTURAR SNAPSHOT INMEDIATAMENTE con los datos de BD (antes de cualquier useEffect)
    // Esto asegura que el snapshot tenga exactamente lo que está en la base de datos
    console.log('📸 [SNAPSHOT] Capturando snapshot INMEDIATO con datos de BD:', {
      id: formularioConCalculos.id,
      estatusPago: formularioConCalculos.estatusPago,
      estatus_pago: formularioConCalculos.estatus_pago
    });
    setFormularioOriginal(JSON.parse(JSON.stringify(formularioConCalculos)));

    // Aplicar al estado en un solo set para evitar inconsistencias por batching
    setFormulario(formularioConCalculos);
    
    // 📸 Capturar snapshot después de cargar TODOS los datos (incluyendo cliente)
    // NO capturamos aquí porque el cliente aún no se ha cargado completamente
    
    // Restaurar cliente seleccionado si el expediente tiene cliente_id
    if (expediente.cliente_id) {
      try {
        // Obtener cliente completo (cache o API) y normalizar a camelCase para evitar duplicados
        let cliente = clientesMap[expediente.cliente_id];

        if (!cliente) {
          const response = await fetch(`${API_URL}/api/clientes/${expediente.cliente_id}`);
          if (response.ok) {
            const data = await response.json();
            cliente = data.data || data;
          }
        }

        if (cliente) {
          // Normalización única: elegir camelCase como representación interna
          const normalizarCliente = (c) => ({
            id: c.id,
            tipoPersona: c.tipoPersona || c.tipo_persona || '',
            nombre: c.nombre || '',
            apellidoPaterno: c.apellidoPaterno || c.apellido_paterno || '',
            apellidoMaterno: c.apellidoMaterno || c.apellido_materno || '',
            razonSocial: c.razonSocial || c.razon_social || '',
            nombreComercial: c.nombreComercial || c.nombre_comercial || '',
            email: c.email || '',
            telefonoFijo: c.telefonoFijo || c.telefono_fijo || '',
            telefonoMovil: c.telefonoMovil || c.telefono_movil || '',
            rfc: c.rfc || '',
            contactoNombre: c.contactoNombre || c.contacto_nombre || '',
            contactoApellidoPaterno: c.contactoApellidoPaterno || c.contacto_apellido_paterno || '',
            contactoApellidoMaterno: c.contactoApellidoMaterno || c.contacto_apellido_materno || '',
            contactoEmail: c.contactoEmail || c.contacto_email || '',
            contactoTelefonoFijo: c.contactoTelefonoFijo || c.contacto_telefono_fijo || '',
            contactoTelefonoMovil: c.contactoTelefonoMovil || c.contacto_telefono_movil || ''
          });

          const clienteNormalizado = normalizarCliente(cliente);

          // Merge no destructivo: solo rellenar si el formulario aún no tenía esos datos
          setFormulario(prev => ({
            ...prev,
            nombre: prev.nombre || clienteNormalizado.nombre,
            apellido_paterno: prev.apellido_paterno || clienteNormalizado.apellidoPaterno,
            apellido_materno: prev.apellido_materno || clienteNormalizado.apellidoMaterno,
            razon_social: prev.razon_social || clienteNormalizado.razonSocial,
            nombre_comercial: prev.nombre_comercial || clienteNormalizado.nombreComercial,
            email: prev.email || clienteNormalizado.email,
            telefono_fijo: prev.telefono_fijo || clienteNormalizado.telefonoFijo,
            telefono_movil: prev.telefono_movil || clienteNormalizado.telefonoMovil,
            rfc: prev.rfc || clienteNormalizado.rfc,
            contacto_nombre: prev.contacto_nombre || clienteNormalizado.contactoNombre,
            contacto_apellido_paterno: prev.contacto_apellido_paterno || clienteNormalizado.contactoApellidoPaterno,
            contacto_apellido_materno: prev.contacto_apellido_materno || clienteNormalizado.contactoApellidoMaterno,
            contacto_email: prev.contacto_email || clienteNormalizado.contactoEmail,
            contacto_telefono_fijo: prev.contacto_telefono_fijo || clienteNormalizado.contactoTelefonoFijo,
            contacto_telefono_movil: prev.contacto_telefono_movil || clienteNormalizado.contactoTelefonoMovil
          }));

          // Guardar referencia simplificada
          setClienteSeleccionado(clienteNormalizado);
        }
      } catch (error) {
        console.error('⚠️ Error al recuperar cliente completo:', error);
      }
    }
    
    setModoEdicion(true);
    setVistaActual('formulario');
    
    // ⚠️ COMENTADO: Ya no usamos el flag porque capturamos el snapshot inmediatamente
    // snapshotPendiente.current = true;
  }, [clientesMap, actualizarCalculosAutomaticos]);

const eliminarExpediente = useCallback((id) => {
  if (confirm('¿Está seguro de eliminar este expediente?')) {
    fetch(`${API_URL}/api/expedientes/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (res.ok) {
          setExpedientes(prev => prev.filter(exp => exp.id !== id));
        } else {
          toast.error('Error al eliminar expediente en la base de datos');
        }
      })
  .catch(() => toast.error('Error de conexión al eliminar expediente'));
  }
}, []);

  const verDetalles = useCallback(async (expediente) => {
    // 🎯 CARGA LAZY: Cargar recibos solo cuando se necesita (ver detalle)
    let expedienteConRecibos = { ...expediente };
    
    try {
      console.log('🔍 [VER] Cargando recibos con GET /api/recibos/:id...');
      const recibosResponse = await fetch(`${API_URL}/api/recibos/${expediente.id}`);
      if (recibosResponse.ok) {
        const recibosData = await recibosResponse.json();
        const recibosArray = recibosData?.data || recibosData || [];
        
        if (Array.isArray(recibosArray)) {
          console.log('✅ [VER] Recibos cargados:', recibosArray.length);
          expedienteConRecibos.recibos = recibosArray;
        }
      }
    } catch (error) {
      console.warn('⚠️ [VER] Error al cargar recibos:', error);
      expedienteConRecibos.recibos = [];
    }
    
    setExpedienteSeleccionado(expedienteConRecibos);
    setVistaActual('detalles');
    
    // Limpiar y cargar historial
    setHistorialExpediente([]);
    
    try {
      const response = await fetch(`${API_URL}/api/historial-expedientes/${expediente.id}`);
      if (response.ok) {
        const data = await response.json();
        const historial = data?.data || data || [];
        const historialArray = Array.isArray(historial) ? historial : [];
        setHistorialExpediente(historialArray);
      } else {
        setHistorialExpediente([]);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cargar historial:', error);
      setHistorialExpediente([]);
    }
  }, []);

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="container-fluid">
        {vistaActual === 'lista' && (
          <ListaExpedientes 
            expedientes={expedientes}
            agentes={agentes}
            vendedoresMap={vendedoresMap}
            limpiarFormulario={limpiarFormulario}
            setVistaActual={setVistaActual}
            setModoEdicion={setModoEdicion}
            mostrarModalMetodoCaptura={mostrarModalMetodoCaptura}
            setMostrarModalMetodoCaptura={setMostrarModalMetodoCaptura}
            mostrarExtractorPDF={mostrarExtractorPDF}
            setMostrarExtractorPDF={setMostrarExtractorPDF}
            aplicarPago={abrirModalAplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            verDetalles={verDetalles}
            editarExpediente={editarExpediente}
            eliminarExpediente={eliminarExpediente}
            calcularProximoPago={calcularProximoPago}
            clientesMap={clientesMap}
            abrirModalCompartir={abrirModalCompartir}
          />
        )}
        
        {vistaActual === 'formulario' && (
          <Formulario 
            modoEdicion={modoEdicion}
            setVistaActual={setVistaActual}
            formulario={formulario}
            setFormulario={setFormulario}
            actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
            guardarExpediente={guardarExpediente}
            companias={companias}
            productos={productos}
            aseguradoras={aseguradoras}
            tiposProductos={tiposProductos}
            etapasActivas={etapasActivas}
            agentes={agentes}
            tiposPago={tiposPago}
            frecuenciasPago={frecuenciasPago}
            periodosGracia={periodosGracia}
            estatusPago={estatusPago}
            marcasVehiculo={marcasVehiculo}
            tiposVehiculo={tiposVehiculo}
            tiposCobertura={tiposCobertura}
            calculartermino_vigencia={calculartermino_vigencia}
            calcularProximoPago={calcularProximoPago}
            CONSTANTS={CONSTANTS}
            handleClienteSeleccionado={handleClienteSeleccionado}
            clienteSeleccionado={clienteSeleccionado}
            handleSeleccionarPDF={handleSeleccionarPDF}
            archivoSeleccionado={archivoSeleccionado}
            subiendoPDF={subiendoPDF}
            subirPDFPoliza={subirPDFPoliza}
            mostrarExtractorPDF={mostrarExtractorPDF}
            setMostrarExtractorPDF={setMostrarExtractorPDF}
            onEliminarPago={handleEliminarPago}
          />
        )}
        
        {vistaActual === 'detalles' && (
          <DetallesExpediente 
            expedienteSeleccionado={expedienteSeleccionado}
            setExpedienteSeleccionado={setExpedienteSeleccionado}
            setVistaActual={setVistaActual}
            aplicarPago={abrirModalAplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            editarExpediente={editarExpediente}
            calcularSiguientePago={calcularSiguientePago}
            calculartermino_vigencia={calculartermino_vigencia}
            calcularProximoPago={calcularProximoPago}
            abrirModalCompartir={abrirModalCompartir}
            enviarAvisoPago={enviarAvisoPago}
            historial={historialExpediente}
          />
        )}
      </div>
      
      {/* Modal Compartir - global al módulo */}
      {mostrarModalCompartir && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90vw', width: 450 }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Compartir información</h5>
                <button type="button" className="btn-close" onClick={cerrarModalCompartir} aria-label="Cerrar"></button>
              </div>
              <div className="modal-body">
                {expedienteParaCompartir && (
                  <>
                    <div className="mb-3 small">
                      <div><strong>Póliza:</strong> {expedienteParaCompartir.numero_poliza || 'Sin número'}</div>
                      <div><strong>Aseguradora:</strong> {expedienteParaCompartir.compania || 'N/A'}</div>
                    </div>

                    {/* Selector de tipo de envío */}
                    <div className="mb-3">
                      <label className="form-label mb-2"><strong>¿Qué deseas enviar?</strong></label>
                      <div className="btn-group w-100" role="group">
                        <input
                          type="radio"
                          className="btn-check"
                          name="tipoEnvio"
                          id="radioPoliza"
                          checked={tipoEnvio === 'poliza'}
                          onChange={() => setTipoEnvio('poliza')}
                        />
                        <label className="btn btn-outline-primary" htmlFor="radioPoliza">
                          📄 Póliza Completa
                        </label>

                        <input
                          type="radio"
                          className="btn-check"
                          name="tipoEnvio"
                          id="radioPago"
                          checked={tipoEnvio === 'pago'}
                          onChange={() => setTipoEnvio('pago')}
                        />
                        <label className="btn btn-outline-success" htmlFor="radioPago">
                          💰 Aviso de Pago
                        </label>
                      </div>
                    </div>

                    {/* Selector de pago (solo si tipo es 'pago') */}
                    {tipoEnvio === 'pago' && expedienteParaCompartir.recibos && expedienteParaCompartir.recibos.length > 0 && (
                      <div className="mb-3">
                        <label className="form-label mb-1"><strong>Seleccionar Pago:</strong></label>
                        <select
                          className="form-select form-select-sm"
                          value={pagoSeleccionado?.numero_recibo || ''}
                          onChange={(e) => {
                            const pago = expedienteParaCompartir.recibos.find(r => r.numero_recibo === parseInt(e.target.value));
                            setPagoSeleccionado(pago);
                          }}
                        >
                          {expedienteParaCompartir.recibos.map(recibo => (
                            <option key={recibo.numero_recibo} value={recibo.numero_recibo}>
                              Pago #{recibo.numero_recibo} - Vence {utils.formatearFecha(recibo.fecha_vencimiento)} - ${utils.formatearMoneda(recibo.monto)}
                              {recibo.estado_pago === 'Pagado' ? ' ✅' : recibo.estado_pago === 'Vencido' ? ' ⚠️' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {/* Mostrar select si hay múltiples destinatarios, o solo el nombre si hay uno */}
                    {destinatariosCompartir.length > 1 ? (
                      <div className="mb-3">
                        <label className="form-label mb-1"><strong>Enviar a:</strong></label>
                        <select 
                          className="form-select form-select-sm"
                          value={destinatarioCompartirSeleccionado?.id || ''}
                          onChange={(e) => {
                            const dest = destinatariosCompartir.find(d => d.id === e.target.value);
                            setDestinatarioCompartirSeleccionado(dest);
                          }}
                        >
                          {destinatariosCompartir.map(dest => (
                            <option key={dest.id} value={dest.id}>
                              {dest.nombre} ({dest.tipo})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : destinatariosCompartir.length === 1 ? (
                      <div className="mb-3"><strong>Enviar a:</strong> {destinatariosCompartir[0].nombre} ({destinatariosCompartir[0].tipo})</div>
                    ) : null}
                    
                    {/* Mostrar teléfono y email del destinatario seleccionado */}
                    {destinatarioCompartirSeleccionado && (
                      <div className="mb-3 p-2 bg-light rounded border">
                        {destinatarioCompartirSeleccionado.telefono && (
                          <div className="small text-break">
                            <strong>📱 Teléfono:</strong> <span className="text-primary">{destinatarioCompartirSeleccionado.telefono}</span>
                          </div>
                        )}
                        {destinatarioCompartirSeleccionado.email && (
                          <div className="small text-break">
                            <strong>📧 Email:</strong> <span className="text-primary">{destinatarioCompartirSeleccionado.email}</span>
                          </div>
                        )}
                        {!destinatarioCompartirSeleccionado.telefono && !destinatarioCompartirSeleccionado.email && (
                          <div className="small text-muted">
                            ⚠️ Sin datos de contacto registrados
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="d-grid gap-2">
                  <button
                    className="btn btn-success d-flex align-items-center justify-content-center"
                    onClick={() => {
                      if (tipoEnvio === 'pago' && pagoSeleccionado) {
                        enviarAvisoPagoWhatsApp(pagoSeleccionado, expedienteParaCompartir);
                      } else {
                        compartirPorWhatsApp(expedienteParaCompartir);
                      }
                      cerrarModalCompartir();
                    }}
                  >
                    <Share2 size={16} className="me-2" /> WhatsApp
                  </button>
                  <button
                    className="btn btn-info d-flex align-items-center justify-content-center"
                    onClick={() => {
                      if (tipoEnvio === 'pago' && pagoSeleccionado) {
                        enviarAvisoPagoEmail(pagoSeleccionado, expedienteParaCompartir);
                      } else {
                        compartirPorEmail(expedienteParaCompartir);
                      }
                      cerrarModalCompartir();
                    }}
                    title="Envío por correo"
                  >
                    <Mail size={16} className="me-2" /> Email
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cerrarModalCompartir}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💰 Modal Aviso/Recordatorio de Pago */}
      {mostrarModalAvisoPago && pagoParaNotificar && expedienteDelPago && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '90vw', width: 450 }}>
            <div className="modal-content">
              <div className={`modal-header text-white ${pagoParaNotificar.estado === 'Vencido' ? 'bg-danger' : 'bg-info'}`}>
                <h5 className="modal-title">
                  {pagoParaNotificar.estado === 'Vencido' ? '⚠️ Recordatorio de Pago' : '📧 Aviso de Pago'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={cerrarModalAvisoPago}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3 small">
                  <div><strong>Póliza:</strong> {expedienteDelPago.numero_poliza || 'Sin número'}</div>
                  
                  {/* Mostrar select si hay múltiples destinatarios, o solo el nombre si hay uno */}
                  {destinatariosDisponibles.length > 1 ? (
                    <div className="mt-2">
                      <label className="form-label mb-1"><strong>Enviar a:</strong></label>
                      <select 
                        className="form-select form-select-sm"
                        value={destinatarioSeleccionado?.id || ''}
                        onChange={(e) => {
                          const dest = destinatariosDisponibles.find(d => d.id === e.target.value);
                          setDestinatarioSeleccionado(dest);
                        }}
                      >
                        {destinatariosDisponibles.map(dest => (
                          <option key={dest.id} value={dest.id}>
                            {dest.nombre} ({dest.tipo})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : destinatariosDisponibles.length === 1 ? (
                    <div><strong>Enviar a:</strong> {destinatariosDisponibles[0].nombre} ({destinatariosDisponibles[0].tipo})</div>
                  ) : (
                    <div><strong>Cliente:</strong> {expedienteDelPago.cliente_nombre || 'N/A'}</div>
                  )}
                  
                  {/* Mostrar teléfono y email del destinatario seleccionado */}
                  {destinatarioSeleccionado && (
                    <div className="mt-2 p-2 bg-light rounded border">
                      {destinatarioSeleccionado.telefono && (
                        <div className="small text-break">
                          <strong>📱 Teléfono:</strong> <span className="text-primary">{destinatarioSeleccionado.telefono}</span>
                        </div>
                      )}
                      {destinatarioSeleccionado.email && (
                        <div className="small text-break">
                          <strong>📧 Email:</strong> <span className="text-primary">{destinatarioSeleccionado.email}</span>
                        </div>
                      )}
                      {!destinatarioSeleccionado.telefono && !destinatarioSeleccionado.email && (
                        <div className="small text-muted">
                          ⚠️ Sin datos de contacto registrados
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-2">
                    <strong>Pago #{pagoParaNotificar.numero}</strong>
                  </div>
                  <div><strong>Fecha:</strong> {utils.formatearFecha(pagoParaNotificar.fecha, 'larga')}</div>
                  <div><strong>Monto:</strong> <span className="badge bg-primary">${pagoParaNotificar.monto}</span></div>
                  <div className="mt-2">
                    <strong>Estado:</strong> <span className={`badge ${pagoParaNotificar.badgeClass}`}>{pagoParaNotificar.estado}</span>
                  </div>
                </div>

                <div className="d-grid gap-2">
                  <button
                    className="btn btn-success d-flex align-items-center justify-content-center"
                    onClick={() => enviarAvisoPagoWhatsApp(pagoParaNotificar, expedienteDelPago)}
                  >
                    <Share2 size={16} className="me-2" /> WhatsApp
                  </button>
                  <button
                    className="btn btn-info text-white d-flex align-items-center justify-content-center"
                    onClick={() => enviarAvisoPagoEmail(pagoParaNotificar, expedienteDelPago)}
                  >
                    <Mail size={16} className="me-2" /> Email
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cerrarModalAvisoPago}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NUEVO: Modal para capturar contacto faltante */}
      <ModalCapturarContacto
        show={mostrarModalContacto}
        onClose={() => {
          setMostrarModalContacto(false);
          setClienteParaActualizar(null);
          setTipoDatoFaltante(null);
          setCanalEnvio(null);
          setExpedienteEnEspera(null);
        }}
        onGuardar={handleGuardarContactoFaltante}
        onGuardarYContinuar={() => {
          // Después de guardar, reintentar el envío conservando estado necesario
          if (expedienteEnEspera && canalEnvio) {
            const loadingId = toast.loading(`Abriendo ${canalEnvio}…`);
            setTimeout(() => {
              console.log('🔄 Reintentando envío por', canalEnvio);
              if (canalEnvio === 'WhatsApp') {
                // Verificar si es envío de aviso de pago o compartir póliza
                if (pagoParaNotificar) {
                  enviarAvisoPagoWhatsApp(pagoParaNotificar, expedienteEnEspera);
                } else {
                  compartirPorWhatsApp(expedienteEnEspera);
                }
              } else if (canalEnvio === 'Email') {
                // Verificar si es envío de aviso de pago o compartir póliza
                if (pagoParaNotificar) {
                  enviarAvisoPagoEmail(pagoParaNotificar, expedienteEnEspera);
                } else {
                  compartirPorEmail(expedienteEnEspera);
                }
              }
              // Limpieza diferida tras el reintento
              setTimeout(() => {
                toast.dismiss(loadingId);
                setCanalEnvio(null);
                setExpedienteEnEspera(null);
                setPagoParaNotificar(null);
              }, 300);
            }, 500);
          }
        }}
        cliente={clienteParaActualizar}
        tipoDatoFaltante={tipoDatoFaltante}
        canalEnvio={canalEnvio}
      />

      <ModalCancelacion 
        mostrarModalCancelacion={mostrarModalCancelacion}
        setMostrarModalCancelacion={setMostrarModalCancelacion}
        expedienteACancelar={expedienteACancelar}
        motivoCancelacion={motivoCancelacion}
        setMotivoCancelacion={setMotivoCancelacion}
        motivosCancelacion={motivosCancelacion}
        confirmarCancelacion={confirmarCancelacion}
      />

      {/* Modal Aplicar Pago con Comprobante */}
      {mostrarModalPago && expedienteParaPago && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white py-2 px-3">
                <h6 className="modal-title mb-0" style={{ fontSize: '0.95rem' }}>
                  <DollarSign size={18} className="me-2" />
                  Aplicar Pago
                </h6>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                    setFechaUltimoPago('');
                    setNumeroReciboPago(1);
                  }}
                  disabled={procesandoPago}
                ></button>
              </div>
              
              <div className="modal-body py-2 px-3">
                {/* Información del expediente */}
                <div className="alert alert-info mb-2 py-2 px-2">
                  <div className="mb-1">
                    <strong style={{ fontSize: '0.85rem' }}>Póliza:</strong> <span style={{ fontSize: '0.85rem' }}>{expedienteParaPago.numero_poliza || 'Sin número'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem' }}>
                    <div><strong>Cliente:</strong> {expedienteParaPago.cliente_nombre || 'Sin nombre'}</div>
                    <div><strong>Aseguradora:</strong> {expedienteParaPago.compania || 'N/A'}</div>
                    <div><strong>Producto:</strong> {expedienteParaPago.producto || 'N/A'}</div>
                    {expedienteParaPago.importe_total && (
                      <div className="mt-1">
                        <strong>Monto a pagar:</strong> <span className="badge bg-success" style={{ fontSize: '0.7rem' }}>${parseFloat(expedienteParaPago.importe_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campo para fecha real de pago */}
                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                    <Calendar size={14} className="me-1" />
                    Fecha real del pago (cuando el cliente pagó) *
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fechaUltimoPago}
                    onChange={(e) => setFechaUltimoPago(e.target.value)}
                    disabled={procesandoPago}
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    {(() => {
                      const fechaLimite = expedienteParaPago.fecha_vencimiento_pago || expedienteParaPago.proximo_pago;
                      if (fechaLimite) {
                        return `Fecha límite de pago: ${new Date(fechaLimite).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} • La fecha de captura será hoy`;
                      }
                      return 'Ingrese la fecha en que el cliente realizó el pago. La fecha de captura será automática (hoy)';
                    })()}
                  </small>
                </div>

                {/* Selector de recibo (solo para pagos fraccionados) */}
                {(() => {
                  const esFraccionado = (expedienteParaPago.tipo_pago === 'Fraccionado') || (expedienteParaPago.forma_pago?.toUpperCase() === 'FRACCIONADO');
                  const frecuencia = expedienteParaPago.frecuenciaPago || expedienteParaPago.frecuencia_pago;
                  
                  if (esFraccionado && frecuencia) {
                    const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                    
                    // Filtrar solo recibos pendientes (sin fecha_pago_real)
                    const recibos = expedienteParaPago.recibos || [];
                    const recibosPendientes = recibos.filter(r => !r.fecha_pago_real);
                    
                    const opciones = recibosPendientes.map(r => r.numero_recibo);
                    
                    // Si no hay recibos pendientes, mostrar mensaje
                    if (opciones.length === 0) {
                      return (
                        <div className="alert alert-info mb-2 py-2 px-2" style={{ fontSize: '0.75rem' }}>
                          <CheckCircle size={14} className="me-1" />
                          Todos los recibos ya tienen pago registrado
                        </div>
                      );
                    }
                    
                    return (
                      <div className="mb-2">
                        <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                          <FileText size={14} className="me-1" />
                          Recibo a aplicar pago *
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={numeroReciboPago}
                          onChange={(e) => setNumeroReciboPago(parseInt(e.target.value))}
                          disabled={procesandoPago}
                        >
                          {opciones.map(num => (
                            <option key={num} value={num}>
                              Recibo #{num} de {numeroPagos}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                          Seleccione el número de recibo al que corresponde este pago
                        </small>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Campo para subir comprobante */}
                <div className="mb-2">
                  <label className="form-label fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
                    <Upload size={14} className="me-1" />
                    Comprobante de Pago (opcional)
                  </label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      const archivo = e.target.files[0];
                      if (archivo) {
                        // Validar tamaño (máximo 10MB)
                        if (archivo.size > 10 * 1024 * 1024) {
                          toast.error('El archivo no debe superar 10MB');
                          e.target.value = '';
                          return;
                        }
                        setComprobantePago(archivo);
                      }
                    }}
                    disabled={procesandoPago}
                  />
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                    Formatos permitidos: PDF, JPG, PNG, WEBP (máximo 10MB)
                  </small>
                  
                  {comprobantePago && (
                    <div className="alert alert-success mt-2 mb-0 py-1 px-2 d-flex align-items-center justify-content-between">
                      <div style={{ fontSize: '0.75rem' }}>
                        <CheckCircle size={14} className="me-1" />
                        <strong>{comprobantePago.name}</strong>
                        <small className="d-block ms-3 text-muted" style={{ fontSize: '0.7rem' }}>
                          {(comprobantePago.size / 1024).toFixed(2)} KB
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-1"
                        onClick={() => setComprobantePago(null)}
                        disabled={procesandoPago}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Información adicional */}
                <div className="alert alert-warning mb-0 py-1 px-2">
                  <small style={{ fontSize: '0.7rem' }}>
                    <AlertCircle size={12} className="me-1" />
                    <strong>Importante:</strong> Si adjunta un comprobante, se guardará en S3 y se agregará 
                    al expediente con un comentario automático en el historial.
                  </small>
                </div>
              </div>
              
              <div className="modal-footer py-2 px-3">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary btn-sm" 
                  onClick={() => {
                    setMostrarModalPago(false);
                    setExpedienteParaPago(null);
                    setComprobantePago(null);
                    setFechaUltimoPago('');
                    setNumeroReciboPago(1);
                  }}
                  disabled={procesandoPago}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-success btn-sm"
                  onClick={procesarPagoConComprobante}
                  disabled={!fechaUltimoPago || procesandoPago}
                >
                  {procesandoPago ? (
                    <>
                      <Loader size={14} className="me-1 spinner-border spinner-border-sm" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} className="me-1" />
                      Confirmar Pago
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODALES DE RENOVACIÓN
          ═══════════════════════════════════════════════════════════════ */}

      {/* Modal 1: Iniciar Cotización de Renovación */}
      {mostrarModalCotizarRenovacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <FileText size={20} className="me-2" />
                  Iniciar Cotización de Renovación
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalCotizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <h6 className="mb-2">
                    <strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza || 'Sin número'}
                  </h6>
                  <p className="mb-1"><strong>Cliente:</strong> {expedienteParaRenovacion.nombre_cliente || 'N/A'}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania || 'N/A'}</p>
                </div>
                
                <p className="text-muted">
                  Se iniciará el proceso de cotización para la renovación de esta póliza. 
                  El expediente se moverá a la carpeta <strong>"En Proceso"</strong> con estado 
                  <strong>"En Cotización - Renovación"</strong>.
                </p>
                
                <p className="text-muted mb-0">
                  <strong>Próximos pasos:</strong>
                </p>
                <ol className="text-muted small">
                  <li>Preparar cotización con la aseguradora</li>
                  <li>Enviar cotización al cliente</li>
                  <li>Esperar autorización del cliente</li>
                </ol>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalCotizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarCotizacionRenovacion}
                >
                  <FileText size={16} className="me-2" />
                  Iniciar Cotización
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Marcar como Autorizado */}
      {mostrarModalAutorizarRenovacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <CheckCircle size={20} className="me-2" />
                  Confirmar Autorización
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalAutorizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <p className="mb-0">
                  ¿Confirmas que el cliente <strong>autorizó</strong> la cotización de renovación?
                </p>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalAutorizarRenovacion(false);
                    setExpedienteParaRenovacion(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={confirmarRenovacionAutorizada}
                >
                  <CheckCircle size={16} className="me-2" />
                  Sí, Autorizado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Agregar Póliza Renovada */}
      {mostrarModalPolizaRenovada && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <RefreshCw size={20} className="me-2" />
                  Registrar Póliza Renovada
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalPolizaRenovada(false);
                    setExpedienteParaRenovacion(null);
                    setDatosRenovacion({
                      numeroPolizaNueva: '',
                      primaNueva: '',
                      totalNuevo: '',
                      fechaEmisionNueva: '',
                      inicioVigenciaNueva: '',
                      terminoVigenciaNueva: '',
                      observaciones: ''
                    });
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <p className="mb-1"><strong>Póliza Original:</strong> {expedienteParaRenovacion.numero_poliza}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania}</p>
                </div>
                
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Número de Póliza Renovada *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={datosRenovacion.numeroPolizaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, numeroPolizaNueva: e.target.value }))}
                      placeholder="Número de póliza renovada"
                    />
                    <small className="text-muted">Puede ser el mismo o un nuevo número</small>
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Prima *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={datosRenovacion.primaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, primaNueva: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Total *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={datosRenovacion.totalNuevo}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, totalNuevo: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Fecha Emisión *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.fechaEmisionNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, fechaEmisionNueva: e.target.value }))}
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Inicio Vigencia *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.inicioVigenciaNueva}
                      onChange={(e) => {
                        const inicio = e.target.value;
                        if (inicio) {
                          const fechaInicio = new Date(inicio);
                          const fechaTermino = new Date(fechaInicio);
                          fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
                          setDatosRenovacion(prev => ({ 
                            ...prev, 
                            inicioVigenciaNueva: inicio,
                            terminoVigenciaNueva: fechaTermino.toISOString().split('T')[0]
                          }));
                        } else {
                          setDatosRenovacion(prev => ({ ...prev, inicioVigenciaNueva: inicio }));
                        }
                      }}
                    />
                  </div>
                  
                  <div className="col-md-4">
                    <label className="form-label">Término Vigencia *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={datosRenovacion.terminoVigenciaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, terminoVigenciaNueva: e.target.value }))}
                    />
                    <small className="text-muted">Auto-calculado (1 año)</small>
                  </div>
                  
                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={datosRenovacion.observaciones}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Comentarios sobre la renovación..."
                    ></textarea>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPolizaRenovada(false);
                    setExpedienteParaRenovacion(null);
                    setDatosRenovacion({
                      numeroPolizaNueva: '',
                      primaNueva: '',
                      totalNuevo: '',
                      fechaEmisionNueva: '',
                      inicioVigenciaNueva: '',
                      terminoVigenciaNueva: '',
                      observaciones: ''
                    });
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-info"
                  onClick={guardarPolizaRenovada}
                  disabled={
                    !datosRenovacion.numeroPolizaNueva ||
                    !datosRenovacion.primaNueva ||
                    !datosRenovacion.totalNuevo ||
                    !datosRenovacion.fechaEmisionNueva ||
                    !datosRenovacion.inicioVigenciaNueva ||
                    !datosRenovacion.terminoVigenciaNueva
                  }
                >
                  <RefreshCw size={16} className="me-2" />
                  Guardar Póliza Renovada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuloExpedientes;

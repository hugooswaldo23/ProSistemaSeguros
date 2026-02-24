/**
 * ====================================================================
 * MÓDULO: GESTIÓN DE EXPEDIENTES (VERSIÓN CON FORMULARIOS SEPARADOS)
 * ====================================================================
 * Versión con formularios separados:
 * - FormularioNuevoExpediente: Para agregar desde PDF (sin snapshot)
 * - FormularioEditarExpediente: Para editar (con snapshot para logs)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Share2, Mail, DollarSign, Calendar, Upload, CheckCircle, X, AlertCircle, Loader, FileText, RefreshCw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FormularioNuevoExpediente from '../components/expedientes/FormularioNuevoExpediente';
import FormularioEditarExpediente from '../components/expedientes/FormularioEditarExpediente';
import ListaExpedientes from '../components/expedientes/ListaExpedientes';
import DetallesExpediente from '../components/expedientes/DetallesExpediente';
import ModalCapturarContacto from '../components/ModalCapturarContacto';
import { usePagos } from '../hooks/usePagos';
import { useCompartirExpediente } from '../hooks/useCompartirExpediente';
import * as clientesService from '../services/clientesService';
import * as historialService from '../services/historialExpedienteService';
import * as pdfService from '../services/pdfService';
import utils from '../utils/expedientesUtils';
import { CONSTANTS } from '../utils/expedientesConstants';

const API_URL = import.meta.env.VITE_API_URL;

// Estado inicial del formulario
const estadoInicialFormulario = {
  id: null,
  cliente_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  razon_social: '',
  nombre_comercial: '',
  rfc: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  compania: '',
  producto: '',
  etapa_activa: 'Captura',
  agente: '',
  sub_agente: '',
  numero_poliza: '',
  numero_endoso: '',
  inicio_vigencia: '',
  termino_vigencia: '',
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_captura: new Date().toISOString().split('T')[0],
  prima_neta: '',
  cargo_pago_fraccionado: '',
  gastos_expedicion: '',
  iva: '',
  subtotal: '',
  total: '',
  tipo_pago: 'Anual',
  frecuenciaPago: 'Anual',
  periodo_gracia: 14,
  fecha_vencimiento_pago: '',
  estatusPago: 'Pendiente',
  marca: '',
  modelo: '',
  anio: '',
  numero_serie: '',
  placas: '',
  color: '',
  tipo_vehiculo: '',
  tipo_cobertura: '',
  suma_asegurada: '',
  conductor_habitual: '',
  edad_conductor: '',
  licencia_conducir: '',
  coberturas: [],
  recibos: []
};

const ModuloNvoExpedientes = () => {
  // Hook de navegación para detectar parámetros de URL
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados
  const [vistaActual, setVistaActual] = useState('lista'); // 'lista', 'formulario', 'detalles'
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [origenNavegacion, setOrigenNavegacion] = useState(null); // 'dashboard' o null
  
  // Datos
  const [expedientes, setExpedientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [agentes, setAgentes] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  
  // Formulario
  const [formulario, setFormulario] = useState(estadoInicialFormulario);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  
  // 🔧 Estado para trackear cambios de cliente pendientes de registrar en historial
  const [cambiosClientePendientes, setCambiosClientePendientes] = useState(null);
  
  // Vista de Detalles
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [historialExpediente, setHistorialExpediente] = useState([]);

  // 📤 Estados para Modal de Compartir
  const [mostrarModalCompartir, setMostrarModalCompartir] = useState(false);
  const [expedienteParaCompartir, setExpedienteParaCompartir] = useState(null);
  const [destinatariosCompartir, setDestinatariosCompartir] = useState([]);
  const [destinatarioCompartirSeleccionado, setDestinatarioCompartirSeleccionado] = useState(null);
  const [tipoEnvio, setTipoEnvio] = useState('poliza'); // 'poliza', 'pago' o 'cotizacion'
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);

  // 📞 Estados para Modal de Captura de Contacto (teléfono/email faltante)
  const [mostrarModalContacto, setMostrarModalContacto] = useState(false);
  const [clienteParaActualizar, setClienteParaActualizar] = useState(null);
  const [destinatarioParaModal, setDestinatarioParaModal] = useState(null); // Destinatario para mostrar en modal
  const [tipoDatoFaltante, setTipoDatoFaltante] = useState(''); // 'telefono_movil' o 'email'
  const [canalEnvio, setCanalEnvio] = useState(''); // 'WhatsApp' o 'Email'
  const [expedienteEnEspera, setExpedienteEnEspera] = useState(null);
  const [pagoParaNotificar, setPagoParaNotificar] = useState(null);

  // 📧 Estados para Modal de Aviso de Pago
  const [mostrarModalAvisoPago, setMostrarModalAvisoPago] = useState(false);
  const [expedienteDelPago, setExpedienteDelPago] = useState(null);
  const [destinatariosDisponibles, setDestinatariosDisponibles] = useState([]);
  const [destinatarioSeleccionado, setDestinatarioSeleccionado] = useState(null);

  // �️ Estados para Modal de Eliminar Pago
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [pagoParaEliminar, setPagoParaEliminar] = useState(null);
  const [expedienteParaEliminarPago, setExpedienteParaEliminarPago] = useState(null);
  const [motivoEliminacion, setMotivoEliminacion] = useState('');
  const [eliminandoPago, setEliminandoPago] = useState(false);

  // 🔄 Estados para flujo de renovación
  const [mostrarModalCotizarRenovacion, setMostrarModalCotizarRenovacion] = useState(false);
  const [mostrarModalAutorizarRenovacion, setMostrarModalAutorizarRenovacion] = useState(false);
  const [mostrarModalPolizaRenovada, setMostrarModalPolizaRenovada] = useState(false);
  const [expedienteParaRenovacion, setExpedienteParaRenovacion] = useState(null);
  
  // 🆕 Modal unificado de opciones de renovación (Cotización o Póliza)
  const [mostrarModalOpcionesRenovacion, setMostrarModalOpcionesRenovacion] = useState(false);
  const [expedienteAnteriorParaRenovacion, setExpedienteAnteriorParaRenovacion] = useState(null);
  
  // 🆕 Modal para cargar archivo de cotización
  const [mostrarModalCargarCotizacion, setMostrarModalCargarCotizacion] = useState(false);
  const [archivoCotizacion, setArchivoCotizacion] = useState(null);
  const [cargandoCotizacion, setCargandoCotizacion] = useState(false);
  
  // 🆕 Cotizaciones del expediente (para compartir)
  const [cotizacionesExpediente, setCotizacionesExpediente] = useState([]);
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState(null);
  const [cargandoCotizaciones, setCargandoCotizaciones] = useState(false);

  // Datos para la renovación
  const [datosRenovacion, setDatosRenovacion] = useState({
    numeroPolizaNueva: '',
    primaNueva: '',
    totalNuevo: '',
    fechaEmisionNueva: '',
    inicioVigenciaNueva: '',
    terminoVigenciaNueva: '',
    observaciones: ''
  });

  // Carga inicial
  useEffect(() => {
    let mounted = true;
    
    const cargarDatos = async () => {
      if (!mounted) return;
      
      try {
        const [expRes, clientesRes, agentesRes, asegRes] = await Promise.all([
          fetch(`${API_URL}/api/expedientes`),
          fetch(`${API_URL}/api/clientes`),
          fetch(`${API_URL}/api/equipoDeTrabajo`),
          fetch(`${API_URL}/api/aseguradoras`)
        ]);

        const expedientesData = await expRes.json();
        const clientesData = await clientesRes.json();
        const agentesData = await agentesRes.json();
        const aseguradorasData = await asegRes.json();

        if (!mounted) return;

        const mapa = {};
        clientesData.forEach(cliente => {
          mapa[cliente.id] = cliente;
        });

        // 🔥 CARGAR RECIBOS PARA CADA EXPEDIENTE FRACCIONADO
        const expedientesConRecibos = await Promise.all(
          expedientesData.map(async (exp) => {
            // Solo cargar recibos si es pago fraccionado
            if ((exp.tipo_pago === 'Fraccionado' || exp.forma_pago?.toUpperCase() === 'FRACCIONADO') && 
                (exp.frecuenciaPago || exp.frecuencia_pago)) {
              try {
                const recibosResponse = await fetch(`${API_URL}/api/recibos/${exp.id}`);
                if (recibosResponse.ok) {
                  const recibosData = await recibosResponse.json();
                  const recibosArray = recibosData?.data || recibosData || [];
                  exp.recibos = Array.isArray(recibosArray) ? recibosArray : [];
                }
              } catch (error) {
                console.warn(`⚠️ Error al cargar recibos para expediente ${exp.id}:`, error);
                exp.recibos = [];
              }
            }
            return exp;
          })
        );

        // Normalizar expedientes desde backend: sincronizar ambos formatos
        const expedientesNormalizados = expedientesConRecibos.map(exp => ({
          ...exp,
          estatusPago: exp.estatusPago || exp.estatus_pago || 'Pendiente',
          estatus_pago: exp.estatus_pago || exp.estatusPago || 'Pendiente',
          fecha_vencimiento_pago: exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago || '',
          proximoPago: exp.proximoPago || exp.fecha_vencimiento_pago || exp.fecha_pago || '',
          fecha_pago: exp.fecha_pago || exp.fecha_vencimiento_pago || exp.proximoPago || ''
        }));

        setExpedientes(expedientesNormalizados);
        setClientes(clientesData);
        setClientesMap(mapa);
        setAgentes(agentesData);
        setAseguradoras(aseguradorasData);
        setTiposProductos(['Automóvil', 'Moto', 'Camión', 'Hogar', 'Empresa', 'GMM', 'Vida']);
      } catch (error) {
        console.error('❌ Error al cargar datos iniciales:', error);
        if (mounted) {
          toast.error('Error al cargar datos');
        }
      }
    };
    
    cargarDatos();
    
    return () => {
      mounted = false;
    };
  }, []);

  // 🔄 RESTAURAR ESTADO después de reload (por eliminación de pago u otras acciones)
  useEffect(() => {
    const expedienteId = sessionStorage.getItem('expediente_seleccionado_id');
    const vistaGuardada = sessionStorage.getItem('vista_actual');
    
    if (expedienteId && vistaGuardada && expedientes.length > 0) {
      console.log('🔄 Restaurando estado guardado:', { expedienteId, vistaGuardada });
      
      const expedienteRestaurar = expedientes.find(e => e.id === expedienteId || e.id === parseInt(expedienteId));
      if (expedienteRestaurar) {
        setExpedienteSeleccionado(expedienteRestaurar);
        setVistaActual(vistaGuardada);
        console.log('✅ Estado restaurado:', expedienteRestaurar.numero_poliza);
      }
      
      // Limpiar sessionStorage después de restaurar
      sessionStorage.removeItem('expediente_seleccionado_id');
      sessionStorage.removeItem('vista_actual');
    }
  }, [expedientes]);

  // 🔄 RECARGAR CLIENTES cuando se dispara el evento 'clientes-actualizados'
  const recargarClientes = useCallback(async () => {
    try {
      console.log('🔄 Recargando clientes tras evento...');
      const resClientes = await fetch(`${API_URL}/api/clientes?t=${Date.now()}`);
      const clientesData = await resClientes.json();
      const mapa = {};
      clientesData.forEach(c => { mapa[c.id] = c; });
      setClientes(clientesData);
      setClientesMap(mapa);
      console.log('✅ ClientesMap actualizado:', Object.keys(mapa).length, 'clientes');
    } catch (error) {
      console.error('❌ Error recargando clientes tras evento:', error);
    }
  }, []);

  // Listener para evento de actualización de clientes
  useEffect(() => {
    const handler = () => recargarClientes();
    window.addEventListener('clientes-actualizados', handler);
    return () => window.removeEventListener('clientes-actualizados', handler);
  }, [recargarClientes]);

  // 🔄 Listener para recargar expedientes cuando el usuario regresa de WhatsApp/Email
  useEffect(() => {
    const handleRecargarExpedientes = () => {
      console.log('🔄 Evento recargarExpedientes recibido, recargando lista...');
      recargarExpedientes();
    };
    window.addEventListener('recargarExpedientes', handleRecargarExpedientes);
    return () => window.removeEventListener('recargarExpedientes', handleRecargarExpedientes);
  }, []);

  const recargarExpedientes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/expedientes?t=${Date.now()}`);
      const data = await response.json();
      
      // 🔥 CARGAR SOLO EL PRIMER RECIBO PENDIENTE DE CADA EXPEDIENTE
      const datosConPrimerRecibo = await Promise.all(
        data.map(async (exp) => {
          // Solo cargar recibos si es pago fraccionado
          if ((exp.tipo_pago === 'Fraccionado' || exp.forma_pago?.toUpperCase() === 'FRACCIONADO') && 
              (exp.frecuenciaPago || exp.frecuencia_pago)) {
            try {
              const recibosResponse = await fetch(`${API_URL}/api/recibos/${exp.id}`);
              if (recibosResponse.ok) {
                const recibosData = await recibosResponse.json();
                const recibosArray = recibosData?.data || recibosData || [];
                
                if (Array.isArray(recibosArray) && recibosArray.length > 0) {
                  // Buscar el primer recibo sin fecha_pago_real (sin pagar)
                  const primerReciboPendiente = recibosArray
                    .filter(r => !r.fecha_pago_real)
                    .sort((a, b) => a.numero_recibo - b.numero_recibo)[0];
                  
                  // Guardar solo el primer recibo pendiente (o array vacío si todos están pagados)
                  exp.primer_recibo_pendiente = primerReciboPendiente || null;
                }
              }
            } catch (error) {
              console.warn(`⚠️ Error al cargar recibos para expediente ${exp.id}:`, error);
              exp.primer_recibo_pendiente = null;
            }
          }
          return exp;
        })
      );
      
      // Normalizar datos del backend: sincronizar ambos formatos de campos
      const datosNormalizados = datosConPrimerRecibo.map(exp => ({
        ...exp,
        // Sincronizar estatus_pago ↔ estatusPago
        estatusPago: exp.estatusPago || exp.estatus_pago || 'Pendiente',
        estatus_pago: exp.estatus_pago || exp.estatusPago || 'Pendiente',
        // Sincronizar fecha_vencimiento_pago ↔ proximoPago ↔ fecha_pago
        fecha_vencimiento_pago: exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago || '',
        proximoPago: exp.proximoPago || exp.fecha_vencimiento_pago || exp.fecha_pago || '',
        fecha_pago: exp.fecha_pago || exp.fecha_vencimiento_pago || exp.proximoPago || '',
        
        // 🔄 USAR ETAPA CALCULADA DEL BACKEND (si existe)
        // ⚠️ NOTA PARA HUGO: El backend debe agregar campo 'etapa_calculada' que determine
        //    dinámicamente si una póliza Pagada debe cambiar a "Por Renovar" basándose
        //    en fecha_aviso_renovacion. Ver: docs/BACKEND-CALCULO-DINAMICO-ETAPA-POR-RENOVAR.md
        etapa_activa: exp.etapa_calculada || exp.etapa_activa,
        _etapa_original: exp.etapa_activa, // Guardar etapa original por si se necesita
        _dias_para_vencimiento: exp.dias_para_vencimiento || null // Campo adicional del backend
      }));
      
      // Expedientes normalizados
      setExpedientes(datosNormalizados);
    } catch (error) {
      console.error('Error al recargar expedientes:', error);
    }
  };

  // � Función para cambiar estado/etapa de expediente
  const cambiarEstadoExpediente = useCallback(async (expedienteId, nuevoEstado, motivo = '') => {
    try {
      const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
      const etapaAnterior = expedienteActual?.etapa_activa;

      const datosActualizacion = {
        etapa_activa: nuevoEstado,
        fecha_actualizacion: new Date().toISOString().split('T')[0]
      };
      
      if (nuevoEstado === 'Cancelada') {
        datosActualizacion.fecha_cancelacion = new Date().toISOString().split('T')[0];
        datosActualizacion.estatus_pago = 'Cancelado';
        
        // 🔥 IMPORTANTE: Cancelar todos los recibos PENDIENTES (no pagados)
        // Los recibos ya pagados conservan su estatus "Pagado"
        try {
          // Obtener recibos del expediente
          const resRecibos = await fetch(`${API_URL}/api/recibos/${expedienteId}`);
          if (resRecibos.ok) {
            const dataRecibos = await resRecibos.json();
            const recibos = Array.isArray(dataRecibos) ? dataRecibos : (dataRecibos?.data || []);
            
            // Filtrar solo recibos NO pagados
            const recibosPendientes = recibos.filter(r => {
              const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
              return estatus !== 'pagado' && estatus !== 'pagada';
            });
            
            // Cancelar cada recibo pendiente
            for (const recibo of recibosPendientes) {
              await fetch(`${API_URL}/api/recibos/${expedienteId}/${recibo.numero_recibo}/pago`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  estatus: 'Cancelado',
                  fecha_pago_real: null,
                  comprobante_url: null,
                  comprobante_nombre: null
                })
              });
            }
            
            console.log(`✅ ${recibosPendientes.length} recibos cancelados para expediente ${expedienteId}`);
          }
        } catch (errorRecibos) {
          console.error('⚠️ Error al cancelar recibos:', errorRecibos);
          // No fallar la cancelación de la póliza si falla la cancelación de recibos
        }
      }
      
      if (motivo) {
        datosActualizacion.motivoCancelacion = motivo;
      }

      // Actualizando etapa

      const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Etapa actualizada
      
      // 📝 Registrar evento en historial de trazabilidad
      try {
        let tipoEvento = historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS; // Default
        let descripcion = `Etapa cambiada de "${etapaAnterior}" a "${nuevoEstado}"`;
        
        // Asignar tipo de evento específico según el cambio de etapa
        switch (nuevoEstado) {
          case 'Emitida':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_EMITIDA;
            break;
          case 'Pagada':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_PAGADA;
            break;
          case 'Por Renovar':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_POR_RENOVAR;
            break;
          case 'Renovación Emitida':
            tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_EMITIDA;
            break;
          case 'Renovación Pagada':
            tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_PAGADA;
            break;
          case 'Cancelada':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_CANCELADA;
            descripcion = motivo ? `Motivo: ${motivo}` : 'Póliza cancelada sin especificar motivo';
            break;
          case 'Enviada al Cliente':
          case 'Renovación Enviada':
            // ⚠️ ESTOS eventos ya se registran en compartirPorWhatsApp/Email
            // No duplicar eventos - salir sin registrar
            return;
          default:
            // Cualquier otra etapa usa el evento genérico
            tipoEvento = historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS;
            break;
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
          // Evento registrado
      } catch (error) {
        console.error('⚠️ Error al registrar cambio de etapa en historial:', error);
      }
      
      await recargarExpedientes();
      
    } catch (error) {
      console.error('❌ Error al cambiar estado:', error);
      toast.error('Error al cambiar estado del expediente');
    }
  }, [expedientes]);

  // 📧 Cerrar Modal de Aviso de Pago
  const cerrarModalAvisoPago = useCallback(() => {
    setMostrarModalAvisoPago(false);
    setPagoParaNotificar(null);
    setExpedienteDelPago(null);
    setDestinatariosDisponibles([]);
    setDestinatarioSeleccionado(null);
  }, []);

  // 📤 Cerrar Modal de Compartir
  const cerrarModalCompartir = useCallback(() => {
    setMostrarModalCompartir(false);
    setExpedienteParaCompartir(null);
    setDestinatariosCompartir([]);
    setDestinatarioCompartirSeleccionado(null);
    setTipoEnvio('poliza');
    setPagoSeleccionado(null);
  }, []);

  // 🚀 MODULARIZACIÓN: Hook para compartir expedientes
  const {
    compartirPorWhatsApp,
    compartirPorEmail,
    enviarAvisoPagoWhatsApp,
    enviarAvisoPagoEmail,
    actualizarCampoCliente
  } = useCompartirExpediente({
    destinatarioCompartirSeleccionado,
    destinatarioSeleccionado,
    setClienteParaActualizar,
    setDestinatarioParaModal,
    setTipoDatoFaltante,
    setCanalEnvio,
    setExpedienteEnEspera,
    setMostrarModalContacto,
    setPagoParaNotificar,
    cerrarModalAvisoPago,
    cambiarEstadoExpediente,
    utils
  });

  // 🔧 FUNCIÓN: Guardar contacto faltante usando el hook (actualización específica de campo)
  const handleGuardarContactoFaltante = useCallback(async (valorContacto) => {
    try {
      if (!clienteParaActualizar || !tipoDatoFaltante) {
        throw new Error('Datos incompletos para actualizar cliente');
      }

      console.log('🔧 Usando función del hook para actualizar campo:', {
        clienteId: clienteParaActualizar.id,
        tipoPersona: clienteParaActualizar.tipoPersona,
        campo: tipoDatoFaltante,
        valor: valorContacto
      });

      // Usar la función del hook que actualiza solo el campo específico
      const clienteCompleto = await actualizarCampoCliente(
        clienteParaActualizar.id,
        tipoDatoFaltante,
        valorContacto,
        clienteParaActualizar.tipoPersona,
        clienteParaActualizar._destinatarioSeleccionado // Usar info preservada del destinatario
      );

      // Actualizar clientesMap local con cliente completo
      setClientesMap(prevMap => ({
        ...prevMap,
        [clienteParaActualizar.id]: clienteCompleto
      }));

      // Cerrar modal
      setMostrarModalContacto(false);

      // Notificar éxito
      const tipoContacto = tipoDatoFaltante === 'email' ? 'Correo electrónico' : 'Teléfono de contacto';
      toast.success(`${tipoContacto} actualizado correctamente. Enviando...`);

      // 🔍 DEBUG: Información disponible tras captura exitosa
      console.log('🔍 DEBUG TRAS CAPTURA EXITOSA:', {
        clienteSeleccionado: clienteParaActualizar?.nombre,
        destinatarioSeleccionado: clienteParaActualizar?._destinatarioSeleccionado?.nombre,
        emailCapturado: valorContacto,
        tipoDato: tipoDatoFaltante,
        canalEnvio: canalEnvio,
        expedienteEnEspera: expedienteEnEspera?.numero_poliza,
        clienteCompleto: {
          id: clienteCompleto.id,
          nombre: clienteCompleto.nombre,
          contacto_email: clienteCompleto.contacto_email,
          email: clienteCompleto.email
        }
      });

      // Disparar evento para recargar vista de clientes con datos del cliente completo
      window.dispatchEvent(new CustomEvent('clientes-actualizados', {
        detail: { 
          clienteId: clienteParaActualizar.id,
          razon: 'captura_contacto_faltante_hook',
          cliente: clienteCompleto
        }
      }));

      // ✨ NUEVA FUNCIONALIDAD: Detectar si es póliza o aviso de pago y manejar apropiadamente
      if (expedienteEnEspera && clienteParaActualizar._destinatarioSeleccionado) {
        // 🔧 FIX: Detectar correctamente si se actualizó teléfono (puede ser 'telefono' o 'telefono_movil')
        const esActualizacionTelefono = tipoDatoFaltante === 'telefono' || tipoDatoFaltante === 'telefono_movil';
        const esActualizacionEmail = tipoDatoFaltante === 'email' || tipoDatoFaltante === 'contacto_email';
        
        const destinatarioActualizado = {
          ...clienteParaActualizar._destinatarioSeleccionado,
          email: esActualizacionEmail ? valorContacto : clienteParaActualizar._destinatarioSeleccionado.email,
          telefono: esActualizacionTelefono ? valorContacto : clienteParaActualizar._destinatarioSeleccionado.telefono
        };

        console.log('🎯 Detectando tipo de envío:', {
          expediente: expedienteEnEspera.numero_poliza,
          destinatario: destinatarioActualizado.nombre,
          contactoActualizado: valorContacto,
          esAvisoPago: !!pagoParaNotificar,
          canal: canalEnvio
        });

        if (pagoParaNotificar) {
          // 📧 CASO: AVISO DE PAGO
          console.log('💰 Procesando aviso de pago automáticamente');
          
          // 🔧 FIX: Actualizar el destinatario seleccionado ANTES de llamar a enviarAvisoPago
          // para que el hook use el email/teléfono recién capturado
          setDestinatarioCompartirSeleccionado(destinatarioActualizado);
          
          // Transformar recibo a formato esperado para avisos de pago
          const pagoTransformado = {
            numero: pagoParaNotificar.numero_recibo || pagoParaNotificar.numero,
            fecha: pagoParaNotificar.fecha_vencimiento || pagoParaNotificar.fecha,
            monto: pagoParaNotificar.monto,
            estado: pagoParaNotificar.estado_pago || pagoParaNotificar.estado,
            totalPagos: expedienteEnEspera.recibos?.length || null
          };

          setTimeout(async () => {
            if (canalEnvio === 'Email') {
              console.log('📧 Ejecutando aviso de pago automático por Email con destinatario:', destinatarioActualizado);
              // 🔧 FIX: Pasar destinatarioActualizado como tercer parámetro para evitar problema de timing
              await enviarAvisoPagoEmail(pagoTransformado, expedienteEnEspera, destinatarioActualizado);
            } else if (canalEnvio === 'WhatsApp') {
              console.log('📱 Ejecutando aviso de pago automático por WhatsApp con destinatario:', destinatarioActualizado);
              // 🔧 FIX: Pasar destinatarioActualizado como tercer parámetro para evitar problema de timing
              await enviarAvisoPagoWhatsApp(pagoTransformado, expedienteEnEspera, destinatarioActualizado);
            }

            // Refrescar vista después del envío
            setTimeout(() => {
              if (expedienteSeleccionado) {
                console.log('🔄 Refrescando vista de detalle tras aviso de pago');
              } else {
                console.log('🔄 Refrescando listado tras aviso de pago');
                recargarExpedientes();
              }
            }, 1000);

          }, 500);

        } else {
          // 📄 CASO: COMPARTIR PÓLIZA (lógica existente)
          setExpedienteParaCompartir(expedienteEnEspera);
          setDestinatarioCompartirSeleccionado(destinatarioActualizado);
          setMostrarModalCompartir(true);
          
          setTimeout(async () => {
            if (canalEnvio === 'Email') {
              console.log('🚀 Ejecutando envío automático por Email');
              await compartirPorEmail(expedienteEnEspera, destinatarioActualizado);
            } else if (canalEnvio === 'WhatsApp') {
              console.log('🚀 Ejecutando envío automático por WhatsApp');
              await compartirPorWhatsApp(expedienteEnEspera, destinatarioActualizado);
            }

            // Refrescar vista después del envío
            setTimeout(() => {
              if (expedienteSeleccionado) {
                console.log('🔄 Refrescando vista de detalle de póliza');
              } else {
                console.log('🔄 Refrescando listado de pólizas');
                recargarExpedientes();
              }
              
              // Cerrar modal de compartir
              setMostrarModalCompartir(false);
              setExpedienteParaCompartir(null);
              
            }, 1000);
          }, 500);
        }
      }

      // Limpiar datos del modal
      setClienteParaActualizar(null);
      setDestinatarioParaModal(null);
      setTipoDatoFaltante(null);
      setCanalEnvio(null);
      setExpedienteEnEspera(null);
      setPagoParaNotificar(null); // 🔧 FIX: Limpiar también el pago pendiente

    } catch (error) {
      console.error('❌ Error al guardar contacto:', error);
      toast.error(`Error al actualizar contacto: ${error.message}`);
      throw error; // Propagar error para que el modal lo muestre
    }
  }, [clienteParaActualizar, tipoDatoFaltante, canalEnvio, pagoParaNotificar, actualizarCampoCliente, setClientesMap, expedienteEnEspera, enviarAvisoPagoEmail, enviarAvisoPagoWhatsApp, compartirPorEmail, compartirPorWhatsApp, expedienteSeleccionado, recargarExpedientes, setDestinatarioCompartirSeleccionado]);

  // 🚀 MODULARIZACIÓN: Hooks para funcionalidades de pagos
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
  } = usePagos({ 
    expedientes, 
    setExpedientes, 
    cargarExpedientes: recargarExpedientes,
    cambiarEstadoExpediente
  });

  // �️ Abrir Modal para Confirmar Eliminación de Pago
  const abrirModalEliminarPago = useCallback((pago, expediente) => {
    console.log('🗑️ Abriendo modal eliminar pago:', { pago, expediente: expediente?.id });
    setPagoParaEliminar(pago);
    setExpedienteParaEliminarPago(expediente);
    setMotivoEliminacion('');
    setMostrarModalEliminarPago(true);
  }, []);

  // 🗑️ Confirmar y ejecutar eliminación de pago
  const confirmarEliminarPago = useCallback(async () => {
    if (!pagoParaEliminar || !expedienteParaEliminarPago) return;
    
    setEliminandoPago(true);
    try {
      console.log('💰 Eliminando pago del recibo', pagoParaEliminar.numero, 'del expediente', expedienteParaEliminarPago.id);
      console.log('📝 Motivo:', motivoEliminacion || 'No especificado');
      
      const response = await fetch(`${API_URL}/api/recibos/${expedienteParaEliminarPago.id}/${pagoParaEliminar.numero}/pago`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar el pago');
      }
      
      console.log('✅ Pago eliminado correctamente del recibo', pagoParaEliminar.numero);
      
      // 📝 Registrar en historial
      try {
        await historialService.registrarEvento({
          expediente_id: expedienteParaEliminarPago.id,
          tipo_evento: historialService.TIPOS_EVENTO.PAGO_REMOVIDO,
          descripcion: `Pago del recibo #${pagoParaEliminar.numero} eliminado`,
          datos_adicionales: {
            numero_recibo: pagoParaEliminar.numero,
            monto: pagoParaEliminar.monto,
            fecha_pago: pagoParaEliminar.fecha,
            motivo: motivoEliminacion || 'No especificado',
            aseguradora: expedienteParaEliminarPago.compania || expedienteParaEliminarPago.aseguradora,
            numero_poliza: expedienteParaEliminarPago.numero_poliza
          }
        });
        console.log('📝 Evento de pago removido registrado en historial');
      } catch (errorHistorial) {
        console.error('⚠️ Error registrando en historial (no crítico):', errorHistorial);
      }
      
      toast.success(`✅ Pago del recibo #${pagoParaEliminar.numero} eliminado`);
      
      // Cerrar modal
      setMostrarModalEliminarPago(false);
      setPagoParaEliminar(null);
      setExpedienteParaEliminarPago(null);
      setMotivoEliminacion('');
      
      // Guardar estado para restaurar después del reload
      sessionStorage.setItem('expediente_seleccionado_id', expedienteParaEliminarPago.id);
      sessionStorage.setItem('vista_actual', 'detalles');
      
      // Recargar la página
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error eliminando pago:', error);
      toast.error(`Error al eliminar pago: ${error.message}`);
    } finally {
      setEliminandoPago(false);
    }
  }, [pagoParaEliminar, expedienteParaEliminarPago, motivoEliminacion]);

  // ❌ Iniciar proceso de cancelación de póliza (con confirmación)
  const iniciarCancelacion = useCallback((expediente) => {
    const nombreCliente = expediente.nombre 
      ? `${expediente.nombre} ${expediente.apellido_paterno || ''}`.trim()
      : 'este expediente';
    const numeroPoliza = expediente.numero_poliza || 'Sin número';
    
    const confirmado = window.confirm(
      `⚠️ ¿Está seguro de CANCELAR la póliza?\n\n` +
      `📋 Póliza: ${numeroPoliza}\n` +
      `👤 Cliente: ${nombreCliente}\n\n` +
      `Esta acción:\n` +
      `• Cambiará el estado del expediente a "Cancelada"\n` +
      `• Cancelará todos los recibos PENDIENTES\n` +
      `• Los recibos YA PAGADOS se mantendrán\n\n` +
      `¿Desea continuar?`
    );
    
    if (confirmado) {
      cambiarEstadoExpediente(expediente.id, 'Cancelada', 'Cancelación manual desde listado');
    }
  }, [cambiarEstadoExpediente]);

  // 📤 Abrir Modal de Compartir (Póliza, Aviso de Pago o Cotización)
  // tipoEnvioInicial: 'poliza' (default), 'pago' o 'cotizacion' para preseleccionar
  const abrirModalCompartir = useCallback(async (expediente, tipoEnvioInicial = 'poliza') => {
    // Preseleccionar tipo de envío
    setTipoEnvio(tipoEnvioInicial);
    
    // Validar que el expediente tenga cliente_id
    if (!expediente?.cliente_id) {
      toast.error('Esta póliza no tiene un cliente asociado');
      return;
    }
    
    // Si es cotización, cargar las cotizaciones disponibles
    if (tipoEnvioInicial === 'cotizacion') {
      setCargandoCotizaciones(true);
      try {
        const cotizaciones = await pdfService.obtenerCotizaciones(expediente.id);
        setCotizacionesExpediente(cotizaciones);
        // Seleccionar la más reciente por defecto
        if (cotizaciones.length > 0) {
          setCotizacionSeleccionada(cotizaciones[cotizaciones.length - 1]);
        } else {
          setCotizacionSeleccionada(null);
        }
      } catch (error) {
        console.warn('No se pudieron cargar cotizaciones:', error);
        setCotizacionesExpediente([]);
        setCotizacionSeleccionada(null);
      } finally {
        setCargandoCotizaciones(false);
      }
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
        setDestinatarioCompartirSeleccionado(destinatarios[0]); // Seleccionar el primero por defecto
        
        // Si hay recibos, seleccionar automáticamente el más relevante
        if (expediente.recibos && expediente.recibos.length > 0) {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          
          // Prioridad: 1) Vencido no pagado, 2) Pendiente no pagado, 3) Primer recibo (incluso pagado)
          const recibosNoPagados = expediente.recibos.filter(r => !r.fecha_pago_real);
          
          if (recibosNoPagados.length > 0) {
            const primerVencido = recibosNoPagados.find(r => {
              const fechaVenc = new Date(r.fecha_vencimiento);
              fechaVenc.setHours(0, 0, 0, 0);
              return fechaVenc < hoy;
            });
            setPagoSeleccionado(primerVencido || recibosNoPagados[0]);
          } else {
            // Todos pagados: seleccionar el último recibo pagado
            setPagoSeleccionado(expediente.recibos[expediente.recibos.length - 1]);
          }
        }
        
        setExpedienteParaCompartir(expediente);
        setMostrarModalCompartir(true);
      } else {
        toast.error('No se pudo obtener la información del cliente');
      }
    } catch (error) {
      console.error('Error al obtener destinatarios:', error);
      toast.error('Error al cargar datos del cliente. Verifica que el cliente exista.');
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES PARA FLUJO DE RENOVACIÓN
  // ═══════════════════════════════════════════════════════════════

  /**
   * 🆕 Abrir Modal de Opciones de Renovación
   * - Muestra 2 opciones: Cargar Cotización o Cargar Póliza Renovada
   * - Se usa en carpetas "Por Renovar" y "En Proceso Renovación"
   */
  const abrirModalOpcionesRenovacion = useCallback((expediente) => {
    setExpedienteAnteriorParaRenovacion(expediente);
    setMostrarModalOpcionesRenovacion(true);
  }, []);

  /**
   * 🆕 Opción 1: Cargar Cotización desde el modal de opciones
   * - Cierra modal de opciones
   * - Mueve directamente a "En Cotización - Renovación"
   * - El usuario puede subir cotización después en la carpeta "En Proceso Renovación"
   */
  const seleccionarCargarCotizacion = useCallback(async () => {
    try {
      if (!expedienteAnteriorParaRenovacion) return;
      
      // Actualizar expediente con nueva etapa
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteAnteriorParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_activa: 'En Cotización - Renovación'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      // Registrar evento
      await historialService.registrarEvento({
        expediente_id: expedienteAnteriorParaRenovacion.id,
        cliente_id: expedienteAnteriorParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA || 'COTIZACION_RENOVACION_INICIADA',
        usuario_nombre: 'Sistema',
        descripcion: 'Iniciado proceso de cotización para renovación de póliza',
        datos_adicionales: {
          numero_poliza: expedienteAnteriorParaRenovacion.numero_poliza,
          compania: expedienteAnteriorParaRenovacion.compania
        }
      });
      
      toast.success('Movido a En Proceso Renovación - Cotización');
      setMostrarModalOpcionesRenovacion(false);
      setExpedienteAnteriorParaRenovacion(null);
      await recargarExpedientes();
    } catch (error) {
      console.error('Error al iniciar cotización:', error);
      toast.error('Error al mover a cotización');
    }
  }, [expedienteAnteriorParaRenovacion]);

  /**
   * 🆕 Opción 2: Cargar Póliza Renovada desde el modal de opciones
   * - Cierra modal de opciones
   * - Abre el extractor PDF con referencia al expediente anterior
   */
  const seleccionarCargarPolizaRenovada = useCallback(() => {
    setMostrarModalOpcionesRenovacion(false);
    // El extractor se abrirá con expedienteAnteriorParaRenovacion disponible
    setMostrarExtractorPDF(true);
  }, []);

  /**
   * 1. Iniciar Cotización de Renovación
   * - Abre modal para capturar detalles de cotización
   * - Cambia estado a "En Cotización - Renovación"
   * - Registra evento COTIZACION_RENOVACION_INICIADA
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
      
      // Actualizar expediente con nueva etapa
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_activa: 'En Cotización - Renovación'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      // Enriquecer expediente con datos del cliente para el log
      const cliente = clientesMap[expedienteParaRenovacion.cliente_id];
      const expedienteEnriquecido = {
        ...expedienteParaRenovacion,
        nombre: expedienteParaRenovacion.nombre || cliente?.nombre || '',
        razon_social: expedienteParaRenovacion.razon_social || cliente?.razon_social || ''
      };
      
      console.log('📝 Expediente para renovación:', expedienteEnriquecido);
      console.log('📅 Vigencias:', {
        inicio: expedienteEnriquecido.inicio_vigencia,
        termino: expedienteEnriquecido.termino_vigencia
      });
      
      // Registrar evento usando helper del servicio (descripción enriquecida)
      await historialService.registrarCotizacionRenovacionIniciada(expedienteEnriquecido);
      
      toast.success('Cotización de renovación iniciada');
      await recargarExpedientes();
      
      // Cerrar modal
      setMostrarModalCotizarRenovacion(false);
      setExpedienteParaRenovacion(null);
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      toast.error('Error al iniciar cotización');
    }
  }, [expedienteParaRenovacion, clientesMap]);

  /**
   * 🆕 2. Abrir Modal para Cargar Cotización
   * - Abre modal para subir archivo PDF de cotización
   */
  const abrirModalCargarCotizacion = useCallback((expediente) => {
    setExpedienteParaRenovacion(expediente);
    setArchivoCotizacion(null);
    setMostrarModalCargarCotizacion(true);
  }, []);

  /**
   * 🆕 3. Guardar Cotización (subir archivo a S3)
   * - Sube el archivo de cotización a S3
   * - Si etapa es "En Cotización - Renovación", cambia a "Cotización Lista"
   * - Si ya está en etapa posterior, solo registra el archivo sin cambiar etapa
   */
  const guardarCotizacionArchivo = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion || !archivoCotizacion) {
        toast.error('Selecciona un archivo de cotización');
        return;
      }
      
      setCargandoCotizacion(true);
      
      // Subir archivo a S3
      let cotizacionUrl = null;
      try {
        const resultado = await pdfService.subirCotizacionPDF(expedienteParaRenovacion.id, archivoCotizacion);
        cotizacionUrl = resultado?.url || null;
        console.log('✅ Cotización subida a S3:', cotizacionUrl);
      } catch (uploadError) {
        console.warn('⚠️ No se pudo subir cotización a S3, continuando sin URL:', uploadError);
        // Continuar sin URL si falla la subida
      }
      
      // Solo cambiar etapa si está en "En Cotización - Renovación"
      const etapaActual = expedienteParaRenovacion.etapa_activa || '';
      if (etapaActual === 'En Cotización - Renovación') {
        const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            etapa_activa: 'Cotización Lista'
          })
        });
        
        if (!response.ok) throw new Error('Error al actualizar expediente');
      }
      
      // Registrar evento usando helper del servicio (descripción enriquecida)
      await historialService.registrarCotizacionCargada(expedienteParaRenovacion, archivoCotizacion.name, cotizacionUrl);
      
      toast.success('Cotización cargada correctamente');
      setMostrarModalCargarCotizacion(false);
      setExpedienteParaRenovacion(null);
      setArchivoCotizacion(null);
      await recargarExpedientes();
    } catch (error) {
      console.error('Error al cargar cotización:', error);
      toast.error('Error al cargar cotización');
    } finally {
      setCargandoCotizacion(false);
    }
  }, [expedienteParaRenovacion, archivoCotizacion]);

  /**
   * 4. Enviar Cotización al Cliente (Abrir Modal)
   * - Abre modal de compartir con tipo 'cotizacion' preseleccionado
   * - NO cambia etapa, solo comparte
   */
  const enviarCotizacionCliente = useCallback(async (expediente) => {
    // Abrir modal de compartir con tipo cotización preseleccionado
    await abrirModalCompartir(expediente, 'cotizacion');
  }, [abrirModalCompartir]);

  /**
   * 4b. Compartir Cotización por WhatsApp
   * - Si etapa es "Cotización Lista", cambia a "Cotización Enviada"
   * - Si ya está en "Cotización Enviada", puede compartir N veces sin cambiar etapa
   * - Incluye link de descarga si hay cotización seleccionada
   * - Registra evento COTIZACION_ENVIADA
   */
  const compartirCotizacionWhatsApp = useCallback(async (expediente) => {
    try {
      // Obtener datos del destinatario
      const destinatario = destinatarioCompartirSeleccionado;
      if (!destinatario?.telefono) {
        toast.error('El destinatario no tiene número de teléfono');
        return;
      }
      
      // Obtener nombre del cliente
      const cliente = clientesMap[expediente.cliente_id];
      const nombreCliente = destinatario.nombre || cliente?.nombre || cliente?.razon_social || 'Cliente';
      const primerNombre = nombreCliente.split(' ')[0]; // Solo primer nombre para ser más personal
      
      // Obtener nombre del usuario que envía
      const usuarioActual = historialService.obtenerUsuarioActual();
      const firmaUsuario = usuarioActual.nombre !== 'Sistema' ? usuarioActual.nombre : '';
      
      // Obtener URL de la cotización seleccionada (si existe)
      let linkCotizacion = '';
      if (cotizacionSeleccionada?.url) {
        linkCotizacion = `\n\n📄 Descarga tu cotización aquí:\n${cotizacionSeleccionada.url}`;
      } else if (cotizacionSeleccionada?.id) {
        // Intentar obtener URL firmada
        try {
          const urlData = await pdfService.obtenerURLCotizacion(expediente.id, cotizacionSeleccionada.id);
          if (urlData?.url) {
            linkCotizacion = `\n\n📄 Descarga tu cotización aquí:\n${urlData.url}`;
          }
        } catch (e) {
          console.warn('No se pudo obtener URL firmada:', e);
        }
      }
      
      // Construir mensaje de cotización más amigable
      const mensaje = `¡Hola ${primerNombre}! 👋\n\nTu póliza ${expediente.numero_poliza || ''} de ${expediente.compania || 'tu aseguradora'} está próxima a vencer.\n\nTe compartimos por este medio algunas opciones para su renovación y que continúes protegido. 🛡️${linkCotizacion}\n\nQuedamos atentos a tus comentarios.${firmaUsuario ? `\n\n${firmaUsuario}` : ''}`;
      
      // Abrir WhatsApp
      const telefono = destinatario.telefono.replace(/\D/g, '');
      const telefonoCompleto = telefono.startsWith('52') ? telefono : `52${telefono}`;
      const urlWhatsApp = `https://wa.me/${telefonoCompleto}?text=${encodeURIComponent(mensaje)}`;
      window.open(urlWhatsApp, '_blank');
      
      // Si está en "Cotización Lista", cambiar a "Cotización Enviada"
      const etapaActual = expediente.etapa_activa || '';
      if (etapaActual === 'Cotización Lista') {
        await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ etapa_activa: 'Cotización Enviada' })
        });
        await recargarExpedientes();
      }
      
      // Registrar evento
      await historialService.registrarCotizacionEnviadaCliente(expediente);
      
      toast.success(`Cotización enviada por WhatsApp a ${nombreCliente}`);
    } catch (error) {
      console.error('Error al enviar cotización por WhatsApp:', error);
      toast.error('Error al enviar cotización');
    }
  }, [clientesMap, destinatarioCompartirSeleccionado, cotizacionSeleccionada, recargarExpedientes]);

  /**
   * 4c. Compartir Cotización por Email
   * - Si etapa es "Cotización Lista", cambia a "Cotización Enviada"
   * - Si ya está en "Cotización Enviada", puede compartir N veces sin cambiar etapa
   * - Incluye link de descarga si hay cotización seleccionada
   * - Registra evento COTIZACION_ENVIADA
   */
  const compartirCotizacionEmail = useCallback(async (expediente) => {
    try {
      // Obtener datos del destinatario
      const destinatario = destinatarioCompartirSeleccionado;
      if (!destinatario?.email) {
        toast.error('El destinatario no tiene email');
        return;
      }
      
      // Obtener nombre del cliente
      const cliente = clientesMap[expediente.cliente_id];
      const nombreCliente = destinatario.nombre || cliente?.nombre || cliente?.razon_social || 'Cliente';
      const primerNombre = nombreCliente.split(' ')[0]; // Solo primer nombre para ser más personal
      
      // Obtener nombre del usuario que envía
      const usuarioActual = historialService.obtenerUsuarioActual();
      const firmaUsuario = usuarioActual.nombre !== 'Sistema' ? usuarioActual.nombre : '';
      
      // Obtener URL de la cotización seleccionada (si existe)
      let linkCotizacion = '';
      if (cotizacionSeleccionada?.url) {
        linkCotizacion = `\n\nDescarga tu cotización aquí:\n${cotizacionSeleccionada.url}`;
      } else if (cotizacionSeleccionada?.id) {
        // Intentar obtener URL firmada
        try {
          const urlData = await pdfService.obtenerURLCotizacion(expediente.id, cotizacionSeleccionada.id);
          if (urlData?.url) {
            linkCotizacion = `\n\nDescarga tu cotización aquí:\n${urlData.url}`;
          }
        } catch (e) {
          console.warn('No se pudo obtener URL firmada:', e);
        }
      }
      
      // Construir email más amigable
      const asunto = `Opciones de Renovación - Póliza ${expediente.numero_poliza || ''} - ${expediente.compania || ''}`;
      const cuerpo = `¡Hola ${primerNombre}!\n\nTu póliza ${expediente.numero_poliza || ''} de ${expediente.compania || 'tu aseguradora'} está próxima a vencer.\n\nTe compartimos por este medio algunas opciones para su renovación y que continúes protegido.${linkCotizacion}\n\nQuedamos atentos a tus comentarios.\n\nSaludos cordiales.${firmaUsuario ? `\n\n${firmaUsuario}` : ''}`;
      
      const urlEmail = `mailto:${destinatario.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(urlEmail, '_blank');
      
      // Si está en "Cotización Lista", cambiar a "Cotización Enviada"
      const etapaActual = expediente.etapa_activa || '';
      if (etapaActual === 'Cotización Lista') {
        await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ etapa_activa: 'Cotización Enviada' })
        });
        await recargarExpedientes();
      }
      
      // Registrar evento
      await historialService.registrarCotizacionEnviadaCliente(expediente);
      
      toast.success(`Cotización enviada por Email a ${nombreCliente}`);
    } catch (error) {
      console.error('Error al enviar cotización por Email:', error);
      toast.error('Error al enviar cotización');
    }
  }, [clientesMap, destinatarioCompartirSeleccionado, cotizacionSeleccionada, recargarExpedientes]);

  /**
   * 3. Marcar Renovación como Autorizada (Cliente Autoriza)
   * - Cliente autorizó la renovación después de recibir cotización
   * - Cambia estado a "Pendiente de Emisión - Renovación"
   * - Registra evento RENOVACION_PENDIENTE_EMISION
   */
  const marcarRenovacionAutorizada = useCallback(async (expediente) => {
    try {
      setExpedienteParaRenovacion(expediente);
      setMostrarModalAutorizarRenovacion(true);
    } catch (error) {
      console.error('Error al abrir modal de autorización:', error);
      toast.error('Error al autorizar renovación');
    }
  }, []);

  const confirmarAutorizacion = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      // Actualizar expediente con nueva etapa
      const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_activa: 'Por Emitir - Renovación'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      // Registrar evento usando helper del servicio (descripción enriquecida)
      await historialService.registrarRenovacionAutorizada(expedienteParaRenovacion);
      
      toast.success('Renovación autorizada - Por emitir');
      await recargarExpedientes();
      
      // Cerrar modal
      setMostrarModalAutorizarRenovacion(false);
      setExpedienteParaRenovacion(null);
    } catch (error) {
      console.error('Error al autorizar renovación:', error);
      toast.error('Error al marcar como autorizada');
    }
  }, [expedienteParaRenovacion]);

  /**
   * 3. Agregar Póliza Renovada
   * - Registrar nueva póliza emitida (renovación completada)
   * - Capturar datos completos de la nueva póliza
   * - Actualizar fecha_aviso_renovacion automáticamente
   * - Cambiar estado a "Renovación Emitida"
   */
  const abrirModalPolizaRenovada = useCallback(async (expediente) => {
    try {
      // Guardar referencia del expediente anterior para vinculación
      setExpedienteAnteriorParaRenovacion(expediente);
      
      // Abrir en modo agregar nueva póliza (el formulario se limpiará automáticamente)
      setModoEdicion(false);
      setVistaActual('formulario');
      
      // Toast informativo
      toast.success(`Capturando renovación de póliza ${expediente.numero_poliza}`);
    } catch (error) {
      console.error('Error al abrir formulario de póliza renovada:', error);
      toast.error('Error al abrir formulario de renovación');
    }
  }, []);

  const guardarPolizaRenovada = useCallback(async () => {
    try {
      if (!expedienteParaRenovacion) return;
      
      // Calcular fecha de aviso (30 días antes del nuevo término)
      const terminoVigencia = new Date(datosRenovacion.terminoVigenciaNueva);
      const fechaAviso = new Date(terminoVigencia);
      fechaAviso.setDate(fechaAviso.getDate() - 30);
      
      // 🆕 CREAR NUEVO EXPEDIENTE para la renovación (en lugar de actualizar el anterior)
      // Copiar datos del expediente anterior + nuevos datos de renovación
      const nuevoExpediente = {
        // Datos del cliente y bien asegurado (copiados)
        cliente_id: expedienteParaRenovacion.cliente_id,
        compania: expedienteParaRenovacion.compania,
        producto: expedienteParaRenovacion.producto,
        plan: expedienteParaRenovacion.plan,
        tipo_pago: expedienteParaRenovacion.tipo_pago,
        frecuencia_pago: expedienteParaRenovacion.frecuencia_pago,
        moneda: expedienteParaRenovacion.moneda,
        forma_pago: expedienteParaRenovacion.forma_pago,
        agente_id: expedienteParaRenovacion.agente_id,
        clave_agente: expedienteParaRenovacion.clave_agente,
        vendedor_id: expedienteParaRenovacion.vendedor_id,
        // Datos del vehículo/bien asegurado
        numero_serie: expedienteParaRenovacion.numero_serie,
        placas: expedienteParaRenovacion.placas,
        marca: expedienteParaRenovacion.marca,
        submarca: expedienteParaRenovacion.submarca,
        modelo: expedienteParaRenovacion.modelo,
        version: expedienteParaRenovacion.version,
        color: expedienteParaRenovacion.color,
        uso: expedienteParaRenovacion.uso,
        servicio: expedienteParaRenovacion.servicio,
        // Coberturas
        suma_asegurada: expedienteParaRenovacion.suma_asegurada,
        deducible: expedienteParaRenovacion.deducible,
        coberturas: expedienteParaRenovacion.coberturas,
        
        // 🆕 NUEVOS datos de la renovación
        numero_poliza: datosRenovacion.numeroPolizaNueva,
        endoso: '000', // Renovación inicia con endoso 000
        prima_neta: parseFloat(datosRenovacion.primaNueva) || 0,
        total: parseFloat(datosRenovacion.totalNuevo) || 0,
        fecha_emision: datosRenovacion.fechaEmisionNueva,
        inicio_vigencia: datosRenovacion.inicioVigenciaNueva,
        termino_vigencia: datosRenovacion.terminoVigenciaNueva,
        fecha_aviso_renovacion: fechaAviso.toISOString().split('T')[0],
        etapa_activa: 'Emitida', // Inicia ciclo nuevo
        estatus_pago: 'Pendiente',
        tipo_movimiento: 'RENOVACION',
        
        // 🔗 VÍNCULO con póliza anterior
        renovacion_de: expedienteParaRenovacion.id,
        observaciones: datosRenovacion.observaciones ? 
          `Renovación de póliza ${expedienteParaRenovacion.numero_poliza}. ${datosRenovacion.observaciones}` :
          `Renovación de póliza ${expedienteParaRenovacion.numero_poliza}`
      };
      
      // 1️⃣ CREAR el nuevo expediente
      const responseNuevo = await fetch(`${API_URL}/api/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoExpediente)
      });
      
      if (!responseNuevo.ok) {
        const errorData = await responseNuevo.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al crear expediente de renovación');
      }
      
      const nuevoExpedienteCreado = await responseNuevo.json();
      console.log('✅ Nuevo expediente de renovación creado:', nuevoExpedienteCreado.id);
      
      // 2️⃣ ACTUALIZAR el expediente anterior a "Renovada"
      const responseAnterior = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etapa_activa: 'Renovada',
          renovada_por: nuevoExpedienteCreado.id // Referencia bidireccional
        })
      });
      
      if (!responseAnterior.ok) {
        console.warn('⚠️ No se pudo actualizar etapa de póliza anterior');
      }
      
      // 3️⃣ Registrar evento en el expediente ANTERIOR usando helper del servicio
      await historialService.registrarRenovacionEmitidaAnterior(
        expedienteParaRenovacion, 
        datosRenovacion, 
        nuevoExpedienteCreado.id
      );
      
      // 4️⃣ Registrar evento en el expediente NUEVO usando helper del servicio
      await historialService.registrarExpedienteRenovacionCreado(
        expedienteParaRenovacion, 
        datosRenovacion, 
        nuevoExpedienteCreado.id
      );
      
      toast.success(`✅ Póliza renovada creada exitosamente - #${datosRenovacion.numeroPolizaNueva}`);
      await recargarExpedientes();
      
      // Cerrar modal
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
    } catch (error) {
      console.error('Error al guardar póliza renovada:', error);
      toast.error('Error al registrar póliza renovada: ' + error.message);
    }
  }, [expedienteParaRenovacion, datosRenovacion]);

  // Función de compartir (por ahora simplificada - pendiente implementación completa)
  const abrirModalCompartirOLD = useCallback(async (expediente) => {
    toast.info('Función Compartir Póliza pendiente de implementación completa');
    // Compartir expediente
    // TODO: Implementar modal de compartir completo con Email/WhatsApp
  }, []);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setClienteSeleccionado(null);
    setModoEdicion(false);
    setCambiosClientePendientes(null); // Limpiar cambios pendientes
  }, []);

  const validarFormulario = useCallback(() => {
    if (!formulario.numero_poliza) {
      toast.error('El número de póliza es obligatorio');
      return false;
    }
    if (!formulario.cliente_id) {
      toast.error('Debe seleccionar un cliente');
      return false;
    }
    if (!formulario.compania) {
      toast.error('La compañía es obligatoria');
      return false;
    }
    return true;
  }, [formulario]);

  // 🔄 DETECTAR Y ACTUALIZAR CAMBIOS EN DATOS DE LA PÓLIZA/EXPEDIENTE
  const actualizarPolizaSiCambio = useCallback(async (datosActuales, expedienteId, datosOriginales) => {

    
    if (!datosOriginales || !expedienteId) {
      console.log('❌ No hay datos originales o expedienteId para comparar');
      return { hayCambios: false, cambiosDetectados: {} };
    }

    const cambiosDetectados = {};
    let hayCambios = false;

    // 🔧 SOLO CAMPOS DE PÓLIZA/EXPEDIENTE que se pueden actualizar en BD
    const camposPoliza = [
      'fecha_emision', 'inicio_vigencia', 'termino_vigencia',
      'prima_neta', 'iva', 'prima_total', 'primer_pago', 'pagos_subsecuentes',
      'tipo_pago', 'frecuenciaPago', 'dias_gracia_pago',
      'compania', 'numero_poliza', 'marca', 'modelo', 'placas'
    ];

    // Detectar cambios
    camposPoliza.forEach(campo => {
      const valorActual = datosActuales[campo];
      const valorOriginal = datosOriginales[campo];
      
      if (valorActual && valorActual !== valorOriginal) {
        cambiosDetectados[campo] = {
          anterior: valorOriginal || '',
          nuevo: valorActual
        };
        hayCambios = true;
      }
    });

    // Si hay cambios, actualizar en BD
    if (hayCambios) {
      try {

        
        // Preparar datos para actualización (solo valores nuevos)
        const datosActualizacion = {};
        Object.keys(cambiosDetectados).forEach(campo => {
          datosActualizacion[campo] = cambiosDetectados[campo].nuevo;
        });

        const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosActualizacion)
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${await response.text()}`);
        }


      } catch (error) {
        console.error('❌ Error al actualizar póliza:', error);
        // No interrumpir el flujo, solo loggear
      }
    }

    const descripcionCambios = Object.keys(cambiosDetectados).map(campo => {
      const cambio = cambiosDetectados[campo];
      const nombreCampo = campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `${nombreCampo}: "${cambio.anterior}" → "${cambio.nuevo}"`;
    }).join(' | ');

    return { hayCambios, cambiosDetectados, descripcionCambios };
  }, []);

  // 🔄 ACTUALIZAR CLIENTE si se modificaron datos en el formulario
  const actualizarClienteSiCambio = useCallback(async (datosFormulario) => {
    try {
      // Solo actualizar si hay cliente seleccionado y estamos en modo edición
      if (!clienteSeleccionado || !datosFormulario.cliente_id) {
        return;
      }

      // Verificar cambios en datos del cliente

      const cambiosDetectados = {};
      let hayCambios = false;

      // 🔧 CAMPOS EDITABLES DESDE EXPEDIENTE: Solo 9 campos específicos
      const camposAComparar = [
        // 📞 CONTACTO DEL CLIENTE/ASEGURADO (3 campos editables)
        { formulario: 'email', cliente: 'email' },
        { formulario: 'telefono_fijo', cliente: 'telefonoFijo' },
        { formulario: 'telefono_movil', cliente: 'telefonoMovil' },
        
        // 👨‍💼 CONTACTO PRINCIPAL/GESTOR (6 campos editables)
        { formulario: 'contacto_nombre', cliente: 'contacto_nombre' },
        { formulario: 'contacto_apellido_paterno', cliente: 'contacto_apellido_paterno' },
        { formulario: 'contacto_apellido_materno', cliente: 'contacto_apellido_materno' },
        { formulario: 'contacto_email', cliente: 'contacto_email' },
        { formulario: 'contacto_telefono_fijo', cliente: 'contacto_telefono_fijo' },
        { formulario: 'contacto_telefono_movil', cliente: 'contacto_telefono_movil' }
        // NOTA: Nombre, apellidos y RFC del cliente NO son editables desde expediente
      ];

      for (const { formulario: campoFormulario, cliente: campoCliente } of camposAComparar) {
        const valorFormulario = datosFormulario[campoFormulario];
        const valorCliente = clienteSeleccionado[campoCliente];
        
        // Normalizar valores: undefined → null, mantener '' y otros valores
        const valorFormNormalizado = valorFormulario === undefined ? null : valorFormulario;
        const valorClienteNormalizado = valorCliente === undefined ? null : valorCliente;
        
        // Comparación: '' vs null se consideran diferentes si uno tiene valor
        const sonDiferentes = (() => {
          // Si ambos son nulos/vacíos, no hay cambio
          if (!valorFormNormalizado && !valorClienteNormalizado) return false;
          // Si uno es null/vacío y el otro tiene valor, sí hay cambio
          if (!valorFormNormalizado && valorClienteNormalizado) return true;
          if (valorFormNormalizado && !valorClienteNormalizado) return true;
          // Si ambos tienen valor, comparar
          return valorFormNormalizado !== valorClienteNormalizado;
        })();
        
        console.log(`🔍 Comparando ${campoFormulario}:`, {
          formulario: valorFormulario,
          cliente: valorCliente,
          sonDiferentes
        });
        
        // Detectar cambios
        if (sonDiferentes) {
          cambiosDetectados[campoFormulario] = {
            anterior: valorCliente || '',
            nuevo: valorFormulario
          };
          hayCambios = true;
          console.log(`✅ CAMBIO DETECTADO en ${campoFormulario}: "${valorCliente}" → "${valorFormulario}"`);
        }
      }

      console.log('🔍 === RESUMEN DE DETECCIÓN DE CAMBIOS ===');
      console.log('🔍 Cambios detectados:', cambiosDetectados);
      console.log('🔍 Campos cambiados:', Object.keys(cambiosDetectados));
      console.log('🔍 Total cambios:', Object.keys(cambiosDetectados).length);

      if (!hayCambios) {
        console.log('❌ No hay cambios, saltando actualización');
        return; // No hay cambios
      }

      // 🔧 ENVIAR TODOS LOS DATOS DEL FORMULARIO al CRUD (objeto completo)
      const datosCompletos = {
        // Datos básicos del cliente desde formulario
        nombre: datosFormulario.nombre || '',
        apellido_paterno: datosFormulario.apellido_paterno || '',
        apellido_materno: datosFormulario.apellido_materno || '',
        rfc: datosFormulario.rfc || '',
        email: datosFormulario.email || '',
        telefono_fijo: datosFormulario.telefono_fijo || '',    
        telefono_movil: datosFormulario.telefono_movil || '',  
        // También enviar en camelCase para compatibilidad
        telefonoFijo: datosFormulario.telefono_fijo || '',     // 🔧 FIX: también camelCase
        telefonoMovil: datosFormulario.telefono_movil || '',   // 🔧 FIX: también camelCase
        // Datos del contacto principal desde formulario  
        contacto_nombre: datosFormulario.contacto_nombre || '',
        contacto_apellido_paterno: datosFormulario.contacto_apellido_paterno || '',
        contacto_apellido_materno: datosFormulario.contacto_apellido_materno || '',
        contacto_email: datosFormulario.contacto_email || '',
        contacto_telefono_fijo: datosFormulario.contacto_telefono_fijo || '',
        contacto_telefono_movil: datosFormulario.contacto_telefono_movil || ''
      };

      console.log('🔧 Enviando datos COMPLETOS al CRUD (como formulario normal):', datosCompletos);

      // Usar el servicio CRUD existente con datos completos
      const resultadoActualizacion = await clientesService.actualizarCliente(clienteSeleccionado.id, datosCompletos);
      
      if (!resultadoActualizacion.success) {
        console.error('❌ Error al actualizar cliente con CRUD:', resultadoActualizacion.error);
        toast.error(`Los datos de la póliza se guardaron, pero hubo un problema al actualizar el cliente: ${resultadoActualizacion.error}`);
        return null;
      }

      console.log('✅ Cliente actualizado exitosamente con CRUD:', resultadoActualizacion.data);

      // 🔄 FORZAR RECARGA DEL CACHE DE CLIENTES
      // En lugar de actualizar manualmente, forzamos la recarga completa del cache
      console.log('🔄 Forzando recarga del cache de clientes...');
      
      // También actualizamos el clienteSeleccionado local
      const clienteActualizado = resultadoActualizacion.data;
      setClienteSeleccionado(prev => ({ ...prev, ...clienteActualizado }));
      
      // Disparar evento para que ListaExpedientes recargue su clientesMap
      window.dispatchEvent(new CustomEvent('clientes-actualizados', {
        detail: { 
          clienteId: clienteSeleccionado.id,
          razon: 'actualizacion_desde_expediente',
          cliente: clienteActualizado
        }
      }));

      // Registrar evento de actualización

      
      if (datosFormulario.id) { 
        // Caso: editando expediente existente - NO registrar evento separado
        // Los cambios se incluirán en el evento de edición de expediente
        console.log('🔍 EDITANDO - Retornando cambios para incluir en evento de edición');
        
        // Crear descripción detallada de los cambios
        const descripcionCambios = Object.keys(cambiosDetectados).map(campo => {
          const cambio = cambiosDetectados[campo];
          const nombreCampo = campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `${nombreCampo}: "${cambio.anterior}" → "${cambio.nuevo}"`;
        }).join(' | ');
        
        return {
          cliente_id: clienteSeleccionado.id,
          campos_actualizados: Object.keys(cambiosDetectados),
          cambios_detallados: cambiosDetectados,
          metodo: 'actualizacion_automatica',
          descripcionCambios
        };
      } else {
        // Caso: creando nuevo expediente - retornar cambios para registrar después
        const cambiosPendientes = {
          cliente_id: clienteSeleccionado.id,
          campos_actualizados: Object.keys(cambiosDetectados),
          cambios_detallados: cambiosDetectados,
          metodo: 'actualizacion_automatica'
        };
        
        // Crear descripción detallada de los cambios
        const descripcionCambios = Object.keys(cambiosDetectados).map(campo => {
          const cambio = cambiosDetectados[campo];
          const nombreCampo = campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `${nombreCampo}: "${cambio.anterior}" → "${cambio.nuevo}"`;
        }).join(' | ');
        
        const cambiosConDescripcion = { ...cambiosPendientes, descripcionCambios };
        
        console.log('🔍 CREANDO - Retornando cambios pendientes:', cambiosConDescripcion);
        setCambiosClientePendientes(cambiosConDescripcion);
        
        // Disparar evento para recargar vista de clientes
        const clienteActualizado = resultadoActualizacion.data || resultadoActualizacion;
        window.dispatchEvent(new CustomEvent('clientes-actualizados', {
          detail: { 
            clienteId: clienteSeleccionado.id, 
            cliente: clienteActualizado,
            accion: 'actualizado'
          }
        }));

        toast.success('Datos del cliente actualizados automáticamente');
        
        return cambiosConDescripcion;
      }

    } catch (error) {
      console.error('❌ Error en actualizarClienteSiCambio:', error);
      // No lanzar error para no interrumpir guardado de póliza
      toast.error('Los datos de la póliza se guardaron, pero hubo un problema al actualizar el cliente');
      return null; // Error - no hay cambios válidos
    }
  }, [clienteSeleccionado]);

  /**
   * 🔍 FUNCIÓN CENTRALIZADA: Comparar snapshot del PDF vs datos actuales del formulario
   * Detecta cambios en TODOS los campos del formulario y recibos para el LOG de historial
   * NO modifica la BD, solo retorna los cambios detectados
   */
  const compararConSnapshot = useCallback((snapshot, datosActuales) => {
    if (!snapshot) {
      return { hayDiferencias: false, campos: [], detalles: {}, recibos: null };
    }

    const cambios = {
      hayDiferencias: false,
      campos: [],
      detalles: {}
    };

    // Función auxiliar para normalizar valores
    const normalizarValor = (valor) => {
      if (valor === null || valor === undefined) return '';
      if (typeof valor === 'string' && valor.includes('T')) {
        return valor.split('T')[0]; // Fecha ISO -> solo fecha
      }
      return String(valor).trim();
    };

    // 1. CAMPOS DEL CLIENTE - Persona Física
    const camposClienteFisica = [
      'nombre', 'apellido_paterno', 'apellido_materno'
    ];

    // 2. CAMPOS DEL CLIENTE - Persona Moral
    const camposClienteMoral = [
      'razon_social', 'nombre_comercial'
    ];

    // 3. DATOS GENERALES DEL CLIENTE
    const camposGeneralesCliente = [
      'rfc', 'telefono_fijo', 'telefono_movil', 'email'
    ];

    // 4. DATOS DE CONTACTO PRINCIPAL (Persona Moral)
    const camposContactoPrincipal = [
      'contacto_telefono_fijo', 'contacto_telefono_movil', 'contacto_email',
      'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno'
    ];

    // 5. ASEGURADORA Y PRODUCTO
    const camposAseguradora = [
      'compania', 'producto'
    ];

    // 6. AGENTES Y VENDEDORES
    const camposAgentes = [
      'agente', 'agente_id', 'clave_agente',
      'sub_agente', 'subagente_id', 'vendedor_id'
    ];

    // 7. NÚMEROS DE PÓLIZA
    const camposPoliza = [
      'numero_poliza', 'numero_endoso'
    ];

    // 8. FECHAS DE PÓLIZA
    const camposFechas = [
      'fecha_emision', 'inicio_vigencia', 'termino_vigencia',
      'fecha_vencimiento_pago', 'fecha_aviso_renovacion'
    ];

    // 9. MONTOS Y CÁLCULOS
    const camposMontos = [
      'prima_neta', 'cargo_pago_fraccionado', 'gastos_expedicion',
      'iva', 'subtotal', 'total'
    ];

    // 10. TIPO DE PAGO
    const camposPago = [
      'tipo_pago', 'frecuenciaPago', 'periodo_gracia',
      'primer_pago', 'pagos_subsecuentes', 'estatusPago'
    ];

    // 11. DATOS DEL VEHÍCULO
    const camposVehiculo = [
      'marca', 'modelo', 'anio', 'numero_serie', 'placas',
      'color', 'tipo_vehiculo', 'tipo_cobertura', 'suma_asegurada',
      'conductor_habitual', 'edad_conductor', 'licencia_conducir'
    ];

    // Combinar todos los campos a comparar
    const todosCampos = [
      ...camposClienteFisica,
      ...camposClienteMoral,
      ...camposGeneralesCliente,
      ...camposContactoPrincipal,
      ...camposAseguradora,
      ...camposAgentes,
      ...camposPoliza,
      ...camposFechas,
      ...camposMontos,
      ...camposPago,
      ...camposVehiculo
    ];

    // Comparar cada campo
    todosCampos.forEach(campo => {
      const valorSnapshot = normalizarValor(snapshot[campo]);
      const valorActual = normalizarValor(datosActuales[campo]);

      if (valorSnapshot !== valorActual && (valorSnapshot || valorActual)) {
        cambios.hayDiferencias = true;
        cambios.campos.push(campo);
        cambios.detalles[campo] = {
          pdf: valorSnapshot || '(vacío)',
          final: valorActual || '(vacío)'
        };
      }
    });

    // 12. COMPARAR RECIBOS (fechas de vencimiento y montos)
    const recibosSnapshot = snapshot.recibos || [];
    const recibosActuales = datosActuales.recibos || [];

    // Parsear si vienen como string JSON
    let recibosSnapParsed = recibosSnapshot;
    let recibosActualesParsed = recibosActuales;

    if (typeof recibosSnapParsed === 'string') {
      try {
        recibosSnapParsed = JSON.parse(recibosSnapParsed);
      } catch (e) {
        recibosSnapParsed = [];
      }
    }
    if (typeof recibosActualesParsed === 'string') {
      try {
        recibosActualesParsed = JSON.parse(recibosActualesParsed);
      } catch (e) {
        recibosActualesParsed = [];
      }
    }

    // Asegurar que sean arrays
    if (!Array.isArray(recibosSnapParsed)) recibosSnapParsed = [];
    if (!Array.isArray(recibosActualesParsed)) recibosActualesParsed = [];

    if (recibosSnapParsed.length > 0 || recibosActualesParsed.length > 0) {
      const cambiosRecibos = [];
      const maxLength = Math.max(recibosSnapParsed.length, recibosActualesParsed.length);

      for (let i = 0; i < maxLength; i++) {
        const reciboSnap = recibosSnapParsed[i];
        const reciboActual = recibosActualesParsed[i];

        // Recibo agregado
        if (!reciboSnap && reciboActual) {
          cambios.hayDiferencias = true;
          cambiosRecibos.push({
            recibo: reciboActual.numero_recibo || (i + 1),
            tipo_cambio: 'agregado',
            fecha_pdf: null,
            fecha_final: reciboActual.fecha_vencimiento || reciboActual.fecha,
            monto: reciboActual.monto
          });
        }
        // Recibo eliminado
        else if (reciboSnap && !reciboActual) {
          cambios.hayDiferencias = true;
          cambiosRecibos.push({
            recibo: i + 1,
            tipo_cambio: 'eliminado',
            fecha_pdf: reciboSnap.fecha_vencimiento || reciboSnap.fecha,
            fecha_final: null,
            monto: reciboSnap.monto
          });
        }
        // Recibo editado (comparar fecha y monto)
        else if (reciboSnap && reciboActual) {
          const fechaSnap = normalizarValor(reciboSnap.fecha_vencimiento || reciboSnap.fecha);
          const fechaActual = normalizarValor(reciboActual.fecha_vencimiento || reciboActual.fecha);
          const montoSnap = normalizarValor(reciboSnap.monto);
          const montoActual = normalizarValor(reciboActual.monto);

          if (fechaSnap !== fechaActual || montoSnap !== montoActual) {
            cambios.hayDiferencias = true;
            cambiosRecibos.push({
              recibo: reciboActual.numero_recibo || (i + 1),
              tipo_cambio: 'editado',
              fecha_pdf: reciboSnap.fecha_vencimiento || reciboSnap.fecha,
              fecha_final: reciboActual.fecha_vencimiento || reciboActual.fecha,
              monto_pdf: reciboSnap.monto,
              monto_final: reciboActual.monto
            });
          }
        }
      }

      if (cambiosRecibos.length > 0) {
        cambios.recibos = {
          cantidad: cambiosRecibos.length,
          detalles: cambiosRecibos
        };
      }
    }

    return cambios;
  }, []);

  const guardarExpediente = useCallback(async () => {
    if (!validarFormulario()) {
      return;
    }

    setGuardando(true);

    try {
      const datos = { ...formulario };
      
      // 🔄 PASO 1: ACTUALIZAR CLIENTE EN BD (si cambió)
      console.log('🔍 Actualizando cliente si cambió...');
      const cambiosClienteDetectados = await actualizarClienteSiCambio(datos);
      
      // 🔄 PASO 2: DETECTAR CAMBIOS MANUALES POST-PDF (para el LOG)
      let cambiosManualesDetectados = null;
      const fueExtractorPDF = datos._datos_desde_pdf === true;
      
      console.log('🔍 ===== DEBUG DETECCIÓN DE CAMBIOS =====');
      console.log('🔍 modoEdicion:', modoEdicion);
      console.log('🔍 fueExtractorPDF:', fueExtractorPDF);
      console.log('🔍 window.__datosOriginalesPDF existe:', !!window.__datosOriginalesPDF);
      
      if (!modoEdicion && fueExtractorPDF && window.__datosOriginalesPDF) {
        console.log('🔍 Detectando cambios manuales post-PDF...');
        console.log('🔍 Snapshot original:', window.__datosOriginalesPDF);
        console.log('🔍 Datos actuales:', datos);
        
        cambiosManualesDetectados = compararConSnapshot(window.__datosOriginalesPDF, datos);
        
        console.log('🔍 Resultado de comparación:', cambiosManualesDetectados);
        
        if (cambiosManualesDetectados.hayDiferencias) {
          console.log('✅ ===== CAMBIOS DETECTADOS =====');
          console.log('✅ Campos editados:', cambiosManualesDetectados.campos.length);
          console.log('✅ Lista de campos:', cambiosManualesDetectados.campos);
          console.log('✅ Detalles:', cambiosManualesDetectados.detalles);
          console.log('✅ Recibos editados:', cambiosManualesDetectados.recibos?.cantidad || 0);
          if (cambiosManualesDetectados.recibos) {
            console.log('✅ Detalles recibos:', cambiosManualesDetectados.recibos.detalles);
          }
          console.log('✅ ================================');
        } else {
          console.log('ℹ️ No se detectaron cambios manuales');
        }
      } else {
        console.log('⚠️ NO se ejecutó detección de cambios. Razones:');
        if (modoEdicion) console.log('  - Es modo edición');
        if (!fueExtractorPDF) console.log('  - No fue extractor PDF');
        if (!window.__datosOriginalesPDF) console.log('  - No hay snapshot');
      }
      console.log('🔍 ======================================');
      
      // 🔍 En modo edición, guardar snapshot del estado ORIGINAL antes de los cambios
      let snapshotOriginal = null;
      let snapshotRecibosOriginales = null;
      if (modoEdicion && expedienteSeleccionado) {
        snapshotOriginal = {
          fecha_emision: expedienteSeleccionado.fecha_emision,
          inicio_vigencia: expedienteSeleccionado.inicio_vigencia,
          termino_vigencia: expedienteSeleccionado.termino_vigencia,
          tipo_pago: expedienteSeleccionado.tipo_pago,
          frecuencia_pago: expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago,
          total: expedienteSeleccionado.total,
          primer_pago: expedienteSeleccionado.primer_pago,
          pagos_subsecuentes: expedienteSeleccionado.pagos_subsecuentes,
          periodo_gracia: expedienteSeleccionado.periodo_gracia,
          fecha_vencimiento_pago: expedienteSeleccionado.fecha_vencimiento_pago || expedienteSeleccionado.proximoPago,
          compania: expedienteSeleccionado.compania,
          producto: expedienteSeleccionado.producto,
          tipo_cobertura: expedienteSeleccionado.tipo_cobertura
        };
        
        // 📋 Guardar snapshot de recibos originales si existen
        if (expedienteSeleccionado.recibos && Array.isArray(expedienteSeleccionado.recibos)) {
          snapshotRecibosOriginales = expedienteSeleccionado.recibos.map(r => ({
            numero_recibo: r.numero_recibo,
            fecha_vencimiento: r.fecha_vencimiento,
            monto: r.monto
          }));
        }
      }
      
      // Capturar si cambió algún campo que afecta los recibos ANTES de limpiar las banderas
      const cambioInicioVigencia = datos._inicio_vigencia_changed === true;
      const cambioPeriodoGracia = datos._periodo_gracia_changed === true;
      const cambioTipoPago = datos._tipo_pago_changed === true;
      const cambioFrecuenciaPago = datos._frecuencia_pago_changed === true;
      const cambioTotal = datos._total_changed === true;
      const cambioPrimerPago = datos._primer_pago_changed === true;
      const cambioPagosSubsecuentes = datos._pagos_subsecuentes_changed === true;
      
      const debeRegenerarRecibos = (
        cambioInicioVigencia || cambioPeriodoGracia || cambioTipoPago || 
        cambioFrecuenciaPago || cambioTotal || cambioPrimerPago || cambioPagosSubsecuentes
      );
      
      // Limpiar campos temporales y banderas
      delete datos._fechaManual;
      delete datos._datos_desde_pdf;
      delete datos._metodo_captura;
      delete datos._inicio_vigencia_changed;
      delete datos._periodo_gracia_changed;
      delete datos._tipo_pago_changed;
      delete datos._frecuencia_pago_changed;
      delete datos._total_changed;
      delete datos._primer_pago_changed;
      delete datos._pagos_subsecuentes_changed;
      delete datos.cliente;
      delete datos.historial;
      
      // 📄 En modo edición, NO enviar campos de PDF (se actualizan por separado al subir)
      // Esto evita sobrescribir el pdf_key nuevo con el viejo
      if (modoEdicion) {
        delete datos.pdf_key;
        delete datos.pdf_url;
        delete datos.pdf_nombre;
        delete datos.pdf_size;
        delete datos.pdf_fecha_subida;
      }

      // Serializar coberturas
      if (datos.coberturas && Array.isArray(datos.coberturas)) {
        datos.coberturas = JSON.stringify(datos.coberturas);
      }

      // 🔥 IMPORTANTE: Sincronizar campos entre camelCase y snake_case
      // para que el backend y frontend siempre estén compatibles
      
      // 1. Sincronizar estatusPago ↔ estatus_pago
      if (datos.estatusPago) {
        datos.estatus_pago = datos.estatusPago;
      }
      if (datos.estatus_pago) {
        datos.estatusPago = datos.estatus_pago;
      }
      
      // 2. Sincronizar frecuenciaPago ↔ frecuencia_pago
      if (datos.frecuenciaPago) {
        datos.frecuencia_pago = datos.frecuenciaPago;
      }
      if (datos.frecuencia_pago) {
        datos.frecuenciaPago = datos.frecuencia_pago;
      }
      
      // 3. Sincronizar fecha_vencimiento_pago (fecha límite para pagar)
      if (datos.fecha_vencimiento_pago) {
        datos.proximoPago = datos.fecha_vencimiento_pago;
      } else if (datos.proximoPago) {
        datos.fecha_vencimiento_pago = datos.proximoPago;
      }
      
      // 4. ⚠️ fecha_pago solo se envía si está PAGADO (es la fecha REAL del pago)
      const estaPagado = (datos.estatusPago || datos.estatus_pago || '').toLowerCase() === 'pagado';
      if (!estaPagado) {
        // Si NO está pagado, NO enviar fecha_pago
        delete datos.fecha_pago;
      } else if (datos.fecha_vencimiento_pago && !datos.fecha_pago) {
        // Si está pagado pero no tiene fecha_pago, usar fecha_vencimiento_pago
        datos.fecha_pago = datos.fecha_vencimiento_pago;
      }

      // 5. Para pagos fraccionados: gestión de recibos
      // Si cambió cualquier campo que afecte los recibos, ELIMINAR recibos para que el backend los regenere
      if (debeRegenerarRecibos && modoEdicion) {
        console.log('🔄 Cambios detectados que requieren regenerar recibos - eliminando recibos para que el backend los regenere');
        console.log('🔄 Cambios:', {
          inicio_vigencia: cambioInicioVigencia,
          periodo_gracia: cambioPeriodoGracia,
          tipo_pago: cambioTipoPago,
          frecuencia_pago: cambioFrecuenciaPago,
          total: cambioTotal,
          primer_pago: cambioPrimerPago,
          pagos_subsecuentes: cambioPagosSubsecuentes
        });
        delete datos.recibos;
        datos._force_recibo_regeneration = true; // Bandera explícita para backend
      } else {
        // Serializar recibos si existen
        if (datos.recibos && Array.isArray(datos.recibos) && datos.recibos.length > 0) {
          datos.recibos = JSON.stringify(datos.recibos);
        } else {
          delete datos.recibos;
        }
      }
      
      console.log('💾 ========== GUARDANDO EXPEDIENTE ==========');
      console.log('💾 Recibos en datos a guardar:', datos.recibos);
      console.log('💾 ===========================================');
      
      // Enviando al backend

      let response;
      if (modoEdicion) {
        response = await fetch(`${API_URL}/api/expedientes/${datos.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
      } else {
        datos.fecha_creacion = new Date().toISOString().split('T')[0];
        
        // 🆕 Si hay expediente anterior (renovación), vincular
        if (expedienteAnteriorParaRenovacion) {
          datos.renovacion_de = expedienteAnteriorParaRenovacion.id;
          console.log('🔗 Vinculando renovación - expediente anterior:', expedienteAnteriorParaRenovacion.id);
        }
        
        response = await fetch(`${API_URL}/api/expedientes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Error al guardar');
      }

      const resultado = await response.json();
      // Procesando respuesta
      
      // Obtener ID del expediente (para creación o edición)
      const expedienteId = resultado.data?.id || resultado.id;
      
      // 📄 SUBIR PDF A S3 (si es creación desde extractor PDF)
      console.log('📄 ===== DEBUG SUBIDA PDF =====');
      console.log('📄 modoEdicion:', modoEdicion);
      console.log('📄 window._selectedPDFFile:', window._selectedPDFFile);
      console.log('📄 fueExtractorPDF:', fueExtractorPDF);
      console.log('📄 expedienteId:', expedienteId);
      console.log('📄 ==============================');
      
      if (!modoEdicion && window._selectedPDFFile) {
        try {
          console.log('📤 Subiendo PDF del extractor a S3...');
          const pdfData = await pdfService.subirPDFPoliza(expedienteId, window._selectedPDFFile);
          console.log('✅ PDF subido correctamente:', pdfData);
          
          // Limpiar archivo temporal
          window._selectedPDFFile = null;
          window._autoExtractorMode = null;
        } catch (errorPDF) {
          console.error('⚠️ Error al subir PDF (no crítico):', errorPDF);
          toast.error('No se pudo subir el PDF: ' + errorPDF.message);
          // Continuar con el flujo aunque falle la subida del PDF
        }
      } else if (!modoEdicion && fueExtractorPDF) {
        console.warn('⚠️ Fue extractor PDF pero window._selectedPDFFile está vacío');
      }
      
      // Si es creación y no vienen recibos, obtenerlos del backend o usar los que tenemos
      let recibosParaLog = resultado.data?.recibos || resultado.recibos || null;
      console.log('🔍 recibosParaLog inicial:', recibosParaLog);
      console.log('🔍 datos.recibos disponible:', datos.recibos);
      
      if (!modoEdicion && !recibosParaLog && (datos.tipo_pago === 'Fraccionado' || datos.tipo_pago === 'Anual')) {
        try {
          const resRecibos = await fetch(`${API_URL}/api/recibos/${expedienteId}`);
          if (resRecibos.ok) {
            const dataRecibos = await resRecibos.json();
            recibosParaLog = dataRecibos.data || dataRecibos || null;
            console.log('🔍 recibosParaLog del backend:', recibosParaLog);
          }
        } catch (err) {
          console.error('⚠️ Error al obtener recibos para log:', err);
        }
      }
      
      // Si aún no hay recibos pero están en datos, usarlos
      if (!recibosParaLog && datos.recibos && Array.isArray(datos.recibos) && datos.recibos.length > 0) {
        recibosParaLog = datos.recibos;
        console.log('✅ Usando recibos de datos.recibos:', recibosParaLog.length);
      }
      
      // 📋 Si es edición y se regeneraron recibos, obtener los nuevos para comparar
      if (modoEdicion && debeRegenerarRecibos) {
        try {
          const resRecibos = await fetch(`${API_URL}/api/recibos/${expedienteId}`);
          if (resRecibos.ok) {
            const dataRecibos = await resRecibos.json();
            recibosParaLog = dataRecibos.data || dataRecibos || null;
          }
        } catch (err) {
          console.error('⚠️ Error al obtener recibos actualizados:', err);
        }
      }
      
      // 📊 Detectar cambios en fechas de recibos en EDICIÓN
      let cambiosRecibosEdicion = null;
      if (modoEdicion && snapshotRecibosOriginales && recibosParaLog && debeRegenerarRecibos) {
        const cambiosDetectados = [];
        
        // Comparar cada recibo
        recibosParaLog.forEach((reciboNuevo, idx) => {
          const reciboOriginal = snapshotRecibosOriginales[idx];
          if (reciboOriginal) {
            const fechaOriginal = reciboOriginal.fecha_vencimiento;
            const fechaNueva = reciboNuevo.fecha_vencimiento;
            
            if (fechaOriginal !== fechaNueva) {
              cambiosDetectados.push({
                numero_recibo: reciboNuevo.numero_recibo,
                fecha_anterior: fechaOriginal,
                fecha_nueva: fechaNueva,
                monto: reciboNuevo.monto
              });
            }
          }
        });
        
        if (cambiosDetectados.length > 0) {
          cambiosRecibosEdicion = {
            cantidad_cambios: cambiosDetectados.length,
            cambios_detallados: cambiosDetectados
          };
        }
      }
      
      // 🧹 Limpiar snapshot global después de usarlo
      if (window.__datosOriginalesPDF) {
        window.__datosOriginalesPDF = null;
      }
      
      //  Registrar evento en historial de trazabilidad
      try {
        if (modoEdicion) {
          // REGISTRO DE EDICIÓN
          const camposEditados = {};
          if (snapshotOriginal) {
            // Comparar campos importantes
            const camposAComparar = {
              fecha_emision: 'Fecha de emisión',
              inicio_vigencia: 'Inicio de vigencia',
              termino_vigencia: 'Término de vigencia',
              tipo_pago: 'Tipo de pago',
              frecuencia_pago: 'Frecuencia de pago',
              total: 'Monto total',
              primer_pago: 'Primer pago',
              pagos_subsecuentes: 'Pagos subsecuentes',
              periodo_gracia: 'Período de gracia',
              fecha_vencimiento_pago: 'Fecha vencimiento pago',
              compania: 'Aseguradora',
              producto: 'Producto',
              tipo_cobertura: 'Tipo de cobertura'
            };
            
            // Función para normalizar valores antes de comparar
            const normalizarValor = (valor) => {
              if (!valor) return '';
              if (typeof valor === 'string' && valor.includes('T')) {
                return valor.split('T')[0];
              }
              return String(valor).trim();
            };
            
            Object.entries(camposAComparar).forEach(([campo, etiqueta]) => {
              const valorAnterior = snapshotOriginal[campo];
              const valorNuevo = datos[campo] || datos[campo.replace(/_/g, '')] || datos[campo.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase())];
              
              const valorAnteriorNormalizado = normalizarValor(valorAnterior);
              const valorNuevoNormalizado = normalizarValor(valorNuevo);
              
              if (valorAnteriorNormalizado !== valorNuevoNormalizado && (valorAnteriorNormalizado || valorNuevoNormalizado)) {
                camposEditados[etiqueta] = {
                  antes: valorAnterior || 'vacío',
                  despues: valorNuevo || 'vacío'
                };
              }
            });
          }
          
          const cantidadCambios = Object.keys(camposEditados).length;
          
          // 🔍 DEBUG: Ver qué cambios se detectaron
          console.log('🔍 ===== DEBUG EDICIÓN =====');
          console.log('🔍 snapshotOriginal:', snapshotOriginal);
          console.log('🔍 datos actuales:', {
            fecha_emision: datos.fecha_emision,
            inicio_vigencia: datos.inicio_vigencia,
            termino_vigencia: datos.termino_vigencia,
            tipo_pago: datos.tipo_pago,
            frecuencia_pago: datos.frecuencia_pago || datos.frecuenciaPago,
            total: datos.total,
            compania: datos.compania,
            producto: datos.producto
          });
          console.log('🔍 camposEditados:', camposEditados);
          console.log('🔍 cantidadCambios:', cantidadCambios);
          console.log('🔍 ===========================');
          
          // Formatear campos editados
          const cambiosDetallados = {};
          Object.entries(camposEditados).forEach(([etiqueta, cambio]) => {
            const nombreCampo = etiqueta.toLowerCase().replace(/ /g, '_');
            cambiosDetallados[nombreCampo] = {
              anterior: cambio.antes,
              nuevo: cambio.despues
            };
          });
          
          console.log('🔍 cambiosDetallados para el log:', cambiosDetallados);
          console.log('🔍 cambiosClienteDetectados:', cambiosClienteDetectados);
          
          // Contar cambios totales (póliza + cliente)
          const cantidadCambiosCliente = cambiosClienteDetectados?.campos_actualizados?.length || 0;
          const cantidadCambiosTotal = cantidadCambios + cantidadCambiosCliente;
          
          // Construir descripción más informativa
          let descripcionCambios = [];
          if (cantidadCambios > 0) {
            descripcionCambios.push(`${cantidadCambios} campo(s) de póliza`);
          }
          if (cantidadCambiosCliente > 0) {
            descripcionCambios.push(`${cantidadCambiosCliente} dato(s) de cliente`);
          }
          const textoDescripcion = descripcionCambios.length > 0 
            ? descripcionCambios.join(' + ') 
            : 'Sin cambios detectados';
          
          // 🔇 NOTA: El registro de edición ahora se hace en FormularioEditarExpediente.jsx
          // con la función guardarConAuditoria() que tiene un snapshot más preciso.
          // Solo registramos aquí si hay cambios de cliente detectados que no se capturan allá.
          // await historialService.registrarEvento({...}) -- DESHABILITADO
          console.log('ℹ️ Registro de edición delegado a FormularioEditarExpediente.jsx');
          
        } else {
          // REGISTRO DE CREACIÓN
          const expedienteId = resultado.data?.id || resultado.id;
          
          // Construir descripción del log
          const aseguradora = datos.compania || 'Sin aseguradora';
          const numPoliza = datos.numero_poliza || 'Sin número';
          const tipoPago = datos.tipo_pago || 'Sin tipo de pago';
          const frecuencia = datos.tipo_pago === 'Fraccionado' 
            ? `(${datos.frecuenciaPago || datos.frecuencia_pago || 'N/A'})` 
            : '';
          const totalFormateado = `$${datos.total || '0'}`;
          
          let descripcionCaptura = '';
          if (fueExtractorPDF) {
            descripcionCaptura = `Captura de póliza (PDF) | ${aseguradora} | Póliza: ${numPoliza} | ${tipoPago} ${frecuencia} | Total: ${totalFormateado}`;
            
            // Añadir mención de cambios manuales si los hay
            if (cambiosManualesDetectados?.hayDiferencias) {
              const totalCambios = cambiosManualesDetectados.campos.length + (cambiosManualesDetectados.recibos?.cantidad || 0);
              descripcionCaptura += ` | ${totalCambios} cambio(s) manual(es)`;
            }
          } else {
            descripcionCaptura = `Captura de póliza (Manual) | ${aseguradora} | Póliza: ${numPoliza} | ${tipoPago} ${frecuencia} | Total: ${totalFormateado}`;
          }
          
          // Obtener información del agente
          let agenteInfo = null;
          if (datos.agente_id) {
            try {
              const agenteResponse = await fetch(`${API_URL}/api/equipo-trabajo/${datos.agente_id}`);
              if (agenteResponse.ok) {
                const agenteData = await agenteResponse.json();
                const agente = agenteData.data || agenteData;
                if (agente) {
                  agenteInfo = {
                    nombre: `${agente.nombre || ''} ${agente.apellidoPaterno || agente.apellido_paterno || ''} ${agente.apellidoMaterno || agente.apellido_materno || ''}`.trim() || 'Sin nombre',
                    clave: datos.clave_agente || 'Sin clave'
                  };
                }
              }
            } catch (err) {
              console.error('⚠️ Error al obtener info del agente:', err);
            }
          }
          
          // Obtener información del sub-agente/vendedor
          let subAgenteInfo = null;
          const subAgenteId = datos.subagente_id || datos.vendedor_id || datos.sub_agente;
          
          // Solo intentar fetch si parece ser un ID válido (número o UUID)
          const esIdValido = subAgenteId && (
            !isNaN(subAgenteId) || 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subAgenteId)
          );
          
          if (esIdValido) {
            try {
              const subAgenteResponse = await fetch(`${API_URL}/api/equipo-trabajo/${subAgenteId}`);
              if (subAgenteResponse.ok) {
                const subAgenteData = await subAgenteResponse.json();
                const subAgente = subAgenteData.data || subAgenteData;
                if (subAgente) {
                  subAgenteInfo = {
                    nombre: `${subAgente.nombre || ''} ${subAgente.apellidoPaterno || subAgente.apellido_paterno || ''} ${subAgente.apellidoMaterno || subAgente.apellido_materno || ''}`.trim() || 'Sin nombre'
                  };
                }
              }
            } catch (err) {
              console.error('⚠️ Error al obtener info del sub-agente:', err);
            }
          } else if (subAgenteId) {
            // Si no es un ID válido pero existe, usar el valor directo como nombre
            subAgenteInfo = {
              nombre: String(subAgenteId)
            };
          }
          
          // Determinar origen del cliente
          let codigoCliente = 'Sin código';
          let origenCliente = '';
          let clienteNuevoInfo = null;
          
          if (window.__clienteCreadoDurantePDF) {
            const datosCliente = window.__clienteCreadoDurantePDF;
            const cliente = datosCliente.cliente;
            codigoCliente = cliente?.codigo || datos.codigo_cliente || 'Sin código';
            
            const nombreCliente = cliente.razonSocial || cliente.razon_social || 
                                 `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''} ${cliente.apellidoMaterno || cliente.apellido_materno || ''}`.trim() || 
                                 'Sin nombre';
            
            origenCliente = `Cliente nuevo (#${codigoCliente})`;
            
            // Guardar info del cliente nuevo para incluir en datos_adicionales
            clienteNuevoInfo = {
              cliente_id: cliente.id,
              codigo: codigoCliente,
              nombre_cliente: nombreCliente,
              rfc: cliente.rfc,
              tipo_persona: cliente.tipoPersona || 'No definido',
              email: cliente.email || null,
              telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || null,
              metodo_creacion: datosCliente.metodo
            };
            
            // Limpiar flag
            window.__clienteCreadoDurantePDF = null;
          } else {
            codigoCliente = clienteSeleccionado?.codigo || datos.codigo_cliente || 'Sin código';
            origenCliente = `Cliente seleccionado (#${codigoCliente})`;
          }
          
          // Calcular fechas límite de pago
          let fechasLimitePago = [];
          if (datos.tipo_pago === 'Fraccionado' && (datos.frecuenciaPago || datos.frecuencia_pago)) {
            if (recibosParaLog && Array.isArray(recibosParaLog)) {
              fechasLimitePago = recibosParaLog.map(r => r.fecha_vencimiento);
            }
          } else {
            fechasLimitePago = [datos.fecha_vencimiento_pago || datos.proximoPago || datos.fecha_pago || null];
          }
          
          // Registrar evento en historial
          console.log('📝 ===== REGISTRANDO EN HISTORIAL =====');
          console.log('📝 Tipo evento:', fueExtractorPDF ? 'CAPTURA_EXTRACTOR_PDF' : 'CAPTURA_MANUAL');
          console.log('📝 Descripción:', descripcionCaptura);
          console.log('📝 ¿Hay cambios manuales?', !!cambiosManualesDetectados?.hayDiferencias);
          if (cambiosManualesDetectados?.hayDiferencias) {
            console.log('📝 Cambios que se van a guardar:', {
              campos: cambiosManualesDetectados.campos.length,
              recibos: cambiosManualesDetectados.recibos?.cantidad || 0
            });
          }
          console.log('📝 ====================================');
          
          await historialService.registrarEvento({
            expediente_id: expedienteId,
            cliente_id: datos.cliente_id,
            tipo_evento: fueExtractorPDF 
              ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
              : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
            usuario_nombre: 'Sistema',
            descripcion: descripcionCaptura,
            datos_adicionales: {
              // 1. Método de captura
              metodo_captura: fueExtractorPDF ? 'Extractor PDF' : 'Captura Manual',
              
              // 2. Información básica
              aseguradora: datos.compania || 'Sin aseguradora',
              numero_poliza: datos.numero_poliza || 'Sin número',
              fecha_captura: new Date().toISOString(),
              
              // 3. Cliente
              cliente_origen: origenCliente,
              
              // 3.1 Si es cliente nuevo, incluir sus datos
              ...(clienteNuevoInfo && {
                cliente_nuevo: clienteNuevoInfo
              }),
              
              // 4. Agente y Vendedor
              agente: agenteInfo,
              subagente: subAgenteInfo,
              
              // 5. Cambios de cliente (si los hay - actualizaciones en BD)
              ...(cambiosClienteDetectados && {
                cliente_cambios: {
                  descripcion: 'Datos personales del cliente editados',
                  campos_actualizados: cambiosClienteDetectados.campos_actualizados,
                  cambios_detallados: cambiosClienteDetectados.cambios_detallados
                }
              }),
              
              // 6. ✨ CAMBIOS MANUALES POST-PDF (usando la nueva función compararConSnapshot)
              ...(cambiosManualesDetectados?.hayDiferencias && {
                cambios_manuales: {
                  descripcion: 'Datos editados manualmente después de extraer del PDF',
                  campos_editados: cambiosManualesDetectados.campos.length > 0 ? {
                    cantidad: cambiosManualesDetectados.campos.length,
                    lista: cambiosManualesDetectados.campos,
                    detalles: cambiosManualesDetectados.detalles
                  } : null,
                  recibos_editados: cambiosManualesDetectados.recibos || null
                }
              }),
              
              // 7. Fechas importantes
              fecha_emision: datos.fecha_emision || null,
              inicio_vigencia: datos.inicio_vigencia || null,
              termino_vigencia: datos.termino_vigencia || null,
              
              // 8. Fechas límite de pago
              fechas_limite_pago: fechasLimitePago,
              tipo_pago: datos.tipo_pago || null,
              frecuencia_pago: datos.tipo_pago === 'Fraccionado' ? (datos.frecuenciaPago || datos.frecuencia_pago) : null,
              
              // 9. Información de recibos generados
              recibos_generados: (() => {
                try {
                  // datos.recibos puede ser string JSON o array
                  let recibosArray = datos.recibos;
                  if (typeof recibosArray === 'string') {
                    recibosArray = JSON.parse(recibosArray);
                  }
                  
                  if (recibosArray && Array.isArray(recibosArray) && recibosArray.length > 0) {
                    return {
                      cantidad: recibosArray.length,
                      detalles: recibosArray.map(r => ({
                        numero: r.numero_recibo,
                        monto: r.monto,
                        fecha_vencimiento: r.fecha_vencimiento,
                        estatus: r.estatus_pago || 'Pendiente'
                      }))
                    };
                  }
                } catch (err) {
                  console.error('⚠️ Error al parsear recibos:', err);
                }
                return null;
              })(),
              monto_total: datos.total || null,
              monto_primer_pago: datos.tipo_pago === 'Fraccionado' ? datos.primer_pago : datos.total,
              monto_pagos_subsecuentes: datos.tipo_pago === 'Fraccionado' ? datos.pagos_subsecuentes : null,
              
              // 10. Estatus de pago (calcular del recibo más viejo pendiente)
              estatus_pago: (() => {
                try {
                  let recibosArray = datos.recibos;
                  if (typeof recibosArray === 'string') {
                    recibosArray = JSON.parse(recibosArray);
                  }
                  
                  if (recibosArray && Array.isArray(recibosArray) && recibosArray.length > 0) {
                    // Ordenar por fecha de vencimiento (más viejo primero)
                    const recibosOrdenados = [...recibosArray].sort((a, b) => 
                      new Date(a.fecha_vencimiento || a.fecha) - new Date(b.fecha_vencimiento || b.fecha)
                    );
                    
                    // Tomar el primer recibo (más viejo)
                    const primerRecibo = recibosOrdenados[0];
                    const fechaVenc = new Date(primerRecibo.fecha_vencimiento || primerRecibo.fecha);
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    fechaVenc.setHours(0, 0, 0, 0);
                    const diffDias = Math.floor((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
                    
                    if (primerRecibo.estatus_pago === 'Pagado') return 'Pagado';
                    if (diffDias < 0) return 'Vencido';
                    if (diffDias <= 5) return 'Por Vencer';
                    return 'Pendiente';
                  }
                } catch (err) {
                  console.error('⚠️ Error al calcular estatus de pago:', err);
                }
                return 'Pendiente';
              })(),
              
              // 11. Quién capturó y etapa
              usuario_capturo: 'Sistema',
              etapa_inicial: datos.etapa_activa || 'Captura'
            }
          });

        }
      } catch (errorHistorial) {
        console.error('⚠️ Error al registrar en historial (no crítico):', errorHistorial);
        console.error('⚠️ Detalles del error:', {
          message: errorHistorial.message,
          stack: errorHistorial.stack,
          expedienteId: resultado.data?.id || resultado.id,
          clienteId: datos.cliente_id
        });
        // Mostrar el error al usuario para debugging
        toast.error('No se pudo registrar el evento en el historial: ' + errorHistorial.message);
      }
      
      // ✅ Limpiar cambios pendientes del cliente si los había
      if (cambiosClienteDetectados) {
        setCambiosClientePendientes(null); // Limpiar
      }
      
      // 🆕 Si fue renovación, actualizar expediente anterior a "Renovada"
      if (expedienteAnteriorParaRenovacion && !modoEdicion) {
        try {
          console.log('🔄 Actualizando expediente anterior a Renovada:', expedienteAnteriorParaRenovacion.id);
          
          // Actualizar etapa del expediente anterior
          await fetch(`${API_URL}/api/expedientes/${expedienteAnteriorParaRenovacion.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              etapa_activa: 'Renovada',
              renovada_por: resultado.data?.id || resultado.id
            })
          });
          
          // Registrar evento en historial del expediente anterior
          await historialService.registrarEvento({
            expediente_id: expedienteAnteriorParaRenovacion.id,
            cliente_id: expedienteAnteriorParaRenovacion.cliente_id,
            tipo_evento: 'POLIZA_RENOVADA',
            usuario_nombre: 'Sistema',
            descripcion: `Póliza renovada - Nueva póliza: ${datos.numero_poliza || 'N/A'}`,
            datos_adicionales: {
              poliza_anterior: expedienteAnteriorParaRenovacion.numero_poliza,
              aseguradora_anterior: expedienteAnteriorParaRenovacion.compania,
              poliza_nueva: datos.numero_poliza,
              aseguradora_nueva: datos.compania,
              expediente_nuevo_id: resultado.data?.id || resultado.id
            }
          });
          
          // Limpiar estado de expediente anterior
          setExpedienteAnteriorParaRenovacion(null);
          
          toast.success('✅ Renovación completada - Expediente anterior marcado como Renovada');
        } catch (errorRenovacion) {
          console.error('⚠️ Error al actualizar expediente anterior:', errorRenovacion);
          toast.error('Expediente creado pero hubo error al marcar anterior como renovada');
        }
      }
      
      // Recargar lista de expedientes desde backend para asegurar sincronización
      await recargarExpedientes();
      
      toast.success(`✅ Expediente ${modoEdicion ? 'actualizado' : 'creado'} correctamente`);
      limpiarFormulario();
      
      // Si vino del Dashboard, regresar allá
      if (origenNavegacion === 'dashboard') {
        setOrigenNavegacion(null); // Limpiar origen
        navigate('/');
      } else {
        setVistaActual('lista');
      }
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setGuardando(false);
    }
  }, [formulario, modoEdicion, validarFormulario, limpiarFormulario, clienteSeleccionado]);

  const abrirNuevoExpediente = useCallback(() => {
    limpiarFormulario();
    setModoEdicion(false);
    setVistaActual('formulario');
  }, [limpiarFormulario]);

  const editarExpediente = useCallback(async (expediente) => {
    try {
      console.log('🔍 Editando expediente:', expediente.id);
      const response = await fetch(`${API_URL}/api/expedientes/${expediente.id}`);
      if (!response.ok) throw new Error('Error al cargar expediente');
      
      const data = await response.json();
      const expedienteCompleto = data?.data ?? data;
      
      console.log('📦 Expediente completo desde backend:', expedienteCompleto);

      // 🔧 FIX: Consultar cliente FRESH desde la API para datos actualizados
      let clienteEncontrado = null;
      if (expedienteCompleto.cliente_id) {
        try {
          console.log('🔍 Consultando cliente fresh desde API:', expedienteCompleto.cliente_id);
          const clienteResponse = await fetch(`${API_URL}/api/clientes/${expedienteCompleto.cliente_id}`);
          if (clienteResponse.ok) {
            const clienteData = await clienteResponse.json();
            clienteEncontrado = clienteData?.data ?? clienteData;
            console.log('✅ Cliente fresh obtenido:', clienteEncontrado);
            
            // Actualizar el clientesMap para futuras consultas
            setClientesMap(prevMap => ({
              ...prevMap,
              [expedienteCompleto.cliente_id]: clienteEncontrado
            }));
          } else {
            console.warn('⚠️ No se pudo obtener cliente fresh, usando cache');
            clienteEncontrado = clientesMap[expedienteCompleto.cliente_id];
          }
        } catch (error) {
          console.warn('⚠️ Error al obtener cliente fresh, usando cache:', error);
          clienteEncontrado = clientesMap[expedienteCompleto.cliente_id];
        }
        
        console.log('👤 Cliente final para edición:', clienteEncontrado);
      }

      // 🔧 PROCESAR DATOS PARA EL FORMULARIO
      // Función helper para convertir fechas ISO a formato yyyy-MM-dd
      const formatearFecha = (fecha) => {
        if (!fecha) return '';
        if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          return fecha;
        }
        if (typeof fecha === 'string' && fecha.includes('T')) {
          return fecha.split('T')[0];
        }
        return fecha;
      };

      // Parsear coberturas si vienen como string JSON
      let coberturasParseadas = [];
      if (expedienteCompleto.coberturas) {
        if (typeof expedienteCompleto.coberturas === 'string') {
          try {
            coberturasParseadas = JSON.parse(expedienteCompleto.coberturas);
          } catch (e) {
            console.warn('⚠️ Error al parsear coberturas:', e);
            coberturasParseadas = [];
          }
        } else if (Array.isArray(expedienteCompleto.coberturas)) {
          coberturasParseadas = expedienteCompleto.coberturas;
        }
      }

      // Parsear recibos si vienen como string JSON Y formatear fechas dentro
      let recibosParseados = [];
      if (expedienteCompleto.recibos) {
        if (typeof expedienteCompleto.recibos === 'string') {
          try {
            recibosParseados = JSON.parse(expedienteCompleto.recibos);
          } catch (e) {
            console.warn('⚠️ Error al parsear recibos:', e);
            recibosParseados = [];
          }
        } else if (Array.isArray(expedienteCompleto.recibos)) {
          recibosParseados = expedienteCompleto.recibos;
        }
        
        // Formatear fechas dentro de cada recibo
        recibosParseados = recibosParseados.map(recibo => ({
          ...recibo,
          fecha_vencimiento: formatearFecha(recibo.fecha_vencimiento),
          fecha_pago_real: formatearFecha(recibo.fecha_pago_real)
        }));
      }

      // Normalizar tipo_pago y frecuenciaPago (pueden venir con diferentes nombres del backend)
      const tipoPagoNormalizado = expedienteCompleto.tipo_pago || expedienteCompleto.tipoPago || 'Anual';
      const frecuenciaPagoNormalizada = expedienteCompleto.frecuenciaPago || 
                                        expedienteCompleto.frecuencia_pago || 
                                        expedienteCompleto.frecuencia ||
                                        (tipoPagoNormalizado === 'Anual' ? 'Anual' : '');

      // 🔧 FIX SIMPLE: Calcular fecha_vencimiento_pago = inicio + periodo_gracia
      let fechaVencimientoPago = '';
      if (expedienteCompleto.inicio_vigencia && expedienteCompleto.periodo_gracia) {
        const fechaInicio = new Date(expedienteCompleto.inicio_vigencia);
        fechaInicio.setDate(fechaInicio.getDate() + parseInt(expedienteCompleto.periodo_gracia));
        fechaVencimientoPago = fechaInicio.toISOString().split('T')[0];

      } else {
        fechaVencimientoPago = expedienteCompleto.fecha_vencimiento_pago || expedienteCompleto.proximoPago;
      }

      const datosFormulario = {
        ...expedienteCompleto,
        // Formatear todas las fechas
        fecha_emision: formatearFecha(expedienteCompleto.fecha_emision),
        fecha_captura: formatearFecha(expedienteCompleto.fecha_captura),
        inicio_vigencia: formatearFecha(expedienteCompleto.inicio_vigencia),
        termino_vigencia: formatearFecha(expedienteCompleto.termino_vigencia),
        fecha_aviso_renovacion: formatearFecha(expedienteCompleto.fecha_aviso_renovacion),
        fecha_vencimiento_pago: formatearFecha(fechaVencimientoPago),
        proximoPago: formatearFecha(expedienteCompleto.proximoPago || fechaVencimientoPago),
        fecha_pago: formatearFecha(expedienteCompleto.fecha_pago),
        fecha_ultimo_pago: formatearFecha(expedienteCompleto.fecha_ultimo_pago),
        // Normalizar estatus
        estatusPago: expedienteCompleto.estatusPago || expedienteCompleto.estatus_pago || 'Pendiente',
        estatus_pago: expedienteCompleto.estatus_pago || expedienteCompleto.estatusPago || 'Pendiente',
        // Normalizar tipo_pago y frecuenciaPago
        tipo_pago: tipoPagoNormalizado,
        frecuenciaPago: frecuenciaPagoNormalizada,
        // Arrays parseados
        coberturas: coberturasParseadas,
        recibos: recibosParseados,
        // Asegurar valores por defecto para campos numéricos
        periodo_gracia: expedienteCompleto.periodo_gracia ?? 14,
        // Asegurar strings vacíos en lugar de null para campos de texto
        numero_poliza: expedienteCompleto.numero_poliza || '',
        numero_endoso: expedienteCompleto.numero_endoso || '',
        agente: expedienteCompleto.agente || '',
        sub_agente: expedienteCompleto.sub_agente || '',
        // Campos de vehículo
        marca: expedienteCompleto.marca || '',
        modelo: expedienteCompleto.modelo || '',
        anio: expedienteCompleto.anio || '',
        placas: expedienteCompleto.placas || '',
        numero_serie: expedienteCompleto.numero_serie || '',
        color: expedienteCompleto.color || '',
        tipo_vehiculo: expedienteCompleto.tipo_vehiculo || '',
        tipo_cobertura: expedienteCompleto.tipo_cobertura || '',
        suma_asegurada: expedienteCompleto.suma_asegurada || '',
        conductor_habitual: expedienteCompleto.conductor_habitual || '',
        edad_conductor: expedienteCompleto.edad_conductor || '',
        licencia_conducir: expedienteCompleto.licencia_conducir || ''
      };


      console.log('📅 Recibos parseados:', recibosParseados);
      console.log('💰 Tipo de pago:', datosFormulario.tipo_pago, '| Frecuencia:', datosFormulario.frecuenciaPago);

      // 🔧 FIX: Poplar datos del cliente en formulario
      setFormulario(datosFormulario);
      setClienteSeleccionado(clienteEncontrado);
      
      // 🔧 CRÍTICO: Poplar campos del cliente en el formulario cuando se edita
      if (clienteEncontrado) {
        const datosClienteParaFormulario = {
          // Datos básicos del cliente
          nombre: clienteEncontrado.nombre || '',
          apellido_paterno: clienteEncontrado.apellidoPaterno || clienteEncontrado.apellido_paterno || '',
          apellido_materno: clienteEncontrado.apellidoMaterno || clienteEncontrado.apellido_materno || '',
          razon_social: clienteEncontrado.razonSocial || clienteEncontrado.razon_social || '',
          nombre_comercial: clienteEncontrado.nombreComercial || clienteEncontrado.nombre_comercial || '',
          rfc: clienteEncontrado.rfc || '',
          email: clienteEncontrado.email || '',
          telefono_fijo: clienteEncontrado.telefonoFijo || clienteEncontrado.telefono_fijo || '',
          telefono_movil: clienteEncontrado.telefonoMovil || clienteEncontrado.telefono_movil || '',
          // Datos del gestor/contacto adicional
          contacto_nombre: clienteEncontrado.contacto_nombre || clienteEncontrado.contactoNombre || '',
          contacto_apellido_paterno: clienteEncontrado.contacto_apellido_paterno || clienteEncontrado.contactoApellidoPaterno || '',
          contacto_apellido_materno: clienteEncontrado.contacto_apellido_materno || clienteEncontrado.contactoApellidoMaterno || '',
          contacto_email: clienteEncontrado.contacto_email || clienteEncontrado.contactoEmail || '',
          contacto_telefono_fijo: clienteEncontrado.contacto_telefono_fijo || clienteEncontrado.contactoTelefonoFijo || '',
          contacto_telefono_movil: clienteEncontrado.contacto_telefono_movil || clienteEncontrado.contactoTelefonoMovil || ''
        };
        
        setFormulario(prev => ({ ...prev, ...datosClienteParaFormulario }));
      }
      
      setModoEdicion(true);
      setVistaActual('formulario');
      
    } catch (error) {
      console.error('Error al editar expediente:', error);
      toast.error('Error al cargar expediente');
    }
  }, [clientesMap]);

  const eliminarExpediente = useCallback(async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este expediente?')) return;

    try {
      const response = await fetch(`${API_URL}/api/expedientes/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar');

      toast.success('Expediente eliminado correctamente');
      await recargarExpedientes();
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar expediente');
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

  // 🆕 Detectar parámetro ?accion=xxx desde Dashboard u otra pantalla
  // NOTA: Este useEffect debe estar DESPUÉS de las declaraciones de abrirModalCompartir, abrirModalAplicarPago y verDetalles
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accion = params.get('accion');
    const id = params.get('id');
    
    if (!accion) return;
    
    console.log('📋 Acción detectada desde URL:', accion, 'ID:', id);
    
    // Guardar origen para saber a dónde regresar después
    const origen = params.get('origen') || 'dashboard';
    setOrigenNavegacion(origen);
    
    if (accion === 'nueva') {
      console.log('📋 Abriendo formulario de nueva póliza desde navegación');
      limpiarFormulario();
      setModoEdicion(false);
      setVistaActual('formulario');
      // Limpiar el parámetro de la URL sin recargar
      navigate('/polizas', { replace: true });
    } else if (id) {
      // Si hay ID, necesitamos esperar a que los expedientes estén cargados
      if (expedientes.length === 0) {
        console.log('⏳ Esperando a que carguen los expedientes...');
        return; // Salir y esperar a que el useEffect se vuelva a ejecutar cuando carguen
      }
      
      // Buscar el expediente por ID
      const expediente = expedientes.find(e => String(e.id) === String(id));
      
      if (expediente) {
        switch (accion) {
          case 'compartir':
            console.log('📤 Abriendo modal de compartir para expediente:', id);
            abrirModalCompartir(expediente);
            break;
          case 'pago':
            console.log('💰 Abriendo modal de pago para expediente:', id);
            abrirModalAplicarPago(expediente.id);
            break;
          case 'ver':
            console.log('👁️ Abriendo vista de detalles para expediente:', id);
            verDetalles(expediente);
            break;
          default:
            console.warn('⚠️ Acción no reconocida:', accion);
        }
        // Limpiar el parámetro de la URL DESPUÉS de ejecutar la acción
        navigate('/polizas', { replace: true });
      } else {
        console.warn('⚠️ Expediente no encontrado con ID:', id);
        toast.error('Póliza no encontrada');
        navigate('/polizas', { replace: true });
      }
    }
  }, [location.search, navigate, expedientes, abrirModalCompartir, abrirModalAplicarPago, verDetalles, limpiarFormulario]);

  const handleClienteSeleccionado = useCallback(async (cliente) => {
    if (!cliente) {
      setClienteSeleccionado(null);
      setFormulario(prev => ({
        ...prev,
        cliente_id: null,
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        razon_social: '',
        nombre_comercial: '',
        rfc: '',
        email: '',
        telefono_fijo: '',
        telefono_movil: '',
        // 🔧 LIMPIAR CAMPOS DE CONTACTO ADICIONAL/GESTOR:
        contacto_nombre: '',
        contacto_apellido_paterno: '',
        contacto_apellido_materno: '',
        contacto_email: '',
        contacto_telefono_fijo: '',
        contacto_telefono_movil: ''
      }));
      return;
    }

    setClienteSeleccionado(cliente);
    
    const datosCliente = {
      cliente_id: cliente.id,
      nombre: cliente.nombre || '',
      apellido_paterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
      apellido_materno: cliente.apellidoMaterno || cliente.apellido_materno || '',
      razon_social: cliente.razonSocial || cliente.razon_social || '',
      nombre_comercial: cliente.nombreComercial || cliente.nombre_comercial || '',
      rfc: cliente.rfc || '',
      email: cliente.email || '',
      telefono_fijo: cliente.telefonoFijo || cliente.telefono_fijo || '',
      telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || '',
      // 🔧 CAMPOS DE CONTACTO ADICIONAL/GESTOR (igual que el expedientes viejo):
      contacto_nombre: cliente.contacto_nombre || cliente.contactoNombre || '',
      contacto_apellido_paterno: cliente.contacto_apellido_paterno || cliente.contactoApellidoPaterno || '',
      contacto_apellido_materno: cliente.contacto_apellido_materno || cliente.contactoApellidoMaterno || '',
      contacto_email: cliente.contacto_email || cliente.contactoEmail || '',
      contacto_telefono_fijo: cliente.contacto_telefono_fijo || cliente.contactoTelefonoFijo || '',
      contacto_telefono_movil: cliente.contacto_telefono_movil || cliente.contactoTelefonoMovil || ''
    };
    
    setFormulario(prev => ({ ...prev, ...datosCliente }));

    // 📝 LOGGING: Registro de cliente seleccionado
    if (formulario.id) { // Solo si estamos en modo edición
      try {
        // Construir nombre completo del cliente
        let nombreCliente = '';
        if (cliente.razonSocial || cliente.razon_social) {
          nombreCliente = cliente.razonSocial || cliente.razon_social;
        } else {
          const partes = [
            cliente.nombre,
            cliente.apellidoPaterno || cliente.apellido_paterno,
            cliente.apellidoMaterno || cliente.apellido_materno
          ].filter(Boolean);
          nombreCliente = partes.join(' ') || 'Sin nombre';
        }

        await historialService.registrarEvento({
          expediente_id: formulario.id,
          cliente_id: cliente.id,
          tipo_evento: 'cliente_seleccionado',
          usuario_nombre: 'Usuario',
          descripcion: `Cliente seleccionado | ${cliente.tipoPersona || 'Tipo no definido'} | ${nombreCliente} | RFC: ${cliente.rfc}`,
          datos_adicionales: {
            cliente_id: cliente.id,
            nombre_cliente: nombreCliente,
            rfc: cliente.rfc,
            tipo_persona: cliente.tipoPersona || 'No definido',
            email: cliente.email || 'No definido',
            telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || 'No definido',
            fecha_seleccion: new Date().toISOString(),
            accion: 'Datos del cliente cargados en formulario'
          }
        });

      } catch (errorHistorial) {
        console.error('⚠️ Error al registrar cliente seleccionado en historial:', errorHistorial);
      }
    }
  }, [formulario.id]);

  // ==================== FUNCIONES DE CÁLCULO ====================
  
  /**
   * Calcula el término de vigencia (mismo día, 1 año después)
   */
  const calculartermino_vigencia = useCallback((inicioVigencia) => {
    if (!inicioVigencia) return '';
    
    const fecha = new Date(inicioVigencia);
    fecha.setFullYear(fecha.getFullYear() + 1); // Sumar 1 año exacto
    return fecha.toISOString().split('T')[0];
  }, []);

  /**
   * Calcula el próximo pago según tipo de pago y frecuencia
   */
  const calcularProximoPago = useCallback((inicioVigencia, tipoPago, frecuencia, compania, numeroPago = 1, periodoGracia = 0) => {
    if (!inicioVigencia) return '';
    
    // Crear fecha en hora local para evitar problemas de timezone
    const [year, month, day] = inicioVigencia.split('-');
    const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // REGLA SIMPLE: Primer recibo = inicio + periodo_gracia, Subsecuentes = inicio + N meses (SIN gracia)
    
    // Para pago único/anual: inicio + periodo de gracia
    if (tipoPago === 'Anual' || tipoPago === 'Pago Único') {
      fecha.setDate(fecha.getDate() + periodoGracia);
      return fecha.toISOString().split('T')[0];
    }
    
    // Para fraccionado: calcular según frecuencia
    if (tipoPago === 'Fraccionado' && frecuencia) {
      const mesesPorPago = {
        'Mensual': 1,
        'Bimestral': 2,
        'Trimestral': 3,
        'Semestral': 6,
        'Anual': 12
      };
      
      const meses = mesesPorPago[frecuencia] || 1;
      
      // Calcular fecha base según número de pago
      if (numeroPago === 1) {
        // PRIMER RECIBO: inicio_vigencia + periodo_gracia
        fecha.setDate(fecha.getDate() + periodoGracia);
      } else {
        // RECIBOS SUBSECUENTES: inicio_vigencia + (N-1) * meses (SIN periodo de gracia)
        fecha.setMonth(fecha.getMonth() + (meses * (numeroPago - 1)));
      }
      
      return fecha.toISOString().split('T')[0];
    }
    
    return '';
  }, []);

  /**
   * Actualiza todos los cálculos automáticos del formulario
   */
  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    // 1. Calcular término de vigencia (mismo día, 1 año después)
    const termino_vigencia = calculartermino_vigencia(formularioActual.inicio_vigencia);
    
    // 2. Calcular fecha de aviso de renovación (término - 30 días)
    let fecha_aviso_renovacion = '';
    if (termino_vigencia) {
      const fechaTermino = new Date(termino_vigencia);
      fechaTermino.setDate(fechaTermino.getDate() - 30);
      fecha_aviso_renovacion = fechaTermino.toISOString().split('T')[0];
    }
    
    // 3. 🔧 FIX SIMPLE: Fecha límite = inicio_vigencia + periodo_gracia
    let fechaLimitePago = '';
    if (formularioActual.inicio_vigencia) {
      const periodoGracia = parseInt(formularioActual.periodo_gracia) || 0;
      const fechaInicio = new Date(formularioActual.inicio_vigencia);
      fechaInicio.setDate(fechaInicio.getDate() + periodoGracia);
      fechaLimitePago = fechaInicio.toISOString().split('T')[0];

    }
    
    // 4. Calcular estatus de pago basado en la fecha límite
    let estatusPago = formularioActual.estatusPago || 'Pendiente';
    if (fechaLimitePago && estatusPago !== 'Pagado') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaLimite = new Date(fechaLimitePago);
      fechaLimite.setHours(0, 0, 0, 0);
      
      const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) {
        estatusPago = 'Vencido';
      } else if (diasRestantes <= 15) {
        estatusPago = 'Por Vencer';
      } else {
        estatusPago = 'Pendiente';
      }
    }
    
    // 5. Mantener recibos actuales (ya vienen recalculados del frontend)
    let recibosActualizados = formularioActual.recibos;
    
    // Retornar formulario actualizado
    const resultado = {
      ...formularioActual,
      termino_vigencia,
      fecha_aviso_renovacion,
      proximoPago: fechaLimitePago,
      fecha_vencimiento_pago: fechaLimitePago,
      estatusPago,
      recibos: recibosActualizados
    };
    
    // Limpiar banderas temporales
    delete resultado._inicio_vigencia_changed;
    delete resultado._periodo_gracia_changed;
    delete resultado._frecuencia_pago_changed;
    delete resultado._tipo_pago_changed;
    delete resultado._total_changed;
    delete resultado._primer_pago_changed;
    delete resultado._pagos_subsecuentes_changed;
    
    return resultado;
  }, [calculartermino_vigencia]);

  return (
    <div className="container-fluid py-3">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Gestión de Pólizas</h2>
        {vistaActual === 'lista' && (
          <button 
            className="btn btn-primary"
            onClick={abrirNuevoExpediente}
          >
            <Plus size={20} className="me-2" />
            Agregar Póliza
          </button>
        )}
      </div>

      {/* VISTA LISTA */}
      {vistaActual === 'lista' && (
        <ListaExpedientes
          expedientes={expedientes}
          agentes={agentes}
          clientesMap={clientesMap}
          editarExpediente={editarExpediente}
          eliminarExpediente={eliminarExpediente}
          verDetalles={verDetalles}
          aplicarPago={abrirModalAplicarPago}
          abrirModalCompartir={abrirModalCompartir}
          limpiarFormulario={limpiarFormulario}
          setVistaActual={setVistaActual}
          setModoEdicion={setModoEdicion}
          calcularProximoPago={calcularProximoPago}
          // ❌ Función de cancelación
          iniciarCancelacion={iniciarCancelacion}
          // 🔄 Funciones de renovación (Flujo 1: Cotización)
          iniciarRenovacion={abrirModalOpcionesRenovacion}
          cargarCotizacion={abrirModalCargarCotizacion}
          enviarCotizacionCliente={enviarCotizacionCliente}
          marcarRenovacionAutorizada={marcarRenovacionAutorizada}
          abrirModalPolizaRenovada={abrirModalPolizaRenovada}
        />
      )}

      {/* VISTA FORMULARIO: Modo AGREGAR */}
      {vistaActual === 'formulario' && !modoEdicion && (
        <FormularioNuevoExpediente
          setVistaActual={setVistaActual}
          formulario={formulario}
          setFormulario={setFormulario}
          actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
          guardarExpediente={guardarExpediente}
          // 🆕 Expediente anterior para renovación (si aplica)
          expedienteAnterior={expedienteAnteriorParaRenovacion}
          limpiarExpedienteAnterior={() => setExpedienteAnteriorParaRenovacion(null)}
          companias={['HDI', 'Qualitas', 'GNP', 'AXA', 'Zurich']}
          productos={tiposProductos.map(p => p.nombre || p)}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
          etapasActivas={['Emitida', 'Enviada al Cliente', 'Pagada', 'Por Renovar', 'Renovación Emitida', 'Renovación Enviada', 'Renovación Pagada', 'Cancelada']}
          agentes={agentes}
          tiposPago={['Anual', 'Fraccionado', 'Pago Único']}
          frecuenciasPago={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']}
          periodosGracia={[0, 7, 14, 30]}
          estatusPago={['Pendiente', 'Por Vencer', 'Vencido', 'Pagado']}
          marcasVehiculo={['Nissan', 'Volkswagen', 'Chevrolet', 'Toyota', 'Honda', 'Mazda', 'Ford']}
          tiposVehiculo={['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Van']}
          tiposCobertura={['Amplia', 'Limitada', 'RC', 'Integral']}
          calculartermino_vigencia={calculartermino_vigencia}
          calcularProximoPago={calcularProximoPago}
          handleClienteSeleccionado={handleClienteSeleccionado}
          clienteSeleccionado={clienteSeleccionado}
          onEliminarPago={abrirModalEliminarPago}
        />
      )}

      {/* VISTA FORMULARIO: Modo EDITAR */}
      {vistaActual === 'formulario' && modoEdicion && (
        <FormularioEditarExpediente
          setVistaActual={setVistaActual}
          formulario={formulario}
          setFormulario={setFormulario}
          actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
          guardarExpediente={guardarExpediente}
          companias={['HDI', 'Qualitas', 'GNP', 'AXA', 'Zurich']}
          productos={tiposProductos.map(p => p.nombre || p)}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
          etapasActivas={['Emitida', 'Enviada al Cliente', 'Pagada', 'Por Renovar', 'Renovación Emitida', 'Renovación Enviada', 'Renovación Pagada', 'Cancelada']}
          agentes={agentes}
          tiposPago={['Anual', 'Fraccionado', 'Pago Único']}
          frecuenciasPago={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']}
          periodosGracia={[0, 7, 14, 30]}
          estatusPago={['Pendiente', 'Por Vencer', 'Vencido', 'Pagado']}
          marcasVehiculo={['Nissan', 'Volkswagen', 'Chevrolet', 'Toyota', 'Honda', 'Mazda', 'Ford']}
          tiposVehiculo={['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Van']}
          tiposCobertura={['Amplia', 'Limitada', 'RC', 'Integral']}
          calculartermino_vigencia={calculartermino_vigencia}
          calcularProximoPago={calcularProximoPago}
          handleClienteSeleccionado={handleClienteSeleccionado}
          clienteSeleccionado={clienteSeleccionado}
          onEliminarPago={abrirModalEliminarPago}
        />
      )}

      {/* VISTA DETALLES */}
      {vistaActual === 'detalles' && expedienteSeleccionado && (
        <DetallesExpediente 
          expedienteSeleccionado={expedienteSeleccionado}
          setExpedienteSeleccionado={setExpedienteSeleccionado}
          setVistaActual={setVistaActual}
          aplicarPago={abrirModalAplicarPago}
          cargarExpedientes={recargarExpedientes}
          editarExpediente={editarExpediente}
          calculartermino_vigencia={calculartermino_vigencia}
          calcularProximoPago={calcularProximoPago}
          abrirModalCompartir={abrirModalCompartir}
          enviarAvisoPago={(pago, expediente) => abrirModalCompartir(expediente, 'pago')}
          onEliminarPago={abrirModalEliminarPago}
          historial={historialExpediente}
          setHistorialExpediente={setHistorialExpediente}
        />
      )}

      {/* MODALES */}
      
      {/* Modal Eliminar Pago */}
      {mostrarModalEliminarPago && pagoParaEliminar && expedienteParaEliminarPago && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white py-2 px-3">
                <h6 className="modal-title mb-0" style={{ fontSize: '0.95rem' }}>
                  <Trash2 size={18} className="me-2" />
                  Eliminar Pago
                </h6>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalEliminarPago(false);
                    setPagoParaEliminar(null);
                    setExpedienteParaEliminarPago(null);
                    setMotivoEliminacion('');
                  }}
                  disabled={eliminandoPago}
                ></button>
              </div>
              
              <div className="modal-body py-3 px-3">
                <div className="alert alert-warning mb-3 py-2">
                  <strong>⚠️ Atención:</strong> Esta acción eliminará el pago registrado y recalculará el calendario de pagos.
                </div>
                
                {/* Información del pago */}
                <div className="card mb-3">
                  <div className="card-body py-2 px-3">
                    <div className="row">
                      <div className="col-6">
                        <small className="text-muted d-block">Recibo</small>
                        <strong>#{pagoParaEliminar.numero}</strong>
                      </div>
                      <div className="col-6">
                        <small className="text-muted d-block">Monto</small>
                        <strong className="text-success">${pagoParaEliminar.monto}</strong>
                      </div>
                    </div>
                    <div className="row mt-2">
                      <div className="col-6">
                        <small className="text-muted d-block">Fecha de Pago</small>
                        <span>{pagoParaEliminar.fecha}</span>
                      </div>
                      <div className="col-6">
                        <small className="text-muted d-block">Póliza</small>
                        <span>{expedienteParaEliminarPago.numero_poliza || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Campo de motivo */}
                <div className="mb-0">
                  <label className="form-label mb-1" style={{ fontSize: '0.85rem' }}>
                    <strong>Motivo de la eliminación:</strong>
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Ej: Pago duplicado, error de captura, pago no válido..."
                    value={motivoEliminacion}
                    onChange={(e) => setMotivoEliminacion(e.target.value)}
                    disabled={eliminandoPago}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>
              
              <div className="modal-footer py-2 px-3">
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setMostrarModalEliminarPago(false);
                    setPagoParaEliminar(null);
                    setExpedienteParaEliminarPago(null);
                    setMotivoEliminacion('');
                  }}
                  disabled={eliminandoPago}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger btn-sm"
                  onClick={confirmarEliminarPago}
                  disabled={eliminandoPago}
                >
                  {eliminandoPago ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} className="me-1" />
                      Confirmar Eliminación
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* � Modal de Captura de Contacto Faltante */}
      <ModalCapturarContacto
        show={mostrarModalContacto}
        onClose={() => {
          setMostrarModalContacto(false);
          setClienteParaActualizar(null);
          setDestinatarioParaModal(null);
          setTipoDatoFaltante(null);
          setCanalEnvio(null);
          setExpedienteEnEspera(null);
        }}
        onGuardar={handleGuardarContactoFaltante}
        cliente={clienteParaActualizar}
        destinatario={destinatarioParaModal}
        tipoDatoFaltante={tipoDatoFaltante}
        canalEnvio={canalEnvio}
        onGuardarYContinuar={() => {
          // ✨ NUEVA LÓGICA: Solo guardar y cerrar, sin reintento automático
          // El usuario deberá dar click nuevamente en "Compartir" → ALVARO ya tendrá email
          toast.success('Email guardado. Puedes volver a enviar la póliza.');
          
          // Limpiar estado del modal
          setCanalEnvio(null);
          setExpedienteEnEspera(null);
          setPagoParaNotificar(null);
        }}
      />

      {/* �📤 Modal de Compartir Expediente */}
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

                        <input
                          type="radio"
                          className="btn-check"
                          name="tipoEnvio"
                          id="radioCotizacion"
                          checked={tipoEnvio === 'cotizacion'}
                          onChange={() => setTipoEnvio('cotizacion')}
                        />
                        <label className="btn btn-outline-warning" htmlFor="radioCotizacion">
                          📝 Cotización
                        </label>
                      </div>
                    </div>

                    {/* Selector de pago (solo si tipo es 'pago') */}
                    {tipoEnvio === 'pago' && (
                      <div className="mb-3">
                        <label className="form-label mb-1"><strong>Seleccionar Pago:</strong></label>
                        {expedienteParaCompartir.recibos && expedienteParaCompartir.recibos.length > 0 ? (
                          <>
                            {/* Alerta si todos los recibos están pagados */}
                            {expedienteParaCompartir.recibos.every(r => r.fecha_pago_real) && (
                              <div className="alert alert-success py-2 px-3 mb-2 d-flex align-items-center" style={{ fontSize: '0.85em' }}>
                                <span className="me-2">✅</span>
                                <span>Todos los pagos están al corriente. Puedes reenviar un comprobante de pago.</span>
                              </div>
                            )}
                            <select
                              className="form-select form-select-sm"
                              value={pagoSeleccionado?.numero_recibo || ''}
                              onChange={(e) => {
                                const pago = expedienteParaCompartir.recibos.find(r => r.numero_recibo === parseInt(e.target.value));
                                setPagoSeleccionado(pago);
                              }}
                            >
                              {expedienteParaCompartir.recibos
                                .map(recibo => {
                                  const hoy = new Date();
                                  hoy.setHours(0, 0, 0, 0);
                                  const fechaVenc = new Date(recibo.fecha_vencimiento);
                                  fechaVenc.setHours(0, 0, 0, 0);
                                  const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
                                  
                                  let estadoReal;
                                  let iconoEstado;
                                  if (recibo.fecha_pago_real) {
                                    estadoReal = 'Pagado';
                                    iconoEstado = ' ✅';
                                  } else if (diasRestantes < 0) {
                                    estadoReal = 'Vencido';
                                    iconoEstado = ' 🚨';
                                  } else if (diasRestantes <= 7) {
                                    estadoReal = 'Por Vencer';
                                    iconoEstado = ' ⏰';
                                  } else {
                                    estadoReal = 'Pendiente';
                                    iconoEstado = ' ⏳';
                                  }
                                  
                                  return (
                                    <option key={recibo.numero_recibo} value={recibo.numero_recibo}>
                                      Pago #{recibo.numero_recibo} - Vence {utils.formatearFecha(recibo.fecha_vencimiento)} - ${utils.formatearMoneda(recibo.monto)} - {estadoReal}{iconoEstado}
                                    </option>
                                  );
                                })}
                            </select>
                            <small className="text-muted d-block mt-1">
                              {expedienteParaCompartir.recibos.some(r => !r.fecha_pago_real)
                                ? 'Se muestran todos los pagos. Los pendientes/vencidos aparecen primero.'
                                : 'Todos los pagos están cubiertos. Selecciona uno para reenviar el comprobante.'}
                            </small>
                          </>
                        ) : (
                          <div className="alert alert-warning py-2 px-3 mb-0 d-flex align-items-center" style={{ fontSize: '0.85em' }}>
                            <span className="me-2">⚠️</span>
                            <span>Esta póliza no tiene recibos de pago registrados.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selector de cotización (solo si tipo es 'cotizacion') */}
                    {tipoEnvio === 'cotizacion' && (
                      <div className="mb-3">
                        <label className="form-label mb-1"><strong>Seleccionar Cotización:</strong></label>
                        {cargandoCotizaciones ? (
                          <div className="text-center py-2">
                            <div className="spinner-border spinner-border-sm text-warning" role="status">
                              <span className="visually-hidden">Cargando...</span>
                            </div>
                            <small className="ms-2 text-muted">Cargando cotizaciones...</small>
                          </div>
                        ) : cotizacionesExpediente.length > 0 ? (
                          <>
                            <select
                              className="form-select form-select-sm"
                              value={cotizacionSeleccionada?.id || ''}
                              onChange={(e) => {
                                const cot = cotizacionesExpediente.find(c => c.id === e.target.value || c.id === parseInt(e.target.value));
                                setCotizacionSeleccionada(cot);
                              }}
                            >
                              {cotizacionesExpediente.map((cot, idx) => (
                                <option key={cot.id || idx} value={cot.id}>
                                  📄 {cot.filename || cot.nombre || `Cotización ${idx + 1}`} 
                                  {cot.uploadedAt ? ` - ${new Date(cot.uploadedAt).toLocaleDateString('es-MX')}` : ''}
                                </option>
                              ))}
                            </select>
                            <small className="text-muted d-block mt-1">
                              Se enviará el link de descarga en el mensaje
                            </small>
                          </>
                        ) : (
                          <div className="alert alert-warning py-2 px-3 mb-0" style={{ fontSize: '0.8rem' }}>
                            <strong>⚠️ Sin cotizaciones</strong>
                            <p className="mb-0 mt-1">No hay cotizaciones cargadas. Puedes enviar el mensaje sin link de descarga o cargar una cotización primero.</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Mostrar select si hay múltiples destinatarios, o solo el nombre si hay uno */}
                    {destinatariosCompartir.length > 1 ? (
                      <div className="mb-3">
                        <label className="form-label mb-1"><strong>Enviar a:</strong></label>
                        <select 
                          className="form-select form-select-sm"
                          value={destinatarioCompartirSeleccionado?.id || (destinatariosCompartir?.[0]?.id || '')}
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
                    onClick={async () => {
                      if (tipoEnvio === 'pago') {
                        if (!pagoSeleccionado) {
                          toast.error('Selecciona un recibo de pago antes de enviar');
                          return;
                        }
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null,
                          recibo_pago_url: pagoSeleccionado.recibo_pago_url || null
                        };
                        await enviarAvisoPagoWhatsApp(pagoTransformado, expedienteParaCompartir);
                      } else if (tipoEnvio === 'cotizacion') {
                        await compartirCotizacionWhatsApp(expedienteParaCompartir);
                      } else {
                        await compartirPorWhatsApp(expedienteParaCompartir);
                      }
                      cerrarModalCompartir();
                    }}
                  >
                    <Share2 size={16} className="me-2" /> WhatsApp
                  </button>
                  <button
                    className="btn btn-info d-flex align-items-center justify-content-center"
                    onClick={async () => {
                      if (tipoEnvio === 'pago') {
                        if (!pagoSeleccionado) {
                          toast.error('Selecciona un recibo de pago antes de enviar');
                          return;
                        }
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null,
                          recibo_pago_url: pagoSeleccionado.recibo_pago_url || null
                        };
                        await enviarAvisoPagoEmail(pagoTransformado, expedienteParaCompartir);
                      } else if (tipoEnvio === 'cotizacion') {
                        await compartirCotizacionEmail(expedienteParaCompartir);
                      } else {
                        await compartirPorEmail(expedienteParaCompartir);
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

      {/* ═══════════════════════════════════════════════════════════════
          MODALES DE RENOVACIÓN
          ═══════════════════════════════════════════════════════════════ */}

      {/* 🆕 Modal: Cargar Archivo de Cotización */}
      {mostrarModalCargarCotizacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <FileText size={20} className="me-2" />
                  Cargar Cotización
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => {
                    setMostrarModalCargarCotizacion(false);
                    setExpedienteParaRenovacion(null);
                    setArchivoCotizacion(null);
                  }}
                  disabled={cargandoCotizacion}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <p className="mb-1"><strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania || 'N/A'}</p>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Archivo de cotización (PDF)</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".pdf,.PDF"
                    onChange={(e) => setArchivoCotizacion(e.target.files[0])}
                    disabled={cargandoCotizacion}
                  />
                  {archivoCotizacion && (
                    <small className="text-success mt-1 d-block">
                      ✓ {archivoCotizacion.name}
                    </small>
                  )}
                </div>
                
                <p className="text-muted small">
                  Al cargar la cotización, el expediente cambiará a etapa <strong>"Cotización Lista"</strong>.
                  Después podrás enviarla al cliente.
                </p>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalCargarCotizacion(false);
                    setExpedienteParaRenovacion(null);
                    setArchivoCotizacion(null);
                  }}
                  disabled={cargandoCotizacion}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={guardarCotizacionArchivo}
                  disabled={!archivoCotizacion || cargandoCotizacion}
                >
                  {cargandoCotizacion ? (
                    <>
                      <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="me-2" />
                      Cargar Cotización
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 Modal 0: Opciones de Renovación (Iniciar Renovación) */}
      {mostrarModalOpcionesRenovacion && expedienteAnteriorParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <RefreshCw size={20} className="me-2" />
                  Iniciar Renovación
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => {
                    setMostrarModalOpcionesRenovacion(false);
                    setExpedienteAnteriorParaRenovacion(null);
                  }}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-info mb-3">
                  <p className="mb-1"><strong>Póliza:</strong> {expedienteAnteriorParaRenovacion.numero_poliza}</p>
                  <p className="mb-1"><strong>Compañía:</strong> {expedienteAnteriorParaRenovacion.compania || 'N/A'}</p>
                  <p className="mb-0"><strong>Vigencia termina:</strong> {expedienteAnteriorParaRenovacion.termino_vigencia ? new Date(expedienteAnteriorParaRenovacion.termino_vigencia).toLocaleDateString('es-MX') : 'N/A'}</p>
                </div>
                
                <p className="text-muted mb-3">
                  Selecciona cómo deseas iniciar el proceso de renovación:
                </p>
                
                <div className="d-grid gap-3">
                  {/* Opción 1: Iniciar Cotización */}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-lg text-start p-3"
                    onClick={seleccionarCargarCotizacion}
                  >
                    <div className="d-flex align-items-center">
                      <FileText size={32} className="me-3 text-primary" />
                      <div>
                        <strong>Iniciar Cotización</strong>
                        <p className="mb-0 small text-muted">
                          Mueve a "En Proceso Renovación" para gestionar cotización
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Opción 2: Cargar Póliza Renovada Directamente */}
                  <button
                    type="button"
                    className="btn btn-outline-success btn-lg text-start p-3"
                    onClick={seleccionarCargarPolizaRenovada}
                  >
                    <div className="d-flex align-items-center">
                      <Upload size={32} className="me-3 text-success" />
                      <div>
                        <strong>Cargar Póliza Renovada</strong>
                        <p className="mb-0 small text-muted">
                          Ya tienes la póliza emitida, crea nuevo expediente para gestión de pagos
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalOpcionesRenovacion(false);
                    setExpedienteAnteriorParaRenovacion(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <p className="mb-1"><strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza}</p>
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

      {/* Modal 2: Marcar como Autorizado (confirmación simple) */}
      {mostrarModalAutorizarRenovacion && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
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
                <div className="alert alert-info mb-3">
                  <p className="mb-1"><strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza}</p>
                  <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania || 'N/A'}</p>
                </div>
                
                <p>¿Confirmas que el cliente <strong>autorizó la renovación</strong> de esta póliza?</p>
                
                <p className="text-muted small">
                  El expediente cambiará a estado <strong>"Pendiente de Emisión - Renovación"</strong> 
                  y podrás proceder a registrar la póliza renovada una vez emitida.
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
                  onClick={confirmarAutorizacion}
                >
                  <CheckCircle size={16} className="me-2" />
                  Sí, Autorizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Agregar Póliza Renovada (formulario completo) */}
      {mostrarModalPolizaRenovada && expedienteParaRenovacion && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <RefreshCw size={20} className="me-2" />
                  Agregar Póliza Renovada
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
                      placeholder="Puede ser el mismo número"
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Prima *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={datosRenovacion.primaNueva}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, primaNueva: e.target.value }))}
                      step="0.01"
                    />
                  </div>
                  
                  <div className="col-md-3">
                    <label className="form-label">Total *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={datosRenovacion.totalNuevo}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, totalNuevo: e.target.value }))}
                      step="0.01"
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
                        // Auto-calcular término (1 año después)
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
                  </div>
                  
                  <div className="col-12">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={datosRenovacion.observaciones}
                      onChange={(e) => setDatosRenovacion(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Notas adicionales sobre la renovación..."
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
                  Registrar Renovación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuloNvoExpedientes;

/**
 * ====================================================================
 * MÓDULO: GESTIÓN DE EXPEDIENTES (VERSIÓN CON FORMULARIOS SEPARADOS)
 * ====================================================================
 * Versión con formularios separados:
 * - FormularioNuevoExpediente: Para agregar desde PDF (sin snapshot)
 * - FormularioEditarExpediente: Para editar (con snapshot para logs)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, Mail, DollarSign, Calendar, Upload, CheckCircle, X, AlertCircle, Loader, FileText, RefreshCw } from 'lucide-react';
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
  // Estados
  const [vistaActual, setVistaActual] = useState('lista'); // 'lista', 'formulario', 'detalles'
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
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
  const [tipoEnvio, setTipoEnvio] = useState('poliza'); // 'poliza' o 'pago'
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);

  // 📞 Estados para Modal de Captura de Contacto (teléfono/email faltante)
  const [mostrarModalContacto, setMostrarModalContacto] = useState(false);
  const [clienteParaActualizar, setClienteParaActualizar] = useState(null);
  const [tipoDatoFaltante, setTipoDatoFaltante] = useState(''); // 'telefono_movil' o 'email'
  const [canalEnvio, setCanalEnvio] = useState(''); // 'WhatsApp' o 'Email'
  const [expedienteEnEspera, setExpedienteEnEspera] = useState(null);
  const [pagoParaNotificar, setPagoParaNotificar] = useState(null);

  // 📧 Estados para Modal de Aviso de Pago
  const [mostrarModalAvisoPago, setMostrarModalAvisoPago] = useState(false);
  const [expedienteDelPago, setExpedienteDelPago] = useState(null);
  const [destinatariosDisponibles, setDestinatariosDisponibles] = useState([]);
  const [destinatarioSeleccionado, setDestinatarioSeleccionado] = useState(null);

  // 🔄 Estados para flujo de renovación
  const [mostrarModalCotizarRenovacion, setMostrarModalCotizarRenovacion] = useState(false);
  const [mostrarModalAutorizarRenovacion, setMostrarModalAutorizarRenovacion] = useState(false);
  const [mostrarModalPolizaRenovada, setMostrarModalPolizaRenovada] = useState(false);
  const [expedienteParaRenovacion, setExpedienteParaRenovacion] = useState(null);

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
          case 'Enviada al Cliente':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL; // Se registra por método de envío
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
          case 'Renovación Enviada':
            tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_ENVIADA;
            break;
          case 'Renovación Pagada':
            tipoEvento = historialService.TIPOS_EVENTO.RENOVACION_PAGADA;
            break;
          case 'Cancelada':
            tipoEvento = historialService.TIPOS_EVENTO.POLIZA_CANCELADA;
            descripcion = motivo ? `Motivo: ${motivo}` : 'Póliza cancelada sin especificar motivo';
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
    cerrarModalAvisoPago,
    cambiarEstadoExpediente,
    utils
  });

  // � Guardar contacto faltante (teléfono o email) - VERSIÓN ORIGINAL SIMPLIFICADA
  const handleGuardarContactoFaltante = useCallback(async (valorContacto) => {
    try {
      if (!clienteParaActualizar || !tipoDatoFaltante) {
        throw new Error('Datos incompletos para actualizar cliente');
      }

      // Preparar datos según tipo de persona - LÓGICA ORIGINAL
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

      // Enviando actualización

      // Actualizar en BD - IGUAL QUE LA VERSIÓN ORIGINAL
      const response = await fetch(`${API_URL}/api/clientes/${clienteParaActualizar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error del servidor:', response.status, errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Error parseado:', errorJson);
        } catch (e) {
          console.error('❌ Error no es JSON válido');
        }
        throw new Error(`Error al actualizar cliente: ${response.status} - ${errorText}`);
      }

      const resultado = await response.json();
      // Actualización exitosa

      // Actualizar clientesMap local - EXACTAMENTE IGUAL QUE LA VERSIÓN ORIGINAL
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

      // Notificar éxito
      const tipoContacto = tipoDatoFaltante === 'email' ? 'Correo electrónico' : 'Teléfono de contacto';
      toast.success(`${tipoContacto} actualizado correctamente${canalEnvio ? '. Reintentando envío…' : '. Puedes continuar con el envío.'}`);

      // Disparar evento para recargar vista de clientes
      window.dispatchEvent(new CustomEvent('clientes-actualizados'));

      // Limpiar parcialmente (dejamos canalEnvio y expedienteEnEspera para el reintento)
      setClienteParaActualizar(null);
      setTipoDatoFaltante(null);

    } catch (error) {
      console.error('❌ Error al guardar contacto:', error);
      throw error; // Propagar error para que el modal lo muestre
    }
  }, [clienteParaActualizar, tipoDatoFaltante, canalEnvio]);

  // �🚀 MODULARIZACIÓN: Hooks para funcionalidades de pagos
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

  // 📤 Abrir Modal de Compartir (Póliza o Aviso de Pago)
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
        setDestinatarioCompartirSeleccionado(destinatarios[0]); // Seleccionar el primero por defecto
        
        // Si hay recibos, seleccionar el primer recibo vencido o pendiente (no pagado)
        if (expediente.recibos && expediente.recibos.length > 0) {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          
          // Filtrar solo recibos no pagados
          const recibosNoPagados = expediente.recibos.filter(r => !r.fecha_pago_real);
          
          if (recibosNoPagados.length > 0) {
            // Buscar primer recibo vencido
            const primerVencido = recibosNoPagados.find(r => {
              const fechaVenc = new Date(r.fecha_vencimiento);
              fechaVenc.setHours(0, 0, 0, 0);
              return fechaVenc < hoy;
            });
            
            // Si no hay vencidos, tomar el primer pendiente
            setPagoSeleccionado(primerVencido || recibosNoPagados[0]);
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
      
      // Registrar evento
      await historialService.registrarEvento({
        expediente_id: expedienteParaRenovacion.id,
        cliente_id: expedienteParaRenovacion.cliente_id,
        tipo_evento: historialService.TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA,
        usuario_nombre: 'Sistema',
        descripcion: 'Iniciado proceso de cotización para renovación de póliza',
        datos_adicionales: {
          numero_poliza: expedienteParaRenovacion.numero_poliza,
          compania: expedienteParaRenovacion.compania
        }
      });
      
      toast.success('Cotización de renovación iniciada');
      await recargarExpedientes();
      
      // Cerrar modal
      setMostrarModalCotizarRenovacion(false);
      setExpedienteParaRenovacion(null);
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      toast.error('Error al iniciar cotización');
    }
  }, [expedienteParaRenovacion]);

  /**
   * 2. Marcar Renovación como Autorizada
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
          etapa_activa: 'Pendiente de Emisión - Renovación'
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      // Registrar evento
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
      setExpedienteParaRenovacion(expediente);
      
      // Pre-llenar formulario con datos inteligentes
      const hoy = new Date();
      const inicioVigencia = new Date(expediente.termino_vigencia);
      const terminoVigencia = new Date(inicioVigencia);
      terminoVigencia.setFullYear(terminoVigencia.getFullYear() + 1);
      
      setDatosRenovacion({
        numeroPolizaNueva: expediente.numero_poliza || '', // Puede ser el mismo o nuevo
        primaNueva: expediente.prima_pagada || '',
        totalNuevo: expediente.total || '',
        fechaEmisionNueva: hoy.toISOString().split('T')[0],
        inicioVigenciaNueva: inicioVigencia.toISOString().split('T')[0],
        terminoVigenciaNueva: terminoVigencia.toISOString().split('T')[0],
        observaciones: ''
      });
      
      setMostrarModalPolizaRenovada(true);
    } catch (error) {
      console.error('Error al abrir modal de póliza renovada:', error);
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
      
      // Actualizar expediente con nuevos datos
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
          tipo_movimiento: 'renovacion' // Marcar como renovación
        })
      });
      
      if (!response.ok) throw new Error('Error al actualizar expediente');
      
      // Registrar evento
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
      toast.error('Error al registrar póliza renovada');
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

      // 🔧 COMPARACIÓN CORREGIDA: usar los nombres REALES que tiene el cliente (sin duplicados)
      const camposAComparar = [
        // 👤 DATOS BÁSICOS DEL CLIENTE/ASEGURADO
        { formulario: 'nombre', cliente: 'nombre' },
        { formulario: 'apellido_paterno', cliente: 'apellidoPaterno' }, // BD usa camelCase
        { formulario: 'apellido_materno', cliente: 'apellidoMaterno' }, // BD usa camelCase
        { formulario: 'rfc', cliente: 'rfc' },
        { formulario: 'curp', cliente: 'curp' },
        { formulario: 'fecha_nacimiento', cliente: 'fechaNacimiento' },
        
        // �📞 CONTACTO DEL CLIENTE/ASEGURADO (sus propios teléfonos y email)
        { formulario: 'email', cliente: 'email' },
        { formulario: 'telefono_fijo', cliente: 'telefonoFijo' }, // BD usa camelCase
        { formulario: 'telefono_movil', cliente: 'telefonoMovil' }, // BD usa camelCase
        
        // 🏢 PARA PERSONA MORAL ÚNICAMENTE
        { formulario: 'razon_social', cliente: 'razonSocial' },
        { formulario: 'nombre_comercial', cliente: 'nombreComercial' },
        
        // 🏠 DIRECCIÓN Y UBICACIÓN DEL CLIENTE
        { formulario: 'domicilio', cliente: 'direccion' }, // BD usa 'direccion'
        { formulario: 'colonia', cliente: 'colonia' },
        { formulario: 'municipio', cliente: 'municipio' },
        { formulario: 'estado', cliente: 'estado' },
        { formulario: 'codigo_postal', cliente: 'codigoPostal' }, // BD usa camelCase
        
        // 👨‍💼 CONTACTO PRINCIPAL/GESTOR/RESPONSABLE (persona que maneja la cuenta)
        // Físicas: OPCIONAL (pueden tener contacto responsable además de sus datos)
        // Morales: OBLIGATORIO (la empresa no tiene contacto propio, solo el responsable)
        { formulario: 'contacto_nombre', cliente: 'contacto_nombre' },
        { formulario: 'contacto_apellido_paterno', cliente: 'contacto_apellido_paterno' },
        { formulario: 'contacto_apellido_materno', cliente: 'contacto_apellido_materno' },
        { formulario: 'contacto_email', cliente: 'contacto_email' },
        { formulario: 'contacto_telefono_fijo', cliente: 'contacto_telefono_fijo' },
        { formulario: 'contacto_telefono_movil', cliente: 'contacto_telefono_movil' }
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



      if (!hayCambios) {
        console.log('❌ No hay cambios, saltando actualización');
        return; // No hay cambios
      }

      // Filtrar solo los campos válidos que el backend espera
      const camposValidosCliente = {
        id: clienteSeleccionado.id,
        codigo: clienteSeleccionado.codigo,
        categoria_id: clienteSeleccionado.categoria_id,
        nombre: clienteSeleccionado.nombre,
        apellido_paterno: clienteSeleccionado.apellidoPaterno || clienteSeleccionado.apellido_paterno,
        apellido_materno: clienteSeleccionado.apellidoMaterno || clienteSeleccionado.apellido_materno,
        razon_social: clienteSeleccionado.razonSocial || clienteSeleccionado.razon_social,
        nombre_comercial: clienteSeleccionado.nombreComercial || clienteSeleccionado.nombre_comercial,
        rfc: clienteSeleccionado.rfc,
        curp: clienteSeleccionado.curp,
        fecha_nacimiento: clienteSeleccionado.fecha_nacimiento,
        email: clienteSeleccionado.email,
        telefono_fijo: clienteSeleccionado.telefonoFijo || clienteSeleccionado.telefono_fijo,
        telefono_movil: clienteSeleccionado.telefonoMovil || clienteSeleccionado.telefono_movil,
        domicilio: clienteSeleccionado.domicilio,
        colonia: clienteSeleccionado.colonia,
        municipio: clienteSeleccionado.municipio,
        estado: clienteSeleccionado.estado,
        codigo_postal: clienteSeleccionado.codigo_postal,
        contacto_nombre: clienteSeleccionado.contacto_nombre,
        contacto_apellido_paterno: clienteSeleccionado.contacto_apellido_paterno,
        contacto_apellido_materno: clienteSeleccionado.contacto_apellido_materno,
        contacto_email: clienteSeleccionado.contacto_email,
        contacto_telefono_fijo: clienteSeleccionado.contacto_telefono_fijo,
        contacto_telefono_movil: clienteSeleccionado.contacto_telefono_movil,
        activo: clienteSeleccionado.activo
      };

      // Preparar datos para actualización (extraer SOLO campos válidos del cliente)
      const camposValidosActualizar = [
        'nombre', 'apellido_paterno', 'apellido_materno', 'rfc', 'curp', 'fecha_nacimiento',
        'email', 'telefono_fijo', 'telefono_movil', 'razon_social', 'nombre_comercial',
        'domicilio', 'colonia', 'municipio', 'estado', 'codigo_postal',
        'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno',
        'contacto_email', 'contacto_telefono_fijo', 'contacto_telefono_movil'
      ];
      
      const datosActualizacion = {};
      Object.keys(cambiosDetectados).forEach(campo => {
        // Solo incluir si es un campo válido del cliente
        if (camposValidosActualizar.includes(campo)) {
          const valorNuevo = cambiosDetectados[campo].nuevo;
          // Enviar null si está vacío, o el valor tal cual
          datosActualizacion[campo] = valorNuevo === '' ? null : valorNuevo;
        }
      });
      
      // Si no hay cambios válidos de cliente, no actualizar
      if (Object.keys(datosActualizacion).length === 0) {
        console.log('ℹ️ No hay cambios válidos de cliente para actualizar');
        return null;
      }
      // Aplicar los cambios sobre los campos válidos
      const datosCompletos = {
        ...camposValidosCliente,
        ...datosActualizacion
      };

      // Usar el servicio de clientes para actualizar
      const response = await fetch(`${API_URL}/api/clientes/${clienteSeleccionado.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosCompletos)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error al actualizar cliente:', response.status, errorText);
        // No lanzar error para no interrumpir guardado de póliza
        toast.error('Los datos de la póliza se guardaron, pero hubo un problema al actualizar el cliente');
        return;
      }

      const resultado = await response.json();
      // Cliente actualizado exitosamente

      // Actualizar clienteSeleccionado y clientesMap local
      const clienteActualizado = resultado.data || resultado;
      setClienteSeleccionado(prev => ({ ...prev, ...clienteActualizado }));
      setClientesMap(prevMap => ({
        ...prevMap,
        [clienteSeleccionado.id]: { ...prevMap[clienteSeleccionado.id], ...clienteActualizado }
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
        const clienteActualizado = resultado.data || resultado;
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
          
          // Formatear campos editados
          const cambiosDetallados = {};
          Object.entries(camposEditados).forEach(([etiqueta, cambio]) => {
            const nombreCampo = etiqueta.toLowerCase().replace(/ /g, '_');
            cambiosDetallados[nombreCampo] = {
              anterior: cambio.antes,
              nuevo: cambio.despues
            };
          });
          
          await historialService.registrarEvento({
            expediente_id: datos.id,
            cliente_id: datos.cliente_id,
            tipo_evento: 'edicion_manual_expediente',
            usuario_nombre: 'Sistema',
            descripcion: `Edición manual de expediente | ${datos.compania || 'Sin aseguradora'} | Póliza: ${datos.numero_poliza || 'Sin número'} | ${cantidadCambios} campo(s) modificado(s)`,
            datos_adicionales: {
              metodo_captura: 'Edición Manual',
              fecha_edicion: new Date().toISOString(),
              aseguradora: datos.compania,
              numero_poliza: datos.numero_poliza,
              fecha_emision: datos.fecha_emision,
              inicio_vigencia: datos.inicio_vigencia,
              termino_vigencia: datos.termino_vigencia,
              monto_total: datos.total,
              tipo_pago: datos.tipo_pago,
              frecuencia_pago: datos.frecuenciaPago || datos.frecuencia_pago,
              usuario_edito: 'Sistema',
              etapa_actual: datos.etapa_activa || 'Sin etapa',
              
              // Cambios de cliente (si los hay)
              ...(cambiosClienteDetectados && {
                cliente_cambios: {
                  descripcion: 'Datos de contacto editados',
                  campos_actualizados: cambiosClienteDetectados.campos_actualizados,
                  cambios_detallados: cambiosClienteDetectados.cambios_detallados
                }
              }),
              
              // Cambios detectados en póliza
              poliza_cambios: cantidadCambios > 0 ? {
                descripcion: 'Datos de póliza editados manualmente',
                campos_actualizados: Object.keys(cambiosDetallados),
                cambios_detallados: cambiosDetallados
              } : null,
              
              // Cambios en recibos (fechas de vencimiento)
              ...(cambiosRecibosEdicion && {
                recibos_cambios: {
                  descripcion: 'Fechas de vencimiento de recibos actualizadas por cambio en vigencia',
                  cantidad_cambios: cambiosRecibosEdicion.cantidad_cambios,
                  cambios_detallados: cambiosRecibosEdicion.cambios_detallados
                }
              })
            }
          });
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
      
      // ✅ Todos los cambios (cliente + póliza) se incluyen en el evento de captura PDF
      if (cambiosClienteDetectados || (cambiosPoliza && cambiosPoliza.hayCambios)) {

        setCambiosClientePendientes(null); // Limpiar
      }
      
      // Recargar lista de expedientes desde backend para asegurar sincronización
      await recargarExpedientes();
      
      toast.success(`✅ Expediente ${modoEdicion ? 'actualizado' : 'creado'} correctamente`);
      limpiarFormulario();
      setVistaActual('lista');
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

      let clienteEncontrado = null;
      if (expedienteCompleto.cliente_id) {
        clienteEncontrado = clientesMap[expedienteCompleto.cliente_id];
        console.log('👤 Cliente encontrado:', clienteEncontrado);
        console.log('🗺️ ClientesMap keys:', Object.keys(clientesMap));
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
          // 🔄 Funciones de renovación
          iniciarCotizacionRenovacion={iniciarCotizacionRenovacion}
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
          onEliminarPago={() => {}}
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
          onEliminarPago={() => {}}
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
          historial={historialExpediente}
          setHistorialExpediente={setHistorialExpediente}
        />
      )}

      {/* MODALES */}
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
                  // Transformar recibo a formato esperado
                  const pagoTransformado = {
                    numero: pagoParaNotificar.numero_recibo || pagoParaNotificar.numero,
                    fecha: pagoParaNotificar.fecha_vencimiento || pagoParaNotificar.fecha,
                    monto: pagoParaNotificar.monto,
                    estado: pagoParaNotificar.estado_pago || pagoParaNotificar.estado,
                    totalPagos: expedienteEnEspera.recibos?.length || null
                  };
                  enviarAvisoPagoWhatsApp(pagoTransformado, expedienteEnEspera);
                } else {
                  compartirPorWhatsApp(expedienteEnEspera);
                }
              } else if (canalEnvio === 'Email') {
                // Verificar si es envío de aviso de pago o compartir póliza
                if (pagoParaNotificar) {
                  // Transformar recibo a formato esperado
                  const pagoTransformado = {
                    numero: pagoParaNotificar.numero_recibo || pagoParaNotificar.numero,
                    fecha: pagoParaNotificar.fecha_vencimiento || pagoParaNotificar.fecha,
                    monto: pagoParaNotificar.monto,
                    estado: pagoParaNotificar.estado_pago || pagoParaNotificar.estado,
                    totalPagos: expedienteEnEspera.recibos?.length || null
                  };
                  enviarAvisoPagoEmail(pagoTransformado, expedienteEnEspera);
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
                          {expedienteParaCompartir.recibos
                            .filter(recibo => {
                              // Solo mostrar recibos pendientes o vencidos (no pagados)
                              if (recibo.fecha_pago_real) return false; // Si ya tiene fecha de pago real, está pagado
                              
                              // Calcular estado real basado en fecha
                              const hoy = new Date();
                              hoy.setHours(0, 0, 0, 0);
                              const fechaVenc = new Date(recibo.fecha_vencimiento);
                              fechaVenc.setHours(0, 0, 0, 0);
                              
                              // Si está vencido o pendiente, mostrarlo
                              return fechaVenc <= hoy || !recibo.fecha_pago_real;
                            })
                            .map(recibo => {
                              // Calcular estado real para mostrar
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
                          Solo se muestran pagos pendientes o vencidos
                        </small>
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
                    onClick={async () => {
                      if (tipoEnvio === 'pago' && pagoSeleccionado) {
                        // Transformar recibo a formato esperado por el hook
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null
                        };
                        await enviarAvisoPagoWhatsApp(pagoTransformado, expedienteParaCompartir);
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
                      if (tipoEnvio === 'pago' && pagoSeleccionado) {
                        // Transformar recibo a formato esperado por el hook
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null
                        };
                        await enviarAvisoPagoEmail(pagoTransformado, expedienteParaCompartir);
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

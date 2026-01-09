/**
 * ====================================================================
 * MÓDULO: GESTIÓN DE EXPEDIENTES (VERSIÓN CON FORMULARIOS SEPARADOS)
 * ====================================================================
 * Versión con formularios separados:
 * - FormularioNuevoExpediente: Para agregar desde PDF (sin snapshot)
 * - FormularioEditarExpediente: Para editar (con snapshot para logs)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, Mail, DollarSign, Calendar, Upload, CheckCircle, X, AlertCircle, Loader, FileText } from 'lucide-react';
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

        console.log('✅ Datos iniciales cargados con recibos');
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
      
      console.log('✅ Expedientes normalizados con primer recibo pendiente:', datosNormalizados.length);
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

      console.log('🔄 Cambiando etapa:', { expedienteId, etapaAnterior, nuevoEstado });

      const response = await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizacion)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Etapa actualizada en BD');
      
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
        console.log(`✅ Evento "${tipoEvento}" registrado en historial de trazabilidad`);
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

  // � Guardar contacto faltante (teléfono o email)
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

      // Notificar éxito
      const tipoContacto = tipoDatoFaltante === 'email' ? 'Correo electrónico' : 'Teléfono de contacto';
      toast.success(`${tipoContacto} actualizado correctamente${canalEnvio ? '. Reintentando envío…' : '. Puedes continuar con el envío.'}`);

      // Limpiar parcialmente (dejamos canalEnvio y expedienteEnEspera para el reintento)
      setClienteParaActualizar(null);
      setTipoDatoFaltante(null);

    } catch (error) {
      console.error('❌ Error al guardar contacto:', error);
      throw error; // Propagar error para que el modal lo muestre
    }
  }, [clienteParaActualizar, tipoDatoFaltante, canalEnvio, clientesMap]);

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

  // Función de compartir (por ahora simplificada - pendiente implementación completa)
  const abrirModalCompartirOLD = useCallback(async (expediente) => {
    toast.info('Función Compartir Póliza pendiente de implementación completa');
    console.log('📤 Compartir expediente:', expediente.id);
    // TODO: Implementar modal de compartir completo con Email/WhatsApp
  }, []);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setClienteSeleccionado(null);
    setModoEdicion(false);
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

  const guardarExpediente = useCallback(async () => {
    if (!validarFormulario()) {
      return;
    }

    setGuardando(true);

    try {
      const datos = { ...formulario };
      
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
      
      // 🔥 GUARDAR flag de PDF ANTES de eliminarlo (para el log de trazabilidad)
      const fueExtractorPDF = datos._datos_desde_pdf === true;
      const camposModificadosPostPDF = datos._campos_modificados_post_pdf || [];
      const metodoCaptura = datos._metodo_captura || (fueExtractorPDF ? 'pdf' : 'manual');
      
      // Limpiar campos temporales y banderas
      delete datos._fechaManual;
      delete datos._datos_desde_pdf;
      delete datos._metodo_captura;
      delete datos._snapshot_pdf;
      delete datos._campos_modificados_post_pdf;
      delete datos._inicio_vigencia_changed;
      delete datos._periodo_gracia_changed;
      delete datos._tipo_pago_changed;
      delete datos._frecuencia_pago_changed;
      delete datos._total_changed;
      delete datos._primer_pago_changed;
      delete datos._pagos_subsecuentes_changed;
      delete datos.cliente;
      delete datos.historial;
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

      console.log('💾 DATOS COMPLETOS que se enviarán al backend:', datos);
      console.log('📅 CAMPOS CRÍTICOS:', {
        // Fechas
        inicio_vigencia: datos.inicio_vigencia,
        termino_vigencia: datos.termino_vigencia,
        fecha_vencimiento_pago: datos.fecha_vencimiento_pago,
        proximoPago: datos.proximoPago,
        fecha_pago: datos.fecha_pago,
        // Pagos
        tipo_pago: datos.tipo_pago,
        frecuenciaPago: datos.frecuenciaPago,
        frecuencia_pago: datos.frecuencia_pago,
        periodo_gracia: datos.periodo_gracia,
        // Estatus
        estatus_pago: datos.estatus_pago,
        estatusPago: datos.estatusPago,
        // Recibos
        recibos: datos.recibos?.length || 0
      });
      console.log('🔄 Modo:', modoEdicion ? 'EDITAR (PUT)' : 'CREAR (POST)');

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
      console.log('✅ Respuesta del backend:', resultado);
      
      // 📝 Registrar evento en historial de trazabilidad
      try {
        if (modoEdicion) {
          // Registro de EDICIÓN
          await historialService.registrarEvento({
            expediente_id: datos.id,
            cliente_id: datos.cliente_id,
            tipo_evento: historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS,
            usuario_nombre: 'Sistema',
            descripcion: `Expediente actualizado - Póliza: ${datos.numero_poliza || 'N/A'}`,
            datos_adicionales: {
              numero_poliza: datos.numero_poliza,
              compania: datos.compania,
              producto: datos.producto,
              fecha_actualizacion: new Date().toISOString()
            }
          });
          console.log('✅ Evento de edición registrado en historial');
        } else {
          // Registro de CREACIÓN
          const expedienteId = resultado.data?.id || resultado.id;
          
          // Construir nombre completo del cliente
          let nombreCliente = '';
          if (datos.razon_social || datos.razonSocial) {
            nombreCliente = datos.razon_social || datos.razonSocial;
          } else {
            const partes = [
              datos.nombre,
              datos.apellido_paterno || datos.apellidoPaterno,
              datos.apellido_materno || datos.apellidoMaterno
            ].filter(Boolean);
            nombreCliente = partes.join(' ') || 'Sin nombre';
          }
          
          await historialService.registrarEvento({
            expediente_id: expedienteId,
            cliente_id: datos.cliente_id,
            tipo_evento: fueExtractorPDF 
              ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
              : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
            usuario_nombre: 'Sistema',
            descripcion: fueExtractorPDF 
              ? `Expediente creado mediante extracción automática de PDF - ${datos.compania || ''} ${datos.numero_poliza || ''}${camposModificadosPostPDF.length > 0 ? ' (con modificaciones manuales)' : ''}`
              : `Expediente creado mediante captura manual - ${datos.compania || ''} ${datos.numero_poliza || ''}`,
            datos_adicionales: {
              // Datos de la póliza
              numero_poliza: datos.numero_poliza || 'Sin número',
              compania: datos.compania || 'Sin compañía',
              producto: datos.producto || 'Sin producto',
              numero_endoso: datos.numero_endoso || null,
              
              // Datos del cliente
              cliente_nombre: nombreCliente,
              cliente_rfc: datos.rfc || null,
              
              // Vigencia
              inicio_vigencia: datos.inicio_vigencia || null,
              termino_vigencia: datos.termino_vigencia || null,
              
              // Montos
              prima_neta: datos.prima_neta || null,
              total: datos.total || null,
              tipo_pago: datos.tipo_pago || null,
              frecuencia_pago: datos.frecuenciaPago || datos.frecuencia_pago || null,
              
              // Vehículo (si aplica)
              vehiculo_marca: datos.marca || null,
              vehiculo_modelo: datos.modelo || null,
              vehiculo_anio: datos.anio || null,
              vehiculo_placas: datos.placas || null,
              
              // Agente
              agente: datos.agente || null,
              clave_agente: datos.clave_agente || null,
              
              // Metadata de captura
              metodo_captura: metodoCaptura === 'pdf' ? 'Extractor PDF' : 'Captura Manual',
              campos_extraidos_desde_pdf: fueExtractorPDF,
              campos_modificados_manualmente: camposModificadosPostPDF.length > 0,
              campos_modificados: camposModificadosPostPDF.length > 0 ? camposModificadosPostPDF : null,
              cantidad_campos_modificados: camposModificadosPostPDF.length,
              fecha_captura: new Date().toISOString(),
              etapa_inicial: datos.etapa_activa || 'Captura'
            }
          });
          console.log('✅ Evento de creación registrado en historial:', fueExtractorPDF ? 'PDF' : 'Manual');
          
          // 🔥 SEGUNDO EVENTO: Registrar evento según la etapa inicial del expediente
          const etapaInicial = datos.etapa_activa || 'Captura';
          let tipoEventoEtapa = null;
          let descripcionEtapa = '';
          
          switch (etapaInicial) {
            case 'En cotización':
            case 'Captura':
              tipoEventoEtapa = historialService.TIPOS_EVENTO.COTIZACION_CREADA;
              descripcionEtapa = `Cotización creada - ${datos.compania || ''} ${datos.numero_poliza || ''}`;
              break;
            case 'Cotización enviada':
              tipoEventoEtapa = historialService.TIPOS_EVENTO.COTIZACION_ENVIADA;
              descripcionEtapa = `Cotización enviada al cliente - ${datos.compania || ''} ${datos.numero_poliza || ''}`;
              break;
            case 'Autorizado':
              tipoEventoEtapa = historialService.TIPOS_EVENTO.COTIZACION_AUTORIZADA;
              descripcionEtapa = `Cotización autorizada por el cliente - ${datos.compania || ''} ${datos.numero_poliza || ''}`;
              break;
            case 'En proceso emisión':
              tipoEventoEtapa = historialService.TIPOS_EVENTO.EMISION_INICIADA;
              descripcionEtapa = `Emisión de póliza iniciada - ${datos.compania || ''} ${datos.numero_poliza || ''}`;
              break;
            case 'Emitida':
              tipoEventoEtapa = historialService.TIPOS_EVENTO.POLIZA_EMITIDA;
              descripcionEtapa = `Póliza emitida - ${datos.compania || ''} ${datos.numero_poliza || ''}`;
              break;
          }
          
          // Registrar el evento de etapa si aplica
          if (tipoEventoEtapa) {
            await historialService.registrarEvento({
              expediente_id: expedienteId,
              cliente_id: datos.cliente_id,
              tipo_evento: tipoEventoEtapa,
              usuario_nombre: 'Sistema',
              descripcion: descripcionEtapa,
              datos_adicionales: {
                numero_poliza: datos.numero_poliza || 'Sin número',
                compania: datos.compania || 'Sin compañía',
                producto: datos.producto || 'Sin producto',
                etapa: etapaInicial,
                inicio_vigencia: datos.inicio_vigencia || null,
                termino_vigencia: datos.termino_vigencia || null,
                total: datos.total || null
              }
            });
            console.log('✅ Evento de etapa registrado:', tipoEventoEtapa);
          }
        }
      } catch (errorHistorial) {
        console.error('⚠️ Error al registrar en historial (no crítico):', errorHistorial);
      }
      
      // Recargar lista de expedientes desde backend para asegurar sincronización
      await recargarExpedientes();
      
      toast.success(`✅ Expediente ${modoEdicion ? 'actualizado' : 'creado'} correctamente`);
      limpiarFormulario();
      setVistaActual('lista');
      setGuardando(false);
      
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      toast.error('Error al guardar: ' + error.message);
      setGuardando(false);
    }
  }, [formulario, modoEdicion, validarFormulario, limpiarFormulario]);

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
        console.log('🔧 CALCULANDO: inicio:', expedienteCompleto.inicio_vigencia, '+ gracia:', expedienteCompleto.periodo_gracia, '= fecha límite:', fechaVencimientoPago);
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

      console.log('✅ Datos procesados para el formulario:', datosFormulario);
      console.log('📅 Recibos parseados:', recibosParseados);
      console.log('💰 Tipo de pago:', datosFormulario.tipo_pago, '| Frecuencia:', datosFormulario.frecuenciaPago);

      // 🔧 FIX: NO RECALCULAR - usar los datos tal como vienen calculados
      setFormulario(datosFormulario);
      setClienteSeleccionado(clienteEncontrado);
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

  const handleClienteSeleccionado = useCallback((cliente) => {
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
        telefono_movil: ''
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
      telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || ''
    };
    
    setFormulario(prev => ({ ...prev, ...datosCliente }));
  }, []);

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
      console.log('🔧 actualizarCalculosAutomaticos: inicio:', formularioActual.inicio_vigencia, '+ gracia:', periodoGracia, '= límite:', fechaLimitePago);
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
    
    // 5. Si cambió cualquier campo que afecte los recibos, limpiar para forzar recálculo
    let recibosActualizados = formularioActual.recibos;
    const debeRecalcularRecibos = (
      formularioActual._inicio_vigencia_changed ||
      formularioActual._periodo_gracia_changed ||
      formularioActual._frecuencia_pago_changed ||
      formularioActual._tipo_pago_changed ||
      formularioActual._total_changed ||
      formularioActual._primer_pago_changed ||
      formularioActual._pagos_subsecuentes_changed
    );
    
    if (debeRecalcularRecibos) {
      recibosActualizados = undefined; // Forzar recálculo en CalendarioPagos
      console.log('🔄 Forzando recálculo de recibos por cambios detectados');
      console.log('💾 Recibos antes del recálculo:', formularioActual.recibos?.length || 0);
      console.log('💾 Recibos después del recálculo:', recibosActualizados);
    }
    
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
                    onClick={() => {
                      if (tipoEnvio === 'pago' && pagoSeleccionado) {
                        // Transformar recibo a formato esperado por el hook
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null
                        };
                        enviarAvisoPagoWhatsApp(pagoTransformado, expedienteParaCompartir);
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
                        // Transformar recibo a formato esperado por el hook
                        const pagoTransformado = {
                          numero: pagoSeleccionado.numero_recibo,
                          fecha: pagoSeleccionado.fecha_vencimiento,
                          monto: pagoSeleccionado.monto,
                          estado: pagoSeleccionado.estado_pago,
                          totalPagos: expedienteParaCompartir.recibos?.length || null
                        };
                        enviarAvisoPagoEmail(pagoTransformado, expedienteParaCompartir);
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
    </div>
  );
};

export default ModuloNvoExpedientes;

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import * as clientesService from '../services/clientesService';
import * as pdfService from '../services/pdfService';
import * as notificacionesService from '../services/notificacionesService';
import * as historialService from '../services/historialExpedienteService';

/**
 * Custom Hook para manejar la lógica de compartir expedientes
 * por WhatsApp y Email (pólizas y avisos de pago)
 * 
 * ⚠️ CAMPOS IMPORTANTES - NO CONFUNDIR JAMÁS:
 * 
 * 📋 CLIENTE DIRECTO (raramente usado):
 * - apellidoPaterno/apellido_paterno
 * - apellidoMaterno/apellido_materno  
 * - email, telefonoMovil/telefono_movil
 * 
 * 📋 CONTACTO PRINCIPAL (MÁS COMÚN - lo que se ve en pantalla):
 * - contacto_nombre
 * - contacto_apellido_paterno ⚠️ NUNCA OLVIDES
 * - contacto_apellido_materno ⚠️ NUNCA OLVIDES  
 * - contacto_email, contacto_telefono_movil
 * 
 * 🚨 Al actualizar cliente SIEMPRE incluir AMBOS tipos
 */
export const useCompartirExpediente = ({
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
}) => {

  /**
   * 🔧 FUNCIÓN: Actualizar solo un campo específico del cliente (enviando cliente COMPLETO)
   * @param {number} clienteId - ID del cliente
   * @param {string} campo - Campo a actualizar ('email', 'telefono_movil')
   * @param {string} valor - Nuevo valor del campo
   * @param {string} tipoPersona - Tipo de persona para determinar el campo correcto
   * @returns {Object} Cliente actualizado completo
   */
  const actualizarCampoCliente = useCallback(async (clienteId, campo, valor, tipoPersona, destinatarioSeleccionado = null) => {
    try {
      // Primero obtener el cliente completo actual
      const respCliente = await clientesService.obtenerClientePorId(clienteId);
      if (!respCliente?.success) {
        throw new Error('No se pudo obtener los datos actuales del cliente');
      }

      const clienteActual = respCliente.data;

      // 🔍 DEBUG: Ver exactamente qué campos vienen del cliente
      console.log('🔍 DEBUG - Cliente actual completo:', clienteActual);
      console.log('🔍 DEBUG - Apellidos específicos:', {
        apellidoPaterno: clienteActual.apellidoPaterno,
        apellido_paterno: clienteActual.apellido_paterno,
        apellidoMaterno: clienteActual.apellidoMaterno,
        apellido_materno: clienteActual.apellido_materno
      });

      // Determinar el campo correcto según QUÉ DESTINATARIO se seleccionó
      let campoReal = campo;
      const destinatarioActual = destinatarioSeleccionado || destinatarioCompartirSeleccionado;
      
      if (campo === 'telefono_movil') {
        // Si se seleccionó contacto principal → contacto_telefono_movil
        // Si se seleccionó cliente directo → telefonoMovil  
        campoReal = destinatarioActual?.tipo === 'Contacto Principal' 
          ? 'contacto_telefono_movil' 
          : 'telefonoMovil';
      } else if (campo === 'email') {
        // Si se seleccionó contacto principal → contacto_email
        // Si se seleccionó cliente directo → email
        campoReal = destinatarioActual?.tipo === 'Contacto Principal'
          ? 'contacto_email' 
          : 'email';
      }

      // 🔧 MAPEAR todos los campos existentes del cliente (preservar estructura original)
      const camposValidosCliente = {};
      
      // ⚠️ IMPORTANTE: NO CONFUNDIR CAMPOS DE CLIENTE vs CONTACTO PRINCIPAL
      // - Cliente directo: apellidoPaterno, apellidoMaterno (raramente usado)  
      // - Contacto Principal: contacto_apellido_paterno, contacto_apellido_materno (MÁS COMÚN)
      
      // Campos básicos con mapeo dinámico
      if (clienteActual.id) camposValidosCliente.id = clienteActual.id;
      if (clienteActual.nombre) camposValidosCliente.nombre = clienteActual.nombre;
      
      // ❌ CLIENTE DIRECTO - Usar campos como el CRUD de clientes (camelCase)
      if (clienteActual.apellidoPaterno) {
        camposValidosCliente.apellidoPaterno = clienteActual.apellidoPaterno;
      } else if (clienteActual.apellido_paterno) {
        camposValidosCliente.apellidoPaterno = clienteActual.apellido_paterno;
      }
      
      if (clienteActual.apellidoMaterno) {
        camposValidosCliente.apellidoMaterno = clienteActual.apellidoMaterno;
      } else if (clienteActual.apellido_materno) {
        camposValidosCliente.apellidoMaterno = clienteActual.apellido_materno;
      }

      // Otros campos importantes con prioridad camelCase (como CRUD)
      if (clienteActual.rfc) camposValidosCliente.rfc = clienteActual.rfc;
      if (clienteActual.curp) camposValidosCliente.curp = clienteActual.curp;
      if (clienteActual.fechaNacimiento) camposValidosCliente.fechaNacimiento = clienteActual.fechaNacimiento;
      if (clienteActual.fecha_nacimiento) camposValidosCliente.fechaNacimiento = clienteActual.fecha_nacimiento;
      if (clienteActual.tipoPersona) camposValidosCliente.tipoPersona = clienteActual.tipoPersona;
      if (clienteActual.tipo_persona) camposValidosCliente.tipoPersona = clienteActual.tipo_persona;
      if (clienteActual.razonSocial) camposValidosCliente.razonSocial = clienteActual.razonSocial;
      if (clienteActual.razon_social) camposValidosCliente.razonSocial = clienteActual.razon_social;
      if (clienteActual.email) camposValidosCliente.email = clienteActual.email;
      
      // ✅ CONTACTO CLIENTE DIRECTO - Usar camelCase como CRUD
      if (clienteActual.telefonoMovil) camposValidosCliente.telefonoMovil = clienteActual.telefonoMovil;
      if (clienteActual.telefono_movil && !camposValidosCliente.telefonoMovil) camposValidosCliente.telefonoMovil = clienteActual.telefono_movil;
      if (clienteActual.telefonoFijo) camposValidosCliente.telefonoFijo = clienteActual.telefonoFijo;
      if (clienteActual.telefono_fijo && !camposValidosCliente.telefonoFijo) camposValidosCliente.telefonoFijo = clienteActual.telefono_fijo;
      
      if (clienteActual.direccion) camposValidosCliente.direccion = clienteActual.direccion;
      if (clienteActual.ciudad) camposValidosCliente.ciudad = clienteActual.ciudad;
      if (clienteActual.estado) camposValidosCliente.estado = clienteActual.estado;
      if (clienteActual.codigoPostal) camposValidosCliente.codigoPostal = clienteActual.codigoPostal;
      if (clienteActual.codigo_postal) camposValidosCliente.codigoPostal = clienteActual.codigo_postal;
      
      // ✅ CONTACTO PRINCIPAL - Los campos MÁS IMPORTANTES (estos son los que se ven en pantalla)
      // ⚠️ NUNCA OLVIDES ESTOS: contacto_apellido_paterno, contacto_apellido_materno
      if (clienteActual.contacto_nombre) camposValidosCliente.contacto_nombre = clienteActual.contacto_nombre;
      if (clienteActual.contacto_apellido_paterno) camposValidosCliente.contacto_apellido_paterno = clienteActual.contacto_apellido_paterno;
      if (clienteActual.contacto_apellido_materno) camposValidosCliente.contacto_apellido_materno = clienteActual.contacto_apellido_materno;
      if (clienteActual.contacto_email) camposValidosCliente.contacto_email = clienteActual.contacto_email;
      if (clienteActual.contacto_telefono_movil) camposValidosCliente.contacto_telefono_movil = clienteActual.contacto_telefono_movil;
      if (clienteActual.contacto_telefono_fijo) camposValidosCliente.contacto_telefono_fijo = clienteActual.contacto_telefono_fijo;
      
      // IDs de relaciones
      if (clienteActual.categoria_id) camposValidosCliente.categoria_id = clienteActual.categoria_id;
      if (clienteActual.agente_id) camposValidosCliente.agente_id = clienteActual.agente_id;
      if (clienteActual.sub_agente_id) camposValidosCliente.sub_agente_id = clienteActual.sub_agente_id;
      if (clienteActual.fecha_alta) camposValidosCliente.fecha_alta = clienteActual.fecha_alta;

      // Campo actualizado
      camposValidosCliente[campoReal] = valor;
      
      console.log('🔧 Datos finales a enviar:', {
        clienteId,
        campoReal,
        valor,
        apellidoPaterno: camposValidosCliente.apellidoPaterno,
        apellidoMaterno: camposValidosCliente.apellidoMaterno,
        totalCampos: Object.keys(camposValidosCliente).length
      });

      // Actualizar usando el servicio con campos filtrados
      const resultado = await clientesService.actualizarCliente(clienteId, camposValidosCliente);
      
      if (!resultado.success) {
        throw new Error(resultado.error);
      }

      console.log('✅ Campo actualizado exitosamente con cliente completo:', resultado.data);
      return resultado.data;

    } catch (error) {
      console.error('❌ Error actualizando campo cliente:', error);
      throw error;
    }
  }, []);
  /**
   * Compartir póliza completa por WhatsApp
   */
  const compartirPorWhatsApp = useCallback(async (expediente, destinatarioForzado = null) => {
    try {
      // 🔧 USAR DESTINATARIO FORZADO SI SE PROPORCIONA, SINO EL SELECCIONADO
      const destinatarioActual = destinatarioForzado || destinatarioCompartirSeleccionado;
      
      // Usar destinatario actual si está disponible, sino obtener del cliente
      let telefono, nombreDestinatario;
      
      if (destinatarioActual) {
        telefono = destinatarioActual.telefono;
        nombreDestinatario = destinatarioActual.nombre;
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
      
      // Si no tiene teléfono, abrir modal para capturarlo
      if (!telefono) {
        console.log('⚠️ Destinatario sin teléfono móvil, abriendo modal de captura');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (respCliente?.success) {
          setClienteParaActualizar({
            ...respCliente.data,
            // 🔧 GUARDAR INFO DEL DESTINATARIO SELECCIONADO
            _destinatarioSeleccionado: destinatarioActual
          });
          setDestinatarioParaModal(destinatarioActual); // Pasar destinatario al modal
          setTipoDatoFaltante('telefono_movil');
          setCanalEnvio('WhatsApp');
          setExpedienteEnEspera({
            ...expediente,
            // 🔧 PRESERVAR DESTINATARIO PARA EL REINTENTO
            _destinatarioOriginal: destinatarioActual
          });
          setMostrarModalContacto(true);
        }
        return;
      }

      // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Validar que el número tenga al menos 10 dígitos y solo contenga números
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        console.log('⚠️ Número de teléfono inválido, abriendo modal de captura');
        toast.error(`❌ El número de teléfono "${telefono}" no es válido para WhatsApp. Por favor actualízalo.`);
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (respCliente?.success) {
          setClienteParaActualizar(respCliente.data);
          setTipoDatoFaltante('telefono_movil');
          setCanalEnvio('WhatsApp');
          setExpedienteEnEspera(expediente);
          setMostrarModalContacto(true);
        }
        return;
      }
      
      console.log('✅ Número de teléfono válido:', telefonoLimpio);
      
      // Obtener URL firmada del PDF si existe
      let pdfUrl = null;
      let pdfExpiracion = null;
      
      // Debug: verificar si tiene PDF
      console.log('📄 Verificando PDF del expediente:', {
        pdf_key: expediente.pdf_key,
        pdf_url: expediente.pdf_url,
        pdf_nombre: expediente.pdf_nombre
      });
      
      if (expediente.pdf_key) {
        try {
          const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400); // 24 horas
          pdfUrl = pdfData.signed_url;
          pdfExpiracion = new Date(Date.now() + 86400 * 1000).toISOString();
          console.log('✅ URL del PDF obtenida:', pdfUrl?.substring(0, 50) + '...');
        } catch (error) {
          console.warn('❌ No se pudo obtener URL del PDF:', error);
        }
      } else {
        console.log('⚠️ El expediente no tiene pdf_key - No se puede incluir link de descarga');
      }
      
      // 📄 Obtener URL del recibo de pago del próximo pago pendiente (si existe)
      let reciboPagoUrl = null;
      if (expediente.recibos && Array.isArray(expediente.recibos)) {
        // Buscar el próximo recibo pendiente que tenga recibo de pago subido
        const reciboPendiente = expediente.recibos.find(r => r.recibo_pago_url && !r.fecha_pago_real);
        const reciboConRecibo = reciboPendiente || expediente.recibos.find(r => r.recibo_pago_url);
        if (reciboConRecibo) {
          try {
            const dataRecibo = await pdfService.obtenerReciboPagoURL(expediente.id, reciboConRecibo.numero_recibo, 86400);
            reciboPagoUrl = dataRecibo?.url || dataRecibo?.signed_url;
            console.log('✅ Recibo de pago incluido en póliza WhatsApp:', reciboPagoUrl?.substring(0, 50) + '...');
          } catch (e) { console.warn('⚠️ No se pudo obtener URL recibo de pago:', e); }
        }
      }

      // Generar mensaje dinámico según el estado usando el servicio
      const { tipoMensaje, mensaje } = notificacionesService.generarMensajeWhatsApp(
        expediente, 
        utils, 
        pdfUrl,
        true,
        reciboPagoUrl
      );

      // Crear la URL de WhatsApp
      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      const nombreFinalDestinatario = destinatarioCompartirSeleccionado
        ? destinatarioCompartirSeleccionado.nombre
        : nombreDestinatario;
      
      // Abrir WhatsApp
      window.open(url, '_blank');
      
      // Registrar evento en el historial de trazabilidad (log único y completo)
      try {
        await historialService.registrarEnvioDocumento(
          expediente.id,
          expediente.cliente_id,
          'WhatsApp',
          { nombre: nombreFinalDestinatario, contacto: telefono },
          mensaje,
          pdfUrl,
          { 
            compania: expediente.compania,
            numero_poliza: expediente.numero_poliza,
            tipo_pago: expediente.tipo_pago
          }
        );
        console.log('✅ Evento registrado en historial de trazabilidad (WhatsApp)');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      // 🔥 Actualizar la etapa: Si está "Emitida", siempre avanzar a "Enviada al Cliente"
      if (expediente.etapa_activa === 'Emitida') {
        await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
        toast.success(`✅ Póliza enviada por WhatsApp.\n📬 Etapa avanzada a "Enviada al Cliente"`);
      } else if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.RENOVACION_EMISION || expediente.etapa_activa === 'Renovación Emitida') {
        if (expediente.etapa_activa === 'Renovación Emitida') {
          await cambiarEstadoExpediente(expediente.id, 'Renovación Enviada');
          await historialService.registrarRenovacionEnviadaCliente(
            expediente,
            'WhatsApp',
            { nombre: nombreFinalDestinatario, contacto: telefono }
          );
          toast.success(`✅ Renovación enviada por WhatsApp.\n📬 Etapa avanzada a "Renovación Enviada"`);
        } else {
          toast.success('✅ Renovación enviada por WhatsApp');
        }
      } else {
        toast.success('✅ Mensaje enviado por WhatsApp');
      }
      
      // 🔄 Recargar historial automáticamente después de compartir póliza
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada (compartir póliza WhatsApp)');
      }, 1500);
      
      // 🔄 Agregar listener para recargar cuando el usuario regrese de WhatsApp
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('🔄 Usuario regresó a la página, recargando expedientes...');
          window.dispatchEvent(new CustomEvent('recargarExpedientes'));
          // Remover el listener después de usarlo una vez
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Auto-remover el listener después de 5 minutos para evitar memory leaks
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }, 300000);
      
    } catch (error) {
      console.error('Error al compartir por WhatsApp:', error);
      toast.error('Error al compartir por WhatsApp. Intenta nuevamente.');
    }
  }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setMostrarModalContacto, utils]);

  /**
   * Compartir póliza completa por Email
   */
  const compartirPorEmail = useCallback(async (expediente, destinatarioForzado = null) => {
    try {
      // 🔧 USAR DESTINATARIO FORZADO SI SE PROPORCIONA, SINO EL SELECCIONADO
      const destinatarioActual = destinatarioForzado || destinatarioCompartirSeleccionado;
      
      // 🔧 PRESERVAR NOMBRE DEL DESTINATARIO DESDE EL INICIO
      const nombreOriginalDestinatario = destinatarioActual 
        ? destinatarioActual.nombre 
        : null;
        
      console.log('🔍 DEBUG Email - Nombres:', {
        nombreOriginalDestinatario,
        destinatarioActual,
        destinatarioForzado,
        tieneDestinatario: !!destinatarioActual
      });
        
      // Usar destinatario actual si está disponible, sino obtener del cliente
      let email, nombreDestinatario;
      
      if (destinatarioActual) {
        email = destinatarioActual.email;
        nombreDestinatario = destinatarioActual.nombre;
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
      
      // Si no tiene email, abrir modal para capturarlo
      if (!email) {
        console.log('⚠️ Destinatario sin email, abriendo modal de captura');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (respCliente?.success) {
          setClienteParaActualizar({
            ...respCliente.data,
            // 🔧 GUARDAR INFO DEL DESTINATARIO SELECCIONADO
            _destinatarioSeleccionado: destinatarioActual
          });
          setDestinatarioParaModal(destinatarioActual); // Pasar destinatario al modal
          setTipoDatoFaltante('email');
          setCanalEnvio('Email');
          setExpedienteEnEspera({
            ...expediente,
            // 🔧 PRESERVAR DESTINATARIO PARA EL REINTENTO
            _destinatarioOriginal: destinatarioActual
          });
          setMostrarModalContacto(true);
        }
        return;
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

      // 📄 Obtener URL del recibo de pago del próximo pago pendiente (si existe)
      let reciboPagoUrl = null;
      if (expediente.recibos && Array.isArray(expediente.recibos)) {
        const reciboPendiente = expediente.recibos.find(r => r.recibo_pago_url && !r.fecha_pago_real);
        const reciboConRecibo = reciboPendiente || expediente.recibos.find(r => r.recibo_pago_url);
        if (reciboConRecibo) {
          try {
            const dataRecibo = await pdfService.obtenerReciboPagoURL(expediente.id, reciboConRecibo.numero_recibo, 86400);
            reciboPagoUrl = dataRecibo?.url || dataRecibo?.signed_url;
            console.log('✅ Recibo de pago incluido en póliza Email:', reciboPagoUrl?.substring(0, 50) + '...');
          } catch (e) { console.warn('⚠️ No se pudo obtener URL recibo de pago (Email):', e); }
        }
      }

      // Generar mensaje dinámico según el estado
      const { tipoMensaje, asunto, cuerpo } = notificacionesService.generarMensajeEmail(expediente, pdfUrl, reciboPagoUrl);

      // Opción 1: Usar mailto (cliente de correo local)
      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.location.href = mailtoUrl;
    
      // Registrar evento en el historial de trazabilidad (log único y completo)
      try {
        // 🔧 USAR NOMBRE PRESERVADO DESDE EL INICIO (no depende del estado actual)
        const nombreFinalDestinatario = nombreOriginalDestinatario || nombreDestinatario;
        
        console.log('🔍 DEBUG Log Email:', {
          nombreOriginalDestinatario,
          nombreDestinatario,
          nombreFinalDestinatario,
          email
        });
          
        await historialService.registrarEnvioDocumento(
          expediente.id,
          expediente.cliente_id,
          'Email',
          { nombre: nombreFinalDestinatario, contacto: email },
          cuerpo,
          pdfUrl,
          { 
            compania: expediente.compania,
            numero_poliza: expediente.numero_poliza,
            tipo_pago: expediente.tipo_pago
          }
        );
        console.log('✅ Evento registrado en historial de trazabilidad (Email)');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
    
      // 🔥 Actualizar la etapa: Si está "Emitida", siempre avanzar a "Enviada al Cliente"
      if (expediente.etapa_activa === 'Emitida') {
        await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
        toast.success('✅ Póliza enviada por Email.\n📬 Etapa avanzada a "Enviada al Cliente"');
      } else if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.RENOVACION_EMISION || expediente.etapa_activa === 'Renovación Emitida') {
        if (expediente.etapa_activa === 'Renovación Emitida') {
          await cambiarEstadoExpediente(expediente.id, 'Renovación Enviada');
          await historialService.registrarRenovacionEnviadaCliente(
            expediente,
            'Email',
            { nombre: nombreFinalDestinatario, contacto: email }
          );
          toast.success('✅ Renovación enviada por Email.\n📬 Etapa avanzada a "Renovación Enviada"');
        } else {
          toast.success('✅ Renovación enviada por Email');
        }
      } else {
        toast.success('✅ Mensaje enviado por Email');
      }
      
      // 🔄 Recargar historial automáticamente después de compartir póliza
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada (compartir póliza Email)');
      }, 1500);
    
    } catch (error) {
      console.error('Error al compartir por Email:', error);
      toast.error('Error al compartir por Email. Intenta nuevamente.');
    }
  }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setMostrarModalContacto]);

  /**
   * Enviar aviso de pago por WhatsApp
   */
  const enviarAvisoPagoWhatsApp = useCallback(async (pago, expediente, destinatarioForzado = null) => {
    try {
      // 🔧 FIX: Usar destinatarioForzado primero, luego destinatarioCompartirSeleccionado, luego destinatarioSeleccionado
      const destinatarioActual = destinatarioForzado || destinatarioCompartirSeleccionado || destinatarioSeleccionado;
      let telefono, nombreDestinatario;
      
      console.log('🔍 DEBUG enviarAvisoPagoWhatsApp - destinatarioActual:', {
        destinatarioActual,
        telefono: destinatarioActual?.telefono,
        nombre: destinatarioActual?.nombre,
        fuente: destinatarioForzado ? 'forzado' : destinatarioCompartirSeleccionado ? 'modal_compartir' : destinatarioSeleccionado ? 'selector_aviso' : 'ninguno'
      });
      
      if (destinatarioActual) {
        telefono = destinatarioActual.telefono;
        nombreDestinatario = destinatarioActual.nombre;
        console.log('📱 Usando destinatario seleccionado:', { nombre: nombreDestinatario, telefono, tieneTelefono: !!telefono });
      }
      
      // 🔧 FIX: Si el destinatario seleccionado NO tiene teléfono, NO hacer fallback al cliente
      // En su lugar, abrir modal de captura (igual que compartirPorWhatsApp)
      if (!telefono) {
        console.log('⚠️ Destinatario sin teléfono móvil, abriendo modal de captura para aviso de pago');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        const cliente = respCliente?.success ? respCliente.data : null;
        
        // Construir nombre del destinatario si no existe
        if (!nombreDestinatario && cliente) {
          nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
            ? cliente.razonSocial || cliente.razon_social
            : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
        }
        
        setClienteParaActualizar({
          ...cliente,
          // 🔧 FIX: Guardar info del destinatario seleccionado para reintento automático
          _destinatarioSeleccionado: destinatarioActual || { nombre: nombreDestinatario, telefono: null }
        });
        setDestinatarioParaModal(destinatarioActual); // Pasar destinatario al modal
        setTipoDatoFaltante('telefono_movil');
        setCanalEnvio('WhatsApp');
        setExpedienteEnEspera(expediente);
        setPagoParaNotificar(pago);
        setMostrarModalContacto(true);
        return;
      }

      // Limpiar el número de teléfono
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Validar formato
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        console.log('⚠️ Número de teléfono inválido, abriendo modal de captura para aviso de pago');
        toast.error(`❌ El número de teléfono "${telefono}" no es válido para WhatsApp. Por favor actualízalo.`);
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        const cliente = respCliente?.success ? respCliente.data : null;
        setClienteParaActualizar({
          ...cliente,
          // 🔧 FIX: Guardar info del destinatario seleccionado para reintento automático
          _destinatarioSeleccionado: destinatarioActual || { nombre: nombreDestinatario, telefono: null }
        });
        setTipoDatoFaltante('telefono_movil');
        setCanalEnvio('WhatsApp');
        setExpedienteEnEspera(expediente);
        setPagoParaNotificar(pago);
        setMostrarModalContacto(true);
        // 🔧 FIX: NO llamar cerrarModalAvisoPago() porque borra pagoParaNotificar
        return;
      }
      
      // Generar mensaje personalizado
      // Verificar si está vencido comparando fecha o estado
      const fechaVencimiento = new Date(pago.fecha);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      fechaVencimiento.setHours(0, 0, 0, 0);
      
      const esVencido = pago.estado === 'Vencido' || fechaVencimiento < hoy;
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      const esPorVencer = !esVencido && diasRestantes >= 0 && diasRestantes <= 7;
      const esPendiente = !esVencido && diasRestantes > 7;
      const estadoFinal = esVencido ? 'Vencido' : esPorVencer ? 'Por Vencer' : 'Pendiente';
      
      console.log('📤 Enviando aviso de pago WhatsApp:', {
        numero: pago.numero,
        fecha: pago.fecha,
        estado_original: pago.estado,
        estado_calculado: estadoFinal,
        diasRestantes,
        esVencido,
        esPorVencer,
        esPendiente
      });
      
      // Construir mensaje según el estado
      let titulo, mensajeImportante;
      
      if (esVencido) {
        titulo = '🚨 *RECORDATORIO DE PAGO VENCIDO*';
        mensajeImportante = '⚠️ *IMPORTANTE:* Este pago está vencido. En caso de algún siniestro, *no tendremos cobertura de la compañía aseguradora*. Por favor, regulariza tu situación lo antes posible para reactivar tu protección.';
      } else if (esPorVencer) {
        titulo = '⏰ *AVISO: PAGO PRÓXIMO A VENCER*';
        mensajeImportante = `📅 *IMPORTANTE:* Tu pago vence ${diasRestantes === 0 ? '*HOY*' : diasRestantes === 1 ? 'mañana' : `en ${diasRestantes} días`}. Es fundamental registrar tu pago a tiempo para *no perder la cobertura* de tu póliza y mantener tu protección activa.`;
      } else {
        titulo = '📋 *AVISO DE PAGO*';
        mensajeImportante = '💡 *Te recordamos* que tienes un pago pendiente. Mantén tu póliza al día para garantizar tu cobertura sin interrupciones.';
      }
      
      // Construir resumen de todos los recibos
      let resumenRecibos = '';
      let todosRecibos = [];
      if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
        resumenRecibos = '\n📊 *ESTADO DE TODOS TUS PAGOS:*\n';
        
        expediente.recibos.forEach((recibo) => {
          const fechaRecibo = new Date(recibo.fecha_vencimiento || recibo.fecha);
          const hoyCalc = new Date();
          hoyCalc.setHours(0, 0, 0, 0);
          fechaRecibo.setHours(0, 0, 0, 0);
          const diffDias = Math.ceil((fechaRecibo - hoyCalc) / (1000 * 60 * 60 * 24));
          
          let icono, estadoRecibo, detalle;
          
          // ✅ CORREGIDO: Verificar si está pagado por fecha_pago_real
          if (recibo.fecha_pago_real) {
            icono = '✅';
            estadoRecibo = 'PAGADO';
            detalle = ` (pagado ${utils.formatearFecha(recibo.fecha_pago_real, 'corta')})`;
          } else if (diffDias < 0) {
            icono = '🚨';
            estadoRecibo = 'VENCIDO';
            detalle = ` (hace ${Math.abs(diffDias)} día${Math.abs(diffDias) !== 1 ? 's' : ''})`;
          } else if (diffDias <= 5) {
            icono = '⏰';
            estadoRecibo = 'Por vencer';
            detalle = ` (${diffDias === 0 ? 'vence HOY' : `vence en ${diffDias} día${diffDias !== 1 ? 's' : ''}`})`;
          } else {
            icono = '⏳';
            estadoRecibo = 'Pendiente';
            detalle = ` (vence ${utils.formatearFecha(recibo.fecha_vencimiento || recibo.fecha, 'corta')})`;
          }
          
          resumenRecibos += `${icono} Pago ${recibo.numero_recibo}: ${estadoRecibo}${detalle}\n`;
          
          todosRecibos.push({
            numero: recibo.numero_recibo,
            estatus: estadoRecibo,
            fecha: recibo.fecha_vencimiento || recibo.fecha,
            monto: recibo.monto,
            dias_restantes: diffDias
          });
        });
      }
      
      // 📄 Obtener URL firmada del recibo de pago de aseguradora
      // Siempre intentar obtener del backend, sin depender del campo local recibo_pago_url
      let reciboPagoUrl = null;
      let polizaPdfUrl = null;
      try {
        const dataRecibo = await pdfService.obtenerReciboPagoURL(expediente.id, pago.numero, 86400);
        reciboPagoUrl = dataRecibo?.url || dataRecibo?.signed_url;
        if (reciboPagoUrl) {
          console.log('✅ URL de recibo de pago obtenida:', reciboPagoUrl?.substring(0, 50) + '...');
        }
      } catch (errorRecibo) {
        console.warn('⚠️ No se encontró recibo de pago en S3, intentando póliza como fallback:', errorRecibo?.message);
      }

      // 📄 Fallback: Si no hay recibo de pago, incluir PDF de la póliza
      if (!reciboPagoUrl && expediente.pdf_key) {
        try {
          const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400);
          polizaPdfUrl = pdfData?.signed_url;
          console.log('ℹ️ Recibo no disponible, se adjunta póliza como respaldo:', polizaPdfUrl?.substring(0, 50) + '...');
        } catch (errorPdf) {
          console.warn('⚠️ No se pudo obtener URL de la póliza:', errorPdf);
        }
      }

      const mensaje = `Hola ${nombreDestinatario},\n\n` +
        `${titulo}\n\n` +
        `Póliza: *${expediente.numero_poliza || 'Sin número'}*\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `*Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}*\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: *$${utils.formatearMoneda ? utils.formatearMoneda(pago.monto) : pago.monto}*\n` +
        `Estado: ${estadoFinal}\n` +
        `${resumenRecibos}\n` +
        `${mensajeImportante}\n\n` +
        (reciboPagoUrl ? `📄 *Descarga tu recibo de pago aquí:*\n👉 ${reciboPagoUrl}\n\n` : '') +
        (polizaPdfUrl ? `📄 *Descarga tu póliza aquí:*\n👉 ${polizaPdfUrl}\n\n` : '') +
        `Para cualquier duda o realizar tu pago, estamos a tus órdenes.\n\n` +
        `Saludos cordiales`;
      
      // Crear URL de WhatsApp
      const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
      
      // Abrir WhatsApp
      window.open(url, '_blank');
      
      // Registrar la notificación en el sistema de notificaciones
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.WHATSAPP,
          tipo_mensaje: esVencido 
            ? notificacionesService.TIPOS_MENSAJE.PAGO_VENCIDO 
            : notificacionesService.TIPOS_MENSAJE.RECORDATORIO_PAGO,
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          mensaje: mensaje,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: pago.estado,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación de pago registrada');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
      }
      
      // Registrar evento en el historial de trazabilidad
      try {
        // 🆕 Determinar tipo de evento según estado del pago
        let tipoEvento;
        if (esVencido) {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_VENCIDO_ENVIADO;
        } else if (esPorVencer) {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_POR_VENCER_ENVIADO;
        } else {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_PENDIENTE_ENVIADO;
        }
        
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: tipoEvento,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por WhatsApp (${telefono})`,
          metodo_contacto: 'WhatsApp',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          documento_url: reciboPagoUrl || polizaPdfUrl || null,
          datos_adicionales: {
            canal: 'WhatsApp',
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'vencido' : esPorVencer ? 'por_vencer' : 'pendiente',
            resumen_recibos: todosRecibos
          }
        });
        console.log('✅ Evento de pago registrado en trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      toast.success(`✅ ${esVencido ? 'Recordatorio' : 'Aviso'} enviado por WhatsApp a ${nombreDestinatario}`);
      cerrarModalAvisoPago();
      
      // Recargar historial automáticamente después de 1.5 segundos
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada');
      }, 1500);
      
    } catch (error) {
      console.error('Error al enviar aviso por WhatsApp:', error);
      toast.error('Error al enviar aviso por WhatsApp');
    }
  }, [cerrarModalAvisoPago, destinatarioCompartirSeleccionado, destinatarioSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setPagoParaNotificar, setMostrarModalContacto, utils]);

  /**
   * Enviar aviso de pago por Email
   */
  const enviarAvisoPagoEmail = useCallback(async (pago, expediente, destinatarioForzado = null) => {
    try {
      // 🔧 FIX: Usar destinatarioForzado primero, luego destinatarioCompartirSeleccionado, luego destinatarioSeleccionado
      const destinatarioActual = destinatarioForzado || destinatarioCompartirSeleccionado || destinatarioSeleccionado;
      let email, nombreDestinatario;
      
      console.log('🔍 DEBUG enviarAvisoPagoEmail - destinatarioActual:', {
        destinatarioActual,
        email: destinatarioActual?.email,
        nombre: destinatarioActual?.nombre,
        fuente: destinatarioForzado ? 'forzado' : destinatarioCompartirSeleccionado ? 'modal_compartir' : destinatarioSeleccionado ? 'selector_aviso' : 'ninguno'
      });
      
      if (destinatarioActual) {
        email = destinatarioActual.email;
        nombreDestinatario = destinatarioActual.nombre;
        console.log('📧 Usando destinatario seleccionado:', { nombre: nombreDestinatario, email, tieneEmail: !!email });
      }
      
      // 🔧 FIX: Si el destinatario seleccionado NO tiene email, NO hacer fallback al cliente
      // En su lugar, abrir modal de captura (igual que compartirPorEmail)
      if (!email) {
        console.log('⚠️ Destinatario sin email, abriendo modal de captura para aviso de pago');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        const cliente = respCliente?.success ? respCliente.data : null;
        
        // Construir nombre del destinatario si no existe
        if (!nombreDestinatario && cliente) {
          nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
            ? cliente.razonSocial || cliente.razon_social
            : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
        }
        
        setClienteParaActualizar({
          ...cliente,
          // 🔧 FIX: Guardar info del destinatario seleccionado para reintento automático
          _destinatarioSeleccionado: destinatarioActual || { nombre: nombreDestinatario, email: null }
        });
        setDestinatarioParaModal(destinatarioActual); // Pasar destinatario al modal
        setTipoDatoFaltante('email');
        setCanalEnvio('Email');
        setExpedienteEnEspera(expediente);
        setPagoParaNotificar(pago);
        setMostrarModalContacto(true);
        return;
      }
      
      // Generar mensaje personalizado
      // Verificar si está vencido comparando fecha o estado
      const fechaVencimiento = new Date(pago.fecha);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      fechaVencimiento.setHours(0, 0, 0, 0);
      
      const esVencido = pago.estado === 'Vencido' || fechaVencimiento < hoy;
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      const esPorVencer = !esVencido && diasRestantes >= 0 && diasRestantes <= 7;
      const esPendiente = !esVencido && diasRestantes > 7;
      const estadoFinal = esVencido ? 'Vencido' : esPorVencer ? 'Por Vencer' : 'Pendiente';
      
      console.log('📧 Enviando aviso de pago Email:', {
        numero: pago.numero,
        fecha: pago.fecha,
        estado_original: pago.estado,
        estado_calculado: estadoFinal,
        diasRestantes,
        esVencido,
        esPorVencer
      });
      
      // Construir asunto y mensaje según el estado
      let asunto, titulo, mensajeImportante;
      
      if (esVencido) {
        asunto = `🚨 URGENTE: Pago Vencido - Póliza ${expediente.numero_poliza}`;
        titulo = 'RECORDATORIO DE PAGO VENCIDO';
        mensajeImportante = `⚠️ IMPORTANTE: Este pago está vencido. En caso de presentarse algún siniestro, NO TENDREMOS COBERTURA de la compañía aseguradora. Le solicitamos regularizar su situación lo antes posible para reactivar su protección y evitar inconvenientes.`;
      } else if (esPorVencer) {
        asunto = `⏰ Aviso: Pago Próximo a Vencer - Póliza ${expediente.numero_poliza}`;
        titulo = 'AVISO: PAGO PRÓXIMO A VENCER';
        mensajeImportante = `📅 IMPORTANTE: Su pago vence ${diasRestantes === 0 ? 'HOY' : diasRestantes === 1 ? 'mañana' : `en ${diasRestantes} días`}. Es fundamental realizar su pago en tiempo y forma para NO PERDER LA COBERTURA de su póliza y mantener su protección activa sin interrupciones.`;
      } else {
        asunto = `📋 Aviso de Pago - Póliza ${expediente.numero_poliza}`;
        titulo = 'AVISO DE PAGO';
        mensajeImportante = `Le recordamos que tiene un pago pendiente. Mantener su póliza al día garantiza su cobertura sin interrupciones.`;
      }
      
      // Construir resumen de todos los recibos (igual que WhatsApp)
      let resumenRecibos = '';
      let todosRecibos = [];
      if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
        resumenRecibos = '\n📊 ESTADO DE TODOS LOS PAGOS:\n';
        
        expediente.recibos.forEach((recibo) => {
          const fechaRecibo = new Date(recibo.fecha_vencimiento || recibo.fecha);
          const hoyCalc = new Date();
          hoyCalc.setHours(0, 0, 0, 0);
          fechaRecibo.setHours(0, 0, 0, 0);
          const diffDias = Math.ceil((fechaRecibo - hoyCalc) / (1000 * 60 * 60 * 24));
          
          let icono, estadoRecibo, detalle;
          
          // ✅ CORREGIDO: Verificar si está pagado por fecha_pago_real (Email)
          if (recibo.fecha_pago_real) {
            icono = '✅';
            estadoRecibo = 'PAGADO';
            detalle = ` (pagado ${utils.formatearFecha(recibo.fecha_pago_real, 'corta')})`;
          } else if (diffDias < 0) {
            icono = '🚨';
            estadoRecibo = 'VENCIDO';
            detalle = ` (hace ${Math.abs(diffDias)} día${Math.abs(diffDias) !== 1 ? 's' : ''})`;
          } else if (diffDias <= 5) {
            icono = '⏰';
            estadoRecibo = 'Por vencer';
            detalle = ` (${diffDias === 0 ? 'vence HOY' : `vence en ${diffDias} día${diffDias !== 1 ? 's' : ''}`})`;
          } else {
            icono = '⏳';
            estadoRecibo = 'Pendiente';
            detalle = ` (vence ${utils.formatearFecha(recibo.fecha_vencimiento || recibo.fecha, 'corta')})`;
          }
          
          resumenRecibos += `${icono} Pago ${recibo.numero_recibo}: ${estadoRecibo}${detalle}\n`;
          
          todosRecibos.push({
            numero: recibo.numero_recibo,
            estatus: estadoRecibo,
            fecha: recibo.fecha_vencimiento || recibo.fecha,
            monto: recibo.monto,
            dias_restantes: diffDias
          });
        });
      }
      
      // 📄 Obtener URL firmada del recibo de pago de aseguradora
      // Siempre intentar obtener del backend, sin depender del campo local recibo_pago_url
      let reciboPagoUrl = null;
      let polizaPdfUrl = null;
      try {
        const dataRecibo = await pdfService.obtenerReciboPagoURL(expediente.id, pago.numero, 86400);
        reciboPagoUrl = dataRecibo?.url || dataRecibo?.signed_url;
        if (reciboPagoUrl) {
          console.log('✅ URL de recibo de pago (Email) obtenida:', reciboPagoUrl?.substring(0, 50) + '...');
        }
      } catch (errorRecibo) {
        console.warn('⚠️ No se encontró recibo de pago en S3 (Email), intentando póliza como fallback:', errorRecibo?.message);
      }

      // 📄 Fallback: Si no hay recibo de pago, incluir PDF de la póliza
      if (!reciboPagoUrl && expediente.pdf_key) {
        try {
          const pdfData = await pdfService.obtenerURLFirmadaPDF(expediente.id, 86400);
          polizaPdfUrl = pdfData?.signed_url;
          console.log('ℹ️ Recibo no disponible (Email), se adjunta póliza como respaldo:', polizaPdfUrl?.substring(0, 50) + '...');
        } catch (errorPdf) {
          console.warn('⚠️ No se pudo obtener URL de la póliza (Email):', errorPdf);
        }
      }

      const cuerpo = `Estimado/a ${nombreDestinatario},\n\n` +
        `${titulo}\n\n` +
        `Póliza: ${expediente.numero_poliza || 'Sin número'}\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: $${utils.formatearMoneda ? utils.formatearMoneda(pago.monto) : pago.monto}\n` +
        `Estado: ${estadoFinal}\n` +
        `${resumenRecibos}\n` +
        `${mensajeImportante}\n\n` +
        (reciboPagoUrl ? `📄 Descargue su recibo de pago aquí:\n${reciboPagoUrl}\n\n` : '') +
        (polizaPdfUrl ? `📄 Descargue su póliza aquí:\n${polizaPdfUrl}\n\n` : '') +
        `Para realizar su pago o cualquier aclaración, estamos a sus órdenes.\n\n` +
        `Saludos cordiales`;
      
      // Registrar la notificación en el sistema de notificaciones
      try {
        await notificacionesService.registrarNotificacion({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_notificacion: notificacionesService.TIPOS_NOTIFICACION.EMAIL,
          tipo_mensaje: esVencido 
            ? notificacionesService.TIPOS_MENSAJE.PAGO_VENCIDO 
            : notificacionesService.TIPOS_MENSAJE.RECORDATORIO_PAGO,
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: email,
          asunto: asunto,
          mensaje: cuerpo,
          numero_poliza: expediente.numero_poliza,
          compania: expediente.compania,
          producto: expediente.producto,
          estatus_pago: pago.estado,
          estado_envio: 'enviado'
        });
        console.log('✅ Notificación de pago registrada');
      } catch (error) {
        console.error('⚠️ Error al registrar notificación (no crítico):', error);
      }
      
      // Registrar evento en el historial de trazabilidad
      try {
        // 🆕 Determinar tipo de evento según estado del pago (Email)
        let tipoEvento;
        if (esVencido) {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_VENCIDO_ENVIADO;
        } else if (esPorVencer) {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_POR_VENCER_ENVIADO;
        } else {
          tipoEvento = historialService.TIPOS_EVENTO.AVISO_PAGO_PENDIENTE_ENVIADO;
        }
        
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: tipoEvento,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por Email (${email})`,
          metodo_contacto: 'Email',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: email,
          documento_url: reciboPagoUrl || polizaPdfUrl || null,
          datos_adicionales: {
            canal: 'Email',
            asunto: asunto,
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'vencido' : esPorVencer ? 'por_vencer' : 'pendiente',
            resumen_recibos: todosRecibos
          }
        });
        console.log('✅ Evento de pago registrado en trazabilidad');
      } catch (error) {
        console.error('⚠️ Error al registrar en historial de trazabilidad:', error);
      }
      
      // Abrir cliente de email con mailto
      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.location.href = mailtoUrl;
      
      toast.success(`✅ ${esVencido ? 'Recordatorio' : 'Aviso'} enviado por Email a ${nombreDestinatario}`);
      cerrarModalAvisoPago();
      
      // Recargar historial automáticamente después de 1.5 segundos
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('recargarHistorial', { 
          detail: { expedienteId: expediente.id } 
        }));
        console.log('🔄 Recarga automática del historial solicitada');
      }, 1500);
      
    } catch (error) {
      console.error('Error al enviar aviso por Email:', error);
      toast.error('Error al enviar aviso por Email');
    }
  }, [cerrarModalAvisoPago, destinatarioCompartirSeleccionado, destinatarioSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setPagoParaNotificar, setMostrarModalContacto, utils]);

  return {
    compartirPorWhatsApp,
    compartirPorEmail,
    enviarAvisoPagoWhatsApp,
    enviarAvisoPagoEmail,
    actualizarCampoCliente
  };
};

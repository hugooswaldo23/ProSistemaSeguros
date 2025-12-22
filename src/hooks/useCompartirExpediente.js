import { useCallback } from 'react';
import toast from 'react-hot-toast';
import * as clientesService from '../services/clientesService';
import * as pdfService from '../services/pdfService';
import * as notificacionesService from '../services/notificacionesService';
import * as historialService from '../services/historialExpedienteService';

/**
 * Custom Hook para manejar la lógica de compartir expedientes
 * por WhatsApp y Email (pólizas y avisos de pago)
 */
export const useCompartirExpediente = ({
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
}) => {
  /**
   * Compartir póliza completa por WhatsApp
   */
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
      
      // Si no tiene teléfono, abrir modal para capturarlo
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
        return;
      }

      // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Validar que el número tenga al menos 10 dígitos y solo contenga números
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
      }

      // Registrar evento en el historial de trazabilidad
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
  }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setMostrarModalContacto, utils]);

  /**
   * Compartir póliza completa por Email
   */
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
      
      // Si no tiene email, abrir modal para capturarlo
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

      // Registrar evento en el historial de trazabilidad
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
    
      // Actualizar la etapa a "Enviada al Cliente" solo si es emisión
      if (tipoMensaje === notificacionesService.TIPOS_MENSAJE.EMISION) {
        await cambiarEstadoExpediente(expediente.id, 'Enviada al Cliente');
      }
    
    } catch (error) {
      console.error('Error al compartir por Email:', error);
      toast.error('Error al compartir por Email. Intenta nuevamente.');
    }
  }, [cambiarEstadoExpediente, destinatarioCompartirSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setMostrarModalContacto]);

  /**
   * Enviar aviso de pago por WhatsApp
   */
  const enviarAvisoPagoWhatsApp = useCallback(async (pago, expediente) => {
    try {
      // Usar destinatario seleccionado si está disponible, sino obtener del cliente
      let telefono, nombreDestinatario;
      
      if (destinatarioSeleccionado) {
        telefono = destinatarioSeleccionado.telefono;
        nombreDestinatario = destinatarioSeleccionado.nombre;
      } else {
        // Obtener datos del cliente (fallback cuando no hay destinatario seleccionado)
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (!respCliente?.success) {
          toast.error('No se pudo obtener la información del cliente');
          return;
        }
        const cliente = respCliente.data;
        telefono = cliente?.contacto_telefono_movil || cliente?.telefonoMovil || cliente?.telefono_movil;
        nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
      }
      
      // Si no tiene teléfono, abrir modal para capturarlo
      if (!telefono) {
        console.log('⚠️ Destinatario sin teléfono móvil, abriendo modal de captura para aviso de pago');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        const cliente = respCliente?.success ? respCliente.data : null;
        setClienteParaActualizar(cliente);
        setTipoDatoFaltante('telefono_movil');
        setCanalEnvio('WhatsApp');
        setExpedienteEnEspera(expediente);
        setPagoParaNotificar(pago);
        setMostrarModalContacto(true);
        cerrarModalAvisoPago();
        return;
      }

      // Limpiar el número de teléfono
      const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');
      
      // Validar formato
      if (!/^\d{10,15}$/.test(telefonoLimpio)) {
        toast.error(`El número de teléfono "${telefono}" no es válido para WhatsApp`);
        return;
      }
      
      // Generar mensaje personalizado
      const esVencido = pago.estado === 'Vencido';
      
      const mensaje = `Hola ${nombreDestinatario},\n\n` +
        `${esVencido ? '⚠️ *RECORDATORIO DE PAGO VENCIDO*' : '📋 *AVISO DE PAGO PRÓXIMO*'}\n\n` +
        `Póliza: *${expediente.numero_poliza || 'Sin número'}*\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `*Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}*\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: *$${pago.monto}*\n` +
        `Estado: ${pago.estado}\n\n` +
        `${esVencido 
          ? '⚠️ *IMPORTANTE:* Este pago está vencido. En caso de algún siniestro, *no tendremos cobertura de la compañía aseguradora*. Por favor, regulariza tu situación lo antes posible para reactivar tu protección.' 
          : '📅 *IMPORTANTE:* Te recordamos que tu próximo pago está próximo a vencer. Es fundamental registrar tu pago a tiempo para *no perder la cobertura* de tu póliza y mantener tu protección activa.'
        }\n\n` +
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
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: esVencido 
            ? historialService.TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO 
            : historialService.TIPOS_EVENTO.AVISO_PAGO_ENVIADO,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por WhatsApp (${telefono})`,
          metodo_contacto: 'WhatsApp',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: telefono,
          datos_adicionales: {
            canal: 'WhatsApp',
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'recordatorio' : 'aviso'
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
  }, [cerrarModalAvisoPago, destinatarioSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setPagoParaNotificar, setMostrarModalContacto, utils]);

  /**
   * Enviar aviso de pago por Email
   */
  const enviarAvisoPagoEmail = useCallback(async (pago, expediente) => {
    try {
      // Usar destinatario seleccionado si está disponible, sino obtener del cliente
      let email, nombreDestinatario;
      
      if (destinatarioSeleccionado) {
        email = destinatarioSeleccionado.email;
        nombreDestinatario = destinatarioSeleccionado.nombre;
      } else {
        // Obtener datos del cliente (fallback cuando no hay destinatario seleccionado)
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        if (!respCliente?.success) {
          toast.error('No se pudo obtener la información del cliente');
          return;
        }
        const cliente = respCliente.data;
        email = cliente?.contacto_email || cliente?.email;
        nombreDestinatario = cliente.tipoPersona === 'Persona Moral'
          ? cliente.razonSocial || cliente.razon_social
          : `${cliente.nombre || ''} ${cliente.apellidoPaterno || cliente.apellido_paterno || ''}`.trim();
      }
      
      // Si no tiene email, abrir modal para capturarlo
      if (!email) {
        console.log('⚠️ Destinatario sin email, abriendo modal de captura para aviso de pago');
        const respCliente = await clientesService.obtenerClientePorId(expediente.cliente_id);
        const cliente = respCliente?.success ? respCliente.data : null;
        setClienteParaActualizar(cliente);
        setTipoDatoFaltante('email');
        setCanalEnvio('Email');
        setExpedienteEnEspera(expediente);
        setPagoParaNotificar(pago);
        setMostrarModalContacto(true);
        cerrarModalAvisoPago();
        return;
      }
      
      // Generar mensaje personalizado
      const esVencido = pago.estado === 'Vencido';
      
      const asunto = esVencido 
        ? `⚠️ Recordatorio: Pago Vencido - Póliza ${expediente.numero_poliza}`
        : `📋 Aviso: Próximo Pago - Póliza ${expediente.numero_poliza}`;
      
      const cuerpo = `Estimado/a ${nombreDestinatario},\n\n` +
        `${esVencido ? 'Le recordamos que tiene un pago vencido:' : 'Le notificamos sobre su próximo pago:'}\n\n` +
        `Póliza: ${expediente.numero_poliza || 'Sin número'}\n` +
        `Aseguradora: ${expediente.compania || 'N/A'}\n\n` +
        `Pago #${pago.numero}${pago.totalPagos ? ` de ${pago.totalPagos}` : ''}\n` +
        `Fecha de vencimiento: ${utils.formatearFecha(pago.fecha, 'larga')}\n` +
        `Monto: $${pago.monto}\n` +
        `Estado: ${pago.estado}\n\n` +
        `${esVencido 
          ? '⚠️ IMPORTANTE: Este pago está vencido. En caso de presentarse algún siniestro, NO TENDREMOS COBERTURA de la compañía aseguradora. Le solicitamos regularizar su situación lo antes posible para reactivar su protección y evitar inconvenientes.' 
          : '📋 IMPORTANTE: Le recordamos que este pago está próximo a vencer. Es fundamental realizar su pago en tiempo y forma para NO PERDER LA COBERTURA de su póliza y mantener su protección activa sin interrupciones.'
        }\n\n` +
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
        await historialService.registrarEvento({
          expediente_id: expediente.id,
          cliente_id: expediente.cliente_id,
          tipo_evento: esVencido 
            ? historialService.TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO 
            : historialService.TIPOS_EVENTO.AVISO_PAGO_ENVIADO,
          usuario_nombre: 'Sistema',
          descripcion: `Enviado a ${nombreDestinatario} por Email (${email})`,
          metodo_contacto: 'Email',
          destinatario_nombre: nombreDestinatario,
          destinatario_contacto: email,
          datos_adicionales: {
            canal: 'Email',
            asunto: asunto,
            numero_poliza: expediente.numero_poliza,
            numero_pago: pago.numero,
            total_pagos: pago.totalPagos || null,
            fecha_pago: pago.fecha,
            monto: pago.monto,
            estado_pago: pago.estado,
            tipo_aviso: esVencido ? 'recordatorio' : 'aviso'
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
  }, [cerrarModalAvisoPago, destinatarioSeleccionado, setClienteParaActualizar, setTipoDatoFaltante, setCanalEnvio, setExpedienteEnEspera, setPagoParaNotificar, setMostrarModalContacto, utils]);

  return {
    compartirPorWhatsApp,
    compartirPorEmail,
    enviarAvisoPagoWhatsApp,
    enviarAvisoPagoEmail
  };
};

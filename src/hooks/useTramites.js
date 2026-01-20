import { useState, useEffect, useCallback } from 'react';
import { 
  obtenerTramites, 
  crearTramite, 
  actualizarTramite, 
  eliminarTramite,
  obtenerTramitesPorEstatus,
  obtenerTramitesPorPrioridad,
  obtenerTramitesVencidos
} from '../services/tramitesService';

export const useTramites = () => {
  const [tramites, setTramites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar trámites
  const cargarTramites = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const resultado = await obtenerTramites();
    
    if (resultado.success) {
      setTramites(resultado.data);
    } else {
      setError(resultado.error);
    }
    
    setLoading(false);
  }, []);

  // Crear trámite
  const crear = useCallback(async (tramite) => {
    const resultado = await crearTramite(tramite);
    
    if (resultado.success) {
      await cargarTramites(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarTramites]);

  // Actualizar trámite
  const actualizar = useCallback(async (id, tramite) => {
    const resultado = await actualizarTramite(id, tramite);
    
    if (resultado.success) {
      await cargarTramites(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarTramites]);

  // Eliminar trámite
  const eliminar = useCallback(async (id) => {
    const resultado = await eliminarTramite(id);
    
    if (resultado.success) {
      await cargarTramites(); // Recargar lista
      return { success: true };
    } else {
      return { success: false, error: resultado.error };
    }
  }, [cargarTramites]);

  // Generar código automático
  const generarCodigo = useCallback(() => {
    if (tramites.length === 0) {
      return 'TR001';
    }
    
    const numeros = tramites
      .map(tramite => {
        const match = tramite.codigo.match(/TR(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));
    
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    const siguienteNumero = maxNumero + 1;
    
    return `TR${siguienteNumero.toString().padStart(3, '0')}`;
  }, [tramites]);

  // Obtener estadísticas
  const obtenerEstadisticas = useCallback(() => {
    const total = tramites.length;
    const pendientes = tramites.filter(t => t.estatus === 'Pendiente').length;
    const enProceso = tramites.filter(t => t.estatus === 'En proceso').length;
    const completados = tramites.filter(t => t.estatus === 'Completado').length;
    const cancelados = tramites.filter(t => t.estatus === 'Cancelado').length;
    const rechazados = tramites.filter(t => t.estatus === 'Rechazado').length;
    
    const hoy = new Date();
    const vencidos = tramites.filter(t => 
      t.fechaLimite && 
      new Date(t.fechaLimite) < hoy && 
      t.estatus !== 'Completado' && 
      t.estatus !== 'Cancelado'
    ).length;
    
    const prioridadAlta = tramites.filter(t => t.prioridad === 'Alta').length;
    const prioridadMedia = tramites.filter(t => t.prioridad === 'Media').length;
    const prioridadBaja = tramites.filter(t => t.prioridad === 'Baja').length;

    return {
      total,
      pendientes,
      enProceso,
      completados,
      cancelados,
      rechazados,
      vencidos,
      prioridadAlta,
      prioridadMedia,
      prioridadBaja
    };
  }, [tramites]);

  // Filtrar por estatus
  const filtrarPorEstatus = useCallback(async (estatus) => {
    const resultado = await obtenerTramitesPorEstatus(estatus);
    return resultado.success ? resultado.data : [];
  }, []);

  // Filtrar por prioridad
  const filtrarPorPrioridad = useCallback(async (prioridad) => {
    const resultado = await obtenerTramitesPorPrioridad(prioridad);
    return resultado.success ? resultado.data : [];
  }, []);

  // Obtener vencidos
  const obtenerVencidos = useCallback(async () => {
    const resultado = await obtenerTramitesVencidos();
    return resultado.success ? resultado.data : [];
  }, []);

  // Enviar trámite a ejecutivo (WhatsApp o Email)
  const enviarAEjecutivo = useCallback((tramite, metodo = 'whatsapp') => {
    // Construir mensaje
    const mensaje = construirMensajeEjecutivo(tramite);
    
    if (metodo === 'whatsapp') {
      // Abrir WhatsApp Web con el mensaje
      const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    } else if (metodo === 'email') {
      // Abrir cliente de email
      const asunto = `Solicitud de Trámite ${tramite.codigo} - ${tramite.tipoTramite}`;
      const url = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    }
    
    return { success: true };
  }, []);

  // Construir mensaje para enviar al ejecutivo
  const construirMensajeEjecutivo = (tramite) => {
    const fechaLimite = tramite.fechaLimite 
      ? new Date(tramite.fechaLimite).toLocaleDateString('es-MX') 
      : 'Sin fecha límite';
    
    const mensaje = `🔔 *SOLICITUD DE TRÁMITE*

📋 *Código:* ${tramite.codigo || '-'}
📝 *Tipo:* ${tramite.tipoTramite || '-'}
⚡ *Prioridad:* ${tramite.prioridad || 'Normal'}
📅 *Fecha Límite:* ${fechaLimite}

👤 *Cliente:* ${tramite.clienteNombre || tramite.cliente || '-'}
📄 *Póliza:* ${tramite.numeroPoliza || tramite.expediente || '-'}
🏢 *Aseguradora:* ${tramite.aseguradora || '-'}
📦 *Producto:* ${tramite.tipoSeguro || '-'}

📝 *Descripción:*
${tramite.descripcion || 'Sin descripción'}

${tramite.observaciones ? `💬 *Observaciones:*\n${tramite.observaciones}` : ''}

Por favor, atender este trámite a la brevedad.

Saludos cordiales,
*DCPRO Administración* 🏢`;

    return mensaje;
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarTramites();
  }, [cargarTramites]);

  return {
    tramites,
    loading,
    error,
    cargarTramites,
    crear,
    actualizar,
    eliminar,
    generarCodigo,
    obtenerEstadisticas,
    filtrarPorEstatus,
    filtrarPorPrioridad,
    obtenerVencidos,
    enviarAEjecutivo,
    construirMensajeEjecutivo
  };
};
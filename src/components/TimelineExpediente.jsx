/**
 * ====================================================================
 * COMPONENTE: Timeline de Expediente
 * PROPÓSITO: Mostrar la trazabilidad completa usando tabla notificaciones
 * FECHA: 2025-11-12
 * ====================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText
} from 'lucide-react';
import { obtenerNotificacionesPorExpediente } from '../services/notificacionesService';
import * as historialService from '../services/historialExpedienteService';
import * as pdfService from '../services/pdfService';
import toast from 'react-hot-toast';

const TimelineExpediente = ({ expedienteId, expedienteData = null }) => {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [eventoExpandido, setEventoExpandido] = useState(null);

  // Cargar historial al montar
  useEffect(() => {
    cargarHistorial();
  }, [expedienteId]);

  // 🔄 Escuchar evento personalizado para recargar historial automáticamente
  useEffect(() => {
    const handleRecargarHistorial = (event) => {
      // Solo recargar si el evento es para este expediente
      if (event.detail?.expedienteId === expedienteId) {
        console.log('🔄 Recargando historial automáticamente...');
        cargarHistorial();
      }
    };

    window.addEventListener('recargarHistorial', handleRecargarHistorial);
    
    return () => {
      window.removeEventListener('recargarHistorial', handleRecargarHistorial);
    };
  }, [expedienteId]);

  const cargarHistorial = async () => {
    try {
      setCargando(true);
      setError(null);
      
      // 🎯 PRIORIDAD 1: Intentar cargar desde el nuevo sistema de historial
      try {
        const eventosHistorial = await historialService.obtenerHistorialExpediente(expedienteId);
        console.log('📋 Historial cargado desde nuevo sistema:', eventosHistorial);
        
        if (eventosHistorial && eventosHistorial.length > 0) {
          setHistorial(eventosHistorial);
          setCargando(false);
          return; // ✅ Usar el nuevo sistema si está disponible
        }
      } catch (errorHistorial) {
        console.warn('⚠️ Sistema de historial no disponible, usando notificaciones:', errorHistorial.message);
      }
      
      // 🔄 FALLBACK: Usar tabla de notificaciones (sistema legacy)
      const notificaciones = await obtenerNotificacionesPorExpediente(expedienteId);
      console.log('📋 Notificaciones cargadas (fallback):', notificaciones);
      
      // Si tampoco hay notificaciones, crear evento sintético de captura
      if (!notificaciones || notificaciones.length === 0) {
        // Crear evento temporal de captura si es un expediente nuevo
        const eventoCaptura = {
          id: 'temp-captura-' + expedienteId,
          expediente_id: expedienteId,
          tipo_evento: 'CAPTURA_MANUAL',
          fecha_evento: new Date().toISOString(),
          usuario_nombre: 'Sistema',
          descripcion: '⚠️ Historial temporal no disponible. Backend pendiente de implementación.',
          es_temporal: true
        };
        setHistorial([eventoCaptura]);
        setCargando(false);
        return;
      }
      
      // Convertir notificaciones a formato timeline (sin URLs en descripción)
      const eventosTimeline = notificaciones.map(notif => {
        // Limpiar descripción: quitar URLs largas
        let descripcionLimpia = '';
        if (notif.tipo_notificacion === 'whatsapp' || notif.tipo_notificacion === 'email') {
          // Para envíos, mostrar solo metadata relevante
          descripcionLimpia = `Póliza emitida • ${notif.compania || 'Aseguradora'}: ${notif.producto || 'Producto'} • Póliza #${notif.numero_poliza || 'N/A'}`;
        } else {
          descripcionLimpia = notif.mensaje || notif.asunto || '';
        }
        
        return {
          id: notif.id,
          expediente_id: notif.expediente_id,
          cliente_id: notif.cliente_id,
          tipo_evento: mapearTipoNotificacionAEvento(notif.tipo_notificacion, notif.tipo_mensaje),
          fecha_evento: notif.fecha_envio || notif.created_at,
          usuario_nombre: notif.enviado_por_nombre || 'Sistema',
          descripcion: descripcionLimpia,
          metodo_contacto: mapearTipoNotificacion(notif.tipo_notificacion),
          destinatario_nombre: notif.destinatario_nombre,
          destinatario_contacto: notif.destinatario_contacto,
          documento_url: notif.pdf_url,
          datos_adicionales: {
            numero_poliza: notif.numero_poliza,
            compania: notif.compania,
            producto: notif.producto,
            estatus_pago: notif.estatus_pago,
            estado_envio: notif.estado_envio
          }
        };
      });
      
      // ✅ Ya NO agregamos eventos sintéticos
      // Los eventos reales (captura, emisión, pago) vienen del sistema de historial
      
      // Ordenar por fecha descendente (más reciente primero), y si son iguales, por ID descendente
      eventosTimeline.sort((a, b) => {
        const fechaDiff = new Date(b.fecha_evento) - new Date(a.fecha_evento);
        if (fechaDiff !== 0) return fechaDiff;
        // Si las fechas son iguales, ordenar por ID (más reciente = ID mayor)
        return (b.id || 0) - (a.id || 0);
      });
      
      setHistorial(eventosTimeline);
    } catch (err) {
      console.error('Error al cargar historial:', err);
      setError('No se pudo cargar el historial del expediente');
    } finally {
      setCargando(false);
    }
  };

  // Mapear tipo_notificacion a nombre legible
  const mapearTipoNotificacion = (tipo) => {
    const mapa = {
      'whatsapp': 'WhatsApp',
      'email': 'Email',
      'sms': 'SMS'
    };
    return mapa[tipo] || tipo;
  };

  // Mapear tipo_notificacion + tipo_mensaje a tipo_evento
  const mapearTipoNotificacionAEvento = (tipoNotif, tipoMensaje) => {
    // Mapeo basado en tipo_mensaje
    const mapaMensajes = {
      'captura': 'CAPTURA_MANUAL', // Evento de captura
      'emision': tipoNotif === 'whatsapp' ? 'POLIZA_ENVIADA_WHATSAPP' : 'POLIZA_ENVIADA_EMAIL',
      'recordatorio_pago': 'RECORDATORIO_PAGO_ENVIADO',
      'pago_vencido': 'PAGO_VENCIDO',
      'pago_recibido': 'PAGO_REGISTRADO',
      'renovacion': 'POLIZA_RENOVADA',
      'cancelacion': 'POLIZA_CANCELADA',
      'modificacion': 'ENDOSO_APLICADO',
      'otro': 'NOTA_AGREGADA'
    };
    
    return mapaMensajes[tipoMensaje] || 'DOCUMENTO_ENVIADO';
  };

  // Obtener estilo (icono y color) para cada tipo de evento
  const obtenerEstiloEvento = (tipoEvento) => {
    return historialService.obtenerEstiloEvento(tipoEvento);
  };

  // Obtener título legible para cada tipo de evento
  const obtenerTituloEvento = (tipoEvento) => {
    return historialService.obtenerTituloEvento(tipoEvento);
  };

  // Filtrar historial
  const historialFiltrado = filtroTipo === 'todos' 
    ? historial.filter(evento => {
        // Omitir eventos de "datos actualizados" si solo es cambio de etapa sin modificaciones relevantes
        if (evento.tipo_evento === 'datos_actualizados' || evento.tipo_evento === 'DATOS_ACTUALIZADOS') {
          // Mostrar si tiene cambios significativos O si hay cambio de pago
          const cambios = evento.datos_adicionales?.cantidad_cambios || evento.datos_adicionales?.total_cambios || 0;
          const tieneCambioPago = evento.datos_adicionales?.cambio_pago || false;
          const tienePolizaCambios = evento.datos_adicionales?.poliza_cambios?.cambios_detallados && Object.keys(evento.datos_adicionales.poliza_cambios.cambios_detallados).length > 0;
          const tieneClienteCambios = evento.datos_adicionales?.cliente_cambios?.cambios_detallados && Object.keys(evento.datos_adicionales.cliente_cambios.cambios_detallados).length > 0;
          const tieneRecibosCambios = evento.datos_adicionales?.recibos_cambios?.cambios_detallados && evento.datos_adicionales.recibos_cambios.cambios_detallados.length > 0;
          return cambios > 0 || tieneCambioPago || tienePolizaCambios || tieneClienteCambios || tieneRecibosCambios;
        }
        return true; // Mostrar todos los demás eventos
      })
    : historial.filter(evento => {
        // Primero aplicar el filtro de eventos irrelevantes
        if (evento.tipo_evento === 'datos_actualizados' || evento.tipo_evento === 'DATOS_ACTUALIZADOS') {
          const cambios = evento.datos_adicionales?.cantidad_cambios || evento.datos_adicionales?.total_cambios || 0;
          const tieneCambioPago = evento.datos_adicionales?.cambio_pago || false;
          const tienePolizaCambios = evento.datos_adicionales?.poliza_cambios?.cambios_detallados && Object.keys(evento.datos_adicionales.poliza_cambios.cambios_detallados).length > 0;
          const tieneClienteCambios = evento.datos_adicionales?.cliente_cambios?.cambios_detallados && Object.keys(evento.datos_adicionales.cliente_cambios.cambios_detallados).length > 0;
          const tieneRecibosCambios = evento.datos_adicionales?.recibos_cambios?.cambios_detallados && evento.datos_adicionales.recibos_cambios.cambios_detallados.length > 0;
          if (cambios === 0 && !tieneCambioPago && !tienePolizaCambios && !tieneClienteCambios && !tieneRecibosCambios) return false;
        }
        
        // Luego aplicar filtro por categoría
        const tipo = evento.tipo_evento || '';
        if (filtroTipo === 'Emisión') {
          return tipo.includes('poliza_emitida') || tipo.includes('poliza_enviada') || tipo.includes('cotizacion') || tipo.includes('captura_extractor_pdf') || tipo.includes('captura_manual') || tipo.includes('emision_iniciada');
        }
        if (filtroTipo === 'Pagos') {
          return tipo.includes('pago');
        }
        if (filtroTipo === 'Comunicaciones') {
          return tipo.includes('enviada') || tipo.includes('documento');
        }
        return false;
      });

  // Formatear fecha
  const formatearFecha = (fechaISO) => {
    if (!fechaISO) return 'Sin fecha';
    
    // El backend envía la hora correcta del servidor en zona horaria México
    const fecha = new Date(fechaISO);
    
    if (isNaN(fecha.getTime())) return fechaISO;
    
    const hoy = new Date();
    const ayer = new Date(hoy); 
    ayer.setDate(ayer.getDate() - 1);
    
    const esMismoDia = fecha.toDateString() === hoy.toDateString();
    const esAyer = fecha.toDateString() === ayer.toDateString();
    
    const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    
    if (esMismoDia) return `Hoy ${hora}`;
    if (esAyer) return `Ayer ${hora}`;
    
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + hora;
  };

  // Formatear fechas en formato YYYY-MM-DD sin conversión de zona horaria
  const formatearFechaSinTZ = (fecha) => {
    if (!fecha || fecha === '(vacío)') return fecha;
    
    // Si la fecha está en formato YYYY-MM-DD, convertirla directamente a DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [year, month, day] = fecha.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Si incluye 'T' (ISO timestamp), extraer solo la parte de fecha y convertir
    if (fecha.includes('T')) {
      const [year, month, day] = fecha.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    
    return fecha;
  };

  // Exportar historial
  const exportarHistorial = () => {
    const datosExportar = historialFiltrado.map(evento => ({
      Fecha: formatearFecha(evento.fecha_evento),
      Evento: obtenerTituloEvento(evento.tipo_evento),
      Usuario: evento.usuario_nombre,
      Descripción: evento.descripcion,
      'Etapa Anterior': evento.etapa_anterior || 'N/A',
      'Etapa Nueva': evento.etapa_nueva || 'N/A',
      Contacto: evento.destinatario_contacto || 'N/A'
    }));

    const csv = [
      Object.keys(datosExportar[0]).join(','),
      ...datosExportar.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_expediente_${expedienteId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (cargando) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando historial...</span>
        </div>
        <p className="text-muted mt-3">Cargando historial del expediente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <strong>Error:</strong> {error}
        <button className="btn btn-sm btn-outline-danger ms-3" onClick={cargarHistorial}>
          Reintentar
        </button>
      </div>
    );
  }

  if (historial.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock size={40} className="text-muted mb-2" />
        <p className="text-muted mb-0">No hay eventos registrados</p>
        <small className="text-muted">Los eventos del ciclo de vida aparecerán aquí</small>
      </div>
    );
  }

  return (
    <div className="timeline-expediente">
      {/* Header compacto con info y filtros */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <small className="text-muted">
            {historialFiltrado.length} {historialFiltrado.length === 1 ? 'evento' : 'eventos'}
            {filtroTipo !== 'todos' && ` • Filtro: ${filtroTipo}`}
          </small>
        </div>
        
        <div className="d-flex gap-2">
          {/* Filtro por categoría */}
          <select 
            className="form-select form-select-sm"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ width: 'auto', fontSize: '0.85rem' }}
          >
            <option value="todos">📋 Todos</option>
            <option value="Cotización">📝 Cotización</option>
            <option value="Emisión">📄 Emisión</option>
            <option value="Pagos">💰 Pagos</option>
            <option value="Renovaciones">🔄 Renovaciones</option>
            <option value="Cancelaciones">🚫 Cancelaciones</option>
            <option value="Comunicaciones">📨 Comunicaciones</option>
          </select>

          {/* Botón exportar */}
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={exportarHistorial}
            title="Exportar a CSV"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Timeline compacto - ORDEN CRONOLÓGICO INVERSO (más reciente primero) */}
      <div className="timeline" style={{ position: 'relative' }}>
        {historialFiltrado.map((evento, index) => {
          const estilo = obtenerEstiloEvento(evento.tipo_evento);
          const titulo = obtenerTituloEvento(evento.tipo_evento);
          const expandido = eventoExpandido === evento.id;

          return (
            <div 
              key={evento.id} 
              className="timeline-item position-relative"
              style={{ 
                paddingLeft: '48px',
                paddingBottom: index < historialFiltrado.length - 1 ? '1rem' : '0',
                borderLeft: index < historialFiltrado.length - 1 ? '2px solid #e9ecef' : 'none',
                marginLeft: '18px'
              }}
            >
              {/* Icono del evento - posicionado sobre la línea */}
              <div 
                className="position-absolute"
                style={{
                  left: '-20px',
                  top: '0',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: estilo.bgColor,
                  border: `3px solid ${estilo.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  zIndex: 1
                }}
                title={titulo}
              >
                {estilo.icon}
              </div>

              {/* Contenido compacto del evento */}
              <div className="card border-0 shadow-sm mb-2" style={{ borderLeft: `3px solid ${estilo.color}` }}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      {/* Línea 1: Título del evento */}
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong style={{ color: estilo.color, fontSize: '0.95rem' }}>
                          {titulo}
                        </strong>
                      </div>
                      
                      {/* Vista mejorada para eventos de captura Y edición */}
                      {(evento.tipo_evento === 'captura_manual' || evento.tipo_evento === 'captura_extractor_pdf' || evento.tipo_evento === 'edicion_manual_expediente') ? (
                        <div className="mb-1">
                          {(() => {
                            // Helper functions
                            const limpiarValor = (valor) => {
                              if (!valor || valor === 'vacío') return valor;
                              if (typeof valor === 'string' && valor.includes('T')) return valor.split('T')[0];
                              return valor;
                            };
                            
                            // Construir mapa de cambios para búsqueda rápida
                            const cambiosMap = {};
                            
                            // Cambios de cliente
                            if (evento.datos_adicionales?.cliente_cambios?.cambios_detallados) {
                              Object.entries(evento.datos_adicionales.cliente_cambios.cambios_detallados).forEach(([campo, cambio]) => {
                                cambiosMap[campo] = cambio;
                              });
                            }
                            
                            // Cambios de póliza
                            if (evento.datos_adicionales?.poliza_cambios?.cambios_detallados) {
                              Object.entries(evento.datos_adicionales.poliza_cambios.cambios_detallados).forEach(([campo, cambio]) => {
                                cambiosMap[campo] = cambio;
                              });
                            }
                            
                            // ✨ NUEVO: Cambios manuales post-PDF
                            if (evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles) {
                              Object.entries(evento.datos_adicionales.cambios_manuales.campos_editados.detalles).forEach(([campo, cambio]) => {
                                cambiosMap[campo] = { anterior: cambio.pdf, nuevo: cambio.final };
                              });
                            }
                            
                            // Campos editados manualmente (legacy)
                            if (evento.datos_adicionales?.campos_editados_manualmente) {
                              Object.entries(evento.datos_adicionales.campos_editados_manualmente).forEach(([campo, cambio]) => {
                                cambiosMap[campo] = { anterior: cambio.antes, nuevo: cambio.despues };
                              });
                            }
                            
                            // Helper para verificar si un campo fue editado
                            const fueEditado = (campo) => {
                              return cambiosMap[campo] || cambiosMap[campo.replace(/_/g, ' ').toLowerCase()];
                            };
                            
                            return null;
                          })()}
                          
                          {/* Información completa en formato vertical: 10 datos esenciales */}
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {(() => {
                              const limpiarValor = (valor) => {
                                if (!valor || valor === 'vacío') return valor;
                                if (typeof valor === 'string' && valor.includes('T')) return valor.split('T')[0];
                                return valor;
                              };
                              
                              const cambiosMap = {};
                              if (evento.datos_adicionales?.cliente_cambios?.cambios_detallados) {
                                Object.entries(evento.datos_adicionales.cliente_cambios.cambios_detallados).forEach(([campo, cambio]) => {
                                  cambiosMap[campo] = cambio;
                                });
                              }
                              if (evento.datos_adicionales?.poliza_cambios?.cambios_detallados) {
                                Object.entries(evento.datos_adicionales.poliza_cambios.cambios_detallados).forEach(([campo, cambio]) => {
                                  cambiosMap[campo] = cambio;
                                });
                              }
                              if (evento.datos_adicionales?.campos_editados_manualmente) {
                                Object.entries(evento.datos_adicionales.campos_editados_manualmente).forEach(([campo, cambio]) => {
                                  cambiosMap[campo] = { anterior: cambio.antes, nuevo: cambio.despues };
                                });
                              }
                              
                              return (
                                <>
                                  {/* 1. Método de captura (SOLO para captura, no para edición) */}
                                  {evento.datos_adicionales?.metodo_captura && evento.tipo_evento !== 'edicion_manual_expediente' && (
                                    <div className="text-muted">
                                      📋 Método: <strong className="text-dark">{evento.datos_adicionales.metodo_captura}</strong>
                                    </div>
                                  )}
                                  
                                  {/* Fecha de edición (solo para edición) */}
                                  {evento.tipo_evento === 'edicion_manual_expediente' && evento.datos_adicionales?.fecha_edicion && (
                                    <div className="text-muted">
                                      🕐 Fecha edición: <strong className="text-dark">{new Date(evento.datos_adicionales.fecha_edicion).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                                    </div>
                                  )}
                                  
                                  {/* 2. Fecha de captura */}
                                  {evento.datos_adicionales?.fecha_captura && (
                                    <div className="text-muted">
                                      🕐 Fecha captura: <strong className="text-dark">{new Date(evento.datos_adicionales.fecha_captura).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                                    </div>
                                  )}
                                  
                                  {/* 3. Aseguradora */}
                                  {evento.datos_adicionales?.aseguradora && (
                                    <div className="text-muted">
                                      🏢 Aseguradora: <strong className="text-dark">{evento.datos_adicionales.aseguradora}</strong>
                                    </div>
                                  )}
                                  
                                  {/* 4. Número de póliza */}
                                  {evento.datos_adicionales?.numero_poliza && (
                                    <div className="text-muted">
                                      📄 Póliza: <strong className="text-dark">{evento.datos_adicionales.numero_poliza}</strong>
                                    </div>
                                  )}
                                  
                                  {/* ✨ CAMBIOS DE PÓLIZA (para edicion_manual_expediente) */}
                                  {evento.tipo_evento === 'edicion_manual_expediente' && evento.datos_adicionales?.poliza_cambios?.cambios_detallados && 
                                   Object.keys(evento.datos_adicionales.poliza_cambios.cambios_detallados).length > 0 && (
                                    <>
                                      <div className="text-muted mt-2 mb-1"><strong>📋 Cambios en póliza:</strong></div>
                                      {Object.entries(evento.datos_adicionales.poliza_cambios.cambios_detallados).map(([campo, cambio], idx) => {
                                        const esFecha = campo.toLowerCase().includes('fecha') || campo.toLowerCase().includes('vigencia');
                                        const formatearCampo = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                        const valorAnterior = esFecha && cambio.anterior && !cambio.anterior.includes('vacío') 
                                          ? formatearFechaSinTZ(cambio.anterior) 
                                          : cambio.anterior;
                                        const valorNuevo = esFecha && cambio.nuevo && !cambio.nuevo.includes('vacío') 
                                          ? formatearFechaSinTZ(cambio.nuevo) 
                                          : cambio.nuevo;
                                        return (
                                          <div key={`poliza-cambio-${idx}`} className="text-muted ms-2">
                                            ✏️ {formatearCampo(campo)}: <span className="text-danger fw-bold">{valorAnterior}</span> → <span className="text-success fw-bold">{valorNuevo}</span>
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                  
                                  {/* ✨ CAMBIOS DE CLIENTE (para edicion_manual_expediente) */}
                                  {evento.tipo_evento === 'edicion_manual_expediente' && evento.datos_adicionales?.cliente_cambios?.cambios_detallados && 
                                   Object.keys(evento.datos_adicionales.cliente_cambios.cambios_detallados).length > 0 && (
                                    <>
                                      <div className="text-muted mt-2 mb-1"><strong>👤 Cambios en datos del cliente:</strong></div>
                                      {Object.entries(evento.datos_adicionales.cliente_cambios.cambios_detallados).map(([campo, cambio], idx) => {
                                        const formatearCampo = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                        return (
                                          <div key={`cliente-cambio-${idx}`} className="text-muted ms-2">
                                            ✏️ {formatearCampo(campo)}: <span className="text-danger fw-bold">{cambio.anterior || '(vacío)'}</span> → <span className="text-success fw-bold">{cambio.nuevo || '(vacío)'}</span>
                                          </div>
                                        );
                                      })}
                                    </>
                                  )}
                                  
                                  {/* ✨ CAMBIOS EN RECIBOS (para edicion_manual_expediente) - Formato igual que captura */}
                                  {evento.tipo_evento === 'edicion_manual_expediente' && evento.datos_adicionales?.recibos_cambios?.cambios_detallados && 
                                   evento.datos_adicionales.recibos_cambios.cambios_detallados.length > 0 && (
                                    <>
                                      <div className="text-muted mt-2 mb-1"><strong>📋 Recibos de pago modificados:</strong></div>
                                      {evento.datos_adicionales.recibos_cambios.cambios_detallados.map((cambio, idx) => (
                                        <div key={`recibo-cambio-${idx}`} className="text-muted ms-2">
                                          {cambio.tipo_cambio === 'agregado' && (
                                            <>• Recibo #{cambio.numero_recibo}: <strong className="text-success">${Number(cambio.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong> - Fecha límite de pago: <strong className="text-success">{formatearFechaSinTZ(cambio.fecha_nueva)}</strong> <span className="badge bg-success ms-1">Nuevo</span></>
                                          )}
                                          {cambio.tipo_cambio === 'eliminado' && (
                                            <>• Recibo #{cambio.numero_recibo}: <span className="text-decoration-line-through text-danger">${Number(cambio.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} - {formatearFechaSinTZ(cambio.fecha_anterior)}</span> <span className="badge bg-danger ms-1">Eliminado</span></>
                                          )}
                                          {cambio.tipo_cambio === 'editado' && (
                                            <>• Recibo #{cambio.numero_recibo}: <strong className="text-dark">${Number(cambio.monto_nuevo || cambio.monto_anterior || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong> - Fecha límite de pago: <strong className="text-dark">{formatearFechaSinTZ(cambio.fecha_nueva)}</strong> <span className="text-muted" style={{ fontSize: '0.8em' }}>(antes: {formatearFechaSinTZ(cambio.fecha_anterior)})</span></>
                                          )}
                                        </div>
                                      ))}
                                    </>
                                  )}
                                  
                                  {/* ✨ CAMBIOS EN PDF (para edicion_manual_expediente) */}
                                  {evento.tipo_evento === 'edicion_manual_expediente' && evento.datos_adicionales?.pdf_cambios && (
                                    <div className="text-muted mt-2">
                                      📄 <strong>{evento.datos_adicionales.pdf_cambios.descripcion}:</strong>{' '}
                                      {evento.datos_adicionales.pdf_cambios.anterior ? (
                                        <>
                                          <span 
                                            className="text-danger" 
                                            style={{ cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                            title="📋 PDF anterior guardado en historial. Funcionalidad de consulta pendiente de implementación en backend."
                                          >
                                            {evento.datos_adicionales.pdf_cambios.anterior}
                                          </span> → <span 
                                            className="text-success" 
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={async () => {
                                              try {
                                                // Usar el endpoint existente con expedienteId
                                                const data = await pdfService.obtenerURLFirmadaPDF(expedienteId);
                                                window.open(data.signed_url, '_blank');
                                              } catch (err) {
                                                toast.error('Error al abrir PDF: ' + err.message);
                                              }
                                            }}
                                            title="Clic para ver PDF actual"
                                          >
                                            {evento.datos_adicionales.pdf_cambios.nuevo}
                                          </span>
                                        </>
                                      ) : (
                                        <span 
                                          className="text-success" 
                                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                          onClick={async () => {
                                            try {
                                              const data = await pdfService.obtenerURLFirmadaPDF(expedienteId);
                                              window.open(data.signed_url, '_blank');
                                            } catch (err) {
                                              toast.error('Error al abrir PDF: ' + err.message);
                                            }
                                          }}
                                          title="Clic para ver PDF"
                                        >
                                          {evento.datos_adicionales.pdf_cambios.nuevo}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Información del cliente (origen) */}
                                  {evento.datos_adicionales?.cliente_origen && (
                                    <div className="text-muted">
                                      👤 Cliente: <strong className="text-dark">{evento.datos_adicionales.cliente_origen}</strong>
                                      {/* Si es cliente nuevo, mostrar info adicional */}
                                      {evento.datos_adicionales?.cliente_nuevo && (
                                        <div className="ms-3 mt-1" style={{ fontSize: '0.75rem', color: '#28a745' }}>
                                          ✨ <strong>Nuevo cliente creado:</strong> {evento.datos_adicionales.cliente_nuevo.nombre_cliente} | RFC: {evento.datos_adicionales.cliente_nuevo.rfc} | Tipo: {evento.datos_adicionales.cliente_nuevo.tipo_persona}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Información del agente y clave - SIEMPRE se muestra */}
                                  {evento.datos_adicionales?.agente && (
                                    <div className="text-muted">
                                      👔 Agente: <strong className="text-dark">{evento.datos_adicionales.agente.nombre}</strong>
                                      {evento.datos_adicionales.agente.clave && evento.datos_adicionales.agente.clave !== 'Sin clave' && (
                                        <span className="ms-1">(Clave: {evento.datos_adicionales.agente.clave})</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Si el agente fue editado, mostrar el cambio */}
                                  {evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.agente && (
                                    <div className="text-muted">
                                      ✏️ Agente: <span className="text-danger fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.agente.pdf}</span> → <span className="text-success fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.agente.final}</span>
                                    </div>
                                  )}
                                  {evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.agente_id && (
                                    <div className="text-muted">
                                      ✏️ Agente ID: <span className="text-danger fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.agente_id.pdf}</span> → <span className="text-success fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.agente_id.final}</span>
                                    </div>
                                  )}
                                  {evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.clave_agente && (
                                    <div className="text-muted">
                                      ✏️ Clave Agente: <span className="text-danger fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.clave_agente.pdf}</span> → <span className="text-success fw-bold">{evento.datos_adicionales.cambios_manuales.campos_editados.detalles.clave_agente.final}</span>
                                    </div>
                                  )}
                                  
                                  {/* Información del sub-agente (solo si NO está en cambios manuales) */}
                                  {!evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.sub_agente && !evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.subagente_id && !evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.vendedor_id && evento.datos_adicionales?.subagente && (
                                    <div className="text-muted">
                                      👔 Sub-agente: <strong className="text-dark">{evento.datos_adicionales.subagente.nombre}</strong>
                                    </div>
                                  )}
                                  
                                  {/* Fecha de emisión (solo si NO está en cambios) */}
                                  {!evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.fecha_emision && !evento.datos_adicionales?.campos_editados_post_pdf && evento.datos_adicionales?.fecha_emision && evento.tipo_evento !== 'edicion_manual_expediente' && (
                                    <div className="text-muted">
                                      📅 Fecha emisión: <strong className="text-dark">{evento.datos_adicionales.fecha_emision.includes('T') ? new Date(evento.datos_adicionales.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : evento.datos_adicionales.fecha_emision.split('-').reverse().join('/')}</strong>
                                    </div>
                                  )}
                                  
                                  {/* Inicio vigencia (solo si NO está en cambios) */}
                                  {!evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.inicio_vigencia && !evento.datos_adicionales?.campos_editados_post_pdf && evento.datos_adicionales?.inicio_vigencia && evento.tipo_evento !== 'edicion_manual_expediente' && (
                                    <div className="text-muted">
                                      📅 Inicio vigencia: <strong className="text-dark">{evento.datos_adicionales.inicio_vigencia.includes('T') ? new Date(evento.datos_adicionales.inicio_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : evento.datos_adicionales.inicio_vigencia.split('-').reverse().join('/')}</strong>
                                    </div>
                                  )}
                                  
                                  {/* Término vigencia (solo si NO está en cambios) */}
                                  {!evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.termino_vigencia && !evento.datos_adicionales?.campos_editados_post_pdf && evento.datos_adicionales?.termino_vigencia && evento.tipo_evento !== 'edicion_manual_expediente' && (
                                    <div className="text-muted">
                                      📅 Término vigencia: <strong className="text-dark">{evento.datos_adicionales.termino_vigencia.includes('T') ? new Date(evento.datos_adicionales.termino_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : evento.datos_adicionales.termino_vigencia.split('-').reverse().join('/')}</strong>
                                    </div>
                                  )}
                                  
                                  {/* Monto total (solo si NO está en cambios) */}
                                  {!evento.datos_adicionales?.cambios_manuales?.campos_editados?.detalles?.total && evento.datos_adicionales?.monto_total && evento.tipo_evento !== 'edicion_manual_expediente' && (
                                    <div className="text-muted">
                                      💰 Monto total: <strong className="text-dark">${Number(evento.datos_adicionales.monto_total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            
                            {/* Recibos: cambios o generados */}
                            {(() => {
                              const formatearFecha = (fecha) => {
                                if (!fecha) return 'N/A';
                                const f = new Date(fecha);
                                return f.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
                              };
                              
                              const limpiarValor = (valor) => {
                                if (valor === null || valor === undefined) return '(vacío)';
                                if (valor === '') return '(vacío)';
                                return valor;
                              };
                              
                              // ✨ NUEVO: Procesar cambios_manuales
                              const cambiosManuales = evento.datos_adicionales?.cambios_manuales;
                              const camposEditados = cambiosManuales?.campos_editados?.detalles || {};
                              const recibosEditados = cambiosManuales?.recibos_editados?.detalles || [];
                              
                              // Legacy
                              const cambiosCampos = evento.datos_adicionales?.campos_editados_post_pdf?.cambios_detallados || [];
                              const cambiosRecibos = evento.datos_adicionales?.recibos_cambios?.cambios_detallados || [];
                              const recibosGenerados = evento.datos_adicionales?.recibos_generados?.detalles || [];
                              
                              // DEBUG: Ver si hay recibos
                              console.log('🔍 Recibos generados:', recibosGenerados);
                              console.log('🔍 datos_adicionales completo:', evento.datos_adicionales?.recibos_generados);
                              
                              // Función para formatear nombre de campo
                              const formatearNombreCampo = (campo) => {
                                return campo
                                  .replace(/_/g, ' ')
                                  .replace(/\b\w/g, l => l.toUpperCase());
                              };
                              
                              return (
                                <>
                                  {/* ✨ Mostrar campos editados post-PDF en formato de lista */}
                                  {Object.keys(camposEditados).length > 0 && Object.entries(camposEditados).map(([campo, cambio], idx) => {
                                    const esFecha = campo.toLowerCase().includes('fecha') || campo.toLowerCase().includes('vigencia');
                                    const valorPDF = esFecha && cambio.pdf && cambio.pdf !== '(vacío)' ? 
                                      formatearFechaSinTZ(cambio.pdf) : 
                                      limpiarValor(cambio.pdf);
                                    const valorFinal = esFecha && cambio.final && cambio.final !== '(vacío)' ? 
                                      formatearFechaSinTZ(cambio.final) : 
                                      limpiarValor(cambio.final);
                                    
                                    return (
                                      <div key={`campo-edit-${idx}`} className="text-muted">
                                        ✏️ {formatearNombreCampo(campo)}: <span className="text-danger fw-bold">{valorPDF}</span> → <span className="text-success fw-bold">{valorFinal}</span>
                                      </div>
                                    );
                                  })}
                                  
                                  {/* ✨ Mostrar recibos editados post-PDF en formato de lista (NO para edicion_manual_expediente) */}
                                  {evento.tipo_evento !== 'edicion_manual_expediente' && recibosEditados.length > 0 && recibosEditados.map((cambio, idx) => {
                                    const fechaCambio = cambio.fecha_pdf !== cambio.fecha_final;
                                    const montoCambio = cambio.monto_pdf !== cambio.monto_final;
                                    
                                    return (
                                      <div key={`recibo-edit-${idx}`} className="text-muted">
                                        {cambio.tipo_cambio === 'agregado' && (
                                          <>✏️ 📋 Recibo #{cambio.recibo}: <span className="text-success fw-bold">Agregado - Vence: {formatearFechaSinTZ(cambio.fecha_final)} - ${Number(cambio.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></>
                                        )}
                                        {cambio.tipo_cambio === 'eliminado' && (
                                          <>✏️ 📋 Recibo #{cambio.recibo}: <span className="text-danger fw-bold">Eliminado (era: {formatearFechaSinTZ(cambio.fecha_pdf)} - ${Number(cambio.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })})</span></>
                                        )}
                                        {cambio.tipo_cambio === 'editado' && (
                                          <>
                                            ✏️ 📋 Recibo #{cambio.recibo}:
                                            {fechaCambio && (
                                              <> Fecha: <span className="text-danger fw-bold">{formatearFechaSinTZ(cambio.fecha_pdf)}</span> → <span className="text-success fw-bold">{formatearFechaSinTZ(cambio.fecha_final)}</span></>
                                            )}
                                            {montoCambio && (
                                              <>{fechaCambio ? ' | ' : ''} Monto: <span className="text-danger fw-bold">${Number(cambio.monto_pdf).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> → <span className="text-success fw-bold">${Number(cambio.monto_final).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Legacy: Cambios en campos del formulario post-PDF (NO para edicion_manual_expediente) */}
                                  {evento.tipo_evento !== 'edicion_manual_expediente' && cambiosCampos.length > 0 && cambiosCampos.map((cambio, idx) => (
                                    <div key={`campo-${idx}`} className="text-muted">
                                      ✏️ <strong className="text-dark">{cambio.campo}:</strong> {limpiarValor(cambio.valor_nuevo)} <span style={{ color: '#6c757d', fontSize: '0.85em' }}>(antes: {limpiarValor(cambio.valor_anterior)})</span>
                                    </div>
                                  ))}
                                  
                                  {/* Legacy: Cambios en recibos post-PDF (NO para edicion_manual_expediente) */}
                                  {evento.tipo_evento !== 'edicion_manual_expediente' && cambiosRecibos.length > 0 && cambiosRecibos.map((cambio, idx) => (
                                    <div key={`recibo-cambio-${idx}`} className="text-muted">
                                      ✏️ <strong className="text-dark">Recibo #{cambio.numero_recibo} - Vence:</strong> {formatearFecha(cambio.fecha_nueva)} <span style={{ color: '#6c757d', fontSize: '0.85em' }}>(antes: {formatearFecha(cambio.fecha_anterior)})</span>
                                    </div>
                                  ))}
                                  
                                  {/* 3. Recibos generados - Solo para captura, NO para edicion (NO para edicion_manual_expediente) */}
                                  {evento.tipo_evento !== 'edicion_manual_expediente' && recibosGenerados.length > 0 && (
                                    <>
                                      <div className="text-muted mt-2 mb-1"><strong>📋 Recibos de pago generados:</strong></div>
                                      {recibosGenerados.map((recibo, idx) => (
                                        <div key={`recibo-gen-${idx}`} className="text-muted ms-2">
                                          • Recibo #{recibo.numero}: <strong className="text-dark">${Number(recibo.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> - Fecha límite de pago: <strong className="text-dark">{recibo.fecha_vencimiento ? formatearFechaSinTZ(recibo.fecha_vencimiento) : 'N/A'}</strong>
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </>
                              );
                            })()}
                            
                            {/* Estatus de pago */}
                            {evento.datos_adicionales?.estatus_pago && (
                              <div className="text-muted">
                                📊 Estatus de pago: <strong className={`${
                                  evento.datos_adicionales.estatus_pago === 'Vencido' ? 'text-danger' : 
                                  evento.datos_adicionales.estatus_pago === 'Pagado' ? 'text-success' : 
                                  evento.datos_adicionales.estatus_pago === 'Por Vencer' ? 'text-warning' : 
                                  'text-dark'
                                }`}>
                                  {evento.datos_adicionales.estatus_pago}
                                </strong>
                              </div>
                            )}
                            
                            {/* 9. Usuario que capturó o editó */}
                            {(evento.datos_adicionales?.usuario_capturo || evento.datos_adicionales?.usuario_edito) && (
                              <div className="text-muted">
                                👤 Usuario: <strong className="text-dark">{evento.datos_adicionales.usuario_capturo || evento.datos_adicionales.usuario_edito}</strong>
                              </div>
                            )}
                            
                            {/* 10. Etapa inicial o actual */}
                            {(evento.datos_adicionales?.etapa_inicial || evento.datos_adicionales?.etapa_actual) && (
                              <div className="text-muted">
                                🎯 Etapa: <strong className="text-dark">{evento.datos_adicionales.etapa_inicial || evento.datos_adicionales.etapa_actual}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (evento.tipo_evento === 'poliza_enviada_whatsapp' || evento.tipo_evento === 'poliza_enviada_email') ? (
                        /* Vista vertical para eventos de envío (WhatsApp/Email) */
                        <div className="mb-1">
                          {/* Información en formato vertical compacto */}
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {/* Empresa/Cliente */}
                            {evento.destinatario_nombre && (
                              <div className="text-muted">
                                🏢 Cliente: <strong className="text-dark">{evento.destinatario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Contacto (teléfono o email) */}
                            {evento.destinatario_contacto && (
                              <div className="text-muted">
                                {evento.metodo_contacto === 'WhatsApp' ? '📱' : '📧'} Contacto: <strong className="text-dark">{evento.destinatario_contacto}</strong>
                              </div>
                            )}
                            
                            {/* Canal de envío */}
                            {evento.metodo_contacto && (
                              <div className="text-muted">
                                📤 Canal: <strong className="text-primary">{evento.metodo_contacto}</strong>
                              </div>
                            )}
                            
                            {/* Aseguradora - NUEVO */}
                            {(expedienteData?.compania || evento.datos_adicionales?.compania) && (
                              <div className="text-muted">
                                🏛️ Aseguradora: <strong className="text-primary">{expedienteData?.compania || evento.datos_adicionales?.compania}</strong>
                              </div>
                            )}
                            
                            {/* Número de Póliza - NUEVO */}
                            {(expedienteData?.numero_poliza || evento.datos_adicionales?.numero_poliza) && (
                              <div className="text-muted">
                                📋 Póliza: <strong className="text-dark">{expedienteData?.numero_poliza || evento.datos_adicionales?.numero_poliza}</strong>
                              </div>
                            )}
                            
                            {/* Usuario que realizó el envío */}
                            {evento.usuario_nombre && (
                              <div className="text-muted">
                                👤 Usuario: <strong className="text-dark">{evento.usuario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Estatus de pago - USAR DATOS DEL EXPEDIENTE ACTUAL */}
                            {(expedienteData?.estatusPago || evento.datos_adicionales?.estatus_pago) && (() => {
                              const estatus = expedienteData?.estatusPago || evento.datos_adicionales?.estatus_pago;
                              const estatusNormalizado = estatus.toLowerCase();
                              
                              let colorClass = 'text-dark';
                              if (estatusNormalizado.includes('vencido') || estatusNormalizado.includes('vencida')) {
                                colorClass = 'text-danger fw-bold';
                              } else if (estatusNormalizado.includes('pagado') || estatusNormalizado.includes('pagada')) {
                                colorClass = 'text-success fw-bold';
                              } else if (estatusNormalizado.includes('por vencer') || estatusNormalizado.includes('vencer')) {
                                colorClass = 'text-warning fw-bold';
                              } else if (estatusNormalizado.includes('pendiente')) {
                                colorClass = 'text-info fw-bold';
                              }
                              
                              return (
                                <div className="text-muted">
                                  💳 Estatus de pago: <strong className={colorClass}>{estatus}</strong>
                                </div>
                              );
                            })()}
                            
                            {/* Monto total - USAR DATOS DEL EXPEDIENTE ACTUAL */}
                            {(expedienteData?.total || evento.datos_adicionales?.monto_total) && (
                              <div className="text-muted">
                                💰 Monto total: <strong className="text-dark">${Number(expedienteData?.total || evento.datos_adicionales.monto_total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            
                            {/* Fecha límite de pago - USAR DATOS DEL EXPEDIENTE ACTUAL */}
                            {(expedienteData?.fecha_vencimiento_pago || evento.datos_adicionales?.fecha_vencimiento_pago) && (
                              <div className="text-muted">
                                📅 Fecha límite de pago: <strong className="text-dark">{formatearFechaSinTZ(expedienteData?.fecha_vencimiento_pago || evento.datos_adicionales.fecha_vencimiento_pago)}</strong>
                              </div>
                            )}
                            
                            {/* Fecha y hora del envío */}
                            <div className="text-muted">
                              🕐 Fecha envío: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                            
                            {/* Link al PDF compartido - genera URL firmada fresca al hacer click */}
                            {evento.documento_url && (
                              <div className="text-muted">
                                📄 PDF compartido:{' '}
                                <a 
                                  href="#"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    try {
                                      const { signed_url } = await pdfService.obtenerURLFirmadaPDF(expedienteId, 3600);
                                      const win = window.open(signed_url, '_blank', 'noopener,noreferrer');
                                      if (win) win.opener = null;
                                    } catch (err) {
                                      console.error('Error al obtener PDF:', err);
                                      toast.error('No se pudo abrir el PDF: ' + (err?.message || 'desconocido'));
                                    }
                                  }}
                                  className="text-primary text-decoration-underline"
                                  style={{ cursor: 'pointer' }}
                                >
                                  {expedienteData?.pdf_nombre || evento.datos_adicionales?.numero_poliza || 'Ver documento'}
                                </a>
                              </div>
                            )}
                            
                            {/* Cambio de etapa (si aplica) */}
                            {evento.etapa_anterior && evento.etapa_nueva && (
                              <div className="text-muted">
                                📊 Etapa: <strong className="text-dark">{evento.etapa_anterior} → {evento.etapa_nueva}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (evento.tipo_evento === 'aviso_pago_vencido_enviado' ||
                           evento.tipo_evento === 'aviso_pago_por_vencer_enviado' ||
                           evento.tipo_evento === 'aviso_pago_pendiente_enviado') ? (
                        /* Vista vertical para eventos de aviso/recordatorio de pago */
                        <div className="mb-1">
                          {/* Información en formato vertical compacto */}
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {/* Empresa/Cliente - Mostrar tanto destinatario_nombre como datos_adicionales si están disponibles */}
                            {(evento.destinatario_nombre || evento.datos_adicionales?.destinatario_nombre) && (
                              <div className="text-muted">
                                🏢 Cliente: <strong className="text-dark">{evento.destinatario_nombre || evento.datos_adicionales?.destinatario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Contacto (teléfono o email) */}
                            {(evento.destinatario_contacto || evento.datos_adicionales?.destinatario_contacto) && (
                              <div className="text-muted">
                                {evento.metodo_contacto === 'WhatsApp' ? '📱' : '📧'} Contacto: <strong className="text-dark">{evento.destinatario_contacto || evento.datos_adicionales?.destinatario_contacto}</strong>
                              </div>
                            )}
                            
                            {/* Canal de envío */}
                            {(evento.metodo_contacto || evento.datos_adicionales?.canal) && (
                              <div className="text-muted">
                                📤 Canal: <strong className="text-primary">{evento.metodo_contacto || evento.datos_adicionales?.canal}</strong>
                              </div>
                            )}
                            
                            {/* Información del pago */}
                            {evento.datos_adicionales?.numero_pago && (
                              <div className="text-muted">
                                💰 Pago: <strong className="text-dark">
                                  #{evento.datos_adicionales.numero_pago}
                                  {evento.datos_adicionales?.total_pagos && ` de ${evento.datos_adicionales.total_pagos}`}
                                </strong>
                              </div>
                            )}
                            
                            {evento.datos_adicionales?.fecha_pago && (
                              <div className="text-muted">
                                📅 Vencimiento: <strong className="text-dark">{new Date(evento.datos_adicionales.fecha_pago).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                              </div>
                            )}
                            
                            {evento.datos_adicionales?.monto && (
                              <div className="text-muted">
                                💵 Monto: <strong className="text-dark">${Number(evento.datos_adicionales.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            
                            {/* Estatus del pago - CALCULAR DESDE FECHA O USAR expedienteData */}
                            {(evento.datos_adicionales?.fecha_pago || evento.datos_adicionales?.estado_pago) && (() => {
                              let estatusPago = evento.datos_adicionales?.estado_pago;
                              
                              // Si no hay estatus en datos_adicionales, calcular desde fecha
                              if (!estatusPago && evento.datos_adicionales?.fecha_pago) {
                                const fechaVenc = new Date(evento.datos_adicionales.fecha_pago);
                                const hoy = new Date();
                                hoy.setHours(0, 0, 0, 0);
                                fechaVenc.setHours(0, 0, 0, 0);
                                const diffDias = Math.floor((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
                                
                                if (diffDias < 0) {
                                  estatusPago = 'Vencido';
                                } else if (diffDias <= 5) {
                                  estatusPago = 'Por Vencer';
                                } else {
                                  estatusPago = 'Pendiente';
                                }
                              }
                              
                              // O buscar en recibos del expediente
                              if (!estatusPago && expedienteData?.recibos && evento.datos_adicionales?.numero_pago) {
                                const recibo = expedienteData.recibos.find(r => r.numero_recibo === evento.datos_adicionales.numero_pago);
                                estatusPago = recibo?.estatus_pago || recibo?.estado_pago;
                              }
                              
                              if (estatusPago) {
                                return (
                                  <div className="text-muted">
                                    📊 Estatus del pago: <strong className={`${estatusPago === 'Vencido' ? 'text-danger' : estatusPago === 'Pagado' ? 'text-success' : estatusPago === 'Por Vencer' ? 'text-warning' : 'text-dark'}`}>
                                      {estatusPago}
                                    </strong>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Resumen de todos los recibos */}
                            {evento.datos_adicionales?.resumen_recibos && Array.isArray(evento.datos_adicionales.resumen_recibos) && evento.datos_adicionales.resumen_recibos.length > 0 && (
                              <div className="mt-2 mb-2 p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                                <div className="text-dark fw-bold mb-2" style={{ fontSize: '0.85rem' }}>
                                  📊 Estado de todos los pagos:
                                </div>
                                {evento.datos_adicionales.resumen_recibos.map((recibo, idx) => {
                                  let icono, colorClase, detalle;
                                  
                                  if (recibo.estatus === 'Pagado') {
                                    icono = '✅';
                                    colorClase = 'text-success';
                                    detalle = '';
                                  } else if (recibo.estatus === 'VENCIDO') {
                                    icono = '🚨';
                                    colorClase = 'text-danger';
                                    const diasVencido = Math.abs(recibo.dias_restantes);
                                    detalle = ` (hace ${diasVencido} día${diasVencido !== 1 ? 's' : ''})`;
                                  } else if (recibo.estatus === 'Por vencer') {
                                    icono = '⏰';
                                    colorClase = 'text-warning';
                                    const dias = recibo.dias_restantes;
                                    detalle = dias === 0 ? ' (vence HOY)' : ` (vence en ${dias} día${dias !== 1 ? 's' : ''})`;
                                  } else {
                                    icono = '⏳';
                                    colorClase = 'text-secondary';
                                    detalle = recibo.fecha ? ` (vence ${formatearFechaSinTZ(recibo.fecha)})` : '';
                                  }
                                  
                                  return (
                                    <div key={idx} className="text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.8' }}>
                                      {icono} Pago {recibo.numero}: <span className={`fw-bold ${colorClase}`}>{recibo.estatus}</span>{detalle}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* Usuario que realizó el envío */}
                            {evento.usuario_nombre && (
                              <div className="text-muted">
                                👤 Usuario: <strong className="text-dark">{evento.usuario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Fecha y hora del envío */}
                            <div className="text-muted">
                              🕐 Fecha envío: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                            
                            {/* Link al PDF compartido (recibo o póliza) */}
                            {evento.documento_url && (
                              <div className="text-muted">
                                📄 PDF compartido:{' '}
                                <a 
                                  href="#"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    try {
                                      // Determinar si es recibo o póliza según la URL
                                      const esRecibo = evento.documento_url.includes('recibo');
                                      let url;
                                      if (esRecibo && evento.datos_adicionales?.numero_pago) {
                                        const result = await pdfService.obtenerReciboPagoURL(expedienteId, evento.datos_adicionales.numero_pago, 3600);
                                        url = result.url;
                                      } else {
                                        const result = await pdfService.obtenerURLFirmadaPDF(expedienteId, 3600);
                                        url = result.signed_url;
                                      }
                                      const win = window.open(url, '_blank', 'noopener,noreferrer');
                                      if (win) win.opener = null;
                                    } catch (err) {
                                      console.error('Error al obtener PDF:', err);
                                      toast.error('No se pudo abrir el PDF: ' + (err?.message || 'desconocido'));
                                    }
                                  }}
                                  className="text-primary text-decoration-underline"
                                  style={{ cursor: 'pointer' }}
                                >
                                  {evento.documento_url.includes('recibo') ? 'Ver recibo de pago' : (expedienteData?.pdf_nombre || evento.datos_adicionales?.numero_poliza || 'Ver documento')}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : evento.tipo_evento === 'pago_removido' ? (
                        /* Vista vertical para eventos de pago eliminado */
                        <div className="mb-1">
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {/* Número de recibo */}
                            {evento.datos_adicionales?.numero_recibo && (
                              <div className="text-muted">
                                🧾 Recibo eliminado: <strong className="text-danger">#{evento.datos_adicionales.numero_recibo}</strong>
                              </div>
                            )}
                            
                            {/* Monto del pago */}
                            {evento.datos_adicionales?.monto && (
                              <div className="text-muted">
                                💵 Monto: <strong className="text-dark">${Number(evento.datos_adicionales.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            
                            {/* Fecha del pago que se eliminó */}
                            {evento.datos_adicionales?.fecha_pago && (
                              <div className="text-muted">
                                📅 Fecha pago: <strong className="text-dark">{new Date(evento.datos_adicionales.fecha_pago).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                              </div>
                            )}
                            
                            {/* Aseguradora */}
                            {evento.datos_adicionales?.aseguradora && (
                              <div className="text-muted">
                                🏛️ Aseguradora: <strong className="text-primary">{evento.datos_adicionales.aseguradora}</strong>
                              </div>
                            )}
                            
                            {/* Número de póliza */}
                            {evento.datos_adicionales?.numero_poliza && (
                              <div className="text-muted">
                                📋 Póliza: <strong className="text-dark">{evento.datos_adicionales.numero_poliza}</strong>
                              </div>
                            )}
                            
                            {/* Motivo de eliminación */}
                            {evento.datos_adicionales?.motivo && (
                              <div className="text-muted mt-1 p-2" style={{ backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
                                📝 <strong>Motivo:</strong> {evento.datos_adicionales.motivo}
                              </div>
                            )}
                            
                            {/* Usuario que eliminó */}
                            {evento.usuario_nombre && (
                              <div className="text-muted">
                                👤 Eliminado por: <strong className="text-dark">{evento.usuario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Fecha y hora de eliminación */}
                            <div className="text-muted">
                              🕐 Fecha eliminación: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                          </div>
                        </div>
                      ) : evento.tipo_evento === 'datos-actualizados' ? (
                        /* Vista vertical para eventos de edición de póliza */
                        <div className="mb-1">
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {/* Aseguradora */}
                            {evento.datos_adicionales?.compania && (
                              <div className="text-muted">
                                🏢 Aseguradora: <strong className="text-dark">{evento.datos_adicionales.compania}</strong>
                              </div>
                            )}
                            
                            {/* Número de póliza */}
                            {evento.datos_adicionales?.numero_poliza && (
                              <div className="text-muted">
                                📋 Póliza: <strong className="text-dark">{evento.datos_adicionales.numero_poliza}</strong>
                              </div>
                            )}
                            
                            {/* Cantidad de cambios */}
                            {evento.datos_adicionales?.cantidad_cambios !== undefined && (
                              <div className="text-muted">
                                ✏️ Cambios: <strong className="text-dark">{evento.datos_adicionales.cantidad_cambios} campo(s) modificado(s)</strong>
                              </div>
                            )}
                            
                            {/* Campos editados - mostrar lista detallada */}
                            {evento.datos_adicionales?.campos_editados && Object.keys(evento.datos_adicionales.campos_editados).length > 0 && (
                              <div className="mt-2 p-2 bg-info bg-opacity-10 rounded" style={{ fontSize: '0.75rem' }}>
                                <div className="text-info mb-1"><strong>📝 Campos modificados:</strong></div>
                                {Object.entries(evento.datos_adicionales.campos_editados).map(([campo, cambio], idx) => {
                                  // Formatear fechas si el campo contiene fecha
                                  const esFecha = campo.toLowerCase().includes('fecha');
                                  const valorAntes = esFecha && cambio.antes !== 'vacío' ? 
                                    new Date(cambio.antes).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 
                                    cambio.antes;
                                  const valorDespues = esFecha && cambio.despues !== 'vacío' ? 
                                    new Date(cambio.despues).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 
                                    cambio.despues;
                                  
                                  return (
                                    <div key={idx} className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                                      <strong>{campo}:</strong> <span className="text-danger">{valorAntes}</span> → <span className="text-success">{valorDespues}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* Usuario */}
                            {evento.usuario_nombre && (
                              <div className="text-muted mt-1">
                                👤 Usuario: <strong className="text-dark">{evento.usuario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Fecha del evento */}
                            <div className="text-muted">
                              🕐 Fecha edición: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                          </div>
                        </div>
                      ) : (evento.tipo_evento === 'cotizacion_renovacion_iniciada' ||
                           evento.tipo_evento === 'COTIZACION_CARGADA' ||
                           evento.tipo_evento === 'POLIZA_EMITIDA' ||
                           evento.tipo_evento === 'cotizacion_enviada' ||
                           evento.tipo_evento === 'renovacion_pendiente_emision' ||
                           evento.tipo_evento === 'renovacion_emitida' ||
                           evento.tipo_evento === 'expediente_creado') ? (
                        /* Vista vertical para eventos de renovación */
                        <div className="mb-1">
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {/* Número de póliza */}
                            {evento.datos_adicionales?.numero_poliza && (
                              <div className="text-muted">
                                📋 Póliza: <strong className="text-dark">{evento.datos_adicionales.numero_poliza}</strong>
                              </div>
                            )}
                            
                            {/* Póliza anterior (para renovaciones) */}
                            {evento.datos_adicionales?.numero_poliza_anterior && (
                              <div className="text-muted">
                                📋 Póliza anterior: <strong className="text-dark">{evento.datos_adicionales.numero_poliza_anterior}</strong>
                              </div>
                            )}
                            
                            {/* Nueva póliza (para renovaciones) */}
                            {evento.datos_adicionales?.numero_poliza_nueva && (
                              <div className="text-muted">
                                📄 Nueva póliza: <strong className="text-success">{evento.datos_adicionales.numero_poliza_nueva}</strong>
                              </div>
                            )}
                            
                            {/* Aseguradora */}
                            {evento.datos_adicionales?.compania && (
                              <div className="text-muted">
                                🏢 Aseguradora: <strong className="text-primary">{evento.datos_adicionales.compania}</strong>
                              </div>
                            )}
                            
                            {/* Vigencia anterior (texto directo o calculado desde fechas) */}
                            {(evento.datos_adicionales?.vigencia_anterior || (evento.datos_adicionales?.inicio_vigencia && evento.datos_adicionales?.termino_vigencia)) && (
                              <div className="text-muted">
                                📅 Vigencia anterior: <strong className="text-dark">
                                  {evento.datos_adicionales.vigencia_anterior || 
                                   `${new Date(evento.datos_adicionales.inicio_vigencia).toLocaleDateString('es-MX')} al ${new Date(evento.datos_adicionales.termino_vigencia).toLocaleDateString('es-MX')}`}
                                </strong>
                              </div>
                            )}
                            
                            {/* Vigencia nueva */}
                            {evento.datos_adicionales?.vigencia_nueva && (
                              <div className="text-muted">
                                📅 Nueva vigencia: <strong className="text-success">{evento.datos_adicionales.vigencia_nueva}</strong>
                              </div>
                            )}
                            
                            {/* Inicio y término de vigencia (formato alternativo) */}
                            {evento.datos_adicionales?.inicio_vigencia && evento.datos_adicionales?.termino_vigencia && !evento.datos_adicionales?.vigencia_anterior && (
                              <div className="text-muted">
                                📅 Vigencia: <strong className="text-dark">
                                  {new Date(evento.datos_adicionales.inicio_vigencia).toLocaleDateString('es-MX')} al {new Date(evento.datos_adicionales.termino_vigencia).toLocaleDateString('es-MX')}
                                </strong>
                              </div>
                            )}
                            
                            {/* Cliente */}
                            {evento.datos_adicionales?.cliente_nombre && (
                              <div className="text-muted">
                                👤 Cliente: <strong className="text-dark">{evento.datos_adicionales.cliente_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Archivo de cotización */}
                            {evento.datos_adicionales?.archivo && (
                              <div className="text-muted">
                                📎 Archivo: <strong className="text-dark">{evento.datos_adicionales.archivo}</strong>
                              </div>
                            )}
                            
                            {/* Usuario que realizó la acción */}
                            {evento.usuario_nombre && (
                              <div className="text-muted">
                                👤 Usuario: <strong className="text-dark">{evento.usuario_nombre}</strong>
                              </div>
                            )}
                            
                            {/* Fecha y hora */}
                            <div className="text-muted">
                              🕐 Fecha: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Vista estándar para otros eventos */}
                          {evento.descripcion && (
                            <div className="text-dark mb-1" style={{ fontSize: '0.85rem', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                              {(() => {
                                // Aplicar colores a los estatus en la descripción
                                const texto = evento.descripcion;
                                const partes = texto.split(/(\d+\/\d+\s+(?:Pagado|Por vencer|Vencido|Pendiente))/g);
                                
                                return partes.map((parte, idx) => {
                                  // Detectar patrones como "1/4 Pagado", "2/4 Por vencer", etc.
                                  if (/\d+\/\d+\s+Pagado/.test(parte)) {
                                    return <span key={idx} className="fw-bold text-success">{parte}</span>;
                                  } else if (/\d+\/\d+\s+Por vencer/.test(parte)) {
                                    return <span key={idx} className="fw-bold text-warning">{parte}</span>;
                                  } else if (/\d+\/\d+\s+Vencido/.test(parte)) {
                                    return <span key={idx} className="fw-bold text-danger">{parte}</span>;
                                  } else if (/\d+\/\d+\s+Pendiente/.test(parte)) {
                                    return <span key={idx} className="fw-bold text-info">{parte}</span>;
                                  }
                                  return parte;
                                });
                              })()}
                            </div>
                          )}
                          
                          {/* Metadata estándar (fecha, usuario, destinatario) */}
                          <div className="d-flex flex-wrap gap-2 align-items-center" style={{ fontSize: '0.75rem' }}>
                            {/* Fecha/Hora */}
                            <span className="text-muted">
                              🕐 {formatearFecha(evento.fecha_evento)}
                            </span>
                            
                            {/* Usuario que realizó la acción */}
                            {evento.usuario_nombre && (
                              <span className="text-muted">
                                • 👤 {evento.usuario_nombre}
                              </span>
                            )}
                            
                            {/* Destinatario (para envíos) */}
                            {evento.destinatario_nombre && (
                              <span className="text-muted">
                                • ✍️ {evento.destinatario_nombre}
                              </span>
                            )}
                            
                            {/* Canal de envío */}
                            {evento.metodo_contacto && (
                              <span className="badge bg-secondary bg-opacity-10 text-secondary" style={{ fontSize: '0.7rem' }}>
                                {evento.metodo_contacto}
                              </span>
                            )}
                            
                            {/* Cambio de etapa */}
                            {evento.etapa_anterior && evento.etapa_nueva && (
                              <span className="text-muted">
                                • 📊 {evento.etapa_anterior} → {evento.etapa_nueva}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Botón expandir solo si hay datos adicionales */}
                    {(evento.datos_adicionales || evento.documento_url) && (
                      <button
                        className="btn btn-sm btn-link text-secondary p-0 ms-2"
                        onClick={() => setEventoExpandido(expandido ? null : evento.id)}
                        style={{ lineHeight: 1 }}
                      >
                        {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>

                  {/* Detalles expandibles */}
                  {expandido && evento.datos_adicionales && (
                    <div className="mt-2 pt-2 border-top">
                      {/* Vista mejorada para eventos de "Datos Actualizados" */}
                      {(evento.tipo_evento === 'datos_actualizados' || evento.tipo_evento === 'DATOS_ACTUALIZADOS') ? (
                        <div className="d-flex flex-column gap-2" style={{ fontSize: '0.8rem' }}>
                          {/* Información básica */}
                          {evento.datos_adicionales?.fecha_edicion && (
                            <div className="text-muted">
                              🕐 Fecha edición: <strong className="text-dark">{new Date(evento.datos_adicionales.fecha_edicion).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                            </div>
                          )}
                          {evento.datos_adicionales?.aseguradora && (
                            <div className="text-muted">
                              🏢 Aseguradora: <strong className="text-dark">{evento.datos_adicionales.aseguradora}</strong>
                            </div>
                          )}
                          {evento.datos_adicionales?.numero_poliza && (
                            <div className="text-muted">
                              📄 Póliza: <strong className="text-dark">{evento.datos_adicionales.numero_poliza}</strong>
                            </div>
                          )}
                          
                          {/* Cambios en póliza */}
                          {evento.datos_adicionales?.poliza_cambios?.cambios_detallados && 
                           Object.keys(evento.datos_adicionales.poliza_cambios.cambios_detallados).length > 0 && (
                            <>
                              <div className="text-muted mt-1"><strong>📋 Cambios en póliza:</strong></div>
                              {Object.entries(evento.datos_adicionales.poliza_cambios.cambios_detallados).map(([campo, cambio], idx) => {
                                const formatearCampo = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                const esFecha = campo.toLowerCase().includes('fecha') || campo.toLowerCase().includes('vigencia');
                                const valorAnterior = esFecha && cambio.anterior && !String(cambio.anterior).includes('vacío') 
                                  ? formatearFechaSinTZ(cambio.anterior) 
                                  : (cambio.anterior || '(vacío)');
                                const valorNuevo = esFecha && cambio.nuevo && !String(cambio.nuevo).includes('vacío') 
                                  ? formatearFechaSinTZ(cambio.nuevo) 
                                  : (cambio.nuevo || '(vacío)');
                                return (
                                  <div key={`poliza-${idx}`} className="text-muted ms-2">
                                    ✏️ {formatearCampo(campo)}: <span className="text-danger fw-bold">{valorAnterior}</span> → <span className="text-success fw-bold">{valorNuevo}</span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                          
                          {/* Cambios en cliente */}
                          {evento.datos_adicionales?.cliente_cambios?.cambios_detallados && 
                           Object.keys(evento.datos_adicionales.cliente_cambios.cambios_detallados).length > 0 && (
                            <>
                              <div className="text-muted mt-1"><strong>👤 Cambios en cliente:</strong></div>
                              {Object.entries(evento.datos_adicionales.cliente_cambios.cambios_detallados).map(([campo, cambio], idx) => {
                                const formatearCampo = (c) => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                return (
                                  <div key={`cliente-${idx}`} className="text-muted ms-2">
                                    ✏️ {formatearCampo(campo)}: <span className="text-danger fw-bold">{cambio.anterior || '(vacío)'}</span> → <span className="text-success fw-bold">{cambio.nuevo || '(vacío)'}</span>
                                  </div>
                                );
                              })}
                            </>
                          )}
                          
                          {/* Cambios en recibos */}
                          {evento.datos_adicionales?.recibos_cambios?.cambios_detallados && 
                           evento.datos_adicionales.recibos_cambios.cambios_detallados.length > 0 && (
                            <>
                              <div className="text-muted mt-1"><strong>📋 Cambios en recibos ({evento.datos_adicionales.recibos_cambios.cantidad_cambios}):</strong></div>
                              {evento.datos_adicionales.recibos_cambios.cambios_detallados.map((cambio, idx) => (
                                <div key={`recibo-${idx}`} className="text-muted ms-2">
                                  {cambio.tipo_cambio === 'agregado' && (
                                    <>✏️ Recibo #{cambio.numero_recibo}: <span className="text-success fw-bold">Agregado</span> - Vence: {formatearFechaSinTZ(cambio.fecha_nueva)} - ${Number(cambio.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</>
                                  )}
                                  {cambio.tipo_cambio === 'eliminado' && (
                                    <>✏️ Recibo #{cambio.numero_recibo}: <span className="text-danger fw-bold">Eliminado</span></>
                                  )}
                                  {cambio.tipo_cambio === 'editado' && (
                                    <>
                                      ✏️ Recibo #{cambio.numero_recibo}:
                                      {cambio.fecha_anterior !== cambio.fecha_nueva && (
                                        <> Fecha: <span className="text-danger fw-bold">{formatearFechaSinTZ(cambio.fecha_anterior)}</span> → <span className="text-success fw-bold">{formatearFechaSinTZ(cambio.fecha_nueva)}</span></>
                                      )}
                                      {cambio.monto_anterior !== cambio.monto_nuevo && (
                                        <> | Monto: <span className="text-danger fw-bold">${Number(cambio.monto_anterior).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> → <span className="text-success fw-bold">${Number(cambio.monto_nuevo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></>
                                      )}
                                      {cambio.estatus_anterior !== cambio.estatus_nuevo && (
                                        <> | Estatus: <span className="text-danger fw-bold">{cambio.estatus_anterior}</span> → <span className="text-success fw-bold">{cambio.estatus_nuevo}</span></>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                          
                          {/* Fallback: Lista antigua de campos modificados */}
                          {evento.datos_adicionales.campos_modificados && 
                           Array.isArray(evento.datos_adicionales.campos_modificados) &&
                           !evento.datos_adicionales.poliza_cambios && 
                           !evento.datos_adicionales.cliente_cambios && (
                            <>
                              <small className="text-muted d-block mb-1">
                                <strong>✏️ Campos modificados ({evento.datos_adicionales.campos_modificados.length}):</strong>
                              </small>
                              <div className="d-flex flex-column gap-1">
                                {evento.datos_adicionales.campos_modificados.map((cambio, idx) => (
                                  <div key={idx} className="text-dark ms-2" style={{ fontSize: '0.8rem' }}>
                                    <span className="text-muted">•</span> {cambio}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                          
                          {/* Usuario */}
                          {evento.datos_adicionales?.usuario_edito && (
                            <div className="text-muted">
                              👤 Usuario: <strong className="text-dark">{evento.datos_adicionales.usuario_edito}</strong>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Vista estándar JSON para otros eventos - FILTRAR CAMPOS DUPLICADOS */
                        (() => {
                          // Obtener lista de campos que ya se muestran en los cambios
                          const camposEditados = new Set();
                          
                          // Agregar campos de cliente_cambios
                          if (evento.datos_adicionales?.cliente_cambios?.cambios_detallados) {
                            Object.keys(evento.datos_adicionales.cliente_cambios.cambios_detallados).forEach(campo => {
                              camposEditados.add(campo);
                            });
                          }
                          
                          // Agregar campos de poliza_cambios
                          if (evento.datos_adicionales?.poliza_cambios?.cambios_detallados) {
                            Object.keys(evento.datos_adicionales.poliza_cambios.cambios_detallados).forEach(campo => {
                              camposEditados.add(campo);
                            });
                          }
                          
                          // Agregar campos de campos_editados_manualmente
                          if (evento.datos_adicionales?.campos_editados_manualmente) {
                            Object.keys(evento.datos_adicionales.campos_editados_manualmente).forEach(campo => {
                              camposEditados.add(campo);
                            });
                          }
                          
                          // Filtrar datos_adicionales para no mostrar campos duplicados
                          const datosAdicionales = { ...evento.datos_adicionales };
                          camposEditados.forEach(campo => {
                            delete datosAdicionales[campo];
                          });
                          
                          return (
                            <>
                              <small className="text-muted d-block mb-1"><strong>Datos adicionales:</strong></small>
                              <pre className="bg-light p-2 rounded mb-0" style={{ fontSize: '0.7rem', maxHeight: '150px', overflow: 'auto' }}>
                                {JSON.stringify(datosAdicionales, null, 2)}
                              </pre>
                            </>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Documento asociado */}
                  {expandido && evento.documento_url && (
                    <div className="mt-2">
                      <a 
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const { signed_url } = await pdfService.obtenerURLFirmadaPDF(expedienteId, 3600);
                            const win = window.open(signed_url, '_blank', 'noopener,noreferrer');
                            if (win) win.opener = null;
                          } catch (err) {
                            console.error('Error al obtener PDF:', err);
                            toast.error('No se pudo abrir el PDF: ' + (err?.message || 'desconocido'));
                          }
                        }}
                        className="btn btn-sm btn-outline-primary"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <ExternalLink size={12} className="me-1" />
                        Ver documento
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen al final */}
      <div className="card bg-light border-0 mt-4">
        <div className="card-body">
          <div className="row text-center">
            <div className="col-md-4">
              <h3 className="mb-0">{historial.length}</h3>
              <p className="text-muted small mb-0">Eventos totales</p>
            </div>
            <div className="col-md-4">
              <h3 className="mb-0">
                {historial.filter(e => 
                  e.tipo_evento?.includes('enviada') || e.tipo_evento?.includes('envio')
                ).length}
              </h3>
              <p className="text-muted small mb-0">Envíos</p>
            </div>
            <div className="col-md-4">
              <h3 className="mb-0">
                {historial.filter(e => 
                  e.tipo_evento?.includes('pago') || e.tipo_evento?.includes('recordatorio')
                ).length}
              </h3>
              <p className="text-muted small mb-0">Pagos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineExpediente;

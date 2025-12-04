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
  ExternalLink
} from 'lucide-react';
import { obtenerNotificacionesPorExpediente } from '../services/notificacionesService';
import * as historialService from '../services/historialExpedienteService';

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
      
      // Ordenar por fecha descendente (más reciente primero)
      eventosTimeline.sort((a, b) => new Date(b.fecha_evento) - new Date(a.fecha_evento));
      
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
          const cambios = evento.datos_adicionales?.cantidad_cambios || 0;
          const tieneCambioPago = evento.datos_adicionales?.cambio_pago || false;
          return cambios > 0 || tieneCambioPago;
        }
        return true; // Mostrar todos los demás eventos
      })
    : historial.filter(evento => {
        // Primero aplicar el filtro de eventos irrelevantes
        if (evento.tipo_evento === 'datos_actualizados' || evento.tipo_evento === 'DATOS_ACTUALIZADOS') {
          const cambios = evento.datos_adicionales?.cantidad_cambios || 0;
          const tieneCambioPago = evento.datos_adicionales?.cambio_pago || false;
          if (cambios === 0 && !tieneCambioPago) return false;
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
                      
                      {/* Vista mejorada para eventos de captura */}
                      {(evento.tipo_evento === 'captura_manual' || evento.tipo_evento === 'captura_extractor_pdf') ? (
                        <div className="mb-1">
                          {/* Línea principal: nombre del archivo o método */}
                          {evento.datos_adicionales?.nombre_archivo_pdf ? (
                            <div className="mb-1">
                              <span className="text-dark" style={{ fontSize: '0.85rem' }}>
                                📄 {evento.datos_adicionales.nombre_archivo_pdf}
                              </span>
                              {evento.datos_adicionales?.modificaciones_manuales && (
                                <span className="badge bg-warning bg-opacity-10 text-warning ms-2" style={{ fontSize: '0.75rem' }}>
                                  ✏️ {evento.datos_adicionales?.campos_modificados?.length || 0} campo(s) editado(s)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mb-1">
                              <span className="text-dark" style={{ fontSize: '0.85rem' }}>
                                ✍️ Captura manual del sistema
                              </span>
                            </div>
                          )}
                          
                          {/* Información de fechas en formato vertical compacto */}
                          <div className="d-flex flex-column gap-0" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                            {evento.datos_adicionales?.fecha_emision && evento.datos_adicionales.fecha_emision !== 'No especificada' && (
                              <div className="text-muted">
                                📅 Fecha emisión: <strong className="text-dark">{evento.datos_adicionales.fecha_emision}</strong>
                              </div>
                            )}
                            {evento.datos_adicionales?.inicio_vigencia && evento.datos_adicionales.inicio_vigencia !== 'No especificada' && (
                              <div className="text-muted">
                                🔖 Inicio vigencia: <strong className="text-dark">{evento.datos_adicionales.inicio_vigencia}</strong>
                              </div>
                            )}
                            <div className="text-muted">
                              🕐 Fecha captura: <strong className="text-dark">{formatearFecha(evento.fecha_evento)}</strong>
                            </div>
                            {evento.usuario_nombre && (
                              <div className="text-muted">
                                👤 Usuario: <strong className="text-dark">{evento.usuario_nombre}</strong>
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
                                📤 Canal: <strong className="text-dark">{evento.metodo_contacto}</strong>
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
                            
                            {/* Cambio de etapa (si aplica) */}
                            {evento.etapa_anterior && evento.etapa_nueva && (
                              <div className="text-muted">
                                📊 Etapa: <strong className="text-dark">{evento.etapa_anterior} → {evento.etapa_nueva}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (evento.tipo_evento === 'aviso_pago_enviado' || evento.tipo_evento === 'recordatorio_pago_enviado') ? (
                        /* Vista vertical para eventos de aviso/recordatorio de pago */
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
                                📤 Canal: <strong className="text-dark">{evento.metodo_contacto}</strong>
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
                                💵 Monto: <strong className="text-dark">${evento.datos_adicionales.monto}</strong>
                              </div>
                            )}
                            
                            {evento.datos_adicionales?.estado_pago && (
                              <div className="text-muted">
                                📊 Estado: <strong className={`text-${evento.datos_adicionales.estado_pago === 'Vencido' ? 'danger' : evento.datos_adicionales.estado_pago === 'Pagado' ? 'success' : 'warning'}`}>
                                  {evento.datos_adicionales.estado_pago}
                                </strong>
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
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Vista estándar para otros eventos */}
                          {evento.descripcion && (
                            <p className="text-dark mb-1" style={{ fontSize: '0.85rem', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                              {evento.descripcion}
                            </p>
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
                      {(evento.tipo_evento === 'datos_actualizados' || evento.tipo_evento === 'DATOS_ACTUALIZADOS') && 
                       evento.datos_adicionales.campos_modificados && 
                       Array.isArray(evento.datos_adicionales.campos_modificados) ? (
                        <div>
                          <small className="text-muted d-block mb-2">
                            <strong>✏️ Campos modificados ({evento.datos_adicionales.campos_modificados.length}):</strong>
                          </small>
                          <div className="d-flex flex-column gap-1">
                            {evento.datos_adicionales.campos_modificados.map((cambio, idx) => (
                              <div key={idx} className="text-dark" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                                <span className="text-muted">•</span> {cambio}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Vista estándar JSON para otros eventos */
                        <>
                          <small className="text-muted d-block mb-1"><strong>Datos adicionales:</strong></small>
                          <pre className="bg-light p-2 rounded mb-0" style={{ fontSize: '0.7rem', maxHeight: '150px', overflow: 'auto' }}>
                            {JSON.stringify(evento.datos_adicionales, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  )}

                  {/* Documento asociado */}
                  {expandido && evento.documento_url && (
                    <div className="mt-2">
                      <a 
                        href={evento.documento_url}
                        target="_blank"
                        rel="noopener noreferrer"
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

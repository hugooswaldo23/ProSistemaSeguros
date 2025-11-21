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
      
      // Convertir notificaciones a formato timeline
      const eventosTimeline = notificaciones.map(notif => ({
        id: notif.id,
        expediente_id: notif.expediente_id,
        cliente_id: notif.cliente_id,
        tipo_evento: mapearTipoNotificacionAEvento(notif.tipo_notificacion, notif.tipo_mensaje),
        fecha_evento: notif.fecha_envio || notif.created_at,
        usuario_nombre: notif.enviado_por_nombre || 'Sistema',
        descripcion: notif.mensaje || notif.asunto || '',
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
      }));
      
      // Agregar eventos sintéticos basados en fechas del expediente
      if (expedienteData) {
        console.log('📅 Fechas del expediente:', {
          fecha_creacion: expedienteData.fecha_creacion,
          created_at: expedienteData.created_at,
          fecha_emision: expedienteData.fecha_emision,
          fecha_pago: expedienteData.fecha_pago,
          estatusPago: expedienteData.estatusPago,
          inicio_vigencia: expedienteData.inicio_vigencia
        });

        // 1. Fecha de CAPTURA (cuando se registró en el sistema)
        // Usar created_at o fecha_creacion (son lo mismo)
        const fechaCaptura = expedienteData.created_at || expedienteData.fecha_creacion;
        if (fechaCaptura) {
          eventosTimeline.push({
            id: 'captura-sintetico',
            expediente_id: expedienteData.id,
            cliente_id: expedienteData.cliente_id,
            tipo_evento: 'poliza_emitida',
            fecha_evento: fechaCaptura,
            usuario_nombre: expedienteData.usuario_nombre || 'Sistema',
            descripcion: `📝 Póliza capturada en el sistema`,
            datos_adicionales: {
              numero_poliza: expedienteData.numero_poliza,
              compania: expedienteData.compania,
              producto: expedienteData.producto,
              _es_sintetico: true,
              _tipo: 'captura'
            }
          });
        }
        
        // 2. Fecha de PAGO - Solo si realmente se aplicó el pago
        // Verificar que estatusPago sea "Pagado" o "Completado" y que fecha_pago exista
        const pagoAplicado = expedienteData.estatusPago === 'Pagado' || 
                             expedienteData.estatusPago === 'Completado' ||
                             expedienteData.estatusPago === 'pagado';
        
        if (expedienteData.fecha_pago && pagoAplicado) {
          eventosTimeline.push({
            id: 'pago-sintetico',
            expediente_id: expedienteData.id,
            cliente_id: expedienteData.cliente_id,
            tipo_evento: 'pago_registrado',
            fecha_evento: expedienteData.fecha_pago,
            usuario_nombre: 'Sistema',
            descripcion: `💰 Pago registrado${expedienteData.total ? ': $' + expedienteData.total.toLocaleString('es-MX') : ''}`,
            datos_adicionales: {
              numero_poliza: expedienteData.numero_poliza,
              monto: expedienteData.total,
              tipo_pago: expedienteData.tipo_pago,
              _es_sintetico: true,
              _tipo: 'pago'
            }
          });
        }
      }
      
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
      'emision': tipoNotif === 'whatsapp' ? 'poliza_enviada_whatsapp' : 'poliza_enviada_email',
      'recordatorio_pago': 'recordatorio_pago_enviado',
      'pago_vencido': 'pago_vencido',
      'pago_recibido': 'pago_registrado',
      'renovacion': 'poliza_renovada',
      'cancelacion': 'poliza_cancelada',
      'modificacion': 'endoso_aplicado',
      'otro': 'nota_agregada'
    };
    
    return mapaMensajes[tipoMensaje] || 'documento_enviado';
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
    ? historial
    : historial.filter(evento => {
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
    const fecha = new Date(fechaISO);
    if (isNaN(fecha.getTime())) return fechaISO; // Fallback si formato raro
    const hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
    const esMismoDia = fecha.toDateString() === hoy.toDateString();
    const esAyer = fecha.toDateString() === ayer.toDateString();
    const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const segundos = fecha.getSeconds();
    // Mostrar minutos siempre y segundos si no son 0 para diagnósticos
    const horaDetallada = segundos ? fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : hora;
    if (esMismoDia) return `Hoy ${horaDetallada}`;
    if (esAyer) return `Ayer ${horaDetallada}`;
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + horaDetallada;
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
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <strong style={{ color: estilo.color, fontSize: '0.9rem' }}>
                          {titulo}
                        </strong>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {formatearFecha(evento.fecha_evento)}
                        </span>
                      </div>
                      
                      {evento.descripcion && (
                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                          {evento.descripcion}
                        </p>
                      )}
                      
                      {/* Información adicional compacta */}
                      <div style={{ fontSize: '0.75rem' }}>
                        {evento.etapa_anterior && evento.etapa_nueva && (
                          <span className="text-muted me-2">
                            📊 {evento.etapa_anterior} → {evento.etapa_nueva}
                          </span>
                        )}
                        {evento.destinatario_nombre && (
                          <span className="text-muted me-2">
                            👤 {evento.destinatario_nombre}
                          </span>
                        )}
                        {evento.metodo_contacto && (
                          <span className="badge bg-secondary bg-opacity-10 text-secondary me-2" style={{ fontSize: '0.7rem' }}>
                            {evento.metodo_contacto}
                          </span>
                        )}
                        {evento.usuario_nombre && (
                          <span className="text-muted">
                            ✍️ {evento.usuario_nombre}
                          </span>
                        )}
                      </div>
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
                      <small className="text-muted d-block mb-1"><strong>Datos adicionales:</strong></small>
                      <pre className="bg-light p-2 rounded mb-0" style={{ fontSize: '0.7rem', maxHeight: '150px', overflow: 'auto' }}>
                        {JSON.stringify(evento.datos_adicionales, null, 2)}
                      </pre>
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

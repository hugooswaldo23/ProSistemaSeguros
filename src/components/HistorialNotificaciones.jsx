/**
 * Componente: Historial de Notificaciones
 * Muestra el historial de comunicaciones enviadas al cliente (WhatsApp, Email, SMS)
 */

import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, Mail, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import * as notificacionesService from '../services/notificacionesService';

const HistorialNotificaciones = ({ expedienteId, clienteId, modo = 'expediente' }) => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandidas, setExpandidas] = useState(new Set());

  // Cargar notificaciones
  useEffect(() => {
    cargarNotificaciones();
  }, [expedienteId, clienteId, modo]);

  const cargarNotificaciones = async () => {
    setCargando(true);
    setError(null);
    try {
      let data;
      if (modo === 'expediente' && expedienteId) {
        data = await notificacionesService.obtenerNotificacionesPorExpediente(expedienteId);
      } else if (modo === 'cliente' && clienteId) {
        data = await notificacionesService.obtenerNotificacionesPorCliente(clienteId);
      }
      setNotificaciones(data || []);
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
      setError('No se pudo cargar el historial de notificaciones');
    } finally {
      setCargando(false);
    }
  };

  const toggleExpansion = (id) => {
    const nuevasExpandidas = new Set(expandidas);
    if (nuevasExpandidas.has(id)) {
      nuevasExpandidas.delete(id);
    } else {
      nuevasExpandidas.add(id);
    }
    setExpandidas(nuevasExpandidas);
  };

  // Obtener icono según tipo de notificación
  const getIcono = (tipo) => {
    switch (tipo) {
      case 'whatsapp':
        return <MessageCircle size={16} className="text-success" />;
      case 'email':
        return <Mail size={16} className="text-primary" />;
      case 'sms':
        return <MessageSquare size={16} className="text-info" />;
      default:
        return <Bell size={16} className="text-secondary" />;
    }
  };

  // Obtener badge según tipo de mensaje
  const getBadgeTipoMensaje = (tipoMensaje) => {
    const badges = {
      'emision': { text: 'Emisión', class: 'bg-success' },
      'recordatorio_pago': { text: 'Recordatorio', class: 'bg-warning' },
      'pago_vencido': { text: 'Vencido', class: 'bg-danger' },
      'pago_recibido': { text: 'Pago Recibido', class: 'bg-success' },
      'renovacion': { text: 'Renovación', class: 'bg-info' },
      'cancelacion': { text: 'Cancelación', class: 'bg-dark' },
      'modificacion': { text: 'Modificación', class: 'bg-primary' },
      'otro': { text: 'Otro', class: 'bg-secondary' }
    };
    const badge = badges[tipoMensaje] || badges.otro;
    return <span className={`badge ${badge.class} badge-sm`}>{badge.text}</span>;
  };

  // Obtener badge según estado de envío
  const getBadgeEstadoEnvio = (estado) => {
    switch (estado) {
      case 'enviado':
        return <CheckCircle size={14} className="text-success" title="Enviado" />;
      case 'fallido':
        return <XCircle size={14} className="text-danger" title="Fallido" />;
      case 'pendiente':
        return <Clock size={14} className="text-warning" title="Pendiente" />;
      default:
        return <AlertCircle size={14} className="text-secondary" title="Desconocido" />;
    }
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (cargando) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <AlertCircle size={16} className="me-2" />
        {error}
      </div>
    );
  }

  if (notificaciones.length === 0) {
    return (
      <div className="alert alert-info" role="alert">
        <Bell size={16} className="me-2" />
        No hay notificaciones registradas para {modo === 'expediente' ? 'esta póliza' : 'este cliente'}.
      </div>
    );
  }

  return (
    <div className="historial-notificaciones">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">
          <Bell size={18} className="me-2" />
          Historial de Comunicaciones ({notificaciones.length})
        </h6>
        <button 
          className="btn btn-sm btn-outline-secondary"
          onClick={cargarNotificaciones}
          title="Recargar"
        >
          🔄
        </button>
      </div>

      <div className="list-group">
        {notificaciones.map((notif) => (
          <div key={notif.id} className="list-group-item">
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1">
                <div className="d-flex align-items-center mb-2">
                  {getIcono(notif.tipo_notificacion)}
                  <span className="ms-2 fw-semibold">{notif.tipo_notificacion.toUpperCase()}</span>
                  <span className="ms-2">{getBadgeTipoMensaje(notif.tipo_mensaje)}</span>
                  <span className="ms-2">{getBadgeEstadoEnvio(notif.estado_envio)}</span>
                </div>

                <div className="small text-muted mb-1">
                  <Clock size={12} className="me-1" />
                  {formatearFecha(notif.fecha_envio)}
                </div>

                <div className="small mb-1">
                  <strong>Para:</strong> {notif.destinatario_nombre || 'N/A'} 
                  <span className="text-muted ms-2">({notif.destinatario_contacto})</span>
                </div>

                {notif.numero_poliza && (
                  <div className="small text-muted mb-1">
                    <strong>Póliza:</strong> {notif.numero_poliza} | 
                    <strong className="ms-2">Estatus pago:</strong> {notif.estatus_pago || 'N/A'}
                  </div>
                )}

                {notif.asunto && (
                  <div className="small mb-1">
                    <strong>Asunto:</strong> {notif.asunto}
                  </div>
                )}

                <button
                  className="btn btn-sm btn-link p-0 text-decoration-none"
                  onClick={() => toggleExpansion(notif.id)}
                >
                  {expandidas.has(notif.id) ? (
                    <>
                      <ChevronUp size={14} /> Ocultar mensaje
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Ver mensaje completo
                    </>
                  )}
                </button>

                {expandidas.has(notif.id) && (
                  <div className="mt-2 p-2 bg-light rounded small" style={{ whiteSpace: 'pre-wrap' }}>
                    {notif.mensaje}
                  </div>
                )}

                {notif.pdf_url && (
                  <div className="small text-muted mt-2">
                    📄 Se compartió PDF (expira: {formatearFecha(notif.pdf_expiracion)})
                  </div>
                )}

                {notif.notas && (
                  <div className="small text-muted mt-2">
                    📝 <em>{notif.notas}</em>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorialNotificaciones;

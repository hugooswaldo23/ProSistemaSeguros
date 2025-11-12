/**
 * ====================================================================
 * COMPONENTE: Timeline de Expediente
 * PROPÓSITO: Mostrar la trazabilidad completa del ciclo de vida
 * FECHA: 2025-11-10
 * ====================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Filter, 
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import {
  obtenerHistorialExpediente,
  obtenerEstiloEvento,
  obtenerTituloEvento,
  TIPOS_EVENTO
} from '../services/historialExpedienteService';

const TimelineExpediente = ({ expedienteId }) => {
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
      const datos = await obtenerHistorialExpediente(expedienteId);
      setHistorial(datos);
    } catch (err) {
      console.error('Error al cargar historial:', err);
      setError('No se pudo cargar el historial del expediente');
    } finally {
      setCargando(false);
    }
  };

  // Agrupar eventos por categoría
  const categoriasEventos = {
    'Cotización': [
      TIPOS_EVENTO.COTIZACION_CREADA,
      TIPOS_EVENTO.COTIZACION_ENVIADA,
      TIPOS_EVENTO.COTIZACION_AUTORIZADA,
      TIPOS_EVENTO.COTIZACION_RECHAZADA
    ],
    'Emisión': [
      TIPOS_EVENTO.EMISION_INICIADA,
      TIPOS_EVENTO.POLIZA_EMITIDA,
      TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL,
      TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP
    ],
    'Pagos': [
      TIPOS_EVENTO.PAGO_REGISTRADO,
      TIPOS_EVENTO.PAGO_VENCIDO,
      TIPOS_EVENTO.RECORDATORIO_PAGO_ENVIADO
    ],
    'Renovaciones': [
      TIPOS_EVENTO.RENOVACION_INICIADA,
      TIPOS_EVENTO.POLIZA_RENOVADA,
      TIPOS_EVENTO.RECORDATORIO_RENOVACION_ENVIADO
    ],
    'Cancelaciones': [
      TIPOS_EVENTO.POLIZA_CANCELADA,
      TIPOS_EVENTO.SOLICITUD_CANCELACION
    ],
    'Comunicaciones': [
      TIPOS_EVENTO.DOCUMENTO_ENVIADO,
      TIPOS_EVENTO.NOTA_AGREGADA,
      TIPOS_EVENTO.LLAMADA_REGISTRADA,
      TIPOS_EVENTO.REUNION_REGISTRADA
    ]
  };

  // Filtrar historial
  const historialFiltrado = filtroTipo === 'todos' 
    ? historial
    : historial.filter(evento => {
        const categoria = Object.entries(categoriasEventos).find(([cat, tipos]) => 
          tipos.includes(evento.tipo_evento)
        );
        return categoria && categoria[0].toLowerCase() === filtroTipo.toLowerCase();
      });

  // Formatear fecha
  const formatearFecha = (fechaISO) => {
    const fecha = new Date(fechaISO);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    
    const esMismoDia = fecha.toDateString() === hoy.toDateString();
    const esAyer = fecha.toDateString() === ayer.toDateString();
    
    const hora = fecha.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (esMismoDia) {
      return `Hoy ${hora}`;
    } else if (esAyer) {
      return `Ayer ${hora}`;
    } else {
      return fecha.toLocaleString('es-MX', { 
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
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
      <div className="text-center py-5">
        <Clock size={48} className="text-muted mb-3" />
        <h6 className="text-muted">No hay eventos registrados</h6>
        <p className="text-muted small">
          Los eventos del ciclo de vida del expediente aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="timeline-expediente">
      {/* Header con filtros */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="mb-0">
          <Clock size={20} className="me-2" />
          Historial del Expediente
          <span className="badge bg-primary ms-2">{historialFiltrado.length}</span>
        </h6>
        
        <div className="d-flex gap-2">
          {/* Filtro por categoría */}
          <div className="dropdown">
            <button 
              className="btn btn-sm btn-outline-secondary dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
            >
              <Filter size={16} className="me-1" />
              {filtroTipo === 'todos' ? 'Todos' : filtroTipo}
            </button>
            <ul className="dropdown-menu">
              <li>
                <button 
                  className="dropdown-item" 
                  onClick={() => setFiltroTipo('todos')}
                >
                  Todos los eventos
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              {Object.keys(categoriasEventos).map(categoria => (
                <li key={categoria}>
                  <button 
                    className="dropdown-item"
                    onClick={() => setFiltroTipo(categoria)}
                  >
                    {categoria}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Botón exportar */}
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={exportarHistorial}
          >
            <Download size={16} className="me-1" />
            Exportar
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline">
        {historialFiltrado.map((evento, index) => {
          const estilo = obtenerEstiloEvento(evento.tipo_evento);
          const titulo = obtenerTituloEvento(evento.tipo_evento);
          const expandido = eventoExpandido === evento.id;

          return (
            <div 
              key={evento.id} 
              className="timeline-item"
              style={{ marginBottom: '1.5rem' }}
            >
              {/* Línea conectora */}
              {index < historialFiltrado.length - 1 && (
                <div 
                  className="timeline-line"
                  style={{
                    position: 'absolute',
                    left: '20px',
                    top: '40px',
                    width: '2px',
                    height: 'calc(100% + 1rem)',
                    backgroundColor: '#dee2e6'
                  }}
                />
              )}

              <div className="d-flex align-items-start">
                {/* Icono del evento */}
                <div 
                  className="timeline-icon flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: estilo.bgColor,
                    border: `2px solid ${estilo.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    zIndex: 1,
                    position: 'relative'
                  }}
                  title={titulo}
                >
                  {estilo.icon}
                </div>

                {/* Contenido del evento */}
                <div className="timeline-content flex-grow-1 ms-3">
                  <div 
                    className="card border-0 shadow-sm"
                    style={{ borderLeft: `4px solid ${estilo.color}` }}
                  >
                    <div className="card-body">
                      {/* Header del evento */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-1" style={{ color: estilo.color }}>
                            {titulo}
                          </h6>
                          <p className="text-muted small mb-0">
                            <Clock size={14} className="me-1" />
                            {formatearFecha(evento.fecha_evento)}
                            {evento.usuario_nombre && (
                              <span className="ms-2">
                                • Por: <strong>{evento.usuario_nombre}</strong>
                              </span>
                            )}
                          </p>
                        </div>
                        
                        {/* Botón expandir/colapsar */}
                        {(evento.datos_adicionales || evento.documento_url) && (
                          <button
                            className="btn btn-sm btn-link text-secondary p-0"
                            onClick={() => setEventoExpandido(expandido ? null : evento.id)}
                          >
                            {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        )}
                      </div>

                      {/* Descripción */}
                      {evento.descripcion && (
                        <p className="mb-2">{evento.descripcion}</p>
                      )}

                      {/* Cambio de etapa */}
                      {evento.etapa_anterior && evento.etapa_nueva && (
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="badge bg-secondary">{evento.etapa_anterior}</span>
                          <span>→</span>
                          <span className="badge bg-primary">{evento.etapa_nueva}</span>
                        </div>
                      )}

                      {/* Información de contacto */}
                      {evento.destinatario_nombre && (
                        <div className="small text-muted">
                          <strong>Destinatario:</strong> {evento.destinatario_nombre}
                          {evento.destinatario_contacto && (
                            <span> ({evento.destinatario_contacto})</span>
                          )}
                          {evento.metodo_contacto && (
                            <span className="ms-2">
                              <span className="badge bg-light text-dark">
                                {evento.metodo_contacto}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Documento asociado */}
                      {evento.documento_url && (
                        <div className="mt-2">
                          <a 
                            href={evento.documento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-primary"
                          >
                            <ExternalLink size={14} className="me-1" />
                            Ver documento
                          </a>
                        </div>
                      )}

                      {/* Detalles expandibles */}
                      {expandido && evento.datos_adicionales && (
                        <div className="mt-3 pt-3 border-top">
                          <h6 className="small text-muted mb-2">Detalles adicionales:</h6>
                          <pre className="bg-light p-2 rounded small mb-0" style={{ fontSize: '0.8rem' }}>
                            {JSON.stringify(evento.datos_adicionales, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
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
            <div className="col-md-3">
              <h3 className="mb-0">{historial.length}</h3>
              <p className="text-muted small mb-0">Eventos totales</p>
            </div>
            <div className="col-md-3">
              <h3 className="mb-0">
                {historial.filter(e => 
                  categoriasEventos['Cotización'].includes(e.tipo_evento)
                ).length}
              </h3>
              <p className="text-muted small mb-0">Cotizaciones</p>
            </div>
            <div className="col-md-3">
              <h3 className="mb-0">
                {historial.filter(e => 
                  [TIPOS_EVENTO.POLIZA_ENVIADA_EMAIL, TIPOS_EVENTO.POLIZA_ENVIADA_WHATSAPP].includes(e.tipo_evento)
                ).length}
              </h3>
              <p className="text-muted small mb-0">Envíos</p>
            </div>
            <div className="col-md-3">
              <h3 className="mb-0">
                {historial.filter(e => 
                  categoriasEventos['Comunicaciones'].includes(e.tipo_evento)
                ).length}
              </h3>
              <p className="text-muted small mb-0">Comunicaciones</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineExpediente;

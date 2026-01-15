import React, { useMemo, useState } from 'react';
import './detalle-expediente.css';
import { User, FileText, Calendar, Package, DollarSign, Shield } from 'lucide-react';

// Recibe props: datos (objeto de expediente), utils (formateadores), coberturas, mensajes, etc.
// historialSlot: opcional, ReactNode para renderizar un historial personalizado dentro del acordeón
const DetalleExpediente = ({ 
  datos, 
  utils = {}, 
  coberturas, 
  mensajes, 
  historialSlot, 
  modo = 'acordeon',
  autoOpenCoberturas = false,
  autoOpenHistorial = false,
  showResumenChips = true,
  highlightPago = true,
  caratulaColapsable = true,
  onHistorialClick
}) => {
  // Estados controlados en React para no depender del JS de Bootstrap
  const [openGeneral, setOpenGeneral] = useState(false);
  const [openVehiculoCoberturas, setOpenVehiculoCoberturas] = useState(false);
  const [openHistorial, setOpenHistorial] = useState(false);

  const esAutos = useMemo(() => (datos?.producto || '').toLowerCase().includes('auto'), [datos?.producto]);
  const tipoRiesgo = useMemo(() => {
    const texto = `${datos?.producto || ''} ${datos?.tipo_de_poliza || ''}`.toLowerCase();
    if (/auto|veh|moto|camion|camión|pickup|remolque/.test(texto)) return 'vehiculo';
    if (/embarc|lancha|yate|barco|mar(í|i)tim/.test(texto)) return 'embarcacion';
    if (/vida|ahorro|educativo|accidentes|ap|gmm|gastos m(é|e)dicos|salud/.test(texto)) return 'persona';
    if (/hogar|casa|inmueble|propiedad|empresa|negocio|da(ñ|n)os|comerc/.test(texto)) return 'bien';
    return 'generico';
  }, [datos?.producto, datos?.tipo_de_poliza]);

  const renderCampo = (label, valor, opts = {}) => {
    const { strong = true, className = '', forceShow = false } = opts;
    // Si forceShow está activado, mostrar siempre (para campos financieros con $0.00)
    if (!forceShow && (valor === undefined || valor === null || valor === '' || valor === '-')) return null;
    return (
      <div className={`col-md-3 mb-1 ${className}`}>
        <small className="text-muted" style={{ fontSize: '0.6rem' }}>{label}:</small>
        <div>
          {strong ? <strong style={{ fontSize: '0.7rem' }}>{valor}</strong> : <span style={{ fontSize: '0.7rem' }}>{valor}</span>}
        </div>
      </div>
    );
  };

  const calcularDias = (fecha) => {
    if (!fecha) return null;
    const hoy = new Date();
    const f = new Date(fecha);
    hoy.setHours(0,0,0,0);
    f.setHours(0,0,0,0);
    return Math.ceil((f - hoy) / (1000*60*60*24));
  };

  const pagoInfo = useMemo(() => {
    const proximo = datos?.fecha_vencimiento_pago || datos?.proximoPago || datos?.fecha_pago || null;
    const dias = calcularDias(proximo);
    let estatus = datos?.estatusPago || 'Sin definir';
    if (!datos?.estatusPago && proximo) {
      if (dias < 0) estatus = 'Vencido';
      else if (dias <= 30) estatus = 'Pago por vencer';
      else estatus = 'Sin definir';
    }
    let clase = 'bg-secondary';
    if (highlightPago) {
      if (estatus === 'Vencido') clase = 'bg-danger';
      else if (estatus === 'Pago por vencer') clase = 'bg-warning text-dark';
      else if (estatus === 'Pagado') clase = 'bg-success';
      else clase = 'bg-secondary';
    }
    return { proximo, dias, estatus, clase };
  }, [datos?.estatusPago, datos?.fecha_vencimiento_pago, datos?.proximoPago, datos?.fecha_pago, highlightPago]);

  // Normalizar alias para Uso / Servicio / Movimiento provenientes del backend o del extractor
  const usoMostrar = datos?.uso || datos?.uso_poliza || datos?.Uso || datos?.usoVehiculo || datos?.uso_vehiculo || '';
  const servicioMostrar = datos?.servicio || datos?.servicio_poliza || datos?.Servicio || datos?.servicioVehiculo || datos?.servicio_vehiculo || '';
  const movimientoMostrar = datos?.movimiento || datos?.movimiento_poliza || datos?.Movimiento || datos?.movimientoVehiculo || datos?.movimiento_vehiculo || '';

  // Determinar tipo de pago mostrado (prioriza forma_pago del PDF sobre tipo_pago calculado)
  const tipoPagoMostrar = useMemo(() => {
    const forma = (datos?.forma_pago || '').trim().toUpperCase();
    const tipo = (datos?.tipo_pago || '').trim();
    const normalizar = (v) => v ? v.charAt(0) + v.slice(1).toLowerCase() : '';
    
    // PRIORIDAD 1: Si existe forma_pago extraída del PDF, usarla SIEMPRE
    if (forma) return normalizar(forma);
    
    // PRIORIDAD 2: Si no hay forma_pago, usar tipo_pago normalizado
    if (tipo && !['FRACCIONADO',''].includes(tipo.toUpperCase())) return normalizar(tipo);
    
    // FALLBACK: Devolver lo que haya
    return tipo || forma || 'No especificado';
  }, [datos?.forma_pago, datos?.tipo_pago]);

  const Caratula = () => (
    <div className="card border-0 shadow-sm mb-2">
      <div className="card-header bg-light py-1 px-2">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-1">
          <small className="mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>Datos Generales de Póliza</small>
          {showResumenChips && (
            <div className="d-flex flex-wrap gap-1">
              {datos?.compania && (
                <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: '0.65rem' }}>{datos.compania}</span>
              )}
              {datos?.numero_poliza && (
                <span className="badge bg-secondary-subtle text-secondary border" style={{ fontSize: '0.65rem' }}>Póliza #{datos.numero_poliza}</span>
              )}
              {datos?.termino_vigencia && (
                <span className="badge bg-info-subtle text-info border" style={{ fontSize: '0.65rem' }}>
                  Termina {utils.formatearFecha?.(datos.termino_vigencia, 'cortaY')?.toUpperCase() || '-'}
                </span>
              )}
              <span className={`badge ${pagoInfo.clase} border`} style={{ fontSize: '0.65rem' }}> {pagoInfo.estatus}
                {pagoInfo.dias !== null && pagoInfo.estatus !== 'Pagado' && (
                  <span className="ms-1">{pagoInfo.dias < 0 ? `${Math.abs(pagoInfo.dias)} días vencido` : `en ${pagoInfo.dias} días`}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="card-body py-2 px-2">
        {/* Asegurado */}
        <div className="seccion-bloque seccion-asegurado">
          <h6 className="text-primary mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            👤 Información del {datos?.tipo_persona === 'Moral' ? 'Asegurado (Persona Moral)' : 'Asegurado'}
          </h6>
          <div className="row g-1">
            {datos?.tipo_persona === 'Moral' ? (
              renderCampo('Razón Social', datos?.razonSocial || datos?.razon_social || '-')
            ) : (
              renderCampo('Nombre Completo', `${datos?.nombre || ''} ${datos?.apellido_paterno || ''} ${datos?.apellido_materno || ''}`.trim())
            )}
            {renderCampo('Conductor Habitual', datos?.conductor_habitual || 'Mismo que asegurado')}
          </div>
        </div>

        {/* Póliza */}
        <div className="seccion-bloque seccion-poliza">
          <h6 className="text-primary mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>📋 Datos de la Póliza</h6>
          <div className="row g-1">
            {renderCampo('Compañía', datos?.compania)}
            {renderCampo('Número de Póliza', datos?.numero_poliza)}
            {renderCampo('Endoso', datos?.endoso)}
            {renderCampo('Inciso', datos?.inciso)}
            {renderCampo('Plan', datos?.plan?.toUpperCase?.() || datos?.plan)}
            {renderCampo('Producto', datos?.producto)}
            {renderCampo('Tipo de Pago', tipoPagoMostrar || datos?.tipo_pago)}
            {renderCampo('Agente', datos?.agente)}
          </div>
        </div>

        {/* Vigencia */}
        <div className="seccion-bloque seccion-vigencia">
          <h6 className="text-success mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>📅 Vigencia de la Póliza</h6>
          <div className="row g-1">
            {renderCampo('Inicio', datos?.inicio_vigencia ? utils.formatearFecha?.(datos.inicio_vigencia, 'cortaY')?.toUpperCase() : '-')}
            {renderCampo('Fin', datos?.termino_vigencia ? utils.formatearFecha?.(datos.termino_vigencia, 'cortaY')?.toUpperCase() : '-')}
            {/* Siempre mostrar Aviso de Renovación, incluso si está vacío */}
            <div className="col-md-3 mb-1 text-warning">
              <small className="text-muted" style={{ fontSize: '0.6rem' }}>🔔 Aviso de Renovación:</small>
              <div>
                <strong style={{ fontSize: '0.7rem' }}>
                  {datos?.fecha_aviso_renovacion ? utils.formatearFecha?.(datos.fecha_aviso_renovacion, 'cortaY')?.toUpperCase() : '-'}
                </strong>
              </div>
            </div>
            {renderCampo('Fecha de Emisión', datos?.fecha_emision ? utils.formatearFecha?.(datos.fecha_emision, 'cortaY')?.toUpperCase() : '-')}
            {renderCampo('Fecha de Captura', datos?.fecha_captura ? utils.formatearFecha?.(datos.fecha_captura, 'cortaY')?.toUpperCase() : '-')}
          </div>
        </div>

        {/* Financiera (subida antes de vehículo) */}
        <div className="seccion-bloque seccion-financiera">
          <h6 className="text-secondary mb-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>💰 Información Financiera</h6>
          <div className="row g-1">
            {renderCampo('1. Prima Neta', utils.formatearMoneda?.(datos?.prima_neta || '0.00'), { forceShow: true })}
            {renderCampo('2. Otros Descuentos', utils.formatearMoneda?.(datos?.otros_servicios || '0.00'), { forceShow: true })}
            {renderCampo('3. Financiamiento por pago fraccionado', utils.formatearMoneda?.(datos?.cargo_pago_fraccionado || '0.00'), { forceShow: true })}
            {renderCampo('4. Gastos de expedición', utils.formatearMoneda?.(datos?.gastos_expedicion || '0.00'), { forceShow: true })}
            {renderCampo('5. I.V.A.', utils.formatearMoneda?.(datos?.iva || '0.00'), { forceShow: true })}
            {renderCampo('6. Total a pagar', utils.formatearMoneda?.(datos?.total || '0.00'), { forceShow: true })}
            {renderCampo('Cesión de Comisión', utils.formatearMoneda?.(datos?.cesion_comision || '0.00'), { forceShow: true })}
            {renderCampo('1er. Pago', utils.formatearMoneda?.(datos?.primer_pago || '0.00'), { forceShow: true })}
            {renderCampo('Subsecuentes', utils.formatearMoneda?.(datos?.pagos_subsecuentes || '0.00'), { forceShow: true })}
            {renderCampo('Forma de Pago', (tipoPagoMostrar || datos?.tipo_pago)?.toUpperCase?.())}
          </div>
        </div>

        {/* Vehículo removido de carátula para agruparlo con Coberturas más abajo */}
      </div>
    </div>
  );

  return (
    <div>
      {/* DATOS GENERALES DE PÓLIZA */}
      {modo === 'caratula' ? (
        caratulaColapsable ? (
          <div className="accordion mb-3" id="accordionCaratulaGeneral">
            <div className="accordion-item">
              <h2 className="accordion-header" id="headingCaratulaGeneral">
                <button 
                  className={`accordion-button ${openGeneral ? '' : 'collapsed'}`}
                  type="button"
                  aria-expanded={openGeneral}
                  aria-controls="collapseCaratulaGeneral"
                  onClick={() => setOpenGeneral(v => !v)}
                >
                  Datos Generales de Póliza
                </button>
              </h2>
              <div 
                id="collapseCaratulaGeneral" 
                className={`accordion-collapse collapse ${openGeneral ? 'show' : ''}`}
                aria-labelledby="headingCaratulaGeneral"
              >
                <div className="accordion-body p-0">
                  <Caratula />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Caratula />
        )
      ) : (
      <div className="accordion mb-3" id="accordionDatosGeneralesPoliza">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingDatosGeneralesPoliza">
            <button 
              className={`accordion-button ${openGeneral ? '' : 'collapsed'}`}
              type="button"
              aria-expanded={openGeneral}
              aria-controls="collapseDatosGeneralesPoliza"
              onClick={() => setOpenGeneral(v => !v)}
            >
              Datos Generales de Póliza
            </button>
          </h2>
          <div 
            id="collapseDatosGeneralesPoliza" 
            className={`accordion-collapse collapse ${openGeneral ? 'show' : ''}`}
            aria-labelledby="headingDatosGeneralesPoliza"
          >
            <div className="accordion-body py-1 px-2">
              {/* INFORMACIÓN DEL ASEGURADO */}
              <div className="p-1 bg-light rounded mb-1">
                <h6 className="text-primary mb-1" style={{ fontSize: '0.7rem', fontWeight: '600' }}>
                  👤 INFORMACIÓN DEL {datos.tipo_persona === 'Moral' ? 'ASEGURADO (PERSONA MORAL)' : 'ASEGURADO'}
                </h6>
                <div className="row g-1">
                  {datos?.tipo_persona === 'Moral' ? (
                    <div className="col-md-6">
                      <small className="text-muted" style={{ fontSize: '0.6rem' }}>Razón Social:</small>
                      <div><strong style={{ fontSize: '0.7rem' }}>{datos.razonSocial || datos.razon_social || '-'}</strong></div>
                    </div>
                  ) : (
                    <div className="col-md-6">
                      <small className="text-muted" style={{ fontSize: '0.6rem' }}>Nombre Completo:</small>
                      <div><strong style={{ fontSize: '0.7rem' }}>{datos.nombre} {datos.apellido_paterno} {datos.apellido_materno}</strong></div>
                    </div>
                  )}
                  <div className="col-md-6">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Conductor Habitual:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.conductor_habitual || 'Mismo que asegurado'}</strong></div>
                  </div>
                </div>
              </div>
              {/* DATOS DE LA PÓLIZA */}
              <div className="p-1 bg-primary bg-opacity-10 rounded mb-1">
                <h6 className="text-primary mb-1" style={{ fontSize: '0.7rem', fontWeight: '600' }}>📋 DATOS DE LA PÓLIZA</h6>
                <div className="row g-1">
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Compañía:</small>
                    <div><strong className="text-primary" style={{ fontSize: '0.7rem' }}>{datos.compania}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Número de Póliza:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.numero_poliza || '-'}</strong></div>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Endoso:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.endoso || '-'}</strong></div>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Inciso:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.inciso || '-'}</strong></div>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Plan:</small>
                    <div><strong className="text-uppercase" style={{ fontSize: '0.7rem' }}>{datos.plan || '-'}</strong></div>
                  </div>
                </div>
                <div className="row g-1 mt-1">
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Producto:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.producto}</strong></div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Tipo de Pago:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{tipoPagoMostrar || datos.tipo_pago}</strong></div>
                    {datos?.tipo_pago && datos?.tipo_pago.toUpperCase() === 'FRACCIONADO' && tipoPagoMostrar && tipoPagoMostrar.toUpperCase() !== 'ANUAL' && (
                      <small className="text-muted" style={{ fontSize: '0.55rem' }}>Fraccionado ({tipoPagoMostrar})</small>
                    )}
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Agente:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.agente || '-'}</strong></div>
                  </div>
                </div>
              </div>
              {/* VIGENCIA */}
              <div className="p-1 bg-success bg-opacity-10 rounded mb-1">
                <h6 className="text-success mb-1" style={{ fontSize: '0.7rem', fontWeight: '600' }}>📅 VIGENCIA DE LA PÓLIZA</h6>
                <div className="row g-1">
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Desde las 12:00 P.M. del:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.inicio_vigencia ? utils.formatearFecha?.(datos.inicio_vigencia, 'cortaY')?.toUpperCase() : '-'}</strong></div>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Hasta las 12:00 P.M. del:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.termino_vigencia ? utils.formatearFecha?.(datos.termino_vigencia, 'cortaY')?.toUpperCase() : '-'}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-warning" style={{ fontSize: '0.6rem' }}>🔔 Aviso de Renovación:</small>
                    <div><strong className="text-warning" style={{ fontSize: '0.7rem' }}>{datos.fecha_aviso_renovacion ? utils.formatearFecha?.(datos.fecha_aviso_renovacion, 'cortaY')?.toUpperCase() : '-'}</strong></div>
                  </div>
                  <div className="col-md-2">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Fecha de Emisión:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.fecha_emision ? utils.formatearFecha?.(datos.fecha_emision, 'cortaY')?.toUpperCase() : '-'}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Fecha de Captura:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{datos.fecha_captura ? utils.formatearFecha?.(datos.fecha_captura, 'cortaY')?.toUpperCase() : '-'}</strong></div>
                  </div>
                </div>
              </div>
              
              {/* INFORMACIÓN FINANCIERA */}
              <div className="p-1 bg-secondary bg-opacity-10 rounded mb-1">
                <h6 className="text-secondary mb-1" style={{ fontSize: '0.7rem', fontWeight: '600' }}>💰 INFORMACIÓN FINANCIERA</h6>
                <div className="row g-1">
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>1. Prima Neta:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.prima_neta || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>2. Otros Descuentos:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.otros_servicios || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>3. Financiamiento por pago fraccionado:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.cargo_pago_fraccionado || '0.00')}</strong></div>
                  </div>
                </div>
                <div className="row g-1 mt-1">
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>4. Gastos de expedición:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.gastos_expedicion || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>5. I.V.A.:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.iva || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>6. Total a pagar:</small>
                    <div><strong className="text-success" style={{ fontSize: '0.85rem' }}>{utils.formatearMoneda(datos.total || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Forma de Pago:</small>
                    <div><strong className="text-uppercase" style={{ fontSize: '0.7rem' }}>{datos.tipo_pago || 'No especificado'}</strong></div>
                  </div>
                </div>
                <div className="row g-1 mt-1">
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Cesión de Comisión:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.cesion_comision || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>1er. Pago:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.primer_pago || '0.00')}</strong></div>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted" style={{ fontSize: '0.6rem' }}>Subsecuentes:</small>
                    <div><strong style={{ fontSize: '0.7rem' }}>{utils.formatearMoneda(datos.pagos_subsecuentes || '0.00')}</strong></div>
                  </div>
                </div>
                {(datos.fecha_limite_pago || datos.fecha_pago) && (
                  <div className="row g-1 mt-1">
                    {datos.fecha_limite_pago && (
                      <div className="col-md-6">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>📅 Fecha Límite de Pago:</small>
                        <div><strong className="text-danger" style={{ fontSize: '0.8rem' }}>{utils.formatearFecha(datos.fecha_limite_pago)}</strong></div>
                      </div>
                    )}
                    {datos.pago_unico && (
                      <div className="col-md-6">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>Pago Único:</small>
                        <div><strong style={{ fontSize: '0.8rem' }}>{utils.formatearMoneda(datos.pago_unico)}</strong></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* VEHÍCULO Y COBERTURAS - Acordeón combinado si es Autos; si no, mostrar solo Coberturas */}
      <div className="accordion mb-3" id="accordionVehiculoCoberturas">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingVehiculoCoberturas">
            <button 
              className={`accordion-button ${openVehiculoCoberturas ? '' : 'collapsed'}`}
              type="button"
              aria-expanded={openVehiculoCoberturas}
              aria-controls="collapseVehiculoCoberturas"
              onClick={() => setOpenVehiculoCoberturas(v => !v)}
            >
              {(() => {
                switch (tipoRiesgo) {
                  case 'vehiculo':
                    return 'Vehículo Asegurado y Coberturas';
                  case 'embarcacion':
                    return 'Embarcación Asegurada y Coberturas';
                  case 'persona':
                    return 'Coberturas Contratadas';
                  case 'bien':
                    return 'Bien Asegurado y Coberturas';
                  default:
                    return esAutos ? 'Vehículo Asegurado y Coberturas' : 'Bien Asegurado y Coberturas';
                }
              })()}
            </button>
          </h2>
          <div 
            id="collapseVehiculoCoberturas" 
            className={`accordion-collapse collapse ${openVehiculoCoberturas ? 'show' : ''}`}
            aria-labelledby="headingVehiculoCoberturas"
          >
            <div className="accordion-body">
              {esAutos && (
                <div className="seccion-bloque seccion-vehiculo mb-3">
                  <h6 className="text-info mb-2" style={{ fontSize: '0.85rem', fontWeight: 600 }}>🚗 Vehículo Asegurado</h6>
                  <div className="row g-2">
                    {renderCampo('Marca', datos?.marca)}
                    {renderCampo('Modelo', datos?.modelo)}
                    {renderCampo('Año', datos?.anio)}
                    {renderCampo('Serie (VIN)', datos?.numero_serie, { strong: false, className: 'col-md-6' })}
                    {renderCampo('Número de Motor', datos?.numero_motor, { strong: false, className: 'col-md-6' })}
                    {renderCampo('Capacidad', datos?.capacidad)}
                    {renderCampo('Motor', datos?.motor)}
                    {renderCampo('Placas', datos?.placas)}
                    {renderCampo('Color', datos?.color)}
                    {renderCampo('Tipo', datos?.tipo_vehiculo)}
                    {usoMostrar && renderCampo('Uso', usoMostrar)}
                    {servicioMostrar && renderCampo('Servicio', servicioMostrar)}
                    {datos?.tipo_carga && renderCampo('Tipo de Carga', datos?.tipo_carga)}
                  </div>
                </div>
              )}
              <div className="seccion-bloque seccion-coberturas">
                <h6 className="text-primary mb-2" style={{ fontSize: '0.85rem', fontWeight: 600 }}>🛡️ Coberturas Contratadas</h6>
                {coberturas && coberturas.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.75rem' }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ padding: '0.25rem 0.5rem' }}>Cobertura</th>
                          <th className="text-end" style={{ padding: '0.25rem 0.5rem' }}>Suma Asegurada</th>
                          <th className="text-center" style={{ padding: '0.25rem 0.5rem' }}>Deducible</th>
                          <th className="text-end" style={{ padding: '0.25rem 0.5rem' }}>Prima</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coberturas.map((cob, idx) => (
                          <tr key={idx}>
                            <td className="fw-medium" style={{ padding: '0.25rem 0.5rem' }}>{cob.nombre}</td>
                            <td className="text-end" style={{ padding: '0.25rem 0.5rem' }}>
                              {(() => {
                                const sa = cob.suma_asegurada?.toString?.() || '';
                                const esNumero = /^\d+(?:\.\d+)?$/.test(sa);
                                if (!sa) return <span className="text-muted">—</span>;
                                if (sa.toUpperCase() === 'AMPARADA') return <span className="badge bg-success">AMPARADA</span>;
                                if (/VALOR\s+COMERCIAL|VALOR\s+FACTURA/i.test(sa)) return <span className="badge bg-info text-dark">{sa.toUpperCase()}</span>;
                                if (esNumero) return `$${parseFloat(sa).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                return <span className="badge bg-secondary">{sa}</span>;
                              })()}
                              {cob.tipo === 'por_evento' && <small className="d-block text-muted">POR EVENTO</small>}
                            </td>
                            <td className="text-center">
                              <span className="badge bg-secondary">{cob.deducible}</span>
                            </td>
                            <td className="text-end">
                              ${parseFloat(cob.prima).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-muted">No hay coberturas registradas.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORIAL COMPLETO DEL EXPEDIENTE - Acordeón independiente */}
      <div className="accordion mb-3" id="accordionHistorialComunicacion">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingHistorialComunicacion">
            <button 
              className={`accordion-button ${openHistorial ? '' : 'collapsed'}`}
              type="button"
              aria-expanded={openHistorial}
              aria-controls="collapseHistorialComunicacion"
              onClick={() => {
                setOpenHistorial(v => !v);
                // Si se está abriendo la pestaña, recargar el historial
                if (!openHistorial && onHistorialClick) {
                  onHistorialClick();
                }
              }}
            >
              📋 Historial y Trazabilidad del Expediente
            </button>
          </h2>
          <div 
            id="collapseHistorialComunicacion" 
            className={`accordion-collapse collapse ${openHistorial ? 'show' : ''}`}
            aria-labelledby="headingHistorialComunicacion"
          >
            <div className="accordion-body p-2">
              {historialSlot ? (
                historialSlot
              ) : mensajes && mensajes.length > 0 ? (
                <ul className="list-group">
                  {mensajes.map((msg, idx) => (
                    <li key={idx} className="list-group-item">
                      <strong>{msg.fecha}:</strong> {msg.texto}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted text-center py-3">
                  <small>No hay eventos registrados.</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalleExpediente;

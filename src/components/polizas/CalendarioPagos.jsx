import React from 'react';
import { FileText, Mail, X } from 'lucide-react';
import * as estatusPagosUtils from '../../utils/estatusPagos';

// Constantes
const CONSTANTS = {
  PAGOS_POR_FRECUENCIA: {
    'Mensual': 12,
    'Trimestral': 4,
    'Semestral': 2
  }
};

// Utilidades
const utils = {
  calcularDiasRestantes: (fecha) => {
    if (!fecha) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);
    return Math.floor((fechaObj - hoy) / (1000 * 60 * 60 * 24));
  },
  
  formatearFecha: (fecha, formato = 'corta') => {
    if (!fecha) return '-';
    let fechaObj;
    if (typeof fecha === 'string' && fecha.includes('-')) {
      const [year, month, day] = fecha.split('-');
      fechaObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      fechaObj = new Date(fecha);
    }
    const opciones = {
      corta: { day: '2-digit', month: 'short' },
      larga: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    };
    return fechaObj.toLocaleDateString('es-MX', opciones[formato]);
  },
  
  formatearMoneda: (cantidad) => {
    if (cantidad === null || cantidad === undefined || cantidad === '') return '$0.00';
    const numero = parseFloat(cantidad);
    if (isNaN(numero)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(numero);
  }
};

const CalendarioPagos = React.memo(({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false,
  onEnviarAviso,
  historial = [],
  setFormulario,
  cancelarPago
}) => {
  const tipoPago = expediente.tipo_pago || expediente.forma_pago;
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  
  if (!expediente.inicio_vigencia) {
    return null;
  }
  
  const esAnual = tipoPago?.toUpperCase() === 'ANUAL' || tipoPago?.toUpperCase() === 'CONTADO';
  const esFraccionado = tipoPago?.toUpperCase() === 'FRACCIONADO';
  
  if (!esAnual && !esFraccionado) {
    return null;
  }
  
  if (esFraccionado && !frecuencia) {
    return null;
  }

  const numeroPagos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
  let pagos = [];
  
  // Leer recibos desde backend
  if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
    pagos = expediente.recibos
      .filter(r => r.numero_recibo <= numeroPagos)
      .map(r => {
        const estatusCalculado = estatusPagosUtils.calcularEstatusRecibo(r.fecha_vencimiento, r.fecha_pago_real);
        
        return {
          numero: r.numero_recibo,
          fecha: r.fecha_vencimiento,
          monto: parseFloat(r.monto).toFixed(2),
          estatusBackend: estatusCalculado,
          comprobante_url: r.comprobante_url,
          comprobante_nombre: r.comprobante_nombre,
          fecha_pago_real: r.fecha_pago_real
        };
      });
  } else {
    // Fallback: Calcular en frontend (para pólizas nuevas)
    const periodoGracia = expediente.periodo_gracia 
      ? parseInt(expediente.periodo_gracia, 10)
      : (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
    
    const primerPagoField = expediente.primer_pago || expediente.primerPago;
    const pagosSubsecuentesField = expediente.pagos_subsecuentes || expediente.pagosSubsecuentes;
    
    const usarMontosExactos = primerPagoField && pagosSubsecuentesField;
    const primerPagoMonto = usarMontosExactos ? parseFloat(primerPagoField) : null;
    const pagosSubsecuentesMonto = usarMontosExactos ? parseFloat(pagosSubsecuentesField) : null;
    const montoPorDefecto = expediente.total ? (parseFloat(expediente.total) / numeroPagos).toFixed(2) : '---';
    
    for (let i = 1; i <= numeroPagos; i++) {
      const fechaPago = calcularProximoPago(
        expediente.inicio_vigencia,
        tipoPago,
        frecuencia,
        expediente.compania,
        i,
        periodoGracia
      );
      
      if (fechaPago) {
        let monto = montoPorDefecto;
        if (usarMontosExactos) {
          monto = (i === 1 ? primerPagoMonto : pagosSubsecuentesMonto).toFixed(2);
        }
        
        pagos.push({
          numero: i,
          fecha: fechaPago,
          monto: monto
        });
      }
    }
  }

  const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
  let totalPagado = 0;
  let totalPendiente = 0;
  let totalPorVencer = 0;
  let totalVencido = 0;
  let pagosRealizados = ultimoReciboPagado;

  // 🔄 ACTUALIZAR fecha_vencimiento_pago en el formulario cuando cambian las fechas
  React.useEffect(() => {
    if (!setFormulario || pagos.length === 0) return;
    
    // Encontrar el próximo pago pendiente (primer recibo no pagado)
    const proximoPagoPendiente = pagos.find(p => {
      const numeroPago = p.numero;
      return numeroPago > ultimoReciboPagado;
    });
    
    if (proximoPagoPendiente && proximoPagoPendiente.fecha) {
      // Actualizar campo fecha_vencimiento_pago solo si cambió
      setFormulario(prev => {
        if (prev.fecha_vencimiento_pago !== proximoPagoPendiente.fecha) {
          console.log('📅 Actualizando fecha_vencimiento_pago:', proximoPagoPendiente.fecha);
          return {
            ...prev,
            fecha_vencimiento_pago: proximoPagoPendiente.fecha
          };
        }
        return prev;
      });
    }
  }, [expediente.inicio_vigencia, expediente.termino_vigencia, expediente.periodo_gracia, ultimoReciboPagado, pagos.length, setFormulario]);

  const pagosProcesados = pagos.map((pago) => {
    if (pago.estatusBackend) {
      const estatusNorm = pago.estatusBackend.toLowerCase();
      const pagado = estatusNorm === 'pagado';
      
      if (pagado) {
        totalPagado += parseFloat(pago.monto) || 0;
      } else if (estatusNorm === 'vencido') {
        totalVencido += parseFloat(pago.monto) || 0;
      } else if (estatusNorm === 'pago por vencer') {
        totalPorVencer += parseFloat(pago.monto) || 0;
      } else {
        totalPendiente += parseFloat(pago.monto) || 0;
      }
      
      let estado = pago.estatusBackend;
      let badgeClass = 'bg-secondary';
      
      if (estatusNorm === 'pagado') {
        badgeClass = 'bg-success';
      } else if (estatusNorm === 'vencido') {
        badgeClass = 'bg-danger';
      } else if (estatusNorm === 'pago por vencer' || estatusNorm === 'por vencer') {
        badgeClass = 'bg-warning';
      }
      
      return { ...pago, estado, badgeClass, pagado, totalPagos: numeroPagos };
    }
    
    // Fallback: calcular en frontend
    const [year, month, day] = pago.fecha.split('-');
    const fechaPago = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const diasRestantes = utils.calcularDiasRestantes(pago.fecha);
    
    let pagado = pago.numero <= ultimoReciboPagado;
    
    if (pagado) {
      totalPagado += parseFloat(pago.monto) || 0;
    } else {
      if (diasRestantes < 0) {
        totalVencido += parseFloat(pago.monto) || 0;
      } else if (diasRestantes <= 15) {
        totalPorVencer += parseFloat(pago.monto) || 0;
      } else {
        totalPendiente += parseFloat(pago.monto) || 0;
      }
    }
    
    let estado = 'Pendiente';
    let badgeClass = 'bg-secondary';
    
    if (pagado) {
      estado = 'Pagado';
      badgeClass = 'bg-success';
    } else if (diasRestantes < 0) {
      estado = 'Vencido';
      badgeClass = 'bg-danger';
    } else if (diasRestantes === 0) {
      estado = 'Vence hoy';
      badgeClass = 'bg-danger';
    } else if (diasRestantes <= 15) {
      estado = diasRestantes <= 7 ? `Vence en ${diasRestantes} días` : 'Por Vencer';
      badgeClass = 'bg-warning';
    } else {
      estado = 'Pendiente';
      badgeClass = 'bg-secondary';
    }
    
    return { ...pago, estado, badgeClass, pagado, totalPagos: numeroPagos };
  });

  if (compacto) {
    return (
      <div className="mt-1">
        <small className="text-info">
          📊 {pagosRealizados}/{numeroPagos} pagos
        </small>
      </div>
    );
  }

  return (
    <div className="card border-primary">
      <div className="card-header bg-primary text-white">
        <h6 className="mb-0">
          📅 Calendario de Pagos - {esAnual ? 'Anual' : frecuencia}
          <small className="ms-2">({numeroPagos} {numeroPagos === 1 ? 'pago' : 'pagos'} en el año)</small>
        </h6>
      </div>
      <div className="card-body p-3">
        {mostrarResumen && (
          <div className="row mb-3 g-2">
            <div className="col">
              <div className="card bg-light h-100">
                <div className="card-body text-center p-2">
                  <small className="text-muted d-block mb-1">Total Anual</small>
                  <h5 className="mb-0 text-primary">{utils.formatearMoneda(expediente.total)}</h5>
                </div>
              </div>
            </div>
            
            <div className="col">
              <div className="card bg-success text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">✅ Pagado</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPagado)}</h5>
                  <small className="d-block mt-1">{pagosRealizados} de {numeroPagos}</small>
                </div>
              </div>
            </div>
            
            <div className="col">
              <div className="card bg-warning text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">⚠️ Por Vencer</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPorVencer)}</h5>
                  <small className="d-block mt-1">≤ 15 días</small>
                </div>
              </div>
            </div>
            
            <div className="col">
              <div className="card bg-danger text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">❌ Vencido</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalVencido)}</h5>
                  <small className="d-block mt-1">Atrasado</small>
                </div>
              </div>
            </div>
            
            <div className="col">
              <div className="card bg-secondary text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">📅 Pendiente</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPendiente)}</h5>
                  <small className="d-block mt-1">Sin riesgo</small>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th width="80">Pago #</th>
                <th>Fecha de Pago</th>
                <th>Monto</th>
                <th width="150">Estado</th>
                <th width="200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagosProcesados.map((pago) => (
                <tr key={pago.numero} className={pago.pagado ? 'table-success' : ''}>
                  <td><strong>#{pago.numero}</strong></td>
                  <td>{utils.formatearFecha(pago.fecha, 'larga')}</td>
                  <td><strong>${pago.monto}</strong></td>
                  <td>
                    <span className={`badge ${pago.badgeClass}`}>
                      {pago.pagado && '✓ '}
                      {pago.estado}
                    </span>
                  </td>
                  <td>
                    {pago.pagado ? (
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            const normalizarFecha = (fecha) => {
                              if (!fecha) return null;
                              const d = new Date(fecha);
                              return d.toISOString().split('T')[0];
                            };
                            
                            const fechaBuscada = normalizarFecha(pago.fecha);
                            
                            const eventoPago = historial.find(evento => {
                              const fechaEvento = normalizarFecha(evento.datos_adicionales?.fecha_pago);
                              return evento.tipo_evento === 'pago_registrado' &&
                                fechaEvento === fechaBuscada &&
                                evento.datos_adicionales?.comprobante_url;
                            });
                            
                            if (eventoPago?.datos_adicionales?.comprobante_url) {
                              window.open(eventoPago.datos_adicionales.comprobante_url, '_blank');
                            } else {
                              alert('No se encontró el comprobante de pago para esta fecha');
                            }
                          }}
                          title="Ver comprobante de pago"
                        >
                          <FileText size={14} className="me-1" />
                          Ver
                        </button>
                        {cancelarPago && (
                          <button 
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => cancelarPago(expediente.id, pago.numero)}
                            title="Cancelar este pago"
                          >
                            <X size={14} className="me-1" />
                            Cancelar
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        className={`btn btn-sm ${pago.estado === 'Vencido' ? 'btn-danger' : 'btn-outline-info'}`}
                        onClick={() => onEnviarAviso && onEnviarAviso(pago, expediente)}
                        title={pago.estado === 'Vencido' ? 'Enviar recordatorio de pago vencido' : 'Enviar aviso de pago'}
                      >
                        <Mail size={14} className="me-1" />
                        {pago.estado === 'Vencido' ? 'Recordatorio' : 'Enviar Aviso'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {expediente.total && (
              <tfoot>
                <tr className="table-info">
                  <td colSpan="3" className="text-end"><strong>Total Anual:</strong></td>
                  <td colSpan="2"><strong>{utils.formatearMoneda(expediente.total)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});

CalendarioPagos.displayName = 'CalendarioPagos';

export default CalendarioPagos;

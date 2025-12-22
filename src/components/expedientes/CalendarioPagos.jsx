/**
 * ====================================================================
 * COMPONENTE: CALENDARIO DE PAGOS
 * ====================================================================
 * Tabla de pagos con resumen, cálculo de estados y botones de aviso
 */

import React from 'react';
import { FileText, Mail, Trash2 } from 'lucide-react';
import { CONSTANTS } from '../../utils/expedientesConstants';
import utils from '../../utils/expedientesUtils';
import * as estatusPagosUtils from '../../utils/estatusPagos';
import { Badge } from './UIComponents';

const CalendarioPagos = React.memo(({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false,
  onEnviarAviso, // Callback para enviar avisos de pago
  onEliminarPago, // Callback para eliminar un pago (solo en modo edición)
  historial = [] // Historial de eventos para encontrar comprobantes
}) => {
  // Debug: verificar datos recibidos
  console.log('🔄 CalendarioPagos - Renderizando con:', {
    cantidad_recibos: expediente.recibos?.length || 0,
    recibos: expediente.recibos
  });
  
  // Normalizar campos (aceptar múltiples nombres)
  const tipoPago = expediente.tipo_pago || expediente.forma_pago;
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  
  // Validar que tenga los datos mínimos necesarios
  if (!expediente.inicio_vigencia) {
    return null;
  }
  
  // Determinar si es Anual o Fraccionado
  const esAnual = tipoPago?.toUpperCase() === 'ANUAL' || tipoPago?.toUpperCase() === 'CONTADO';
  const esFraccionado = tipoPago?.toUpperCase() === 'FRACCIONADO';
  
  // Si no es ninguno de los dos, no mostrar
  if (!esAnual && !esFraccionado) {
    return null;
  }
  
  // Para fraccionado, validar que tenga frecuencia
  if (esFraccionado && !frecuencia) {
    return null;
  }

  // Determinar número de pagos: 1 para Anual, según frecuencia para Fraccionado
  const numeroPagos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
  let pagos = [];
  
  // 🔥 PRIORIDAD: Si el backend envía los recibos, usarlos directamente
  if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
    pagos = expediente.recibos
      .filter(r => r.numero_recibo <= numeroPagos)
      .map(r => {
        // IMPORTANTE: Normalizar estatus del backend
        // Backend usa: "Pago por vencer" | Frontend usa: "Por Vencer"
        const estatusNormalizado = estatusPagosUtils.normalizarEstatusBackend(r.estatus);
        
        return {
          numero: r.numero_recibo,
          fecha: r.fecha_vencimiento,
          monto: parseFloat(r.monto).toFixed(2),
          estatusBackend: estatusNormalizado,
          comprobante_url: r.comprobante_url,
          comprobante_nombre: r.comprobante_nombre,
          fecha_pago_real: r.fecha_pago_real
        };
      });
  } else {
    // Fallback: Calcular recibos en el frontend (método antiguo)
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

  // 🔥 Usar ultimo_recibo_pagado en lugar de fecha_ultimo_pago
  const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
  let totalPagado = 0;
  let totalPendiente = 0;
  let totalPorVencer = 0;
  let totalVencido = 0;
  let pagosRealizados = ultimoReciboPagado;

  const pagosProcesados = pagos.map((pago) => {
    // 🔥 Si el recibo viene del backend con estatus, usarlo directamente
    if (pago.estatusBackend) {
      // console.log(`🔍 [RECIBO ${pago.numero}] Usando estatus del BACKEND: "${pago.estatusBackend}" | Fecha: ${pago.fecha}`);
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
      } else if (estatusNorm === 'pago por vencer') {
        badgeClass = 'bg-warning';
      }
      
      // console.log(`✅ [RECIBO ${pago.numero}] Estado final: "${estado}" | Badge: ${badgeClass}`);
      return { ...pago, estado, badgeClass, pagado, totalPagos: numeroPagos };
    }
    
    // Fallback: Calcular estatus en el frontend (método antiguo)
    // console.log(`🔍 [RECIBO ${pago.numero}] SIN estatus backend, calculando en FRONTEND | Fecha: ${pago.fecha} | ultimo_recibo_pagado: ${ultimoReciboPagado}`);
    const [year, month, day] = pago.fecha.split('-');
    const fechaPago = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const diasRestantes = utils.calcularDiasRestantes(pago.fecha);
    // console.log(`🔍 [RECIBO ${pago.numero}] Días restantes calculados: ${diasRestantes}`);
    
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
      // Por Pagar: cuando faltan 15 días o menos (listo para cobrar)
      estado = diasRestantes <= 7 ? `Vence en ${diasRestantes} días` : 'Por Pagar';
      badgeClass = 'bg-warning';
    } else {
      // Pendiente: cuando falta más de 15 días (aún no urgente)
      estado = 'Pendiente';
      badgeClass = 'bg-secondary';
    }
    
    // console.log(`✅ [RECIBO ${pago.numero}] Estado calculado en frontend: "${estado}" | Badge: ${badgeClass}`);
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
            {/* Total Anual */}
            <div className="col">
              <div className="card bg-light h-100">
                <div className="card-body text-center p-2">
                  <small className="text-muted d-block mb-1">Total Anual</small>
                  <h5 className="mb-0 text-primary">{utils.formatearMoneda(expediente.total)}</h5>
                </div>
              </div>
            </div>
            
            {/* Pagado */}
            <div className="col">
              <div className="card bg-success text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">✅ Pagado</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPagado)}</h5>
                  <small className="d-block mt-1">{pagosRealizados} de {numeroPagos}</small>
                </div>
              </div>
            </div>
            
            {/* Por Vencer */}
            <div className="col">
              <div className="card bg-warning text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">⚠️ Por Vencer</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalPorVencer)}</h5>
                  <small className="d-block mt-1">≤ 15 días</small>
                </div>
              </div>
            </div>
            
            {/* Vencido */}
            <div className="col">
              <div className="card bg-danger text-white h-100">
                <div className="card-body text-center p-2">
                  <small className="d-block mb-1">❌ Vencido</small>
                  <h5 className="mb-0">{utils.formatearMoneda(totalVencido)}</h5>
                  <small className="d-block mt-1">Atrasado</small>
                </div>
              </div>
            </div>
            
            {/* Pendiente */}
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
                      <>
                        {/* Botón para ver comprobante de pago */}
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => {
                          // Normalizar fechas para comparación (solo YYYY-MM-DD)
                          const normalizarFecha = (fecha) => {
                            if (!fecha) return null;
                            const d = new Date(fecha);
                            return d.toISOString().split('T')[0]; // Solo YYYY-MM-DD
                          };
                          
                          const fechaBuscada = normalizarFecha(pago.fecha);
                          console.log('🔍 Buscando comprobante para fecha:', fechaBuscada);
                          console.log('📋 Historial disponible:', historial?.length || 0, 'eventos');
                          
                          // Buscar en el historial el evento de pago correspondiente
                          const eventoPago = historial.find(evento => {
                            const fechaEvento = normalizarFecha(evento.datos_adicionales?.fecha_pago);
                            const coincide = evento.tipo_evento === 'pago_registrado' &&
                              fechaEvento === fechaBuscada &&
                              evento.datos_adicionales?.comprobante_url;
                            
                            if (coincide) {
                              console.log('✅ Comprobante encontrado:', evento.datos_adicionales.comprobante_url);
                            }
                            return coincide;
                          });
                          
                          if (eventoPago?.datos_adicionales?.comprobante_url) {
                            // Abrir comprobante en nueva pestaña
                            window.open(eventoPago.datos_adicionales.comprobante_url, '_blank');
                          } else {
                            console.warn('❌ No se encontró comprobante. Eventos de pago:', 
                              historial.filter(e => e.tipo_evento === 'pago_registrado').map(e => ({
                                fecha: e.datos_adicionales?.fecha_pago,
                                tiene_url: !!e.datos_adicionales?.comprobante_url
                              }))
                            );
                            alert('No se encontró el comprobante de pago para esta fecha');
                          }
                        }}
                        title="Ver comprobante de pago"
                      >
                        <FileText size={14} className="me-1" />
                        Ver Comprobante
                        </button>
                      
                        {/* Botón para eliminar pago (solo en modo edición) */}
                        {onEliminarPago && (
                          <button 
                            className="btn btn-sm btn-outline-danger ms-1"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar el pago del recibo #${pago.numero}? El estatus se recalculará automáticamente.`)) {
                                onEliminarPago(pago, expediente);
                              }
                            }}
                            title="Eliminar este pago y recalcular estatus"
                          >
                            <Trash2 size={14} className="me-1" />
                            Eliminar pago
                          </button>
                        )}
                      </>
                    ) : (
                      // Botón para enviar aviso/recordatorio
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

export default CalendarioPagos;

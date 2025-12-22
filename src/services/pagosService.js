/**
 * ====================================================================
 * SERVICIO: Gestión de Pagos de Pólizas
 * ====================================================================
 * Maneja la lógica de aplicar pagos de expedientes
 * - Aplicar pagos (registrar comprobantes)
 * - Registro automático en trazabilidad
 * - Actualización de estatus de pago
 */

import { API_URL } from '../constants/apiUrl';
import * as historialService from './historialExpedienteService';
import { CONSTANTS } from '../utils/expedientesConstants';

/**
 * Aplicar un pago a un expediente
 * @param {Object} expediente - Expediente al que se aplicará el pago
 * @param {Object} datosPago - Datos del pago (fecha, comprobante, número de recibo)
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function aplicarPago(expediente, datosPago) {
  const {
    fechaUltimoPago,
    comprobantePago,
    numeroReciboPago,
    comprobanteUrl
  } = datosPago;

  try {
    console.log('💰 Aplicando pago:', { 
      expediente: expediente.id, 
      fecha: fechaUltimoPago, 
      recibo: numeroReciboPago 
    });

    // 1. Determinar tipo de pago
    const esFraccionado = expediente.tipo_pago?.toUpperCase() === 'FRACCIONADO';
    const esAnual = expediente.tipo_pago?.toUpperCase() === 'ANUAL' || 
                    expediente.tipo_pago?.toUpperCase() === 'CONTADO';

    // 2. Calcular número de pago actual
    let numeroPago = numeroReciboPago;
    if (!numeroPago) {
      const ultimoReciboPagadoActual = expediente.ultimo_recibo_pagado || 0;
      numeroPago = ultimoReciboPagadoActual + 1;
    }

    // 3. Determinar próximo pago y nuevo estatus
    let proximoPago = null;
    let nuevoEstatusPago = 'Pendiente';
    let nuevaFechaVencimiento = expediente.fecha_vencimiento_pago;
    let etapaFinal = expediente.etapa_activa;
    let estatusReciboActual = 'Pagado';

    // Calcular total de recibos
    let totalRecibos = 1;
    if (esFraccionado) {
      const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
      totalRecibos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 1;
    }

    const esUltimoPago = numeroPago >= totalRecibos;

    if (esUltimoPago) {
      // Último pago: marcar como completamente pagado
      nuevoEstatusPago = 'Pagado';
      proximoPago = null;
      nuevaFechaVencimiento = null;
      etapaFinal = 'En Vigencia';
      estatusReciboActual = 'Pagado (Póliza Completa)';
    } else {
      // Hay más pagos pendientes
      nuevoEstatusPago = 'Pago por vencer';
      
      // Calcular fecha del próximo vencimiento
      try {
        const responseProximoPago = await fetch(
          `${API_URL}/api/expedientes/${expediente.id}/proximo-pago`
        );
        
        if (responseProximoPago.ok) {
          const dataProximoPago = await responseProximoPago.json();
          proximoPago = dataProximoPago.fecha_vencimiento || null;
          nuevaFechaVencimiento = proximoPago;
        }
      } catch (error) {
        console.error('❌ Error al calcular próximo pago:', error);
      }
    }

    // 4. Preparar datos de actualización
    const datosActualizacion = {
      ultimo_recibo_pagado: numeroPago,
      fecha_ultimo_pago: fechaUltimoPago,
      fecha_captura_ultimo_pago: new Date().toISOString(),
      estatus_pago: nuevoEstatusPago,
      fecha_vencimiento_pago: nuevaFechaVencimiento,
      etapa_activa: etapaFinal
    };

    // 5. Actualizar expediente en BD
    const response = await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosActualizacion)
    });

    if (!response.ok) {
      throw new Error(`Error al actualizar expediente: ${response.status}`);
    }

    // 6. Obtener monto del recibo desde el backend
    let montoRecibo = 0;
    try {
      const responseRecibo = await fetch(
        `${API_URL}/api/expedientes/${expediente.id}/recibos/${numeroReciboPago}`
      );
      
      if (responseRecibo.ok) {
        const reciboData = await responseRecibo.json();
        if (reciboData.monto && !isNaN(parseFloat(reciboData.monto))) {
          montoRecibo = parseFloat(reciboData.monto);
        }
      }
    } catch (error) {
      console.error('❌ Error al obtener monto del recibo:', error);
    }

    // Fallback: calcular monto proporcional si no se obtuvo del backend
    if (!montoRecibo && esFraccionado) {
      const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
      const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 1;
      montoRecibo = parseFloat(expediente.total || 0) / numeroPagos;
    } else if (!montoRecibo) {
      montoRecibo = parseFloat(expediente.total || 0);
    }

    // 7. Registrar evento en trazabilidad
    const fechaPagoFormateada = new Date(fechaUltimoPago).toLocaleDateString('es-MX', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
    const fechaCapturaFormateada = new Date().toLocaleDateString('es-MX', { 
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    let comentario;
    if (!esUltimoPago) {
      let siguienteVencimientoTexto = '';
      if (proximoPago) {
        siguienteVencimientoTexto = `\n📅 Siguiente vencimiento: ${new Date(proximoPago).toLocaleDateString('es-MX', { 
          day: 'numeric', month: 'long', year: 'numeric' 
        })}`;
      }
      
      comentario = `💰 Pago Registrado\n` +
                  `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                  `📝 Fecha de captura: ${fechaCapturaFormateada}\n` +
                  `📄 Recibo/Pago: ${numeroPago}\n` +
                  `🧾 Comprobante: ${comprobantePago?.name || 'N/A'}\n` +
                  `💵 Monto: $${parseFloat(montoRecibo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}${siguienteVencimientoTexto}\n` +
                  `📊 Estado: ${etapaFinal} | ${estatusReciboActual}`;
    } else {
      comentario = `💰 Pago Registrado (Final)\n` +
                  `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                  `📝 Fecha de captura: ${fechaCapturaFormateada}\n` +
                  `📄 Recibo/Pago: ${numeroPago}\n` +
                  `🧾 Comprobante: ${comprobantePago?.name || 'N/A'}\n` +
                  `💵 Monto: $${parseFloat(montoRecibo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                  `✅ Póliza completamente pagada → ${etapaFinal} | ${estatusReciboActual}\n` +
                  `📂 Movida a carpeta: Vigentes Pagadas`;
    }

    await historialService.registrarEvento({
      expediente_id: expediente.id,
      cliente_id: expediente.cliente_id,
      tipo_evento: historialService.TIPOS_EVENTO.PAGO_REGISTRADO,
      usuario_nombre: 'Sistema',
      descripcion: comentario,
      datos_adicionales: {
        numero_poliza: expediente.numero_poliza,
        compania: expediente.compania,
        producto: expediente.producto,
        monto_total: expediente.total || null,
        monto_pagado: montoRecibo,
        fecha_pago: fechaUltimoPago,
        numero_pago: numeroPago,
        numero_recibo: numeroReciboPago,
        comprobante_nombre: comprobantePago?.name || null,
        comprobante_url: comprobanteUrl || null,
        siguiente_vencimiento: proximoPago || null,
        estatus_pago_nuevo: nuevoEstatusPago,
        etapa_activa: etapaFinal,
        tipo_pago: expediente.tipo_pago,
        frecuencia_pago: expediente.frecuenciaPago || expediente.frecuencia_pago
      }
    });

    console.log('✅ Pago aplicado correctamente');
    
    return {
      success: true,
      nuevoEstatusPago,
      proximoPago,
      esUltimoPago,
      etapaFinal
    };

  } catch (error) {
    console.error('❌ Error al aplicar pago:', error);
    throw error;
  }
}



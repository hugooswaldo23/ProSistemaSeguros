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
    let etapaFinal = 'En Vigencia'; // Siempre "En Vigencia" al pagar un recibo
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
      estatusReciboActual = 'Pagado (Póliza Completa)';
    } else {
      // Hay más pagos pendientes - pero póliza está al corriente
      nuevoEstatusPago = 'Pendiente'; // El próximo recibo está pendiente
      
      // Calcular fecha del próximo vencimiento
      try {
        const responseProximoPago = await fetch(
          `${API_URL}/api/expedientes/${expediente.id}/proximo-pago`
        );
        
        if (responseProximoPago.ok) {
          const dataProximoPago = await responseProximoPago.json();
          proximoPago = dataProximoPago.fecha_vencimiento || null;
          nuevaFechaVencimiento = proximoPago;
          
          // Verificar si el próximo recibo ya está por vencer (15 días o menos)
          if (proximoPago) {
            const fechaProximoVenc = new Date(proximoPago);
            const hoy = new Date();
            fechaProximoVenc.setHours(0, 0, 0, 0);
            hoy.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((fechaProximoVenc - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes <= 15 && diasRestantes >= 0) {
              nuevoEstatusPago = 'Por vencer';
              etapaFinal = 'Por Vencer';
            } else if (diasRestantes < 0) {
              nuevoEstatusPago = 'Vencido';
              etapaFinal = 'Vencida';
            }
          }
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

    // 6. Obtener TODOS los recibos del expediente para tener montos exactos
    let recibos = [];
    try {
      const responseRecibos = await fetch(`${API_URL}/api/recibos/${expediente.id}`);
      
      if (responseRecibos.ok) {
        const recibosData = await responseRecibos.json();
        recibos = recibosData?.data || recibosData || [];
        console.log('✅ Recibos obtenidos:', recibos.length);
      }
    } catch (error) {
      console.error('❌ Error al obtener recibos:', error);
    }

    // 7. Obtener monto del recibo que se está pagando
    let montoRecibo = 0;
    const reciboActual = recibos.find(r => r.numero_recibo === numeroReciboPago);
    
    if (reciboActual && reciboActual.monto) {
      montoRecibo = parseFloat(reciboActual.monto);
      console.log(`💵 Monto del recibo ${numeroReciboPago}:`, montoRecibo);
    } else {
      // Fallback: calcular monto proporcional si no se obtuvo del backend
      if (esFraccionado) {
        const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
        const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 1;
        montoRecibo = parseFloat(expediente.total || 0) / numeroPagos;
      } else {
        montoRecibo = parseFloat(expediente.total || 0);
      }
      console.warn('⚠️ Usando monto calculado (no encontrado en recibos):', montoRecibo);
    }

    // 8. Obtener información del próximo recibo (si existe)
    let proximoReciboInfo = null;
    if (!esUltimoPago) {
      const siguienteNumeroRecibo = numeroPago + 1;
      const proximoRecibo = recibos.find(r => r.numero_recibo === siguienteNumeroRecibo);
      
      if (proximoRecibo) {
        proximoReciboInfo = {
          numero: siguienteNumeroRecibo,
          monto: parseFloat(proximoRecibo.monto || 0),
          fecha_vencimiento: proximoRecibo.fecha_vencimiento || proximoPago
        };
        console.log('📋 Próximo recibo encontrado:', proximoReciboInfo);
      } else {
        console.warn('⚠️ No se encontró el próximo recibo en la lista');
      }
    }

    // 9. Registrar evento en trazabilidad
    // Evitar conversión de zona horaria agregando hora local
    const [año, mes, dia] = fechaUltimoPago.split('-');
    const fechaPagoLocal = new Date(año, mes - 1, dia);
    const fechaPagoFormateada = fechaPagoLocal.toLocaleDateString('es-MX', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
    const fechaCapturaFormateada = new Date().toLocaleDateString('es-MX', { 
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    let comentario;
    if (!esUltimoPago) {
      let siguienteReciboTexto = '';
      if (proximoReciboInfo) {
        const fechaProximoRecibo = new Date(proximoReciboInfo.fecha_vencimiento).toLocaleDateString('es-MX', { 
          day: 'numeric', month: 'long', year: 'numeric' 
        });
        
        // Calcular estatus del próximo recibo
        const fechaVencProximo = new Date(proximoReciboInfo.fecha_vencimiento);
        const hoyCalc = new Date();
        hoyCalc.setHours(0, 0, 0, 0);
        fechaVencProximo.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((fechaVencProximo - hoyCalc) / (1000 * 60 * 60 * 24));
        
        let estatusProximo;
        if (diffDias < 0) {
          estatusProximo = 'Vencido';
        } else if (diffDias <= 5) {
          estatusProximo = 'Por vencer';
        } else {
          estatusProximo = 'Pendiente';
        }
        
        siguienteReciboTexto = `\n\n📋 Próximo Recibo a Pagar:\n` +
                              `   • Recibo: ${proximoReciboInfo.numero}/${totalRecibos} ${estatusProximo}\n` +
                              `   • Monto: $${parseFloat(proximoReciboInfo.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n` +
                              `   • Vencimiento: ${fechaProximoRecibo}`;
      } else if (proximoPago) {
        const fechaProxima = new Date(proximoPago).toLocaleDateString('es-MX', { 
          day: 'numeric', month: 'long', year: 'numeric' 
        });
        siguienteReciboTexto = `\n📅 Siguiente vencimiento: ${fechaProxima}`;
      }
      
      comentario = `💰 Pago Registrado\n` +
                  `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                  `📝 Fecha de captura: ${fechaCapturaFormateada}\n` +
                  `📄 Recibo/Pago: ${numeroPago}/${totalRecibos} Pagado\n` +
                  `🧾 Comprobante: ${comprobantePago?.name || 'N/A'}\n` +
                  `💵 Monto: $${parseFloat(montoRecibo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}${siguienteReciboTexto}\n` +
                  `📊 Estado: ${etapaFinal} | ${estatusReciboActual}`;
    } else {
      comentario = `💰 Pago Registrado (Final)\n` +
                  `📅 Fecha de pago: ${fechaPagoFormateada}\n` +
                  `📝 Fecha de captura: ${fechaCapturaFormateada}\n` +
                  `📄 Recibo/Pago: ${numeroPago}/${totalRecibos} Pagado\n` +
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
        proximo_recibo_numero: proximoReciboInfo?.numero || null,
        proximo_recibo_monto: proximoReciboInfo?.monto || null,
        proximo_recibo_fecha: proximoReciboInfo?.fecha_vencimiento || null,
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



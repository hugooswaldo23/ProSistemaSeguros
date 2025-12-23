/**
 * ====================================================================
 * HOOK: usePagos
 * ====================================================================
 * Hook personalizado para manejar la lógica de pagos de expedientes
 * - Aplicar pagos con comprobantes
 * - Remover pagos erróneos
 * - Manejo de estado del modal de pagos
 * - Integración con pagosService y subida a S3
 */

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import * as pagosService from '../services/pagosService';
import { CONSTANTS } from '../utils/expedientesConstants';

const API_URL = import.meta.env.VITE_API_URL;

export function usePagos({ expedientes, setExpedientes, cargarExpedientes, onPagoAplicado }) {
  // Estados del modal de pagos
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [expedienteParaPago, setExpedienteParaPago] = useState(null);
  const [comprobantePago, setComprobantePago] = useState(null);
  const [fechaUltimoPago, setFechaUltimoPago] = useState('');
  const [numeroReciboPago, setNumeroReciboPago] = useState(1);
  const [procesandoPago, setProcesandoPago] = useState(false);

  /**
   * Abre el modal para aplicar un pago
   */
  const abrirModalAplicarPago = useCallback((expedienteId) => {
    const expedienteActual = expedientes.find(exp => exp.id === expedienteId);
    if (!expedienteActual) return;
    
    // Calcular fecha límite del pago pendiente
    const fechaLimite = expedienteActual.fecha_vencimiento_pago || 
                        expedienteActual.proximo_pago || 
                        new Date().toISOString().split('T')[0];
    
    // Calcular el próximo recibo pendiente
    let proximoReciboPendiente = 1;
    const esFraccionado = (expedienteActual.tipo_pago === 'Fraccionado') || 
                          (expedienteActual.forma_pago?.toUpperCase() === 'FRACCIONADO');
    
    if (esFraccionado && (expedienteActual.frecuenciaPago || expedienteActual.frecuencia_pago)) {
      const frecuencia = expedienteActual.frecuenciaPago || expedienteActual.frecuencia_pago;
      const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
      const ultimoReciboPagado = expedienteActual.ultimo_recibo_pagado || 0;
      proximoReciboPendiente = Math.min(ultimoReciboPagado + 1, numeroPagos);
    }
    
    setExpedienteParaPago(expedienteActual);
    setComprobantePago(null);
    setFechaUltimoPago(fechaLimite);
    setNumeroReciboPago(proximoReciboPendiente);
    setMostrarModalPago(true);
  }, [expedientes]);

  /**
   * Procesa el pago con comprobante
   */
  const procesarPagoConComprobante = useCallback(async () => {
    if (!expedienteParaPago) return;

    setProcesandoPago(true);

    try {
      // 1. Subir comprobante a S3 (solo si existe)
      let comprobanteUrl = null;
      if (comprobantePago) {
        try {
          console.log('📤 Subiendo comprobante a S3...');
          
          const formData = new FormData();
          formData.append('file', comprobantePago);
          formData.append('tipo', 'comprobante-pago');
          formData.append('expediente_id', expedienteParaPago.id);
          
          const uploadResponse = await fetch(
            `${API_URL}/api/expedientes/${expedienteParaPago.id}/comprobante`,
            {
              method: 'POST',
              body: formData
            }
          );
          
          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            comprobanteUrl = uploadData.data?.pdf_url || uploadData.data?.url;
            console.log('✅ Comprobante subido a S3:', comprobanteUrl);
          } else {
            console.warn('⚠️ No se pudo subir comprobante a S3, continuando sin URL');
          }
        } catch (errorUpload) {
          console.error('❌ Error al subir comprobante:', errorUpload);
          toast.error('Error al subir el comprobante, pero el pago se aplicará');
        }
      } else {
        console.log('ℹ️ No se proporcionó comprobante, aplicando pago sin archivo');
      }

      // 2. Aplicar pago usando el servicio
      const resultado = await pagosService.aplicarPago(expedienteParaPago, {
        fechaUltimoPago,
        comprobantePago,
        numeroReciboPago,
        comprobanteUrl
      });

      if (!resultado.success) {
        throw new Error('Error al aplicar el pago');
      }

      console.log('✅ Pago aplicado correctamente');

      // 3. Actualizar estatus del recibo específico en la tabla recibos_pago
      try {
        console.log(`📝 Actualizando recibo ${numeroReciboPago} en base de datos...`);
        const reciboResponse = await fetch(
          `${API_URL}/api/recibos/${expedienteParaPago.id}/${numeroReciboPago}/pago`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fecha_pago_real: fechaUltimoPago,
              comprobante_nombre: comprobantePago?.name || null,
              comprobante_url: comprobanteUrl || null
            })
          }
        );

        if (reciboResponse.ok) {
          const reciboData = await reciboResponse.json();
          console.log('✅ Recibo actualizado en BD:', reciboData);
        } else {
          console.error('❌ Error al actualizar recibo, status:', reciboResponse.status);
          const errorText = await reciboResponse.text();
          console.error('Respuesta del servidor:', errorText);
        }
      } catch (errorRecibo) {
        console.error('❌ Error al actualizar recibo:', errorRecibo);
        toast.error('Pago aplicado pero error al actualizar recibo en BD');
      }

      // 4. Actualizar estado local
      setExpedientes(prevExpedientes => 
        prevExpedientes.map(exp => 
          exp.id === expedienteParaPago.id 
            ? { 
                ...exp, 
                estatus_pago: resultado.nuevoEstatusPago,
                etapa_activa: resultado.etapaFinal,
                ultimo_recibo_pagado: numeroReciboPago,
                fecha_ultimo_pago: fechaUltimoPago
              }
            : exp
        )
      );

      // 5. Cerrar modal y mostrar éxito
      toast.success('✅ Pago aplicado correctamente');
      setMostrarModalPago(false);
      setExpedienteParaPago(null);
      setComprobantePago(null);
      setNumeroReciboPago(1);

      // 6. Recargar expedientes desde BD
      setTimeout(async () => {
        if (cargarExpedientes) {
          await cargarExpedientes();
        }
        
        // Ejecutar callback adicional (para recargar vista de detalles si es necesario)
        if (onPagoAplicado) {
          await onPagoAplicado(expedienteParaPago);
        }
      }, 500);

    } catch (error) {
      console.error('❌ Error al procesar pago:', error);
      toast.error('Error al aplicar el pago: ' + error.message);
    } finally {
      setProcesandoPago(false);
    }
  }, [expedienteParaPago, comprobantePago, fechaUltimoPago, numeroReciboPago, setExpedientes, cargarExpedientes]);

  return {
    // Estados
    mostrarModalPago,
    setMostrarModalPago,
    expedienteParaPago,
    comprobantePago,
    setComprobantePago,
    fechaUltimoPago,
    setFechaUltimoPago,
    numeroReciboPago,
    setNumeroReciboPago,
    procesandoPago,
    
    // Funciones
    abrirModalAplicarPago,
    procesarPagoConComprobante
  };
}

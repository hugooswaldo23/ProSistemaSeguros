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
import * as historialService from '../services/historialExpedienteService';
import { CONSTANTS } from '../utils/expedientesConstants';

const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = (includeJson = false) => {
  const token = localStorage.getItem('ss_token');
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export function usePagos({ expedientes, setExpedientes, cargarExpedientes, set_aplicando_pago, onPagoAplicado, cambiarEstadoExpediente }) {
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
    
    // Usar fecha de HOY como valor por defecto (es cuando se aplica el pago)
    const hoy = new Date().toISOString().split('T')[0];
    
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
    setFechaUltimoPago(hoy); // 🔥 Usar fecha de hoy por defecto
    setNumeroReciboPago(proximoReciboPendiente);
    setMostrarModalPago(true);
  }, [expedientes]);

  /**
   * Procesa el pago con comprobante
   */
  const procesarPagoConComprobante = useCallback(async () => {
    if (!expedienteParaPago) return;

    setProcesandoPago(true);
    // 🚫 Activar bandera para evitar recálculo de recibos durante el pago
    if (set_aplicando_pago) set_aplicando_pago(true);

    try {
      // 1. Subir comprobante a S3 (solo si existe)
      // IMPORTANTE: Usar endpoint de recibos para NO sobrescribir el PDF de la póliza
      let comprobanteUrl = null;
      if (comprobantePago) {
        try {
          console.log('📤 Subiendo comprobante de pago a S3 (vía recibos)...');
          
          const formData = new FormData();
          formData.append('file', comprobantePago);
          formData.append('tipo', 'comprobante-pago');
          formData.append('numero_recibo', numeroReciboPago);
          
          const uploadResponse = await fetch(
            `${API_URL}/api/recibos/${expedienteParaPago.id}/${numeroReciboPago}/comprobante-pago`,
            {
              method: 'POST',
              headers: getAuthHeaders(),
              body: formData
            }
          );

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `Error subiendo comprobante (${uploadResponse.status})`);
          }

          const uploadData = await uploadResponse.json();
          comprobanteUrl = uploadData.data?.comprobante_url || null;

          if (!comprobanteUrl) {
            throw new Error('El backend no devolvió comprobante_url después de subir el archivo');
          }

          console.log('✅ Comprobante subido a S3 (recibo):', comprobanteUrl);
        } catch (errorUpload) {
          console.error('❌ Error al subir comprobante:', errorUpload);
          toast.error(`No se pudo subir el comprobante: ${errorUpload.message}`);
          throw errorUpload;
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

      // 3. El registro de evento y cambio de etapa ya se hace en pagosService.js
      // No duplicar logs aquí

      // 4. Actualizar estatus del recibo específico en la tabla recibos_pago
      try {
        console.log(`📝 Actualizando recibo ${numeroReciboPago} en base de datos...`);
        const reciboResponse = await fetch(
          `${API_URL}/api/recibos/${expedienteParaPago.id}/${numeroReciboPago}/pago`,
          {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              fecha_pago_real: fechaUltimoPago,
              comprobante_nombre: comprobanteUrl ? (comprobantePago?.name || null) : null,
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

      // 5. Cerrar modal y mostrar éxito
      toast.success('✅ Pago aplicado correctamente');
      setMostrarModalPago(false);
      setExpedienteParaPago(null);
      setComprobantePago(null);
      setNumeroReciboPago(1);

      // 6. Recargar expedientes desde BD para obtener el estatus correcto calculado por el backend
      if (cargarExpedientes) {
        await cargarExpedientes();
      }
      
      // Ejecutar callback adicional (para recargar vista de detalles si es necesario)
      if (onPagoAplicado) {
        await onPagoAplicado(expedienteParaPago);
      }

    } catch (error) {
      console.error('❌ Error al procesar pago:', error);
      toast.error('Error al aplicar el pago: ' + error.message);
    } finally {
      setProcesandoPago(false);
      // 🟢 Desactivar bandera para permitir recálculo normal
      if (set_aplicando_pago) set_aplicando_pago(false);
    }
  }, [expedienteParaPago, comprobantePago, fechaUltimoPago, numeroReciboPago, setExpedientes, cargarExpedientes, onPagoAplicado, set_aplicando_pago]);

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

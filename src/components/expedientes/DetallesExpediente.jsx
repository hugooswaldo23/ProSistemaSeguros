/**
 * ====================================================================
 * COMPONENTE: DETALLES DE EXPEDIENTE
 * ====================================================================
 * Vista completa de detalles de un expediente con:
 * - Información general del expediente
 * - Calendario de pagos
 * - Historial y trazabilidad
 * - Acciones (Aplicar Pago, Compartir, Cancelar, Editar)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { DollarSign, Share2, XCircle, Edit } from 'lucide-react';
import DetalleExpediente from '../DetalleExpediente';
import CalendarioPagos from './CalendarioPagos';
import TimelineExpediente from '../TimelineExpediente';
import utils from '../../utils/expedientesUtils';

const API_URL = import.meta.env.VITE_API_URL;

const DetallesExpediente = React.memo(({ 
  expedienteSeleccionado,
  setExpedienteSeleccionado,
  setVistaActual,
  aplicarPago,
  cargarExpedientes,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  editarExpediente,
  calcularSiguientePago,
  calculartermino_vigencia,
  calcularProximoPago,
  abrirModalCompartir,
  enviarAvisoPago,
  onEliminarPago, // Callback para eliminar pago (abre modal)
  historial = [], // Historial del expediente
  setHistorialExpediente
}) => {
  const [clienteInfo, setClienteInfo] = useState(null);
  
  // Debug: verificar que el historial llega correctamente
  useEffect(() => {
    console.log('🔍 DetallesExpediente - Historial recibido:', {
      cantidad: historial?.length || 0,
      historial: historial,
      expediente_id: expedienteSeleccionado?.id
    });
  }, [historial, expedienteSeleccionado?.id]);
  
  // Estados para controlar secciones colapsables (todas cerradas por defecto)
  const [mostrarAsegurado, setMostrarAsegurado] = useState(false);
  const [mostrarPoliza, setMostrarPoliza] = useState(false);
  const [mostrarVigencia, setMostrarVigencia] = useState(false);
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [mostrarFinanciera, setMostrarFinanciera] = useState(false);
  const [mostrarCoberturas, setMostrarCoberturas] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  
  // Helper: parsear coberturas de forma segura
  const obtenerCoberturas = useMemo(() => {
    if (!expedienteSeleccionado?.coberturas) return [];
    
    // Si ya es un array, devolverlo
    if (Array.isArray(expedienteSeleccionado.coberturas)) {
      return expedienteSeleccionado.coberturas;
    }
    
    // Si es un string JSON, parsearlo
    if (typeof expedienteSeleccionado.coberturas === 'string') {
      try {
        const parsed = JSON.parse(expedienteSeleccionado.coberturas);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Error parseando coberturas:', e);
        return [];
      }
    }
    
    return [];
  }, [expedienteSeleccionado?.coberturas]);
  
  // Debug: ver qué coberturas tiene el expediente
  useEffect(() => {
    if (expedienteSeleccionado) {
      console.log('🔍 Expediente seleccionado para detalles:', {
        numero_poliza: expedienteSeleccionado.numero_poliza,
        tiene_coberturas: !!expedienteSeleccionado.coberturas,
        cantidad_coberturas: expedienteSeleccionado.coberturas?.length || 0,
        coberturas: expedienteSeleccionado.coberturas,
        tipo_cobertura: expedienteSeleccionado.tipo_cobertura,
        suma_asegurada: expedienteSeleccionado.suma_asegurada,
        deducible: expedienteSeleccionado.deducible
      });
    }
  }, [expedienteSeleccionado]);
  
  // Cargar información del cliente cuando se selecciona un expediente
  useEffect(() => {
    const cargarCliente = async () => {
      if (expedienteSeleccionado?.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          const cliente = clientes.find(c => c.id === expedienteSeleccionado.cliente_id);
          setClienteInfo(cliente);
        } catch (error) {
          console.error('Error al cargar cliente:', error);
        }
      } else {
        setClienteInfo(null);
      }
    };
    
    cargarCliente();
  }, [expedienteSeleccionado?.cliente_id]);
  
  // Función para recargar el historial
  const recargarHistorial = async () => {
    if (!expedienteSeleccionado?.id) return;
    
    console.log('🔄 Recargando historial después de acción...');
    try {
      const response = await fetch(`${API_URL}/api/historial-expedientes/${expedienteSeleccionado.id}?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const historialRaw = data?.data || data || [];
        const historialArray = Array.isArray(historialRaw) ? historialRaw : [];
        setHistorialExpediente(historialArray);
        console.log('✅ Historial recargado:', historialArray.length, 'eventos');
      }
    } catch (error) {
      console.error('❌ Error al recargar historial:', error);
    }
  };
  
  return (
  <div className="p-4">
    <div className="d-flex justify-content-between align-items-center mb-4">
      <h3 className="mb-0">Detalles del Expediente</h3>
      <div className="d-flex gap-3">
        {expedienteSeleccionado && 
         ['Emitida', 'Renovada', 'Enviada al Cliente', 'Vencida'].includes(expedienteSeleccionado.etapa_activa) && 
         ((expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagado' && (expedienteSeleccionado.estatusPago || '').toLowerCase().trim() !== 'pagada') && (
          <button
            onClick={async () => {
              aplicarPago(expedienteSeleccionado.id);
              
              // Después de aplicar pago, recargar expedientes y volver a lista
              toast.success('Pago aplicado correctamente');
              
              setTimeout(async () => {
                // Recargar expedientes
                if (cargarExpedientes) {
                  await cargarExpedientes();
                }
                // Volver a lista
                setVistaActual('lista');
              }, 1000);
            }}
            className="btn btn-success d-flex align-items-center"
          >
            <DollarSign size={16} className="me-2" />
            Aplicar Pago
          </button>
          )}

          {expedienteSeleccionado && (
            <button
              onClick={() => abrirModalCompartir(expedienteSeleccionado)}
              className="btn btn-success d-flex align-items-center"
            >
              <Share2 size={16} className="me-2" />
              Compartir
            </button>
          )}

          {expedienteSeleccionado && expedienteSeleccionado.etapa_activa !== 'Cancelada' && (
            <button
              onClick={() => iniciarCancelacion(expedienteSeleccionado)}
              className="btn btn-danger d-flex align-items-center"
            >
              <XCircle size={16} className="me-2" />
              Cancelar Póliza
            </button>
          )}
          
          <button
            onClick={() => editarExpediente(expedienteSeleccionado)}
            className="btn btn-primary d-flex align-items-center"
          >
            <Edit size={16} className="me-2" />
            Editar
          </button>
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary"
          >
            Volver
          </button>
        </div>
      </div>

      {expedienteSeleccionado && (
        <div className="card">
          <div className="card-body p-3">
            <div className="row g-3">
              <div className="col-12">
                <DetalleExpediente
                  datos={expedienteSeleccionado}
                  coberturas={obtenerCoberturas}
                  utils={utils}
                  modo="caratula"
                  onHistorialClick={recargarHistorial}
                  historialSlot={(
                    <>
                      {/* SECCIÓN ÚNICA: Timeline Unificado (Trazabilidad + Comunicaciones) */}
                      <div className="mb-3">
                        <TimelineExpediente 
                          expedienteId={expedienteSeleccionado.id}
                          expedienteData={expedienteSeleccionado}
                        />
                      </div>
                    </>
                  )}
                />
              </div>
              {/* Mostrar calendario para Fraccionado y Anual */}
              {expedienteSeleccionado.inicio_vigencia && (
                (expedienteSeleccionado.tipo_pago === 'Fraccionado' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
                expedienteSeleccionado.tipo_pago === 'Anual' ||
                (expedienteSeleccionado.forma_pago?.toUpperCase() === 'FRACCIONADO' && (expedienteSeleccionado.frecuenciaPago || expedienteSeleccionado.frecuencia_pago)) ||
                expedienteSeleccionado.forma_pago?.toUpperCase() === 'ANUAL'
              ) && (
                <div className="col-12">
                  <CalendarioPagos 
                    key={`calendario-${expedienteSeleccionado?.id}-${historial?.length || 0}`}
                    expediente={expedienteSeleccionado}
                    calcularProximoPago={calcularProximoPago}
                    mostrarResumen={true}
                    onEnviarAviso={enviarAvisoPago}
                    onEliminarPago={onEliminarPago}
                    historial={historial}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

DetallesExpediente.displayName = 'DetallesExpediente';

export default DetallesExpediente;

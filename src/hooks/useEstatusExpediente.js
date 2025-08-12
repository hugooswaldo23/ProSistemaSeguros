// Hook para manejo de estado y cálculos automáticos de expedientes
import { useCallback } from 'react';
import { useFechasExpediente } from './useFechasExpediente';

export const useEstatusExpediente = () => {
  const { calcularProximoPago } = useFechasExpediente();

  const calcularEstatusPago = useCallback((proximoPago, periodoGracia, tipoPago, estatusActual, esPrimerPago = true) => {
    if (!proximoPago) return 'Sin definir';
    
    if (estatusActual === 'Pagado') return 'Pagado';
    
    const hoy = new Date();
    const fechaProximoPago = new Date(proximoPago);
    const diferenciaDias = Math.ceil((fechaProximoPago - hoy) / (1000 * 60 * 60 * 24));
    
    const tieneGracia = esPrimerPago;
    const diasGracia = tieneGracia ? periodoGracia : 0;
    
    const fechaVencimiento = new Date(fechaProximoPago);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasGracia);
    
    const diasHastaVencimiento = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    if (diferenciaDias > 30) {
      return tipoPago === 'Anual' ? 'Por renovar' : 'Sin definir';
    } else if (diferenciaDias > 0) {
      return 'Pago por vencer';
    } else if (tieneGracia && diasHastaVencimiento > 0) {
      return 'Pago en período de gracia';
    } else if (diasHastaVencimiento <= 0) {
      return 'Vencido';
    } else {
      return 'Sin definir';
    }
  }, []);

  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    const esPrimerPago = !formularioActual.fechaUltimoPago;
    
    const proximoPago = calcularProximoPago(
      formularioActual.inicioVigencia,
      formularioActual.tipoPago,
      formularioActual.frecuenciaPago,
      esPrimerPago
    );
    
    const estatusPago = calcularEstatusPago(
      proximoPago,
      formularioActual.periodoGracia,
      formularioActual.tipoPago,
      formularioActual.estatusPago,
      esPrimerPago
    );
    
    return {
      ...formularioActual,
      proximoPago,
      estatusPago
    };
  }, [calcularProximoPago, calcularEstatusPago]);

  const obtenerSiguienteEstado = useCallback((estadoActual) => {
    const flujo = {
      'En cotización': 'Cotización enviada',
      'Cotización enviada': 'Autorizado',
      'Autorizado': 'En proceso emisión',
      'En proceso emisión': 'Emitida',
      'Emitida': 'Pendiente de pago',
      'Pendiente de pago': 'Pagado'
    };
    return flujo[estadoActual];
  }, []);

  const puedeAvanzarEstado = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(estado);
  }, []);

  const puedeCancelar = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Pendiente de pago'].includes(estado);
  }, []);

  return {
    calcularEstatusPago,
    actualizarCalculosAutomaticos,
    obtenerSiguienteEstado,
    puedeAvanzarEstado,
    puedeCancelar,
  };
};

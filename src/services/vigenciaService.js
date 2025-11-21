/**
 * ====================================================================
 * SERVICIO: Gestión de Vigencias de Pólizas
 * PROPÓSITO: Detectar y registrar pólizas próximas a vencer y vencidas
 * ====================================================================
 */

import { API_URL } from '../constants/apiUrl';
import * as historialService from './historialExpedienteService';

/**
 * Verificar vigencias de todas las pólizas activas
 * Debe ejecutarse diariamente (job programado o al cargar dashboard)
 */
export const verificarVigencias = async () => {
  try {
    console.log('🔍 Verificando vigencias de pólizas...');
    
    // Obtener todas las pólizas en vigencia
    const response = await fetch(`${API_URL}/api/expedientes`);
    if (!response.ok) throw new Error('Error al obtener expedientes');
    
    const expedientes = await response.json();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const resultados = {
      proximasVencer: [],
      vencidas: [],
      errores: []
    };
    
    for (const expediente of expedientes) {
      // Solo verificar pólizas en vigencia o pagadas
      if (!['En Vigencia', 'Emitida', 'Enviada al Cliente'].includes(expediente.etapa_activa)) {
        continue;
      }
      
      if (!expediente.termino_vigencia) continue;
      
      const fechaVencimiento = new Date(expediente.termino_vigencia);
      fechaVencimiento.setHours(0, 0, 0, 0);
      
      const diasRestantes = Math.floor((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      
      try {
        // Póliza vencida
        if (diasRestantes < 0 && expediente.etapa_activa !== 'Vencida') {
          await marcarComoVencida(expediente);
          resultados.vencidas.push(expediente.numero_poliza);
        }
        // Próxima a vencer (30 días o menos)
        else if (diasRestantes >= 0 && diasRestantes <= 30) {
          await marcarProximaVencer(expediente, diasRestantes);
          resultados.proximasVencer.push({
            numero_poliza: expediente.numero_poliza,
            dias_restantes: diasRestantes
          });
        }
      } catch (error) {
        console.error(`❌ Error al procesar ${expediente.numero_poliza}:`, error);
        resultados.errores.push({
          numero_poliza: expediente.numero_poliza,
          error: error.message
        });
      }
    }
    
    console.log('✅ Verificación de vigencias completada:', resultados);
    return resultados;
    
  } catch (error) {
    console.error('❌ Error en verificación de vigencias:', error);
    throw error;
  }
};

/**
 * Marcar póliza como próxima a vencer
 */
const marcarProximaVencer = async (expediente, diasRestantes) => {
  // Verificar si ya se registró este evento en los últimos 7 días
  const historial = await historialService.obtenerHistorialExpediente(expediente.id);
  const yaRegistrado = historial.some(evento => 
    evento.tipo_evento === historialService.TIPOS_EVENTO.POLIZA_PROXIMA_VENCER &&
    new Date(evento.fecha_evento) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  
  if (yaRegistrado) {
    console.log(`⏭️ Póliza ${expediente.numero_poliza} ya marcada como próxima a vencer`);
    return;
  }
  
  // Registrar evento
  await historialService.registrarEvento({
    expediente_id: expediente.id,
    cliente_id: expediente.cliente_id,
    tipo_evento: historialService.TIPOS_EVENTO.POLIZA_PROXIMA_VENCER,
    usuario_nombre: 'Sistema Automático',
    descripcion: `Póliza próxima a vencer en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`,
    datos_adicionales: {
      numero_poliza: expediente.numero_poliza,
      dias_restantes: diasRestantes,
      fecha_vencimiento: expediente.termino_vigencia
    }
  });
  
  console.log(`⏰ Póliza ${expediente.numero_poliza} marcada como próxima a vencer (${diasRestantes} días)`);
};

/**
 * Marcar póliza como vencida
 */
const marcarComoVencida = async (expediente) => {
  // Actualizar etapa en BD
  await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      etapa_activa: 'Vencida',
      fecha_vencimiento: new Date().toISOString().split('T')[0]
    })
  });
  
  // Registrar evento
  await historialService.registrarEvento({
    expediente_id: expediente.id,
    cliente_id: expediente.cliente_id,
    tipo_evento: historialService.TIPOS_EVENTO.POLIZA_VENCIDA,
    usuario_nombre: 'Sistema Automático',
    descripcion: `Póliza vencida el ${new Date(expediente.termino_vigencia).toLocaleDateString('es-MX')}`,
    datos_adicionales: {
      numero_poliza: expediente.numero_poliza,
      fecha_vencimiento: expediente.termino_vigencia,
      inicio_vigencia: expediente.inicio_vigencia
    }
  });
  
  console.log(`❌ Póliza ${expediente.numero_poliza} marcada como vencida`);
};

/**
 * Verificar si una póliza específica requiere actualización de vigencia
 */
export const verificarVigenciaIndividual = async (expediente) => {
  if (!expediente.termino_vigencia) return null;
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaVencimiento = new Date(expediente.termino_vigencia);
  fechaVencimiento.setHours(0, 0, 0, 0);
  
  const diasRestantes = Math.floor((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
  
  if (diasRestantes < 0) {
    return { estado: 'vencida', diasRestantes };
  } else if (diasRestantes <= 30) {
    return { estado: 'proxima_vencer', diasRestantes };
  } else {
    return { estado: 'vigente', diasRestantes };
  }
};

/**
 * ====================================================================
 * COMPONENTE: LISTA DE EXPEDIENTES
 * ====================================================================
 * Tabla principal de expedientes con filtros por carpetas
 * - Sistema de carpetas (vigentes, renovadas, por renovar, etc.)
 * - Detección de duplicados
 * - Acciones por expediente (ver, editar, eliminar, compartir, pagar)
 * - Vista responsive (desktop y móvil)
 */

import React from 'react';
import { Plus, Edit, Trash2, Eye, FileText, Upload, DollarSign, Share2, AlertCircle, Search, XCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { CONSTANTS } from '../../utils/expedientesConstants';
import utils from '../../utils/expedientesUtils';
import * as estatusPagosUtils from '../../utils/estatusPagos';
import { Badge, InfoCliente, EstadoPago, BarraBusqueda } from './UIComponents';
import { usePaginacion } from '../../hooks/usePaginacion';
import Paginacion from '../common/Paginacion';
import CalendarioPagos from './CalendarioPagos';

// 👇 COPIAR AQUÍ desde Expedientes.jsx líneas 2677 hasta 4393
const ListaExpedientes = React.memo(({ 
  expedientes,
  agentes,
  vendedoresMap,
  limpiarFormulario,
  setVistaActual,
  setModoEdicion,
  mostrarModalMetodoCaptura,
  setMostrarModalMetodoCaptura,
  mostrarExtractorPDF,
  setMostrarExtractorPDF,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  verDetalles,
  editarExpediente,
  eliminarExpediente,
  calcularProximoPago,
  clientesMap,
  abrirModalCompartir,
  // 🔄 Funciones de renovación (Flujo 1: Cotización)
  iniciarRenovacion,           // Abre modal con opciones (Cotización o Póliza)
  cargarCotizacion,            // 🆕 Cargar archivo de cotización
  enviarCotizacionCliente,     // Cotización Lista → Cotización Enviada
  marcarRenovacionAutorizada,  // Cotización Enviada → Por Emitir
  abrirModalPolizaRenovada     // Por Emitir → Crear nuevo expediente
}) => {
  // Estado para carpeta/categoría seleccionada
  const [carpetaSeleccionada, setCarpetaSeleccionada] = React.useState('en_proceso');
  
  // 📂 HELPER: Obtener próximo recibo pendiente y días para vencer
  const obtenerProximoReciboPendiente = (exp) => {
    if (!exp.recibos || !Array.isArray(exp.recibos) || exp.recibos.length === 0) {
      return null;
    }
    
    // Ordenar recibos por número
    const recibosOrdenados = [...exp.recibos].sort((a, b) => 
      (a.numero_recibo || 0) - (b.numero_recibo || 0)
    );
    
    // Encontrar el primer recibo pendiente (sin fecha_pago_real Y no cancelado)
    const proximoPendiente = recibosOrdenados.find(r => {
      if (r.fecha_pago_real) return false; // Ya pagado
      const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
      if (estatus === 'cancelado' || estatus === 'cancelada') return false; // Cancelado
      return true;
    });
    
    if (!proximoPendiente) return null;
    
    // Calcular días restantes para que venza este recibo
    const fechaVencimiento = proximoPendiente.fecha_limite_pago || proximoPendiente.fecha_vencimiento;
    if (!fechaVencimiento) return { recibo: proximoPendiente, diasRestantes: 999 };
    
    const fechaVenc = new Date(fechaVencimiento);
    const hoy = new Date();
    fechaVenc.setHours(0, 0, 0, 0);
    hoy.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
    
    return { recibo: proximoPendiente, diasRestantes };
  };
  
  // 📂 HELPER: Calcular etapa real del flujo de negocio
  // ETAPA ACTIVA = Flujo de la póliza: Emitida → Enviada → En Vigencia → Cancelada/Renovada
  // ESTATUS PAGO = Estado del recibo: Pendiente → Por Vencer → Vencido → Pagado (esto se maneja aparte)
  const calcularEtapaReal = (exp) => {
    // Etapas que NO deben modificarse (proceso de renovación)
    const etapasRenovacion = [
      'Renovada', 'Renovación Emitida', 'En Cotización - Renovación', 
      'Cotización Lista', 'Cotización Enviada', 'Por Emitir - Renovación',
      'Por Renovar'
    ];
    
    if (etapasRenovacion.includes(exp.etapa_activa)) {
      return exp.etapa_activa;
    }
    
    // 🔥 Póliza cancelada: mostrar "Vigente / Cancelada" si aún tiene vigencia
    if (exp.etapa_activa === 'Cancelada') {
      // Verificar si aún tiene vigencia activa
      if (exp.recibos && exp.recibos.length > 0) {
        const recibosPagados = exp.recibos
          .filter(r => r.fecha_pago_real)
          .sort((a, b) => (b.numero_recibo || 0) - (a.numero_recibo || 0));
        
        if (recibosPagados.length > 0) {
          const ultimoPagado = recibosPagados[0];
          const fechaVencUltimoPagado = ultimoPagado.fecha_limite_pago || ultimoPagado.fecha_vencimiento;
          if (fechaVencUltimoPagado) {
            const fechaVenc = new Date(fechaVencUltimoPagado);
            const hoy = new Date();
            fechaVenc.setHours(23, 59, 59, 999);
            hoy.setHours(0, 0, 0, 0);
            if (fechaVenc >= hoy) {
              return 'Vigente / Cancelada';
            }
          }
        }
      }
      return 'Cancelada';
    }
    
    // 🔥 Para pólizas normales: la etapa depende del flujo, NO del estatus de pago
    // - Si tiene algún recibo pagado → "En Vigencia"
    // - Si fue enviada al cliente → "Enviada al Cliente"  
    // - Si no → "Emitida"
    
    if (exp.recibos && exp.recibos.length > 0) {
      const tieneAlgunPago = exp.recibos.some(r => r.fecha_pago_real);
      if (tieneAlgunPago) {
        return 'En Vigencia';
      }
    }
    
    // Mantener etapa guardada en BD (Emitida, Enviada al Cliente, etc.)
    return exp.etapa_activa || 'Emitida';
  };
  
  // 📂 HELPER: Verificar si la póliza aún tiene vigencia activa
  const tieneVigenciaActiva = (exp) => {
    // Si tiene término de vigencia, verificar que no haya pasado
    if (exp.termino_vigencia) {
      const fechaTermino = new Date(exp.termino_vigencia);
      const hoy = new Date();
      fechaTermino.setHours(23, 59, 59, 999);
      hoy.setHours(0, 0, 0, 0);
      return fechaTermino >= hoy;
    }
    
    // Si tiene recibos pagados, calcular vigencia basada en el último recibo pagado
    if (exp.recibos && exp.recibos.length > 0) {
      const recibosPagados = exp.recibos
        .filter(r => r.fecha_pago_real)
        .sort((a, b) => (b.numero_recibo || 0) - (a.numero_recibo || 0));
      
      if (recibosPagados.length > 0) {
        const ultimoPagado = recibosPagados[0];
        const fechaVencUltimoPagado = ultimoPagado.fecha_limite_pago || ultimoPagado.fecha_vencimiento;
        if (fechaVencUltimoPagado) {
          const fechaVenc = new Date(fechaVencUltimoPagado);
          const hoy = new Date();
          fechaVenc.setHours(23, 59, 59, 999);
          hoy.setHours(0, 0, 0, 0);
          return fechaVenc >= hoy;
        }
      }
    }
    
    // Sin información de vigencia, asumir activa
    return true;
  };
  
  // 📂 HELPER: Determinar si la etapa es de PROCESO de renovación (cotización/por emitir)
  // Estas NO deben aparecer en carpetas normales (vigentes, en_proceso)
  const esEtapaProcesoRenovacion = (etapa) => {
    if (!etapa) return false;
    return etapa === 'En Cotización - Renovación' ||
           etapa === 'Cotización Lista' ||
           etapa === 'Cotización Enviada' ||
           etapa === 'Por Emitir - Renovación' ||
           etapa === 'Por Renovar';
  };

  // 📂 FILTROS DE PÓLIZAS POR CARPETA
  const expedientesFiltrados = React.useMemo(() => {
    switch (carpetaSeleccionada) {
      case 'en_proceso':
        // Pólizas con próximo recibo pendiente a 15 días o menos de vencer
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          if (exp.etapa_activa === 'Renovada') return false;
          
          // Si está en proceso de renovación (cotización), no mostrar aquí
          if (esEtapaProcesoRenovacion(exp.etapa_activa)) {
            return false;
          }
          
          const proximoRecibo = obtenerProximoReciboPendiente(exp);
          
          // Si no hay recibos, usar lógica anterior de estatus
          if (!proximoRecibo) {
            const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
            return estatusPago === 'por vencer' || estatusPago === 'pago por vencer';
          }
          
          // Próximo recibo pendiente a 15 días o menos de vencer (pero no vencido aún)
          return proximoRecibo.diasRestantes <= 15 && proximoRecibo.diasRestantes >= 0;
        });
      
      case 'vigentes':
        // Pólizas con próximo recibo pendiente a MÁS de 15 días de vencer
        // O pólizas canceladas pero con vigencia aún activa
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Renovada') return false;
          
          // 🔥 Póliza cancelada pero con vigencia activa → mostrar en vigentes
          if (exp.etapa_activa === 'Cancelada') {
            return tieneVigenciaActiva(exp);
          }
          
          // Si está en proceso de renovación (cotización), no mostrar en vigentes
          if (esEtapaProcesoRenovacion(exp.etapa_activa)) {
            return false;
          }
          
          const proximoRecibo = obtenerProximoReciboPendiente(exp);
          
          // Si tiene recibos, verificar que el próximo pendiente esté a más de 15 días
          if (proximoRecibo) {
            return proximoRecibo.diasRestantes > 15;
          }
          
          // Si no hay recibos pendientes, verificar si está pagada y no próxima a vencer
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          const estaPagado = estatusPago === 'pagado' || estatusPago === 'pagada';
          
          if (!estaPagado) return false;
          
          // Verificar que NO esté próxima a vencer (más de 30 días restantes)
          if (exp.termino_vigencia) {
            const fechaTermino = new Date(exp.termino_vigencia);
            const hoy = new Date();
            fechaTermino.setHours(0, 0, 0, 0);
            hoy.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((fechaTermino - hoy) / (1000 * 60 * 60 * 24));
            // Solo mostrar si faltan MÁS de 30 días
            if (diasRestantes <= 30) return false;
          }
          
          // Verificar por fecha_aviso_renovacion
          if (exp.fecha_aviso_renovacion) {
            const fechaAviso = new Date(exp.fecha_aviso_renovacion);
            const hoy = new Date();
            fechaAviso.setHours(0, 0, 0, 0);
            hoy.setHours(0, 0, 0, 0);
            if (fechaAviso <= hoy) return false;
          }
          
          return true;
        });
      
      case 'renovadas':
        // TODO: Implementar reglas para Renovadas
        return expedientes.filter(exp => exp.etapa_activa === 'Renovada');
      
      case 'en_proceso_renovacion':
        // 🔄 Pólizas con proceso de renovación YA iniciado
        // FLUJO: En Cotización → Cotización Lista → Cotización Enviada → Por Emitir
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          if (exp.etapa_activa === 'Renovada') return false;
          
          const etapa = exp.etapa_activa || '';
          // Incluir si tiene etapa de proceso de renovación activo
          return etapa === 'En Cotización - Renovación' ||
                 etapa === 'Cotización Lista' ||
                 etapa === 'Cotización Enviada' ||
                 etapa === 'Por Emitir - Renovación';
        });
      
      case 'por_renovar':
        // 🔄 Pólizas próximas a vencer que AÚN NO han iniciado proceso de renovación
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          if (exp.etapa_activa === 'Renovada') return false;
          
          const etapa = exp.etapa_activa || '';
          
          // EXCLUIR si ya está en proceso de renovación (FLUJO 1)
          if (etapa === 'En Cotización - Renovación') return false;
          if (etapa === 'Cotización Lista') return false;
          if (etapa === 'Cotización Enviada') return false;
          if (etapa === 'Por Emitir - Renovación') return false;
          
          // Verificar por fecha_aviso_renovacion
          if (exp.fecha_aviso_renovacion) {
            const fechaAviso = new Date(exp.fecha_aviso_renovacion);
            const hoy = new Date();
            fechaAviso.setHours(0, 0, 0, 0);
            hoy.setHours(0, 0, 0, 0);
            if (fechaAviso <= hoy) return true;
          }
          
          // Verificar por término de vigencia (30 días antes)
          if (exp.termino_vigencia) {
            const fechaTermino = new Date(exp.termino_vigencia);
            const hoy = new Date();
            fechaTermino.setHours(0, 0, 0, 0);
            hoy.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((fechaTermino - hoy) / (1000 * 60 * 60 * 24));
            // Mostrar si faltan 30 días o menos Y la vigencia no ha terminado
            if (diasRestantes <= 30 && diasRestantes >= 0) return true;
          }
          
          // También incluir si tiene etapa "Por Renovar" explícita
          if (etapa === 'Por Renovar') return true;
          
          return false;
        });
      
      case 'vencidas':
        // Pólizas con estatus "Vencido" o con recibo vencido
        return expedientes.filter(exp => {
          if (exp.etapa_activa === 'Cancelada') return false;
          
          // Verificar si tiene recibo vencido
          const proximoRecibo = obtenerProximoReciboPendiente(exp);
          if (proximoRecibo && proximoRecibo.diasRestantes < 0) {
            return true;
          }
          
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          
          return estatusPago === 'vencido' || estatusPago === 'vencida';
        });
      
      case 'canceladas':
        // Pólizas canceladas SOLO cuando su vigencia ya terminó
        return expedientes.filter(exp => {
          if (exp.etapa_activa !== 'Cancelada') return false;
          
          // Solo mostrar en canceladas si la vigencia ya terminó
          return !tieneVigenciaActiva(exp);
        });
      
      case 'todas':
      default:
        return expedientes;
    }
  }, [expedientes, carpetaSeleccionada]);
  
  // 📂 CONTADORES DE PÓLIZAS POR CARPETA
  const contadores = React.useMemo(() => {
    return {
      todas: expedientes.length,
      
      // Pólizas con próximo recibo pendiente a 15 días o menos de vencer
      en_proceso: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        if (exp.etapa_activa === 'Renovada') return false;
        
        if (esEtapaProcesoRenovacion(exp.etapa_activa)) {
          return false;
        }
        
        const proximoRecibo = obtenerProximoReciboPendiente(exp);
        
        if (!proximoRecibo) {
          const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
          return estatusPago === 'por vencer' || estatusPago === 'pago por vencer';
        }
        
        return proximoRecibo.diasRestantes <= 15 && proximoRecibo.diasRestantes >= 0;
      }).length,
      
      // Pólizas con próximo recibo pendiente a MÁS de 15 días de vencer
      // O pólizas canceladas pero con vigencia aún activa
      vigentes: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Renovada') return false;
        
        // 🔥 Póliza cancelada pero con vigencia activa → contar en vigentes
        if (exp.etapa_activa === 'Cancelada') {
          return tieneVigenciaActiva(exp);
        }
        
        // Si está en proceso de renovación (cotización), no contar en vigentes
        if (esEtapaProcesoRenovacion(exp.etapa_activa)) {
          return false;
        }
        
        const proximoRecibo = obtenerProximoReciboPendiente(exp);
        
        if (proximoRecibo) {
          return proximoRecibo.diasRestantes > 15;
        }
        
        const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
        const estaPagado = estatusPago === 'pagado' || estatusPago === 'pagada';
        
        if (!estaPagado) return false;
        
        // Verificar que NO esté próxima a vencer (más de 30 días restantes)
        if (exp.termino_vigencia) {
          const fechaTermino = new Date(exp.termino_vigencia);
          const hoy = new Date();
          fechaTermino.setHours(0, 0, 0, 0);
          hoy.setHours(0, 0, 0, 0);
          const diasRestantes = Math.ceil((fechaTermino - hoy) / (1000 * 60 * 60 * 24));
          if (diasRestantes <= 30) return false;
        }
        
        // Verificar por fecha_aviso_renovacion
        if (exp.fecha_aviso_renovacion) {
          const fechaAviso = new Date(exp.fecha_aviso_renovacion);
          const hoy = new Date();
          fechaAviso.setHours(0, 0, 0, 0);
          hoy.setHours(0, 0, 0, 0);
          if (fechaAviso <= hoy) return false;
        }
        
        return true;
      }).length,
      
      renovadas: expedientes.filter(exp => exp.etapa_activa === 'Renovada').length,
      
      // 🔄 Pólizas con proceso de renovación YA iniciado (FLUJO 1)
      en_proceso_renovacion: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        if (exp.etapa_activa === 'Renovada') return false;
        
        const etapa = exp.etapa_activa || '';
        return etapa === 'En Cotización - Renovación' ||
               etapa === 'Cotización Lista' ||
               etapa === 'Cotización Enviada' ||
               etapa === 'Por Emitir - Renovación';
      }).length,
      
      // 🔄 Pólizas próximas a vencer que AÚN NO han iniciado proceso
      por_renovar: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        if (exp.etapa_activa === 'Renovada') return false;
        
        const etapa = exp.etapa_activa || '';
        
        // EXCLUIR si ya está en proceso de renovación (FLUJO 1)
        if (etapa === 'En Cotización - Renovación') return false;
        if (etapa === 'Cotización Lista') return false;
        if (etapa === 'Cotización Enviada') return false;
        if (etapa === 'Por Emitir - Renovación') return false;
        
        // Verificar por fecha_aviso_renovacion
        if (exp.fecha_aviso_renovacion) {
          const fechaAviso = new Date(exp.fecha_aviso_renovacion);
          const hoy = new Date();
          fechaAviso.setHours(0, 0, 0, 0);
          hoy.setHours(0, 0, 0, 0);
          if (fechaAviso <= hoy) return true;
        }
        
        // Verificar por término de vigencia (30 días antes)
        if (exp.termino_vigencia) {
          const fechaTermino = new Date(exp.termino_vigencia);
          const hoy = new Date();
          fechaTermino.setHours(0, 0, 0, 0);
          hoy.setHours(0, 0, 0, 0);
          const diasRestantes = Math.ceil((fechaTermino - hoy) / (1000 * 60 * 60 * 24));
          if (diasRestantes <= 30 && diasRestantes >= 0) return true;
        }
        
        // También incluir si tiene etapa "Por Renovar" explícita
        if (etapa === 'Por Renovar') return true;
        
        return false;
      }).length,
      
      // Pólizas con estatus "Vencido" o con recibo vencido
      vencidas: expedientes.filter(exp => {
        if (exp.etapa_activa === 'Cancelada') return false;
        
        // Verificar si tiene recibo vencido
        const proximoRecibo = obtenerProximoReciboPendiente(exp);
        if (proximoRecibo && proximoRecibo.diasRestantes < 0) {
          return true;
        }
        
        const estatusPago = (exp.estatusPago || exp.estatus_pago || '').toLowerCase().trim();
        return estatusPago === 'vencido' || estatusPago === 'vencida';
      }).length,
      
      // Pólizas canceladas SOLO cuando su vigencia ya terminó
      canceladas: expedientes.filter(exp => {
        if (exp.etapa_activa !== 'Cancelada') return false;
        return !tieneVigenciaActiva(exp);
      }).length
    };
  }, [expedientes]);
  
  const paginacion = usePaginacion(expedientesFiltrados, 10);

  // Detectar 3 tipos de duplicados (excluir Renovadas: es normal que compartan VIN con la nueva)
  const analisisDuplicados = React.useMemo(() => {
    const polizasDuplicadas = [];
    const vinsDuplicados = [];
    const polizasVinDistinto = [];

    // Filtrar: no analizar pólizas con etapa "Renovada" (comparten VIN con su renovación)
    const activos = expedientes.filter(e => e.etapa_activa !== 'Renovada');

    activos.forEach((exp, index) => {
      // Solo analizar si tiene número de póliza
      if (!exp.numero_poliza) return;

      const vin = exp.numero_serie?.trim() || '';

      // Buscar otros expedientes
      activos.forEach((otro, otroIndex) => {
        if (index >= otroIndex || !otro.numero_poliza) return;

        const otroVin = otro.numero_serie?.trim() || '';

        // Regla 1: Misma póliza + mismo VIN (duplicada completa)
        if (exp.numero_poliza === otro.numero_poliza &&
            exp.compania === otro.compania &&
            vin !== '' && otroVin !== '' &&
            vin === otroVin) {
          if (!polizasDuplicadas.find(d => d.id === exp.id)) {
            polizasDuplicadas.push({ id: exp.id, tipo: 'completa', poliza: exp.numero_poliza, vin });
          }
          if (!polizasDuplicadas.find(d => d.id === otro.id)) {
            polizasDuplicadas.push({ id: otro.id, tipo: 'completa', poliza: otro.numero_poliza, vin: otroVin });
          }
        }
        // Regla 2: Mismo VIN, diferente póliza
        else if (vin !== '' && otroVin !== '' &&
                 vin === otroVin &&
                 exp.numero_poliza !== otro.numero_poliza) {
          if (!vinsDuplicados.find(d => d.id === exp.id)) {
            vinsDuplicados.push({ id: exp.id, vin, poliza: exp.numero_poliza });
          }
          if (!vinsDuplicados.find(d => d.id === otro.id)) {
            vinsDuplicados.push({ id: otro.id, vin: otroVin, poliza: otro.numero_poliza });
          }
        }
        // Regla 3: Misma póliza, diferente VIN
        else if (exp.numero_poliza === otro.numero_poliza &&
                 exp.compania === otro.compania &&
                 vin !== '' && otroVin !== '' &&
                 vin !== otroVin) {
          if (!polizasVinDistinto.find(d => d.id === exp.id)) {
            polizasVinDistinto.push({ id: exp.id, poliza: exp.numero_poliza, vin });
          }
          if (!polizasVinDistinto.find(d => d.id === otro.id)) {
            polizasVinDistinto.push({ id: otro.id, poliza: otro.numero_poliza, vin: otroVin });
          }
        }
      });
    });

    return { polizasDuplicadas, vinsDuplicados, polizasVinDistinto };
  }, [expedientes]);

  return (
    <div className="p-3">
      {/* Estilos globales para normalizar fuentes */}
      <style>{`
        .table-sm { font-size: 0.875rem !important; }
        .table-sm small { font-size: 0.75rem !important; }
        .table-sm .badge { font-size: 0.75rem !important; }
        .table-sm .text-muted { font-size: 0.75rem !important; }
      `}</style>
      
      {/* Header Compacto */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Gestión de Pólizas</h4>
      </div>

      {/* Carpetas en Grid Responsive */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'todas' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('todas')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>📋 Todas</span>
              <span className="badge bg-white text-dark">{contadores.todas}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'en_proceso' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('en_proceso')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>📝 En Proceso</span>
              <span className="badge bg-secondary">{contadores.en_proceso}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'vigentes' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setCarpetaSeleccionada('vigentes')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>✅ Vigentes</span>
              <span className={`badge ${carpetaSeleccionada === 'vigentes' ? 'bg-white text-success' : 'bg-success text-white'}`}>{contadores.vigentes}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'renovadas' ? 'btn-info' : 'btn-outline-info'}`}
            onClick={() => setCarpetaSeleccionada('renovadas')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>🔄 Renovadas</span>
              <span className={`badge ${carpetaSeleccionada === 'renovadas' ? 'bg-white text-info' : 'bg-info text-white'}`}>{contadores.renovadas}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'por_renovar' ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={() => setCarpetaSeleccionada('por_renovar')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>⏰ Por Renovar</span>
              <span className={`badge ${carpetaSeleccionada === 'por_renovar' ? 'bg-white text-warning' : 'bg-warning text-white'}`}>{contadores.por_renovar}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'en_proceso_renovacion' ? 'btn-orange text-white' : 'btn-outline-warning'}`}
            onClick={() => setCarpetaSeleccionada('en_proceso_renovacion')}
            style={carpetaSeleccionada === 'en_proceso_renovacion' ? { backgroundColor: '#fd7e14', borderColor: '#fd7e14' } : { borderColor: '#fd7e14', color: '#fd7e14' }}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>📋 En Proceso Renov.</span>
              <span className={`badge ${carpetaSeleccionada === 'en_proceso_renovacion' ? 'bg-white text-dark' : 'text-white'}`} style={carpetaSeleccionada !== 'en_proceso_renovacion' ? { backgroundColor: '#fd7e14' } : {}}>{contadores.en_proceso_renovacion}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'vencidas' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setCarpetaSeleccionada('vencidas')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>⚠️ Vencidas</span>
              <span className={`badge ${carpetaSeleccionada === 'vencidas' ? 'bg-white text-danger' : 'bg-danger text-white'}`}>{contadores.vencidas}</span>
            </div>
          </button>
        </div>
        <div className="col-6 col-md-4 col-lg-3">
          <button
            className={`btn btn-sm w-100 ${carpetaSeleccionada === 'canceladas' ? 'btn-secondary' : 'btn-outline-secondary'}`}
            onClick={() => setCarpetaSeleccionada('canceladas')}
          >
            <div className="d-flex justify-content-between align-items-center">
              <span>🚫 Canceladas</span>
              <span className={`badge ${carpetaSeleccionada === 'canceladas' ? 'bg-white text-dark' : 'bg-secondary text-white'}`}>{contadores.canceladas}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Alertas de duplicados */}
      {(analisisDuplicados.polizasDuplicadas.length > 0 || 
        analisisDuplicados.vinsDuplicados.length > 0 || 
        analisisDuplicados.polizasVinDistinto.length > 0) && (
        <div className="mb-3">
          {analisisDuplicados.polizasDuplicadas.length > 0 && (
            <div className="alert alert-warning mb-2" role="alert">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Pólizas Duplicadas:</strong> {analisisDuplicados.polizasDuplicadas.length} registro(s) con misma póliza y mismo VIN
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver pólizas duplicadas
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.polizasDuplicadas.forEach(d => {
                      const clave = `${d.poliza}-${d.vin}`;
                      if (!grupos[clave]) grupos[clave] = [];
                      grupos[clave].push(d);
                    });
                    return Object.entries(grupos).map(([clave, items]) => (
                      <li key={clave} className="mb-1">
                        <strong>Póliza: {items[0].poliza}</strong> | VIN: {items[0].vin} 
                        <span className="text-muted"> ({items.length} registros)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
          {analisisDuplicados.vinsDuplicados.length > 0 && (
            <div className="alert alert-warning mb-2" role="alert" style={{borderLeft: '4px solid #fd7e14'}}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ VINs Duplicados:</strong> {analisisDuplicados.vinsDuplicados.length} registro(s) con VIN repetido en diferentes pólizas
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver VINs duplicados - revisar
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.vinsDuplicados.forEach(d => {
                      if (!grupos[d.vin]) grupos[d.vin] = [];
                      grupos[d.vin].push(d);
                    });
                    return Object.entries(grupos).map(([vin, items]) => (
                      <li key={vin} className="mb-1">
                        <strong>VIN: {vin}</strong> aparece en pólizas: {items.map(i => i.poliza).join(', ')}
                        <span className="text-muted"> ({items.length} pólizas)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
          {analisisDuplicados.polizasVinDistinto.length > 0 && (
            <div className="alert alert-danger mb-2" role="alert">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>⚠️ Pólizas con VIN Distinto:</strong> {analisisDuplicados.polizasVinDistinto.length} registro(s) con mismo número de póliza pero VIN diferente
                </div>
              </div>
              <details className="mt-2">
                <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
                  Ver pólizas con VIN distinto - revisar urgente
                </summary>
                <ul className="mt-2 mb-0" style={{fontSize: '0.9rem'}}>
                  {(() => {
                    const grupos = {};
                    analisisDuplicados.polizasVinDistinto.forEach(d => {
                      if (!grupos[d.poliza]) grupos[d.poliza] = [];
                      grupos[d.poliza].push(d);
                    });
                    return Object.entries(grupos).map(([poliza, items]) => (
                      <li key={poliza} className="mb-1">
                        <strong>Póliza: {poliza}</strong> tiene VINs: {items.map(i => i.vin).join(', ')}
                        <span className="text-muted"> ({items.length} VINs diferentes)</span>
                      </li>
                    ));
                  })()}
                </ul>
              </details>
            </div>
          )}
        </div>
      )}

      {expedientes.length > 0 && (
        <div className="row mb-3 g-2">
          <div className="col-12 col-md-8">
            <BarraBusqueda 
              busqueda={paginacion.busqueda}
              setBusqueda={(valor) => {
                // Si el usuario empieza a buscar, cambiar a "Todas" para buscar en toda la cartera
                if (valor && valor.trim() !== '' && carpetaSeleccionada !== 'todas') {
                  setCarpetaSeleccionada('todas');
                }
                paginacion.setBusqueda(valor);
              }}
              placeholder="Buscar pólizas..."
            />
          </div>
          <div className="col-12 col-md-4 text-md-end">
            <small className="text-muted d-block mt-2 mt-md-0">
              Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} pólizas
            </small>
          </div>
        </div>
      )}

      <div className="card">
        {expedientes.length === 0 ? (
          <div className="card-body text-center py-5">
            <FileText size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No hay pólizas registradas</h5>
            <p className="text-muted">Crea tu primera póliza para comenzar</p>
          </div>
        ) : paginacion.itemsPaginados.length === 0 ? (
          <div className="card-body text-center py-5">
            <Search size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No se encontraron resultados</h5>
            <p className="text-muted">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <>
            {/* Vista Desktop - Tabla */}
            <div className="table-responsive d-none d-lg-block">
              <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.875rem' }}>
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '100px', verticalAlign: 'middle', textAlign: 'center' }}>Póliza</th>
                    <th style={{ width: '240px', verticalAlign: 'middle', textAlign: 'center' }}>Cliente</th>
                    <th style={{ width: '100px', verticalAlign: 'middle', textAlign: 'center' }}>Compañía</th>
                    <th style={{ width: '210px', verticalAlign: 'middle', textAlign: 'center' }}>Producto</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>
                      <div>Etapa</div>
                      <div>Activa</div>
                    </th>
                    <th style={{ width: '130px', verticalAlign: 'middle', textAlign: 'center' }}>Agente</th>
                    <th style={{ width: '200px', textAlign: 'center' }}>
                      <div>Estatus Pago</div>
                      <div>y Progreso</div>
                    </th>
                    <th style={{ width: '100px', textAlign: 'center' }}>
                      <div>Vigencia</div>
                      <div>Pago</div>
                    </th>
                    <th width="150" style={{ verticalAlign: 'middle', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacion.itemsPaginados.map((expediente) => {
                    // Extraer clave del agente del campo expediente.agente
                    const claveAgenteExpediente = expediente.agente ? expediente.agente.split('-')[0].trim() : '';
                    const agenteInfo = agentes.find(a => a.codigoAgente === claveAgenteExpediente);
                    
                    // Detectar tipo de duplicado para este expediente
                    const esDuplicadaCompleta = analisisDuplicados.polizasDuplicadas.find(d => d.id === expediente.id);
                    const esVinDuplicado = analisisDuplicados.vinsDuplicados.find(d => d.id === expediente.id);
                    const esPolizaVinDistinto = analisisDuplicados.polizasVinDistinto.find(d => d.id === expediente.id);
                    
                    return (
                      <tr key={expediente.id} style={{ verticalAlign: 'middle' }}>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div>
                            <strong className="text-primary">{expediente.numero_poliza || '-'}</strong>
                            {esDuplicadaCompleta && (
                              <div>
                                <span className="badge bg-warning text-dark" title="Póliza duplicada (misma póliza + mismo VIN)">
                                  ⚠️ Duplicada
                                </span>
                              </div>
                            )}
                            {esVinDuplicado && (
                              <div>
                                <span className="badge" style={{ backgroundColor: '#fd7e14', color: 'white' }} title="VIN duplicado en otra póliza - Revisar">
                                  ⚠️ VIN Duplicado
                                </span>
                              </div>
                            )}
                            {esPolizaVinDistinto && (
                              <div>
                                <span className="badge bg-danger" title="Mismo número de póliza con VIN diferente - Revisar urgente">
                                  ⚠️ Póliza VIN Distinto
                                </span>
                              </div>
                            )}
                            {expediente.endoso && (
                              <div><small className="text-muted">End: {expediente.endoso}</small></div>
                            )}
                            {expediente.inciso && (
                              <div><small className="text-muted">Inc: {expediente.inciso}</small></div>
                            )}
                            {/* Fechas de captura y emisión */}
                            <div style={{ marginTop: '4px', fontSize: '0.7rem', lineHeight: '1.3' }}>
                              {expediente.created_at && (
                                <div>
                                  <div className="text-muted">Captura</div>
                                  <div>{utils.formatearFecha(expediente.created_at, 'cortaY')}</div>
                                </div>
                              )}
                              {expediente.fecha_emision && (
                                <div style={{ marginTop: '2px' }}>
                                  <div className="text-muted">Emisión</div>
                                  <div>{utils.formatearFecha(expediente.fecha_emision, 'cortaY')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td><InfoCliente expediente={expediente} cliente={clientesMap[expediente.cliente_id]} /></td>
                        <td style={{ textAlign: 'center' }}>{expediente.compania}</td>
                        <td style={{ fontSize: '0.7rem' }}>
                          <div>
                            <strong>{expediente.producto}</strong>
                            {(expediente.producto === 'Autos' || expediente.producto?.includes('Autos') || expediente.producto?.includes('Auto')) && (
                              <>
                                {expediente.tipo_cobertura && (
                                  <div className="text-muted">
                                    {expediente.tipo_cobertura}
                                  </div>
                                )}
                                {(expediente.marca || expediente.modelo) && (
                                  <div>
                                    {expediente.marca} {expediente.modelo}
                                  </div>
                                )}
                                {(expediente.anio || expediente.numero_serie) && (
                                  <div className="text-muted">
                                    {expediente.anio && <>Año: {expediente.anio}</>}
                                    {expediente.anio && expediente.numero_serie && <> | </>}
                                    {expediente.numero_serie && <>VIN: {expediente.numero_serie}</>}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.7rem' }}>
                          <Badge tipo="etapa" valor={calcularEtapaReal(expediente)} />
                          {expediente.motivoCancelacion && (
                            <div><small className="text-muted">Motivo: {expediente.motivoCancelacion}</small></div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: '1.3' }}>
                          {(() => {
                            const vendedorInfo = (expediente.vendedor_id && vendedoresMap) ? vendedoresMap[expediente.vendedor_id] : null;
                            let claveAgente = '';
                            let nombreAgente = '';
                            let apellidoAgente = '';
                            let nombreVendedor = '';
                            let apellidoVendedor = '';
                            
                            // Obtener información del agente
                            if (agenteInfo) {
                              claveAgente = agenteInfo.codigoAgente || '';
                              const nombreCompleto = (agenteInfo.nombre || '').trim();
                              nombreAgente = nombreCompleto.split(/\s+/)[0] || '';
                              apellidoAgente = agenteInfo.apellidoPaterno || '';
                            } else if (expediente.agente) {
                              const textoAgente = expediente.agente || '';
                              const partes = textoAgente.split('-');
                              if (partes.length >= 2) {
                                claveAgente = partes[0].trim();
                                const nombreCompleto = partes.slice(1).join('-').trim();
                                const palabras = nombreCompleto.split(/\s+/);
                                nombreAgente = palabras[0] || '';
                                // Para "CESAR PAUL MENDOZA GARCIA" -> tomar penúltimo (MENDOZA)
                                // Para "CESAR MENDOZA" -> tomar último (MENDOZA)
                                apellidoAgente = palabras.length >= 3 ? palabras[palabras.length - 2] : (palabras[palabras.length - 1] || '');
                              } else {
                                claveAgente = textoAgente;
                              }
                            }
                            
                            // Obtener información del vendedor
                            if (vendedorInfo) {
                              const nombreCompletoVendedor = (vendedorInfo.nombre || '').trim();
                              nombreVendedor = nombreCompletoVendedor.split(/\s+/)[0] || '';
                              apellidoVendedor = vendedorInfo.apellidoPaterno || '';
                            } else if (expediente.sub_agente) {
                              // Fallback: usar sub_agente como texto
                              const textoVendedor = (expediente.sub_agente || '').trim();
                              const palabras = textoVendedor.split(/\s+/);
                              // Si tiene 3+ palabras: primeras 2 como nombre, última como apellido
                              // Ejemplo: "mariana sanchez torres" → nombre: "mariana sanchez", apellido: "torres"
                              if (palabras.length >= 3) {
                                nombreVendedor = palabras.slice(0, 2).join(' ');
                                apellidoVendedor = palabras[palabras.length - 1];
                              } else if (palabras.length === 2) {
                                nombreVendedor = palabras[0];
                                apellidoVendedor = palabras[1];
                              } else {
                                nombreVendedor = palabras[0] || '';
                                apellidoVendedor = '';
                              }
                            }
                            
                            return (
                              <div>
                                <div><strong>{claveAgente || '-'}</strong></div>
                                {nombreAgente && <div style={{ fontSize: '0.65rem' }}>{nombreAgente} {apellidoAgente}</div>}
                                {nombreVendedor && (
                                  <div style={{ fontSize: '0.65rem', color: '#6c757d', marginTop: '2px' }}>
                                    V: {nombreVendedor} {apellidoVendedor}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div>
                            {/* Tipo y Estatus de Pago - Ya incluye progreso X/X */}
                            <EstadoPago expediente={expediente} />
                          </div>
                        </td>
                        <td style={{ fontSize: '0.7rem', lineHeight: '1.4', textAlign: 'center' }}>
                          <div>
                            {expediente.inicio_vigencia ? utils.formatearFecha(expediente.inicio_vigencia, 'cortaY') : '-'}
                          </div>
                          <div>
                            {expediente.termino_vigencia ? utils.formatearFecha(expediente.termino_vigencia, 'cortaY') : '-'}
                          </div>
                          <div className="fw-semibold" style={{ marginTop: '2px', color: '#f59e0b' }}>
                            {(() => {
                              // 🎯 PRIORIDAD: Consultar directamente los recibos si están disponibles
                              if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
                                // Buscar el primer recibo sin pago (ordenados por número)
                                const proximoReciboPendiente = expediente.recibos
                                  .filter(r => !r.fecha_pago_real)
                                  .sort((a, b) => a.numero_recibo - b.numero_recibo)[0];
                                
                                if (proximoReciboPendiente?.fecha_vencimiento) {
                                  return utils.formatearFecha(proximoReciboPendiente.fecha_vencimiento, 'cortaY');
                                }
                                
                                // Si no hay recibos pendientes, mostrar que están todos pagados
                                return '✓ Pagado';
                              }
                              
                              // FALLBACK: Usar campo del expediente si no hay recibos
                              return expediente.fecha_vencimiento_pago ? utils.formatearFecha(expediente.fecha_vencimiento_pago, 'cortaY') : 
                                     expediente.proximoPago ? utils.formatearFecha(expediente.proximoPago, 'cortaY') :
                                     expediente.fecha_pago ? utils.formatearFecha(expediente.fecha_pago, 'cortaY') : '-';
                            })()}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxWidth: '120px' }}>
                            {/* === BOTÓN INICIAR RENOVACIÓN (carpeta Por Renovar) === */}
                            {(() => {
                              // Solo mostrar en carpeta "por_renovar"
                              if (carpetaSeleccionada !== 'por_renovar') return null;
                              
                              const etapaActual = (expediente.etapa_activa || '').toLowerCase();
                              
                              // No mostrar si ya inició proceso de renovación
                              if (etapaActual.includes('cotización') || 
                                  etapaActual.includes('enviada') || 
                                  etapaActual.includes('pendiente de emisión')) {
                                return null;
                              }
                              
                              return (
                                <button
                                  onClick={() => iniciarRenovacion(expediente)}
                                  className="btn btn-warning btn-sm"
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                  title="Iniciar Renovación"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              );
                            })()}
                            
                            {/* === BOTONES FLUJO DE RENOVACIÓN (carpeta En Proceso Renovación) === */}
                            {(() => {
                              // Solo mostrar en carpeta "en_proceso_renovacion"
                              if (carpetaSeleccionada !== 'en_proceso_renovacion') return null;
                              
                              const etapaActual = expediente.etapa_activa || '';
                              
                              // FLUJO: En Cotización → Cotización Lista → Cotización Enviada → Por Emitir → Cargar Póliza
                              // NOTA: Puede cargar N cotizaciones y compartir N veces durante el proceso
                              
                              // 1. Botón CARGAR COTIZACIÓN: Disponible en todas las etapas del proceso (puede cargar N cotizaciones)
                              const puedeCargarCotizacion = ['En Cotización - Renovación', 'Cotización Lista', 'Cotización Enviada'].includes(etapaActual);
                              
                              // 2. Botón COMPARTIR: Disponible en "Cotización Lista" y "Cotización Enviada"
                              //    - En "Cotización Lista": cambia etapa a "Cotización Enviada"
                              //    - En "Cotización Enviada": puede compartir N veces sin cambiar etapa
                              const puedeCompartir = etapaActual === 'Cotización Lista' || etapaActual === 'Cotización Enviada';
                              
                              // 3. Botón AUTORIZAR: "Cotización Enviada" → "Por Emitir - Renovación"
                              const puedeAutorizar = etapaActual === 'Cotización Enviada';
                              
                              // 4. Botón CARGAR PÓLIZA: "Por Emitir - Renovación" → Crear nuevo expediente
                              const puedeCargarPoliza = etapaActual === 'Por Emitir - Renovación';
                              
                              return (
                                <>
                                  {puedeCargarCotizacion && (
                                    <button
                                      onClick={() => cargarCotizacion(expediente)}
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Cargar Cotización"
                                    >
                                      <FileText size={12} />
                                    </button>
                                  )}
                                  
                                  {puedeCompartir && (
                                    <button
                                      onClick={() => enviarCotizacionCliente(expediente)}
                                      className="btn btn-info btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Compartir Cotización (WhatsApp/Email)"
                                    >
                                      <Share2 size={12} />
                                    </button>
                                  )}
                                  
                                  {puedeAutorizar && (
                                    <button
                                      onClick={() => marcarRenovacionAutorizada(expediente)}
                                      className="btn btn-success btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Cliente Autoriza"
                                    >
                                      <CheckCircle size={12} />
                                    </button>
                                  )}
                                  
                                  {puedeCargarPoliza && (
                                    <button
                                      onClick={() => abrirModalPolizaRenovada(expediente)}
                                      className="btn btn-warning btn-sm"
                                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                      title="Cargar Póliza Renovada"
                                    >
                                      <Upload size={12} />
                                    </button>
                                  )}
                                </>
                              );
                            })()}

                            {/* Botón Compartir - Ocultar en Por Renovar y En Proceso Renovación */}
                            {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (
                              <button
                                onClick={() => abrirModalCompartir(expediente)}
                                className="btn btn-success btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                title="Compartir"
                              >
                                <Share2 size={12} />
                              </button>
                            )}

                            {/* Botón Pago - Ocultar en Por Renovar y En Proceso Renovación */}
                            {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (() => {
                              // ✅ El botón de pago debe estar disponible independientemente de la etapa
                              // Solo se oculta si ya está pagado o si la póliza está cancelada
                              const etapaValida = expediente.etapa_activa !== 'Cancelada';
                              
                              // ✅ Verificar estatus_pago tanto en camelCase como snake_case
                              const estatusPagoDB = (expediente.estatus_pago || '').toLowerCase().trim();
                              const estatusPagoNorm = (expediente.estatusPago || '').toLowerCase().trim();
                              
                              // 🔥 Para pagos fraccionados, verificar si hay pagos pendientes usando contador directo
                              const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
                              let tienePagosPendientes = false;
                              
                              if (esFraccionado && (expediente.frecuenciaPago || expediente.frecuencia_pago)) {
                                const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
                                const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                                const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
                                
                                // Si no ha completado todos los pagos, tiene pendientes
                                tienePagosPendientes = pagosRealizados < numeroPagos;
                              }
                              
                              // ✅ CRÍTICO: No mostrar botón si el pago YA está aplicado (preservar integridad financiera)
                              // Para fraccionados: mostrar si tiene pagos pendientes
                              // Para pago único: mostrar si no está pagado
                              const noPagado = esFraccionado 
                                ? tienePagosPendientes
                                : (estatusPagoDB !== 'pagado' && estatusPagoNorm !== 'pagado');
                              
                              return etapaValida && noPagado ? (
                                <button
                                  onClick={() => aplicarPago(expediente.id)}
                                  className="btn btn-success btn-sm"
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                  title="Aplicar Pago"
                                >
                                  <DollarSign size={12} />
                                </button>
                              ) : null;
                            })()}
                            
                            {/* Botón Cancelar - Ocultar en Por Renovar y En Proceso Renovación */}
                            {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && expediente.etapa_activa !== 'Cancelada' && (
                              <button
                                onClick={() => iniciarCancelacion(expediente)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                title="Cancelar Póliza"
                              >
                                <XCircle size={12} />
                              </button>
                            )}
                            
                            <button
                              onClick={() => verDetalles(expediente)}
                              className="btn btn-outline-primary btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Ver detalles"
                            >
                              <Eye size={12} />
                            </button>
                            
                            {/* Botón Editar - Ocultar en Por Renovar y En Proceso Renovación */}
                            {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (
                              <button
                                onClick={() => editarExpediente(expediente)}
                                className="btn btn-outline-secondary btn-sm"
                                style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                title="Editar"
                              >
                                <Edit size={12} />
                              </button>
                            )}
                            
                            {/* Botón Eliminar - Siempre visible para pruebas */}
                            <button
                              onClick={() => eliminarExpediente(expediente.id)}
                              className="btn btn-outline-danger btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                              title="Eliminar"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista Móvil - Cards */}
            <div className="d-lg-none p-3">
              {paginacion.itemsPaginados.map((expediente) => {
                // Extraer clave del agente del campo expediente.agente
                const claveAgenteExpediente = expediente.agente ? expediente.agente.split('-')[0].trim() : '';
                const agenteInfo = agentes.find(a => a.codigoAgente === claveAgenteExpediente);
                const vendedorInfo = (expediente.vendedor_id && vendedoresMap) ? vendedoresMap[expediente.vendedor_id] : null;
                const esDuplicadaCompleta = analisisDuplicados.polizasDuplicadas.find(d => d.id === expediente.id);
                const esVinDuplicado = analisisDuplicados.vinsDuplicados.find(d => d.id === expediente.id);
                const esPolizaVinDistinto = analisisDuplicados.polizasVinDistinto.find(d => d.id === expediente.id);
                
                return (
                  <div key={expediente.id} className="card mb-3 shadow-sm">
                    <div className="card-body p-3">
                      {/* Header - Número de Póliza */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h6 className="mb-1">
                            <strong className="text-primary">{expediente.numero_poliza || 'Sin número'}</strong>
                          </h6>
                          {(expediente.endoso || expediente.inciso) && (
                            <small className="text-muted">
                              {expediente.endoso && `End: ${expediente.endoso}`}
                              {expediente.endoso && expediente.inciso && ' | '}
                              {expediente.inciso && `Inc: ${expediente.inciso}`}
                            </small>
                          )}
                        </div>
                        <Badge tipo="etapa" valor={calcularEtapaReal(expediente)} />
                      </div>

                      {/* Alertas de duplicados */}
                      {(esDuplicadaCompleta || esVinDuplicado || esPolizaVinDistinto) && (
                        <div className="mb-2">
                          {esDuplicadaCompleta && (
                            <span className="badge bg-warning text-dark me-1" style={{ fontSize: '0.7rem' }}>
                              ⚠️ Duplicada
                            </span>
                          )}
                          {esVinDuplicado && (
                            <span className="badge me-1" style={{ fontSize: '0.7rem', backgroundColor: '#fd7e14', color: 'white' }}>
                              ⚠️ VIN Duplicado
                            </span>
                          )}
                          {esPolizaVinDistinto && (
                            <span className="badge bg-danger" style={{ fontSize: '0.7rem' }}>
                              ⚠️ Póliza VIN Distinto
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cliente */}
                      <div className="mb-2 pb-2 border-bottom">
                        <small className="text-muted d-block">Cliente</small>
                        <InfoCliente expediente={expediente} cliente={clientesMap[expediente.cliente_id]} />
                      </div>

                      {/* Compañía y Producto */}
                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <small className="text-muted d-block">Compañía</small>
                          <strong style={{ fontSize: '0.875rem' }}>{expediente.compania}</strong>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Producto</small>
                          <strong style={{ fontSize: '0.875rem' }}>{expediente.producto}</strong>
                          {(expediente.producto === 'Autos' || expediente.producto?.includes('Autos') || expediente.producto?.includes('Auto')) && (
                            <>
                              {expediente.tipo_cobertura && (
                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                  {expediente.tipo_cobertura}
                                </div>
                              )}
                              {(expediente.marca || expediente.modelo) && (
                                <div style={{ fontSize: '0.75rem' }}>
                                  {expediente.marca} {expediente.modelo}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Agente */}
                      {expediente.agente && (
                        <div className="mb-2">
                          <small className="text-muted d-block">Agente</small>
                          {(() => {
                            let claveAgente = '';
                            let nombreAgente = '';
                            let apellidoAgente = '';
                            let nombreVendedor = '';
                            let apellidoVendedor = '';
                            
                            // Obtener información del agente
                            if (agenteInfo) {
                              claveAgente = agenteInfo.codigoAgente || '';
                              const nombreCompleto = (agenteInfo.nombre || '').trim();
                              nombreAgente = nombreCompleto.split(/\s+/)[0] || '';
                              apellidoAgente = agenteInfo.apellidoPaterno || '';
                            } else if (expediente.agente) {
                              const textoAgente = expediente.agente || '';
                              const partes = textoAgente.split('-');
                              if (partes.length >= 2) {
                                claveAgente = partes[0].trim();
                                const nombreCompleto = partes.slice(1).join('-').trim();
                                const palabras = nombreCompleto.split(/\s+/);
                                nombreAgente = palabras[0] || '';
                                // Para "CESAR PAUL MENDOZA GARCIA" -> tomar penúltimo (MENDOZA)
                                // Para "CESAR MENDOZA" -> tomar último (MENDOZA)
                                apellidoAgente = palabras.length >= 3 ? palabras[palabras.length - 2] : (palabras[palabras.length - 1] || '');
                              } else {
                                claveAgente = textoAgente;
                              }
                            }
                            
                            // Obtener información del vendedor
                            if (vendedorInfo) {
                              const nombreCompletoVendedor = (vendedorInfo.nombre || '').trim();
                              nombreVendedor = nombreCompletoVendedor.split(/\s+/)[0] || '';
                              apellidoVendedor = vendedorInfo.apellidoPaterno || '';
                            } else if (expediente.sub_agente) {
                              // Fallback: usar sub_agente como texto
                              const textoVendedor = (expediente.sub_agente || '').trim();
                              const palabras = textoVendedor.split(/\s+/);
                              // Si tiene 3+ palabras: primeras 2 como nombre, última como apellido
                              if (palabras.length >= 3) {
                                nombreVendedor = palabras.slice(0, 2).join(' ');
                                apellidoVendedor = palabras[palabras.length - 1];
                              } else if (palabras.length === 2) {
                                nombreVendedor = palabras[0];
                                apellidoVendedor = palabras[1];
                              } else {
                                nombreVendedor = palabras[0] || '';
                                apellidoVendedor = '';
                              }
                            }
                            
                            return (
                              <div>
                                <div style={{ fontSize: '0.875rem' }}><strong>{claveAgente || '-'}</strong></div>
                                {nombreAgente && <div style={{ fontSize: '0.75rem' }}>{nombreAgente} {apellidoAgente}</div>}
                                {nombreVendedor && (
                                  <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                    V: {nombreVendedor} {apellidoVendedor}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Estado de Pago */}
                      <div className="mb-2">
                        <small className="text-muted d-block">Estado de Pago</small>
                        <EstadoPago expediente={expediente} />
                        <CalendarioPagos 
                          expediente={expediente} 
                          calcularProximoPago={calcularProximoPago}
                          compacto={true}
                        />
                      </div>

                      {/* Vigencia */}
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <small className="text-muted d-block">Inicio Vigencia</small>
                          <span style={{ fontSize: '0.875rem' }}>
                            {expediente.inicio_vigencia ? utils.formatearFecha(expediente.inicio_vigencia, 'cortaY') : '-'}
                          </span>
                        </div>
                        <div className="col-6">
                          <small className="text-muted d-block">Fin Vigencia</small>
                          <span style={{ fontSize: '0.875rem' }}>
                            {expediente.termino_vigencia ? utils.formatearFecha(expediente.termino_vigencia, 'cortaY') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Fechas */}
                      {(expediente.created_at || expediente.fecha_emision) && (
                        <div className="mb-3" style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                          {expediente.created_at && (
                            <div>📝 Capturada: {utils.formatearFecha(expediente.created_at, 'cortaY')}</div>
                          )}
                          {expediente.fecha_emision && (
                            <div>📄 Emitida: {utils.formatearFecha(expediente.fecha_emision, 'cortaY')}</div>
                          )}
                        </div>
                      )}

                      {/* Botones de Acción */}
                      <div className="d-flex flex-wrap gap-2">
                        {/* === BOTÓN INICIAR RENOVACIÓN (carpeta Por Renovar o Vencidas) === */}
                        {(() => {
                          // Solo mostrar en carpetas de renovación
                          if (carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'vencidas') return null;
                          
                          const etapaActual = (expediente.etapa_activa || '').toLowerCase();
                          
                          // No mostrar si ya inició proceso de renovación
                          if (etapaActual.includes('cotización') || 
                              etapaActual.includes('enviada') || 
                              etapaActual.includes('pendiente de emisión') ||
                              etapaActual === 'renovada') {
                            return null;
                          }
                          
                          return (
                            <button
                              onClick={() => iniciarRenovacion(expediente)}
                              className="btn btn-warning btn-sm"
                              title="Iniciar Renovación"
                            >
                              <RefreshCw size={14} className="me-1" />
                              Renovar
                            </button>
                          );
                        })()}
                        
                        {/* === BOTONES FLUJO DE RENOVACIÓN (carpeta En Proceso Renovación) === */}
                        {(() => {
                          // Solo mostrar en carpeta "en_proceso_renovacion"
                          if (carpetaSeleccionada !== 'en_proceso_renovacion') return null;
                          
                          const etapaActual = expediente.etapa_activa || '';
                          
                          // 1. Botón CARGAR COTIZACIÓN
                          const puedeCargarCotizacion = ['En Cotización - Renovación', 'Cotización Lista', 'Cotización Enviada'].includes(etapaActual);
                          
                          // 2. Botón COMPARTIR
                          const puedeCompartir = etapaActual === 'Cotización Lista' || etapaActual === 'Cotización Enviada';
                          
                          // 3. Botón AUTORIZAR
                          const puedeAutorizar = etapaActual === 'Cotización Enviada';
                          
                          // 4. Botón CARGAR PÓLIZA
                          const puedeCargarPoliza = etapaActual === 'Por Emitir - Renovación';
                          
                          return (
                            <>
                              {puedeCargarCotizacion && (
                                <button
                                  onClick={() => cargarCotizacion(expediente)}
                                  className="btn btn-primary btn-sm"
                                  title="Cargar Cotización"
                                >
                                  <FileText size={14} className="me-1" />
                                  Cotización
                                </button>
                              )}
                              
                              {puedeCompartir && (
                                <button
                                  onClick={() => enviarCotizacionCliente(expediente)}
                                  className="btn btn-info btn-sm"
                                  title="Compartir Cotización"
                                >
                                  <Share2 size={14} className="me-1" />
                                  Enviar
                                </button>
                              )}
                              
                              {puedeAutorizar && (
                                <button
                                  onClick={() => marcarRenovacionAutorizada(expediente)}
                                  className="btn btn-success btn-sm"
                                  title="Cliente Autoriza"
                                >
                                  <CheckCircle size={14} className="me-1" />
                                  Autorizar
                                </button>
                              )}
                              
                              {puedeCargarPoliza && (
                                <button
                                  onClick={() => abrirModalPolizaRenovada(expediente)}
                                  className="btn btn-warning btn-sm"
                                  title="Cargar Póliza Renovada"
                                >
                                  <Upload size={14} className="me-1" />
                                  Póliza
                                </button>
                              )}
                            </>
                          );
                        })()}

                        {/* Botón Compartir - Ocultar en Por Renovar y En Proceso Renovación (igual que Desktop) */}
                        {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (
                          <button
                            onClick={() => abrirModalCompartir(expediente)}
                            className="btn btn-success btn-sm"
                            title="Compartir"
                          >
                            <Share2 size={14} className="me-1" />
                            Compartir
                          </button>
                        )}

                        {/* Botón Pago - Ocultar en Por Renovar y En Proceso Renovación (igual que Desktop) */}
                        {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (() => {
                          const etapaValida = expediente.etapa_activa !== 'Cancelada';
                          const estatusPagoDB = (expediente.estatus_pago || '').toLowerCase().trim();
                          const estatusPagoNorm = (expediente.estatusPago || '').toLowerCase().trim();
                          
                          // 🔥 Para pagos fraccionados, verificar si hay pagos pendientes
                          const esFraccionado = (expediente.tipo_pago === 'Fraccionado') || (expediente.forma_pago?.toUpperCase() === 'FRACCIONADO');
                          let tienePagosPendientes = false;
                          
                          if (esFraccionado && (expediente.frecuenciaPago || expediente.frecuencia_pago)) {
                            const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
                            const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
                            const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
                            
                            // Si no ha completado todos los pagos, tiene pendientes
                            tienePagosPendientes = pagosRealizados < numeroPagos;
                          }
                          
                          // Para fraccionados: mostrar si tiene pagos pendientes
                          // Para pago único: mostrar si no está pagado
                          const noPagado = esFraccionado 
                            ? tienePagosPendientes
                            : (estatusPagoDB !== 'pagado' && estatusPagoNorm !== 'pagado');
                          
                          return etapaValida && noPagado ? (
                            <button
                              onClick={() => aplicarPago(expediente.id)}
                              className="btn btn-success btn-sm"
                              title="Aplicar Pago"
                            >
                              <DollarSign size={14} className="me-1" />
                              Pagar
                            </button>
                          ) : null;
                        })()}

                        <button
                          onClick={() => verDetalles(expediente)}
                          className="btn btn-outline-primary btn-sm"
                          title="Ver detalles"
                        >
                          <Eye size={14} className="me-1" />
                          Ver
                        </button>
                        
                        {/* Botón Editar - Ocultar en Por Renovar y En Proceso Renovación (igual que Desktop) */}
                        {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && (
                          <button
                            onClick={() => editarExpediente(expediente)}
                            className="btn btn-outline-secondary btn-sm"
                            title="Editar"
                          >
                            <Edit size={14} className="me-1" />
                            Editar
                          </button>
                        )}

                        {/* Botón Cancelar - Ocultar en Por Renovar y En Proceso Renovación (igual que Desktop) */}
                        {carpetaSeleccionada !== 'por_renovar' && carpetaSeleccionada !== 'en_proceso_renovacion' && expediente.etapa_activa !== 'Cancelada' && (
                          <button
                            onClick={() => iniciarCancelacion(expediente)}
                            className="btn btn-danger btn-sm"
                            title="Cancelar Póliza"
                          >
                            <XCircle size={14} className="me-1" />
                            Cancelar
                          </button>
                        )}

                        <button
                          onClick={() => eliminarExpediente(expediente.id)}
                          className="btn btn-outline-danger btn-sm"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {paginacion.totalPaginas > 1 && (
              <div className="card-footer">
                <Paginacion 
                  paginaActual={paginacion.paginaActual}
                  totalPaginas={paginacion.totalPaginas}
                  setPaginaActual={paginacion.setPaginaActual}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Selección de Método de Captura */}
      {mostrarModalMetodoCaptura && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title w-100 text-center">
                  📋 Selecciona el Método de Captura
                </h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setMostrarModalMetodoCaptura(false)}
                ></button>
              </div>
              
              <div className="modal-body pt-2">
                <p className="text-center text-muted mb-4">
                  ¿Cómo deseas agregar la nueva póliza?
                </p>

                {/* Input file oculto para PDF */}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="pdfFileInput"
                  ref={(input) => {
                    if (input) {
                      input.onclick = () => {
                        // Guardar referencia para poder procesar el archivo después
                        window._pdfInputForExtractor = input;
                      };
                    }
                  }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'application/pdf') {
                      // Cerrar modal de selección
                      setMostrarModalMetodoCaptura(false);
                      // Cambiar a vista formulario
                      setVistaActual('formulario');
                      setModoEdicion(false);
                      limpiarFormulario();
                      // Guardar archivo y abrir el extractor directamente en modo automático
                      window._selectedPDFFile = file;
                      window._autoExtractorMode = true;
                      setTimeout(() => {
                        setMostrarExtractorPDF(true);
                      }, 100);
                    }
                    // NO resetear el input todavía
                  }}
                />

                <div className="row g-3">
                  {/* Opción Captura Manual */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary text-center p-3" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalMetodoCaptura(false);
                        setVistaActual('formulario');
                        setModoEdicion(false);
                        limpiarFormulario();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,110,253,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          ✍️
                        </div>
                        <h5 className="card-title text-primary mb-2">Captura Manual</h5>
                        <p className="card-text text-muted small mb-3">
                          Llena el formulario campo por campo
                        </p>
                        <button 
                          className="btn btn-primary w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalMetodoCaptura(false);
                            setVistaActual('formulario');
                            setModoEdicion(false);
                            limpiarFormulario();
                          }}
                        >
                          Captura Manual
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opción Extractor PDF */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-success text-center p-3" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        document.getElementById('pdfFileInput')?.click();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,135,84,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          📄
                        </div>
                        <h5 className="card-title text-success mb-2">Extractor PDF</h5>
                        <p className="card-text text-muted small mb-3">
                          Importa datos automáticamente desde el PDF
                        </p>
                        <button 
                          className="btn btn-success w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById('pdfFileInput')?.click();
                          }}
                        >
                          <Upload size={16} className="me-2" />
                          Importar PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-4 mb-0">
                  <small>
                    <strong>💡 Recomendación:</strong> Usa el extractor PDF para mayor velocidad y precisión. 
                    La captura manual es útil cuando no tienes el PDF de la póliza.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ListaExpedientes;



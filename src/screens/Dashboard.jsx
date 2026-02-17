import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CalendarioAgenda from '../components/dashboard/CalendarioAgenda';
const API_URL = import.meta.env.VITE_API_URL;
import { 
  Plus, FileText, AlertCircle, 
  RefreshCw, Send, CheckCircle, Clock, Edit,
  CreditCard, Calendar, TrendingUp, AlertTriangle,
  ArrowRight, Activity, Award, X, User, Shield, 
  Package, Paperclip, MessageSquare, CheckCircle2, 
  XCircle, Eye, UserCheck, Users, BarChart2, 
  Building2, Briefcase, FileCheck, Filter, Download
} from 'lucide-react';
const DashboardComponent = () => {
  const navigate = useNavigate();
  const [expedientes, setExpedientes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalDesglose, setModalDesglose] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const [paginaModal, setPaginaModal] = useState(1);
  const [modalActualParams, setModalActualParams] = useState(null); // Para recordar qué modal está abierto
  const [modalTramites, setModalTramites] = useState(null); // Modal para mostrar trámites filtrados
  const [tramiteSeleccionado, setTramiteSeleccionado] = useState(null); // Panel detalle de trámite
  const [modalEnviarEjecutivo, setModalEnviarEjecutivo] = useState(null); // Modal para enviar a ejecutivo
  const POLIZAS_POR_PAGINA = 20;

  // Resolver monto TOTAL de la póliza (para panel financiero - emitidas, por vencer, etc.)
  // Prioridad: total > prima_pagada > prima > monto
  const resolverMonto = (p) => {
    const n = Number(p?.total ?? p?.prima_pagada ?? p?.prima ?? p?.monto ?? 0);
    return isNaN(n) ? 0 : n;
  };

  // Resolver PRIMA NETA (para cálculo de comisiones)
  // Las comisiones se calculan sobre la prima neta, no sobre el total
  const resolverPrimaNeta = (p) => {
    const n = Number(p?.prima_neta ?? p?.prima ?? p?.total ?? 0);
    return isNaN(n) ? 0 : n;
  };

  // 🔥 Resolver MONTO REALMENTE PAGADO (para panel de pólizas pagadas)
  // - Pago Anual: si está pagado, cuenta el total completo
  // - Pago Fraccionado: suma solo los recibos con estatus "Pagado"
  const resolverMontoPagado = (p) => {
    const esFraccionado = (p?.tipo_pago === 'Fraccionado') || 
                          (p?.forma_pago?.toUpperCase() === 'FRACCIONADO');
    
    if (esFraccionado && Array.isArray(p?.recibos) && p.recibos.length > 0) {
      // Sumar solo los recibos pagados
      const sumaPagados = p.recibos
        .filter(r => {
          const estatus = (r.estatus_pago || r.estatus || r.status || '').toLowerCase();
          return estatus === 'pagado' || estatus === 'pagada';
        })
        .reduce((sum, r) => {
          const monto = Number(r.monto || r.importe || 0);
          return sum + (isNaN(monto) ? 0 : monto);
        }, 0);
      return sumaPagados;
    }
    
    // Pago Anual o sin recibos: devolver total si está pagado
    return resolverMonto(p);
  };

  // Helper para formatear fechas sin problemas de zona horaria
  const formatearFecha = (fechaStr, formato = 'completo') => {
    if (!fechaStr) return '';
    
    // Si ya es un objeto Date, convertir a string ISO primero
    if (fechaStr instanceof Date) {
      fechaStr = fechaStr.toISOString().split('T')[0];
    }
    
    // Convertir a string y extraer solo la parte de fecha (antes de T si existe)
    fechaStr = String(fechaStr).split('T')[0];
    
    // Parsear la fecha manualmente para evitar problemas de zona horaria
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr; // Si no es formato YYYY-MM-DD, devolver tal cual
    
    const [year, month, day] = partes.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return fechaStr;
    
    // Formato: dd/mm/yyyy
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // 🔥 OPTIMIZACIÓN: Cargar expedientes, clientes, recibos y trámites en paralelo
      const [resExpedientes, resClientes, resRecibos, resTramites] = await Promise.all([
        fetch(`${API_URL}/api/expedientes?t=${Date.now()}`),
        fetch(`${API_URL}/api/clientes?t=${Date.now()}`),
        fetch(`${API_URL}/api/recibos?t=${Date.now()}`),
        fetch(`${API_URL}/api/tramites?t=${Date.now()}`) // Cargar trámites
      ]);
      
      if (!resExpedientes.ok) {
        console.error('Error al cargar expedientes:', resExpedientes.status, resExpedientes.statusText);
        setExpedientes([]);
        return;
      }
      
      const expedientesData = await resExpedientes.json();
      const expedientesArray = Array.isArray(expedientesData) ? expedientesData : [];
      
      // Procesar recibos: agrupar por expediente_id
      let recibosPorExpediente = new Map();
      if (resRecibos.ok) {
        const recibosData = await resRecibos.json();
        const recibosArray = Array.isArray(recibosData) ? recibosData : (recibosData?.data || []);
        
        recibosArray.forEach(recibo => {
          // Convertir a string para asegurar match con exp.id
          const expId = String(recibo.expediente_id);
          if (!recibosPorExpediente.has(expId)) {
            recibosPorExpediente.set(expId, []);
          }
          recibosPorExpediente.get(expId).push(recibo);
        });
        console.log(`📋 Dashboard: ${recibosArray.length} recibos cargados para ${recibosPorExpediente.size} expedientes`);
      }
      
      // Si hay clientes disponibles, enriquecer los expedientes con datos del cliente
      let expedientesEnriquecidos = expedientesArray;
      
      if (resClientes.ok) {
        const clientesData = await resClientes.json();
        const clientesMap = new Map();
        
        if (Array.isArray(clientesData)) {
          clientesData.forEach(cliente => {
            clientesMap.set(cliente.id, cliente);
          });
        }
        
        // Enriquecer cada expediente con datos del cliente Y sus recibos
        expedientesEnriquecidos = expedientesArray.map(exp => {
          const recibos = recibosPorExpediente.get(String(exp.id)) || [];
          
          if (exp.cliente_id && clientesMap.has(exp.cliente_id)) {
            const cliente = clientesMap.get(exp.cliente_id);
            return {
              ...exp,
              recibos, // 🔥 Agregar recibos del expediente
              // Agregar campos del cliente para facilitar el acceso
              tipoPersona: cliente.tipoPersona || cliente.tipo_persona,
              razonSocial: cliente.razonSocial || cliente.razon_social,
              nombreComercial: cliente.nombreComercial || cliente.nombre_comercial,
              nombre: cliente.nombre,
              apellidoPaterno: cliente.apellidoPaterno || cliente.apellido_paterno,
              apellidoMaterno: cliente.apellidoMaterno || cliente.apellido_materno,
              email: cliente.email || cliente.contacto_email,
              telefonoMovil: cliente.telefonoMovil || cliente.telefono_movil || cliente.contacto_telefono_movil,
              telefonoFijo: cliente.telefonoFijo || cliente.telefono_fijo || cliente.contacto_telefono_fijo,
              rfc: cliente.rfc
            };
          }
          return { ...exp, recibos };
        });
      } else {
        // Sin clientes, solo agregar recibos
        expedientesEnriquecidos = expedientesArray.map(exp => ({
          ...exp,
          recibos: recibosPorExpediente.get(String(exp.id)) || []
        }));
      }
      
      setExpedientes(expedientesEnriquecidos);
      
      // 📋 Cargar trámites
      if (resTramites.ok) {
        const tramitesData = await resTramites.json();
        const tramitesArray = Array.isArray(tramitesData) ? tramitesData : (tramitesData?.data || []);
        
        // Transformar campos de snake_case a camelCase si es necesario
        const tramitesFormateados = tramitesArray.map(t => ({
          id: t.id,
          codigo: t.codigo,
          tipoTramite: t.tipoTramite || t.tipo_tramite,
          descripcion: t.descripcion,
          cliente: t.cliente,
          cliente_id: t.cliente_id,  // ✅ Agregar cliente_id
          expediente: t.expediente,
          expediente_id: t.expediente_id,  // ✅ Agregar expediente_id
          estatus: t.estatus,
          prioridad: t.prioridad,
          fechaInicio: t.fechaInicio || t.fecha_inicio,
          fechaLimite: t.fechaLimite || t.fecha_limite,
          responsable: t.responsable || t.ejecutivo_asignado,  // ✅ También ejecutivo_asignado
          ejecutivoAsignado: t.ejecutivo_asignado || t.responsable,
          departamento: t.departamento,
          observaciones: t.observaciones,
          fechaCreacion: t.fechaCreacion || t.created_at
        }));
        
        setTramites(tramitesFormateados);
        console.log(`📋 Dashboard: ${tramitesFormateados.length} trámites cargados`);
      } else {
        console.warn('No se pudieron cargar los trámites');
        setTramites([]);
      }
    } catch (e) {
      console.error('Fallo de red al cargar datos:', e);
      setExpedientes([]);
      setTramites([]);
    } finally {
      setCargando(false);
    }
  };

  const recargarDatos = () => cargarDatos();

  useEffect(() => {
    cargarDatos();
  }, []);

  // 🔄 Recargar datos cuando la ventana recupera el foco (ej: al regresar de otra pestaña)
  useEffect(() => {
    const handleFocus = async () => {
      console.log('🔄 Dashboard: Ventana recuperó foco, recargando datos...');
      await cargarDatos();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 🔄 Refrescar modal cuando cambien los expedientes (si hay uno abierto)
  useEffect(() => {
    if (modalActualParams && expedientes.length > 0) {
      console.log('🔄 Dashboard: Expedientes actualizados, refrescando modal...');
      abrirDesglose(modalActualParams.tipo, modalActualParams.periodo);
    }
  }, [expedientes]); // Se ejecuta cuando cambian los expedientes

  const abrirDesglose = (tipo, periodo = 'ambos') => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Calcular rangos
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
    
    // Rango "meses anteriores del año": desde enero hasta fin del mes anterior
    const inicioAnioActual = new Date(hoy.getFullYear(), 0, 1); // 1 de enero del año actual
    
    const estaEnRango = (fecha, inicio, fin) => {
      if (!fecha) return false;
      
      // Extraer solo la parte de fecha (sin hora) para evitar problemas de zona horaria
      const fechaStr = String(fecha).split('T')[0];
      const [year, month, day] = fechaStr.split('-').map(Number);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
      
      // Crear fecha en hora local
      const f = new Date(year, month - 1, day);
      f.setHours(0, 0, 0, 0);
      
      return f >= inicio && f <= fin;
    };

    let polizasFiltradas = [];
    let titulo = '';
    let color = '#3B82F6';
    let periodoTexto = periodo === 'mesActual' ? 'Mes Actual' : periodo === 'mesAnterior' ? 'Meses Anteriores' : 'Mes Actual + Anterior';

    switch (tipo) {
      case 'emitidas':
        // Filtrar TODAS las pólizas emitidas (sin excluir canceladas)
        polizasFiltradas = expedientes.filter(p => {
          // Usar fecha_emision o fecha_captura como fallback
          const fechaReferencia = p.fecha_emision || p.fecha_captura || p.created_at;
          if (!fechaReferencia) return false;
          
          if (periodo === 'mesActual') return estaEnRango(fechaReferencia, inicioMesActual, finMesActual);
          if (periodo === 'mesAnterior') return estaEnRango(fechaReferencia, inicioMesAnterior, finMesAnterior);
          return estaEnRango(fechaReferencia, inicioMesAnterior, finMesActual);
        });
        titulo = `Pólizas Emitidas - ${periodoTexto}`;
        color = '#3B82F6';
        break;
      case 'pagadas':
        // 🔥 NUEVA LÓGICA: Mostrar recibos con fecha_pago_real en el periodo
        {
          const recibosPagados = expedientes.flatMap(p => {
            if (!Array.isArray(p.recibos) || p.recibos.length === 0) {
              // Póliza sin recibos: verificar si tiene fecha_pago
              if (p.fecha_pago) {
                let incluir = false;
                if (periodo === 'mesActual') {
                  incluir = estaEnRango(p.fecha_pago, inicioMesActual, finMesActual);
                } else if (periodo === 'mesAnterior') {
                  incluir = estaEnRango(p.fecha_pago, inicioMesAnterior, finMesAnterior);
                } else {
                  incluir = estaEnRango(p.fecha_pago, inicioMesAnterior, finMesActual);
                }
                if (incluir) {
                  return [{
                    ...p,
                    _esRecibo: true,
                    monto: resolverMonto(p)
                  }];
                }
              }
              return [];
            }
            // Filtrar recibos con fecha_pago_real en el periodo
            return p.recibos
              .filter(r => {
                if (!r.fecha_pago_real) return false;
                
                if (periodo === 'mesActual') {
                  return estaEnRango(r.fecha_pago_real, inicioMesActual, finMesActual);
                } else if (periodo === 'mesAnterior') {
                  return estaEnRango(r.fecha_pago_real, inicioMesAnterior, finMesAnterior);
                }
                return estaEnRango(r.fecha_pago_real, inicioMesAnterior, finMesActual);
              })
              .map(r => ({
                ...p,
                _esRecibo: true,
                _reciboNumero: r.numero_recibo,
                _totalRecibos: p.recibos?.length || 1,
                // Usar el estatus del recibo, o "Pagado" si tiene fecha_pago_real
                estatus_pago: r.fecha_pago_real ? 'Pagado' : (r.estatus_pago || r.estatus || 'Pendiente'),
                monto: Number(r.monto || r.importe || 0),
                fecha_pago: r.fecha_pago_real
              }));
          });
          polizasFiltradas = recibosPagados;
        }
        titulo = `Recibos Pagados - ${periodoTexto}`;
        color = '#10B981';
        break;
      case 'porVencer':
        // 🔥 NUEVA LÓGICA: Mostrar TODOS los recibos con estatus "Por Vencer" sin importar fecha
        {
          const hoyPV = new Date();
          hoyPV.setHours(0, 0, 0, 0);
          const en15Dias = new Date(hoyPV);
          en15Dias.setDate(en15Dias.getDate() + 15);
          
          const recibosPorVencer = expedientes.flatMap(p => {
            if (!Array.isArray(p.recibos) || p.recibos.length === 0) {
              // Póliza sin recibos: verificar estatus de la póliza
              const estatus = (p.estatus_pago || p.estatusPago || '').toLowerCase();
              if (estatus === 'por vencer' || estatus === 'pago por vencer') {
                return [{
                  ...p,
                  _esRecibo: true,
                  monto: resolverMonto(p)
                }];
              }
              return [];
            }
            // Filtrar recibos por vencer
            // Criterio: estatus = 'Por vencer' O (no pagado, no vencido, y vence en los próximos 15 días)
            return p.recibos
              .filter(r => {
                // Si ya está pagado, no cuenta
                if (r.fecha_pago_real) return false;
                
                const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
                if (estatus === 'por vencer' || estatus === 'pago por vencer') return true;
                
                // Fallback: calcular por fecha si no tiene estatus
                if (r.fecha_vencimiento) {
                  const fechaVenc = new Date(r.fecha_vencimiento);
                  fechaVenc.setHours(0, 0, 0, 0);
                  // No está vencido (fecha >= hoy) y vence pronto (fecha <= hoy+15)
                  return fechaVenc >= hoyPV && fechaVenc <= en15Dias;
                }
                return false;
              })
              .map(r => ({
                ...p,
                _esRecibo: true,
                _reciboNumero: r.numero_recibo,
                _totalRecibos: p.recibos?.length || 1,
                estatus_pago: 'Por Vencer', // 🔥 Forzar estatus correcto para el modal
                monto: Number(r.monto || r.importe || 0),
                fecha_vencimiento_pago: r.fecha_vencimiento
              }));
          });
          polizasFiltradas = recibosPorVencer;
        }
        titulo = 'Recibos Por Vencer';
        color = '#F59E0B';
        break;
      case 'vencidas':
        // 🔥 NUEVA LÓGICA: Mostrar TODOS los recibos con estatus "Vencido" sin importar fecha
        // Cuando se paguen o cancelen, dejarán de aparecer aquí
        {
          const hoyLocal = new Date();
          hoyLocal.setHours(0, 0, 0, 0);
          
          console.log('🔍 DEBUG VENCIDAS - Expedientes con recibos:', 
            expedientes.filter(p => p.recibos?.length > 0).map(p => ({
              poliza: p.numero_poliza,
              recibos: p.recibos?.map(r => ({
                num: r.numero_recibo,
                estatus: r.estatus_pago || r.estatus,
                vencimiento: r.fecha_vencimiento,
                pagado: r.fecha_pago_real
              }))
            }))
          );
          
          const recibosVencidos = expedientes.flatMap(p => {
            if (!Array.isArray(p.recibos) || p.recibos.length === 0) {
              // Póliza sin recibos: verificar estatus de la póliza
              const estatus = (p.estatus_pago || p.estatusPago || '').toLowerCase();
              if (estatus === 'vencido') {
                return [{
                  ...p,
                  _esRecibo: true,
                  monto: resolverMonto(p)
                }];
              }
              return [];
            }
            // Filtrar recibos vencidos
            // Criterio: estatus = 'Vencido' O (no está pagado Y fecha_vencimiento < hoy)
            return p.recibos
              .filter(r => {
                // Si ya está pagado, no está vencido
                if (r.fecha_pago_real) return false;
                
                const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
                if (estatus === 'vencido') return true;
                
                // Fallback: calcular por fecha si no tiene estatus o estatus no es claro
                if (r.fecha_vencimiento) {
                  const fechaVenc = new Date(r.fecha_vencimiento);
                  fechaVenc.setHours(0, 0, 0, 0);
                  return fechaVenc < hoyLocal;
                }
                return false;
              })
              .map(r => ({
                ...p,
                _esRecibo: true,
                _reciboNumero: r.numero_recibo,
                monto: Number(r.monto || r.importe || 0),
                fecha_vencimiento_pago: r.fecha_vencimiento
              }));
          });
          console.log('🔍 DEBUG - Recibos vencidos encontrados:', recibosVencidos.length, recibosVencidos);
          polizasFiltradas = recibosVencidos;
        }
        titulo = 'Recibos Vencidos';
        color = '#EF4444';
        break;
      case 'canceladas':
        // 🔥 LÓGICA: Recibos NO pagados de pólizas canceladas
        {
          const recibosCancelados = expedientes.flatMap(p => {
            // Solo considerar pólizas canceladas
            const estaCancelado = p.etapa_activa === 'Cancelada' || p.etapaActiva === 'Cancelada';
            if (!estaCancelado) return [];
            
            // Verificar fecha de cancelación según el periodo
            const fechaCancelacion = p.fecha_cancelacion || p.updated_at;
            let incluidoEnPeriodo = false;
            
            if (periodo === 'mesActual') {
              incluidoEnPeriodo = !fechaCancelacion || estaEnRango(fechaCancelacion, inicioMesActual, finMesActual);
            } else if (periodo === 'mesAnterior') {
              incluidoEnPeriodo = fechaCancelacion && estaEnRango(fechaCancelacion, inicioMesAnterior, finMesAnterior);
            } else {
              incluidoEnPeriodo = true;
            }
            
            if (!incluidoEnPeriodo) return [];
            
            if (!Array.isArray(p.recibos) || p.recibos.length === 0) {
              // Póliza sin recibos: mostrar la póliza como item
              return [{
                ...p,
                _esRecibo: true,
                monto: resolverMonto(p)
              }];
            }
            
            // Filtrar recibos NO pagados (los cancelados)
            return p.recibos
              .filter(r => !r.fecha_pago_real) // Solo recibos sin pagar
              .map(r => ({
                ...p,
                _esRecibo: true,
                _reciboNumero: r.numero_recibo,
                _totalRecibos: p.recibos?.length || 1,
                monto: Number(r.monto || r.importe || 0),
                fecha_cancelacion: p.fecha_cancelacion || p.updated_at
              }));
          });
          polizasFiltradas = recibosCancelados;
        }
        titulo = `Recibos Cancelados - ${periodoTexto}`;
        color = '#6B7280';
        break;
      default:
        break;
    }

    // Helper para obtener monto: si es recibo usa monto directo, si no usa resolverMonto
    const obtenerMonto = (item) => item._esRecibo ? (item.monto || 0) : resolverMonto(item);

    const porProducto = polizasFiltradas.reduce((acc, poliza) => {
      const producto = poliza.producto || 'Sin producto';
      if (!acc[producto]) acc[producto] = { polizas: [], total: 0, cantidad: 0 };
      acc[producto].polizas.push(poliza);
      acc[producto].total += obtenerMonto(poliza);
      acc[producto].cantidad += 1;
      return acc;
    }, {});

    setPaginaModal(1); // Resetear página al abrir
    setModalActualParams({ tipo, periodo }); // Guardar parámetros para refrescar después
    setModalDesglose({
      tipo,
      titulo,
      color,
      porProducto,
      todasLasPolizas: polizasFiltradas, // Guardar todas para paginación
      totalGeneral: polizasFiltradas.reduce((sum, p) => sum + obtenerMonto(p), 0),
      cantidadTotal: polizasFiltradas.length
    });
  };

  // Estadísticas Financieras - Calculadas por RANGOS DE FECHAS (MES ACTUAL + MES ANTERIOR)
  // Estrategia simplificada: Cada tarjeta usa SU PROPIA fecha de referencia
  const estadisticasFinancieras = useMemo(() => {
    // ==================== CALCULAR RANGOS DE FECHAS ====================
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Mes actual: del 1 al último día del mes
    const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    
    // Mes anterior: del 1 al último día del mes anterior
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
    
    // Helper: Verificar si una fecha está en un rango
    const estaEnRango = (fecha, inicio, fin) => {
      if (!fecha) return false;
      
      // Extraer solo la parte de fecha (sin hora) para evitar problemas de zona horaria
      const fechaStr = String(fecha).split('T')[0];
      const [year, month, day] = fechaStr.split('-').map(Number);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.warn('⚠️ Fecha inválida:', fecha);
        return false;
      }
      
      // Crear fecha en hora local
      const f = new Date(year, month - 1, day);
      f.setHours(0, 0, 0, 0);
      
      return f >= inicio && f <= fin;
    };

    // ==================== EXTRAER TODOS LOS RECIBOS ====================
    // Crear "recibos virtuales" para pólizas sin recibos (fallback)
    const todosLosRecibos = expedientes.flatMap(p => {
      if (!Array.isArray(p.recibos) || p.recibos.length === 0) {
        // Póliza sin recibos: crear un "recibo virtual" con datos de la póliza
        return [{
          expediente_id: p.id,
          monto: resolverMonto(p),
          estatus: p.estatus_pago || p.estatusPago || 'Pendiente',
          fecha_pago_real: p.fecha_pago,
          fecha_vencimiento: p.fecha_vencimiento_pago || p.proximo_pago,
          created_at: p.fecha_emision || p.created_at, // Fecha de emisión del recibo
          _esPolizaAnual: true
        }];
      }
      // Póliza con recibos: agregar referencia al expediente
      return p.recibos.map(r => ({ 
        ...r, 
        expediente_id: p.id,
        // Usar created_at del recibo, o fallback a fecha_emision de póliza
        created_at: r.created_at || p.fecha_emision || p.created_at
      }));
    });

    // ==================== TARJETA 1: PÓLIZAS EMITIDAS ====================
    // Contar TODAS las PÓLIZAS emitidas (sin importar estado posterior)
    // Emitidas = Pagadas + Canceladas + Pendientes (el total)
    const polizasEmitidasMesActual = expedientes.filter(p => {
      const fechaRef = p.fecha_emision || p.fecha_captura || p.created_at;
      return fechaRef && estaEnRango(fechaRef, inicioMesActual, finMesActual);
    });
    
    const polizasEmitidasMesAnterior = expedientes.filter(p => {
      const fechaRef = p.fecha_emision || p.fecha_captura || p.created_at;
      return fechaRef && estaEnRango(fechaRef, inicioMesAnterior, finMesAnterior);
    });
    
    // Sumar el importe total de cada póliza emitida
    const primasEmitidasMesActual = polizasEmitidasMesActual.reduce((sum, p) => {
      const monto = resolverMonto(p);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasEmitidasMesAnterior = polizasEmitidasMesAnterior.reduce((sum, p) => {
      const monto = resolverMonto(p);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasEmitidasTotal = primasEmitidasMesActual + primasEmitidasMesAnterior;

    // ==================== TARJETA 2: PÓLIZAS PAGADAS ====================
    // Recibos pagados: tiene fecha_pago_real O estatus = 'Pagado'
    // Filtrados por fecha_pago_real en el rango del mes
    const recibosPagadosMesActual = todosLosRecibos.filter(r => {
      // Criterio principal: tiene fecha_pago_real
      if (r.fecha_pago_real && estaEnRango(r.fecha_pago_real, inicioMesActual, finMesActual)) {
        return true;
      }
      return false;
    });
    
    const recibosPagadosMesAnterior = todosLosRecibos.filter(r => {
      if (r.fecha_pago_real && estaEnRango(r.fecha_pago_real, inicioMesAnterior, finMesAnterior)) {
        return true;
      }
      return false;
    });
    
    const primasPagadasMesActual = recibosPagadosMesActual.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasPagadasMesAnterior = recibosPagadosMesAnterior.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasPagadasTotal = primasPagadasMesActual + primasPagadasMesAnterior;

    // ==================== TARJETA 3: POR VENCER ====================
    // Recibos por vencer: estatus = 'Por Vencer' O (no pagado Y vence en 15 días)
    const hoyStats = new Date();
    hoyStats.setHours(0, 0, 0, 0);
    const en15DiasStats = new Date(hoyStats);
    en15DiasStats.setDate(en15DiasStats.getDate() + 15);
    
    // IDs de expedientes cancelados (para excluirlos de Por Vencer y Vencidos)
    const idsExpedientesCancelados = new Set(
      expedientes
        .filter(exp => exp.etapa_activa === 'Cancelada' || exp.etapaActiva === 'Cancelada')
        .map(exp => String(exp.id))
    );
    
    const recibosPorVencer = todosLosRecibos.filter(r => {
      // Si ya está pagado, no cuenta
      if (r.fecha_pago_real) return false;
      
      // Excluir recibos de expedientes cancelados
      if (idsExpedientesCancelados.has(String(r.expediente_id))) return false;
      
      // Excluir recibos con estatus cancelado
      const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
      if (estatus === 'cancelado' || estatus === 'cancelada') return false;
      
      if (estatus === 'por vencer' || estatus === 'pago por vencer') return true;
      
      // Fallback: calcular por fecha
      if (r.fecha_vencimiento) {
        const fechaVenc = new Date(String(r.fecha_vencimiento).split('T')[0]);
        fechaVenc.setHours(0, 0, 0, 0);
        return fechaVenc >= hoyStats && fechaVenc <= en15DiasStats;
      }
      return false;
    });
    
    const primasPorVencer = recibosPorVencer.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);

    // ==================== TARJETA 4: VENCIDOS ====================
    // Recibos vencidos: estatus = 'Vencido' O (no pagado Y fecha_vencimiento < hoy)
    // EXCLUYE recibos de expedientes cancelados
    const recibosVencidos = todosLosRecibos.filter(r => {
      // Si ya está pagado, no cuenta
      if (r.fecha_pago_real) return false;
      
      // Excluir recibos de expedientes cancelados
      if (idsExpedientesCancelados.has(String(r.expediente_id))) return false;
      
      // Excluir recibos con estatus cancelado
      const estatus = (r.estatus_pago || r.estatus || '').toLowerCase();
      if (estatus === 'cancelado' || estatus === 'cancelada') return false;
      
      if (estatus === 'vencido') return true;
      
      // Fallback: calcular por fecha
      if (r.fecha_vencimiento) {
        const fechaVenc = new Date(String(r.fecha_vencimiento).split('T')[0]);
        fechaVenc.setHours(0, 0, 0, 0);
        return fechaVenc < hoyStats;
      }
      return false;
    });
    
    const primasVencidas = recibosVencidos.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);

    // ==================== TARJETA 5: CANCELADOS ====================
    // Lógica simplificada: 
    // - Expedientes con etapa_activa = "Cancelada" del mes actual
    // - Sumar recibos NO pagados de esos expedientes (son los cancelados)
    
    // 1. Obtener expedientes cancelados del mes actual
    const expedientesCanceladosMesActual = expedientes.filter(exp => {
      const estaCancelado = exp.etapa_activa === 'Cancelada' || exp.etapaActiva === 'Cancelada';
      if (!estaCancelado) return false;
      
      const fechaCancelacion = exp.fecha_cancelacion || exp.updated_at;
      if (!fechaCancelacion) return true; // Sin fecha, asumir mes actual
      return estaEnRango(fechaCancelacion, inicioMesActual, finMesActual);
    });
    
    const expedientesCanceladosMesAnterior = expedientes.filter(exp => {
      const estaCancelado = exp.etapa_activa === 'Cancelada' || exp.etapaActiva === 'Cancelada';
      if (!estaCancelado) return false;
      
      const fechaCancelacion = exp.fecha_cancelacion || exp.updated_at;
      if (!fechaCancelacion) return false;
      return estaEnRango(fechaCancelacion, inicioMesAnterior, finMesAnterior);
    });
    
    const idsCanceladosMesActual = new Set(expedientesCanceladosMesActual.map(exp => String(exp.id)));
    const idsCanceladosMesAnterior = new Set(expedientesCanceladosMesAnterior.map(exp => String(exp.id)));
    
    // 2. Recibos cancelados = recibos NO pagados de expedientes cancelados
    const recibosCanceladosMesActual = todosLosRecibos.filter(r => {
      if (!idsCanceladosMesActual.has(String(r.expediente_id))) return false;
      // Excluir recibos que ya fueron pagados
      if (r.fecha_pago_real) return false;
      return true;
    });
    
    const recibosCanceladosMesAnterior = todosLosRecibos.filter(r => {
      if (!idsCanceladosMesAnterior.has(String(r.expediente_id))) return false;
      if (r.fecha_pago_real) return false;
      return true;
    });
    
    const primasCanceladasMesActual = recibosCanceladosMesActual.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasCanceladasMesAnterior = recibosCanceladosMesAnterior.reduce((sum, r) => {
      const monto = Number(r.monto || r.importe || 0);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);
    
    const primasCanceladasTotal = primasCanceladasMesActual + primasCanceladasMesAnterior;
    
    console.log(`📊 Dashboard Cancelados: ${expedientesCanceladosMesActual.length} expedientes cancelados mes actual, ${recibosCanceladosMesActual.length} recibos cancelados mes actual`);

    
    // ==================== CONSTRUIR OBJETO DE ESTADÍSTICAS ====================
    const stats = {
      primasEmitidas: {
        monto: primasEmitidasTotal,
        cantidad: polizasEmitidasMesActual.length + polizasEmitidasMesAnterior.length, // Cantidad de PÓLIZAS emitidas
        mesActual: {
          monto: primasEmitidasMesActual,
          cantidad: polizasEmitidasMesActual.length
        },
        mesAnterior: {
          monto: primasEmitidasMesAnterior,
          cantidad: polizasEmitidasMesAnterior.length
        }
      },
      primasPagadas: {
        monto: primasPagadasTotal,
        cantidad: recibosPagadosMesActual.length + recibosPagadosMesAnterior.length, // Cantidad de RECIBOS pagados
        mesActual: {
          monto: primasPagadasMesActual,
          cantidad: recibosPagadosMesActual.length
        },
        mesAnterior: {
          monto: primasPagadasMesAnterior,
          cantidad: recibosPagadosMesAnterior.length
        }
      },
      primasPorVencer: {
        monto: primasPorVencer,
        cantidad: recibosPorVencer.length // Cantidad de RECIBOS por vencer (sin desglose por mes)
      },
      primasVencidas: {
        monto: primasVencidas,
        cantidad: recibosVencidos.length // Cantidad de RECIBOS vencidos (sin desglose por mes)
      },
      primasCanceladas: {
        monto: primasCanceladasTotal,
        cantidad: recibosCanceladosMesActual.length + recibosCanceladosMesAnterior.length,
        mesActual: {
          monto: primasCanceladasMesActual,
          cantidad: recibosCanceladosMesActual.length
        },
        mesAnterior: {
          monto: primasCanceladasMesAnterior,
          cantidad: recibosCanceladosMesAnterior.length
        }
      }
    };
    
    return stats;
  }, [expedientes]);

  // Etapas de nuevas pólizas - diseño ejecutivo
  const etapasNuevasPolizas = [
    { 
      nombre: 'Solicitud de cotización',
      codigo: 'COT',
      color: '#1e40af',
      icono: FileText
    },
    { 
      nombre: 'Cotización enviada',
      codigo: 'ENV',
      color: '#0e7490',
      icono: Send
    },
    { 
      nombre: 'Solicitar emisión',
      codigo: 'EMI',
      color: '#7c2d12',
      icono: Edit
    },
    { 
      nombre: 'Emitida pendiente de pago',
      codigo: 'PEN',
      color: '#6b21a8',
      icono: Clock
    },
    { 
      nombre: 'Pagada',
      codigo: 'PAG',
      color: '#166534',
      icono: CheckCircle
    }
  ];

  const estadisticasNuevasPolizas = useMemo(() => {
    const nuevas = expedientes.filter(exp => exp.tipo === 'nueva');
    return etapasNuevasPolizas.map(etapa => ({
      ...etapa,
      cantidad: nuevas.filter(exp => exp.etapa === etapa.nombre).length
    }));
  }, [expedientes]);

  // Estadísticas de Pagos
  const estadisticasPagos = useMemo(() => {
    const pagos = expedientes.filter(exp => exp.tipo === 'pago');
    return {
      vencidos: pagos.filter(p => p.estatusPago === 'Vencido'),
      porVencer: pagos.filter(p => p.estatusPago === 'Por vencer'),
      enGracia: pagos.filter(p => p.estatusPago === 'En período de gracia'),
      montoTotal: pagos.reduce((sum, p) => sum + (p.monto || 0), 0)
    };
  }, [expedientes]);

  // =====================
  // Panel de Trámites
  // =====================
  const estadisticasTramites = useMemo(() => {
    const hoy = new Date();
    const parseDate = (d) => (d ? new Date(d) : null);
    const esVencido = (t) => {
      const f = parseDate(t.fechaLimite || t.fecha_limite);
      if (!f) return false;
      return f < hoy && !['Completado', 'Cancelado', 'Rechazado'].includes(t.estatus);
    };

    const pendientes = tramites.filter(t => t.estatus === 'Pendiente');
    const solicitados = tramites.filter(t => t.estatus === 'Solicitado');
    const enProceso = tramites.filter(t => t.estatus === 'En proceso');
    const completados = tramites.filter(t => t.estatus === 'Completado');
    const cancelados = tramites.filter(t => t.estatus === 'Cancelado');
    const rechazados = tramites.filter(t => t.estatus === 'Rechazado');
    const vencidos = tramites.filter(esVencido);

    // Recientes
    const recientes = [...tramites]
      .sort((a, b) => new Date(b.fechaCreacion || b.created_at || 0) - new Date(a.fechaCreacion || a.created_at || 0))
      .slice(0, 8);

    return {
      totales: {
        pendientes: pendientes.length,
        solicitados: solicitados.length,
        enProceso: enProceso.length,
        completados: completados.length,
        cancelados: cancelados.length,
        rechazados: rechazados.length,
        vencidos: vencidos.length,
        total: tramites.length
      },
      recientes,
    };
  }, [tramites]);

  const irATramites = () => {
    try { window.history.pushState({}, '', '/tramites'); window.dispatchEvent(new PopStateEvent('popstate')); }
    catch (_) { window.location.href = '/tramites'; }
  };

  // Función para cambiar el estatus de un trámite
  const cambiarEstatusTramite = async (tramite, nuevoEstatus) => {
    try {
      const payload = {
        estatus: nuevoEstatus
      };
      
      const res = await fetch(`${API_URL}/api/tramites/${tramite.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Error al actualizar trámite');
      }
      
      // Actualizar el trámite en el estado local
      setTramites(prev => prev.map(t => 
        t.id === tramite.id ? { ...t, estatus: nuevoEstatus } : t
      ));
      
      // Actualizar en el modal también
      if (modalTramites) {
        setModalTramites(prev => ({
          ...prev,
          tramites: prev.tramites.map(t => 
            t.id === tramite.id ? { ...t, estatus: nuevoEstatus } : t
          ).filter(t => {
            // Si estamos en pendientes y cambió a otro estatus, removerlo de la lista
            if (prev.tipo === 'pendientes' && nuevoEstatus !== 'Pendiente') return t.id !== tramite.id;
            if (prev.tipo === 'enProceso' && nuevoEstatus !== 'En proceso') return t.id !== tramite.id;
            return true;
          })
        }));
      }
      
      // Limpiar selección
      setTramiteSeleccionado(null);
      
      // Mostrar notificación
      toast.success(`Trámite ${tramite.codigo} actualizado a "${nuevoEstatus}"`);
      
      return true;
    } catch (error) {
      console.error('Error al cambiar estatus:', error);
      toast.error('Error al actualizar el trámite');
      return false;
    }
  };

  // Función para abrir modal de envío a ejecutivo
  const abrirModalEnviarEjecutivo = (tramite) => {
    setModalEnviarEjecutivo(tramite);
  };

  // Función para enviar trámite a ejecutivo
  const enviarTramiteAEjecutivo = async (tramite, metodo) => {
    // Obtener datos del ejecutivo asignado
    let ejecutivoData = null;
    const ejecutivoNombre = tramite.responsable || tramite.ejecutivoAsignado;
    
    if (ejecutivoNombre) {
      try {
        // Buscar el ejecutivo en equipo de trabajo por nombre
        const resEquipo = await fetch(`${API_URL}/api/equipoDeTrabajo`);
        if (resEquipo.ok) {
          const equipoData = await resEquipo.json();
          const equipoArray = Array.isArray(equipoData) ? equipoData : [];
          
          // Buscar por nombre (puede ser "nombre" o "nombre apellido")
          ejecutivoData = equipoArray.find(e => {
            const nombreCompleto = `${e.nombre || ''} ${e.apellido_paterno || ''}`.trim().toLowerCase();
            const nombreBuscado = ejecutivoNombre.toLowerCase();
            return nombreCompleto.includes(nombreBuscado) || 
                   nombreBuscado.includes(e.nombre?.toLowerCase() || '') ||
                   e.nombre?.toLowerCase() === nombreBuscado;
          });
          
          if (ejecutivoData) {
            console.log('✅ Ejecutivo encontrado:', ejecutivoData);
          }
        }
      } catch (error) {
        console.warn('No se pudo obtener datos del ejecutivo:', error);
      }
    }
    
    // Construir mensaje
    const fechaLimite = tramite.fechaLimite 
      ? new Date(tramite.fechaLimite).toLocaleDateString('es-MX') 
      : 'Sin fecha límite';
    
    const ejecutivo = ejecutivoData 
      ? `${ejecutivoData.nombre || ''} ${ejecutivoData.apellido_paterno || ''}`.trim()
      : (ejecutivoNombre || 'Por asignar');
    
    // Obtener agente y solicitante
    const agenteInfo = tramite.agente || '-';
    const solicitante = 'Administración'; // Usuario actual del sistema
    
    // Mensaje para WhatsApp (con formato)
    const mensajeWhatsApp = `🔔 *SOLICITUD DE TRÁMITE*

📋 *Código:* ${tramite.codigo || '-'}
📝 *Tipo:* ${tramite.tipoTramite || '-'}
⚡ *Prioridad:* ${tramite.prioridad || 'Normal'}
📅 *Fecha Límite:* ${fechaLimite}

👤 *Cliente:* ${tramite.clienteNombre || tramite.cliente || '-'}
📄 *Póliza:* ${tramite.numeroPoliza || tramite.expediente || '-'}
🏢 *Aseguradora:* ${tramite.aseguradora || '-'}
📦 *Producto:* ${tramite.tipoSeguro || '-'}
🧑‍💼 *Agente:* ${agenteInfo}

📝 *Descripción:*
${tramite.descripcion || 'Sin descripción'}
${tramite.observaciones ? `\n💬 *Observaciones:*\n${tramite.observaciones}` : ''}

👷 *Ejecutivo Asignado:* ${ejecutivo}
📤 *Solicitado por:* ${solicitante}

Por favor, atender este trámite a la brevedad.

Saludos cordiales,
*DCPRO Administración* 🏢`;

    // Mensaje para Email (sin asteriscos)
    const mensajeEmail = `SOLICITUD DE TRÁMITE

Código: ${tramite.codigo || '-'}
Tipo: ${tramite.tipoTramite || '-'}
Prioridad: ${tramite.prioridad || 'Normal'}
Fecha Límite: ${fechaLimite}

Cliente: ${tramite.clienteNombre || tramite.cliente || '-'}
Póliza: ${tramite.numeroPoliza || tramite.expediente || '-'}
Aseguradora: ${tramite.aseguradora || '-'}
Producto: ${tramite.tipoSeguro || '-'}
Agente: ${agenteInfo}

Descripción:
${tramite.descripcion || 'Sin descripción'}
${tramite.observaciones ? `\nObservaciones:\n${tramite.observaciones}` : ''}

Ejecutivo Asignado: ${ejecutivo}
Solicitado por: ${solicitante}

Por favor, atender este trámite a la brevedad.

Saludos cordiales,
DCPRO Administración`;

    if (metodo === 'whatsapp') {
      // Si tenemos teléfono del ejecutivo, enviarlo directo
      if (ejecutivoData?.telefono) {
        const telefonoLimpio = ejecutivoData.telefono.replace(/\D/g, '');
        const telefonoConCodigo = telefonoLimpio.startsWith('52') ? telefonoLimpio : `52${telefonoLimpio}`;
        const url = `https://wa.me/${telefonoConCodigo}?text=${encodeURIComponent(mensajeWhatsApp)}`;
        window.open(url, '_blank');
      } else {
        // Sin teléfono, abrir para seleccionar contacto
        const url = `https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`;
        window.open(url, '_blank');
        toast('Selecciona el contacto del ejecutivo en WhatsApp', { icon: 'ℹ️' });
      }
    } else if (metodo === 'email') {
      const asunto = `Solicitud de Trámite ${tramite.codigo} - ${tramite.tipoTramite}`;
      // Si tenemos email del ejecutivo, incluirlo
      const emailDestino = ejecutivoData?.email || '';
      const mailtoUrl = `mailto:${emailDestino}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeEmail)}`;
      window.location.href = mailtoUrl;
    }

    // Cambiar estatus a "Solicitado"
    await cambiarEstatusTramite(tramite, 'Solicitado');
    
    // Cerrar modales
    setModalEnviarEjecutivo(null);
    toast.success(`Trámite ${tramite.codigo} enviado a ${ejecutivo}`);
  };

  // Función para abrir modal de trámites filtrados
  const abrirModalTramites = (tipo, titulo, color) => {
    const hoy = new Date();
    const esVencido = (t) => {
      const f = t.fechaLimite ? new Date(t.fechaLimite) : null;
      if (!f) return false;
      return f < hoy && !['Completado', 'Cancelado', 'Rechazado'].includes(t.estatus);
    };

    let tramitesFiltrados = [];
    switch (tipo) {
      case 'pendientes':
        tramitesFiltrados = tramites.filter(t => t.estatus === 'Pendiente');
        break;
      case 'solicitados':
        tramitesFiltrados = tramites.filter(t => t.estatus === 'Solicitado');
        break;
      case 'enProceso':
        tramitesFiltrados = tramites.filter(t => t.estatus === 'En proceso');
        break;
      case 'vencidos':
        tramitesFiltrados = tramites.filter(esVencido);
        break;
      case 'completados':
        tramitesFiltrados = tramites.filter(t => t.estatus === 'Completado');
        break;
      default:
        tramitesFiltrados = tramites;
    }

    // Enriquecer trámites con datos del expediente
    const tramitesEnriquecidos = tramitesFiltrados.map(t => {
      // Buscar expediente por número de póliza (el campo 'expediente' del trámite contiene el numero_poliza)
      const expedienteRelacionado = expedientes.find(e => {
        // Match por numero_poliza (puede venir con o sin espacios/guiones)
        const polizaTramite = (t.expediente || '').replace(/[-\s]/g, '').toLowerCase();
        const polizaExp = (e.numero_poliza || '').replace(/[-\s]/g, '').toLowerCase();
        
        return (
          // Match exacto por expediente_id si existe
          (t.expediente_id && String(e.id) === String(t.expediente_id)) ||
          // Match exacto por número de póliza
          (polizaTramite && polizaExp && polizaTramite === polizaExp) ||
          // Match si uno contiene al otro
          (polizaTramite && polizaExp && (polizaTramite.includes(polizaExp) || polizaExp.includes(polizaTramite)))
        );
      });
      
      // Calcular días restantes o vencidos
      const diasRestantes = t.fechaLimite ? Math.ceil((new Date(t.fechaLimite) - hoy) / (1000 * 60 * 60 * 24)) : null;
      
      if (expedienteRelacionado) {
        // Construir nombre del cliente (persona física o moral)
        const nombreCliente = expedienteRelacionado.razon_social || 
                              expedienteRelacionado.razonSocial ||
                              expedienteRelacionado.nombre_cliente || 
                              `${expedienteRelacionado.nombre || ''} ${expedienteRelacionado.apellido_paterno || expedienteRelacionado.apellidoPaterno || ''}`.trim() || 
                              t.cliente || '-';
        
        // Construir info del vehículo
        const tieneVehiculo = expedienteRelacionado.marca || expedienteRelacionado.modelo;
        const vehiculoInfo = tieneVehiculo 
          ? `${expedienteRelacionado.marca || ''} ${expedienteRelacionado.modelo || ''} ${expedienteRelacionado.anio || ''}`.trim()
          : null;
        
        return {
          ...t,
          // Datos del expediente (todos los campos que tiene la póliza)
          aseguradora: expedienteRelacionado.compania || '-',
          tipoSeguro: expedienteRelacionado.producto || '-',
          clienteNombre: nombreCliente,
          numeroPoliza: expedienteRelacionado.numero_poliza || t.expediente || '-',
          vigencia: expedienteRelacionado.inicio_vigencia && expedienteRelacionado.termino_vigencia 
            ? `${new Date(expedienteRelacionado.inicio_vigencia).toLocaleDateString('es-MX')} - ${new Date(expedienteRelacionado.termino_vigencia).toLocaleDateString('es-MX')}`
            : '-',
          estatusPago: expedienteRelacionado.estatusPago || expedienteRelacionado.estatus_pago || '-',
          vehiculo: vehiculoInfo,
          placas: expedienteRelacionado.placas || null,
          numeroSerie: expedienteRelacionado.numero_serie || null,
          agente: expedienteRelacionado.agente || '-',
          subAgente: expedienteRelacionado.sub_agente || null,
          etapaActiva: expedienteRelacionado.etapa_activa || expedienteRelacionado.etapaActiva || null,
          tipoPago: expedienteRelacionado.tipo_pago || expedienteRelacionado.tipoPago || null,
          total: expedienteRelacionado.total || null,
          primaNeta: expedienteRelacionado.prima_neta || null,
          // Contacto del cliente
          emailCliente: expedienteRelacionado.email || null,
          telefonoCliente: expedienteRelacionado.telefonoMovil || expedienteRelacionado.telefono_movil || null,
          diasRestantes,
          expedienteEncontrado: true
        };
      }
      
      return {
        ...t,
        aseguradora: '-',
        tipoSeguro: '-',
        clienteNombre: t.cliente || '-',
        numeroPoliza: t.expediente || '-',
        vigencia: '-',
        estatusPago: '-',
        vehiculo: null,
        placas: null,
        agente: null,
        vendedor: null,
        diasRestantes,
        expedienteEncontrado: false
      };
    });

    setModalTramites({
      titulo,
      color,
      tipo,
      tramites: tramitesEnriquecidos
    });
  };

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <style>
        {`
          .executive-card {
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            transition: all 0.2s ease;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }
          .executive-card:hover {
            box-shadow: 0 4px 6px rgba(0,0,0,0.07);
            border-color: #D1D5DB;
            transform: translateY(-2px);
          }
          .kpi-card {
            background: white;
            border-radius: 6px;
            border: 1px solid #E5E7EB;
            position: relative;
            overflow: hidden;
          }
          .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--accent-color);
          }
          .metric-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .compact-table {
            font-size: 13px;
          }
          .compact-table th {
            background: #F9FAFB;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6B7280;
            padding: 8px 12px;
            border-bottom: 2px solid #E5E7EB;
          }
          .compact-table td {
            padding: 10px 12px;
            vertical-align: middle;
            border-bottom: 1px solid #F3F4F6;
          }
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
          }
          .data-row:hover {
            background-color: #F9FAFB;
          }
          .section-header {
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .mini-chart {
            height: 40px;
            display: flex;
            align-items: flex-end;
            gap: 2px;
          }
          .mini-chart-bar {
            flex: 1;
            background: #E5E7EB;
            border-radius: 2px 2px 0 0;
            transition: background 0.2s;
          }
          .mini-chart-bar:hover {
            background: #3B82F6;
          }
          .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s ease-in-out infinite;
            border-radius: 4px;
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      
      <div className="p-0" style={{ backgroundColor: '#F3F4F6', minHeight: '100vh' }}>
        {/* Header Ejecutivo Compacto */}
        <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB' }} className="py-3 px-4">
          <div className="container-fluid">
            <div className="row align-items-center g-3">
              <div className="col-12 col-md-6">
                <h4 className="mb-0 fw-bold" style={{ color: '#111827' }}>Dashboard Ejecutivo</h4>
                <small className="text-muted d-none d-md-block" style={{ fontSize: '12px' }}>
                  {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </small>
              </div>
              <div className="col-12 col-md-6">
                <div className="d-flex gap-2 flex-wrap justify-content-md-end">
                  <button className="btn btn-sm flex-fill flex-md-grow-0" style={{ border: '1px solid #E5E7EB', background: 'white' }}>
                    <Download size={14} className="me-1" />
                    <span className="d-none d-sm-inline">Exportar</span>
                  </button>
                  <button 
                    className="btn btn-sm flex-fill flex-md-grow-0" 
                    style={{ border: '1px solid #E5E7EB', background: 'white' }}
                    onClick={recargarDatos}
                    disabled={cargando}>
                    <RefreshCw size={14} className={`me-1 ${cargando ? 'spinner-border spinner-border-sm' : ''}`} />
                    <span className="d-none d-sm-inline">Actualizar</span>
                  </button>
                  <button 
                    className="btn btn-primary btn-sm flex-fill flex-md-grow-0"
                    onClick={() => navigate('/polizas?accion=nueva&origen=dashboard')}
                  >
                    <Plus size={14} className="me-1" />
                    <span className="d-none d-sm-inline">Nueva </span>Póliza
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container-fluid px-4 py-3">
          {/* SECCIÓN ECONÓMICA - Tarjetas Financieras */}
          <div className="mb-3">
            <h5 className="fw-bold mb-0" style={{ color: '#111827' }}>Panel Financiero</h5>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
              Resumen de primas del mes en curso ({new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })})
              {cargando && <span className="ms-2"><span className="spinner-border spinner-border-sm me-1" /> Cargando...</span>}
              {!cargando && expedientes.length > 0 && <span className="ms-2 text-success">• {expedientes.length} pólizas en base de datos</span>}
            </p>
          </div>

          <div className="row g-3 mb-4">
            {/* Primas Emitidas */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl">
              <div className="executive-card p-3">
                <div 
                  className="d-flex align-items-center justify-content-between mb-3"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => abrirDesglose('emitidas', 'mesActual')}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileCheck size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Pólizas Emitidas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#3B82F6' }}>
                      ${estadisticasFinancieras.primasEmitidas.mesActual.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                    <small style={{ fontSize: '11px', color: '#6B7280' }}>
                      {estadisticasFinancieras.primasEmitidas.mesActual.cantidad} pólizas • Mes actual
                    </small>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div 
                    className="d-flex justify-content-between p-2 rounded" 
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirDesglose('emitidas', 'mesAnterior');
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      Mes anterior: {estadisticasFinancieras.primasEmitidas.mesAnterior.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      ${estadisticasFinancieras.primasEmitidas.mesAnterior.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primas Pagadas */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl">
              <div className="executive-card p-3">
                <div 
                  className="d-flex align-items-center justify-content-between mb-3"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => abrirDesglose('pagadas', 'mesActual')}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Pólizas Pagadas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#10B981' }}>
                      ${estadisticasFinancieras.primasPagadas.mesActual.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                    <small style={{ fontSize: '11px', color: '#6B7280' }}>
                      {estadisticasFinancieras.primasPagadas.mesActual.cantidad} recibos • Mes actual
                    </small>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div 
                    className="d-flex justify-content-between p-2 rounded" 
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirDesglose('pagadas', 'mesAnterior');
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      Mes anterior: {estadisticasFinancieras.primasPagadas.mesAnterior.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      ${estadisticasFinancieras.primasPagadas.mesAnterior.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primas Por Vencer */}
            <div className="col-12 col-sm-6 col-lg-4 col-xl">
              <div className="executive-card p-3">
                <div 
                  className="d-flex align-items-center justify-content-between mb-3"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => abrirDesglose('porVencer', 'mesActual')}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Clock size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Por Vencer
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#F59E0B' }}>
                      ${estadisticasFinancieras.primasPorVencer.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                    <small style={{ fontSize: '11px', color: '#6B7280' }}>
                      {estadisticasFinancieras.primasPorVencer.cantidad} recibos
                    </small>
                  </div>
                </div>
                {/* Espacio para mantener altura uniforme con otras tarjetas */}
                <div className="pt-2 border-top" style={{ minHeight: '44px' }}>
                </div>
              </div>
            </div>

            {/* Primas Vencidas */}
            <div className="col-md-6 col-lg-6 col-xl">
              <div className="executive-card p-3">
                <div 
                  className="d-flex align-items-center justify-content-between mb-3"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => abrirDesglose('vencidas', 'todos')}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Vencidas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#EF4444' }}>
                      ${estadisticasFinancieras.primasVencidas.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                    <small style={{ fontSize: '11px', color: '#6B7280' }}>
                      {estadisticasFinancieras.primasVencidas.cantidad} recibo{estadisticasFinancieras.primasVencidas.cantidad !== 1 ? 's' : ''}
                    </small>
                  </div>
                </div>
                {/* Espacio para mantener altura uniforme con otras tarjetas */}
                <div className="pt-2 border-top" style={{ minHeight: '44px' }}>
                </div>
              </div>
            </div>

            {/* Primas Canceladas */}
            <div className="col-12 col-sm-6 col-lg-6 col-xl">
              <div className="executive-card p-3">
                <div 
                  className="d-flex align-items-center justify-content-between mb-3"
                  style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onClick={() => abrirDesglose('canceladas', 'mesActual')}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    background: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <XCircle size={24} style={{ color: 'white' }} />
                  </div>
                  <div className="text-end">
                    <div className="text-muted" style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Canceladas
                    </div>
                    <h3 className="mb-0 fw-bold" style={{ fontSize: '24px', color: '#6B7280' }}>
                      ${estadisticasFinancieras.primasCanceladas.mesActual.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </h3>
                    <small style={{ fontSize: '11px', color: '#6B7280' }}>
                      {estadisticasFinancieras.primasCanceladas.mesActual.cantidad} recibo{estadisticasFinancieras.primasCanceladas.mesActual.cantidad !== 1 ? 's' : ''} • Mes actual
                    </small>
                  </div>
                </div>
                <div className="pt-2 border-top">
                  <div 
                    className="d-flex justify-content-between p-2 rounded" 
                    style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirDesglose('canceladas', 'mesAnterior');
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      Mes anterior: {estadisticasFinancieras.primasCanceladas.mesAnterior.cantidad}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      ${estadisticasFinancieras.primasCanceladas.mesAnterior.monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mensaje cuando no hay datos */}
          {!cargando && expedientes.length === 0 && (
            <div className="row g-3 mb-4">
              <div className="col-12">
                <div className="executive-card p-5 text-center">
                  <FileText size={48} className="text-muted mb-3" />
                  <h5 className="text-muted mb-2">No hay pólizas registradas</h5>
                  <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                    Comienza creando tu primera póliza para ver las estadísticas financieras
                  </p>
                  <button className="btn btn-primary btn-sm">
                    <Plus size={14} className="me-1" />
                    Crear Primera Póliza
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Panel de Trámites */}
          <div className="mb-3 mt-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h5 className="fw-bold mb-0" style={{ color: '#111827' }}>Panel de Trámites</h5>
            <button className="btn btn-sm btn-outline-primary" onClick={irATramites}>
              Ver todos
            </button>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg">
              <div 
                className="executive-card p-3" 
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => abrirModalTramites('pendientes', 'Trámites Pendientes', '#F59E0B')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Pendientes</div>
                  <Clock size={18} style={{ color: '#F59E0B' }} />
                </div>
                <h3 className="mb-0 fw-bold" style={{ color: '#F59E0B' }}>{estadisticasTramites.totales.pendientes}</h3>
                <small className="text-muted">en espera</small>
              </div>
            </div>
            <div className="col-6 col-lg">
              <div 
                className="executive-card p-3" 
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => abrirModalTramites('solicitados', 'Trámites Solicitados', '#8B5CF6')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Solicitados</div>
                  <Send size={18} style={{ color: '#8B5CF6' }} />
                </div>
                <h3 className="mb-0 fw-bold" style={{ color: '#8B5CF6' }}>{estadisticasTramites.totales.solicitados}</h3>
                <small className="text-muted">enviados a ejecutivo</small>
              </div>
            </div>
            <div className="col-6 col-lg">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => abrirModalTramites('enProceso', 'Trámites En Proceso', '#3B82F6')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>En Proceso</div>
                  <Activity size={18} style={{ color: '#3B82F6' }} />
                </div>
                <h3 className="mb-0 fw-bold" style={{ color: '#3B82F6' }}>{estadisticasTramites.totales.enProceso}</h3>
                <small className="text-muted">gestión activa</small>
              </div>
            </div>
            <div className="col-6 col-lg">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => abrirModalTramites('vencidos', 'Trámites Vencidos', '#EF4444')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Vencidos</div>
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                </div>
                <h3 className="mb-0 fw-bold" style={{ color: '#EF4444' }}>{estadisticasTramites.totales.vencidos}</h3>
                <small className="text-muted">fecha límite</small>
              </div>
            </div>
            <div className="col-6 col-lg">
              <div 
                className="executive-card p-3"
                style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onClick={() => abrirModalTramites('completados', 'Trámites Completados', '#10B981')}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Completados</div>
                  <CheckCircle2 size={18} style={{ color: '#10B981' }} />
                </div>
                <h3 className="mb-0 fw-bold" style={{ color: '#10B981' }}>{estadisticasTramites.totales.completados}</h3>
                <small className="text-muted">finalizados</small>
              </div>
            </div>
          </div>

          {/* Calendario de Agenda */}
          <CalendarioAgenda />

        </div>
      </div>

      {/* MODAL DE DESGLOSE - Por Producto */}
      {modalDesglose && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setModalDesglose(null); setModalActualParams(null); }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '95%', width: '1400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              {/* Header del modal */}
              <div className="modal-header" style={{ background: modalDesglose.color, color: 'white' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-0">{modalDesglose.titulo}</h5>
                </div>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => { setModalDesglose(null); setModalActualParams(null); }}>
                </button>
              </div>
              
              {/* Body del modal */}
              <div className="modal-body p-0">
                {Object.keys(modalDesglose.porProducto).length === 0 ? (
                  <div className="text-center py-5">
                    <FileText size={48} className="text-muted mb-3" />
                    <h6 className="text-muted">No hay pólizas en esta categoría</h6>
                  </div>
                ) : (
                  (() => {
                    // Paginación: obtener pólizas de la página actual
                    const todasLasPolizas = modalDesglose.todasLasPolizas || [];
                    const totalPolizas = todasLasPolizas.length;
                    const totalPaginas = Math.ceil(totalPolizas / POLIZAS_POR_PAGINA);
                    const inicio = (paginaModal - 1) * POLIZAS_POR_PAGINA;
                    const fin = inicio + POLIZAS_POR_PAGINA;
                    const polizasPagina = todasLasPolizas.slice(inicio, fin);
                    
                    // Reagrupar por producto para mostrar con el formato original
                    const porProductoPagina = polizasPagina.reduce((acc, poliza) => {
                      const producto = poliza.producto || 'Sin producto';
                      if (!acc[producto]) acc[producto] = { polizas: [], total: 0, cantidad: 0 };
                      acc[producto].polizas.push(poliza);
                      acc[producto].total += resolverMonto(poliza);
                      acc[producto].cantidad += 1;
                      return acc;
                    }, {});
                    
                    return Object.entries(porProductoPagina).map(([producto, data], idx) => (
                    <div key={idx} className="border-bottom">
                      <div className="table-responsive">
                        <table className="table table-hover mb-0 compact-table">
                          <thead>
                            <tr>
                              <th>Fechas</th>
                              <th>Póliza</th>
                              <th>Cliente</th>
                              {/* Columna de Vehículo solo para productos de Autos */}
                              {producto.toLowerCase().includes('auto') && (
                                <th>Vehículo</th>
                              )}
                              <th style={{ textAlign: 'center' }}>Aseguradora</th>
                              <th style={{ textAlign: 'center' }}>
                                <div>Estatus Pago</div>
                                <div>y Progreso</div>
                              </th>
                              <th className="text-end">Importe</th>
                              <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.polizas.map((poliza, pIdx) => (
                              <tr key={pIdx} className="data-row">
                                <td>
                                  <div style={{ fontSize: '11px' }}>
                                    {modalDesglose.tipo === 'emitidas' && poliza.fecha_captura && (
                                      <div className="mb-1">
                                        <strong className="d-block text-muted">Captura:</strong>
                                        <span className="text-muted">
                                          {formatearFecha(poliza.fecha_captura)}
                                        </span>
                                      </div>
                                    )}
                                    {modalDesglose.tipo === 'emitidas' && poliza.fecha_emision && (
                                      <div>
                                        <strong className="d-block text-muted">Emisión:</strong>
                                        <span className="text-dark">
                                          {formatearFecha(poliza.fecha_emision)}
                                        </span>
                                      </div>
                                    )}
                                    {modalDesglose.tipo === 'pagadas' && (
                                      <>
                                        {poliza.fecha_emision && (
                                          <div className="mb-1">
                                            <strong className="d-block text-muted">Emisión:</strong>
                                            <span className="text-muted">
                                              {formatearFecha(poliza.fecha_emision)}
                                            </span>
                                          </div>
                                        )}
                                        {poliza.fecha_pago && (
                                          <div>
                                            <strong className="d-block text-muted">Pago:</strong>
                                            <span className="text-dark">
                                              {formatearFecha(poliza.fecha_pago)}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {modalDesglose.tipo === 'canceladas' && (
                                      <>
                                        {poliza.fecha_emision && (
                                          <div className="mb-1">
                                            <strong className="d-block text-muted">Emisión:</strong>
                                            <span className="text-muted">
                                              {formatearFecha(poliza.fecha_emision)}
                                            </span>
                                          </div>
                                        )}
                                        {poliza.fecha_cancelacion && (
                                          <div>
                                            <strong className="d-block text-muted">Cancelación:</strong>
                                            <span className="text-dark">
                                              {formatearFecha(poliza.fecha_cancelacion)}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {(modalDesglose.tipo === 'porVencer' || modalDesglose.tipo === 'vencidas') && (
                                      <>
                                        {poliza.fecha_emision && (
                                          <div className="mb-1">
                                            <strong className="d-block text-muted">Emisión:</strong>
                                            <span className="text-muted">
                                              {formatearFecha(poliza.fecha_emision)}
                                            </span>
                                          </div>
                                        )}
                                        {(poliza.fecha_vencimiento_pago || poliza.proximo_pago) && (
                                          <div>
                                            <strong className="d-block text-muted">Vencimiento:</strong>
                                            <span className="text-dark">
                                              {formatearFecha(poliza.fecha_vencimiento_pago || poliza.proximo_pago)}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    <div className="fw-semibold" style={{ color: '#111827', fontSize: '13px' }}>
                                      {poliza.numero_poliza || 'Sin número'}
                                    </div>
                                    {poliza.endoso && poliza.endoso !== '000000' && (
                                      <small className="text-muted d-block">Endoso: {poliza.endoso}</small>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div>
                                    {/* Nombre del Cliente según tipo de persona */}
                                    <div className="fw-medium" style={{ fontSize: '13px' }}>
                                      {poliza.tipoPersona === 'Persona Moral' || poliza.tipo_persona === 'Moral'
                                        ? (poliza.razonSocial || poliza.razon_social || poliza.cliente_nombre || 'Sin nombre')
                                        : (poliza.cliente_nombre || 
                                           `${poliza.nombre || ''} ${poliza.apellidoPaterno || poliza.apellido_paterno || ''}`.trim() || 
                                           'Sin nombre')
                                      }
                                    </div>
                                    {/* Datos de contacto */}
                                    <div className="text-muted mt-1" style={{ fontSize: '11px', borderTop: '1px solid #eee', paddingTop: '3px' }}>
                                      {(poliza.email || poliza.contacto_email) && (
                                        <div className="mb-1">
                                          📧 {poliza.email || poliza.contacto_email}
                                        </div>
                                      )}
                                      {(poliza.telefonoMovil || poliza.telefono_movil || poliza.contacto_telefono_movil) && (
                                        <div>
                                          📱 {poliza.telefonoMovil || poliza.telefono_movil || poliza.contacto_telefono_movil}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {/* Columna de Vehículo solo para productos de Autos */}
                                {producto.toLowerCase().includes('auto') && (
                                  <td style={{ maxWidth: '180px' }}>
                                    <div style={{ fontSize: '11px' }}>
                                      {(() => {
                                        // Construir descripción del vehículo
                                        const descripcion = poliza.descripcion_vehiculo || 
                                          `${poliza.marca || ''} ${poliza.modelo || ''}`.trim();
                                        
                                        if (!descripcion && !poliza.anio && !poliza.placas) {
                                          return <span className="text-muted">Sin datos</span>;
                                        }
                                        
                                        // Limitar a 35 caracteres la primera línea
                                        const linea1 = descripcion.substring(0, 35);
                                        const linea2 = descripcion.length > 35 ? descripcion.substring(35) : '';
                                        
                                        return (
                                          <>
                                            <div className="fw-medium" style={{ lineHeight: '1.2' }}>
                                              {linea1}{linea2 ? '' : ''}
                                            </div>
                                            {linea2 && (
                                              <div className="text-muted" style={{ lineHeight: '1.2' }}>
                                                {linea2.substring(0, 40)}{linea2.length > 40 ? '...' : ''}
                                              </div>
                                            )}
                                            <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                                              {poliza.anio && <span>Año: {poliza.anio}</span>}
                                              {poliza.anio && poliza.placas && <span> • </span>}
                                              {poliza.placas && <span>🚗 {poliza.placas}</span>}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                )}
                                <td style={{ textAlign: 'center', fontSize: '0.75rem', lineHeight: '1.3' }}>
                                  {/* Aseguradora + Agente + Vendedor */}
                                  {(() => {
                                    const textoAgente = poliza.agente || '';
                                    let claveAgente = '';
                                    let nombreAgente = '';
                                    
                                    const partes = textoAgente.split('-');
                                    if (partes.length >= 2) {
                                      claveAgente = partes[0].trim();
                                      const nombreCompleto = partes.slice(1).join('-').trim();
                                      const palabras = nombreCompleto.split(/\s+/);
                                      // Primer nombre + apellido paterno (penúltimo si hay 3+ palabras)
                                      const primerNombre = palabras[0] || '';
                                      const apellidoPaterno = palabras.length >= 3 
                                        ? palabras[palabras.length - 2]  // Penúltimo = apellido paterno
                                        : (palabras[1] || '');           // Si solo hay 2, el segundo es el apellido
                                      nombreAgente = `${primerNombre} ${apellidoPaterno}`.trim();
                                    } else {
                                      claveAgente = textoAgente;
                                    }
                                    
                                    const vendedor = poliza.vendedor || poliza.subagente || poliza.sub_agente || '';
                                    let nombreVendedor = '';
                                    if (vendedor) {
                                      const palabrasV = vendedor.trim().split(/\s+/);
                                      // Primer nombre + apellido paterno (penúltimo si hay 3+ palabras)
                                      const primerNombreV = palabrasV[0] || '';
                                      const apellidoPaternoV = palabrasV.length >= 3 
                                        ? palabrasV[palabrasV.length - 2]  // Penúltimo = apellido paterno
                                        : (palabrasV[1] || '');            // Si solo hay 2, el segundo es el apellido
                                      nombreVendedor = `${primerNombreV} ${apellidoPaternoV}`.trim();
                                    }
                                    
                                    return (
                                      <div>
                                        <div className="fw-semibold">{poliza.aseguradora || poliza.compania || 'Sin aseguradora'}</div>
                                        <div style={{ fontSize: '0.65rem' }}>
                                          {claveAgente || '-'}
                                        </div>
                                        {nombreAgente && (
                                          <div style={{ fontSize: '0.65rem' }}>
                                            {nombreAgente}
                                          </div>
                                        )}
                                        {nombreVendedor && (
                                          <div style={{ fontSize: '0.65rem', color: '#17a2b8' }}>
                                            V: {nombreVendedor}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {/* Columna Estado Pago y Progreso - simplificado */}
                                  <div>
                                    {/* Frecuencia de pago (Trimestral, Mensual, etc.) o Anual */}
                                    <small className="fw-semibold text-primary">
                                      {poliza.frecuenciaPago || poliza.frecuencia_pago || poliza.tipo_pago || 'Anual'}
                                    </small>
                                    {/* Estatus de pago con progreso unificado */}
                                    {(() => {
                                      const recibos = poliza.recibos || [];
                                      const esFraccionado = poliza.tipo_pago === 'Fraccionado' || 
                                                           (poliza.forma_pago && poliza.forma_pago.toUpperCase() === 'FRACCIONADO');
                                      
                                      // Calcular total de recibos basado en frecuencia (NO en recibos.length para evitar recibos fantasma)
                                      const frecuencia = (poliza.frecuencia_pago || poliza.frecuenciaPago || '').toLowerCase();
                                      let totalRecibos = 1; // Por defecto Anual = 1
                                      if (esFraccionado) {
                                        const totalPorFrecuencia = frecuencia.includes('trimestral') ? 4 : 
                                                       frecuencia.includes('semestral') ? 2 : 
                                                       frecuencia.includes('mensual') ? 12 : 
                                                       frecuencia.includes('cuatrimestral') ? 3 : 0;
                                        // Priorizar frecuencia; solo usar recibos.length si no hay frecuencia definida
                                        totalRecibos = totalPorFrecuencia || recibos.filter(r => parseFloat(r.monto || 0) > 0).length || 1;
                                      }
                                      
                                      // Contar recibos pagados
                                      const recibosPagados = recibos.filter(r => {
                                        if (r.fecha_pago_real) return true;
                                        const est = (r.estatus_pago || r.estatus || '').toLowerCase();
                                        return est === 'pagado' || est === 'pagada';
                                      }).length;
                                      
                                      // Determinar estatus y color
                                      let estatus = '';
                                      let colorClass = 'bg-secondary';
                                      let numeroMostrar = recibosPagados || 1;
                                      
                                      // 🔥 PRIORIDAD 1: Si es un recibo individual, usar su número específico
                                      if (poliza._esRecibo) {
                                        estatus = poliza.fecha_pago_real ? 'Pagado' : 
                                                 (poliza.estatus_pago || poliza.estatus || 'Pendiente');
                                        numeroMostrar = poliza._reciboNumero || 1;
                                        totalRecibos = poliza._totalRecibos || totalRecibos;
                                        
                                        // Si la póliza está cancelada, mostrar badge "Cancelado" pero mantener número de recibo
                                        if (poliza.etapa_activa === 'Cancelada') {
                                          estatus = 'Cancelado';
                                          colorClass = 'bg-dark';
                                        } else {
                                          colorClass = estatus.toLowerCase() === 'pagado' || estatus.toLowerCase() === 'pagada' ? 'bg-success' :
                                                      estatus.toLowerCase() === 'vencido' ? 'bg-danger' :
                                                      estatus.toLowerCase().includes('vencer') ? 'bg-warning text-dark' :
                                                      'bg-info';
                                        }
                                      }
                                      // 🔥 Si la póliza está cancelada (y NO es recibo individual)
                                      else if (poliza.etapa_activa === 'Cancelada') {
                                        estatus = 'Cancelado';
                                        colorClass = 'bg-dark';
                                        numeroMostrar = recibosPagados; // Mostrar el último pagado
                                      }
                                      // Para pólizas completas
                                      else if (recibos.length > 0) {
                                        const tieneVencidos = recibos.some(r => {
                                          const est = (r.estatus_pago || r.estatus || '').toLowerCase();
                                          return est === 'vencido';
                                        });
                                        const tienePorVencer = recibos.some(r => {
                                          const est = (r.estatus_pago || r.estatus || '').toLowerCase();
                                          return est === 'por vencer' || est === 'pago por vencer';
                                        });
                                        const todosPagados = recibos.every(r => r.fecha_pago_real);
                                        
                                        if (todosPagados) {
                                          estatus = 'Pagado';
                                          colorClass = 'bg-success';
                                          numeroMostrar = totalRecibos;
                                        } else if (tieneVencidos) {
                                          estatus = 'Vencido';
                                          colorClass = 'bg-danger';
                                          // Buscar primer recibo vencido
                                          const primerVencido = recibos.find(r => (r.estatus_pago || r.estatus || '').toLowerCase() === 'vencido');
                                          numeroMostrar = primerVencido?.numero_recibo || (recibosPagados + 1);
                                        } else if (tienePorVencer) {
                                          estatus = 'Por Vencer';
                                          colorClass = 'bg-warning text-dark';
                                          // Buscar primer recibo por vencer
                                          const primerPorVencer = recibos.find(r => {
                                            const est = (r.estatus_pago || r.estatus || '').toLowerCase();
                                            return est === 'por vencer' || est === 'pago por vencer';
                                          });
                                          numeroMostrar = primerPorVencer?.numero_recibo || (recibosPagados + 1);
                                        } else {
                                          estatus = 'Pendiente';
                                          colorClass = 'bg-info';
                                          numeroMostrar = recibosPagados + 1;
                                        }
                                      } else {
                                        // Póliza sin recibos (anual)
                                        estatus = poliza.estatus_pago || poliza.estatusPago || 'Pendiente';
                                        colorClass = estatus.toLowerCase() === 'pagado' || estatus.toLowerCase() === 'pagada' ? 'bg-success' :
                                                    estatus.toLowerCase() === 'vencido' ? 'bg-danger' :
                                                    estatus.toLowerCase().includes('vencer') ? 'bg-warning text-dark' :
                                                    'bg-info';
                                        numeroMostrar = estatus.toLowerCase() === 'pagado' ? 1 : 1;
                                      }
                                      
                                      return (
                                        <div className="mt-1">
                                          <span className={`badge ${colorClass}`} style={{ fontSize: '9px' }}>
                                            {estatus}
                                          </span>
                                          <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                            <span className={estatus.toLowerCase() === 'pagado' || estatus.toLowerCase() === 'pagada' || estatus.toLowerCase() === 'cancelado' ? 'text-success fw-bold' : 
                                                            estatus.toLowerCase() === 'vencido' ? 'text-danger fw-bold' :
                                                            estatus.toLowerCase().includes('vencer') ? 'text-warning fw-bold' : 'text-muted'}>
                                              {numeroMostrar}/{totalRecibos} {estatus.toLowerCase() === 'pagado' || estatus.toLowerCase() === 'pagada' || estatus.toLowerCase() === 'cancelado' ? 'Pagado' : estatus}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="text-end">
                                  <span className="fw-bold" style={{ color: modalDesglose.color, fontSize: '14px' }}>
                                    ${(poliza._esRecibo ? poliza.monto : resolverMonto(poliza)).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {/* Botón Ver Detalles - Abre en nueva pestaña */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/polizas?id=${poliza.id}&accion=ver`, '_blank');
                                    }}
                                    className="btn btn-outline-primary btn-sm"
                                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
                                    title="Ver detalles"
                                  >
                                    <Eye size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                  })()
                )}
              </div>
              
              {/* Controles de paginación */}
              {modalDesglose.todasLasPolizas && modalDesglose.todasLasPolizas.length > POLIZAS_POR_PAGINA && (
                <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top" style={{ background: '#F3F4F6' }}>
                  <div className="text-muted" style={{ fontSize: '13px' }}>
                    Mostrando {((paginaModal - 1) * POLIZAS_POR_PAGINA) + 1}-{Math.min(paginaModal * POLIZAS_POR_PAGINA, modalDesglose.todasLasPolizas.length)} de {modalDesglose.todasLasPolizas.length} pólizas
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      disabled={paginaModal === 1}
                      onClick={() => setPaginaModal(p => p - 1)}
                    >
                      ← Anterior
                    </button>
                    <span style={{ fontSize: '13px', minWidth: '100px', textAlign: 'center' }}>
                      Página {paginaModal} de {Math.ceil(modalDesglose.todasLasPolizas.length / POLIZAS_POR_PAGINA)}
                    </span>
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      disabled={paginaModal >= Math.ceil(modalDesglose.todasLasPolizas.length / POLIZAS_POR_PAGINA)}
                      onClick={() => setPaginaModal(p => p + 1)}
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE - Comentado temporalmente */}
      {modalDetalle && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              {/* Header del modal */}
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-normal">
                  Detalle del Trámite - Folio #{modalDetalle.id}
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setModalDetalle(null)}>
                </button>
              </div>
              
              {/* Body del modal */}
              <div className="modal-body">
                <div className="row g-3">
                  {/* SECCIÓN ROLES - Diseño ejecutivo */}
                  <div className="col-12">
                    <h6 className="text-muted mb-3 fw-normal">
                      <Users size={18} className="me-2" />
                      Partes Involucradas
                    </h6>
                    <div className="row g-2">
                      {/* Cliente */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-primary"></span>
                            <small className="text-muted fw-bold">CLIENTE</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.cliente}</h6>
                          <small className="text-muted d-block">{modalDetalle.telefono}</small>
                          <small className="text-primary" style={{ fontSize: '11px' }}>{modalDetalle.email}</small>
                        </div>
                      </div>
                      
                      {/* Agente */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-success"></span>
                            <small className="text-muted fw-bold">AGENTE</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.agente || 'No asignado'}</h6>
                          <small className="text-muted d-block">{modalDetalle.agenteTelefono || '-'}</small>
                          <small className="text-success" style={{ fontSize: '11px' }}>{modalDetalle.agenteEmail || '-'}</small>
                        </div>
                      </div>
                      
                      {/* Vendedor */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-info"></span>
                            <small className="text-muted fw-bold">VENDEDOR</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.vendedor || 'No aplica'}</h6>
                          <small className="text-muted d-block">{modalDetalle.vendedorTelefono || '-'}</small>
                          <small className="text-info" style={{ fontSize: '11px' }}>{modalDetalle.vendedorEmail || '-'}</small>
                        </div>
                      </div>
                      
                      {/* Ejecutivo */}
                      <div className="col-md-3">
                        <div className="border rounded p-3">
                          <div className="d-flex align-items-center mb-2">
                            <span className="status-indicator bg-warning"></span>
                            <small className="text-muted fw-bold">EJECUTIVO</small>
                          </div>
                          <h6 className="mb-1">{modalDetalle.ejecutivo || 'Por asignar'}</h6>
                          <small className="text-muted d-block">{modalDetalle.ejecutivoTelefono || '-'}</small>
                          <small className="text-warning" style={{ fontSize: '11px' }}>{modalDetalle.ejecutivoEmail || '-'}</small>
                        </div>
                      </div>
                    </div>
                    {modalDetalle.solicitadoPor && (
                      <div className="mt-2 text-end">
                        <small className="text-muted">
                          Iniciado por: <strong>{modalDetalle.solicitadoPor}</strong>
                        </small>
                      </div>
                    )}
                  </div>
                  
                  {/* Información de la póliza y trámite */}
                  <div className="col-md-6">
                    <div className="border rounded p-3">
                      <h6 className="mb-3 fw-normal">Información de la Póliza</h6>
                      <table className="table table-sm table-borderless">
                        <tbody>
                          <tr>
                            <td className="text-muted">Número:</td>
                            <td className="fw-semibold">{modalDetalle.poliza}</td>
                          </tr>
                          <tr>
                            <td className="text-muted">Aseguradora:</td>
                            <td>{modalDetalle.aseguradora}</td>
                          </tr>
                          <tr>
                            <td className="text-muted">Producto:</td>
                            <td>{modalDetalle.producto}</td>
                          </tr>
                          {modalDetalle.vehiculo && (
                            <tr>
                              <td className="text-muted">Vehículo:</td>
                              <td>{modalDetalle.vehiculo} - {modalDetalle.placas}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="border rounded p-3">
                      <h6 className="mb-3 fw-normal">Detalles del Trámite</h6>
                      <div className="mb-3">
                        <span className="badge bg-primary me-2">{modalDetalle.tramite}</span>
                        <span className={`badge ${
                          modalDetalle.estado === 'Autorizado' ? 'bg-success' :
                          modalDetalle.estado === 'En proceso' ? 'bg-warning' :
                          'bg-secondary'
                        }`}>
                          {modalDetalle.estado || 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-muted small mb-2">
                        <strong>Fecha:</strong> {modalDetalle.fechaSolicitud}
                      </p>
                      <p className="small">{modalDetalle.descripcion}</p>
                    </div>
                  </div>
                  
                  {/* Observaciones y archivos */}
                  {modalDetalle.observaciones && (
                    <div className="col-12">
                      <div className="alert alert-light border">
                        <strong>Observaciones:</strong> {modalDetalle.observaciones}
                      </div>
                    </div>
                  )}
                  
                  {modalDetalle.archivos && modalDetalle.archivos.length > 0 && (
                    <div className="col-12">
                      <div className="border rounded p-3">
                        <h6 className="mb-3 fw-normal">Documentos Adjuntos</h6>
                        <div className="list-group list-group-flush">
                          {modalDetalle.archivos.map((archivo, index) => (
                            <a key={index} href="#" className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <Paperclip size={14} className="me-2 text-muted" />
                                <span>{archivo}</span>
                              </div>
                              <Eye size={14} className="text-primary" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer del modal */}
              <div className="modal-footer bg-light">
                <button 
                  type="button" 
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <XCircle size={14} className="me-1" />
                  Rechazar
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-warning btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <Clock size={14} className="me-1" />
                  Pendiente
                </button>
                <button 
                  type="button" 
                  className="btn btn-success btn-sm"
                  onClick={() => setModalDetalle(null)}>
                  <CheckCircle2 size={14} className="me-1" />
                  Autorizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TRÁMITES - VISTA SIMPLIFICADA */}
      {modalTramites && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setModalTramites(null); setTramiteSeleccionado(null); }}>
          <div 
            className="modal-dialog modal-dialog-centered modal-dialog-scrollable" 
            style={{ maxWidth: tramiteSeleccionado ? '95%' : '900px', transition: 'max-width 0.3s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ height: '80vh' }}>
              {/* Header del modal */}
              <div className="modal-header py-2" style={{ background: modalTramites.color, color: 'white' }}>
                <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '16px' }}>
                  {modalTramites.titulo}
                  <span className="badge bg-light text-dark ms-2" style={{ fontSize: '11px' }}>
                    {modalTramites.tramites.length}
                  </span>
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => { setModalTramites(null); setTramiteSeleccionado(null); }}>
                </button>
              </div>
              
              {/* Body del modal - Layout con tabla y panel */}
              <div className="modal-body p-0 d-flex" style={{ overflow: 'hidden' }}>
                {/* Tabla de trámites (lado izquierdo) */}
                <div className={`${tramiteSeleccionado ? 'border-end' : ''}`} style={{ 
                  width: tramiteSeleccionado ? '55%' : '100%', 
                  overflow: 'auto',
                  transition: 'width 0.3s ease'
                }}>
                  {modalTramites.tramites.length === 0 ? (
                    <div className="text-center py-5">
                      <FileText size={48} className="text-muted mb-3" />
                      <h6 className="text-muted">No hay trámites en esta categoría</h6>
                    </div>
                  ) : (
                    <table className="table table-hover mb-0" style={{ fontSize: '12px' }}>
                      <thead className="table-light sticky-top">
                        <tr>
                          <th style={{ fontSize: '10px', fontWeight: 600 }}>TRÁMITE</th>
                          <th style={{ fontSize: '10px', fontWeight: 600 }}>CLIENTE / PÓLIZA</th>
                          <th style={{ fontSize: '10px', fontWeight: 600, textAlign: 'center' }}>PRIORIDAD</th>
                          <th style={{ fontSize: '10px', fontWeight: 600, textAlign: 'center' }}>VENCE</th>
                          <th style={{ fontSize: '10px', fontWeight: 600, textAlign: 'center' }}>ESTATUS</th>
                          <th style={{ fontSize: '10px', fontWeight: 600, textAlign: 'center', width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalTramites.tramites.map((t, idx) => {
                          const fechaLimite = t.fechaLimite ? new Date(t.fechaLimite) : null;
                          const hoy = new Date();
                          const esVencido = fechaLimite && fechaLimite < hoy && !['Completado', 'Cancelado', 'Rechazado'].includes(t.estatus);
                          const diasRestantes = t.diasRestantes;
                          const estaSeleccionado = tramiteSeleccionado?.id === t.id;
                          
                          return (
                            <tr 
                              key={t.id || idx} 
                              style={{ 
                                cursor: 'pointer',
                                backgroundColor: estaSeleccionado ? '#E3F2FD' : 'transparent'
                              }}
                              onClick={() => setTramiteSeleccionado(t)}
                            >
                              {/* Trámite */}
                              <td>
                                <div className="fw-semibold" style={{ color: modalTramites.color, fontSize: '11px' }}>
                                  {t.codigo || '-'}
                                </div>
                                <div className="fw-medium">{t.tipoTramite || '-'}</div>
                              </td>
                              
                              {/* Cliente / Póliza */}
                              <td>
                                <div className="fw-medium">{t.clienteNombre || t.cliente || '-'}</div>
                                <div style={{ fontSize: '11px', color: '#2563EB' }}>
                                  {t.numeroPoliza || t.expediente || '-'}
                                </div>
                              </td>
                              
                              {/* Prioridad */}
                              <td className="text-center">
                                <span className={`badge ${
                                  t.prioridad === 'Alta' ? 'bg-danger' :
                                  t.prioridad === 'Media' ? 'bg-warning text-dark' : 'bg-success'
                                }`} style={{ fontSize: '9px' }}>
                                  {t.prioridad || 'Normal'}
                                </span>
                              </td>
                              
                              {/* Vence en */}
                              <td className="text-center">
                                {diasRestantes !== null ? (
                                  <span className={`badge ${
                                    diasRestantes < 0 ? 'bg-danger' : 
                                    diasRestantes === 0 ? 'bg-danger' :
                                    diasRestantes <= 3 ? 'bg-warning text-dark' : 'bg-light text-dark'
                                  }`} style={{ fontSize: '10px' }}>
                                    {diasRestantes < 0 ? `⚠️ ${Math.abs(diasRestantes)}d` : 
                                     diasRestantes === 0 ? '⚠️ HOY' : `${diasRestantes}d`}
                                  </span>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              
                              {/* Estatus */}
                              <td className="text-center">
                                <span className={`badge ${
                                  t.estatus === 'Completado' ? 'bg-success' :
                                  t.estatus === 'En proceso' ? 'bg-primary' :
                                  t.estatus === 'Pendiente' ? 'bg-warning text-dark' :
                                  t.estatus === 'Cancelado' ? 'bg-secondary' :
                                  t.estatus === 'Rechazado' ? 'bg-dark' : 'bg-info'
                                }`} style={{ fontSize: '9px' }}>
                                  {t.estatus}
                                </span>
                              </td>
                              
                              {/* Botón Ver */}
                              <td className="text-center">
                                <button 
                                  className="btn btn-sm btn-outline-primary py-0 px-2"
                                  style={{ fontSize: '10px' }}
                                  onClick={(e) => { e.stopPropagation(); setTramiteSeleccionado(t); }}
                                >
                                  <Eye size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {/* Panel de Detalle (lado derecho) */}
                {tramiteSeleccionado && (
                  <div style={{ width: '45%', overflow: 'auto', backgroundColor: '#F8FAFC' }}>
                    <div className="p-3">
                      {/* Header del panel */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="fw-bold mb-1" style={{ color: modalTramites.color }}>
                            {tramiteSeleccionado.codigo}
                          </h6>
                          <span className={`badge ${
                            tramiteSeleccionado.estatus === 'Completado' ? 'bg-success' :
                            tramiteSeleccionado.estatus === 'En proceso' ? 'bg-primary' :
                            tramiteSeleccionado.estatus === 'Pendiente' ? 'bg-warning text-dark' : 'bg-secondary'
                          }`}>
                            {tramiteSeleccionado.estatus}
                          </span>
                        </div>
                        <button 
                          className="btn btn-sm btn-light"
                          onClick={() => setTramiteSeleccionado(null)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      
                      {/* Sección: Trámite */}
                      <div className="card mb-3 shadow-sm">
                        <div className="card-header py-2 bg-white">
                          <small className="fw-bold text-muted">📋 DATOS DEL TRÁMITE</small>
                        </div>
                        <div className="card-body py-2" style={{ fontSize: '12px' }}>
                          <div className="row g-2">
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Tipo</label>
                              <div className="fw-medium">{tramiteSeleccionado.tipoTramite || '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Prioridad</label>
                              <div>
                                <span className={`badge ${
                                  tramiteSeleccionado.prioridad === 'Alta' ? 'bg-danger' :
                                  tramiteSeleccionado.prioridad === 'Media' ? 'bg-warning text-dark' : 'bg-success'
                                }`}>
                                  {tramiteSeleccionado.prioridad || 'Normal'}
                                </span>
                              </div>
                            </div>
                            <div className="col-12">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Descripción</label>
                              <div>{tramiteSeleccionado.descripcion || 'Sin descripción'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Fecha Solicitud</label>
                              <div>{tramiteSeleccionado.fechaCreacion ? new Date(tramiteSeleccionado.fechaCreacion).toLocaleDateString('es-MX') : '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Fecha Límite</label>
                              <div className={tramiteSeleccionado.diasRestantes < 0 ? 'text-danger fw-bold' : ''}>
                                {tramiteSeleccionado.fechaLimite ? new Date(tramiteSeleccionado.fechaLimite).toLocaleDateString('es-MX') : '-'}
                                {tramiteSeleccionado.diasRestantes !== null && (
                                  <span className={`ms-1 badge ${
                                    tramiteSeleccionado.diasRestantes < 0 ? 'bg-danger' : 
                                    tramiteSeleccionado.diasRestantes <= 3 ? 'bg-warning text-dark' : 'bg-light text-dark'
                                  }`} style={{ fontSize: '9px' }}>
                                    {tramiteSeleccionado.diasRestantes < 0 ? `${Math.abs(tramiteSeleccionado.diasRestantes)}d vencido` : 
                                     tramiteSeleccionado.diasRestantes === 0 ? 'HOY' : `${tramiteSeleccionado.diasRestantes}d restantes`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Sección: Póliza */}
                      <div className="card mb-3 shadow-sm">
                        <div className="card-header py-2 bg-white">
                          <small className="fw-bold text-muted">📄 DATOS DE LA PÓLIZA</small>
                        </div>
                        <div className="card-body py-2" style={{ fontSize: '12px' }}>
                          <div className="row g-2">
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Número de Póliza</label>
                              <div className="fw-bold" style={{ color: '#2563EB' }}>{tramiteSeleccionado.numeroPoliza || tramiteSeleccionado.expediente || '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Aseguradora</label>
                              <div className="fw-medium">🏢 {tramiteSeleccionado.aseguradora || '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Producto</label>
                              <div>{tramiteSeleccionado.tipoSeguro || '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Etapa</label>
                              <div>
                                <span className={`badge ${
                                  tramiteSeleccionado.etapaActiva === 'Emitida' ? 'bg-success' :
                                  tramiteSeleccionado.etapaActiva === 'Captura' ? 'bg-info' :
                                  tramiteSeleccionado.etapaActiva === 'Cotización' ? 'bg-secondary' : 'bg-light text-dark'
                                }`} style={{ fontSize: '10px' }}>
                                  {tramiteSeleccionado.etapaActiva || '-'}
                                </span>
                              </div>
                            </div>
                            <div className="col-12">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Vigencia</label>
                              <div>📅 {tramiteSeleccionado.vigencia || '-'}</div>
                            </div>
                            {tramiteSeleccionado.vehiculo && (
                              <>
                                <div className="col-12" style={{ borderTop: '1px dashed #dee2e6', paddingTop: '8px', marginTop: '4px' }}>
                                  <label className="text-muted" style={{ fontSize: '10px' }}>Vehículo Asegurado</label>
                                  <div className="fw-medium">🚗 {tramiteSeleccionado.vehiculo}</div>
                                </div>
                                <div className="col-6">
                                  <label className="text-muted" style={{ fontSize: '10px' }}>Placas</label>
                                  <div>{tramiteSeleccionado.placas || '-'}</div>
                                </div>
                                {tramiteSeleccionado.numeroSerie && (
                                  <div className="col-6">
                                    <label className="text-muted" style={{ fontSize: '10px' }}>No. Serie</label>
                                    <div style={{ fontSize: '10px' }}>{tramiteSeleccionado.numeroSerie}</div>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Tipo de Pago</label>
                              <div>{tramiteSeleccionado.tipoPago || '-'}</div>
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Estatus Pago</label>
                              <div>
                                <span className={`badge ${
                                  tramiteSeleccionado.estatusPago === 'Pagado' || tramiteSeleccionado.estatusPago === 'Pagada' ? 'bg-success' :
                                  tramiteSeleccionado.estatusPago === 'Pendiente' ? 'bg-warning text-dark' : 'bg-secondary'
                                }`} style={{ fontSize: '10px' }}>
                                  {tramiteSeleccionado.estatusPago || '-'}
                                </span>
                              </div>
                            </div>
                            {tramiteSeleccionado.total && (
                              <div className="col-12">
                                <label className="text-muted" style={{ fontSize: '10px' }}>Prima Total</label>
                                <div className="fw-bold text-success">
                                  ${Number(tramiteSeleccionado.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Sección: Personas */}
                      <div className="card mb-3 shadow-sm">
                        <div className="card-header py-2 bg-white">
                          <small className="fw-bold text-muted">👥 PERSONAS INVOLUCRADAS</small>
                        </div>
                        <div className="card-body py-2" style={{ fontSize: '12px' }}>
                          <div className="row g-2">
                            <div className="col-12">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Cliente</label>
                              <div className="fw-medium"><User size={12} className="me-1" />{tramiteSeleccionado.clienteNombre || tramiteSeleccionado.cliente || '-'}</div>
                            </div>
                            {(tramiteSeleccionado.emailCliente || tramiteSeleccionado.telefonoCliente) && (
                              <div className="col-12">
                                <label className="text-muted" style={{ fontSize: '10px' }}>Contacto</label>
                                <div style={{ fontSize: '11px' }}>
                                  {tramiteSeleccionado.emailCliente && (
                                    <span className="me-2">📧 {tramiteSeleccionado.emailCliente}</span>
                                  )}
                                  {tramiteSeleccionado.telefonoCliente && (
                                    <span>📱 {tramiteSeleccionado.telefonoCliente}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Agente/Vendedor</label>
                              <div><Briefcase size={12} className="me-1" />{tramiteSeleccionado.agente || '-'}</div>
                              {tramiteSeleccionado.subAgente && (
                                <div className="text-muted" style={{ fontSize: '10px' }}>Sub: {tramiteSeleccionado.subAgente}</div>
                              )}
                            </div>
                            <div className="col-6">
                              <label className="text-muted" style={{ fontSize: '10px' }}>Ejecutivo Asignado</label>
                              <div><UserCheck size={12} className="me-1" />{tramiteSeleccionado.responsable || tramiteSeleccionado.ejecutivoAsignado || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Observaciones */}
                      {tramiteSeleccionado.observaciones && (
                        <div className="card mb-3 shadow-sm">
                          <div className="card-header py-2 bg-white">
                            <small className="fw-bold text-muted">💬 OBSERVACIONES</small>
                          </div>
                          <div className="card-body py-2" style={{ fontSize: '12px' }}>
                            {tramiteSeleccionado.observaciones}
                          </div>
                        </div>
                      )}
                      
                      {/* Acciones rápidas */}
                      <div className="card shadow-sm">
                        <div className="card-header py-2 bg-white">
                          <small className="fw-bold text-muted">⚡ ACCIONES RÁPIDAS</small>
                        </div>
                        <div className="card-body py-2">
                          <div className="d-flex flex-wrap gap-2">
                            {/* Botón Enviar a Ejecutivo - solo si está Pendiente */}
                            {tramiteSeleccionado.estatus === 'Pendiente' && (
                              <button 
                                className="btn btn-sm btn-warning"
                                onClick={() => abrirModalEnviarEjecutivo(tramiteSeleccionado)}
                              >
                                <Send size={12} className="me-1" />Enviar a Ejecutivo
                              </button>
                            )}
                            
                            {/* Botón Atender - solo si está Pendiente o Solicitado */}
                            {(tramiteSeleccionado.estatus === 'Pendiente' || tramiteSeleccionado.estatus === 'Solicitado') && (
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={() => cambiarEstatusTramite(tramiteSeleccionado, 'En proceso')}
                              >
                                <Activity size={12} className="me-1" />Atender
                              </button>
                            )}
                            
                            {/* Botón Completar - solo si está En proceso */}
                            {tramiteSeleccionado.estatus === 'En proceso' && (
                              <button 
                                className="btn btn-sm btn-success"
                                onClick={() => cambiarEstatusTramite(tramiteSeleccionado, 'Completado')}
                              >
                                <CheckCircle size={12} className="me-1" />Completar
                              </button>
                            )}
                            
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => { setModalTramites(null); setTramiteSeleccionado(null); navigate('/tramites'); }}
                            >
                              <Edit size={12} className="me-1" />Editar Trámite
                            </button>
                            <button className="btn btn-sm btn-outline-secondary">
                              <Clock size={12} className="me-1" />Posponer
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Footer del modal */}
              <div className="modal-footer py-2">
                <span className="text-muted me-auto" style={{ fontSize: '11px' }}>
                  💡 Clic en una fila o en 👁️ para ver detalle
                </span>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => { setModalTramites(null); setTramiteSeleccionado(null); }}>
                  Cerrar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={() => { setModalTramites(null); setTramiteSeleccionado(null); navigate('/tramites'); }}>
                  <FileCheck size={14} className="me-1" />
                  Ir a Gestión de Trámites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENVIAR A EJECUTIVO */}
      {modalEnviarEjecutivo && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }} onClick={() => setModalEnviarEjecutivo(null)}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark py-3">
                <h5 className="modal-title fw-bold mb-0">
                  <Send size={18} className="me-2" />
                  Enviar Trámite a Ejecutivo
                </h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setModalEnviarEjecutivo(null)}>
                </button>
              </div>
              
              <div className="modal-body">
                {/* Resumen del trámite */}
                <div className="bg-light rounded p-3 mb-4">
                  <div className="row g-2" style={{ fontSize: '13px' }}>
                    <div className="col-6">
                      <small className="text-muted d-block">Código</small>
                      <span className="fw-bold">{modalEnviarEjecutivo.codigo}</span>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Tipo</small>
                      <span>{modalEnviarEjecutivo.tipoTramite}</span>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Cliente</small>
                      <span>{modalEnviarEjecutivo.clienteNombre || modalEnviarEjecutivo.cliente}</span>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Ejecutivo</small>
                      <span className="fw-medium">{modalEnviarEjecutivo.responsable || modalEnviarEjecutivo.ejecutivoAsignado || 'Por asignar'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Opciones de envío */}
                <p className="text-muted text-center mb-3" style={{ fontSize: '13px' }}>
                  Selecciona cómo deseas enviar la solicitud:
                </p>
                
                <div className="d-flex gap-3 justify-content-center">
                  {/* Botón WhatsApp */}
                  <button
                    className="btn btn-lg d-flex flex-column align-items-center p-3"
                    style={{ 
                      backgroundColor: '#25D366', 
                      color: 'white',
                      borderRadius: '12px',
                      minWidth: '140px'
                    }}
                    onClick={() => enviarTramiteAEjecutivo(modalEnviarEjecutivo, 'whatsapp')}
                  >
                    <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                    </svg>
                    <span className="mt-2 fw-medium">WhatsApp</span>
                  </button>
                  
                  {/* Botón Email */}
                  <button
                    className="btn btn-lg d-flex flex-column align-items-center p-3"
                    style={{ 
                      backgroundColor: '#EA4335', 
                      color: 'white',
                      borderRadius: '12px',
                      minWidth: '140px'
                    }}
                    onClick={() => enviarTramiteAEjecutivo(modalEnviarEjecutivo, 'email')}
                  >
                    <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/>
                    </svg>
                    <span className="mt-2 fw-medium">Email</span>
                  </button>
                </div>
                
                <p className="text-center text-muted mt-4 mb-0" style={{ fontSize: '11px' }}>
                  ℹ️ El trámite cambiará a estado "Solicitado" al enviar
                </p>
              </div>
              
              <div className="modal-footer py-2">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setModalEnviarEjecutivo(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardComponent;

/**
 * ====================================================================
 * COMPONENTE: CALENDARIO DE PAGOS
 * ====================================================================
 * Tabla de pagos con resumen, cálculo de estados y botones de aviso
 */

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Mail, Trash2, Upload, Download, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { CONSTANTS } from '../../utils/expedientesConstants';
import utils from '../../utils/expedientesUtils';
import * as estatusPagosUtils from '../../utils/estatusPagos';
import { subirReciboPago, obtenerReciboPagoURL, obtenerURLFirmadaPDF, obtenerComprobantePagoURL } from '../../services/pdfService';
import { Badge } from './UIComponents';

const CalendarioPagos = ({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false,
  onEnviarAviso, // Callback para enviar avisos de pago
  onEliminarPago, // Callback para eliminar un pago (abre modal de confirmación)
  onRecibosCalculados, // 📸 Callback para notificar que se calcularon recibos
  onRecibosArchivos, // 📎 Callback para entregar archivos de recibo seleccionados (pre-guardado)
  modoPreGuardado = false, // true = expediente aún no guardado, no subir a S3
  historial = [] // Historial de eventos para encontrar comprobantes
}) => {
  // === Estado para recibos de pago de aseguradora ===
  const [subiendoRecibo, setSubiendoRecibo] = useState(null); // número de recibo que se está subiendo
  const [recibosSubidos, setRecibosSubidos] = useState({}); // {numero: {subido, nombre}}
  const fileInputRef = useRef(null);
  const [reciboSeleccionado, setReciboSeleccionado] = useState(null); // para saber qué pago quiere subir

  // Inicializar recibosSubidos con los datos del backend al montar/cambiar expediente
  useEffect(() => {
    if (expediente?.recibos && Array.isArray(expediente.recibos)) {
      const subidos = {};
      expediente.recibos.forEach(r => {
        if (r.recibo_pago_url) {
          subidos[r.numero_recibo] = { subido: true, nombre: r.recibo_pago_nombre || 'recibo' };
        }
      });
      if (Object.keys(subidos).length > 0) {
        setRecibosSubidos(prev => ({ ...subidos, ...prev }));
      }
    }
  }, [expediente?.id, expediente?.recibos]);

  // Normalizar campos (aceptar múltiples nombres)
  const tipoPago = expediente.tipo_pago || expediente.forma_pago;
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  
  // Validar que tenga los datos mínimos necesarios
  if (!expediente.inicio_vigencia) {
    console.log('❌ CalendarioPagos - No hay inicio_vigencia, no se renderiza');
    return null;
  }
  
  // Determinar si es Anual o Fraccionado
  const esAnual = tipoPago?.toUpperCase() === 'ANUAL' || tipoPago?.toUpperCase() === 'CONTADO';
  const esFraccionado = tipoPago?.toUpperCase() === 'FRACCIONADO';
  
  // Si no es ninguno de los dos, no mostrar
  if (!esAnual && !esFraccionado) {
    console.log('❌ CalendarioPagos - No es Anual ni Fraccionado, no se renderiza');
    return null;
  }
  
  // Para fraccionado, validar que tenga frecuencia
  if (esFraccionado && !frecuencia) {
    console.log('❌ CalendarioPagos - Es Fraccionado pero NO hay frecuencia, no se renderiza');
    return null;
  }

  // Determinar número de pagos: 1 para Anual, según frecuencia para Fraccionado
  const numeroPagos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
  
  // 🔥 useMemo para recalcular pagos cuando cambien las dependencias importantes
  const pagos = React.useMemo(() => {
    let pagosList = [];
    
    // 🔥 PRIORIDAD: Si el backend envía los recibos, usarlos directamente
    if (expediente.recibos && Array.isArray(expediente.recibos) && expediente.recibos.length > 0) {
      pagosList = expediente.recibos
        .filter(r => r.numero_recibo <= numeroPagos)
        .map(r => {
          // IMPORTANTE: Solo usar estatusBackend si el recibo tiene estatus del backend
          // Si no tiene estatus, dejarlo sin estatusBackend para que se calcule en frontend
          const tieneEstatusBackend = r.estatus || r.estatus_pago;
          const estatusNormalizado = tieneEstatusBackend ? estatusPagosUtils.normalizarEstatusBackend(r.estatus || r.estatus_pago) : null;
          
          return {
            numero: r.numero_recibo,
            fecha: r.fecha_vencimiento,
            monto: parseFloat(r.monto).toFixed(2),
            estatusBackend: estatusNormalizado, // Puede ser null si no viene del backend
            comprobante_url: r.comprobante_url,
            comprobante_nombre: r.comprobante_nombre,
            fecha_pago_real: r.fecha_pago_real,
            recibo_pago_url: r.recibo_pago_url
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
          
          pagosList.push({
            numero: i,
            fecha: fechaPago,
            monto: monto
          });
        }
      }
    }
    
    return pagosList;
  }, [
    expediente.inicio_vigencia,
    expediente.tipo_pago,
    expediente.forma_pago,
    expediente.frecuenciaPago,
    expediente.frecuencia_pago,
    expediente.periodo_gracia,
    expediente.compania,
    expediente.total,
    expediente.primer_pago,
    expediente.primerPago,
    expediente.pagos_subsecuentes,
    expediente.pagosSubsecuentes,
    expediente.recibos,
    numeroPagos,
    tipoPago,
    frecuencia,
    calcularProximoPago
  ]);

  // 📸 Notificar que se calcularon los recibos (cada vez que cambien fechas clave)
  const recibosCalculadosRef = React.useRef(false);
  const ultimoInicioVigenciaRef = React.useRef(expediente.inicio_vigencia);
  const ultimoTipoPagoRef = React.useRef(tipoPago);
  const ultimaFrecuenciaRef = React.useRef(frecuencia);
  
  // 🔄 Resetear el flag cuando cambien datos que afectan los recibos
  React.useEffect(() => {
    if (
      ultimoInicioVigenciaRef.current !== expediente.inicio_vigencia ||
      ultimoTipoPagoRef.current !== tipoPago ||
      ultimaFrecuenciaRef.current !== frecuencia
    ) {
      console.log('🔄 CalendarioPagos: Detectado cambio en fechas/tipo de pago, reseteando flag de notificación');
      recibosCalculadosRef.current = false;
      ultimoInicioVigenciaRef.current = expediente.inicio_vigencia;
      ultimoTipoPagoRef.current = tipoPago;
      ultimaFrecuenciaRef.current = frecuencia;
    }
  }, [expediente.inicio_vigencia, tipoPago, frecuencia]);
  
  // Crear un hash de las fechas para detectar cambios
  const hashFechasPagos = React.useMemo(() => {
    return pagos.map(p => `${p.numero}:${p.fecha}:${p.monto}`).join('|');
  }, [pagos]);
  
  React.useEffect(() => {
    if (onRecibosCalculados && pagos.length > 0 && !expediente.recibos?.length && !recibosCalculadosRef.current) {
      const recibosParaSnapshot = pagos.map(p => ({
        numero_recibo: p.numero,
        fecha_vencimiento: p.fecha,
        monto: p.monto
        // NO incluir estatus - se calculará dinámicamente cada vez
      }));
      console.log('📅 CalendarioPagos: Notificando recibos calculados al formulario');
      console.log('📅 Cantidad de recibos:', recibosParaSnapshot.length);
      console.log('📅 Recibos:', recibosParaSnapshot);
      onRecibosCalculados(recibosParaSnapshot);
      recibosCalculadosRef.current = true;
    }
  }, [pagos.length, hashFechasPagos, onRecibosCalculados, expediente.recibos?.length]);
  // 🔙 Detectar pagos que fueron removidos (buscar en historial)
  const pagosRemovidos = React.useMemo(() => {
    if (!historial || !Array.isArray(historial)) return {};
    
    const removidos = {};
    historial.forEach(evento => {
      if (evento.tipo_evento === 'pago_removido' && evento.datos_adicionales?.numero_recibo) {
        const numRecibo = evento.datos_adicionales.numero_recibo;
        // Guardar el más reciente
        if (!removidos[numRecibo] || new Date(evento.fecha_evento) > new Date(removidos[numRecibo].fecha)) {
          removidos[numRecibo] = {
            fecha: evento.fecha_evento,
            motivo: evento.datos_adicionales.motivo || 'No especificado'
          };
        }
      }
    });
    return removidos;
  }, [historial]);
  // �🔥 Usar ultimo_recibo_pagado en lugar de fecha_ultimo_pago
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
      
      // 🔧 Detectar variantes de "Por Vencer"
      const esPorVencer = estatusNorm === 'pago por vencer' || 
                          estatusNorm === 'por vencer' || 
                          estatusNorm.includes('por vencer');
      
      if (pagado) {
        totalPagado += parseFloat(pago.monto) || 0;
      } else if (estatusNorm === 'vencido') {
        totalVencido += parseFloat(pago.monto) || 0;
      } else if (esPorVencer) {
        totalPorVencer += parseFloat(pago.monto) || 0;
      } else {
        totalPendiente += parseFloat(pago.monto) || 0;
      }
      
      let estado = pago.estatusBackend;
      let badgeClass = 'bg-info'; // Pendiente = azul
      
      if (estatusNorm === 'pagado') {
        badgeClass = 'bg-success';
      } else if (estatusNorm === 'vencido') {
        badgeClass = 'bg-danger';
      } else if (esPorVencer) {
        badgeClass = 'bg-warning text-dark';
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
    let badgeClass = 'bg-info'; // Pendiente = azul
    
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
      badgeClass = 'bg-warning text-dark';
    } else {
      // Pendiente: cuando falta más de 15 días (aún no urgente)
      estado = 'Pendiente';
      badgeClass = 'bg-info';
    }
    
    // console.log(`✅ [RECIBO ${pago.numero}] Estado calculado en frontend: "${estado}" | Badge: ${badgeClass}`);
    return { ...pago, estado, badgeClass, pagado, totalPagos: numeroPagos };
  });

  // ====================================================================
  // HANDLERS: Recibo de pago de aseguradora (subir/ver)
  // ====================================================================
  
  /**
   * Abre el selector de archivo para subir recibo de pago
   */
  const handleClickSubirRecibo = (numeroPago) => {
    setReciboSeleccionado(numeroPago);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset para permitir re-selección
      fileInputRef.current.click();
    }
  };

  /**
   * Procesa el archivo seleccionado y lo sube a S3 (o lo guarda localmente si es pre-guardado)
   */
  const handleArchivoRecibo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !reciboSeleccionado) return;

    // === Modo pre-guardado: guardar archivo localmente, no subir a S3 ===
    if (modoPreGuardado) {
      setRecibosSubidos(prev => {
        const nuevos = {
          ...prev,
          [reciboSeleccionado]: {
            subido: true,
            nombre: file.name,
            archivo: file // Guardar referencia al File para subir después
          }
        };
        // Notificar al padre los archivos pendientes
        if (onRecibosArchivos) {
          const archivos = {};
          Object.entries(nuevos).forEach(([num, data]) => {
            if (data.archivo) archivos[num] = data.archivo;
          });
          onRecibosArchivos(archivos);
        }
        return nuevos;
      });
      toast.success(`📎 Recibo #${reciboSeleccionado} adjuntado - se subirá al guardar`);
      setReciboSeleccionado(null);
      return;
    }

    // === Modo normal: subir directamente a S3 ===
    setSubiendoRecibo(reciboSeleccionado);
    try {
      const resultado = await subirReciboPago(expediente.id, reciboSeleccionado, file);
      
      // Guardar referencia local del recibo subido (solo marcar como subido, NO guardar URL directa de S3)
      setRecibosSubidos(prev => ({
        ...prev,
        [reciboSeleccionado]: {
          subido: true,
          nombre: file.name
        }
      }));

      // Feedback visual
      if (window.toast) {
        window.toast.success(`✅ Recibo #${reciboSeleccionado} subido correctamente`);
      } else {
        alert(`Recibo #${reciboSeleccionado} subido correctamente`);
      }
    } catch (error) {
      console.error('❌ Error al subir recibo:', error);
      if (window.toast) {
        window.toast.error(`Error al subir recibo: ${error.message}`);
      } else {
        alert(`Error al subir recibo: ${error.message}`);
      }
    } finally {
      setSubiendoRecibo(null);
      setReciboSeleccionado(null);
    }
  };

  /**
   * Abre en nueva pestaña el recibo de pago (URL firmada)
   */
  const handleVerRecibo = async (numeroPago) => {
    try {
      // Siempre obtener URL firmada del backend (las URLs directas de S3 dan Access Denied)
      const data = await obtenerReciboPagoURL(expediente.id, numeroPago);
      if (data?.url || data?.signed_url) {
        window.open(data.url || data.signed_url, '_blank');
      } else {
        alert('No se encontró el recibo de pago para este período');
      }
    } catch (error) {
      console.error('❌ Error al obtener recibo:', error);
      alert('Error al obtener el recibo de pago');
    }
  };

  /**
   * Determina si un pago tiene recibo de aseguradora subido
   */
  const tieneReciboAseguradora = (pago) => {
    return !!(recibosSubidos[pago.numero]?.subido || pago.recibo_pago_url);
  };

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
              <div className="card bg-warning h-100">
                <div className="card-body text-center p-2">
                  <small className="text-dark d-block mb-1">⚠️ Por Vencer</small>
                  <h5 className="mb-0 text-dark">{utils.formatearMoneda(totalPorVencer)}</h5>
                  <small className="text-dark d-block mt-1">≤ 15 días</small>
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
          {/* Input oculto para seleccionar archivo de recibo */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleArchivoRecibo}
          />
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th width="80">Pago #</th>
                <th>Fecha de Pago</th>
                <th>Monto</th>
                <th width="150">Estado</th>
                {expediente?.pdf_url && <th width="80" className="text-center">Póliza</th>}
                <th width="100" className="text-center">Recibo</th>
                {!modoPreGuardado && <th width="150">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {pagosProcesados.map((pago) => {
                const fueRemovido = pagosRemovidos[pago.numero];
                
                return (
                <tr key={pago.numero} className={pago.pagado ? 'table-success' : ''}>
                  <td><strong>#{pago.numero}</strong></td>
                  <td>{utils.formatearFecha(pago.fecha, 'larga')}</td>
                  <td><strong>${pago.monto}</strong></td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <span className={`badge ${pago.badgeClass}`}>
                        {pago.pagado && '✓ '}
                        {pago.estado}
                      </span>
                      {/* Indicador de pago removido */}
                      {fueRemovido && !pago.pagado && (
                        <span 
                          className="badge bg-warning text-dark" 
                          style={{ fontSize: '0.65rem', cursor: 'help' }}
                          title={`Pago removido: ${fueRemovido.motivo}`}
                        >
                          🔙 Removido
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Columna: Póliza PDF (solo en primer recibo) */}
                  {expediente?.pdf_url && (
                    <td className="text-center">
                      {pago.numero === 1 ? (
                        <button
                          className="btn btn-sm btn-outline-info"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={async () => {
                            try {
                              const { signed_url } = await obtenerURLFirmadaPDF(expediente.id, 3600);
                              const win = window.open(signed_url, '_blank', 'noopener,noreferrer');
                              if (win) win.opener = null;
                            } catch (err) {
                              alert('No se pudo abrir el PDF: ' + (err?.message || 'desconocido'));
                            }
                          }}
                          title="Ver PDF de la póliza"
                        >
                          <FileText size={12} />
                        </button>
                      ) : null}
                    </td>
                  )}
                  {/* Columna: Recibo de pago de la aseguradora */}
                  <td className="text-center">
                    {subiendoRecibo === pago.numero ? (
                      <button 
                        className="btn btn-sm btn-outline-secondary" 
                        disabled
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        <Loader size={12} className="spinner-border spinner-border-sm" />
                      </button>
                    ) : tieneReciboAseguradora(pago) ? (
                      <div className="d-flex gap-1 justify-content-center">
                        {!modoPreGuardado && (
                          <button
                            className="btn btn-sm btn-outline-success"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleVerRecibo(pago.numero)}
                            title="Ver recibo de pago de aseguradora"
                          >
                            <Download size={12} />
                          </button>
                        )}
                        {modoPreGuardado && (
                          <span className="badge bg-success" style={{ fontSize: '0.65rem' }}
                            title={recibosSubidos[pago.numero]?.nombre}>
                            ✓ {recibosSubidos[pago.numero]?.nombre?.substring(0, 15) || 'Adjunto'}
                          </span>
                        )}
                        <button
                          className="btn btn-sm btn-outline-warning"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}
                          onClick={() => handleClickSubirRecibo(pago.numero)}
                          title={modoPreGuardado ? 'Cambiar recibo adjunto' : 'Reemplazar recibo'}
                        >
                          <Upload size={10} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleClickSubirRecibo(pago.numero)}
                        title={modoPreGuardado ? 'Adjuntar recibo de pago' : 'Subir recibo de pago de aseguradora'}
                      >
                        <Upload size={12} />
                      </button>
                    )}
                  </td>
                  {!modoPreGuardado && (
                  <td>
                    <div className="d-flex gap-1">
                    {pago.pagado ? (
                      <>
                        {/* Botón para ver comprobante de pago */}
                        <button 
                          className="btn btn-outline-success btn-sm"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={async () => {
                          try {
                            // Intentar obtener URL firmada del backend
                            const data = await obtenerComprobantePagoURL(expediente.id, pago.numero);
                            if (data?.url || data?.signed_url) {
                              window.open(data.url || data.signed_url, '_blank');
                              return;
                            }
                          } catch (err) {
                            console.warn('⚠️ No se pudo obtener URL firmada del comprobante:', err.message);
                          }

                          // Fallback: usar URL directa del recibo
                          if (pago.comprobante_url) {
                            console.log('📎 Usando URL directa del comprobante:', pago.comprobante_url);
                            window.open(pago.comprobante_url, '_blank');
                            return;
                          }

                          // Último fallback: buscar en historial por numero_recibo
                          const eventoPago = historial.find(evento => {
                            return evento.tipo_evento === 'pago_registrado' &&
                              evento.datos_adicionales?.numero_recibo === pago.numero &&
                              evento.datos_adicionales?.comprobante_url;
                          });
                          
                          if (eventoPago?.datos_adicionales?.comprobante_url) {
                            window.open(eventoPago.datos_adicionales.comprobante_url, '_blank');
                          } else {
                            alert('No se encontró el comprobante de pago para este recibo');
                          }
                        }}
                        title="Ver comprobante de pago"
                      >
                        <FileText size={12} />
                        </button>
                      
                        {/* Botón para eliminar pago */}
                        {onEliminarPago && (
                          <button 
                            className="btn btn-outline-danger btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => onEliminarPago(pago, expediente)}
                            title="Eliminar pago"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    ) : (
                      // Botón para enviar aviso/recordatorio
                      <button 
                        className={`btn btn-sm ${pago.estado === 'Vencido' ? 'btn-danger' : 'btn-outline-info'}`}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => onEnviarAviso && onEnviarAviso(pago, expediente)}
                        title={pago.estado === 'Vencido' ? 'Enviar recordatorio de pago vencido' : 'Enviar aviso de pago'}
                      >
                        <Mail size={12} />
                      </button>
                    )}
                    </div>
                  </td>
                  )}
                </tr>
                );
              })}
            </tbody>
            {expediente.total && (
              <tfoot>
                <tr className="table-info">
                  <td colSpan="3" className="text-end"><strong>Total Anual:</strong></td>
                  <td colSpan={modoPreGuardado ? 2 : 3}><strong>{utils.formatearMoneda(expediente.total)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

CalendarioPagos.displayName = 'CalendarioPagos';

export default CalendarioPagos;

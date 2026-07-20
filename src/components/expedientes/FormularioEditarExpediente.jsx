/**
 * ====================================================================
 * WRAPPER: FORMULARIO EDITAR EXPEDIENTE
 * ====================================================================
 * Componente específico para EDITAR expedientes existentes
 * - Captura snapshot inicial (formularioOriginal) para logs de cambios
 * - Sección de visualización/gestión de PDF ya subido
 * - Detecta cambios entre formularioOriginal y formulario actual
 * - Prepara datos para auditoría (pendiente implementación)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, FileText, Eye, Trash2, Upload, Loader } from 'lucide-react';
import FormularioExpedienteBase from './FormularioExpedienteBase';
import ExtractorPolizasPDF from './ExtractorPolizasPDF';
import * as pdfService from '../../services/pdfService';
import * as historialExpedienteService from '../../services/historialExpedienteService';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

const FormularioEditarExpediente = ({ 
  // Props heredadas del padre
  setVistaActual,
  formulario,
  setFormulario,
  actualizarCalculosAutomaticos,
  guardarExpediente,
  companias,
  productos,
  aseguradoras,
  tiposProductos,
  etapasActivas,
  agentes,
  tiposPago,
  frecuenciasPago,
  periodosGracia,
  estatusPago,
  marcasVehiculo,
  tiposVehiculo,
  tiposCobertura,
  calculartermino_vigencia,
  calcularProximoPago,
  handleClienteSeleccionado,
  clienteSeleccionado,
  onEliminarPago,
  onCrearAgenteNuevo,
  guardando = false
}) => {
  // 📸 SNAPSHOT: Estado original para detectar cambios
  const [formularioOriginal, setFormularioOriginal] = useState(null);
  
  // Estados para manejo de PDF existente
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [subiendoPDF, setSubiendoPDF] = useState(false);
  const [mostrarExtractorEndoso, setMostrarExtractorEndoso] = useState(false);
  const [mostrarModalSeleccionEndoso, setMostrarModalSeleccionEndoso] = useState(false);
  const [infoEndoso, setInfoEndoso] = useState(null);
  const [requiereAjusteEconomicoQualitas, setRequiereAjusteEconomicoQualitas] = useState(false);

  /**
   * 🔍 CAPTURAR SNAPSHOT al montar el componente
   * Este snapshot se usará para generar logs de auditoría
   */
  useEffect(() => {
    if (formulario && !formularioOriginal) {
      console.log('📸 Capturando snapshot del formulario original para logs de auditoría');
      setFormularioOriginal({...formulario});
    }
  }, [formulario, formularioOriginal]);

  const normalizarRecibos = useCallback((recibos) => {
    if (!recibos) return [];
    if (typeof recibos === 'string') {
      try {
        const parsed = JSON.parse(recibos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(recibos) ? recibos : [];
  }, []);

  const tieneRecibosPagados = useCallback((recibos) => {
    return normalizarRecibos(recibos).some(recibo => {
      const estatus = String(recibo.estatus || recibo.estatus_pago || '').toLowerCase();
      return Boolean(recibo.fecha_pago_real) || estatus === 'pagado';
    });
  }, [normalizarRecibos]);

  const construirRecibosComplementariosQualitas = useCallback((recibosBase, datosAjuste) => {
    const base = normalizarRecibos(recibosBase).filter(recibo => !recibo.es_endoso_complementario);
    if (base.length === 0) return [];

    const primer = parseFloat(datosAjuste.primer_pago || 0) || 0;
    const subsecuente = parseFloat(datosAjuste.pagos_subsecuentes || 0) || primer;

    return base.map((recibo, index) => {
      const numeroBase = String(recibo.numero_base || recibo.numero_recibo || index + 1);
      const monto = index === 0 ? primer : subsecuente;
      return {
        numero_recibo: base.length + index + 1,
        numero_base: numeroBase,
        numero_mostrar: `${numeroBase}-E`,
        es_endoso_complementario: true,
        tipo_recibo: 'endoso_economico',
        fecha_vencimiento: recibo.fecha_vencimiento,
        fecha_pago_real: '',
        monto: monto.toFixed(2),
        estatus_pago: recibo.estatus_pago || 'Pendiente',
        origen_endoso: datosAjuste.numero_endoso || datosAjuste.endoso || ''
      };
    });
  }, [normalizarRecibos]);

  const handleDatosExtraidosEndoso = useCallback((datosExtraidos) => {
    const esQualitas = String(datosExtraidos.compania || formulario.compania || '').toLowerCase().includes('qualitas');
    const esAjusteEconomico = datosExtraidos.es_endoso_economico === true || datosExtraidos.tipo_endoso === 'ajuste_economico';
    const cambioTipoPago = Boolean(datosExtraidos.tipo_pago && datosExtraidos.tipo_pago !== (formularioOriginal?.tipo_pago || formulario.tipo_pago));
    const cambioFrecuencia = Boolean(datosExtraidos.frecuenciaPago && datosExtraidos.frecuenciaPago !== (formularioOriginal?.frecuenciaPago || formulario.frecuenciaPago));

    if (requiereAjusteEconomicoQualitas && !esAjusteEconomico) {
      toast.error('El segundo archivo debe ser el endoso económico de Qualitas (A-AJUSTE).');
      setMostrarExtractorEndoso(false);
      return;
    }

    if (esAjusteEconomico) {
      const recibosCombinados = (() => {
        const base = normalizarRecibos(formulario.recibos).filter(recibo => !recibo.es_endoso_complementario).map((recibo, index) => ({
          ...recibo,
          numero_base: String(recibo.numero_base || recibo.numero_recibo || index + 1),
          numero_mostrar: String(recibo.numero_mostrar || recibo.numero_recibo || index + 1)
        }));
        const complementarios = construirRecibosComplementariosQualitas(base, datosExtraidos);
        return [...base, ...complementarios];
      })();

      setFormulario(prev => ({
        ...prev,
        recibos: recibosCombinados,
        _modo_endoso: true,
        _metodo_captura: 'endoso_pdf',
        _tiene_recibos_complementarios: true,
        _force_recibo_regeneration: false,
        _tipo_endoso_economico_cargado: true,
        _numero_endoso_economico: datosExtraidos.numero_endoso || datosExtraidos.endoso || prev._numero_endoso_economico || ''
      }));

      setRequiereAjusteEconomicoQualitas(false);
      setInfoEndoso(prev => ({
        ...(prev || {}),
        archivo_ajuste: datosExtraidos.__pdfNombre || 'PDF de ajuste económico',
        numero_endoso_ajuste: datosExtraidos.numero_endoso || datosExtraidos.endoso || '',
        ajuste_economico_cargado: true
      }));
      setMostrarExtractorEndoso(false);
      toast.success('Ajuste económico Qualitas cargado. Se generaron los recibos complementarios en el calendario.');
      return;
    }

    const agenteDisplay = datosExtraidos.clave_agente && datosExtraidos.agente
      ? `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}`
      : (datosExtraidos.agente || formulario.agente || '');

    const endosoNumero = datosExtraidos.numero_endoso || datosExtraidos.endoso || formulario.numero_endoso || '';
    const esFraccionado = datosExtraidos.tipo_pago === 'Fraccionado';
    const recargoExtraido = datosExtraidos.cargo_pago_fraccionado ?? formulario.cargo_pago_fraccionado ?? '';
    const recibosExtraidos = Array.isArray(datosExtraidos.recibos) ? datosExtraidos.recibos : [];

    setFormulario(prev => ({
      ...prev,
      numero_endoso: endosoNumero,
      movimiento: 'Endoso',
      compania: datosExtraidos.compania || prev.compania,
      producto: datosExtraidos.producto || prev.producto,
      forma_pago: datosExtraidos.forma_pago || prev.forma_pago,
      moneda: datosExtraidos.moneda || prev.moneda,
      fecha_emision: datosExtraidos.fecha_emision || prev.fecha_emision,
      inicio_vigencia: datosExtraidos.inicio_vigencia || prev.inicio_vigencia,
      termino_vigencia: datosExtraidos.termino_vigencia || prev.termino_vigencia,
      fecha_aviso_renovacion: datosExtraidos.fecha_aviso_renovacion || prev.fecha_aviso_renovacion,
      fecha_vencimiento_pago: datosExtraidos.fecha_vencimiento_pago || datosExtraidos.fecha_limite_pago || prev.fecha_vencimiento_pago,
      proximoPago: datosExtraidos.proximoPago || datosExtraidos.fecha_vencimiento_pago || datosExtraidos.fecha_limite_pago || prev.proximoPago,
      prima_neta: datosExtraidos.prima_neta || prev.prima_neta,
      cargo_pago_fraccionado: recargoExtraido,
      gastos_expedicion: datosExtraidos.gastos_expedicion || prev.gastos_expedicion,
      subtotal: datosExtraidos.subtotal || prev.subtotal,
      iva: datosExtraidos.iva || prev.iva,
      total: datosExtraidos.total || prev.total,
      tipo_pago: datosExtraidos.tipo_pago || prev.tipo_pago,
      frecuenciaPago: datosExtraidos.frecuenciaPago || prev.frecuenciaPago,
      periodo_gracia: datosExtraidos.periodo_gracia || prev.periodo_gracia,
      estatusPago: datosExtraidos.estatusPago || datosExtraidos.estatus_pago || prev.estatusPago,
      estatus_pago: datosExtraidos.estatus_pago || datosExtraidos.estatusPago || prev.estatus_pago,
      primer_pago: datosExtraidos.primer_pago || prev.primer_pago,
      pagos_subsecuentes: datosExtraidos.pagos_subsecuentes || prev.pagos_subsecuentes,
      recibos: recibosExtraidos.length > 0 ? recibosExtraidos : prev.recibos,
      uso: datosExtraidos.uso || prev.uso,
      servicio: datosExtraidos.servicio || prev.servicio,
      marca: datosExtraidos.marca || prev.marca,
      modelo: datosExtraidos.modelo || prev.modelo,
      anio: datosExtraidos.anio || prev.anio,
      numero_serie: datosExtraidos.numero_serie || prev.numero_serie,
      placas: datosExtraidos.placas || prev.placas,
      color: datosExtraidos.color || prev.color,
      tipo_vehiculo: datosExtraidos.tipo_vehiculo || prev.tipo_vehiculo,
      tipo_cobertura: datosExtraidos.tipo_cobertura || prev.tipo_cobertura,
      suma_asegurada: datosExtraidos.suma_asegurada || prev.suma_asegurada,
      coberturas: Array.isArray(datosExtraidos.coberturas) && datosExtraidos.coberturas.length > 0 ? datosExtraidos.coberturas : prev.coberturas,
      agente: agenteDisplay,
      agente_id: datosExtraidos.agente_id || prev.agente_id,
      clave_agente: datosExtraidos.clave_agente || prev.clave_agente,
      __pdfFile: datosExtraidos.__pdfFile || prev.__pdfFile,
      __pdfNombre: datosExtraidos.__pdfNombre || prev.__pdfNombre,
      __pdfSize: datosExtraidos.__pdfSize || prev.__pdfSize,
      _modo_endoso: true,
      _datos_desde_pdf: true,
      _metodo_captura: 'endoso_pdf',
      _esperando_recargo_fraccionado: esFraccionado && !String(recargoExtraido).trim(),
      _recargo_fraccionado_por_parcialidad: esFraccionado,
      _tipo_pago_changed: datosExtraidos.tipo_pago && datosExtraidos.tipo_pago !== prev.tipo_pago,
      _frecuencia_pago_changed: datosExtraidos.frecuenciaPago && datosExtraidos.frecuenciaPago !== prev.frecuenciaPago,
      _total_changed: Boolean(datosExtraidos.total && datosExtraidos.total !== prev.total),
      _tiene_recibos_complementarios: false,
      _tipo_endoso_economico_cargado: false,
      _numero_endoso_economico: ''
    }));

    setInfoEndoso({
      archivo: datosExtraidos.__pdfNombre || 'PDF de endoso',
      numero_endoso: endosoNumero,
      compania: datosExtraidos.compania || formulario.compania,
      cambiosCobranza: Boolean(datosExtraidos.tipo_pago || datosExtraidos.frecuenciaPago || datosExtraidos.total || datosExtraidos.primer_pago || datosExtraidos.pagos_subsecuentes)
    });
    setRequiereAjusteEconomicoQualitas(esQualitas && (cambioTipoPago || cambioFrecuencia));
    setMostrarExtractorEndoso(false);
    toast.success(
      esQualitas && (cambioTipoPago || cambioFrecuencia)
        ? `Endoso ${endosoNumero || ''} cargado. Ahora carga el ajuste económico de Qualitas para generar los recibos complementarios.`.trim()
        : `Endoso ${endosoNumero || ''} cargado en el formulario. Revisa y guarda para aplicar cambios.`.trim()
    );
  }, [construirRecibosComplementariosQualitas, formulario.agente, formulario.cargo_pago_fraccionado, formulario.compania, formulario.frecuenciaPago, formulario.numero_endoso, formulario.recibos, formulario.tipo_pago, formularioOriginal, normalizarRecibos, requiereAjusteEconomicoQualitas, setFormulario]);

  /**
   * 🔍 DETECTAR CAMBIOS entre formularioOriginal y formulario actual
   * Esta función se puede llamar antes de guardar para generar logs
   * COMPLETO: Incluye todos los campos y recibos
   */
  const detectarCambios = () => {
    if (!formularioOriginal) return {};
    
    const cambios = {};
    
    // Función auxiliar para normalizar valores antes de comparar
    const normalizarValor = (valor) => {
      if (valor === null || valor === undefined) return '';
      if (typeof valor === 'string' && valor.includes('T')) {
        return valor.split('T')[0]; // Fecha ISO -> solo fecha
      }
      return String(valor).trim();
    };
    
    // TODOS los campos a comparar
    const camposAComparar = [
      // Datos básicos de póliza
      'numero_poliza', 'numero_endoso', 'compania', 'producto', 'etapa_activa',
      
      // Fechas
      'fecha_emision', 'inicio_vigencia', 'termino_vigencia', 
      'fecha_vencimiento_pago', 'proximoPago', 'fecha_aviso_renovacion',
      
      // Montos y cálculos
      'prima_neta', 'cargo_pago_fraccionado', 'gastos_expedicion',
      'iva', 'subtotal', 'total', 'primer_pago', 'pagos_subsecuentes',
      
      // Datos de pago
      'tipo_pago', 'frecuenciaPago', 'frecuencia_pago', 'periodo_gracia', 
      'estatusPago', 'estatus_pago',
      
      // Vehículo
      'marca', 'modelo', 'anio', 'placas', 'numero_serie', 'color',
      'tipo_vehiculo', 'tipo_cobertura', 'suma_asegurada',
      'conductor_habitual', 'edad_conductor', 'licencia_conducir',
      
      // Agentes
      'agente', 'agente_id', 'clave_agente',
      'sub_agente', 'subagente_id', 'vendedor_id',
      
      // Cliente
      'nombre', 'apellido_paterno', 'apellido_materno',
      'razon_social', 'nombre_comercial', 'rfc',
      'email', 'telefono_fijo', 'telefono_movil',
      'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno',
      'contacto_email', 'contacto_telefono_fijo', 'contacto_telefono_movil'
    ];
    
    camposAComparar.forEach(campo => {
      const valorOriginal = normalizarValor(formularioOriginal[campo]);
      const valorActual = normalizarValor(formulario[campo]);
      
      // Comparar solo si son diferentes y al menos uno tiene valor
      if (valorOriginal !== valorActual && (valorOriginal || valorActual)) {
        cambios[campo] = {
          anterior: formularioOriginal[campo] || '(vacío)',
          nuevo: formulario[campo] || '(vacío)'
        };
      }
    });
    
    // 🔍 COMPARAR RECIBOS
    const recibosOriginales = formularioOriginal.recibos || [];
    const recibosActuales = formulario.recibos || [];
    
    // Parsear si vienen como string
    let recibosOrigParsed = recibosOriginales;
    let recibosActualesParsed = recibosActuales;
    
    if (typeof recibosOrigParsed === 'string') {
      try { recibosOrigParsed = JSON.parse(recibosOrigParsed); } 
      catch (e) { recibosOrigParsed = []; }
    }
    if (typeof recibosActualesParsed === 'string') {
      try { recibosActualesParsed = JSON.parse(recibosActualesParsed); } 
      catch (e) { recibosActualesParsed = []; }
    }
    
    // Asegurar arrays
    if (!Array.isArray(recibosOrigParsed)) recibosOrigParsed = [];
    if (!Array.isArray(recibosActualesParsed)) recibosActualesParsed = [];
    
    // Comparar recibos
    const cambiosRecibos = [];
    const maxLength = Math.max(recibosOrigParsed.length, recibosActualesParsed.length);
    
    for (let i = 0; i < maxLength; i++) {
      const reciboOrig = recibosOrigParsed[i];
      const reciboActual = recibosActualesParsed[i];
      
      if (!reciboOrig && reciboActual) {
        // Recibo agregado
        cambiosRecibos.push({
          numero_recibo: reciboActual.numero_recibo || (i + 1),
          tipo_cambio: 'agregado',
          fecha_anterior: null,
          fecha_nueva: reciboActual.fecha_vencimiento,
          monto: reciboActual.monto,
          estatus: reciboActual.estatus || reciboActual.estatus_pago
        });
      } else if (reciboOrig && !reciboActual) {
        // Recibo eliminado
        cambiosRecibos.push({
          numero_recibo: reciboOrig.numero_recibo || (i + 1),
          tipo_cambio: 'eliminado',
          fecha_anterior: reciboOrig.fecha_vencimiento,
          fecha_nueva: null,
          monto: reciboOrig.monto,
          estatus: reciboOrig.estatus || reciboOrig.estatus_pago
        });
      } else if (reciboOrig && reciboActual) {
        // Comparar campos del recibo
        const fechaOrig = normalizarValor(reciboOrig.fecha_vencimiento);
        const fechaActual = normalizarValor(reciboActual.fecha_vencimiento);
        const montoOrig = normalizarValor(reciboOrig.monto);
        const montoActual = normalizarValor(reciboActual.monto);
        const estatusOrig = normalizarValor(reciboOrig.estatus || reciboOrig.estatus_pago);
        const estatusActual = normalizarValor(reciboActual.estatus || reciboActual.estatus_pago);
        
        if (fechaOrig !== fechaActual || montoOrig !== montoActual || estatusOrig !== estatusActual) {
          cambiosRecibos.push({
            numero_recibo: reciboActual.numero_recibo || (i + 1),
            tipo_cambio: 'editado',
            fecha_anterior: reciboOrig.fecha_vencimiento,
            fecha_nueva: reciboActual.fecha_vencimiento,
            monto_anterior: reciboOrig.monto,
            monto_nuevo: reciboActual.monto,
            estatus_anterior: reciboOrig.estatus || reciboOrig.estatus_pago,
            estatus_nuevo: reciboActual.estatus || reciboActual.estatus_pago
          });
        }
      }
    }
    
    // Agregar recibos al objeto de cambios si hay
    if (cambiosRecibos.length > 0) {
      cambios._recibos = {
        cantidad: cambiosRecibos.length,
        detalles: cambiosRecibos
      };
    }
    
    console.log('🔍 Cambios detectados:', cambios);
    return cambios;
  };

  /**
   * Helper: Obtener etiqueta amigable de los campos
   */
  const obtenerEtiquetaCampo = (campo) => {
    const etiquetas = {
      // Información básica
      'tipo_tramite': 'Tipo de Trámite',
      'aseguradora': 'Aseguradora',
      'agente_id': 'Agente',
      'vendedor_id': 'Vendedor',
      'etapa': 'Etapa',
      'prioridad': 'Prioridad',
      'observaciones': 'Observaciones',
      
      // Cliente
      'nombre_cliente': 'Nombre del Cliente',
      'rfc_cliente': 'RFC del Cliente',
      'telefono_cliente': 'Teléfono',
      'email_cliente': 'Email',
      'direccion_cliente': 'Dirección',
      
      // Póliza
      'numero_poliza': 'Número de Póliza',
      'vigencia_inicio': 'Fecha de Inicio',
      'vigencia_fin': 'Fecha de Fin',
      'suma_asegurada': 'Suma Asegurada',
      'prima_total': 'Prima Total',
      'frecuencia_pago': 'Frecuencia de Pago',
      'numero_recibos': 'Número de Recibos',
      
      // Fechas
      'fecha_creacion': 'Fecha de Creación',
      'fecha_modificacion': 'Fecha de Modificación',
      'fecha_expedicion': 'Fecha de Expedición'
    };
    
    return etiquetas[campo] || campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  /**
   * Handler para seleccionar archivo PDF
   */
  const handleSeleccionarPDF = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      // Validar tipo
      if (archivo.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      // Validar tamaño (10MB)
      if (archivo.size > 10 * 1024 * 1024) {
        toast.error('El archivo no puede ser mayor a 10MB');
        return;
      }
      setArchivoSeleccionado(archivo);
    }
  };

  /**
   * Subir PDF de la póliza (usado internamente)
   */
  const subirPDFPoliza = async (expedienteId, archivo) => {
    if (!archivo) return null;
    
    try {
      console.log('📤 Subiendo PDF:', { expedienteId, archivo: archivo.name });
      const result = await pdfService.subirPDFPoliza(expedienteId, archivo);
      console.log('✅ PDF subido:', result);
      return result;
    } catch (error) {
      console.error('Error al subir PDF:', error);
      throw error;
    }
  };

  /**
   * Eliminar PDF de la póliza
   */
  const eliminarPDFPoliza = async (expedienteId) => {
    if (!confirm('¿Estás seguro de eliminar el PDF de esta póliza?')) {
      return;
    }
    
    try {
      await pdfService.eliminarPDFPoliza(expedienteId);
      
      // Actualizar formulario local
      setFormulario(prev => ({
        ...prev,
        pdf_url: null,
        pdf_nombre: null,
        pdf_key: null,
        pdf_size: null,
        pdf_fecha_subida: null
      }));
      
      toast.success('PDF eliminado correctamente');
    } catch (error) {
      console.error('❌ Error al eliminar PDF:', error);
      toast.error('Error al eliminar PDF: ' + error.message);
    }
  };

  // Sección de PDF inferior: Visualización y gestión de PDF existente
  const seccionPDFInferior = formulario.id && (
    <div className="mb-4">
      <h5 className="card-title border-bottom pb-2">Documento de Póliza (PDF)</h5>
    
      {/* Mostrar PDF actual si existe */}
      {formulario.pdf_nombre && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <FileText size={20} className="me-2 text-primary" />
                <strong>{formulario.pdf_nombre}</strong>
                {formulario.pdf_size && (
                  <span className="text-muted ms-2">
                    ({pdfService.formatearTamañoArchivo(formulario.pdf_size)})
                  </span>
                )}
                {formulario.pdf_fecha_subida && (
                  <div className="text-muted small mt-1">
                    Subido el {new Date(formulario.pdf_fecha_subida).toLocaleDateString('es-MX')}
                  </div>
                )}
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const pdfData = await pdfService.obtenerURLFirmadaPDF(formulario.id);
                      window.open(pdfData.signed_url, '_blank');
                    } catch (error) {
                      toast.error('Error al abrir PDF: ' + error.message);
                    }
                  }}
                  className="btn btn-sm btn-outline-primary"
                >
                  <Eye size={14} className="me-1" />
                  Ver
                </button>
                <label className="btn btn-sm btn-outline-secondary mb-0" style={{ cursor: 'pointer' }}>
                  <Upload size={14} className="me-1" />
                  Cambiar
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        // Solo guardar en estado - se subirá al dar "Actualizar Expediente"
                        setArchivoSeleccionado(file);
                        toast.success(`PDF seleccionado: ${file.name}. Guarda los cambios para aplicar.`);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario para subir PDF */}
      {!formulario.pdf_nombre && (
        <div className="card">
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">Seleccionar archivo PDF de la póliza</label>
              <input
                type="file"
                className="form-control"
                accept=".pdf,application/pdf"
                onChange={handleSeleccionarPDF}
              />
              <small className="form-text text-muted">
                Tamaño máximo: 10MB. Solo archivos PDF.
              </small>
            </div>
          
            {archivoSeleccionado && (
              <div className="alert alert-success mb-3">
                <FileText size={16} className="me-2" />
                <strong>Archivo seleccionado:</strong> {archivoSeleccionado.name}
                <span className="ms-2">
                  ({pdfService.formatearTamañoArchivo(archivoSeleccionado.size)})
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => subirPDFPoliza(formulario.id)}
              className="btn btn-primary"
              disabled={!archivoSeleccionado || subiendoPDF}
            >
              {subiendoPDF ? (
                <>
                  <Loader size={16} className="me-2 spinner-border spinner-border-sm" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload size={16} className="me-2" />
                  Subir PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const bannerEndoso = (
    <div className={`alert ${requiereAjusteEconomicoQualitas ? 'alert-warning' : 'alert-info'} mb-3 d-flex justify-content-between align-items-start gap-3`}>
      <div>
        <div className="fw-semibold">Cargar Endoso</div>
        <small>
          Usa el extractor para aplicar cambios del endoso sobre esta póliza sin capturarlos manualmente.
          {infoEndoso && ` Último cargado: ${infoEndoso.numero_endoso || 'sin número'}${infoEndoso.archivo ? ` | ${infoEndoso.archivo}` : ''}.`}
          {requiereAjusteEconomicoQualitas && ' Falta cargar el ajuste económico de Qualitas para completar los cobros complementarios.'}
          {infoEndoso?.ajuste_economico_cargado && ` Ajuste económico: ${infoEndoso.numero_endoso_ajuste || 'sin número'}${infoEndoso.archivo_ajuste ? ` | ${infoEndoso.archivo_ajuste}` : ''}.`}
        </small>
      </div>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => setMostrarModalSeleccionEndoso(true)}
      >
        <Upload size={14} className="me-1" />
        {requiereAjusteEconomicoQualitas ? 'Cargar Ajuste Económico' : 'Cargar Endoso'}
      </button>
    </div>
  );

  /**
   * Wrapper del guardarExpediente para incluir detección de cambios
   */
  const guardarConAuditoria = async () => {
    try {
      // 0. Verificar si hay PDF pendiente de subir
      let cambioPDF = null;
      const archivoParaSubir = archivoSeleccionado || (formulario._modo_endoso ? formulario.__pdfFile : null);
      if (archivoParaSubir) {
        const pdfAnterior = formulario.pdf_nombre;
        const pdfKeyAnterior = formulario.pdf_key; // Guardar key anterior para historial
        const pdfUrlAnterior = formulario.pdf_url;
        setSubiendoPDF(true);
        try {
          const resultPDF = await subirPDFPoliza(formulario.id, archivoParaSubir);
          if (resultPDF) {
            cambioPDF = {
              esReemplazo: !!pdfAnterior,
              anterior: pdfAnterior || null,
              anterior_key: pdfKeyAnterior || null, // Key para poder abrir el PDF anterior
              anterior_url: pdfUrlAnterior || null,
              nuevo: archivoParaSubir.name,
              nuevo_key: resultPDF.pdf_key, // Key del nuevo PDF
              size: resultPDF.pdf_size
            };
            // Actualizar formulario con datos del PDF
            setFormulario(prev => ({
              ...prev,
              pdf_nombre: resultPDF.pdf_nombre,
              pdf_size: resultPDF.pdf_size,
              pdf_key: resultPDF.pdf_key,
              pdf_url: resultPDF.pdf_url,
              pdf_fecha_subida: resultPDF.pdf_fecha_subida,
              __pdfFile: null,
              __pdfNombre: null,
              __pdfSize: null
            }));
            setArchivoSeleccionado(null);
          }
        } catch (errorPDF) {
          toast.error('Error al subir PDF: ' + errorPDF.message);
          setSubiendoPDF(false);
          return; // No continuar si falla el PDF
        } finally {
          setSubiendoPDF(false);
        }
      }
      
      // 1. Detectar cambios antes de guardar
      const cambios = detectarCambios();
      const cambiosRecibosPrevios = cambios._recibos;
      const camposCobranza = new Set([
        'tipo_pago', 'frecuenciaPago', 'frecuencia_pago', 'periodo_gracia',
        'fecha_vencimiento_pago', 'proximoPago', 'prima_neta', 'cargo_pago_fraccionado',
        'gastos_expedicion', 'iva', 'subtotal', 'total', 'primer_pago', 'pagos_subsecuentes'
      ]);
      const endosoImpactaCobranza = formulario._modo_endoso && (
        Object.keys(cambios).some(campo => camposCobranza.has(campo)) ||
        Boolean(cambiosRecibosPrevios?.cantidad)
      );

      if (requiereAjusteEconomicoQualitas) {
        toast.error('Falta cargar el ajuste económico de Qualitas antes de guardar este endoso.');
        return;
      }

      if (endosoImpactaCobranza && tieneRecibosPagados(formularioOriginal?.recibos)) {
        toast.error('Este endoso cambia cobranza y la póliza ya tiene recibos pagados. Revisión manual requerida antes de guardar.');
        return;
      }
      
      // 2. Guardar el expediente (llamar al original)
      await guardarExpediente();
      
      // 3. Registrar cambios en el historial si los hay
      // Separar cambios de recibos de cambios de campos
      const cambiosRecibos = cambios._recibos;
      delete cambios._recibos;
      
      const cantidadCampos = Object.keys(cambios).length;
      const cantidadRecibos = cambiosRecibos?.cantidad || 0;
      const hayAlgunCambio = cantidadCampos > 0 || cantidadRecibos > 0 || cambioPDF;
      
      if (hayAlgunCambio) {
        console.log('📝 Registrando cambios para auditoría:', { cambios, cambiosRecibos });
        
        // Formatear descripción de cambios para el historial
        const camposModificados = Object.keys(cambios)
          .filter(campo => !campo.startsWith('_'))
          .map(campo => {
            const etiqueta = obtenerEtiquetaCampo(campo);
            const valorAnterior = cambios[campo].anterior || 'Vacío';
            const valorNuevo = cambios[campo].nuevo || 'Vacío';
            return `${etiqueta}: "${valorAnterior}" → "${valorNuevo}"`;
          });
        
        // Construir descripción
        let descripcionPartes = [];
        if (cantidadCampos > 0) {
          descripcionPartes.push(`${cantidadCampos} campo(s) de póliza`);
        }
        if (cantidadRecibos > 0) {
          descripcionPartes.push(`${cantidadRecibos} recibo(s)`);
        }
        if (cambioPDF) {
          descripcionPartes.push(cambioPDF.esReemplazo ? 'PDF reemplazado' : 'PDF agregado');
        }
        
        const descripcion = `Expediente actualizado | ${descripcionPartes.join(' + ')}${camposModificados.length > 0 ? ': ' + camposModificados.join(', ') : ''}`;
        
        try {
          // Separar cambios por categorías para mejor visualización
          const cambiosPorCategoria = {
            // Cambios en póliza (excluir campos de cliente)
            poliza: {},
            // Cambios en cliente
            cliente: {},
            // Cambios en recibos
            recibos: cambiosRecibos
          };
          
          const camposCliente = [
            'nombre', 'apellido_paterno', 'apellido_materno',
            'razon_social', 'nombre_comercial', 'rfc',
            'email', 'telefono_fijo', 'telefono_movil',
            'contacto_nombre', 'contacto_apellido_paterno', 'contacto_apellido_materno',
            'contacto_email', 'contacto_telefono_fijo', 'contacto_telefono_movil'
          ];
          
          Object.entries(cambios).forEach(([campo, valor]) => {
            if (camposCliente.includes(campo)) {
              cambiosPorCategoria.cliente[campo] = valor;
            } else {
              cambiosPorCategoria.poliza[campo] = valor;
            }
          });
          
          const esEndoso = formulario._modo_endoso === true;
          const tipoEvento = esEndoso
            ? historialExpedienteService.TIPOS_EVENTO.ENDOSO_APLICADO
            : 'edicion_manual_expediente';
          const descripcionBase = esEndoso
            ? `Endoso aplicado | ${formulario.compania || 'Sin aseguradora'} | Póliza: ${formulario.numero_poliza || 'Sin número'} | Endoso: ${formulario.numero_endoso || 'Sin número'} | ${descripcionPartes.join(' + ')}`
            : `Edición manual de expediente | ${formulario.compania || 'Sin aseguradora'} | Póliza: ${formulario.numero_poliza || 'Sin número'} | ${descripcionPartes.join(' + ')}`;

          await historialExpedienteService.registrarEvento({
            expediente_id: formulario.id,
            cliente_id: formulario.cliente_id,
            usuario_nombre: 'Sistema',
            tipo_evento: tipoEvento,
            descripcion: descripcionBase,
            datos_adicionales: {
              metodo_captura: esEndoso ? 'Endoso PDF' : 'Edición Manual',
              fecha_edicion: new Date().toISOString(),
              aseguradora: formulario.compania,
              numero_poliza: formulario.numero_poliza,
              numero_endoso: formulario.numero_endoso || null,
              usuario_edito: 'Sistema',
              etapa_actual: formulario.etapa_activa || 'Sin etapa',
              es_endoso: esEndoso,
              
              // Cambios en campos de póliza
              ...(Object.keys(cambiosPorCategoria.poliza).length > 0 && {
                poliza_cambios: {
                  descripcion: 'Datos de póliza editados',
                  campos_actualizados: Object.keys(cambiosPorCategoria.poliza),
                  cambios_detallados: Object.fromEntries(
                    Object.entries(cambiosPorCategoria.poliza).map(([campo, valor]) => [
                      campo,
                      { anterior: valor.anterior, nuevo: valor.nuevo }
                    ])
                  )
                }
              }),
              
              // Cambios en campos de cliente
              ...(Object.keys(cambiosPorCategoria.cliente).length > 0 && {
                cliente_cambios: {
                  descripcion: 'Datos de cliente editados',
                  campos_actualizados: Object.keys(cambiosPorCategoria.cliente),
                  cambios_detallados: Object.fromEntries(
                    Object.entries(cambiosPorCategoria.cliente).map(([campo, valor]) => [
                      campo,
                      { anterior: valor.anterior, nuevo: valor.nuevo }
                    ])
                  )
                }
              }),
              
              // Cambios en recibos
              ...(cambiosPorCategoria.recibos && {
                recibos_cambios: {
                  descripcion: 'Calendario de pagos modificado',
                  cantidad_cambios: cambiosPorCategoria.recibos.cantidad,
                  cambios_detallados: cambiosPorCategoria.recibos.detalles
                }
              }),
              
              // Cambios en PDF (incluye keys para poder abrir ambos archivos)
              ...(cambioPDF && {
                pdf_cambios: {
                  descripcion: cambioPDF.esReemplazo ? 'PDF de póliza reemplazado' : 'PDF de póliza agregado',
                  anterior: cambioPDF.anterior,
                  anterior_key: cambioPDF.anterior_key,
                  anterior_url: cambioPDF.anterior_url,
                  nuevo: cambioPDF.nuevo,
                  nuevo_key: cambioPDF.nuevo_key,
                  size: cambioPDF.size
                }
              }),
              
              total_cambios: cantidadCampos + cantidadRecibos + (cambioPDF ? 1 : 0)
            }
          });
          
          console.log('✅ Cambios registrados exitosamente en el historial');
        } catch (historialError) {
          console.error('❌ Error al registrar cambios en historial:', historialError);
          toast.error('Error al registrar cambios en el historial');
          // No relanzar el error para no impedir el guardado
        }
      }
    } catch (error) {
      console.error('❌ Error al guardar expediente:', error);
      throw error; // Relanzar error del guardado principal
    }
  };

  return (
    <>
      {mostrarModalSeleccionEndoso && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '700px' }}>
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title w-100 text-center">
                  📋 Selecciona el Método de Captura
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setMostrarModalSeleccionEndoso(false)}
                ></button>
              </div>

              <div className="modal-body pt-2">
                <p className="text-center text-muted mb-4">
                  ¿Cómo deseas cargar el endoso?
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="pdfFileInputEndoso"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'application/pdf') {
                      setMostrarModalSeleccionEndoso(false);
                      window._selectedPDFFile = file;
                      window._autoExtractorMode = true;
                      window._extractorMetodo = 'auto';
                      setTimeout(() => {
                        setMostrarExtractorEndoso(true);
                      }, 100);
                    }
                  }}
                />

                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  id="pdfFileInputEndosoIA"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'application/pdf') {
                      setMostrarModalSeleccionEndoso(false);
                      window._selectedPDFFile = file;
                      window._iaExtractorMode = true;
                      window._extractorMetodo = 'openai';
                      setTimeout(() => {
                        setMostrarExtractorEndoso(true);
                      }, 100);
                    }
                  }}
                />

                <div className="row g-3">
                  <div className="col-md-4">
                    <div
                      className="card h-100 border-primary text-center p-3"
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => setMostrarModalSeleccionEndoso(false)}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,110,253,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body p-2">
                        <div className="mb-2" style={{ fontSize: '40px' }}>✍️</div>
                        <h6 className="card-title text-primary mb-1">Captura Manual</h6>
                        <p className="card-text text-muted small mb-2" style={{ fontSize: '0.7rem' }}>
                          Continúa editando el formulario campo por campo
                        </p>
                        <button
                          className="btn btn-primary btn-sm w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalSeleccionEndoso(false);
                          }}
                        >
                          Captura Manual
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div
                      className="card h-100 border-success text-center p-3"
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => document.getElementById('pdfFileInputEndoso')?.click()}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,135,84,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body p-2">
                        <div className="mb-2" style={{ fontSize: '40px' }}>📄</div>
                        <h6 className="card-title text-success mb-1">Extractor PDF</h6>
                        <p className="card-text text-muted small mb-2" style={{ fontSize: '0.7rem' }}>
                          Extracción automática por patrones
                        </p>
                        <button
                          className="btn btn-success btn-sm w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            window._extractorMetodo = 'auto';
                            document.getElementById('pdfFileInputEndoso')?.click();
                          }}
                        >
                          <Upload size={16} className="me-1" />
                          Importar PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div
                      className="card h-100 border-warning text-center p-3"
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => document.getElementById('pdfFileInputEndosoIA')?.click()}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,193,7,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body p-2">
                        <div className="mb-2" style={{ fontSize: '40px' }}>🤖</div>
                        <h6 className="card-title mb-1" style={{ color: '#b8860b' }}>Extraer con IA</h6>
                        <p className="card-text text-muted small mb-2" style={{ fontSize: '0.7rem' }}>
                          IA para cualquier aseguradora
                        </p>
                        <button
                          className="btn btn-outline-success w-100 mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            window._extractorMetodo = 'openai';
                            document.getElementById('pdfFileInputEndosoIA')?.click();
                          }}
                        >
                          🤖 Leer PDF con IA
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-3 mb-0">
                  <small>
                    <strong>💡 Recomendación:</strong> Usa el extractor PDF para aseguradoras soportadas (Qualitas, Chubb, HDI, etc).
                    Usa <strong>Extraer con IA</strong> para cualquier aseguradora y ramo.
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <FormularioExpedienteBase
      modoEdicion={true}
      titulo={`Editar Expediente #${formulario.id || ''}`}
      textoBotónGuardar="Actualizar Expediente"
      guardando={guardando}
      setVistaActual={setVistaActual}
      formulario={formulario}
      setFormulario={setFormulario}
      actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
      guardarExpediente={guardarConAuditoria}
      companias={companias}
      productos={productos}
      aseguradoras={aseguradoras}
      tiposProductos={tiposProductos}
      etapasActivas={etapasActivas}
      agentes={agentes}
      tiposPago={tiposPago}
      frecuenciasPago={frecuenciasPago}
      periodosGracia={periodosGracia}
      estatusPago={estatusPago}
      marcasVehiculo={marcasVehiculo}
      tiposVehiculo={tiposVehiculo}
      tiposCobertura={tiposCobertura}
      calculartermino_vigencia={calculartermino_vigencia}
      calcularProximoPago={calcularProximoPago}
      handleClienteSeleccionado={handleClienteSeleccionado}
      clienteSeleccionado={clienteSeleccionado}
      handleSeleccionarPDF={handleSeleccionarPDF}
      archivoSeleccionado={archivoSeleccionado}
      subiendoPDF={subiendoPDF}
      subirPDFPoliza={subirPDFPoliza}
      onEliminarPago={onEliminarPago}
      onCrearAgenteNuevo={onCrearAgenteNuevo}
      bannerSuperior={bannerEndoso}
      seccionPDFInferior={seccionPDFInferior}
      />
      {mostrarExtractorEndoso && (
        <ExtractorPolizasPDF
          onDataExtracted={handleDatosExtraidosEndoso}
          onClose={() => setMostrarExtractorEndoso(false)}
          agentes={agentes}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
          forcedAseguradora={requiereAjusteEconomicoQualitas ? 'QUALITAS' : null}
          forcedProducto={requiereAjusteEconomicoQualitas ? 'autos' : 'autos'}
        />
      )}
    </>
  );
};

export default FormularioEditarExpediente;

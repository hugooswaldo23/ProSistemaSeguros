/**
 * ====================================================================
 * WRAPPER: FORMULARIO NUEVO EXPEDIENTE (DESDE PDF)
 * ====================================================================
 * Componente específico para AGREGAR expedientes desde PDF
 * - Integra ExtractorPolizasPDF
 * - Lógica aplicarSiVacio (no sobrescribir campos ya llenados)
 * - NO usa snapshot (no es necesario para agregar)
 * - Banner de confirmación de importación
 */

import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, FileText, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { validarContactoCliente } from '../../utils/validacionContacto';
import FormularioExpedienteBase from './FormularioExpedienteBase';
import ExtractorPolizasPDF from './ExtractorPolizasPDF';

const API_URL = import.meta.env.VITE_API_URL;

const FormularioNuevoExpediente = ({ 
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
  onEliminarPago
}) => {
  // Estados específicos para modo agregar
  const [mostrarModalSeleccion, setMostrarModalSeleccion] = useState(true);
  const [modoCaptura, setModoCaptura] = useState(null); // 'manual' o 'pdf'
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);
  const [infoImportacion, setInfoImportacion] = useState(null);
  const [camposModificadosPostPDF, setCamposModificadosPostPDF] = useState([]);

  /**
   * Handler para seleccionar modo de captura
   */
  const seleccionarModo = (modo) => {
    setModoCaptura(modo);
    setMostrarModalSeleccion(false);
    
    if (modo === 'pdf') {
      setMostrarExtractorPDF(true);
    } else if (modo === 'manual') {
      // Marcar que fue captura manual
      setFormulario(prev => ({
        ...prev,
        _metodo_captura: 'manual'
      }));
    }
  };

  /**
   * Handler para datos extraídos del PDF
   * Aplica lógica aplicarSiVacio: solo llena campos vacíos
   */
  const handleDatosExtraidosPDF = useCallback(async (datosExtraidos) => {
    try {
      // 1. CLIENTE: Usar el que ya fue creado/encontrado en ExtractorPolizasPDF
      let clienteSeleccionadoFinal = null;
      
      if (datosExtraidos.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          clienteSeleccionadoFinal = clientes.find(c => c.id === datosExtraidos.cliente_id);
          
          if (clienteSeleccionadoFinal) {
            handleClienteSeleccionado(clienteSeleccionadoFinal);
            console.log('✅ Cliente vinculado:', clienteSeleccionadoFinal.nombre || clienteSeleccionadoFinal.razonSocial);
          }
        } catch (error) {
          console.error('❌ Error al buscar cliente:', error);
        }
      }
      
      // 2. AGENTE: Preparar texto para mostrar en formulario
      let agenteDisplay = '';
      if (datosExtraidos.clave_agente && datosExtraidos.agente) {
        agenteDisplay = `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}`;
      } else if (datosExtraidos.agente) {
        agenteDisplay = datosExtraidos.agente;
      }
      
      // 3. EXCLUIR campos del cliente (no sobrescribir con undefined)
      const { 
        nombre, apellido_paterno, apellido_materno, 
        razonSocial, razon_social, 
        nombreComercial, nombre_comercial,
        rfc, tipo_persona,
        email, telefono_fijo, telefono_movil,
        ...datosPoliza 
      } = datosExtraidos;
      
      // 4. APLICAR DATOS AL FORMULARIO (solo si campo está vacío)
      setFormulario(prev => {
        /**
         * 🔑 LÓGICA CLAVE: aplicarSiVacio
         * Solo aplicar valor del PDF si el campo actual está vacío
         */
        const aplicarSiVacio = (valorPDF, valorActual) => {
          return (valorActual === '' || valorActual === null || valorActual === undefined) 
            ? valorPDF 
            : valorActual;
        };

        const nuevosDatos = {
          ...prev,
          // Datos de la póliza (aplicar si vacío)
          numero_poliza: aplicarSiVacio(datosPoliza.numero_poliza, prev.numero_poliza),
          compania: aplicarSiVacio(datosPoliza.compania, prev.compania),
          producto: aplicarSiVacio(datosPoliza.producto, prev.producto),
          numero_endoso: aplicarSiVacio(datosPoliza.numero_endoso, prev.numero_endoso),
          
          // ⚠️ FORZAR estos campos desde PDF (no usar aplicarSiVacio)
          // Porque el estado inicial tiene "Anual" y no queremos que bloquee el cambio
          tipo_pago: datosPoliza.tipo_pago || prev.tipo_pago,
          frecuenciaPago: datosPoliza.frecuenciaPago || prev.frecuenciaPago,
          
          forma_pago: aplicarSiVacio(datosPoliza.forma_pago, prev.forma_pago),
          moneda: aplicarSiVacio(datosPoliza.moneda, prev.moneda),
          
          // Fechas
          fecha_emision: aplicarSiVacio(datosPoliza.fecha_emision, prev.fecha_emision) || new Date().toISOString().split('T')[0],
          inicio_vigencia: aplicarSiVacio(datosPoliza.inicio_vigencia, prev.inicio_vigencia),
          termino_vigencia: aplicarSiVacio(datosPoliza.termino_vigencia, prev.termino_vigencia),
          fecha_aviso_renovacion: aplicarSiVacio(datosPoliza.fecha_aviso_renovacion, prev.fecha_aviso_renovacion),
          fecha_vencimiento_pago: aplicarSiVacio(datosPoliza.fecha_vencimiento_pago, prev.fecha_vencimiento_pago),
          fecha_pago: aplicarSiVacio(datosPoliza.fecha_pago, prev.fecha_pago),
          proximoPago: aplicarSiVacio(datosPoliza.proximoPago, prev.proximoPago),
          
          // Montos
          prima_neta: aplicarSiVacio(datosPoliza.prima_neta, prev.prima_neta),
          total: aplicarSiVacio(datosPoliza.total, prev.total),
          cargo_pago_fraccionado: aplicarSiVacio(datosPoliza.cargo_pago_fraccionado, prev.cargo_pago_fraccionado),
          gastos_expedicion: aplicarSiVacio(datosPoliza.gastos_expedicion, prev.gastos_expedicion),
          iva: aplicarSiVacio(datosPoliza.iva, prev.iva),
          subtotal: aplicarSiVacio(datosPoliza.subtotal, prev.subtotal),
          
          // ⚠️ FORZAR montos de pagos fraccionados desde PDF
          primer_pago: datosPoliza.primer_pago || prev.primer_pago,
          pagos_subsecuentes: datosPoliza.pagos_subsecuentes || prev.pagos_subsecuentes,
          
          // ⚠️ FORZAR período de gracia desde PDF (extraído del documento)
          periodo_gracia: datosPoliza.periodo_gracia || prev.periodo_gracia,
          
          // ⚠️ FORZAR estatus de pago calculado desde el extractor
          estatusPago: datosPoliza.estatusPago || datosPoliza.estatus_pago || prev.estatusPago,
          estatus_pago: datosPoliza.estatus_pago || datosPoliza.estatusPago || prev.estatus_pago,
          
          uso: aplicarSiVacio(datosPoliza.uso, prev.uso),
          servicio: aplicarSiVacio(datosPoliza.servicio, prev.servicio),
          movimiento: aplicarSiVacio(datosPoliza.movimiento, prev.movimiento),
          
          // Vehículo (si aplica)
          marca: aplicarSiVacio(datosPoliza.marca, prev.marca),
          modelo: aplicarSiVacio(datosPoliza.modelo, prev.modelo),
          anio: aplicarSiVacio(datosPoliza.anio, prev.anio),
          numero_serie: aplicarSiVacio(datosPoliza.numero_serie, prev.numero_serie),
          placas: aplicarSiVacio(datosPoliza.placas, prev.placas),
          color: aplicarSiVacio(datosPoliza.color, prev.color),
          tipo_vehiculo: aplicarSiVacio(datosPoliza.tipo_vehiculo, prev.tipo_vehiculo),
          tipo_cobertura: aplicarSiVacio(datosPoliza.tipo_cobertura, prev.tipo_cobertura),
          
          // Agente (forzar desde PDF)
          agente: agenteDisplay,
          clave_agente: datosExtraidos.clave_agente || prev.clave_agente || '',
          sub_agente: '',
          etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
        };

        // 5. NO recalcular automáticamente - usar datos del PDF tal cual
        // Los cálculos solo se aplican cuando el usuario edita campos manualmente
        
        // 🔥 MARCAR que estos datos vienen del PDF extractor
        nuevosDatos._datos_desde_pdf = true;
        nuevosDatos._metodo_captura = 'pdf';
        nuevosDatos._snapshot_pdf = JSON.stringify(nuevosDatos); // Snapshot para detectar cambios
        
        // 🔥 GUARDAR SNAPSHOT GLOBAL para detectar cambios en guardarExpediente
        window.__datosOriginalesPDF = { ...nuevosDatos };
        console.log('📸 Snapshot de datos originales del PDF guardado globalmente');
        
        return nuevosDatos;
      });

      // 6. GUARDAR INFO DE IMPORTACIÓN para el banner
      setInfoImportacion({
        clienteCreado: !datosExtraidos.cliente_existente && !!clienteSeleccionadoFinal,
        clienteEncontrado: datosExtraidos.cliente_existente && !!clienteSeleccionadoFinal,
        nombreCliente: clienteSeleccionadoFinal?.nombre || clienteSeleccionadoFinal?.razonSocial || 'N/A',
        poliza: datosExtraidos.numero_poliza || 'N/A',
        compania: datosExtraidos.compania || 'N/A',
        agenteAsignado: !!agenteDisplay
      });
      
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
      
      console.log('✅ Datos del PDF aplicados al formulario');
      
    } catch (error) {
      console.error('❌ Error al procesar datos del PDF:', error);
      // Aún así aplicar lo que se pueda
      setFormulario(prev => ({
        ...prev,
        ...datosExtraidos
      }));
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
    }
  }, [setFormulario, actualizarCalculosAutomaticos, handleClienteSeleccionado]);

  /**
   * useEffect para detectar cambios manuales post-PDF
   */
  useEffect(() => {
    if (formulario._metodo_captura === 'pdf' && formulario._snapshot_pdf && datosImportadosDesdePDF) {
      try {
        const snapshot = JSON.parse(formulario._snapshot_pdf);
        const camposModificados = [];
        
        // Campos importantes a monitorear
        const camposClave = [
          'numero_poliza', 'compania', 'producto', 'numero_endoso',
          'fecha_emision', 'inicio_vigencia', 'termino_vigencia',
          'prima_neta', 'total', 'tipo_pago', 'frecuenciaPago',
          'marca', 'modelo', 'anio', 'placas', 'numero_serie',
          'agente', 'estatusPago', 'fecha_vencimiento_pago'
        ];
        
        camposClave.forEach(campo => {
          const valorOriginal = snapshot[campo];
          const valorActual = formulario[campo];
          
          // Detectar cambio (ignorando campos temporales)
          if (valorOriginal !== valorActual && 
              !campo.startsWith('_') &&
              valorOriginal !== undefined &&
              valorActual !== undefined) {
            camposModificados.push(campo);
          }
        });
        
        if (camposModificados.length > 0) {
          setCamposModificadosPostPDF(prev => {
            const nuevoSet = new Set([...prev, ...camposModificados]);
            return Array.from(nuevoSet);
          });
        }
      } catch (err) {
        console.error('Error al comparar snapshot:', err);
      }
    }
  }, [formulario, datosImportadosDesdePDF]);

  /**
   * Wrapper para setFormulario simplificado (sin detección sincrónica)
   */
  const setFormularioConDeteccion = useCallback((updater) => {
    setFormulario(prev => {
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  }, [setFormulario]);

  // Banner superior: Confirmación de importación desde PDF
  const bannerSuperior = datosImportadosDesdePDF && infoImportacion && (
    <div className="alert alert-success alert-dismissible fade show mb-2 py-2 px-3" role="alert" style={{ fontSize: '0.8rem' }}>
      <CheckCircle className="me-2" size={16} />
      <div>
        <strong>✅ Datos importados desde PDF exitosamente</strong>
        <ul className="mb-0 mt-1" style={{ fontSize: '0.75rem' }}>
          {infoImportacion.clienteCreado && (
            <li>🆕 <strong>Cliente creado automáticamente:</strong> {infoImportacion.nombreCliente}</li>
          )}
          {infoImportacion.clienteEncontrado && (
            <li>✅ <strong>Cliente encontrado:</strong> {infoImportacion.nombreCliente}</li>
          )}
          {!infoImportacion.clienteCreado && !infoImportacion.clienteEncontrado && (
            <li>⚠️ <strong>Cliente no pudo crearse</strong> - Verifica los datos extraídos</li>
          )}
          <li>📄 <strong>Póliza:</strong> {infoImportacion.poliza}</li>
          <li>🏢 <strong>Compañía:</strong> {infoImportacion.compania}</li>
          {infoImportacion.agenteAsignado ? (
            <li>✅ <strong>Agente asignado automáticamente</strong></li>
          ) : (
            <li>⚠️ <strong>Agente no encontrado</strong> - Selecciónalo manualmente</li>
          )}
        </ul>
        <small className="text-muted mt-2 d-block">
          💡 Revisa la información y completa los campos faltantes antes de guardar
        </small>
      </div>
      <button 
        type="button" 
        className="btn-close" 
        onClick={() => {
          setDatosImportadosDesdePDF(false);
          setInfoImportacion(null);
        }}
      ></button>
    </div>
  );

  return (
    <>
      {/* Modal de Selección de Método de Captura */}
      {mostrarModalSeleccion && (
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
                  onClick={() => setVistaActual('lista')}
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
                  id="pdfFileInputNuevo"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.type === 'application/pdf') {
                      // Cerrar modal de selección
                      setMostrarModalSeleccion(false);
                      // Guardar archivo y abrir el extractor directamente en modo automático
                      window._selectedPDFFile = file;
                      window._autoExtractorMode = true;
                      setModoCaptura('pdf');
                      setTimeout(() => {
                        setMostrarExtractorPDF(true);
                      }, 100);
                    }
                  }}
                />

                <div className="row g-3">
                  {/* Opción Captura Manual */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary text-center p-3" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => seleccionarModo('manual')}
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
                            seleccionarModo('manual');
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
                        document.getElementById('pdfFileInputNuevo')?.click();
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
                            document.getElementById('pdfFileInputNuevo')?.click();
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

      {/* Formulario base (se muestra solo si ya seleccionó modo) */}
      {!mostrarModalSeleccion && (
        <FormularioExpedienteBase
          modoEdicion={false}
          titulo={modoCaptura === 'pdf' ? 'Nuevo Expediente (desde PDF)' : 'Nuevo Expediente (Captura Manual)'}
          textoBotónGuardar="Guardar Expediente"
          setVistaActual={setVistaActual}
          formulario={formulario}
          setFormulario={setFormularioConDeteccion}
          actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
          guardarExpediente={() => {
            // VALIDACIÓN DE CONTACTO usando función utilitaria
            if (!validarContactoCliente(formulario, clienteSeleccionado, toast)) {
              return Promise.resolve(); // No guardar si falla validación
            }
            
            // Agregar información de campos modificados antes de guardar
            if (camposModificadosPostPDF.length > 0) {
              setFormulario(prev => ({
                ...prev,
                _campos_modificados_post_pdf: camposModificadosPostPDF
              }));
            }
            return guardarExpediente();
          }}
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
          onEliminarPago={onEliminarPago}
          bannerSuperior={bannerSuperior}
          seccionPDFInferior={null}
        />
      )}

      {/* Modal de Extractor PDF */}
      {mostrarExtractorPDF && (
        <ExtractorPolizasPDF 
          onDataExtracted={handleDatosExtraidosPDF}
          onClose={() => setMostrarExtractorPDF(false)}
          agentes={agentes}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
        />
      )}
    </>
  );
};

export default FormularioNuevoExpediente;

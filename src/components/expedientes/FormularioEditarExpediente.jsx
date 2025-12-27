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

import React, { useState, useEffect } from 'react';
import { AlertCircle, FileText, Eye, Trash2, Upload, Loader } from 'lucide-react';
import FormularioExpedienteBase from './FormularioExpedienteBase';
import * as pdfService from '../../services/pdfService';
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
  onEliminarPago
}) => {
  // 📸 SNAPSHOT: Estado original para detectar cambios
  const [formularioOriginal, setFormularioOriginal] = useState(null);
  
  // Estados para manejo de PDF existente
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [subiendoPDF, setSubiendoPDF] = useState(false);

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

  /**
   * 🔍 DETECTAR CAMBIOS entre formularioOriginal y formulario actual
   * Esta función se puede llamar antes de guardar para generar logs
   */
  const detectarCambios = () => {
    if (!formularioOriginal) return {};
    
    const cambios = {};
    const camposAComparar = [
      // Datos básicos
      'numero_poliza', 'compania', 'producto', 'etapa_activa',
      // Fechas
      'fecha_emision', 'inicio_vigencia', 'termino_vigencia',
      // Montos
      'prima_neta', 'total', 'iva', 'subtotal',
      // Vehículo
      'marca', 'modelo', 'anio', 'placas', 'numero_serie',
      // Agentes
      'agente', 'sub_agente',
      // Pagos
      'tipo_pago', 'frecuenciaPago', 'periodo_gracia', 'estatusPago'
    ];
    
    camposAComparar.forEach(campo => {
      const valorOriginal = formularioOriginal[campo];
      const valorActual = formulario[campo];
      
      // Comparar solo si son diferentes
      if (valorOriginal !== valorActual) {
        cambios[campo] = {
          anterior: valorOriginal,
          nuevo: valorActual
        };
      }
    });
    
    console.log('🔍 Cambios detectados:', cambios);
    return cambios;
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
   * Subir PDF de la póliza (pendiente implementación backend)
   */
  const subirPDFPoliza = async (expedienteId) => {
    if (!archivoSeleccionado) {
      toast.error('Selecciona un archivo PDF primero');
      return;
    }
    
    setSubiendoPDF(true);
    
    try {
      // TODO: Implementar cuando Hugo complete el backend
      toast.error('Funcionalidad pendiente de implementación en el backend');
      console.log('📤 Subir PDF:', { expedienteId, archivo: archivoSeleccionado.name });
      
      // Código de ejemplo para cuando esté listo:
      /*
      const result = await pdfService.subirPDFPoliza(expedienteId, archivoSeleccionado);
      
      if (result.success) {
        toast.success('PDF subido exitosamente');
        setFormulario(prev => ({
          ...prev,
          pdf_nombre: result.data.pdf_nombre,
          pdf_size: result.data.pdf_size,
          pdf_fecha_subida: result.data.pdf_fecha_subida
        }));
        setArchivoSeleccionado(null);
      }
      */
    } catch (error) {
      console.error('Error al subir PDF:', error);
      toast.error('Error al subir el PDF: ' + error.message);
    } finally {
      setSubiendoPDF(false);
    }
  };

  /**
   * Eliminar PDF de la póliza (pendiente implementación backend)
   */
  const eliminarPDFPoliza = async (expedienteId) => {
    // TODO: Implementar cuando Hugo complete el backend
    toast.error('Funcionalidad pendiente de implementación en el backend');
    console.log('🗑️ Eliminar PDF:', { expedienteId });
  };

  // Sección de PDF inferior: Visualización y gestión de PDF existente
  const seccionPDFInferior = formulario.id && (
    <div className="mb-4">
      <h5 className="card-title border-bottom pb-2">Documento de Póliza (PDF)</h5>
      <div className="alert alert-info" role="alert">
        <AlertCircle size={16} className="me-2" />
        <strong>Funcionalidad en preparación:</strong> Esta sección estará disponible cuando Hugo complete la implementación del backend y AWS S3.
        Ver documento: <code>docs/BACKEND-COMPROBANTES-PAGO-S3.md</code>
      </div>
    
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
                  disabled
                  title="Disponible cuando se implemente el backend"
                >
                  <Eye size={14} className="me-1" />
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => eliminarPDFPoliza(formulario.id)}
                  className="btn btn-sm btn-outline-danger"
                  disabled
                  title="Disponible cuando se implemente el backend"
                >
                  <Trash2 size={14} className="me-1" />
                  Eliminar
                </button>
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

  /**
   * Wrapper del guardarExpediente para incluir detección de cambios
   */
  const guardarConAuditoria = async () => {
    // 1. Detectar cambios antes de guardar
    const cambios = detectarCambios();
    
    // 2. Guardar el expediente (llamar al original)
    await guardarExpediente();
    
    // 3. TODO: Enviar cambios al sistema de auditoría
    if (Object.keys(cambios).length > 0) {
      console.log('📝 Cambios para auditoría:', cambios);
      // Aquí se enviaría al endpoint de historial cuando esté implementado
      /*
      await fetch(`${API_URL}/api/expedientes/${formulario.id}/historial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: 'Sistema', // TODO: Usuario autenticado
          tipo_evento: 'DATOS_ACTUALIZADOS',
          descripcion: `Campos modificados: ${Object.keys(cambios).join(', ')}`,
          datos_anteriores: formularioOriginal,
          datos_nuevos: formulario
        })
      });
      */
    }
  };

  return (
    <FormularioExpedienteBase
      modoEdicion={true}
      titulo={`Editar Expediente #${formulario.id || ''}`}
      textoBotónGuardar="Actualizar Expediente"
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
      bannerSuperior={null}
      seccionPDFInferior={seccionPDFInferior}
    />
  );
};

export default FormularioEditarExpediente;

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

  /**
   * Wrapper del guardarExpediente para incluir detección de cambios
   */
  const guardarConAuditoria = async () => {
    try {
      // 0. Verificar si hay PDF pendiente de subir
      let cambioPDF = null;
      if (archivoSeleccionado) {
        const pdfAnterior = formulario.pdf_nombre;
        const pdfKeyAnterior = formulario.pdf_key; // Guardar key anterior para historial
        setSubiendoPDF(true);
        try {
          const resultPDF = await subirPDFPoliza(formulario.id, archivoSeleccionado);
          if (resultPDF) {
            cambioPDF = {
              esReemplazo: !!pdfAnterior,
              anterior: pdfAnterior || null,
              anterior_key: pdfKeyAnterior || null, // Key para poder abrir el PDF anterior
              nuevo: archivoSeleccionado.name,
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
              pdf_fecha_subida: resultPDF.pdf_fecha_subida
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
          
          // Registrar evento de actualización en el historial
          // Usamos 'edicion_manual_expediente' para que tenga el mismo formato visual
          await historialExpedienteService.registrarEvento({
            expediente_id: formulario.id,
            cliente_id: formulario.cliente_id,
            usuario_nombre: 'Sistema',
            tipo_evento: 'edicion_manual_expediente',
            descripcion: `Edición manual de expediente | ${formulario.compania || 'Sin aseguradora'} | Póliza: ${formulario.numero_poliza || 'Sin número'} | ${descripcionPartes.join(' + ')}`,
            datos_adicionales: {
              metodo_captura: 'Edición Manual',
              fecha_edicion: new Date().toISOString(),
              aseguradora: formulario.compania,
              numero_poliza: formulario.numero_poliza,
              usuario_edito: 'Sistema',
              etapa_actual: formulario.etapa_activa || 'Sin etapa',
              
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

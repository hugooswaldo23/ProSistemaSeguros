import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Hook personalizado para manejar la extracción y procesamiento de datos desde PDF
 * Encapsula toda la lógica de procesamiento posterior a la extracción
 */
export const usePDFExtractor = ({
  setFormulario,
  actualizarCalculosAutomaticos,
  handleClienteSeleccionado,
  aseguradoras,
  tiposProductos,
  setMostrarExtractorPDF,
  setVistaActual
}) => {
  // Estados para manejo de datos extraídos
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);
  const [infoImportacion, setInfoImportacion] = useState(null);
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');
  const [datosTemporales, setDatosTemporales] = useState(null);

  /**
   * Handler principal que procesa los datos extraídos del PDF
   * @param {Object} datosExtraidos - Datos extraídos por el extractor de PDF
   */
  const handleDataExtracted = useCallback(async (datosExtraidos) => {
    try {
      // 1. USAR EL CLIENTE QUE YA FUE CREADO EN EL EXTRACTOR PDF
      let clienteSeleccionadoFinal = null;
      
      if (datosExtraidos.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          clienteSeleccionadoFinal = clientes.find(c => c.id === datosExtraidos.cliente_id);
          
          if (clienteSeleccionadoFinal) {
            handleClienteSeleccionado(clienteSeleccionadoFinal);
            console.log('✅ Cliente vinculado:', clienteSeleccionadoFinal.nombre || clienteSeleccionadoFinal.razonSocial);
          } else {
            console.error('❌ No se encontró el cliente con ID:', datosExtraidos.cliente_id);
          }
        } catch (error) {
          console.error('❌ Error al buscar cliente:', error);
        }
      } else {
        console.warn('⚠️ No se proporcionó cliente_id. El cliente debe ser seleccionado manualmente.');
      }
      
      // 2. PREPARAR NOMBRE DEL AGENTE PARA MOSTRAR EN EL FORMULARIO
      let agenteDisplay = '';
      if (datosExtraidos.clave_agente && datosExtraidos.agente) {
        agenteDisplay = `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}`;
        console.log('✅ Agente extraído:', agenteDisplay);
      } else if (datosExtraidos.agente) {
        agenteDisplay = datosExtraidos.agente;
        console.log('✅ Agente extraído:', agenteDisplay);
      }
      
      // 3. POPULAR FORMULARIO CON DATOS DE LA PÓLIZA
      console.log(`📋 Extracción completa | Póliza: ${datosExtraidos.numero_poliza} | Vehículo: ${datosExtraidos.marca} ${datosExtraidos.modelo}`);
      
      // EXCLUIR campos del cliente para NO sobrescribirlos
      const { 
        nombre, apellido_paterno, apellido_materno, 
        razonSocial, razon_social, 
        nombreComercial, nombre_comercial,
        rfc, tipo_persona,
        email, telefono_fijo, telefono_movil,
        ...datosPoliza 
      } = datosExtraidos;
      
      // Aplicar datos al formulario
      setFormulario(prev => {
        const aplicarSiVacio = (valorPDF, valorActual) => {
          if (valorActual && valorActual !== '' && valorActual !== null) {
            return valorActual;
          }
          if (!valorPDF || valorPDF === '') {
            return null;
          }
          return valorPDF;
        };

        const agenteParaFormulario = datosExtraidos.clave_agente && datosExtraidos.agente 
          ? `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}` 
          : (datosExtraidos.agente || agenteDisplay || prev.agente || '');
        
        // NORMALIZACIÓN DE COMPAÑÍA
        let companiaNormalizada = datosExtraidos.compania || prev.compania;
        if (datosExtraidos.compania) {
          const companiaEncontrada = aseguradoras.find(a => 
            a.nombre.toLowerCase() === datosExtraidos.compania.toLowerCase()
          );
          if (companiaEncontrada) {
            companiaNormalizada = companiaEncontrada.nombre;
            console.log('✅ Compañía normalizada:', datosExtraidos.compania, '→', companiaNormalizada);
          }
        }

        // NORMALIZACIÓN DE PRODUCTO
        let productoNormalizado = datosExtraidos.producto || prev.producto;
        if (datosExtraidos.producto) {
          let productoEncontrado = tiposProductos.find(p => 
            p.nombre.toLowerCase() === datosExtraidos.producto.toLowerCase()
          );
          
          if (!productoEncontrado) {
            productoEncontrado = tiposProductos.find(p => 
              datosExtraidos.producto.toLowerCase().includes(p.nombre.toLowerCase()) ||
              p.nombre.toLowerCase().includes(datosExtraidos.producto.toLowerCase())
            );
          }
          
          if (productoEncontrado) {
            productoNormalizado = productoEncontrado.nombre;
            console.log('✅ Producto normalizado:', datosExtraidos.producto, '→', productoNormalizado);
          }
        }

        const nuevoFormulario = {
          ...prev,
          ...datosPoliza,
          cliente_id: datosExtraidos.cliente_id || prev.cliente_id,
          cargo_pago_fraccionado: aplicarSiVacio(datosPoliza.cargo_pago_fraccionado, prev.cargo_pago_fraccionado),
          gastos_expedicion: aplicarSiVacio(datosPoliza.gastos_expedicion, prev.gastos_expedicion),
          subtotal: aplicarSiVacio(datosPoliza.subtotal, prev.subtotal),
          uso: aplicarSiVacio(datosPoliza.uso, prev.uso),
          servicio: aplicarSiVacio(datosPoliza.servicio, prev.servicio),
          movimiento: aplicarSiVacio(datosPoliza.movimiento, prev.movimiento),
          fecha_emision: datosPoliza.fecha_emision || prev.fecha_emision || new Date().toISOString().split('T')[0],
          agente: agenteParaFormulario,
          clave_agente: datosExtraidos.clave_agente || prev.clave_agente || '',
          sub_agente: '',
          etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
          compania: companiaNormalizada,
          producto: productoNormalizado,
          tipo_cobertura: datosExtraidos.tipo_cobertura || datosPoliza.tipo_cobertura || prev.tipo_cobertura,
          deducible: datosExtraidos.deducible || datosPoliza.deducible || prev.deducible,
          suma_asegurada: datosExtraidos.suma_asegurada || datosPoliza.suma_asegurada || prev.suma_asegurada,
          marca: datosExtraidos.marca || datosPoliza.marca || prev.marca,
          modelo: datosExtraidos.modelo || datosPoliza.modelo || prev.modelo,
          anio: datosExtraidos.anio || datosPoliza.anio || prev.anio,
          numero_serie: datosExtraidos.numero_serie || datosPoliza.numero_serie || prev.numero_serie,
          placas: datosExtraidos.placas || datosPoliza.placas || prev.placas,
          color: datosExtraidos.color || datosPoliza.color || prev.color,
          tipo_pago: datosExtraidos.tipo_pago || prev.tipo_pago,
          frecuenciaPago: datosExtraidos.frecuenciaPago || prev.frecuenciaPago,
          forma_pago: datosExtraidos.forma_pago || prev.forma_pago,
          primer_pago: datosExtraidos.primer_pago || prev.primer_pago,
          pagos_subsecuentes: datosExtraidos.pagos_subsecuentes || prev.pagos_subsecuentes,
          periodo_gracia: datosExtraidos.periodo_gracia || datosExtraidos.plazo_pago_dias || prev.periodo_gracia,
          __pdfFile: datosExtraidos.__pdfFile || prev.__pdfFile,
          __pdfNombre: datosExtraidos.__pdfNombre || prev.__pdfNombre,
          __pdfSize: datosExtraidos.__pdfSize || prev.__pdfSize
        };
        
        console.log(`✅ Formulario actualizado | Cliente: ${nuevoFormulario.cliente_id || 'N/A'} | Póliza: ${nuevoFormulario.numero_poliza || 'N/A'}`);
        
        return nuevoFormulario;
      });
      
      // 4. PRESERVAR DATOS DEL PDF - NO RECALCULAR (los datos extraídos son la verdad absoluta)
      if (datosExtraidos.inicio_vigencia) {
        setTimeout(() => {
          setFormulario(prev => {
            // ✅ Solo calcular término_vigencia si NO viene en el PDF
            if (!prev.termino_vigencia && prev.inicio_vigencia) {
              const fechaTermino = new Date(prev.inicio_vigencia);
              fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
              return {
                ...prev,
                termino_vigencia: fechaTermino.toISOString().split('T')[0]
              };
            }
            // Preservar todos los datos del PDF sin modificaciones
            return prev;
          });
          console.log('✅ Datos del PDF preservados (sin recálculos automáticos)');
          
          setTimeout(() => {
            if (window.globalSnapshotPendiente !== undefined) {
              window.globalSnapshotPendiente = true;
            }
            console.log('📸 Snapshot pendiente');
          }, 200);
        }, 150);
      } else {
        setTimeout(() => {
          setFormulario(prev => ({
            ...prev,
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteDisplay || '',
            marca: datosExtraidos.marca,
            modelo: datosExtraidos.modelo,
            anio: datosExtraidos.anio,
            numero_serie: datosExtraidos.numero_serie,
            motor: datosExtraidos.motor,
            placas: datosExtraidos.placas,
            color: datosExtraidos.color,
            tipo_vehiculo: datosExtraidos.tipo_vehiculo,
            tipo_cobertura: datosExtraidos.tipo_cobertura,
            codigo_vehiculo: datosExtraidos.codigo_vehiculo,
            tipo_pago: datosExtraidos.tipo_pago,
            frecuenciaPago: datosExtraidos.frecuenciaPago,
            primer_pago: datosExtraidos.primer_pago,
            pagos_subsecuentes: datosExtraidos.pagos_subsecuentes,
            forma_pago: datosExtraidos.forma_pago,
            uso: datosExtraidos.uso,
            servicio: datosExtraidos.servicio,
            movimiento: datosExtraidos.movimiento
          }));
          console.log('✅ Valores forzados después del render');
          
          setTimeout(() => {
            if (window.globalSnapshotPendiente !== undefined) {
              window.globalSnapshotPendiente = true;
            }
          }, 150);
        }, 100);
      }
      
      // 5. MOSTRAR MENSAJE DE CONFIRMACIÓN Y ABRIR FORMULARIO
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
      if (setVistaActual) {
        setVistaActual('formulario');
      }
      
      setInfoImportacion({
        clienteCreado: clienteSeleccionadoFinal && !datosExtraidos.cliente_existente,
        clienteEncontrado: !!datosExtraidos.cliente_existente,
        nombreCliente: clienteSeleccionadoFinal?.nombre || 'N/A',
        agenteAsignado: !!agenteDisplay,
        poliza: datosExtraidos.numero_poliza || 'N/A',
        compania: datosExtraidos.compania || 'N/A'
      });
      
      console.log('📊 Resumen de importación:');
      if (clienteSeleccionadoFinal) {
        const esNuevo = !datosExtraidos.cliente_existente;
        console.log('  Cliente:', esNuevo ? '🆕 Creado automáticamente' : '✅ Encontrado', '-', clienteSeleccionadoFinal.nombre);
      }
      console.log('  Agente:', agenteDisplay ? `✅ ${agenteDisplay}` : '⚠️ No extraído');
      console.log('  Póliza:', datosExtraidos.numero_poliza || 'N/A');
      
    } catch (error) {
      console.error('Error al procesar datos extraídos:', error);
      setFormulario(prev => ({
        ...prev,
        ...datosExtraidos,
        fecha_creacion: prev.fecha_creacion,
        id: prev.id
      }));
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
      if (setVistaActual) {
        setVistaActual('formulario');
      }
    }
  }, [setFormulario, actualizarCalculosAutomaticos, handleClienteSeleccionado, aseguradoras, tiposProductos, setMostrarExtractorPDF, setVistaActual]);

  /**
   * Limpia los datos de importación
   */
  const limpiarDatosImportados = useCallback(() => {
    setDatosImportadosDesdePDF(false);
    setInfoImportacion(null);
  }, []);

  return {
    // Estados
    datosImportadosDesdePDF,
    infoImportacion,
    mostrarModalRFC,
    rfcCapturado,
    datosTemporales,
    
    // Setters
    setDatosImportadosDesdePDF,
    setInfoImportacion,
    setMostrarModalRFC,
    setRfcCapturado,
    setDatosTemporales,
    
    // Funciones
    handleDataExtracted,
    limpiarDatosImportados
  };
};

/**
 * ====================================================================
 * COMPONENTE: FORMULARIO DE EXPEDIENTE
 * ====================================================================
 * Formulario completo de captura/edición de expedientes
 * - Todos los campos de póliza
 * - Validaciones
 * - Cálculos automáticos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, X, CheckCircle, AlertCircle, FileText, Eye, Trash2 } from 'lucide-react';
import { CONSTANTS, globalSnapshotPendiente, setGlobalSnapshotPendiente } from '../../utils/expedientesConstants';
import utils from '../../utils/expedientesUtils';
import { CampoFechaCalculada } from './UIComponents';
import BuscadorCliente from '../BuscadorCliente';
import ExtractorPolizasPDF from './ExtractorPolizasPDF';
import CalendarioPagos from './CalendarioPagos';
import * as pdfService from '../../services/pdfService';
import * as estatusPagosUtils from '../../utils/estatusPagos';

const API_URL = import.meta.env.VITE_API_URL;

// Función helper para convertir fecha ISO a formato yyyy-MM-dd
const formatearFechaParaInput = (fecha) => {
  if (!fecha) return '';
  // Si ya está en formato yyyy-MM-dd, devolverla tal cual
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  // Si tiene timestamp ISO, extraer solo la parte de fecha
  if (typeof fecha === 'string' && fecha.includes('T')) {
    return fecha.split('T')[0];
  }
  // Si es Date object, convertir
  const fechaObj = new Date(fecha);
  if (isNaN(fechaObj.getTime())) return '';
  return fechaObj.toISOString().split('T')[0];
};

// 👇 COPIAR AQUÍ desde Expedientes.jsx líneas 4396 hasta 6283
const Formulario = React.memo(({ 
  modoEdicion,
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
  CONSTANTS,
  handleClienteSeleccionado,
  clienteSeleccionado,
  handleSeleccionarPDF,
  archivoSeleccionado,
  subiendoPDF,
  subirPDFPoliza,
  mostrarExtractorPDF,
  setMostrarExtractorPDF,
  onEliminarPago // Callback para eliminar pagos
}) => {
  // Estados movidos al componente padre
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);
  const [infoImportacion, setInfoImportacion] = useState(null);
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');
  const [datosTemporales, setDatosTemporales] = useState(null);
  
  // 🔄 Sincronizar automáticamente el estatusPago con el calendario
  useEffect(() => {
    if (formulario.recibos && Array.isArray(formulario.recibos) && formulario.recibos.length > 0) {
      // Buscar el primer recibo no pagado
      const primerReciboPendiente = formulario.recibos.find(r => !r.fecha_pago_real);
      
      if (primerReciboPendiente) {
        // Calcular estatus usando la misma función que el calendario
        const estatusCalculado = estatusPagosUtils.calcularEstatusRecibo(
          primerReciboPendiente.fecha_vencimiento,
          null
        );
        
        // Solo actualizar si es diferente para evitar loops infinitos
        if (formulario.estatusPago !== estatusCalculado) {
          console.log('🔄 Sincronizando estatus del formulario con calendario:', estatusCalculado);
          setFormulario(prev => ({
            ...prev,
            estatusPago: estatusCalculado
          }));
        }
      }
    }
  }, [formulario.recibos, formulario.estatusPago, setFormulario]);
  
  // Estados locales para vendedores
  const [vendedores, setVendedores] = useState([]);
  const [agenteIdSeleccionado, setAgenteIdSeleccionado] = useState(null);

  // Función para obtener vendedores filtrados por clave de agente y aseguradora
  const obtenerVendedoresPorAgente = async (agenteId, claveAgente = null, aseguradora = null) => {
    if (!agenteId) {
      setVendedores([]);
      return;
    }

    try {
      // Construir URL con parámetros de filtro
      let url = `${API_URL}/api/equipoDeTrabajo/vendedores-por-agente/${agenteId}`;
      const params = new URLSearchParams();
      
      if (claveAgente) {
        params.append('clave', claveAgente);
      }
      
      if (aseguradora) {
        params.append('aseguradora', aseguradora);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log('🔍 Solicitando vendedores:', { url, agenteId, claveAgente, aseguradora });
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Vendedores obtenidos del backend:', data);
        
        // El backend devuelve { agenteId, vendedores: [...], total }
        let vendedoresArray = data.vendedores || [];
        console.log('✅ Total vendedores antes de filtrar:', vendedoresArray.length);
        
        // Filtrar por clave si se especificó (doble validación por si el backend no filtra bien)
        if (claveAgente && vendedoresArray.length > 0) {
          vendedoresArray = vendedoresArray.filter(vendedor => {
            // Verificar si tiene la clave en comisionesCompartidas
            const comisiones = vendedor.comisionesCompartidas || [];
            const tieneClave = comisiones.some(com => 
              com.clave && com.clave.toString() === claveAgente.toString()
            );
            
            console.log(`🔍 ${vendedor.nombre}: tiene clave ${claveAgente}?`, tieneClave, 
              'claves:', comisiones.map(c => c.clave));
            
            return tieneClave;
          });
          console.log('✅ Vendedores después de filtrar por clave:', vendedoresArray.length);
        }
        
        setVendedores(vendedoresArray);
      } else {
        console.error('❌ Error al obtener vendedores:', response.statusText);
        setVendedores([]);
      }
    } catch (error) {
      console.error('❌ Error al obtener vendedores:', error);
      setVendedores([]);
    }
  };

  // Función para extraer ID del agente desde el texto del formulario
  const extraerAgenteIdDelFormulario = (agenteTexto) => {
    if (!agenteTexto || !agentes.length) {
      console.log('🔍 No hay texto de agente o no hay agentes:', { agenteTexto, agentesLength: agentes.length });
      return null;
    }

    console.log('🔍 Buscando agente en texto:', agenteTexto);
    console.log('🔍 Agentes disponibles:', agentes.map(a => ({ id: a.id, nombre: a.nombre, codigoAgente: a.codigoAgente })));

    // Método 1: Buscar por código de agente (primera palabra del texto)
    const codigoAgente = agenteTexto.trim().split(' ')[0];
    let agenteEncontrado = agentes.find(a => 
      a.codigoAgente && a.codigoAgente.toString() === codigoAgente
    );
    
    if (agenteEncontrado) {
      console.log('✅ Agente encontrado por código:', agenteEncontrado);
      return agenteEncontrado.id;
    }

    // Método 2: Buscar por nombre completo en el texto
    const textoLimpio = agenteTexto.toLowerCase().trim();
    agenteEncontrado = agentes.find(a => {
      if (a.perfil !== 'Agente') return false;
      const nombreCompleto = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.toLowerCase().trim();
      return textoLimpio.includes(nombreCompleto) || nombreCompleto.includes(textoLimpio.replace(/^\d+\s*-?\s*/, ''));
    });

    if (agenteEncontrado) {
      console.log('✅ Agente encontrado por nombre:', agenteEncontrado);
      return agenteEncontrado.id;
    }

    // Método 3: Búsqueda flexible por palabras clave
    agenteEncontrado = agentes.find(a => {
      if (a.perfil !== 'Agente') return false;
      const nombreCompleto = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.toLowerCase();
      const palabrasTexto = textoLimpio.split(/\s+/);
      return palabrasTexto.some(palabra => 
        palabra.length > 2 && nombreCompleto.includes(palabra)
      );
    });

    if (agenteEncontrado) {
      console.log('✅ Agente encontrado por palabras clave:', agenteEncontrado);
      return agenteEncontrado.id;
    }

    console.log('❌ No se encontró ningún agente para el texto:', agenteTexto);
    return null;
  };

  // Efecto para cargar vendedores cuando se edita un expediente existente
  useEffect(() => {
    console.log('🔄 useEffect vendedores ejecutándose:', { 
      agenteTexto: formulario.agente, 
      compania: formulario.compania,
      agentesLength: agentes.length,
      agenteIdSeleccionado 
    });
    
    if (formulario.agente && agentes.length > 0) {
      const agenteId = extraerAgenteIdDelFormulario(formulario.agente);
      // Extraer clave del agente (primera parte del texto)
      const claveAgente = formulario.agente.trim().split(' ')[0];
      console.log('🎯 Agente ID extraído:', agenteId, 'Clave:', claveAgente, 'Compañía:', formulario.compania);
      
      if (agenteId && agenteId !== agenteIdSeleccionado) {
        console.log('📝 Actualizando agente seleccionado:', agenteId);
        setAgenteIdSeleccionado(agenteId);
        // ✅ Pasar claveAgente y compañía para que el filtrado funcione correctamente
        obtenerVendedoresPorAgente(agenteId, claveAgente, formulario.compania);
      } else if (!agenteId) {
        console.log('🚫 No se encontró ID de agente, limpiando vendedores');
        setAgenteIdSeleccionado(null);
        setVendedores([]);
      }
    } else {
      console.log('⚠️ Condiciones no cumplidas para buscar vendedores');
      setAgenteIdSeleccionado(null);
      setVendedores([]);
    }
  }, [formulario.agente, formulario.compania, agentes]);

  const handleDataExtracted = useCallback(async (datosExtraidos) => {
    try {
      // 1. USAR EL CLIENTE QUE YA FUE CREADO EN EL EXTRACTOR PDF
      let clienteSeleccionadoFinal = null;
      
      if (datosExtraidos.cliente_id) {
        // El cliente ya fue creado o encontrado en el extractor PDF
        // Buscar el cliente en la base de datos usando el cliente_id
        
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
      // Los extractores ahora envían clave_agente y agente por separado
      // El modal de agentes ya valida y vincula al agente en el equipo de trabajo
      let agenteDisplay = '';
      if (datosExtraidos.clave_agente && datosExtraidos.agente) {
        agenteDisplay = `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}`;
        console.log('✅ Agente extraído:', agenteDisplay);
      } else if (datosExtraidos.agente) {
        agenteDisplay = datosExtraidos.agente;
        console.log('✅ Agente extraído:', agenteDisplay);
      }
      
      // 3. BUSCAR VENDEDOR/SUB-AGENTE (si aplica)
      // Los vendedores usan la misma clave que el agente al que están ligados
      // Por ahora lo dejamos vacío, se puede seleccionar manualmente
      let subAgenteId = null;
      
      // 4. POPULAR FORMULARIO CON DATOS DE LA PÓLIZA (NO sobrescribir datos del cliente)
      console.log(`📋 Extracción completa | Póliza: ${datosExtraidos.numero_poliza} | Vehículo: ${datosExtraidos.marca} ${datosExtraidos.modelo}`);
      
      // EXCLUIR campos del cliente para NO sobrescribirlos con valores undefined del PDF
      const { 
        // Campos del cliente que NO deben sobrescribirse
        nombre, apellido_paterno, apellido_materno, 
        razonSocial, razon_social, 
        nombreComercial, nombre_comercial,
        rfc, tipo_persona,
        email, telefono_fijo, telefono_movil,
        // El resto son datos de la póliza
        ...datosPoliza 
      } = datosExtraidos;
      
      // Usar setFormulario con callback para hacer UPDATE PARCIAL
      setFormulario(prev => {
        // ✅ LÓGICA MEJORADA: Solo aplicar datos del PDF si el campo actual está vacío o es null
        const aplicarSiVacio = (valorPDF, valorActual) => {
          // Si el valor actual tiene contenido válido, mantenerlo
          if (valorActual && valorActual !== '' && valorActual !== null) {
            return valorActual;
          }
          // Si el valor del PDF está vacío o es string vacío, usar null
          if (!valorPDF || valorPDF === '') {
            return null;
          }
          // Usar valor del PDF
          return valorPDF;
        };

        // Concatenar agente para el formulario
        const agenteParaFormulario = datosExtraidos.clave_agente && datosExtraidos.agente 
          ? `${datosExtraidos.clave_agente} - ${datosExtraidos.agente}` 
          : (datosExtraidos.agente || agenteDisplay || prev.agente || '');
        
        console.log('🔍 Aplicando agente al formulario:', agenteParaFormulario);

        // ✅ NORMALIZACIÓN DE COMPAÑÍA: Buscar coincidencia case-insensitive
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

        // ✅ NORMALIZACIÓN DE PRODUCTO: Buscar coincidencia parcial o exacta
        let productoNormalizado = datosExtraidos.producto || prev.producto;
        if (datosExtraidos.producto) {
          // Primero buscar coincidencia exacta
          let productoEncontrado = tiposProductos.find(p => 
            p.nombre.toLowerCase() === datosExtraidos.producto.toLowerCase()
          );
          
          // Si no hay coincidencia exacta, buscar coincidencia parcial (ej: "Autos" en "Tu Auto Seguro Más")
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
          ...prev, // Mantener TODO (incluye datos del cliente que ya están bien)
          ...datosPoliza, // Aplicar datos de la póliza base
          // Mantener cliente_id
          cliente_id: datosExtraidos.cliente_id || prev.cliente_id,
          
          // ✅ PROTEGER campos críticos que el usuario pudo haber llenado manualmente
          cargo_pago_fraccionado: aplicarSiVacio(datosPoliza.cargo_pago_fraccionado, prev.cargo_pago_fraccionado),
          gastos_expedicion: aplicarSiVacio(datosPoliza.gastos_expedicion, prev.gastos_expedicion),
          subtotal: aplicarSiVacio(datosPoliza.subtotal, prev.subtotal),
          uso: aplicarSiVacio(datosPoliza.uso, prev.uso),
          servicio: aplicarSiVacio(datosPoliza.servicio, prev.servicio),
          movimiento: aplicarSiVacio(datosPoliza.movimiento, prev.movimiento),
          // Si no tiene fecha_emision, usar fecha actual como valor inicial
          fecha_emision: datosPoliza.fecha_emision || prev.fecha_emision || new Date().toISOString().split('T')[0],
          // Forzar valores críticos de la póliza que vienen del PDF
          agente: agenteParaFormulario,
          clave_agente: datosExtraidos.clave_agente || prev.clave_agente || '',
          sub_agente: '',
          etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
          // Usar datos normalizados del PDF
          compania: companiaNormalizada,
          producto: productoNormalizado,
          tipo_cobertura: datosExtraidos.tipo_cobertura || datosPoliza.tipo_cobertura || prev.tipo_cobertura,
          deducible: datosExtraidos.deducible || datosPoliza.deducible || prev.deducible,
          suma_asegurada: datosExtraidos.suma_asegurada || datosPoliza.suma_asegurada || prev.suma_asegurada,
          // Vehículo
          marca: datosExtraidos.marca || datosPoliza.marca || prev.marca,
          modelo: datosExtraidos.modelo || datosPoliza.modelo || prev.modelo,
          anio: datosExtraidos.anio || datosPoliza.anio || prev.anio,
          numero_serie: datosExtraidos.numero_serie || datosPoliza.numero_serie || prev.numero_serie,
          placas: datosExtraidos.placas || datosPoliza.placas || prev.placas,
          color: datosExtraidos.color || datosPoliza.color || prev.color,
          // ====== CONFIGURACIÓN DE PAGOS FRACCIONADOS ======
          // Mapear tipo_pago y frecuenciaPago desde forma_pago si existe
          tipo_pago: datosExtraidos.tipo_pago || prev.tipo_pago,
          frecuenciaPago: datosExtraidos.frecuenciaPago || prev.frecuenciaPago,
          forma_pago: datosExtraidos.forma_pago || prev.forma_pago,
          primer_pago: datosExtraidos.primer_pago || prev.primer_pago,
          pagos_subsecuentes: datosExtraidos.pagos_subsecuentes || prev.pagos_subsecuentes,
          periodo_gracia: datosExtraidos.periodo_gracia || datosExtraidos.plazo_pago_dias || prev.periodo_gracia,
          // Guardar temporalmente el archivo PDF traído desde el extractor (no se envía al backend)
          __pdfFile: datosExtraidos.__pdfFile || prev.__pdfFile,
          __pdfNombre: datosExtraidos.__pdfNombre || prev.__pdfNombre,
          __pdfSize: datosExtraidos.__pdfSize || prev.__pdfSize
        };
        
        console.log(`✅ Formulario actualizado | Cliente: ${nuevoFormulario.cliente_id || 'N/A'} | Póliza: ${nuevoFormulario.numero_poliza || 'N/A'} | Vehículo: ${nuevoFormulario.marca} ${nuevoFormulario.modelo} ${nuevoFormulario.anio}`);
        
        return nuevoFormulario;
      });
      
      // 5. RECALCULAR FECHAS Y MONTOS AUTOMÁTICOS (incluye estatusPago)
      if (datosExtraidos.inicio_vigencia) {
        setTimeout(() => {
          setFormulario(prev => {
            const formularioConCalculos = actualizarCalculosAutomaticos(prev);
            // ✅ SOLO aplicar los cálculos automáticos, NO sobrescribir datos del PDF
            // Los datos del PDF ya están en 'prev' del setFormulario anterior
            const formularioFinal = {
              ...prev,
              ...formularioConCalculos
              // NO sobrescribir nada más - los datos del PDF ya están en 'prev'
            };
            
            return formularioFinal;
          });
          console.log('✅ Cálculos automáticos aplicados (preservando datos del PDF)');
          
          // 🔍 MARCAR que el snapshot debe guardarse después de que el formulario termine de actualizarse
          setTimeout(() => {
            setGlobalSnapshotPendiente(true);
            console.log('📸 Snapshot pendiente - se guardará en próximo render');
          }, 200);
        }, 150);
      } else {
        // FORZAR la actualización después de un pequeño delay
        setTimeout(() => {
          setFormulario(prev => ({
            ...prev,
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteDisplay || '',
            // Preservar datos del vehículo también en este caso
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
            // Preservar campos adicionales de pago y póliza
            tipo_pago: datosExtraidos.tipo_pago,
            frecuenciaPago: datosExtraidos.frecuenciaPago,
            primer_pago: datosExtraidos.primer_pago,
            pagos_subsecuentes: datosExtraidos.pagos_subsecuentes,
            forma_pago: datosExtraidos.forma_pago,
            uso: datosExtraidos.uso,
            servicio: datosExtraidos.servicio,
            movimiento: datosExtraidos.movimiento
          }));
          console.log('✅ Valores forzados después del render (incluyendo vehículo)');
          
          // 🔍 MARCAR que el snapshot debe guardarse (modo fallback)
          setTimeout(() => {
            setGlobalSnapshotPendiente(true);
            console.log('📸 Snapshot pendiente (fallback) - se guardará en próximo render');
          }, 150);
        }, 100);
      }
      
      // 6. MOSTRAR MENSAJE DE CONFIRMACIÓN
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
      
      // Guardar información de la importación para mostrar en UI
      setInfoImportacion({
        clienteCreado: clienteSeleccionadoFinal && !datosExtraidos.cliente_existente,
        clienteEncontrado: !!datosExtraidos.cliente_existente,
        nombreCliente: clienteSeleccionadoFinal?.nombre || 'N/A',
        agenteAsignado: !!agenteDisplay,
        poliza: datosExtraidos.numero_poliza || 'N/A',
        compania: datosExtraidos.compania || 'N/A'
      });
      
      // Mostrar resumen de lo que se importó
      console.log('📊 Resumen de importación:');
      if (clienteSeleccionadoFinal) {
        const esNuevo = !datosExtraidos.cliente_existente;
        console.log('  Cliente:', esNuevo ? '🆕 Creado automáticamente' : '✅ Encontrado', '-', clienteSeleccionadoFinal.nombre);
        console.log('  ID Cliente:', clienteSeleccionadoFinal.id);
      } else {
        console.log('  Cliente: ⚠️ No pudo crearse - revisar datos');
      }
      console.log('  Agente:', agenteDisplay ? `✅ ${agenteDisplay}` : '⚠️ No extraído del PDF');
      console.log('  Póliza:', datosExtraidos.numero_poliza || 'N/A');
      console.log('  Compañía:', datosExtraidos.compania || 'N/A');
      
    } catch (error) {
      console.error('Error al procesar datos extraídos:', error);
      // Aún así intentar popular el formulario con lo que se pueda
      setFormulario(prev => ({
        ...prev,
        ...datosExtraidos,
        fecha_creacion: prev.fecha_creacion,
        id: prev.id
      }));
      setDatosImportadosDesdePDF(true);
      setMostrarExtractorPDF(false);
    }
  }, [formulario, actualizarCalculosAutomaticos, setFormulario, handleClienteSeleccionado, agentes]);

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0" style={{ fontSize: '1.1rem' }}>
          {modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente'}
        </h5>
        <div className="d-flex gap-2">
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary btn-sm"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ fontSize: '0.85rem' }}>
          <style>{`
            .card-body .form-label { margin-bottom: 0.25rem; font-size: 0.8rem; }
            .card-body .form-control, 
            .card-body .form-select { 
              padding: 0.25rem 0.5rem; 
              font-size: 0.85rem;
              height: calc(1.5em + 0.5rem + 2px);
            }
            .card-body .row { margin-bottom: 0.5rem; }
            .card-body h6.card-title { font-size: 0.9rem; }
            .card-body h6 { font-size: 0.85rem; }
            .card-body .alert { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
            .card-body hr { margin: 0.5rem 0; }
          `}</style>
          {datosImportadosDesdePDF && !modoEdicion && infoImportacion && (
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
          )}

          {/* Datos del Cliente */}
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>
              {clienteSeleccionado?.tipoPersona === 'Persona Moral' ? 'Datos de la Empresa' : 'Datos del Cliente'}
            </h6>
            
            {/* Buscador de Cliente */}
            <BuscadorCliente
              onClienteSeleccionado={handleClienteSeleccionado}
              clienteSeleccionado={clienteSeleccionado}
              datosIniciales={{
                nombre: formulario.nombre,
                apellido_paterno: formulario.apellido_paterno,
                apellido_materno: formulario.apellido_materno,
                rfc: formulario.rfc
              }}
              mostrarBotonNuevo={true}
            />

            {/* Datos del cliente (solo lectura si está seleccionado) */}
            {clienteSeleccionado && (
              <div className="row g-2 mt-1" key={clienteSeleccionado.id}>
                {clienteSeleccionado.tipoPersona === 'Persona Moral' ? (
                  // Campos para Persona Moral (Empresa)
                  <>
                    <div className="col-md-12">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Razón Social</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.razon_social || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre Comercial</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.nombre_comercial || ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>RFC</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.rfc || ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Datos de Contacto - Editables */}
                    <div className="col-12">
                      <hr className="my-2" />
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        💼 Datos del Contacto Principal
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Editable - Se actualizará el cliente)
                        </span>
                      </small>
                      <div className="alert alert-info py-1 px-2 mb-2" role="alert" style={{ fontSize: '0.7rem' }}>
                        Requisito mínimo para guardar póliza (PM): <strong>Nombre</strong> y <strong>Email</strong> o <strong>Teléfono Móvil</strong>.
                      </div>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre del Contacto <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_nombre || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_nombre: e.target.value})}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_paterno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_paterno: e.target.value})}
                        placeholder="Apellido Paterno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formulario.contacto_apellido_materno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_materno: e.target.value})}
                        placeholder="Apellido Materno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email del Contacto <span className="text-muted" style={{ fontSize: '0.7rem' }}>(uno de estos)</span></label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil <span className="text-muted" style={{ fontSize: '0.7rem' }}>(uno de estos)</span></label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                  </>
                ) : (
                  // Campos para Persona Física
                  <>
                    {/* Datos del Cliente (Solo lectura) */}
                    <div className="col-12">
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        👤 Datos del Cliente
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Solo lectura)
                        </span>
                      </small>
                    </div>
                    
                    {/* Primera fila: Nombre, Apellidos y RFC */}
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.nombre ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.apellido_paterno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.apellido_materno ?? ''}
                        readOnly
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>RFC</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.rfc ?? ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Segunda fila: Email y Teléfonos */}
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.email || ''}
                        onChange={(e) => setFormulario({...formulario, email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_fijo: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                    
                    {/* Datos de Contacto Adicional/Gestor - Editables */}
                    <div className="col-12">
                      <hr className="my-2" />
                      <small className="text-muted d-block mb-1" style={{ fontSize: '0.75rem' }}>
                        💼 Contacto Adicional / Gestor
                        <span className="ms-1" style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>
                          (Opcional - Editable)
                        </span>
                      </small>
                    </div>
                    
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre del Contacto</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_nombre || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_nombre: e.target.value})}
                        placeholder="Nombre"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Paterno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_apellido_paterno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_paterno: e.target.value})}
                        placeholder="Apellido Paterno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Apellido Materno</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formulario.contacto_apellido_materno || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_apellido_materno: e.target.value})}
                        placeholder="Apellido Materno"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Email del Contacto</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formulario.contacto_email || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_email: e.target.value})}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_fijo: e.target.value})}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Móvil</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.contacto_telefono_movil || ''}
                        onChange={(e) => setFormulario({...formulario, contacto_telefono_movil: e.target.value})}
                        placeholder="55 5555 5555"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Datos del Seguro */}
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Datos del Seguro</h6>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Compañía <span className="text-danger">*</span></label>
                <select
                  className="form-select form-select-sm"
                  value={formulario.compania}
                  onChange={(e) => {
                    const nuevaCompania = e.target.value;
                    const nuevoFormulario = { ...formulario, compania: nuevaCompania };
                    // Recalcular automáticamente con la nueva compañía
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                  required
                >
                  <option value="">Seleccionar compañía</option>
                  {companias.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Producto <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formulario.producto}
                  onChange={(e) => {
                    const nuevoProducto = e.target.value;
                    if (formulario.producto === 'Autos Individual' && nuevoProducto !== 'Autos') {
                      setFormulario(prev => ({
                        ...prev, 
                        producto: nuevoProducto,
                        marca: '',
                        modelo: '',
                        anio: '',
                        numero_serie: '',
                        placas: '',
                        color: '',
                        tipo_vehiculo: '',
                        numero_poliza: '',
                        tipo_cobertura: '',
                        deducible: '',
                        suma_asegurada: '',
                        conductor_habitual: '',
                        edad_conductor: '',
                        licencia_conducir: ''
                      }));
                    } else {
                      setFormulario(prev => ({ ...prev, producto: nuevoProducto }));
                    }
                  }}
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(prod => (
                    <option key={prod} value={prod}>{prod}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Etapa Activa</label>
                <select
                  className="form-select"
                  value={formulario.etapa_activa}
                  onChange={(e) => setFormulario(prev => ({ ...prev, etapa_activa: e.target.value }))}
                >
                  {etapasActivas.map(etapa => (
                    <option key={etapa} value={etapa}>{etapa}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(() => {
            // Verificar si el producto es de tipo autos
            if (!formulario.producto) return false;
            const producto = tiposProductos.find(p => p.id === formulario.producto);
            return producto && producto.nombre && producto.nombre.toUpperCase().includes('AUTO');
          })() && (
            <div className="alert alert-info mb-4">
              <h6 className="alert-heading">
                <AlertCircle className="me-2" size={20} />
                Información Adicional Requerida para Seguros de Autos
              </h6>
              <p className="mb-0">
                Se han habilitado campos adicionales específicos para el seguro de automóviles.
              </p>
            </div>
          )}

          {/* Datos del Vehículo - Solo si es Autos */}
          {(() => {
            // Verificar si el producto es de tipo autos
            if (!formulario.producto) return false;
            const producto = tiposProductos.find(p => p.id === formulario.producto);
            return producto && producto.nombre && producto.nombre.toUpperCase().includes('AUTO');
          })() && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos del Vehículo</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Marca</label>
                  <select
                    className="form-select"
                    value={formulario.marca}
                    onChange={(e) => setFormulario(prev => ({ ...prev, marca: e.target.value }))}
                  >
                    <option value="">Seleccionar marca</option>
                    {marcasVehiculo.map(marca => (
                      <option key={marca} value={marca}>{marca}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Modelo</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.modelo}
                    onChange={(e) => setFormulario(prev => ({ ...prev, modelo: e.target.value }))}
                    placeholder="Ej: Civic, Jetta, etc."
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Año</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.anio}
                    onChange={(e) => setFormulario(prev => ({ ...prev, anio: e.target.value }))}
                    min={CONSTANTS.MIN_YEAR}
                    max={CONSTANTS.MAX_YEAR}
                    placeholder="Ej: 2023"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Número de Serie (VIN)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.numero_serie}
                    onChange={(e) => setFormulario(prev => ({ ...prev, numero_serie: e.target.value.toUpperCase() }))}
                    placeholder={`${CONSTANTS.VIN_LENGTH} caracteres`}
                    maxLength={CONSTANTS.VIN_LENGTH}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Placas</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.placas}
                    onChange={(e) => setFormulario(prev => ({ ...prev, placas: e.target.value.toUpperCase() }))}
                    placeholder="Ej: ABC-123"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Color</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.color}
                    onChange={(e) => setFormulario(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="Ej: Rojo, Azul, etc."
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Tipo de Vehículo</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_vehiculo}
                    onChange={(e) => setFormulario(prev => ({ ...prev, tipo_vehiculo: e.target.value }))}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposVehiculo.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Número de Motor</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.motor || ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, motor: e.target.value.toUpperCase() }))}
                    placeholder="Número de motor"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Uso</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.uso || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      uso: e.target.value, 
                      uso_poliza: e.target.value 
                    }))}
                    placeholder="Ej: PARTICULAR"
                  />
                  <small className="form-text text-muted">Uso del vehículo según póliza</small>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Servicio</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.servicio || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      servicio: e.target.value,
                      servicio_poliza: e.target.value
                    }))}
                    placeholder="Ej: PRIVADO"
                  />
                  <small className="form-text text-muted">Servicio del vehículo</small>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Movimiento</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.movimiento || ''}
                    onChange={(e) => setFormulario(prev => ({ 
                      ...prev, 
                      movimiento: e.target.value,
                      movimiento_poliza: e.target.value
                    }))}
                    placeholder="Ej: NACIONAL"
                  />
                  <small className="form-text text-muted">Movimiento permitido</small>
                </div>
              </div>
            </div>
          )}

          {/* Datos de la Póliza - Visible para Autos o si ya existen valores (edición) */}
          {(formulario.producto === 'Autos Individual' || formulario.uso || formulario.servicio || formulario.movimiento) && (
            <div className="mb-2">
              <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Datos de la Póliza</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Número de Póliza</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.numero_poliza ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, numero_poliza: e.target.value }))}
                    placeholder="Número asignado por la aseguradora"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Tipo de Cobertura</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_cobertura || ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, tipo_cobertura: e.target.value }))}
                  >
                    <option value="">Seleccionar cobertura</option>
                    {tiposCobertura.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Deducible</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      value={formulario.deducible ?? ''}
                      onChange={(e) => setFormulario(prev => ({ ...prev, deducible: e.target.value }))}
                      placeholder="Porcentaje o monto"
                      step="0.01"
                    />
                    <span className="input-group-text">%</span>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Suma Asegurada</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      value={formulario.suma_asegurada ?? ''}
                      onChange={(e) => setFormulario(prev => ({ ...prev, suma_asegurada: e.target.value }))}
                      placeholder="Valor del vehículo"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Datos del Conductor - Solo si es Autos */}
          {formulario.producto === 'Autos Individual' && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos del Conductor</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Conductor Habitual</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.conductor_habitual ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, conductor_habitual: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Edad del Conductor</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.edad_conductor ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, edad_conductor: e.target.value }))}
                    placeholder="Años"
                    min="18"
                    max="99"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Licencia de Conducir</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.licencia_conducir ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, licencia_conducir: e.target.value.toUpperCase() }))}
                    placeholder="Número de licencia"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Datos Adicionales */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos Adicionales</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">
                  Agente 
                  {agenteIdSeleccionado && <span className="text-success ms-2">✅ Detectado</span>}
                </label>
                <input
                  type="text"
                  className={`form-control ${agenteIdSeleccionado ? 'is-valid' : formulario.agente ? 'is-invalid' : ''}`}
                  value={formulario.agente ?? ''}
                  onChange={(e) => {
                    const nuevoAgente = e.target.value;
                    console.log('📝 Cambiando agente a:', nuevoAgente);
                    setFormulario(prev => ({ ...prev, agente: nuevoAgente, sub_agente: '' }));
                    
                    // Limpiar vendedores inmediatamente al cambiar
                    setVendedores([]);
                    
                    // Extraer ID del agente y obtener vendedores
                    if (nuevoAgente && agentes.length > 0) {
                      const agenteId = extraerAgenteIdDelFormulario(nuevoAgente);
                      console.log('🔍 ID extraído inmediatamente:', agenteId);
                      setAgenteIdSeleccionado(agenteId);
                      if (agenteId) {
                        obtenerVendedoresPorAgente(agenteId);
                      }
                    } else {
                      setAgenteIdSeleccionado(null);
                    }
                  }}
                  placeholder="Ej: 12345 - Juan Pérez"
                />
                {agenteIdSeleccionado && (
                  <small className="text-success mt-1">
                    💡 Agente reconocido - Los vendedores están disponibles
                  </small>
                )}
                {formulario.agente && !agenteIdSeleccionado && (
                  <small className="text-warning mt-1">
                    ⚠️ Agente no reconocido - Verifica el formato: "Código - Nombre"
                  </small>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">Vendedor / Sub Agente</label>
                <select
                  className="form-select"
                  value={formulario.sub_agente || ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, sub_agente: e.target.value }))}
                  disabled={!agenteIdSeleccionado || vendedores.length === 0}
                >
                  <option value="">
                    {!agenteIdSeleccionado ? 'Primero selecciona un agente' : 
                     vendedores.length === 0 ? 'No hay vendedores disponibles' : 
                     'Seleccionar vendedor'}
                  </option>
                  {vendedores.map(vendedor => {
                    const nombreCompleto = `${vendedor.nombre} ${vendedor.apellidoPaterno || ''} ${vendedor.apellidoMaterno || ''}`.trim();
                    const comisionInfo = vendedor.comisionesCompartidas && vendedor.comisionesCompartidas[agenteIdSeleccionado] 
                      ? ` (${vendedor.comisionesCompartidas[agenteIdSeleccionado]}%)` 
                      : '';
                    
                    return (
                      <option key={vendedor.id} value={`${vendedor.id} - ${nombreCompleto}`}>
                        {nombreCompleto}{comisionInfo}
                      </option>
                    );
                  })}
                </select>
                {agenteIdSeleccionado && (
                  <small className={`mt-1 ${vendedores.length > 0 ? 'text-success' : 'text-info'}`}>
                    {vendedores.length > 0 
                      ? `💡 ${vendedores.length} vendedor(es) autorizado(s) para este agente`
                      : '🔄 Cargando vendedores...'
                    }
                  </small>
                )}
                {!agenteIdSeleccionado && formulario.agente && (
                  <small className="text-warning mt-1">
                    ⚠️ Para ver vendedores, el agente debe estar en el formato correcto
                  </small>
                )}
              </div>
              <div className="col-md-6">
                <label className="form-label">Prima Pagada</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.prima_pagada ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, prima_pagada: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Tasa / Cargo Pago Fraccionado</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.cargo_pago_fraccionado || ''}
                    onChange={(e) => {
                      console.log('🔍 DEBUG cargo_pago_fraccionado onChange:', e.target.value);
                      setFormulario(prev => {
                        const nuevo = { 
                          ...prev, 
                          cargo_pago_fraccionado: e.target.value || ''
                        };
                        console.log('🔍 DEBUG estado actualizado:', nuevo.cargo_pago_fraccionado);
                        return nuevo;
                      });
                    }}
                    placeholder="0.00"
                  />
                </div>
                <small className="text-muted">Importe adicional por fraccionar el pago (si aplica)</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Gastos por Expedición</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.gastos_expedicion || ''}
                    onChange={(e) => {
                      console.log('🔍 DEBUG gastos_expedicion onChange:', e.target.value);
                      setFormulario(prev => {
                        const nuevo = { 
                          ...prev, 
                          gastos_expedicion: e.target.value || ''
                        };
                        console.log('🔍 DEBUG estado actualizado:', nuevo.gastos_expedicion);
                        return nuevo;
                      });
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">IVA</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.iva ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, iva: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Subtotal</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.subtotal ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, subtotal: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Importe Total</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.total ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, total: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fechas y Vigencia - SIEMPRE VISIBLE */}
          <div className="mb-2">
            <h6 className="card-title border-bottom pb-1 mb-2" style={{ fontSize: '0.9rem' }}>Fechas y Vigencia</h6>
            <div className="row g-2">
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Fecha de Emisión</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formatearFechaParaInput(formulario.fecha_emision) || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_emision: e.target.value }))}
                />
                <small className="form-text text-muted" style={{ fontSize: '0.65rem' }}>
                  Fecha en que se emitió la póliza
                </small>
              </div>
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Fecha de Captura</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formatearFechaParaInput(formulario.fecha_captura) || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormulario(prev => ({ ...prev, fecha_captura: e.target.value }))}
                />
                <small className="form-text text-muted" style={{ fontSize: '0.65rem' }}>
                  Fecha de registro en el sistema
                </small>
              </div>
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Inicio de Vigencia</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formulario.inicio_vigencia ?? ''}
                  onChange={(e) => {
                    const nuevoFormulario = { ...formulario, inicio_vigencia: e.target.value };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                />
              </div>
              <div className="col-md-3">
                <CampoFechaCalculada
                  label="Término de Vigencia"
                  value={formulario.termino_vigencia}
                  onChange={(valor) => setFormulario(prev => ({ ...prev, termino_vigencia: valor }))}
                  onCalculate={() => {
                    const formularioActualizado = actualizarCalculosAutomaticos(formulario);
                    setFormulario(formularioActualizado);
                  }}
                  disabled={!formulario.inicio_vigencia}
                  helpText="La vigencia siempre es de 1 año"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>📅 Aviso de Renovación</label>
                <input
                  type="date"
                  className="form-control form-control-sm bg-light"
                  value={formatearFechaParaInput(formulario.fecha_aviso_renovacion) || ''}
                  readOnly
                  disabled
                  style={{ cursor: 'not-allowed' }}
                />
                <small className="text-muted" style={{ fontSize: '0.65rem' }}>Se calcula automáticamente (Término - 30 días)</small>
              </div>
            </div>
          </div>

          {/* Configuración de Pagos */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Configuración de Pagos</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Tipo de Pago</label>
                <select
                  className="form-select"
                  value={formulario.tipo_pago ?? ''}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    const esAnual = tipo === 'Anual' || /pago\s+unico|pago\s+único/i.test(tipo);
                    const nuevoFormulario = {
                      ...formulario,
                      tipo_pago: tipo,
                      // Forzar frecuenciaPago = 'Anual' para tipo anual o pago único
                      frecuenciaPago: esAnual ? 'Anual' : formulario.frecuenciaPago
                    };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                >
                  {tiposPago.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              
              {formulario.tipo_pago === 'Fraccionado' && (
                <div className="col-md-3">
                  <label className="form-label">Frecuencia de Pago</label>
                  <select
                    className="form-select"
                    value={formulario.frecuenciaPago}
                    onChange={(e) => {
                      const nuevoFormulario = { ...formulario, frecuenciaPago: e.target.value };
                      const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                      setFormulario(formularioActualizado);
                    }}
                  >
                    <option value="">Seleccionar frecuencia</option>
                    {frecuenciasPago.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>
              )}
              {formulario.tipo_pago && formulario.tipo_pago !== 'Fraccionado' && (
                <div className="col-md-3 d-flex flex-column">
                  <label className="form-label">Frecuencia de Pago</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.frecuenciaPago || 'Anual'}
                    readOnly
                    disabled
                  />
                  <small className="text-muted">Frecuencia fija para pago {formulario.tipo_pago === 'Anual' ? 'Anual' : 'Único'}.</small>
                </div>
              )}
              
              <div className="col-md-3">
                <label className="form-label">Período de Gracia</label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.periodo_gracia ?? ''}
                    onChange={(e) => {
                      const valor = e.target.value;
                      const diasGracia = valor === '' ? 0 : Math.max(0, parseInt(valor, 10) || 0);
                      
                      setFormulario(prev => {
                        // Si tiene inicio_vigencia, recalcular fecha_pago
                        let nuevaFechaPago = prev.fecha_vencimiento_pago || prev.fecha_pago;
                        
                        if (prev.inicio_vigencia) {
                          const fechaInicio = new Date(prev.inicio_vigencia);
                          fechaInicio.setDate(fechaInicio.getDate() + diasGracia);
                          nuevaFechaPago = fechaInicio.toISOString().split('T')[0];
                        }
                        
                        // Calcular estatus de pago inline
                        let nuevoEstatus = prev.estatusPago;
                        if (nuevoEstatus !== 'Pagado' && nuevaFechaPago) {
                          const fechaPago = new Date(nuevaFechaPago);
                          const hoy = new Date();
                          hoy.setHours(0, 0, 0, 0);
                          fechaPago.setHours(0, 0, 0, 0);
                          const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
                          
                          if (diasRestantes < 0) {
                            nuevoEstatus = 'Vencido';
                          } else if (diasRestantes <= 15) {
                            nuevoEstatus = 'Por Vencer';
                          } else {
                            nuevoEstatus = 'Pendiente';
                          }
                        }
                        
                        return {
                          ...prev,
                          periodo_gracia: diasGracia,
                          fecha_vencimiento_pago: nuevaFechaPago,
                          fecha_pago: nuevaFechaPago,
                          estatusPago: nuevoEstatus
                        };
                      });
                    }}
                    min={0}
                  />
                  <span className="input-group-text">
                    días naturales
                  </span>
                </div>
                <small className="text-muted">
                  {formulario.compania?.toLowerCase().includes('qualitas') 
                    ? 'Sugerido Qualitas: 14 días (captura manual) - El PDF puede tener otro valor' 
                    : formulario.compania 
                      ? 'Sugerido otras aseguradoras: 30 días'
                      : 'Editable para pruebas'}
                </small>
              </div>
              
              <div className="col-md-3">
                <label className="form-label">Fecha límite de pago (Último recibo)</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.fecha_vencimiento_pago || ''}
                  onChange={async (e) => {
                    const nuevaFecha = e.target.value;
                    
                    // 🔥 ACTUALIZAR EL RECIBO PENDIENTE en la base de datos
                    if (modoEdicion && formulario.id && nuevaFecha) {
                      try {
                        console.log('🔄 [FECHA MANUAL] Actualizando fecha del recibo pendiente...', {
                          expediente_id: formulario.id,
                          nueva_fecha: nuevaFecha
                        });
                        
                        // Obtener el recibo pendiente actual
                        const recibosResponse = await fetch(`${API_URL}/api/recibos/${formulario.id}`);
                        console.log('📡 [FECHA MANUAL] Respuesta de recibos:', recibosResponse.status);
                        
                        if (recibosResponse.ok) {
                          const recibosData = await recibosResponse.json();
                          console.log('📋 [FECHA MANUAL] Datos de recibos:', recibosData);
                          
                          if (recibosData.success && recibosData.data) {
                            // Encontrar el primer recibo pendiente
                            const recibosPendientes = recibosData.data
                              .filter(recibo => 
                                recibo.estatus !== 'Pagado' && 
                                recibo.estatus !== 'pagado' &&
                                recibo.estatus !== 'PAGADO'
                              )
                              .sort((a, b) => parseInt(a.numero_recibo) - parseInt(b.numero_recibo));
                            
                            console.log('🎯 [FECHA MANUAL] Recibos pendientes:', recibosPendientes);
                            const reciboPendiente = recibosPendientes[0];
                            
                            if (reciboPendiente) {
                              console.log('🔄 [FECHA MANUAL] Actualizando recibo:', {
                                numero_recibo: reciboPendiente.numero_recibo,
                                fecha_anterior: reciboPendiente.fecha_vencimiento,
                                fecha_nueva: nuevaFecha,
                                url: `${API_URL}/api/recibos/${formulario.id}/${reciboPendiente.numero_recibo}/fecha-vencimiento`
                              });
                              
                              // Actualizar directamente en la tabla recibos_pago
                              const updateResponse = await fetch(`${API_URL}/api/recibos/${formulario.id}/${reciboPendiente.numero_recibo}/fecha-vencimiento`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  fecha_vencimiento: nuevaFecha
                                })
                              });
                              
                              console.log('📡 [FECHA MANUAL] Respuesta de actualización:', updateResponse.status);
                              
                              if (updateResponse.ok) {
                                const updateData = await updateResponse.json();
                                console.log('✅ [FECHA MANUAL] Recibo actualizado exitosamente:', updateData);
                                
                                // Verificar que se actualizó correctamente
                                setTimeout(async () => {
                                  try {
                                    const verificarResponse = await fetch(`${API_URL}/api/recibos/${formulario.id}/${reciboPendiente.numero_recibo}`);
                                    if (verificarResponse.ok) {
                                      const reciboVerificado = await verificarResponse.json();
                                      console.log('🔍 [FECHA MANUAL] Verificación del recibo:', reciboVerificado);
                                    }
                                  } catch (e) {
                                    console.log('⚠️ [FECHA MANUAL] No se pudo verificar la actualización');
                                  }
                                }, 500);
                                
                              } else {
                                const errorText = await updateResponse.text();
                                console.error('❌ [FECHA MANUAL] Error en actualización:', errorText);
                              }
                            } else {
                              console.log('ℹ️ [FECHA MANUAL] No hay recibos pendientes para actualizar');
                            }
                          }
                        } else {
                          console.error('❌ [FECHA MANUAL] Error al obtener recibos:', recibosResponse.status);
                        }
                      } catch (error) {
                        console.error('❌ [FECHA MANUAL] Error completo:', error);
                      }
                    }
                    
                    setFormulario(prev => {
                      // Calcular periodo de gracia basado en la diferencia con inicio_vigencia
                      let nuevoPeriodoGracia = prev.periodo_gracia || 0;
                      
                      if (prev.inicio_vigencia && nuevaFecha) {
                        const fechaInicio = new Date(prev.inicio_vigencia);
                        const fechaPago = new Date(nuevaFecha);
                        fechaInicio.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        
                        const diferenciaDias = Math.ceil((fechaPago - fechaInicio) / (1000 * 60 * 60 * 24));
                        nuevoPeriodoGracia = Math.max(0, diferenciaDias);
                      }
                      
                      // Calcular estatus de pago inline
                      let nuevoEstatus = prev.estatusPago;
                      if (nuevoEstatus !== 'Pagado' && nuevaFecha) {
                        const fechaPago = new Date(nuevaFecha);
                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        const diasRestantes = Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24));
                        
                        if (diasRestantes < 0) {
                          nuevoEstatus = 'Vencido';
                        } else if (diasRestantes <= 15) {
                          nuevoEstatus = 'Por Vencer';
                        } else {
                          nuevoEstatus = 'Pendiente';
                        }
                      }
                      
                      return {
                        ...prev,
                        fecha_vencimiento_pago: nuevaFecha,
                        fecha_pago: nuevaFecha,
                        periodo_gracia: nuevoPeriodoGracia,
                        estatusPago: nuevoEstatus,
                        _fechaManual: true // Bandera para evitar recálculo automático
                      };
                    });
                  }}
                />
                <small className="text-muted">
                  Editable - Recalcula periodo de gracia
                </small>
              </div>
              
              <div className="col-md-6">
                <label className="form-label">Estatus del Pago</label>
                <select
                  className="form-select"
                  value={formulario.estatusPago ?? ''}
                  disabled
                  style={{ backgroundColor: '#e9ecef', cursor: 'not-allowed' }}
                >
                  {estatusPago.map(estatus => (
                    <option key={estatus} value={estatus}>{estatus}</option>
                  ))}
                </select>
                <small className="text-muted">
                  Solo lectura - Se sincroniza con el calendario de pagos
                </small>
              </div>

              {/* Campo de Fecha de Pago - Solo si está marcado como Pagado */}
              {formulario.estatusPago === 'Pagado' && (
                <div className="col-md-6">
                  <label className="form-label">
                    Fecha de Pago
                    <small className="text-muted ms-2">(¿Cuándo se pagó?)</small>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formatearFechaParaInput(formulario.fecha_ultimo_pago) || ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, fecha_ultimo_pago: e.target.value }))}
                  />
                  <small className="text-muted d-block mt-1">
                    Si no se especifica, se usará la fecha de captura
                  </small>
                </div>
              )}

              {/* Mostrar calendario para Fraccionado y Anual */}
              {formulario.inicio_vigencia && (
                (formulario.tipo_pago === 'Fraccionado' && formulario.frecuenciaPago) || 
                formulario.tipo_pago === 'Anual'
              ) && (
                <div className="col-12 mt-3">
                  <CalendarioPagos 
                    expediente={formulario} 
                    calcularProximoPago={calcularProximoPago}
                    mostrarResumen={false}
                    onEliminarPago={onEliminarPago}
                  />
                </div>
              )}
            </div>
          </div>

            {/* Sección de Documento PDF - PREPARADA PARA CUANDO HUGO IMPLEMENTE EL BACKEND */}
            {modoEdicion && formulario.id && (
              <div className="mb-4">
                <h5 className="card-title border-bottom pb-2">Documento de Póliza (PDF)</h5>
                <div className="alert alert-info" role="alert">
                  <AlertCircle size={16} className="me-2" />
                  <strong>Funcionalidad en preparación:</strong> Esta sección estará disponible cuando Hugo complete la implementación del backend y AWS S3.
                  Ver documento: <code>docs/IMPLEMENTACION-PDF-POLIZAS-AWS.md</code>
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
            )}

          <div className="d-flex justify-content-end gap-3">
            <button
              type="button"
              onClick={() => setVistaActual('lista')}
              className="btn btn-outline-secondary btn-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarExpediente}
              className="btn btn-primary btn-sm"
            >
              {modoEdicion ? 'Actualizar' : 'Guardar'} Expediente
            </button>
          </div>
        </div>
      </div>

        

      {mostrarExtractorPDF && (
        <>
          {console.log('🟢 Renderizando ExtractorPolizasPDF...')}
          <ExtractorPolizasPDF 
            onDataExtracted={handleDataExtracted}
            onClose={() => setMostrarExtractorPDF(false)}
            agentes={agentes}
            aseguradoras={aseguradoras}
            tiposProductos={tiposProductos}
          />
        </>
      )}
    </div>
  );
});

export default Formulario;


/**
 * ====================================================================
 * COMPONENTE: EXTRACTOR DE PÓLIZAS PDF
 * ====================================================================
 * Componente para extraer datos de PDFs de pólizas automáticamente
 * - Usa detectorLigero.js para identificar la aseguradora
 * - Carga dinámicamente el extractor específico vía registry.js
 * - Maneja flujo de validación de cliente y agente
 * - Permite captura manual de RFC cuando no se encuentra
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import toast from 'react-hot-toast';
import DetalleExpediente from '../DetalleExpediente';
import { CONSTANTS } from '../../utils/expedientesConstants';
import utils from '../../utils/expedientesUtils';
import * as estatusPagosUtils from '../../utils/estatusPagos';

const API_URL = import.meta.env.VITE_API_URL;

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs';

// 👇 COPIAR AQUÍ desde Expedientes.jsx líneas 96 hasta 2258
// ============= COMPONENTE EXTRACTOR PDF =============
const ExtractorPolizasPDF = React.memo(({ onDataExtracted, onClose, agentes = [], aseguradoras = [], tiposProductos = [] }) => {
  const [estado, setEstado] = useState('seleccionando-metodo'); // seleccionando-metodo, esperando, procesando, validando-cliente, validando-agente, preview-datos, error, capturando-rfc
  const [metodoExtraccion, setMetodoExtraccion] = useState(null); // 'auto' o 'openai'
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [informacionArchivo, setInformacionArchivo] = useState(null);
  
  // Estados para el flujo paso a paso
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [agenteEncontrado, setAgenteEncontrado] = useState(null);
  const [claveYaExiste, setClaveYaExiste] = useState(false); // true si el agente ya tiene esta clave+aseguradora
  const [decisionCliente, setDecisionCliente] = useState(null); // 'usar-existente', 'crear-nuevo'
  const [decisionAgente, setDecisionAgente] = useState(null); // 'usar-existente', 'crear-nuevo', 'omitir'
  
  // Estados para captura de RFC
  const [mostrarModalRFC, setMostrarModalRFC] = useState(false);
  const [rfcCapturado, setRfcCapturado] = useState('');
  
  // Ref para el input file
  const fileInputRef = useRef(null);
  const yaAbriSelectorRef = useRef(false); // Bandera para evitar abrir selector múltiples veces
  
  // Si hay un archivo pre-seleccionado, procesarlo inmediatamente
  useEffect(() => {
    // Verificar si ya hay un archivo seleccionado desde el modal anterior
    if (window._selectedPDFFile && window._autoExtractorMode) {
      const file = window._selectedPDFFile;
      const metodoDesdeUI = window._extractorMetodo || 'auto';
      // 📄 NO borrar window._selectedPDFFile aquí - se necesita para subir a S3 después de guardar
      // Solo borrar el flag de auto-extracción
      delete window._autoExtractorMode; // Limpiar flag
      delete window._extractorMetodo;
      
      // Configurar método automático y procesar directamente
      setMetodoExtraccion(metodoDesdeUI);
      setArchivo(file);
      setInformacionArchivo({
        nombre: file.name,
        tamaño: `${(file.size / 1024).toFixed(2)} KB`,
        tipo: file.type,
        fechaModificacion: new Date(file.lastModified).toLocaleDateString('es-MX')
      });
      // Procesar inmediatamente sin esperar
      setEstado('procesando');
      setTimeout(() => procesarPDF(file, metodoDesdeUI), 100);
    }
  }, []);
  
  // Abrir selector automáticamente solo cuando se haya elegido el método manualmente
  useEffect(() => {
    // Solo abrir selector si ya se eligió método y no se ha abierto antes
    if (metodoExtraccion && !yaAbriSelectorRef.current && estado === 'esperando') {
      yaAbriSelectorRef.current = true;
      
      if (fileInputRef.current) {
        // Abrir selector de archivo
        const timer = setTimeout(() => {
          fileInputRef.current?.click();
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [metodoExtraccion, estado]);

  const procesarPDF = useCallback(async (file, metodoForzado = null) => {
    setEstado('procesando');
    setErrores([]);

    const metodoActivo = metodoForzado || metodoExtraccion;

    try {
      // Extraer texto del PDF usando PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      console.log('📄 Total de páginas:', pdf.numPages);
      
      if (pdf.numPages < 1) {
        throw new Error('El PDF debe tener al menos 1 página');
      }
      
      // ==================== EXTRAER TODAS LAS PÁGINAS ====================
      const todasLasPaginas = [];
      let textoPagina1 = '';
      let textoAvisoDeCobro = '';
      let textoPaginaCaratula = '';
      
      for (let numPagina = 1; numPagina <= pdf.numPages; numPagina++) {
        const page = await pdf.getPage(numPagina);
        const textContent = await page.getTextContent();
        
        const lineas = {};
        textContent.items.forEach(item => {
          const y = Math.round(item.transform[5]);
          if (!lineas[y]) lineas[y] = [];
          lineas[y].push({
            text: item.str,
            x: item.transform[4]
          });
        });
        
        const textoPagina = Object.keys(lineas)
          .sort((a, b) => b - a)
          .map(y => {
            return lineas[y]
              .sort((a, b) => a.x - b.x)
              .map(item => item.text)
              .join(' ');
          })
          .join('\n');
        
        todasLasPaginas.push({
          numero: numPagina,
          texto: textoPagina
        });
        
        // Guardar página 1 para detección de aseguradora
        if (numPagina === 1) {
          textoPagina1 = textoPagina;
        }
        
        // Buscar página con "AVISO DE COBRO" o "Prima Neta"
        if (textoPagina.match(/AVISO\s+DE\s+COBRO|Prima\s+Neta|PRIMA\s+NETA/i)) {
          textoAvisoDeCobro = textoPagina;
        }
        
        // Buscar página con "CARÁTULA" o datos del vehículo
        if (textoPagina.match(/CARÁTULA|CAR[AÁ]TULA|Descripción\s+del\s+vehículo|DESCRIPCI[ÓO]N\s+DEL\s+VEH[ÍI]CULO/i)) {
          textoPaginaCaratula = textoPagina;
        }
      }
      
      // Si no encontramos aviso de cobro, usar página 2 como fallback
      if (!textoAvisoDeCobro && todasLasPaginas.length >= 2) {
        textoAvisoDeCobro = todasLasPaginas[1].texto;
      }
      
      // Si no encontramos carátula, usar página 2 como fallback
      if (!textoPaginaCaratula && todasLasPaginas.length >= 2) {
        textoPaginaCaratula = todasLasPaginas[1].texto;
      }
      
      // Crear textoCompleto con todas las páginas
      const textoCompleto = todasLasPaginas.map(p => p.texto).join('\n\n');
      
      // Buscar cliente por RFC, CURP o nombre en la base de datos
      const buscarClienteExistente = async (rfc, curp, nombre, apellidoPaterno, apellidoMaterno) => {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          if (!response.ok) {
            console.error('❌ Error al obtener clientes:', response.status);
            return null;
          }
          
          const clientes = await response.json();
          
          // 1. PRIORIDAD 1: Buscar por RFC (más confiable)
          if (rfc && rfc.trim() !== '') {
            const rfcBusqueda = rfc.trim().toUpperCase();
            const clientePorRFC = clientes.find(c => {
              const rfcCliente = (c.rfc || '').trim().toUpperCase();
              return rfcCliente === rfcBusqueda;
            });
            
            if (clientePorRFC) return clientePorRFC;
          }
          
          // 2. PRIORIDAD 2: Buscar por CURP (si no hay RFC)
          if (curp && curp.trim() !== '') {
            const curpBusqueda = curp.trim().toUpperCase();
            const clientePorCURP = clientes.find(c => {
              const curpCliente = (c.curp || '').trim().toUpperCase();
              return curpCliente === curpBusqueda;
            });
            
            if (clientePorCURP) return clientePorCURP;
          }
          
          // 3. PRIORIDAD 3: Buscar por nombre completo (último recurso)
          if (nombre && apellidoPaterno) {
            const nombreBusqueda = nombre.trim().toUpperCase();
            const apellidoPaternoBusqueda = apellidoPaterno.trim().toUpperCase();
            const apellidoMaternoBusqueda = apellidoMaterno ? apellidoMaterno.trim().toUpperCase() : '';
            
            console.log(`🔍 Buscando por nombre: "${nombreBusqueda} ${apellidoPaternoBusqueda} ${apellidoMaternoBusqueda}"`);
            
            const clientePorNombre = clientes.find(c => {
              const nombreCliente = (c.nombre || '').trim().toUpperCase();
              const apellidoPaternoCliente = (c.apellido_paterno || c.apellidoPaterno || '').trim().toUpperCase();
              const apellidoMaternoCliente = (c.apellido_materno || c.apellidoMaterno || '').trim().toUpperCase();
              
              const coincideNombre = nombreCliente === nombreBusqueda;
              const coincidePaterno = apellidoPaternoCliente === apellidoPaternoBusqueda;
              const coincideMaterno = !apellidoMaternoBusqueda || 
                                     !apellidoMaternoCliente || 
                                     apellidoMaternoCliente === apellidoMaternoBusqueda;
              
              return coincideNombre && coincidePaterno && coincideMaterno;
            });
            
            if (clientePorNombre) return clientePorNombre;
          }
          
          return null;
        } catch (error) {
          console.error('❌ Error buscando cliente:', error);
          return null;
        }
      };

      // ==================== SISTEMA AUTOMÁTICO DE EXTRACCIÓN ====================
      let datosExtraidos = {};

      const extraerConIA = async () => {
        const response = await fetch(`${API_URL}/api/expedientes/extract-pdf-ia`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            textoCompleto,
            textoPagina1,
            textoPagina2: textoPaginaCaratula,
            textoAvisoDeCobro
          })
        });

        const payload = await response.json();
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || payload?.error || 'No se pudo extraer con IA');
        }

        console.log('🤖 Datos completos extraídos por IA (API):', payload?.data || {});
        console.log('🤖 Datos completos extraídos por IA (JSON):', JSON.stringify(payload?.data || {}, null, 2));

        return payload.data || {};
      };
      
      try {
        if (metodoActivo === 'openai') {
          console.log('🤖 Usando extracción con IA...');
          datosExtraidos = await extraerConIA();
        } else {
          // Usar el sistema automático (regex)
          console.log('⚙️ Usando extractor automático...');
          const { detectarAseguradoraYProducto } = await import('../../lib/pdf/detectorLigero.js');
          const { loadExtractor } = await import('../../lib/pdf/extractors/registry.js');
          
          const deteccion = detectarAseguradoraYProducto(textoPagina1);
          const moduloExtractor = await loadExtractor(deteccion.aseguradora, deteccion.producto);
          
          if (moduloExtractor && moduloExtractor.extraer) {
            datosExtraidos = await moduloExtractor.extraer({
              textoCompleto,
              textoPagina1,
              textoPagina2: textoPaginaCaratula,
              textoAvisoDeCobro,
              todasLasPaginas
            });
          } else {
            console.error('❌ No se encontró extractor para:', deteccion);
            setEstado('error');
            setErrores([{
              tipo: 'error',
              mensaje: `No hay extractor disponible para ${deteccion.aseguradora} - ${deteccion.producto}`,
              detalle: 'Selecciona manualmente "Leer PDF con IA" para procesar este archivo.'
            }]);
            return;
          }
        }
      } catch (error) {
        console.error('❌ Error en sistema de extracción:', error);
        setEstado('error');
        setErrores([{
          tipo: 'error',
          mensaje: 'Error al procesar el PDF',
          detalle: error.message
        }]);
        return;
      }

      // Limpiar montos (quitar comas) y asegurar defaults "0.00" si faltan
      const camposMontos = [
        'prima_pagada',
        'otros_descuentos',
        'cargo_pago_fraccionado',
        'gastos_expedicion',
        'iva',
        'total',
        'suma_asegurada'
      ];
      camposMontos.forEach(campo => {
        if (datosExtraidos[campo] !== undefined && datosExtraidos[campo] !== null && datosExtraidos[campo] !== '') {
          datosExtraidos[campo] = String(datosExtraidos[campo]).replace(/,/g, '');
        } else {
          datosExtraidos[campo] = '0.00';
        }
      });

      // Buscar cliente existente
      const clienteExistente = await buscarClienteExistente(
        datosExtraidos.rfc,
        datosExtraidos.curp,
        datosExtraidos.nombre,
        datosExtraidos.apellido_paterno,
        datosExtraidos.apellido_materno
      );

      // Agregar información del cliente al resultado
      const resultado = {
        ...datosExtraidos,
        cliente_existente: clienteExistente,
        cliente_id: clienteExistente?.id || null
      };

      // ==================== VALIDACIÓN DE PAGOS FRACCIONADOS ====================
      // Regla del negocio: En pagos fraccionados, el primer pago suele diferir de los subsecuentes.
      // Además, se valida que la suma: primer_pago + (n-1)*pagos_subsecuentes ≈ total
      try {
        const toNumber = (v) => {
          if (v === undefined || v === null) return null;
          const n = parseFloat(String(v).replace(/,/g, ''));
          return Number.isFinite(n) ? n : null;
        };

        const primer = toNumber(resultado.primer_pago);
        const subsecuentes = toNumber(resultado.pagos_subsecuentes);
        const totalPoliza = toNumber(resultado.total);

        // Inferir número de pagos por la forma/tipo de pago
        const base = `${resultado.forma_pago || resultado.tipo_pago || ''}`.toLowerCase();
        let numeroPagos = 1;
        if (base.includes('men')) numeroPagos = 12;
        else if (base.includes('tri')) numeroPagos = 4;
        else if (base.includes('sem')) numeroPagos = 2;
        else if (base.includes('anu')) numeroPagos = 1;

        const alertas_financieras = [];
        const validacion_pagos = {
          numero_pagos_inferido: numeroPagos,
          primer_pago: primer,
          pagos_subsecuentes: subsecuentes,
          total_pdf: totalPoliza,
          primer_vs_subsecuentes_diferentes: null,
          total_consistente: null,
          total_calculado: null,
          tolerancia: null
        };

        // Validar que primer pago y subsecuentes NO sean iguales (práctica común: difieren)
        if (numeroPagos > 1 && primer !== null && subsecuentes !== null) {
          const iguales = Math.abs(primer - subsecuentes) < 0.005; // tolerancia pequeña por redondeo
          validacion_pagos.primer_vs_subsecuentes_diferentes = !iguales;
          if (iguales) {
            alertas_financieras.push({
              tipo: 'advertencia',
              codigo: 'PAGOS_IGUALES',
              mensaje: 'El primer pago y los pagos subsecuentes son iguales; normalmente deben diferir (primer pago incluye gastos iniciales).',
              detalle: { primer, subsecuentes }
            });
          }
        }

        // Validar consistencia contra el total
        if (numeroPagos > 1 && primer !== null && subsecuentes !== null && totalPoliza !== null) {
          const totalCalculado = primer + (numeroPagos - 1) * subsecuentes;
          const tolerancia = Math.max(1, totalPoliza * 0.002); // ±0.2% o $1 mínimo
          const diferencia = Math.abs(totalCalculado - totalPoliza);
          validacion_pagos.total_calculado = Number(totalCalculado.toFixed(2));
          validacion_pagos.tolerancia = tolerancia;
          validacion_pagos.total_consistente = diferencia <= tolerancia;
          if (!validacion_pagos.total_consistente) {
            alertas_financieras.push({
              tipo: 'advertencia',
              codigo: 'TOTAL_NO_COINCIDE',
              mensaje: 'La suma de pagos fraccionados no coincide con el importe total de la póliza.',
              detalle: {
                numeroPagos,
                primer,
                subsecuentes,
                total_pdf: totalPoliza,
                total_calculado: Number(totalCalculado.toFixed(2)),
                diferencia: Number((totalCalculado - totalPoliza).toFixed(2)),
                tolerancia
              }
            });
          }
        }

        // Adjuntar resultados al objeto
        resultado.alertas_financieras = alertas_financieras;
        resultado.validacion_pagos = validacion_pagos;
      } catch (e) {
        console.warn('⚠️ Error durante validación de pagos fraccionados:', e);
      }

      // Datos extraídos exitosamente
      setDatosExtraidos(resultado);
      
      // Guardar información del cliente encontrado (o null si no existe)
      setClienteEncontrado(clienteExistente);
      
      if (clienteExistente) {
        console.log('🔍 Cliente encontrado en BD:', {
          id: clienteExistente.id,
          codigo: clienteExistente.codigo,
          tipoPersona: clienteExistente.tipoPersona,
          razonSocial: clienteExistente.razonSocial,
          nombre: clienteExistente.nombre,
          apellidoPaterno: clienteExistente.apellidoPaterno,
          rfc: clienteExistente.rfc,
          direccion: clienteExistente.direccion,
          email: clienteExistente.email,
          telefonoMovil: clienteExistente.telefonoMovil,
          created_at: clienteExistente.created_at
        });
      }
      
      // Buscar agente en el equipo de trabajo (búsqueda preliminar)
      let agenteEncontradoEnBD = null;
      let claveYaExisteEnBD = false;
      
      if (datosExtraidos.clave_agente && datosExtraidos.agente && agentes.length > 0) {
        // Buscar por nombre completo
        const nombreExtraido = datosExtraidos.agente.trim().toUpperCase();
        agenteEncontradoEnBD = agentes.find(miembro => {
          if (miembro.perfil !== 'Agente' || !miembro.activo) return false;
          
          const nombreBD = (miembro.nombre || '').trim().toUpperCase();
          const nombreCompleto = `${miembro.nombre || ''} ${miembro.apellidoPaterno || miembro.apellido_paterno || ''} ${miembro.apellidoMaterno || miembro.apellido_materno || ''}`.trim().toUpperCase();
          
          return nombreBD === nombreExtraido || nombreCompleto === nombreExtraido;
        });
        
        // Si encontramos el agente, verificar si ya tiene esta clave
        if (agenteEncontradoEnBD) {
          try {
            const { obtenerEjecutivosPorProducto } = await import('../../services/equipoDeTrabajoService');
            const asignacionesResult = await obtenerEjecutivosPorProducto(agenteEncontradoEnBD.id);
            
            if (asignacionesResult.success && asignacionesResult.data) {
              // Buscar si ya tiene esta clave
              claveYaExisteEnBD = asignacionesResult.data.some(asig => 
                String(asig.clave) === String(datosExtraidos.clave_agente)
              );
              
              console.log(`🔍 Agente: ${agenteEncontradoEnBD.nombre} | Clave ${datosExtraidos.clave_agente}: ${claveYaExisteEnBD ? 'YA EXISTE' : 'NUEVA'}`);
            }
          } catch (error) {
            console.error('Error al verificar claves del agente:', error);
          }
        }
      }
      
      setAgenteEncontrado(agenteEncontradoEnBD);
      setClaveYaExiste(claveYaExisteEnBD);
      
      // Pasar al PASO 1: Validación de Cliente
      setEstado('validando-cliente');
      
      console.log('✅ Datos extraídos. Pasando a validación de cliente...');
      console.log('  Cliente:', clienteExistente ? 'Encontrado' : 'Nuevo');
      console.log('  Agente:', agenteEncontradoEnBD ? 'Encontrado' : 'No encontrado');

    } catch (error) {
      console.error('Error al procesar PDF:', error);
      setEstado('error');
      setErrores(['❌ Error al procesar el archivo PDF: ' + error.message]);
    }
  }, [metodoExtraccion]); // Agregar metodoExtraccion como dependencia

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setArchivo(file);
      // 📄 Guardar referencia para subir a S3 después de guardar el expediente
      window._selectedPDFFile = file;
      setInformacionArchivo({
        nombre: file.name,
        tamaño: `${(file.size / 1024).toFixed(2)} KB`,
        tipo: file.type,
        fechaModificacion: new Date(file.lastModified).toLocaleDateString('es-MX')
      });
      procesarPDF(file);
    } else if (!file) {
      // Usuario canceló la selección del archivo, cerrar el modal
      console.log('⚠️ Usuario canceló la selección de archivo');
      onClose();
    } else {
      setErrores(['❌ Por favor, seleccione un archivo PDF válido']);
      setEstado('error');
    }
  }, [procesarPDF, onClose]);

  // PASO 1: Manejar decisión sobre el cliente
  const handleDecisionCliente = useCallback(async (decision) => {
    setDecisionCliente(decision);
    
    if (decision === 'crear-nuevo') {
      // ✅ VALIDAR RFC ANTES DE CREAR CLIENTE
      if (!datosExtraidos.rfc || datosExtraidos.rfc.trim() === '') {
        console.log('⚠️ RFC no encontrado - Abriendo modal de captura');
        setMostrarModalRFC(true);
        setEstado('capturando-rfc');
        return; // Detener hasta que se capture el RFC
      }
      
      // ✅ VALIDAR DATOS DE CONTACTO PRINCIPAL
      const tieneNombre = datosExtraidos.tipo_persona === 'Moral' 
        ? (datosExtraidos.razonSocial && datosExtraidos.razonSocial.trim() !== '')
        : (datosExtraidos.nombre && datosExtraidos.nombre.trim() !== '');
      
      const tieneRFC = datosExtraidos.rfc && datosExtraidos.rfc.trim() !== '';
      
      if (!tieneNombre || !tieneRFC) {
        setErrores(['❌ Faltan datos principales del cliente. Se requiere al menos: ' + 
          (datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social' : 'Nombre') + 
          ' y RFC para crear el cliente.']);
        setEstado('error');
        return;
      }
      
      // Si hay RFC y nombre, continuar con la creación normal
      console.log('🔄 Creando nuevo cliente...');
      
      // Usar tipo de persona ya detectado en la extracción
      const tipoPersonaDetectado = datosExtraidos.tipo_persona === 'Moral' ? 'Persona Moral' : 'Persona Física';
      
      // Preparar datos según tipo de persona (SIN email ni teléfono)
      let nuevoCliente = {};
      
      if (tipoPersonaDetectado === 'Persona Moral') {
        // Para empresas: usar razón social directamente extraída
        nuevoCliente = {
          tipoPersona: tipoPersonaDetectado,
          razonSocial: datosExtraidos.razonSocial || 'Empresa',
          rfc: datosExtraidos.rfc || '',
          direccion: datosExtraidos.domicilio || '',
          municipio: datosExtraidos.municipio || '',
          colonia: datosExtraidos.colonia || '',
          estado: datosExtraidos.estado || '',
          codigoPostal: datosExtraidos.codigo_postal || '',
          pais: datosExtraidos.pais || 'MEXICO',
          activo: true
        };
      } else {
        // Para personas físicas: usar nombre y apellidos
        nuevoCliente = {
          tipoPersona: tipoPersonaDetectado,
          nombre: datosExtraidos.nombre || '',
          apellidoPaterno: datosExtraidos.apellido_paterno || '',
          apellidoMaterno: datosExtraidos.apellido_materno || '',
          rfc: datosExtraidos.rfc || '',
          direccion: datosExtraidos.domicilio || '',
          municipio: datosExtraidos.municipio || '',
          colonia: datosExtraidos.colonia || '',
          estado: datosExtraidos.estado || '',
          codigoPostal: datosExtraidos.codigo_postal || '',
          pais: datosExtraidos.pais || 'MEXICO',
          activo: true
        };
      }
      
      console.log(`📋 Creando cliente (${tipoPersonaDetectado}) | RFC: ${datosExtraidos.rfc} | ${tipoPersonaDetectado === 'Persona Moral' ? nuevoCliente.razonSocial : nuevoCliente.nombre}`);
      
      const { crearCliente } = await import('../../services/clientesService');
      const resultado = await crearCliente(nuevoCliente);
      
      console.log('📡 Respuesta de crearCliente:', resultado);
      
      if (resultado.success && resultado.data) {
        // ⚠️ IMPORTANTE: Normalizar campos del backend (snake_case → camelCase)
        const clienteNormalizado = {
          ...resultado.data,
          razonSocial: resultado.data.razonSocial || resultado.data.razon_social || '',
          nombreComercial: resultado.data.nombreComercial || resultado.data.nombre_comercial || '',
          apellidoPaterno: resultado.data.apellidoPaterno || resultado.data.apellido_paterno || '',
          apellidoMaterno: resultado.data.apellidoMaterno || resultado.data.apellido_materno || '',
          telefonoFijo: resultado.data.telefonoFijo || resultado.data.telefono_fijo || '',
          telefonoMovil: resultado.data.telefonoMovil || resultado.data.telefono_movil || ''
        };
        
        setClienteEncontrado(clienteNormalizado);
        const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
        console.log('✅ Cliente creado correctamente:', nombreCliente, 'ID:', clienteNormalizado.id);
        console.log('✅ Cliente normalizado:', clienteNormalizado);
        
        // 📝 LOGGING: Registro de cliente creado
        // Nota: El logging se hará cuando se guarde el expediente en NvoExpedientes.jsx
        // Aquí solo agregamos un flag para que sepa que fue creado durante PDF
        if (window.__clienteCreadoDurantePDF) {
          window.__clienteCreadoDurantePDF = null; // Limpiar flag anterior
        }
        window.__clienteCreadoDurantePDF = {
          cliente: clienteNormalizado,
          metodo: 'Extractor PDF',
          fecha: new Date().toISOString()
        };
        
        // 🔄 Notificar a la vista de clientes que se creó un nuevo cliente
        window.dispatchEvent(new CustomEvent('clientes-actualizados', {
          detail: {
            clienteId: clienteNormalizado.id,
            cliente: clienteNormalizado,
            accion: 'creado',
            metodo: 'Extractor PDF'
          }
        }));
        console.log('📡 Evento clientes-actualizados disparado - cliente creado');
      } else if (resultado.success && !resultado.data) {
        console.warn('⚠️ El servidor devolvió success pero sin datos. Intentando recargar clientes...');
        
        // Recargar todos los clientes para obtener el recién creado
        const { obtenerClientes } = await import('../../services/clientesService');
        const clientesResult = await obtenerClientes();
        
        if (clientesResult.success && clientesResult.data.length > 0) {
          // Buscar el cliente por RFC
          const clienteCreado = clientesResult.data.find(c => c.rfc === nuevoCliente.rfc);
          
          if (clienteCreado) {
            // ⚠️ IMPORTANTE: Normalizar campos del backend
            const clienteNormalizado = {
              ...clienteCreado,
              razonSocial: clienteCreado.razonSocial || clienteCreado.razon_social || '',
              nombreComercial: clienteCreado.nombreComercial || clienteCreado.nombre_comercial || '',
              apellidoPaterno: clienteCreado.apellidoPaterno || clienteCreado.apellido_paterno || '',
              apellidoMaterno: clienteCreado.apellidoMaterno || clienteCreado.apellido_materno || '',
              telefonoFijo: clienteCreado.telefonoFijo || clienteCreado.telefono_fijo || '',
              telefonoMovil: clienteCreado.telefonoMovil || clienteCreado.telefono_movil || ''
            };
            
            setClienteEncontrado(clienteNormalizado);
            const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
            console.log('✅ Cliente recuperado después de creación:', nombreCliente, 'ID:', clienteNormalizado.id);
            console.log('✅ Cliente normalizado:', clienteNormalizado);
            
            // 📝 LOGGING: Registro de cliente creado (recuperado)
            if (window.__clienteCreadoDurantePDF) {
              window.__clienteCreadoDurantePDF = null; // Limpiar flag anterior
            }
            window.__clienteCreadoDurantePDF = {
              cliente: clienteNormalizado,
              metodo: 'Extractor PDF',
              fecha: new Date().toISOString()
            };
            
            // 🔄 Notificar a la vista de clientes que se creó un nuevo cliente
            window.dispatchEvent(new CustomEvent('clientes-actualizados', {
              detail: {
                clienteId: clienteNormalizado.id,
                cliente: clienteNormalizado,
                accion: 'creado',
                metodo: 'Extractor PDF'
              }
            }));
            console.log('📡 Evento clientes-actualizados disparado - cliente recuperado');
          } else {
            console.error('❌ No se pudo encontrar el cliente recién creado');
            setErrores(['El cliente se creó pero no se pudo recuperar. Por favor, reintenta.']);
            setEstado('error');
            return;
          }
        } else {
          console.error('❌ No se pudieron recargar los clientes');
          setErrores(['Error al recargar clientes después de la creación.']);
          setEstado('error');
          return;
        }
      } else {
        console.error('❌ Error al crear cliente:', resultado.error);
        
        // ✅ CASO ESPECIAL: Si el error es por RFC faltante, mostrar modal de captura
        if (resultado.error && resultado.error.includes('RFC')) {
          console.log('⚠️ RFC no encontrado en PDF - Abriendo modal de captura');
          setMostrarModalRFC(true);
          setEstado('capturando-rfc');
          return;
        }
        
        // Si no es error de RFC, mostrar error normal
        setErrores(['❌ Error al crear cliente: ' + resultado.error]);
        setEstado('error');
        return;
      }
    }
    
    // Pasar al PASO 2: Validación de Agente
    setEstado('validando-agente');
  }, [datosExtraidos]);

  // ✅ FUNCIÓN SIMPLIFICADA: Asignar RFC y continuar con creación de cliente
  const handleSeleccionRFC = useCallback(async (opcion, rfcManual = '') => {
    console.log(`✅ Usuario seleccionó: ${opcion}`, rfcManual ? `RFC manual: ${rfcManual}` : '');
    
    let rfcFinal = '';
    let tipoPersonaFinal = '';
    
    if (opcion === 'fisica') {
      rfcFinal = 'XAXX010101000'; // 13 caracteres - RFC genérico persona física
      tipoPersonaFinal = 'Fisica';
    } else if (opcion === 'moral') {
      rfcFinal = 'XEXX010101000'; // 12 caracteres - RFC genérico persona moral
      tipoPersonaFinal = 'Moral';
    } else if (opcion === 'capturar' && rfcManual) {
      rfcFinal = rfcManual.toUpperCase().trim();
      tipoPersonaFinal = rfcFinal.length === 13 ? 'Fisica' : 'Moral';
    }
    
    if (!rfcFinal) {
      toast.error('⚠️ RFC inválido');
      return;
    }
    
    console.log(`✅ RFC FINAL asignado: ${rfcFinal} (${tipoPersonaFinal})`);
    
    // Cerrar modal
    setMostrarModalRFC(false);
    setRfcCapturado('');
    
    // ✅ Actualizar datosExtraidos con el RFC asignado
    const datosActualizados = {
      ...datosExtraidos,
      rfc: rfcFinal,
      tipo_persona: tipoPersonaFinal
    };
    setDatosExtraidos(datosActualizados);
    
    // ✅ CONTINUAR con la creación del cliente (copiar lógica de handleDecisionCliente)
    console.log('🔄 Creando nuevo cliente con RFC asignado...');
    
    const tipoPersonaDetectado = tipoPersonaFinal === 'Moral' ? 'Persona Moral' : 'Persona Física';
    
    // Preparar datos según tipo de persona
    let nuevoCliente = {};
    
    if (tipoPersonaDetectado === 'Persona Moral') {
      nuevoCliente = {
        tipoPersona: tipoPersonaDetectado,
        razonSocial: datosActualizados.razonSocial || 'Empresa',
        rfc: rfcFinal,
        direccion: datosActualizados.domicilio || '',
        municipio: datosActualizados.municipio || '',
        colonia: datosActualizados.colonia || '',
        estado: datosActualizados.estado || '',
        codigoPostal: datosActualizados.codigo_postal || '',
        pais: datosActualizados.pais || 'MEXICO',
        email: datosActualizados.email || '',
        activo: true
      };
    } else {
      nuevoCliente = {
        tipoPersona: tipoPersonaDetectado,
        nombre: datosActualizados.nombre || '',
        apellidoPaterno: datosActualizados.apellido_paterno || '',
        apellidoMaterno: datosActualizados.apellido_materno || '',
        rfc: rfcFinal,
        direccion: datosActualizados.domicilio || '',
        municipio: datosActualizados.municipio || '',
        colonia: datosActualizados.colonia || '',
        estado: datosActualizados.estado || '',
        codigoPostal: datosActualizados.codigo_postal || '',
        pais: datosActualizados.pais || 'MEXICO',
        email: datosActualizados.email || '',
        activo: true
      };
    }
    
    console.log('📋 Datos del cliente a crear:', nuevoCliente);
    
    try {
      const { crearCliente } = await import('../../services/clientesService');
      const resultado = await crearCliente(nuevoCliente);
      
      console.log('� Respuesta de crearCliente:', resultado);
      
      if (resultado.success && resultado.data) {
        const clienteNormalizado = {
          ...resultado.data,
          razonSocial: resultado.data.razonSocial || resultado.data.razon_social || '',
          nombreComercial: resultado.data.nombreComercial || resultado.data.nombre_comercial || '',
          apellidoPaterno: resultado.data.apellidoPaterno || resultado.data.apellido_paterno || '',
          apellidoMaterno: resultado.data.apellidoMaterno || resultado.data.apellido_materno || '',
          telefonoFijo: resultado.data.telefonoFijo || resultado.data.telefono_fijo || '',
          telefonoMovil: resultado.data.telefonoMovil || resultado.data.telefono_movil || ''
        };
        
        setClienteEncontrado(clienteNormalizado);
        const nombreCliente = clienteNormalizado.razonSocial || `${clienteNormalizado.nombre} ${clienteNormalizado.apellidoPaterno || ''}`.trim();
        console.log('✅ Cliente creado correctamente:', nombreCliente, 'ID:', clienteNormalizado.id);
        toast.success('✅ Cliente creado correctamente');
        
        // 📝 LOGGING: Registro de cliente creado
        // Nota: El logging se hará cuando se guarde el expediente en NvoExpedientes.jsx
        // Aquí solo agregamos un flag para que sepa que fue creado durante PDF
        if (window.__clienteCreadoDurantePDF) {
          window.__clienteCreadoDurantePDF = null; // Limpiar flag anterior
        }
        window.__clienteCreadoDurantePDF = {
          cliente: clienteNormalizado,
          metodo: 'Extractor PDF',
          fecha: new Date().toISOString()
        };
        
        // 🔄 Notificar a la vista de clientes que se creó un nuevo cliente
        window.dispatchEvent(new CustomEvent('clientes-actualizados', {
          detail: {
            clienteId: clienteNormalizado.id,
            cliente: clienteNormalizado,
            accion: 'creado',
            metodo: 'Extractor PDF'
          }
        }));
        console.log('📡 Evento clientes-actualizados disparado - cliente creado');
        
        // Pasar a validación de agente
        setEstado('validando-agente');
      } else {
        console.error('❌ Error al crear cliente:', resultado.error);
        toast.error('❌ Error al crear cliente: ' + resultado.error);
        setEstado('error');
      }
    } catch (error) {
      console.error('❌ Error en creación de cliente:', error);
      toast.error('❌ Error al crear cliente');
      setEstado('error');
    }
  }, [datosExtraidos]);

  // PASO 2: Manejar decisión sobre el agente
  const handleDecisionAgente = useCallback(async (decision) => {
    console.log('🎯 handleDecisionAgente:', decision);
    setDecisionAgente(decision);
    
    if (decision === 'usar-existente') {
      console.log(`✅ Usando agente: ${agenteEncontrado?.nombre} | Clave ${datosExtraidos.clave_agente}: ${claveYaExiste ? 'existente' : 'nueva'}`);
      
      // Si la clave NO existe, agregarla automáticamente al agente
      if (!claveYaExiste && datosExtraidos.clave_agente && agenteEncontrado) {
        
        try {
          // Identificar aseguradora
          const companiaExtraida = datosExtraidos.compania;
          let aseguradoraId = null;
          let aseguradoraNombre = '';
          
          console.log('🔍 [AUTO-CLAVE] Buscando aseguradora:', companiaExtraida, '| Catálogo tiene:', aseguradoras.length, 'aseguradoras');
          console.log('🔍 [AUTO-CLAVE] Aseguradoras disponibles:', aseguradoras.map(a => `${a.id}:${a.nombre}`).join(', '));
          
          if (companiaExtraida && aseguradoras.length > 0) {
            const normalizarNombre = (nombre) => {
              return nombre
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/\s+/g, ' ')
                .trim();
            };
            
            const companiaExtraidaNormalizada = normalizarNombre(companiaExtraida);
            let mejorScore = 0;
            let aseguradoraMatch = null;
            
            for (const aseg of aseguradoras) {
              if (!aseg.nombre) continue;
              const nombreAsegNormalizado = normalizarNombre(aseg.nombre);
              let score = 0;
              
              if (nombreAsegNormalizado === companiaExtraidaNormalizada) {
                score = 100;
              } else if (nombreAsegNormalizado.includes(companiaExtraidaNormalizada) || 
                         companiaExtraidaNormalizada.includes(nombreAsegNormalizado)) {
                score = 80;
              } else {
                const palabrasClave = companiaExtraidaNormalizada.split(/\s+/);
                const palabrasAseg = nombreAsegNormalizado.split(/\s+/);
                for (const pc of palabrasClave) {
                  if (pc.length >= 3 && palabrasAseg.some(pa => pa.includes(pc) || pc.includes(pa))) {
                    score = Math.max(score, 60);
                  }
                }
              }
              
              if (score > mejorScore) {
                mejorScore = score;
                aseguradoraMatch = aseg;
              }
            }
            
            if (aseguradoraMatch && mejorScore >= 50) {
              aseguradoraId = aseguradoraMatch.id;
              aseguradoraNombre = aseguradoraMatch.nombre;
              console.log(`✅ [AUTO-CLAVE] Aseguradora: ${aseguradoraNombre} (id: ${aseguradoraId}, score: ${mejorScore})`);
            } else {
              console.warn(`⚠️ [AUTO-CLAVE] No se encontró aseguradora para "${companiaExtraida}"`);
            }
          }
          
          // Buscar producto — obtener catálogo real desde API (tiposProductos prop puede ser solo strings)
          const productoExtraido = datosExtraidos.producto;
          let productoMatch = null;
          
          let productosReales = [];
          try {
            const { obtenerTiposProductos } = await import('../../services/tiposProductosService');
            const resProductos = await obtenerTiposProductos();
            if (resProductos && resProductos.success && Array.isArray(resProductos.data)) {
              productosReales = resProductos.data;
            }
          } catch (e) {
            console.warn('⚠️ [AUTO-CLAVE] No se pudieron obtener productos del API:', e);
          }
          
          console.log('🔍 [AUTO-CLAVE] Buscando producto:', productoExtraido, '| Catálogo real tiene:', productosReales.length, 'productos');
          console.log('🔍 [AUTO-CLAVE] Productos disponibles:', productosReales.map(p => `${p.id}:${p.nombre}`).join(', '));
          
          if (productoExtraido && productosReales.length > 0) {
            // Coincidencia exacta
            productoMatch = productosReales.find(prod =>
              prod.nombre && prod.nombre.toLowerCase() === productoExtraido.toLowerCase()
            );
            // Coincidencia parcial
            if (!productoMatch) {
              productoMatch = productosReales.find(prod =>
                prod.nombre && (
                  productoExtraido.toLowerCase().includes(prod.nombre.toLowerCase()) ||
                  prod.nombre.toLowerCase().includes(productoExtraido.toLowerCase())
                )
              );
            }
            // Buscar "auto" 
            if (!productoMatch && productoExtraido.toLowerCase().includes('auto')) {
              productoMatch = productosReales.find(prod => 
                prod.nombre && prod.nombre.toLowerCase().includes('auto')
              );
            }
            // Palabras clave
            if (!productoMatch) {
              const palabrasProducto = productoExtraido.toLowerCase().split(/\s+/);
              productoMatch = productosReales.find(prod =>
                prod.nombre && palabrasProducto.some(p => p.length >= 3 && prod.nombre.toLowerCase().includes(p))
              );
            }
          }
          // Fallback: primer producto tipo auto
          if (!productoMatch && productosReales.length > 0) {
            productoMatch = productosReales.find(prod =>
              prod.nombre && prod.nombre.toLowerCase().includes('auto')
            ) || productosReales[0];
            console.warn(`⚠️ [AUTO-CLAVE] Producto fallback: ${productoMatch?.nombre}`);
          }
          
          console.log(`🔍 [AUTO-CLAVE] Producto: ${productoMatch?.nombre} (id: ${productoMatch?.id})`);
          
          // Vincular agente con nueva clave (2 pasos)
          if (aseguradoraId && productoMatch) {
            const { actualizarMiembroEquipo, obtenerEjecutivosPorProducto: getAsig } = await import('../../services/equipoDeTrabajoService');
            
            // PASO 1: Agregar la combinación aseguradora-producto al array productosAseguradoras del agente
            // Primero obtener las asignaciones actuales para reconstruir productosAseguradoras
            let productosActuales = [];
            try {
              const asigResult = await getAsig(agenteEncontrado.id);
              if (asigResult.success && asigResult.data) {
                productosActuales = asigResult.data.map(a => ({
                  aseguradoraId: a.aseguradoraId || null,
                  productoId: a.productoId,
                  ejecutivoId: a.ejecutivoId || null,
                  comisionPersonalizada: a.comisionPersonalizada || 0,
                  clave: a.clave || null
                }));
              }
            } catch (e) {
              console.warn('⚠️ [AUTO-CLAVE] No se pudieron obtener asignaciones actuales:', e);
            }
            
            // Verificar si ya existe esta combinación aseguradora+producto
            const yaExisteCombo = productosActuales.some(p => 
              String(p.aseguradoraId) === String(aseguradoraId) && 
              String(p.productoId) === String(productoMatch.id)
            );
            
            if (!yaExisteCombo) {
              // Agregar nueva combinación
              productosActuales.push({
                aseguradoraId: aseguradoraId,
                productoId: productoMatch.id,
                ejecutivoId: null,
                comisionPersonalizada: productoMatch.comisionBase || 0,
                clave: datosExtraidos.clave_agente
              });
              
              // Actualizar el agente con el nuevo productosAseguradoras
              console.log('📡 [AUTO-CLAVE] PASO 1: Actualizando productosAseguradoras del agente...');
              const updateResult = await actualizarMiembroEquipo(agenteEncontrado.id, {
                productosAseguradoras: productosActuales
              });
              
              if (!updateResult.success) {
                console.error('❌ [AUTO-CLAVE] Error al actualizar productosAseguradoras:', updateResult.error);
              } else {
                console.log('✅ [AUTO-CLAVE] PASO 1 OK: productosAseguradoras actualizado');
              }
            } else {
              console.log('ℹ️ [AUTO-CLAVE] Combo aseguradora+producto ya existe, solo falta la clave');
            }
            
            // Nota: El ejecutivo se configura manualmente desde Equipo de Trabajo
            if (!yaExisteCombo) {
              toast.success(`Clave ${datosExtraidos.clave_agente} (${aseguradoraNombre}) agregada a ${agenteEncontrado.nombre}. Configure el ejecutivo en Equipo de Trabajo.`);
            }
          } else {
            if (!aseguradoraId) {
              toast.error(`No se encontró "${companiaExtraida}" en el catálogo de aseguradoras. Agrega la clave manualmente.`);
            } else if (!productoMatch) {
              toast.error(`No se encontró el producto "${productoExtraido}" en el catálogo. Agrega la clave manualmente.`);
            }
          }
        } catch (error) {
          console.error('❌ [AUTO-CLAVE] Error:', error);
          toast.error('Error al agregar la clave: ' + error.message);
        }
      }
      
      // Continuar al preview
      setEstado('preview-datos');
    } else if (decision === 'crear-nuevo') {
      // Obtener clave y nombre ya separados desde el extractor
      const codigo = datosExtraidos.clave_agente; // La clave de la aseguradora (ej: 25576, 776024)
      const nombreCompleto = datosExtraidos.agente; // El nombre del agente sin la clave
      console.log('🔍 Nombre agente:', nombreCompleto);
      
      if (!codigo || !nombreCompleto) {
        console.error('❌ No se pudo extraer información del agente');
        toast('⚠️ No se pudo extraer la información del agente del PDF. Crea el agente manualmente en Equipo de Trabajo.');
        // Continuar sin crear el agente
        setEstado('preview-datos');
        return;
      }
      
      // Detectar si es persona moral (empresa)
      const palabrasEmpresa = ['ASOCIADOS', 'Y CIA', 'S.A.', 'SA DE CV', 'S DE RL', 'SC', 'AGTE DE SEGU', 'AGENTE DE SEGUROS', 'ASESORES', 'CONSULTORES', 'GRUPO', 'CORPORATIVO'];
      const esPersonaMoral = palabrasEmpresa.some(palabra => nombreCompleto.toUpperCase().includes(palabra));
      
      let nombre = '', apellidoPaterno = '', apellidoMaterno = '';
      
      if (esPersonaMoral) {
        // Persona Moral: Usar el nombre completo como "nombre" y dejar apellidos vacíos
        nombre = nombreCompleto;
        apellidoPaterno = '';
        apellidoMaterno = '';
      } else {
        // Persona Física: Dividir en nombre y apellidos
        const palabras = nombreCompleto.split(/\s+/);
        
        if (palabras.length >= 4) {
          nombre = palabras.slice(0, -2).join(' ');
          apellidoPaterno = palabras[palabras.length - 2];
          apellidoMaterno = palabras[palabras.length - 1];
        } else if (palabras.length === 3) {
          nombre = palabras[0];
          apellidoPaterno = palabras[1];
          apellidoMaterno = palabras[2];
        } else if (palabras.length === 2) {
          nombre = palabras[0];
          apellidoPaterno = palabras[1];
        }
      }
      
      try {
        // PRIMERO: Identificar la aseguradora antes de buscar al agente
        const companiaExtraida = datosExtraidos.compania;
        let aseguradoraId = null;
        
        if (companiaExtraida && aseguradoras.length > 0) {
          // Normalizar nombre de aseguradora
          const normalizarNombre = (nombre) => {
            return nombre
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/\s+/g, ' ')
              .replace(/^(EL|LA|LOS|LAS)\s+/i, '')
              .replace(/\s+(SEGUROS|SEGURO|S\.A\.|SA|DE\s+CV)$/i, '')
              .trim();
          };
          
          const companiaExtraidaNormalizada = normalizarNombre(companiaExtraida);
          
          // Buscar aseguradora con fuzzy matching
          let mejorScore = 0;
          let aseguradoraMatch = null;
          
          for (const aseg of aseguradoras) {
            if (!aseg.nombre) continue;
            const nombreAsegNormalizado = normalizarNombre(aseg.nombre);
            let score = 0;
            
            if (nombreAsegNormalizado === companiaExtraidaNormalizada) {
              score = 100;
            } else if (nombreAsegNormalizado.includes(companiaExtraidaNormalizada) || 
                       companiaExtraidaNormalizada.includes(nombreAsegNormalizado)) {
              score = 80;
            }
            
            if (score > mejorScore) {
              mejorScore = score;
              aseguradoraMatch = aseg;
            }
          }
          
          if (aseguradoraMatch && mejorScore >= 60) {
            aseguradoraId = aseguradoraMatch.id;
            console.log('🏢 Aseguradora identificada:', aseguradoraMatch.nombre, 'ID:', aseguradoraId);
          } else {
            console.warn('⚠️ No se pudo identificar la aseguradora:', companiaExtraida);
          }
        }
        
        // PASO 1: Buscar agente por ASEGURADORA + CLAVE (combinación única)
        const { obtenerEquipoDeTrabajo, obtenerEjecutivosPorProducto } = await import('../../services/equipoDeTrabajoService');
        const equipoResult = await obtenerEquipoDeTrabajo();
        
        console.log('📋 Equipo obtenido. Total miembros:', equipoResult.data?.length || 0);
        console.log('📋 Success:', equipoResult.success);
        if (equipoResult.data && equipoResult.data.length > 0) {
          console.log('📋 Primeros 3 miembros:', equipoResult.data.slice(0, 3).map(m => ({ 
            id: m.id, 
            nombre: m.nombre, 
            perfil: m.perfil,
            activo: m.activo,
            apellidoPaterno: m.apellidoPaterno || m.apellido_paterno
          })));
          
          // Buscar específicamente ALVARO
          const alvaro = equipoResult.data.find(m => m.nombre?.includes('ALVARO'));
          if (alvaro) {
            console.log('👤 ALVARO encontrado en BD:', {
              id: alvaro.id,
              nombre: alvaro.nombre,
              apellidoPaterno: alvaro.apellidoPaterno || alvaro.apellido_paterno,
              apellidoMaterno: alvaro.apellidoMaterno || alvaro.apellido_materno,
              perfil: alvaro.perfil,
              activo: alvaro.activo
            });
          } else {
            console.log('❌ ALVARO NO encontrado en el equipo');
          }
        }
        
        let agenteExistente = null;
        if (equipoResult.success && equipoResult.data && aseguradoraId) {
          console.log('🔎 Buscando por ASEGURADORA + CLAVE:', aseguradoraId, '+', codigo);
          // PASO 1A: Buscar por ASEGURADORA + CLAVE (la clave solo es única dentro de cada aseguradora)
          for (const miembro of equipoResult.data) {
            if (miembro.perfil !== 'Agente' || !miembro.activo) continue;
            
            const asignacionesResult = await obtenerEjecutivosPorProducto(miembro.id);
            if (asignacionesResult.success && asignacionesResult.data) {
              console.log(`  Revisando agente ${miembro.nombre}, asignaciones:`, asignacionesResult.data.length);
              // Buscar combinación: misma aseguradora Y misma clave
              const tieneAseguradoraYClave = asignacionesResult.data.some(asig => {
                const match = String(asig.aseguradoraId) === String(aseguradoraId) && 
                              String(asig.clave) === String(codigo);
                if (match) {
                  console.log('    ✅ MATCH! asegId:', asig.aseguradoraId, 'clave:', asig.clave);
                }
                return match;
              });
              
              if (tieneAseguradoraYClave) {
                agenteExistente = miembro;
                console.log('✅ Agente encontrado por ASEGURADORA + CLAVE:', aseguradoraId, '+', codigo, '→', miembro.nombre);
                break;
              }
            }
          }
        }
        
        // PASO 1B: Si no se encontró por aseguradora+clave, buscar por NOMBRE
        if (!agenteExistente && equipoResult.success && equipoResult.data) {
          console.log('🔎 No encontrado por aseg+clave. Buscando por NOMBRE:', `${nombre} ${apellidoPaterno} ${apellidoMaterno}`);
          agenteExistente = equipoResult.data.find(miembro => {
            if (miembro.perfil !== 'Agente' || !miembro.activo) return false;
            
            // Opción 1: Nombre compuesto desde campos separados (apellidoPaterno, apellidoMaterno)
            const nombreCompleto1 = `${miembro.nombre} ${miembro.apellidoPaterno || miembro.apellido_paterno || ''} ${miembro.apellidoMaterno || miembro.apellido_materno || ''}`.trim().toUpperCase();
            const nombreCompleto2 = `${nombre} ${apellidoPaterno} ${apellidoMaterno}`.trim().toUpperCase();
            
            // Opción 2: Nombre completo todo en un solo campo (para agentes guardados con nombre completo)
            const nombreSoloCampo = (miembro.nombre || '').trim().toUpperCase();
            const nombreExtraido = nombreCompleto2;
            
            console.log(`  Comparando opción 1: "${nombreCompleto1}" === "${nombreCompleto2}"`, nombreCompleto1 === nombreCompleto2);
            console.log(`  Comparando opción 2: "${nombreSoloCampo}" === "${nombreExtraido}"`, nombreSoloCampo === nombreExtraido);
            
            return nombreCompleto1 === nombreCompleto2 || nombreSoloCampo === nombreExtraido;
          });
          
          if (agenteExistente) {
            console.log('✅ Agente encontrado por NOMBRE:', agenteExistente.nombre);
          } else {
            console.log('❌ No se encontró agente por nombre');
          }
        }
        
        let agenteId;
        let yaExisteAsignacion = false;
        
        if (agenteExistente) {
          agenteId = agenteExistente.id;
          console.log('✅ Agente ya existe en equipo:', agenteExistente.nombre, 'ID:', agenteId);
          
          // PASO 2: Verificar si YA TIENE esta combinación aseguradora+clave asignada
          const asignacionesResult = await obtenerEjecutivosPorProducto(agenteId);
          if (asignacionesResult.success && asignacionesResult.data) {
            if (aseguradoraId) {
              // Buscar si ya existe esta combinación específica
              yaExisteAsignacion = asignacionesResult.data.some(asig => 
                String(asig.aseguradoraId) === String(aseguradoraId) &&
                String(asig.clave) === String(codigo)
              );
              
              if (yaExisteAsignacion) {
                console.log('⚠️ El agente YA TIENE la clave', codigo, 'en esta aseguradora');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(true); // Marcar que la clave ya existe
                toast.info(`El agente ya tiene la clave ${codigo} registrada en esta aseguradora`);
              } else {
                console.log('ℹ️ Se agregará nueva clave', codigo, 'al agente existente para esta aseguradora');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(false); // Marcar que la clave NO existe
                toast.success(`Agente encontrado: ${esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`}`);
              }
            } else {
              // No se pudo identificar la aseguradora, buscar solo por clave
              console.log('⚠️ No se identificó aseguradora, buscando solo por clave');
              yaExisteAsignacion = asignacionesResult.data.some(asig => 
                String(asig.clave) === String(codigo)
              );
              
              if (yaExisteAsignacion) {
                console.log('⚠️ El agente YA TIENE la clave', codigo);
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(true);
                toast.info(`El agente ya tiene la clave ${codigo} registrada`);
              } else {
                console.log('ℹ️ Se agregará nueva clave', codigo, 'al agente existente');
                setAgenteEncontrado(agenteExistente);
                setClaveYaExiste(false);
                toast.success(`Agente encontrado: ${esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`}`);
              }
            }
          } else {
            // No se pudieron obtener las asignaciones, marcar como agente encontrado sin validar clave
            console.log('⚠️ No se pudieron obtener las asignaciones del agente');
            setAgenteEncontrado(agenteExistente);
            setClaveYaExiste(false);
          }
        } else {
          // El agente NO EXISTE - Crear nuevo
          // Generar código consecutivo para el equipo (AG001, AG002, etc.)
          const prefijo = 'AG';
          const agentesExistentes = equipoResult.data.filter(m => 
            m.perfil === 'Agente' && m.codigo && m.codigo.startsWith(prefijo)
          );
          
          let maxNumero = 0;
          for (const ag of agentesExistentes) {
            const num = parseInt(ag.codigo.replace(prefijo, ''), 10);
            if (!isNaN(num) && num > maxNumero) maxNumero = num;
          }
          
          const siguienteNumero = maxNumero + 1;
          const codigoConsecutivo = prefijo + String(siguienteNumero).padStart(3, '0'); // AG001, AG002, etc.
          
          const nuevoAgente = {
            codigo: codigoConsecutivo, // Código del equipo, NO la clave de aseguradora
            nombre: nombre,
            apellidoPaterno: apellidoPaterno,
            apellidoMaterno: apellidoMaterno,
            perfil: 'Agente',
            activo: true,
            fechaIngreso: new Date().toISOString().split('T')[0],
            productosAseguradoras: []
          };
          
          const { crearMiembroEquipo } = await import('../../services/equipoDeTrabajoService');
          const resultado = await crearMiembroEquipo(nuevoAgente);
          
          if (resultado.success) {
            agenteId = resultado.data.id;
            setAgenteEncontrado(resultado.data);
            console.log('✅ Agente creado exitosamente:', resultado.data.nombre, 'ID:', resultado.data.id);
            const nombreMostrar = esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno}`;
            toast.success(`Agente creado: ${nombreMostrar}`);
            
            // RECARGAR LISTA DE AGENTES para que aparezca en el componente principal
            try {
              const { obtenerAgentesEquipo } = await import('../../services/equipoDeTrabajoService');
              const resultadoAgentes = await obtenerAgentesEquipo();
              if (resultadoAgentes.success && window.recargarAgentes) {
                window.recargarAgentes(resultadoAgentes.data);
                console.log('✅ Lista de agentes recargada');
              }
            } catch (errorRecarga) {
              console.warn('⚠️ No se pudo recargar la lista de agentes:', errorRecarga);
            }
          } else {
            throw new Error(resultado.error);
          }
        }
        
        // VINCULAR AGENTE CON ASEGURADORA Y PRODUCTO
        const productoExtraido = datosExtraidos.producto;
        
        console.log('🔗 INICIO VINCULACIÓN:');
        console.log('   aseguradoraId:', aseguradoraId);
        console.log('   productoExtraido:', productoExtraido);
        console.log('   agenteId:', agenteId);
        console.log('   yaExisteAsignacion:', yaExisteAsignacion);
        
        if (aseguradoraId && productoExtraido && tiposProductos.length > 0) {
          // Ya tenemos la aseguradora identificada arriba
          console.log('🔗 Vinculando agente con aseguradora ID:', aseguradoraId);
          
          // Buscar producto
          let productoMatch = tiposProductos.find(prod =>
            prod.nombre && productoExtraido.toLowerCase().includes(prod.nombre.toLowerCase())
          );
          
          if (!productoMatch) {
            productoMatch = tiposProductos.find(prod =>
              prod.nombre && prod.nombre.toLowerCase().includes(productoExtraido.toLowerCase())
            );
          }
          
          if (!productoMatch && productoExtraido.toLowerCase().includes('auto')) {
            productoMatch = tiposProductos.find(prod => 
              prod.nombre && prod.nombre.toLowerCase().includes('auto')
            );
          }
          
          console.log('📦 Producto encontrado:', productoMatch ? productoMatch.nombre : 'NO ENCONTRADO');
          
          if (productoMatch) {
            console.log('✅ Verificando si ya existe asignación:', yaExisteAsignacion);
            // Verificar si ya existe esta asignación
            if (!yaExisteAsignacion) {
              console.log('💾 Guardando nueva asignación...');
              // Guardar la asociación agente-aseguradora-producto-clave
              try {
                const { guardarEjecutivosPorProducto } = await import('../../services/equipoDeTrabajoService');
                const asignacion = {
                  usuarioId: agenteId,
                  aseguradoraId: aseguradoraId,
                  productoId: productoMatch.id,
                  ejecutivoId: agenteId,
                  clave: codigo, // La clave específica para esta aseguradora
                  comisionPersonalizada: 0
                };
                
                
                const resultadoAsignacion = await guardarEjecutivosPorProducto(asignacion);
                
                if (resultadoAsignacion.success) {
                  console.log('✅ Agente vinculado con aseguradora - Clave:', codigo);
                } else {
                  console.warn('⚠️ No se pudo vincular agente con producto:', resultadoAsignacion.error);
                }
              } catch (errorAsignacion) {
                console.error('❌ Error al vincular agente:', errorAsignacion);
              }
            } else {
              console.log('ℹ️ El agente ya tiene asignada esta clave para esta aseguradora, se omite vinculación');
            }
          } else {
            console.warn('⚠️ No se encontró producto matching para:', productoExtraido);
          }
        } else {
          console.warn('⚠️ No se pudo vincular: falta aseguradoraId o productoExtraido');
        }
      } catch (error) {
        console.error('❌ Error al procesar agente:', error);
        const nombreMostrar = esPersonaMoral ? nombre : `${nombre} ${apellidoPaterno} ${apellidoMaterno}`;
        toast(`⚠️ No se pudo crear el agente automáticamente. Agrega manualmente: Código ${codigo} - ${nombreMostrar}`);
        // Continuar sin el agente
      }
    }
    
    // Pasar al PASO 3: Preview de todos los datos
    setEstado('preview-datos');
  }, [datosExtraidos, aseguradoras, tiposProductos, agenteEncontrado, claveYaExiste]);

  // PASO 3: Aplicar datos al formulario
  const aplicarDatos = useCallback(() => {
    if (datosExtraidos && onDataExtracted) {
      // Aplicando datos del cliente
      
      // Combinar los datos extraídos del PDF con los datos normalizados del cliente
      const datosConCliente = {
        ...datosExtraidos,
        cliente_id: clienteEncontrado?.id || datosExtraidos.cliente_id || null,
        agente_id: agenteEncontrado?.id || datosExtraidos.agente_id || null
      };
      
      // Cliente vinculado

      // Si tenemos clienteEncontrado, usar sus datos normalizados (ya en camelCase)
      if (clienteEncontrado) {
        console.log('✅ Aplicando datos del cliente normalizado:', {
          razonSocial: clienteEncontrado.razonSocial,
          nombreComercial: clienteEncontrado.nombreComercial,
          rfc: clienteEncontrado.rfc
        });
        
        // Sobrescribir los datos del cliente del PDF con los datos normalizados de BD
        datosConCliente.razonSocial = clienteEncontrado.razonSocial || clienteEncontrado.razon_social || datosConCliente.razonSocial;
        datosConCliente.nombreComercial = clienteEncontrado.nombreComercial || clienteEncontrado.nombre_comercial || datosConCliente.nombreComercial;
        datosConCliente.nombre = clienteEncontrado.nombre || datosConCliente.nombre;
        datosConCliente.apellido_paterno = clienteEncontrado.apellidoPaterno || clienteEncontrado.apellido_paterno || datosConCliente.apellido_paterno;
        datosConCliente.apellido_materno = clienteEncontrado.apellidoMaterno || clienteEncontrado.apellido_materno || datosConCliente.apellido_materno;
        datosConCliente.rfc = clienteEncontrado.rfc || datosConCliente.rfc;
        datosConCliente.email = clienteEncontrado.email || datosConCliente.email;
        datosConCliente.telefono_fijo = clienteEncontrado.telefonoFijo || clienteEncontrado.telefono_fijo || datosConCliente.telefono_fijo;
        datosConCliente.telefono_movil = clienteEncontrado.telefonoMovil || clienteEncontrado.telefono_movil || datosConCliente.telefono_movil;
      }
      // Adjuntar archivo PDF seleccionado para subirlo automáticamente tras crear el expediente
      if (archivo) {
        try {
          datosConCliente.__pdfFile = archivo;
          if (informacionArchivo?.nombre) datosConCliente.__pdfNombre = informacionArchivo.nombre;
          if (archivo?.size) datosConCliente.__pdfSize = archivo.size;
        } catch (e) {
          console.warn('No se pudo adjuntar el archivo PDF al payload de datos extraídos:', e);
        }
      }

      // ================== AJUSTES DE PAGO FRACCIONADO ==================
      // Normalización: Mapear forma_pago a tipo_pago y frecuenciaPago
      // El extractor de PDF debe proveer tipo_pago y frecuenciaPago correctos desde la Serie del aviso
      // Este código es un FALLBACK por si el extractor no los detectó
      
      if (!datosConCliente.tipo_pago || !datosConCliente.frecuenciaPago) {
        const fp = (datosConCliente.forma_pago || '').toLowerCase();
        
        if (fp.includes('tri')) {
          datosConCliente.tipo_pago = 'Fraccionado';
          datosConCliente.frecuenciaPago = 'Trimestral';
        } else if (fp.includes('men')) {
          datosConCliente.tipo_pago = 'Fraccionado';
          datosConCliente.frecuenciaPago = 'Mensual';
        } else if (fp.includes('sem')) {
          datosConCliente.tipo_pago = 'Fraccionado';
          datosConCliente.frecuenciaPago = 'Semestral';
        } else if (fp.includes('bim')) {
          datosConCliente.tipo_pago = 'Fraccionado';
          datosConCliente.frecuenciaPago = 'Bimestral';
        } else if (fp.includes('cuat')) {
          datosConCliente.tipo_pago = 'Fraccionado';
          datosConCliente.frecuenciaPago = 'Cuatrimestral';
        } else if (fp.includes('anu') || fp.includes('contado') || fp.includes('unico') || fp.includes('único')) {
          datosConCliente.tipo_pago = 'Anual';
          datosConCliente.frecuenciaPago = 'Anual';
        }
        
        if (datosConCliente.tipo_pago) {
          console.log('✅ Normalización aplicada:', {
            forma_pago: datosConCliente.forma_pago,
            tipo_pago: datosConCliente.tipo_pago,
            frecuenciaPago: datosConCliente.frecuenciaPago
          });
        } else {
          console.log('⚠️ No se pudo determinar tipo_pago desde forma_pago:', datosConCliente.forma_pago);
        }
      } else {
        console.log('✅ tipo_pago y frecuenciaPago ya vienen del extractor:', {
          tipo_pago: datosConCliente.tipo_pago,
          frecuenciaPago: datosConCliente.frecuenciaPago
        });
      }

      // ⚠️ NOTA: El calendario de pagos NO se genera aquí.
      // El formulario principal tiene funciones dedicadas que:
      //   1. Calculan fechas de pago con periodo de gracia (calcularProximoPago)
      //   2. Determinan estados (pagado, vencido, por vencer)
      //   3. Generan el calendario visual completo (CalendarioPagos component)
      // Solo pasamos los datos básicos: tipo_pago, frecuenciaPago, primer_pago, pagos_subsecuentes
      
      console.log('📋 Datos de pago para formulario:', {
        tipo_pago: datosConCliente.tipo_pago,
        frecuenciaPago: datosConCliente.frecuenciaPago,
        primer_pago: datosConCliente.primer_pago,
        pagos_subsecuentes: datosConCliente.pagos_subsecuentes
      });

      // ================== CAMPOS ADICIONALES POLIZA (Uso/Servicio/Movimiento) ==================
      // Si existen y el formulario espera camelCase, mantenerlos así.
      if (datosConCliente.uso) datosConCliente.uso_poliza = datosConCliente.uso;
      if (datosConCliente.servicio) datosConCliente.servicio_poliza = datosConCliente.servicio;
      if (datosConCliente.movimiento) datosConCliente.movimiento_poliza = datosConCliente.movimiento;
      
      // ================== TIPO DE COBERTURA / PLAN ==================
      // Si viene "plan" del extractor (ej: INTEGRAL de Chubb), usarlo como tipo_cobertura
      if (datosConCliente.plan && !datosConCliente.tipo_cobertura) {
        // Normalizar el plan a formato title case para que coincida con el select
        const planNormalizado = datosConCliente.plan.charAt(0).toUpperCase() + datosConCliente.plan.slice(1).toLowerCase();
        datosConCliente.tipo_cobertura = planNormalizado;
        console.log('📋 Tipo de cobertura asignado desde plan:', planNormalizado);
      } else if (datosConCliente.tipo_cobertura) {
        // Normalizar tipo_cobertura si ya viene
        datosConCliente.tipo_cobertura = datosConCliente.tipo_cobertura.charAt(0).toUpperCase() + datosConCliente.tipo_cobertura.slice(1).toLowerCase();
      }
      
      // ================== FECHA LÍMITE DE PAGO (PRIMER RECIBO) ==================
      // Calcular: inicio_vigencia + periodo_gracia
      if (datosConCliente.inicio_vigencia && datosConCliente.periodo_gracia) {
        const [year, month, day] = datosConCliente.inicio_vigencia.split('-');
        const fechaInicio = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        fechaInicio.setDate(fechaInicio.getDate() + parseInt(datosConCliente.periodo_gracia));
        datosConCliente.fecha_vencimiento_pago = fechaInicio.toISOString().split('T')[0];
        datosConCliente.fecha_pago = fechaInicio.toISOString().split('T')[0];
        console.log('✅ Fecha límite de pago calculada:', datosConCliente.fecha_vencimiento_pago, `(${datosConCliente.inicio_vigencia} + ${datosConCliente.periodo_gracia} días)`);
      } else if (datosConCliente.fecha_limite_pago) {
        // Fallback: si el PDF trae fecha_limite_pago directamente, usarla
        datosConCliente.fecha_vencimiento_pago = datosConCliente.fecha_limite_pago;
        datosConCliente.fecha_pago = datosConCliente.fecha_limite_pago;
        console.log('ℹ️ Fecha límite de pago extraída del PDF:', datosConCliente.fecha_limite_pago);
      }
      
      // ================== FECHA AVISO DE RENOVACIÓN ==================
      // Calcular: termino_vigencia - 30 días
      if (datosConCliente.termino_vigencia) {
        const [yearTerm, monthTerm, dayTerm] = datosConCliente.termino_vigencia.split('-');
        const fechaTermino = new Date(parseInt(yearTerm), parseInt(monthTerm) - 1, parseInt(dayTerm));
        fechaTermino.setDate(fechaTermino.getDate() - 30);
        datosConCliente.fecha_aviso_renovacion = fechaTermino.toISOString().split('T')[0];
        console.log('✅ Fecha aviso renovación calculada:', datosConCliente.fecha_aviso_renovacion, `(${datosConCliente.termino_vigencia} - 30 días)`);
      }
      
      // ================== PERÍODO DE GRACIA ==================
      // Si NO viene del PDF (no se pudo extraer), usar valores sugeridos por aseguradora
      if (!datosConCliente.periodo_gracia) {
        const aseguradora = (datosConCliente.compania || '').toLowerCase();
        if (aseguradora.includes('qualitas')) {
          datosConCliente.periodo_gracia = 14; // Qualitas: 14 días por defecto cuando NO se extrae del PDF
        } else if (aseguradora) {
          datosConCliente.periodo_gracia = 30; // Otras: 30 días
        }
        console.log('📆 Período de gracia sugerido (no extraído del PDF):', datosConCliente.periodo_gracia, 'días');
      } else {
        console.log('✅ Período de gracia extraído del PDF:', datosConCliente.periodo_gracia, 'días');
      }
      
      // ================== ESTATUS DE PAGO INICIAL ==================
      // Calcular el estatus de pago basado en la fecha_vencimiento_pago (ya calculada arriba)
      if (datosConCliente.fecha_vencimiento_pago) {
        const [yearVenc, monthVenc, dayVenc] = datosConCliente.fecha_vencimiento_pago.split('-');
        const fechaVencimiento = new Date(parseInt(yearVenc), parseInt(monthVenc) - 1, parseInt(dayVenc));
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaVencimiento.setHours(0, 0, 0, 0);
        
        const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes < 0) {
          datosConCliente.estatusPago = 'Vencido';
          datosConCliente.estatus_pago = 'Vencido';
        } else if (diasRestantes <= 15) {
          datosConCliente.estatusPago = 'Por Vencer';
          datosConCliente.estatus_pago = 'Por Vencer';
        } else {
          datosConCliente.estatusPago = 'Pendiente';
          datosConCliente.estatus_pago = 'Pendiente';
        }
        console.log('💳 Estatus de pago calculado:', datosConCliente.estatusPago, '(días restantes:', diasRestantes, ')');
      } else {
        // Si no hay fecha de vencimiento, el pago está pendiente
        datosConCliente.estatusPago = 'Pendiente';
        datosConCliente.estatus_pago = 'Pendiente';
        console.log('💳 Estatus de pago por defecto: Pendiente (sin fecha de vencimiento)');
      }
      
      // ✨ Agregar bandera para identificar que fue capturado con extractor PDF
      datosConCliente._capturado_con_extractor_pdf = true;
      datosConCliente._nombre_archivo_pdf = archivo?.name || informacionArchivo?.nombre || 'PDF importado';
      
      // 🔍 Guardar "huella digital" de los datos originales del PDF para detectar cambios manuales
      datosConCliente._datos_originales_pdf = {
        numero_poliza: datosConCliente.numero_poliza,
        compania: datosConCliente.compania,
        producto: datosConCliente.producto,
        cliente_id: datosConCliente.cliente_id,
        prima_pagada: datosConCliente.prima_pagada,
        total: datosConCliente.total,
        fecha_emision: datosConCliente.fecha_emision,
        inicio_vigencia: datosConCliente.inicio_vigencia,
        termino_vigencia: datosConCliente.termino_vigencia,
        etapa_activa: datosConCliente.etapa_activa,
        tipo_pago: datosConCliente.tipo_pago,
        agente: datosConCliente.agente
      };
      
      // Aplicando al formulario
      onDataExtracted(datosConCliente);
      onClose();
    }
  }, [datosExtraidos, clienteEncontrado, onDataExtracted, onClose, archivo, informacionArchivo]);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <div className="modal-content" style={{ maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header py-2 px-3">
            <small className="modal-title mb-0 fw-semibold" style={{ fontSize: '0.85rem' }}>
              <FileText className="me-1" size={14} />
              Extractor Inteligente de Pólizas PDF
            </small>
            <button 
              type="button" 
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          
          {/* Input file oculto que se activa automáticamente */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          
          <div className="modal-body p-3" style={{ overflowY: 'auto', flex: 1 }}>
            {/* SELECCIÓN DE MÉTODO DE EXTRACCIÓN */}
            {estado === 'seleccionando-metodo' && (
              <div className="py-2">
                <div className="text-center mb-3">
                  <h6 className="mb-1">Extractor Automático de Pólizas</h6>
                  <p className="text-muted small mb-0" style={{ fontSize: '0.75rem' }}>
                    Elige cómo quieres procesar el PDF
                  </p>
                </div>
                
                <div className="row g-3 justify-content-center">
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary cursor-pointer shadow-sm" 
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setMetodoExtraccion('auto');
                        setEstado('esperando');
                      }}
                    >
                      <div className="card-body text-center p-4">
                        <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" 
                             style={{ width: '70px', height: '70px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                            <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                            <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                          </svg>
                        </div>
                        <h5 className="card-title mb-3">Extractor Automático</h5>
                        <p className="card-text text-muted mb-4">
                          Extrae datos de pólizas de forma instantánea usando patrones específicos para cada aseguradora.
                        </p>
                        <div className="d-flex justify-content-center gap-2 flex-wrap mb-3">
                          <span className="badge bg-success">✓ Gratis</span>
                          <span className="badge bg-success">⚡ Instantáneo</span>
                          <span className="badge bg-success">🎯 Preciso</span>
                        </div>
                        <div className="text-muted mt-3" style={{ fontSize: '0.9rem' }}>
                          <strong>Aseguradoras disponibles:</strong><br/>
                          <small>Qualitas • Chubb</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div
                      className="card h-100 border-success cursor-pointer shadow-sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setMetodoExtraccion('openai');
                        setEstado('esperando');
                      }}
                    >
                      <div className="card-body text-center p-4">
                        <div className="bg-success text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                             style={{ width: '70px', height: '70px', fontSize: '1.5rem' }}>
                          🤖
                        </div>
                        <h5 className="card-title mb-3">Leer PDF con IA</h5>
                        <p className="card-text text-muted mb-4">
                          Útil cuando cambia el formato del PDF o no existe extractor específico.
                        </p>
                        <div className="d-flex justify-content-center gap-2 flex-wrap mb-3">
                          <span className="badge bg-info text-dark">🧠 Flexible</span>
                          <span className="badge bg-warning text-dark">⚠️ Requiere API key</span>
                        </div>
                        <div className="text-muted mt-3" style={{ fontSize: '0.9rem' }}>
                          <small>Modo beta para pruebas del equipo</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mt-4">
                  <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            
            {estado === 'esperando' && (
              <div className="text-center py-5">
                <div className="mb-3">
                  <FileText size={48} className="text-muted" />
                </div>
                <p className="mb-2 fw-semibold">Esperando archivo PDF...</p>
                <small className="text-muted">
                  Método: {metodoExtraccion === 'openai' ? 'Leer PDF con IA' : 'Extractor Automático'}
                </small>
                <div className="mt-3">
                  <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Seleccionar PDF
                  </button>
                </div>
              </div>
            )}
            
            {estado === 'procesando' && (
              <div className="text-center py-3">
                <div className="spinner-border text-primary mb-2" role="status" style={{ width: '2rem', height: '2rem' }}>
                  <span className="visually-hidden">Procesando...</span>
                </div>
                <p className="mb-1 fw-semibold">Procesando PDF...</p>
                <small className="text-muted">Extrayendo información de la póliza</small>
              </div>
            )}

            {/* PASO 1: VALIDACIÓN DE CLIENTE */}
            {estado === 'validando-cliente' && datosExtraidos && (
              <div className="py-1">
                <div className="text-center mb-2">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px', fontSize: '0.7rem' }}>
                    <strong>1/3</strong>
                  </div>
                  <small className="d-block mt-1 fw-semibold" style={{ fontSize: '0.75rem' }}>Validación de Cliente</small>
                </div>

                <div className="card mb-2">
                  <div className="card-header bg-light py-1 px-2">
                    <small className="mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>👤 Datos del Cliente Extraídos</small>
                  </div>
                  <div className="card-body p-2">
                    <div className="row g-1">
                      {/* COLUMNA IZQUIERDA: Nombre y RFC */}
                      <div className="col-md-6 col-12">
                        {/* Nombre/Razón Social */}
                        <div className="mb-1">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social/Empresa:' : 'Nombre Completo:'}
                          </small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.tipo_persona === 'Moral' 
                              ? (datosExtraidos.razonSocial || <span className="text-muted">No encontrado</span>)
                              : (`${datosExtraidos.nombre || ''} ${datosExtraidos.apellido_paterno || ''} ${datosExtraidos.apellido_materno || ''}`.trim() || <span className="text-muted">No encontrado</span>)
                            }
                          </small>
                        </div>
                        
                        {/* RFC */}
                        <div>
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>RFC:</small>
                          {datosExtraidos.rfc ? (
                            <small className="mb-0" style={{ fontSize: '0.7rem' }}>{datosExtraidos.rfc}</small>
                          ) : (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.6rem' }}>
                              <i className="bi bi-exclamation-triangle me-1"></i>No encontrado
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUMNA DERECHA: Dirección y Ciudad/Estado */}
                      <div className="col-md-6 col-12">
                        {/* Dirección */}
                        <div className="mb-1">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Dirección:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.domicilio || <span className="text-muted">No encontrada</span>}
                          </small>
                        </div>
                        
                        {/* Ciudad/Estado */}
                        <div>
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Ciudad/Estado:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                            {(datosExtraidos.municipio || datosExtraidos.estado) 
                              ? [datosExtraidos.municipio, datosExtraidos.estado].filter(Boolean).join(', ')
                              : <span className="text-muted">No encontrado</span>
                            }
                          </small>
                        </div>
                      </div>
                      
                      {/* Email - SOLO si cliente existe en BD */}
                      {clienteEncontrado && datosExtraidos.email && (
                        <div className="col-md-6 col-12">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>Email:</small>
                          <small className="mb-0" style={{ fontSize: '0.7rem' }}>{datosExtraidos.email}</small>
                        </div>
                      )}
                      
                      {/* Teléfono - SOLO si cliente existe en BD */}
                      {clienteEncontrado && datosExtraidos.telefono_movil && (
                        <div className="col-md-3">
                          <small className="d-block mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>Teléfono:</small>
                          <small className="mb-0" style={{ fontSize: '0.75rem' }}>{datosExtraidos.telefono_movil}</small>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {clienteEncontrado ? (
                  <div className="alert alert-success py-1 px-2 mb-2">
                    <div className="d-flex align-items-center">
                      <CheckCircle className="me-2" size={16} />
                      <small className="mb-0 fw-semibold" style={{ fontSize: '0.75rem' }}>✅ Cliente ENCONTRADO en base de datos</small>
                    </div>
                    
                    <div className="card border-success mt-1">
                      <div className="card-body p-2">
                        <div className="row g-1">
                          {/* FILA 1: ID Cliente, Fecha Registro, Nombre Completo */}
                          <div className="col-md-2 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>ID</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.codigo || clienteEncontrado.id}</small>
                          </div>
                          
                          <div className="col-md-2 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Registro</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.created_at ? new Date(clienteEncontrado.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}</small>
                          </div>

                          <div className="col-md-4 col-4">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                              {clienteEncontrado.tipoPersona === 'Persona Moral' 
                                ? (clienteEncontrado.razonSocial || clienteEncontrado.nombre || 'N/A')
                                : `${clienteEncontrado.nombre || ''} ${clienteEncontrado.apellido_paterno || clienteEncontrado.apellidoPaterno || ''}`.trim()
                              }
                            </small>
                          </div>

                          {/* RFC */}
                          {clienteEncontrado.rfc && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>RFC</small>
                              <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{clienteEncontrado.rfc}</small>
                            </div>
                          )}
                          
                          {/* Email */}
                          {clienteEncontrado.email && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Email</small>
                              <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={clienteEncontrado.email}>{clienteEncontrado.email}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <hr className="my-1" />
                      <small className="mb-1 fw-semibold d-block" style={{ fontSize: '0.75rem' }}>¿Qué deseas hacer?</small>
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-success btn-sm flex-fill py-1"
                          onClick={() => handleDecisionCliente('usar-existente')}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <CheckCircle className="me-1" size={14} />
                          Usar Cliente Existente
                        </button>
                        <button 
                          className="btn btn-outline-primary btn-sm flex-fill py-1"
                          onClick={() => handleDecisionCliente('crear-nuevo')}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Crear Cliente Nuevo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-1 px-2">
                    <div className="d-flex align-items-center mb-1">
                      <AlertCircle className="me-2" size={18} />
                      <small className="fw-semibold" style={{ fontSize: '0.75rem' }}>⚠️ Cliente NO encontrado en base de datos</small>
                    </div>
                    <small className="mb-2 d-block" style={{ fontSize: '0.7rem' }}>Se creará un nuevo cliente con los datos extraídos del PDF.</small>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary btn-sm flex-fill py-1"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
                        style={{ fontSize: '0.75rem' }}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Crear Cliente y Continuar
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={onClose}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 2: VALIDACIÓN DE AGENTE */}
            {estado === 'validando-agente' && datosExtraidos && (
              <div className="py-2">
                <div className="text-center mb-2">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px', fontSize: '0.75rem' }}>
                    <strong>2/3</strong>
                  </div>
                  <h6 className="mt-2 mb-0" style={{ fontSize: '0.9rem' }}>Validación de Agente</h6>
                </div>

                {datosExtraidos.agente ? (
                  <div className="card mb-2">
                    <div className="card-header bg-light py-1 px-2">
                      <small className="mb-0 fw-semibold" style={{ fontSize: '0.7rem' }}>👔 Agente Extraído del PDF</small>
                    </div>
                    <div className="card-body p-2">
                      <div className="row g-1">
                        <div className="col-md-3 col-6">
                          <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Clave Agente</small>
                          <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.clave_agente || <span className="text-muted">No encontrado</span>}
                          </small>
                        </div>
                        <div className="col-md-9 col-6">
                          <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre del Agente</small>
                          <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>
                            {datosExtraidos.agente}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info mb-2 py-1 px-2">
                    <small style={{ fontSize: '0.7rem' }}>
                      <AlertCircle className="me-1" size={14} />
                      No se pudo extraer información del agente del PDF
                    </small>
                  </div>
                )}

                {agenteEncontrado ? (
                  <div className="alert alert-success py-2 px-2">
                    <div className="d-flex align-items-center mb-2">
                      <CheckCircle className="me-1" size={16} />
                      <strong style={{ fontSize: '0.8rem' }}>✅ Agente ENCONTRADO en Equipo de Trabajo</strong>
                    </div>
                    
                    {claveYaExiste && (
                      <div className="alert alert-info mb-2 py-1 px-2">
                        <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                          <strong>ℹ️ Este agente ya tiene la clave {datosExtraidos.clave_agente} registrada para esta aseguradora.</strong>
                          {' '}La póliza se vinculará al agente existente sin crear duplicados.
                        </small>
                      </div>
                    )}
                    
                    {!claveYaExiste && (
                      <div className="alert alert-warning mb-2 py-1 px-2">
                        <small className="mb-0" style={{ fontSize: '0.7rem' }}>
                          <strong>📋 Se agregará la nueva clave {datosExtraidos.clave_agente} a este agente.</strong>
                          {' '}El agente existe pero no tiene esta clave registrada para esta aseguradora.
                        </small>
                      </div>
                    )}
                    
                    <div className="card border-success">
                      <div className="card-body p-2">
                        <small className="card-subtitle mb-1 d-block text-success fw-semibold" style={{ fontSize: '0.7rem' }}>Datos en Equipo de Trabajo</small>
                        
                        <div className="row g-1">
                          <div className="col-md-2 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Código</small>
                            <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{agenteEncontrado.codigo || agenteEncontrado.codigoAgente}</small>
                          </div>
                          
                          <div className="col-md-4 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Nombre</small>
                            <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={agenteEncontrado.nombre}>{agenteEncontrado.nombre}</small>
                          </div>

                          {agenteEncontrado.email && (
                            <div className="col-md-3 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Email</small>
                              <small className="fw-semibold text-truncate d-block" style={{ fontSize: '0.7rem' }} title={agenteEncontrado.email}>{agenteEncontrado.email}</small>
                            </div>
                          )}

                          {agenteEncontrado.telefono && (
                            <div className="col-md-2 col-6">
                              <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Teléfono</small>
                              <small className="fw-semibold" style={{ fontSize: '0.7rem' }}>{agenteEncontrado.telefono}</small>
                            </div>
                          )}

                          <div className="col-md-1 col-6">
                            <small className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Estado</small>
                            <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>Activo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-1" />
                    <small className="d-block mb-1 fw-semibold" style={{ fontSize: '0.7rem' }}>¿Qué deseas hacer?</small>
                    <div className="d-flex gap-1">
                      <button 
                        className="btn btn-success btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('usar-existente')}
                      >
                        <CheckCircle className="me-1" size={14} />
                        Usar Este Agente
                      </button>
                      <button 
                        className="btn btn-outline-primary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Seleccionar Después
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning py-2 px-2">
                    <div className="d-flex align-items-center mb-1">
                      <AlertCircle className="me-1" size={16} />
                      <strong style={{ fontSize: '0.8rem' }}>⚠️ Agente NO encontrado en Equipo de Trabajo</strong>
                    </div>
                    <small className="d-block mb-2" style={{ fontSize: '0.7rem' }}>
                      El agente con código <strong>{datosExtraidos.agente?.match(/^(\d+)/)?.[1] || 'N/A'}</strong> no está registrado.
                    </small>
                    <div className="d-flex gap-1">
                      <button 
                        className="btn btn-primary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        <CheckCircle className="me-1" size={14} />
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm flex-fill py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Continuar sin Agente
                      </button>
                      <button 
                        className="btn btn-outline-secondary btn-sm py-1"
                        style={{ fontSize: '0.75rem' }}
                        onClick={onClose}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PASO 3: PREVIEW DE TODOS LOS DATOS */}
            {estado === 'preview-datos' && datosExtraidos && (
              <div>
                <div className="alert alert-success mb-2 py-1 px-2">
                  <CheckCircle className="me-1" size={16} />
                  <strong style={{ fontSize: '0.8rem' }}>¡Extracción completada!</strong>
                </div>

                {informacionArchivo && (
                  <div className="card mb-2">
                    <div className="card-body py-1 px-2">
                      <small style={{ fontSize: '0.7rem' }}>
                        <strong>Archivo:</strong> {informacionArchivo.nombre} ({informacionArchivo.tamaño})
                      </small>
                    </div>
                  </div>
                )}

                {errores.length > 0 && (
                  <div className="alert alert-info mb-2 py-1 px-2">
                    <small className="fw-semibold d-block mb-1" style={{ fontSize: '0.7rem' }}>📊 Reporte de Extracción:</small>
                    {errores.map((error, idx) => (
                      <small key={idx} className="d-block" style={{ fontSize: '0.65rem' }}>{error}</small>
                    ))}
                  </div>
                )}

                <div className="card">
                  <div className="card-header bg-primary text-white py-1 px-2">
                    <small className="mb-0 fw-semibold" style={{ fontSize: '0.8rem' }}>🎯 Datos Extraídos del PDF</small>
                  </div>
                  <div className="card-body" style={{ padding: '0.25rem' }}>
                    {/* Usar únicamente el componente DetalleExpediente unificado */}
                    <DetalleExpediente
                      datos={datosExtraidos}
                      coberturas={datosExtraidos.coberturas || []}
                      mensajes={datosExtraidos.mensajes || []}
                      utils={utils}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* MODAL DE CAPTURA RFC */}
            {estado === 'capturando-rfc' && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-warning text-dark rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px', fontSize: '28px' }}>
                    ⚠️
                  </div>
                  <h5 className="mt-3 mb-2">RFC no encontrado en el PDF</h5>
                  <p className="text-muted">Seleccione el tipo de persona o capture el RFC manualmente</p>
                </div>

                <div className="row g-3 mb-4">
                  {/* Opción Persona Física */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-primary text-center p-4" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalRFC(false);
                        handleSeleccionRFC('fisica');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,110,253,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          👤
                        </div>
                        <h5 className="card-title text-primary mb-2">Persona Física</h5>
                        <p className="card-text text-muted small mb-3">
                          Se asignará un RFC genérico de 13 caracteres
                        </p>
                        <button 
                          className="btn btn-primary w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('fisica');
                          }}
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Opción Persona Moral */}
                  <div className="col-md-6">
                    <div 
                      className="card h-100 border-success text-center p-4" 
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => {
                        setMostrarModalRFC(false);
                        handleSeleccionRFC('moral');
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,135,84,0.3)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div className="card-body">
                        <div className="mb-3" style={{ fontSize: '48px' }}>
                          🏢
                        </div>
                        <h5 className="card-title text-success mb-2">Persona Moral</h5>
                        <p className="card-text text-muted small mb-3">
                          Se asignará un RFC genérico de 12 caracteres
                        </p>
                        <button 
                          className="btn btn-success w-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('moral');
                          }}
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opción Captura Manual */}
                <div className="card border-info">
                  <div className="card-header bg-info bg-opacity-10 text-center">
                    <h6 className="mb-0 text-info">
                      ✍️ O capture el RFC manualmente si lo conoce
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3 align-items-end">
                      <div className="col-md-8">
                        <label className="form-label small text-muted">RFC (12 o 13 caracteres)</label>
                        <input
                          type="text"
                          className="form-control form-control-lg text-uppercase"
                          placeholder="Ejemplo: XAXX010101000"
                          value={rfcCapturado}
                          onChange={(e) => setRfcCapturado(e.target.value.toUpperCase())}
                          maxLength={13}
                          style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                        />
                        <small className="form-text text-muted">
                          {rfcCapturado.length > 0 && (
                            <span>
                              Longitud actual: <strong>{rfcCapturado.length}</strong> caracteres
                              {rfcCapturado.length === 12 && <span className="text-success ms-2">✓ Persona Moral</span>}
                              {rfcCapturado.length === 13 && <span className="text-primary ms-2">✓ Persona Física</span>}
                              {rfcCapturado.length > 0 && rfcCapturado.length !== 12 && rfcCapturado.length !== 13 && (
                                <span className="text-warning ms-2">⚠ Debe ser 12 o 13 caracteres</span>
                              )}
                            </span>
                          )}
                        </small>
                      </div>
                      <div className="col-md-4">
                        <button
                          className="btn btn-info w-100 btn-lg"
                          disabled={!rfcCapturado || (rfcCapturado.length !== 12 && rfcCapturado.length !== 13)}
                          onClick={() => {
                            setMostrarModalRFC(false);
                            handleSeleccionRFC('capturar', rfcCapturado);
                          }}
                        >
                          Continuar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="alert alert-info mt-4 mb-0">
                  <small>
                    <strong>ℹ️ Nota:</strong> Los RFC genéricos son identificadores temporales válidos. 
                    Podrá editar el RFC correcto después de crear el expediente.
                  </small>
                </div>
              </div>
            )}

            {estado === 'error' && (
              <div className="text-center py-5">
                <XCircle size={48} className="text-danger mb-3" />
                <h6 className="mb-3 text-danger">Error al procesar el archivo</h6>
                <div className="alert alert-danger text-start">
                  {errores.map((error, idx) => (
                    <div key={idx}>
                      <strong>{error.mensaje}</strong>
                      {error.detalle && (
                        <div className="small text-muted mt-1">{error.detalle}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button 
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    setEstado('seleccionando-metodo');
                    setErrores([]);
                    setMetodoExtraccion(null);
                  }}
                >
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            {estado === 'preview-datos' && datosExtraidos && (
              <button
                type="button"
                className="btn btn-success"
                onClick={aplicarDatos}
              >
                <CheckCircle className="me-2" size={16} />
                Aplicar al Formulario
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ExtractorPolizasPDF;



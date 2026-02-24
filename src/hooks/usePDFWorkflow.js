/**
 * Hook usePDFWorkflow
 * Orquesta el flujo completo de extracción de datos desde PDF:
 * 1. Procesar PDF → extraer texto
 * 2. Detectar aseguradora
 * 3. Cargar extractor específico
 * 4. Validar/crear cliente
 * 5. Validar/crear agente
 */

import { useState, useCallback } from 'react';
import { extraerTextoDePDF } from '../services/pdfService';
import { detectarAseguradoraYProducto } from '../lib/pdf/detectorLigero';
import { loadExtractor } from '../lib/pdf/extractors/registry';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

export function usePDFWorkflow({ agentes, aseguradoras, tiposProductos }) {
  const [estado, setEstado] = useState('idle'); // idle, processing, validating-client, validating-agent, complete, error
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [agenteEncontrado, setAgenteEncontrado] = useState(null);
  const [claveYaExiste, setClaveYaExiste] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Busca un cliente existente por RFC, CURP o nombre
   */
  const buscarClienteExistente = useCallback(async (rfc, curp, nombre, apellidoPaterno, apellidoMaterno) => {
    try {
      const response = await fetch(`${API_URL}/api/clientes`);
      if (!response.ok) return null;
      
      const clientes = await response.json();
      
      // Buscar por RFC
      if (rfc && rfc.trim() !== '') {
        const rfcBusqueda = rfc.trim().toUpperCase();
        const clientePorRFC = clientes.find(c => 
          (c.rfc || '').trim().toUpperCase() === rfcBusqueda
        );
        if (clientePorRFC) return clientePorRFC;
      }
      
      // Buscar por CURP
      if (curp && curp.trim() !== '') {
        const curpBusqueda = curp.trim().toUpperCase();
        const clientePorCURP = clientes.find(c => 
          (c.curp || '').trim().toUpperCase() === curpBusqueda
        );
        if (clientePorCURP) return clientePorCURP;
      }
      
      // Buscar por nombre completo
      if (nombre && apellidoPaterno) {
        const nombreBusqueda = nombre.trim().toUpperCase();
        const apellidoPaternoBusqueda = apellidoPaterno.trim().toUpperCase();
        const apellidoMaternoBusqueda = apellidoMaterno ? apellidoMaterno.trim().toUpperCase() : '';
        
        const clientePorNombre = clientes.find(c => {
          const nombreCliente = (c.nombre || '').trim().toUpperCase();
          const apellidoPaternoCliente = (c.apellido_paterno || c.apellidoPaterno || '').trim().toUpperCase();
          const apellidoMaternoCliente = (c.apellido_materno || c.apellidoMaterno || '').trim().toUpperCase();
          
          return nombreCliente === nombreBusqueda && 
                 apellidoPaternoCliente === apellidoPaternoBusqueda &&
                 (!apellidoMaternoBusqueda || !apellidoMaternoCliente || apellidoMaternoCliente === apellidoMaternoBusqueda);
        });
        
        if (clientePorNombre) return clientePorNombre;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error buscando cliente:', error);
      return null;
    }
  }, []);

  /**
   * Busca un agente en el equipo de trabajo
   */
  const buscarAgenteEnEquipo = useCallback(async (claveAgente, nombreAgente) => {
    if (!nombreAgente || agentes.length === 0) return { agente: null, claveExiste: false };
    
    const nombreExtraido = nombreAgente.trim().toUpperCase();
    const agenteEncontrado = agentes.find(miembro => {
      if (miembro.perfil !== 'Agente' || !miembro.activo) return false;
      
      const nombreBD = (miembro.nombre || '').trim().toUpperCase();
      const nombreCompleto = `${miembro.nombre || ''} ${miembro.apellidoPaterno || miembro.apellido_paterno || ''} ${miembro.apellidoMaterno || miembro.apellido_materno || ''}`.trim().toUpperCase();
      
      return nombreBD === nombreExtraido || nombreCompleto === nombreExtraido;
    });
    
    if (!agenteEncontrado) return { agente: null, claveExiste: false };
    
    // Verificar si ya tiene esta clave
    let claveExiste = false;
    if (claveAgente) {
      try {
        const { obtenerEjecutivosPorProducto } = await import('../services/equipoDeTrabajoService');
        const asignacionesResult = await obtenerEjecutivosPorProducto(agenteEncontrado.id);
        
        if (asignacionesResult.success && asignacionesResult.data) {
          claveExiste = asignacionesResult.data.some(asig => 
            String(asig.clave) === String(claveAgente)
          );
        }
      } catch (error) {
        console.error('Error al verificar claves del agente:', error);
      }
    }
    
    return { agente: agenteEncontrado, claveExiste };
  }, [agentes]);

  /**
   * Procesa un archivo PDF y extrae los datos
   */
  const procesarPDF = useCallback(async (file) => {
    setEstado('processing');
    setError(null);

    try {
      console.log('📄 Iniciando procesamiento de PDF...');
      
      // 1. Extraer texto del PDF
      const textos = await extraerTextoDePDF(file);
      console.log('✅ Texto extraído correctamente');
      
      // 2. Detectar aseguradora y producto
      const deteccion = detectarAseguradoraYProducto(textos.textoPagina1);
      console.log('🔍 Aseguradora detectada:', deteccion.aseguradora, '/', deteccion.producto);
      
      // 3. Cargar extractor específico
      const moduloExtractor = await loadExtractor(deteccion.aseguradora, deteccion.producto);

      if (!moduloExtractor || !moduloExtractor.extraer) {
        throw new Error(`No hay extractor disponible para ${deteccion.aseguradora} - ${deteccion.producto}. Selecciona "Leer PDF con IA".`);
      }

      // 4. Extraer datos con el extractor específico
      const datos = await moduloExtractor.extraer(textos);
      console.log('✅ Datos extraídos:', datos);
      
      // 5. Limpiar montos (quitar comas)
      const camposMontos = ['prima_pagada', 'otros_descuentos', 'cargo_pago_fraccionado', 'gastos_expedicion', 'iva', 'total', 'suma_asegurada'];
      camposMontos.forEach(campo => {
        if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== '') {
          datos[campo] = String(datos[campo]).replace(/,/g, '');
        } else {
          datos[campo] = '0.00';
        }
      });
      
      // 6. Buscar cliente existente
      const clienteExistente = await buscarClienteExistente(
        datos.rfc,
        datos.curp,
        datos.nombre,
        datos.apellido_paterno,
        datos.apellido_materno
      );
      
      // 7. Buscar agente en equipo
      const { agente: agenteExistente, claveExiste } = await buscarAgenteEnEquipo(
        datos.clave_agente,
        datos.agente
      );
      
      // 8. Preparar resultado
      const resultado = {
        ...datos,
        cliente_existente: clienteExistente,
        cliente_id: clienteExistente?.id || null,
        __pdfFile: file,
        __pdfNombre: file.name,
        __pdfSize: file.size
      };
      
      setDatosExtraidos(resultado);
      setClienteEncontrado(clienteExistente);
      setAgenteEncontrado(agenteExistente);
      setClaveYaExiste(claveExiste);
      setEstado('validating-client');
      
      console.log('✅ Procesamiento completado');
      console.log('  Cliente:', clienteExistente ? 'Encontrado' : 'Nuevo');
      console.log('  Agente:', agenteExistente ? 'Encontrado' : 'No encontrado');
      
      return resultado;
    } catch (err) {
      console.error('❌ Error al procesar PDF:', err);
      setError(err.message);
      setEstado('error');
      throw err;
    }
  }, [buscarClienteExistente, buscarAgenteEnEquipo]);

  /**
   * Crea un nuevo cliente con los datos extraídos
   */
  const crearCliente = useCallback(async (datosCliente) => {
    try {
      const { crearCliente: crearClienteService } = await import('../services/clientesService');
      const resultado = await crearClienteService(datosCliente);
      
      if (resultado.success && resultado.data) {
        // Normalizar campos snake_case a camelCase
        const clienteNormalizado = {
          ...resultado.data,
          razonSocial: resultado.data.razonSocial || resultado.data.razon_social || '',
          nombreComercial: resultado.data.nombreComercial || resultado.data.nombre_comercial || '',
          apellidoPaterno: resultado.data.apellidoPaterno || resultado.data.apellido_paterno || '',
          apellidoMaterno: resultado.data.apellidoMaterno || resultado.data.apellido_materno || '',
        };
        
        setClienteEncontrado(clienteNormalizado);
        console.log('✅ Cliente creado:', clienteNormalizado.id);
        return clienteNormalizado;
      }
      
      throw new Error(resultado.error || 'Error al crear cliente');
    } catch (error) {
      console.error('❌ Error al crear cliente:', error);
      throw error;
    }
  }, []);

  /**
   * Resetea el estado del workflow
   */
  const reset = useCallback(() => {
    setEstado('idle');
    setDatosExtraidos(null);
    setClienteEncontrado(null);
    setAgenteEncontrado(null);
    setClaveYaExiste(false);
    setError(null);
  }, []);

  return {
    // Estado
    estado,
    datosExtraidos,
    clienteEncontrado,
    agenteEncontrado,
    claveYaExiste,
    error,
    
    // Acciones
    procesarPDF,
    crearCliente,
    setEstado,
    reset
  };
}

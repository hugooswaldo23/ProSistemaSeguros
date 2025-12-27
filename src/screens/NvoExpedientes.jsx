/**
 * ====================================================================
 * MÓDULO: GESTIÓN DE EXPEDIENTES (VERSIÓN CON FORMULARIOS SEPARADOS)
 * ====================================================================
 * Versión con formularios separados:
 * - FormularioNuevoExpediente: Para agregar desde PDF (sin snapshot)
 * - FormularioEditarExpediente: Para editar (con snapshot para logs)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import FormularioNuevoExpediente from '../components/expedientes/FormularioNuevoExpediente';
import FormularioEditarExpediente from '../components/expedientes/FormularioEditarExpediente';
import ListaExpedientes from '../components/expedientes/ListaExpedientes';

const API_URL = import.meta.env.VITE_API_URL;

// Estado inicial del formulario
const estadoInicialFormulario = {
  id: null,
  cliente_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  razon_social: '',
  nombre_comercial: '',
  rfc: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  compania: '',
  producto: '',
  etapa_activa: 'Captura',
  agente: '',
  sub_agente: '',
  numero_poliza: '',
  numero_endoso: '',
  inicio_vigencia: '',
  termino_vigencia: '',
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_captura: new Date().toISOString().split('T')[0],
  prima_neta: '',
  cargo_pago_fraccionado: '',
  gastos_expedicion: '',
  iva: '',
  subtotal: '',
  total: '',
  tipo_pago: 'Anual',
  frecuenciaPago: 'Anual',
  periodo_gracia: 14,
  fecha_vencimiento_pago: '',
  estatusPago: 'Pendiente',
  marca: '',
  modelo: '',
  anio: '',
  numero_serie: '',
  placas: '',
  color: '',
  tipo_vehiculo: '',
  tipo_cobertura: '',
  suma_asegurada: '',
  conductor_habitual: '',
  edad_conductor: '',
  licencia_conducir: '',
  coberturas: [],
  recibos: []
};

const ModuloNvoExpedientes = () => {
  // Estados
  const [vistaActual, setVistaActual] = useState('lista');
  const [modoEdicion, setModoEdicion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // Datos
  const [expedientes, setExpedientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [agentes, setAgentes] = useState([]);
  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  
  // Formulario
  const [formulario, setFormulario] = useState(estadoInicialFormulario);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  // Carga inicial
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      const [expRes, clientesRes, agentesRes, asegRes] = await Promise.all([
        fetch(`${API_URL}/api/expedientes`),
        fetch(`${API_URL}/api/clientes`),
        fetch(`${API_URL}/api/equipoDeTrabajo`),
        fetch(`${API_URL}/api/aseguradoras`)
      ]);

      const expedientesData = await expRes.json();
      const clientesData = await clientesRes.json();
      const agentesData = await agentesRes.json();
      const aseguradorasData = await asegRes.json();

      const mapa = {};
      clientesData.forEach(cliente => {
        mapa[cliente.id] = cliente;
      });

      // Normalizar expedientes desde backend: sincronizar ambos formatos
      const expedientesNormalizados = expedientesData.map(exp => ({
        ...exp,
        estatusPago: exp.estatusPago || exp.estatus_pago || 'Pendiente',
        estatus_pago: exp.estatus_pago || exp.estatusPago || 'Pendiente',
        fecha_vencimiento_pago: exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago || '',
        proximoPago: exp.proximoPago || exp.fecha_vencimiento_pago || exp.fecha_pago || '',
        fecha_pago: exp.fecha_pago || exp.fecha_vencimiento_pago || exp.proximoPago || ''
      }));

      // Debug: ver un expediente completo del backend
      if (expedientesNormalizados.length > 0) {
        console.log('🔍 Primer expediente desde backend:', expedientesNormalizados[0]);
      }

      setExpedientes(expedientesNormalizados);
      setClientes(clientesData);
      setClientesMap(mapa);
      setAgentes(agentesData);
      setAseguradoras(aseguradorasData);
      setTiposProductos(['Automóvil', 'Moto', 'Camión', 'Hogar', 'Empresa', 'GMM', 'Vida']); // Productos estáticos por ahora

      console.log('✅ Datos iniciales cargados');
    } catch (error) {
      console.error('❌ Error al cargar datos iniciales:', error);
      toast.error('Error al cargar datos');
    }
  };

  const recargarExpedientes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/expedientes?t=${Date.now()}`);
      const data = await response.json();
      
      // Normalizar datos del backend: sincronizar ambos formatos de campos
      const datosNormalizados = data.map(exp => ({
        ...exp,
        // Sincronizar estatus_pago ↔ estatusPago
        estatusPago: exp.estatusPago || exp.estatus_pago || 'Pendiente',
        estatus_pago: exp.estatus_pago || exp.estatusPago || 'Pendiente',
        // Sincronizar fecha_vencimiento_pago ↔ proximoPago ↔ fecha_pago
        fecha_vencimiento_pago: exp.fecha_vencimiento_pago || exp.proximoPago || exp.fecha_pago || '',
        proximoPago: exp.proximoPago || exp.fecha_vencimiento_pago || exp.fecha_pago || '',
        fecha_pago: exp.fecha_pago || exp.fecha_vencimiento_pago || exp.proximoPago || ''
      }));
      
      console.log('✅ Expedientes normalizados desde backend:', datosNormalizados.length);
      setExpedientes(datosNormalizados);
    } catch (error) {
      console.error('Error al recargar expedientes:', error);
    }
  };

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setClienteSeleccionado(null);
    setModoEdicion(false);
  }, []);

  const validarFormulario = useCallback(() => {
    if (!formulario.numero_poliza) {
      toast.error('El número de póliza es obligatorio');
      return false;
    }
    if (!formulario.cliente_id) {
      toast.error('Debe seleccionar un cliente');
      return false;
    }
    if (!formulario.compania) {
      toast.error('La compañía es obligatoria');
      return false;
    }
    return true;
  }, [formulario]);

  const guardarExpediente = useCallback(async () => {
    if (!validarFormulario()) {
      return;
    }

    setGuardando(true);

    try {
      const datos = { ...formulario };
      
      // Limpiar campos temporales y bandera
      delete datos._fechaManual;
      delete datos._datos_desde_pdf;
      delete datos._inicio_vigencia_changed;
      delete datos.cliente;
      delete datos.historial;

      // Serializar coberturas
      if (datos.coberturas && Array.isArray(datos.coberturas)) {
        datos.coberturas = JSON.stringify(datos.coberturas);
      }

      // 🔥 IMPORTANTE: Guardar estatus y fechas en AMBOS formatos (camelCase y snake_case)
      // para que el backend y frontend siempre estén sincronizados
      
      // 1. Sincronizar estatusPago
      if (datos.estatusPago) {
        datos.estatus_pago = datos.estatusPago;
      }
      if (datos.estatus_pago) {
        datos.estatusPago = datos.estatus_pago;
      }
      
      // 2. Sincronizar fecha_vencimiento_pago (fecha límite para pagar)
      if (datos.fecha_vencimiento_pago) {
        datos.proximoPago = datos.fecha_vencimiento_pago;
      } else if (datos.proximoPago) {
        datos.fecha_vencimiento_pago = datos.proximoPago;
      }
      
      // 3. ⚠️ fecha_pago solo se envía si está PAGADO (es la fecha REAL del pago)
      const estaPagado = (datos.estatusPago || datos.estatus_pago || '').toLowerCase() === 'pagado';
      if (!estaPagado) {
        // Si NO está pagado, NO enviar fecha_pago
        delete datos.fecha_pago;
      } else if (datos.fecha_vencimiento_pago && !datos.fecha_pago) {
        // Si está pagado pero no tiene fecha_pago, usar fecha_vencimiento_pago
        datos.fecha_pago = datos.fecha_vencimiento_pago;
      }

      // 3. Para pagos fraccionados: guardar recibos si existen
      // (NO eliminar recibos si ya fueron calculados en el frontend)
      if (!datos.recibos || datos.recibos.length === 0) {
        // Si no hay recibos, eliminar el campo para que el backend no lo procese
        delete datos.recibos;
      }

      console.log('💾 DATOS COMPLETOS que se enviarán al backend:', datos);
      console.log('📅 FECHAS específicas:', {
        inicio_vigencia: datos.inicio_vigencia,
        termino_vigencia: datos.termino_vigencia,
        fecha_vencimiento_pago: datos.fecha_vencimiento_pago,
        proximoPago: datos.proximoPago,
        fecha_pago: datos.fecha_pago,
        periodo_gracia: datos.periodo_gracia,
        estatus_pago: datos.estatus_pago,
        estatusPago: datos.estatusPago,
        recibos: datos.recibos?.length || 0
      });

      let response;
      if (modoEdicion) {
        response = await fetch(`${API_URL}/api/expedientes/${datos.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
      } else {
        datos.fecha_creacion = new Date().toISOString().split('T')[0];
        response = await fetch(`${API_URL}/api/expedientes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Error al guardar');
      }

      const resultado = await response.json();
      
      // 🔥 NO recargar desde backend (sobrescribe el estatus)
      // En su lugar, actualizar el estado local con los datos que guardamos
      if (modoEdicion) {
        // Actualizar expediente existente en el array
        setExpedientes(prev => prev.map(exp => 
          exp.id === datos.id ? { ...exp, ...datos } : exp
        ));
      } else {
        // Agregar nuevo expediente con el ID del backend
        const nuevoExpediente = { ...datos, id: resultado.id || resultado.data?.id };
        setExpedientes(prev => [nuevoExpediente, ...prev]);
      }
      
      toast.success(`✅ Expediente ${modoEdicion ? 'actualizado' : 'creado'} correctamente`);
      limpiarFormulario();
      setVistaActual('lista');
      setGuardando(false);
      
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      toast.error('Error al guardar: ' + error.message);
      setGuardando(false);
    }
  }, [formulario, modoEdicion, validarFormulario, limpiarFormulario]);

  const abrirNuevoExpediente = useCallback(() => {
    limpiarFormulario();
    setModoEdicion(false);
    setVistaActual('formulario');
  }, [limpiarFormulario]);

  const editarExpediente = useCallback(async (expediente) => {
    try {
      const response = await fetch(`${API_URL}/api/expedientes/${expediente.id}`);
      if (!response.ok) throw new Error('Error al cargar expediente');
      
      const data = await response.json();
      const expedienteCompleto = data?.data ?? data;

      let clienteEncontrado = null;
      if (expedienteCompleto.cliente_id) {
        clienteEncontrado = clientesMap[expedienteCompleto.cliente_id];
      }

      const datosFormulario = {
        ...expedienteCompleto,
        coberturas: expedienteCompleto.coberturas || []
      };

      setFormulario(datosFormulario);
      setClienteSeleccionado(clienteEncontrado);
      setModoEdicion(true);
      setVistaActual('formulario');
      
    } catch (error) {
      console.error('Error al editar expediente:', error);
      toast.error('Error al cargar expediente');
    }
  }, [clientesMap]);

  const eliminarExpediente = useCallback(async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este expediente?')) return;

    try {
      const response = await fetch(`${API_URL}/api/expedientes/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar');

      toast.success('Expediente eliminado correctamente');
      await recargarExpedientes();
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar expediente');
    }
  }, []);

  const handleClienteSeleccionado = useCallback((cliente) => {
    if (!cliente) {
      setClienteSeleccionado(null);
      setFormulario(prev => ({
        ...prev,
        cliente_id: null,
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        razon_social: '',
        nombre_comercial: '',
        rfc: '',
        email: '',
        telefono_fijo: '',
        telefono_movil: ''
      }));
      return;
    }

    setClienteSeleccionado(cliente);
    
    const datosCliente = {
      cliente_id: cliente.id,
      nombre: cliente.nombre || '',
      apellido_paterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
      apellido_materno: cliente.apellidoMaterno || cliente.apellido_materno || '',
      razon_social: cliente.razonSocial || cliente.razon_social || '',
      nombre_comercial: cliente.nombreComercial || cliente.nombre_comercial || '',
      rfc: cliente.rfc || '',
      email: cliente.email || '',
      telefono_fijo: cliente.telefonoFijo || cliente.telefono_fijo || '',
      telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || ''
    };
    
    setFormulario(prev => ({ ...prev, ...datosCliente }));
  }, []);

  // ==================== FUNCIONES DE CÁLCULO ====================
  
  /**
   * Calcula el término de vigencia (mismo día, 1 año después)
   */
  const calculartermino_vigencia = useCallback((inicioVigencia) => {
    if (!inicioVigencia) return '';
    
    const fecha = new Date(inicioVigencia);
    fecha.setFullYear(fecha.getFullYear() + 1); // Sumar 1 año exacto
    return fecha.toISOString().split('T')[0];
  }, []);

  /**
   * Calcula el próximo pago según tipo de pago y frecuencia
   */
  const calcularProximoPago = useCallback((inicioVigencia, tipoPago, frecuencia, compania, numeroPago = 1, periodoGracia = 0) => {
    if (!inicioVigencia) return '';
    
    const fecha = new Date(inicioVigencia);
    
    // Para pago único/anual: inicio + periodo de gracia
    if (tipoPago === 'Anual' || tipoPago === 'Pago Único') {
      fecha.setDate(fecha.getDate() + periodoGracia);
      return fecha.toISOString().split('T')[0];
    }
    
    // Para fraccionado: calcular según frecuencia
    if (tipoPago === 'Fraccionado' && frecuencia) {
      const mesesPorPago = {
        'Mensual': 1,
        'Bimestral': 2,
        'Trimestral': 3,
        'Semestral': 6,
        'Anual': 12
      };
      
      const meses = mesesPorPago[frecuencia] || 1;
      fecha.setMonth(fecha.getMonth() + (meses * (numeroPago - 1)));
      
      // Solo al primer pago se le agrega el periodo de gracia
      if (numeroPago === 1) {
        fecha.setDate(fecha.getDate() + periodoGracia);
      }
      
      return fecha.toISOString().split('T')[0];
    }
    
    return '';
  }, []);

  /**
   * Actualiza todos los cálculos automáticos del formulario
   */
  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    // 1. Calcular término de vigencia (mismo día, 1 año después)
    const termino_vigencia = calculartermino_vigencia(formularioActual.inicio_vigencia);
    
    // 2. Calcular fecha de aviso de renovación (término - 30 días)
    let fecha_aviso_renovacion = '';
    if (termino_vigencia) {
      const fechaTermino = new Date(termino_vigencia);
      fechaTermino.setDate(fechaTermino.getDate() - 30);
      fecha_aviso_renovacion = fechaTermino.toISOString().split('T')[0];
    }
    
    // 3. Calcular fecha límite de pago (inicio + periodo de gracia)
    const periodoGracia = formularioActual.periodo_gracia || 0;
    let proximoPago = '';
    
    if (formularioActual.tipo_pago === 'Fraccionado') {
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        formularioActual.tipo_pago,
        formularioActual.frecuenciaPago,
        formularioActual.compania,
        1,
        periodoGracia
      );
    } else if (formularioActual.tipo_pago === 'Anual') {
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        'Anual',
        null,
        formularioActual.compania,
        1,
        periodoGracia
      );
    }
    
    // 4. Calcular estatus de pago basado en la fecha límite
    let estatusPago = 'Pendiente';
    if (proximoPago) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fechaLimite = new Date(proximoPago);
      fechaLimite.setHours(0, 0, 0, 0);
      
      const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) {
        estatusPago = 'Vencido';
      } else if (diasRestantes <= 15) {
        estatusPago = 'Por Vencer';
      } else {
        estatusPago = 'Pendiente';
      }
    }
    
    // 5. Si cambió inicio_vigencia, limpiar recibos para forzar recálculo
    let recibosActualizados = formularioActual.recibos;
    if (formularioActual._inicio_vigencia_changed) {
      recibosActualizados = undefined; // Forzar recálculo en CalendarioPagos
    }
    
    // Retornar formulario actualizado
    const resultado = {
      ...formularioActual,
      termino_vigencia,
      fecha_aviso_renovacion,
      proximoPago,
      // ⚠️ fecha_pago es la fecha REAL del pago (solo si está pagado)
      // NO confundir con fecha_vencimiento_pago que es la fecha límite
      // fecha_pago: solo se asigna cuando el usuario marca como pagado
      fecha_vencimiento_pago: proximoPago,
      estatusPago,
      recibos: recibosActualizados
    };
    
    // Limpiar bandera temporal
    delete resultado._inicio_vigencia_changed;
    
    return resultado;
  }, [calculartermino_vigencia, calcularProximoPago]);

  return (
    <div className="container-fluid py-3">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Gestión de Pólizas</h2>
        {vistaActual === 'lista' && (
          <button 
            className="btn btn-primary"
            onClick={abrirNuevoExpediente}
          >
            <Plus size={20} className="me-2" />
            Nueva Póliza (PDF)
          </button>
        )}
      </div>

      {/* VISTA LISTA */}
      {vistaActual === 'lista' && (
        <ListaExpedientes
          expedientes={expedientes}
          agentes={agentes}
          clientesMap={clientesMap}
          editarExpediente={editarExpediente}
          eliminarExpediente={eliminarExpediente}
          limpiarFormulario={limpiarFormulario}
          setVistaActual={setVistaActual}
          setModoEdicion={setModoEdicion}
          calcularProximoPago={calcularProximoPago}
        />
      )}

      {/* VISTA FORMULARIO: Modo AGREGAR */}
      {vistaActual === 'formulario' && !modoEdicion && (
        <FormularioNuevoExpediente
          setVistaActual={setVistaActual}
          formulario={formulario}
          setFormulario={setFormulario}
          actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
          guardarExpediente={guardarExpediente}
          companias={['HDI', 'Qualitas', 'GNP', 'AXA', 'Zurich']}
          productos={tiposProductos.map(p => p.nombre || p)}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
          etapasActivas={['Captura', 'Cotización', 'Emitida', 'Vigente', 'Cancelada', 'Renovada']}
          agentes={agentes}
          tiposPago={['Anual', 'Fraccionado', 'Pago Único']}
          frecuenciasPago={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']}
          periodosGracia={[0, 7, 14, 30]}
          estatusPago={['Pendiente', 'Por Vencer', 'Vencido', 'Pagado']}
          marcasVehiculo={['Nissan', 'Volkswagen', 'Chevrolet', 'Toyota', 'Honda', 'Mazda', 'Ford']}
          tiposVehiculo={['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Van']}
          tiposCobertura={['Amplia', 'Limitada', 'RC', 'Integral']}
          calculartermino_vigencia={calculartermino_vigencia}
          calcularProximoPago={calcularProximoPago}
          handleClienteSeleccionado={handleClienteSeleccionado}
          clienteSeleccionado={clienteSeleccionado}
          onEliminarPago={() => {}}
        />
      )}

      {/* VISTA FORMULARIO: Modo EDITAR */}
      {vistaActual === 'formulario' && modoEdicion && (
        <FormularioEditarExpediente
          setVistaActual={setVistaActual}
          formulario={formulario}
          setFormulario={setFormulario}
          actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
          guardarExpediente={guardarExpediente}
          companias={['HDI', 'Qualitas', 'GNP', 'AXA', 'Zurich']}
          productos={tiposProductos.map(p => p.nombre || p)}
          aseguradoras={aseguradoras}
          tiposProductos={tiposProductos}
          etapasActivas={['Captura', 'Cotización', 'Emitida', 'Vigente', 'Cancelada', 'Renovada']}
          agentes={agentes}
          tiposPago={['Anual', 'Fraccionado', 'Pago Único']}
          frecuenciasPago={['Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual']}
          periodosGracia={[0, 7, 14, 30]}
          estatusPago={['Pendiente', 'Por Vencer', 'Vencido', 'Pagado']}
          marcasVehiculo={['Nissan', 'Volkswagen', 'Chevrolet', 'Toyota', 'Honda', 'Mazda', 'Ford']}
          tiposVehiculo={['Sedán', 'Hatchback', 'SUV', 'Pickup', 'Van']}
          tiposCobertura={['Amplia', 'Limitada', 'RC', 'Integral']}
          calculartermino_vigencia={calculartermino_vigencia}
          calcularProximoPago={calcularProximoPago}
          handleClienteSeleccionado={handleClienteSeleccionado}
          clienteSeleccionado={clienteSeleccionado}
          onEliminarPago={() => {}}
        />
      )}
    </div>
  );
};

export default ModuloNvoExpedientes;

/**
 * ====================================================================
 * COMPONENTE BASE: FORMULARIO DE EXPEDIENTE
 * ====================================================================
 * Componente compartido para agregar/editar expedientes
 * Contiene SOLO la estructura de campos JSX y lógica compartida
 * NO incluye lógica de PDF ni snapshots (eso va en los wrappers)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, X, CheckCircle, AlertCircle, FileText, Eye, Trash2 } from 'lucide-react';
import { CONSTANTS } from '../../utils/expedientesConstants';
import { CampoFechaCalculada } from './UIComponents';
import BuscadorCliente from '../BuscadorCliente';
import CalendarioPagos from './CalendarioPagos';
import * as pdfService from '../../services/pdfService';
import * as estatusPagosUtils from '../../utils/estatusPagos';

const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = (includeJson = false) => {
  const token = localStorage.getItem('ss_token');
  const headers = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// Función helper para verificar si el producto es de tipo auto/automóvil
const esProductoAuto = (producto) => {
  if (!producto) return false;
  const normalizado = producto.toLowerCase().trim();
  return ['automóvil', 'automovil', 'autos', 'auto'].includes(normalizado);
};

// Función helper para convertir fecha ISO a formato yyyy-MM-dd
const formatearFechaParaInput = (fecha) => {
  if (!fecha) return '';
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  if (typeof fecha === 'string' && fecha.includes('T')) {
    return fecha.split('T')[0];
  }
  const fechaObj = new Date(fecha);
  if (isNaN(fechaObj.getTime())) return '';
  return fechaObj.toISOString().split('T')[0];
};

const FormularioExpedienteBase = React.memo(({ 
  // Props de configuración
  modoEdicion,
  titulo,
  textoBotónGuardar = 'Guardar',
  guardando = false,
  
  // Props de vista y navegación
  setVistaActual,
  
  // Props de formulario
  formulario,
  setFormulario,
  actualizarCalculosAutomaticos,
  guardarExpediente,
  
  // Props de catálogos
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
  
  // Props de cálculos
  calculartermino_vigencia,
  calcularProximoPago,
  
  // Props de cliente
  handleClienteSeleccionado,
  clienteSeleccionado,
  
  // Props de PDF (para edición)
  handleSeleccionarPDF,
  archivoSeleccionado,
  subiendoPDF,
  subirPDFPoliza,
  
  // Props de callbacks
  onEliminarPago,
  onRecibosArchivos, // 📎 Callback para recibir archivos de recibo pendientes (pre-guardado)
  onCrearAgenteNuevo, // 🆕 Callback para abrir modal de crear agente nuevo
  
  // Contenido adicional (para cada modo)
  bannerSuperior,
  seccionPDFInferior
}) => {
  
  // 🔄 Sincronizar automáticamente el estatusPago con el calendario
  useEffect(() => {
    if (formulario.recibos && Array.isArray(formulario.recibos) && formulario.recibos.length > 0) {
      const primerReciboPendiente = formulario.recibos.find(r => !r.fecha_pago_real);
      
      if (primerReciboPendiente) {
        const estatusCalculado = estatusPagosUtils.calcularEstatusRecibo(
          primerReciboPendiente.fecha_vencimiento,
          null
        );
        
        if (formulario.estatusPago !== estatusCalculado) {
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

  // Función para obtener vendedores del agente
  const obtenerVendedoresPorAgente = async (agenteId) => {
    if (!agenteId) {
      setVendedores([]);
      return;
    }

    try {
      const url = `${API_URL}/api/equipoDeTrabajo/vendedores-por-agente/${agenteId}`;
      
      const token = localStorage.getItem('ss_token');
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        const vendedoresArray = data.vendedores || [];
        setVendedores(vendedoresArray);
      } else {
        setVendedores([]);
      }
    } catch (error) {
      console.error('❌ Error al obtener vendedores:', error);
      setVendedores([]);
    }
  };

  // Función para extraer ID del agente desde el texto del formulario
  const extraerAgenteIdDelFormulario = (agenteTexto) => {
    if (!agenteTexto || !agentes.length) return null;

    const codigoAgente = agenteTexto.trim().split(' ')[0];
    let agenteEncontrado = agentes.find(a => 
      a.codigoAgente && a.codigoAgente.toString() === codigoAgente
    );
    
    if (agenteEncontrado) return agenteEncontrado.id;

    const textoLimpio = agenteTexto.toLowerCase().trim();
    agenteEncontrado = agentes.find(a => {
      if (a.perfil !== 'Agente') return false;
      const nombreCompleto = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.toLowerCase().trim();
      return textoLimpio.includes(nombreCompleto) || nombreCompleto.includes(textoLimpio.replace(/^\d+\s*-?\s*/, ''));
    });

    if (agenteEncontrado) return agenteEncontrado.id;

    agenteEncontrado = agentes.find(a => {
      if (a.perfil !== 'Agente') return false;
      const nombreCompleto = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.toLowerCase();
      const palabrasTexto = textoLimpio.split(/\s+/);
      return palabrasTexto.some(palabra => 
        palabra.length > 2 && nombreCompleto.includes(palabra)
      );
    });

    return agenteEncontrado ? agenteEncontrado.id : null;
  };

  // Efecto para cargar vendedores cuando cambia el agente
  // Auto-calcular IVA, subtotal y total cuando cambien los montos
  useEffect(() => {
    const primaNeta = parseFloat(formulario.prima_neta) || 0;
    const recargo = parseFloat(formulario.cargo_pago_fraccionado) || 0;
    const gastosExp = parseFloat(formulario.gastos_expedicion) || 0;

    const nuevoSubtotal = primaNeta + recargo + gastosExp;
    const nuevoIva = nuevoSubtotal * 0.16;
    const nuevoTotal = nuevoSubtotal + nuevoIva;

    const subtotalStr = nuevoSubtotal > 0 ? nuevoSubtotal.toFixed(2) : '';
    const ivaStr = nuevoIva > 0 ? nuevoIva.toFixed(2) : '';
    const totalStr = nuevoTotal > 0 ? nuevoTotal.toFixed(2) : '';

    if (formulario.subtotal !== subtotalStr || formulario.total !== totalStr || formulario.iva !== ivaStr) {
      setFormulario(prev => ({
        ...prev,
        iva: ivaStr,
        subtotal: subtotalStr,
        total: totalStr,
        _total_changed: true
      }));
    }
  }, [formulario.prima_neta, formulario.cargo_pago_fraccionado, formulario.gastos_expedicion]);

  // 🧾 Ref para evitar regenerar recibos en la carga inicial del modo edición
  const frecuenciaInicialRef = useRef(null);
  const tipoPagoInicialRef = useRef(null);
  const totalInicialRef = useRef(null);
  const gastosInicialRef = useRef(null);
  const fechaInicialRef = useRef(null);
  const primeraRenderizacionRef = useRef(true);

  // 🧾 Auto-generar recibos con montos y fechas calculados (manual + edición)
  useEffect(() => {
    const esManual = formulario._metodo_captura === 'manual';
    
    // En modo edición sin _metodo_captura: permitir recalcular solo si el usuario cambió frecuencia o tipo_pago
    if (modoEdicion && !esManual) {
      if (primeraRenderizacionRef.current) {
        // Primera renderización en edición: guardar valores iniciales, no regenerar
        primeraRenderizacionRef.current = false;
        frecuenciaInicialRef.current = formulario.frecuenciaPago;
        tipoPagoInicialRef.current = formulario.tipo_pago;
        totalInicialRef.current = formulario.total;
        gastosInicialRef.current = formulario.gastos_expedicion;
        fechaInicialRef.current = formulario.inicio_vigencia;
        return;
      }
      // Regenerar si el usuario cambió frecuencia, tipo_pago, montos o fechas
      const algoCambio = formulario.frecuenciaPago !== frecuenciaInicialRef.current ||
        formulario.tipo_pago !== tipoPagoInicialRef.current ||
        formulario.total !== totalInicialRef.current ||
        formulario.gastos_expedicion !== gastosInicialRef.current ||
        formulario.inicio_vigencia !== fechaInicialRef.current;
      if (!algoCambio) return;
    }
    
    if (!esManual && !modoEdicion) return;
    
    const tipoPago = formulario.tipo_pago;
    const frecuencia = formulario.frecuenciaPago;
    const esAnual = tipoPago === 'Anual';
    const esFraccionado = tipoPago === 'Fraccionado';
    
    if (!esAnual && !esFraccionado) return;
    
    const numRecibos = esAnual ? 1 : (CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0);
    if (numRecibos === 0) return;
    
    // Calcular montos
    const total = parseFloat(formulario.total) || 0;
    const gastos = parseFloat(formulario.gastos_expedicion) || 0;
    
    let montoPrimerRecibo = '';
    let montoSubsecuente = '';
    
    if (total > 0) {
      if (numRecibos === 1) {
        // Pago anual: un solo recibo con el total
        montoPrimerRecibo = total.toFixed(2);
      } else {
        // Fraccionado: repartir (total - gastos) entre N recibos, gastos van en el primero
        const baseRepartible = total - gastos;
        montoSubsecuente = (baseRepartible / numRecibos).toFixed(2);
        montoPrimerRecibo = (parseFloat(montoSubsecuente) + gastos).toFixed(2);
      }
    }
    
    // Calcular fechas a partir de inicio_vigencia
    const fechaBase = formulario.inicio_vigencia;
    const mesesPorFrecuencia = CONSTANTS.MESES_POR_FRECUENCIA[frecuencia] || 0;
    
    const calcularFecha = (indice) => {
      if (!fechaBase) return '';
      try {
        const [year, month, day] = fechaBase.split('-').map(Number);
        const fecha = new Date(year, month - 1 + (indice * mesesPorFrecuencia), day);
        // Formato YYYY-MM-DD
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      } catch {
        return '';
      }
    };
    
    // Fecha del primer recibo: usar fecha_vencimiento_pago (emisión + periodo gracia) si existe
    const fechaPrimerRecibo = formulario.fecha_vencimiento_pago || fechaBase || '';
    
    const nuevosRecibos = [];
    for (let i = 0; i < numRecibos; i++) {
      let fechaRecibo;
      if (i === 0) {
        // Primer recibo: usa la fecha de pago calculada con periodo de gracia
        fechaRecibo = esAnual ? fechaPrimerRecibo : fechaPrimerRecibo;
      } else {
        // Subsecuentes: calculan desde inicio_vigencia + (i * meses)
        fechaRecibo = calcularFecha(i);
      }
      nuevosRecibos.push({
        numero_recibo: i + 1,
        monto: i === 0 ? montoPrimerRecibo : montoSubsecuente,
        fecha_vencimiento: fechaRecibo
      });
    }
    
    // Sincronizar primer_pago y pagos_subsecuentes para que el backend calcule correctamente
    setFormulario(prev => ({ 
      ...prev, 
      recibos: nuevosRecibos,
      primer_pago: montoPrimerRecibo || '',
      pagos_subsecuentes: montoSubsecuente || montoPrimerRecibo || ''
    }));
  }, [formulario.tipo_pago, formulario.frecuenciaPago, formulario._metodo_captura, formulario.total, formulario.gastos_expedicion, formulario.inicio_vigencia, formulario.fecha_vencimiento_pago, modoEdicion]);

  useEffect(() => {
    if (formulario.agente && agentes.length > 0) {
      const agenteId = extraerAgenteIdDelFormulario(formulario.agente);
      
      if (agenteId && agenteId !== agenteIdSeleccionado) {
        setAgenteIdSeleccionado(agenteId);
        obtenerVendedoresPorAgente(agenteId);
      } else if (!agenteId) {
        setAgenteIdSeleccionado(null);
        setVendedores([]);
      }
    } else {
      setAgenteIdSeleccionado(null);
      setVendedores([]);
    }
  }, [formulario.agente, agentes]);

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0" style={{ fontSize: '1.1rem' }}>
          {titulo || (modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente')}
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
          
          {/* Banner superior (para modo agregar con PDF) */}
          {bannerSuperior}

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
                        value={formulario.razon_social ?? ''}
                        readOnly
                      />
                    </div>
                    {formulario.nombre_comercial && (
                      <div className="col-md-6">
                        <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre Comercial</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-light"
                          value={formulario.nombre_comercial ?? ''}
                          readOnly
                        />
                      </div>
                    )}
                    <div className="col-md-6">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>RFC</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        value={formulario.rfc ?? ''}
                        readOnly
                      />
                    </div>
                    
                    {/* Contacto/Gestor (Persona Moral) */}
                    <div className="col-12">
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                        <strong>Contacto Principal / Gestor</strong>
                      </small>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre</label>
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
                        placeholder="55 5555 5555"
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
                ) : (
                  // Campos para Persona Física
                  <>
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
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Teléfono Fijo</label>
                      <input
                        type="tel"
                        className="form-control form-control-sm"
                        value={formulario.telefono_fijo || ''}
                        onChange={(e) => setFormulario({...formulario, telefono_fijo: e.target.value})}
                        placeholder="55 5555 5555"
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
                    
                    {/* Tercera fila: Contacto adicional opcional (para Persona Física) */}
                    <div className="col-12 mt-2">
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                        <strong>Contacto Adicional (Opcional)</strong>
                      </small>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Nombre</label>
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
                        placeholder="55 5555 5555"
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
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Producto <span className="text-danger">*</span></label>
                <select
                  className="form-select form-select-sm"
                  value={formulario.producto}
                  onChange={(e) => {
                    const nuevoProducto = e.target.value;
                    // Limpiar campos de vehículo si cambia de Auto a otro producto
                    if (!esProductoAuto(nuevoProducto) && esProductoAuto(formulario.producto)) {
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
                        tipo_cobertura: '',
                        uso: '',
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
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Etapa Activa</label>
                <select
                  className="form-select form-select-sm"
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

          {/* Datos del Vehículo - Solo para Autos/Automóvil */}
          {esProductoAuto(formulario.producto) && (
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
                    placeholder="Ej: Versa, Jetta, etc."
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
                  <label className="form-label">Tipo de Cobertura</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_cobertura}
                    onChange={(e) => setFormulario(prev => ({ ...prev, tipo_cobertura: e.target.value }))}
                  >
                    <option value="">Seleccionar cobertura</option>
                    {tiposCobertura.map(cob => (
                      <option key={cob} value={cob}>{cob}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Uso</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.uso ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, uso: e.target.value }))}
                    placeholder="Ej: Particular, Servicio público, etc."
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Suma Asegurada</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formulario.suma_asegurada ?? ''}
                      onChange={(e) => setFormulario(prev => ({ ...prev, suma_asegurada: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Conductor */}
              <div className="row g-3 mt-3">
                <div className="col-12">
                  <h6 className="border-bottom pb-2">Conductor</h6>
                </div>
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
                  {formulario._datos_desde_pdf && <span className="text-info ms-2">🔒 Del PDF</span>}
                </label>
                {formulario._datos_desde_pdf ? (
                  // Modo PDF: input de solo lectura con valor extraído
                  <>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={formulario.agente ?? ''}
                      readOnly
                      disabled
                      style={{ cursor: 'not-allowed' }}
                    />
                    <small className="text-muted">
                      Agente extraído del PDF (no editable)
                    </small>
                  </>
                ) : (
                  // Modo Manual: select dropdown con lista de agentes
                  <>
                    <div className="d-flex gap-2">
                      <select
                        className={`form-select ${agenteIdSeleccionado ? 'is-valid' : ''}`}
                        value={formulario.agente ?? ''}
                        onChange={(e) => {
                          const valorSeleccionado = e.target.value;
                          // Encontrar el agente seleccionado para setear agente_id
                          const agenteSeleccionado = agentes.find(a => {
                            const nombre = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.trim();
                            const codigo = a.codigoAgente || '';
                            const displayText = codigo ? `${codigo} - ${nombre}` : nombre;
                            return displayText === valorSeleccionado;
                          });
                          setFormulario(prev => ({ 
                            ...prev, 
                            agente: valorSeleccionado,
                            agente_id: agenteSeleccionado?.id || null,
                            clave_agente: agenteSeleccionado?.codigoAgente || ''
                          }));
                        }}
                      >
                        <option value="">Seleccionar agente</option>
                        {agentes
                          .filter(a => a.perfil === 'Agente')
                          .map(a => {
                            const nombre = `${a.nombre || ''} ${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.trim();
                            const codigo = a.codigoAgente || '';
                            const displayText = codigo ? `${codigo} - ${nombre}` : nombre;
                            return (
                              <option key={a.id} value={displayText}>
                                {displayText}
                              </option>
                            );
                          })}
                      </select>
                      {onCrearAgenteNuevo && (
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={onCrearAgenteNuevo}
                          title="Crear nuevo agente"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          + Nuevo
                        </button>
                      )}
                    </div>
                    {!formulario.agente && (
                      <small className="text-muted">
                        Selecciona el agente asignado a esta póliza
                      </small>
                    )}
                  </>
                )}
              </div>
              
              <div className="col-md-6">
                <label className="form-label">
                  Sub-Agente / Vendedor
                  {vendedores.length > 0 && <span className="text-info ms-2">({vendedores.length} disponibles)</span>}
                </label>
                <select
                  className="form-select"
                  value={formulario.sub_agente ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, sub_agente: e.target.value }))}
                  disabled={!agenteIdSeleccionado || vendedores.length === 0}
                >
                  <option value="">Sin sub-agente</option>
                  {vendedores.map(vendedor => {
                    const nombre = `${vendedor.nombre || ''} ${vendedor.apellidoPaterno || ''} ${vendedor.apellidoMaterno || ''}`.trim();
                    return (
                      <option key={vendedor.id} value={nombre}>
                        {nombre}
                      </option>
                    );
                  })}
                </select>
                {!agenteIdSeleccionado && (
                  <small className="text-muted">
                    Primero selecciona un agente válido
                  </small>
                )}
                {agenteIdSeleccionado && vendedores.length === 0 && (
                  <small className="text-muted">
                    Este agente no tiene vendedores asignados
                  </small>
                )}
              </div>
              
              <div className="col-md-6">
                <label className="form-label">Número de Póliza</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.numero_poliza ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, numero_poliza: e.target.value }))}
                  placeholder="Ej: 123456789"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Número de Endoso</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.numero_endoso ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, numero_endoso: e.target.value }))}
                  placeholder="Ej: 001, 002, etc."
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Movimiento</label>
                <select
                  className="form-select"
                  value={formulario.movimiento ?? 'Emisión'}
                  onChange={(e) => setFormulario(prev => ({ ...prev, movimiento: e.target.value }))}
                >
                  <option value="Emisión">Emisión</option>
                  <option value="Endoso">Endoso</option>
                  <option value="Renovación">Renovación</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Forma de Pago</label>
                <select
                  className="form-select"
                  value={formulario.forma_pago ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, forma_pago: e.target.value }))}
                >
                  <option value="">Seleccionar forma de pago</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Domiciliación">Domiciliación</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cargo Automático">Cargo Automático</option>
                  <option value="Depósito Bancario">Depósito Bancario</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Moneda</label>
                <select
                  className="form-select"
                  value={formulario.moneda ?? 'MXN'}
                  onChange={(e) => setFormulario(prev => ({ ...prev, moneda: e.target.value }))}
                >
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dólar Estadounidense</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Montos */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Montos</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Prima Neta</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.prima_neta ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, prima_neta: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Recargo por Pago Fraccionado</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.cargo_pago_fraccionado ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, cargo_pago_fraccionado: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Gastos de Expedición</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.gastos_expedicion ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, gastos_expedicion: e.target.value || '' }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">IVA (16%)</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.iva ?? ''}
                    readOnly
                    style={{ backgroundColor: '#f8f9fa' }}
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
                    readOnly
                    style={{ backgroundColor: '#f0f0f0' }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Total</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control fw-bold"
                    value={formulario.total ?? ''}
                    readOnly
                    style={{ backgroundColor: '#e8f5e9' }}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fechas y Vigencia */}
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
                  className="form-control form-control-sm bg-light"
                  value={formatearFechaParaInput(formulario.fecha_captura) || new Date().toISOString().split('T')[0]}
                  readOnly
                  disabled
                  style={{ cursor: 'not-allowed' }}
                />
                <small className="form-text text-muted" style={{ fontSize: '0.65rem' }}>
                  Fecha de registro (solo lectura)
                </small>
              </div>
              <div className="col-md-2">
                <label className="form-label mb-1" style={{ fontSize: '0.8rem' }}>Inicio de Vigencia</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={formatearFechaParaInput(formulario.inicio_vigencia) || ''}
                  onChange={(e) => {
                    const nuevoFormulario = { 
                      ...formulario, 
                      inicio_vigencia: e.target.value,
                      _inicio_vigencia_changed: true,
                      recibos: [] // 🔥 Limpiar recibos para forzar recálculo
                    };
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
                      frecuenciaPago: esAnual ? 'Anual' : formulario.frecuenciaPago,
                      _tipo_pago_changed: true // Marcar cambio para forzar recálculo de recibos
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
                      const nuevoFormulario = { 
                        ...formulario, 
                        frecuenciaPago: e.target.value,
                        _frecuencia_pago_changed: true // Marcar cambio para forzar recálculo de recibos
                      };
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
                      
                      // Actualizar periodo_gracia y marcar cambio para forzar recálculo de recibos
                      const formularioConNuevoPeriodo = {
                        ...formulario,
                        periodo_gracia: diasGracia,
                        _periodo_gracia_changed: true // Marcar cambio para forzar recálculo
                      };
                      
                      // Usar la función de actualización automática que tiene toda la lógica
                      const formularioActualizado = actualizarCalculosAutomaticos(formularioConNuevoPeriodo);
                      setFormulario(formularioActualizado);
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
                <label className="form-label">Fecha límite de pago (Primer recibo)</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.fecha_vencimiento_pago || ''}
                  onChange={async (e) => {
                    const nuevaFecha = e.target.value;
                    
                    if (modoEdicion && formulario.id && nuevaFecha) {
                      try {
                        const recibosResponse = await fetch(`${API_URL}/api/recibos/${formulario.id}`, {
                          headers: getAuthHeaders()
                        });
                        
                        if (recibosResponse.ok) {
                          const recibosData = await recibosResponse.json();
                          
                          if (recibosData.success && recibosData.data) {
                            // 🔧 FIX: Buscar específicamente el recibo #1 (primer recibo)
                            const primerRecibo = recibosData.data.find(recibo => recibo.numero_recibo === 1);
                            
                            if (primerRecibo) {
                              await fetch(`${API_URL}/api/recibos/${formulario.id}/${primerRecibo.numero_recibo}/fecha-vencimiento`, {
                                method: 'PUT',
                                headers: getAuthHeaders(true),
                                body: JSON.stringify({ fecha_vencimiento: nuevaFecha })
                              });
                            }
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error al actualizar fecha:', error);
                      }
                    }
                    
                    setFormulario(prev => {
                      // 🔧 FIX: Calcular período de gracia correctamente
                      let nuevoPeriodoGracia = prev.periodo_gracia || 0;
                      
                      if (prev.inicio_vigencia && nuevaFecha) {
                        const fechaInicio = new Date(prev.inicio_vigencia);
                        const fechaPago = new Date(nuevaFecha);
                        fechaInicio.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        
                        const diferenciaDias = Math.ceil((fechaPago - fechaInicio) / (1000 * 60 * 60 * 24));
                        nuevoPeriodoGracia = Math.max(0, diferenciaDias);
                      }
                      
                      // Actualizar solo la fecha de vencimiento del primer pago
                      return {
                        ...prev,
                        fecha_vencimiento_pago: nuevaFecha,
                        periodo_gracia: nuevoPeriodoGracia,
                        _fechaManual: true,
                        _periodo_gracia_changed: true // Marcar cambio para forzar recálculo de recibos
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

              {/* Editor de Recibos Manual / Edición */}
              {(formulario._metodo_captura === 'manual' || modoEdicion) && 
               formulario.recibos && formulario.recibos.length > 0 && (
                <div className="col-12 mt-3">
                  <h6 className="border-bottom pb-2 mb-3">
                    🧾 Recibos de Pago 
                    <span className="badge bg-info ms-2">{formulario.recibos.length}</span>
                  </h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '60px' }} className="text-center">#</th>
                          <th>Monto ($)</th>
                          <th>Fecha de Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formulario.recibos.map((recibo, idx) => (
                          <tr key={recibo.numero_recibo || idx}>
                            <td className="text-center fw-bold">{recibo.numero_recibo || idx + 1}</td>
                            <td>
                              <div className="input-group input-group-sm">
                                <span className="input-group-text">$</span>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  placeholder="0.00"
                                  step="0.01"
                                  min="0"
                                  value={recibo.monto || ''}
                                  onChange={(e) => {
                                    const nuevosRecibos = [...formulario.recibos];
                                    nuevosRecibos[idx] = { ...nuevosRecibos[idx], monto: e.target.value };
                                    // Sincronizar primer_pago y pagos_subsecuentes
                                    const primerPago = idx === 0 ? e.target.value : nuevosRecibos[0]?.monto || '';
                                    const subsecuente = nuevosRecibos.length > 1 
                                      ? (idx === 1 ? e.target.value : nuevosRecibos[1]?.monto || '') 
                                      : primerPago;
                                    setFormulario(prev => ({ 
                                      ...prev, 
                                      recibos: nuevosRecibos,
                                      primer_pago: primerPago,
                                      pagos_subsecuentes: subsecuente
                                    }));
                                  }}
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={recibo.fecha_vencimiento || ''}
                                onChange={(e) => {
                                  const nuevosRecibos = [...formulario.recibos];
                                  nuevosRecibos[idx] = { ...nuevosRecibos[idx], fecha_vencimiento: e.target.value };
                                  setFormulario(prev => ({ ...prev, recibos: nuevosRecibos }));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-light">
                          <td className="text-center fw-bold">Σ</td>
                          <td>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">$</span>
                              <input
                                type="text"
                                className="form-control form-control-sm fw-bold"
                                readOnly
                                style={{ backgroundColor: '#e8f5e9' }}
                                value={formulario.recibos.reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0).toFixed(2)}
                              />
                            </div>
                          </td>
                          <td className="text-muted small align-middle">Suma de recibos</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <small className="text-muted">
                    💡 Montos y fechas se calculan automáticamente. El primer recibo incluye los gastos de expedición.
                    Puedes editar cualquier valor si es necesario.
                  </small>
                </div>
              )}

              {/* Calendario de Pagos (solo para Regex/IA en modo nuevo, no en manual ni edición) */}
              {formulario._metodo_captura !== 'manual' && !modoEdicion && formulario.inicio_vigencia && (
                (formulario.tipo_pago === 'Fraccionado' && formulario.frecuenciaPago) || 
                formulario.tipo_pago === 'Anual'
              ) && (
                <div className="col-12 mt-3">
                  <CalendarioPagos 
                    expediente={formulario} 
                    calcularProximoPago={calcularProximoPago}
                    mostrarResumen={false}
                    onEliminarPago={onEliminarPago}
                    modoPreGuardado={!modoEdicion}
                    onRecibosArchivos={onRecibosArchivos}
                    onRecibosCalculados={(recibos) => {
                      // 📸 Guardar recibos calculados en el formulario
                      setFormulario(prev => ({
                        ...prev,
                        recibos: recibos
                      }));
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sección de PDF inferior (para modo edición) */}
          {seccionPDFInferior}

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
              disabled={guardando}
            >
              {guardando ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Guardando...</>
              ) : textoBotónGuardar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FormularioExpedienteBase;

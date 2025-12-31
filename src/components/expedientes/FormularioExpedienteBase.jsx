/**
 * ====================================================================
 * COMPONENTE BASE: FORMULARIO DE EXPEDIENTE
 * ====================================================================
 * Componente compartido para agregar/editar expedientes
 * Contiene SOLO la estructura de campos JSX y lógica compartida
 * NO incluye lógica de PDF ni snapshots (eso va en los wrappers)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, X, CheckCircle, AlertCircle, FileText, Eye, Trash2 } from 'lucide-react';
import { CONSTANTS } from '../../utils/expedientesConstants';
import { CampoFechaCalculada } from './UIComponents';
import BuscadorCliente from '../BuscadorCliente';
import CalendarioPagos from './CalendarioPagos';
import * as pdfService from '../../services/pdfService';
import * as estatusPagosUtils from '../../utils/estatusPagos';

const API_URL = import.meta.env.VITE_API_URL;

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
      let url = `${API_URL}/api/equipoDeTrabajo/vendedores-por-agente/${agenteId}`;
      const params = new URLSearchParams();
      
      if (claveAgente) params.append('clave', claveAgente);
      if (aseguradora) params.append('aseguradora', aseguradora);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        let vendedoresArray = data.vendedores || [];
        
        if (claveAgente && vendedoresArray.length > 0) {
          vendedoresArray = vendedoresArray.filter(vendedor => {
            const comisiones = vendedor.comisionesCompartidas || [];
            return comisiones.some(com => 
              com.clave && com.clave.toString() === claveAgente.toString()
            );
          });
        }
        
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
  useEffect(() => {
    if (formulario.agente && agentes.length > 0) {
      const agenteId = extraerAgenteIdDelFormulario(formulario.agente);
      const claveAgente = formulario.agente.trim().split(' ')[0];
      
      if (agenteId && agenteId !== agenteIdSeleccionado) {
        setAgenteIdSeleccionado(agenteId);
        obtenerVendedoresPorAgente(agenteId, claveAgente, formulario.compania);
      } else if (!agenteId) {
        setAgenteIdSeleccionado(null);
        setVendedores([]);
      }
    } else {
      setAgenteIdSeleccionado(null);
      setVendedores([]);
    }
  }, [formulario.agente, formulario.compania, agentes]);

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
                    // Limpiar campos de vehículo si cambia de Automóvil a otro producto
                    if (nuevoProducto !== 'Automóvil' && formulario.producto === 'Automóvil') {
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

          {/* Datos del Vehículo - Solo para Automóvil */}
          {formulario.producto === 'Automóvil' && (
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
                </label>
                <input
                  type="text"
                  className={`form-control ${agenteIdSeleccionado ? 'is-valid' : formulario.agente ? 'is-invalid' : ''}`}
                  value={formulario.agente ?? ''}
                  onChange={(e) => {
                    const nuevoAgente = e.target.value;
                    setFormulario(prev => ({ ...prev, agente: nuevoAgente }));
                  }}
                  placeholder="Nombre del agente"
                />
                {!agenteIdSeleccionado && formulario.agente && (
                  <small className="text-danger">
                    ⚠️ Agente no encontrado en el catálogo - no se podrán asignar vendedores
                  </small>
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
              <div className="col-md-6">
                <label className="form-label">Forma de Pago</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.forma_pago ?? ''}
                  onChange={(e) => setFormulario(prev => ({ ...prev, forma_pago: e.target.value }))}
                  placeholder="Ej: Transferencia, Efectivo, etc."
                />
              </div>
              <div className="col-md-6">
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
                <label className="form-label fw-bold">Total</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control fw-bold"
                    value={formulario.total ?? ''}
                    onChange={(e) => setFormulario(prev => ({ ...prev, total: e.target.value }))}
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
                  value={formulario.inicio_vigencia || ''}
                  onChange={(e) => {
                    console.log('📅 Cambio en inicio_vigencia:', e.target.value);
                    const nuevoFormulario = { 
                      ...formulario, 
                      inicio_vigencia: e.target.value,
                      _inicio_vigencia_changed: true // Marcar que cambió para forzar recálculo de recibos
                    };
                    console.log('📝 Formulario antes de actualizar:', nuevoFormulario);
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    console.log('✅ Formulario después de actualizar:', formularioActualizado);
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
                        let nuevaFechaPago = prev.fecha_vencimiento_pago || prev.fecha_pago;
                        
                        if (prev.inicio_vigencia) {
                          const fechaInicio = new Date(prev.inicio_vigencia);
                          fechaInicio.setDate(fechaInicio.getDate() + diasGracia);
                          nuevaFechaPago = fechaInicio.toISOString().split('T')[0];
                        }
                        
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
                    ? 'Sugerido Qualitas: 14 días' 
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
                    
                    if (modoEdicion && formulario.id && nuevaFecha) {
                      try {
                        const recibosResponse = await fetch(`${API_URL}/api/recibos/${formulario.id}`);
                        
                        if (recibosResponse.ok) {
                          const recibosData = await recibosResponse.json();
                          
                          if (recibosData.success && recibosData.data) {
                            const recibosPendientes = recibosData.data
                              .filter(recibo => 
                                recibo.estatus !== 'Pagado' && 
                                recibo.estatus !== 'pagado' &&
                                recibo.estatus !== 'PAGADO'
                              )
                              .sort((a, b) => parseInt(a.numero_recibo) - parseInt(b.numero_recibo));
                            
                            const reciboPendiente = recibosPendientes[0];
                            
                            if (reciboPendiente) {
                              await fetch(`${API_URL}/api/recibos/${formulario.id}/${reciboPendiente.numero_recibo}/fecha-vencimiento`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
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
                      let nuevoPeriodoGracia = prev.periodo_gracia || 0;
                      
                      if (prev.inicio_vigencia && nuevaFecha) {
                        const fechaInicio = new Date(prev.inicio_vigencia);
                        const fechaPago = new Date(nuevaFecha);
                        fechaInicio.setHours(0, 0, 0, 0);
                        fechaPago.setHours(0, 0, 0, 0);
                        
                        const diferenciaDias = Math.ceil((fechaPago - fechaInicio) / (1000 * 60 * 60 * 24));
                        nuevoPeriodoGracia = Math.max(0, diferenciaDias);
                      }
                      
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
                        _fechaManual: true
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

              {/* Calendario de Pagos */}
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
            >
              {textoBotónGuardar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FormularioExpedienteBase;

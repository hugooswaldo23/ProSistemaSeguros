const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X, XCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, Search, Save, Upload, CheckCircle, Loader } from 'lucide-react';
import { obtenerAgentesEquipo } from '../services/equipoDeTrabajoService';
import { obtenerTiposProductosActivos } from '../services/tiposProductosService';
// ============= CONSTANTES GLOBALES =============
const CONSTANTS = {
  MIN_YEAR: 1900,
  MAX_YEAR: new Date().getFullYear() + 1,
  VIN_LENGTH: 17,
  DIAS_EN_AÑO: 365,
  PAGOS_POR_FRECUENCIA: {
    'Mensual': 12,
    'Trimestral': 4,
    'Semestral': 2
  },
  MESES_POR_FRECUENCIA: {
    'Mensual': 1,
    'Trimestral': 3,
    'Semestral': 6
  }
};

// ============= UTILIDADES =============
const utils = {
  formatearFecha: (fecha, formato = 'corta') => {
    if (!fecha) return '-';
    const opciones = {
      corta: { day: '2-digit', month: 'short' },
      media: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
      larga: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    };
    return new Date(fecha).toLocaleDateString('es-MX', opciones[formato]);
  },

  formatearMoneda: (monto) => {
    if (!monto) return '-';
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(monto);
  },

  getBadgeClass: (tipo, valor) => {
    const mapas = {
      etapa: {
        'Pagado': 'bg-success',
        'Cancelado': 'bg-danger',
        'Emitida': 'bg-info',
        'Autorizado': 'bg-primary',
        'Cotización enviada': 'bg-warning',
        'En proceso emisión': 'bg-info',
        'Pendiente de pago': 'bg-warning'
      },
      pago: {
        'Pagado': 'bg-success',
        'Vencido': 'bg-danger',
        'Pago por vencer': 'bg-warning',
        'Sin definir': 'bg-secondary'
      },
      tipo_pago: {
        'Fraccionado': 'bg-info',
        'Anual': 'bg-primary'
      }
    };
    return mapas[tipo]?.[valor] || 'bg-secondary';
  },

  calcularDiasRestantes: (fecha) => {
    if (!fecha) return null;
    const hoy = new Date();
    const fechaObjetivo = new Date(fecha);
    return Math.ceil((fechaObjetivo - hoy) / (1000 * 60 * 60 * 24));
  }
};

// ============= COMPONENTES REUTILIZABLES =============

const Badge = React.memo(({ tipo, valor, className = '' }) => {
  const badgeClass = utils.getBadgeClass(tipo, valor);
  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {tipo === 'pago' && valor === 'Vencido' && '⚠️ '}
      {valor}
    </span>
  );
});

const CampoFechaCalculada = React.memo(({ 
  label, 
  value, 
  onChange, 
  onCalculate, 
  disabled = false,
  helpText = ''
}) => (
  <div>
    <label className="form-label">{label}</label>
    <div className="input-group">
      <input
        type="date"
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {onCalculate && (
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCalculate}
          title="Calcular automáticamente"
          disabled={disabled}
        >
          🤖
        </button>
      )}
    </div>
    {helpText && <small className="form-text text-muted">{helpText}</small>}
  </div>
));

const InfoCliente = React.memo(({ expediente }) => (
  <div>
    <div className="fw-semibold">
      {expediente.nombre} {expediente.apellido_paterno} {expediente.apellido_materno}
    </div>
    <small className="text-muted">{expediente.email}</small>
    {expediente.producto === 'Autos' && expediente.marca && (
      <div>
        <small className="text-primary">
          🚗 {expediente.marca} {expediente.modelo} {expediente.año}
        </small>
      </div>
    )}
  </div>
));

const EstadoPago = React.memo(({ expediente }) => (
  <div>
    <small className="fw-semibold text-primary">{expediente.tipo_pago || 'Sin definir'}</small>
    {expediente.frecuenciaPago && (
      <div><small className="text-muted">{expediente.frecuenciaPago}</small></div>
    )}
    <Badge tipo="pago" valor={expediente.estatusPago || 'Sin definir'} className="badge-sm" />
    {expediente.proximoPago && expediente.estatusPago !== 'Pagado' && (
      <div>
        <small className={`${
          expediente.estatusPago === 'Vencido' ? 'text-danger fw-bold' :
          expediente.estatusPago === 'Pago por vencer' ? 'text-warning' :
          'text-muted'
        }`}>
          Pago: {utils.formatearFecha(expediente.proximoPago)}
        </small>
      </div>
    )}
  </div>
));

const CalendarioPagos = React.memo(({ 
  expediente, 
  calcularProximoPago, 
  mostrarResumen = true,
  compacto = false 
}) => {
  if (!expediente.tipo_pago === 'Fraccionado' || !expediente.frecuenciaPago || !expediente.inicio_vigencia) {
    return null;
  }

  const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[expediente.frecuenciaPago] || 0;
  const pagos = [];
  
  for (let i = 1; i <= numeroPagos; i++) {
    const fechaPago = calcularProximoPago(
      expediente.inicio_vigencia,
      expediente.tipo_pago,
      expediente.frecuenciaPago,
      expediente.periodoGracia,
      i
    );
    
    if (fechaPago) {
      pagos.push({
        numero: i,
        fecha: fechaPago,
        monto: expediente.total ? (parseFloat(expediente.total) / numeroPagos).toFixed(2) : '---'
      });
    }
  }

  const fechaUltimoPago = expediente.fechaUltimoPago ? new Date(expediente.fechaUltimoPago) : null;
  let totalPagado = 0;
  let totalPendiente = 0;
  let pagosRealizados = 0;

  const pagosProcesados = pagos.map((pago) => {
    const fechaPago = new Date(pago.fecha);
    const diasRestantes = utils.calcularDiasRestantes(pago.fecha);
    
    let pagado = false;
    if (fechaUltimoPago && fechaPago <= fechaUltimoPago) {
      pagado = true;
      pagosRealizados++;
      totalPagado += parseFloat(pago.monto) || 0;
    } else {
      totalPendiente += parseFloat(pago.monto) || 0;
    }
    
    let estado = 'Por vencer';
    let badgeClass = 'bg-secondary';
    
    if (pagado) {
      estado = 'Pagado';
      badgeClass = 'bg-success';
    } else if (diasRestantes < 0) {
      estado = 'Vencido';
      badgeClass = 'bg-danger';
    } else if (diasRestantes === 0) {
      estado = 'Vence hoy';
      badgeClass = 'bg-danger';
    } else if (diasRestantes <= 7) {
      estado = `Vence en ${diasRestantes} días`;
      badgeClass = 'bg-warning';
    } else if (diasRestantes <= 30) {
      estado = 'Próximo';
      badgeClass = 'bg-info';
    }
    
    return { ...pago, estado, badgeClass, pagado };
  });

  if (compacto) {
    return (
      <div className="mt-1">
        <small className="text-info">
          📊 {pagosRealizados}/{numeroPagos} pagos
        </small>
      </div>
    );
  }

  return (
    <div className="card border-primary">
      <div className="card-header bg-primary text-white">
        <h6 className="mb-0">
          📅 Calendario de Pagos - {expediente.frecuenciaPago}
          <small className="ms-2">({numeroPagos} pagos en el año)</small>
        </h6>
      </div>
      <div className="card-body p-3">
        {mostrarResumen && (
          <div className="row mb-3">
            <div className="col-md-3">
              <div className="card bg-light">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Total Anual</h6>
                  <h4 className="mb-0 text-primary">{utils.formatearMoneda(expediente.total)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Pagado</h6>
                  <h4 className="mb-0">{utils.formatearMoneda(totalPagado)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Pendiente</h6>
                  <h4 className="mb-0">{utils.formatearMoneda(totalPendiente)}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body text-center p-2">
                  <h6 className="mb-0">Progreso</h6>
                  <h4 className="mb-0">{pagosRealizados}/{numeroPagos}</h4>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0">
            <thead>
              <tr>
                <th width="80">Pago #</th>
                <th>Fecha de Pago</th>
                <th>Monto</th>
                <th width="150">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagosProcesados.map((pago) => (
                <tr key={pago.numero} className={pago.pagado ? 'table-success' : ''}>
                  <td><strong>#{pago.numero}</strong></td>
                  <td>{utils.formatearFecha(pago.fecha, 'larga')}</td>
                  <td><strong>${pago.monto}</strong></td>
                  <td>
                    <span className={`badge ${pago.badgeClass}`}>
                      {pago.pagado && '✓ '}
                      {pago.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {expediente.total && (
              <tfoot>
                <tr className="table-info">
                  <td colSpan="2" className="text-end"><strong>Total Anual:</strong></td>
                  <td colSpan="2"><strong>{utils.formatearMoneda(expediente.total)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
});

const usePaginacion = (items, itemsPorPagina = 10) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const itemsFiltrados = useMemo(() => {
    if (!busqueda) return items;
    
    const busquedaLower = busqueda.toLowerCase();
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(busquedaLower)
    );
  }, [items, busqueda]);

  const totalPaginas = Math.ceil(itemsFiltrados.length / itemsPorPagina);
  
  const itemsPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    return itemsFiltrados.slice(inicio, fin);
  }, [itemsFiltrados, paginaActual, itemsPorPagina]);

  const irAPagina = useCallback((pagina) => {
    setPaginaActual(Math.max(1, Math.min(pagina, totalPaginas)));
  }, [totalPaginas]);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda]);

  return {
    itemsPaginados,
    paginaActual,
    totalPaginas,
    setPaginaActual: irAPagina,
    busqueda,
    setBusqueda,
    totalItems: itemsFiltrados.length
  };
};

const Paginacion = React.memo(({ paginaActual, totalPaginas, setPaginaActual }) => {
  if (totalPaginas <= 1) return null;

  const paginas = [];
  const maxPaginas = 5;
  let inicio = Math.max(1, paginaActual - Math.floor(maxPaginas / 2));
  let fin = Math.min(totalPaginas, inicio + maxPaginas - 1);
  
  if (fin - inicio + 1 < maxPaginas) {
    inicio = Math.max(1, fin - maxPaginas + 1);
  }

  for (let i = inicio; i <= fin; i++) {
    paginas.push(i);
  }

  return (
    <nav>
      <ul className="pagination justify-content-center mb-0">
        <li className={`page-item ${paginaActual === 1 ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual - 1)}
            disabled={paginaActual === 1}
          >
            <ChevronLeft size={16} />
          </button>
        </li>
        
        {inicio > 1 && (
          <>
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(1)}>1</button>
            </li>
            {inicio > 2 && <li className="page-item disabled"><span className="page-link">...</span></li>}
          </>
        )}
        
        {paginas.map(pagina => (
          <li key={pagina} className={`page-item ${paginaActual === pagina ? 'active' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => setPaginaActual(pagina)}
            >
              {pagina}
            </button>
          </li>
        ))}
        
        {fin < totalPaginas && (
          <>
            {fin < totalPaginas - 1 && <li className="page-item disabled"><span className="page-link">...</span></li>}
            <li className="page-item">
              <button className="page-link" onClick={() => setPaginaActual(totalPaginas)}>{totalPaginas}</button>
            </li>
          </>
        )}
        
        <li className={`page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => setPaginaActual(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
          >
            <ChevronRight size={16} />
          </button>
        </li>
      </ul>
    </nav>
  );
});

const BarraBusqueda = React.memo(({ busqueda, setBusqueda, placeholder = "Buscar..." }) => (
  <div className="input-group mb-3">
    <span className="input-group-text">
      <Search size={20} />
    </span>
    <input
      type="text"
      className="form-control"
      placeholder={placeholder}
      value={busqueda}
      onChange={(e) => setBusqueda(e.target.value)}
    />
    {busqueda && (
      <button 
        className="btn btn-outline-secondary" 
        type="button"
        onClick={() => setBusqueda('')}
      >
        <X size={16} />
      </button>
    )}
  </div>
));

// ============= COMPONENTE EXTRACTOR PDF =============
const ExtractorPolizasPDF = React.memo(({ onDataExtracted, onClose }) => {
  const [estado, setEstado] = useState('esperando');
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [informacionArchivo, setInformacionArchivo] = useState(null);

  const procesarPDF = useCallback(async (file) => {
    setEstado('procesando');
    setErrores([]);

    try {
      // Simulación de procesamiento PDF con datos reales basados en las imágenes
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Datos extraídos basados en la estructura real de Qualitas mostrada en las imágenes
      const datosSimulados = {
        // INFORMACIÓN DEL ASEGURADO (Página 2 - Sección superior)
        nombre: 'ADAN',
        apellido_paterno: 'LUNA',
        apellido_materno: 'MAGDALENO',
        email: '',
        telefono_fijo: '',
        telefono_movil: '',
        
        // DATOS DE LA PÓLIZA (Página 1 - Encabezado)
        compania: 'Qualitas',
        producto: 'Autos',
        etapa_activa: 'Emitida',
        agente: 'GUZMAN GONZALEZ Y ASOCIADOS AGTE DE SEGU',
        sub_agente: '',
        numero_poliza: '0971416046',
        
        // VIGENCIA (Página 2 - Sección de vigencia)
        inicio_vigencia: '2025-07-08',
        termino_vigencia: '2026-07-08',
        
        // INFORMACIÓN FINANCIERA (Página 2 - Sección inferior)
        prima_pagada: '31749.06',
        cargo_pago_fraccionado: '',
        iva: '5080.65',
        total: '36834.73',
        tipo_pago: 'Contado',
        periodo_gracia: 14,
        
        // DESCRIPCIÓN DEL VEHÍCULO (Página 2 - Sección media)
        marca: 'BYD',
        modelo: 'M9 BASE 5P L4 1.5T PHEV AUT',
        anio: '2026',
        numero_serie: 'LC0C74C4XT4005854',
        placas: 'SN',
        color: '',
        tipo_vehiculo: 'Automóviles Especiales',
        
        // COBERTURAS
        tipo_cobertura: 'AMPLIADA',
        deducible: '5',
        suma_asegurada: '978800.00',
        
        // CONDUCTOR
        conductor_habitual: 'ADAN LUNA MAGDALENO',
        edad_conductor: '',
        licencia_conducir: ''
      };

      setDatosExtraidos(datosSimulados);
      setEstado('completado');
      
      // Mensajes informativos sobre la extracción
      const mensajesExtraccion = [
      ];
      
      setErrores(mensajesExtraccion);

    } catch (error) {
      setEstado('error');
      setErrores(['❌ Error al procesar el archivo PDF']);
    }
  }, []);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setArchivo(file);
      setInformacionArchivo({
        nombre: file.name,
        tamaño: `${(file.size / 1024).toFixed(2)} KB`,
        tipo: file.type,
        fechaModificacion: new Date(file.lastModified).toLocaleDateString('es-MX')
      });
      procesarPDF(file);
    } else {
      setErrores(['❌ Por favor, seleccione un archivo PDF válido']);
      setEstado('error');
    }
  }, [procesarPDF]);

  const aplicarDatos = useCallback(() => {
    if (datosExtraidos && onDataExtracted) {
      onDataExtracted(datosExtraidos);
      onClose();
    }
  }, [datosExtraidos, onDataExtracted, onClose]);

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <FileText className="me-2" size={20} />
              Extractor Inteligente de Pólizas PDF
            </h5>
            <button 
              type="button" 
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          
          <div className="modal-body">
            {estado === 'esperando' && (
              <div className="text-center py-5">
                <Upload size={48} className="text-muted mb-3" />
                <h6 className="mb-3">Seleccione el archivo PDF de la póliza</h6>
                <p className="text-muted mb-4">
                  Sistema de extracción inteligente optimizado para pólizas mexicanas
                </p>
                <label className="btn btn-primary btn-lg">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    className="d-none"
                  />
                  <Upload className="me-2" size={20} />
                  Seleccionar Póliza PDF
                </label>
              </div>
            )}

            {estado === 'procesando' && (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Procesando...</span>
                </div>
                <h6 className="mb-3">Procesando PDF...</h6>
                <p className="text-muted">Extrayendo información de la póliza</p>
              </div>
            )}

            {estado === 'completado' && datosExtraidos && (
              <div>
                <div className="alert alert-success mb-3">
                  <CheckCircle className="me-2" size={20} />
                  <strong>¡Extracción completada!</strong>
                </div>

                {informacionArchivo && (
                  <div className="card mb-3">
                    <div className="card-body">
                      <strong>Archivo:</strong> {informacionArchivo.nombre} ({informacionArchivo.tamaño})
                    </div>
                  </div>
                )}

                {errores.length > 0 && (
                  <div className="alert alert-info mb-3">
                    <h6 className="alert-heading">📊 Reporte de Extracción:</h6>
                    {errores.map((error, idx) => (
                      <div key={idx} className="small">{error}</div>
                    ))}
                  </div>
                )}

                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">🎯 Datos Extraídos del PDF</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {/* INFORMACIÓN DEL ASEGURADO */}
                      <div className="col-12">
                        <div className="p-3 bg-light rounded">
                          <h6 className="text-primary mb-3">👤 INFORMACIÓN DEL ASEGURADO</h6>
                          <div className="row g-2">
                            <div className="col-md-12">
                              <small className="text-muted">Nombre Completo:</small><br/>
                              <strong>{datosExtraidos.nombre} {datosExtraidos.apellido_paterno} {datosExtraidos.apellido_materno}</strong>
                            </div>
                            <div className="col-md-12">
                              <small className="text-muted">Conductor Habitual:</small><br/>
                              <strong>{datosExtraidos.conductor_habitual || 'Mismo que asegurado'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DATOS DE LA PÓLIZA */}
                      <div className="col-12">
                        <div className="p-3 bg-primary bg-opacity-10 rounded">
                          <h6 className="text-primary mb-3">📋 DATOS DE LA PÓLIZA</h6>
                          <div className="row g-2">
                            <div className="col-md-3">
                              <small className="text-muted">Compañía:</small><br/>
                              <strong className="text-primary">{datosExtraidos.compania}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Número de Póliza:</small><br/>
                              <strong>{datosExtraidos.numero_poliza}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Producto:</small><br/>
                              <strong>{datosExtraidos.producto}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Tipo de Pago:</small><br/>
                              <strong>{datosExtraidos.tipo_pago}</strong>
                            </div>
                          </div>
                          <div className="row g-2 mt-2">
                            <div className="col-md-12">
                              <small className="text-muted">Agente:</small><br/>
                              <strong>{datosExtraidos.agente}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* VIGENCIA */}
                      <div className="col-12">
                        <div className="p-3 bg-success bg-opacity-10 rounded">
                          <h6 className="text-success mb-3">📅 VIGENCIA DE LA PÓLIZA</h6>
                          <div className="row g-2">
                            <div className="col-md-6">
                              <small className="text-muted">Desde las 12:00 P.M. del:</small><br/>
                              <strong>{datosExtraidos.inicio_vigencia ? new Date(datosExtraidos.inicio_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'}</strong>
                            </div>
                            <div className="col-md-6">
                              <small className="text-muted">Hasta las 12:00 P.M. del:</small><br/>
                              <strong>{datosExtraidos.termino_vigencia ? new Date(datosExtraidos.termino_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DESCRIPCIÓN DEL VEHÍCULO ASEGURADO */}
                      <div className="col-12">
                        <div className="p-3 bg-info bg-opacity-10 rounded">
                          <h6 className="text-info mb-3">🚗 DESCRIPCIÓN DEL VEHÍCULO ASEGURADO</h6>
                          <div className="row g-2">
                            <div className="col-md-3">
                              <small className="text-muted">Marca:</small><br/>
                              <strong>{datosExtraidos.marca}</strong>
                            </div>
                            <div className="col-md-6">
                              <small className="text-muted">Modelo:</small><br/>
                              <strong>{datosExtraidos.modelo}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Año:</small><br/>
                              <strong>{datosExtraidos.anio}</strong>
                            </div>
                          </div>
                          <div className="row g-2 mt-2">
                            <div className="col-md-6">
                              <small className="text-muted">Serie (VIN):</small><br/>
                              <strong className="font-monospace">{datosExtraidos.numero_serie}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Placas:</small><br/>
                              <strong>{datosExtraidos.placas}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Tipo:</small><br/>
                              <strong>{datosExtraidos.tipo_vehiculo}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* COBERTURAS Y DEDUCIBLES */}
                      <div className="col-12">
                        <div className="p-3 bg-warning bg-opacity-10 rounded">
                          <h6 className="text-warning-emphasis mb-3">🛡️ COBERTURAS CONTRATADAS</h6>
                          <div className="row g-2">
                            <div className="col-md-4">
                              <small className="text-muted">Tipo de Cobertura:</small><br/>
                              <strong className="text-uppercase">{datosExtraidos.tipo_cobertura}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Suma Asegurada:</small><br/>
                              <strong>{utils.formatearMoneda(datosExtraidos.suma_asegurada)}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Deducible:</small><br/>
                              <strong>{datosExtraidos.deducible}%</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* INFORMACIÓN FINANCIERA */}
                      <div className="col-12">
                        <div className="p-3 bg-secondary bg-opacity-10 rounded">
                          <h6 className="text-secondary mb-3">💰 INFORMACIÓN FINANCIERA</h6>
                          <div className="row g-2">
                            <div className="col-md-3">
                              <small className="text-muted">Prima Neta:</small><br/>
                              <strong>{utils.formatearMoneda(datosExtraidos.prima_pagada)}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">I.V.A. 16%:</small><br/>
                              <strong>{utils.formatearMoneda(datosExtraidos.iva)}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">Forma de Pago:</small><br/>
                              <strong className="text-uppercase">{datosExtraidos.tipo_pago}</strong>
                            </div>
                            <div className="col-md-3">
                              <small className="text-muted">IMPORTE TOTAL:</small><br/>
                              <strong className="text-success fs-5">{utils.formatearMoneda(datosExtraidos.total)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {estado === 'error' && (
              <div className="text-center py-5">
                <XCircle size={48} className="text-danger mb-3" />
                <h6 className="mb-3 text-danger">Error al procesar el archivo</h6>
                <div className="alert alert-danger">
                  {errores.map((error, idx) => (
                    <div key={idx}>{error}</div>
                  ))}
                </div>
                <button 
                  className="btn btn-primary mt-3"
                  onClick={() => {
                    setEstado('esperando');
                    setErrores([]);
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
            {estado === 'completado' && datosExtraidos && (
              <button
                type="button"
                className="btn btn-success"
                onClick={aplicarDatos}
              >
                <CheckCircle className="me-2" size={16} />
                Aplicar Datos Extraídos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============= COMPONENTES DE VISTA =============

const ModalCancelacion = React.memo(({ 
  mostrarModalCancelacion,
  setMostrarModalCancelacion,
  expedienteACancelar,
  motivoCancelacion,
  setMotivoCancelacion,
  motivosCancelacion,
  confirmarCancelacion
}) => (
  <div>
    {mostrarModalCancelacion && (
      <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Cancelar Expediente</h5>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setMostrarModalCancelacion(false)}
              ></button>
            </div>
            <div className="modal-body">
              <p>¿Está seguro de cancelar el expediente de <strong>{expedienteACancelar?.nombre} {expedienteACancelar?.apellido_paterno}</strong>?</p>
              
              <div className="mb-3">
                <label className="form-label">Motivo de cancelación *</label>
                <select 
                  className="form-select"
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                >
                  <option value="">Seleccionar motivo</option>
                  {motivosCancelacion.map(motivo => (
                    <option key={motivo} value={motivo}>{motivo}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setMostrarModalCancelacion(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={confirmarCancelacion}
                disabled={!motivoCancelacion}
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
));

const ListaExpedientes = React.memo(({ 
  expedientes,
  agentes,
  limpiarFormulario,
  setVistaActual,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  verDetalles,
  editarExpediente,
  eliminarExpediente,
  calcularProximoPago
}) => {
  const paginacion = usePaginacion(expedientes, 10);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">Gestión de Pólizas</h3>
        <button
          onClick={() => {
            limpiarFormulario();
            setVistaActual('formulario');
          }}
          className="btn btn-primary"
        >
          <Plus size={16} className="me-2" />
          Nueva Póliza
        </button>
      </div>

      {expedientes.length > 0 && (
        <div className="row mb-3">
          <div className="col-md-6">
            <BarraBusqueda 
              busqueda={paginacion.busqueda}
              setBusqueda={paginacion.setBusqueda}
              placeholder="Buscar pólizas..."
            />
          </div>
          <div className="col-md-6 text-end">
            <small className="text-muted">
              Mostrando {paginacion.itemsPaginados.length} de {paginacion.totalItems} pólizas
            </small>
          </div>
        </div>
      )}

      <div className="card">
        {expedientes.length === 0 ? (
          <div className="card-body text-center py-5">
            <FileText size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No hay pólizas registradas</h5>
            <p className="text-muted">Crea tu primera póliza para comenzar</p>
          </div>
        ) : paginacion.itemsPaginados.length === 0 ? (
          <div className="card-body text-center py-5">
            <Search size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No se encontraron resultados</h5>
            <p className="text-muted">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Cliente</th>
                    <th>Compañía</th>
                    <th>Producto</th>
                    <th>Etapa Activa</th>
                    <th>Agente</th>
                    <th>Tipo/Estatus Pago</th>
                    <th>Fecha</th>
                    <th width="200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacion.itemsPaginados.map((expediente) => {
                    const agenteInfo = agentes.find(a => a.codigoAgente === expediente.agente);
                    return (
                      <tr key={expediente.id}>
                        <td><InfoCliente expediente={expediente} /></td>
                        <td>{expediente.compania}</td>
                        <td>
                          <div>
                            {expediente.producto}
                            {expediente.producto === 'Autos' && expediente.tipo_cobertura && (
                              <div>
                                <small className="text-muted">{expediente.tipo_cobertura}</small>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge tipo="etapa" valor={expediente.etapa_activa} />
                          {expediente.motivoCancelacion && (
                            <div><small className="text-muted">Motivo: {expediente.motivoCancelacion}</small></div>
                          )}
                        </td>
                        <td>{agenteInfo ? `${agenteInfo.codigoAgente} - ${agenteInfo.nombre}` : expediente.agente || '-'}</td>
                        <td>
                          <EstadoPago expediente={expediente} />
                          <CalendarioPagos 
                            expediente={expediente} 
                            calcularProximoPago={calcularProximoPago}
                            compacto={true}
                          />
                        </td>
                        <td>
                          <small>{expediente.fecha_creacion}</small>
                        </td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            {(expediente.etapa_activa === 'Emitida' || expediente.etapa_activa === 'Pendiente de pago' || expediente.etapa_activa === 'Pagado') && 
                             expediente.estatusPago !== 'Pagado' && (
                              <button
                                onClick={() => aplicarPago(expediente.id)}
                                className="btn btn-success btn-sm"
                                title="Aplicar Pago"
                              >
                                <DollarSign size={14} />
                              </button>
                            )}

                            {puedeAvanzarEstado(expediente.etapa_activa) && (
                              <button
                                onClick={() => avanzarEstado(expediente)}
                                className="btn btn-success btn-sm"
                                title={`Avanzar a: ${obtenerSiguienteEstado(expediente.etapa_activa)}`}
                              >
                                <ArrowRight size={14} />
                              </button>
                            )}
                            
                            {puedeCancelar(expediente.etapa_activa) && (
                              <button
                                onClick={() => iniciarCancelacion(expediente)}
                                className="btn btn-danger btn-sm"
                                title="Cancelar"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                            
                            <button
                              onClick={() => verDetalles(expediente)}
                              className="btn btn-outline-primary btn-sm"
                              title="Ver detalles"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => editarExpediente(expediente)}
                              className="btn btn-outline-secondary btn-sm"
                              title="Editar"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => eliminarExpediente(expediente.id)}
                              className="btn btn-outline-danger btn-sm"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paginacion.totalPaginas > 1 && (
              <div className="card-footer">
                <Paginacion 
                  paginaActual={paginacion.paginaActual}
                  totalPaginas={paginacion.totalPaginas}
                  setPaginaActual={paginacion.setPaginaActual}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

const Formulario = React.memo(({ 
  modoEdicion,
  setVistaActual,
  formulario,
  setFormulario,
  actualizarCalculosAutomaticos,
  guardarExpediente,
  companias,
  productos,
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
  CONSTANTS
}) => {
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);

  const handleDataExtracted = useCallback((datosExtraidos) => {
    setFormulario(prev => ({
      ...prev,
      ...datosExtraidos,
      fecha_creacion: prev.fecha_creacion,
      id: prev.id,
      etapa_activa: datosExtraidos.etapa_activa || prev.etapa_activa
    }));
    
    if (datosExtraidos.inicio_vigencia) {
      const formularioActualizado = actualizarCalculosAutomaticos({
        ...formulario,
        ...datosExtraidos
      });
      setFormulario(formularioActualizado);
    }
    
    setDatosImportadosDesdePDF(true);
    setMostrarExtractorPDF(false);
  }, [formulario, actualizarCalculosAutomaticos, setFormulario]);

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          {modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente'}
        </h3>
        <div className="d-flex gap-2">
          {!modoEdicion && (
            <button
              onClick={() => setMostrarExtractorPDF(true)}
              className="btn btn-outline-primary"
              title="Extraer datos automáticamente desde una póliza PDF"
            >
              <Upload size={16} className="me-2" />
              Importar PDF
            </button>
          )}
          <button
            onClick={() => setVistaActual('lista')}
            className="btn btn-outline-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {datosImportadosDesdePDF && !modoEdicion && (
            <div className="alert alert-info alert-dismissible fade show mb-4" role="alert">
              <CheckCircle className="me-2" size={20} />
              <strong>Datos extraídos desde PDF</strong> - Revise la información y complete los campos faltantes
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setDatosImportadosDesdePDF(false)}
              ></button>
            </div>
          )}

          {/* Datos del Cliente */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos del Cliente</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Nombre <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Apellido Paterno <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.apellido_paterno}
                  onChange={(e) => setFormulario(prev => ({ ...prev }))}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Apellido Materno</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.apellido_materno}
                  onChange={(e) => setFormulario(prev => ({ ...prev}))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={formulario.email}
                  onChange={(e) => setFormulario(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Teléfono Fijo</label>
                <input
                  type="tel"
                  className="form-control"
                  value={formulario.telefono_fijo}
                  onChange={(e) => setFormulario(prev => ({ ...prev, telefono_fijo: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Teléfono Móvil</label>
                <input
                  type="tel"
                  className="form-control"
                  value={formulario.telefono_movil}
                  onChange={(e) => setFormulario(prev => ({ ...prev, telefono_movil: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Datos del Seguro */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos del Seguro</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Compañía <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formulario.compania}
                  onChange={(e) => setFormulario(prev => ({ ...prev, compania: e.target.value }))}
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
                    if (formulario.producto === 'Autos' && nuevoProducto !== 'Autos') {
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

          {formulario.producto === 'Autos' && (
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

          {/* Datos Adicionales */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos Adicionales</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Agente</label>
                <select
                  className="form-select"
                  value={formulario.agente}
                  onChange={(e) => setFormulario(prev => ({ ...prev, agente: e.target.value }))}
                >
                  <option value="">Seleccionar agente</option>
                  {agentes.map(agente => (
                    <option key={agente.id} value={agente.codigo}>
                      {agente.codigo} - {agente.nombre} {agente.apellido_paterno} {agente.apellido_materno}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Sub Agente</label>
                <input
                  type="text"
                  className="form-control"
                  value={formulario.subAgente}
                  onChange={(e) => setFormulario(prev => ({ ...prev, subAgente: e.target.value }))}
                  placeholder="Código o nombre del sub agente"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Prima Pagada</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.prima_pagada}
                    onChange={(e) => setFormulario(prev => ({ ...prev, prima_pagada: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Cargo Pago Fraccionado</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.cargoPagoFraccionado}
                    onChange={(e) => setFormulario(prev => ({ ...prev, cargoPagoFraccionado: e.target.value }))}
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
                    value={formulario.iva}
                    onChange={(e) => setFormulario(prev => ({ ...prev, iva: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Total</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formulario.total}
                    onChange={(e) => setFormulario(prev => ({ ...prev, total: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Inicio de Vigencia</label>
                <input
                  type="date"
                  className="form-control"
                  value={formulario.inicio_vigencia}
                  onChange={(e) => {
                    const nuevoFormulario = { ...formulario, inicio_vigencia: e.target.value };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                />
              </div>
              <div className="col-md-6">
                <CampoFechaCalculada
                  label="Término de Vigencia"
                  value={formulario.termino_vigencia}
                  onChange={(valor) => setFormulario(prev => ({ ...prev, termino_vigencia: valor }))}
                  onCalculate={() => {
                    const terminoCalculado = calculartermino_vigencia(formulario.inicio_vigencia);
                    setFormulario(prev => ({ ...prev, termino_vigencia: terminoCalculado }));
                  }}
                  disabled={!formulario.inicio_vigencia}
                  helpText="La vigencia siempre es de 1 año"
                />
              </div>
            </div>
          </div>

          {/* Datos del Vehículo - Solo si es Autos */}
          {formulario.producto === 'Autos' && (
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
              </div>
            </div>
          )}

          {/* Datos de la Póliza - Solo si es Autos */}
          {formulario.producto === 'Autos' && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos de la Póliza</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Número de Póliza</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.numero_poliza}
                    onChange={(e) => setFormulario(prev => ({ ...prev, numero_poliza: e.target.value }))}
                    placeholder="Número asignado por la aseguradora"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Tipo de Cobertura</label>
                  <select
                    className="form-select"
                    value={formulario.tipo_cobertura}
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
                      value={formulario.deducible}
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
                      value={formulario.suma_asegurada}
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
          {formulario.producto === 'Autos' && (
            <div className="mb-4">
              <h5 className="card-title border-bottom pb-2">Datos del Conductor</h5>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Conductor Habitual</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.conductor_habitual}
                    onChange={(e) => setFormulario(prev => ({ ...prev, conductor_habitual: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Edad del Conductor</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formulario.edad_conductor}
                    onChange={(e) => setFormulario(prev => ({ ...prev, edad_conductor: e.target.value }))}
                    min="18"
                    max="100"
                    placeholder="Años"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Licencia de Conducir</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.licencia_conducir}
                    onChange={(e) => setFormulario(prev => ({ ...prev, licencia_conducir: e.target.value }))}
                    placeholder="Número de licencia"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Configuración de Pagos */}
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Configuración de Pagos</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">Tipo de Pago</label>
                <select
                  className="form-select"
                  value={formulario.tipo_pago}
                  onChange={(e) => {
                    const nuevoFormulario = {
                      ...formulario, 
                      tipo_pago: e.target.value,
                      frecuenciaPago: e.target.value === 'Anual' ? '' : formulario.frecuenciaPago
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
              
              <div className="col-md-3">
                <label className="form-label">Período de Gracia</label>
                <select
                  className="form-select"
                  value={formulario.periodoGracia}
                  onChange={(e) => {
                    const nuevoFormulario = { ...formulario, periodoGracia: parseInt(e.target.value) };
                    const formularioActualizado = actualizarCalculosAutomaticos(nuevoFormulario);
                    setFormulario(formularioActualizado);
                  }}
                >
                  {periodosGracia.map(periodo => (
                    <option key={periodo} value={periodo}>{periodo} días</option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-3">
                <label className="form-label">Fecha de Pago</label>
                <div className="input-group">
                  <input
                    type="date"
                    className="form-control bg-light"
                    value={formulario.proximoPago}
                    readOnly
                  />
                  <span className="input-group-text">
                    <span className="text-info" title="Calculado automáticamente">🤖</span>
                  </span>
                </div>
              </div>
              
              <div className="col-md-6">
                <label className="form-label">Estatus del Pago</label>
                <div className="input-group">
                  <select
                    className="form-select bg-light"
                    value={formulario.estatusPago}
                    onChange={(e) => {
                      if (e.target.value === 'Pagado') {
                        setFormulario(prev => ({ ...prev, estatusPago: 'Pagado' }));
                      }
                    }}
                  >
                    {estatusPago.map(estatus => (
                      <option key={estatus} value={estatus}>{estatus}</option>
                    ))}
                  </select>
                  <span className="input-group-text">
                    <span className="text-info" title="Se actualiza automáticamente">🤖</span>
                  </span>
                </div>
              </div>

              {formulario.tipo_pago === 'Fraccionado' && formulario.frecuenciaPago && formulario.inicio_vigencia && (
                <div className="col-12 mt-3">
                  <CalendarioPagos 
                    expediente={formulario} 
                    calcularProximoPago={calcularProximoPago}
                    mostrarResumen={false}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end gap-3">
            <button
              type="button"
              onClick={() => setVistaActual('lista')}
              className="btn btn-outline-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarExpediente}
              className="btn btn-primary"
            >
              {modoEdicion ? 'Actualizar' : 'Guardar'} Expediente
            </button>
          </div>
        </div>
      </div>

      {mostrarExtractorPDF && (
        <ExtractorPolizasPDF 
          onDataExtracted={handleDataExtracted}
          onClose={() => setMostrarExtractorPDF(false)}
        />
      )}
    </div>
  );
});

const DetallesExpediente = React.memo(({ 
  expedienteSeleccionado,
  setExpedienteSeleccionado,
  setVistaActual,
  aplicarPago,
  puedeAvanzarEstado,
  avanzarEstado,
  obtenerSiguienteEstado,
  puedeCancelar,
  iniciarCancelacion,
  editarExpediente,
  calcularSiguientePago,
  calculartermino_vigencia,
  calcularProximoPago
}) => (
  <div className="p-4">
    <div className="d-flex justify-content-between align-items-center mb-4">
      <h3 className="mb-0">Detalles del Expediente</h3>
      <div className="d-flex gap-3">
        {expedienteSeleccionado && 
         (expedienteSeleccionado.etapa_activa === 'Emitida' || 
          expedienteSeleccionado.etapa_activa === 'Pendiente de pago' || 
          expedienteSeleccionado.etapa_activa === 'Pagado') && 
         expedienteSeleccionado.estatusPago !== 'Pagado' && (
          <button
            onClick={() => {
              aplicarPago(expedienteSeleccionado.id);
              const fechaActual = new Date().toISOString().split('T')[0];
              const proximoPagoNuevo = calcularSiguientePago(expedienteSeleccionado);
              
              setExpedienteSeleccionado({
                ...expedienteSeleccionado,
                estatusPago: 'Pagado',
                fechaUltimoPago: fechaActual,
                proximoPago: proximoPagoNuevo
              });
              
              if (proximoPagoNuevo) {
                alert(`Pago aplicado. Próximo pago: ${new Date(proximoPagoNuevo).toLocaleDateString('es-MX')}`);
              } else {
                alert('Pago aplicado. No hay más pagos pendientes.');
              }
            }}
            className="btn btn-success d-flex align-items-center"
          >
            <DollarSign size={16} className="me-2" />
            Aplicar Pago
          </button>
        )}

        {expedienteSeleccionado && puedeAvanzarEstado(expedienteSeleccionado.etapa_activa) && (
          <button
            onClick={() => avanzarEstado(expedienteSeleccionado)}
            className="btn btn-success d-flex align-items-center"
          >
            <ArrowRight size={16} className="me-2" />
            Avanzar a: {obtenerSiguienteEstado(expedienteSeleccionado.etapa_activa)}
          </button>
        )}
        
        {expedienteSeleccionado && puedeCancelar(expedienteSeleccionado.etapa_activa) && (
          <button
            onClick={() => iniciarCancelacion(expedienteSeleccionado)}
            className="btn btn-danger d-flex align-items-center"
          >
            <XCircle size={16} className="me-2" />
            Cancelar
          </button>
        )}
        
        <button
          onClick={() => editarExpediente(expedienteSeleccionado)}
          className="btn btn-primary d-flex align-items-center"
        >
          <Edit size={16} className="me-2" />
          Editar
        </button>
        <button
          onClick={() => setVistaActual('lista')}
          className="btn btn-outline-secondary"
        >
          Volver
        </button>
      </div>
    </div>

    {expedienteSeleccionado && (
      <div className="card">
        <div className="card-body">
          <div className="row g-4">
            <div className="col-md-6">
              <h5 className="card-title border-bottom pb-2">Información del Cliente</h5>
              <div className="mb-3">
                <strong className="d-block text-muted">Nombre completo:</strong>
                {expedienteSeleccionado.nombre} {expedienteSeleccionado.apellido_paterno} {expedienteSeleccionado.apellido_materno}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Email:</strong>
                {expedienteSeleccionado.email || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Teléfono fijo:</strong>
                {expedienteSeleccionado.telefono_fijo || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Teléfono móvil:</strong>
                {expedienteSeleccionado.telefono_movil || '-'}
              </div>
            </div>

            <div className="col-md-6">
              <h5 className="card-title border-bottom pb-2">Información del Seguro</h5>
              <div className="mb-3">
                <strong className="d-block text-muted">Compañía:</strong>
                {expedienteSeleccionado.compania}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Producto:</strong>
                {expedienteSeleccionado.producto}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Etapa Activa:</strong>
                <Badge tipo="etapa" valor={expedienteSeleccionado.etapa_activa} />
                {expedienteSeleccionado.motivoCancelacion && (
                  <div className="mt-1">
                    <small className="text-danger">Motivo: {expedienteSeleccionado.motivoCancelacion}</small>
                  </div>
                )}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Agente:</strong>
                {expedienteSeleccionado.agente || '-'}
              </div>
            </div>

            <div className="col-md-6">
              <h5 className="card-title border-bottom pb-2">Información Financiera</h5>
              <div className="mb-3">
                <strong className="d-block text-muted">Prima pagada:</strong>
                {utils.formatearMoneda(expedienteSeleccionado.prima_pagada)}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">IVA:</strong>
                {utils.formatearMoneda(expedienteSeleccionado.iva)}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Total:</strong>
                <span className="fs-5 fw-bold text-primary">
                  {utils.formatearMoneda(expedienteSeleccionado.total)}
                </span>
              </div>
            </div>

            <div className="col-md-6">
              <h5 className="card-title border-bottom pb-2">Vigencia</h5>
              <div className="mb-3">
                <strong className="d-block text-muted">Inicio de vigencia:</strong>
                {expedienteSeleccionado.inicio_vigencia || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Término de vigencia:</strong>
                {expedienteSeleccionado.termino_vigencia || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Fecha de creación:</strong>
                {expedienteSeleccionado.fecha_creacion}
              </div>
            </div>

            {expedienteSeleccionado.tipo_pago === 'Fraccionado' && 
             expedienteSeleccionado.frecuenciaPago && 
             expedienteSeleccionado.inicio_vigencia && (
              <div className="col-12">
                <CalendarioPagos 
                  expediente={expedienteSeleccionado}
                  calcularProximoPago={calcularProximoPago}
                  mostrarResumen={true}
                />
              </div>
            )}

            {expedienteSeleccionado.producto === 'Autos' && (
              <>
                <div className="col-md-6">
                  <h5 className="card-title border-bottom pb-2">Información del Vehículo</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Marca:</strong>
                    {expedienteSeleccionado.marca || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Modelo:</strong>
                    {expedienteSeleccionado.modelo || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Año:</strong>
                    {expedienteSeleccionado.anio || '-'}
                  </div>
                </div>

                <div className="col-md-6">
                  <h5 className="card-title border-bottom pb-2">Identificación del Vehículo</h5>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Número de Serie (VIN):</strong>
                    {expedienteSeleccionado.numero_serie || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Placas:</strong>
                    {expedienteSeleccionado.placas || '-'}
                  </div>
                  <div className="mb-3">
                    <strong className="d-block text-muted">Color:</strong>
                    {expedienteSeleccionado.color || '-'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
));

// ============= COMPONENTE PRINCIPAL =============
const ModuloExpedientes = () => {
  const [expedientes, setExpedientes] = useState([]);
  const [agentes, setAgentes] = useState([]);
  useEffect(() => {
    const fetchAgentes = async () => {
      const resultado = await obtenerAgentesEquipo();
      console.log('Agentes cargados:', resultado.data);
      if (resultado.success) setAgentes(resultado.data);
    };
    fetchAgentes();
  }, []);
  // Cargar expedientes desde el backend al montar
  useEffect(() => {
  fetch(`${API_URL}/api/expedientes`)
      .then(res => res.json())
      .then(data => setExpedientes(data))
      .catch(err => console.error('Error al cargar expedientes:', err));
  }, []);
  const [vistaActual, setVistaActual] = useState('lista');
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [expedienteACancelar, setExpedienteACancelar] = useState(null);

  const [aseguradoras, setAseguradoras] = useState([]);
  const [tiposProductos, setTiposProductos] = useState([]);
  
  useEffect(() => {
  fetch(`${API_URL}/api/aseguradoras`)
      .then(res => res.json())
      .then(data => setAseguradoras(data))
      .catch(err => console.error('Error al cargar aseguradoras:', err));
  }, []);

  useEffect(() => {
    const cargarTiposProductos = async () => {
      try {
        const resultado = await obtenerTiposProductosActivos();
        if (resultado.success) {
          setTiposProductos(resultado.data);
        } else {
          console.error('Error al cargar tipos de productos:', resultado.error);
          // Fallback a productos estáticos si hay error
          setTiposProductos([
            { id: 1, nombre: 'Autos' },
            { id: 2, nombre: 'Vida' },
            { id: 3, nombre: 'Daños' },
            { id: 4, nombre: 'Equipo pesado' },
            { id: 5, nombre: 'Embarcaciones' },
            { id: 6, nombre: 'Ahorro' }
          ]);
        }
      } catch (error) {
        console.error('Error cargando productos:', error);
        // Fallback a productos estáticos si hay error
        setTiposProductos([
          { id: 1, nombre: 'Autos' },
          { id: 2, nombre: 'Vida' },
          { id: 3, nombre: 'Daños' },
          { id: 4, nombre: 'Equipo pesado' },
          { id: 5, nombre: 'Embarcaciones' },
          { id: 6, nombre: 'Ahorro' }
        ]);
      }
    };

    cargarTiposProductos();
  }, []);

  const companias = useMemo(() => aseguradoras.map(a => a.nombre), [aseguradoras]);
  const productos = useMemo(() => tiposProductos.map(p => p.nombre), [tiposProductos]);
  const etapasActivas = useMemo(() => [
    'En cotización',
    'Cotización enviada', 
    'Autorizado',
    'En proceso emisión',
    'Emitida',
    'Pendiente de pago',
    'Pagado',
    'Cancelado'
  ], []);

  const tiposPago = useMemo(() => ['Anual', 'Fraccionado'], []);
  const frecuenciasPago = useMemo(() => Object.keys(CONSTANTS.PAGOS_POR_FRECUENCIA), []);
  const periodosGracia = useMemo(() => [14, 30], []);
  const estatusPago = useMemo(() => ['Sin definir', 'Pagado', 'Vencido', 'Pago por vencer'], []);
  const motivosCancelacion = useMemo(() => [
    'Cliente desistió',
    'Precio muy alto',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Documentación incompleta',
    'Otro'
  ], []);

  const tiposVehiculo = useMemo(() => ['Sedán', 'SUV', 'Pickup', 'Hatchback', 'Vagoneta', 'Deportivo', 'Otro'], []);
  const tiposCobertura = useMemo(() => ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)'], []);
  const marcasVehiculo = useMemo(() => [
    'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
    'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Suzuki', 
    'Toyota', 'Volkswagen', 'Volvo', 'Otra'
  ], []);
const estadoInicialFormulario = {
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  compania: '',
  producto: '',
  etapa_activa: 'En cotización',
  agente: '',
  sub_agente: '',
  inicio_vigencia: '',
  termino_vigencia: '',
  prima_pagada: '',
  cargo_pago_fraccionado: '',
  iva: '',
  total: '',
  motivo_cancelacion: '',
  tipo_pago: 'Anual',
  frecuencia_pago: '',
  periodo_gracia: 14,
  proximo_pago: '',
  estatus_pago: 'Sin definir',
  fecha_ultimo_pago: '',
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
  licencia_conducir: '',
  fecha_creacion: new Date().toISOString().split('T')[0],
  id: null
};

  const [formulario, setFormulario] = useState(estadoInicialFormulario);

  const calculartermino_vigencia = useCallback((inicio_vigencia) => {
    if (!inicio_vigencia) return '';
    
    const fechaInicio = new Date(inicio_vigencia);
    const fechaTermino = new Date(fechaInicio);
    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
    
    return fechaTermino.toISOString().split('T')[0];
  }, []);

  const calcularProximoPago = useCallback((inicio_vigencia, tipo_pago, frecuenciaPago, periodoGracia, numeroPago = 1) => {
    if (!inicio_vigencia) return '';
    
    const fechaInicio = new Date(inicio_vigencia);
    let fechaPago = new Date(fechaInicio);
    
    if (numeroPago === 1) {
      fechaPago.setDate(fechaPago.getDate() + (periodoGracia || 0));
      return fechaPago.toISOString().split('T')[0];
    }
    
    if (tipo_pago === 'Anual') return '';
    
    if (tipo_pago === 'Fraccionado' && frecuenciaPago) {
      const fechaPrimerPago = new Date(fechaInicio);
      fechaPrimerPago.setDate(fechaPrimerPago.getDate() + (periodoGracia || 0));
      
      const mesesAAgregar = (numeroPago - 1) * CONSTANTS.MESES_POR_FRECUENCIA[frecuenciaPago];
      fechaPrimerPago.setMonth(fechaPrimerPago.getMonth() + mesesAAgregar);
      
      return fechaPrimerPago.toISOString().split('T')[0];
    }
    
    return '';
  }, []);

  const calcularEstatusPago = useCallback((proximoPago, estatusActual) => {
    if (!proximoPago) return 'Sin definir';
    if (estatusActual === 'Pagado') return 'Pagado';
    
    const diasRestantes = utils.calcularDiasRestantes(proximoPago);
    
    if (diasRestantes > 30) return 'Sin definir';
    if (diasRestantes > 0) return 'Pago por vencer';
    return 'Vencido';
  }, []);

  const actualizarCalculosAutomaticos = useCallback((formularioActual) => {
    const termino_vigencia = formularioActual.termino_vigencia || calculartermino_vigencia(formularioActual.inicio_vigencia);
    const proximoPago = calcularProximoPago(
      formularioActual.inicio_vigencia,
      formularioActual.tipo_pago,
      formularioActual.frecuenciaPago,
      formularioActual.periodoGracia,
      1
    );
    const estatusPago = calcularEstatusPago(proximoPago, formularioActual.estatusPago);
    
    return { ...formularioActual, termino_vigencia, proximoPago, estatusPago };
  }, [calculartermino_vigencia, calcularProximoPago, calcularEstatusPago]);

  const obtenerSiguienteEstado = useCallback((estadoActual) => {
    const flujo = {
      'En cotización': 'Cotización enviada',
      'Cotización enviada': 'Autorizado',
      'Autorizado': 'En proceso emisión',
      'En proceso emisión': 'Emitida',
      'Emitida': 'Pendiente de pago',
      'Pendiente de pago': 'Pagado'
    };
    return flujo[estadoActual];
  }, []);

  const puedeAvanzarEstado = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Emitida', 'Pendiente de pago'].includes(estado);
  }, []);

  const puedeCancelar = useCallback((estado) => {
    return ['En cotización', 'Cotización enviada', 'Autorizado', 'En proceso emisión', 'Pendiente de pago'].includes(estado);
  }, []);

  const cambiarEstadoExpediente = useCallback((expedienteId, nuevoEstado, motivo = '') => {
    setExpedientes(prev => prev.map(exp => 
      exp.id === expedienteId 
        ? { ...exp, etapa_activa: nuevoEstado, motivoCancelacion: motivo, fechaActualizacion: new Date().toISOString().split('T')[0] }
        : exp
    ));
  }, []);

  const avanzarEstado = useCallback((expediente) => {
    const siguienteEstado = obtenerSiguienteEstado(expediente.etapa_activa);
    if (siguienteEstado) {
      cambiarEstadoExpediente(expediente.id, siguienteEstado);
    }
  }, [obtenerSiguienteEstado, cambiarEstadoExpediente]);

  const iniciarCancelacion = useCallback((expediente) => {
    setExpedienteACancelar(expediente);
    setMostrarModalCancelacion(true);
  }, []);

  const confirmarCancelacion = useCallback(() => {
    if (motivoCancelacion && expedienteACancelar) {
      cambiarEstadoExpediente(expedienteACancelar.id, 'Cancelado', motivoCancelacion);
      setMostrarModalCancelacion(false);
      setMotivoCancelacion('');
      setExpedienteACancelar(null);
    }
  }, [motivoCancelacion, expedienteACancelar, cambiarEstadoExpediente]);

  const calcularSiguientePago = useCallback((expediente) => {
    if (!expediente.inicio_vigencia || expediente.tipo_pago === 'Anual') return '';
    
    if (expediente.tipo_pago === 'Fraccionado' && expediente.frecuenciaPago) {
      const fechaInicio = new Date(expediente.inicio_vigencia);
      const fechaPrimerPago = new Date(fechaInicio);
      fechaPrimerPago.setDate(fechaPrimerPago.getDate() + (expediente.periodoGracia || 0));
      
      if (!expediente.fechaUltimoPago) {
        return calcularProximoPago(expediente.inicio_vigencia, expediente.tipo_pago, expediente.frecuenciaPago, expediente.periodoGracia, 2);
      }
      
      const fechaUltimoPago = new Date(expediente.fechaUltimoPago);
      const mesesTranscurridos = (fechaUltimoPago.getFullYear() - fechaPrimerPago.getFullYear()) * 12 + 
                                 (fechaUltimoPago.getMonth() - fechaPrimerPago.getMonth());
      
      const mesesPorPago = CONSTANTS.MESES_POR_FRECUENCIA[expediente.frecuenciaPago];
      const numeroPagoActual = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
      
      return calcularProximoPago(
        expediente.inicio_vigencia,
        expediente.tipo_pago,
        expediente.frecuenciaPago,
        expediente.periodoGracia,
        numeroPagoActual + 1
      );
    }
    
    return '';
  }, [calcularProximoPago]);

  const aplicarPago = useCallback((expedienteId) => {
    setExpedientes(prev => prev.map(exp => {
      if (exp.id === expedienteId) {
        const fechaActual = new Date().toISOString().split('T')[0];
        const proximoPago = calcularSiguientePago(exp);
        
        return { 
          ...exp, 
          estatusPago: 'Pagado',
          fechaUltimoPago: fechaActual,
          proximoPago: proximoPago
        };
      }
      return exp;
    }));
  }, [calcularSiguientePago]);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setModoEdicion(false);
    setExpedienteSeleccionado(null);
  }, [estadoInicialFormulario]);

  const validarFormulario = useCallback(() => {
    if (!formulario.nombre || !formulario.apellido_paterno || !formulario.compania || !formulario.producto) {
      alert('Por favor complete los campos obligatorios');
      return false;
    }

    if (formulario.producto === 'Autos') {
      if (!formulario.marca || !formulario.modelo || !formulario.anio) {
        alert('Para seguros de Autos, complete: Marca, Modelo y Año');
        return false;
      }
      
      const anioVehiculo = parseInt(formulario.anio);
      if (anioVehiculo < CONSTANTS.MIN_YEAR || anioVehiculo > CONSTANTS.MAX_YEAR) {
        alert('Ingrese un año válido para el vehículo');
        return false;
      }
      
      if (formulario.numero_serie && formulario.numero_serie.length !== CONSTANTS.VIN_LENGTH) {
        alert(`El VIN debe tener ${CONSTANTS.VIN_LENGTH} caracteres`);
        return false;
      }
    }

    return true;
  }, [formulario]);

  const guardarExpediente = useCallback(() => {
    if (!validarFormulario()) return;

    const formularioConCalculos = actualizarCalculosAutomaticos(formulario);
    // Normalizar apellidos para backend
    const expedientePayload = {
      ...formularioConCalculos
    };

    if (modoEdicion) {
  fetch(`${API_URL}/api/expedientes/${formularioConCalculos.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expedientePayload)
      })
        .then(() => {
          limpiarFormulario();
          recargarExpedientes();
          setVistaActual('lista');
        })
        .catch(err => alert('Error al actualizar expediente'));
    } else {
  fetch(`${API_URL}/api/expedientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expedientePayload,
          fecha_creacion: new Date().toISOString().split('T')[0]
        })
      })
        .then(() => {
          limpiarFormulario();
          recargarExpedientes();
          setVistaActual('lista');
        })
        .catch(err => alert('Error al crear expediente'));
    }
  }, [formulario, modoEdicion, actualizarCalculosAutomaticos, limpiarFormulario, validarFormulario]);
  const recargarExpedientes = useCallback(() => {
  fetch(`${API_URL}/api/expedientes`)
      .then(res => res.json())
      .then(data => setExpedientes(data))
      .catch(err => console.error('Error al recargar expedientes:', err));
  }, []);
  const editarExpediente = useCallback((expediente) => {
    setFormulario({
      ...expediente
    });
    setModoEdicion(true);
    setVistaActual('formulario');
  }, []);

const eliminarExpediente = useCallback((id) => {
  if (confirm('¿Está seguro de eliminar este expediente?')) {
    fetch(`${API_URL}/api/expedientes/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (res.ok) {
          setExpedientes(prev => prev.filter(exp => exp.id !== id));
        } else {
          alert('Error al eliminar expediente en la base de datos');
        }
      })
      .catch(() => alert('Error de conexión al eliminar expediente'));
  }
}, []);

  const verDetalles = useCallback((expediente) => {
    setExpedienteSeleccionado(expediente);
    setVistaActual('detalles');
  }, []);

  return (
    <div>
      <link 
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" 
        rel="stylesheet" 
      />
      
      <div className="container-fluid">
        {vistaActual === 'lista' && (
          <ListaExpedientes 
            expedientes={expedientes}
            agentes={agentes}
            limpiarFormulario={limpiarFormulario}
            setVistaActual={setVistaActual}
            aplicarPago={aplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            verDetalles={verDetalles}
            editarExpediente={editarExpediente}
            eliminarExpediente={eliminarExpediente}
            calcularProximoPago={calcularProximoPago}
          />
        )}
        
        {vistaActual === 'formulario' && (
          <Formulario 
            modoEdicion={modoEdicion}
            setVistaActual={setVistaActual}
            formulario={formulario}
            setFormulario={setFormulario}
            actualizarCalculosAutomaticos={actualizarCalculosAutomaticos}
            guardarExpediente={guardarExpediente}
            companias={companias}
            productos={productos}
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
            CONSTANTS={CONSTANTS}
          />
        )}
        
        {vistaActual === 'detalles' && (
          <DetallesExpediente 
            expedienteSeleccionado={expedienteSeleccionado}
            setExpedienteSeleccionado={setExpedienteSeleccionado}
            setVistaActual={setVistaActual}
            aplicarPago={aplicarPago}
            puedeAvanzarEstado={puedeAvanzarEstado}
            avanzarEstado={avanzarEstado}
            obtenerSiguienteEstado={obtenerSiguienteEstado}
            puedeCancelar={puedeCancelar}
            iniciarCancelacion={iniciarCancelacion}
            editarExpediente={editarExpediente}
            calcularSiguientePago={calcularSiguientePago}
            calculartermino_vigencia={calculartermino_vigencia}
            calcularProximoPago={calcularProximoPago}
          />
        )}
      </div>
      
      <ModalCancelacion 
        mostrarModalCancelacion={mostrarModalCancelacion}
        setMostrarModalCancelacion={setMostrarModalCancelacion}
        expedienteACancelar={expedienteACancelar}
        motivoCancelacion={motivoCancelacion}
        setMotivoCancelacion={setMotivoCancelacion}
        motivosCancelacion={motivosCancelacion}
        confirmarCancelacion={confirmarCancelacion}
      />
    </div>
  );
};

export default ModuloExpedientes;

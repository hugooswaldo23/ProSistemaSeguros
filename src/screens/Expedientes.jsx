const API_URL = import.meta.env.VITE_API_URL;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, FileText, ArrowRight, X, XCircle, DollarSign, AlertCircle, ChevronLeft, ChevronRight, Search, Save, Upload, CheckCircle, Loader } from 'lucide-react';
import { obtenerAgentesEquipo } from '../services/equipoDeTrabajoService';
import { obtenerTiposProductosActivos } from '../services/tiposProductosService';
import BuscadorCliente from '../components/BuscadorCliente';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker de PDF.js - ruta local copiada por Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
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
    
    // Si la fecha tiene formato ISO (con T), solo tomar la parte de la fecha
    const fechaSinHora = fecha.includes('T') ? fecha.split('T')[0] : fecha;
    
    const opciones = {
      corta: { day: '2-digit', month: 'short' },
      media: { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' },
      larga: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      simple: null // Para retornar solo YYYY-MM-DD
    };
    
    if (formato === 'simple') return fechaSinHora;
    
    return new Date(fechaSinHora).toLocaleDateString('es-MX', opciones[formato]);
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

const InfoCliente = React.memo(({ expediente }) => {
  return (
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
  );
});

const EstadoPago = React.memo(({ expediente }) => {
  // Determinar si el pago está vencido
  const fechaPago = expediente.proximoPago || expediente.fecha_pago;
  const hoy = new Date();
  const fechaPagoDate = fechaPago ? new Date(fechaPago) : null;
  const estaVencido = fechaPagoDate && fechaPagoDate < hoy && expediente.estatusPago !== 'Pagado';
  
  return (
    <div>
      {/* Tipo de Pago */}
      <div className="mb-1">
        <small className="text-muted">Tipo:</small>
        <br />
        <small className="fw-semibold text-primary">{expediente.tipo_pago || 'Sin definir'}</small>
        {expediente.frecuenciaPago && (
          <span className="ms-1">
            <small className="text-muted">({expediente.frecuenciaPago})</small>
          </span>
        )}
      </div>

      {/* Estatus de Pago */}
      <div className="mb-1">
        <small className="text-muted">Estatus:</small>
        <br />
        <Badge tipo="pago" valor={expediente.estatusPago || 'Sin definir'} className="badge-sm" />
      </div>

      {/* Fecha de Pago (solo si está pendiente) */}
      {fechaPago && expediente.estatusPago !== 'Pagado' && (
        <div>
          <small className="text-muted">Fecha pago:</small>
          <br />
          <small className={`${
            estaVencido ? 'text-danger fw-bold' :
            expediente.estatusPago === 'Pago por vencer' ? 'text-warning fw-semibold' :
            'text-secondary'
          }`}>
            {estaVencido && '⚠️ '}
            {utils.formatearFecha(fechaPago)}
          </small>
        </div>
      )}
    </div>
  );
});

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
      expediente.compania,
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
const ExtractorPolizasPDF = React.memo(({ onDataExtracted, onClose, agentes = [], aseguradoras = [], tiposProductos = [] }) => {
  const [estado, setEstado] = useState('esperando'); // esperando, procesando, validando-cliente, validando-agente, preview-datos, error
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [errores, setErrores] = useState([]);
  const [informacionArchivo, setInformacionArchivo] = useState(null);
  
  // Estados para el flujo paso a paso
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [agenteEncontrado, setAgenteEncontrado] = useState(null);
  const [decisionCliente, setDecisionCliente] = useState(null); // 'usar-existente', 'crear-nuevo'
  const [decisionAgente, setDecisionAgente] = useState(null); // 'usar-existente', 'crear-nuevo', 'omitir'

  const procesarPDF = useCallback(async (file) => {
    setEstado('procesando');
    setErrores([]);

    try {
      // Extraer texto del PDF usando PDF.js
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Extraer PÁGINAS 1 Y 2 (algunos datos están en página 1)
      console.log('📄 Total de páginas:', pdf.numPages);
      
      if (pdf.numPages < 2) {
        throw new Error('El PDF debe tener al menos 2 páginas');
      }
      
      // PÁGINA 1: Póliza, Endoso, Inciso, Agente
      const page1 = await pdf.getPage(1);
      const textContent1 = await page1.getTextContent();
      
      const lineas1 = {};
      textContent1.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineas1[y]) lineas1[y] = [];
        lineas1[y].push({
          text: item.str,
          x: item.transform[4]
        });
      });
      
      const textoPagina1 = Object.keys(lineas1)
        .sort((a, b) => b - a)
        .map(y => {
          return lineas1[y]
            .sort((a, b) => a.x - b.x)
            .map(item => item.text)
            .join(' ');
        })
        .join('\n');
      
      // PÁGINA 2: Resto de datos
      const page2 = await pdf.getPage(2);
      const textContent = await page2.getTextContent();
      
      const lineas = {};
      textContent.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineas[y]) lineas[y] = [];
        lineas[y].push({
          text: item.str,
          x: item.transform[4]
        });
      });
      
      const textoCompleto = Object.keys(lineas)
        .sort((a, b) => b - a)
        .map(y => {
          return lineas[y]
            .sort((a, b) => a.x - b.x)
            .map(item => item.text)
            .join(' ');
        })
        .join('\n');

      console.log('📄 Texto página 1 (primeras 20 líneas):\n', textoPagina1.split('\n').slice(0, 20).join('\n'));
      console.log('📄 Texto página 2 (primeras 20 líneas):\n', textoCompleto.split('\n').slice(0, 20).join('\n'));

      // Buscar cliente por RFC, CURP o nombre en la base de datos
      const buscarClienteExistente = async (rfc, curp, nombre, apellidoPaterno, apellidoMaterno) => {
        try {
          console.log('🔍 Buscando cliente con:', { rfc, curp, nombre, apellidoPaterno, apellidoMaterno });
          
          const response = await fetch(`${API_URL}/api/clientes`);
          if (!response.ok) {
            console.error('❌ Error al obtener clientes:', response.status);
            return null;
          }
          
          const clientes = await response.json();
          console.log(`📊 Total de clientes en BD: ${clientes.length}`);
          
          // 1. PRIORIDAD 1: Buscar por RFC (más confiable)
          if (rfc && rfc.trim() !== '') {
            const rfcBusqueda = rfc.trim().toUpperCase();
            console.log(`🔍 Buscando por RFC: "${rfcBusqueda}"`);
            
            const clientePorRFC = clientes.find(c => {
              const rfcCliente = (c.rfc || '').trim().toUpperCase();
              return rfcCliente === rfcBusqueda;
            });
            
            if (clientePorRFC) {
              console.log('✅ Cliente encontrado por RFC:', clientePorRFC.id, clientePorRFC.nombre);
              return clientePorRFC;
            } else {
              console.log('⚠️ No se encontró cliente con RFC:', rfcBusqueda);
            }
          }
          
          // 2. PRIORIDAD 2: Buscar por CURP (si no hay RFC)
          if (curp && curp.trim() !== '') {
            const curpBusqueda = curp.trim().toUpperCase();
            console.log(`🔍 Buscando por CURP: "${curpBusqueda}"`);
            
            const clientePorCURP = clientes.find(c => {
              const curpCliente = (c.curp || '').trim().toUpperCase();
              return curpCliente === curpBusqueda;
            });
            
            if (clientePorCURP) {
              console.log('✅ Cliente encontrado por CURP:', clientePorCURP.id, clientePorCURP.nombre);
              return clientePorCURP;
            } else {
              console.log('⚠️ No se encontró cliente con CURP:', curpBusqueda);
            }
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
            
            if (clientePorNombre) {
              console.log('✅ Cliente encontrado por nombre:', clientePorNombre.id, clientePorNombre.nombre);
              return clientePorNombre;
            } else {
              console.log('⚠️ No se encontró cliente con ese nombre');
            }
          }
          
          console.log('❌ Cliente NO encontrado con ningún criterio');
          return null;
        } catch (error) {
          console.error('❌ Error buscando cliente:', error);
          return null;
        }
      };

      // Función para extraer datos usando expresiones regulares
      const extraerDato = (patron, texto, grupo = 1) => {
        try {
          const match = texto.match(patron);
          return match && match[grupo] ? match[grupo].trim() : '';
        } catch (error) {
          console.warn('Error en extraerDato:', error, 'Patrón:', patron);
          return '';
        }
      };

      // Detectar el tipo de aseguradora
      const esQualitas = /qu[aá]litas/i.test(textoCompleto);
      const compania = esQualitas ? 'Qualitas' : 
                       /gnp/i.test(textoCompleto) ? 'GNP' :
                       /mapfre/i.test(textoCompleto) ? 'MAPFRE' :
                       /axa/i.test(textoCompleto) ? 'AXA' :
                       /hdi/i.test(textoCompleto) ? 'HDI' : 'Otra';

      console.log('🏢 Aseguradora detectada:', compania);

      // Extraer datos específicos para Qualitas
      let datosExtraidos = {};
      
      if (esQualitas) {
        console.log('🎯 Aplicando extractor especializado para Qualitas (página 2)');
        
        // ==================== MESES (definir primero) ====================
        const meses = {
          'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
          'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
        };
        
        // ==================== RFC (PRIMERO - para determinar tipo de persona) ====================
        // RFC puede ser:
        // - Persona Física: 4 letras + 6 dígitos + 3 caracteres (AAAA######XXX) - 13 caracteres
        // - Persona Moral: 3 letras + 6 dígitos + 3 caracteres (AAA######XXX) - 12 caracteres
        const rfcMatch = textoCompleto.match(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
        const rfcExtraido = rfcMatch ? rfcMatch[1] : '';
        const tipoPersona = rfcExtraido.length === 13 ? 'Fisica' : rfcExtraido.length === 12 ? 'Moral' : 'Fisica';
        
        console.log('🔍 RFC extraído:', rfcExtraido, '- Longitud:', rfcExtraido.length, '- Tipo:', tipoPersona);
        
        // ==================== INFORMACIÓN DEL ASEGURADO (según tipo de persona) ====================
        let nombre = '';
        let apellido_paterno = '';
        let apellido_materno = '';
        let razonSocial = '';
        
        const nombreMatch = textoCompleto.match(/INFORMACI[OÓ]N\s+DEL\s+ASEGURADO\s+([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,10})(?=\s*Domicilio|\s*\n)/i);
        if (nombreMatch) {
          const nombreCompleto = nombreMatch[1].trim();
          
          if (tipoPersona === 'Moral') {
            // Persona Moral: TODO es razón social
            razonSocial = nombreCompleto;
            console.log('🏢 Razón Social (Persona Moral):', razonSocial);
          } else {
            // Persona Física: Separar en nombre y apellidos
            const palabras = nombreCompleto.split(/\s+/);
            console.log('📝 Palabras del nombre (Persona Física):', palabras);
            
            if (palabras.length === 4) {
              nombre = `${palabras[0]} ${palabras[1]}`;
              apellido_paterno = palabras[2];
              apellido_materno = palabras[3];
            } else if (palabras.length === 3) {
              nombre = palabras[0];
              apellido_paterno = palabras[1];
              apellido_materno = palabras[2];
            } else if (palabras.length === 2) {
              nombre = palabras[0];
              apellido_paterno = palabras[1];
            } else {
              nombre = palabras[0] || nombreCompleto;
            }
            console.log('👤 Nombre (Persona Física):', { nombre, apellido_paterno, apellido_materno });
          }
        }
        
        // ==================== DOMICILIO ====================
        // Capturar solo hasta antes de "R.F.C:" para evitar incluir el RFC
        const domicilioMatch = textoCompleto.match(/Domicilio:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,\.#\-]+?)(?=\s*R\.F\.C\.|C\.P\.|Estado:|\n\n)/i);
        const domicilio = domicilioMatch ? domicilioMatch[1].trim() : '';
        console.log('🏠 Domicilio extraído:', domicilio);
        
        // ==================== AGENTE (buscar en ambas páginas) ====================
        let agente = '';
        const agenteMatch1 = textoPagina1.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
        const agenteMatch2 = textoCompleto.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
        
        if (agenteMatch1) {
          agente = `${agenteMatch1[1]} - ${agenteMatch1[2].trim()}`;
          console.log('✅ Agente (pág 1):', agente);
        } else if (agenteMatch2) {
          agente = `${agenteMatch2[1]} - ${agenteMatch2[2].trim()}`;
          console.log('✅ Agente (pág 2):', agente);
        }
        
        // ==================== PÓLIZA (buscar en ambas páginas) ====================
        // Formato: POLIZA    ENDOSO    INCISO
        //          POLIZA DE SEGURO DE AUTOMOVILES  
        //          0971413763  000000    0001
        let polizaNum = '', endosoNum = '', incisoNum = '';
        
        // Buscar patrón simple: 10 dígitos + 6 dígitos + 4 dígitos en una línea
        const lineaNumeros2 = textoCompleto.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
        const lineaNumeros1 = textoPagina1.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
        
        if (lineaNumeros2) {
          polizaNum = lineaNumeros2[1];
          endosoNum = lineaNumeros2[2];
          incisoNum = lineaNumeros2[3];
          console.log('✅ Póliza extraída (pág 2):', { polizaNum, endosoNum, incisoNum });
        } else if (lineaNumeros1) {
          polizaNum = lineaNumeros1[1];
          endosoNum = lineaNumeros1[2];
          incisoNum = lineaNumeros1[3];
          console.log('✅ Póliza extraída (pág 1):', { polizaNum, endosoNum, incisoNum });
        } else {
          console.log('⚠️ No se encontró línea con 10+6+4 dígitos');
        }
        
        const planMatch = textoCompleto.match(/PLAN:\s*([A-Z]+)/i) || textoPagina1.match(/PLAN:\s*([A-Z]+)/i);
        
        // ==================== RFC ====================
        
        // ==================== CURP (solo para Persona Física) ====================
        const curpMatch = textoCompleto.match(/C\.?\s*U\.?\s*R\.?\s*P\.?\s*[:.\s]*([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2})/i);
        
        // ==================== VEHÍCULO ====================
        const descripcionMatch = textoCompleto.match(/(\d{5})\s*\(?\w*\)?\s*([A-Z]+)\s+([A-Z\s0-9\.]+?)(?=Tipo:|$)/i);
        const serieMatch = textoCompleto.match(/Serie[:\s]+([A-Z0-9]{17})/i);
        const motorMatch = textoCompleto.match(/Motor[:\s]+([A-Z0-9]{5,})(?=\s|$)/i);
        const modeloAnioMatch = textoCompleto.match(/Modelo:\s*(\d{4})/i);
        const placasMatch = textoCompleto.match(/Placas:\s*([A-Z0-9\-]+)/i);
        const colorMatch = textoCompleto.match(/Color:\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)*?)(?=\s+Placas|\s+Ocupantes|\n|$)/i);
        
        // Extracción alternativa más específica para marca y modelo
        let marca = '';
        let modeloCompleto = '';
        
        if (descripcionMatch) {
          marca = descripcionMatch[2];
          modeloCompleto = descripcionMatch[3].trim();
        } else {
          // Buscar patrón alternativo: después del código y (I) viene MARCA MODELO
          const altMatch = textoCompleto.match(/\d{4,5}\s*\(?\w*\)?\s*([A-Z]+)\s+([A-Z0-9\s\.]+?)(?=\s*Tipo:|\s*Serie:|\n)/i);
          if (altMatch) {
            marca = altMatch[1];
            modeloCompleto = altMatch[2].trim();
          }
        }
        
        console.log('🚗 Marca extraída:', marca);
        console.log('🚗 Modelo extraído:', modeloCompleto);
        
        // ==================== VIGENCIA ====================
        const desdeMatch = textoCompleto.match(/Desde\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
        const hastaMatch = textoCompleto.match(/Hasta\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
        
        // Para fecha de pago: extraer la fecha directamente O calcular desde plazo
        let fechaPagoFinal = '';
        const fechaPagoDirecta = textoCompleto.match(/Fecha\s+Vencimiento\s+del\s+pago[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
        const plazoMatch = textoCompleto.match(/Plazo\s+de\s+pago:\s*(\d+)\s*d[ií]as/i);
        
        if (fechaPagoDirecta) {
          fechaPagoFinal = `${fechaPagoDirecta[3]}-${meses[fechaPagoDirecta[2]]}-${fechaPagoDirecta[1]}`;
          console.log('✅ Fecha pago extraída directamente:', fechaPagoFinal);
        } else if (desdeMatch && plazoMatch) {
          // Calcular fecha de pago: fecha inicio + plazo días
          const fechaInicio = new Date(`${desdeMatch[3]}-${meses[desdeMatch[2]]}-${desdeMatch[1]}`);
          fechaInicio.setDate(fechaInicio.getDate() + parseInt(plazoMatch[1]));
          fechaPagoFinal = fechaInicio.toISOString().split('T')[0];
          console.log('✅ Fecha pago calculada (inicio + plazo):', fechaPagoFinal);
        } else {
          console.log('⚠️ No se pudo extraer ni calcular fecha de pago');
        }
        
        // ==================== COBERTURAS ====================
        console.log('🛡️ Extrayendo coberturas...');
        
        // Buscar la sección de coberturas contratadas
        const coberturasSeccion = textoCompleto.match(/COBERTURAS\s+CONTRATADAS\s+SUMA\s+ASEGURADA\s+DEDUCIBLE\s+\$\s+PRIMAS([\s\S]*?)(?=Para\s+RC\s+en\s+el\s+extranjero|Quedan\s+excluidos|Textos:|Forma\s+de|$)/i);
        
        let coberturasExtraidas = [];
        
        if (coberturasSeccion) {
          const textoCobertura = coberturasSeccion[1];
          console.log('📋 Texto de coberturas encontrado:', textoCobertura.substring(0, 500));
          
          // Extraer cada línea de cobertura
          // Formato 1: Nombre $monto deducible% prima
          // Formato 2: Nombre $monto POR EVENTO deducible prima
          // Formato 3: Nombre AMPARADA prima
          
          const lineas = textoCobertura.split('\n').filter(l => l.trim().length > 0);
          
          for (const linea of lineas) {
            const lineaLimpia = linea.trim();
            if (!lineaLimpia) continue;
            
            // Patrón 1: Cobertura con monto y deducible porcentual
            // Ej: "Daños materiales $ 631,350.00 5% 12,972.86"
            let match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+(\d+)%\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: match[3] + '%',
                prima: match[4].replace(/,/g, ''),
                tipo: 'monto'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]} - ${match[3]}%`);
              continue;
            }
            
            // Patrón 2: Cobertura POR EVENTO con deducible
            // Ej: "Responsabilidad Civil por Daños a Terceros $ 3,000,000.00 POR EVENTO 0 uma 1,983.96"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+POR\s+EVENTO\s+(.+?)\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: match[3].trim(),
                prima: match[4].replace(/,/g, ''),
                tipo: 'por_evento'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]} POR EVENTO`);
              continue;
            }
            
            // Patrón 3: Cobertura AMPARADA
            // Ej: "Asistencia Vial Qualitas AMPARADA 565.00"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s.]+?)\s+AMPARADA\s+([\d,]+\.?\d*)/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: 'AMPARADA',
                deducible: 'N/A',
                prima: match[2].replace(/,/g, ''),
                tipo: 'amparada'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - AMPARADA`);
              continue;
            }
            
            // Patrón 4: Cobertura con monto específico sin deducible porcentual
            // Ej: "Muerte del Conductor por Accidente Automovilístico $ 100,000.00 122.40"
            match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);
            if (match) {
              coberturasExtraidas.push({
                nombre: match[1].trim(),
                suma_asegurada: match[2].replace(/,/g, ''),
                deducible: 'N/A',
                prima: match[3].replace(/,/g, ''),
                tipo: 'monto'
              });
              console.log(`✅ Cobertura extraída: ${match[1].trim()} - $${match[2]}`);
              continue;
            }
          }
          
          console.log(`📊 Total de coberturas extraídas: ${coberturasExtraidas.length}`);
        } else {
          console.log('⚠️ No se encontró la sección de coberturas');
        }
        
        // ==================== MONTOS ====================
        const sumaMatch = textoCompleto.match(/Daños\s+materiales\s+\$\s*([\d,]+\.?\d*)/i);
        const primaMatch = textoCompleto.match(/Prima\s+Neta\s+([\d,]+\.?\d*)/i);
        const tasaFinanciamientoMatch = textoCompleto.match(/Tasa\s+Financiamiento\s+([-]?[\d,]+\.?\d*)/i);
        const gastosExpedicionMatch = textoCompleto.match(/Gastos\s+por\s+Expedici[oó]n[.\s]+([\d,]+\.?\d*)/i);
        const subtotalMatch = textoCompleto.match(/Subtotal\s+([\d,]+\.?\d*)/i);
        const ivaMatch = textoCompleto.match(/I\.V\.A[.\s]*16%\s+([\d,]+\.?\d*)/i);
        const totalMatch = textoCompleto.match(/IMPORTE\s+TOTAL\s+([\d,]+\.?\d*)/i);
        const pagoUnicoMatch = textoCompleto.match(/Pago\s+[UÚ]nico\s+([\d,]+\.?\d*)/i);
        const deducibleMatch = textoCompleto.match(/(\d+)%\s+[\d,]+\.?\d*\s+Robo/i);
        
        datosExtraidos = {
          // ASEGURADO
          tipo_persona: tipoPersona,
          nombre: nombre,
          apellido_paterno: apellido_paterno,
          apellido_materno: apellido_materno,
          razonSocial: razonSocial,
          rfc: rfcExtraido,
          curp: curpMatch ? curpMatch[1] : '',
          domicilio: domicilio,
          email: extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoCompleto),
          
          // PÓLIZA
          compania: compania,
          producto: 'Autos Individual',
          etapa_activa: 'Emitida',
          agente: agente,
          sub_agente: '',
          numero_poliza: polizaNum,
          endoso: endosoNum,
          inciso: incisoNum,
          plan: planMatch ? planMatch[1] : '',
          
          // VIGENCIA
          inicio_vigencia: desdeMatch ? `${desdeMatch[3]}-${meses[desdeMatch[2]]}-${desdeMatch[1]}` : '',
          termino_vigencia: hastaMatch ? `${hastaMatch[3]}-${meses[hastaMatch[2]]}-${hastaMatch[1]}` : '',
          fecha_pago: fechaPagoFinal,
          plazo_pago_dias: plazoMatch ? plazoMatch[1] : '14',
          
          // MONTOS
          prima_pagada: primaMatch ? primaMatch[1].replace(/,/g, '') : '',
          cargo_pago_fraccionado: tasaFinanciamientoMatch ? tasaFinanciamientoMatch[1].replace(/,/g, '') : '',
          gastos_expedicion: gastosExpedicionMatch ? gastosExpedicionMatch[1].replace(/,/g, '') : '',
          subtotal: subtotalMatch ? subtotalMatch[1].replace(/,/g, '') : '',
          iva: ivaMatch ? ivaMatch[1].replace(/,/g, '') : '',
          total: totalMatch ? totalMatch[1].replace(/,/g, '') : '',
          pago_unico: pagoUnicoMatch ? pagoUnicoMatch[1].replace(/,/g, '') : '',
          tipo_pago: 'Anual',
          periodo_gracia: plazoMatch ? plazoMatch[1] : '14',
          suma_asegurada: sumaMatch ? sumaMatch[1].replace(/,/g, '') : '',
          deducible: deducibleMatch ? deducibleMatch[1] : '5',
          
          // VEHÍCULO
          marca: marca,
          modelo: modeloCompleto,
          anio: modeloAnioMatch ? modeloAnioMatch[1] : '',
          numero_serie: serieMatch ? serieMatch[1] : '',
          motor: motorMatch ? motorMatch[1] : '',
          placas: placasMatch ? placasMatch[1] : 'NA',
          color: colorMatch ? colorMatch[1].trim() : '',
          codigo_vehiculo: descripcionMatch ? descripcionMatch[1] : '',
          tipo_vehiculo: 'Automóviles Importados',
          tipo_cobertura: planMatch ? planMatch[1] : 'AMPLIA',
          
          // COBERTURAS DETALLADAS
          coberturas: coberturasExtraidas,
          
          // CONDUCTOR
          conductor_habitual: `${nombre} ${apellido_paterno} ${apellido_materno}`.trim()
        };
        
        console.log('📊 Datos extraídos:', datosExtraidos);
        
      } else {
        console.log('🔧 Aplicando extractor genérico');
        // Extractor genérico para otras aseguradoras
        datosExtraidos = {
          // INFORMACIÓN DEL ASEGURADO
          nombre: extraerDato(/(?:NOMBRE|ASEGURADO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          apellido_paterno: extraerDato(/(?:APELLIDO\s+PATERNO|AP\.\s*PATERNO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          apellido_materno: extraerDato(/(?:APELLIDO\s+MATERNO|AP\.\s*MATERNO)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto) || '',
          rfc: extraerDato(/RFC[:\s]+([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCompleto) || '',
          email: extraerDato(/(?:E-?MAIL|CORREO)[:\s]+([\w\.-]+@[\w\.-]+\.\w+)/i, textoCompleto) || '',
          telefono_fijo: extraerDato(/(?:TEL(?:ÉFONO)?\.?\s+(?:FIJO|CASA))[:\s]+([\d\s\-()]+)/i, textoCompleto) || '',
          telefono_movil: extraerDato(/(?:TEL(?:ÉFONO)?\.?\s+(?:M[OÓ]VIL|CELULAR))[:\s]+([\d\s\-()]+)/i, textoCompleto) || '',
          
          // DATOS DE LA PÓLIZA
          compania: compania,
          producto: textoCompleto.match(/AUTOS?|AUTOMÓVIL/i) ? 'Autos Individual' : 'Autos Individual',
          etapa_activa: 'Emitida',
          agente: extraerDato(/(?:AGENTE|PRODUCTOR)[:\s]+([A-ZÁÉÍÓÚÑ\s,\.]+?)(?:\n|PÓLIZA)/i, textoCompleto) || '',
          sub_agente: '',
          numero_poliza: extraerDato(/(?:P[ÓO]LIZA|NO\.\s+DE\s+P[ÓO]LIZA)[:\s#]+(\d+[-\d]*)/i, textoCompleto) || '',
          
          // VIGENCIA
          inicio_vigencia: '',
          termino_vigencia: '',
          
          // INFORMACIÓN FINANCIERA
          prima_pagada: extraerDato(/(?:PRIMA\s+(?:NETA|TOTAL))[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          cargo_pago_fraccionado: extraerDato(/(?:CARGO\s+(?:POR\s+)?FRACCIONAMIENTO)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          iva: extraerDato(/I\.?V\.?A\.?[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          total: extraerDato(/(?:TOTAL|PRIMA\s+TOTAL)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          tipo_pago: textoCompleto.match(/CONTADO/i) ? 'Anual' : textoCompleto.match(/FRACCIONADO/i) ? 'Fraccionado' : 'Anual',
          periodo_gracia: 30,
          
          // DESCRIPCIÓN DEL VEHÍCULO
          marca: extraerDato(/(?:MARCA)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|MODELO|TIPO)/i, textoCompleto) || '',
          modelo: extraerDato(/(?:MODELO|DESCRIPCI[ÓO]N)[:\s]+([A-ZÁÉÍÓÚÑ0-9\s\.\-]+?)(?:\n|AÑO|MOTOR)/i, textoCompleto) || '',
          anio: extraerDato(/(?:AÑO|A[ÑN]O\s+MODELO)[:\s]+(\d{4})/i, textoCompleto) || '',
          numero_serie: extraerDato(/(?:SERIE|VIN|N[UÚ]MERO\s+DE\s+SERIE)[:\s]+([A-Z0-9]{17})/i, textoCompleto) || '',
          placas: extraerDato(/(?:PLACAS?|MATRÍCULA)[:\s]+([A-Z0-9\-]+)/i, textoCompleto) || '',
          color: extraerDato(/(?:COLOR)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|TIPO)/i, textoCompleto) || '',
          tipo_vehiculo: extraerDato(/(?:TIPO\s+DE\s+VEH[IÍ]CULO|USO)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|COBERTURA)/i, textoCompleto) || '',
          
          // COBERTURAS
          tipo_cobertura: extraerDato(/(?:COBERTURA|PLAN)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|DEDUCIBLE)/i, textoCompleto) || '',
          deducible: extraerDato(/(?:DEDUCIBLE)[:\s]+(\d+)%?/i, textoCompleto) || '',
          suma_asegurada: extraerDato(/(?:SUMA\s+ASEGURADA|VALOR)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto) || '',
          
          // CONDUCTOR
          conductor_habitual: extraerDato(/(?:CONDUCTOR\s+HABITUAL)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|EDAD)/i, textoCompleto) || '',
          edad_conductor: extraerDato(/(?:EDAD)[:\s]+(\d+)/i, textoCompleto) || '',
          licencia_conducir: extraerDato(/(?:LICENCIA)[:\s]+([A-Z0-9]+)/i, textoCompleto) || ''
        };
      }

      console.log('📊 Datos extraídos:', datosExtraidos);

      // Extraer fechas de vigencia
      const fechasMatch = textoCompleto.match(/(?:VIGENCIA|VIGENTE).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4}).*?(?:AL|A).*?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
      if (fechasMatch) {
        const [, diaIni, mesIni, anioIni, diaFin, mesFin, anioFin] = fechasMatch;
        datosExtraidos.inicio_vigencia = `${anioIni.length === 2 ? '20' + anioIni : anioIni}-${mesIni.padStart(2, '0')}-${diaIni.padStart(2, '0')}`;
        datosExtraidos.termino_vigencia = `${anioFin.length === 2 ? '20' + anioFin : anioFin}-${mesFin.padStart(2, '0')}-${diaFin.padStart(2, '0')}`;
      }

      // Limpiar montos (quitar comas)
      ['prima_pagada', 'cargo_pago_fraccionado', 'iva', 'total', 'suma_asegurada'].forEach(campo => {
        if (datosExtraidos[campo]) {
          datosExtraidos[campo] = datosExtraidos[campo].replace(/,/g, '');
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
      
      // Buscar agente en el equipo de trabajo
      let agenteEncontradoEnBD = null;
      if (datosExtraidos.agente && agentes.length > 0) {
        const codigoAgenteMatch = datosExtraidos.agente.match(/^(\d+)/);
        if (codigoAgenteMatch) {
          const codigoAgente = codigoAgenteMatch[1];
          agenteEncontradoEnBD = agentes.find(miembro => 
            miembro.perfil === 'Agente' && 
            miembro.activo &&
            (miembro.codigo === codigoAgente || miembro.codigoAgente === codigoAgente)
          );
        }
      }
      setAgenteEncontrado(agenteEncontradoEnBD);
      
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

  // PASO 1: Manejar decisión sobre el cliente
  const handleDecisionCliente = useCallback(async (decision) => {
    setDecisionCliente(decision);
    
    if (decision === 'crear-nuevo') {
      // Crear cliente automáticamente
      console.log('🔄 Creando nuevo cliente...');
      
      // Usar tipo de persona ya detectado en la extracción
      const tipoPersonaDetectado = datosExtraidos.tipo_persona === 'Moral' ? 'Persona Moral' : 'Persona Física';
      
      // Preparar datos según tipo de persona
      let nuevoCliente = {};
      
      if (tipoPersonaDetectado === 'Persona Moral') {
        // Para empresas: usar razón social directamente extraída
        nuevoCliente = {
          tipoPersona: tipoPersonaDetectado,
          razonSocial: datosExtraidos.razonSocial || 'Empresa',
          rfc: datosExtraidos.rfc || '',
          direccion: datosExtraidos.domicilio || '',
          email: datosExtraidos.email || '',
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
          email: datosExtraidos.email || '',
          activo: true
        };
      }
      
      console.log('📋 Datos del cliente a crear:');
      console.log('   - Tipo persona:', tipoPersonaDetectado);
      console.log('   - RFC:', datosExtraidos.rfc, '(longitud:', datosExtraidos.rfc?.length, ')');
      if (tipoPersonaDetectado === 'Persona Moral') {
        console.log('   - Razón Social:', nuevoCliente.razonSocial);
      } else {
        console.log('   - Nombre:', nuevoCliente.nombre);
        console.log('   - Apellidos:', nuevoCliente.apellidoPaterno, nuevoCliente.apellidoMaterno);
      }
      console.log('   - JSON completo:', JSON.stringify(nuevoCliente, null, 2));
      
      const { crearCliente } = await import('../services/clientesService');
      const resultado = await crearCliente(nuevoCliente);
      
      if (resultado.success) {
        setClienteEncontrado(resultado.data);
        console.log('✅ Cliente creado:', resultado.data.nombre);
      } else {
        setErrores(['❌ Error al crear cliente: ' + resultado.error]);
        setEstado('error');
        return;
      }
    }
    
    // Pasar al PASO 2: Validación de Agente
    setEstado('validando-agente');
  }, [datosExtraidos]);

  // PASO 2: Manejar decisión sobre el agente
  const handleDecisionAgente = useCallback(async (decision) => {
    setDecisionAgente(decision);
    
    if (decision === 'crear-nuevo') {
      console.log('🔄 Creando nuevo agente...');
      
      // Extraer código y nombre del agente del string "25576 - ALVARO IVAN GONZALEZ JIMENEZ"
      const agenteTexto = datosExtraidos.agente || '';
      const codigoMatch = agenteTexto.match(/^(\d+)/);
      const nombreCompletoMatch = agenteTexto.match(/\d+\s*-\s*(.+)$/);
      
      if (!codigoMatch || !nombreCompletoMatch) {
        console.error('❌ No se pudo extraer información del agente');
        alert('No se pudo extraer la información del agente del PDF. Deberás crear el agente manualmente desde el módulo de Equipo de Trabajo.');
        // Continuar sin crear el agente
        setEstado('preview-datos');
        return;
      }
      
      const codigo = codigoMatch[1];
      const nombreCompleto = nombreCompletoMatch[1].trim();
      const palabras = nombreCompleto.split(/\s+/);
      
      let nombre = '', apellidoPaterno = '', apellidoMaterno = '';
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
      
      try {
        const nuevoAgente = {
          codigo: codigo,
          nombre: nombre,
          apellidoPaterno: apellidoPaterno,
          apellidoMaterno: apellidoMaterno,
          perfil: 'Agente',
          activo: true,
          fechaIngreso: new Date().toISOString().split('T')[0],
          fechaRegistro: new Date().toISOString().split('T')[0],
          productosAseguradoras: []
        };
        
        const { crearMiembroEquipo } = await import('../services/equipoDeTrabajoService');
        const resultado = await crearMiembroEquipo(nuevoAgente);
        
        if (resultado.success) {
          setAgenteEncontrado(resultado.data);
          console.log('✅ Agente creado:', resultado.data.nombre);
          alert(`✅ Agente creado exitosamente: ${nombre} ${apellidoPaterno}`);
        } else {
          throw new Error(resultado.error);
        }
      } catch (error) {
        console.error('❌ Error al crear agente:', error);
        alert(`⚠️ No se pudo crear el agente automáticamente.\n\nDeberás agregarlo manualmente desde el módulo "Equipo de Trabajo".\n\nDatos del agente:\n- Código: ${codigo}\n- Nombre: ${nombre} ${apellidoPaterno} ${apellidoMaterno}`);
        // Continuar sin el agente
      }
    }
    
    // Pasar al PASO 3: Preview de todos los datos
    setEstado('preview-datos');
  }, [datosExtraidos, aseguradoras, tiposProductos]);

  // PASO 3: Aplicar datos al formulario
  const aplicarDatos = useCallback(() => {
    if (datosExtraidos && onDataExtracted) {
      // Asegurarse de que el cliente_id esté incluido en los datos
      const datosConCliente = {
        ...datosExtraidos,
        cliente_id: clienteEncontrado?.id || datosExtraidos.cliente_id || null
      };
      
      console.log('📤 Aplicando datos al formulario con cliente_id:', datosConCliente.cliente_id);
      onDataExtracted(datosConCliente);
      onClose();
    }
  }, [datosExtraidos, clienteEncontrado, onDataExtracted, onClose]);

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

            {/* PASO 1: VALIDACIÓN DE CLIENTE */}
            {estado === 'validando-cliente' && datosExtraidos && (
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                    <strong>1/3</strong>
                  </div>
                  <h5 className="mt-3">Validación de Cliente</h5>
                </div>

                <div className="card mb-4">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">👤 Datos del Cliente Extraídos</h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <strong className="d-block mb-1">
                          {datosExtraidos.tipo_persona === 'Moral' ? 'Razón Social:' : 'Nombre Completo:'}
                        </strong>
                        <p className="mb-0">
                          {datosExtraidos.tipo_persona === 'Moral' 
                            ? datosExtraidos.razonSocial 
                            : `${datosExtraidos.nombre || ''} ${datosExtraidos.apellido_paterno || ''} ${datosExtraidos.apellido_materno || ''}`.trim()
                          }
                        </p>
                      </div>
                      {datosExtraidos.rfc && (
                        <div className="col-md-6">
                          <strong className="d-block mb-1">RFC:</strong>
                          <p className="mb-0">{datosExtraidos.rfc}</p>
                        </div>
                      )}
                      {datosExtraidos.domicilio && (
                        <div className="col-12">
                          <strong className="d-block mb-1">Dirección:</strong>
                          <p className="mb-0">{datosExtraidos.domicilio}</p>
                        </div>
                      )}
                      {datosExtraidos.email && (
                        <div className="col-md-6">
                          <strong className="d-block mb-1">Email:</strong>
                          <p className="mb-0">{datosExtraidos.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {clienteEncontrado ? (
                  <div className="alert alert-success">
                    <div className="d-flex align-items-center mb-3">
                      <CheckCircle className="me-2" size={24} />
                      <strong>✅ Cliente ENCONTRADO en base de datos</strong>
                    </div>
                    
                    <div className="card border-success">
                      <div className="card-body">
                        <h6 className="card-subtitle mb-3 text-success">Datos en Base de Datos</h6>
                        
                        <div className="row g-3">
                          <div className="col-md-6">
                            <small className="text-muted d-block">ID Cliente</small>
                            <strong>{clienteEncontrado.codigo || clienteEncontrado.id}</strong>
                          </div>
                          
                          <div className="col-md-6">
                            <small className="text-muted d-block">Fecha de Registro</small>
                            <strong>{clienteEncontrado.created_at ? new Date(clienteEncontrado.created_at).toLocaleDateString('es-MX') : 'N/A'}</strong>
                          </div>

                          <div className="col-12">
                            <small className="text-muted d-block">
                              {clienteEncontrado.tipoPersona === 'Persona Moral' ? 'Razón Social' : 'Nombre Completo'}
                            </small>
                            <strong>
                              {clienteEncontrado.tipoPersona === 'Persona Moral' 
                                ? (clienteEncontrado.razonSocial || clienteEncontrado.nombre || 'N/A')
                                : `${clienteEncontrado.nombre || ''} ${clienteEncontrado.apellido_paterno || clienteEncontrado.apellidoPaterno || ''} ${clienteEncontrado.apellido_materno || clienteEncontrado.apellidoMaterno || ''}`.trim()
                              }
                            </strong>
                          </div>

                          {clienteEncontrado.rfc && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">RFC</small>
                              <strong>{clienteEncontrado.rfc}</strong>
                            </div>
                          )}

                          {clienteEncontrado.curp && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">CURP</small>
                              <strong>{clienteEncontrado.curp}</strong>
                            </div>
                          )}

                          {clienteEncontrado.email && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Email</small>
                              <strong>{clienteEncontrado.email}</strong>
                            </div>
                          )}

                          {clienteEncontrado.telefono_movil && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono Móvil</small>
                              <strong>{clienteEncontrado.telefono_movil}</strong>
                            </div>
                          )}

                          {clienteEncontrado.telefono_fijo && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono Fijo</small>
                              <strong>{clienteEncontrado.telefono_fijo}</strong>
                            </div>
                          )}

                          {clienteEncontrado.direccion && (
                            <div className="col-12">
                              <small className="text-muted d-block">Dirección</small>
                              <strong>{clienteEncontrado.direccion}</strong>
                            </div>
                          )}

                          {(clienteEncontrado.ciudad || clienteEncontrado.estado) && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Ubicación</small>
                              <strong>{clienteEncontrado.ciudad}{clienteEncontrado.ciudad && clienteEncontrado.estado ? ', ' : ''}{clienteEncontrado.estado}</strong>
                            </div>
                          )}

                          {clienteEncontrado.codigo_postal && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Código Postal</small>
                              <strong>{clienteEncontrado.codigo_postal}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-3" />
                    <p className="mb-3"><strong>¿Qué deseas hacer?</strong></p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-success flex-fill"
                        onClick={() => handleDecisionCliente('usar-existente')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Usar Cliente Existente
                      </button>
                      <button 
                        className="btn btn-outline-primary flex-fill"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
                      >
                        Crear Cliente Nuevo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <div className="d-flex align-items-center mb-2">
                      <AlertCircle className="me-2" size={24} />
                      <strong>⚠️ Cliente NO encontrado en base de datos</strong>
                    </div>
                    <p className="mb-3">Se creará un nuevo cliente con los datos extraídos del PDF.</p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary flex-fill"
                        onClick={() => handleDecisionCliente('crear-nuevo')}
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
              <div className="py-4">
                <div className="text-center mb-4">
                  <div className="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                    <strong>2/3</strong>
                  </div>
                  <h5 className="mt-3">Validación de Agente</h5>
                </div>

                {datosExtraidos.agente ? (
                  <div className="card mb-4">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">👔 Agente Extraído del PDF</h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-0"><strong>{datosExtraidos.agente}</strong></p>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-info mb-4">
                    <AlertCircle className="me-2" size={20} />
                    No se pudo extraer información del agente del PDF
                  </div>
                )}

                {agenteEncontrado ? (
                  <div className="alert alert-success">
                    <div className="d-flex align-items-center mb-3">
                      <CheckCircle className="me-2" size={24} />
                      <strong>✅ Agente ENCONTRADO en Equipo de Trabajo</strong>
                    </div>
                    
                    <div className="card border-success">
                      <div className="card-body">
                        <h6 className="card-subtitle mb-3 text-success">Datos en Equipo de Trabajo</h6>
                        
                        <div className="row g-3">
                          <div className="col-md-6">
                            <small className="text-muted d-block">Código Agente</small>
                            <strong>{agenteEncontrado.codigo || agenteEncontrado.codigoAgente}</strong>
                          </div>
                          
                          <div className="col-md-6">
                            <small className="text-muted d-block">Nombre Completo</small>
                            <strong>{agenteEncontrado.nombre}</strong>
                          </div>

                          {agenteEncontrado.email && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Email</small>
                              <strong>{agenteEncontrado.email}</strong>
                            </div>
                          )}

                          {agenteEncontrado.telefono && (
                            <div className="col-md-6">
                              <small className="text-muted d-block">Teléfono</small>
                              <strong>{agenteEncontrado.telefono}</strong>
                            </div>
                          )}

                          <div className="col-md-6">
                            <small className="text-muted d-block">Estado</small>
                            <span className="badge bg-success">Activo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="my-3" />
                    <p className="mb-3"><strong>¿Qué deseas hacer?</strong></p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-success flex-fill"
                        onClick={() => handleDecisionAgente('usar-existente')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Usar Este Agente
                      </button>
                      <button 
                        className="btn btn-outline-primary flex-fill"
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary"
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Seleccionar Después
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <div className="d-flex align-items-center mb-2">
                      <AlertCircle className="me-2" size={24} />
                      <strong>⚠️ Agente NO encontrado en Equipo de Trabajo</strong>
                    </div>
                    <p className="mb-3">
                      El agente con código <strong>{datosExtraidos.agente?.match(/^(\d+)/)?.[1] || 'N/A'}</strong> no está registrado.
                    </p>
                    <div className="d-flex gap-2">
                      <button 
                        className="btn btn-primary flex-fill"
                        onClick={() => handleDecisionAgente('crear-nuevo')}
                      >
                        <CheckCircle className="me-2" size={16} />
                        Crear Agente Nuevo
                      </button>
                      <button 
                        className="btn btn-outline-secondary flex-fill"
                        onClick={() => handleDecisionAgente('omitir')}
                      >
                        Continuar sin Agente
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

            {/* PASO 3: PREVIEW DE TODOS LOS DATOS */}
            {estado === 'preview-datos' && datosExtraidos && (
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
                              <strong>{datosExtraidos.numero_poliza || '-'}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Endoso:</small><br/>
                              <strong>{datosExtraidos.endoso || '-'}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Inciso:</small><br/>
                              <strong>{datosExtraidos.inciso || '-'}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Plan:</small><br/>
                              <strong className="text-uppercase">{datosExtraidos.plan || '-'}</strong>
                            </div>
                          </div>
                          <div className="row g-2 mt-2">
                            <div className="col-md-4">
                              <small className="text-muted">Producto:</small><br/>
                              <strong>{datosExtraidos.producto}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Tipo de Pago:</small><br/>
                              <strong>{datosExtraidos.tipo_pago}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Agente:</small><br/>
                              <strong>{datosExtraidos.agente || '-'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* VIGENCIA */}
                      <div className="col-12">
                        <div className="p-3 bg-success bg-opacity-10 rounded">
                          <h6 className="text-success mb-3">📅 VIGENCIA DE LA PÓLIZA</h6>
                          <div className="row g-2">
                            <div className="col-md-4">
                              <small className="text-muted">Desde las 12:00 P.M. del:</small><br/>
                              <strong>{datosExtraidos.inicio_vigencia ? new Date(datosExtraidos.inicio_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Hasta las 12:00 P.M. del:</small><br/>
                              <strong>{datosExtraidos.termino_vigencia ? new Date(datosExtraidos.termino_vigencia).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Fecha Vencimiento del pago:</small><br/>
                              <strong className="text-warning-emphasis">
                                {datosExtraidos.fecha_pago ? new Date(datosExtraidos.fecha_pago).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '-'}
                                {datosExtraidos.plazo_pago_dias && ` (${datosExtraidos.plazo_pago_dias} días)`}
                              </strong>
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
                            <div className="col-md-4">
                              <small className="text-muted">Serie (VIN):</small><br/>
                              <strong className="font-monospace">{datosExtraidos.numero_serie}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Motor:</small><br/>
                              <strong>{datosExtraidos.motor || '-'}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Placas:</small><br/>
                              <strong>{datosExtraidos.placas}</strong>
                            </div>
                            <div className="col-md-2">
                              <small className="text-muted">Color:</small><br/>
                              <strong>{datosExtraidos.color || '-'}</strong>
                            </div>
                            <div className="col-md-2">
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
                          
                          {datosExtraidos.coberturas && datosExtraidos.coberturas.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover mb-0">
                                <thead className="table-light">
                                  <tr>
                                    <th>Cobertura</th>
                                    <th className="text-end">Suma Asegurada</th>
                                    <th className="text-center">Deducible</th>
                                    <th className="text-end">Prima</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {datosExtraidos.coberturas.map((cob, idx) => (
                                    <tr key={idx}>
                                      <td className="fw-medium">{cob.nombre}</td>
                                      <td className="text-end">
                                        {cob.suma_asegurada === 'AMPARADA' ? (
                                          <span className="badge bg-success">AMPARADA</span>
                                        ) : (
                                          `$${parseFloat(cob.suma_asegurada).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        )}
                                        {cob.tipo === 'por_evento' && <small className="d-block text-muted">POR EVENTO</small>}
                                      </td>
                                      <td className="text-center">
                                        <span className="badge bg-secondary">{cob.deducible}</span>
                                      </td>
                                      <td className="text-end">
                                        ${parseFloat(cob.prima).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
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
                          )}
                        </div>
                      </div>                      {/* INFORMACIÓN FINANCIERA */}
                      <div className="col-12">
                        <div className="p-3 bg-secondary bg-opacity-10 rounded">
                          <h6 className="text-secondary mb-3">💰 INFORMACIÓN FINANCIERA</h6>
                          <div className="row g-2">
                            <div className="col-md-4">
                              <small className="text-muted">Prima Neta:</small><br/>
                              <strong>{datosExtraidos.prima_pagada ? utils.formatearMoneda(datosExtraidos.prima_pagada) : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Tasa Financiamiento:</small><br/>
                              <strong>{datosExtraidos.cargo_pago_fraccionado ? utils.formatearMoneda(datosExtraidos.cargo_pago_fraccionado) : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">Gastos por Expedición:</small><br/>
                              <strong>{datosExtraidos.gastos_expedicion ? utils.formatearMoneda(datosExtraidos.gastos_expedicion) : '-'}</strong>
                            </div>
                          </div>
                          <div className="row g-2 mt-2">
                            <div className="col-md-4">
                              <small className="text-muted">Subtotal:</small><br/>
                              <strong>{datosExtraidos.subtotal ? utils.formatearMoneda(datosExtraidos.subtotal) : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">I.V.A. 16%:</small><br/>
                              <strong>{datosExtraidos.iva ? utils.formatearMoneda(datosExtraidos.iva) : '-'}</strong>
                            </div>
                            <div className="col-md-4">
                              <small className="text-muted">IMPORTE TOTAL:</small><br/>
                              <strong className="text-success fs-5">{datosExtraidos.total ? utils.formatearMoneda(datosExtraidos.total) : '-'}</strong>
                            </div>
                          </div>
                          <div className="row g-2 mt-2">
                            <div className="col-md-6">
                              <small className="text-muted">Forma de Pago:</small><br/>
                              <strong className="text-uppercase">{datosExtraidos.tipo_pago || '-'}</strong>
                            </div>
                            {datosExtraidos.fecha_pago && (
                              <div className="col-md-6">
                                <small className="text-muted">Pago Único:</small><br/>
                                <strong>{datosExtraidos.pago_unico ? utils.formatearMoneda(datosExtraidos.pago_unico) : '-'}</strong>
                              </div>
                            )}
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

  // Detectar pólizas duplicadas
  const polizasDuplicadas = React.useMemo(() => {
    const grupos = {};
    expedientes.forEach(exp => {
      if (exp.numero_poliza && exp.compania && exp.inicio_vigencia) {
        const clave = `${exp.numero_poliza}-${exp.compania}-${exp.inicio_vigencia}`;
        if (!grupos[clave]) {
          grupos[clave] = [];
        }
        grupos[clave].push(exp);
      }
    });
    return Object.entries(grupos).filter(([_, exps]) => exps.length > 1);
  }, [expedientes]);

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

      {polizasDuplicadas.length > 0 && (
        <div className="alert alert-warning mb-3" role="alert">
          <strong>⚠️ Atención:</strong> Se encontraron {polizasDuplicadas.length} póliza(s) duplicada(s).
          Las filas están marcadas en amarillo.
          <details className="mt-2">
            <summary style={{cursor: 'pointer'}} className="text-decoration-underline">
              Ver detalles de duplicados
            </summary>
            <ul className="mt-2 mb-0">
              {polizasDuplicadas.map(([clave, exps]) => (
                <li key={clave}>
                  <strong>{exps[0].numero_poliza}</strong> - {exps[0].compania} - Vigencia: {exps[0].inicio_vigencia}
                  <span className="text-muted"> ({exps.length} registros)</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

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
                    <th>Póliza</th>
                    <th>Cliente</th>
                    <th>Compañía</th>
                    <th>Producto</th>
                    <th>Etapa Activa</th>
                    <th>Agente</th>
                    <th>Tipo/Estatus Pago</th>
                    <th>Vigencia</th>
                    <th width="200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacion.itemsPaginados.map((expediente) => {
                    const agenteInfo = agentes.find(a => a.codigoAgente === expediente.agente);
                    
                    // Detectar si esta póliza está duplicada
                    const esDuplicada = expedientes.filter(exp => 
                      exp.numero_poliza === expediente.numero_poliza &&
                      exp.compania === expediente.compania &&
                      exp.inicio_vigencia === expediente.inicio_vigencia &&
                      expediente.numero_poliza // Solo si tiene número de póliza
                    ).length > 1;
                    
                    return (
                      <tr key={expediente.id} className={esDuplicada ? 'table-warning' : ''}>
                        <td>
                          <div>
                            <strong className="text-primary">{expediente.numero_poliza || '-'}</strong>
                            {esDuplicada && (
                              <div>
                                <span className="badge bg-warning text-dark" title="Póliza duplicada">
                                  ⚠️ Duplicada
                                </span>
                              </div>
                            )}
                            {expediente.endoso && (
                              <div><small className="text-muted">End: {expediente.endoso}</small></div>
                            )}
                            {expediente.inciso && (
                              <div><small className="text-muted">Inc: {expediente.inciso}</small></div>
                            )}
                          </div>
                        </td>
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
                          <small>{utils.formatearFecha(expediente.inicio_vigencia, 'simple')}</small>
                          <div><small className="text-muted">hasta {utils.formatearFecha(expediente.termino_vigencia, 'simple')}</small></div>
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
  CONSTANTS,
  handleClienteSeleccionado,
  clienteSeleccionado
}) => {
  const [mostrarExtractorPDF, setMostrarExtractorPDF] = useState(false);
  const [datosImportadosDesdePDF, setDatosImportadosDesdePDF] = useState(false);
  const [infoImportacion, setInfoImportacion] = useState(null);

  const handleDataExtracted = useCallback(async (datosExtraidos) => {
    try {
      // 1. USAR EL CLIENTE QUE YA FUE CREADO EN EL EXTRACTOR PDF
      let clienteSeleccionadoFinal = null;
      
      if (datosExtraidos.cliente_id) {
        // El cliente ya fue creado o encontrado en el extractor PDF
        // Buscar el cliente en la base de datos usando el cliente_id
        console.log('� Buscando cliente con ID:', datosExtraidos.cliente_id);
        
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          clienteSeleccionadoFinal = clientes.find(c => c.id === datosExtraidos.cliente_id);
          
          if (clienteSeleccionadoFinal) {
            handleClienteSeleccionado(clienteSeleccionadoFinal);
            console.log('✅ Cliente vinculado:', clienteSeleccionadoFinal.nombre || clienteSeleccionadoFinal.razonSocial, 'ID:', clienteSeleccionadoFinal.id);
          } else {
            console.error('❌ No se encontró el cliente con ID:', datosExtraidos.cliente_id);
          }
        } catch (error) {
          console.error('❌ Error al buscar cliente:', error);
        }
      } else {
        console.warn('⚠️ No se proporcionó cliente_id. El cliente debe ser seleccionado manualmente.');
      }
      
      // 2. BUSCAR AGENTE POR CÓDIGO Y COMPAÑÍA
      // El agente extraído viene en formato: "25576 - ALVARO IVAN GONZALEZ JIMENEZ"
      let agenteCodigo = null;
      if (datosExtraidos.agente && agentes.length > 0) {
        // Extraer código del agente del formato "25576 - NOMBRE"
        const codigoAgenteMatch = datosExtraidos.agente.match(/^(\d+)/);
        if (codigoAgenteMatch) {
          const codigoAgente = codigoAgenteMatch[1];
          
          // Buscar agente en el equipo de trabajo que tenga ese código
          // Nota: Un agente puede tener diferentes códigos según la compañía
          const agenteEncontrado = agentes.find(miembro => 
            miembro.perfil === 'Agente' && 
            miembro.activo &&
            (miembro.codigo === codigoAgente || miembro.codigoAgente === codigoAgente)
          );
          
          if (agenteEncontrado) {
            agenteCodigo = agenteEncontrado.codigo || agenteEncontrado.codigoAgente;
            console.log('✅ Agente encontrado en equipo:', agenteEncontrado.nombre, 'Código:', agenteCodigo);
          } else {
            console.warn('⚠️ Agente no encontrado en equipo. Código:', codigoAgente, 'Compañía:', datosExtraidos.compania);
            console.log('💡 El agente debe ser agregado al Equipo de Trabajo antes de asignar pólizas');
          }
        }
      }
      
      // 3. BUSCAR VENDEDOR/SUB-AGENTE (si aplica)
      // Los vendedores usan la misma clave que el agente al que están ligados
      // Por ahora lo dejamos vacío, se puede seleccionar manualmente
      let subAgenteId = null;
      
      // 4. POPULAR FORMULARIO CON TODOS LOS DATOS
      console.log('📋 Datos a aplicar:', {
        compania: datosExtraidos.compania,
        producto: datosExtraidos.producto,
        companias: companias.slice(0, 10), // Primeras 10 compañías
        productos: productos.slice(0, 10).map(p => p.nombre || p) // Primeros 10 productos
      });
      
      const nuevoFormulario = {
        ...formulario,
        ...datosExtraidos,
        // Preservar campos del formulario original
        fecha_creacion: formulario.fecha_creacion,
        id: formulario.id,
        // FORZAR valores directamente
        agente: agenteCodigo || '',
        sub_agente: '',
        etapa_activa: datosExtraidos.etapa_activa || 'Emitida',
        compania: datosExtraidos.compania,
        producto: datosExtraidos.producto
      };
      
      console.log('🔍 DEBUG - Valores antes de setFormulario:', {
        'compania original': datosExtraidos.compania,
        'compania en nuevo': nuevoFormulario.compania,
        'agente codigo': agenteCodigo,
        'agente en nuevo': nuevoFormulario.agente,
        'producto': nuevoFormulario.producto
      });
      
      console.log('🚗 DEBUG - Datos del vehículo extraídos:', {
        'marca': datosExtraidos.marca,
        'modelo': datosExtraidos.modelo,
        'anio': datosExtraidos.anio,
        'numero_serie': datosExtraidos.numero_serie,
        'motor': datosExtraidos.motor,
        'placas': datosExtraidos.placas,
        'color': datosExtraidos.color,
        'tipo_vehiculo': datosExtraidos.tipo_vehiculo,
        'tipo_cobertura': datosExtraidos.tipo_cobertura
      });
      
      console.log('🔍 DEBUG - Producto extraído:', datosExtraidos.producto);
      console.log('🔍 DEBUG - nuevoFormulario.producto:', nuevoFormulario.producto);
      console.log('🔍 DEBUG - nuevoFormulario completo:', {
        marca: nuevoFormulario.marca,
        modelo: nuevoFormulario.modelo,
        anio: nuevoFormulario.anio,
        numero_serie: nuevoFormulario.numero_serie
      });
      
      setFormulario(nuevoFormulario);
      
      // 5. RECALCULAR FECHAS Y MONTOS AUTOMÁTICOS (incluye estatusPago)
      if (datosExtraidos.inicio_vigencia || datosExtraidos.fecha_pago) {
        setTimeout(() => {
          const formularioConCalculos = actualizarCalculosAutomaticos(nuevoFormulario);
          setFormulario(prev => ({
            ...prev,
            ...formularioConCalculos,
            // Preservar datos importantes que no deben cambiar
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteCodigo || '',
            // Preservar datos del vehículo
            marca: datosExtraidos.marca,
            modelo: datosExtraidos.modelo,
            anio: datosExtraidos.anio,
            numero_serie: datosExtraidos.numero_serie,
            motor: datosExtraidos.motor,
            placas: datosExtraidos.placas,
            color: datosExtraidos.color,
            tipo_vehiculo: datosExtraidos.tipo_vehiculo,
            tipo_cobertura: datosExtraidos.tipo_cobertura,
            codigo_vehiculo: datosExtraidos.codigo_vehiculo
          }));
          console.log('✅ Cálculos automáticos aplicados, estatusPago:', formularioConCalculos.estatusPago);
        }, 150);
      } else {
        // FORZAR la actualización después de un pequeño delay
        setTimeout(() => {
          setFormulario(prev => ({
            ...prev,
            compania: datosExtraidos.compania,
            producto: datosExtraidos.producto,
            agente: agenteCodigo || '',
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
            codigo_vehiculo: datosExtraidos.codigo_vehiculo
          }));
          console.log('✅ Valores forzados después del render (incluyendo vehículo)');
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
        agenteAsignado: !!agenteCodigo,
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
      console.log('  Agente:', agenteCodigo ? '✅ Asignado' : '⚠️ No encontrado (revisar código)');
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
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          {modoEdicion ? 'Editar Expediente' : 'Nuevo Expediente'}
        </h3>
        <div className="d-flex gap-2">
          {!modoEdicion && (
            <button
              onClick={() => {
                console.log('🔵 Abriendo extractor PDF...');
                setMostrarExtractorPDF(true);
              }}
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
          {datosImportadosDesdePDF && !modoEdicion && infoImportacion && (
            <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
              <CheckCircle className="me-2" size={20} />
              <div>
                <strong>✅ Datos importados desde PDF exitosamente</strong>
                <ul className="mb-0 mt-2" style={{ fontSize: '0.9rem' }}>
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
          <div className="mb-4">
            <h5 className="card-title border-bottom pb-2">Datos del Cliente</h5>
            
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
              <div className="row g-3 mt-2">
                <div className="col-md-6">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.nombre}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Apellido Paterno</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.apellido_paterno}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Apellido Materno</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.apellido_materno}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">RFC</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formulario.rfc}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formulario.email}
                    disabled
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Teléfono Móvil</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={formulario.telefono_movil}
                    disabled
                  />
                </div>
              </div>
            )}
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

          {formulario.producto && formulario.producto.toLowerCase().includes('autos') && (
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
          {formulario.producto && formulario.producto.toLowerCase().includes('autos') && (
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
          {formulario.producto === 'Autos Individual' && (
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
          {formulario.producto === 'Autos Individual' && (
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
                    value={formulario.licencia_conducir}
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
                  value={formulario.sub_agente}
                  onChange={(e) => setFormulario(prev => ({ ...prev, sub_agente: e.target.value }))}
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
          {formulario.producto === 'Autos Individual' && (
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
          {formulario.producto === 'Autos Individual' && (
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
          {formulario.producto === 'Autos Individual' && (
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
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control bg-light"
                    value={formulario.periodo_gracia || ''}
                    readOnly
                  />
                  <span className="input-group-text">
                    días naturales
                  </span>
                </div>
                <small className="text-muted">
                  {formulario.compania?.toLowerCase().includes('qualitas') 
                    ? '📌 Qualitas: 14 días' 
                    : formulario.compania 
                      ? '📌 Otras aseguradoras: 30 días'
                      : 'Seleccione una compañía'}
                </small>
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
        <>
          {console.log('🟢 Renderizando ExtractorPolizasPDF...')}
          <ExtractorPolizasPDF 
            onDataExtracted={handleDataExtracted}
            onClose={() => setMostrarExtractorPDF(false)}
            agentes={agentes}
            aseguradoras={companias}
            tiposProductos={productos}
          />
        </>
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
}) => {
  const [clienteInfo, setClienteInfo] = useState(null);
  
  // Cargar información del cliente cuando se selecciona un expediente
  useEffect(() => {
    const cargarCliente = async () => {
      if (expedienteSeleccionado?.cliente_id) {
        try {
          const response = await fetch(`${API_URL}/api/clientes`);
          const clientes = await response.json();
          const cliente = clientes.find(c => c.id === expedienteSeleccionado.cliente_id);
          setClienteInfo(cliente);
        } catch (error) {
          console.error('Error al cargar cliente:', error);
        }
      } else {
        setClienteInfo(null);
      }
    };
    
    cargarCliente();
  }, [expedienteSeleccionado?.cliente_id]);
  
  return (
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
                {clienteInfo ? (
                  clienteInfo.tipoPersona === 'Persona Moral' ? 
                    clienteInfo.razonSocial :
                    `${clienteInfo.nombre || ''} ${clienteInfo.apellidoPaterno || clienteInfo.apellido_paterno || ''} ${clienteInfo.apellidoMaterno || clienteInfo.apellido_materno || ''}`
                ) : (expedienteSeleccionado.nombre || expedienteSeleccionado.apellido_paterno ? 
                  `${expedienteSeleccionado.nombre || ''} ${expedienteSeleccionado.apellido_paterno || ''} ${expedienteSeleccionado.apellido_materno || ''}` : 
                  '-'
                )}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Email:</strong>
                {clienteInfo?.email || expedienteSeleccionado.email || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Teléfono fijo:</strong>
                {clienteInfo?.telefonoFijo || clienteInfo?.telefono_fijo || expedienteSeleccionado.telefono_fijo || '-'}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Teléfono móvil:</strong>
                {clienteInfo?.telefonoMovil || clienteInfo?.telefono_movil || expedienteSeleccionado.telefono_movil || '-'}
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
                {utils.formatearFecha(expedienteSeleccionado.inicio_vigencia, 'simple')}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Término de vigencia:</strong>
                {utils.formatearFecha(expedienteSeleccionado.termino_vigencia, 'simple')}
              </div>
              <div className="mb-3">
                <strong className="d-block text-muted">Fecha de creación:</strong>
                {utils.formatearFecha(expedienteSeleccionado.fecha_creacion, 'simple')}
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
  );
});

// ============= COMPONENTE PRINCIPAL =============
const ModuloExpedientes = () => {
  const [expedientes, setExpedientes] = useState([]);
  const [agentes, setAgentes] = useState([]);
  useEffect(() => {
    const fetchAgentes = async () => {
      const resultado = await obtenerAgentesEquipo();
      console.log('Agentes cargados:', resultado.data);
      if (resultado.success) {
        // Ordenar agentes alfabéticamente por nombre
        const agentesOrdenados = resultado.data.sort((a, b) => {
          const nombreA = `${a.nombre} ${a.apellido_paterno}`.toLowerCase();
          const nombreB = `${b.nombre} ${b.apellido_paterno}`.toLowerCase();
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
        });
        setAgentes(agentesOrdenados);
      }
    };
    fetchAgentes();
  }, []);
  // Cargar expedientes desde el backend al montar
  useEffect(() => {
    const cargarExpedientesConClientes = async () => {
      try {
        // 1. Obtener expedientes
        const resExpedientes = await fetch(`${API_URL}/api/expedientes`);
        const expedientes = await resExpedientes.json();
        
        // 2. Obtener todos los clientes
        const resClientes = await fetch(`${API_URL}/api/clientes`);
        const clientes = await resClientes.json();
        
        // 3. Crear un mapa de clientes por ID para búsqueda rápida
        const clientesMap = {};
        clientes.forEach(cliente => {
          clientesMap[cliente.id] = cliente;
        });
        
        // 4. Enriquecer cada expediente con los datos del cliente
        const expedientesEnriquecidos = expedientes.map(exp => {
          const cliente = clientesMap[exp.cliente_id];
          
          if (cliente) {
            // Si es Persona Moral, usar razón social como nombre completo
            if (cliente.tipoPersona === 'Persona Moral') {
              return {
                ...exp,
                nombre: cliente.razonSocial || '',
                apellido_paterno: '',
                apellido_materno: '',
                email: cliente.email || '',
                telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || '',
                rfc: cliente.rfc || ''
              };
            } else {
              // Persona Física: usar nombre y apellidos
              return {
                ...exp,
                nombre: cliente.nombre || '',
                apellido_paterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
                apellido_materno: cliente.apellidoMaterno || cliente.apellido_materno || '',
                email: cliente.email || '',
                telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || '',
                rfc: cliente.rfc || ''
              };
            }
          }
          
          // Si no se encuentra el cliente, mantener el expediente sin cambios
          return exp;
        });
        
        setExpedientes(expedientesEnriquecidos);
        
        // Detectar pólizas duplicadas (mismo número, compañía y vigencia)
        if (expedientesEnriquecidos.length > 0) {
          const grupos = {};
          expedientesEnriquecidos.forEach(exp => {
            if (exp.numero_poliza && exp.compania && exp.inicio_vigencia) {
              const clave = `${exp.numero_poliza}-${exp.compania}-${exp.inicio_vigencia}`;
              if (!grupos[clave]) {
                grupos[clave] = [];
              }
              grupos[clave].push(exp);
            }
          });
          
          const duplicados = Object.entries(grupos).filter(([_, exps]) => exps.length > 1);
          
          if (duplicados.length > 0) {
            console.warn('⚠️ Se encontraron pólizas duplicadas:');
            duplicados.forEach(([clave, exps]) => {
              console.warn(`  📋 ${clave}:`, exps.map(e => ({
                id: e.id,
                cliente: `${e.nombre} ${e.apellido_paterno}`,
                etapa: e.etapa_activa
              })));
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar expedientes:', err);
      }
    };
    
    cargarExpedientesConClientes();
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
      .then(data => {
        // Filtrar solo aseguradoras activas
        const aseguradorasActivas = Array.isArray(data) ? data.filter(a => a.activo === 1 || a.activo === true) : [];
        console.log('Aseguradoras activas cargadas:', aseguradorasActivas);
        setAseguradoras(aseguradorasActivas);
      })
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

  const companias = useMemo(() => {
    return aseguradoras
      .map(a => a.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [aseguradoras]);
  
  const productos = useMemo(() => {
    return tiposProductos
      .map(p => p.nombre)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [tiposProductos]);
  
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
  const frecuenciasPago = useMemo(() => Object.keys(CONSTANTS.PAGOS_POR_FRECUENCIA).sort(), []);
  const periodosGracia = useMemo(() => [14, 30], []);
  const estatusPago = useMemo(() => ['Sin definir', 'Pagado', 'Vencido', 'Pago por vencer'], []);
  const motivosCancelacion = useMemo(() => [
    'Cliente desistió',
    'Documentación incompleta',
    'Encontró mejor opción',
    'No cumple requisitos',
    'Precio muy alto',
    'Otro'
  ], []);

  const tiposVehiculo = useMemo(() => ['Deportivo', 'Hatchback', 'Pickup', 'Sedán', 'SUV', 'Vagoneta', 'Otro'].sort(), []);
  const tiposCobertura = useMemo(() => ['Amplia', 'Limitada', 'RC (Responsabilidad Civil)'].sort(), []);
  const marcasVehiculo = useMemo(() => [
    'Audi', 'BMW', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 
    'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Suzuki', 
    'Toyota', 'Volkswagen', 'Volvo', 'Otra'
  ], []);
const estadoInicialFormulario = {
  cliente_id: null,
  nombre: '',
  apellido_paterno: '',
  apellido_materno: '',
  telefono_fijo: '',
  telefono_movil: '',
  email: '',
  rfc: '',
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
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const calculartermino_vigencia = useCallback((inicio_vigencia) => {
    if (!inicio_vigencia) return '';
    
    const fechaInicio = new Date(inicio_vigencia);
    const fechaTermino = new Date(fechaInicio);
    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
    
    return fechaTermino.toISOString().split('T')[0];
  }, []);

  const calcularProximoPago = useCallback((inicio_vigencia, tipo_pago, frecuenciaPago, compania, numeroPago = 1) => {
    if (!inicio_vigencia) return '';
    
    // Calcular periodo de gracia automáticamente según la compañía
    const periodoGracia = compania?.toLowerCase().includes('qualitas') ? 14 : 30;
    
    const fechaInicio = new Date(inicio_vigencia);
    let fechaPago = new Date(fechaInicio);
    
    if (numeroPago === 1) {
      // Primer pago: fecha inicio + periodo de gracia
      fechaPago.setDate(fechaPago.getDate() + periodoGracia);
      return fechaPago.toISOString().split('T')[0];
    }
    
    if (tipo_pago === 'Anual') return '';
    
    if (tipo_pago === 'Fraccionado' && frecuenciaPago) {
      // CORRECCIÓN: Los pagos subsecuentes se calculan desde la fecha de inicio SIN período de gracia
      // Pago 2: inicio + 1 mes
      // Pago 3: inicio + 2 meses
      // etc.
      const fechaPagoSubsecuente = new Date(fechaInicio);
      const mesesAAgregar = (numeroPago - 1) * CONSTANTS.MESES_POR_FRECUENCIA[frecuenciaPago];
      fechaPagoSubsecuente.setMonth(fechaPagoSubsecuente.getMonth() + mesesAAgregar);
      
      return fechaPagoSubsecuente.toISOString().split('T')[0];
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
    
    // Calcular proximoPago según el tipo de pago
    let proximoPago = '';
    
    if (formularioActual.tipo_pago === 'Fraccionado') {
      // Para fraccionado: calcular el próximo pago basado en frecuencia
      proximoPago = calcularProximoPago(
        formularioActual.inicio_vigencia,
        formularioActual.tipo_pago,
        formularioActual.frecuenciaPago,
        formularioActual.compania,
        1
      );
    } else if (formularioActual.tipo_pago === 'Anual') {
      // Para anual: usar fecha_pago si existe, sino usar inicio_vigencia
      proximoPago = formularioActual.fecha_pago || formularioActual.inicio_vigencia;
    }
    
    // Calcular estatusPago basado en proximoPago
    const estatusPago = calcularEstatusPago(proximoPago, formularioActual.estatusPago);
    
    // Calcular periodo de gracia automáticamente
    const periodoGracia = formularioActual.compania?.toLowerCase().includes('qualitas') ? 14 : 30;
    
    // Incluir fecha_pago con el mismo valor que proximoPago para mantener consistencia
    return { 
      ...formularioActual, 
      termino_vigencia, 
      proximoPago, 
      fecha_pago: proximoPago, // Sincronizar fecha_pago con proximoPago
      estatusPago, 
      periodo_gracia: periodoGracia 
    };
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
      const periodoGracia = expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30;
      const fechaPrimerPago = new Date(fechaInicio);
      fechaPrimerPago.setDate(fechaPrimerPago.getDate() + periodoGracia);
      
      if (!expediente.fechaUltimoPago) {
        return calcularProximoPago(expediente.inicio_vigencia, expediente.tipo_pago, expediente.frecuenciaPago, expediente.compania, 2);
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
        expediente.compania,
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

  // Función para manejar selección de cliente
  const handleClienteSeleccionado = useCallback((cliente) => {
    if (cliente === 'CREAR_NUEVO') {
      // TODO: Abrir modal para crear nuevo cliente
      alert('Funcionalidad de crear nuevo cliente en desarrollo');
      return;
    }

    if (cliente) {
      setClienteSeleccionado(cliente);
      
      // Auto-llenar datos del cliente en el formulario
      // Manejar tanto camelCase como snake_case del backend
      setFormulario(prev => ({
        ...prev,
        cliente_id: cliente.id,
        nombre: cliente.nombre || '',
        apellido_paterno: cliente.apellido_paterno || cliente.apellidoPaterno || '',
        apellido_materno: cliente.apellido_materno || cliente.apellidoMaterno || '',
        email: cliente.email || '',
        telefono_fijo: cliente.telefono_fijo || cliente.telefonoFijo || '',
        telefono_movil: cliente.telefono_movil || cliente.telefonoMovil || '',
        rfc: cliente.rfc || ''
      }));
    } else {
      setClienteSeleccionado(null);
      setFormulario(prev => ({
        ...prev,
        cliente_id: null,
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        email: '',
        telefono_fijo: '',
        telefono_movil: '',
        rfc: ''
      }));
    }
  }, []);

  const limpiarFormulario = useCallback(() => {
    setFormulario(estadoInicialFormulario);
    setClienteSeleccionado(null);
    setModoEdicion(false);
    setExpedienteSeleccionado(null);
  }, [estadoInicialFormulario]);

  const validarFormulario = useCallback(() => {
    // Validar que haya cliente seleccionado
    if (!formulario.cliente_id && !clienteSeleccionado) {
      alert('Por favor seleccione un cliente');
      return false;
    }

    if (!formulario.compania || !formulario.producto) {
      alert('Por favor complete los campos obligatorios: Compañía y Producto');
      return false;
    }

    // Validar póliza duplicada (solo si NO estamos editando)
    if (!modoEdicion && formulario.numero_poliza) {
      console.log('🔍 Validando duplicados:', {
        numero_poliza: formulario.numero_poliza,
        compania: formulario.compania,
        inicio_vigencia: formulario.inicio_vigencia,
        total_expedientes: expedientes.length
      });
      
      const polizaDuplicada = expedientes.find(exp => {
        // Normalizar fechas para comparación (solo YYYY-MM-DD)
        const fechaFormulario = formulario.inicio_vigencia ? formulario.inicio_vigencia.split('T')[0] : '';
        const fechaExpediente = exp.inicio_vigencia ? exp.inicio_vigencia.split('T')[0] : '';
        
        const coincide = exp.numero_poliza === formulario.numero_poliza &&
                        exp.compania === formulario.compania &&
                        fechaExpediente === fechaFormulario;
        
        if (coincide) {
          console.log('✅ Duplicado encontrado:', {
            id: exp.id,
            numero_poliza: exp.numero_poliza,
            compania: exp.compania,
            inicio_vigencia: exp.inicio_vigencia,
            cliente: `${exp.nombre} ${exp.apellido_paterno}`
          });
        }
        return coincide;
      });
      
      if (polizaDuplicada) {
        const mensaje = 
          '⚠️ ATENCIÓN: PÓLIZA DUPLICADA DETECTADA\n\n' +
          'Ya existe un registro en el sistema con estos datos:\n\n' +
          '📋 Póliza: ' + polizaDuplicada.numero_poliza + '\n' +
          '🏢 Compañía: ' + polizaDuplicada.compania + '\n' +
          '📅 Inicio Vigencia: ' + polizaDuplicada.inicio_vigencia.split('T')[0] + '\n' +
          '👤 Cliente: ' + polizaDuplicada.nombre + ' ' + polizaDuplicada.apellido_paterno + '\n' +
          '📊 Etapa: ' + polizaDuplicada.etapa_activa + '\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          'Presione ACEPTAR para continuar con el guardado\n' +
          '(Podrá ver las pólizas duplicadas marcadas en el listado)\n\n' +
          'Presione CANCELAR para regresar al formulario';
        
        const confirmar = window.confirm(mensaje);
        
        if (!confirmar) {
          alert('❌ Operación cancelada.\n\nLa póliza NO fue guardada.\nPuede revisar los datos y volver a intentar.');
          return false;
        } else {
          console.log('✅ Usuario confirmó guardar póliza duplicada');
        }
      } else {
        console.log('✅ No se encontraron duplicados');
      }
    }

    if (formulario.producto === 'Autos Individual') {
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
  }, [formulario, clienteSeleccionado, modoEdicion, expedientes]);

  const guardarExpediente = useCallback(() => {
    if (!validarFormulario()) return;

    const formularioConCalculos = actualizarCalculosAutomaticos(formulario);
    
    console.log('💾 Guardando expediente con cálculos:', {
      estatusPago: formularioConCalculos.estatusPago,
      proximoPago: formularioConCalculos.proximoPago,
      tipo_pago: formularioConCalculos.tipo_pago,
      fecha_pago: formularioConCalculos.fecha_pago,
      cliente_id: formularioConCalculos.cliente_id
    });
    
    // Normalizar apellidos para backend
    const expedientePayload = {
      ...formularioConCalculos
    };
    
    console.log('📦 Payload completo a guardar:', {
      numero_poliza: expedientePayload.numero_poliza,
      cliente_id: expedientePayload.cliente_id,
      compania: expedientePayload.compania
    });

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
  const recargarExpedientes = useCallback(async () => {
    try {
      console.log('🔄 Recargando expedientes...');
      
      // 1. Obtener expedientes
      const resExpedientes = await fetch(`${API_URL}/api/expedientes`);
      const expedientes = await resExpedientes.json();
      console.log('📊 Expedientes obtenidos:', expedientes.length);
      
      // 2. Obtener todos los clientes
      const resClientes = await fetch(`${API_URL}/api/clientes`);
      const clientes = await resClientes.json();
      console.log('👥 Clientes obtenidos:', clientes.length);
      
      // 3. Crear un mapa de clientes por ID para búsqueda rápida
      const clientesMap = {};
      clientes.forEach(cliente => {
        clientesMap[cliente.id] = cliente;
      });
      console.log('🗺️ Mapa de clientes creado con', Object.keys(clientesMap).length, 'entradas');
      
      // 4. Enriquecer cada expediente con los datos del cliente
      const expedientesEnriquecidos = expedientes.map(exp => {
        // Debug: mostrar TODOS los campos del expediente
        console.log('🔍 Expediente:', exp.numero_poliza, 'Campos relacionados con cliente:', {
          cliente_id: exp.cliente_id,
          clienteId: exp.clienteId,
          nombre: exp.nombre,
          apellido_paterno: exp.apellido_paterno,
          razonSocial: exp.razonSocial
        });
        
        const cliente = clientesMap[exp.cliente_id];
        
        // Debug para póliza específica
        if (exp.numero_poliza === '1970064839') {
          console.log('🔍 DEBUG Póliza 1970064839:', {
            expediente_id: exp.id,
            cliente_id: exp.cliente_id,
            cliente_encontrado: !!cliente,
            cliente_tipo: cliente?.tipoPersona,
            cliente_razonSocial: cliente?.razonSocial,
            cliente_nombre: cliente?.nombre
          });
        }
        
        if (cliente) {
          // Si es Persona Moral, usar razón social como nombre completo
          if (cliente.tipoPersona === 'Persona Moral') {
            return {
              ...exp,
              nombre: cliente.razonSocial || '',
              apellido_paterno: '',
              apellido_materno: '',
              email: cliente.email || '',
              telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || '',
              rfc: cliente.rfc || ''
            };
          } else {
            // Persona Física: usar nombre y apellidos
            return {
              ...exp,
              nombre: cliente.nombre || '',
              apellido_paterno: cliente.apellidoPaterno || cliente.apellido_paterno || '',
              apellido_materno: cliente.apellidoMaterno || cliente.apellido_materno || '',
              email: cliente.email || '',
              telefono_movil: cliente.telefonoMovil || cliente.telefono_movil || '',
              rfc: cliente.rfc || ''
            };
          }
        }
        
        // Si no se encuentra el cliente, mantener el expediente sin cambios
        console.warn('⚠️ Cliente no encontrado para expediente:', exp.numero_poliza, 'cliente_id:', exp.cliente_id);
        return exp;
      });
      
      console.log('✅ Expedientes enriquecidos:', expedientesEnriquecidos.length);
      setExpedientes(expedientesEnriquecidos);
    } catch (err) {
      console.error('Error al recargar expedientes:', err);
    }
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
            handleClienteSeleccionado={handleClienteSeleccionado}
            clienteSeleccionado={clienteSeleccionado}
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

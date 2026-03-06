# 🔄 Implementación de Botones de Renovación

## 📋 Resumen
Agregar 3 botones al menú de acciones del listado de pólizas para el flujo de renovación:
1. **Cotizar** - Iniciar proceso de renovación
2. **Marcar Autorizado** - Cliente autorizó la cotización
3. **Agregar Póliza Renovada** - Registrar póliza emitida

---

## 1️⃣ AGREGAR ESTADOS (línea ~656, después de `useState` existentes)

```javascript
// Estados para flujo de renovación
const [mostrarModalCotizarRenovacion, setMostrarModalCotizarRenovacion] = useState(false);
const [mostrarModalAutorizarRenovacion, setMostrarModalAutorizarRenovacion] = useState(false);
const [mostrarModalPolizaRenovada, setMostrarModalPolizaRenovada] = useState(false);
const [expedienteParaRenovacion, setExpedienteParaRenovacion] = useState(null);

// Datos para la renovación
const [datosRenovacion, setDatosRenovacion] = useState({
  numeroPolizaNueva: '',
  primaNueva: '',
  totalNuevo: '',
  fechaEmisionNueva: '',
  inicioVigenciaNueva: '',
  terminoVigenciaNueva: '',
  observaciones: ''
});
```

---

## 2️⃣ AGREGAR FUNCIONES (línea ~5900, después de `compartirPorEmail`)

```javascript
// ═══════════════════════════════════════════════════════════════
// FUNCIONES PARA FLUJO DE RENOVACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Iniciar Cotización de Renovación
 * - Abre modal para capturar detalles de cotización
 * - Cambia estado a "En Cotización - Renovación"
 * - Registra evento COTIZACION_RENOVACION_INICIADA
 */
const iniciarCotizacionRenovacion = useCallback(async (expediente) => {
  try {
    setExpedienteParaRenovacion(expediente);
    setMostrarModalCotizarRenovacion(true);
  } catch (error) {
    console.error('Error al abrir modal de cotización:', error);
    toast.error('Error al iniciar cotización de renovación');
  }
}, []);

const guardarCotizacionRenovacion = useCallback(async () => {
  try {
    if (!expedienteParaRenovacion) return;
    
    // Actualizar expediente con nueva etapa
    const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etapa_activa: 'En Cotización - Renovación'
      })
    });
    
    if (!response.ok) throw new Error('Error al actualizar expediente');
    
    // Registrar evento en historial
    await historialService.registrarEvento({
      expediente_id: expedienteParaRenovacion.id,
      cliente_id: expedienteParaRenovacion.cliente_id,
      tipo_evento: 'cotizacion_renovacion_iniciada', // TODO: Agregar a TIPOS_EVENTO
      usuario_nombre: 'Sistema',
      descripcion: 'Cotización de renovación iniciada',
      datos_adicionales: {
        numero_poliza: expedienteParaRenovacion.numero_poliza,
        compania: expedienteParaRenovacion.compania
      }
    });
    
    toast.success('Cotización de renovación iniciada');
    setMostrarModalCotizarRenovacion(false);
    setExpedienteParaRenovacion(null);
    await recargarExpedientes();
    
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    toast.error('Error al guardar cotización de renovación');
  }
}, [expedienteParaRenovacion, recargarExpedientes]);

/**
 * 2. Marcar como Autorizado
 * - Cliente autorizó la cotización de renovación
 * - Cambia estado a "Pendiente de Emisión - Renovación"
 * - Registra evento RENOVACION_PENDIENTE_EMISION
 */
const marcarRenovacionAutorizada = useCallback(async (expediente) => {
  try {
    // Actualizar expediente
    const response = await fetch(`${API_URL}/api/expedientes/${expediente.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        etapa_activa: 'Pendiente de Emisión - Renovación'
      })
    });
    
    if (!response.ok) throw new Error('Error al actualizar expediente');
    
    // Registrar evento
    await historialService.registrarEvento({
      expediente_id: expediente.id,
      cliente_id: expediente.cliente_id,
      tipo_evento: 'renovacion_pendiente_emision', // TODO: Agregar a TIPOS_EVENTO
      usuario_nombre: 'Sistema',
      descripcion: 'Cliente autorizó la renovación - Pendiente de emisión',
      datos_adicionales: {
        numero_poliza: expediente.numero_poliza,
        compania: expediente.compania
      }
    });
    
    toast.success('Renovación marcada como autorizada');
    await recargarExpedientes();
    
  } catch (error) {
    console.error('Error al marcar como autorizada:', error);
    toast.error('Error al marcar renovación como autorizada');
  }
}, [recargarExpedientes]);

/**
 * 3. Agregar Póliza Renovada
 * - Captura datos de la póliza renovada emitida
 * - Actualiza todas las fechas y vigencias
 * - Cambia estado a "Renovación Emitida"
 * - Registra evento RENOVACION_EMITIDA
 */
const abrirModalPolizaRenovada = useCallback((expediente) => {
  setExpedienteParaRenovacion(expediente);
  
  // Pre-llenar datos sugeridos
  const hoy = new Date();
  const inicioVigencia = new Date(hoy);
  const terminoVigencia = new Date(inicioVigencia);
  terminoVigencia.setFullYear(terminoVigencia.getFullYear() + 1);
  
  setDatosRenovacion({
    numeroPolizaNueva: expediente.numero_poliza || '', // Puede ser el mismo o nuevo
    primaNueva: expediente.prima_pagada || '',
    totalNuevo: expediente.total || '',
    fechaEmisionNueva: hoy.toISOString().split('T')[0],
    inicioVigenciaNueva: inicioVigencia.toISOString().split('T')[0],
    terminoVigenciaNueva: terminoVigencia.toISOString().split('T')[0],
    observaciones: ''
  });
  
  setMostrarModalPolizaRenovada(true);
}, []);

const guardarPolizaRenovada = useCallback(async () => {
  try {
    if (!expedienteParaRenovacion) return;
    
    // Calcular fecha de aviso (30 días antes del nuevo término)
    const terminoVigencia = new Date(datosRenovacion.terminoVigenciaNueva);
    const fechaAviso = new Date(terminoVigencia);
    fechaAviso.setDate(fechaAviso.getDate() - 30);
    
    // Actualizar expediente con nuevos datos
    const response = await fetch(`${API_URL}/api/expedientes/${expedienteParaRenovacion.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_poliza: datosRenovacion.numeroPolizaNueva,
        prima_pagada: parseFloat(datosRenovacion.primaNueva) || 0,
        total: parseFloat(datosRenovacion.totalNuevo) || 0,
        fecha_emision: datosRenovacion.fechaEmisionNueva,
        inicio_vigencia: datosRenovacion.inicioVigenciaNueva,
        termino_vigencia: datosRenovacion.terminoVigenciaNueva,
        fecha_aviso_renovacion: fechaAviso.toISOString().split('T')[0],
        etapa_activa: 'Renovación Emitida',
        tipo_movimiento: 'renovacion' // Marcar como renovación
      })
    });
    
    if (!response.ok) throw new Error('Error al actualizar expediente');
    
    // Registrar evento
    await historialService.registrarEvento({
      expediente_id: expedienteParaRenovacion.id,
      cliente_id: expedienteParaRenovacion.cliente_id,
      tipo_evento: 'renovacion_emitida', // TODO: Agregar a TIPOS_EVENTO
      usuario_nombre: 'Sistema',
      descripcion: `Póliza renovada emitida - Nueva vigencia: ${datosRenovacion.inicioVigenciaNueva} a ${datosRenovacion.terminoVigenciaNueva}`,
      datos_adicionales: {
        numero_poliza: datosRenovacion.numeroPolizaNueva,
        compania: expedienteParaRenovacion.compania,
        prima_nueva: datosRenovacion.primaNueva,
        total_nuevo: datosRenovacion.totalNuevo,
        observaciones: datosRenovacion.observaciones
      }
    });
    
    toast.success('Póliza renovada registrada exitosamente');
    setMostrarModalPolizaRenovada(false);
    setExpedienteParaRenovacion(null);
    setDatosRenovacion({
      numeroPolizaNueva: '',
      primaNueva: '',
      totalNuevo: '',
      fechaEmisionNueva: '',
      inicioVigenciaNueva: '',
      terminoVigenciaNueva: '',
      observaciones: ''
    });
    await recargarExpedientes();
    
  } catch (error) {
    console.error('Error al guardar póliza renovada:', error);
    toast.error('Error al guardar póliza renovada');
  }
}, [expedienteParaRenovacion, datosRenovacion, recargarExpedientes]);
```

---

## 3️⃣ AGREGAR IMPORTS (línea ~60, en la sección de imports de lucide-react)

Buscar la línea donde se importan los íconos de `lucide-react` y agregar:

```javascript
import { 
  // ... íconos existentes
  FileText,      // Para icono de cotización
  CheckCircle,   // Para icono de autorizado
  RefreshCw      // Para icono de renovación
} from 'lucide-react';
```

---

## 4️⃣ AGREGAR BOTONES EN EL LISTADO (línea ~2954, dentro de la columna de Acciones)

Buscar la sección donde están los botones "Compartir", "Aplicar Pago", etc. y agregar **ANTES** de los botones "Ver detalles":

```javascript
{/* === BOTONES DE RENOVACIÓN === */}
{/* Mostrar botones solo en carpetas Por Renovar o Vencidas */}
{(() => {
  const estaPorRenovar = carpetaSeleccionada === 'por_renovar' || carpetaSeleccionada === 'vencidas';
  
  if (!estaPorRenovar) return null;
  
  const etapaActual = expediente.etapa_activa || '';
  
  // 1. Botón COTIZAR - Solo si está en etapa inicial (no ha iniciado proceso)
  const puedeIniciarCotizacion = !etapaActual.includes('Cotización') && 
                                  !etapaActual.includes('Renovación') &&
                                  !etapaActual.includes('Pendiente de Emisión');
  
  // 2. Botón AUTORIZAR - Solo si está en "En Cotización" o "Renovación Enviada"
  const puedeMarcarAutorizado = etapaActual === 'En Cotización - Renovación' || 
                                 etapaActual === 'Renovación Enviada';
  
  // 3. Botón AGREGAR RENOVADA - Solo si está en "Pendiente de Emisión"
  const puedeAgregarRenovada = etapaActual === 'Pendiente de Emisión - Renovación';
  
  return (
    <>
      {puedeIniciarCotizacion && (
        <button
          onClick={() => iniciarCotizacionRenovacion(expediente)}
          className="btn btn-primary btn-sm"
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
          title="Cotizar Renovación"
        >
          <FileText size={12} />
        </button>
      )}
      
      {puedeMarcarAutorizado && (
        <button
          onClick={() => marcarRenovacionAutorizada(expediente)}
          className="btn btn-success btn-sm"
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
          title="Marcar como Autorizado"
        >
          <CheckCircle size={12} />
        </button>
      )}
      
      {puedeAgregarRenovada && (
        <button
          onClick={() => abrirModalPolizaRenovada(expediente)}
          className="btn btn-info btn-sm"
          style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}
          title="Agregar Póliza Renovada"
        >
          <RefreshCw size={12} />
        </button>
      )}
    </>
  );
})()}
```

---

## 5️⃣ AGREGAR MODALES (línea ~8200, después del modal de Compartir)

```javascript
{/* ═══════════════════════════════════════════════════════════════
    MODALES DE RENOVACIÓN
    ═══════════════════════════════════════════════════════════════ */}

{/* Modal 1: Iniciar Cotización de Renovación */}
{mostrarModalCotizarRenovacion && expedienteParaRenovacion && (
  <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-primary text-white">
          <h5 className="modal-title">
            <FileText size={20} className="me-2" />
            Iniciar Cotización de Renovación
          </h5>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={() => {
              setMostrarModalCotizarRenovacion(false);
              setExpedienteParaRenovacion(null);
            }}
          ></button>
        </div>
        
        <div className="modal-body">
          <div className="alert alert-info mb-3">
            <h6 className="mb-2">
              <strong>Póliza:</strong> {expedienteParaRenovacion.numero_poliza || 'Sin número'}
            </h6>
            <p className="mb-1"><strong>Cliente:</strong> {expedienteParaRenovacion.nombre_cliente || 'N/A'}</p>
            <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania || 'N/A'}</p>
          </div>
          
          <p className="text-muted">
            Se iniciará el proceso de cotización para la renovación de esta póliza. 
            El expediente se moverá a la carpeta <strong>"En Proceso"</strong> con estado 
            <strong>"En Cotización - Renovación"</strong>.
          </p>
          
          <p className="text-muted mb-0">
            <strong>Próximos pasos:</strong>
          </p>
          <ol className="text-muted small">
            <li>Preparar cotización con la aseguradora</li>
            <li>Enviar cotización al cliente</li>
            <li>Esperar autorización del cliente</li>
          </ol>
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              setMostrarModalCotizarRenovacion(false);
              setExpedienteParaRenovacion(null);
            }}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={guardarCotizacionRenovacion}
          >
            <FileText size={16} className="me-2" />
            Iniciar Cotización
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Modal 2: Marcar como Autorizado (confirmación simple) */}
{mostrarModalAutorizarRenovacion && expedienteParaRenovacion && (
  <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-sm modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-success text-white">
          <h5 className="modal-title">
            <CheckCircle size={20} className="me-2" />
            Confirmar Autorización
          </h5>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={() => {
              setMostrarModalAutorizarRenovacion(false);
              setExpedienteParaRenovacion(null);
            }}
          ></button>
        </div>
        
        <div className="modal-body">
          <p className="mb-0">
            ¿Confirmas que el cliente <strong>autorizó</strong> la cotización de renovación?
          </p>
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              setMostrarModalAutorizarRenovacion(false);
              setExpedienteParaRenovacion(null);
            }}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-success"
            onClick={() => {
              marcarRenovacionAutorizada(expedienteParaRenovacion);
              setMostrarModalAutorizarRenovacion(false);
              setExpedienteParaRenovacion(null);
            }}
          >
            <CheckCircle size={16} className="me-2" />
            Sí, Autorizado
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Modal 3: Agregar Póliza Renovada */}
{mostrarModalPolizaRenovada && expedienteParaRenovacion && (
  <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog modal-lg modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header bg-info text-white">
          <h5 className="modal-title">
            <RefreshCw size={20} className="me-2" />
            Registrar Póliza Renovada
          </h5>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={() => {
              setMostrarModalPolizaRenovada(false);
              setExpedienteParaRenovacion(null);
              setDatosRenovacion({
                numeroPolizaNueva: '',
                primaNueva: '',
                totalNuevo: '',
                fechaEmisionNueva: '',
                inicioVigenciaNueva: '',
                terminoVigenciaNueva: '',
                observaciones: ''
              });
            }}
          ></button>
        </div>
        
        <div className="modal-body">
          <div className="alert alert-info mb-3">
            <p className="mb-1"><strong>Póliza Original:</strong> {expedienteParaRenovacion.numero_poliza}</p>
            <p className="mb-0"><strong>Compañía:</strong> {expedienteParaRenovacion.compania}</p>
          </div>
          
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Número de Póliza Renovada *</label>
              <input
                type="text"
                className="form-control"
                value={datosRenovacion.numeroPolizaNueva}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, numeroPolizaNueva: e.target.value }))}
                placeholder="Número de póliza renovada"
              />
              <small className="text-muted">Puede ser el mismo o un nuevo número</small>
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Prima *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={datosRenovacion.primaNueva}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, primaNueva: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            
            <div className="col-md-3">
              <label className="form-label">Total *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={datosRenovacion.totalNuevo}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, totalNuevo: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            
            <div className="col-md-4">
              <label className="form-label">Fecha Emisión *</label>
              <input
                type="date"
                className="form-control"
                value={datosRenovacion.fechaEmisionNueva}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, fechaEmisionNueva: e.target.value }))}
              />
            </div>
            
            <div className="col-md-4">
              <label className="form-label">Inicio Vigencia *</label>
              <input
                type="date"
                className="form-control"
                value={datosRenovacion.inicioVigenciaNueva}
                onChange={(e) => {
                  const inicio = e.target.value;
                  // Auto-calcular término (1 año después)
                  if (inicio) {
                    const fechaInicio = new Date(inicio);
                    const fechaTermino = new Date(fechaInicio);
                    fechaTermino.setFullYear(fechaTermino.getFullYear() + 1);
                    setDatosRenovacion(prev => ({ 
                      ...prev, 
                      inicioVigenciaNueva: inicio,
                      terminoVigenciaNueva: fechaTermino.toISOString().split('T')[0]
                    }));
                  } else {
                    setDatosRenovacion(prev => ({ ...prev, inicioVigenciaNueva: inicio }));
                  }
                }}
              />
            </div>
            
            <div className="col-md-4">
              <label className="form-label">Término Vigencia *</label>
              <input
                type="date"
                className="form-control"
                value={datosRenovacion.terminoVigenciaNueva}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, terminoVigenciaNueva: e.target.value }))}
              />
              <small className="text-muted">Auto-calculado (1 año)</small>
            </div>
            
            <div className="col-12">
              <label className="form-label">Observaciones</label>
              <textarea
                className="form-control"
                rows="2"
                value={datosRenovacion.observaciones}
                onChange={(e) => setDatosRenovacion(prev => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Comentarios sobre la renovación..."
              ></textarea>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              setMostrarModalPolizaRenovada(false);
              setExpedienteParaRenovacion(null);
              setDatosRenovacion({
                numeroPolizaNueva: '',
                primaNueva: '',
                totalNuevo: '',
                fechaEmisionNueva: '',
                inicioVigenciaNueva: '',
                terminoVigenciaNueva: '',
                observaciones: ''
              });
            }}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-info"
            onClick={guardarPolizaRenovada}
            disabled={
              !datosRenovacion.numeroPolizaNueva ||
              !datosRenovacion.primaNueva ||
              !datosRenovacion.totalNuevo ||
              !datosRenovacion.fechaEmisionNueva ||
              !datosRenovacion.inicioVigenciaNueva ||
              !datosRenovacion.terminoVigenciaNueva
            }
          >
            <RefreshCw size={16} className="me-2" />
            Guardar Póliza Renovada
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 6️⃣ AGREGAR TIPOS DE EVENTO EN historialExpedienteService.js

Agregar estos 3 nuevos eventos al objeto `TIPOS_EVENTO`:

```javascript
export const TIPOS_EVENTO = {
  // ... eventos existentes
  
  // Renovaciones (completar flujo)
  RENOVACION_INICIADA: 'renovacion_iniciada',
  POLIZA_RENOVADA: 'poliza_renovada',
  RECORDATORIO_RENOVACION_ENVIADO: 'recordatorio_renovacion_enviado',
  
  // 🆕 NUEVOS EVENTOS DE RENOVACIÓN
  COTIZACION_RENOVACION_INICIADA: 'cotizacion_renovacion_iniciada',
  COTIZACION_RENOVACION_ENVIADA: 'cotizacion_renovacion_enviada',
  RENOVACION_PENDIENTE_EMISION: 'renovacion_pendiente_emision',
  RENOVACION_EMITIDA: 'renovacion_emitida',
  PAGO_RENOVACION_REGISTRADO: 'pago_renovacion_registrado',
  RENOVACION_VIGENTE: 'renovacion_vigente',
  
  // ... resto de eventos
};
```

Y agregar los títulos e íconos correspondientes:

```javascript
// En obtenerEstiloEvento
[TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA]: { icon: '📝', color: '#3b82f6', bgColor: '#dbeafe' },
[TIPOS_EVENTO.COTIZACION_RENOVACION_ENVIADA]: { icon: '📧', color: '#10b981', bgColor: '#d1fae5' },
[TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION]: { icon: '⏳', color: '#f59e0b', bgColor: '#fef3c7' },
[TIPOS_EVENTO.RENOVACION_EMITIDA]: { icon: '📄', color: '#8b5cf6', bgColor: '#ede9fe' },
[TIPOS_EVENTO.PAGO_RENOVACION_REGISTRADO]: { icon: '💰', color: '#10b981', bgColor: '#d1fae5' },
[TIPOS_EVENTO.RENOVACION_VIGENTE]: { icon: '🔁', color: '#059669', bgColor: '#d1fae5' },

// En obtenerTituloEvento
[TIPOS_EVENTO.COTIZACION_RENOVACION_INICIADA]: 'Cotización de Renovación Iniciada',
[TIPOS_EVENTO.COTIZACION_RENOVACION_ENVIADA]: 'Cotización de Renovación Enviada',
[TIPOS_EVENTO.RENOVACION_PENDIENTE_EMISION]: 'Renovación Pendiente de Emisión',
[TIPOS_EVENTO.RENOVACION_EMITIDA]: 'Renovación Emitida',
[TIPOS_EVENTO.PAGO_RENOVACION_REGISTRADO]: 'Pago de Renovación Registrado',
[TIPOS_EVENTO.RENOVACION_VIGENTE]: 'Renovación Vigente',
```

---

## 7️⃣ MODIFICAR FUNCIÓN aplicarPago PARA DETECTAR RENOVACIONES

Buscar la función `aplicarPago` (línea ~6260) y modificar para que al aplicar pago a una póliza con `etapa_activa = "Renovación Emitida"`, cambie a `etapa_activa = "Renovada"` y mueva a carpeta "Renovadas":

```javascript
// Dentro de la función aplicarPago, después de registrar el pago

// Detectar si es una renovación y cambiar estado final
if (expedienteActual.etapa_activa === 'Renovación Emitida') {
  // Cambiar a estado final "Renovada"
  await fetch(`${API_URL}/api/expedientes/${expedienteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      etapa_activa: 'Renovada'
    })
  });
  
  // Registrar evento final
  await historialService.registrarEvento({
    expediente_id: expedienteId,
    cliente_id: expedienteActual.cliente_id,
    tipo_evento: 'renovacion_vigente',
    usuario_nombre: 'Sistema',
    descripcion: 'Renovación completada y vigente',
    datos_adicionales: {
      numero_poliza: expedienteActual.numero_poliza,
      monto_pagado: montoPagado
    }
  });
  
  toast.success('💚 Renovación completada - Póliza movida a carpeta "Renovadas"');
} else {
  // Flujo normal para pólizas nuevas
  toast.success('✅ Pago aplicado correctamente');
}
```

---

## 📝 RESUMEN DE CAMBIOS

1. ✅ Estados agregados para modales y datos
2. ✅ 3 funciones de manejo implementadas
3. ✅ 3 botones condicionales en listado
4. ✅ 3 modales completos con formularios
5. ✅ 6 nuevos tipos de evento agregados
6. ✅ Detección de renovación en aplicarPago

---

## 🎯 COMPORTAMIENTO ESPERADO

### Flujo Visual:

```
Carpeta "Por Renovar" o "Vencidas"
  ↓
[Botón "Cotizar" 📝] → Estado: "En Cotización - Renovación" → Carpeta: "En Proceso"
  ↓
Usuario envía cotización por Email/WhatsApp (botones existentes)
  ↓
[Botón "Autorizar" ✅] → Estado: "Pendiente de Emisión - Renovación"
  ↓
[Botón "Agregar Renovada" 🔄] → Estado: "Renovación Emitida"
  ↓
[Botón "Aplicar Pago" 💰] → Estado: "Renovada" → Carpeta: "Renovadas"
```

### Botones Visibles Según Estado:

| Estado Actual | Botón Visible |
|--------------|---------------|
| (Sin iniciar) | 📝 Cotizar |
| En Cotización - Renovación | ✅ Autorizar |
| Renovación Enviada | ✅ Autorizar |
| Pendiente de Emisión - Renovación | 🔄 Agregar Renovada |
| Renovación Emitida | 💰 Aplicar Pago |
| Renovada | (ninguno - proceso completo) |

---

## ⚠️ NOTAS IMPORTANTES

1. **Backend**: Asegúrate de que Hugo agregue los nuevos campos necesarios en BD
2. **Validaciones**: Los botones solo aparecen en carpetas "Por Renovar" y "Vencidas"
3. **Estados**: Los nombres de `etapa_activa` deben coincidir exactamente
4. **Historial**: Todos los eventos quedan registrados para trazabilidad
5. **Carpetas**: El flujo completo respeta el movimiento automático de carpetas

---

**Fecha:** 25 de Noviembre, 2025
**Archivo:** Expedientes.jsx
**Módulo:** Sistema de Renovación de Pólizas

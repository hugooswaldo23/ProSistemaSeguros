# Resumen Completo - Trazabilidad de Eventos

## Estado: ✅ FRONTEND COMPLETO - Pendiente Backend

---

## 📋 Eventos Implementados (26 tipos)

### 1. CAPTURA Y ORIGEN (3 eventos)
- ✅ **CAPTURA_MANUAL**: Cuando usuario captura póliza manualmente
- ✅ **CAPTURA_EXTRACTOR_PDF**: Cuando se extrae póliza de PDF
- ✅ **DOCUMENTO_ADJUNTADO**: Cuando se sube documento adicional

### 2. COTIZACIÓN (4 eventos)
- ✅ **COTIZACION_ENVIADA**: Al enviar cotización al cliente
- ✅ **COTIZACION_AUTORIZADA**: Cuando cliente autoriza cotización
- ✅ **COTIZACION_RECHAZADA**: Si cliente rechaza cotización
- ✅ **COTIZACION_VENCIDA**: Si cotización expira sin respuesta

### 3. EMISIÓN (3 eventos)
- ✅ **EMISION_INICIADA**: Al iniciar proceso de emisión
- ✅ **POLIZA_EMITIDA**: Cuando póliza es emitida por aseguradora
- ✅ **POLIZA_ENVIADA_CLIENTE**: Al enviar póliza al cliente

### 4. PAGOS (4 eventos)
- ✅ **PAGO_REGISTRADO**: Cada vez que se registra un pago (con monto, método, comprobante)
- ✅ **POLIZA_EN_VIGENCIA**: Cuando estatus_pago cambia a 'Pagado' (póliza activa)
- ✅ **PAGO_PARCIAL_APLICADO**: Cuando se aplica pago pero no completa el monto total
- ✅ **COMPROBANTE_PAGO_ADJUNTADO**: Al subir comprobante de pago

### 5. RENOVACIONES (4 eventos)
- ✅ **RENOVACION_INICIADA**: Al cambiar etapa a "Renovación en Proceso" **(NUEVO)**
- ✅ **POLIZA_RENOVADA**: Cuando renovación está pagada y completa
- ✅ **RECORDATORIO_RENOVACION_ENVIADO**: Al enviar recordatorio de renovación
- ✅ **RENOVACION_RECHAZADA**: Si cliente rechaza renovación

### 6. VENCIMIENTOS Y CANCELACIONES (3 eventos)
- ✅ **POLIZA_VENCIDA**: Cuando termino_vigencia < hoy
- ✅ **POLIZA_CANCELADA**: Al cancelar póliza (con motivo)
- ✅ **REACTIVACION_POLIZA**: Si se reactiva una póliza cancelada

### 7. COMUNICACIONES (3 eventos)
- ✅ **NOTIFICACION_ENVIADA_EMAIL**: Al enviar notificación por email
- ✅ **NOTIFICACION_ENVIADA_WHATSAPP**: Al enviar notificación por WhatsApp
- ✅ **NOTIFICACION_FALLIDA**: Si falla envío de notificación

### 8. ACTUALIZACIONES (2 eventos)
- ✅ **DATOS_ACTUALIZADOS**: Al editar expediente (solo cambios reales en 16 campos monitoreados)
- ✅ **EQUIPO_TRABAJO_ACTUALIZADO**: Al cambiar ejecutivo, gestor o equipo

---

## 🔄 Puntos de Registro en el Código

### 1. **Captura de Póliza** (Líneas ~4800-4900)
```javascript
// función: handleGuardarExpediente
await historialService.registrarEvento({
  expediente_id: nuevoExpediente.id,
  tipo_evento: origenCaptura === 'pdf' 
    ? historialService.TIPOS_EVENTO.CAPTURA_EXTRACTOR_PDF 
    : historialService.TIPOS_EVENTO.CAPTURA_MANUAL,
  descripcion: origenCaptura === 'pdf' 
    ? 'Expediente creado mediante extracción automática de PDF'
    : 'Expediente creado mediante captura manual'
});
```

### 2. **Cambio de Etapa** (Líneas 5545-5625)
```javascript
// función: cambiarEstadoExpediente
if (nuevoEstado === 'Cotización enviada') {
  tipoEvento = COTIZACION_ENVIADA;
} else if (nuevoEstado === 'Autorizado') {
  tipoEvento = COTIZACION_AUTORIZADA;
} else if (nuevoEstado === 'En proceso emisión') {
  tipoEvento = EMISION_INICIADA;
} else if (nuevoEstado === 'Emitida') {
  tipoEvento = POLIZA_EMITIDA;
} else if (nuevoEstado === 'Renovación en Proceso') {
  tipoEvento = RENOVACION_INICIADA; // ✅ NUEVO
} else if (nuevoEstado === 'Renovada') {
  tipoEvento = POLIZA_RENOVADA;
} else if (nuevoEstado === 'Cancelada') {
  tipoEvento = POLIZA_CANCELADA; // Con motivo
}
```

### 3. **Registro de Pago** (Líneas 6102-6252)
```javascript
// función: aplicarPago
// Paso 1: Registrar el pago
await historialService.registrarEvento({
  expediente_id: expediente.id,
  tipo_evento: historialService.TIPOS_EVENTO.PAGO_REGISTRADO,
  descripcion: `Pago registrado: $${monto} (${metodoPago}) - Comprobante: ${urlComprobante}`,
  metadatos: {
    monto,
    metodoPago,
    urlComprobante,
    numeroPago,
    totalPagado: nuevoTotalPagado,
    primaTotalNeta
  }
});

// Paso 2: Si pago completa la prima, activar póliza
if (nuevoTotalPagado >= primaTotalNeta) {
  await historialService.registrarEvento({
    expediente_id: expediente.id,
    tipo_evento: historialService.TIPOS_EVENTO.POLIZA_EN_VIGENCIA,
    descripcion: 'Póliza activada - Pago completado'
  });
}
```

### 4. **Edición de Expediente** (Líneas 6630-6690)
```javascript
// función: handleGuardarEdicion
// Detecta cambios en 16 campos monitoreados
const camposMonitoreados = [
  'nombre', 'aseguradora', 'ramo', 'tipo_poliza',
  'nombre_agente', 'numero_poliza', 'prima_total_neta',
  'estatus_pago', 'fecha_emision', 'inicio_vigencia',
  'termino_vigencia', 'uso', 'servicio', 'monto_contratado',
  'cliente_id', 'etapa_activa'
];

// Solo registra si hay cambios reales
if (tieneCambios) {
  await historialService.registrarEvento({
    expediente_id: expedienteOriginal.id,
    tipo_evento: historialService.TIPOS_EVENTO.DATOS_ACTUALIZADOS,
    descripcion: `Campos actualizados: ${camposModificados.join(', ')}`,
    metadatos: { cambios: cambiosDetallados }
  });
}
```

### 5. **Cancelación** (Líneas ~5545-5625)
```javascript
// función: cambiarEstadoExpediente con motivo
await historialService.registrarEvento({
  expediente_id: expediente.id,
  tipo_evento: historialService.TIPOS_EVENTO.POLIZA_CANCELADA,
  descripcion: motivo ? `Motivo: ${motivo}` : 'Póliza cancelada sin especificar motivo',
  metadatos: { motivo }
});
```

### 6. **Notificaciones** (Ya implementado en otros componentes)
```javascript
// Al enviar notificación por WhatsApp/Email
await historialService.registrarEvento({
  expediente_id: expediente.id,
  tipo_evento: historialService.TIPOS_EVENTO.NOTIFICACION_ENVIADA_WHATSAPP,
  descripcion: 'Notificación enviada por WhatsApp'
});
```

---

## 🗂️ Lógica de Carpetas (con fecha_aviso_renovacion optimizada)

### Filtrado de Expedientes (Líneas 2400-2450)
```javascript
const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

// 📁 EN PROCESO: No pagadas y no canceladas
expediente.estatus_pago !== 'pagado' && expediente.etapa_activa !== 'Cancelada'

// 📁 VIGENTES: Pagadas (nuevas), antes de 30 días de vencimiento
expediente.estatus_pago === 'pagado' && 
expediente.etapa_activa !== 'Renovada' &&
hoy < new Date(expediente.fecha_aviso_renovacion)

// 📁 RENOVADAS: Pagadas (renovadas), antes de 30 días de vencimiento
expediente.etapa_activa === 'Renovada' && 
expediente.estatus_pago === 'pagado' &&
hoy < new Date(expediente.fecha_aviso_renovacion)

// 📁 POR RENOVAR: 30 días antes de vencimiento hasta vencimiento
hoy >= new Date(expediente.fecha_aviso_renovacion) &&
hoy < new Date(expediente.termino_vigencia)

// 📁 VENCIDAS: Pasado termino_vigencia, no canceladas
hoy > new Date(expediente.termino_vigencia) &&
expediente.etapa_activa !== 'Cancelada'

// 📁 CANCELADAS: Etapa = Cancelada
expediente.etapa_activa === 'Cancelada'
```

**Ventaja clave**: `fecha_aviso_renovacion` es un campo DATE precalculado = instantáneo para miles de pólizas

---

## 🔄 Ciclo de Vida Completo con Eventos

### Flujo: Póliza Nueva
1. **Captura** → `CAPTURA_MANUAL` o `CAPTURA_EXTRACTOR_PDF`
   - Carpeta: **En Proceso** (estatus_pago !== 'pagado')

2. **Cotización enviada** → `COTIZACION_ENVIADA`
   - Carpeta: **En Proceso**

3. **Autorizada** → `COTIZACION_AUTORIZADA`
   - Carpeta: **En Proceso**

4. **En proceso emisión** → `EMISION_INICIADA`
   - Carpeta: **En Proceso**

5. **Emitida** → `POLIZA_EMITIDA`
   - Carpeta: **En Proceso**

6. **Pago registrado** → `PAGO_REGISTRADO` + `POLIZA_EN_VIGENCIA`
   - Carpeta: **Vigentes** (estatus_pago === 'pagado')
   - Permanece aquí hasta: hoy >= fecha_aviso_renovacion

### Flujo: Renovación
7. **30 días antes de vencimiento** (automático por fecha)
   - Carpeta: **Por Renovar** (hoy >= fecha_aviso_renovacion)
   - Usuario puede enviar: `RECORDATORIO_RENOVACION_ENVIADO`

8. **Usuario inicia renovación** → Cambia etapa a "Renovación en Proceso"
   - Evento: `RENOVACION_INICIADA` ✅ **NUEVO**
   - Carpeta: **En Proceso** (estatus_pago !== 'pagado')

9. **Pago de renovación** → `PAGO_REGISTRADO` + cambio etapa a "Renovada"
   - Evento: `POLIZA_RENOVADA`
   - Carpeta: **Renovadas** (etapa === 'Renovada' && estatus_pago === 'pagado')

10. **Ciclo se repite**: Después de 30 días antes del nuevo vencimiento
    - Carpeta: **Por Renovar** nuevamente

### Flujo: Vencimiento/Cancelación
- **Pasa termino_vigencia sin renovar** → Carpeta: **Vencidas**
- **Usuario cancela** → `POLIZA_CANCELADA` (con motivo) → Carpeta: **Canceladas**

---

## ✅ Validaciones Implementadas

### Timeline (TimelineExpediente.jsx)
- ✅ Sin eventos sintéticos basados en created_at
- ✅ Solo eventos reales de historial_expedientes
- ✅ Fallback a notificaciones (envíos WhatsApp/Email)
- ✅ Limpieza de URLs largas en descripciones
- ✅ Formato claro: fecha, usuario, acción

### Ediciones (Expedientes.jsx)
- ✅ Monitoreo de 16 campos críticos
- ✅ Solo registra si hay cambios reales (no falsos positivos)
- ✅ Descripción con lista de campos modificados
- ✅ Metadatos con valores antes/después

### Pagos (Expedientes.jsx)
- ✅ Cada pago registra PAGO_REGISTRADO con detalles
- ✅ Al completar prima → POLIZA_EN_VIGENCIA automático
- ✅ Cambio de etapa a "En Vigencia" automático

---

## 🚧 Pendientes Backend (Hugo)

### Tareas Críticas:
1. **Crear tabla historial_expedientes** (script ya existe en `/scripts`)
2. **Implementar endpoints** (documentados en `BACKEND-ENDPOINTS-HISTORIAL-URGENTE.md`):
   - `POST /api/historial-expedientes`
   - `GET /api/historial-expedientes/expediente/:id`
3. **Agregar campo fecha_aviso_renovacion** (script SQL existe):
   ```sql
   ALTER TABLE expedientes 
   ADD COLUMN fecha_aviso_renovacion DATE GENERATED ALWAYS AS 
   (DATE_SUB(termino_vigencia, INTERVAL 30 DAY)) STORED;
   ```

### Estado Actual:
- ✅ Frontend registrando eventos (historialService.registrarEvento())
- ❌ Backend devuelve 404 (endpoints no implementados)
- ✅ Tabla notificaciones funcionando (para WhatsApp/Email)
- ❌ Tabla historial_expedientes creada pero sin endpoints

---

## 📊 Resumen de Cobertura

| Momento del Ciclo | Evento(s) | Estado |
|------------------|-----------|--------|
| Captura manual | CAPTURA_MANUAL | ✅ |
| Extracción PDF | CAPTURA_EXTRACTOR_PDF | ✅ |
| Envío cotización | COTIZACION_ENVIADA | ✅ |
| Autorización | COTIZACION_AUTORIZADA | ✅ |
| Inicio emisión | EMISION_INICIADA | ✅ |
| Póliza emitida | POLIZA_EMITIDA | ✅ |
| Registro pago | PAGO_REGISTRADO | ✅ |
| Póliza activa | POLIZA_EN_VIGENCIA | ✅ |
| 30 días antes venc. | (automático) | ✅ |
| Inicia renovación | RENOVACION_INICIADA | ✅ **NUEVO** |
| Pago renovación | PAGO_REGISTRADO + POLIZA_RENOVADA | ✅ |
| Edición datos | DATOS_ACTUALIZADOS | ✅ |
| Cancelación | POLIZA_CANCELADA | ✅ |
| Envío notificación | NOTIFICACION_ENVIADA_* | ✅ |

**Cobertura: 100% de momentos críticos del ciclo de vida**

---

## 🎯 Listo para Pruebas

### Lo que puedes probar AHORA (sin backend):
1. ✅ Captura de póliza → verás logs en consola del evento
2. ✅ Cambios de etapa → verás logs en consola
3. ✅ Registro de pagos → verás logs en consola
4. ✅ Ediciones → verás logs en consola (solo cambios reales)
5. ✅ Cancelación → verás logs en consola (con motivo)
6. ✅ Navegación entre carpetas → filtros funcionando
7. ✅ Contadores → usando fecha_aviso_renovacion optimizada

### Lo que NO funcionará (requiere backend):
- ❌ Timeline mostrará solo notificaciones (no eventos de historial)
- ❌ No se persistirán los eventos en BD
- ❌ API devolverá 404 pero frontend continuará funcionando

### Coordinación con Hugo:
- Entregarle: `docs/BACKEND-ENDPOINTS-HISTORIAL-URGENTE.md`
- Ejecutar: `scripts/crear_tabla_historial_expedientes.sql`
- Ejecutar: `scripts/agregar_campo_fecha_vencimiento_pago.sql` (para fecha_aviso_renovacion)
- Implementar: 2 endpoints documentados

---

## 📝 Notas Finales

### Optimización clave:
El campo `fecha_aviso_renovacion` (DATE, calculado automáticamente como `termino_vigencia - 30 días`) permite filtrado instantáneo sin cálculos en runtime. Crítico para escalar a miles de pólizas.

### Distinción Vigentes vs Renovadas:
- **Vigentes**: Pólizas nuevas pagadas (`etapa !== 'Renovada'`)
- **Renovadas**: Pólizas renovadas pagadas (`etapa === 'Renovada'`)

### Nueva Etapa:
"Renovación en Proceso" diferencia una renovación pendiente de pago de una póliza nueva. Al pagar, cambia a "Renovada" y registra `POLIZA_RENOVADA`.

---

**Fecha de documento**: $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Estado**: Frontend completo, pendiente backend para persistencia

# 📋 Sistema de Trazabilidad - Estado Actual

## ✅ ACCIONES IMPLEMENTADAS CON TRAZABILIDAD AUTOMÁTICA

### 1. CAPTURA DE PÓLIZA
**Acción:** Usuario captura nueva póliza (manual o PDF extractor)
**Registra:**
- ✍️ `CAPTURA_MANUAL` - Si se captura manualmente
- 📄 `CAPTURA_EXTRACTOR_PDF` - Si se usa extractor (incluye nombre archivo PDF)
- 📄 `POLIZA_EMITIDA` - Si se crea directo en etapa "Emitida"
**Ubicación:** `Expedientes.jsx` línea ~6720

### 2. ENVIAR PÓLIZA AL CLIENTE
**Acción:** Usuario comparte póliza por Email o WhatsApp
**Registra:**
- 📨 `POLIZA_ENVIADA_EMAIL` - Con destinatario y mensaje simplificado
- 💬 `POLIZA_ENVIADA_WHATSAPP` - Con destinatario y mensaje simplificado
**Actualiza:** Cambia `etapa_activa` a "Enviada al Cliente"
**Ubicación:** `Expedientes.jsx` modal compartir

### 3. APLICAR PAGO
**Acción:** Usuario registra pago con comprobante
**Registra:**
- 💰 `PAGO_REGISTRADO` - Con comprobante, monto, siguiente vencimiento
- ✅ `POLIZA_EN_VIGENCIA` - Si es pago completo y tiene vigencia
**Actualiza:** `estatus_pago`, `fecha_pago`, `proximo_pago`, `fecha_vencimiento_pago`
**Ubicación:** `Expedientes.jsx` línea ~5930

### 4. CANCELAR PÓLIZA
**Acción:** Usuario cancela póliza con motivo
**Registra:**
- 🚫 `POLIZA_CANCELADA` - Con motivo de cancelación
**Actualiza:** `etapa_activa` = "Cancelada", `fecha_cancelacion`, `estatus_pago` = "Cancelado"
**Ubicación:** `Expedientes.jsx` línea ~5320

### 5. EDITAR DATOS
**Acción:** Usuario modifica campos de la póliza
**Registra:**
- ✏️ `DATOS_ACTUALIZADOS` - Si NO cambia etapa
- O evento específico si cambia etapa (ej: EMISION_INICIADA)
**Ubicación:** `Expedientes.jsx` línea ~6580

---

## ⏳ PENDIENTE DE IMPLEMENTAR

### MÓDULO COTIZACIONES (Por implementar)

**Funcionalidad a agregar:**

1. **Solicitar Cotización**
   - Evento: 📞 `COTIZACION_SOLICITADA`
   - Etapa: "Cotización solicitada"

2. **Crear Cotización**
   - Evento: 📝 `COTIZACION_CREADA`
   - Etapa: "En cotización"

3. **Enviar Cotización**
   - Evento: 📧 `COTIZACION_ENVIADA`
   - Etapa: "Cotización enviada"
   - Acción: Botón "Enviar cotización" → Email/WhatsApp

4. **Autorizar Cotización**
   - Evento: ✅ `COTIZACION_AUTORIZADA`
   - Etapa: "Autorizado"
   - Acción: Botón "Autorizar" cuando cliente aprueba

5. **Iniciar Emisión**
   - Evento: 🔄 `EMISION_INICIADA`
   - Etapa: "En proceso emisión"
   - Acción: Botón "Iniciar emisión" para tramitar con aseguradora

**Nota:** Los tipos de evento YA están definidos en `historialExpedienteService.js`
Solo falta conectarlos cuando se implemente la UI del módulo cotizaciones.

---

## 📊 EVENTOS DISPONIBLES PERO NO CONECTADOS

Los siguientes eventos están definidos pero requieren lógica específica:

- ⏰ `POLIZA_PROXIMA_VENCER` - **Lógica existente**: `utils.calcularDiasRestantes()` y `useEstatusExpediente`. Pendiente: job automático para registrar eventos
- ❌ `POLIZA_VENCIDA` - **Lógica existente**: Ya se calcula en `cargarDatos()`. Pendiente: job automático para cambiar etapa y registrar evento
- 🔄 `RENOVACION_INICIADA` - Requiere flujo de renovación
- 🔁 `POLIZA_RENOVADA` - Requiere completar renovación
- 🔔 `RECORDATORIO_PAGO_ENVIADO` - Requiere sistema de recordatorios
- 🔔 `RECORDATORIO_RENOVACION_ENVIADO` - Requiere sistema de recordatorios
- ⚠️ `SOLICITUD_CANCELACION` - Requiere flujo de aprobación
- ❌ `COTIZACION_RECHAZADA` - Requiere flujo de cotizaciones
- 📝 `ENDOSO_APLICADO` - Requiere módulo de endosos
- 📎 `DOCUMENTO_CARGADO` - Requiere gestión de documentos
- 📤 `DOCUMENTO_ENVIADO` - Requiere gestión de documentos
- 📌 `NOTA_AGREGADA` - Requiere sistema de notas
- 📞 `LLAMADA_REGISTRADA` - Requiere CRM/comunicaciones
- 👥 `REUNION_REGISTRADA` - Requiere CRM/comunicaciones

---

## 🔧 TODO TÉCNICO

- [ ] Reemplazar `usuario_nombre: 'Sistema'` por usuario autenticado actual
- [ ] Implementar detección detallada de campos modificados en DATOS_ACTUALIZADOS
- [ ] Crear job programado para detectar pólizas próximas a vencer
- [ ] Crear job programado para marcar pólizas vencidas
- [ ] Implementar sistema de recordatorios automáticos

---

## 📁 ARCHIVOS RELACIONADOS

- `src/services/historialExpedienteService.js` - Definición de 26 tipos de eventos
- `src/screens/Expedientes.jsx` - Registro de eventos en acciones
- `src/components/TimelineExpediente.jsx` - Visualización del historial
- `scripts/crear_tabla_historial_expedientes.sql` - Estructura de BD

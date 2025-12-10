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

- ⏰ `POLIZA_PROXIMA_VENCER` - **Optimizado**: Campo `fecha_aviso_renovacion` precalculado (termino_vigencia - 30 días). Query simple: `SELECT * WHERE fecha_aviso_renovacion = CURDATE()`
- ❌ `POLIZA_VENCIDA` - **Optimizado**: Campo `termino_vigencia` ya existe. Query simple: `SELECT * WHERE termino_vigencia < CURDATE()`
- **Pendiente**: Job backend que ejecute queries diariamente y registre eventos en historial
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
- [ ] Implementar detección detallada de campos modificados en DATOS_ACTUALIZADOSINSTRUCCIONES PARA HUGO - COMPROBANTES DE PAGO EN AWS S3
==========================================================

OBJETIVO:
Permitir subir y visualizar comprobantes de pago en AWS S3 (igual que las pólizas)

----------------------------------------------------------
ENDPOINT NECESARIO
----------------------------------------------------------

POST /api/expedientes/:id/comprobante
Content-Type: multipart/form-data

Campos del formulario:
- file: El archivo del comprobante (PDF/imagen)
- tipo: "comprobante-pago"
- expediente_id: ID del expediente

Response exitosa (200):
{
  "success": true,
  "data": {
    "url": "https://s3.amazonaws.com/prosistema-polizas/comprobantes/2025/expediente-431/comprobante-20251208.pdf",
    "pdf_url": "https://s3.amazonaws.com/prosistema-polizas/comprobantes/2025/expediente-431/comprobante-20251208.pdf",
    "pdf_key": "comprobantes/2025/expediente-431/comprobante-20251208.pdf",
    "pdf_nombre": "comprobante-pago.pdf",
    "pdf_size": 245680
  }
}

Response error (500):
{
  "success": false,
  "error": "Descripción del error"
}

----------------------------------------------------------
ESTRUCTURA EN S3
----------------------------------------------------------

Bucket: prosistema-polizas (el mismo existente)

Nueva carpeta para comprobantes:
comprobantes/
  └── 2025/
      └── expediente-{id}/
          ├── comprobante-20251208.pdf
          ├── comprobante-20251215.pdf

Ejemplo de key completa:
comprobantes/2025/expediente-431/comprobante-20251208.pdf

----------------------------------------------------------
LÓGICA DEL ENDPOINT
----------------------------------------------------------

1. Recibir archivo via multer o similar
2. Generar nombre: comprobante-{YYYYMMDD}.pdf
3. Key de S3: comprobantes/{año}/expediente-{id}/{nombre}
4. Subir a S3 usando s3.upload()
5. Retornar URL pública del archivo

----------------------------------------------------------
CONFIGURACIÓN AWS (YA EXISTENTE)
----------------------------------------------------------

Usar las MISMAS credenciales que para PDFs de pólizas:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_S3_BUCKET=prosistema-polizas
- AWS_REGION=us-east-1

----------------------------------------------------------
VALIDACIONES RECOMENDADAS
----------------------------------------------------------

- Solo permitir: PDF, JPG, PNG
- Tamaño máximo: 10MB
- Verificar que el expediente existe
- Sanitizar nombre del archivo

----------------------------------------------------------
COMANDO DE PRUEBA
----------------------------------------------------------

curl -X POST http://localhost:3000/api/expedientes/431/comprobante \
  -F 'file=@/ruta/al/comprobante.pdf' \
  -F 'tipo=comprobante-pago' \
  -F 'expediente_id=431'

Debe retornar JSON con URL accesible del comprobante.

----------------------------------------------------------
NOTAS IMPORTANTES
----------------------------------------------------------

- El frontend YA está implementado
- El frontend sube el comprobante cuando se aplica un pago
- El frontend guarda la URL en el historial (datos_adicionales.comprobante_url)
- El botón "Ver Comprobante" abre la URL en nueva pestaña
- Si falla la subida, el frontend continúa (no bloquea el pago)

SOLO FALTA IMPLEMENTAR EL ENDPOINT EN BACKEND.

PRIORIDAD: ALTA
- [ ] Crear job programado para detectar pólizas próximas a vencer
- [ ] Crear job programado para marcar pólizas vencidas
- [ ] Implementar sistema de recordatorios automáticos

---

## 📁 ARCHIVOS RELACIONADOS

- `src/services/historialExpedienteService.js` - Definición de 26 tipos de eventos
- `src/screens/Expedientes.jsx` - Registro de eventos en acciones
- `src/components/TimelineExpediente.jsx` - Visualización del historial
- `scripts/crear_tabla_historial_expedientes.sql` - Estructura de BD

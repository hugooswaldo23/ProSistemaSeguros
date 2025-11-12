# ✅ Checklist: Sistema de Notificaciones - Pendientes

## 📋 Resumen de Implementación

| Componente | Estado | Responsable | Archivo |
|-----------|--------|-------------|---------|
| **Script SQL tabla** | ✅ Creado | Frontend | `scripts/crear_tabla_notificaciones.sql` |
| **Servicio notificaciones** | ✅ Implementado | Frontend | `src/services/notificacionesService.js` |
| **Componente historial** | ✅ Implementado | Frontend | `src/components/HistorialNotificaciones.jsx` |
| **Funciones compartir** | ✅ Implementadas | Frontend | `src/screens/Expedientes.jsx` |
| **Ejecutar script SQL** | ❌ Pendiente | **Backend** | - |
| **Endpoint POST notificaciones** | ❌ Pendiente | **Backend** | `/api/notificaciones` |
| **Endpoint GET por expediente** | ❌ Pendiente | **Backend** | `/api/notificaciones/expediente/:id` |
| **Endpoint GET por cliente** | ❌ Pendiente | **Backend** | `/api/notificaciones/cliente/:id` |

---

## 🎯 Lo que YA funciona (Frontend 100%)

### ✅ Registro automático de notificaciones
**Ubicación:** `src/screens/Expedientes.jsx` líneas 4419-4569

Cuando un usuario comparte una póliza:

1. **Por WhatsApp** (función `compartirPorWhatsApp`):
   - ✅ Se obtiene el teléfono del cliente
   - ✅ Se genera mensaje dinámico según el estado
   - ✅ Se obtiene URL firmada del PDF (si existe)
   - ✅ Se abre WhatsApp con el mensaje
   - ✅ **Se registra la notificación** llamando a:
     ```javascript
     await notificacionesService.registrarNotificacion({ ... })
     ```

2. **Por Email** (función `compartirPorEmail`):
   - ✅ Se obtiene el email del cliente
   - ✅ Se genera asunto y cuerpo dinámico
   - ✅ Se obtiene URL firmada del PDF (si existe)
   - ✅ Se abre mailto: con el mensaje
   - ✅ **Se registra la notificación** llamando a:
     ```javascript
     await notificacionesService.registrarNotificacion({ ... })
     ```

### ✅ Datos que se envían al backend
```javascript
{
  expediente_id: 142,                    // ID de la póliza
  cliente_id: "CLI-00001",               // ID del cliente
  tipo_notificacion: "whatsapp",         // whatsapp | email | sms
  tipo_mensaje: "emision",               // tipo según estado
  destinatario_nombre: "Juan Pérez",     // nombre del cliente
  destinatario_contacto: "5551234567",   // teléfono o email
  asunto: null,                          // solo para email
  mensaje: "Mensaje completo...",        // texto enviado
  numero_poliza: "POL-12345",           // número de póliza
  compania: "Qualitas",                 // aseguradora
  producto: "Autos Individual",         // tipo de producto
  estatus_pago: "Pendiente",            // estado del pago
  fecha_vencimiento_pago: "2025-12-01", // cuándo vence
  pdf_url: "https://...",               // URL del PDF (si aplica)
  pdf_expiracion: "2025-11-11T...",     // cuándo expira el PDF
  estado_envio: "enviado"               // enviado | fallido | pendiente
}
```

### ✅ Visualización del historial
**Componente:** `src/components/HistorialNotificaciones.jsx`

- ✅ Carga automática al abrir detalle de póliza
- ✅ Lista ordenada por fecha (más recientes primero)
- ✅ Íconos diferentes por tipo (WhatsApp, Email, SMS)
- ✅ Badges de color según tipo de mensaje
- ✅ Mostrar/ocultar mensaje completo
- ✅ Información del destinatario
- ✅ Fecha y hora de envío
- ✅ Estado del envío (enviado, fallido, pendiente)
- ✅ Información del PDF compartido
- ✅ Botón de recarga manual

---

## ❌ Lo que FALTA (Backend)

### Tarea 1: Crear la tabla en la BD
```bash
# Ejecutar una sola vez:
mysql -u usuario -p base_datos < scripts/crear_tabla_notificaciones.sql
```

**Verificar:**
```sql
SHOW TABLES LIKE 'notificaciones';
DESCRIBE notificaciones;
```

---

### Tarea 2: Endpoint POST /api/notificaciones

**URL:** `POST http://localhost:3000/api/notificaciones`

**Headers:**
```
Content-Type: application/json
```

**Body esperado por el frontend:**
```json
{
  "expediente_id": 142,
  "cliente_id": "CLI-00001",
  "tipo_notificacion": "whatsapp",
  "tipo_mensaje": "emision",
  "destinatario_nombre": "Juan Pérez",
  "destinatario_contacto": "5551234567",
  "mensaje": "...",
  "numero_poliza": "POL-12345",
  "compania": "Qualitas",
  "producto": "Autos Individual",
  "estatus_pago": "Pendiente",
  "fecha_vencimiento_pago": "2025-12-01",
  "pdf_url": "https://...",
  "pdf_expiracion": "2025-11-11T12:00:00Z",
  "estado_envio": "enviado"
}
```

**Response esperado:**
```json
{
  "success": true,
  "message": "Notificación registrada exitosamente",
  "data": {
    "id": 1,
    "expediente_id": 142,
    ...
  }
}
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/notificaciones \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 142,
    "cliente_id": "CLI-00001",
    "tipo_notificacion": "whatsapp",
    "tipo_mensaje": "emision",
    "destinatario_nombre": "Test",
    "destinatario_contacto": "5551234567",
    "mensaje": "Test",
    "estado_envio": "enviado"
  }'
```

---

### Tarea 3: Endpoint GET /api/notificaciones/expediente/:id

**URL:** `GET http://localhost:3000/api/notificaciones/expediente/142`

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": 142,
      "cliente_id": "CLI-00001",
      "tipo_notificacion": "whatsapp",
      "tipo_mensaje": "emision",
      "destinatario_nombre": "Juan Pérez",
      "destinatario_contacto": "5551234567",
      "mensaje": "...",
      "numero_poliza": "POL-12345",
      "compania": "Qualitas",
      "producto": "Autos Individual",
      "estatus_pago": "Pendiente",
      "fecha_vencimiento_pago": "2025-12-01",
      "fecha_envio": "2025-11-10T14:30:00Z",
      "estado_envio": "enviado",
      "pdf_url": "https://...",
      "pdf_expiracion": "2025-11-11T14:30:00Z"
    }
  ]
}
```

**IMPORTANTE:** Ordenar por `fecha_envio DESC`

**Test:**
```bash
curl http://localhost:3000/api/notificaciones/expediente/142
```

---

### Tarea 4: Endpoint GET /api/notificaciones/cliente/:id

**URL:** `GET http://localhost:3000/api/notificaciones/cliente/CLI-00001`

**Response esperado:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": 142,
      "numero_poliza": "POL-12345",
      "tipo_notificacion": "whatsapp",
      "fecha_envio": "2025-11-10T14:30:00Z",
      ...
    },
    {
      "id": 2,
      "expediente_id": 143,
      "numero_poliza": "POL-67890",
      "tipo_notificacion": "email",
      "fecha_envio": "2025-11-09T10:15:00Z",
      ...
    }
  ]
}
```

**IMPORTANTE:** Ordenar por `fecha_envio DESC`

**Test:**
```bash
curl http://localhost:3000/api/notificaciones/cliente/CLI-00001
```

---

## 🧪 Plan de Pruebas

### Prueba 1: Crear tabla ✅
```sql
-- Verificar que existe
SHOW TABLES LIKE 'notificaciones';

-- Ver estructura
DESCRIBE notificaciones;

-- Debería tener estos campos principales:
-- id, expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
-- destinatario_nombre, destinatario_contacto, mensaje, fecha_envio
```

### Prueba 2: Insertar dato de prueba ✅
```sql
INSERT INTO notificaciones (
  expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
  destinatario_nombre, destinatario_contacto, mensaje,
  numero_poliza, estado_envio
) VALUES (
  142, 'CLI-00001', 'whatsapp', 'emision',
  'Juan Pérez', '5551234567', 'Test mensaje',
  'POL-12345', 'enviado'
);

-- Verificar
SELECT * FROM notificaciones;
```

### Prueba 3: Endpoint POST ✅
- Usar Postman o cURL para enviar notificación
- Verificar que regresa `success: true`
- Verificar que se insertó en la BD

### Prueba 4: Endpoint GET por expediente ✅
- Llamar endpoint con ID del expediente de prueba
- Verificar que regresa las notificaciones
- Verificar orden DESC por fecha

### Prueba 5: Endpoint GET por cliente ✅
- Llamar endpoint con ID del cliente de prueba
- Verificar que regresa todas las notificaciones del cliente
- Verificar orden DESC por fecha

### Prueba 6: Integración con frontend ✅
1. Abrir detalle de póliza en el sistema
2. Ir a sección "Historial de Comunicaciones con el Cliente"
3. **Debería mostrar:** Lista de notificaciones (si existen datos)
4. **NO debería mostrar:** Error "No se pudo cargar el historial"

### Prueba 7: Compartir póliza ✅
1. Abrir detalle de póliza
2. Click en botón "Compartir"
3. Seleccionar WhatsApp o Email
4. Sistema abre WhatsApp/Email
5. **Verificar en BD:** Se insertó un nuevo registro en `notificaciones`
6. **Verificar en frontend:** Aparece en el historial inmediatamente

---

## 📊 Campos de Trazabilidad Clave

Los campos más importantes para auditoría son:

| Campo | Propósito |
|-------|-----------|
| `fecha_envio` | Cuándo se envió (automático con TIMESTAMP) |
| `tipo_notificacion` | Por qué medio (whatsapp, email, sms) |
| `destinatario_contacto` | A qué número o email |
| `mensaje` | Qué se le dijo al cliente (texto completo) |
| `numero_poliza` | Sobre qué póliza |
| `tipo_mensaje` | Contexto (emisión, recordatorio, etc.) |
| `enviado_por` | Quién lo envió (opcional, por ahora NULL) |
| `pdf_url` | Si se compartió el PDF |

---

## 🎯 Estado Actual

```
Frontend:  ████████████████████ 100% ✅
Backend:   ░░░░░░░░░░░░░░░░░░░░   0% ❌
```

**Bloqueador principal:** Endpoints de API no implementados

---

## 📞 Próximos Pasos

1. **Backend implementa los 3 endpoints** (Tarea 2, 3, 4)
2. **Backend ejecuta script SQL** (Tarea 1)
3. **Backend prueba con cURL/Postman** cada endpoint
4. **Frontend prueba desde la aplicación** (debería funcionar automáticamente)
5. **Verificar datos en BD** después de compartir pólizas

---

## 🚨 Puntos Críticos

- ⚠️ **Orden de resultados:** SIEMPRE `ORDER BY fecha_envio DESC`
- ⚠️ **Foreign keys:** Verificar que `expediente_id` y `cliente_id` existen
- ⚠️ **Formato de respuesta:** Debe ser `{ success: true, data: [...] }`
- ⚠️ **Campo opcional:** `enviado_por` puede ser NULL por ahora
- ⚠️ **Timestamps:** Usar formato ISO 8601 para fechas

---

Última actualización: 10 de noviembre de 2025

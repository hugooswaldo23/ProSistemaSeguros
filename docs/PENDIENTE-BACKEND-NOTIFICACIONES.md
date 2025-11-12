# ⚠️ PENDIENTE: Implementar Backend de Notificaciones

## 🎯 Objetivo
Completar la implementación del sistema de historial de comunicaciones con clientes. El frontend ya está listo y esperando que el backend responda.

---

## ❌ Problema Actual
El frontend muestra el error: **"No se pudo cargar el historial de notificaciones"**

**Causa:** Los endpoints de la API no existen o no están respondiendo correctamente.

---

## 📝 Tareas Pendientes

### ✅ Tarea 1: Crear la tabla en la base de datos
**Archivo:** `scripts/crear_tabla_notificaciones.sql`

```bash
# Ejecutar en MySQL/MariaDB:
mysql -u usuario -p nombre_base_datos < scripts/crear_tabla_notificaciones.sql
```

**Campos principales de la tabla:**
- `expediente_id` - ID de la póliza
- `cliente_id` - ID del cliente
- `tipo_notificacion` - whatsapp, email, sms
- `tipo_mensaje` - emision, recordatorio_pago, etc.
- `destinatario_nombre` - Nombre del cliente
- `destinatario_contacto` - Teléfono o email
- `mensaje` - Contenido del mensaje enviado
- `fecha_envio` - Cuándo se envió
- `pdf_url` - URL del PDF compartido (si aplica)
- `enviado_por` - ID del usuario que envió (opcional)

---

### ✅ Tarea 2: Implementar 3 endpoints en el backend

#### 1️⃣ POST /api/notificaciones
**Registrar una nueva notificación**

**Request Body:**
```json
{
  "expediente_id": 142,
  "cliente_id": "CLI-00001",
  "tipo_notificacion": "whatsapp",
  "tipo_mensaje": "emision",
  "destinatario_nombre": "Juan Pérez",
  "destinatario_contacto": "5551234567",
  "mensaje": "Mensaje completo enviado...",
  "numero_poliza": "POL-12345",
  "compania": "Qualitas",
  "producto": "Autos Individual",
  "estatus_pago": "Pendiente",
  "fecha_vencimiento_pago": "2025-12-01",
  "pdf_url": "https://cloudfront.net/...",
  "pdf_expiracion": "2025-11-05T12:00:00Z",
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
    "cliente_id": "CLI-00001",
    "fecha_envio": "2025-11-10T14:30:00Z",
    ...
  }
}
```

---

#### 2️⃣ GET /api/notificaciones/expediente/:expedienteId
**Obtener todas las notificaciones de una póliza**

**Ejemplo:** `GET /api/notificaciones/expediente/142`

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
    },
    {
      "id": 2,
      ...
    }
  ]
}
```

**IMPORTANTE:** Ordenar por `fecha_envio DESC` (más recientes primero)

---

#### 3️⃣ GET /api/notificaciones/cliente/:clienteId
**Obtener todas las notificaciones de un cliente (todas sus pólizas)**

**Ejemplo:** `GET /api/notificaciones/cliente/CLI-00001`

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

**IMPORTANTE:** Ordenar por `fecha_envio DESC` (más recientes primero)

---

## 📦 Código de Referencia para Backend

### Ejemplo en Node.js/Express

**Archivo: `routes/notificaciones.js`**
```javascript
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Tu conexión a BD

// POST /api/notificaciones
router.post('/', async (req, res) => {
  try {
    const datos = req.body;
    
    const query = `
      INSERT INTO notificaciones (
        expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
        destinatario_nombre, destinatario_contacto, asunto, mensaje,
        numero_poliza, compania, producto, estatus_pago, 
        fecha_vencimiento_pago, estado_envio, pdf_url, pdf_expiracion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(query, [
      datos.expediente_id,
      datos.cliente_id,
      datos.tipo_notificacion,
      datos.tipo_mensaje,
      datos.destinatario_nombre,
      datos.destinatario_contacto,
      datos.asunto || null,
      datos.mensaje,
      datos.numero_poliza || null,
      datos.compania || null,
      datos.producto || null,
      datos.estatus_pago || null,
      datos.fecha_vencimiento_pago || null,
      datos.estado_envio || 'enviado',
      datos.pdf_url || null,
      datos.pdf_expiracion || null
    ]);
    
    res.json({
      success: true,
      message: 'Notificación registrada exitosamente',
      data: {
        id: result.insertId,
        ...datos
      }
    });
  } catch (error) {
    console.error('Error al registrar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar notificación',
      error: error.message
    });
  }
});

// GET /api/notificaciones/expediente/:expedienteId
router.get('/expediente/:expedienteId', async (req, res) => {
  try {
    const { expedienteId } = req.params;
    
    const query = `
      SELECT * FROM notificaciones
      WHERE expediente_id = ?
      ORDER BY fecha_envio DESC
    `;
    
    const [rows] = await db.execute(query, [expedienteId]);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
});

// GET /api/notificaciones/cliente/:clienteId
router.get('/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const query = `
      SELECT * FROM notificaciones
      WHERE cliente_id = ?
      ORDER BY fecha_envio DESC
    `;
    
    const [rows] = await db.execute(query, [clienteId]);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
});

module.exports = router;
```

**Registrar rutas en `app.js`:**
```javascript
const notificacionesRoutes = require('./routes/notificaciones');
app.use('/api/notificaciones', notificacionesRoutes);
```

---

## 🧪 Cómo Probar los Endpoints

### Test 1: Registrar notificación
```bash
curl -X POST http://localhost:3000/api/notificaciones \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 142,
    "cliente_id": "CLI-00001",
    "tipo_notificacion": "whatsapp",
    "tipo_mensaje": "emision",
    "destinatario_nombre": "Juan Pérez",
    "destinatario_contacto": "5551234567",
    "mensaje": "Test mensaje",
    "numero_poliza": "POL-12345",
    "estado_envio": "enviado"
  }'
```

### Test 2: Obtener notificaciones de expediente
```bash
curl http://localhost:3000/api/notificaciones/expediente/142
```

### Test 3: Obtener notificaciones de cliente
```bash
curl http://localhost:3000/api/notificaciones/cliente/CLI-00001
```

---

## ✅ Checklist de Implementación

- [ ] **Ejecutar script SQL** `scripts/crear_tabla_notificaciones.sql`
- [ ] **Verificar que la tabla se creó correctamente:**
  ```sql
  SHOW TABLES LIKE 'notificaciones';
  DESCRIBE notificaciones;
  ```
- [ ] **Implementar endpoint POST** `/api/notificaciones`
- [ ] **Implementar endpoint GET** `/api/notificaciones/expediente/:id`
- [ ] **Implementar endpoint GET** `/api/notificaciones/cliente/:id`
- [ ] **Probar con cURL o Postman** cada endpoint
- [ ] **Verificar en el frontend** que el historial se carga correctamente

---

## 📊 Datos de Prueba

Después de implementar los endpoints, puedes insertar datos de prueba manualmente:

```sql
INSERT INTO notificaciones (
  expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
  destinatario_nombre, destinatario_contacto, mensaje,
  numero_poliza, compania, producto, estatus_pago,
  estado_envio, fecha_envio
) VALUES (
  142, 
  'CLI-00001', 
  'whatsapp', 
  'emision',
  'Juan Pérez', 
  '5551234567', 
  'Estimado cliente, su póliza ha sido emitida...',
  'POL-12345',
  'Qualitas',
  'Autos Individual',
  'Pendiente',
  'enviado',
  NOW()
);
```

Luego verifica en el frontend que aparece en el historial.

---

## 🎯 Resultado Esperado

Una vez implementado correctamente:

1. **Al compartir póliza por WhatsApp o Email:**
   - Se abre WhatsApp/Email con el mensaje
   - Se registra automáticamente en la tabla `notificaciones`

2. **Al abrir el detalle de una póliza:**
   - Se muestra el componente "Historial de Comunicaciones"
   - Aparecen todas las notificaciones enviadas, ordenadas por fecha
   - Se pueden expandir para ver el mensaje completo

3. **Trazabilidad completa:**
   - Qué se envió (mensaje completo)
   - Cuándo se envió (fecha y hora)
   - A quién se envió (nombre y contacto)
   - Por qué medio (WhatsApp, Email)
   - Qué tipo de mensaje era (emisión, recordatorio, etc.)
   - Quién lo envió (opcional: `enviado_por`)

---

## 📞 Dudas o Problemas

Si tienes dudas sobre la implementación:

1. **Revisa la documentación completa:** `docs/SISTEMA-NOTIFICACIONES-BACKEND.md`
2. **Revisa el código del frontend:**
   - Servicio: `src/services/notificacionesService.js`
   - Componente: `src/components/HistorialNotificaciones.jsx`
   - Uso: `src/screens/Expedientes.jsx` (funciones `compartirPorWhatsApp` y `compartirPorEmail`)

---

## 🚀 Prioridad: ALTA

Este sistema es crítico para:
- ✅ Auditar qué comunicaciones se enviaron a clientes
- ✅ Cumplir con trazabilidad de notificaciones
- ✅ Evitar duplicar envíos innecesarios
- ✅ Tener historial completo por cliente/póliza

**Estado actual del frontend:** ✅ 100% implementado y esperando backend

**Estado actual del backend:** ❌ 0% implementado (pendiente)

---

Generado: 10 de noviembre de 2025

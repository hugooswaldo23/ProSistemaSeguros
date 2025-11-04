# Sistema de Notificaciones - Implementación Backend

## 📋 Resumen
Sistema para registrar y gestionar el historial de comunicaciones enviadas a clientes (WhatsApp, Email, SMS). Permite auditar qué se notificó al cliente, cuándo y con qué contenido.

---

## 🗄️ Base de Datos

### Tabla: `notificaciones`

```sql
CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT NOT NULL,
  cliente_id VARCHAR(50) NOT NULL,
  tipo_notificacion ENUM('whatsapp', 'email', 'sms') NOT NULL DEFAULT 'whatsapp',
  tipo_mensaje ENUM(
    'emision',
    'recordatorio_pago',
    'pago_vencido',
    'pago_recibido',
    'renovacion',
    'cancelacion',
    'modificacion',
    'otro'
  ) NOT NULL DEFAULT 'emision',
  
  destinatario_nombre VARCHAR(255),
  destinatario_contacto VARCHAR(255) NOT NULL,
  
  asunto VARCHAR(500),
  mensaje TEXT NOT NULL,
  
  numero_poliza VARCHAR(100),
  compania VARCHAR(100),
  producto VARCHAR(100),
  estatus_pago VARCHAR(50),
  fecha_vencimiento_pago DATE,
  
  enviado_por INT,
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_envio ENUM('enviado', 'fallido', 'pendiente') DEFAULT 'enviado',
  
  pdf_url TEXT,
  pdf_expiracion DATETIME,
  
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_expediente (expediente_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_fecha_envio (fecha_envio),
  INDEX idx_tipo_notificacion (tipo_notificacion),
  INDEX idx_tipo_mensaje (tipo_mensaje),
  
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (enviado_por) REFERENCES equipo_trabajo(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Script SQL disponible en:** `scripts/crear_tabla_notificaciones.sql`

---

## 🔌 Endpoints a Implementar

### 1. Registrar Notificación
**POST** `/api/notificaciones`

**Request Body:**
```json
{
  "expediente_id": 142,
  "cliente_id": "CLI-00001",
  "tipo_notificacion": "whatsapp",
  "tipo_mensaje": "emision",
  "destinatario_nombre": "Juan Pérez",
  "destinatario_contacto": "5551234567",
  "asunto": null,
  "mensaje": "Mensaje completo enviado...",
  "numero_poliza": "POL-12345",
  "compania": "GNP",
  "producto": "Autos",
  "estatus_pago": "Pendiente",
  "fecha_vencimiento_pago": "2025-12-01",
  "enviado_por": null,
  "estado_envio": "enviado",
  "pdf_url": "https://...",
  "pdf_expiracion": "2025-11-04T12:00:00Z",
  "notas": null
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Notificación registrada exitosamente",
  "data": {
    "id": 1,
    "expediente_id": 142,
    "cliente_id": "CLI-00001",
    "tipo_notificacion": "whatsapp",
    "tipo_mensaje": "emision",
    "fecha_envio": "2025-11-03T14:30:00Z",
    ...
  }
}
```

**Response 400:**
```json
{
  "success": false,
  "message": "Error al registrar notificación",
  "error": "Detalles del error"
}
```

---

### 2. Obtener Notificaciones por Expediente
**GET** `/api/notificaciones/expediente/:expedienteId`

**Response 200:**
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
      "estatus_pago": "Pendiente",
      "fecha_envio": "2025-11-03T14:30:00Z",
      "estado_envio": "enviado",
      "pdf_url": "https://...",
      "pdf_expiracion": "2025-11-04T12:00:00Z"
    }
  ]
}
```

**Ordenar por:** `fecha_envio DESC` (más reciente primero)

---

### 3. Obtener Notificaciones por Cliente
**GET** `/api/notificaciones/cliente/:clienteId`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": 142,
      "numero_poliza": "POL-12345",
      "tipo_notificacion": "whatsapp",
      "tipo_mensaje": "emision",
      "fecha_envio": "2025-11-03T14:30:00Z",
      ...
    },
    {
      "id": 2,
      "expediente_id": 143,
      "numero_poliza": "POL-67890",
      "tipo_notificacion": "email",
      "tipo_mensaje": "recordatorio_pago",
      "fecha_envio": "2025-11-02T10:15:00Z",
      ...
    }
  ]
}
```

**Ordenar por:** `fecha_envio DESC`

---

## 📝 Ejemplo de Implementación en Node.js

### Modelo (models/notificacion.js)

```javascript
class Notificacion {
  static async crear(datos) {
    const query = `
      INSERT INTO notificaciones (
        expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
        destinatario_nombre, destinatario_contacto, asunto, mensaje,
        numero_poliza, compania, producto, estatus_pago, fecha_vencimiento_pago,
        enviado_por, estado_envio, pdf_url, pdf_expiracion, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      datos.enviado_por || null,
      datos.estado_envio || 'enviado',
      datos.pdf_url || null,
      datos.pdf_expiracion || null,
      datos.notas || null
    ]);

    return result.insertId;
  }

  static async obtenerPorExpediente(expedienteId) {
    const query = `
      SELECT * FROM notificaciones
      WHERE expediente_id = ?
      ORDER BY fecha_envio DESC
    `;
    const [rows] = await db.execute(query, [expedienteId]);
    return rows;
  }

  static async obtenerPorCliente(clienteId) {
    const query = `
      SELECT * FROM notificaciones
      WHERE cliente_id = ?
      ORDER BY fecha_envio DESC
    `;
    const [rows] = await db.execute(query, [clienteId]);
    return rows;
  }
}

module.exports = Notificacion;
```

### Controlador (controllers/notificacionesController.js)

```javascript
const Notificacion = require('../models/notificacion');

exports.registrarNotificacion = async (req, res) => {
  try {
    const datos = req.body;

    // Validaciones básicas
    if (!datos.expediente_id || !datos.cliente_id || !datos.tipo_notificacion || !datos.mensaje) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    const id = await Notificacion.crear(datos);

    res.json({
      success: true,
      message: 'Notificación registrada exitosamente',
      data: { id, ...datos }
    });
  } catch (error) {
    console.error('Error al registrar notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar notificación',
      error: error.message
    });
  }
};

exports.obtenerPorExpediente = async (req, res) => {
  try {
    const { expedienteId } = req.params;
    const notificaciones = await Notificacion.obtenerPorExpediente(expedienteId);

    res.json({
      success: true,
      data: notificaciones
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
};

exports.obtenerPorCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const notificaciones = await Notificacion.obtenerPorCliente(clienteId);

    res.json({
      success: true,
      data: notificaciones
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
};
```

### Rutas (routes/notificaciones.js)

```javascript
const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificacionesController');

// Registrar notificación
router.post('/', notificacionesController.registrarNotificacion);

// Obtener por expediente
router.get('/expediente/:expedienteId', notificacionesController.obtenerPorExpediente);

// Obtener por cliente
router.get('/cliente/:clienteId', notificacionesController.obtenerPorCliente);

module.exports = router;
```

### Registrar rutas en app.js

```javascript
const notificacionesRoutes = require('./routes/notificaciones');
app.use('/api/notificaciones', notificacionesRoutes);
```

---

## ✅ Checklist de Implementación

- [ ] Ejecutar script SQL para crear tabla `notificaciones`
- [ ] Crear modelo `Notificacion` con métodos CRUD
- [ ] Crear controlador `notificacionesController`
- [ ] Crear archivo de rutas `routes/notificaciones.js`
- [ ] Registrar rutas en `app.js`
- [ ] Probar endpoint POST `/api/notificaciones`
- [ ] Probar endpoint GET `/api/notificaciones/expediente/:id`
- [ ] Probar endpoint GET `/api/notificaciones/cliente/:id`
- [ ] Verificar que las foreign keys funcionan correctamente
- [ ] Verificar índices para optimización de queries

---

## 🧪 Casos de Prueba

### Test 1: Registrar notificación de emisión por WhatsApp
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
    "estatus_pago": "Pendiente",
    "estado_envio": "enviado"
  }'
```

### Test 2: Obtener notificaciones de un expediente
```bash
curl http://localhost:3000/api/notificaciones/expediente/142
```

### Test 3: Obtener notificaciones de un cliente
```bash
curl http://localhost:3000/api/notificaciones/cliente/CLI-00001
```

---

## 📊 Reportes Sugeridos (Opcional - Futuro)

1. **Reporte de comunicaciones por periodo**
   - Cuántas notificaciones se enviaron por día/semana/mes
   - Desglose por tipo (WhatsApp, Email)

2. **Reporte de efectividad**
   - Notificaciones de recordatorio vs pagos recibidos
   - Tiempo promedio entre notificación y respuesta

3. **Reporte de clientes sin notificar**
   - Pólizas emitidas sin notificación enviada
   - Pagos vencidos sin recordatorio previo

---

## 🔐 Consideraciones de Seguridad

- ✅ Los mensajes pueden contener información sensible - asegurar que solo usuarios autorizados accedan
- ✅ Las URLs de PDF tienen expiración (24 horas por defecto)
- ✅ Validar que el usuario tenga permisos para ver notificaciones del cliente/expediente
- ✅ Considerar cifrado para mensajes muy sensibles (opcional)

---

## 📞 Contacto

**Para dudas sobre esta implementación:**
- Frontend: Revisar `src/services/notificacionesService.js`
- Componente UI: `src/components/HistorialNotificaciones.jsx`
- Script SQL: `scripts/crear_tabla_notificaciones.sql`

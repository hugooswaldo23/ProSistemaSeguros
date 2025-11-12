# Backend: Sistema de Historial de Expedientes
**Fecha:** 2025-11-10  
**Propósito:** Trazabilidad completa del ciclo de vida de expedientes/pólizas

---

## 📋 Resumen

Este sistema permite registrar y consultar **todos los eventos** que ocurren durante el ciclo de vida de un expediente, desde la solicitud de cotización hasta la cancelación o renovación.

### Beneficios
- ✅ **Trazabilidad completa**: Cada acción queda registrada
- ✅ **Auditoría**: Saber quién hizo qué y cuándo
- ✅ **Seguimiento de comunicaciones**: Email, WhatsApp, llamadas
- ✅ **Cambios de estado**: Ver evolución del expediente
- ✅ **Reportes**: Estadísticas y análisis de gestión

---

## 1️⃣ Base de Datos

### Script SQL
```bash
# Ejecutar en MariaDB/MySQL
mysql -u root -p prosistema_db < scripts/crear_tabla_historial_expedientes.sql
```

### Estructura de la tabla

```sql
CREATE TABLE historial_expedientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Relaciones
  expediente_id VARCHAR(50) NOT NULL,
  cliente_id VARCHAR(50),
  
  -- Tipo de evento
  tipo_evento VARCHAR(100) NOT NULL,
  
  -- Cambios de etapa
  etapa_anterior VARCHAR(100),
  etapa_nueva VARCHAR(100),
  
  -- Usuario responsable
  usuario_id INT,
  usuario_nombre VARCHAR(255),
  
  -- Detalles
  descripcion TEXT,
  datos_adicionales JSON,
  
  -- Comunicaciones
  metodo_contacto VARCHAR(50),
  destinatario_nombre VARCHAR(255),
  destinatario_contacto VARCHAR(255),
  
  -- Documentos
  documento_url VARCHAR(500),
  documento_tipo VARCHAR(100),
  
  -- Timestamp
  fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_expediente (expediente_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_tipo_evento (tipo_evento),
  INDEX idx_fecha (fecha_evento)
);
```

---

## 2️⃣ Endpoints de la API

### 📍 POST `/api/historial-expedientes`
**Registrar un nuevo evento**

#### Request Body
```json
{
  "expediente_id": "EXP-2025-001",
  "cliente_id": "CLI-001",
  "tipo_evento": "poliza_enviada_whatsapp",
  "etapa_anterior": "Emitida",
  "etapa_nueva": "Enviada al Cliente",
  "usuario_id": 5,
  "usuario_nombre": "Juan Pérez",
  "descripcion": "Póliza enviada al cliente por WhatsApp",
  "metodo_contacto": "WhatsApp",
  "destinatario_nombre": "María García",
  "destinatario_contacto": "+52 1 55 1234 5678",
  "documento_url": "https://storage.s3.amazonaws.com/polizas/EXP-2025-001.pdf",
  "documento_tipo": "poliza",
  "datos_adicionales": {
    "mensaje": "Estimada María, adjunto su póliza de seguro...",
    "pdf_expiracion": "2025-11-17T10:30:00Z"
  }
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "expediente_id": "EXP-2025-001",
    "tipo_evento": "poliza_enviada_whatsapp",
    "fecha_evento": "2025-11-10T10:30:45Z"
  },
  "message": "Evento registrado exitosamente"
}
```

#### Implementación Node.js
```javascript
router.post('/api/historial-expedientes', async (req, res) => {
  try {
    const {
      expediente_id, cliente_id, tipo_evento, etapa_anterior, etapa_nueva,
      usuario_id, usuario_nombre, descripcion, datos_adicionales,
      metodo_contacto, destinatario_nombre, destinatario_contacto,
      documento_url, documento_tipo
    } = req.body;

    // Validaciones
    if (!expediente_id || !tipo_evento) {
      return res.status(400).json({
        success: false,
        message: 'expediente_id y tipo_evento son obligatorios'
      });
    }

    const query = `
      INSERT INTO historial_expedientes 
      (expediente_id, cliente_id, tipo_evento, etapa_anterior, etapa_nueva,
       usuario_id, usuario_nombre, descripcion, datos_adicionales,
       metodo_contacto, destinatario_nombre, destinatario_contacto,
       documento_url, documento_tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(query, [
      expediente_id,
      cliente_id || null,
      tipo_evento,
      etapa_anterior || null,
      etapa_nueva || null,
      usuario_id || null,
      usuario_nombre || 'Sistema',
      descripcion || '',
      datos_adicionales ? JSON.stringify(datos_adicionales) : null,
      metodo_contacto || null,
      destinatario_nombre || null,
      destinatario_contacto || null,
      documento_url || null,
      documento_tipo || null
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        expediente_id,
        tipo_evento,
        fecha_evento: new Date().toISOString()
      },
      message: 'Evento registrado exitosamente'
    });

  } catch (error) {
    console.error('Error al registrar evento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar evento en historial'
    });
  }
});
```

---

### 📍 GET `/api/historial-expedientes/expediente/:id`
**Obtener historial completo de un expediente**

#### Request
```
GET /api/historial-expedientes/expediente/EXP-2025-001
```

#### Query Parameters (opcionales)
- `tipo`: Filtrar por tipo de evento (ej: `tipo=poliza_enviada_email`)
- `desde`: Fecha inicio (ISO 8601) (ej: `desde=2025-11-01`)
- `hasta`: Fecha fin (ISO 8601) (ej: `hasta=2025-11-30`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": "EXP-2025-001",
      "cliente_id": "CLI-001",
      "tipo_evento": "cotizacion_creada",
      "etapa_anterior": null,
      "etapa_nueva": "En cotización",
      "usuario_nombre": "Juan Pérez",
      "descripcion": "Cotización creada para seguro de auto",
      "fecha_evento": "2025-11-01T09:15:00Z"
    },
    {
      "id": 2,
      "expediente_id": "EXP-2025-001",
      "cliente_id": "CLI-001",
      "tipo_evento": "cotizacion_enviada",
      "metodo_contacto": "Email",
      "destinatario_nombre": "María García",
      "destinatario_contacto": "maria@example.com",
      "descripcion": "Cotización enviada por email",
      "fecha_evento": "2025-11-01T10:30:00Z"
    },
    {
      "id": 3,
      "expediente_id": "EXP-2025-001",
      "tipo_evento": "cotizacion_autorizada",
      "etapa_anterior": "Cotización enviada",
      "etapa_nueva": "Autorizado",
      "descripcion": "Cliente autorizó la emisión",
      "fecha_evento": "2025-11-02T14:20:00Z"
    }
  ],
  "count": 3
}
```

#### Implementación Node.js
```javascript
router.get('/api/historial-expedientes/expediente/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, desde, hasta } = req.query;

    let query = `
      SELECT * FROM historial_expedientes 
      WHERE expediente_id = ?
    `;
    const params = [id];

    // Filtro por tipo de evento
    if (tipo) {
      query += ` AND tipo_evento = ?`;
      params.push(tipo);
    }

    // Filtro por rango de fechas
    if (desde) {
      query += ` AND fecha_evento >= ?`;
      params.push(desde);
    }
    if (hasta) {
      query += ` AND fecha_evento <= ?`;
      params.push(hasta);
    }

    query += ` ORDER BY fecha_evento DESC`;

    const [rows] = await connection.execute(query, params);

    // Parsear JSON de datos_adicionales
    const historial = rows.map(row => ({
      ...row,
      datos_adicionales: row.datos_adicionales 
        ? JSON.parse(row.datos_adicionales) 
        : null
    }));

    res.json({
      success: true,
      data: historial,
      count: historial.length
    });

  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial del expediente'
    });
  }
});
```

---

### 📍 GET `/api/historial-expedientes/cliente/:id`
**Obtener historial de todos los expedientes de un cliente**

#### Request
```
GET /api/historial-expedientes/cliente/CLI-001
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": "EXP-2025-001",
      "tipo_evento": "poliza_emitida",
      "fecha_evento": "2025-11-03T11:00:00Z"
    },
    {
      "id": 15,
      "expediente_id": "EXP-2024-089",
      "tipo_evento": "poliza_renovada",
      "fecha_evento": "2025-01-15T09:30:00Z"
    }
  ],
  "count": 2
}
```

#### Implementación Node.js
```javascript
router.get('/api/historial-expedientes/cliente/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT * FROM historial_expedientes 
      WHERE cliente_id = ?
      ORDER BY fecha_evento DESC
    `;

    const [rows] = await connection.execute(query, [id]);

    const historial = rows.map(row => ({
      ...row,
      datos_adicionales: row.datos_adicionales 
        ? JSON.parse(row.datos_adicionales) 
        : null
    }));

    res.json({
      success: true,
      data: historial,
      count: historial.length
    });

  } catch (error) {
    console.error('Error al obtener historial del cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial del cliente'
    });
  }
});
```

---

## 3️⃣ Tipos de Eventos

### Cotización
- `cotizacion_creada`
- `cotizacion_enviada`
- `cotizacion_autorizada`
- `cotizacion_rechazada`

### Emisión
- `emision_iniciada`
- `poliza_emitida`
- `poliza_enviada_email`
- `poliza_enviada_whatsapp`

### Pagos
- `pago_registrado`
- `pago_vencido`
- `recordatorio_pago_enviado`

### Renovaciones
- `renovacion_iniciada`
- `poliza_renovada`
- `recordatorio_renovacion_enviado`

### Cancelaciones
- `poliza_cancelada`
- `solicitud_cancelacion`

### Modificaciones
- `endoso_aplicado`
- `datos_actualizados`

### Comunicaciones
- `documento_cargado`
- `documento_enviado`
- `nota_agregada`
- `llamada_registrada`
- `reunion_registrada`

---

## 4️⃣ Casos de Uso

### Ejemplo 1: Registrar creación de cotización
```javascript
// Frontend: Expedientes.jsx - función guardarExpediente
const resultado = await fetch(`${API_URL}/api/expedientes`, {
  method: 'POST',
  body: JSON.stringify(nuevoExpediente)
});

if (resultado.ok) {
  // Registrar evento en historial
  await registrarEvento({
    expediente_id: nuevoExpediente.id,
    cliente_id: nuevoExpediente.cliente_id,
    tipo_evento: TIPOS_EVENTO.COTIZACION_CREADA,
    etapa_nueva: 'En cotización',
    usuario_nombre: 'Juan Pérez',
    descripcion: `Cotización creada para ${nuevoExpediente.producto}`
  });
}
```

### Ejemplo 2: Registrar envío de póliza por WhatsApp
```javascript
// Ya existe en compartirPorWhatsApp - solo agregar:
await registrarEnvioDocumento(
  expediente.id,
  expediente.cliente_id,
  'WhatsApp',
  {
    nombre: clienteInfo.nombre,
    contacto: clienteInfo.telefono_movil
  },
  mensaje,
  pdfUrl
);
```

### Ejemplo 3: Registrar cambio de etapa manual
```javascript
// Cuando usuario cambia etapa en el formulario
const handleCambioEtapa = async (etapaNueva) => {
  const etapaAnterior = formulario.etapa_activa;
  
  setFormulario(prev => ({ ...prev, etapa_activa: etapaNueva }));
  
  // Registrar en historial
  await registrarCambioEtapa(
    formulario.id,
    formulario.cliente_id,
    etapaAnterior,
    etapaNueva,
    'Juan Pérez',
    'Cambio manual por usuario'
  );
};
```

---

## 5️⃣ Checklist de Implementación

### Backend
- [ ] Ejecutar script SQL `crear_tabla_historial_expedientes.sql`
- [ ] Implementar POST `/api/historial-expedientes`
- [ ] Implementar GET `/api/historial-expedientes/expediente/:id`
- [ ] Implementar GET `/api/historial-expedientes/cliente/:id`
- [ ] Agregar validaciones de datos
- [ ] Probar con Postman/Thunder Client

### Frontend
- [x] Crear servicio `historialExpedienteService.js`
- [x] Crear componente `TimelineExpediente.jsx`
- [ ] Integrar en `DetalleExpediente.jsx`
- [ ] Agregar llamadas en funciones clave:
  - [ ] `guardarExpediente` (crear)
  - [ ] `actualizarExpediente` (editar)
  - [ ] `compartirPorWhatsApp` (envío)
  - [ ] `compartirPorEmail` (envío)
  - [ ] Cambio de etapa manual
  - [ ] Cancelación de póliza

### Testing
- [ ] Crear expediente → verificar evento `cotizacion_creada`
- [ ] Enviar por WhatsApp → verificar evento `poliza_enviada_whatsapp`
- [ ] Cambiar etapa → verificar cambio registrado
- [ ] Ver timeline en UI → verificar visualización correcta
- [ ] Filtrar por tipo de evento
- [ ] Exportar historial a CSV

---

## 6️⃣ Notas Importantes

1. **Performance**: Los índices están optimizados para consultas frecuentes por `expediente_id` y `fecha_evento`

2. **JSON flexible**: La columna `datos_adicionales` permite agregar información específica sin modificar el esquema

3. **Cascada**: Si se elimina un expediente, su historial también se elimina (ON DELETE CASCADE)

4. **Auditoría**: Nunca eliminar eventos del historial, son parte de la auditoría

5. **Fechas**: Todas las fechas se guardan en formato ISO 8601 (UTC)

---

**Próximo paso:** Integrar las llamadas en Expedientes.jsx

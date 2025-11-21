# 🚨 ENDPOINTS HISTORIAL EXPEDIENTES - IMPLEMENTACIÓN URGENTE

## Estado Actual
- ✅ Tabla `historial_expedientes` creada en BD
- ✅ Tabla `notificaciones` YA implementada (para envíos al cliente)
- ✅ Endpoints `POST /api/notificaciones` y `GET /api/notificaciones/expediente/:id` funcionando
- ✅ Frontend registrando eventos de envío correctamente
- ❌ Falta implementar endpoints para eventos del ciclo de vida

## Diferencia Importante
**NO son duplicados**, son dos propósitos diferentes:

### `notificaciones` (YA EXISTE)
- **Propósito:** Comunicaciones AL CLIENTE (WhatsApp/Email/SMS)
- **Cuándo:** Cuando se envía un documento o mensaje al cliente
- **Ejemplos:** "Póliza enviada por WhatsApp", "Recordatorio de pago por Email"

### `historial_expedientes` (FALTA IMPLEMENTAR)
- **Propósito:** Trazabilidad INTERNA del expediente
- **Cuándo:** Eventos del ciclo de vida de la póliza
- **Ejemplos:** "Captura manual", "Póliza editada", "Cancelación", "Pago aplicado"

## Solución: Reutilizar código existente
Agregar 2 endpoints siguiendo la misma estructura de `notificaciones`:
```
POST /api/historial-expedientes
GET /api/historial-expedientes/expediente/:id
```

---

## ENDPOINT 1: Registrar Evento

### POST `/api/historial-expedientes`

**Request Body:**
```json
{
  "expediente_id": 279,
  "cliente_id": "0971451980",
  "tipo_evento": "captura_manual",
  "etapa_anterior": null,
  "etapa_nueva": "Emitida",
  "usuario_id": null,
  "usuario_nombre": "Sistema",
  "descripcion": "Póliza capturada manualmente en el sistema",
  "datos_adicionales": {
    "aseguradora": "Qualitas",
    "producto": "Autos Individual",
    "numero_poliza": "0971451980",
    "metodo_captura": "Captura Manual",
    "fecha_captura": "2025-11-21"
  },
  "metodo_contacto": null,
  "destinatario_nombre": null,
  "destinatario_contacto": null,
  "documento_url": null,
  "documento_tipo": null,
  "fecha_evento": "2025-11-21T18:30:00.000Z"
}
```

**Response esperada:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "expediente_id": 279,
    "tipo_evento": "captura_manual",
    "fecha_evento": "2025-11-21T18:30:00.000Z",
    "created_at": "2025-11-21T18:30:00.000Z"
  }
}
```

**Código backend sugerido:**
```javascript
router.post('/historial-expedientes', async (req, res) => {
  try {
    const {
      expediente_id,
      cliente_id,
      tipo_evento,
      etapa_anterior,
      etapa_nueva,
      usuario_id,
      usuario_nombre,
      descripcion,
      datos_adicionales,
      metodo_contacto,
      destinatario_nombre,
      destinatario_contacto,
      documento_url,
      documento_tipo,
      fecha_evento
    } = req.body;

    const query = `
      INSERT INTO historial_expedientes (
        expediente_id, cliente_id, tipo_evento, etapa_anterior, etapa_nueva,
        usuario_id, usuario_nombre, descripcion, datos_adicionales,
        metodo_contacto, destinatario_nombre, destinatario_contacto,
        documento_url, documento_tipo, fecha_evento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      expediente_id,
      cliente_id,
      tipo_evento,
      etapa_anterior,
      etapa_nueva,
      usuario_id,
      usuario_nombre || 'Sistema',
      descripcion,
      datos_adicionales ? JSON.stringify(datos_adicionales) : null,
      metodo_contacto,
      destinatario_nombre,
      destinatario_contacto,
      documento_url,
      documento_tipo,
      fecha_evento || new Date().toISOString()
    ];

    const [result] = await db.execute(query, values);

    res.json({
      success: true,
      data: {
        id: result.insertId,
        expediente_id,
        tipo_evento,
        fecha_evento: fecha_evento || new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error al registrar evento:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

---

## ENDPOINT 2: Obtener Historial

### GET `/api/historial-expedientes/expediente/:id`

**Ejemplo:** `GET /api/historial-expedientes/expediente/279`

**Response esperada:**
```json
[
  {
    "id": 1,
    "expediente_id": 279,
    "cliente_id": "0971451980",
    "tipo_evento": "captura_manual",
    "etapa_anterior": null,
    "etapa_nueva": "Emitida",
    "usuario_id": null,
    "usuario_nombre": "Sistema",
    "descripcion": "Póliza capturada manualmente en el sistema",
    "datos_adicionales": {
      "aseguradora": "Qualitas",
      "producto": "Autos Individual",
      "numero_poliza": "0971451980",
      "metodo_captura": "Captura Manual"
    },
    "metodo_contacto": null,
    "destinatario_nombre": null,
    "destinatario_contacto": null,
    "documento_url": null,
    "documento_tipo": null,
    "fecha_evento": "2025-11-21T18:30:00.000Z",
    "created_at": "2025-11-21T18:30:00.000Z"
  },
  {
    "id": 2,
    "expediente_id": 279,
    "tipo_evento": "poliza_emitida",
    "descripcion": "Póliza capturada: Qualitas - Autos Individual",
    "fecha_evento": "2025-11-21T18:30:01.000Z",
    ...
  }
]
```

**Código backend sugerido:**
```javascript
router.get('/historial-expedientes/expediente/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        expediente_id,
        cliente_id,
        tipo_evento,
        etapa_anterior,
        etapa_nueva,
        usuario_id,
        usuario_nombre,
        descripcion,
        datos_adicionales,
        metodo_contacto,
        destinatario_nombre,
        destinatario_contacto,
        documento_url,
        documento_tipo,
        fecha_evento,
        created_at
      FROM historial_expedientes
      WHERE expediente_id = ?
      ORDER BY fecha_evento DESC, created_at DESC
    `;

    const [rows] = await db.execute(query, [id]);

    // Parsear datos_adicionales (JSON string → objeto)
    const historial = rows.map(row => ({
      ...row,
      datos_adicionales: row.datos_adicionales ? JSON.parse(row.datos_adicionales) : null
    }));

    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

---

## Tipos de Eventos Soportados

Frontend envía estos `tipo_evento`:

### Captura
- `captura_manual` - Póliza capturada manualmente
- `captura_extractor_pdf` - Póliza importada desde PDF

### Cotización
- `cotizacion_creada` - Nueva cotización
- `cotizacion_solicitada` - Cliente solicitó cotización
- `cotizacion_enviada` - Cotización enviada al cliente
- `cotizacion_autorizada` - Cliente autorizó cotización
- `cotizacion_rechazada` - Cliente rechazó cotización

### Emisión
- `emision_iniciada` - Inicio del proceso de emisión
- `poliza_emitida` - Póliza emitida correctamente

### Envíos
- `poliza_enviada_email` - Póliza enviada por email
- `poliza_enviada_whatsapp` - Póliza enviada por WhatsApp

### Pagos
- `pago_registrado` - Pago aplicado
- `pago_vencido` - Pago venció
- `recordatorio_pago_enviado` - Recordatorio enviado

### Vigencia
- `poliza_en_vigencia` - Póliza activada
- `poliza_proxima_vencer` - Alerta 30 días antes
- `poliza_vencida` - Póliza venció

### Renovación
- `renovacion_iniciada` - Inicio renovación
- `poliza_renovada` - Renovación completada

### Cancelación
- `poliza_cancelada` - Póliza cancelada
- `solicitud_cancelacion` - Solicitud pendiente

### Otros
- `datos_actualizados` - Edición de campos
- `nota_agregada` - Nota o comentario
- `documento_enviado` - Documento compartido
- `endoso_aplicado` - Modificación de póliza

---

## Prioridad de Implementación

1. **URGENTE:** `POST /api/historial-expedientes` (sin esto no se guardan eventos)
2. **URGENTE:** `GET /api/historial-expedientes/expediente/:id` (sin esto el timeline está vacío)

## Verificación

Después de implementar, verificar:
1. Crear póliza → debe registrar 2 eventos (captura + emisión)
2. Enviar por WhatsApp/Email → debe registrar envío
3. Editar póliza → debe registrar cambios
4. Cancelar póliza → debe registrar cancelación
5. Timeline debe mostrar todos los eventos en orden cronológico

## Archivos de Referencia

- Script SQL: `/scripts/crear_tabla_historial_expedientes.sql`
- Frontend service: `/src/services/historialExpedienteService.js`
- Documentación: `/docs/TRAZABILIDAD-SISTEMA-ACTUAL.md`

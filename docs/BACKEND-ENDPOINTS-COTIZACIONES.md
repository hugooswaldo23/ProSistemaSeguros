# Backend: Endpoints para Gestión de Cotizaciones

## Resumen

El frontend de renovaciones necesita poder **subir**, **listar** y **obtener URLs firmadas** de cotizaciones PDF asociadas a expedientes.

---

## Endpoints Requeridos

### 1. Subir Cotización PDF

```
POST /api/expedientes/:expedienteId/documentos
```

**Content-Type:** `multipart/form-data`

**Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `file` | File | Sí | Archivo PDF de cotización (max 10MB) |
| `tipo` | string | Sí | Tipo de documento: `"cotizacion"` |

**Response Exitoso (201):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "expediente_id": 456,
    "tipo": "cotizacion",
    "filename": "cotizacion-qualitas-2026.pdf",
    "url": "https://bucket.s3.amazonaws.com/expedientes/456/cotizaciones/cotizacion-qualitas-2026.pdf",
    "uploadedAt": "2026-01-19T12:30:00Z"
  }
}
```

**Response Error (400/500):**
```json
{
  "success": false,
  "message": "Error al subir el archivo"
}
```

---

### 2. Listar Cotizaciones de un Expediente

```
GET /api/expedientes/:expedienteId/documentos?tipo=cotizacion
```

**Query Params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `tipo` | string | Filtrar por tipo: `"cotizacion"` |

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "tipo": "cotizacion",
      "filename": "cotizacion-qualitas-2026.pdf",
      "url": "https://...",
      "uploadedAt": "2026-01-19T12:30:00Z"
    },
    {
      "id": 124,
      "tipo": "cotizacion", 
      "filename": "cotizacion-gnp-2026.pdf",
      "url": "https://...",
      "uploadedAt": "2026-01-19T14:00:00Z"
    }
  ]
}
```

---

### 3. Obtener URL Firmada de Cotización

```
GET /api/expedientes/:expedienteId/documentos/:documentoId/url?expiration=3600
```

**Query Params:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `expiration` | number | 3600 | Segundos de validez del link |

**Response Exitoso (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://bucket.s3.amazonaws.com/expedientes/456/cotizaciones/cotizacion.pdf?X-Amz-Algorithm=...",
    "expiresAt": "2026-01-19T13:30:00Z"
  }
}
```

---

## Estructura Sugerida en BD

### Tabla: `documentos_expedientes`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT PK | ID del documento |
| `expediente_id` | INT FK | Referencia al expediente |
| `tipo` | VARCHAR(50) | Tipo: `'cotizacion'`, `'poliza'`, `'comprobante'`, etc. |
| `filename` | VARCHAR(255) | Nombre original del archivo |
| `s3_key` | VARCHAR(500) | Key en S3 |
| `s3_url` | TEXT | URL pública (si aplica) |
| `size_bytes` | BIGINT | Tamaño del archivo |
| `mime_type` | VARCHAR(100) | Tipo MIME |
| `created_at` | DATETIME | Fecha de subida |
| `created_by` | INT FK | Usuario que subió |

---

## Estructura S3 Sugerida

```
bucket/
├── expedientes/
│   ├── {expediente_id}/
│   │   ├── polizas/
│   │   │   └── poliza-original.pdf
│   │   ├── cotizaciones/
│   │   │   ├── cotizacion-qualitas-2026.pdf
│   │   │   └── cotizacion-gnp-2026.pdf
│   │   └── comprobantes/
│   │       └── comprobante-pago-1.pdf
```

---

## Flujo de Uso en Frontend

1. **Usuario carga cotización:**
   - Frontend llama `POST /api/expedientes/:id/documentos` con el PDF
   - Backend sube a S3 y guarda registro en BD
   - Frontend recibe URL y la guarda en historial

2. **Usuario quiere compartir cotización:**
   - Frontend llama `GET /api/expedientes/:id/documentos?tipo=cotizacion`
   - Muestra selector con las cotizaciones disponibles
   - Usuario elige una

3. **Usuario envía por WhatsApp/Email:**
   - Frontend llama `GET /api/expedientes/:id/documentos/:docId/url`
   - Incluye la URL firmada en el mensaje

---

## Prioridad

🔴 **ALTA** - Sin estos endpoints, las cotizaciones se subirán pero no habrá link de descarga para el cliente.

El frontend ya está preparado para funcionar sin estos endpoints (muestra mensaje "Sin cotizaciones"), pero para la funcionalidad completa se requiere la implementación.

---

## Archivos Frontend que usan estos endpoints

- `src/services/pdfService.js` - Funciones: `subirCotizacionPDF`, `obtenerCotizaciones`, `obtenerURLCotizacion`
- `src/screens/NvoExpedientes.jsx` - Flujo de compartir cotización

# Backend: Recibos de Pago de Aseguradora

## Descripción
El frontend ahora permite **subir y ver el recibo de pago** que envía la aseguradora por cada período de pago. Esto es DIFERENTE del comprobante de pago del cliente — es el documento que la aseguradora emite como constancia de pago recibido.

Cada fila en el Calendario de Pagos tiene un botón para subir/ver el recibo correspondiente.

---

## Cambios en Base de Datos

### Opción A: Agregar campos a tabla `recibos_pago`
```sql
ALTER TABLE recibos_pago 
  ADD COLUMN recibo_pago_url VARCHAR(500) DEFAULT NULL COMMENT 'URL del recibo de pago de la aseguradora en S3',
  ADD COLUMN recibo_pago_nombre VARCHAR(255) DEFAULT NULL COMMENT 'Nombre original del archivo subido';
```

### Opción B: Usar tabla `documentos_expedientes` existente
Si prefieren usar la tabla de documentos existente, agregar tipo `recibo-pago` y asociar con `numero_recibo`:
```sql
-- No requiere ALTER, solo insertar con tipo = 'recibo-pago'
INSERT INTO documentos_expedientes (expediente_id, tipo, url, nombre_archivo, numero_recibo)
VALUES (123, 'recibo-pago', 'https://...', 'recibo.pdf', 2);

-- Si la tabla no tiene campo numero_recibo:
ALTER TABLE documentos_expedientes
  ADD COLUMN numero_recibo INT DEFAULT NULL COMMENT 'Número de recibo asociado (para recibos de pago)';
```

**Recomendación**: Opción A es más simple. Los campos van directamente en `recibos_pago`.

---

## Endpoints Requeridos

### 1. POST `/api/expedientes/:id/recibos/:numero/recibo-pago`
Sube el archivo del recibo de pago de la aseguradora.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Archivo PDF, JPG, PNG o WebP (máx 10MB)
  - `tipo`: `"recibo-pago"`
  - `numero_recibo`: Número del recibo (1, 2, 3...)

**Response exitosa (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://prosistema-polizas.s3.amazonaws.com/recibos-pago/123/recibo-2.pdf",
    "filename": "recibo-2.pdf",
    "numero_recibo": 2
  }
}
```

**Lógica del backend:**
1. Recibir archivo via multer
2. Subir a S3 en carpeta: `recibos-pago/{expediente_id}/recibo-{numero}.{ext}`
3. Actualizar `recibos_pago` SET `recibo_pago_url` = url, `recibo_pago_nombre` = nombre
4. Retornar URL

---

### 2. GET `/api/expedientes/:id/recibos/:numero/recibo-pago-url`
Obtiene URL firmada para ver/descargar el recibo.

**Query params:**
- `expiration`: Segundos de validez (default: 3600)

**Response exitosa (200):**
```json
{
  "success": true,
  "data": {
    "url": "https://prosistema-polizas.s3.amazonaws.com/recibos-pago/123/recibo-2.pdf?X-Amz-...",
    "expiresAt": "2025-01-10T15:30:00Z"
  }
}
```

**Response sin recibo (404):**
```json
{
  "success": false,
  "message": "No se encontró recibo de pago para el recibo #2"
}
```

---

## Carpeta S3 Sugerida
```
prosistema-polizas/
  ├── polizas/         (PDFs de pólizas - ya existe)
  ├── comprobantes/    (comprobantes de pago - ya existe)
  ├── expedientes/     (documentos generales - ya existe)
  └── recibos-pago/    ← NUEVO
      ├── 123/
      │   ├── recibo-1.pdf
      │   ├── recibo-2.jpg
      │   └── recibo-3.pdf
      └── 456/
          └── recibo-1.pdf
```

---

## Datos que el frontend espera en `GET /api/recibos/:expedienteId`
Cuando se cargan los recibos del expediente, incluir los nuevos campos:

```json
{
  "recibos": [
    {
      "id": 1,
      "expediente_id": 123,
      "numero_recibo": 1,
      "fecha_pago": "2025-02-15",
      "monto": 3500.00,
      "estatus_pago": "pagado",
      "fecha_pago_real": "2025-02-14",
      "comprobante_url": "https://...",
      "comprobante_nombre": "comprobante.pdf",
      "recibo_pago_url": "https://...",
      "recibo_pago_nombre": "recibo-aseguradora-1.pdf"
    }
  ]
}
```

Los campos nuevos son:
- `recibo_pago_url` — URL del recibo de la aseguradora en S3
- `recibo_pago_nombre` — Nombre original del archivo

---

## Archivos Frontend Modificados
- `src/services/pdfService.js` — Nuevas funciones: `subirReciboPago()`, `obtenerReciboPagoURL()`
- `src/components/expedientes/CalendarioPagos.jsx` — Nueva columna "Recibo" con botones subir/ver por fila

## Prioridad
**Media** — Es funcional sin backend (los botones de subir aparecen pero fallarán hasta implementar endpoints).

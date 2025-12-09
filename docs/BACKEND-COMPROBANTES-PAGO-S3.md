# Implementación: Comprobantes de Pago en AWS S3

**Fecha:** 8 de Diciembre, 2025  
**Para:** Hugo (Backend/BD)  
**Objetivo:** Permitir subir y visualizar comprobantes de pago en AWS S3

---

## 1. ENDPOINT NECESARIO

### POST `/api/expedientes/:id/comprobante`

**Descripción:** Subir comprobante de pago a AWS S3

**Content-Type:** `multipart/form-data`

**Body:**
- `file`: Archivo del comprobante (PDF, imagen, etc.)
- `tipo`: `"comprobante-pago"` (para categorizar)
- `expediente_id`: ID del expediente (redundante pero útil)

**Response exitosa:**
```json
{
  "success": true,
  "data": {
    "url": "https://s3.amazonaws.com/prosistema-polizas/comprobantes/2025/expediente-123/comprobante-20251208.pdf",
    "pdf_url": "https://s3.amazonaws.com/prosistema-polizas/comprobantes/2025/expediente-123/comprobante-20251208.pdf",
    "pdf_key": "comprobantes/2025/expediente-123/comprobante-20251208.pdf",
    "pdf_nombre": "comprobante-pago-17nov2025.pdf",
    "pdf_size": 245680
  }
}
```

**Response error:**
```json
{
  "success": false,
  "error": "Descripción del error"
}
```

---

## 2. ESTRUCTURA EN S3

### Bucket existente: `prosistema-polizas`

**Nueva estructura de carpetas para comprobantes:**
```
prosistema-polizas/
  ├── polizas/              # PDFs de pólizas (ya existente)
  │   ├── 2024/
  │   ├── 2025/
  └── comprobantes/         # NUEVA: Comprobantes de pago
      ├── 2024/
      │   ├── expediente-{id}/
      │   │   ├── comprobante-{fecha}.pdf
      │   │   ├── comprobante-{fecha}-2.pdf
      ├── 2025/
      │   ├── expediente-{id}/
      │       ├── comprobante-20251208.pdf
      │       ├── comprobante-20251215.pdf
```

**Ejemplo de nombres:**
- `comprobantes/2025/expediente-431/comprobante-20251117.pdf`
- `comprobantes/2025/expediente-431/comprobante-20251208-pago2.pdf`

---

## 3. LÓGICA DEL ENDPOINT

```javascript
// Pseudocódigo del endpoint

app.post('/api/expedientes/:id/comprobante', upload.single('file'), async (req, res) => {
  try {
    const expedienteId = req.params.id;
    const file = req.file;
    
    // Validar archivo
    if (!file) {
      return res.status(400).json({ success: false, error: 'No se recibió archivo' });
    }
    
    // Generar nombre único
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const extension = path.extname(file.originalname);
    const fileName = `comprobante-${fecha}${extension}`;
    
    // Key en S3
    const year = new Date().getFullYear();
    const s3Key = `comprobantes/${year}/expediente-${expedienteId}/${fileName}`;
    
    // Subir a S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    
    const result = await s3.upload(uploadParams).promise();
    
    // Generar URL pública (o firmada si es privado)
    const url = result.Location;
    
    // Respuesta
    res.json({
      success: true,
      data: {
        url: url,
        pdf_url: url,
        pdf_key: s3Key,
        pdf_nombre: file.originalname,
        pdf_size: file.size
      }
    });
    
  } catch (error) {
    console.error('Error al subir comprobante:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al subir comprobante a S3' 
    });
  }
});
```

---

## 4. CONFIGURACIÓN AWS (YA EXISTENTE)

Usar las mismas credenciales y configuración que para PDFs de pólizas:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=prosistema-polizas
```

**CORS del bucket** (debe permitir GET para visualizar):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:5173", "https://tudominio.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

---

## 5. PERMISOS DEL BUCKET

- Los comprobantes deben ser **accesibles públicamente** o usar **URLs firmadas**
- Si son privados, considerar generar URLs firmadas con expiración de 1 hora
- Recomendación: mismo enfoque que PDFs de pólizas

---

## 6. FRONTEND - FLUJO IMPLEMENTADO

El frontend ya está preparado y hace lo siguiente:

1. **Al aplicar pago:**
   - Sube el comprobante vía `POST /api/expedientes/:id/comprobante`
   - Recibe la URL del comprobante
   - Guarda la URL en el historial (`datos_adicionales.comprobante_url`)

2. **Al ver comprobante:**
   - Busca en el historial el evento de pago correspondiente
   - Abre la URL en nueva pestaña: `window.open(comprobante_url, '_blank')`

---

## 7. TESTING

### Caso de prueba 1: Subir comprobante
```bash
curl -X POST \
  http://localhost:3000/api/expedientes/431/comprobante \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/comprobante.pdf' \
  -F 'tipo=comprobante-pago' \
  -F 'expediente_id=431'
```

**Esperado:** 
- Archivo subido a S3 en `comprobantes/2025/expediente-431/comprobante-YYYYMMDD.pdf`
- Response con URL accesible

### Caso de prueba 2: Visualizar comprobante
1. Aplicar pago con comprobante
2. Ir a "Detalles del Expediente"
3. Expandir "Calendario de Pagos"
4. Click en "Ver Comprobante" del pago registrado
5. Debe abrir el PDF en nueva pestaña

---

## 8. VALIDACIONES RECOMENDADAS

- **Tipo de archivo:** Solo PDF, JPG, PNG (max 10MB)
- **Nombre del archivo:** Sanitizar caracteres especiales
- **Duplicados:** Agregar timestamp si ya existe archivo con mismo nombre
- **Seguridad:** Validar que el expediente existe antes de subir

---

## 9. NOTAS ADICIONALES

- El frontend no bloquea si falla la subida a S3 (continúa sin URL)
- Si no hay URL, el botón "Ver Comprobante" muestra alerta
- Los comprobantes quedan vinculados al expediente vía historial
- Cada pago puede tener múltiples comprobantes si se aplica varias veces

---

## PRIORIDAD: ALTA ⚠️

Este feature permite completar el flujo de pagos con evidencia documental.

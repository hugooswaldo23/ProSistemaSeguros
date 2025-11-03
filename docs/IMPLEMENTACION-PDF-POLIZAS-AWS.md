# Implementación: Almacenamiento de PDFs de Pólizas en AWS S3

**Fecha:** 1 de Noviembre, 2025
**Para:** Hugo (Backend/BD)
**Objetivo:** Permitir guardar y compartir PDFs de pólizas vía WhatsApp y Email

---

## 1. CAMBIOS EN BASE DE DATOS

### Tabla: `expedientes` (o `polizas`)

Agregar las siguientes columnas:

```sql
ALTER TABLE expedientes 
ADD COLUMN pdf_url VARCHAR(500),
ADD COLUMN pdf_nombre VARCHAR(255),
ADD COLUMN pdf_bucket VARCHAR(100) DEFAULT 'prosistema-polizas',
ADD COLUMN pdf_key VARCHAR(500),
ADD COLUMN pdf_size INT,
ADD COLUMN pdf_fecha_subida DATETIME;
```

**Descripción de campos:**
- `pdf_url`: URL completa para acceder al PDF (ej: https://s3.amazonaws.com/bucket/archivo.pdf)
- `pdf_nombre`: Nombre original del archivo subido
- `pdf_bucket`: Nombre del bucket de S3 (por si usamos múltiples buckets)
- `pdf_key`: Key/path del archivo en S3 (ej: polizas/2024/cliente-123/poliza-456.pdf)
- `pdf_size`: Tamaño del archivo en bytes
- `pdf_fecha_subida`: Timestamp de cuándo se subió el PDF

---

## 2. CONFIGURACIÓN AWS S3

### 2.1 Crear Bucket
```
Nombre sugerido: prosistema-polizas
Region: us-east-1 (o la más cercana)
ACL: Privado (con acceso público para lectura vía URLs firmadas)
Versionado: Habilitado (recomendado)
Encriptación: AES-256
```

### 2.2 Estructura de carpetas en S3
```
prosistema-polizas/
  ├── polizas/
  │   ├── 2024/
  │   │   ├── cliente-{id}/
  │   │   │   ├── poliza-{numero}.pdf
  │   ├── 2025/
  │   │   ├── cliente-{id}/
  │   │   │   ├── poliza-{numero}.pdf
```

### 2.3 Configuración CORS para el bucket
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

### 2.4 Credenciales AWS (Variables de entorno en backend)
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=prosistema-polizas
AWS_S3_URL_EXPIRATION=3600  # URLs firmadas válidas por 1 hora
```

---

## 3. ENDPOINTS BACKEND NECESARIOS

### 3.1 Subir PDF de Póliza
```
POST /api/expedientes/:id/pdf
Content-Type: multipart/form-data

Body:
  - file: archivo PDF

Response:
{
  "success": true,
  "data": {
    "pdf_url": "https://s3.amazonaws.com/prosistema-polizas/polizas/2025/cliente-123/poliza-456.pdf",
    "pdf_nombre": "poliza-456.pdf",
    "pdf_key": "polizas/2025/cliente-123/poliza-456.pdf",
    "pdf_size": 245680,
    "pdf_fecha_subida": "2025-11-01T10:30:00Z"
  }
}
```

**Lógica del endpoint:**
1. Validar que el archivo es PDF
2. Validar tamaño máximo (ej: 10MB)
3. Generar key único: `polizas/{año}/{cliente_id}/poliza-{numero_poliza}-{timestamp}.pdf`
4. Subir a S3 usando SDK de AWS
5. Actualizar registro en BD con los datos del PDF
6. Retornar datos del archivo

### 3.2 Obtener URL firmada (para compartir)
```
GET /api/expedientes/:id/pdf-url?expiration=3600

Response:
{
  "success": true,
  "data": {
    "signed_url": "https://s3.amazonaws.com/prosistema-polizas/polizas/2025/cliente-123/poliza-456.pdf?AWSAccessKeyId=...&Expires=...&Signature=...",
    "expires_in": 3600
  }
}
```

**Lógica del endpoint:**
1. Obtener pdf_key de la BD
2. Generar URL firmada con tiempo de expiración
3. Retornar URL temporal

### 3.3 Eliminar PDF
```
DELETE /api/expedientes/:id/pdf

Response:
{
  "success": true,
  "message": "PDF eliminado correctamente"
}
```

**Lógica del endpoint:**
1. Obtener pdf_key de la BD
2. Eliminar archivo de S3
3. Limpiar campos pdf_* en la BD (set NULL)

---

## 4. CÓDIGO BACKEND (Node.js con AWS SDK v3)

### 4.1 Instalar dependencias
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
```

### 4.2 Servicio S3 (services/s3Service.js)
```javascript
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

// Subir archivo a S3
async function uploadPDF(file, key) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256'
  });

  await s3Client.send(command);
  
  return {
    pdf_url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    pdf_key: key,
    pdf_size: file.size,
    pdf_nombre: file.originalname
  };
}

// Generar URL firmada
async function getSignedPDFUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return signedUrl;
}

// Eliminar archivo de S3
async function deletePDF(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  await s3Client.send(command);
}

module.exports = {
  uploadPDF,
  getSignedPDFUrl,
  deletePDF
};
```

### 4.3 Controlador (controllers/expedientesController.js)
```javascript
const multer = require('multer');
const { uploadPDF, getSignedPDFUrl, deletePDF } = require('../services/s3Service');
const db = require('../config/database');

// Configurar multer para memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Subir PDF de póliza
async function uploadPolizaPDF(req, res) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No se recibió archivo' });
    }

    // Obtener datos del expediente
    const [expediente] = await db.query('SELECT cliente_id, numero_poliza FROM expedientes WHERE id = ?', [id]);
    
    if (!expediente) {
      return res.status(404).json({ success: false, message: 'Expediente no encontrado' });
    }

    // Generar key único
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const key = `polizas/${year}/cliente-${expediente.cliente_id}/poliza-${expediente.numero_poliza}-${timestamp}.pdf`;

    // Subir a S3
    const pdfData = await uploadPDF(file, key);

    // Actualizar BD
    await db.query(
      `UPDATE expedientes 
       SET pdf_url = ?, pdf_nombre = ?, pdf_key = ?, pdf_size = ?, pdf_fecha_subida = NOW(), pdf_bucket = ?
       WHERE id = ?`,
      [pdfData.pdf_url, pdfData.pdf_nombre, pdfData.pdf_key, pdfData.pdf_size, process.env.AWS_S3_BUCKET, id]
    );

    res.json({
      success: true,
      data: {
        ...pdfData,
        pdf_fecha_subida: new Date()
      }
    });
  } catch (error) {
    console.error('Error al subir PDF:', error);
    res.status(500).json({ success: false, message: 'Error al subir PDF', error: error.message });
  }
}

// Obtener URL firmada
async function getPolizaPDFUrl(req, res) {
  try {
    const { id } = req.params;
    const expiresIn = parseInt(req.query.expiration) || 3600;

    const [expediente] = await db.query('SELECT pdf_key FROM expedientes WHERE id = ?', [id]);

    if (!expediente || !expediente.pdf_key) {
      return res.status(404).json({ success: false, message: 'PDF no encontrado' });
    }

    const signedUrl = await getSignedPDFUrl(expediente.pdf_key, expiresIn);

    res.json({
      success: true,
      data: {
        signed_url: signedUrl,
        expires_in: expiresIn
      }
    });
  } catch (error) {
    console.error('Error al generar URL firmada:', error);
    res.status(500).json({ success: false, message: 'Error al generar URL', error: error.message });
  }
}

// Eliminar PDF
async function deletePolizaPDF(req, res) {
  try {
    const { id } = req.params;

    const [expediente] = await db.query('SELECT pdf_key FROM expedientes WHERE id = ?', [id]);

    if (!expediente || !expediente.pdf_key) {
      return res.status(404).json({ success: false, message: 'PDF no encontrado' });
    }

    // Eliminar de S3
    await deletePDF(expediente.pdf_key);

    // Limpiar BD
    await db.query(
      `UPDATE expedientes 
       SET pdf_url = NULL, pdf_nombre = NULL, pdf_key = NULL, pdf_size = NULL, pdf_fecha_subida = NULL, pdf_bucket = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'PDF eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar PDF:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar PDF', error: error.message });
  }
}

module.exports = {
  upload,
  uploadPolizaPDF,
  getPolizaPDFUrl,
  deletePolizaPDF
};
```

### 4.4 Rutas (routes/expedientes.js)
```javascript
const express = require('express');
const router = express.Router();
const { upload, uploadPolizaPDF, getPolizaPDFUrl, deletePolizaPDF } = require('../controllers/expedientesController');

// Rutas para PDFs
router.post('/:id/pdf', upload.single('file'), uploadPolizaPDF);
router.get('/:id/pdf-url', getPolizaPDFUrl);
router.delete('/:id/pdf', deletePolizaPDF);

module.exports = router;
```

---

## 5. TESTING

### 5.1 Probar subida de PDF
```bash
curl -X POST http://localhost:3000/api/expedientes/123/pdf \
  -H "Content-Type: multipart/form-data" \
  -F "file=@poliza-test.pdf"
```

### 5.2 Probar obtención de URL firmada
```bash
curl http://localhost:3000/api/expedientes/123/pdf-url?expiration=3600
```

### 5.3 Probar eliminación
```bash
curl -X DELETE http://localhost:3000/api/expedientes/123/pdf
```

---

## 6. CONSIDERACIONES DE SEGURIDAD

1. **URLs Firmadas:** Usar URLs firmadas con tiempo de expiración corto (1-2 horas)
2. **Validación:** Validar siempre el tipo de archivo y tamaño
3. **Autenticación:** Proteger todos los endpoints con autenticación
4. **Permisos S3:** Bucket privado, acceso solo vía URLs firmadas
5. **Logs:** Registrar todas las operaciones de subida/descarga
6. **Backups:** Configurar versionado y lifecycle policies en S3

---

## 7. COSTOS ESTIMADOS AWS S3

- **Almacenamiento:** ~$0.023 por GB/mes
- **Requests PUT:** $0.005 por 1,000 requests
- **Requests GET:** $0.0004 por 1,000 requests
- **Transferencia de datos:** Primeros 100GB gratis/mes

**Ejemplo:** 1000 pólizas de 500KB c/u = 500MB ≈ $0.012/mes

---

## 8. CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear bucket en AWS S3
- [ ] Configurar CORS en bucket
- [ ] Configurar credenciales AWS en variables de entorno
- [ ] Ejecutar script SQL para agregar columnas
- [ ] Instalar dependencias npm
- [ ] Implementar servicio S3
- [ ] Implementar controladores y rutas
- [ ] Probar subida de PDFs
- [ ] Probar generación de URLs firmadas
- [ ] Verificar permisos y seguridad
- [ ] Documentar proceso para el equipo

---

**Notas adicionales:**
- El frontend ya está preparado para usar estos endpoints
- Considerar implementar cron job para limpiar PDFs antiguos
- Evaluar implementar caché de URLs firmadas (Redis)

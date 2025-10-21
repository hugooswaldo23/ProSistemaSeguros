# Guía de Implementación - Backend de Documentos de Clientes

## 📋 Resumen
Sistema de gestión de documentos para clientes con almacenamiento de archivos en servidor y metadatos en base de datos.

---

## 🗄️ 1. Preparación de Base de Datos

### Paso 1: Ejecutar Script SQL
```bash
# Conectarse a MySQL
mysql -u usuario -p nombre_base_datos

# Ejecutar el script
source scripts/crear_tabla_documentos_clientes.sql;

# Verificar la tabla
DESCRIBE documentos_clientes;
```

### Verificación
```sql
-- Debe mostrar la tabla con estos campos:
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'documentos_clientes';
```

---

## 📁 2. Configuración de Almacenamiento de Archivos

### Estructura de Carpetas en Servidor
```
/var/www/uploads/                    (o ruta configurada)
└── clientes/
    ├── 1/                          (ID del cliente)
    │   └── documentos/
    │       ├── INE_20250101.pdf
    │       ├── CURP_20250101.pdf
    │       └── RFC_20250101.pdf
    ├── 2/
    │   └── documentos/
    └── ...
```

### Permisos Requeridos (Linux/Unix)
```bash
# Crear directorio base
mkdir -p /var/www/uploads/clientes

# Asignar permisos
chmod 755 /var/www/uploads
chmod 755 /var/www/uploads/clientes

# Asignar propietario (ajustar según tu servidor)
chown -R www-data:www-data /var/www/uploads
```

---

## 🔧 3. Implementación del Backend (Node.js/Express)

### Instalación de Dependencias
```bash
npm install multer
# Multer es un middleware de Node.js para manejar multipart/form-data
```

### Configuración de Multer
```javascript
// config/multer.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const clienteId = req.params.id;
    const uploadPath = path.join(__dirname, '../uploads/clientes', clienteId.toString(), 'documentos');
    
    // Crear directorio si no existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const tipo = req.body.tipo || 'documento';
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const nombreLimpio = tipo.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${nombreLimpio}_${timestamp}${extension}`);
  }
});

// Filtro de archivos
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido'), false);
  }
};

// Exportar configuración
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
});

module.exports = upload;
```

---

## 🛣️ 4. Rutas del API

### Archivo de Rutas
```javascript
// routes/clientes-documentos.js
const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { verificarToken } = require('../middleware/auth');
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// 1️⃣ LISTAR DOCUMENTOS DE UN CLIENTE
router.get('/clientes/:id/documentos', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [documentos] = await db.query(
      'SELECT * FROM documentos_clientes WHERE cliente_id = ? ORDER BY fecha_subida DESC',
      [id]
    );
    
    res.json({
      success: true,
      data: documentos
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar documentos',
      error: error.message
    });
  }
});

// 2️⃣ SUBIR DOCUMENTO
router.post('/clientes/:id/documentos', verificarToken, upload.single('archivo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, estado = 'Vigente', notas = null } = req.body;
    const archivo = req.file;
    
    if (!archivo) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }
    
    // Insertar en base de datos
    const [result] = await db.query(
      `INSERT INTO documentos_clientes 
       (cliente_id, tipo, nombre, ruta_archivo, extension, estado, tipo_archivo, tamaño, notas) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        tipo,
        archivo.originalname,
        archivo.path,
        path.extname(archivo.originalname),
        estado,
        archivo.mimetype,
        archivo.size,
        notas
      ]
    );
    
    // Obtener el documento recién creado
    const [documento] = await db.query(
      'SELECT * FROM documentos_clientes WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Documento subido correctamente',
      data: documento[0]
    });
    
  } catch (error) {
    console.error('Error al subir documento:', error);
    
    // Eliminar archivo si hubo error en BD
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al subir documento',
      error: error.message
    });
  }
});

// 3️⃣ ACTUALIZAR METADATOS DE DOCUMENTO
router.put('/clientes/:id/documentos/:doc_id', verificarToken, async (req, res) => {
  try {
    const { doc_id } = req.params;
    const { tipo, estado, notas } = req.body;
    
    await db.query(
      `UPDATE documentos_clientes 
       SET tipo = ?, estado = ?, notas = ? 
       WHERE id = ?`,
      [tipo, estado, notas, doc_id]
    );
    
    const [documento] = await db.query(
      'SELECT * FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    res.json({
      success: true,
      message: 'Documento actualizado correctamente',
      data: documento[0]
    });
    
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar documento',
      error: error.message
    });
  }
});

// 4️⃣ REEMPLAZAR ARCHIVO DE DOCUMENTO
router.post('/clientes/:id/documentos/:doc_id/reemplazar', verificarToken, upload.single('archivo'), async (req, res) => {
  try {
    const { doc_id } = req.params;
    const archivo = req.file;
    
    if (!archivo) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }
    
    // Obtener documento actual para eliminar archivo viejo
    const [documentoViejo] = await db.query(
      'SELECT ruta_archivo FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    if (documentoViejo.length === 0) {
      fs.unlinkSync(archivo.path); // Eliminar archivo nuevo
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
    
    // Actualizar en base de datos
    await db.query(
      `UPDATE documentos_clientes 
       SET nombre = ?, ruta_archivo = ?, extension = ?, tipo_archivo = ?, tamaño = ? 
       WHERE id = ?`,
      [
        archivo.originalname,
        archivo.path,
        path.extname(archivo.originalname),
        archivo.mimetype,
        archivo.size,
        doc_id
      ]
    );
    
    // Eliminar archivo viejo
    if (fs.existsSync(documentoViejo[0].ruta_archivo)) {
      fs.unlinkSync(documentoViejo[0].ruta_archivo);
    }
    
    // Obtener documento actualizado
    const [documento] = await db.query(
      'SELECT * FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    res.json({
      success: true,
      message: 'Archivo reemplazado correctamente',
      data: documento[0]
    });
    
  } catch (error) {
    console.error('Error al reemplazar archivo:', error);
    
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error al reemplazar archivo',
      error: error.message
    });
  }
});

// 5️⃣ ELIMINAR DOCUMENTO
router.delete('/clientes/:id/documentos/:doc_id', verificarToken, async (req, res) => {
  try {
    const { doc_id } = req.params;
    
    // Obtener información del documento
    const [documento] = await db.query(
      'SELECT ruta_archivo FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    if (documento.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
    
    // Eliminar archivo físico
    if (fs.existsSync(documento[0].ruta_archivo)) {
      fs.unlinkSync(documento[0].ruta_archivo);
    }
    
    // Eliminar de base de datos
    await db.query('DELETE FROM documentos_clientes WHERE id = ?', [doc_id]);
    
    res.json({
      success: true,
      message: 'Documento eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento',
      error: error.message
    });
  }
});

// 6️⃣ DESCARGAR DOCUMENTO
router.get('/clientes/:id/documentos/:doc_id/descargar', verificarToken, async (req, res) => {
  try {
    const { doc_id } = req.params;
    
    const [documento] = await db.query(
      'SELECT * FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    if (documento.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
    
    const filePath = documento[0].ruta_archivo;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el servidor'
      });
    }
    
    res.download(filePath, documento[0].nombre);
    
  } catch (error) {
    console.error('Error al descargar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar documento',
      error: error.message
    });
  }
});

// 7️⃣ VER DOCUMENTO (inline)
router.get('/clientes/:id/documentos/:doc_id/ver', verificarToken, async (req, res) => {
  try {
    const { doc_id } = req.params;
    
    const [documento] = await db.query(
      'SELECT * FROM documentos_clientes WHERE id = ?',
      [doc_id]
    );
    
    if (documento.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
    
    const filePath = documento[0].ruta_archivo;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el servidor'
      });
    }
    
    res.setHeader('Content-Type', documento[0].tipo_archivo);
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(path.resolve(filePath));
    
  } catch (error) {
    console.error('Error al ver documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al ver documento',
      error: error.message
    });
  }
});

module.exports = router;
```

### Registrar las Rutas en el Servidor Principal
```javascript
// server.js o app.js
const documentosRoutes = require('./routes/clientes-documentos');

app.use('/api', documentosRoutes);
```

---

## 🔐 4. Middleware de Autenticación (si no existe)

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
    
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

module.exports = { verificarToken };
```

---

## ✅ 5. Pruebas con Postman/Thunder Client

### 1. Subir Documento
```
POST http://localhost:3000/api/clientes/1/documentos
Authorization: Bearer {TOKEN}
Content-Type: multipart/form-data

Body (form-data):
- archivo: [seleccionar archivo]
- tipo: "INE"
- estado: "Vigente"
- notas: "Documento vigente hasta 2030"
```

### 2. Listar Documentos
```
GET http://localhost:3000/api/clientes/1/documentos
Authorization: Bearer {TOKEN}
```

### 3. Eliminar Documento
```
DELETE http://localhost:3000/api/clientes/1/documentos/5
Authorization: Bearer {TOKEN}
```

---

## 🐛 6. Troubleshooting

### Error: "ENOENT: no such file or directory"
- Verificar que la carpeta `/uploads/clientes` exista
- Verificar permisos de escritura
- Ejecutar: `mkdir -p uploads/clientes`

### Error: "File too large"
- Aumentar límite en multer: `limits: { fileSize: 20 * 1024 * 1024 }`
- Aumentar límite en nginx (si aplica): `client_max_body_size 20M;`

### Error: "Multer unexpected field"
- Verificar que el campo en el frontend se llame exactamente `archivo`
- Verificar: `upload.single('archivo')`

### Error de CORS
```javascript
// Agregar en server.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173', // URL del frontend
  credentials: true
}));
```

---

## 📊 7. Verificación Post-Implementación

### Queries de Verificación
```sql
-- Ver documentos de un cliente
SELECT * FROM documentos_clientes WHERE cliente_id = 1;

-- Estadísticas
SELECT 
  cliente_id,
  COUNT(*) as total_documentos,
  SUM(tamaño) as tamaño_total_bytes
FROM documentos_clientes
GROUP BY cliente_id;

-- Documentos por tipo
SELECT tipo, COUNT(*) as cantidad
FROM documentos_clientes
GROUP BY tipo
ORDER BY cantidad DESC;
```

---

## 📝 8. Siguiente Pasos (Opcional)

- [ ] Implementar vista previa de PDFs en el frontend
- [ ] Agregar compresión de imágenes al subir
- [ ] Implementar versionado de documentos
- [ ] Agregar notificaciones de documentos por vencer
- [ ] Implementar búsqueda de documentos
- [ ] Agregar logs de auditoría (quién subió/eliminó)

---

## 📞 Contacto
Si tienes problemas con la implementación, contactar al equipo de desarrollo frontend.

**Documentación generada**: 2025
**Última actualización**: Enero 2025

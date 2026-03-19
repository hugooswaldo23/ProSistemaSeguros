# Endpoints: Documentos de Clientes (S3)

**Fecha:** 2026-03-18  
**Frontend:** Ya implementado en `src/services/documentosClienteService.js` y `src/screens/Clientes.jsx`  
**Tabla destino:** `documentos_clientes` (ya existe el script SQL en `scripts/crear_tabla_documentos_clientes.sql`)  
**Bucket S3:** `prosistema-polizas` (el mismo que ya se usa para pólizas PDF)

---

## Contexto

El módulo de Clientes ahora tiene gestión documental real: checklist de documentos por tipo de persona (Física / Moral) + documentos genéricos ("Otros"). El frontend ya sube archivos reales, pero necesita estos 5 endpoints en el backend.

---

## 1. Subir documento

```
POST /api/clientes/:clienteId/documentos
```

**Headers:** `Authorization: Bearer <token>` (NO enviar Content-Type, lo pone el browser por el multipart)

**Body:** `multipart/form-data`
| Campo  | Tipo   | Descripción |
|--------|--------|-------------|
| `file` | File   | Archivo (PDF, JPG, PNG, DOC, DOCX). Máximo 10 MB |
| `tipo` | string | Nombre/tipo del documento. Ej: `"INE"`, `"Acta Constitutiva"`, `"Carta poder"` |

**Lógica:**
1. Validar que el cliente existe
2. Subir archivo a S3 con ruta: `clientes/{clienteId}/documentos/{timestamp}_{nombre_original}`
3. Insertar registro en `documentos_clientes`:
   - `cliente_id` = :clienteId
   - `tipo` = campo `tipo` del form
   - `nombre` = nombre original del archivo
   - `ruta_archivo` = key de S3
   - `extension` = extensión del archivo (.pdf, .jpg, etc.)
   - `fecha_subida` = NOW()
   - `estado` = 'Vigente'
   - `tipo_archivo` = MIME type del archivo
   - `tamaño` = tamaño en formato legible (ej: "2.5 MB")

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "cliente_id": 123,
    "tipo": "INE",
    "nombre": "INE_frente.pdf",
    "ruta_archivo": "clientes/123/documentos/1710700000_INE_frente.pdf",
    "extension": ".pdf",
    "fecha_subida": "2026-03-18",
    "estado": "Vigente",
    "tipo_archivo": "application/pdf",
    "tamaño": "2.5 MB"
  }
}
```

---

## 2. Listar documentos del cliente

```
GET /api/clientes/:clienteId/documentos
```

**Headers:** `Authorization: Bearer <token>`

**Lógica:** `SELECT * FROM documentos_clientes WHERE cliente_id = :clienteId ORDER BY fecha_subida DESC`

**Respuesta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "cliente_id": 123,
      "tipo": "INE",
      "nombre": "INE_frente.pdf",
      "ruta_archivo": "clientes/123/documentos/...",
      "extension": ".pdf",
      "fecha_subida": "2026-03-18",
      "estado": "Vigente",
      "tipo_archivo": "application/pdf",
      "tamaño": "2.5 MB"
    },
    {
      "id": 2,
      "tipo": "Comprobante de Domicilio",
      "nombre": "recibo_luz.jpg",
      ...
    }
  ]
}
```

> **Nota:** Si el cliente no tiene documentos, devolver `{ "success": true, "data": [] }`

---

## 3. Obtener URL firmada (para ver/descargar)

```
GET /api/clientes/:clienteId/documentos/:docId/url
```

**Headers:** `Authorization: Bearer <token>`

**Lógica:**
1. Buscar el documento en `documentos_clientes` donde `id = :docId` y `cliente_id = :clienteId`
2. Generar URL firmada de S3 con `getSignedUrl` (expiración: 5 minutos)

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "signed_url": "https://prosistema-polizas.s3.amazonaws.com/clientes/123/documentos/...?X-Amz-...",
    "expires_in": 300
  }
}
```

> **Referencia:** Funciona igual que el endpoint existente para PDFs de pólizas. Ver cómo se hace en las rutas de expedientes/PDF.

---

## 4. Actualizar/Reemplazar archivo

```
PUT /api/clientes/:clienteId/documentos/:docId
```

**Headers:** `Authorization: Bearer <token>`

**Body:** `multipart/form-data`
| Campo  | Tipo | Descripción |
|--------|------|-------------|
| `file` | File | Nuevo archivo que reemplaza al anterior |

**Lógica:**
1. Buscar documento existente en BD
2. Eliminar archivo anterior de S3 (la key vieja en `ruta_archivo`)
3. Subir nuevo archivo a S3
4. Actualizar registro en BD (`nombre`, `ruta_archivo`, `extension`, `fecha_subida`, `tipo_archivo`, `tamaño`)

**Respuesta (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tipo": "INE",
    "nombre": "INE_nueva.pdf",
    "fecha_subida": "2026-03-18",
    ...
  }
}
```

---

## 5. Eliminar documento

```
DELETE /api/clientes/:clienteId/documentos/:docId
```

**Headers:** `Authorization: Bearer <token>`

**Lógica:**
1. Buscar documento en BD
2. Eliminar archivo de S3
3. Eliminar registro de `documentos_clientes`

**Respuesta (200):**
```json
{
  "success": true,
  "message": "Documento eliminado correctamente"
}
```

---

## Tabla `documentos_clientes` (referencia)

Ya existe el script en `scripts/crear_tabla_documentos_clientes.sql`:

```sql
CREATE TABLE documentos_clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  tipo VARCHAR(100) NOT NULL,          -- 'INE', 'Acta Constitutiva', 'Carta poder', etc.
  nombre VARCHAR(255),                  -- nombre original del archivo
  ruta_archivo VARCHAR(500),            -- key de S3
  extension VARCHAR(10),                -- '.pdf', '.jpg', etc.
  fecha_subida DATE,
  estado ENUM('Vigente','Vencido','Por renovar') DEFAULT 'Vigente',
  tipo_archivo VARCHAR(50),             -- MIME type
  tamaño VARCHAR(20),                   -- '2.5 MB'
  notas TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);
```

> **Si la tabla no existe en producción, ejecutar ese script primero.**

---

## Ruta S3 sugerida

```
clientes/{clienteId}/documentos/{timestamp}_{nombre_original}
```

Ejemplo: `clientes/45/documentos/1710700000_INE_frente.pdf`

---

## Middleware

Usar `multer` con `memoryStorage` igual que ya se usa para PDFs de pólizas. Referencia: ver las rutas de upload de expedientes.

---

## Patrón de referencia en backend

Los endpoints de PDF de pólizas ya hacen lo mismo (subir a S3 + generar signed URL). Se puede copiar/adaptar esa lógica:
- Upload: `FormData` → multer → S3 `putObject`
- Signed URL: `getSignedUrl` con expiración
- Delete: `deleteObject` de S3

---

## Resumen rápido

| # | Método | Ruta | Qué hace |
|---|--------|------|----------|
| 1 | POST   | `/api/clientes/:clienteId/documentos` | Subir archivo a S3 + crear registro |
| 2 | GET    | `/api/clientes/:clienteId/documentos` | Listar todos los docs del cliente |
| 3 | GET    | `/api/clientes/:clienteId/documentos/:docId/url` | URL firmada para ver/descargar |
| 4 | PUT    | `/api/clientes/:clienteId/documentos/:docId` | Reemplazar archivo existente |
| 5 | DELETE | `/api/clientes/:clienteId/documentos/:docId` | Eliminar de S3 y BD |

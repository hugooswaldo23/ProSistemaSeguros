# 📄 Resumen de Cambios - Sistema de Documentos para Clientes

## 🎯 Problema Resuelto
**Situación anterior**: Los documentos que se subían en el módulo de Clientes solo se guardaban en el estado de React, por lo que al refrescar la página se perdían.

**Solución implementada**: Sistema completo de gestión de documentos con almacenamiento persistente en base de datos y archivos en servidor.

---

## ✅ Cambios Implementados en el Frontend

### Archivo Modificado: `src/screens/Clientes.jsx`

#### 1. **Nuevo Estado para Archivo Seleccionado** (Línea 182)
```javascript
const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
```

#### 2. **Función `agregarDocumento()` Actualizada** (Línea 436-479)
**Antes**: Solo agregaba el documento al estado local de React
**Ahora**: 
- Crea un `FormData` con el archivo seleccionado
- Hace un `POST` a `/api/clientes/:id/documentos`
- Sube el archivo real al servidor
- Actualiza el estado con la respuesta del servidor

**Formato de envío**:
```javascript
FormData:
- archivo: File
- tipo: "INE" | "CURP" | "RFC" | etc.
- estado: "Vigente"
```

#### 3. **Función `eliminarDocumento()` Actualizada** (Línea 525-583)
**Antes**: Solo eliminaba del estado local
**Ahora**:
- Hace un `DELETE` a `/api/clientes/:id/documentos/:doc_id`
- Elimina el archivo del servidor
- Elimina el registro de la base de datos
- Actualiza el estado local

#### 4. **Función `verDetallesCliente()` Actualizada** (Línea 430-451)
**Ahora carga automáticamente los documentos** cuando se selecciona un cliente:
- Hace un `GET` a `/api/clientes/:id/documentos`
- Carga todos los documentos desde el backend
- Los muestra en el detalle del cliente

#### 5. **Modal de Subir Documentos Mejorado** (Línea 2367-2409)
**Nuevas características**:
- Input de archivo funcional con `onChange`
- Validación de tipos de archivo (PDF, JPG, PNG, DOC, DOCX)
- Muestra el nombre y tamaño del archivo seleccionado
- Límite de 10MB
- Botón deshabilitado si no se selecciona archivo

---

## 🗄️ Cambios en Base de Datos

### Nueva Tabla: `documentos_clientes`

**Script**: `scripts/crear_tabla_documentos_clientes.sql`

**Estructura**:
```sql
CREATE TABLE documentos_clientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  tipo VARCHAR(100) NOT NULL,          -- "INE", "CURP", "RFC", etc.
  nombre VARCHAR(255) NOT NULL,         -- Nombre original del archivo
  ruta_archivo VARCHAR(500) NOT NULL,   -- Ruta en servidor
  extension VARCHAR(10),                -- ".pdf", ".jpg", etc.
  fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('Vigente', 'Vencido'),   -- Estado del documento
  tipo_archivo VARCHAR(100),            -- MIME type
  tamaño BIGINT,                        -- Tamaño en bytes
  notas TEXT,                           -- Observaciones
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);
```

**Índices creados**:
- `idx_cliente_id` - Para búsquedas por cliente
- `idx_tipo` - Para filtrar por tipo de documento
- `idx_estado` - Para filtrar vigentes/vencidos
- `idx_fecha_subida` - Para ordenar por fecha

---

## 🛣️ API Endpoints Requeridos (Backend)

### Endpoints que debe implementar el equipo de IT:

#### 1. **Listar Documentos**
```
GET /api/clientes/:id/documentos
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "cliente_id": 5,
      "tipo": "INE",
      "nombre": "INE_frente.pdf",
      "ruta_archivo": "/uploads/clientes/5/documentos/INE_1234567890.pdf",
      "extension": ".pdf",
      "fecha_subida": "2025-01-15T10:30:00",
      "estado": "Vigente",
      "tipo_archivo": "application/pdf",
      "tamaño": 2548000,
      "notas": null
    }
  ]
}
```

#### 2. **Subir Documento**
```
POST /api/clientes/:id/documentos
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body (FormData):
- archivo: File
- tipo: "INE"
- estado: "Vigente"
- notas: "Opcional"

Response:
{
  "success": true,
  "message": "Documento subido correctamente",
  "data": { ...documento creado... }
}
```

#### 3. **Eliminar Documento**
```
DELETE /api/clientes/:id/documentos/:doc_id
Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Documento eliminado correctamente"
}
```

#### 4. **Descargar Documento** (Opcional)
```
GET /api/clientes/:id/documentos/:doc_id/descargar
Authorization: Bearer {token}

Response: Archivo para descarga
```

---

## 📁 Archivos Creados/Modificados

### ✅ Archivos del Frontend (listos)
- [x] `src/screens/Clientes.jsx` - Actualizado con funcionalidad completa

### 📄 Scripts SQL (listos para ejecutar)
- [x] `scripts/crear_tabla_documentos_clientes.sql` - Crear tabla de documentos

### 📋 Documentación Técnica (lista para IT)
- [x] `docs/estructura-tabla-documentos-clientes.json` - Especificación completa de API
- [x] `docs/backend-documentos-implementacion.md` - Guía paso a paso para implementación
- [x] `docs/RESUMEN-CAMBIOS-DOCUMENTOS.md` - Este archivo

---

## 🚀 Pasos para Poner en Producción

### Para el Equipo de IT:

#### 1. **Ejecutar Script de Base de Datos**
```bash
mysql -u usuario -p base_datos < scripts/crear_tabla_documentos_clientes.sql
```

#### 2. **Crear Carpeta de Uploads en Servidor**
```bash
mkdir -p /var/www/uploads/clientes
chmod 755 /var/www/uploads
chown -R www-data:www-data /var/www/uploads
```

#### 3. **Implementar Backend**
Ver guía completa en: `docs/backend-documentos-implementacion.md`

Resumen:
- Instalar: `npm install multer`
- Crear rutas según el archivo de guía
- Implementar middleware de autenticación
- Configurar almacenamiento de archivos

#### 4. **Probar Endpoints**
Usar Postman o Thunder Client con los ejemplos del archivo de documentación.

### Para Ti (Frontend):

#### 1. **Subir Cambios a Git** (si aún no lo hiciste)
Opción A - GitHub Desktop:
1. Abre GitHub Desktop
2. Verás 2 commits pendientes
3. Clic en "Push origin"

Opción B - Terminal:
```bash
git push origin main
```

#### 2. **Esperar Backend**
El frontend ya está listo. Solo necesita que IT implemente las rutas del API.

#### 3. **Probar Funcionalidad**
Una vez que IT termine:
1. Inicia sesión en el sistema
2. Ve a Clientes
3. Selecciona un cliente o crea uno nuevo
4. En "Documentos del Cliente", clic en "Subir Documento"
5. Selecciona tipo y archivo
6. Sube el documento
7. Refresca la página
8. ✅ Los documentos deben seguir ahí

---

## 🔍 Diferencias Clave

### Antes ❌
```javascript
// Solo guardaba en estado de React
const nuevoDocumento = {
  id: Date.now(),
  tipo: "INE",
  nombre: "documento.pdf"
};
setClientes([...clientes, nuevoDocumento]);
// Al refrescar → se perdía
```

### Ahora ✅
```javascript
// Guarda en backend
const formData = new FormData();
formData.append('archivo', archivo);
const response = await fetch('/api/clientes/:id/documentos', {
  method: 'POST',
  body: formData
});
// Al refrescar → se mantiene en BD
```

---

## 📊 Flujo Completo

```
Usuario sube documento
         ↓
Frontend crea FormData
         ↓
POST /api/clientes/:id/documentos
         ↓
Backend recibe archivo
         ↓
Guarda archivo en /uploads/clientes/{id}/documentos/
         ↓
Inserta registro en documentos_clientes
         ↓
Devuelve información del documento
         ↓
Frontend actualiza el estado
         ↓
Usuario ve el documento en la lista
         ↓
Usuario refresca página
         ↓
GET /api/clientes/:id/documentos carga documentos
         ↓
✅ Documentos siguen ahí
```

---

## 🎓 Tecnologías Utilizadas

### Frontend
- **FormData API**: Para enviar archivos multipart/form-data
- **Fetch API**: Para comunicación con backend
- **React Hooks**: useState, useCallback para gestión de estado

### Backend (a implementar)
- **Multer**: Middleware para manejar archivos
- **Node.js/Express**: Servidor y rutas
- **MySQL**: Base de datos
- **File System (fs)**: Para manipular archivos en servidor

---

## ✅ Checklist de Implementación

### Frontend ✅
- [x] Actualizar función agregarDocumento()
- [x] Actualizar función eliminarDocumento()
- [x] Agregar carga automática de documentos
- [x] Actualizar modal con input file
- [x] Agregar validaciones de archivo
- [x] Manejo de errores
- [x] Commits en Git

### Backend ⏳ (Pendiente IT)
- [ ] Crear tabla documentos_clientes
- [ ] Configurar carpeta de uploads
- [ ] Instalar dependencias (multer)
- [ ] Implementar rutas del API
- [ ] Configurar middleware de autenticación
- [ ] Pruebas con Postman
- [ ] Deploy a producción

### Testing ⏳
- [ ] Probar subida de diferentes tipos de archivo
- [ ] Probar límite de tamaño (10MB)
- [ ] Probar eliminación de documentos
- [ ] Probar persistencia después de refresh
- [ ] Probar con múltiples clientes

---

## 📞 Contacto

**Para dudas sobre el frontend**: Álvaro (tú)
**Para implementación del backend**: Equipo de IT

**Archivos importantes para IT**:
1. `docs/backend-documentos-implementacion.md` - 📕 Guía completa
2. `docs/estructura-tabla-documentos-clientes.json` - 📄 Especificación API
3. `scripts/crear_tabla_documentos_clientes.sql` - 🗄️ Script de BD

---

**Generado**: Enero 2025
**Estado**: ✅ Frontend completo | ⏳ Backend pendiente

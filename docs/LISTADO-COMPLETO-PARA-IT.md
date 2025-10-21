# 📋 LISTADO COMPLETO DE IMPLEMENTACIÓN PARA IT
## Sistema de Seguros - ProSistemaSeguros

**Fecha:** 20 de Enero de 2025  
**Responsable Frontend:** Álvaro  
**Responsable Backend:** Equipo IT

---

## 📊 RESUMEN EJECUTIVO

Este documento contiene **TODAS** las tareas de backend que deben implementarse para completar las funcionalidades del sistema. Se agrupan en 3 áreas principales:

1. **Módulo de Clientes** - Gestión de documentos
2. **Configuración de Tablas** - 4 catálogos maestros
3. **Actualizaciones de BD** - Campos faltantes en tabla clientes

---

## 🗄️ PARTE 1: ACTUALIZACIONES DE BASE DE DATOS

### 1.1 Tabla `clientes` - Agregar campos faltantes

**Archivo:** `scripts/agregar_campos_clientes.sql`

**Descripción:** Agrega los campos `codigo` y `categoria_id` a la tabla clientes

**Campos a agregar:**
```sql
- codigo VARCHAR(20) UNIQUE
- categoria_id INT NULL (FK a categorias_clientes)
```

**Índices:**
- `idx_categoria_id` en categoria_id

**Foreign Key:**
- Relación con `categorias_clientes(id)`
- ON DELETE SET NULL
- ON UPDATE CASCADE

**Acciones:**
- ✅ Script SQL creado: `scripts/agregar_campos_clientes.sql`
- ⏳ **PENDIENTE IT:** Ejecutar script en base de datos de producción

**Impacto:** 
- Frontend YA usa estos campos
- Sin estos campos, el módulo de clientes dará error

---

### 1.2 Crear tablas de catálogos maestros

**Archivo:** `scripts/crear_tablas_catalogos.sql`

**Descripción:** Crea 4 tablas para catálogos del sistema con datos iniciales

**Tablas a crear:**

#### Tabla: `tipos_documentos`
```sql
Campos principales:
- id (PK)
- codigo (UNIQUE, ej: DOC_PF_001)
- nombre
- tipo_persona ENUM('Persona Física', 'Persona Moral')
- obligatorio BOOLEAN
- vigencia_dias INT
- orden INT
- activo BOOLEAN
- timestamps

Datos iniciales: 13 documentos (6 Persona Física + 7 Persona Moral)
```

#### Tabla: `canales_venta`
```sql
Campos principales:
- id (PK)
- codigo (UNIQUE, ej: CV_001)
- nombre
- descripcion TEXT
- icono VARCHAR(50)
- color VARCHAR(20)
- orden INT
- activo BOOLEAN
- timestamps

Datos iniciales: 8 canales
```

#### Tabla: `categorias_clientes`
```sql
Campos principales:
- id (PK)
- codigo (UNIQUE, ej: CAT_001)
- nombre
- descripcion TEXT
- color VARCHAR(20)
- orden INT
- activo BOOLEAN
- timestamps

Datos iniciales: 6 categorías
NOTA: Esta tabla puede ya existir, el script usa CREATE IF NOT EXISTS
```

#### Tabla: `tipos_tramites`
```sql
Campos principales:
- id (PK)
- codigo (UNIQUE, ej: TRAM_001)
- nombre
- descripcion TEXT
- tiempo_estimado INT (horas)
- requiere_documentos BOOLEAN
- documentos_requeridos JSON
- orden INT
- activo BOOLEAN
- timestamps

Datos iniciales: 18 trámites
```

**Acciones:**
- ✅ Script SQL creado: `scripts/crear_tablas_catalogos.sql`
- ⏳ **PENDIENTE IT:** Ejecutar script en base de datos de producción

**Impacto:** 
- Sin estas tablas, el módulo de Configuración de Tablas no guardará cambios
- Los datos se perderán al refrescar

---

### 1.3 Tabla de documentos de clientes

**Archivo:** `scripts/crear_tabla_documentos_clientes.sql`

**Descripción:** Crea tabla para almacenar documentos subidos por clientes

**Tabla:** `documentos_clientes`
```sql
Campos principales:
- id (PK)
- cliente_id (FK a clientes)
- tipo VARCHAR(100)
- nombre VARCHAR(255)
- ruta_archivo VARCHAR(500)
- extension VARCHAR(10)
- fecha_subida DATETIME
- estado ENUM('Vigente', 'Vencido')
- tipo_archivo VARCHAR(100) (MIME type)
- tamaño BIGINT (bytes)
- notas TEXT
- timestamps

Índices:
- idx_cliente_id
- idx_tipo
- idx_estado
- idx_fecha_subida

Foreign Key:
- cliente_id → clientes(id) ON DELETE CASCADE
```

**Acciones:**
- ✅ Script SQL creado: `scripts/crear_tabla_documentos_clientes.sql`
- ⏳ **PENDIENTE IT:** Ejecutar script en base de datos de producción

**Impacto:** 
- Sin esta tabla, no se pueden guardar documentos de clientes
- Actualmente los documentos se pierden al refrescar

---

## 🔌 PARTE 2: ENDPOINTS DE API A IMPLEMENTAR

### 2.1 Documentos de Clientes

**Guía completa:** `docs/backend-documentos-implementacion.md`

**Tecnología requerida:**
- Node.js/Express
- Multer (para manejo de archivos)
- File System (para almacenamiento)

**Estructura de carpetas:**
```
/var/www/uploads/clientes/{cliente_id}/documentos/
```

**Endpoints a crear:**

#### 1. Listar documentos de un cliente
```
GET /api/clientes/:id/documentos
Authorization: Bearer {token}

Response: {
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
      "tamaño": 2548000
    }
  ]
}
```

#### 2. Subir documento
```
POST /api/clientes/:id/documentos
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body (FormData):
- archivo: File
- tipo: string
- estado: string ("Vigente" | "Vencido")
- notas: string (opcional)

Response: {
  "success": true,
  "message": "Documento subido correctamente",
  "data": { ...documento... }
}
```

#### 3. Actualizar metadatos
```
PUT /api/clientes/:id/documentos/:doc_id
Authorization: Bearer {token}
Content-Type: application/json

Body: {
  "tipo": "string",
  "estado": "Vigente",
  "notas": "string"
}
```

#### 4. Reemplazar archivo
```
POST /api/clientes/:id/documentos/:doc_id/reemplazar
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body (FormData):
- archivo: File
```

#### 5. Eliminar documento
```
DELETE /api/clientes/:id/documentos/:doc_id
Authorization: Bearer {token}

Response: {
  "success": true,
  "message": "Documento eliminado correctamente"
}
```

#### 6. Descargar documento
```
GET /api/clientes/:id/documentos/:doc_id/descargar
Authorization: Bearer {token}

Response: Archivo para descarga (attachment)
```

#### 7. Ver documento (inline)
```
GET /api/clientes/:id/documentos/:doc_id/ver
Authorization: Bearer {token}

Response: Archivo para visualización (inline)
```

**Validaciones:**
- Tipos de archivo permitidos: PDF, JPG, JPEG, PNG, DOC, DOCX
- Tamaño máximo: 10MB
- Autenticación requerida en todos los endpoints

**Archivos de referencia:**
- `docs/estructura-tabla-documentos-clientes.json` - Especificación completa
- `docs/backend-documentos-implementacion.md` - Guía paso a paso con código

**Estado Frontend:** ✅ COMPLETO - Esperando backend

---

### 2.2 Tipos de Documentos

**Service Frontend:** `src/services/tiposDocumentosService.js` ✅

**Endpoints a crear:**

```
GET    /api/tipos-documentos                          Listar todos
GET    /api/tipos-documentos?tipo_persona={tipo}      Filtrar por tipo
GET    /api/tipos-documentos?activo=true              Solo activos
GET    /api/tipos-documentos/:id                      Obtener por ID
POST   /api/tipos-documentos                          Crear nuevo
PUT    /api/tipos-documentos/:id                      Actualizar
DELETE /api/tipos-documentos/:id                      Eliminar
PATCH  /api/tipos-documentos/:id/estado               Cambiar estado
```

**Modelo de datos:**
```json
{
  "id": 1,
  "codigo": "DOC_PF_001",
  "nombre": "Identificación Oficial (INE/Pasaporte)",
  "tipo_persona": "Persona Física",
  "obligatorio": true,
  "vigencia_dias": 0,
  "orden": 1,
  "activo": true,
  "created_at": "2025-01-20T10:00:00",
  "updated_at": "2025-01-20T10:00:00"
}
```

---

### 2.3 Canales de Venta

**Service Frontend:** `src/services/canalesVentaService.js` ✅

**Endpoints a crear:**

```
GET    /api/canales-venta                    Listar todos
GET    /api/canales-venta?activo=true        Solo activos
GET    /api/canales-venta/:id                Obtener por ID
POST   /api/canales-venta                    Crear nuevo
PUT    /api/canales-venta/:id                Actualizar
DELETE /api/canales-venta/:id                Eliminar
PATCH  /api/canales-venta/:id/estado         Cambiar estado
```

**Modelo de datos:**
```json
{
  "id": 1,
  "codigo": "CV_001",
  "nombre": "Directo",
  "descripcion": "Cliente que llega directamente a la empresa",
  "icono": "UserCheck",
  "color": "primary",
  "orden": 1,
  "activo": true,
  "created_at": "2025-01-20T10:00:00",
  "updated_at": "2025-01-20T10:00:00"
}
```

---

### 2.4 Categorías de Clientes

**Service Frontend:** `src/services/categoriasClientesService.js` ✅

**Endpoints a crear:**

```
GET    /api/categorias-clientes                Listar todos (YA EXISTE)
GET    /api/categorias-clientes?activo=true    Solo activos
GET    /api/categorias-clientes/:id            Obtener por ID
POST   /api/categorias-clientes                Crear nuevo
PUT    /api/categorias-clientes/:id            Actualizar
DELETE /api/categorias-clientes/:id            Eliminar
PATCH  /api/categorias-clientes/:id/estado     Cambiar estado
```

**NOTA:** El endpoint GET principal ya existe y funciona. Solo faltan los de CRUD.

**Modelo de datos:**
```json
{
  "id": 1,
  "codigo": "CAT_001",
  "nombre": "Normal",
  "descripcion": "Cliente estándar",
  "color": "secondary",
  "orden": 1,
  "activo": true,
  "created_at": "2025-01-20T10:00:00",
  "updated_at": "2025-01-20T10:00:00"
}
```

---

### 2.5 Tipos de Trámites

**Service Frontend:** `src/services/tiposTramitesService.js` ✅

**Endpoints a crear:**

```
GET    /api/tipos-tramites                    Listar todos
GET    /api/tipos-tramites?activo=true        Solo activos
GET    /api/tipos-tramites/:id                Obtener por ID
POST   /api/tipos-tramites                    Crear nuevo
PUT    /api/tipos-tramites/:id                Actualizar
DELETE /api/tipos-tramites/:id                Eliminar
PATCH  /api/tipos-tramites/:id/estado         Cambiar estado
```

**Modelo de datos:**
```json
{
  "id": 1,
  "codigo": "TRAM_001",
  "nombre": "MOVIMIENTO GENERAL EN PÓLIZA",
  "descripcion": "Modificaciones generales en la póliza",
  "tiempo_estimado": 24,
  "requiere_documentos": true,
  "documentos_requeridos": ["DOC_PF_001", "DOC_PF_002"],
  "orden": 1,
  "activo": true,
  "created_at": "2025-01-20T10:00:00",
  "updated_at": "2025-01-20T10:00:00"
}
```

**NOTA ESPECIAL:** El campo `documentos_requeridos` es JSON. En MySQL usar tipo JSON.

---

## 📁 PARTE 3: ESTRUCTURA DE ARCHIVOS CREADOS

### Scripts SQL (Listos para ejecutar)
```
✅ scripts/agregar_campos_clientes.sql
✅ scripts/crear_tablas_catalogos.sql
✅ scripts/crear_tabla_documentos_clientes.sql
```

### Services Frontend (Ya implementados)
```
✅ src/services/tiposDocumentosService.js
✅ src/services/canalesVentaService.js
✅ src/services/categoriasClientesService.js
✅ src/services/tiposTramitesService.js
```

### Documentación Técnica
```
✅ docs/estructura-tabla-clientes.json
✅ docs/api-clientes-backend.json
✅ docs/estructura-tabla-documentos-clientes.json
✅ docs/backend-documentos-implementacion.md
✅ docs/RESUMEN-CAMBIOS-DOCUMENTOS.md
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN PARA IT

### Fase 1: Base de Datos (Ejecutar en orden)
```
[ ] 1. Hacer backup completo de la base de datos
[ ] 2. Ejecutar: scripts/agregar_campos_clientes.sql
[ ] 3. Verificar: SELECT codigo, categoria_id FROM clientes LIMIT 5;
[ ] 4. Ejecutar: scripts/crear_tablas_catalogos.sql
[ ] 5. Verificar: SELECT COUNT(*) FROM tipos_documentos;
[ ] 6. Ejecutar: scripts/crear_tabla_documentos_clientes.sql
[ ] 7. Verificar: SHOW TABLES LIKE '%documentos%';
```

### Fase 2: Configuración de Servidor
```
[ ] 1. Crear carpeta: mkdir -p /var/www/uploads/clientes
[ ] 2. Asignar permisos: chmod 755 /var/www/uploads
[ ] 3. Asignar propietario: chown -R www-data:www-data /var/www/uploads
[ ] 4. Instalar dependencia: npm install multer
```

### Fase 3: Implementación de APIs

#### Documentos de Clientes (7 endpoints)
```
[ ] GET    /api/clientes/:id/documentos
[ ] POST   /api/clientes/:id/documentos
[ ] PUT    /api/clientes/:id/documentos/:doc_id
[ ] POST   /api/clientes/:id/documentos/:doc_id/reemplazar
[ ] DELETE /api/clientes/:id/documentos/:doc_id
[ ] GET    /api/clientes/:id/documentos/:doc_id/descargar
[ ] GET    /api/clientes/:id/documentos/:doc_id/ver
```

#### Tipos de Documentos (8 endpoints)
```
[ ] GET    /api/tipos-documentos
[ ] GET    /api/tipos-documentos?tipo_persona={tipo}
[ ] GET    /api/tipos-documentos?activo=true
[ ] GET    /api/tipos-documentos/:id
[ ] POST   /api/tipos-documentos
[ ] PUT    /api/tipos-documentos/:id
[ ] DELETE /api/tipos-documentos/:id
[ ] PATCH  /api/tipos-documentos/:id/estado
```

#### Canales de Venta (7 endpoints)
```
[ ] GET    /api/canales-venta
[ ] GET    /api/canales-venta?activo=true
[ ] GET    /api/canales-venta/:id
[ ] POST   /api/canales-venta
[ ] PUT    /api/canales-venta/:id
[ ] DELETE /api/canales-venta/:id
[ ] PATCH  /api/canales-venta/:id/estado
```

#### Categorías de Clientes (6 endpoints - GET principal ya existe)
```
[ ] GET    /api/categorias-clientes?activo=true
[ ] GET    /api/categorias-clientes/:id
[ ] POST   /api/categorias-clientes
[ ] PUT    /api/categorias-clientes/:id
[ ] DELETE /api/categorias-clientes/:id
[ ] PATCH  /api/categorias-clientes/:id/estado
```

#### Tipos de Trámites (7 endpoints)
```
[ ] GET    /api/tipos-tramites
[ ] GET    /api/tipos-tramites?activo=true
[ ] GET    /api/tipos-tramites/:id
[ ] POST   /api/tipos-tramites
[ ] PUT    /api/tipos-tramites/:id
[ ] DELETE /api/tipos-tramites/:id
[ ] PATCH  /api/tipos-tramites/:id/estado
```

### Fase 4: Pruebas
```
[ ] Probar subida de documentos con Postman
[ ] Probar CRUD de tipos de documentos
[ ] Probar CRUD de canales de venta
[ ] Probar CRUD de categorías de clientes
[ ] Probar CRUD de tipos de trámites
[ ] Verificar que los archivos se guardan correctamente
[ ] Verificar que las eliminaciones también borran archivos físicos
```

---

## 📊 RESUMEN DE CONTEO

### Base de Datos
- **3** scripts SQL a ejecutar
- **5** tablas nuevas/modificadas
- **141** registros de datos iniciales

### API Endpoints
- **35** endpoints en total
- **7** para documentos de clientes
- **8** para tipos de documentos
- **7** para canales de venta
- **6** para categorías de clientes
- **7** para tipos de trámites

### Archivos de Código
- **4** services frontend (ya listos)
- **7** documentos de especificación
- **1** guía completa de implementación con código

---

## 🔒 AUTENTICACIÓN

**TODOS los endpoints requieren:**
```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

El token se obtiene del `localStorage.getItem('ss_token')`

---

## 🚨 NOTAS IMPORTANTES

1. **Orden de ejecución:** Ejecutar los scripts SQL en el orden indicado
2. **Backup:** Hacer backup ANTES de ejecutar cualquier script
3. **Archivos:** Configurar correctamente los permisos de la carpeta uploads
4. **JSON en MySQL:** El campo `documentos_requeridos` usa tipo JSON nativo de MySQL
5. **Cascada:** La tabla `documentos_clientes` tiene CASCADE en DELETE
6. **Validaciones:** Implementar validaciones de tamaño y tipo de archivo

---

## 📞 CONTACTO Y SOPORTE

**Frontend (Álvaro):**
- Todos los services ya están implementados y listos
- El frontend está esperando que el backend esté listo
- Cualquier duda sobre el formato de datos o estructura

**IT (Backend):**
- Revisar archivos en carpeta `docs/` para detalles técnicos
- Ver `backend-documentos-implementacion.md` para código completo
- Los scripts SQL están probados y listos para ejecutar

---

## 📅 PRÓXIMOS PASOS

Una vez implementado todo esto:

1. ✅ Módulo de Clientes estará 100% funcional con documentos persistentes
2. ✅ Configuración de Tablas guardará cambios en BD
3. ✅ Todos los catálogos serán persistentes
4. ✅ Sistema listo para producción

---

**Documento generado:** 20 de Enero de 2025  
**Versión:** 1.0  
**Estado:** Listo para implementación

---

## 📎 ANEXOS

Todos los archivos mencionados están en el repositorio:
- **GitHub:** proordermx/ProSistemaSeguros
- **Branch:** main
- **Último commit:** Enero 20, 2025

Para cualquier duda, revisar los archivos de documentación en la carpeta `docs/`

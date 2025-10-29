# 🔄 Migración de IDs a BIGINT

## Objetivo
Unificar todos los IDs del sistema para usar **BIGINT UNSIGNED** y establecer relaciones correctas entre tablas.

## ¿Por qué BIGINT?
- **Escalabilidad**: Hasta 9 trillones de registros
- **Rendimiento**: Índices más rápidos que VARCHAR/UUID
- **Simplicidad**: Fácil de leer y depurar
- **Estándar**: Común en sistemas empresariales

---

## PASO 1: Verificar Estructura Actual

```sql
-- Ver estructura de tablas principales
DESCRIBE clientes;
DESCRIBE expedientes;
DESCRIBE tramites;
DESCRIBE documentos_clientes;
```

---

## PASO 2: Backup Completo

```sql
-- Crear respaldo de todas las tablas
CREATE TABLE clientes_backup_20251028 AS SELECT * FROM clientes;
CREATE TABLE expedientes_backup_20251028 AS SELECT * FROM expedientes;
CREATE TABLE tramites_backup_20251028 AS SELECT * FROM tramites;
CREATE TABLE documentos_clientes_backup_20251028 AS SELECT * FROM documentos_clientes;

-- Verificar que se crearon los backups
SELECT COUNT(*) as total_clientes FROM clientes_backup_20251028;
SELECT COUNT(*) as total_expedientes FROM expedientes_backup_20251028;
```

---

## PASO 3: Modificar Tabla CLIENTES

```sql
-- Si la tabla clientes tiene UUID, necesitamos recrearla
-- Primero, eliminar constraints de foreign keys que apuntan a clientes

-- Mostrar todas las foreign keys
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
    REFERENCED_TABLE_NAME = 'clientes';

-- Eliminar foreign keys (ajustar nombres según tu BD)
-- ALTER TABLE expedientes DROP FOREIGN KEY fk_expedientes_cliente;
-- ALTER TABLE documentos_clientes DROP FOREIGN KEY fk_documentos_cliente;

-- Si la tabla tiene UUID, recrearla:
-- OPCIÓN A: Si puedes recrear la tabla (recomendado para BD nueva)
DROP TABLE IF EXISTS clientes_temp;

CREATE TABLE clientes_temp (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  categoria_id INT UNSIGNED NULL,
  tipoPersona ENUM('Persona Física', 'Persona Moral') NOT NULL DEFAULT 'Persona Física',
  
  -- Persona Física
  nombre VARCHAR(100) NULL,
  apellido_paterno VARCHAR(100) NULL,
  apellido_materno VARCHAR(100) NULL,
  curp VARCHAR(18) NULL,
  fecha_nacimiento DATE NULL,
  
  -- Persona Moral
  razon_social VARCHAR(200) NULL,
  nombre_comercial VARCHAR(200) NULL,
  representante_legal VARCHAR(200) NULL,
  puesto_representante VARCHAR(100) NULL,
  telefono_representante VARCHAR(20) NULL,
  email_representante VARCHAR(100) NULL,
  
  -- Datos de contacto
  rfc VARCHAR(13) NULL,
  email VARCHAR(100) NULL,
  telefono_fijo VARCHAR(20) NULL,
  telefono_movil VARCHAR(20) NULL,
  
  -- Dirección
  direccion VARCHAR(255) NULL,
  ciudad VARCHAR(100) NULL,
  estado VARCHAR(100) NULL,
  codigo_postal VARCHAR(10) NULL,
  pais VARCHAR(100) DEFAULT 'México',
  
  -- Clasificación
  segmento VARCHAR(50) NULL,
  
  -- Arrays guardados como JSON
  contactos JSON NULL,
  documentos JSON NULL,
  expedientes_relacionados JSON NULL,
  
  -- Control
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  notas TEXT NULL,
  fecha_alta DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_categoria_id (categoria_id),
  INDEX idx_rfc (rfc),
  INDEX idx_email (email),
  INDEX idx_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrar datos (ajustar campos según tu estructura actual)
INSERT INTO clientes_temp (
  codigo, categoria_id, tipoPersona, nombre, apellido_paterno, apellido_materno,
  rfc, email, telefono_fijo, telefono_movil, direccion, ciudad, estado, 
  codigo_postal, activo, created_at, updated_at
)
SELECT 
  COALESCE(codigo, CONCAT('CL', LPAD(id, 6, '0'))) as codigo,
  categoria_id,
  tipoPersona,
  nombre,
  apellido_paterno,
  apellido_materno,
  rfc,
  email,
  telefono_fijo,
  telefono_movil,
  direccion,
  ciudad,
  estado,
  codigo_postal,
  activo,
  created_at,
  updated_at
FROM clientes;

-- Verificar migración
SELECT COUNT(*) as total_clientes_original FROM clientes;
SELECT COUNT(*) as total_clientes_nuevo FROM clientes_temp;

-- Si todo está bien, reemplazar
DROP TABLE clientes;
RENAME TABLE clientes_temp TO clientes;
```

---

## PASO 4: Modificar Tabla EXPEDIENTES

```sql
-- Modificar la columna cliente_id para que sea BIGINT
ALTER TABLE expedientes 
MODIFY COLUMN cliente_id BIGINT UNSIGNED NULL;

-- Verificar el cambio
DESCRIBE expedientes;

-- Limpiar datos incorrectos (los que están truncados)
-- Solo si hay datos de prueba que quieres eliminar
-- UPDATE expedientes SET cliente_id = NULL WHERE cliente_id < 1000;

-- O mejor: eliminar expedientes de prueba
-- DELETE FROM expedientes WHERE created_at < '2025-10-28' AND cliente_id IS NOT NULL;
```

---

## PASO 5: Agregar Foreign Keys

```sql
-- Agregar constraint de foreign key
ALTER TABLE expedientes
ADD CONSTRAINT fk_expedientes_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Verificar constraint
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
    TABLE_NAME = 'expedientes' AND CONSTRAINT_NAME = 'fk_expedientes_cliente';
```

---

## PASO 6: Verificación Final

```sql
-- Ver estructura final
DESCRIBE clientes;
DESCRIBE expedientes;

-- Probar la relación
SELECT 
    c.id as cliente_id,
    c.codigo as cliente_codigo,
    c.nombre,
    c.apellido_paterno,
    COUNT(e.id) as total_polizas
FROM clientes c
LEFT JOIN expedientes e ON e.cliente_id = c.id
GROUP BY c.id
ORDER BY c.id;

-- Ver clientes con sus pólizas
SELECT 
    c.id,
    c.codigo,
    c.nombre,
    c.apellido_paterno,
    e.numero_poliza,
    e.tipo_de_poliza,
    e.aseguradora
FROM clientes c
LEFT JOIN expedientes e ON e.cliente_id = c.id
WHERE c.id = 1;  -- Cambiar por el ID del cliente a verificar
```

---

## PASO 7: Ajustes en el Backend (Node.js/PHP)

### Endpoints que necesitan actualización:

#### 1. POST /api/expedientes
```javascript
// Verificar que cliente_id sea un número entero
const clienteId = req.body.cliente_id ? parseInt(req.body.cliente_id) : null;

// Insertar expediente
const query = `
  INSERT INTO expedientes (
    cliente_id, numero_poliza, tipo_de_poliza, aseguradora, ...
  ) VALUES (?, ?, ?, ?, ...)
`;
await connection.query(query, [clienteId, numeroPoliza, tipoPoliza, aseguradora, ...]);
```

#### 2. PUT /api/expedientes/:id
```javascript
// Verificar que cliente_id sea un número entero
const clienteId = req.body.cliente_id ? parseInt(req.body.cliente_id) : null;

// Actualizar expediente
const query = `
  UPDATE expedientes 
  SET cliente_id = ?, numero_poliza = ?, tipo_de_poliza = ?, ...
  WHERE id = ?
`;
await connection.query(query, [clienteId, numeroPoliza, tipoPoliza, ..., expedienteId]);
```

#### 3. GET /api/expedientes
```javascript
// Devolver cliente_id como número
const expedientes = await connection.query('SELECT * FROM expedientes');

// Asegurarse de que cliente_id sea número o null
expedientes.forEach(exp => {
  exp.cliente_id = exp.cliente_id ? parseInt(exp.cliente_id) : null;
});

return res.json(expedientes);
```

#### 4. GET /api/clientes/:id/expedientes (nuevo endpoint recomendado)
```javascript
// Obtener todas las pólizas de un cliente
router.get('/api/clientes/:id/expedientes', async (req, res) => {
  const clienteId = parseInt(req.params.id);
  
  const query = `
    SELECT e.* 
    FROM expedientes e
    WHERE e.cliente_id = ?
    ORDER BY e.created_at DESC
  `;
  
  const expedientes = await connection.query(query, [clienteId]);
  return res.json(expedientes);
});
```

---

## PASO 8: Pruebas

### 1. Crear un nuevo cliente
```http
POST /api/clientes
Content-Type: application/json

{
  "tipoPersona": "Persona Física",
  "nombre": "JUAN",
  "apellido_paterno": "PEREZ",
  "apellido_materno": "GARCIA",
  "rfc": "PEGJ900101XXX",
  "email": "juan@example.com",
  "activo": true
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "id": 1,  // BIGINT
    "codigo": "CL000001",
    "tipoPersona": "Persona Física",
    "nombre": "JUAN",
    "apellido_paterno": "PEREZ",
    ...
  }
}
```

### 2. Crear un expediente vinculado
```http
POST /api/expedientes
Content-Type: application/json

{
  "cliente_id": 1,  // Usar el ID del cliente creado
  "numero_poliza": "POL123456",
  "tipo_de_poliza": "Autos",
  "aseguradora": "Qualitas",
  ...
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "cliente_id": 1,  // BIGINT (no truncado)
    "numero_poliza": "POL123456",
    ...
  }
}
```

### 3. Verificar desde el frontend
```javascript
// En el módulo de Clientes, debería mostrar:
// "1 póliza" o "2 pólizas"

// Al hacer clic, debería abrir el modal con las pólizas correctas
```

---

## Checklist Final

- [ ] Backup creado de todas las tablas
- [ ] Estructura de `clientes` modificada a BIGINT
- [ ] Estructura de `expedientes.cliente_id` modificada a BIGINT
- [ ] Foreign key agregada correctamente
- [ ] Backend actualizado para enviar/recibir BIGINT
- [ ] Frontend probado: contador de pólizas funciona
- [ ] Frontend probado: modal de pólizas se abre
- [ ] Datos de prueba creados y verificados

---

## Rollback (si algo sale mal)

```sql
-- Restaurar desde backup
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS expedientes;

CREATE TABLE clientes AS SELECT * FROM clientes_backup_20251028;
CREATE TABLE expedientes AS SELECT * FROM expedientes_backup_20251028;

-- Recrear índices y constraints si es necesario
```

---

## Notas Importantes

1. **No ejecutar en producción sin backup**
2. **Probar primero en ambiente de desarrollo**
3. **Coordinar con el equipo de backend** para actualizar endpoints
4. **Documentar cualquier cambio adicional** que se haga durante la migración

---

## Fecha de Migración
**Planeada**: 28 de octubre de 2025  
**Estado**: Pendiente  
**Responsable**: Equipo Backend + Frontend

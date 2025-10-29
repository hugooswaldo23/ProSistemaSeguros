# 🐛 PROBLEMA URGENTE: cliente_id en Expedientes

## Problema Identificado

El campo `cliente_id` en la tabla `expedientes` está guardando valores incorrectos:

### Lo que se envía desde el frontend:
```javascript
cliente_id: '11c0b03d-b458-11f0-9cad-0ab39348df91'  // UUID completo (string)
```

### Lo que se guarda en la base de datos:
```sql
cliente_id: 11  -- Solo los primeros dígitos como INT
```

## Causa Raíz

La columna `cliente_id` en la tabla `expedientes` está definida como **INT** o **BIGINT**, cuando debería ser **VARCHAR(36)** para almacenar UUIDs.

Cuando el backend intenta insertar el UUID `'11c0b03d-b458-11f0-9cad-0ab39348df91'`, MySQL/PostgreSQL lo convierte automáticamente a número, resultando en `11`.

## Impacto

❌ **No se pueden relacionar las pólizas con los clientes** porque:
- Cliente tiene: `id = '11c0b03d-b458-11f0-9cad-0ab39348df91'`
- Expediente tiene: `cliente_id = 11`
- La comparación `'11c0b03d-b458-11f0-9cad-0ab39348df91' === 11` siempre es `false`

## Solución Requerida

### 1. Modificar el tipo de columna en la base de datos:

```sql
-- Para MySQL
ALTER TABLE expedientes 
MODIFY COLUMN cliente_id VARCHAR(36) NULL;

-- Para PostgreSQL
ALTER TABLE expedientes 
ALTER COLUMN cliente_id TYPE VARCHAR(36);
```

### 2. Limpiar los datos incorrectos existentes:

```sql
-- Establecer cliente_id como NULL para los registros con valores truncados
UPDATE expedientes 
SET cliente_id = NULL 
WHERE cliente_id IS NOT NULL 
  AND CAST(cliente_id AS CHAR) NOT LIKE '%-%';

-- O si prefieres eliminar los registros de prueba
DELETE FROM expedientes 
WHERE cliente_id IS NOT NULL 
  AND CAST(cliente_id AS CHAR) NOT LIKE '%-%';
```

### 3. Verificar que el endpoint POST/PUT guarde correctamente:

```javascript
// El backend debe recibir y guardar exactamente esto:
{
  cliente_id: '11c0b03d-b458-11f0-9cad-0ab39348df91',  // UUID completo
  // ... otros campos
}
```

### 4. Verificar que el endpoint GET devuelva el UUID:

```javascript
// El backend debe devolver:
{
  id: 38,
  cliente_id: '11c0b03d-b458-11f0-9cad-0ab39348df91',  // UUID completo (no 11)
  numero_poliza: '897142556',
  // ... otros campos
}
```

## Pruebas de Verificación

Después de hacer los cambios, verificar:

1. ✅ Crear un nuevo expediente desde el frontend
2. ✅ Verificar en la base de datos que `cliente_id` tiene el UUID completo
3. ✅ Recargar la lista de clientes y verificar que muestre "2 pólizas" (o el número correcto)
4. ✅ Hacer clic en el botón de pólizas y verificar que se muestren correctamente

## Logs de Debug

```
Cliente ID en tabla clientes: '11c0b03d-b458-11f0-9cad-0ab39348df91' (string)
Cliente ID en tabla expedientes: 11 (number) ❌ INCORRECTO

Debería ser:
Cliente ID en tabla expedientes: '11c0b03d-b458-11f0-9cad-0ab39348df91' (string) ✅
```

## Fecha de Detección
28 de octubre de 2025

## Prioridad
🔴 **URGENTE** - Bloquea la funcionalidad de relacionar pólizas con clientes

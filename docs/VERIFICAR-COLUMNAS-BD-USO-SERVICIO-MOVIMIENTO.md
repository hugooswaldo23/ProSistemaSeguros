# ⚠️ VERIFICACIÓN URGENTE: Columnas uso/servicio/movimiento en BD

**Fecha:** 12 de Noviembre de 2025  
**Problema:** Los campos uso, servicio y movimiento no se populan al editar expedientes


## 🔍 DIAGNÓSTICO

El frontend está:

**PERO** al editar, los campos llegan vacíos desde el backend.


## 🗄️ VERIFICACIÓN REQUERIDA EN BASE DE DATOS

### **PASO 1: Verificar que existen las columnas**

```sql
DESCRIBE expedientes;

SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'expedientes' 
  AND COLUMN_NAME IN (
    'uso', 'uso_poliza', 
    'servicio', 'servicio_poliza', 
    'movimiento', 'movimiento_poliza'
  );
```

**Resultado esperado:**
Deben existir al menos 3 columnas: `uso`, `servicio`, `movimiento` (o sus aliases)


### **PASO 2: Verificar si hay datos guardados**

```sql
SELECT 
    id,
    numero_poliza,
    producto,
    uso,
    uso_poliza,
    servicio,
    servicio_poliza,
    movimiento,
    movimiento_poliza,
    created_at
FROM expedientes
WHERE producto LIKE '%Auto%'
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
Si hay pólizas de autos creadas recientemente, deberían tener valores en estos campos.


### **PASO 3: Si las columnas NO EXISTEN, crearlas**

```sql
ALTER TABLE expedientes ADD COLUMN uso VARCHAR(50) NULL AFTER conductor_habitual;
ALTER TABLE expedientes ADD COLUMN servicio VARCHAR(50) NULL AFTER uso;
ALTER TABLE expedientes ADD COLUMN movimiento VARCHAR(50) NULL AFTER servicio;

ALTER TABLE expedientes ADD COLUMN uso_poliza VARCHAR(50) NULL AFTER movimiento;
ALTER TABLE expedientes ADD COLUMN servicio_poliza VARCHAR(50) NULL AFTER uso_poliza;
ALTER TABLE expedientes ADD COLUMN movimiento_poliza VARCHAR(50) NULL AFTER servicio_poliza;

SHOW COLUMNS FROM expedientes LIKE '%uso%';
SHOW COLUMNS FROM expedientes LIKE '%servicio%';
SHOW COLUMNS FROM expedientes LIKE '%movimiento%';
```


### **PASO 4: Verificar el endpoint GET /api/expedientes**

El backend debe devolver estos campos en la respuesta. Verificar en el código del backend:

```javascript
// Backend debería incluir estos campos al hacer SELECT
SELECT 
  id, numero_poliza, ..., 
  uso, servicio, movimiento,
  uso_poliza, servicio_poliza, movimiento_poliza,
  ...
FROM expedientes
```


### **PASO 5: Verificar el endpoint PUT /api/expedientes/:id**

El backend debe aceptar y guardar estos campos. Verificar en el código:

```javascript
// Backend debería aceptar estos campos en el body
const { 
  uso, uso_poliza,
  servicio, servicio_poliza,
  movimiento, movimiento_poliza,
  ...otrosCampos 
} = req.body;

// Y hacer UPDATE incluyéndolos
UPDATE expedientes SET
  uso = ?,
  servicio = ?,
  movimiento = ?,
  uso_poliza = ?,
  servicio_poliza = ?,
  movimiento_poliza = ?,
  ...
WHERE id = ?
```


## 🚨 PROBLEMA PROBABLE

**Escenario más probable:**


## ✅ SOLUCIÓN

1. **Crear las columnas** en la tabla expedientes (ejecutar PASO 3)
2. **Verificar que el backend las incluya** en INSERT/UPDATE (PASO 5)
3. **Verificar que el backend las devuelva** en SELECT (PASO 4)
4. **Reiniciar el servidor backend** después de los cambios


## 🔗 REFERENCIAS



**⚠️ ACCIÓN REQUERIDA:** Ejecutar PASO 1 y PASO 2 para confirmar diagnóstico

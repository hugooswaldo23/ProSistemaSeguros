# ⚠️ URGENTE - Campo fecha_aviso_renovacion en BD

## Hugo: Por favor ejecutar este script SQL

**Fecha**: 24 de noviembre de 2025
**Prioridad**: ALTA
**Contexto**: Implementación de campo "Aviso de Renovación" en sistema de pólizas

---

## 📋 Problema

El frontend ya está preparado para mostrar y guardar el campo `fecha_aviso_renovacion` en las pólizas, pero **necesitamos verificar que la columna existe en la tabla `expedientes` de la base de datos**.

## ✅ Acción Requerida

**1. Verificar si la columna existe:**

```sql
SHOW COLUMNS FROM expedientes LIKE 'fecha_aviso_renovacion';
```

**Si NO existe**, ejecutar el siguiente script que ya está en el repositorio:

```bash
scripts/agregar_fecha_aviso_renovacion.sql
```

**2. Contenido del script a ejecutar:**

```sql
-- Agregar columna fecha_aviso_renovacion
ALTER TABLE expedientes 
ADD COLUMN fecha_aviso_renovacion DATE NULL COMMENT 'Fecha calculada para avisar renovación (termino_vigencia - 30 días)';

-- Calcular fecha_aviso_renovacion para pólizas existentes
UPDATE expedientes 
SET fecha_aviso_renovacion = DATE_SUB(termino_vigencia, INTERVAL 30 DAY)
WHERE termino_vigencia IS NOT NULL;

-- Crear índice para consultas rápidas
CREATE INDEX idx_fecha_aviso_renovacion ON expedientes(fecha_aviso_renovacion);
```

**3. Verificar resultado:**

```sql
SELECT 
    COUNT(*) as total_polizas,
    COUNT(fecha_aviso_renovacion) as con_fecha_aviso,
    COUNT(*) - COUNT(fecha_aviso_renovacion) as sin_fecha_aviso
FROM expedientes;
```

---

## 🎯 Funcionalidad Implementada

- ✅ **Frontend**: El formulario calcula automáticamente la fecha (término de vigencia - 30 días)
- ✅ **Payload**: Se envía el campo al backend en el PUT/POST
- ✅ **Vista**: Se muestra en la sección "Vigencia de la Póliza" con ícono 🔔 en color amarillo
- ⏳ **Backend/BD**: Pendiente de verificar/crear columna

---

## 📝 Notas Técnicas

- **Campo**: `fecha_aviso_renovacion` (DATE, nullable)
- **Cálculo**: `termino_vigencia - 30 días`
- **Uso**: Notificaciones automáticas de renovación de pólizas
- **Dashboard futuro**: Pólizas próximas a renovar en los próximos 7/15/30 días

---

## 🔍 Prueba de Validación

Después de ejecutar el script:

1. Recargar una póliza existente en el sistema
2. Verificar que en "Ver → Datos Generales de Póliza → Vigencia de la Póliza" aparezca el campo "🔔 Aviso de Renovación" con una fecha
3. Editar la póliza, cambiar fecha de inicio/término, guardar
4. Verificar que se recalcula y guarda correctamente

---

**Gracias Hugo! 🙏**

_Una vez ejecutado, por favor confirma en el grupo para continuar con las pruebas._

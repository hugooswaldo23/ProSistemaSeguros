# NOTA URGENTE PARA HUGO - Campo fecha_aviso_renovacion

## 🔴 ACCIÓN REQUERIDA

**Fecha:** 24 de noviembre de 2025

### Problema Detectado

El campo `fecha_aviso_renovacion` se está calculando correctamente en el frontend y aparece en el formulario de edición, pero **NO se está guardando en la base de datos**.

### Verificación Necesaria

Por favor **verifica si existe el campo en la tabla `expedientes`**:

```sql
DESCRIBE expedientes;
-- O
SHOW COLUMNS FROM expedientes LIKE 'fecha_aviso_renovacion';
```

### Solución

Si el campo **NO existe**, ejecutar el script que ya está preparado:

**Archivo:** `scripts/agregar_fecha_aviso_renovacion.sql`

```bash
# Ejecutar en MariaDB:
mysql -u usuario -p nombre_bd < scripts/agregar_fecha_aviso_renovacion.sql
```

### Qué hace el script:

1. ✅ Agrega columna `fecha_aviso_renovacion DATE NULL`
2. ✅ Calcula fechas para pólizas existentes (termino_vigencia - 30 días)
3. ✅ Crea índice para consultas optimizadas
4. ✅ Muestra reporte de pólizas actualizadas

### Validación Post-Ejecución

Después de ejecutar, verificar que el campo aparezca en las consultas:

```sql
SELECT 
    numero_poliza,
    inicio_vigencia,
    termino_vigencia,
    fecha_aviso_renovacion
FROM expedientes 
WHERE fecha_aviso_renovacion IS NOT NULL
LIMIT 5;
```

### Impacto

- **Frontend:** Ya implementado y funcionando ✅
- **Backend:** El endpoint PUT `/api/expedientes/:id` debe recibir y guardar el campo
- **Vista:** El campo ya aparece en las vistas de Detalle y Edición

### Cambios en este Commit

- ✅ Persistencia de fechas corregida (inicio_vigencia, termino_vigencia)
- ✅ Cálculo automático de fecha_aviso_renovacion en formulario
- ✅ Registro de eventos en historial (captura, edición)
- ✅ Detección de modificaciones manuales vs automáticas
- ✅ Campo fecha_aviso_renovacion visible en vistas (aunque vacío si BD no tiene el campo)

---

**URGENTE:** Sin este campo en BD, las fechas de aviso no persisten entre sesiones.

**Contacto:** Alvaro - Frontend completado, pendiente validación backend/BD

-- ====================================================================
-- Agregar campo fecha_aviso_renovacion a tabla expedientes
-- PROPÓSITO: Precalcular fecha de aviso de renovación (30 días antes)
-- FECHA: 2025-11-21
-- ====================================================================

-- 1. Agregar columna fecha_aviso_renovacion
ALTER TABLE expedientes 
ADD COLUMN fecha_aviso_renovacion DATE NULL COMMENT 'Fecha calculada para avisar renovación (termino_vigencia - 30 días)';

-- 2. Calcular fecha_aviso_renovacion para pólizas existentes
UPDATE expedientes 
SET fecha_aviso_renovacion = DATE_SUB(termino_vigencia, INTERVAL 30 DAY)
WHERE termino_vigencia IS NOT NULL;

-- 3. Crear índice para consultas rápidas
CREATE INDEX idx_fecha_aviso_renovacion ON expedientes(fecha_aviso_renovacion);

-- 4. Verificar resultado
SELECT 
    COUNT(*) as total_polizas,
    COUNT(fecha_aviso_renovacion) as con_fecha_aviso,
    COUNT(*) - COUNT(fecha_aviso_renovacion) as sin_fecha_aviso
FROM expedientes;

-- 5. Mostrar ejemplos de fechas calculadas
SELECT 
    numero_poliza,
    termino_vigencia,
    fecha_aviso_renovacion,
    DATEDIFF(termino_vigencia, fecha_aviso_renovacion) as dias_diferencia
FROM expedientes 
WHERE fecha_aviso_renovacion IS NOT NULL
LIMIT 10;

-- ====================================================================
-- NOTAS PARA EL BACKEND:
-- - El frontend calculará fecha_aviso_renovacion al guardar/editar
-- - Fórmula: fecha_aviso_renovacion = termino_vigencia - 30 días
-- - Queries optimizadas para dashboard:
--   SELECT * FROM expedientes WHERE fecha_aviso_renovacion BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
-- ====================================================================

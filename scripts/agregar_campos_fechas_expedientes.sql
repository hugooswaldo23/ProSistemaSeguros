-- Agregar columnas de fechas clave en expedientes
-- Requiere MySQL 8.0+

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS fecha_emision DATE NULL AFTER total,
  ADD COLUMN IF NOT EXISTS fecha_pago DATE NULL AFTER fecha_ultimo_pago,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_pago DATE NULL AFTER proximo_pago;

-- Poblar valores iniciales aprovechando columnas existentes
UPDATE expedientes
SET fecha_emision = COALESCE(fecha_emision, inicio_vigencia, DATE(created_at))
WHERE fecha_emision IS NULL;

UPDATE expedientes
SET fecha_pago = COALESCE(fecha_pago, fecha_ultimo_pago)
WHERE fecha_pago IS NULL;

UPDATE expedientes
SET fecha_vencimiento_pago = COALESCE(fecha_vencimiento_pago, proximo_pago, termino_vigencia)
WHERE fecha_vencimiento_pago IS NULL;

-- Índices para consultas por mes/año
CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_emision ON expedientes (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_pago ON expedientes (fecha_pago);
CREATE INDEX IF NOT EXISTS idx_expedientes_fecha_vencimiento ON expedientes (fecha_vencimiento_pago);

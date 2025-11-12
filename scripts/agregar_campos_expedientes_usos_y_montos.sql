-- Agregar columnas faltantes en expedientes para Uso/Servicio/Movimiento y montos financieros
-- Requiere MySQL 8.0+

ALTER TABLE expedientes
  ADD COLUMN IF NOT EXISTS uso VARCHAR(50) NULL AFTER deducible,
  ADD COLUMN IF NOT EXISTS servicio VARCHAR(50) NULL AFTER uso,
  ADD COLUMN IF NOT EXISTS movimiento VARCHAR(50) NULL AFTER servicio,
  ADD COLUMN IF NOT EXISTS cargo_pago_fraccionado DECIMAL(12,2) NULL AFTER prima_pagada,
  ADD COLUMN IF NOT EXISTS gastos_expedicion DECIMAL(12,2) NULL AFTER cargo_pago_fraccionado,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NULL AFTER gastos_expedicion;

-- Índices opcionales (descomentar si se consultan frecuentemente por estos campos)
-- CREATE INDEX IF NOT EXISTS idx_expedientes_uso ON expedientes (uso);
-- CREATE INDEX IF NOT EXISTS idx_expedientes_servicio ON expedientes (servicio);
-- CREATE INDEX IF NOT EXISTS idx_expedientes_movimiento ON expedientes (movimiento);

-- NOTA: Si el backend usaba aliases (p. ej., tasa_financiamiento o sub_total),
-- ajustar INSERT/UPDATE/SELECT para usar los nombres canónicos anteriores.
-- Ejemplos (Node/Express):
-- INSERT INTO expedientes (..., uso, servicio, movimiento, cargo_pago_fraccionado, gastos_expedicion, subtotal)
-- VALUES (..., ?, ?, ?, ?, ?, ?)
-- SELECT id, ..., uso, servicio, movimiento, cargo_pago_fraccionado, gastos_expedicion, subtotal FROM expedientes;
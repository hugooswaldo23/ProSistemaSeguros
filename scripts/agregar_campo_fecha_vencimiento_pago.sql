-- Script para agregar el campo fecha_vencimiento_pago a la tabla expedientes
-- Este campo almacena la fecha del próximo pago pendiente
-- Debe ejecutarse en la base de datos prosistema_seguros

USE prosistema_seguros;

-- Agregar columna fecha_vencimiento_pago después de fecha_pago
ALTER TABLE expedientes 
ADD COLUMN fecha_vencimiento_pago DATE AFTER fecha_pago;

-- Verificar que se agregó correctamente
DESCRIBE expedientes;

-- Copiar valores de fecha_pago a fecha_vencimiento_pago para expedientes existentes (opcional)
-- UPDATE expedientes 
-- SET fecha_vencimiento_pago = fecha_pago 
-- WHERE fecha_pago IS NOT NULL;

SELECT 'Campo fecha_vencimiento_pago agregado exitosamente' AS resultado;

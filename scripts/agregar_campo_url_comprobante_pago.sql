-- Agregar campo para almacenar la URL del comprobante de pago en la tabla expedientes
-- Este campo guarda la referencia al archivo de comprobante cuando se aplica un pago

ALTER TABLE expedientes 
ADD COLUMN IF NOT EXISTS url_comprobante_pago VARCHAR(500);

-- Agregar comentario al campo
COMMENT ON COLUMN expedientes.url_comprobante_pago IS 'URL del comprobante de pago subido al aplicar un pago';

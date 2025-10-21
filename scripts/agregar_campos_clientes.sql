-- Script para agregar campos faltantes a la tabla clientes
-- Fecha: 2025-10-20
-- Descripción: Agrega los campos 'codigo' y 'categoria_id' a la tabla clientes

-- 1. Agregar columna 'codigo' para identificación visual del cliente
-- Se genera automáticamente con trigger o en el backend
ALTER TABLE clientes 
ADD COLUMN codigo VARCHAR(20) UNIQUE AFTER id;

-- 2. Agregar columna 'categoria_id' para relacionar con la tabla de categorías
ALTER TABLE clientes 
ADD COLUMN categoria_id INT NULL AFTER codigo;

-- 3. Crear el índice para categoria_id
ALTER TABLE clientes 
ADD INDEX idx_categoria_id (categoria_id);

-- 4. Agregar la llave foránea (foreign key) para integridad referencial
-- NOTA: Asegúrate de que la tabla 'categorias_clientes' exista
-- Si el nombre de la tabla es diferente, ajusta el nombre aquí
ALTER TABLE clientes 
ADD CONSTRAINT fk_clientes_categoria 
FOREIGN KEY (categoria_id) REFERENCES categorias_clientes(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 5. Opcional: Actualizar registros existentes con una categoría por defecto
-- Asumiendo que el ID 1 es "Normal" o la categoría por defecto
UPDATE clientes 
SET categoria_id = 1 
WHERE categoria_id IS NULL;

-- 6. Opcional: Generar códigos para clientes existentes
-- Esto genera códigos como CL001, CL002, etc.
UPDATE clientes 
SET codigo = CONCAT('CL', LPAD(id, 3, '0')) 
WHERE codigo IS NULL;

-- Verificar los cambios
SHOW COLUMNS FROM clientes;

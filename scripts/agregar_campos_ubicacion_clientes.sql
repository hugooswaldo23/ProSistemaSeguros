-- Script para agregar campos de ubicación a la tabla clientes
-- Ejecutar este script en la base de datos

-- OPCIÓN 1: Si ya tienes el campo 'ciudad', renombrarlo a 'municipio'
ALTER TABLE clientes 
CHANGE COLUMN ciudad municipio VARCHAR(100);

-- OPCIÓN 2: Si NO tienes el campo 'ciudad', agregar 'municipio' directamente
-- ALTER TABLE clientes 
-- ADD COLUMN municipio VARCHAR(100) AFTER direccion;

-- Agregar columna colonia (después de municipio)
ALTER TABLE clientes 
ADD COLUMN colonia VARCHAR(100) AFTER municipio;

-- Verificar que se agregaron correctamente
DESCRIBE clientes;

-- Para ver los datos actuales
SELECT id, codigo, direccion, municipio, colonia, estado, codigoPostal 
FROM clientes 
LIMIT 5;

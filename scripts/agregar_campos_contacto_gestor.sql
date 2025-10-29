-- Agregar campos de contacto/gestor para Persona Física
-- Esto permite que una Persona Física también tenga un contacto/gestor diferente

-- IMPORTANTE: Para Persona Moral, los campos nombre/apellidos/email/teléfonos 
-- ya existentes son DEL CONTACTO, no de la empresa

-- Para Persona Física, agregamos campos específicos de contacto/gestor
ALTER TABLE clientes 
ADD COLUMN contacto_nombre VARCHAR(100) NULL COMMENT 'Nombre del contacto/gestor (solo Persona Física)' AFTER emailRepresentante,
ADD COLUMN contacto_apellido_paterno VARCHAR(100) NULL COMMENT 'Apellido paterno del contacto/gestor (solo Persona Física)' AFTER contacto_nombre,
ADD COLUMN contacto_apellido_materno VARCHAR(100) NULL COMMENT 'Apellido materno del contacto/gestor (solo Persona Física)' AFTER contacto_apellido_paterno,
ADD COLUMN contacto_email VARCHAR(100) NULL COMMENT 'Email del contacto/gestor (solo Persona Física)' AFTER contacto_apellido_materno,
ADD COLUMN contacto_telefono_fijo VARCHAR(20) NULL COMMENT 'Teléfono fijo del contacto/gestor (solo Persona Física)' AFTER contacto_email,
ADD COLUMN contacto_telefono_movil VARCHAR(20) NULL COMMENT 'Teléfono móvil del contacto/gestor (solo Persona Física)' AFTER contacto_telefono_fijo,
ADD COLUMN contacto_puesto VARCHAR(100) NULL COMMENT 'Puesto del contacto/gestor (solo Persona Física)' AFTER contacto_telefono_movil;

-- ACLARACIÓN DE LA LÓGICA:
-- 
-- PERSONA FÍSICA:
--   - nombre, apellidoPaterno, apellidoMaterno, rfc, email, telefonoFijo, telefonoMovil = DATOS DEL CLIENTE
--   - contacto_nombre, contacto_apellido_paterno, contacto_apellido_materno, contacto_email, 
--     contacto_telefono_fijo, contacto_telefono_movil = DATOS DEL GESTOR/CONTACTO (opcional)
--   - Ejemplo: Álvaro González es el cliente, Estefanía Esteban es quien gestiona sus pólizas
--
-- PERSONA MORAL:
--   - razonSocial, nombreComercial, rfc = DATOS DE LA EMPRESA
--   - nombre, apellidoPaterno, apellidoMaterno, email, telefonoFijo, telefonoMovil = DATOS DEL CONTACTO
--   - Ejemplo: Coca-Cola es la empresa, Pato Sánchez es el contacto con quien hablas
--   - Los campos contacto_* NO SE USAN para Persona Moral

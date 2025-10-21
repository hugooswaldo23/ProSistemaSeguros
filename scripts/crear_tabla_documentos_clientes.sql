-- Script para crear tabla de documentos de clientes
-- Fecha: 2025-10-20
-- Descripción: Crea la tabla documentos_clientes para almacenar documentos relacionados con los clientes

-- 1. Crear la tabla documentos_clientes
CREATE TABLE IF NOT EXISTS documentos_clientes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  tipo VARCHAR(100) NOT NULL COMMENT 'Tipo de documento (INE, RFC, etc.)',
  nombre VARCHAR(255) NOT NULL COMMENT 'Nombre del archivo',
  ruta_archivo VARCHAR(500) NOT NULL COMMENT 'Ruta donde se guardó el archivo en el servidor',
  extension VARCHAR(10) NULL COMMENT 'Extensión del archivo (pdf, jpg, etc.)',
  fecha_subida DATE NOT NULL COMMENT 'Fecha en que se subió el documento',
  estado ENUM('Vigente', 'Vencido', 'Por renovar') DEFAULT 'Vigente',
  tipo_archivo VARCHAR(50) NULL COMMENT 'MIME type del archivo (application/pdf, image/jpeg, etc.)',
  tamaño VARCHAR(20) NULL COMMENT 'Tamaño del archivo (ej: 2.5 MB)',
  notas TEXT NULL COMMENT 'Notas adicionales sobre el documento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_cliente_id (cliente_id),
  INDEX idx_tipo (tipo),
  INDEX idx_estado (estado),
  INDEX idx_fecha_subida (fecha_subida),
  
  -- Foreign key
  CONSTRAINT fk_documentos_cliente 
    FOREIGN KEY (cliente_id) 
    REFERENCES clientes(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Documentos asociados a clientes';

-- 2. Verificar que se creó correctamente
SHOW COLUMNS FROM documentos_clientes;

-- 3. Verificar los índices
SHOW INDEX FROM documentos_clientes;

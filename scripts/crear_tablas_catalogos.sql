-- ============================================================================
-- Script para crear tablas de catálogos del sistema
-- Fecha: 2025-01-20
-- Descripción: Crea las tablas para tipos de documentos, canales de venta,
--              categorías de clientes y tipos de trámites
-- ============================================================================

-- ============================================================================
-- 1. TABLA: tipos_documentos
-- Descripción: Catálogo de tipos de documentos para personas físicas y morales
-- ============================================================================
CREATE TABLE IF NOT EXISTS tipos_documentos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL COMMENT 'Código único del documento (ej: DOC_PF_001)',
    nombre VARCHAR(255) NOT NULL COMMENT 'Nombre del documento',
    tipo_persona ENUM('Persona Física', 'Persona Moral') NOT NULL COMMENT 'A quién aplica el documento',
    obligatorio BOOLEAN DEFAULT FALSE COMMENT 'Si es obligatorio para el tipo de persona',
    vigencia_dias INT DEFAULT 0 COMMENT 'Días de vigencia del documento (0 = sin vencimiento)',
    orden INT DEFAULT 1 COMMENT 'Orden de visualización',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Si está activo en el sistema',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tipo_persona (tipo_persona),
    INDEX idx_activo (activo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de documentos requeridos para clientes';

-- ============================================================================
-- 2. TABLA: canales_venta
-- Descripción: Catálogo de canales de venta u origen de clientes
-- ============================================================================
CREATE TABLE IF NOT EXISTS canales_venta (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL COMMENT 'Código único del canal (ej: CV_001)',
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre del canal',
    descripcion TEXT COMMENT 'Descripción del canal',
    icono VARCHAR(50) DEFAULT 'UserCheck' COMMENT 'Nombre del icono (Lucide React)',
    color VARCHAR(20) DEFAULT 'primary' COMMENT 'Color del badge (Bootstrap)',
    orden INT DEFAULT 1 COMMENT 'Orden de visualización',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Si está activo en el sistema',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Canales de venta u origen de clientes';

-- ============================================================================
-- 3. TABLA: categorias_clientes
-- Descripción: Catálogo de categorías o segmentación de clientes
-- NOTA: Esta tabla ya existe, pero aseguramos su estructura
-- ============================================================================
CREATE TABLE IF NOT EXISTS categorias_clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL COMMENT 'Código único de la categoría (ej: CAT_001)',
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre de la categoría',
    descripcion TEXT COMMENT 'Descripción de la categoría',
    color VARCHAR(20) DEFAULT 'secondary' COMMENT 'Color del badge (Bootstrap)',
    orden INT DEFAULT 1 COMMENT 'Orden de visualización',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Si está activa en el sistema',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Categorías de clientes';

-- ============================================================================
-- 4. TABLA: tipos_tramites
-- Descripción: Catálogo de tipos de trámites disponibles
-- ============================================================================
CREATE TABLE IF NOT EXISTS tipos_tramites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL COMMENT 'Código único del trámite (ej: TRAM_001)',
    nombre VARCHAR(255) NOT NULL COMMENT 'Nombre del trámite',
    descripcion TEXT COMMENT 'Descripción del trámite',
    tiempo_estimado INT DEFAULT 24 COMMENT 'Tiempo estimado en horas',
    requiere_documentos BOOLEAN DEFAULT TRUE COMMENT 'Si requiere documentos',
    documentos_requeridos JSON COMMENT 'Array de códigos de documentos requeridos',
    orden INT DEFAULT 1 COMMENT 'Orden de visualización',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Si está activo en el sistema',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tipos de trámites disponibles';

-- ============================================================================
-- INSERTAR DATOS INICIALES
-- ============================================================================

-- Datos para tipos_documentos - Persona Física
INSERT INTO tipos_documentos (codigo, nombre, tipo_persona, obligatorio, vigencia_dias, activo, orden) VALUES
('DOC_PF_001', 'Identificación Oficial (INE/Pasaporte)', 'Persona Física', TRUE, 0, TRUE, 1),
('DOC_PF_002', 'Comprobante de Domicilio', 'Persona Física', TRUE, 90, TRUE, 2),
('DOC_PF_003', 'CURP', 'Persona Física', FALSE, 0, TRUE, 3),
('DOC_PF_004', 'RFC', 'Persona Física', FALSE, 0, TRUE, 4),
('DOC_PF_005', 'Comprobante de Ingresos', 'Persona Física', FALSE, 30, TRUE, 5),
('DOC_PF_006', 'Estado de Cuenta Bancario', 'Persona Física', FALSE, 30, TRUE, 6);

-- Datos para tipos_documentos - Persona Moral
INSERT INTO tipos_documentos (codigo, nombre, tipo_persona, obligatorio, vigencia_dias, activo, orden) VALUES
('DOC_PM_001', 'Acta Constitutiva', 'Persona Moral', TRUE, 0, TRUE, 1),
('DOC_PM_002', 'Poder Notarial', 'Persona Moral', TRUE, 0, TRUE, 2),
('DOC_PM_003', 'Identificación del Representante Legal', 'Persona Moral', TRUE, 0, TRUE, 3),
('DOC_PM_004', 'Comprobante de Domicilio Fiscal', 'Persona Moral', TRUE, 90, TRUE, 4),
('DOC_PM_005', 'RFC de la Empresa', 'Persona Moral', TRUE, 0, TRUE, 5),
('DOC_PM_006', 'Constancia de Situación Fiscal', 'Persona Moral', FALSE, 30, TRUE, 6),
('DOC_PM_007', 'Estados Financieros', 'Persona Moral', FALSE, 365, TRUE, 7);

-- Datos para canales_venta
INSERT INTO canales_venta (codigo, nombre, descripcion, icono, color, activo, orden) VALUES
('CV_001', 'Directo', 'Cliente que llega directamente a la empresa', 'UserCheck', 'primary', TRUE, 1),
('CV_002', 'Recomendación', 'Cliente referido por otro cliente', 'Users', 'success', TRUE, 2),
('CV_003', 'Redes Sociales', 'Cliente captado por Facebook, Instagram, etc.', 'Share2', 'info', TRUE, 3),
('CV_004', 'Google Ads', 'Cliente por publicidad en Google', 'Globe', 'danger', TRUE, 4),
('CV_005', 'Llamada en Frío', 'Cliente contactado telefónicamente', 'Phone', 'warning', TRUE, 5),
('CV_006', 'Email Marketing', 'Cliente por campañas de correo', 'Mail', 'secondary', TRUE, 6),
('CV_007', 'Página Web', 'Cliente desde el sitio web', 'Globe', 'primary', TRUE, 7),
('CV_008', 'WhatsApp Business', 'Cliente por WhatsApp', 'MessageCircle', 'success', TRUE, 8);

-- Datos para categorias_clientes (solo si no existen)
INSERT IGNORE INTO categorias_clientes (codigo, nombre, descripcion, color, activo, orden) VALUES
('CAT_001', 'Normal', 'Cliente estándar', 'secondary', TRUE, 1),
('CAT_002', 'VIP', 'Cliente preferencial con alto valor', 'warning', TRUE, 2),
('CAT_003', 'Premium', 'Cliente con beneficios especiales', 'primary', TRUE, 3),
('CAT_004', 'Digital', 'Cliente que opera principalmente online', 'info', TRUE, 4),
('CAT_005', 'Corporativo', 'Grandes empresas', 'dark', TRUE, 5),
('CAT_006', 'Nuevo', 'Cliente recién registrado', 'success', TRUE, 6);

-- Datos para tipos_tramites
INSERT INTO tipos_tramites (codigo, nombre, descripcion, tiempo_estimado, requiere_documentos, documentos_requeridos, activo, orden) VALUES
('TRAM_001', 'MOVIMIENTO GENERAL EN PÓLIZA', 'Modificaciones generales en la póliza', 24, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_002'), TRUE, 1),
('TRAM_002', 'CANCELACIÓN', 'Cancelación de póliza o servicio', 48, TRUE, JSON_ARRAY('DOC_PF_001'), TRUE, 2),
('TRAM_003', 'ALTA DE ASEGURADO', 'Registro de nuevo asegurado', 24, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_002', 'DOC_PF_003'), TRUE, 3),
('TRAM_004', 'BAJA DE ASEGURADO', 'Eliminación de asegurado', 24, TRUE, JSON_ARRAY('DOC_PF_001'), TRUE, 4),
('TRAM_005', 'CORRECCIÓN DE SERIE', 'Corrección de número de serie', 12, FALSE, JSON_ARRAY(), TRUE, 5),
('TRAM_006', 'CORRECCIÓN DE PLACAS', 'Corrección de placas vehiculares', 12, FALSE, JSON_ARRAY(), TRUE, 6),
('TRAM_007', 'DEVOLUCIÓN DE PRIMAS', 'Reembolso de primas pagadas', 72, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_006'), TRUE, 7),
('TRAM_008', 'FACTURA FISCAL', 'Emisión de factura fiscal', 24, FALSE, JSON_ARRAY(), TRUE, 8),
('TRAM_009', 'ENDOSO DE INCREMENTO', 'Aumento en cobertura o suma asegurada', 48, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_005'), TRUE, 9),
('TRAM_010', 'ENDOSO DE DECREMENTO', 'Disminución en cobertura o suma asegurada', 48, TRUE, JSON_ARRAY('DOC_PF_001'), TRUE, 10),
('TRAM_011', 'ENDOSO ACLARATORIO', 'Aclaraciones en la póliza', 24, FALSE, JSON_ARRAY(), TRUE, 11),
('TRAM_012', 'APLICACIÓN DE PAGO', 'Registro de pago realizado', 12, TRUE, JSON_ARRAY('DOC_PF_006'), TRUE, 12),
('TRAM_013', 'ACLARACIÓN DE PAGO', 'Aclaración sobre pagos realizados', 24, TRUE, JSON_ARRAY('DOC_PF_006'), TRUE, 13),
('TRAM_014', 'CAMBIO DE AGENTE', 'Cambio de agente asignado', 48, TRUE, JSON_ARRAY('DOC_PF_001'), TRUE, 14),
('TRAM_015', 'RECONOCIMIENTO DE ANTIGÜEDAD', 'Reconocimiento de tiempo previo', 72, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_002'), TRUE, 15),
('TRAM_016', 'ENDOSO DE BENEFICIARIO PREFERENTE', 'Cambio de beneficiario preferente', 48, TRUE, JSON_ARRAY('DOC_PF_001'), TRUE, 16),
('TRAM_017', 'RENOVACIÓN', 'Renovación de póliza', 48, TRUE, JSON_ARRAY('DOC_PF_001', 'DOC_PF_002'), TRUE, 17),
('TRAM_018', 'COTIZACIÓN', 'Solicitud de cotización', 24, FALSE, JSON_ARRAY(), TRUE, 18);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 'Verificación de tablas creadas:' AS mensaje;
SELECT 'tipos_documentos' AS tabla, COUNT(*) AS registros FROM tipos_documentos;
SELECT 'canales_venta' AS tabla, COUNT(*) AS registros FROM canales_venta;
SELECT 'categorias_clientes' AS tabla, COUNT(*) AS registros FROM categorias_clientes;
SELECT 'tipos_tramites' AS tabla, COUNT(*) AS registros FROM tipos_tramites;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================

-- ============================================
-- Script: Crear tabla de notificaciones/historial de comunicaciones
-- Propósito: Registrar cada comunicación enviada al cliente (WhatsApp, Email, SMS)
-- Fecha: 2025-11-03
-- ============================================

CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expediente_id INT NOT NULL,
  cliente_id VARCHAR(50) NOT NULL,
  tipo_notificacion ENUM('whatsapp', 'email', 'sms') NOT NULL DEFAULT 'whatsapp',
  tipo_mensaje ENUM(
    'emision',           -- Póliza emitida/enviada
    'recordatorio_pago', -- Recordatorio de pago próximo
    'pago_vencido',      -- Aviso de pago vencido
    'pago_recibido',     -- Confirmación de pago
    'renovacion',        -- Aviso de renovación
    'cancelacion',       -- Notificación de cancelación
    'modificacion',      -- Cambios en la póliza (endoso)
    'otro'               -- Otros mensajes
  ) NOT NULL DEFAULT 'emision',
  
  -- Información del destinatario
  destinatario_nombre VARCHAR(255),
  destinatario_contacto VARCHAR(255) NOT NULL, -- Email o teléfono
  
  -- Contenido del mensaje
  asunto VARCHAR(500),
  mensaje TEXT NOT NULL,
  
  -- Estado de la póliza al momento del envío
  numero_poliza VARCHAR(100),
  compania VARCHAR(100),
  producto VARCHAR(100),
  estatus_pago VARCHAR(50),
  fecha_vencimiento_pago DATE,
  
  -- Metadata del envío
  enviado_por INT, -- ID del usuario que envió (equipo_trabajo.id)
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_envio ENUM('enviado', 'fallido', 'pendiente') DEFAULT 'enviado',
  
  -- URL del PDF compartido (si aplica)
  pdf_url TEXT,
  pdf_expiracion DATETIME,
  
  -- Notas adicionales
  notas TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para búsquedas rápidas
  INDEX idx_expediente (expediente_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_fecha_envio (fecha_envio),
  INDEX idx_tipo_notificacion (tipo_notificacion),
  INDEX idx_tipo_mensaje (tipo_mensaje),
  
  -- Relaciones
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (enviado_por) REFERENCES equipo_trabajo(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Comentarios sobre la tabla
-- ============================================
-- Esta tabla permite:
-- 1. Llevar un historial completo de comunicaciones con el cliente
-- 2. Auditar qué se le notificó y cuándo
-- 3. Demostrar que se notificó al cliente en tiempo y forma
-- 4. Analizar patrones de comunicación
-- 5. Generar reportes de seguimiento
-- ============================================

-- ====================================================================
-- TABLA: historial_expedientes
-- PROPÓSITO: Trazabilidad completa del ciclo de vida de expedientes
-- FECHA: 2025-11-10
-- ====================================================================

CREATE TABLE IF NOT EXISTS historial_expedientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Relaciones
  expediente_id VARCHAR(50) NOT NULL,
  cliente_id VARCHAR(50),
  
  -- Tipo de evento (qué pasó)
  tipo_evento VARCHAR(100) NOT NULL,
  -- Ejemplos:
  -- 'cotizacion_creada', 'cotizacion_enviada', 'cotizacion_autorizada',
  -- 'emision_iniciada', 'poliza_emitida', 'poliza_enviada_email', 
  -- 'poliza_enviada_whatsapp', 'pago_registrado', 'poliza_renovada',
  -- 'poliza_cancelada', 'endoso_aplicado', 'recordatorio_enviado'
  
  -- Cambio de etapa (si aplica)
  etapa_anterior VARCHAR(100),
  etapa_nueva VARCHAR(100),
  
  -- Usuario que realizó la acción
  usuario_id INT,
  usuario_nombre VARCHAR(255),
  
  -- Detalles del evento
  descripcion TEXT,
  datos_adicionales JSON,
  -- Ejemplos de datos_adicionales:
  -- {"motivo": "Cliente aprobó cotización", "monto": 15000}
  -- {"canal": "WhatsApp", "destinatario": "+52...", "mensaje_id": "..."}
  -- {"documento_id": 123, "tipo_documento": "poliza", "url": "https://..."}
  
  -- Información de contacto (si se envió algo)
  metodo_contacto VARCHAR(50), -- 'Email', 'WhatsApp', 'Teléfono', 'Presencial', 'Portal'
  destinatario_nombre VARCHAR(255),
  destinatario_contacto VARCHAR(255), -- email o teléfono
  
  -- Documentos relacionados
  documento_url VARCHAR(500),
  documento_tipo VARCHAR(100), -- 'cotizacion', 'poliza', 'endoso', 'comprobante_pago'
  
  -- Timestamps
  fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para búsquedas rápidas
  INDEX idx_expediente (expediente_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_tipo_evento (tipo_evento),
  INDEX idx_fecha (fecha_evento),
  INDEX idx_usuario (usuario_id),
  
  -- Foreign keys
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- COMENTARIOS DE USO
-- ====================================================================
-- 1. Cada vez que se crea/modifica/envía algo relacionado al expediente,
--    se debe registrar un evento en esta tabla.
--
-- 2. Los eventos se pueden agrupar por categorías:
--    - Ciclo de vida: cotizacion_creada, poliza_emitida, poliza_cancelada
--    - Comunicaciones: cotizacion_enviada, poliza_enviada, recordatorio_enviado
--    - Pagos: pago_registrado, pago_vencido
--    - Modificaciones: endoso_aplicado, datos_actualizados
--
-- 3. La columna `datos_adicionales` (JSON) permite almacenar información
--    específica de cada tipo de evento sin necesidad de agregar columnas.
--
-- 4. Este historial se puede mostrar como una línea de tiempo visual
--    en la interfaz del expediente.
-- ====================================================================

# ✅ Checklist: Sistema de Historial y Trazabilidad

**Fecha:** 2025-11-21  
**Estado:** Listo para probar

---

## 📊 Componentes Implementados

### Frontend ✅
- [x] **Servicio**: `historialExpedienteService.js`
  - 26 tipos de eventos definidos
  - Funciones helper: `registrarEvento`, `registrarCambioEtapa`, `registrarEnvioDocumento`
  - Obtener historial: `obtenerHistorialExpediente`, `obtenerHistorialCliente`
  
- [x] **Componente UI**: `TimelineExpediente.jsx`
  - Visualización de eventos con iconos y colores
  - Filtros por tipo de evento
  - Exportación a CSV
  
- [x] **Integración en Expedientes.jsx**:
  - ✅ Línea 6986: Crear expediente → `CAPTURA_MANUAL` o `CAPTURA_EXTRACTOR_PDF`
  - ✅ Línea 5800: WhatsApp → `registrarEnvioDocumento` con `POLIZA_ENVIADA_WHATSAPP`
  - ✅ Línea 5908: Email → `registrarEnvioDocumento` con `POLIZA_ENVIADA_EMAIL`
  - ✅ Línea 6171: Pago → `PAGO_REGISTRADO`
  - ✅ Línea 5564 y 6873: Cambio de etapa → `registrarCambioEtapa` (automático según etapa)
  - ✅ Línea 6884: Editar expediente → `DATOS_ACTUALIZADOS`

- [x] **Visualización**:
  - Timeline mostrado en modal de detalles (línea 4827)
  - Acordeón "Historial y Trazabilidad del Expediente"

### Base de Datos ✅
- [x] Script SQL: `scripts/crear_tabla_historial_expedientes.sql`
  - Tabla: `historial_expedientes`
  - Campos: expediente_id, cliente_id, tipo_evento, etapa_anterior, etapa_nueva, usuario_id, usuario_nombre, descripcion, datos_adicionales (JSON), metodo_contacto, destinatario_nombre, destinatario_contacto, documento_url, documento_tipo, fecha_evento
  - Índices: expediente_id, cliente_id, tipo_evento, fecha_evento, usuario_id
  - Foreign key: expediente_id → expedientes(id) ON DELETE CASCADE

---

## 🔧 Backend - Pendiente de Verificar

Hugo confirmó que implementó los endpoints. Verificar:

### Endpoints Requeridos

#### 1. POST `/api/historial-expedientes`
**Registrar nuevo evento**

```javascript
// Request Body
{
  "expediente_id": "EXP-2025-001",
  "cliente_id": "CLI-001",
  "tipo_evento": "poliza_enviada_whatsapp",
  "etapa_anterior": "Emitida",
  "etapa_nueva": "Enviada al Cliente",
  "usuario_id": 5,
  "usuario_nombre": "Juan Pérez",
  "descripcion": "Póliza enviada al cliente por WhatsApp",
  "datos_adicionales": {
    "numero_poliza": "12345",
    "compania": "Qualitas",
    "metodo_captura": "Extractor PDF"
  },
  "metodo_contacto": "WhatsApp",
  "destinatario_nombre": "María García",
  "destinatario_contacto": "+52 1 55 1234 5678",
  "documento_url": "https://s3.amazonaws.com/...",
  "documento_tipo": "poliza"
}

// Response 201
{
  "success": true,
  "data": {
    "id": 123,
    "expediente_id": "EXP-2025-001",
    "tipo_evento": "poliza_enviada_whatsapp",
    "fecha_evento": "2025-11-21T10:30:45Z"
  }
}
```

#### 2. GET `/api/historial-expedientes/expediente/:id`
**Obtener historial de un expediente**

```javascript
// Request
GET /api/historial-expedientes/expediente/EXP-2025-001

// Query params opcionales:
// - tipo: Filtrar por tipo_evento
// - desde: Fecha inicio (ISO 8601)
// - hasta: Fecha fin (ISO 8601)

// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": "EXP-2025-001",
      "cliente_id": "CLI-001",
      "tipo_evento": "captura_extractor_pdf",
      "etapa_nueva": "En cotización",
      "usuario_nombre": "Sistema",
      "descripcion": "Expediente creado mediante Extractor PDF - Archivo: Poliza.pdf",
      "datos_adicionales": {
        "numero_poliza": "12345",
        "compania": "Qualitas",
        "metodo_captura": "Extractor PDF"
      },
      "fecha_evento": "2025-11-21T09:15:00Z"
    },
    {
      "id": 2,
      "expediente_id": "EXP-2025-001",
      "tipo_evento": "poliza_enviada_whatsapp",
      "metodo_contacto": "WhatsApp",
      "destinatario_nombre": "María García",
      "destinatario_contacto": "+52 1 55 1234 5678",
      "descripcion": "Enviado a María García por WhatsApp (+52 1 55 1234 5678)",
      "fecha_evento": "2025-11-21T10:30:00Z"
    }
  ],
  "count": 2
}
```

#### 3. GET `/api/historial-expedientes/cliente/:id`
**Obtener historial de todos los expedientes de un cliente**

```javascript
// Request
GET /api/historial-expedientes/cliente/CLI-001

// Response 200
{
  "success": true,
  "data": [...], // Array de eventos de todos los expedientes del cliente
  "count": 15
}
```

---

## 🧪 Pruebas a Realizar

### 1. Crear Expediente
- [ ] **Captura Manual**: Crear expediente sin PDF
  - Verificar evento `captura_manual` en BD
  - Verificar descripción: "Expediente creado mediante Captura Manual"
  
- [ ] **Captura con PDF**: Usar extractor
  - Verificar evento `captura_extractor_pdf` en BD
  - Verificar `datos_adicionales.nombre_archivo_pdf`
  - Si hay modificaciones manuales post-extracción, verificar `datos_adicionales.modificaciones_manuales: true`

### 2. Enviar Póliza
- [ ] **WhatsApp**: Compartir por WhatsApp
  - Verificar evento `poliza_enviada_whatsapp`
  - Verificar `metodo_contacto: "WhatsApp"`
  - Verificar `destinatario_nombre` y `destinatario_contacto`
  - Verificar que NO se guarda el mensaje completo (solo metadata en `datos_adicionales`)
  
- [ ] **Email**: Compartir por Email
  - Verificar evento `poliza_enviada_email`
  - Verificar `metodo_contacto: "Email"`
  - Verificar destinatario

### 3. Registrar Pago
- [ ] Aplicar pago con comprobante
  - Verificar evento `pago_registrado`
  - Verificar `datos_adicionales.comprobante_nombre`
  - Verificar `datos_adicionales.siguiente_vencimiento`
  - Verificar `datos_adicionales.estatus_pago_nuevo`

### 4. Cambiar Etapa
- [ ] Cambiar etapa manualmente
  - Verificar evento según mapeo:
    - "En cotización" → `cotizacion_creada`
    - "Cotización enviada" → `cotizacion_enviada`
    - "Autorizado" → `cotizacion_autorizada`
    - "En proceso emisión" → `emision_iniciada`
    - "Emitida" → `poliza_emitida`
    - "Renovada" → `poliza_renovada`
    - "Cancelada" → `poliza_cancelada`
  - Verificar `etapa_anterior` y `etapa_nueva`

### 5. Editar Expediente
- [ ] Modificar datos del expediente
  - Verificar evento `datos_actualizados`
  - Verificar `descripcion` incluye campos modificados
  - Verificar que NO se registra si no hay cambios reales

### 6. Visualización del Timeline
- [ ] Abrir modal de detalles de expediente
  - Verificar acordeón "Historial y Trazabilidad del Expediente"
  - Verificar que se cargan los eventos
  - Verificar iconos y colores según tipo de evento
  - Verificar orden cronológico (más reciente primero)
  
- [ ] Filtrar eventos
  - Filtrar por tipo de evento
  - Verificar que funcionan los filtros
  
- [ ] Exportar a CSV
  - Verificar que se genera CSV con todos los campos

---

## 🐛 Problemas Conocidos

### Usuario Actual
- **TODO**: Reemplazar `'Sistema'` por usuario autenticado
- Actualmente usa `obtenerUsuarioActual()` que lee de `localStorage.usuarioActual`
- Formato esperado: `{ id: 5, nombre: "Juan Pérez" }`

### Mensajes en Historial
- ✅ **CORRECTO**: NO se guarda el mensaje completo de WhatsApp/Email
- Solo se guarda metadata esencial en `datos_adicionales`
- Descripción simplificada: "Enviado a [nombre] por [canal] ([contacto])"

---

## 📝 Notas Importantes

1. **Nunca eliminar eventos**: El historial es auditoría permanente
2. **Fechas en UTC**: Todas las fechas se guardan en ISO 8601
3. **JSON flexible**: `datos_adicionales` permite agregar campos sin modificar esquema
4. **Cascada**: Si se elimina expediente, su historial también se elimina (ON DELETE CASCADE)
5. **Performance**: Índices optimizados para consultas por expediente y fecha

---

## 🚀 Próximos Pasos

1. **Verificar Backend**: Confirmar que Hugo implementó los 3 endpoints
2. **Probar Flujo Completo**: Crear expediente → Enviar → Pagar → Ver historial
3. **Ajustar Usuario**: Implementar sistema de autenticación real
4. **Reportes**: Crear vistas de estadísticas basadas en el historial
5. **Notificaciones**: Integrar con sistema de notificaciones automáticas

---

**Estado Final**: ✅ Frontend completo, Backend pendiente de verificar endpoints

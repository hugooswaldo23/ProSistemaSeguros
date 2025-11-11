# 🔧 PENDIENTES PARA HUGO - Backend

**Fecha:** 11 de Noviembre, 2025  
**Prioridad:** 🔴 ALTA - BLOQUEADORES CRÍTICOS  
**Frontend:** 100% Completo y listo  
**Backend:** Requiere implementación

---

## 📋 RESUMEN EJECUTIVO

El frontend está **100% funcional** pero necesita que el backend implemente:

### 🚨 **PRIORIDAD 1 - BLOQUEADORES (Dashboard no funciona sin esto)**

1. ✅ **Campos de fechas en `expedientes`** → Agregar y poblar:
   - `fecha_emision` (DATE) - Fecha cuando se emitió la póliza
   - `fecha_pago` (DATE) - Fecha cuando se registró el pago
   - Sin estas fechas, el Dashboard no puede filtrar por mes

### 🔴 **PRIORIDAD 2 - FUNCIONALIDAD BLOQUEADA**

2. ❌ **Sistema de Notificaciones** → 3 endpoints + tabla
3. ❌ **Campos faltantes en `expedientes`** → `cliente_id` y `coberturas` no se guardan

---

## 🎯 TAREA 1: Agregar Campos de Fechas al Dashboard (CRÍTICO)

### **Problema:**
El Dashboard filtra pólizas por mes (noviembre vs octubre) pero **NO existen** los campos de fecha en la BD:
- `fecha_emision` → undefined
- `fecha_pago` → undefined

**Resultado:** Todas las pólizas se muestran en "mes actual" por defecto porque no hay fechas para filtrar.

### **Solución:**

#### 1. Agregar columnas a la tabla `expedientes`:

```sql
-- Agregar campos de fecha
ALTER TABLE expedientes 
ADD COLUMN fecha_emision DATE NULL COMMENT 'Fecha cuando se emitió la póliza',
ADD COLUMN fecha_pago DATE NULL COMMENT 'Fecha cuando se registró el pago del cliente';

-- Agregar índices para performance
CREATE INDEX idx_expedientes_fecha_emision ON expedientes(fecha_emision);
CREATE INDEX idx_expedientes_fecha_pago ON expedientes(fecha_pago);
```

#### 2. Poblar fechas para pólizas existentes:

**Opción A - Usar fecha de creación como referencia:**
```sql
-- Si tienen created_at, usarla como fecha_emision
UPDATE expedientes 
SET fecha_emision = DATE(created_at)
WHERE fecha_emision IS NULL 
  AND created_at IS NOT NULL;

-- Para las pagadas, usar la misma fecha como pago
UPDATE expedientes 
SET fecha_pago = DATE(created_at)
WHERE fecha_pago IS NULL 
  AND estatus_pago IN ('Pagado', 'Pagada')
  AND created_at IS NOT NULL;
```

**Opción B - Asignar fechas manualmente:**
```sql
-- Ejemplo: Asignar noviembre 2025 a pólizas recientes
UPDATE expedientes 
SET fecha_emision = '2025-11-01'
WHERE fecha_emision IS NULL 
  AND etapa_activa IN ('Emitida', 'Enviada al Cliente', 'Renovada');

-- Para las pagadas de noviembre
UPDATE expedientes 
SET fecha_pago = '2025-11-05'
WHERE fecha_pago IS NULL 
  AND estatus_pago = 'Pagado'
  AND etapa_activa = 'Enviada al Cliente';
```

**Opción C - Usar fecha_vencimiento_pago como referencia:**
```sql
-- Si tienen fecha de vencimiento, restar 30 días = emisión
UPDATE expedientes 
SET fecha_emision = DATE_SUB(fecha_vencimiento_pago, INTERVAL 30 DAY)
WHERE fecha_emision IS NULL 
  AND fecha_vencimiento_pago IS NOT NULL;
```

#### 3. Modificar endpoints para incluir fechas:

**POST `/api/expedientes`:**
```javascript
router.post('/api/expedientes', (req, res) => {
  const { 
    fecha_emision,  // ← AGREGAR
    fecha_pago,     // ← AGREGAR
    numero_poliza,
    // ... otros campos
  } = req.body;
  
  const query = `
    INSERT INTO expedientes 
    (fecha_emision, fecha_pago, numero_poliza, ...) 
    VALUES (?, ?, ?, ...)
  `;
  
  db.query(query, [fecha_emision, fecha_pago, numero_poliza, ...], ...);
});
```

**PUT `/api/expedientes/:id`:**
```javascript
router.put('/api/expedientes/:id', (req, res) => {
  const query = `
    UPDATE expedientes 
    SET fecha_emision = ?,
        fecha_pago = ?,
        numero_poliza = ?,
        ...
    WHERE id = ?
  `;
});
```

**GET `/api/expedientes`:**
```javascript
router.get('/api/expedientes', (req, res) => {
  const query = `
    SELECT 
      id,
      fecha_emision,  -- ← INCLUIR
      fecha_pago,     -- ← INCLUIR
      numero_poliza,
      ...
    FROM expedientes
  `;
});
```

#### 4. Verificar que funciona:

```sql
-- Ver fechas de todas las pólizas
SELECT 
  numero_poliza,
  etapa_activa,
  estatus_pago,
  fecha_emision,
  fecha_pago,
  fecha_vencimiento_pago
FROM expedientes
ORDER BY fecha_emision DESC;
```

**Resultado esperado:**
```
numero_poliza | etapa_activa      | estatus_pago | fecha_emision | fecha_pago | fecha_vencimiento_pago
0971452556    | Emitida           | Vencido      | 2025-11-01    | NULL       | 2025-10-15
0971451980    | Enviada al Cliente| Pagado       | 2025-11-03    | 2025-11-05 | 2025-11-20
```

### **Impacto en el Dashboard:**

Una vez implementado, el Dashboard mostrará correctamente:
- ✅ **Emitidas Mes Actual:** Pólizas con `fecha_emision` en noviembre 2025
- ✅ **Emitidas Mes Anterior:** Pólizas con `fecha_emision` en octubre 2025
- ✅ **Pagadas Mes Actual:** Pólizas con `fecha_pago` en noviembre 2025
- ✅ **Pagadas Mes Anterior:** Pólizas con `fecha_pago` en octubre 2025

---

## 🔴 TAREA 2: Sistema de Notificaciones

**Estado:** Frontend 100% implementado - Esperando backend

### **Archivos Listos:**
- ✅ Script SQL: `scripts/crear_tabla_notificaciones.sql`
- ✅ Servicio: `src/services/notificacionesService.js`
- ✅ Componente: `src/components/HistorialNotificaciones.jsx`
- ✅ Integración: `src/screens/Expedientes.jsx`

### **Lo que falta:**

#### 1. Ejecutar script SQL (una sola vez):

```bash
mysql -u usuario -p base_datos < scripts/crear_tabla_notificaciones.sql
```

#### 2. Implementar 3 endpoints:

**A) POST `/api/notificaciones` - Registrar notificación**

```javascript
router.post('/api/notificaciones', async (req, res) => {
  const {
    expediente_id,
    cliente_id,
    tipo_notificacion,  // 'whatsapp', 'email', 'sms'
    tipo_mensaje,       // 'emision', 'recordatorio_pago', etc.
    destinatario_nombre,
    destinatario_contacto,
    asunto,            // Solo para email
    mensaje,
    numero_poliza,
    compania,
    producto,
    estatus_pago,
    fecha_vencimiento_pago,
    pdf_url,
    pdf_expiracion,
    estado_envio       // 'enviado', 'fallido', 'pendiente'
  } = req.body;
  
  const query = `
    INSERT INTO notificaciones (
      expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
      destinatario_nombre, destinatario_contacto, asunto, mensaje,
      numero_poliza, compania, producto, estatus_pago,
      fecha_vencimiento_pago, pdf_url, pdf_expiracion, estado_envio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  try {
    const [result] = await db.query(query, [
      expediente_id, cliente_id, tipo_notificacion, tipo_mensaje,
      destinatario_nombre, destinatario_contacto, asunto, mensaje,
      numero_poliza, compania, producto, estatus_pago,
      fecha_vencimiento_pago, pdf_url, pdf_expiracion, estado_envio
    ]);
    
    res.json({
      success: true,
      message: 'Notificación registrada exitosamente',
      data: { id: result.insertId, ...req.body }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al registrar notificación',
      error: error.message
    });
  }
});
```

**Test:**
```bash
curl -X POST http://localhost:3000/api/notificaciones \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 142,
    "cliente_id": "CLI-00001",
    "tipo_notificacion": "whatsapp",
    "tipo_mensaje": "emision",
    "destinatario_nombre": "Juan Pérez",
    "destinatario_contacto": "5551234567",
    "mensaje": "Test de notificación",
    "numero_poliza": "POL-12345",
    "estado_envio": "enviado"
  }'
```

**B) GET `/api/notificaciones/expediente/:id` - Obtener por expediente**

```javascript
router.get('/api/notificaciones/expediente/:id', async (req, res) => {
  const query = `
    SELECT * FROM notificaciones
    WHERE expediente_id = ?
    ORDER BY fecha_envio DESC
  `;
  
  try {
    const [results] = await db.query(query, [req.params.id]);
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
});
```

**Test:**
```bash
curl http://localhost:3000/api/notificaciones/expediente/142
```

**C) GET `/api/notificaciones/cliente/:id` - Obtener por cliente**

```javascript
router.get('/api/notificaciones/cliente/:id', async (req, res) => {
  const query = `
    SELECT * FROM notificaciones
    WHERE cliente_id = ?
    ORDER BY fecha_envio DESC
  `;
  
  try {
    const [results] = await db.query(query, [req.params.id]);
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener notificaciones',
      error: error.message
    });
  }
});
```

**Test:**
```bash
curl http://localhost:3000/api/notificaciones/cliente/CLI-00001
```

### **Cómo Probar:**

1. Abrir el sistema → Expedientes → Click en una póliza
2. Sección "Historial de Comunicaciones con el Cliente" debe aparecer
3. Click botón "Compartir" → Seleccionar WhatsApp o Email
4. **Verificar en BD:** Se insertó registro en tabla `notificaciones`
5. **Verificar en frontend:** Aparece en el historial inmediatamente

---

## 🔴 TAREA 3: Campos Faltantes en Expedientes

### **Problema:**

Dos campos críticos **NO se guardan** en la BD:

#### A) `cliente_id` - Vinculación cliente-póliza

**Frontend ENVÍA:**
```json
{
  "cliente_id": "20b1810f-b451-11f0-9cad-0ab39348df91",
  "numero_poliza": "0971452556"
}
```

**Backend DEVUELVE:**
```json
{
  "id": 34,
  "cliente_id": null,  ← ❌ VIENE NULL
  "numero_poliza": "0971452556"
}
```

**Impacto:**
- ❌ Las pólizas no quedan vinculadas a sus clientes
- ❌ No se puede mostrar el nombre del cliente en listados
- ❌ Reportes por cliente no funcionan

**Solución:**

```sql
-- 1. Agregar columna
ALTER TABLE expedientes 
ADD COLUMN cliente_id VARCHAR(36) NULL;

-- 2. Agregar índice
CREATE INDEX idx_expedientes_cliente_id ON expedientes(cliente_id);

-- 3. Opcional: Foreign key
ALTER TABLE expedientes
ADD CONSTRAINT fk_expedientes_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id);
```

Luego modificar POST, PUT y GET para incluir `cliente_id`.

#### B) `coberturas` - Detalle de coberturas contratadas

**Frontend ENVÍA:**
```json
{
  "numero_poliza": "0971452556",
  "coberturas": "[{\"nombre\":\"Daños materiales\",\"suma_asegurada\":\"2046300.00\",\"deducible\":\"5%\",\"prima\":\"30035.59\"}]"
}
```

**Backend DEVUELVE:**
```json
{
  "id": 34,
  "numero_poliza": "0971452556"
  // ❌ NO devuelve "coberturas"
}
```

**Impacto:**
- ❌ Se pierde el detalle de coberturas
- ❌ No se puede mostrar qué está cubriendo la póliza
- ❌ Información crítica del negocio se pierde

**Solución:**

```sql
-- MySQL
ALTER TABLE expedientes 
ADD COLUMN coberturas TEXT NULL;

-- PostgreSQL (mejor con JSONB)
ALTER TABLE expedientes 
ADD COLUMN coberturas JSONB NULL;

CREATE INDEX idx_expedientes_coberturas_gin 
ON expedientes USING GIN (coberturas);
```

Luego modificar POST, PUT y GET para incluir `coberturas`.

**Ver documento completo:** `docs/BACKEND-CAMPOS-FALTANTES.md`

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Prioridad 1 - Dashboard (CRÍTICO)
- [ ] Agregar columna `expedientes.fecha_emision`
- [ ] Agregar columna `expedientes.fecha_pago`
- [ ] Agregar índices en ambas columnas
- [ ] Poblar fechas para pólizas existentes
- [ ] Modificar POST `/api/expedientes` para incluir fechas
- [ ] Modificar PUT `/api/expedientes/:id` para actualizar fechas
- [ ] Modificar GET `/api/expedientes` para devolver fechas
- [ ] Verificar que el Dashboard filtra correctamente por mes

### Prioridad 2 - Notificaciones
- [ ] Ejecutar script `scripts/crear_tabla_notificaciones.sql`
- [ ] Verificar que tabla existe: `SHOW TABLES LIKE 'notificaciones';`
- [ ] Implementar POST `/api/notificaciones`
- [ ] Implementar GET `/api/notificaciones/expediente/:id`
- [ ] Implementar GET `/api/notificaciones/cliente/:id`
- [ ] Probar con cURL/Postman cada endpoint
- [ ] Verificar que frontend carga historial sin errores
- [ ] Probar compartir póliza y verificar que se registra

### Prioridad 3 - Campos Faltantes
- [ ] Agregar columna `expedientes.cliente_id`
- [ ] Agregar columna `expedientes.coberturas`
- [ ] Modificar POST para guardar ambos campos
- [ ] Modificar PUT para actualizar ambos campos
- [ ] Modificar GET para devolver ambos campos
- [ ] Verificar que se guardan correctamente en BD
- [ ] Verificar que frontend recibe los datos

---

## 🧪 PLAN DE PRUEBAS

### Test 1: Fechas del Dashboard
```sql
-- Verificar que existen y tienen datos
SELECT 
  numero_poliza,
  fecha_emision,
  fecha_pago,
  estatus_pago
FROM expedientes
WHERE fecha_emision IS NOT NULL
ORDER BY fecha_emision DESC
LIMIT 5;
```

### Test 2: Endpoint Dashboard
```bash
# Llamar API y verificar que vienen fechas
curl http://localhost:3000/api/expedientes | jq '.[0] | {numero_poliza, fecha_emision, fecha_pago}'
```

### Test 3: Notificaciones - Insertar
```bash
curl -X POST http://localhost:3000/api/notificaciones \
  -H "Content-Type: application/json" \
  -d '{
    "expediente_id": 142,
    "tipo_notificacion": "whatsapp",
    "mensaje": "Test",
    "estado_envio": "enviado"
  }'
```

### Test 4: Notificaciones - Consultar
```bash
curl http://localhost:3000/api/notificaciones/expediente/142
```

### Test 5: Frontend Completo
1. Abrir Dashboard → Verificar que muestra montos correctos por mes
2. Abrir Expedientes → Click en póliza
3. Ver "Historial de Comunicaciones" → Debe cargar sin error
4. Click "Compartir" → Enviar por WhatsApp
5. Verificar que aparece en historial

---

## 📊 RESUMEN DE ESTADO

```
┌─────────────────────────────────────────────────────────┐
│                  PENDIENTES HUGO                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔴 PRIORIDAD 1 - DASHBOARD (CRÍTICO)                  │
│     ❌ Agregar fecha_emision a expedientes             │
│     ❌ Agregar fecha_pago a expedientes                │
│     ❌ Poblar fechas existentes                        │
│     ❌ Modificar endpoints GET/POST/PUT                │
│                                                         │
│  🔴 PRIORIDAD 2 - NOTIFICACIONES                       │
│     ❌ Ejecutar script SQL (tabla)                     │
│     ❌ POST /api/notificaciones                        │
│     ❌ GET /api/notificaciones/expediente/:id          │
│     ❌ GET /api/notificaciones/cliente/:id             │
│                                                         │
│  🟡 PRIORIDAD 3 - CAMPOS FALTANTES                     │
│     ❌ Agregar cliente_id a expedientes                │
│     ❌ Agregar coberturas a expedientes                │
│     ❌ Modificar endpoints para incluirlos             │
│                                                         │
└─────────────────────────────────────────────────────────┘

Frontend:  ████████████████████ 100% ✅ LISTO
Backend:   ░░░░░░░░░░░░░░░░░░░░   0% ❌ PENDIENTE
```

---

## 📞 DOCUMENTACIÓN ADICIONAL

Para más detalles técnicos ver:
- **Sistema de Notificaciones:** `docs/CHECKLIST-NOTIFICACIONES.md`
- **Campos Faltantes:** `docs/BACKEND-CAMPOS-FALTANTES.md`
- **Dashboard:** `docs/DASHBOARD-CONEXION-BD.md`
- **Scripts SQL:** Carpeta `/scripts/`

---

**Última actualización:** 11 de Noviembre, 2025  
**Generado por:** Frontend Team  
**Para:** Hugo (Backend Developer)

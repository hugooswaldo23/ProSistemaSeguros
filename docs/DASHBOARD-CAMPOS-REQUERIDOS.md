# Dashboard - Campos Requeridos en API

## 📋 Resumen
El Dashboard financiero requiere que el endpoint `GET /api/expedientes` devuelva los siguientes campos para calcular correctamente las estadísticas.

---

## 🔌 Endpoint Afectado

### GET `/api/expedientes`

**Campos CRÍTICOS que deben incluirse en el SELECT:**

```sql
SELECT 
  -- Identificación
  id,
  numero_poliza,
  cliente_id,
  
  -- Producto y compañía
  compania,
  producto,
  
  -- Estados
  etapa_activa,        -- 'Emitida', 'Renovada', 'Cancelada', etc.
  estatus_pago,        -- 'Pagado', 'Pendiente', 'Por Vencer', 'Vencido'
  
  -- Fechas CRÍTICAS para Dashboard
  fecha_emision,       -- ⚠️ OBLIGATORIO para "Primas Emitidas"
  fecha_pago,          -- ⚠️ OBLIGATORIO para "Primas Pagadas"
  fecha_vencimiento_pago,  -- ⚠️ OBLIGATORIO para "Por Vencer" y "Vencidas"
  proximo_pago,        -- Alternativa si no hay fecha_vencimiento_pago
  fecha_cancelacion,   -- Para filtrar canceladas del mes
  created_at,          -- Fecha de creación del registro
  
  -- Montos CRÍTICOS
  total,               -- Monto total de la póliza
  prima_pagada,        -- Alternativa 1 al total
  prima,               -- Alternativa 2 al total
  monto,               -- Alternativa 3 al total
  
  -- Otros campos usados
  periodo_gracia,      -- Días de gracia después del vencimiento
  tipo_pago,           -- 'Anual', 'Semestral', 'Mensual', etc.
  
FROM expedientes
ORDER BY fecha_emision DESC
```

---

## 📊 Uso de los Campos en Dashboard

### 1. **Primas Emitidas** (Tarjeta Azul)
```javascript
// Filtra pólizas donde:
// - etapa_activa IN ('Emitida', 'Renovada', 'Enviada al Cliente')
// - fecha_emision está en mes actual O mes anterior
// - etapa_activa !== 'Cancelada'

// ⚠️ Si fecha_emision es NULL → NO se cuenta
```

### 2. **Primas Pagadas** (Tarjeta Verde)
```javascript
// Filtra pólizas donde:
// - fecha_pago NO es NULL
// - fecha_pago está en mes actual O mes anterior
// - etapa_activa !== 'Cancelada'

// ⚠️ Si fecha_pago es NULL → NO se cuenta como pagada
```

### 3. **Por Vencer** (Tarjeta Amarilla)
```javascript
// Filtra pólizas donde:
// - (fecha_vencimiento_pago O proximo_pago) está en mes actual
// - Fecha >= HOY (aún no vencida)
// - etapa_activa !== 'Cancelada'

// ⚠️ Si ambas fechas son NULL → NO aparece
```

### 4. **Vencidas** (Tarjeta Roja)
```javascript
// Filtra pólizas donde:
// - (fecha_vencimiento_pago O proximo_pago) + periodo_gracia < HOY
// - etapa_activa !== 'Cancelada'

// periodo_gracia se suma a la fecha de vencimiento
// Si periodo_gracia es NULL → se considera 0
```

### 5. **Canceladas** (Tarjeta Gris)
```javascript
// Filtra pólizas donde:
// - etapa_activa === 'Cancelada'
// - fecha_cancelacion está en mes actual

// ⚠️ Si fecha_cancelacion es NULL → NO se cuenta en mes actual
```

---

## 🚨 Problemas Comunes

### ❌ Problema 1: Campos NULL
**Síntoma:** Dashboard muestra $0 o contadores en 0

**Causa:** Los campos fecha_emision, fecha_pago, o fecha_vencimiento_pago son NULL en la BD

**Solución:**
1. Verificar que el frontend esté enviando estas fechas en POST/PUT
2. Verificar que el backend esté guardando estos campos
3. En la migración, llenar valores por defecto:
```sql
UPDATE expedientes 
SET fecha_emision = COALESCE(fecha_emision, inicio_vigencia, DATE(created_at))
WHERE fecha_emision IS NULL;
```

---

### ❌ Problema 2: Campos no devueltos en GET
**Síntoma:** Console del navegador muestra campos undefined

**Causa:** El SELECT en GET /api/expedientes no incluye los campos

**Solución:**
```javascript
// Backend - Verificar que el SELECT incluya TODOS los campos listados arriba
router.get('/api/expedientes', (req, res) => {
  const query = `
    SELECT 
      id, numero_poliza, cliente_id, compania, producto,
      etapa_activa, estatus_pago,
      fecha_emision, fecha_pago, fecha_vencimiento_pago,  -- ← CRÍTICO
      total, prima_pagada, prima, monto,                   -- ← CRÍTICO
      proximo_pago, periodo_gracia, created_at
    FROM expedientes
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});
```

---

### ❌ Problema 3: Formato de fecha incorrecto
**Síntoma:** Fechas no se filtran correctamente por mes

**Causa:** Fechas vienen como string en formato incorrecto

**Solución:** Asegurar que las fechas se devuelvan en formato ISO:
```sql
-- En MySQL/MariaDB
DATE_FORMAT(fecha_emision, '%Y-%m-%d') as fecha_emision,
DATE_FORMAT(fecha_pago, '%Y-%m-%d') as fecha_pago
```

---

## ✅ Checklist de Verificación

- [ ] Tabla `expedientes` tiene columnas: `fecha_emision`, `fecha_pago`, `fecha_vencimiento_pago`
- [ ] GET `/api/expedientes` incluye estos campos en el SELECT
- [ ] POST `/api/expedientes` guarda estos campos cuando vienen en el body
- [ ] PUT `/api/expedientes/:id` actualiza estos campos
- [ ] Los campos numéricos (`total`, `prima`) se devuelven como números, no strings
- [ ] Las fechas se devuelven en formato YYYY-MM-DD o ISO 8601
- [ ] Existe al menos 1 póliza con `fecha_emision` del mes actual para probar

---

## 🧪 Prueba Manual

1. Abrir navegador en `http://localhost:5173`
2. Ir a Dashboard
3. Abrir Console (F12)
4. Buscar log: `📈 Calculando estadísticas con X expedientes`
5. Verificar que cada expediente tenga:
   - `fecha_emision`: "2025-11-12" (no null, no undefined)
   - `fecha_pago`: "2025-11-12" o null (según si está pagada)
   - `total`: número > 0

---

## 📝 Ejemplo de Respuesta Correcta

```json
[
  {
    "id": 195,
    "numero_poliza": "0971458956",
    "cliente_id": "CLI-00001",
    "compania": "Qualitas",
    "producto": "Autos Individual",
    "etapa_activa": "Emitida",
    "estatus_pago": "Pendiente",
    "fecha_emision": "2025-11-12",
    "fecha_pago": null,
    "fecha_vencimiento_pago": "2025-12-12",
    "total": 51229.08,
    "prima_pagada": 51229.08,
    "periodo_gracia": 15,
    "created_at": "2025-11-12T06:00:00.000Z"
  }
]
```

---

## 🎯 Prioridad

**CRÍTICO** - Sin estos campos, el Dashboard no funciona correctamente y mostrará datos incorrectos o vacíos.

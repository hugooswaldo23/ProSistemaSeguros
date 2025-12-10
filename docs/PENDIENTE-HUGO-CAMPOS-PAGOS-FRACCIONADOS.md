# PENDIENTE BACKEND - Campos de Pagos Fraccionados

## ⚠️ PROBLEMA ACTUAL

Cuando se consulta el endpoint `GET /api/expedientes`, los campos de montos de pagos fraccionados **NO están siendo retornados** en la respuesta, causando que el calendario de pagos muestre montos incorrectos.

### Campos Faltantes en la Respuesta del Endpoint

Los siguientes campos **existen en la base de datos** pero NO se están retornando en el GET de expedientes:

- `primer_pago` (DECIMAL)
- `pagos_subsecuentes` (DECIMAL)

## 🔍 EVIDENCIA

**Frontend esperado:**
```javascript
{
  id: 397,
  numero_poliza: "0005161150",
  primer_pago: 2033.19,        // ❌ Viene como undefined
  pagos_subsecuentes: 1290.81,  // ❌ Viene como undefined
  total: 5905.62,
  tipo_pago: "Fraccionado",
  frecuencia_pago: "Trimestral"
}
```

**Frontend recibido actualmente:**
```javascript
{
  id: 397,
  numero_poliza: "0005161150",
  primer_pago: undefined,       // ❌ NO viene del backend
  pagos_subsecuentes: undefined, // ❌ NO viene del backend
  total: 5905.62,
  tipo_pago: "Fraccionado",
  frecuencia_pago: "Trimestral"
}
```

**Efecto en UI:**
Como no vienen los campos, el calendario calcula: `$5905.62 / 4 = $1476.40` para todos los pagos, cuando debería mostrar:
- Pago #1: **$2,033.19**
- Pagos #2-4: **$1,290.81**

## ✅ SOLUCIÓN REQUERIDA

### Backend (Hugo)

**Archivo:** `backend/routes/expedientes.js` (o similar)

**Endpoint afectado:** `GET /api/expedientes`

**Cambio necesario:**

Agregar los campos `primer_pago` y `pagos_subsecuentes` al SELECT de la consulta:

```sql
SELECT 
  id,
  numero_poliza,
  -- ... otros campos existentes ...
  tipo_pago,
  frecuencia_pago,
  primer_pago,           -- ✅ AGREGAR ESTE CAMPO
  pagos_subsecuentes,    -- ✅ AGREGAR ESTE CAMPO
  total,
  -- ... resto de campos ...
FROM expedientes
```

**También verificar en:**
- `GET /api/expedientes/:id` - Debe retornar estos campos
- Cualquier otro endpoint que retorne datos de expedientes

## 📋 VALIDACIÓN

Después del cambio, verificar que la respuesta incluya:

```json
{
  "id": 397,
  "numero_poliza": "0005161150",
  "primer_pago": "2033.19",
  "pagos_subsecuentes": "1290.81",
  "total": "5905.62",
  "tipo_pago": "Fraccionado",
  "frecuencia_pago": "Trimestral"
}
```

## 📌 NOTAS IMPORTANTES

1. **Los campos YA existen en la base de datos** - Solo falta retornarlos en el SELECT
2. **El frontend ya está preparado** para recibir estos campos (acepta snake_case y camelCase)
3. **El guardado funciona correctamente** - Los valores se están almacenando bien en la BD
4. **Solo el GET tiene el problema** - No está retornando los campos en la consulta

## 🎯 PRIORIDAD

**ALTA** - El calendario de pagos fraccionados muestra información incorrecta hasta que esto se corrija.

---

**Fecha:** 4 de diciembre de 2025
**Reportado por:** Frontend Team
**Asignado a:** Hugo (Backend)

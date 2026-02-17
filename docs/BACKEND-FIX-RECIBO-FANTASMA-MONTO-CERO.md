# 🐛 BUG: Recibo Fantasma con Monto $0.00

**Fecha:** 16 de febrero de 2026  
**Prioridad:** Alta  
**Asignado a:** Hugo  

---

## 📋 Descripción del Problema

El backend está generando un **recibo extra con monto $0.00** en pólizas fraccionadas trimestrales.

Una póliza **Trimestral** debería tener **4 recibos** (12 meses ÷ 3 meses = 4), pero el backend está creando **5 recibos**, donde el #5 tiene monto $0.00.

---

## 🔍 Ejemplo: Póliza de OSCAR GREGORIO (Expediente 818)

```
GET /api/recibos/818

Recibo #1 | monto = $2,584.40 | fecha = 2026-02-05 | estatus = Pagado    ✅
Recibo #2 | monto = $1,743.40 | fecha = 2026-04-06 | estatus = Pendiente ✅
Recibo #3 | monto = $1,743.40 | fecha = 2026-07-06 | estatus = Pendiente ✅
Recibo #4 | monto = $1,743.40 | fecha = 2026-10-06 | estatus = Pendiente ✅
Recibo #5 | monto = $0.00     | fecha = 2027-01-06 | estatus = Pendiente ❌ FANTASMA
```

**Esperado:** Solo 4 recibos (Trimestral = 4 pagos al año)  
**Actual:** 5 recibos, el último con monto $0.00  

---

## 📊 Expedientes Afectados

Se encontraron **3 expedientes** con este problema:

| Expediente ID | Recibo Fantasma (DB id) | Número Recibo | Monto |
|---------------|------------------------|---------------|-------|
| 808           | id=1215                | #5            | $0.00 |
| 818           | id=1233                | #5            | $0.00 |
| 820           | id=1240                | #5            | $0.00 |

Los 3 son trimestrales con los mismos montos ($2,584.40 primer pago, $1,743.40 subsecuentes).

---

## 🔧 Qué Revisar en el Backend

### 1. Lógica de cálculo de número de recibos

El número de recibos debe calcularse así:

```javascript
const PAGOS_POR_FRECUENCIA = {
  'Mensual': 12,
  'Bimestral': 6,
  'Trimestral': 4,    // ← Debe ser 4, NO 5
  'Cuatrimestral': 3,
  'Semestral': 2
};

const numeroPagos = PAGOS_POR_FRECUENCIA[expediente.frecuencia_pago];
```

**Verificar que el `for` loop use `<=` correctamente:**

```javascript
// ✅ CORRECTO: genera exactamente numeroPagos recibos
for (let i = 1; i <= numeroPagos; i++) { ... }

// ❌ INCORRECTO: si numeroPagos ya incluye +1, genera uno de más
for (let i = 0; i <= numeroPagos; i++) { ... }  // Genera numeroPagos + 1
```

### 2. Posibles causas del bug

- El loop empieza en `i = 0` en vez de `i = 1` (genera N+1 recibos)
- Se usa `Trimestral: 5` en vez de `Trimestral: 4` en la tabla de frecuencias
- El monto del último recibo se calcula como `total - sumaPagosAnteriores` y si ya se cubrió el total, queda en $0
- Se está sumando un recibo adicional por alguna lógica de "recibo final" o "recibo de cierre"

### 3. Asignación de montos

Parece que la lógica de montos es:
- Recibo 1: `primer_pago` ($2,584.40)
- Recibos 2-4: `pagos_subsecuentes` ($1,743.40)
- Recibo 5: Lo que sobra = $0.00 ← **Este no debería existir**

Si se usa la fórmula `monto = total - sumaPagosAnteriores`, esta fórmula agrega recibos hasta cubrir el total. Cuando ya se cubrió, genera uno en $0.

---

## ✅ Acciones Requeridas

### Acción 1: Corregir la lógica de generación de recibos
Asegurar que para frecuencia Trimestral solo se generen **4 recibos**, no 5.

### Acción 2: Eliminar los recibos fantasma existentes

```sql
-- Eliminar los 3 recibos fantasma con monto $0.00
DELETE FROM recibos_pago WHERE id IN (1215, 1233, 1240);

-- Verificar que se eliminaron
SELECT * FROM recibos_pago WHERE monto = 0;
```

### Acción 3: Verificar que no haya más recibos en $0

```sql
-- Buscar TODOS los recibos con monto 0 en la BD
SELECT rp.id, rp.expediente_id, rp.numero_recibo, rp.monto, rp.fecha_vencimiento
FROM recibos_pago rp
WHERE rp.monto = 0 OR rp.monto IS NULL
ORDER BY rp.expediente_id, rp.numero_recibo;
```

---

## 🧪 Cómo Verificar que se Corrigió

Después de aplicar el fix, verificar con:

```bash
# Debe devolver exactamente 4 recibos para expediente trimestral
GET /api/recibos/818
# Esperado: 4 recibos, todos con monto > 0

# Verificar en la BD que no hay recibos en 0
SELECT COUNT(*) FROM recibos_pago WHERE monto = 0;
# Esperado: 0
```

---

## 💡 Impacto en el Frontend

En el frontend ya se aplicó un workaround temporal:
- Se calcula `totalRecibos` basado en la **frecuencia de pago** (no en `recibos.length`)
- Se filtran recibos con `monto > 0` como fallback

Pero el **fix real debe ser en el backend** para que no se generen recibos fantasma.

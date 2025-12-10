# 🔴 URGENTE: Backend debe devolver `estatus_pago` correctamente

## Problema Actual

El frontend está listo para leer el `estatus_pago` del backend, pero el campo no se está devolviendo correctamente en el endpoint `GET /api/expedientes`.

## Campos Requeridos en la Respuesta del Backend

El endpoint `GET /api/expedientes` DEBE devolver estos campos para cada expediente:

```json
{
  "id": "...",
  "numero_poliza": "...",
  "estatus_pago": "Vencido",  // ⚠️ ESTE CAMPO ES CRÍTICO
  "fecha_vencimiento_pago": "2025-11-14",
  "ultimo_recibo_pagado": 1,
  "tipo_pago": "Fraccionado",
  "frecuencia_pago": "Trimestral",
  // ... otros campos
}
```

## Valores Permitidos para `estatus_pago`

| Valor | Descripción | Cuándo usarlo |
|-------|-------------|---------------|
| `"Pagado"` | Póliza completamente pagada | `ultimo_recibo_pagado >= total_recibos` |
| `"Vencido"` | Pago vencido | `fecha_vencimiento_pago < CURDATE()` |
| `"Pago por vencer"` | Por vencer en ≤15 días | `DATEDIFF(fecha_vencimiento_pago, CURDATE()) <= 15` |
| `"Pendiente"` | Pago futuro (>15 días) | `DATEDIFF(fecha_vencimiento_pago, CURDATE()) > 15` |
| `"Cancelado"` | Póliza cancelada | `etapa_activa = "Cancelada"` |

## Lugares donde el Backend DEBE Calcular y Guardar `estatus_pago`

### 1️⃣ Al capturar/crear una póliza nueva
**Endpoint:** `POST /api/expedientes`

```sql
-- Calcular estatus_pago al insertar
INSERT INTO expedientes (..., estatus_pago, fecha_vencimiento_pago)
VALUES (..., 
  CASE 
    WHEN DATEDIFF(fecha_vencimiento_pago, CURDATE()) < 0 THEN 'Vencido'
    WHEN DATEDIFF(fecha_vencimiento_pago, CURDATE()) <= 15 THEN 'Pago por vencer'
    ELSE 'Pendiente'
  END,
  fecha_calculada_primer_pago
);
```

### 2️⃣ Al aplicar un pago
**Endpoint:** `PUT /api/expedientes/:id`

Cuando el frontend envía:
```json
{
  "estatus_pago": "Vencido",
  "fecha_vencimiento_pago": "2025-11-14",
  "ultimo_recibo_pagado": 2
}
```

El backend DEBE:
- ✅ Guardar exactamente esos valores en la BD
- ✅ NO sobre-escribir o recalcular el `estatus_pago`
- ✅ Devolver una respuesta 200 OK

### 3️⃣ Cron Job nocturno (recomendado)
**Frecuencia:** Ejecutar diariamente a las 00:00

```sql
-- Actualizar estatus de todas las pólizas activas
UPDATE expedientes
SET estatus_pago = CASE 
  WHEN ultimo_recibo_pagado >= total_recibos THEN 'Pagado'
  WHEN DATEDIFF(fecha_vencimiento_pago, CURDATE()) < 0 THEN 'Vencido'
  WHEN DATEDIFF(fecha_vencimiento_pago, CURDATE()) <= 15 THEN 'Pago por vencer'
  ELSE 'Pendiente'
END
WHERE etapa_activa IN ('Emitida', 'En Vigencia', 'En Proceso')
  AND estatus_pago != 'Cancelado';
```

## Verificación

Para verificar que está funcionando correctamente:

1. **Crear una póliza nueva** y verificar que tenga `estatus_pago`
2. **Aplicar un pago** y verificar que el `estatus_pago` se actualice
3. **Consultar `GET /api/expedientes`** y verificar que el campo venga en la respuesta

### Query de prueba:
```sql
SELECT 
  numero_poliza,
  estatus_pago,
  fecha_vencimiento_pago,
  ultimo_recibo_pagado,
  DATEDIFF(fecha_vencimiento_pago, CURDATE()) as dias_restantes
FROM expedientes
WHERE numero_poliza = '0005161150';
```

Resultado esperado:
```
numero_poliza | estatus_pago | fecha_vencimiento_pago | ultimo_recibo_pagado | dias_restantes
0005161150    | Vencido      | 2025-11-14             | 1                    | -26
```

## Frontend Actual

El frontend ya está preparado y NO calcula nada. Solo lee `estatus_pago` del backend:

```javascript
const estatusBackend = expediente.estatus_pago || expediente.estatusPago;
```

Si el campo viene vacío o NULL, mostrará "Sin definir" y registrará una advertencia en consola.

## Prioridad

🔴 **CRÍTICO** - Sin este campo, el sistema no puede mostrar correctamente el estado de pagos de las pólizas.

---

**Fecha:** 10 de diciembre de 2025
**Solicitado por:** Alvaro (Frontend)
**Para:** Hugo (Backend)

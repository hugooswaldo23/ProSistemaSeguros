# Contrato API Expedientes (Canónico)

Objetivo: Unificar nombres de campos entre Frontend y Backend para evitar parches/aliases.

## Nombres canónicos (snake_case)

Campos relevantes al caso:
- uso: string (50)
- servicio: string (50)
- movimiento: string (50)
- cargo_pago_fraccionado: decimal(12,2)
- gastos_expedicion: decimal(12,2)
- subtotal: decimal(12,2)

Otros relacionados (ya presentes):
- prima_pagada, iva, total, inicio_vigencia, termino_vigencia, fecha_emision, fecha_pago, fecha_vencimiento_pago

## POST /api/expedientes

Debe aceptar en body:
```json
{
  "uso": "NORMAL",
  "servicio": "PARTICULAR",
  "movimiento": "ALTA",
  "cargo_pago_fraccionado": -934.97,
  "gastos_expedicion": 640.00,
  "subtotal": 44163.00,
  "...otros_campos"
}
```

SQL sugerido:
```sql
INSERT INTO expedientes (
  ..., uso, servicio, movimiento, cargo_pago_fraccionado, gastos_expedicion, subtotal
) VALUES (
  ..., ?, ?, ?, ?, ?, ?
);
```

## PUT /api/expedientes/:id
Debe actualizar esos mismos campos.

## GET /api/expedientes y GET /api/expedientes/:id
Debe incluir esos mismos campos en el SELECT.

```sql
SELECT id, ..., uso, servicio, movimiento, cargo_pago_fraccionado, gastos_expedicion, subtotal
FROM expedientes
WHERE id = ?;
```

## Migración de BD
Ejecutar el script: `scripts/agregar_campos_expedientes_usos_y_montos.sql`.

## Plan de limpieza en Frontend
Una vez desplegado el backend con este contrato:
1) Eliminar el envío/lectura de aliases (`*_poliza`, `cargoPagoFraccionado`, `tasa_financiamiento`, `sub_total`, etc.).
2) Mantener solo snake_case en `formulario` y payload.
3) Retirar logs de depuración agregados para la verificación.

## Criterios de aceptación
- Crear póliza con valores en esos 6 campos → Respuesta del POST los devuelve con el mismo valor.
- Abrir esa póliza en edición → Los 6 campos llegan poblados sin depender de aliases.
- No hay `undefined`/`0` inesperados para esos campos en el GET.

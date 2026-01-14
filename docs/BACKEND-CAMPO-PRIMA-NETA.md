# Backend: Agregar Campo `prima_neta` a Tabla Expedientes

## Problema

El frontend captura y envía el campo `prima_neta` pero el backend no lo guarda ni lo devuelve.

## Aclaración Importante

El campo puede llamarse **"prima"** o **"prima_neta"** dependiendo de la aseguradora:
- Qualitas, HDI → usan "Prima Neta"
- Otras aseguradoras → pueden usar solo "Prima"

**Recomendación**: Usar un solo campo `prima_neta` en BD y el frontend manejará ambos nombres.

## Solución Requerida

### 1. Agregar columna a la tabla `expedientes`:

```sql
ALTER TABLE expedientes 
ADD COLUMN prima_neta DECIMAL(12,2) DEFAULT NULL;
```

### 2. Actualizar endpoint POST `/api/expedientes`

Agregar `prima_neta` a los campos que se insertan:

```javascript
// En el INSERT
const campos = [
  // ... campos existentes ...
  'prima_neta'  // ← AGREGAR
];
```

### 3. Actualizar endpoint PUT `/api/expedientes/:id`

Agregar `prima_neta` a los campos que se actualizan:

```javascript
// En el UPDATE
if (body.prima_neta !== undefined) {
  updates.push('prima_neta = ?');
  values.push(body.prima_neta);
}
```

### 4. Actualizar endpoint GET `/api/expedientes`

Asegurar que `prima_neta` se incluya en el SELECT.

## Contexto

El campo `prima_neta` es la prima base antes de:
- Recargo por pago fraccionado
- Gastos de expedición
- IVA

Fórmula aproximada:
```
total = prima_neta + cargo_pago_fraccionado + gastos_expedicion + iva
```

## Prioridad

Media - Se requiere para mostrar desglose correcto en Dashboard.

## Frontend Ya Listo

El frontend ya envía `prima_neta` en el body de POST/PUT. Solo falta que el backend lo guarde.

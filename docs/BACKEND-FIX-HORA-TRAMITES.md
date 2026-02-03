# Backend: Fix para guardar hora en fechas de trámites

## Fecha: 2 de febrero de 2026

## Problema

El endpoint de trámites **no está guardando la hora** en los campos `fecha_inicio` y `fecha_limite`. 

### Evidencia:
- **Frontend envía:** `2026-02-01T23:58` (con hora)
- **Backend guarda/devuelve:** `2026-02-01T06:00:00.000Z` (medianoche UTC = 00:00 hora México)

## Causa probable

El código del backend está parseando las fechas y descartando la hora, posiblemente usando:
- `DATE()` en lugar de mantener el DATETIME completo
- `.split('T')[0]` o similar que corta la hora
- Un ORM que convierte a DATE en lugar de DATETIME

## Solución requerida

Revisar el código de los endpoints:
- `POST /api/tramites` 
- `PUT /api/tramites/:id`

Asegurarse de que los campos `fecha_inicio` y `fecha_limite` se guarden como DATETIME completo.

### Ejemplo de lo que NO hacer:
```javascript
// ❌ INCORRECTO - Esto descarta la hora
fecha_inicio: req.body.fecha_inicio.split('T')[0]

// ❌ INCORRECTO - Esto también descarta la hora
fecha_inicio: new Date(req.body.fecha_inicio).toISOString().split('T')[0]
```

### Ejemplo de lo que SÍ hacer:
```javascript
// ✅ CORRECTO - Mantener el valor completo
fecha_inicio: req.body.fecha_inicio

// ✅ CORRECTO - O convertir a formato MySQL DATETIME
fecha_inicio: new Date(req.body.fecha_inicio).toISOString().slice(0, 19).replace('T', ' ')
// Resultado: "2026-02-01 23:58:00"
```

## Verificación

Después del fix, crear un trámite y verificar que la API devuelva la hora correcta:

```bash
curl https://apiseguros.proordersistem.com.mx/api/tramites?limit=1
```

Debería mostrar algo como:
```json
{
  "fecha_inicio": "2026-02-02T05:58:00.000Z"  // 23:58 hora México = 05:58 UTC
}
```

**NO** debería mostrar:
```json
{
  "fecha_inicio": "2026-02-02T06:00:00.000Z"  // Esto indica 00:00 hora México (medianoche)
}
```

## Notas

- La tabla `tramites` ya tiene los campos como DATETIME (fix aplicado anteriormente)
- El frontend ya envía las fechas con hora correctamente
- Solo falta que el backend guarde el valor completo

## Estado

- [ ] Pendiente de aplicar en backend

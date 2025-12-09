# 🔥 URGENTE - Implementación Campo `ultimo_recibo_pagado`

## 📋 Resumen Ejecutivo

Se requiere agregar el campo `ultimo_recibo_pagado` a la tabla `expedientes` para corregir un error crítico en el tracking de pagos fraccionados.

### Problema Actual
- Cuando se paga el recibo #1, el sistema marca incorrectamente los recibos #1 y #2 como pagados
- La causa: usar `fecha_ultimo_pago` (fecha real del pago) para calcular cuántos recibos se han pagado
- Si el pago se hace tarde, el cálculo por meses da números incorrectos

### Solución
- Agregar campo `ultimo_recibo_pagado` INT para trackear directamente el número del último recibo pagado
- El frontend ya está actualizado y solo espera este campo en la base de datos

---

## 🗄️ Cambios en Base de Datos

### 1. Agregar Campo a Tabla `expedientes`

```sql
ALTER TABLE expedientes 
ADD COLUMN ultimo_recibo_pagado INT DEFAULT 0 
COMMENT 'Número del último recibo pagado en pólizas fraccionadas (0 = ninguno pagado)';
```

**Detalles:**
- **Tipo:** `INT`
- **Default:** `0` (ningún recibo pagado aún)
- **Null:** NO (siempre debe tener valor)
- **Índice:** No requerido por ahora, considerar si hay problemas de performance

---

## 🔄 Endpoints del Backend a Actualizar

### 1. GET `/api/expedientes` y `/api/expedientes/:id`

**Cambio:** Incluir el campo `ultimo_recibo_pagado` en la respuesta

```javascript
// Ejemplo de respuesta actual
{
  "id": "POL-2025-001",
  "tipo_pago": "Fraccionado",
  "frecuenciaPago": "Mensual",
  "fecha_ultimo_pago": "2025-01-15",
  // ✅ AGREGAR:
  "ultimo_recibo_pagado": 1  // Nuevo campo
}
```

### 2. PUT `/api/expedientes/:id` (Actualización de Pagos)

**Cambio:** Aceptar y guardar el campo `ultimo_recibo_pagado` cuando el frontend lo envíe

El frontend envía este objeto cuando se procesa un pago:

```javascript
{
  "estatus_pago": "Pagado",
  "fecha_vencimiento_pago": "2025-02-15",
  "fecha_ultimo_pago": "2025-01-20",  // Fecha real del pago
  "proximo_pago": "2025-02-15",
  "ultimo_recibo_pagado": 1  // ✅ NUEVO: Número del recibo que se acaba de pagar
}
```

**Validaciones recomendadas:**
- Si `tipo_pago === 'Fraccionado'`, validar que `ultimo_recibo_pagado` sea un número entre 0 y el total de pagos
- Si `tipo_pago === 'Anual'`, el campo puede ser NULL o 0

---

## 📊 Migración de Datos Existentes (Opcional pero Recomendado)

Para pólizas que ya tienen pagos registrados, calcular el valor correcto de `ultimo_recibo_pagado`:

```sql
-- Script de migración para pólizas fraccionadas con pagos
UPDATE expedientes e
SET ultimo_recibo_pagado = (
  SELECT CASE 
    WHEN e.fecha_ultimo_pago IS NULL THEN 0
    WHEN e.frecuenciaPago = 'Mensual' THEN 
      LEAST(
        FLOOR(
          (YEAR(e.fecha_ultimo_pago) - YEAR(e.inicio_vigencia)) * 12 + 
          (MONTH(e.fecha_ultimo_pago) - MONTH(e.inicio_vigencia))
        ) + 1,
        12  -- Máximo pagos para mensual
      )
    WHEN e.frecuenciaPago = 'Trimestral' THEN 
      LEAST(
        FLOOR(
          ((YEAR(e.fecha_ultimo_pago) - YEAR(e.inicio_vigencia)) * 12 + 
           (MONTH(e.fecha_ultimo_pago) - MONTH(e.inicio_vigencia))) / 3
        ) + 1,
        4  -- Máximo pagos para trimestral
      )
    WHEN e.frecuenciaPago = 'Semestral' THEN 
      LEAST(
        FLOOR(
          ((YEAR(e.fecha_ultimo_pago) - YEAR(e.inicio_vigencia)) * 12 + 
           (MONTH(e.fecha_ultimo_pago) - MONTH(e.inicio_vigencia))) / 6
        ) + 1,
        2  -- Máximo pagos para semestral
      )
    ELSE 0
  END
)
WHERE tipo_pago = 'Fraccionado' 
  AND fecha_ultimo_pago IS NOT NULL;
```

**⚠️ IMPORTANTE:** Ejecutar este script **DESPUÉS** de agregar el campo pero **ANTES** de poner en producción los cambios del frontend.

---

## ✅ Checklist de Implementación

### Backend
- [ ] Agregar campo `ultimo_recibo_pagado` INT DEFAULT 0 a tabla `expedientes`
- [ ] Actualizar modelo/schema de `expedientes` para incluir el nuevo campo
- [ ] Modificar GET endpoints para retornar `ultimo_recibo_pagado`
- [ ] Modificar PUT endpoint para aceptar y guardar `ultimo_recibo_pagado`
- [ ] Ejecutar script de migración de datos existentes
- [ ] Probar con una póliza fraccionada en desarrollo

### Testing
- [ ] Crear póliza fraccionada nueva (debe tener `ultimo_recibo_pagado: 0`)
- [ ] Pagar recibo #1 (debe actualizar a `ultimo_recibo_pagado: 1`)
- [ ] Verificar que el botón de pago siga visible
- [ ] Pagar recibo #2 (debe actualizar a `ultimo_recibo_pagado: 2`)
- [ ] Pagar todos los recibos (botón debe desaparecer)
- [ ] Verificar contadores de carpetas (Vigentes, En Proceso, etc.)

---

## 🎯 Impacto Esperado

### Antes (con fecha_ultimo_pago)
```
Recibo #1 pagado el 2025-01-20
→ Sistema calcula: "1 mes desde inicio → 1 recibo pagado" ✅
→ Siguiente pago esperado: Recibo #2

Pero si el pago se hace tarde:
Recibo #1 pagado el 2025-02-05 (tarde)
→ Sistema calcula: "2 meses desde inicio → 2 recibos pagados" ❌ ERROR
→ Siguiente pago esperado: Recibo #3 (saltó el #2)
```

### Después (con ultimo_recibo_pagado)
```
Recibo #1 pagado el 2025-01-20
→ Sistema guarda: ultimo_recibo_pagado = 1 ✅
→ Siguiente pago esperado: Recibo #2

Recibo #1 pagado el 2025-02-05 (tarde)
→ Sistema guarda: ultimo_recibo_pagado = 1 ✅
→ Siguiente pago esperado: Recibo #2 (correcto)
```

---

## 📞 Contacto

Si hay dudas sobre la implementación, revisar:
- Frontend: `src/screens/Expedientes.jsx` (líneas ~8090-8200 para lógica de pagos)
- Función clave: `procesarPagoConComprobante()` envía el campo `ultimo_recibo_pagado`

---

## 📝 Notas Técnicas

1. **¿Por qué INT y no TINYINT?**
   - INT es más claro y permite flexibilidad futura (ej: pagos semanales = 52 recibos)
   - El espacio adicional es mínimo (3 bytes de diferencia por registro)

2. **¿Por qué DEFAULT 0 y no NULL?**
   - Facilita consultas: `WHERE ultimo_recibo_pagado < total_pagos`
   - Evita manejo de NULL en el frontend
   - 0 es semánticamente correcto: "cero recibos pagados"

3. **Compatibilidad con pagos anuales**
   - Para `tipo_pago = 'Anual'`, este campo permanece en 0 o puede ignorarse
   - El frontend no lo usa para pólizas anuales

4. **Relación con fecha_ultimo_pago**
   - `fecha_ultimo_pago`: Fecha REAL en que se hizo el pago (para contabilidad)
   - `ultimo_recibo_pagado`: Número del recibo pagado (para lógica de pagos)
   - **Ambos campos son necesarios y complementarios**

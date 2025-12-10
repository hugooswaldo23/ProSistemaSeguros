# Campo: Fecha de Pago vs Fecha Límite

## 📋 Resumen
Se renombró el campo en el formulario para distinguir entre **cuándo se debía pagar** (fecha_vencimiento_pago) y **cuándo realmente se pagó** (fecha_ultimo_pago).

**✅ NO SE REQUIEREN CAMBIOS EN BASE DE DATOS** - Se usa el campo existente `fecha_ultimo_pago`

---

## 🎯 Diferencia entre campos de fecha:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `fecha_vencimiento_pago` | **Fecha límite** para pagar (según periodo de gracia) | 15-Ene-2025 |
| `fecha_ultimo_pago` | Fecha en que el cliente **realmente pagó** | 10-Ene-2025 (pagó antes) o 20-Ene-2025 (pagó después) |

---

## 📱 CAMBIOS EN FRONTEND

### 1. Modal de Aplicar Pago
- **Nuevo campo**: "Fecha en que se realizó el pago"
- **Default**: Fecha límite del pago pendiente (`fecha_vencimiento_pago`)
- **Editable**: Usuario puede ajustar si pagó antes o después
- **Validación**: Campo obligatorio para aplicar pago
- **Guarda en**: `fecha_ultimo_pago` (campo existente)

### 2. Formulario de Captura
- **✅ Renombrado**: "Fecha de Pago" → "Fecha Límite de Pago"
- **Nuevo campo condicional**: "Fecha de Pago" (solo visible si Estatus = "Pagado")
- **Default**: Si no se especifica, usa fecha de captura
- **Guarda en**: `fecha_ultimo_pago` (campo existente)

---

## 🔄 LÓGICA DE PAGOS FRACCIONADOS

Cada vez que se aplica un pago:
1. Se registra `fecha_ultimo_pago` (fecha exacta del pago)
2. Se calcula el siguiente vencimiento
3. `fecha_vencimiento_pago` se actualiza al siguiente mes/trimestre/semestre
4. Proceso se repite para cada pago

**Ejemplo póliza mensual:**
```
Pago 1: fecha_ultimo_pago = 10-Ene → Siguiente vencimiento: 15-Feb
Pago 2: fecha_ultimo_pago = 12-Feb → Siguiente vencimiento: 15-Mar
Pago 3: fecha_ultimo_pago = 08-Mar → Siguiente vencimiento: 15-Abr
...
```

---

## 📊 IMPACTO EN DASHBOARD

El Dashboard ahora puede mostrar:
- Pagos realizados en un rango de fechas basados en `fecha_ultimo_pago`
- Distinguir entre pagos a tiempo vs pagos atrasados
- Reportes precisos de flujo de efectivo real

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Frontend: Agregar campo en modal de pago
- [x] Frontend: Agregar campo condicional en formulario
- [x] Frontend: Renombrar label "Fecha de Pago" a "Fecha Límite de Pago"
- [x] Frontend: Actualizar lógica de `aplicarPago()` para usar `fecha_ultimo_pago`
- [x] Frontend: Actualizar lógica de guardado en formulario
- [x] Backend: NO SE REQUIEREN CAMBIOS (usa campo existente)
- [ ] Dashboard: Usar `fecha_ultimo_pago` para reportes de pagos

---

## 🚀 PRÓXIMOS PASOS

1. Probar aplicación de pagos con nuevo campo
2. Verificar que Dashboard muestre pagos correctamente usando `fecha_ultimo_pago`
3. Validar con pólizas fraccionadas (mensual, trimestral, semestral)

---

**Fecha de creación**: 4 de diciembre de 2025  
**Actualización**: Se decidió usar campo existente `fecha_ultimo_pago` en lugar de crear uno nuevo  
**Creado por**: Álvaro  
**Prioridad**: 🟢 COMPLETADO (no requiere cambios en BD)

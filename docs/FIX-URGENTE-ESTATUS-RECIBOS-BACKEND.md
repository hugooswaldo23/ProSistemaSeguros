# 🚨 FIX URGENTE: Estatus de Recibos Calculado Incorrectamente en Backend

## PROBLEMA IDENTIFICADO

El backend está retornando **TODOS los recibos con estatus "Pendiente"**, cuando deberían calcularse como "Vencido", "Por vencer", o "Pendiente" según la fecha actual.

### Evidencia del problema:

**Fecha actual:** 10 de diciembre de 2025

**Recibos retornados por el backend:**
```javascript
{
  numero: 1,
  fecha: '2025-08-14',  // ❌ Esta fecha YA PASÓ (hace 4 meses)
  monto: '2033.19',
  estatus: 'Pendiente'   // ❌ INCORRECTO - debería ser "Vencido"
}
{
  numero: 2,
  fecha: '2025-11-14',  // ❌ Esta fecha YA PASÓ (hace 1 mes)
  monto: '1290.81',
  estatus: 'Pendiente'   // ❌ INCORRECTO - debería ser "Vencido"
}
{
  numero: 3,
  fecha: '2026-02-14',  // ✅ Esta fecha es FUTURA (en 2 meses)
  monto: '1290.81',
  estatus: 'Pendiente'   // ✅ CORRECTO
}
{
  numero: 4,
  fecha: '2026-05-14',  // ✅ Esta fecha es FUTURA (en 5 meses)
  monto: '1290.81',
  estatus: 'Pendiente'   // ✅ CORRECTO
}
```

---

## 🔍 LOGS DE LA CONSOLA

```
📊 [CALENDARIO] Recibos desde BACKEND: (4) [{…}, {…}, {…}, {…}]
🔍 [RECIBO 1] Usando estatus del BACKEND: "Pendiente" | Fecha: 2025-08-14
✅ [RECIBO 1] Estado final: "Pendiente" | Badge: bg-secondary  ❌ DEBERÍA SER VENCIDO
🔍 [RECIBO 2] Usando estatus del BACKEND: "Pendiente" | Fecha: 2025-11-14
✅ [RECIBO 2] Estado final: "Pendiente" | Badge: bg-secondary  ❌ DEBERÍA SER VENCIDO
```

---

## 🎯 SOLUCIÓN REQUERIDA

El backend debe calcular el campo `estatus` de cada recibo **comparando la fecha de vencimiento con la fecha actual**.

### Lógica correcta para calcular estatus:

```javascript
// Obtener fecha actual
const hoy = new Date();
hoy.setHours(0, 0, 0, 0); // Sin horas para comparar solo fechas

// Fecha de vencimiento del recibo
const fechaVencimiento = new Date(recibo.fecha_vencimiento);
fechaVencimiento.setHours(0, 0, 0, 0);

// Calcular días de diferencia
const diasDiferencia = Math.floor((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

let estatus;

// 1. Si el recibo ya fue pagado (tiene fecha_pago_real)
if (recibo.fecha_pago_real) {
  estatus = 'Pagado';
}
// 2. Si la fecha de vencimiento ya pasó
else if (diasDiferencia < 0) {
  estatus = 'Vencido';
}
// 3. Si vence hoy
else if (diasDiferencia === 0) {
  estatus = 'Vence hoy';
}
// 4. Si faltan 15 días o menos
else if (diasDiferencia <= 15) {
  estatus = 'Pago por vencer';
}
// 5. Si falta más de 15 días
else {
  estatus = 'Pendiente';
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### ✅ Paso 1: Verificar campo `estatus` en tabla `recibos_pagos`

Asegúrate de que existe el campo:
```sql
ALTER TABLE recibos_pagos 
ADD COLUMN estatus VARCHAR(50) DEFAULT 'Pendiente';
```

### ✅ Paso 2: Modificar la función que calcula/retorna los recibos

**Archivo probable:** `backend/controllers/expedientesController.js` o similar

**Endpoints afectados:**
- `GET /api/expedientes` (listar todas las pólizas)
- `GET /api/expedientes/:id` (obtener una póliza específica)

**Modificación necesaria:**

```javascript
// Cuando obtienes los recibos de la BD:
const recibos = await db.query(`
  SELECT * FROM recibos_pagos 
  WHERE expediente_id = ? 
  ORDER BY numero_recibo ASC
`, [expedienteId]);

// ANTES de retornarlos, calcular el estatus de cada uno:
const recibosConEstatus = recibos.map(recibo => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaVencimiento = new Date(recibo.fecha_vencimiento);
  fechaVencimiento.setHours(0, 0, 0, 0);
  
  const diasDiferencia = Math.floor((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
  
  let estatus;
  
  if (recibo.fecha_pago_real) {
    estatus = 'Pagado';
  } else if (diasDiferencia < 0) {
    estatus = 'Vencido';
  } else if (diasDiferencia === 0) {
    estatus = 'Vence hoy';
  } else if (diasDiferencia <= 15) {
    estatus = 'Pago por vencer';
  } else {
    estatus = 'Pendiente';
  }
  
  return {
    ...recibo,
    estatus: estatus
  };
});

// Retornar recibosConEstatus en lugar de recibos
```

---

## 🧪 CÓMO PROBAR EL FIX

1. **Crear/editar una póliza** con fecha de inicio en el pasado (ej: agosto 2025)
2. **Guardar la póliza** con tipo de pago "Fraccionado - Trimestral"
3. **Consultar la póliza** en el listado o al editarla
4. **Verificar en los logs de la consola del navegador:**
   ```
   📊 [CALENDARIO] Recibos desde BACKEND: (4) [{…}, {…}, {…}, {…}]
   ```
5. **Expandir el array de recibos** y verificar que:
   - Recibos con fechas pasadas tienen `estatus: "Vencido"`
   - Recibos con fechas próximas (≤15 días) tienen `estatus: "Pago por vencer"`
   - Recibos con fechas futuras (>15 días) tienen `estatus: "Pendiente"`

---

## 📊 EJEMPLO DE RESPUESTA CORRECTA

Para una póliza con inicio de vigencia `2025-08-14` y frecuencia Trimestral:

```json
{
  "recibos": [
    {
      "numero_recibo": 1,
      "fecha_vencimiento": "2025-08-14",
      "monto": 2033.19,
      "estatus": "Vencido",          // ✅ CORRECTO (fecha pasada)
      "fecha_pago_real": null
    },
    {
      "numero_recibo": 2,
      "fecha_vencimiento": "2025-11-14",
      "monto": 1290.81,
      "estatus": "Vencido",          // ✅ CORRECTO (fecha pasada)
      "fecha_pago_real": null
    },
    {
      "numero_recibo": 3,
      "fecha_vencimiento": "2026-02-14",
      "monto": 1290.81,
      "estatus": "Pendiente",        // ✅ CORRECTO (falta >15 días)
      "fecha_pago_real": null
    },
    {
      "numero_recibo": 4,
      "fecha_vencimiento": "2026-05-14",
      "monto": 1290.81,
      "estatus": "Pendiente",        // ✅ CORRECTO (falta >15 días)
      "fecha_pago_real": null
    }
  ]
}
```

---

## ⚠️ IMPACTO DEL BUG ACTUAL

### Síntomas visibles en el frontend:

1. **En el listado de pólizas:**
   - Badge de "Estatus Pago" muestra "Pendiente" cuando debería mostrar "Vencido"
   - El contador "1/4 Vencido" (rojo) se ve correcto porque usa cálculo de frontend como fallback

2. **Al ver/editar una póliza:**
   - Calendario muestra TODOS los pagos como "Pendientes" (gris)
   - Cuando deberían mostrarse como "Vencidos" (rojo)

3. **Antes de guardar la póliza:**
   - Se muestra correctamente porque usa cálculo del frontend
   - **Después de guardar** se usa el estatus del backend (incorrecto)

---

## 🚀 PRIORIDAD

**URGENTE** - Este bug afecta la visualización correcta del estado de pagos en TODO el sistema.

---

## 📞 NOTAS ADICIONALES

- El frontend tiene un **fallback** que calcula el estatus si el backend NO lo envía
- Pero el problema es que el backend **SÍ está enviando el campo `estatus`**, pero con valor incorrecto
- Por eso el frontend confía en el backend y NO usa su cálculo local

**Archivo frontend con logs de debug:** `src/screens/Expedientes.jsx` (líneas 395-530)

---

## ✅ CONFIRMACIÓN DE FIX

Una vez implementado el fix, deberías ver en los logs:

```
🔍 [RECIBO 1] Usando estatus del BACKEND: "Vencido" | Fecha: 2025-08-14
✅ [RECIBO 1] Estado final: "Vencido" | Badge: bg-danger  ✅ CORRECTO

🔍 [RECIBO 2] Usando estatus del BACKEND: "Vencido" | Fecha: 2025-11-14
✅ [RECIBO 2] Estado final: "Vencido" | Badge: bg-danger  ✅ CORRECTO

🔍 [RECIBO 3] Usando estatus del BACKEND: "Pendiente" | Fecha: 2026-02-14
✅ [RECIBO 3] Estado final: "Pendiente" | Badge: bg-secondary  ✅ CORRECTO
```

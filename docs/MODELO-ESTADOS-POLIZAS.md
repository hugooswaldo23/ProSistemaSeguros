# 🎯 Modelo de Estados de Pólizas - Guía Conceptual

## 📊 Dos Dimensiones Independientes

Cada póliza tiene **DOS sistemas de estado completamente separados**:

---

## 1️⃣ ETAPA OPERATIVA (`etapa_activa`)

**¿Qué representa?** El estado en el **flujo de trabajo operativo** de la póliza.

### Valores posibles:
```
"Cotizada"   → Se generó una cotización
"Emitida"    → La póliza ya fue emitida por la aseguradora
"Cancelada"  → El cliente canceló la póliza
"Renovada"   → Es una renovación de póliza existente
```

### Flujo típico:
```
Cotizada → Emitida → (activa durante vigencia) → Renovada
                  ↘ Cancelada
```

### Ejemplo en código:
```sql
-- Una póliza puede estar "Emitida" y seguir activa, sin importar si pagó o no
UPDATE expedientes 
SET etapa_activa = 'Emitida' 
WHERE expediente_id = 123;
```

---

## 2️⃣ ESTADO DE PAGO (`estatus_pago`)

**¿Qué representa?** La situación **financiera** del pago de la prima.

### Valores posibles:
```
"Pendiente"    → Aún no llega la fecha de pago
"Por Vencer"   → Falta poco para vencer (ej: 7 días o menos)
"Vencido"      → Ya pasó la fecha y no pagó
"Pagado"       → El cliente ya pagó
```

### Flujo típico:
```
Pendiente → Por Vencer → (se recibe pago) → Pagado
                      ↘ (no paga) → Vencido
```

### Ejemplo en código:
```sql
-- Cuando el cliente paga:
UPDATE expedientes 
SET estatus_pago = 'Pagado',
    fecha_pago = '2024-10-20'
WHERE expediente_id = 123;
```

---

## 🔄 Combinaciones Válidas

Una póliza puede tener **cualquier combinación** de estos estados:

| etapa_activa | estatus_pago | Significado |
|--------------|--------------|-------------|
| Emitida | Pendiente | Póliza emitida, aún no vence el pago |
| Emitida | Por Vencer | Póliza emitida, pago próximo a vencer |
| Emitida | Vencido | Póliza emitida pero cliente no pagó |
| Emitida | Pagado | Póliza emitida y pagada (✅ flujo exitoso) |
| Cancelada | Pendiente | Cliente canceló antes de pagar |
| Cancelada | Pagado | Cliente pagó pero luego canceló (se debe devolver) |

---

## 📅 Fechas Relacionadas

Cada estado tiene sus fechas asociadas:

### Para `etapa_activa`:
```javascript
{
  fecha_emision: "2024-10-15",      // Cuándo se emitió
  fecha_cancelacion: "2024-11-20",  // Cuándo se canceló (si aplica)
}
```

### Para `estatus_pago`:
```javascript
{
  fecha_vencimiento_pago: "2024-11-15",  // Cuándo DEBE pagar
  fecha_pago: "2024-10-18",              // Cuándo SÍ pagó (si aplica)
}
```

---

## 💡 Ejemplos del Mundo Real

### Caso 1: Flujo Exitoso
```json
{
  "numero_poliza": "POL-2024-001",
  "cliente_nombre": "Juan Pérez",
  "importe_total": 15000,
  "fecha_emision": "2024-10-01",
  "fecha_vencimiento_pago": "2024-10-15",
  "fecha_pago": "2024-10-12",
  "etapa_activa": "Emitida",
  "estatus_pago": "Pagado"
}
```
**Interpretación:** Póliza emitida el 1 de octubre, cliente pagó antes de vencer (el 12). ✅ Todo bien.

---

### Caso 2: Cliente Moroso
```json
{
  "numero_poliza": "POL-2024-002",
  "cliente_nombre": "María López",
  "importe_total": 22000,
  "fecha_emision": "2024-09-15",
  "fecha_vencimiento_pago": "2024-10-01",
  "fecha_pago": null,
  "etapa_activa": "Emitida",
  "estatus_pago": "Vencido"
}
```
**Interpretación:** Póliza emitida en septiembre, debía pagar el 1 de octubre pero no lo hizo. ⚠️ Hay que cobrar.

---

### Caso 3: Cliente Desiste
```json
{
  "numero_poliza": "POL-2024-003",
  "cliente_nombre": "Carlos Gómez",
  "importe_total": 18000,
  "fecha_emision": "2024-10-10",
  "fecha_vencimiento_pago": "2024-10-25",
  "fecha_pago": null,
  "fecha_cancelacion": "2024-10-15",
  "etapa_activa": "Cancelada",
  "estatus_pago": "Pendiente"
}
```
**Interpretación:** Póliza emitida pero cliente canceló antes de pagar. ❌ Operación perdida.

---

### Caso 4: Pago Próximo a Vencer
```json
{
  "numero_poliza": "POL-2024-004",
  "cliente_nombre": "Ana Martínez",
  "importe_total": 12000,
  "fecha_emision": "2024-10-20",
  "fecha_vencimiento_pago": "2024-10-28",
  "fecha_pago": null,
  "etapa_activa": "Emitida",
  "estatus_pago": "Por Vencer"
}
```
**Interpretación:** Póliza emitida, vence en 2 días. ⏰ Hay que recordarle al cliente.

---

## 🎯 Uso en el Dashboard

### Primas Emitidas
```javascript
// Contar pólizas que se EMITIERON (sin importar si pagaron)
expedientes.filter(e => 
  e.etapa_activa === 'Emitida' && 
  esMesActual(e.fecha_emision)
)
```

### Primas Por Vencer
```javascript
// Contar pólizas que AÚN NO VENCEN
expedientes.filter(e => 
  e.estatus_pago === 'Por Vencer'
)
```

### Primas Vencidas
```javascript
// Contar pólizas que NO PAGARON
expedientes.filter(e => 
  e.estatus_pago === 'Vencido'
)
```

### Primas Pagadas
```javascript
// Contar pólizas que SÍ PAGARON este mes
expedientes.filter(e => 
  e.estatus_pago === 'Pagado' && 
  esMesActual(e.fecha_pago)
)
```

---

## ⚠️ Errores Comunes a Evitar

### ❌ ERROR 1: Usar "Pagado" como etapa
```javascript
// INCORRECTO
{
  etapa_activa: "Pagado",  // ❌ NO! "Pagado" no es una etapa
  estatus_pago: null
}

// CORRECTO
{
  etapa_activa: "Emitida",  // ✅ Estado en el workflow
  estatus_pago: "Pagado"    // ✅ Estado financiero
}
```

### ❌ ERROR 2: Dejar fecha_pago en pólizas no pagadas
```javascript
// INCORRECTO
{
  estatus_pago: "Vencido",
  fecha_pago: "2024-10-15"  // ❌ Si está vencido, NO debe tener fecha_pago
}

// CORRECTO
{
  estatus_pago: "Vencido",
  fecha_pago: null  // ✅ null porque no ha pagado
}
```

### ❌ ERROR 3: Póliza cancelada sin fecha
```javascript
// INCORRECTO
{
  etapa_activa: "Cancelada",
  fecha_cancelacion: null  // ❌ Si está cancelada, debe tener fecha
}

// CORRECTO
{
  etapa_activa: "Cancelada",
  fecha_cancelacion: "2024-10-15"  // ✅ Fecha de cancelación
}
```

---

## 🔧 Triggers Sugeridos (Backend)

### Cuando se emite una póliza:
```sql
UPDATE expedientes 
SET etapa_activa = 'Emitida',
    estatus_pago = 'Pendiente',
    fecha_emision = NOW()
WHERE expediente_id = ?;
```

### Cuando el cliente paga:
```sql
UPDATE expedientes 
SET estatus_pago = 'Pagado',
    fecha_pago = NOW()
WHERE expediente_id = ?;
```

### Cuando vence un pago sin cobrar:
```sql
-- Job automático que corre diariamente
UPDATE expedientes 
SET estatus_pago = 'Vencido'
WHERE fecha_vencimiento_pago < CURDATE()
  AND estatus_pago != 'Pagado'
  AND etapa_activa != 'Cancelada';
```

### Cuando falta poco para vencer (7 días):
```sql
-- Job automático que corre diariamente
UPDATE expedientes 
SET estatus_pago = 'Por Vencer'
WHERE fecha_vencimiento_pago BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
  AND estatus_pago = 'Pendiente'
  AND etapa_activa != 'Cancelada';
```

---

## 📋 Checklist de Implementación

- [ ] Tabla `expedientes` tiene columna `etapa_activa` VARCHAR
- [ ] Tabla `expedientes` tiene columna `estatus_pago` VARCHAR (nullable)
- [ ] Tabla `expedientes` tiene columna `fecha_emision` DATE
- [ ] Tabla `expedientes` tiene columna `fecha_pago` DATE (nullable)
- [ ] Tabla `expedientes` tiene columna `fecha_vencimiento_pago` DATE
- [ ] Tabla `expedientes` tiene columna `fecha_cancelacion` DATE (nullable)
- [ ] Job automático para marcar pagos como "Vencidos"
- [ ] Job automático para marcar pagos como "Por Vencer"
- [ ] Endpoint GET retorna todos estos campos correctamente
- [ ] Frontend consume los campos sin mezclarlos

---

**Fecha:** 29 de octubre 2024  
**Autor:** Equipo Frontend  
**Para:** Hugo (Backend Developer)  
**Objetivo:** Clarificar el modelo de datos para correcta implementación

# Requerimientos Backend para Dashboard - Panel Financiero

## 📋 RESUMEN
El Dashboard ya está completamente desarrollado en el frontend. Este documento especifica el **modelo híbrido** que permite:
- ✅ Dashboard operativo (hoy)
- ✅ Reportes avanzados por agente/aseguradora/producto (futuro)
- ✅ Trazabilidad completa del ciclo de vida de cada póliza

Hugo necesita asegurar que el endpoint `/api/expedientes` retorne los campos correctos.

---

## 🔌 ENDPOINT REQUERIDO

### `GET /api/expedientes`

**Estado actual:** ✅ Funcionando (devuelve pólizas)  
**Acción requerida:** ✅ Verificar que incluya TODOS los campos necesarios (ver modelo completo abajo)

## 📊 MODELO HÍBRIDO COMPLETO (Recomendado)

### **Por qué modelo híbrido:**
- **Hoy**: Dashboard operativo con KPIs financieros
- **Mañana**: Reportes detallados por agente, aseguradora, producto
- **Siempre**: Auditoría y trazabilidad completa

---

## 📊 CAMPOS OBLIGATORIOS que debe retornar cada expediente

### 1️⃣ Identificación y Clasificación
```javascript
{
  expediente_id: 123,                      // INT - ID único
  numero_poliza: "POL-2024-001",           // VARCHAR - Número de póliza
  tipo_movimiento: "nueva",                // ENUM - "nueva" | "renovacion"
  
  // Para reportes por aseguradora/producto
  aseguradora: "Qualitas",                 // VARCHAR - Nombre aseguradora
  producto: "Auto Tradicional",            // VARCHAR - Tipo de producto
}
```

### 2️⃣ Estados del Sistema (MODELO HÍBRIDO) ⚡
**Cada póliza tiene DOS estados independientes:**

```javascript
{
  // ESTADO OPERATIVO (workflow con acciones del usuario)
  etapa_activa: "Pendiente de Pago",      // ENUM - Dónde está en el proceso
  // Valores: "Cotizada" | "Emitida" | "Pendiente de Pago" | "Pagada" | "Vencida" | "Cancelada"
  
  // ESTADO FINANCIERO (para reportes y filtros)
  estatus_pago: "Por Vencer",             // ENUM - Situación del pago
  // Valores: "Pendiente" | "Por Vencer" | "Vencido" | "Pagado"
}
```

**¿Por qué ambos?**
- `etapa_activa`: Usuario hace una acción → cambia la etapa (ej: "Compartir con Cliente")
- `estatus_pago`: Sistema evalúa fechas → cambia automático (ej: Job marca como "Vencido")
- **Reportes futuros**: Puedes filtrar por ambos según necesites

### 3️⃣ Fechas Clave (Trazabilidad Completa)
```javascript
{
  fecha_emision: "2024-10-15",            // DATE - Cuando se emitió
  fecha_compartida: "2024-10-16",         // DATE - Cuando se compartió con cliente (transición a "Pendiente de Pago")
  fecha_vencimiento_pago: "2024-11-15",   // DATE - Cuando DEBE pagar
  fecha_pago: "2024-10-20",               // DATE - Cuando SÍ pagó (null si no ha pagado)
  fecha_cancelacion: "2024-10-25",        // DATE - Si fue cancelada
}
```

### 4️⃣ Montos
```javascript
{
  importe_total: 15000.50,                // DECIMAL(10,2) - Monto de la prima
}
```

### 5️⃣ Personas (Para Reportes por Agente/Vendedor)
```javascript
{
  cliente_id: "CLI001",                   // VARCHAR - ID del cliente
  cliente_nombre: "Juan Pérez González",   // VARCHAR - Nombre completo
  agente_id: "AG001",                     // VARCHAR - ID del agente ✨ PARA REPORTES
  vendedor_id: "VEN001",                  // VARCHAR - ID del vendedor ✨ PARA REPORTES
}
```

---

## 📐 EJEMPLO DE RESPUESTA COMPLETA

```json
[
  {
    "expediente_id": 1,
    "numero_poliza": "POL-2024-001",
    "tipo_movimiento": "nueva",
    
    "cliente_id": "CLI001",
    "cliente_nombre": "Juan Pérez González",
    "agente_id": "AG001",
    "vendedor_id": "VEN001",
    
    "aseguradora": "Qualitas",
    "producto": "Auto Tradicional",
    "importe_total": 15000.50,
    
    "etapa_activa": "Pagada",
    "estatus_pago": "Pagado",
    
    "fecha_emision": "2024-10-15",
    "fecha_compartida": "2024-10-16",
    "fecha_vencimiento_pago": "2024-11-15",
    "fecha_pago": "2024-10-18",
    "fecha_cancelacion": null
  },
  {
    "expediente_id": 2,
    "numero_poliza": "POL-2024-002",
    "tipo_movimiento": "renovacion",
    
    "cliente_id": "CLI002",
    "cliente_nombre": "María López",
    "agente_id": "AG002",
    "vendedor_id": null,
    
    "aseguradora": "ANA Seguros",
    "producto": "Auto Premium",
    "importe_total": 22000.00,
    
    "etapa_activa": "Pendiente de Pago",
    "estatus_pago": "Por Vencer",
    
    "fecha_emision": "2024-10-20",
    "fecha_compartida": "2024-10-21",
    "fecha_vencimiento_pago": "2024-10-25",
    "fecha_pago": null,
    "fecha_cancelacion": null
  },
  {
    "expediente_id": 3,
    "numero_poliza": "POL-2024-003",
    "tipo_movimiento": "nueva",
    
    "cliente_id": "CLI003",
    "cliente_nombre": "Carlos Ramírez",
    "agente_id": "AG001",
    "vendedor_id": "VEN002",
    
    "aseguradora": "GNP",
    "producto": "Auto Básico",
    "importe_total": 8500.00,
    
    "etapa_activa": "Vencida",
    "estatus_pago": "Vencido",
    
    "fecha_emision": "2024-09-10",
    "fecha_compartida": "2024-09-11",
    "fecha_vencimiento_pago": "2024-10-10",
    "fecha_pago": null,
    "fecha_cancelacion": null
  },
  {
    "expediente_id": 4,
    "numero_poliza": "POL-2024-004",
    "tipo_movimiento": "nueva",
    
    "cliente_id": "CLI004",
    "cliente_nombre": "Ana Martínez",
    "agente_id": "AG003",
    "vendedor_id": "VEN001",
    
    "aseguradora": "HDI",
    "producto": "Auto Full",
    "importe_total": 18000.00,
    
    "etapa_activa": "Cancelada",
    "estatus_pago": "Pendiente",
    
    "fecha_emision": "2024-10-05",
    "fecha_compartida": "2024-10-06",
    "fecha_vencimiento_pago": "2024-11-05",
    "fecha_pago": null,
    "fecha_cancelacion": "2024-10-12"
  }
]
```

### 💡 Explicación de los ejemplos:

1. **Póliza #001**: Flujo exitoso (Emitida → Compartida → Pagada)
2. **Póliza #002**: En proceso normal (Pendiente de Pago, próxima a vencer)
3. **Póliza #003**: Cliente moroso (Vencida, no pagó)
4. **Póliza #004**: Cliente desistió (Cancelada antes de pagar)

---

## 🔄 LÓGICA DE NEGOCIO (Modelo Híbrido)

### **💡 Concepto Clave: Workflow vs Estado Financiero**

Cada póliza tiene **DOS dimensiones independientes**:

1. **Workflow Operativo** (`etapa_activa`): ¿Dónde está en el proceso? (controlado por usuario)
   - "Cotizada" → "Emitida" → "Pendiente de Pago" → "Pagada" / "Vencida" / "Cancelada"
   - Cambia con **acciones del usuario**: "Compartir", "Registrar Pago", "Cancelar"
   
2. **Estado Financiero** (`estatus_pago`): ¿Nos pagaron o no? (controlado por sistema)
   - "Pendiente" → "Por Vencer" → "Vencido" → "Pagado"
   - Cambia **automáticamente** (jobs/cron) basándose en fechas

---

### **A. Dimensión Operativa: `etapa_activa`** (Acciones de Usuario)

**Flujo del Workflow:**

```
1. COTIZADA (creación inicial)
   ↓ Usuario: "Compartir con Cliente" → registra fecha_compartida
   
2. EMITIDA (cliente revisando)
   ↓ Usuario: "Registrar Pago" O Sistema: detecta vencimiento cercano
   
3. PENDIENTE DE PAGO (esperando confirmación)
   ↓ Usuario: "Confirmar Pago" → registra fecha_pago
   
4. PAGADA ✅ (completada exitosamente)

   O si fecha_vencimiento_pago < HOY sin pago:
   
5. VENCIDA ⚠️ (no pagó a tiempo)
   ↓ Usuario puede: "Registrar Pago Tardío" → PAGADA

   O en cualquier momento:
   
6. CANCELADA ❌ (proceso abortado) → registra fecha_cancelacion
```

**Transiciones Válidas:**

- Cotizada → Emitida → Pendiente de Pago → Pagada ✅
- Cotizada → Emitida → Pendiente de Pago → Vencida ⚠️ → Pagada ✅
- Cualquier etapa → Cancelada ❌

---

### **B. Dimensión Financiera: `estatus_pago`** (Cálculo Automático)

**Estados Calculados por Jobs Diarios:**

```sql
-- Job 1: Marcar "Por Vencer" (ejecutar diario)
UPDATE expedientes 
SET estatus_pago = 'Por Vencer'
WHERE fecha_vencimiento_pago BETWEEN CURDATE() AND (CURDATE() + INTERVAL 7 DAY)
  AND fecha_pago IS NULL
  AND etapa_activa NOT IN ('Cancelada', 'Pagada');

-- Job 2: Marcar "Vencido" (ejecutar diario)
UPDATE expedientes 
SET estatus_pago = 'Vencido',
    etapa_activa = 'Vencida'  -- También cambiar workflow
WHERE fecha_vencimiento_pago < CURDATE()
  AND fecha_pago IS NULL
  AND etapa_activa NOT IN ('Cancelada', 'Pagada', 'Vencida');

-- Job 3: Marcar "Pagado" (cuando usuario registra pago)
UPDATE expedientes 
SET estatus_pago = 'Pagado',
    etapa_activa = 'Pagada',
    fecha_pago = CURDATE()
WHERE expediente_id = ?;
```

**Condiciones de Estados:**

| estatus_pago | Condición |
|--------------|-----------|
| Pendiente | `fecha_vencimiento_pago > (HOY + 7 días)` Y `fecha_pago IS NULL` |
| Por Vencer | `fecha_vencimiento_pago BETWEEN HOY AND (HOY + 7 días)` Y `fecha_pago IS NULL` |
| Vencido | `fecha_vencimiento_pago < HOY` Y `fecha_pago IS NULL` |
| Pagado | `fecha_pago IS NOT NULL` |

---

### **C. Combinaciones Válidas**

| etapa_activa | estatus_pago | Significado | Dashboard |
|--------------|--------------|-------------|-----------|
| Cotizada | - | Aún no emitida | No cuenta |
| Emitida | Pendiente | Compartida, vencimiento lejano | Emitida |
| Emitida | Por Vencer | Compartida, vencimiento ≤7 días | Por Vencer |
| Pendiente de Pago | Por Vencer | Preparando pago, vencimiento cercano | Por Vencer |
| Pagada | Pagado | ✅ Completada exitosamente | No cuenta (ya cobrada) |
| Vencida | Vencido | ⚠️ No pagó a tiempo | Vencida |
| Cancelada | Pendiente/Vencido | ❌ Abortada | Cancelada |

---

### **1. Primas Emitidas (Mes Actual)**
**¿Qué cuenta?** Pólizas que SE EMITIERON este mes (sin importar si están pagadas)

```javascript
// Filtro:
- fecha_emision del mes actual
- etapa_activa = "Emitida"  // Solo las emitidas (no canceladas ni en cotización)

// Desglose:
- Nuevas: tipo_movimiento = "nueva" | "Nueva"
- Renovaciones: tipo_movimiento = "renovacion" | "Renovación"
```

**Nota:** Una póliza emitida puede tener cualquier `estatus_pago` (Pendiente, Por Vencer, Vencido, Pagado)

---

### **2. Primas Por Vencer (Acumulado)**
**¿Qué cuenta?** Pólizas que AÚN NO HAN VENCIDO pero deben pagarse pronto (≤7 días)

```javascript
// Filtro:
- estatus_pago = "Por Vencer"
- fecha_vencimiento_pago BETWEEN HOY AND (HOY + 7 días)
- fecha_pago IS NULL
- etapa_activa NOT IN ("Cancelada")

// Desglose:
- Mes actual: fecha_vencimiento_pago del mes en curso
- Anteriores: fecha_vencimiento_pago de meses previos
```

**Nota:** Incluye acumulado porque son pagos pendientes históricos (job debe haberlos marcado)

---

### **3. Primas Vencidas (Acumulado)**
**¿Qué cuenta?** Pólizas que YA VENCIERON y NO PAGARON

```javascript
// Filtro:
- estatus_pago = "Vencido"
- fecha_vencimiento_pago < HOY
- fecha_pago IS NULL
- etapa_activa = "Vencida"

// Desglose:
- Mes actual: fecha_vencimiento_pago del mes en curso
- Anteriores: fecha_vencimiento_pago de meses previos
```

**Nota:** Incluye acumulado de TODOS los vencimientos históricos sin pagar

---

### **4. Primas Canceladas (Acumulado)**
**¿Qué cuenta?** Pólizas que SE CANCELARON (en cualquier etapa)

```javascript
// Filtro:
- etapa_activa = "Cancelada"
- fecha_cancelacion IS NOT NULL

// Desglose:
- Mes actual: fecha_cancelacion del mes en curso
- Anteriores: fecha_cancelacion de meses previos
```

**Nota:** Canceladas pueden tener cualquier `estatus_pago` (Pendiente, Vencido, etc.)

---

### **D. Reportes Futuros (Soporte del Modelo)**

El modelo híbrido permite reportes avanzados sin cambios futuros:

**Reporte por Agente:**
```sql
SELECT 
  agente_id,
  SUM(CASE WHEN etapa_activa = 'Pagada' THEN importe_total ELSE 0 END) as total_cobrado,
  SUM(CASE WHEN estatus_pago = 'Vencido' THEN importe_total ELSE 0 END) as total_moroso
FROM expedientes
WHERE fecha_emision >= '2024-01-01'
GROUP BY agente_id;
```

**Reporte por Producto:**
```sql
SELECT 
  producto,
  aseguradora,
  COUNT(*) as total_polizas,
  SUM(importe_total) as monto_total,
  AVG(DATEDIFF(fecha_pago, fecha_compartida)) as dias_promedio_pago
FROM expedientes
WHERE etapa_activa = 'Pagada'
  AND fecha_emision >= '2024-01-01'
GROUP BY producto, aseguradora;
```

**Reporte por Vendedor:**
```sql
SELECT 
  COALESCE(vendedor_id, 'Sin Vendedor') as vendedor,
  COUNT(*) as total_ventas,
  SUM(CASE WHEN tipo_movimiento = 'nueva' THEN importe_total ELSE 0 END) as nuevas,
  SUM(CASE WHEN tipo_movimiento = 'renovacion' THEN importe_total ELSE 0 END) as renovaciones
FROM expedientes
WHERE etapa_activa IN ('Emitida', 'Pagada')
  AND fecha_emision BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY vendedor_id;
```

**Eficiencia de Cobranza:**
```sql
SELECT 
  YEAR(fecha_emision) as año,
  MONTH(fecha_emision) as mes,
  COUNT(*) as total_emitidas,
  SUM(CASE WHEN etapa_activa = 'Pagada' THEN 1 ELSE 0 END) as total_pagadas,
  SUM(CASE WHEN etapa_activa = 'Vencida' THEN 1 ELSE 0 END) as total_vencidas,
  ROUND(100.0 * SUM(CASE WHEN etapa_activa = 'Pagada' THEN 1 ELSE 0 END) / COUNT(*), 2) as tasa_cobranza
FROM expedientes
WHERE etapa_activa IN ('Emitida', 'Pagada', 'Vencida')
GROUP BY YEAR(fecha_emision), MONTH(fecha_emision)
ORDER BY año DESC, mes DESC;
```

---

### **4. Primas Canceladas (Mes Actual)**
**¿Qué cuenta?** Pólizas que SE CANCELARON este mes

```javascript
// Filtro:
- etapa_activa = "Cancelada"
- fecha_cancelacion del mes actual
```

---

### **5. Primas Pagadas (Nueva métrica sugerida)**
**¿Qué cuenta?** Pólizas que SÍ PAGARON este mes

```javascript
// Filtro:
- estatus_pago = "Pagado"
- fecha_pago del mes actual
```

**Sugerencia:** Esta métrica es muy útil para ver el flujo de efectivo real

---

## ✅ CHECKLIST PARA HUGO

### Base de Datos
- [ ] Columna `expediente_id` INT PRIMARY KEY AUTO_INCREMENT
- [ ] Columna `numero_poliza` VARCHAR(50)
- [ ] Columna `tipo_movimiento` ENUM('nueva', 'renovacion')
- [ ] Columna `importe_total` DECIMAL(10,2) ✨ CRÍTICO
- [ ] Columna `producto` VARCHAR(100)
- [ ] Columna `aseguradora` VARCHAR(100)
- [ ] Columna `etapa_activa` ENUM('Cotizada', 'Emitida', 'Pendiente de Pago', 'Pagada', 'Vencida', 'Cancelada') ✨ MODELO HÍBRIDO
- [ ] Columna `estatus_pago` ENUM('Pendiente', 'Por Vencer', 'Vencido', 'Pagado') ✨ MODELO HÍBRIDO
- [ ] Columna `fecha_emision` DATE
- [ ] Columna `fecha_compartida` DATE (nullable) ✨ NUEVO - tracking de workflow
- [ ] Columna `fecha_vencimiento_pago` DATE
- [ ] Columna `fecha_pago` DATE (nullable) ✨ CRÍTICO
- [ ] Columna `fecha_cancelacion` DATE (nullable)
- [ ] Columna `cliente_id` VARCHAR(20)
- [ ] Columna `cliente_nombre` VARCHAR(200)
- [ ] Columna `agente_id` VARCHAR(20) ✨ PARA REPORTES FUTUROS
- [ ] Columna `vendedor_id` VARCHAR(20) (nullable) ✨ PARA REPORTES FUTUROS
- [ ] Índices en: `fecha_emision`, `fecha_pago`, `agente_id`, `aseguradora`, `producto`

### Jobs/Cron Automáticos (CRÍTICO)
- [ ] Job diario: Marcar `estatus_pago = 'Por Vencer'` cuando `fecha_vencimiento_pago` entre HOY y HOY+7 días
- [ ] Job diario: Marcar `estatus_pago = 'Vencido'` y `etapa_activa = 'Vencida'` cuando `fecha_vencimiento_pago < HOY`
- [ ] Job diario: Mantener `estatus_pago = 'Pendiente'` cuando `fecha_vencimiento_pago > HOY+7 días`

### Endpoint API
- [ ] `GET /api/expedientes` retorna TODOS los campos mencionados arriba
- [ ] Los campos de tipo DECIMAL se envían como números (no strings)
- [ ] Las fechas están en formato ISO: "YYYY-MM-DD"
- [ ] Los campos nullable pueden ser `null` (no undefined ni "")
- [ ] Verificar que `etapa_activa` y `estatus_pago` son campos SEPARADOS (no combinados)

### Testing Sugerido
```bash
# Probar endpoint desde terminal
curl http://localhost:3000/api/expedientes

# Verificar estructura JSON:
{
  "expediente_id": 1,
  "numero_poliza": "POL-2024-001",
  "tipo_movimiento": "nueva",
  
  "cliente_id": "CLI001",
  "cliente_nombre": "Juan Pérez",
  "agente_id": "AG001",
  "vendedor_id": "VEN001",
  
  "aseguradora": "Qualitas",
  "producto": "Auto Tradicional",
  "importe_total": 15000.50,  // ⚠️ NÚMERO, no string
  
  "etapa_activa": "Pagada",      // ⚠️ Campo SEPARADO
  "estatus_pago": "Pagado",      // ⚠️ Campo SEPARADO
  
  "fecha_emision": "2024-10-15",
  "fecha_compartida": "2024-10-16",
  "fecha_vencimiento_pago": "2024-11-15",
  "fecha_pago": "2024-10-18",
  "fecha_cancelacion": null
}
```

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### ❌ Error #1: Campos combinados en lugar de separados
**Síntoma:** Dashboard muestra $0 o datos incorrectos

**Causa:** Base de datos usa un solo campo `estatus` con valores como "Emitida - Pendiente"

**Solución:** Separar en DOS campos:
```sql
ALTER TABLE expedientes 
ADD COLUMN etapa_activa ENUM('Cotizada', 'Emitida', 'Pendiente de Pago', 'Pagada', 'Vencida', 'Cancelada'),
ADD COLUMN estatus_pago ENUM('Pendiente', 'Por Vencer', 'Vencido', 'Pagado');
```

---

### ❌ Error #2: Usar "Pagado" como etapa_activa
**Síntoma:** Filtros del dashboard no funcionan correctamente

**Causa:** Confundir workflow operativo con estado financiero

**Incorrecto:**
```json
{
  "etapa_activa": "Pagado",  // ❌ NO! "Pagado" no es una etapa de workflow
  "estatus_pago": null
}
```

**Correcto:**
```json
{
  "etapa_activa": "Pagada",   // ✅ Etapa de workflow
  "estatus_pago": "Pagado"    // ✅ Estado financiero
}
```

---

### ❌ Error #3: Jobs automáticos no implementados
**Síntoma:** Pólizas vencidas no se marcan automáticamente

**Causa:** No hay jobs/cron actualizando `estatus_pago`

**Solución:** Implementar 3 jobs diarios (ver sección "Jobs/Cron Automáticos" arriba)

---

### ❌ Error #4: `importe_total` como string
**Síntoma:** Dashboard muestra "$0" aunque hay datos

**Causa:** Backend envía `"15000.50"` (string) en lugar de `15000.50` (número)

**Solución:**
```javascript
// ❌ Incorrecto
importe_total: row.importe_total.toString()

// ✅ Correcto
importe_total: parseFloat(row.importe_total)
```

---

### ❌ Error #5: Fechas sin campo `fecha_compartida`
**Síntoma:** No se puede rastrear cuándo se compartió con cliente

**Causa:** Falta el campo `fecha_compartida` en la BD

**Solución:**
```sql
ALTER TABLE expedientes 
ADD COLUMN fecha_compartida DATE NULL AFTER fecha_emision;
```

---

### ❌ Error #6: Falta `agente_id` y `vendedor_id`
**Síntoma:** No se pueden hacer reportes futuros por agente/vendedor

**Causa:** Campos no existen en la tabla

**Solución:**
```sql
ALTER TABLE expedientes 
ADD COLUMN agente_id VARCHAR(20) NULL,
ADD COLUMN vendedor_id VARCHAR(20) NULL,
ADD INDEX idx_agente (agente_id),
ADD INDEX idx_vendedor (vendedor_id);
```

---

## ✅ VALIDACIÓN RÁPIDA

### Test 1: Campos separados
```sql
SELECT 
  expediente_id,
  etapa_activa,    -- Debe existir como columna separada
  estatus_pago     -- Debe existir como columna separada
FROM expedientes
LIMIT 5;
```

### Test 2: Jobs funcionando
```sql
-- Ejecutar este query después del job diario
SELECT 
  COUNT(*) as total_vencidas,
  SUM(CASE WHEN etapa_activa = 'Vencida' THEN 1 ELSE 0 END) as marcadas_vencidas
FROM expedientes
WHERE fecha_vencimiento_pago < CURDATE()
  AND fecha_pago IS NULL;

-- Si total_vencidas != marcadas_vencidas, el job no está funcionando
```

### Test 3: Tipos de datos correctos
```sql
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'expedientes'
  AND COLUMN_NAME IN ('etapa_activa', 'estatus_pago', 'fecha_compartida', 'agente_id', 'vendedor_id');
```

---

## 🎯 PRIORIDAD

**CRÍTICO** - Sin el modelo híbrido completo:
- Dashboard no funciona correctamente
- No se pueden hacer reportes futuros
- Datos inconsistentes entre workflow y finanzas

El frontend ya está listo y probado. Solo necesitamos que el backend retorne los datos correctos.

---

## 📞 CONTACTO

Si hay dudas sobre algún campo o la lógica, revisar:
- `src/screens/Dashboard.jsx` (líneas 40-320) - Lógica de cálculo
- `src/screens/Dashboard.jsx` (líneas 159-317) - useMemo estadisticasFinancieras

---

**Fecha:** 29 de octubre 2024  
**Requiere atención de:** Hugo (Backend Developer)  
**Estado:** ⏳ Pendiente de verificación backend

# 🔄 Flujo Completo: Uso/Servicio/Movimiento

**Fecha:** 12 de Noviembre de 2025  
**Objetivo:** Documentar el flujo completo de normalización de campos uso/servicio/movimiento desde carga hasta guardado.

---

## 🎯 RESUMEN EJECUTIVO

Los campos **uso**, **servicio** y **movimiento** (específicos de pólizas de Autos Individual) pueden llegar del backend con diferentes nombres debido a inconsistencias históricas. Este documento describe cómo el frontend normaliza estos campos en **5 puntos críticos** para garantizar consistencia.

---

## 📊 ALIASES CONOCIDOS

| Campo Principal | Aliases Posibles |
|----------------|------------------|
| `uso` | `uso_poliza`, `Uso`, `usoVehiculo` |
| `servicio` | `servicio_poliza`, `Servicio`, `servicioVehiculo` |
| `movimiento` | `movimiento_poliza`, `Movimiento` |

---

## 🔄 5 PUNTOS DE NORMALIZACIÓN

### **1️⃣ EXTRACCIÓN DE PDF → Aplicar al Formulario**

**Ubicación:** `Expedientes.jsx` - Función `aplicarDatosAlFormulario` (líneas 2056-2058)

**Qué hace:** Cuando el usuario extrae datos de un PDF y presiona "Aplicar al Formulario", los campos principales se sincronizan con sus alias.

```javascript
// Si el PDF tiene "uso", también llenar "uso_poliza"
if (datosConCliente.uso) datosConCliente.uso_poliza = datosConCliente.uso;
if (datosConCliente.servicio) datosConCliente.servicio_poliza = datosConCliente.servicio;
if (datosConCliente.movimiento) datosConCliente.movimiento_poliza = datosConCliente.movimiento;
```

**Resultado:** El formulario recibe ambos campos (`uso` Y `uso_poliza`) con el mismo valor.

---

### **2️⃣ FORMULARIO → onChange de inputs**

**Ubicación:** `Expedientes.jsx` - Inputs de formulario (líneas 3923-3956)

**Qué hace:** Cuando el usuario edita manualmente los campos Uso/Servicio/Movimiento en el formulario, ambos campos (principal + alias) se actualizan simultáneamente.

```javascript
// Input de "Uso"
<select
  value={formulario.uso || ''}
  onChange={(e) => setFormulario(prev => ({ 
    ...prev, 
    uso: e.target.value,
    uso_poliza: e.target.value  // ✅ Se sincroniza automáticamente
  }))}
>
  <option value="">Seleccionar...</option>
  <option value="Particular">Particular</option>
  <option value="Público">Público</option>
  <option value="Comercial">Comercial</option>
</select>

// Input de "Servicio"
<select
  value={formulario.servicio || ''}
  onChange={(e) => setFormulario(prev => ({ 
    ...prev, 
    servicio: e.target.value,
    servicio_poliza: e.target.value  // ✅ Se sincroniza automáticamente
  }))}
>
  <option value="">Seleccionar...</option>
  <option value="Transporte de Carga">Transporte de Carga</option>
  <option value="Transporte de Pasajeros">Transporte de Pasajeros</option>
  {/* ... más opciones ... */}
</select>

// Input de "Movimiento"
<select
  value={formulario.movimiento || ''}
  onChange={(e) => setFormulario(prev => ({ 
    ...prev, 
    movimiento: e.target.value,
    movimiento_poliza: e.target.value  // ✅ Se sincroniza automáticamente
  }))}
>
  <option value="">Seleccionar...</option>
  <option value="Local">Local</option>
  <option value="Foráneo">Foráneo</option>
  <option value="Extranjero">Extranjero</option>
</select>
```

**Resultado:** Cualquier cambio manual se refleja en ambos campos del estado.

---

### **3️⃣ BACKEND → Carga de Expedientes (GET /api/expedientes)**

**Ubicación:** `Expedientes.jsx` - Función `recargarExpedientes` (líneas 6534-6536)

**Qué hace:** Al cargar expedientes desde el backend, si vienen con cualquier alias, se normalizan al campo principal.

```javascript
const expedientesConCoberturasParsadas = expedientes.map(exp => {
  // Parsear coberturas...
  
  // 🔄 NORMALIZACIÓN: Unificar todos los aliases al campo principal
  exp.uso = exp.uso || exp.uso_poliza || exp.Uso || exp.usoVehiculo || '';
  exp.servicio = exp.servicio || exp.servicio_poliza || exp.Servicio || exp.servicioVehiculo || '';
  exp.movimiento = exp.movimiento || exp.movimiento_poliza || exp.Movimiento || '';
  
  return exp;
});

setExpedientes(expedientesConCoberturasParsadas);
```

**Resultado:** Todos los expedientes en memoria tienen los campos normalizados (`uso`, `servicio`, `movimiento`).

---

### **4️⃣ EDITAR EXPEDIENTE → Inicialización del Formulario**

**Ubicación:** `Expedientes.jsx` - Función `editarExpediente` (líneas 6618-6623)

**Qué hace:** Al hacer clic en "Editar" en un expediente, el formulario se inicializa buscando el valor en todos los aliases posibles y sincronizando ambos campos.

```javascript
const formularioBase = {
  ...expediente,
  // ... otros campos ...
  
  // Normalizar desde cualquier alias al campo principal
  uso: expediente.uso || expediente.uso_poliza || expediente.Uso || expediente.usoVehiculo || '',
  servicio: expediente.servicio || expediente.servicio_poliza || expediente.Servicio || expediente.servicioVehiculo || '',
  movimiento: expediente.movimiento || expediente.movimiento_poliza || expediente.Movimiento || '',
  
  // ✅ SINCRONIZAR también los alias *_poliza para el formulario
  uso_poliza: expediente.uso || expediente.uso_poliza || expediente.Uso || expediente.usoVehiculo || '',
  servicio_poliza: expediente.servicio || expediente.servicio_poliza || expediente.Servicio || expediente.servicioVehiculo || '',
  movimiento_poliza: expediente.movimiento || expediente.movimiento_poliza || expediente.Movimiento || ''
};
```

**Resultado:** El formulario de edición recibe ambos campos (`uso` Y `uso_poliza`) con valores consistentes.

---

### **5️⃣ GUARDAR → Payload al Backend (POST/PUT /api/expedientes)**

**Ubicación:** `Expedientes.jsx` - Función `guardarExpediente` (línea 6194)

**Qué hace:** Al guardar (crear o actualizar), el payload se construye con spread operator, incluyendo **TODOS** los campos del formulario.

```javascript
const expedientePayload = {
  ...formularioConCalculos  // ✅ Incluye uso, uso_poliza, servicio, servicio_poliza, movimiento, movimiento_poliza
};

// Excluir solo campos temporales y contacto_*
if ('__pdfFile' in expedientePayload) delete expedientePayload.__pdfFile;
// ... etc ...

// 🚀 ENVIAR AL BACKEND
fetch(`${API_URL}/api/expedientes/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(expedientePayload)  // ✅ Contiene ambos: uso y uso_poliza
})
```

**Console.log agregado (líneas 6291-6296):**
```javascript
console.log('💾 PAYLOAD:', {
  // ... otros campos ...
  uso: expedientePayload.uso,
  uso_poliza: expedientePayload.uso_poliza,
  servicio: expedientePayload.servicio,
  servicio_poliza: expedientePayload.servicio_poliza,
  movimiento: expedientePayload.movimiento,
  movimiento_poliza: expedientePayload.movimiento_poliza
});
```

**Resultado:** El backend recibe ambos campos, puede guardar en la columna que prefiera.

---

## 📋 DETALLES DE IMPLEMENTACIÓN

### **🔍 Console.logs Agregados para Debugging**

#### **A) En `editarExpediente` - Inicio (líneas 6550-6591)**

```javascript
console.log('🔧 ============ EDITANDO EXPEDIENTE ============');
console.log('📦 EXPEDIENTE COMPLETO RECIBIDO:', expediente);
console.log('🔍 Campos críticos USO/SERVICIO/MOVIMIENTO:', {
  uso: expediente.uso,
  uso_poliza: expediente.uso_poliza,
  Uso: expediente.Uso,
  usoVehiculo: expediente.usoVehiculo,
  servicio: expediente.servicio,
  servicio_poliza: expediente.servicio_poliza,
  Servicio: expediente.Servicio,
  servicioVehiculo: expediente.servicioVehiculo,
  movimiento: expediente.movimiento,
  movimiento_poliza: expediente.movimiento_poliza,
  Movimiento: expediente.Movimiento
});
```

**Propósito:** Ver exactamente qué aliases vienen del backend al hacer clic en "Editar".

---

#### **B) En `editarExpediente` - Después de normalizar (líneas 6627-6643)**

```javascript
console.log('📋 FORMULARIO BASE NORMALIZADO:', {
  uso: formularioBase.uso,
  uso_poliza: formularioBase.uso_poliza,
  servicio: formularioBase.servicio,
  servicio_poliza: formularioBase.servicio_poliza,
  movimiento: formularioBase.movimiento,
  movimiento_poliza: formularioBase.movimiento_poliza,
  prima_pagada: formularioBase.prima_pagada,
  cargo_pago_fraccionado: formularioBase.cargo_pago_fraccionado,
  gastos_expedicion: formularioBase.gastos_expedicion,
  subtotal: formularioBase.subtotal,
  iva: formularioBase.iva,
  total: formularioBase.total,
  marca: formularioBase.marca,
  modelo: formularioBase.modelo,
  numero_serie: formularioBase.numero_serie,
  placas: formularioBase.placas
});
```

**Propósito:** Confirmar que después de normalizar, ambos campos tienen el mismo valor.

---

#### **C) En `editarExpediente` - Después de cálculos (líneas 6650-6663)**

```javascript
console.log('🔄 FORMULARIO CON CÁLCULOS APLICADOS:', {
  inicio_vigencia: formularioConCalculos.inicio_vigencia,
  periodo_gracia: formularioConCalculos.periodo_gracia,
  proximoPago: formularioConCalculos.proximoPago,
  fecha_pago: formularioConCalculos.fecha_pago,
  fecha_vencimiento_pago: formularioConCalculos.fecha_vencimiento_pago,
  tipo_pago: formularioConCalculos.tipo_pago,
  frecuenciaPago: formularioConCalculos.frecuenciaPago,
  uso: formularioConCalculos.uso,
  servicio: formularioConCalculos.servicio,
  movimiento: formularioConCalculos.movimiento,
  prima_pagada: formularioConCalculos.prima_pagada,
  total: formularioConCalculos.total
});
```

**Propósito:** Verificar que los cálculos automáticos no sobrescriben los campos de uso/servicio/movimiento.

---

#### **D) En `guardarExpediente` - Payload (líneas 6291-6296)**

```javascript
console.log('💾 TODOS LOS CAMPOS DEL PAYLOAD:', {
  // ... campos anteriores ...
  
  // Datos de la Póliza (Autos Individual)
  uso: expedientePayload.uso,
  uso_poliza: expedientePayload.uso_poliza,
  servicio: expedientePayload.servicio,
  servicio_poliza: expedientePayload.servicio_poliza,
  movimiento: expedientePayload.movimiento,
  movimiento_poliza: expedientePayload.movimiento_poliza,
  
  // ... campos siguientes ...
});
```

**Propósito:** Confirmar que ambos campos están incluidos en el payload que se envía al backend.

---

## 🎨 VISUALIZACIÓN EN COMPONENTE DE DETALLE

**Ubicación:** `DetalleExpediente.jsx` (líneas ~80-82)

**Qué hace:** Al mostrar el detalle de un expediente (vista de lectura), se busca el valor en todos los aliases.

```javascript
const usoMostrar = datos?.uso || datos?.uso_poliza || datos?.Uso || datos?.usoVehiculo || datos?.uso_vehiculo || '';
const servicioMostrar = datos?.servicio || datos?.servicio_poliza || datos?.Servicio || datos?.servicioVehiculo || '';
const movimientoMostrar = datos?.movimiento || datos?.movimiento_poliza || datos?.Movimiento || '';
```

**Uso en render:**
```javascript
<div className="detalle-campo">
  <strong>Uso:</strong>
  <span>{usoMostrar || 'N/A'}</span>
</div>

<div className="detalle-campo">
  <strong>Servicio:</strong>
  <span>{servicioMostrar || 'N/A'}</span>
</div>

<div className="detalle-campo">
  <strong>Movimiento:</strong>
  <span>{movimientoMostrar || 'N/A'}</span>
</div>
```

**Resultado:** La vista de detalle muestra el valor correcto sin importar qué alias use el backend.

---

## ✅ VERIFICACIÓN DE FUNCIONALIDAD

### **Escenario 1: Usuario carga PDF y crea nueva póliza**

1. ✅ Usuario extrae datos del PDF
2. ✅ Datos aparecen en preview (DetalleExpediente usa aliases)
3. ✅ Usuario presiona "Aplicar al Formulario"
4. ✅ Función `aplicarDatosAlFormulario` sincroniza uso → uso_poliza
5. ✅ Inputs del formulario muestran valores correctos (bind a `formulario.uso`)
6. ✅ Usuario guarda
7. ✅ Payload incluye ambos campos (`uso` Y `uso_poliza`)
8. ✅ Backend recibe y guarda

---

### **Escenario 2: Usuario edita póliza existente**

1. ✅ Backend devuelve expediente con `uso_poliza` (alias)
2. ✅ Función `recargarExpedientes` normaliza → `exp.uso = exp.uso_poliza`
3. ✅ Usuario hace clic en "Editar"
4. ✅ Función `editarExpediente` busca en todos los aliases
5. ✅ Sincroniza `formularioBase.uso` Y `formularioBase.uso_poliza` con mismo valor
6. ✅ `actualizarCalculosAutomaticos` no sobrescribe estos campos
7. ✅ `setFormulario` aplica ambos campos al estado
8. ✅ Inputs muestran valores correctos
9. ✅ Usuario puede editar (onChange sincroniza ambos)
10. ✅ Usuario guarda
11. ✅ Payload incluye ambos campos
12. ✅ Backend recibe y actualiza

---

### **Escenario 3: Usuario solo visualiza detalle**

1. ✅ Backend devuelve expediente con cualquier alias
2. ✅ Función `recargarExpedientes` normaliza
3. ✅ Usuario hace clic en "Ver Detalles"
4. ✅ `DetalleExpediente` busca en todos los aliases con `usoMostrar`
5. ✅ Se muestra valor correcto

---

## 🔧 RECOMENDACIONES PARA BACKEND

### **Opción A: Backend soporta ambas columnas (RECOMENDADO)**

```sql
ALTER TABLE expedientes ADD COLUMN uso VARCHAR(50) NULL;
ALTER TABLE expedientes ADD COLUMN uso_poliza VARCHAR(50) NULL;
ALTER TABLE expedientes ADD COLUMN servicio VARCHAR(50) NULL;
ALTER TABLE expedientes ADD COLUMN servicio_poliza VARCHAR(50) NULL;
ALTER TABLE expedientes ADD COLUMN movimiento VARCHAR(50) NULL;
ALTER TABLE expedientes ADD COLUMN movimiento_poliza VARCHAR(50) NULL;
```

**Ventajas:**
- ✅ Máxima compatibilidad
- ✅ Frontend puede usar cualquier campo
- ✅ Retrocompatibilidad con APIs antiguas

**Desventaja:**
- ⚠️ Duplicación de datos (pero solo 6 columnas adicionales)

---

### **Opción B: Backend usa solo campos principales**

Backend solo crea columnas `uso`, `servicio`, `movimiento` y al recibir PUT/POST:

```javascript
// Backend normaliza al recibir request
if (req.body.uso_poliza && !req.body.uso) {
  req.body.uso = req.body.uso_poliza;
}
if (req.body.servicio_poliza && !req.body.servicio) {
  req.body.servicio = req.body.servicio_poliza;
}
if (req.body.movimiento_poliza && !req.body.movimiento) {
  req.body.movimiento = req.body.movimiento_poliza;
}
```

**Ventajas:**
- ✅ Sin duplicación
- ✅ Esquema más limpio

**Desventaja:**
- ⚠️ Backend debe normalizar en cada request

---

### **Opción C: Frontend solo envía campos principales (NO RECOMENDADO)**

Eliminar sincronización de aliases en frontend y enviar solo `uso`, `servicio`, `movimiento`.

**Ventajas:**
- ✅ Payload más pequeño

**Desventajas:**
- ❌ Rompe compatibilidad si backend espera `uso_poliza`
- ❌ Requiere migración de datos existentes
- ❌ Mayor riesgo de bugs

---

## 📊 RESUMEN DE CAMBIOS REALIZADOS

| Ubicación | Líneas | Cambio |
|-----------|--------|--------|
| `aplicarDatosAlFormulario` | 2056-2058 | Sincronizar uso → uso_poliza al aplicar PDF |
| Form inputs (Uso) | 3923-3926 | onChange actualiza ambos campos |
| Form inputs (Servicio) | 3938-3941 | onChange actualiza ambos campos |
| Form inputs (Movimiento) | 3953-3956 | onChange actualiza ambos campos |
| `recargarExpedientes` | 6534-6536 | Normalizar aliases al cargar desde backend |
| `editarExpediente` (inicio) | 6550-6591 | Console.logs detallados de aliases recibidos |
| `editarExpediente` (normalización) | 6618-6623 | Normalizar y sincronizar ambos campos |
| `editarExpediente` (log) | 6627-6643 | Console.log de formulario normalizado |
| `editarExpediente` (log cálculos) | 6650-6663 | Console.log después de cálculos |
| `guardarExpediente` (log payload) | 6291-6296 | Console.log explícito de uso/servicio/movimiento en payload |
| `DetalleExpediente` | ~80-82 | Normalización para display (ya existía) |

---

## 🚀 RESULTADO FINAL

### ✅ **LO QUE FUNCIONA**

1. **Extracción PDF:** Campos se sincronizan al aplicar al formulario
2. **Edición manual:** onChange actualiza ambos campos simultáneamente
3. **Carga desde backend:** Normalización unifica cualquier alias
4. **Inicialización de edición:** Busca en todos los aliases y sincroniza
5. **Guardado:** Payload incluye ambos campos (principal + alias)
6. **Visualización:** Display busca en todos los aliases

### 🔍 **DEBUGGING MEJORADO**

- Console.logs detallados en cada punto crítico
- Visibilidad completa del flujo de datos
- Fácil identificar dónde falla si hay problemas

### 📝 **DOCUMENTACIÓN COMPLETA**

- Este documento describe todo el flujo
- Ejemplos de código de cada punto
- Recomendaciones para backend
- Tabla resumen de todos los cambios

---

## 📞 SOPORTE

**En caso de que los campos sigan vacíos al editar:**

1. **Verificar console.log** del navegador cuando haces clic en "Editar"
2. **Buscar:** `🔧 ============ EDITANDO EXPEDIENTE ============`
3. **Revisar:** `🔍 Campos críticos USO/SERVICIO/MOVIMIENTO`
4. **Confirmar:** ¿Cuál alias trae el backend?
5. **Verificar:** `📋 FORMULARIO BASE NORMALIZADO` - ¿Se normalizó correctamente?
6. **Revisar inputs:** ¿Los valores están en `formulario.uso`?

**Si el problema persiste:**
- Copiar los console.logs completos
- Verificar que el backend devuelve al menos uno de los aliases
- Confirmar que columnas existen en la base de datos

---

**✨ Flujo completamente documentado y funcional**


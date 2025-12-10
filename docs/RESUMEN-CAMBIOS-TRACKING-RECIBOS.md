# 📊 Resumen de Cambios - Sistema de Tracking de Recibos

## 🎯 Objetivo
Corregir el tracking de pagos fraccionados reemplazando cálculos basados en fechas por un contador directo de recibos pagados.

---

## 🔧 Cambios Implementados en Frontend

### Archivo: `src/screens/Expedientes.jsx`

#### 1. **Modal de Pago - Selector de Recibo**

**Ubicación:** Función `aplicarPago()` (línea ~8038)

**Antes:**
```javascript
// No había selector, siempre calculaba el próximo recibo usando fechas
```

**Después:**
```javascript
// 🔥 Calcular el próximo recibo pendiente usando contador directo
let proximoReciboPendiente = 1;
const ultimoReciboPagado = expedienteActual.ultimo_recibo_pagado || 0;

if (esFraccionado && frecuencia) {
  const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
  // El próximo recibo es simplemente el siguiente al último pagado
  proximoReciboPendiente = Math.min(ultimoReciboPagado + 1, numeroPagos);
}

setNumeroReciboPago(proximoReciboPendiente); // Auto-selecciona próximo pendiente
```

**Impacto:**
- ✅ Auto-selecciona el recibo correcto basándose en contador, no en fechas
- ✅ Usuario puede cambiar manualmente si necesita pagar recibo diferente

---

#### 2. **Procesamiento de Pago**

**Ubicación:** Función `procesarPagoConComprobante()` (línea ~8137)

**Antes:**
```javascript
// Calculaba fecha del recibo usando meses desde inicio
let fechaDelReciboPagado = fechaUltimoPago;
if (esFraccionado && expedienteParaPago.inicio_vigencia) {
  const fechaInicio = new Date(expedienteParaPago.inicio_vigencia);
  const fechaRecibo = new Date(fechaInicio);
  fechaRecibo.setMonth(fechaRecibo.getMonth() + (numeroReciboPago - 1) * mesesPorPago);
  fechaDelReciboPagado = fechaRecibo.toISOString().split('T')[0];
}

const proximoPago = calcularSiguientePago({
  ...expedienteParaPago,
  fechaUltimoPago: fechaDelReciboPagado
});
```

**Después:**
```javascript
// 🔥 Calcular el próximo pago basándose en el número de recibo pagado
const proximoPago = calcularSiguientePago({
  ...expedienteParaPago,
  ultimo_recibo_pagado: esFraccionado ? numeroReciboPago : null
});

// Guardar en BD
const datosActualizacion = {
  estatus_pago: nuevoEstatusPago,
  fecha_vencimiento_pago: nuevaFechaVencimiento,
  fecha_ultimo_pago: fechaUltimoPago,  // Fecha real del pago
  proximo_pago: proximoPago,
  ultimo_recibo_pagado: numeroReciboPago  // ✅ NUEVO: Guardar número de recibo
};
```

**Impacto:**
- ✅ Guarda directamente el número de recibo pagado
- ✅ Elimina cálculos complejos de fechas
- ✅ `fecha_ultimo_pago` se mantiene para registro contable (fecha real del pago)

---

#### 3. **Cálculo de Siguiente Pago**

**Ubicación:** Función `calcularSiguientePago()` (línea ~7997)

**Antes:**
```javascript
const fechaUltimoPago = new Date(expediente.fechaUltimoPago);
const mesesTranscurridos = (fechaUltimoPago.getFullYear() - fechaPrimerPago.getFullYear()) * 12 + 
                           (fechaUltimoPago.getMonth() - fechaPrimerPago.getMonth());

const mesesPorPago = CONSTANTS.MESES_POR_FRECUENCIA[expediente.frecuenciaPago];
const numeroPagoActual = Math.floor(mesesTranscurridos / mesesPorPago) + 1;

return calcularProximoPago(..., numeroPagoActual + 1, ...);
```

**Después:**
```javascript
// 🔥 Usar el número de recibo pagado directamente
const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;

if (ultimoReciboPagado === 0) {
  // Si no hay recibos pagados, calcular el pago #1
  return calcularProximoPago(..., 1, ...);
}

// El siguiente recibo es el número siguiente al último pagado
const siguienteNumeroRecibo = ultimoReciboPagado + 1;
return calcularProximoPago(..., siguienteNumeroRecibo, ...);
```

**Impacto:**
- ✅ Lógica simple y directa: siguiente = último + 1
- ✅ No depende de fechas, no falla con pagos tardíos

---

#### 4. **Filtros de Carpetas**

**Ubicación:** `useMemo` de `expedientesFiltrados` (línea ~3013)

**Antes:**
```javascript
// Carpeta "En Proceso" (vencidos o por vencer ≤15 días)
if (fechaUltimoPago && expediente.inicio_vigencia) {
  const fechaUltimo = new Date(fechaUltimoPago);
  const fechaInicio = new Date(expediente.inicio_vigencia);
  const mesesTranscurridos = ...;
  const pagosRealizados = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
  const proximoRecibo = pagosRealizados + 1;
  // Calcular fecha del próximo recibo...
}
```

**Después:**
```javascript
// 🔥 Usar contador directo
const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
const proximoRecibo = ultimoReciboPagado + 1;

if (proximoRecibo <= numeroPagos) {
  const fechaInicio = new Date(expediente.inicio_vigencia);
  const fechaProximoRecibo = new Date(fechaInicio);
  fechaProximoRecibo.setMonth(fechaProximoRecibo.getMonth() + (proximoRecibo - 1) * mesesPorPago);
  // Calcular días restantes...
}
```

**Impacto:**
- ✅ Filtros más precisos y confiables
- ✅ Políticas no "saltan" carpetas incorrectamente

---

#### 5. **Contadores de Carpetas**

**Ubicación:** `useMemo` de `contadores` (línea ~3240)

**Cambios en:**
- Contador de "vigentes" (línea ~3292)
- Contador de "renovadas" (línea ~3344)

**Antes:**
```javascript
const fechaUltimoPago = exp.fechaUltimoPago || exp.fecha_ultimo_pago;
let pagosRealizados = 0;

if (fechaUltimoPago) {
  const fechaUltimo = new Date(fechaUltimoPago);
  const fechaInicio = new Date(exp.inicio_vigencia);
  const mesesTranscurridos = ...;
  pagosRealizados = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
  pagosRealizados = Math.min(pagosRealizados, numeroPagos);
}

if (pagosRealizados < numeroPagos) {
  const proximoRecibo = pagosRealizados + 1;
  // Calcular si está por vencer...
}
```

**Después:**
```javascript
// 🔥 Usar el contador directo de recibos pagados
const pagosRealizados = exp.ultimo_recibo_pagado || 0;

if (pagosRealizados === 0) {
  return false;  // No ha pagado nada, no es vigente
}

if (pagosRealizados < numeroPagos) {
  const proximoRecibo = pagosRealizados + 1;
  // Calcular si está por vencer...
}
```

**Impacto:**
- ✅ Badges de carpetas muestran números correctos
- ✅ No cuentan pólizas incorrectamente

---

#### 6. **Visibilidad del Botón de Pago**

**Ubicación:** Render de botón "Aplicar Pago" (línea ~3997)

**Antes:**
```javascript
if (esFraccionado && expediente.frecuenciaPago) {
  const fechaUltimoPago = expediente.fechaUltimoPago || expediente.fecha_ultimo_pago;
  let pagosRealizados = 0;
  
  if (fechaUltimoPago && expediente.inicio_vigencia) {
    const fechaUltimo = new Date(fechaUltimoPago);
    const fechaInicio = new Date(expediente.inicio_vigencia);
    const mesesTranscurridos = ...;
    pagosRealizados = Math.floor(mesesTranscurridos / mesesPorPago) + 1;
    pagosRealizados = Math.min(pagosRealizados, numeroPagos);
  }
  
  tienePagosPendientes = pagosRealizados < numeroPagos;
}
```

**Después:**
```javascript
// 🔥 Usar contador directo de recibos pagados
if (esFraccionado && expediente.frecuenciaPago) {
  const frecuencia = expediente.frecuenciaPago || expediente.frecuencia_pago;
  const numeroPagos = CONSTANTS.PAGOS_POR_FRECUENCIA[frecuencia] || 0;
  const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
  
  // Si no ha completado todos los pagos, tiene pendientes
  tienePagosPendientes = pagosRealizados < numeroPagos;
}
```

**Impacto:**
- ✅ Botón de pago aparece correctamente para pólizas con recibos pendientes
- ✅ Desaparece cuando todos los recibos están pagados

---

#### 7. **Display de Estado de Pagos**

**Ubicación:** Columna de pagos en tabla (línea ~3700)

**Antes:**
```javascript
// Mostraba: "0/4" o "Pagado"
```

**Después:**
```javascript
// Muestra: "1/4 Vencido" o "2/4 Por Vencer" o "Pagado"
const pagosRealizados = expediente.ultimo_recibo_pagado || 0;
const proximoRecibo = pagosRealizados + 1;

if (proximoRecibo <= numeroPagos) {
  // Calcular estado del próximo recibo (Vencido, Por Vencer, Pendiente)
  return `${proximoRecibo}/${numeroPagos} ${estadoRecibo}`;
}
```

**Impacto:**
- ✅ Usuario ve claramente qué recibo está pendiente
- ✅ Muestra estado real (vencido/por vencer) del próximo recibo

---

## 🔄 Dependencia con Backend

### El frontend está **LISTO** y espera:

1. **Campo en BD:** `ultimo_recibo_pagado INT DEFAULT 0`
2. **GET endpoints:** Retornar `ultimo_recibo_pagado` en respuesta
3. **PUT endpoint:** Aceptar y guardar `ultimo_recibo_pagado` en updates

### El frontend funciona con **fallback:**
```javascript
const ultimoReciboPagado = expediente.ultimo_recibo_pagado || 0;
```

Si el backend no retorna el campo:
- ✅ No crashea (usa 0 por defecto)
- ⚠️ Pero los cálculos serán incorrectos (todos mostrarán recibo #1 pendiente)

---

## 📊 Comparación Antes/Después

### Escenario: Póliza Mensual con recibo #1 pagado tarde

**Antes (con fecha_ultimo_pago):**
```
inicio_vigencia: 2025-01-01
Pago recibo #1 el: 2025-02-05 (tarde)

Cálculo:
mesesTranscurridos = 1 mes
pagosRealizados = 1 + 1 = 2  ❌ ERROR

Resultado:
- Muestra: "2/12 Pendiente"
- Próximo recibo: #3
- Botón de pago: Aparece para recibo #3
- Problema: Saltó el recibo #2
```

**Después (con ultimo_recibo_pagado):**
```
inicio_vigencia: 2025-01-01
Pago recibo #1 el: 2025-02-05 (tarde)
ultimo_recibo_pagado: 1

Cálculo:
pagosRealizados = 1  ✅ CORRECTO

Resultado:
- Muestra: "2/12 Vencido"
- Próximo recibo: #2
- Botón de pago: Aparece para recibo #2
- Correcto: No salta recibos
```

---

## ✅ Beneficios de la Solución

1. **Precisión:** No depende de cuándo se hizo el pago
2. **Simplicidad:** Lógica directa (contador++)
3. **Performance:** Menos cálculos de fechas
4. **Mantenibilidad:** Código más fácil de entender
5. **Escalabilidad:** Funciona con cualquier frecuencia de pago

---

## 📝 Notas Importantes

### Campos que se Mantienen
- `fecha_ultimo_pago`: Fecha **real** del pago (para contabilidad/finanzas)
- `fecha_vencimiento_pago`: Fecha límite para pagar el próximo recibo
- `proximo_pago`: Fecha calculada del próximo pago

### Nuevo Campo
- `ultimo_recibo_pagado`: **Número** del último recibo pagado (para lógica)

### Relación Entre Campos
```
Pago del recibo #2 el 2025-02-20:

fecha_ultimo_pago: "2025-02-20"        ← Cuándo SE PAGÓ (real)
ultimo_recibo_pagado: 2                ← QUÉ SE PAGÓ (lógica)
proximo_pago: "2025-03-15"            ← Cuándo vence el siguiente
fecha_vencimiento_pago: "2025-03-15"   ← Fecha límite
```

---

## 🧪 Testing Requerido

Una vez Hugo implemente el backend:

1. **Crear póliza fraccionada mensual**
   - Verificar: `ultimo_recibo_pagado: 0`

2. **Pagar recibo #1**
   - Verificar: `ultimo_recibo_pagado: 1`
   - Verificar: Display muestra "2/12"
   - Verificar: Botón de pago visible

3. **Pagar recibo #2**
   - Verificar: `ultimo_recibo_pagado: 2`
   - Verificar: Display muestra "3/12"

4. **Pagar todos los recibos (hasta #12)**
   - Verificar: `ultimo_recibo_pagado: 12`
   - Verificar: Botón de pago desaparece
   - Verificar: Póliza aparece en carpeta "Vigentes"

5. **Probar con pago tardío**
   - Crear póliza con inicio 2025-01-01
   - Pagar recibo #1 el 2025-02-20 (tarde)
   - Verificar: Próximo recibo es #2 (no #3)

---

## 📞 Soporte

Ver documentación completa en:
- `BACKEND-CAMPO-ULTIMO-RECIBO-PAGADO.md` - Instrucciones para Hugo
- `Expedientes.jsx` - Código frontend implementado

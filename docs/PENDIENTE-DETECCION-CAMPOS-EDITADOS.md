# PENDIENTE: Detección de Campos Editados vs Auto-llenados

## Estado Actual (26 Nov 2025 - 00:00)

### ✅ Funcionalidades Implementadas y FUNCIONANDO

1. **Quitar pago manualmente** 
   - ✅ Detecta cambio de estatus
   - ✅ Revierte etapa de "En Vigencia" → "Emitida"
   - ✅ Muestra badge "⚠️ PAGO REMOVIDO"
   - ✅ Muestra "📂 Póliza movida a: Emitida"

2. **Aplicar pago con botón**
   - ✅ Actualiza estatus y etapa
   - ✅ Registra log con comprobante
   - ✅ Refresca vista automáticamente después del modal

3. **Aplicar pago manualmente (editar estatus)**
   - ✅ Detecta cambio a "Pagado"
   - ✅ Actualiza etapa a "En Vigencia" automáticamente
   - ✅ Muestra badge "🟢 PAGO APLICADO MANUALMENTE"
   - ✅ Muestra "📂 Póliza movida a: En Vigencia"

4. **Log consolidation**
   - ✅ Un solo log por edición (no múltiples entradas)
   - ✅ Badges destacados para cambios de pago
   - ✅ Info de carpeta/etapa siempre presente
   - ✅ Formato multi-línea con saltos de línea

### ⚠️ PROBLEMA PENDIENTE: Detección de Campos Editados

**Síntoma:**
Al editar una póliza y aplicar pago manualmente, el log muestra campos de contacto como modificados cuando NO fueron editados:
- Nombre del contacto: "vacío" → "ALVARO IVAN"
- Apellido paterno del contacto: "vacío" → "GONZALEZ"
- etc.

**Causa Raíz:**
El problema está en cómo se comparan los datos:
- `expedienteEnBD` (de la lista en memoria) puede tener campos de contacto como `null`
- `formularioParaGuardar` tiene esos campos con valores porque el formulario los carga del cliente
- La comparación detecta `null` → "ALVARO IVAN" como cambio, aunque el usuario NO editó nada

**Código Afectado:**
```javascript
// Archivo: src/screens/Expedientes.jsx
// Líneas: ~7425-7530

// Comparación actual:
const expedienteEnBD = expedientes.find(exp => exp.id === formularioParaGuardar.id);
const valorAnterior = normalizar(expedienteEnBD[key], esFecha);
const valorNuevo = normalizar(formularioParaGuardar[key], esFecha);
```

**Soluciones Propuestas (NO implementadas aún):**

### Opción 1: Traer expediente fresco de BD antes de comparar
```javascript
// Antes de comparar, traer datos frescos:
const respuesta = await fetch(`${API_URL}/api/expedientes/${formularioParaGuardar.id}`);
const expedienteEnBD = await respuesta.json();

// Esto asegura que expedienteEnBD tiene TODOS los campos completos
```

**Pros:** Garantiza datos completos y actualizados
**Contras:** Llamada extra a la BD

### Opción 2: Usar snapshot del formulario al abrirlo
```javascript
// Ya existe formularioOriginal que se captura al abrir edición
const expedienteAnterior = formularioOriginal || expedientes.find(...);

// Esto compara contra lo que el usuario VIO al abrir el formulario
```

**Pros:** No requiere llamada extra
**Contras:** Depende de que el snapshot se capture correctamente (actualmente comentado)

### Opción 3: Comparar solo campos que están en payload final
```javascript
// Solo comparar campos que realmente se van a guardar
// Excluir campos que se eliminan del payload antes del PUT
```

**Pros:** Simple, compara solo lo que se guarda
**Contras:** Puede perder visibilidad de algunos cambios

## Próximos Pasos (Mañana)

1. **Decidir estrategia:** ¿Opción 1, 2, o 3?
2. **Implementar solución elegida**
3. **Probar casos:**
   - Editar solo campos de contacto (deben detectarse)
   - Aplicar pago sin tocar contactos (NO deben detectarse como cambios)
   - Editar otros campos (fechas, montos, etc.)

## Notas Técnicas

- Los campos de contacto se eliminan del payload antes del PUT (líneas 7209-7214)
- La función `normalizar()` maneja correctamente fechas y valores vacíos
- El sistema de badges y carpetas funciona perfectamente
- Hugo debe implementar generación de `fecha_evento` en backend (ver: URGENTE-HUGO-FECHA-EVENTO-SERVIDOR.md)

## Commit Actual
```
8909136 - WIP: Log consolidation y mejoras en detección de cambios
```

**Archivo guardado:** 26 Nov 2025, 00:00 hrs
**Estado:** Código subido a GitHub, pendiente de resolver detección de campos

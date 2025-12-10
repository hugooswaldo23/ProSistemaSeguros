# 📋 RECORDATORIO - Próxima Sesión

**Fecha creación**: 5 de diciembre de 2025

## 🎯 Tareas Prioritarias

### 1. 🔄 Refactorización Estructural: Producto → Ramo
**Impacto**: Alto | **Prioridad**: Alta

Normalizar conceptos en todo el sistema:

#### Cambios a realizar:
- **Renombrar campos**:
  - `producto` → `ramo` (Autos, Vida, GMM, Daños, etc.)
  - `tipo_cobertura` → `producto` (Amplia, Limitada, RC, "Tu Auto Seguro Más", etc.)

#### Archivos a modificar:
1. **Backend (Hugo)**:
   - Tabla `expedientes`: Renombrar columnas
   - Nueva tabla `ramos` (catálogo)
   - Actualizar tabla `tipos_productos` → `productos`
   - Migración de datos existentes

2. **Frontend**:
   - `src/screens/Expedientes.jsx`:
     - Formulario (líneas ~4830-4900)
     - Catálogos (líneas ~6234-6250)
     - Función `handleDataExtracted`
   - `src/components/DetalleExpediente.jsx`
   - Componentes de visualización
   - Filtros y reportes

3. **Extractores PDF**:
   - `src/lib/pdf/extractors/hdi/autos.js`
   - `src/lib/pdf/extractors/chubb/autos.js`
   - `src/lib/pdf/extractors/qualitas/autos.js`
   - `src/lib/pdf/extractors/ana/autos.js`
   - `src/lib/pdf/extractors/zurich/autos.js` ✅ (ya preparado con `producto_especifico`)

#### Beneficios:
- ✅ Estructura más clara y semántica
- ✅ Facilita catálogos específicos por ramo
- ✅ Mejor organización de productos por aseguradora
- ✅ Escalabilidad para nuevos ramos (Vida, GMM, Daños, etc.)

---

### 2. 🔍 Revisar Flujo Pólizas Zurich en Parcialidades
**Estado**: Verificar comportamiento

- [ ] Probar extracción de póliza Zurich con pagos fraccionados
- [ ] Verificar que `primer_pago` y `pagos_subsecuentes` se extraen correctamente
- [ ] Validar que el calendario de pagos se genera bien
- [ ] Confirmar que los estados de pago funcionan (Pendiente, Por Vencer, Vencido)
- [ ] Revisar cálculo de fechas con periodo de gracia (30 días para Zurich)

**Archivo**: PDF de póliza Zurich en parcialidades (si está disponible)

---

### 3. 🧹 Limpiar Logs de Depuración
**Prioridad**: Media

Actualmente hay muchos console.log que fueron útiles para desarrollo:

#### Logs a revisar/limpiar:
- `src/lib/pdf/extractors/zurich/autos.js`:
  - Línea ~68: Log completo de texto extraído (📄 ========== TEXTO EXTRAÍDO COMPLETO ==========)
  - Considerar: Dejar solo en modo debug o eliminar

- `src/screens/Expedientes.jsx`:
  - Logs de normalización de compañía/producto
  - Logs de aplicación de datos al formulario
  - Logs de calendario de pagos

#### Estrategia sugerida:
- Crear variable de entorno `DEBUG_MODE` o `VITE_DEBUG_EXTRACTORS`
- Envolver logs en condicional: `if (import.meta.env.VITE_DEBUG_EXTRACTORS) { console.log(...) }`
- Mantener logs críticos de errores

---

### 4. 📅 Revisar Calendario de Pagos
**Estado**: Funcional, validar edge cases

- [ ] Verificar visualización correcta en ambos modos (acordeón y carátula)
- [ ] Validar cálculo de fechas con diferentes frecuencias:
  - Mensual
  - Bimestral
  - Trimestral
  - Cuatrimestral
  - Semestral
  - Anual
- [ ] Confirmar estados de pago se calculan bien:
  - Pendiente (> 15 días para vencimiento)
  - Por Vencer (≤ 15 días)
  - Vencido (fecha pasada)
  - Pagado
- [ ] Verificar periodo de gracia por aseguradora:
  - Qualitas: 14 días
  - Otras: 30 días

---

## ✅ Completado en esta sesión

### Extractor Zurich - Autos
- ✅ Extractor completo operacional (457 líneas)
- ✅ 11 coberturas extraídas con 4 columnas:
  1. Daños Materiales
  2. Robo Total
  3. R.C. por daños a Terceros
  4. R.C. por Muerte de Terceros
  5. Gastos Médicos Ocupantes (L.U.C.)
  6. Protección MaZ
  7. Accidentes al Conductor y Ocupantes
  8. Multas y Corralones
  9. Asistencia Vial
  10. Asistencia Legal
  11. Responsabilidad Civil Extranjero
- ✅ Datos vehículo completos (tipo_carga, marca, modelo, año, serie, motor, placas, tipo, servicio, uso)
- ✅ Datos financieros (9 campos): prima_pagada, otros_servicios, cesion_comision, cargo_pago_fraccionado, gastos_expedicion, iva, total, primer_pago, pagos_subsecuentes
- ✅ Normalización de deducibles: "0" → "0 UMA"
- ✅ Normalización de compañía: "ZURICH" → "Zurich" (case-insensitive matching)
- ✅ Normalización de producto: "Tu Auto Seguro Más" → "Autos" (con búsqueda parcial)
- ✅ Cambios subidos a GitHub (commit b7859cb)

---

## 📝 Notas Técnicas

### Estado del Sistema
- **Extractores implementados**: HDI, Chubb, Qualitas, ANA, Zurich ✅
- **Campos en BD pendientes** (Hugo debe agregar):
  - `otros_servicios` (DECIMAL 10,2)
  - `cesion_comision` (DECIMAL 10,2)
  
### Patrones del Extractor Zurich
- **Formato nombres**: APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE (invertido)
- **Formato financial**: Renglones alternados (valores en una línea, labels en siguiente)
- **Formato vigencia**: Termino aparece ANTES de "Hasta:" label
- **Formato clave agente**: Números divididos por línea (993\n14157)
- **Formato coberturas**: Tabla de 4 columnas con headers

### Consideraciones Futuras
- Los extractores actuales asumen que `producto` es el tipo de vehículo/seguro
- Con la refactorización, `ramo` será la categoría principal
- El campo `producto_especifico` en Zurich ya guarda el nombre comercial del producto

---

## 🚀 Próximos Pasos Sugeridos

1. **Mañana**: Iniciar refactorización producto → ramo (planificar con calma)
2. **Testing**: Probar Zurich con póliza en parcialidades
3. **Limpieza**: Decidir estrategia de logs (debug mode vs producción)
4. **Validación**: Confirmar calendario de pagos funciona en todos los casos

---

**Última actualización**: 5 de diciembre de 2025, 8:36 PM

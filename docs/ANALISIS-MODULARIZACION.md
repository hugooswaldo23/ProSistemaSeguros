# 📋 ANÁLISIS DETALLADO - SECCIONES MODULARES DE EXPEDIENTES.JSX

## 🎯 MAPEO COMPLETO DE SECCIONES

### **📄 1. EXTRACTOR PDF** (Líneas ~863-3027)
- **Tamaño estimado:** ~2,164 líneas
- **Componente:** `ExtractorPolizasPDF`
- **Funcionalidades:**
  - Selección de método (auto/manual)
  - Extracción con PDF.js
  - Procesamiento OpenAI
  - Validación de clientes/agentes
  - Preview de datos extraídos
- **Hook existente:** `usePDFExtractor.js` ✅
- **Prioridad:** ALTA (gran impacto en líneas)

### **🔄 2. WORKFLOW PDF** (Dentro de extractor)
- **Hook existente:** `usePDFWorkflow.js` ✅
- **Funcionalidades:**
  - Estado de procesamiento paso a paso
  - Manejo de errores de extracción
  - Flujo de validación de datos

### **📝 3. FORMULARIOS DE CAPTURA** (Líneas ~4812+)
- **Tamaño estimado:** ~1,500+ líneas
- **Componentes:**
  - `Formulario` (manual)
  - `ModalCancelacion`
  - Formulario de edición inline
- **Funcionalidades:**
  - Captura manual de pólizas
  - Validaciones de campos
  - Cálculos automáticos
- **Prioridad:** ALTA

### **🧮 4. CÁLCULOS DE PÓLIZAS** (Líneas ~7614+)
- **Tamaño estimado:** ~400+ líneas
- **Funciones principales:**
  - `calculartermino_vigencia`
  - `calcularProximoPago`
  - `calcularEstatusPago`
  - `actualizarCalculosAutomaticos`
- **Hook potencial:** `useCalculosPolizas` (crear)
- **Prioridad:** MEDIA

### **📤 5. COMPARTIR/ENVÍOS** (Líneas ~8037+)
- **Tamaño estimado:** ~800+ líneas
- **Funciones principales:**
  - `compartirPorWhatsApp`
  - `compartirPorEmail`
  - `enviarAvisoPagoWhatsApp`
  - `enviarAvisoPagoEmail`
- **Hook existente:** `useCompartirExpediente.js` ✅
- **Prioridad:** ALTA (fácil de extraer)

### **💰 6. GESTIÓN DE PAGOS** (Líneas ~8747+)
- **Tamaño estimado:** ~600+ líneas
- **Funciones principales:**
  - `aplicarPago`
  - `procesarPagoConComprobante`
  - Modal de aplicar pago
  - Calendario de pagos
- **Hook potencial:** `usePagos` (recrear)
- **Prioridad:** MEDIA

### **👁️ 7. COMPONENTES DE VISTA** (Líneas ~3028+)
- **Tamaño estimado:** ~800+ líneas
- **Componentes:**
  - `ModalCancelacion`
  - `EstadoPago` 
  - `CalendarioPagos`
  - Tarjetas de expedientes
- **Componentes existentes:** En `/components/polizas/` ✅
- **Prioridad:** MEDIA

### **🔍 8. FILTROS Y BÚSQUEDAS** (Disperso)
- **Tamaño estimado:** ~300+ líneas
- **Funcionalidades:**
  - Filtros por etapa
  - Búsqueda de texto
  - Paginación
- **Hook existente:** `usePaginacion.js` ✅
- **Prioridad:** BAJA

### **📊 9. UTILIDADES Y HELPERS** (Líneas ~100+)
- **Tamaño estimado:** ~200+ líneas
- **Funciones:**
  - `formatearFecha`, `formatearMoneda`
  - `getBadgeClass`, `calcularDiasRestantes`
  - Constantes globales
- **Archivo potencial:** `/utils/expedientesHelpers.js`
- **Prioridad:** BAJA

---

## ✅ PLAN DE MODULARIZACIÓN PRIORIZADO

### **🥇 FASE 1 - IMPACTO INMEDIATO (~3,000 líneas)**
1. **EXTRACTOR PDF** → usar `usePDFExtractor` + `usePDFWorkflow`
2. **COMPARTIR/ENVÍOS** → usar `useCompartirExpediente`

### **🥈 FASE 2 - FORMULARIOS (~1,500 líneas)**
3. **FORMULARIO MANUAL** → crear componente separado
4. **CÁLCULOS** → crear `useCalculosPolizas`

### **🥉 FASE 3 - REFINAMIENTO (~1,000 líneas)**
5. **GESTIÓN PAGOS** → recrear `usePagos`
6. **COMPONENTES VISTA** → usar `/components/polizas/`
7. **UTILIDADES** → extraer helpers

---

## 📈 IMPACTO ESPERADO

- **Líneas actuales:** 12,350
- **Meta objetivo:** ~6,000 líneas (50% reducción)
- **Fase 1 completada:** ~8,350 líneas
- **Fase 2 completada:** ~6,850 líneas  
- **Fase 3 completada:** ~5,850 líneas ✨

---

## 💾 ESTADO ACTUAL

- ✅ **Backup creado:** `Expedientes.jsx.backup-modularizacion`
- ✅ **Hook implementado:** `useExpedientes` (-26 líneas)
- ⏳ **Siguiente:** Decidir entre Extractor PDF o Compartir/Envíos
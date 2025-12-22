# 🔍 INVENTARIO COMPLETO DE FUNCIONES - EXPEDIENTES.JSX

## 📊 ANÁLISIS FUNCIÓN POR FUNCIÓN

### 🎯 **1. COMPONENTES REUTILIZABLES (Líneas ~183-863)**

#### ✅ **Badge** (L.183)
- **Qué hace:** Componente para mostrar badges de estado (etapa, pago, etc.)
- **Dependencias:** `utils.getBadgeClass`
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/components/common/Badge.jsx`

#### ✅ **CampoFechaCalculada** (L.193)
- **Qué hace:** Input de fecha con botón de cálculo automático
- **Dependencias:** Ninguna
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/components/common/CampoFechaCalculada.jsx`

#### ✅ **InfoCliente** (L.227)
- **Qué hace:** Muestra info básica del cliente (nombre, RFC, etc.)
- **Dependencias:** Ninguna
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/components/expedientes/InfoCliente.jsx`

#### 🔄 **EstadoPago** (L.353)
- **Qué hace:** Muestra estado de pago con lógica de cálculo
- **Dependencias:** `obtenerEstatusPagoDesdeBackend`
- **Código duplicado:** ⚠️ Posible con CalendarioPagos
- **Obsoleto:** ❌ No
- **Propuesta:** 🔄 REVISAR duplicación con CalendarioPagos

#### 🔄 **CalendarioPagos** (L.370)
- **Qué hace:** Muestra calendario completo de pagos fraccionados
- **Dependencias:** `CONSTANTS.PAGOS_POR_FRECUENCIA`, `estatusPagosUtils`
- **Código duplicado:** ⚠️ Posible con EstadoPago
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ YA EXISTE en `/components/polizas/CalendarioPagos.jsx` - USAR ESE

#### ✅ **Paginacion** (L.767)
- **Qué hace:** Componente de paginación
- **Dependencias:** Ninguna
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Hook existente:** ✅ `usePaginacion.js`
- **Propuesta:** ✅ MOVER a `/components/common/` + usar hook

#### ✅ **BarraBusqueda** (L.839)
- **Qué hace:** Input de búsqueda con ícono
- **Dependencias:** Ninguna
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ YA EXISTE `/components/BarraBusqueda.jsx` - USAR ESE

---

### 📄 **2. EXTRACTOR PDF (Líneas ~864-3027)**

#### 🎯 **ExtractorPolizasPDF** (L.864)
- **Qué hace:** Componente completo de extracción PDF con flujo paso a paso
- **Dependencias:** `pdfjsLib`, OpenAI, validaciones cliente/agente
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Hook existente:** ✅ `usePDFExtractor.js`, `usePDFWorkflow.js`
- **Propuesta:** ✅ MOVER a `/components/polizas/ExtractorPolizasPDF.jsx` (YA EXISTE)

#### ⚠️ **procesarPDF** (L.926)
- **Qué hace:** Lógica de extracción con PDF.js
- **Dependencias:** `pdfjsLib`
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ INTEGRAR en `usePDFExtractor.js`

#### ⚠️ **buscarClienteExistente** (L.1006)
- **Qué hace:** Busca cliente por RFC/CURP/nombre
- **Dependencias:** API clientes
- **Código duplicado:** ⚠️ Posible con otras búsquedas
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/services/clientesService.js`

---

### 📝 **3. FORMULARIOS (Líneas ~4812+)**

#### 🎯 **Formulario** (L.4812)
- **Qué hace:** Formulario completo de captura manual de pólizas
- **Dependencias:** Agentes, aseguradoras, cálculos, validaciones
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/components/expedientes/FormularioPoliza.jsx`

#### ⚠️ **obtenerVendedoresPorAgente** (L.4856)
- **Qué hace:** Obtiene vendedores filtrados por agente
- **Dependencias:** API vendedores
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/services/vendedoresService.js`

#### 🔄 **handleDataExtracted** (L.5001)
- **Qué hace:** Procesa datos extraídos del PDF para formulario
- **Dependencias:** Cálculos, clientes, aseguradoras
- **Código duplicado:** ⚠️ Similar en ExtractorPDF
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ INTEGRAR en `usePDFExtractor.js`

---

### 🧮 **4. CÁLCULOS (Líneas ~7614+)**

#### ⚠️ **calculartermino_vigencia** (L.7614)
- **Qué hace:** Calcula término de vigencia (inicio + 1 año)
- **Dependencias:** Ninguna
- **Código duplicado:** ❌ No
- **Obsoleto:** ⚠️ Función muy simple, podría ser utility
- **Propuesta:** ✅ MOVER a `/utils/calculosPolizas.js`

#### ⚠️ **calcularProximoPago** (L.7624)
- **Qué hace:** Calcula fecha próximo pago según frecuencia
- **Dependencias:** `CONSTANTS.MESES_POR_FRECUENCIA`
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/utils/calculosPolizas.js`

#### ⚠️ **calcularEstatusPago** (L.7674)
- **Qué hace:** Calcula estatus basado en fecha próximo pago
- **Dependencias:** `utils.calcularDiasRestantes`
- **Código duplicado:** ⚠️ Similar lógica en EstadoPago
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ MOVER a `/utils/calculosPolizas.js`

#### 🎯 **actualizarCalculosAutomaticos** (L.7699)
- **Qué hace:** Función principal que recalcula todo el formulario
- **Dependencias:** Todas las funciones de cálculo
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ CREAR hook `useCalculosPolizas`

---

### 📤 **5. COMPARTIR/ENVÍOS (Líneas ~8037+)**

#### 🎯 **compartirPorWhatsApp** (L.8037)
- **Qué hace:** Compartir póliza por WhatsApp con PDF
- **Dependencias:** `pdfService`, `historialService`, `notificacionesService`
- **Código duplicado:** ⚠️ Similar a compartirPorEmail
- **Obsoleto:** ❌ No
- **Hook existente:** ✅ `useCompartirExpediente.js`
- **Propuesta:** ✅ USAR hook existente

#### 🎯 **compartirPorEmail** (L.8164)
- **Qué hace:** Compartir póliza por Email con PDF
- **Dependencias:** `pdfService`, `historialService`, `notificacionesService`
- **Código duplicado:** ⚠️ Similar a compartirPorWhatsApp
- **Obsoleto:** ❌ No
- **Hook existente:** ✅ `useCompartirExpediente.js`
- **Propuesta:** ✅ USAR hook existente

#### 🎯 **enviarAvisoPagoWhatsApp** (L.8279)
- **Qué hace:** Enviar aviso de pago por WhatsApp
- **Dependencias:** `notificacionesService`, `historialService`
- **Código duplicado:** ⚠️ Similar a enviarAvisoPagoEmail
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ INTEGRAR en `useCompartirExpediente.js`

#### 🎯 **enviarAvisoPagoEmail** (L.8420)
- **Qué hace:** Enviar aviso de pago por Email
- **Dependencias:** `notificacionesService`, `historialService`
- **Código duplicado:** ⚠️ Similar a enviarAvisoPagoWhatsApp
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ INTEGRAR en `useCompartirExpediente.js`

---

### 💰 **6. GESTIÓN DE PAGOS (Líneas ~8663+)**

#### ⚠️ **calcularSiguientePago** (L.8663)
- **Qué hace:** Calcula siguiente pago para expediente
- **Dependencias:** `calcularProximoPago`
- **Código duplicado:** ⚠️ Podría usar calcularProximoPago directamente
- **Obsoleto:** ⚠️ Wrapper innecesario
- **Propuesta:** ❌ ELIMINAR - usar calcularProximoPago directamente

#### 🎯 **aplicarPago** (L.8723)
- **Qué hace:** Modal y lógica para aplicar pagos con comprobante
- **Dependencias:** Cálculos, historial, archivos
- **Código duplicado:** ❌ No
- **Obsoleto:** ❌ No
- **Propuesta:** ✅ CREAR hook `usePagos`

---

## 🎯 **RESUMEN DE ACCIONES**

### ✅ **REUTILIZAR (usar hooks/componentes existentes)**
- `CalendarioPagos` → usar `/components/polizas/CalendarioPagos.jsx`
- `BarraBusqueda` → usar `/components/BarraBusqueda.jsx`
- `ExtractorPolizasPDF` → usar hooks `usePDFExtractor.js` + `usePDFWorkflow.js`
- `compartirPor*` → usar `useCompartirExpediente.js`

### 🏗️ **CREAR NUEVOS**
- Hook `useCalculosPolizas` para cálculos centralizados
- Hook `usePagos` para gestión de pagos
- Componente `FormularioPoliza.jsx`

### 📦 **MOVER A UTILITIES**
- Funciones de cálculo → `/utils/calculosPolizas.js`
- Búsquedas → `/services/clientesService.js`
- Componentes pequeños → `/components/common/`

### ❌ **ELIMINAR (código duplicado/obsoleto)**
- `calcularSiguientePago` (wrapper innecesario)
- Duplicaciones entre EstadoPago y CalendarioPagos

---

## 📈 **IMPACTO ESTIMADO**
- **Total líneas actuales:** 12,350
- **Líneas a extraer:** ~8,000
- **Líneas finales estimadas:** ~4,350
- **Reducción:** 65% 🎯
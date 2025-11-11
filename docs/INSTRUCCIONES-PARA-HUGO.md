# Instrucciones para Hugo – Unificación de Detalles de Expediente y pendientes por ramo

Este documento resume lo que ya quedó listo en la UI, qué falta por afinar por ramo, y cómo probar el flujo de PDFs.

## ✅ Listo en esta entrega

- Componente unificado `DetalleExpediente` como fuente única para la vista de detalles en:
  - Modal de Clientes (al ver una póliza)
  - Pantalla de Expedientes (detalle principal)
- Primer bloque "Datos Generales de Póliza" ahora es una carátula dentro de un acordeón:
  - Abierta por defecto
  - Se puede plegar/desplegar (sin Bootstrap JS, controlado por React)
- Sección combinada para Autos: "Vehículo Asegurado y Coberturas"
  - Para Autos: muestra vehículo arriba y la tabla de coberturas abajo
  - Para otros ramos, de momento se muestra "Coberturas Contratadas" (genérico)
- Estilos de secciones más cálidos: tarjetas con borde/sombra y acentos laterales
- Props del componente para ajustar comportamiento sin duplicar código:
  - `modo="caratula" | "acordeon"`
  - `caratulaColapsable` (default: `true`)
  - `autoOpenCoberturas`, `autoOpenHistorial` (boolean)
  - `showResumenChips`, `highlightPago` (boolean)
  - `historialSlot` para inyectar el componente de historial vivo

## 🧭 Archivos clave

- `src/components/DetalleExpediente.jsx`  ← Componente unificado (lógica y layout)
- `src/components/detalle-expediente.css` ← Estilos de tarjetas/acentos
- Usos:
  - `src/screens/Clientes.jsx` (modal de póliza)
  - `src/screens/Expedientes.jsx` (detalle principal) – con `historialSlot`

## 🔧 Cómo está organizado el componente

- Carátula (Datos Generales) agrupa 4 bloques: Asegurado, Póliza, Vigencia y Financiera.
- Acordeones independientes:
  - "Vehículo Asegurado y Coberturas" (si el ramo coincide con autos) o título genérico por ramo (ver abajo)
  - "Historial de Comunicaciones"
- Detección de ramo para titular el bloque combinado:
  - Autos/motos/camión ⇒ "Vehículo Asegurado y Coberturas"
  - Embarcaciones ⇒ "Embarcación Asegurada y Coberturas"
  - Vida / Salud (AP, GMM) ⇒ "Coberturas Contratadas"
  - Daños / Patrimonial ⇒ "Bien Asegurado y Coberturas"

## 🧩 Puntos pendientes por ramo (para que los tomes tú cuando toque)

1) Vida / Salud / AP / GMM
- Añadir un mini-resumen del asegurado titular en el bloque combinado (debajo del título), p. ej.: CURP, edad, suma asegurada básica.
- Mantener la tabla/listado de coberturas tal cual.

2) Daños / Hogar / Empresa
- Añadir mini-resumen del bien asegurado (domicilio del riesgo, giro si empresa, etc.).
- Mantener coberturas.

3) Embarcaciones
- Añadir mini-resumen de la embarcación (marca/modelo/eslora/matrícula, si aplica).

4) Comportamiento
- Si lo ves útil: auto-abrir el bloque combinado cuando haya coberturas o al venir de extracción PDF (`autoOpenCoberturas`).

Para cada ramo, la edición es dentro de `DetalleExpediente.jsx`. Puedes usar el `tipoRiesgo` derivado de `producto`/`tipo_de_poliza` para ramificar el render.

## 🔍 Flujo de PDFs (pruebas rápidas)

Servicio: `src/services/pdfService.js`
- `subirPDFPoliza(expedienteId, file)` → POST `${API_URL}/api/expedientes/:id/pdf`
- `obtenerURLFirmadaPDF(expedienteId, expiration)` → GET `${API_URL}/api/expedientes/:id/pdf-url`
- `eliminarPDFPoliza(expedienteId)` → DELETE `${API_URL}/api/expedientes/:id/pdf`
- Validaciones de tipo/tamaño y helpers incluidos

Prueba manual con el HTML:
- Archivo: `test-pdf-endpoint.html`
- Abre en el navegador, configura el ID de expediente, selecciona un PDF y prueba:
  - 📤 Subir PDF
  - 🔗 Obtener URL firmada
  - 🗑️ Eliminar PDF
- El HTML apunta a: `https://apiseguros.proordersistem.com.mx` (ya configurado adentro).

Requisitos para que la prueba funcione:
- Backend accesible y con CORS habilitado para el origen desde el que abras el HTML
- El expediente ID debe existir
- Si hay un gateway o auth, ajustarlo en el servidor o ampliar el tester según sea necesario

## ✅ Qué quedó pendiente mínimo para salir con Autos

- Opcional: abrir automáticamente "Vehículo Asegurado y Coberturas" si el producto es Autos (`autoOpenCoberturas`).
- Si quieres, pequeñas mejoras visuales en los headers de acordeón (iconos, colores de acento consistentes).

## 📝 Notas de implementación

- Los acordeones están controlados por estado React (no dependen de JS de Bootstrap)
- Las chips de resumen (compañía, póliza, fin de vigencia, estatus de pago) están en la cabecera de la carátula
- `highlightPago` permite colorear el estatus en base a la proximidad/atraso del vencimiento

Con esto Autos ya queda unificado y listo para liberar. Para los otros ramos, sólo hay que rellenar los mini-resúmenes en el bloque combinado.

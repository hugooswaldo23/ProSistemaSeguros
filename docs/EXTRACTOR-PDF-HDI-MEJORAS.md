# Extractor de PDF HDI - Mejoras Implementadas

## 📋 Resumen

Se completó y mejoró el extractor de pólizas PDF para **HDI Seguros**, utilizando la misma estructura de preview y población de datos al formulario que ya funciona con Qualitas.

---

## ✅ Mejoras Implementadas

### 1. **Extracción de Coberturas Mejorada**

Se implementaron 5 patrones diferentes para extraer coberturas:

#### Patrón 1: Cobertura con monto y deducible porcentual
```
Daños materiales $ 631,350.00 5% 12,972.86
```

#### Patrón 2: Cobertura POR EVENTO
```
Responsabilidad Civil por Daños a Terceros $ 3,000,000.00 POR EVENTO 0 uma 1,983.96
```

#### Patrón 3: Cobertura AMPARADA
```
Asistencia Vial AMPARADA 565.00
```

#### Patrón 4: Cobertura con monto específico sin deducible porcentual
```
Muerte del Conductor por Accidente $ 100,000.00 122.40
```

#### Patrón 5: Solo cobertura y prima (coberturas básicas)
```
Gastos Médicos Ocupantes 1,200.50
```

### 2. **Extracción de Suma Asegurada y Deducible Principal**

Se agregó lógica específica para extraer:
- **Suma Asegurada**: Del monto de Daños Materiales (cobertura principal)
- **Deducible**: Del porcentaje asociado a Daños Materiales
- **Fallback**: Si no se encuentra Daños Materiales, busca el primer patrón `$ monto deducible%`

```javascript
const danosMaterialesMatch = textoCompleto.match(/Daños?\s+[Mm]ateriales?\s+\$\s*([\d,]+\.?\d*)\s+(\d+)%/i);
```

### 3. **Extracción de Uso, Servicio y Movimiento**

Campos importantes para pólizas de autos que HDI incluye:

```javascript
uso: textoCompleto.match(/Uso[:\s]+([A-ZÁÉÍÓÚÑ]+)/i)?.[1]?.trim() || '',
servicio: textoCompleto.match(/Servicio[:\s]+([A-ZÁÉÍÓÚÑ]+)/i)?.[1]?.trim() || '',
movimiento: textoCompleto.match(/Movimiento[:\s]+([A-ZÁÉÍÓÚÑ]+)/i)?.[1]?.trim() || ''
```

### 4. **Logs de Debug Mejorados**

Se agregó un log estructurado que muestra:
- Datos del asegurado
- Información de la póliza
- Datos del vehículo
- Información financiera
- Cantidad de coberturas extraídas

```javascript
console.log('📊 Datos extraídos HDI completos:', {
  asegurado: { ... },
  poliza: { ... },
  vehiculo: { ... },
  financiero: { ... },
  coberturas: `${coberturasExtraidas.length} extraídas`
});
```

---

## 🔄 Flujo de Extracción

### Paso 1: Detección de Aseguradora
```javascript
const esHDI = /\bHDI\b/i.test(textoCompleto);
```

### Paso 2: Extracción Específica HDI
Si se detecta HDI, se aplican los patrones específicos para:
- RFC (12 o 13 caracteres, permite homoclave truncada)
- Nombre/Razón Social (múltiples estrategias de fallback)
- Domicilio y ubicación
- Datos del vehículo
- Agente
- Póliza, endoso, inciso
- Vigencia
- Forma de pago y montos
- Coberturas detalladas

### Paso 3: Normalización
- Marca del vehículo (coincide con lista disponible)
- Tipo de cobertura (Amplia/Limitada/RC)
- Forma de pago → tipo_pago + frecuenciaPago

### Paso 4: Preview y Confirmación
- Muestra vista previa usando `DetalleExpediente`
- Validación de cliente existente
- Validación de agente
- Botón "Aplicar al Formulario"

### Paso 5: Población del Formulario
- Llama a `aplicarDatos()` que ejecuta `onDataExtracted(datosConCliente)`
- Incluye archivo PDF adjunto para subida automática
- Normalización defensiva de pagos fraccionados
- Mapeo de campos (camelCase ↔ snake_case)

---

## 📊 Estructura de Datos Extraídos

### Asegurado
```javascript
{
  tipo_persona: 'Fisica' | 'Moral',
  nombre: string,
  apellido_paterno: string,
  apellido_materno: string,
  razonSocial: string,
  rfc: string,
  curp: string,
  domicilio: string,
  municipio: string,
  colonia: string,
  estado: string,
  codigo_postal: string,
  pais: string,
  email: string,
  telefono_movil: string,
  codigo_cliente: string
}
```

### Póliza
```javascript
{
  compania: 'HDI',
  producto: 'Autos Individual',
  etapa_activa: 'Emitida',
  agente: string,
  numero_poliza: string,
  endoso: string,
  inciso: string,
  plan: string,
  inicio_vigencia: 'YYYY-MM-DD',
  termino_vigencia: 'YYYY-MM-DD'
}
```

### Financiero
```javascript
{
  prima_pagada: string,
  cargo_pago_fraccionado: string,
  gastos_expedicion: string,
  subtotal: string,
  iva: string,
  total: string,
  tipo_pago: 'Anual' | 'Fraccionado',
  frecuenciaPago: 'Anual' | 'Mensual' | 'Trimestral' | 'Semestral' | 'Bimestral' | 'Cuatrimestral',
  forma_pago: string,
  primer_pago: string,
  pagos_subsecuentes: string,
  periodo_gracia: string
}
```

### Vehículo
```javascript
{
  marca: string,
  modelo: string,
  anio: string,
  numero_serie: string,
  motor: string,
  placas: string,
  color: string,
  tipo_vehiculo: string,
  tipo_cobertura: 'Amplia' | 'Limitada' | 'RC (Responsabilidad Civil)',
  suma_asegurada: string,
  deducible: string,
  uso: string,
  servicio: string,
  movimiento: string,
  conductor_habitual: string
}
```

### Coberturas
```javascript
coberturas: [
  {
    nombre: string,
    suma_asegurada: string | 'AMPARADA' | 'N/A',
    deducible: string | 'N/A',
    prima: string,
    tipo: 'monto' | 'por_evento' | 'amparada' | 'cobertura_basica'
  }
]
```

---

## 🎯 Compatibilidad

### ✅ Funciona con:
- **Preview de datos**: Usa el componente `DetalleExpediente` unificado
- **Validación de cliente**: Busca cliente existente por RFC/CURP/nombre
- **Validación de agente**: Busca agente en equipo de trabajo
- **Población de formulario**: Mapea todos los campos correctamente
- **Subida de PDF**: Adjunta el archivo para subida automática post-creación

### ✅ Reutiliza:
- Modal de extracción (`ModalExtractorPDF`)
- Componente de detalle (`DetalleExpediente`)
- Función `aplicarDatos()`
- Validaciones de pagos fraccionados
- Normalización de campos

---

## 🧪 Pruebas Recomendadas

### 1. Extracción Básica
- [ ] Subir PDF de HDI Autos Individual
- [ ] Verificar que detecte correctamente la aseguradora
- [ ] Revisar logs de extracción en consola

### 2. Datos del Asegurado
- [ ] Persona Física: nombre y apellidos correctos
- [ ] Persona Moral: razón social correcta
- [ ] RFC detectado (12 o 13 caracteres)
- [ ] Domicilio completo con CP, municipio, estado

### 3. Datos de la Póliza
- [ ] Número de póliza, endoso, inciso
- [ ] Agente con código y nombre
- [ ] Vigencia inicio y término

### 4. Datos Financieros
- [ ] Prima, IVA, total
- [ ] Tipo de pago y frecuencia
- [ ] Primer pago y pagos subsecuentes (si aplica)
- [ ] Periodo de gracia (14 días default)

### 5. Datos del Vehículo
- [ ] Marca, modelo, año
- [ ] Número de serie (17 caracteres)
- [ ] Placas, color
- [ ] Uso, servicio, movimiento

### 6. Coberturas
- [ ] Al menos 3-5 coberturas extraídas
- [ ] Suma asegurada y deducible principal
- [ ] Primas individuales por cobertura

### 7. Preview y Aplicación
- [ ] Vista previa muestra todos los datos
- [ ] Cliente existente se detecta correctamente
- [ ] Agente existente se detecta correctamente
- [ ] Botón "Aplicar al Formulario" funciona
- [ ] Todos los campos se poblan correctamente

---

## 🔍 Debugging

### Activar Logs Detallados

Los logs ya están implementados, solo abrir la consola del navegador:

```
🎯 Aplicando extractor especializado para HDI
🔍 RFC extraído: ...
👤 Nombre / Razón social HDI determinado: ...
🏠 Domicilio extraído: ...
🚗 Marca extraída: ...
🛡️ Extrayendo coberturas HDI...
✅ Cobertura HDI extraída: ...
📊 Datos extraídos HDI completos: { ... }
```

### Errores Comunes

1. **RFC no encontrado**: Se abrirá modal para capturar RFC manualmente o seleccionar tipo de persona
2. **Nombre no encontrado**: Se usarán fallbacks múltiples
3. **Coberturas no extraídas**: Verificar que el PDF tenga sección "COBERTURAS CONTRATADAS"
4. **Montos vacíos**: Algunos PDFs pueden tener formato diferente, revisar patrones

---

## 📝 Notas Importantes

### Diferencias entre HDI y Qualitas

| Campo | HDI | Qualitas |
|-------|-----|----------|
| RFC homoclave | Puede truncarse (12 chars) | Siempre 13 chars |
| Nombre | Requiere múltiples fallbacks | Etiqueta clara "INFORMACIÓN DEL ASEGURADO" |
| Vigencia | Formato: DD/MM/YYYY | Formato: DD/MMM/YYYY |
| Forma de pago | Etiqueta: "Forma de Pago:" | Entre "Gastos Expedición" y "Pago:" |
| Coberturas | Formato más variado | Formato consistente |
| Periodo gracia | 14 días default | 14 días especificado |

### Campos Opcionales HDI
- `codigo_cliente`: Código interno HDI
- `uso`, `servicio`, `movimiento`: Campos específicos de pólizas de autos

---

## 🚀 Próximos Pasos

1. **Probar con PDFs reales de HDI** ✅ Listo para pruebas
2. **Ajustar patrones** según resultados de pruebas
3. **Agregar más aseguradoras**: GNP, MAPFRE, AXA, etc.
4. **Mejorar extractor genérico** para aseguradoras no implementadas

---

## 📚 Referencias

- Código fuente: `src/screens/Expedientes.jsx` (líneas 1398-1880)
- Componente DetalleExpediente: `src/screens/Expedientes.jsx`
- Servicio PDF: `src/services/pdfService.js`
- Documentación Qualitas: `docs/BACKEND-CAMPOS-FALTANTES.md`

---

**Última actualización**: 13 de noviembre, 2025
**Estado**: ✅ Implementado y listo para pruebas
**Desarrollador**: Álvaro

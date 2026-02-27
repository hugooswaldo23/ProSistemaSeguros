# Campos de Extracción de Pólizas

> Documento de referencia para los datos mínimos que deben extraerse de los PDFs de pólizas.
> Fecha: 27 de febrero de 2026

---

## Métodos de Extracción

| Método | Producto | Campos |
|--------|----------|--------|
| **Regex** (extractor específico por aseguradora) | Autos | 1 – 50 (todos) |
| **IA** (OpenAI / extracción genérica) | Autos | 1 – 50 (todos) |
| **IA** (OpenAI / extracción genérica) | Vida, GMM, Daños, Otros | 1 – 36 (sin vehículo) |

---

## Campos Universales (1 – 36) — Aplican a TODOS los productos

### Asegurado (1 – 11)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 1 | Tipo de persona | `tipo_persona` | Física o Moral (se deduce del RFC) | `"Fisica"` / `"Moral"` |
| 2 | Nombre(s) | `nombre` | Nombre(s) de pila del asegurado | Texto |
| 3 | Apellido paterno | `apellido_paterno` | Primer apellido | Texto |
| 4 | Apellido materno | `apellido_materno` | Segundo apellido | Texto |
| 5 | Razón social | `razonSocial` | Solo si es persona moral | Texto |
| 6 | RFC | `rfc` | RFC del asegurado (12 o 13 caracteres) | Alfanumérico |
| 7 | Domicilio | `domicilio` | Calle y número | Texto |
| 8 | Colonia | `colonia` | Colonia del domicilio | Texto |
| 9 | Municipio | `municipio` | Municipio / alcaldía | Texto |
| 10 | Estado | `estado` | Entidad federativa | Texto |
| 11 | Código postal | `codigo_postal` | CP de 5 dígitos | `"00000"` |

### Póliza (12 – 19)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 12 | Compañía | `compania` | Nombre de la aseguradora | `"Banorte"`, `"Qualitas"`, etc. |
| 13 | Producto | `producto` | Tipo de seguro | `"autos"`, `"vida"`, `"gmm"`, `"danos"` |
| 14 | Clave de agente | `clave_agente` | Número/clave del agente | Texto |
| 15 | Agente | `agente` | Nombre del agente | Texto |
| 16 | Número de póliza | `numero_poliza` | Identificador único de la póliza | Texto |
| 17 | Endoso | `endoso` | Número de endoso (si aplica) | Texto / `""` |
| 18 | Inciso | `inciso` | Número de inciso | Texto / `""` |
| 19 | Plan | `plan` | Nombre del paquete/plan | `"Amplia"`, `"Limitada"`, etc. |

### Vigencia (20 – 23)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 20 | Inicio de vigencia | `inicio_vigencia` | Fecha de inicio | `YYYY-MM-DD` |
| 21 | Término de vigencia | `termino_vigencia` | Fecha de fin | `YYYY-MM-DD` |
| 22 | Fecha de emisión | `fecha_emision` | Fecha en que se emitió la póliza | `YYYY-MM-DD` |
| 23 | Fecha de captura | `fecha_captura` | Fecha en que se captura en el sistema | `YYYY-MM-DD` (fecha actual) |

### Financiero (24 – 36)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 24 | Prima neta | `prima_neta` | Prima sin recargos ni impuestos | Numérico `"0.00"` |
| 25 | Cargo pago fraccionado | `cargo_pago_fraccionado` | Recargo por pago en parcialidades | Numérico `"0.00"` |
| 26 | Gastos de expedición | `gastos_expedicion` | Derecho de póliza / gastos de emisión | Numérico `"0.00"` |
| 27 | Subtotal | `subtotal` | Suma antes de IVA | Numérico `"0.00"` |
| 28 | IVA | `iva` | Impuesto (16%) | Numérico `"0.00"` |
| 29 | Total | `total` | Prima total a pagar | Numérico `"0.00"` |
| 30 | Tipo de pago | `tipo_pago` | Contado o crédito | `"Contado"` / `"Crédito"` |
| 31 | Frecuencia de pago | `frecuenciaPago` | Periodicidad | `"Anual"`, `"Semestral"`, `"Trimestral"`, `"Mensual"` |
| 32 | Primer pago | `primer_pago` | Monto del primer recibo | Numérico `"0.00"` |
| 33 | Pagos subsecuentes | `pagos_subsecuentes` | Monto de recibos siguientes | Numérico `"0.00"` |
| 34 | Periodo de gracia | `periodo_gracia` | Días de gracia para pago | Numérico (días) |
| 35 | Moneda | `moneda` | Moneda de la póliza | `"MXN"` / `"USD"` |
| 36 | Fecha límite de pago | `fecha_limite_pago` | Fecha límite del primer pago | `YYYY-MM-DD` |

---

## Campos Exclusivos de Autos (37 – 50) — Solo aplican cuando `producto = "autos"`

### Vehículo (37 – 48)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 37 | Marca | `marca` | Marca del vehículo | `"NISSAN"`, `"TOYOTA"`, etc. |
| 38 | Modelo | `modelo` | Submarca / versión | `"SENTRA SENSE"`, etc. |
| 39 | Año | `anio` | Año modelo | `"2025"` |
| 40 | Número de serie | `numero_serie` | VIN (17 caracteres) | Alfanumérico |
| 41 | Motor | `motor` | Número de motor | Alfanumérico |
| 42 | Placas | `placas` | Placas del vehículo | Alfanumérico |
| 43 | Color | `color` | Color del vehículo | Texto |
| 44 | Tipo de vehículo | `tipo_vehiculo` | Clasificación del vehículo | `"Automóvil"`, `"Camioneta"`, etc. |
| 45 | Tipo de cobertura | `tipo_cobertura` | Nivel de cobertura | `"Amplia"`, `"Limitada"`, `"RC"` |
| 46 | Uso | `uso` | Uso del vehículo | `"Particular"`, `"Comercial"` |
| 47 | Servicio | `servicio` | Tipo de servicio | `"Particular"`, `"Público"` |
| 48 | Capacidad | `capacidad` | Número de pasajeros | Numérico |

### Otros (49 – 50)

| # | Campo | Clave | Descripción | Formato |
|---|-------|-------|-------------|---------|
| 49 | Conductor habitual | `conductor_habitual` | Nombre del conductor habitual | Texto |
| 50 | Movimiento | `movimiento` | Tipo de movimiento | `"Emisión"`, `"Renovación"`, `"Endoso"` |

---

## Resumen Rápido

```
┌─────────────────────────────────────────────────────┐
│                EXTRACCIÓN POR REGEX                  │
│            (extractor por aseguradora)               │
│                                                      │
│  Autos → Campos 1-50 (todos)                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              EXTRACCIÓN POR IA (OpenAI)              │
│            (prompt genérico con el texto)            │
│                                                      │
│  Autos         → Campos 1-50 (todos)                │
│  Vida          → Campos 1-36 (universales)           │
│  GMM           → Campos 1-36 (universales)           │
│  Daños         → Campos 1-36 (universales)           │
│  Otros         → Campos 1-36 (universales)           │
└─────────────────────────────────────────────────────┘
```

## Notas de Implementación

1. **Fechas**: Siempre normalizar a formato `YYYY-MM-DD`
2. **Montos**: Guardar como string numérico sin comas ni signo `$` → `"12345.67"`
3. **Campos vacíos**: Devolver cadena vacía `""` si no se encuentra el dato
4. **`tipo_persona`**: Se deduce del RFC (13 chars = Física, 12 chars = Moral)
5. **`fecha_captura`**: Siempre es la fecha actual del momento de extracción
6. **`etapa_activa`**: No se extrae, se calcula según las fechas de vigencia
7. **Coberturas**: No se incluyen en la lista mínima; si el PDF las trae, se extraen como bonus

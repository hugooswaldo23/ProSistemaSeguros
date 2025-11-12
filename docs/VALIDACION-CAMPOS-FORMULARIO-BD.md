# 📊 Validación de Campos del Formulario vs Base de Datos

**Fecha:** Generado automáticamente  
**Objetivo:** Verificar que cada campo visible en el formulario de expedientes se guarda correctamente en la base de datos.

---

## 🎯 RESUMEN EJECUTIVO

Este documento valida que **todos los campos del formulario** de creación/edición de pólizas están siendo persistidos correctamente en la base de datos.

### ✅ **CONCLUSIÓN GENERAL**
- **Payload de guardado:** Usa `spread operator` (`...formularioConCalculos`) lo que incluye TODOS los campos del estado `formulario`
- **Campos normalizados:** uso/servicio/movimiento se sincronizan con sus alias `*_poliza` en el onChange
- **Separación correcta:** Campos `contacto_*` se envían solo a tabla `clientes`, no a `expedientes`

---

## 📋 CAMPOS DEL FORMULARIO

### **SECCIÓN 1: Datos del Cliente**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Tipo de Persona | `formulario.tipoPersona` | `clientes` | `tipo_persona` | ✅ Sí |
| Cliente ID | `formulario.cliente_id` | `expedientes` | `cliente_id` | ✅ Sí |
| Nombre | `formulario.nombre` | `clientes` / `expedientes` | `nombre` | ✅ Sí |
| Apellido Paterno | `formulario.apellido_paterno` | `clientes` / `expedientes` | `apellido_paterno` | ✅ Sí |
| Apellido Materno | `formulario.apellido_materno` | `clientes` / `expedientes` | `apellido_materno` | ✅ Sí |
| Razón Social | `formulario.razon_social` | `clientes` / `expedientes` | `razon_social` | ✅ Sí |
| Nombre Comercial | `formulario.nombre_comercial` | `clientes` / `expedientes` | `nombre_comercial` | ✅ Sí |
| RFC | `formulario.rfc` | `clientes` / `expedientes` | `rfc` | ✅ Sí |
| Nº Identificación | `formulario.numero_identificacion` | `clientes` / `expedientes` | `numero_identificacion` | ✅ Sí |
| Email | `formulario.email` | `clientes` / `expedientes` | `email` | ✅ Sí |
| Teléfono Móvil | `formulario.telefono_movil` | `clientes` / `expedientes` | `telefono_movil` | ✅ Sí |

**Nota:** Los campos del cliente se guardan en **DOS lugares**:
1. En tabla `clientes` mediante `PUT /api/clientes/{id}` (actualización del cliente existente)
2. En tabla `expedientes` para enriquecer el registro de la póliza (desnormalización intencional)

---

### **SECCIÓN 2: Datos del Contacto (solo Persona Moral)**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Nombre Contacto | `formulario.contacto_nombre` | `clientes` | `contacto_nombre` | ✅ Sí |
| Apellido Paterno | `formulario.contacto_apellido_paterno` | `clientes` | `contacto_apellido_paterno` | ✅ Sí |
| Apellido Materno | `formulario.contacto_apellido_materno` | `clientes` | `contacto_apellido_materno` | ✅ Sí |
| Email Contacto | `formulario.contacto_email` | `clientes` | `contacto_email` | ✅ Sí |
| Teléfono Fijo | `formulario.contacto_telefono_fijo` | `clientes` | `contacto_telefono_fijo` | ✅ Sí |
| Teléfono Móvil | `formulario.contacto_telefono_movil` | `clientes` | `contacto_telefono_movil` | ✅ Sí |

**⚠️ IMPORTANTE:** Estos campos son **excluidos** del payload de `expedientes` (líneas 6204-6210 en Expedientes.jsx):
```javascript
if ('contacto_nombre' in expedientePayload) delete expedientePayload.contacto_nombre;
if ('contacto_apellido_paterno' in expedientePayload) delete expedientePayload.contacto_apellido_paterno;
// ... etc.
```

Se envían solo a `PUT /api/clientes/{id}` (líneas 6075-6150).

---

### **SECCIÓN 3: Datos de la Póliza**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Número de Póliza | `formulario.numero_poliza` | `expedientes` | `numero_poliza` | ✅ Sí |
| Endoso | `formulario.endoso` | `expedientes` | `endoso` | ✅ Sí |
| Inciso | `formulario.inciso` | `expedientes` | `inciso` | ✅ Sí |
| Compañía | `formulario.compania` | `expedientes` | `compania` | ✅ Sí |
| Producto | `formulario.producto` | `expedientes` | `producto` | ✅ Sí |
| Plan | `formulario.plan` | `expedientes` | `plan` | ✅ Sí |
| Tipo de Cobertura | `formulario.tipo_cobertura` | `expedientes` | `tipo_cobertura` | ✅ Sí |

---

### **SECCIÓN 4: Agentes y Equipo de Trabajo**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Agente | `formulario.agente` | `expedientes` | `agente` | ✅ Sí |
| Sub-Agente | `formulario.sub_agente` | `expedientes` | `sub_agente` | ✅ Sí |

---

### **SECCIÓN 5: Vigencia y Fechas**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Inicio de Vigencia | `formulario.inicio_vigencia` | `expedientes` | `inicio_vigencia` | ✅ Sí |
| Término de Vigencia | `formulario.termino_vigencia` | `expedientes` | `termino_vigencia` | ✅ Sí |
| Fecha de Pago | `formulario.fecha_pago` | `expedientes` | `fecha_pago` | ✅ Sí |
| Fecha Vencimiento Pago | `formulario.fecha_vencimiento_pago` | `expedientes` | `fecha_vencimiento_pago` | ✅ Sí |
| Periodo de Gracia (días) | `formulario.periodo_gracia` | `expedientes` | `periodo_gracia` | ✅ Sí |

**Nota:** `fecha_vencimiento_pago` se calcula automáticamente como `fecha_pago + periodo_gracia` en `actualizarCalculosAutomaticos()`.

---

### **SECCIÓN 6: Pagos**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Tipo de Pago | `formulario.tipo_pago` | `expedientes` | `tipo_pago` | ✅ Sí |
| Frecuencia de Pago | `formulario.frecuenciaPago` | `expedientes` | `frecuenciaPago` | ✅ Sí |
| Estatus de Pago | `formulario.estatusPago` | `expedientes` | `estatusPago` | ✅ Sí |
| Próximo Pago | `formulario.proximoPago` | `expedientes` | `proximoPago` | ✅ Sí |

---

### **SECCIÓN 7: Montos y Cálculos**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD (snake_case) | ✅ Guardado |
|---------------------|--------------|---------------|-------------------------|-------------|
| Prima Pagada | `formulario.prima_pagada` | `expedientes` | `prima_pagada` | ✅ Sí |
| Cargo Pago Fraccionado | `formulario.cargo_pago_fraccionado` | `expedientes` | `cargo_pago_fraccionado` | ✅ Sí |
| Gastos de Expedición | `formulario.gastos_expedicion` | `expedientes` | `gastos_expedicion` | ✅ Sí |
| Subtotal | `formulario.subtotal` | `expedientes` | `subtotal` | ✅ Sí (calculado) |
| IVA (16%) | `formulario.iva` | `expedientes` | `iva` | ✅ Sí (calculado) |
| Total | `formulario.total` | `expedientes` | `total` | ✅ Sí (calculado) |

**⚠️ Dualidad camelCase / snake_case:**
- Frontend usa ambos formatos: `cargo_pago_fraccionado` (formulario) y `cargoPagoFraccionado` (algunos cálculos)
- Backend acepta `snake_case` (preferencia SQL)
- Edición usa nullish coalescing para aceptar ambos: `expediente.prima_pagada ?? expediente.primaPagada ?? ''`

---

### **SECCIÓN 8: Coberturas**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Coberturas (array) | `formulario.coberturas` | `expedientes` | `coberturas` (JSON) | ✅ Sí |
| Suma Asegurada | `formulario.suma_asegurada` | `expedientes` | `suma_asegurada` | ✅ Sí |
| Deducible | `formulario.deducible` | `expedientes` | `deducible` | ✅ Sí |

**Transformación:** El array `coberturas` se convierte a JSON string antes de enviar (línea 6223):
```javascript
if (expedientePayload.coberturas && Array.isArray(expedientePayload.coberturas)) {
  expedientePayload.coberturas = JSON.stringify(expedientePayload.coberturas);
}
```

---

### **SECCIÓN 9: Datos del Vehículo (Productos: Autos)**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Marca | `formulario.marca` | `expedientes` | `marca` | ✅ Sí |
| Modelo | `formulario.modelo` | `expedientes` | `modelo` | ✅ Sí |
| Año | `formulario.anio` | `expedientes` | `anio` | ✅ Sí |
| Número de Serie (VIN) | `formulario.numero_serie` | `expedientes` | `numero_serie` | ✅ Sí |
| Motor | `formulario.motor` | `expedientes` | `motor` | ✅ Sí |
| Placas | `formulario.placas` | `expedientes` | `placas` | ✅ Sí |
| Color | `formulario.color` | `expedientes` | `color` | ✅ Sí |
| Tipo de Vehículo | `formulario.tipo_vehiculo` | `expedientes` | `tipo_vehiculo` | ✅ Sí |
| Conductor Habitual | `formulario.conductor_habitual` | `expedientes` | `conductor_habitual` | ✅ Sí |

---

### **SECCIÓN 10: Datos de la Póliza (Autos Individual) ⭐ CAMPOS CRÍTICOS**

| Campo en Formulario | Estado React | Alias Estado | Tabla Destino | Columnas BD | ✅ Guardado |
|---------------------|--------------|--------------|---------------|-------------|-------------|
| Uso | `formulario.uso` | `formulario.uso_poliza` | `expedientes` | `uso` / `uso_poliza` | ✅ Sí (ambos) |
| Servicio | `formulario.servicio` | `formulario.servicio_poliza` | `expedientes` | `servicio` / `servicio_poliza` | ✅ Sí (ambos) |
| Movimiento | `formulario.movimiento` | `formulario.movimiento_poliza` | `expedientes` | `movimiento` / `movimiento_poliza` | ✅ Sí (ambos) |

**🔧 Sincronización en onChange (líneas 3923-3956):**
```javascript
// Al cambiar "Uso", se actualiza tanto uso como uso_poliza
onChange: (e) => setFormulario(prev => ({ 
  ...prev, 
  uso: e.target.value,
  uso_poliza: e.target.value 
}))
```

**🔧 Sincronización al aplicar PDF (líneas 2056-2058):**
```javascript
if (datosConCliente.uso) datosConCliente.uso_poliza = datosConCliente.uso;
if (datosConCliente.servicio) datosConCliente.servicio_poliza = datosConCliente.servicio;
if (datosConCliente.movimiento) datosConCliente.movimiento_poliza = datosConCliente.movimiento;
```

**🔧 Normalización al cargar (líneas 6527-6529):**
```javascript
exp.uso = exp.uso || exp.uso_poliza || exp.Uso || exp.usoVehiculo || '';
exp.servicio = exp.servicio || exp.servicio_poliza || exp.Servicio || exp.servicioVehiculo || '';
exp.movimiento = exp.movimiento || exp.movimiento_poliza || exp.Movimiento || '';
```

---

### **SECCIÓN 11: Estado y Control**

| Campo en Formulario | Estado React | Tabla Destino | Columna BD | ✅ Guardado |
|---------------------|--------------|---------------|------------|-------------|
| Etapa Activa | `formulario.etapa_activa` | `expedientes` | `etapa_activa` | ✅ Sí |
| Motivo de Cancelación | `formulario.motivoCancelacion` | `expedientes` | `motivoCancelacion` | ✅ Sí |
| Notas | `formulario.notas` | `expedientes` | `notas` | ✅ Sí |
| Fecha de Creación | `formulario.fecha_creacion` | `expedientes` | `fecha_creacion` | ✅ Sí |

---

## 🔍 VALIDACIÓN DE PAYLOAD

### **Construcción del Payload (línea 6194)**

```javascript
const expedientePayload = {
  ...formularioConCalculos  // ✅ Incluye TODOS los campos del formulario
};
```

**Campos excluidos explícitamente:**
- `__pdfFile`, `__pdfNombre`, `__pdfSize` (temporales del visor PDF)
- `contacto_*` (van solo a tabla `clientes`, NO a `expedientes`)

### **Console.log de Diagnóstico (líneas 6228-6304)**

El sistema registra en consola:
- ✅ Todos los campos de identificación (id, numero_poliza, endoso, inciso)
- ✅ Todos los campos del cliente (nombre, apellidos, rfc, email, teléfono)
- ✅ Producto y compañía
- ✅ Agentes
- ✅ Vigencias y fechas
- ✅ Pagos y montos
- ✅ Coberturas (con verificación de tipo)
- ✅ Datos del vehículo
- ✅ **Uso, servicio, movimiento (y sus alias _poliza)** ⭐
- ✅ Estado y notas

---

## 🗄️ VERIFICACIÓN DE ESQUEMA DE BASE DE DATOS

### **Tabla `expedientes` - Columnas Requeridas**

Según los campos del formulario, la tabla `expedientes` debe tener las siguientes columnas:

```sql
-- Identificación
id INT AUTO_INCREMENT PRIMARY KEY,
numero_poliza VARCHAR(100),
endoso VARCHAR(50),
inciso VARCHAR(50),

-- Relación con cliente
cliente_id VARCHAR(36), -- UUID

-- Datos del cliente (desnormalizados)
nombre VARCHAR(100),
apellido_paterno VARCHAR(100),
apellido_materno VARCHAR(100),
razon_social VARCHAR(200),
nombre_comercial VARCHAR(200),
rfc VARCHAR(13),
numero_identificacion VARCHAR(50),
email VARCHAR(100),
telefono_movil VARCHAR(20),

-- Producto y compañía
compania VARCHAR(100),
producto VARCHAR(100),
plan VARCHAR(100),
tipo_cobertura VARCHAR(100),

-- Agentes
agente VARCHAR(100),
sub_agente VARCHAR(100),

-- Vigencia y fechas
inicio_vigencia DATE,
termino_vigencia DATE,
fecha_pago DATE,
fecha_vencimiento_pago DATE,
periodo_gracia INT,

-- Pagos
tipo_pago VARCHAR(50),
frecuenciaPago VARCHAR(50),
estatusPago VARCHAR(50),
proximoPago DATE,

-- Montos
prima_pagada DECIMAL(10,2),
cargo_pago_fraccionado DECIMAL(10,2),
gastos_expedicion DECIMAL(10,2),
subtotal DECIMAL(10,2),
iva DECIMAL(10,2),
total DECIMAL(10,2),

-- Coberturas
coberturas TEXT, -- JSON string
suma_asegurada DECIMAL(15,2),
deducible DECIMAL(10,2),

-- Vehículo
marca VARCHAR(50),
modelo VARCHAR(100),
anio INT,
numero_serie VARCHAR(50),
motor VARCHAR(50),
placas VARCHAR(20),
color VARCHAR(30),
tipo_vehiculo VARCHAR(50),
conductor_habitual VARCHAR(200),

-- Datos de la Póliza (Autos Individual) ⭐
uso VARCHAR(50),
uso_poliza VARCHAR(50),
servicio VARCHAR(50),
servicio_poliza VARCHAR(50),
movimiento VARCHAR(50),
movimiento_poliza VARCHAR(50),

-- Estado
etapa_activa VARCHAR(50),
motivoCancelacion VARCHAR(200),
notas TEXT,

-- Auditoría
fecha_creacion DATE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

---

## ⚠️ CAMPOS QUE REQUIEREN ATENCIÓN

### **1. Columnas con dual naming (camelCase + snake_case)**

Estos campos pueden llegar en dos formatos desde el backend:

| Campo | Formato 1 (snake_case) | Formato 2 (camelCase) |
|-------|------------------------|----------------------|
| Cargo Pago Fraccionado | `cargo_pago_fraccionado` | `cargoPagoFraccionado` |
| Gastos Expedición | `gastos_expedicion` | `gastosExpedicion` |
| Prima Pagada | `prima_pagada` | `primaPagada` |

**Solución implementada:** Nullish coalescing en `editarExpediente` (línea 6558):
```javascript
prima_pagada: expediente.prima_pagada ?? expediente.primaPagada ?? '',
```

**Recomendación:** Backend debería estandarizar a `snake_case` para SQL.

---

### **2. Campos con múltiples aliases (uso, servicio, movimiento)**

Estos campos pueden venir con diferentes nombres:

| Campo Principal | Aliases Conocidos |
|----------------|-------------------|
| `uso` | `uso_poliza`, `Uso`, `usoVehiculo` |
| `servicio` | `servicio_poliza`, `Servicio`, `servicioVehiculo` |
| `movimiento` | `movimiento_poliza`, `Movimiento` |

**Solución implementada:**
1. **Load-time normalization** (líneas 6527-6529): al cargar expedientes, se unifica a campo principal
2. **Form sync** (líneas 3923-3956): onChange actualiza ambos (principal + alias)
3. **Display normalization** (DetalleExpediente.jsx): busca en todos los alias para mostrar
4. **Edit initialization** (líneas 6588-6590): carga desde cualquier alias disponible

**Recomendación:** Backend debería:
- Crear columnas para **ambos** (`uso` Y `uso_poliza`)
- O definir UN solo nombre canónico y mantenerlo consistente
- Documentar cuál es el nombre oficial en el API

---

### **3. Campos calculados**

Estos campos se recalculan automáticamente antes de guardar:

| Campo | Cálculo | Función |
|-------|---------|---------|
| `subtotal` | `prima_pagada + cargo_pago_fraccionado + gastos_expedicion` | `actualizarCalculosAutomaticos` |
| `iva` | `subtotal * 0.16` | `actualizarCalculosAutomaticos` |
| `total` | `subtotal + iva` | `actualizarCalculosAutomaticos` |
| `fecha_vencimiento_pago` | `fecha_pago + periodo_gracia días` | `actualizarCalculosAutomaticos` |

**Recomendación:** Backend NO debería recalcular estos valores; confiar en frontend.

---

## ✅ VERIFICACIÓN FINAL

### **Comandos SQL para Validar Esquema**

```sql
-- Ver estructura completa de la tabla expedientes
DESCRIBE expedientes;

-- Verificar columnas específicas de Uso/Servicio/Movimiento
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'expedientes' 
  AND COLUMN_NAME IN ('uso', 'uso_poliza', 'servicio', 'servicio_poliza', 'movimiento', 'movimiento_poliza');

-- Probar guardado de un expediente con estos campos
SELECT 
    id,
    numero_poliza,
    uso,
    uso_poliza,
    servicio,
    servicio_poliza,
    movimiento,
    movimiento_poliza,
    marca,
    modelo
FROM expedientes
WHERE producto = 'Autos Individual'
ORDER BY id DESC
LIMIT 5;
```

---

## 📌 ACCIONES RECOMENDADAS

### **Para IT/Backend:**

1. ✅ **Verificar que existen columnas** `uso`, `uso_poliza`, `servicio`, `servicio_poliza`, `movimiento`, `movimiento_poliza` en tabla `expedientes`
   - Si NO existen, ejecutar:
     ```sql
     ALTER TABLE expedientes ADD COLUMN uso VARCHAR(50) NULL AFTER conductor_habitual;
     ALTER TABLE expedientes ADD COLUMN uso_poliza VARCHAR(50) NULL AFTER uso;
     ALTER TABLE expedientes ADD COLUMN servicio VARCHAR(50) NULL AFTER uso_poliza;
     ALTER TABLE expedientes ADD COLUMN servicio_poliza VARCHAR(50) NULL AFTER servicio;
     ALTER TABLE expedientes ADD COLUMN movimiento VARCHAR(50) NULL AFTER servicio_poliza;
     ALTER TABLE expedientes ADD COLUMN movimiento_poliza VARCHAR(50) NULL AFTER movimiento;
     ```

2. ✅ **Estandarizar nombres de columnas** en backend:
   - Decidir: ¿`cargo_pago_fraccionado` o `cargoPagoFraccionado`?
   - Preferencia SQL: `snake_case`
   - Documentar en API Spec

3. ✅ **Verificar que backend acepta ambos formatos** al recibir PUT/POST (para retrocompatibilidad)

4. ✅ **Registrar en logs** cuando se reciban campos con nombres inesperados (detectar inconsistencias)

### **Para Frontend:**

1. ✅ **HECHO:** Console.log incluye uso/servicio/movimiento y sus alias (líneas añadidas al log de diagnóstico)

2. ✅ **HECHO:** Form onChange sincroniza ambos campos (principal + alias)

3. ✅ **HECHO:** Load normalization unifica aliases a un solo campo principal

4. ⏳ **PENDIENTE:** Agregar validación visual cuando usuario selecciona "Autos Individual" pero no llena uso/servicio/movimiento (requerido vs opcional)

---

## 📊 RESUMEN DE HALLAZGOS

### ✅ **LO QUE FUNCIONA BIEN**

1. **Payload completo:** Spread operator incluye todos los campos del formulario
2. **Exclusión correcta:** Campos `contacto_*` no se envían a expedientes
3. **Dual persistence:** Campos de cliente se guardan en ambas tablas (clientes + expedientes)
4. **Transformaciones:** Coberturas se convierten a JSON string
5. **Cálculos automáticos:** Subtotal, IVA, total, fecha_vencimiento se recalculan antes de guardar
6. **Sincronización uso/servicio/movimiento:** Form onChange actualiza ambos formatos

### ⚠️ **LO QUE NECESITA VERIFICACIÓN**

1. **Esquema BD:** Confirmar que existen columnas `uso`, `uso_poliza`, `servicio`, `servicio_poliza`, `movimiento`, `movimiento_poliza`
2. **Backend API:** Verificar que acepta ambos nombres (snake_case + camelCase) para montos
3. **Respuesta del backend:** Verificar que devuelve consistentemente `snake_case` en GET

---

## 🔗 REFERENCIAS

- **Código fuente:** `src/screens/Expedientes.jsx`
- **Función de guardado:** `guardarExpediente` (líneas 6050-6450)
- **Payload construction:** Línea 6194
- **Exclusión contacto_*:** Líneas 6204-6210
- **Sincronización uso/servicio/movimiento:** 
  - Form onChange: líneas 3923-3956
  - PDF application: líneas 2056-2058
  - Load normalization: líneas 6527-6529
  - Edit initialization: líneas 6588-6590
- **Scripts SQL migración:** `scripts/agregar_campos_fechas_expedientes.sql`

---

**✨ Documento generado para validar integridad de datos entre formulario y base de datos**

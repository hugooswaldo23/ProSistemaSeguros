# 🔧 Cambios Requeridos en Backend - Campos Faltantes

**Fecha:** 28 de Octubre, 2025  
**Prioridad:** 🔴 ALTA  
**Módulos Afectados:** Clientes, Expedientes (Pólizas)

---

## 📋 Resumen Ejecutivo

El frontend está enviando correctamente todos los campos al backend, pero varios campos críticos **NO se están guardando** en la base de datos y/o **NO se están devolviendo** en las respuestas. Esto causa pérdida de información importante.

### Campos Críticos Faltantes:

#### **Tabla: `clientes`**
- ✅ Todos los campos básicos se guardan correctamente
- ⚠️ Posible problema: Arrays (`contactos`, `documentos`, `expedientesRelacionados`) - verificar si se guardan como JSON

#### **Tabla: `expedientes`** (Pólizas)
- ❌ **`cliente_id`** - NO se guarda/devuelve
- ❌ **`coberturas`** - NO se guarda/devuelve
- ⚠️ Varios campos con nombres inconsistentes (camelCase vs snake_case)

---

## 🚨 Problema 1: Campo `cliente_id` en Expedientes

### **Situación Actual:**

**Frontend ENVÍA:**
```json
{
  "cliente_id": "20b1810f-b451-11f0-9cad-0ab39348df91",
  "numero_poliza": "0971452556",
  "compania": "Qualitas",
  // ... otros campos
}
```

**Backend DEVUELVE:**
```json
{
  "id": 34,
  "cliente_id": null,  ← ❌ VIENE NULL
  "numero_poliza": "0971452556",
  // ... otros campos
}
```

### **Impacto:**
- ❌ Las pólizas no quedan vinculadas a sus clientes
- ❌ No se puede mostrar el nombre del cliente en el listado
- ❌ No se pueden generar reportes por cliente
- ❌ Se pierde la relación cliente-póliza

### **Solución Requerida:**

#### 1. Verificar que existe la columna en la base de datos:

**MySQL/PostgreSQL:**
```sql
-- Verificar si existe
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'expedientes' 
AND COLUMN_NAME = 'cliente_id';

-- Si NO existe, agregarla:
ALTER TABLE expedientes 
ADD COLUMN cliente_id VARCHAR(36) NULL;

-- Agregar índice para mejorar performance:
CREATE INDEX idx_expedientes_cliente_id ON expedientes(cliente_id);

-- Opcional: Agregar foreign key si la tabla clientes existe
ALTER TABLE expedientes
ADD CONSTRAINT fk_expedientes_cliente
FOREIGN KEY (cliente_id) REFERENCES clientes(id)
ON DELETE SET NULL
ON UPDATE CASCADE;
```

#### 2. Modificar el endpoint POST `/api/expedientes`:

**Antes (ejemplo):**
```javascript
router.post('/api/expedientes', (req, res) => {
  const { 
    numero_poliza, 
    compania, 
    producto,
    // ... otros campos
  } = req.body;
  
  const query = `
    INSERT INTO expedientes 
    (numero_poliza, compania, producto, ...) 
    VALUES (?, ?, ?, ...)
  `;
  // ...
});
```

**Después:**
```javascript
router.post('/api/expedientes', (req, res) => {
  const { 
    cliente_id,  // ← AGREGAR ESTE CAMPO
    numero_poliza, 
    compania, 
    producto,
    // ... otros campos
  } = req.body;
  
  const query = `
    INSERT INTO expedientes 
    (cliente_id, numero_poliza, compania, producto, ...) 
    VALUES (?, ?, ?, ?, ...)
  `;
  
  db.query(query, [cliente_id, numero_poliza, compania, producto, ...], ...);
});
```

#### 3. Modificar el endpoint PUT `/api/expedientes/:id`:

Asegurar que `cliente_id` se actualice en el UPDATE:

```javascript
router.put('/api/expedientes/:id', (req, res) => {
  const { 
    cliente_id,  // ← INCLUIR EN UPDATE
    numero_poliza,
    // ...
  } = req.body;
  
  const query = `
    UPDATE expedientes 
    SET cliente_id = ?, 
        numero_poliza = ?,
        // ... otros campos
    WHERE id = ?
  `;
  
  db.query(query, [cliente_id, numero_poliza, ..., req.params.id], ...);
});
```

#### 4. Modificar el endpoint GET `/api/expedientes`:

Asegurar que `cliente_id` se devuelva en el SELECT:

```javascript
router.get('/api/expedientes', (req, res) => {
  const query = `
    SELECT 
      id,
      cliente_id,  -- ← ASEGURAR QUE ESTÉ EN SELECT
      numero_poliza,
      compania,
      producto,
      // ... todos los demás campos
    FROM expedientes
    ORDER BY fecha_creacion DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});
```

---

## 🚨 Problema 2: Campo `coberturas` en Expedientes

### **Situación Actual:**

**Frontend ENVÍA:**
```json
{
  "numero_poliza": "0971452556",
  "coberturas": "[{\"nombre\":\"Daños materiales\",\"suma_asegurada\":\"2046300.00\",\"deducible\":\"5%\",\"prima\":\"30035.59\"},{\"nombre\":\"Robo total\",\"suma_asegurada\":\"2046300.00\",\"deducible\":\"20%\",\"prima\":\"9534.63\"}]"
}
```
*Nota: Las coberturas se envían como JSON string, listo para guardar en TEXT/JSON*

**Backend DEVUELVE:**
```json
{
  "id": 34,
  "numero_poliza": "0971452556"
  // ❌ NO devuelve el campo "coberturas"
}
```

### **Impacto:**
- ❌ Se pierde el detalle de las coberturas contratadas
- ❌ No se puede mostrar el desglose de coberturas en el detalle
- ❌ No se pueden generar reportes de coberturas
- ❌ Información crítica del negocio se pierde

### **Solución Requerida:**

#### 1. Agregar columna en la base de datos:

**MySQL:**
```sql
-- Agregar columna para almacenar JSON
ALTER TABLE expedientes 
ADD COLUMN coberturas TEXT NULL;

-- O si el motor soporta tipo JSON:
ALTER TABLE expedientes 
ADD COLUMN coberturas JSON NULL;
```

**PostgreSQL:**
```sql
-- PostgreSQL tiene tipo JSON nativo
ALTER TABLE expedientes 
ADD COLUMN coberturas JSONB NULL;

-- Agregar índice GIN para búsquedas rápidas en JSON
CREATE INDEX idx_expedientes_coberturas_gin 
ON expedientes USING GIN (coberturas);
```

#### 2. Modificar INSERT (POST):

```javascript
router.post('/api/expedientes', (req, res) => {
  const { 
    cliente_id,
    numero_poliza,
    coberturas,  // ← AGREGAR ESTE CAMPO
    // ... otros campos
  } = req.body;
  
  const query = `
    INSERT INTO expedientes 
    (cliente_id, numero_poliza, coberturas, ...) 
    VALUES (?, ?, ?, ...)
  `;
  
  // coberturas ya viene como string JSON desde el frontend
  db.query(query, [cliente_id, numero_poliza, coberturas, ...], ...);
});
```

#### 3. Modificar UPDATE (PUT):

```javascript
router.put('/api/expedientes/:id', (req, res) => {
  const { 
    cliente_id,
    numero_poliza,
    coberturas,  // ← INCLUIR EN UPDATE
    // ...
  } = req.body;
  
  const query = `
    UPDATE expedientes 
    SET cliente_id = ?,
        numero_poliza = ?,
        coberturas = ?,  -- ← ACTUALIZAR COBERTURAS
        // ... otros campos
    WHERE id = ?
  `;
  
  db.query(query, [cliente_id, numero_poliza, coberturas, ..., req.params.id], ...);
});
```

#### 4. Modificar SELECT (GET):

```javascript
router.get('/api/expedientes', (req, res) => {
  const query = `
    SELECT 
      id,
      cliente_id,
      numero_poliza,
      coberturas,  -- ← DEVOLVER COBERTURAS
      // ... todos los demás campos
    FROM expedientes
    ORDER BY fecha_creacion DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Las coberturas vienen como string JSON, el frontend las parseará
    res.json(results);
  });
});
```

---

## 📝 Problema 3: Inconsistencia en Nombres de Campos

Algunos campos se envían con **camelCase** pero la base de datos puede esperar **snake_case**.

### **Campos con Posible Inconsistencia:**

| Frontend (envía) | Backend (debe guardar) |
|------------------|------------------------|
| `cargoPagoFraccionado` | `cargo_pago_fraccionado` |
| `motivoCancelacion` | `motivo_cancelacion` |
| `frecuenciaPago` | `frecuencia_pago` |
| `proximoPago` | `proximo_pago` |
| `estatusPago` | `estatus_pago` |
| `gastosExpedicion` | `gastos_expedicion` |

### **Solución:**

**Opción 1:** Normalizar en backend (RECOMENDADO)

```javascript
router.post('/api/expedientes', (req, res) => {
  // Normalizar nombres de campos
  const datos = {
    cliente_id: req.body.cliente_id,
    numero_poliza: req.body.numero_poliza,
    cargo_pago_fraccionado: req.body.cargo_pago_fraccionado || req.body.cargoPagoFraccionado,
    motivo_cancelacion: req.body.motivo_cancelacion || req.body.motivoCancelacion,
    frecuencia_pago: req.body.frecuencia_pago || req.body.frecuenciaPago,
    proximo_pago: req.body.proximo_pago || req.body.proximoPago,
    estatus_pago: req.body.estatus_pago || req.body.estatusPago,
    gastos_expedicion: req.body.gastos_expedicion || req.body.gastosExpedicion,
    // ... resto de campos
  };
  
  // Usar 'datos' en el query
});
```

**Opción 2:** Devolver ambos formatos (temporal)

```javascript
router.get('/api/expedientes', (req, res) => {
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Agregar versiones camelCase para compatibilidad
    const resultsNormalized = results.map(exp => ({
      ...exp,
      cargoPagoFraccionado: exp.cargo_pago_fraccionado,
      motivoCancelacion: exp.motivo_cancelacion,
      frecuenciaPago: exp.frecuencia_pago,
      proximoPago: exp.proximo_pago,
      estatusPago: exp.estatus_pago,
      gastosExpedicion: exp.gastos_expedicion
    }));
    
    res.json(resultsNormalized);
  });
});
```

---

## 🧪 Testing / Verificación

### **1. Verificar que se guardan los campos:**

Después de hacer un POST, ejecutar:

```sql
SELECT 
  id, 
  numero_poliza, 
  cliente_id,  -- Debe tener valor UUID
  coberturas,  -- Debe tener JSON string
  LENGTH(coberturas) as coberturas_length  -- Ver tamaño del JSON
FROM expedientes 
WHERE numero_poliza = '0971452556';
```

**Resultado esperado:**
```
id | numero_poliza | cliente_id                           | coberturas                    | coberturas_length
34 | 0971452556    | 20b1810f-b451-11f0-9cad-0ab39348df91 | [{"nombre":"Daños mate..."}] | 850
```

### **2. Verificar que se devuelven en el GET:**

Hacer request:
```bash
curl http://localhost:3000/api/expedientes
```

Verificar que la respuesta incluya:
```json
[
  {
    "id": 34,
    "numero_poliza": "0971452556",
    "cliente_id": "20b1810f-b451-11f0-9cad-0ab39348df91",  ← ✅ Debe estar
    "coberturas": "[{\"nombre\":\"Daños materiales\"...}]", ← ✅ Debe estar
    // ... otros campos
  }
]
```

### **3. Verificar logs del frontend:**

En la consola del navegador debe aparecer:
```
📈 Total de expedientes con coberturas: 1 de 1  ← ✅ Ya no debe ser "0 de 1"
🔍 Expediente: 0971452556 Campos: {cliente_id: "20b1810f-...", ...}  ← ✅ Ya no debe ser null
```

---

## 📊 Lista de Verificación (Checklist)

### **Base de Datos:**
- [ ] Columna `expedientes.cliente_id` existe (VARCHAR(36) o UUID)
- [ ] Columna `expedientes.coberturas` existe (TEXT o JSON/JSONB)
- [ ] Índice en `cliente_id` para performance
- [ ] Foreign key opcional hacia `clientes.id`

### **Endpoint POST `/api/expedientes`:**
- [ ] Recibe `cliente_id` del body
- [ ] Recibe `coberturas` del body
- [ ] Inserta `cliente_id` en la BD
- [ ] Inserta `coberturas` en la BD
- [ ] Devuelve el registro creado con TODOS los campos

### **Endpoint PUT `/api/expedientes/:id`:**
- [ ] Recibe `cliente_id` del body
- [ ] Recibe `coberturas` del body
- [ ] Actualiza `cliente_id` en la BD
- [ ] Actualiza `coberturas` en la BD
- [ ] Devuelve el registro actualizado con TODOS los campos

### **Endpoint GET `/api/expedientes`:**
- [ ] SELECT incluye `cliente_id`
- [ ] SELECT incluye `coberturas`
- [ ] Devuelve ambos campos en el JSON response

### **Normalización de Nombres:**
- [ ] Acepta tanto camelCase como snake_case en POST/PUT
- [ ] Guarda en formato consistente (snake_case recomendado)
- [ ] Devuelve en formato esperado por frontend

---

## 🔗 Información Adicional

### **Formato de Coberturas (JSON):**

Las coberturas vienen como string JSON con esta estructura:

```json
[
  {
    "nombre": "Daños materiales",
    "suma_asegurada": "2046300.00",
    "deducible": "5%",
    "prima": "30035.59",
    "tipo": "monto"
  },
  {
    "nombre": "Robo total",
    "suma_asegurada": "2046300.00",
    "deducible": "20%",
    "prima": "9534.63",
    "tipo": "monto"
  },
  {
    "nombre": "Responsabilidad Civil por Daños a Terceros",
    "suma_asegurada": "3000000.00",
    "deducible": "0 uma",
    "prima": "1326.56",
    "tipo": "por_evento"
  }
]
```

### **Formato de cliente_id:**

- Tipo: UUID v1 generado por el backend
- Ejemplo: `20b1810f-b451-11f0-9cad-0ab39348df91`
- Longitud: 36 caracteres con guiones

---

## 📞 Contacto

Si tienes dudas sobre la implementación o necesitas más información sobre algún campo, consulta:
- **Documentación Frontend:** `/docs/`
- **Logs del Frontend:** Consola del navegador (F12)
- **Estructura Completa:** Ver archivo `LISTADO-COMPLETO-PARA-IT.md`

---

**Generado:** 28 de Octubre, 2025  
**Versión:** 1.0  
**Estado:** ⚠️ Pendiente de Implementación

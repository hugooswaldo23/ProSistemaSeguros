# 🚨 FIX URGENTE: Campos Faltantes en GET /api/expedientes

## Problema
Al editar un expediente, varios campos aparecen vacíos porque el backend NO los está devolviendo en el SELECT.

## Evidencia (Console Log)
```javascript
// GET /api/expedientes devuelve:
{
  id: 196,
  numero_poliza: "0971452556",
  prima_pagada: "46748.65",
  gastos_expedicion: undefined,  // ❌ FALTA
  cargo_pago_fraccionado: undefined,  // ❌ PROBABLEMENTE FALTA
  iva: "7066.08",
  total: "51229.08",
  fecha_emision: "2025-11-12T00:00:00.000Z",
  // ... otros campos
}
```

## Campos que DEBEN incluirse en el SELECT

### GET `/api/expedientes` y GET `/api/expedientes/:id`

```sql
SELECT 
  -- Identificación
  id,
  numero_poliza,
  endoso,
  inciso,
  cliente_id,
  
  -- Compañía y Producto
  compania,
  producto,
  plan,
  tipo_cobertura,
  
  -- Agente y Equipo
  agente,
  sub_agente,
  
  -- Cliente (datos enriquecidos)
  nombre,
  apellido_paterno,
  apellido_materno,
  razon_social,
  nombre_comercial,
  rfc,
  numero_identificacion,
  email,
  telefono_fijo,
  telefono_movil,
  
  -- Vigencia y Fechas
  fecha_emision,              -- ✅ Ya se devuelve
  inicio_vigencia,            -- ✅ Ya se devuelve
  termino_vigencia,           -- ✅ Ya se devuelve
  fecha_pago,
  fecha_vencimiento_pago,
  periodo_gracia,
  
  -- Pagos
  tipo_pago,
  frecuencia_pago,
  estatus_pago,
  proximo_pago,
  
  -- Montos CRÍTICOS (FALTANTES)
  prima_pagada,               -- ✅ Ya se devuelve
  cargo_pago_fraccionado,     -- ❌ FALTA - Campo crítico para edición
  gastos_expedicion,          -- ❌ FALTA - Campo crítico para edición
  subtotal,                   -- ❌ PROBABLEMENTE FALTA
  iva,                        -- ✅ Ya se devuelve
  total,                      -- ✅ Ya se devuelve
  
  -- Coberturas
  coberturas,                 -- JSON string
  suma_asegurada,
  deducible,
  
  -- Vehículo (si aplica)
  marca,
  modelo,
  anio,
  numero_serie,
  motor,
  placas,
  color,
  tipo_vehiculo,
  conductor_habitual,
  
  -- Estado
  etapa_activa,
  motivo_cancelacion,
  fecha_cancelacion,
  
  -- Otros
  notas,
  created_at,
  updated_at

FROM expedientes
WHERE id = ?;  -- Para GET por ID
-- ORDER BY created_at DESC;  -- Para GET todos
```

## ⚠️ Impacto

Sin estos campos, al **editar un expediente**:
- ❌ Campos de montos aparecen en CERO
- ❌ No se pueden modificar correctamente
- ❌ Al guardar, se sobrescriben con valores vacíos/cero

## ✅ Solución Inmediata

En el backend (Node.js/Express), asegúrate que el SELECT incluya TODOS los campos:

```javascript
// backend/routes/expedientes.js

router.get('/api/expedientes/:id', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      id, numero_poliza, endoso, inciso, cliente_id,
      compania, producto, plan, tipo_cobertura,
      agente, sub_agente,
      nombre, apellido_paterno, apellido_materno, 
      razon_social, nombre_comercial, rfc, numero_identificacion,
      email, telefono_fijo, telefono_movil,
      fecha_emision, inicio_vigencia, termino_vigencia,
      fecha_pago, fecha_vencimiento_pago, periodo_gracia,
      tipo_pago, frecuencia_pago, estatus_pago, proximo_pago,
      prima_pagada, 
      cargo_pago_fraccionado,   -- ⚠️ AGREGAR ESTE
      gastos_expedicion,        -- ⚠️ AGREGAR ESTE
      subtotal,                 -- ⚠️ AGREGAR ESTE
      iva, total,
      coberturas, suma_asegurada, deducible,
      marca, modelo, anio, numero_serie, motor, placas, color,
      tipo_vehiculo, conductor_habitual,
      etapa_activa, motivo_cancelacion, fecha_cancelacion,
      notas, created_at, updated_at
    FROM expedientes
    WHERE id = ?
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }
    
    res.json(results[0]);
  });
});

// Mismo SELECT para GET /api/expedientes (sin WHERE)
router.get('/api/expedientes', (req, res) => {
  const query = `SELECT id, numero_poliza, ... FROM expedientes ORDER BY created_at DESC`;
  // ... mismo código
});
```

## 🧪 Prueba

Después de actualizar el backend:

1. Recargar el frontend
2. Ir a Pólizas → Editar la póliza de Álvaro
3. Verificar en consola que `gastos_expedicion` ya NO sea `undefined`
4. Verificar que los campos se pueblen correctamente

---

## 📝 Nota Adicional

También hay datos viejos en la BD. Ejecutar limpieza:

```sql
-- Ver todas las pólizas
SELECT id, numero_poliza, cliente_id, created_at FROM expedientes;

-- Si hay más de 1 y solo debe haber la de Álvaro (id: 195 o 196):
-- DELETE FROM expedientes WHERE id NOT IN (195, 196);
```

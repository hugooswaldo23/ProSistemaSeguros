# Fix: Endpoint PUT /api/expedientes/:id

## ❌ Problema Actual

El endpoint está **sobrescribiendo todo el expediente** cuando solo deberías actualizar los campos enviados.

```javascript
// ❌ MAL - Esto borra todos los campos no incluidos en req.body
app.put('/api/expedientes/:id', (req, res) => {
  const { id } = req.params;
  const expediente = req.body; // Sobrescribe TODOS los campos
  
  db.run(
    `UPDATE expedientes SET 
      etapa_activa = ?,
      cliente_id = ?,
      poliza = ?,
      compania = ?,
      ... // todos los campos
    WHERE id = ?`,
    [expediente.etapa_activa, expediente.cliente_id, expediente.poliza, ...]
  );
});
```

### Síntoma:
Cuando actualizas solo `etapa_activa`, se pierde el `cliente_id` porque no estaba en el `req.body`.

---

## ✅ Solución: UPDATE Dinámico

Actualiza **solo los campos enviados** en el body:

```javascript
// ✅ BIEN - Actualiza solo los campos presentes en req.body
app.put('/api/expedientes/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Construir query dinámicamente solo con los campos enviados
  const campos = Object.keys(updates);
  const valores = Object.values(updates);
  
  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  const setClause = campos.map(campo => `${campo} = ?`).join(', ');
  const query = `UPDATE expedientes SET ${setClause} WHERE id = ?`;
  
  db.run(query, [...valores, id], function(err) {
    if (err) {
      console.error('Error al actualizar expediente:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Expediente actualizado',
      changes: this.changes 
    });
  });
});
```

---

## 🔍 Ejemplo de Uso

### Caso 1: Cambiar Etapa
```http
PUT /api/expedientes/123
Content-Type: application/json

{
  "etapa_activa": "Pendiente de pago",
  "fecha_actualizacion": "2025-10-28"
}
```

**Resultado:** Solo actualiza `etapa_activa` y `fecha_actualizacion`. El resto de los campos (`cliente_id`, `poliza`, etc.) **NO se tocan**.

### Caso 2: Aplicar Pago
```http
PUT /api/expedientes/123
Content-Type: application/json

{
  "estatusPago": "Pagado",
  "fechaUltimoPago": "2025-10-28",
  "proximoPago": "2025-11-28"
}
```

**Resultado:** Solo actualiza los 3 campos de pago. Todo lo demás permanece intacto.

---

## 🛡️ Validación Extra (Opcional)

Para mayor seguridad, puedes validar que solo se actualicen campos permitidos:

```javascript
app.put('/api/expedientes/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Campos que se pueden actualizar
  const camposPermitidos = [
    'etapa_activa',
    'estatusPago',
    'fecha_actualizacion',
    'fechaUltimoPago',
    'proximoPago',
    'motivoCancelacion',
    'observaciones'
    // Agregar más según necesites
  ];
  
  // Filtrar solo campos permitidos
  const updatesFiltrados = {};
  Object.keys(updates).forEach(key => {
    if (camposPermitidos.includes(key)) {
      updatesFiltrados[key] = updates[key];
    }
  });
  
  const campos = Object.keys(updatesFiltrados);
  const valores = Object.values(updatesFiltrados);
  
  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }
  
  const setClause = campos.map(campo => `${campo} = ?`).join(', ');
  const query = `UPDATE expedientes SET ${setClause} WHERE id = ?`;
  
  db.run(query, [...valores, id], function(err) {
    if (err) {
      console.error('Error:', err);
      return res.status(500).json({ error: err.message });
    }
    
    res.json({ 
      success: true, 
      camposActualizados: campos,
      changes: this.changes 
    });
  });
});
```

---

## 📝 Testing

Después de implementar el fix, prueba con estos casos:

### Test 1: Verificar que NO se pierden datos
```javascript
// 1. Crear expediente con cliente
POST /api/expedientes
{
  "cliente_id": "ALVARO123",
  "poliza": "POL001",
  "etapa_activa": "Emitida"
}

// 2. Actualizar solo la etapa
PUT /api/expedientes/1
{
  "etapa_activa": "Pendiente de pago"
}

// 3. Verificar que el cliente sigue ahí
GET /api/expedientes/1
// Debe devolver cliente_id: "ALVARO123" ✅
```

### Test 2: Actualización múltiple
```javascript
PUT /api/expedientes/1
{
  "etapa_activa": "Pagado",
  "estatusPago": "Pagado",
  "fechaUltimoPago": "2025-10-28"
}
// Debe actualizar solo estos 3 campos ✅
```

---

## 🚀 Implementación Rápida

Si estás usando **Express + SQLite**, este es el código completo listo para copiar:

```javascript
const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

app.use(express.json());

// ✅ Endpoint corregido
app.put('/api/expedientes/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const campos = Object.keys(updates);
  const valores = Object.values(updates);
  
  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  const setClause = campos.map(campo => `${campo} = ?`).join(', ');
  const query = `UPDATE expedientes SET ${setClause} WHERE id = ?`;
  
  console.log('📝 Actualizando:', { id, campos, valores });
  
  db.run(query, [...valores, id], function(err) {
    if (err) {
      console.error('❌ Error:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }
    
    console.log('✅ Actualizado:', this.changes, 'registro(s)');
    res.json({ 
      success: true, 
      message: 'Expediente actualizado correctamente',
      changes: this.changes,
      camposActualizados: campos
    });
  });
});

app.listen(3000, () => {
  console.log('🚀 Servidor corriendo en http://localhost:3000');
});
```

---

## 📌 Resumen

**Antes (❌):**
- PUT sobrescribía TODO el expediente
- Perdías cliente_id al actualizar etapa_activa

**Después (✅):**
- PUT actualiza SOLO los campos enviados
- Los demás campos quedan intactos
- Frontend puede enviar updates parciales sin miedo

---

## 🔗 Referencias

- [SQLite UPDATE Statement](https://www.sqlite.org/lang_update.html)
- [Express.js PUT Routes](https://expressjs.com/en/guide/routing.html)
- [REST API Best Practices - Partial Updates](https://restfulapi.net/rest-put-vs-post/)

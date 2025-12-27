# 🔄 HUGO: Crear Endpoint para Sincronizar Estatus del Expediente

## 📋 Problema Identificado

Cuando se edita una póliza y se guardan cambios (fechas, recibos, etc.), el listado no muestra la información actualizada porque:

1. ✅ Los recibos se actualizan correctamente en `recibos_pago`
2. ✅ Los campos del expediente se guardan bien en `expedientes`  
3. ❌ **FALTA**: El `estatus_pago` del expediente no se sincroniza con el estatus del próximo recibo pendiente

## 🎯 Solución Requerida

Crear endpoint que sincronice el `estatus_pago` del expediente con la información más actual de sus recibos.

## 🔧 Endpoint a Implementar

### **POST** `/api/expedientes/:id/sync-estatus`

```javascript
// backend/routes/expedientes.js

/**
 * Sincronizar estatus_pago del expediente con el primer recibo pendiente
 */
app.post('/api/expedientes/:id/sync-estatus', async (req, res) => {
  try {
    const expedienteId = req.params.id;
    
    console.log(`🔄 [SYNC] Sincronizando estatus del expediente ${expedienteId}`);
    
    // 1. Obtener el primer recibo pendiente (sin pago)
    const queryRecibos = `
      SELECT numero_recibo, fecha_vencimiento, estatus, monto
      FROM recibos_pago 
      WHERE expediente_id = ? 
        AND fecha_pago_real IS NULL
      ORDER BY numero_recibo ASC
      LIMIT 1
    `;
    
    const [recibos] = await pool.query(queryRecibos, [expedienteId]);
    
    let nuevoEstatus = 'Pagado';
    let nuevaFechaVencimiento = null;
    
    if (recibos.length > 0) {
      // Hay recibos pendientes - usar estatus del primer recibo
      const proximoRecibo = recibos[0];
      nuevoEstatus = proximoRecibo.estatus || 'Pendiente';
      nuevaFechaVencimiento = proximoRecibo.fecha_vencimiento;
      
      console.log(`📊 [SYNC] Próximo recibo: #${proximoRecibo.numero_recibo}, estatus: ${nuevoEstatus}`);
    } else {
      console.log(`✅ [SYNC] No hay recibos pendientes - expediente completamente pagado`);
    }
    
    // 2. Actualizar expediente con el nuevo estatus
    const updateQuery = `
      UPDATE expedientes 
      SET estatus_pago = ?, 
          fecha_vencimiento_pago = ?,
          fecha_pago = ?,
          updated_at = NOW()
      WHERE id = ?
    `;
    
    await pool.query(updateQuery, [
      nuevoEstatus, 
      nuevaFechaVencimiento,
      nuevaFechaVencimiento, // Sincronizar fecha_pago también
      expedienteId
    ]);
    
    console.log(`✅ [SYNC] Expediente ${expedienteId} actualizado: estatus=${nuevoEstatus}, fecha=${nuevaFechaVencimiento}`);
    
    res.json({
      success: true,
      data: {
        expediente_id: expedienteId,
        estatus_anterior: req.body.estatus_anterior || 'N/A',
        estatus_nuevo: nuevoEstatus,
        fecha_vencimiento_pago: nuevaFechaVencimiento,
        recibos_pendientes: recibos.length
      },
      message: 'Estatus del expediente sincronizado correctamente'
    });
    
  } catch (error) {
    console.error('❌ [SYNC] Error al sincronizar estatus:', error);
    res.status(500).json({
      success: false,
      error: 'Error al sincronizar estatus del expediente',
      details: error.message
    });
  }
});
```

## 🧪 Endpoint de Prueba (Opcional)

Para verificar que funciona antes de implementar:

### **POST** `/api/expedientes/:id/debug-recibos`

```javascript
/**
 * Debug: Ver estado de recibos de un expediente
 */
app.post('/api/expedientes/:id/debug-recibos', async (req, res) => {
  try {
    const expedienteId = req.params.id;
    
    // Obtener todos los recibos del expediente
    const queryTodos = `
      SELECT numero_recibo, fecha_vencimiento, estatus, monto, fecha_pago_real
      FROM recibos_pago 
      WHERE expediente_id = ? 
      ORDER BY numero_recibo ASC
    `;
    
    const [todosRecibos] = await pool.query(queryTodos, [expedienteId]);
    
    // Obtener datos del expediente
    const queryExpediente = `
      SELECT numero_poliza, estatus_pago, fecha_vencimiento_pago, fecha_pago
      FROM expedientes 
      WHERE id = ?
    `;
    
    const [expediente] = await pool.query(queryExpediente, [expedienteId]);
    
    res.json({
      success: true,
      data: {
        expediente: expediente[0] || null,
        recibos: todosRecibos,
        recibos_pendientes: todosRecibos.filter(r => !r.fecha_pago_real),
        recibos_pagados: todosRecibos.filter(r => r.fecha_pago_real),
        total_recibos: todosRecibos.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 📝 Pruebas

### 1. Probar endpoint de debug:
```bash
curl -X POST http://localhost:3000/api/expedientes/531/debug-recibos
```

### 2. Probar sincronización:
```bash
curl -X POST http://localhost:3000/api/expedientes/531/sync-estatus
```

### 3. Verificar en BD:
```sql
-- Ver expediente antes y después
SELECT id, numero_poliza, estatus_pago, fecha_vencimiento_pago 
FROM expedientes WHERE id = 531;

-- Ver recibos del expediente
SELECT numero_recibo, fecha_vencimiento, estatus, fecha_pago_real
FROM recibos_pago WHERE expediente_id = 531 ORDER BY numero_recibo;
```

## ✅ Resultado Esperado

Después de implementar:

1. **Usuario edita póliza** → Cambia fechas → Guarda
2. **Frontend llama** → `POST /api/expedientes/531/sync-estatus`
3. **Backend sincroniza** → `estatus_pago` del expediente = estatus del próximo recibo
4. **Frontend recarga lista** → Ve información actualizada correctamente

## 🚨 Importante

- Este endpoint debe ejecutarse **DESPUÉS** de cualquier cambio a recibos o fechas del expediente
- Es especialmente crítico después de:
  - Editar fechas de vigencia
  - Aplicar/remover pagos
  - Cambiar período de gracia
  - Modificar tipo de pago

¡El listado finalmente mostrará la información correcta! 🎉
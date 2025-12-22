# 🎯 IMPLEMENTACIÓN COMPLETA: Eliminar Pagos de Recibos

## 📋 CHECKLIST BACKEND (Hugo)

### 1️⃣ Verificar que exista `GET /api/recibos/:expediente_id`
**Estado:** ✅ Ya existe (según documentación)

**Debe devolver:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "expediente_id": 514,
      "numero_recibo": 1,
      "fecha_vencimiento": "2025-11-14",
      "monto": "8690.00",
      "estatus": "Pagado",
      "fecha_pago_real": "2025-12-22",
      "comprobante_url": "...",
      "comprobante_nombre": "..."
    }
  ]
}
```

**Probar manualmente:**
```bash
GET https://apiseguros.proordersistem.com.mx/api/recibos/514
GET https://apiseguros.proordersistem.com.mx/api/recibos/515
```

---

### 2️⃣ Ajustar `POST /api/recibos/:expediente_id/:numero_recibo/pago`

**PROBLEMA ACTUAL:**
```javascript
// ❌ Rechaza null
if (!fecha_pago_real) {
  return res.status(400).json({ error: 'fecha_pago_real es requerida' });
}
```

**SOLUCIÓN:**
```javascript
// ✅ Eliminar esas 3 líneas completamente
// El endpoint debe aceptar fecha_pago_real = null
```

**Razón:** Cuando CREAS póliza, los recibos se guardan con `fecha_pago_real = NULL`. Al EDITAR debe funcionar igual.

**Lógica del endpoint después del ajuste:**
```javascript
router.post('/recibos/:expediente_id/:numero_recibo/pago', async (req, res) => {
  const { expediente_id, numero_recibo } = req.params;
  const { estatus, fecha_pago_real, comprobante_url, comprobante_nombre } = req.body;

  // ✅ Aceptar cualquier valor (incluso null)
  const query = `
    UPDATE recibos_pago 
    SET 
      estatus = ?,
      fecha_pago_real = ?,
      comprobante_url = ?,
      comprobante_nombre = ?
    WHERE expediente_id = ? AND numero_recibo = ?
  `;
  
  await db.query(query, [
    estatus,
    fecha_pago_real,  // ✅ Puede ser null
    comprobante_url,
    comprobante_nombre,
    expediente_id,
    numero_recibo
  ]);

  res.json({ success: true });
});
```

---

### 3️⃣ (OPCIONAL) Agregar endpoint DELETE si prefieres

Si prefieres usar DELETE en lugar de POST con null:

```javascript
router.delete('/recibos/:expediente_id/:numero_recibo/pago', async (req, res) => {
  const { expediente_id, numero_recibo } = req.params;

  // Calcular estatus basándose en fecha_vencimiento
  const query = `
    UPDATE recibos_pago 
    SET 
      fecha_pago_real = NULL,
      comprobante_url = NULL,
      comprobante_nombre = NULL,
      estatus = CASE 
        WHEN fecha_vencimiento < CURDATE() THEN 'Vencido'
        ELSE 'Pendiente'
      END
    WHERE expediente_id = ? AND numero_recibo = ?
  `;
  
  await db.query(query, [expediente_id, numero_recibo]);

  res.json({ success: true, message: 'Pago eliminado' });
});
```

---

## 🎨 FLUJO FRONTEND (Ya implementado)

### Al editar póliza:
1. ✅ Carga expediente con `GET /api/expedientes/:id`
2. ✅ Carga recibos con `GET /api/recibos/:id`
3. ✅ Muestra calendario con recibos

### Botón "Eliminar pago":
```javascript
// ✅ Solo actualiza estado local
setFormulario(prev => ({
  ...prev,
  recibos: prev.recibos.map(r => 
    r.numero_recibo === pago.numero 
      ? { ...r, fecha_pago_real: null, estatus: 'Vencido' }
      : r
  )
}));
```

### Botón "Guardar":
```javascript
// ✅ Envía POST solo de recibos CON pago
for (const recibo of formulario.recibos) {
  if (recibo.fecha_pago_real) {  // Solo si tiene fecha
    await fetch(`/api/recibos/${id}/${recibo.numero_recibo}/pago`, {
      method: 'POST',
      body: JSON.stringify({
        estatus: recibo.estatus,
        fecha_pago_real: recibo.fecha_pago_real,
        comprobante_url: recibo.comprobante_url,
        comprobante_nombre: recibo.comprobante_nombre
      })
    });
  }
}
```

**Resultado:** Los recibos sin pago (fecha_pago_real = null) NO se tocan, el backend calcula su estatus automáticamente.

---

## 🧪 PRUEBAS

### Caso 1: Pago Anual
1. Crear póliza anual → Backend crea 1 recibo (Pendiente)
2. Registrar pago → POST fecha_pago_real
3. Editar póliza → GET /api/recibos/:id devuelve 1 recibo (Pagado)
4. Eliminar pago → Estado local: fecha_pago_real = null
5. Guardar → **NO envía POST** (porque no tiene fecha_pago_real)
6. Backend mantiene recibo como Pendiente/Vencido

### Caso 2: Pago Fraccionado
1. Crear póliza fraccionada → Backend crea 4 recibos (todos Pendiente)
2. Registrar pago del recibo 1 → POST fecha_pago_real
3. Editar póliza → GET /api/recibos/:id devuelve 4 recibos (1 Pagado, 3 Pendiente)
4. Eliminar pago del recibo 1 → Estado local: fecha_pago_real = null
5. Guardar → **NO envía POST del recibo 1** (porque no tiene fecha_pago_real)
6. Backend recalcula recibo 1 como Vencido

---

## ⚡ RESUMEN PARA HUGO

### ✅ QUÉ HACER:
1. Probar `GET /api/recibos/:expediente_id` con pólizas 514 y 515
2. En `POST /api/recibos/:id/:numero/pago`, eliminar validación `if (!fecha_pago_real)`
3. (Opcional) Crear `DELETE /api/recibos/:id/:numero/pago` si prefieres REST puro

### ⏱️ TIEMPO: 
- Opción 1 (solo ajustar POST): **30 segundos**
- Opción 2 (agregar DELETE): **5 minutos**

### 🎯 RESULTADO:
- Frontend puede eliminar pagos sin errores
- Recibos vuelven a Pendiente/Vencido automáticamente
- Mismo comportamiento que al crear póliza por primera vez

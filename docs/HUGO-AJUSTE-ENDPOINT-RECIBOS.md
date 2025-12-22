# 🔧 AJUSTE: Endpoint POST /api/recibos/:id/:numero/pago

## 💡 El punto clave

Cuando **CREAS** una póliza, guardas recibos con:
```sql
INSERT INTO recibos_pago (expediente_id, numero_recibo, fecha_vencimiento, monto, estatus)
VALUES (515, 2, '2025-11-14', 1290.81, 'Pendiente')
-- ✅ fecha_pago_real es NULL por defecto
```

Cuando **EDITAS** y eliminas un pago, debe quedar exactamente igual:
```sql
UPDATE recibos_pago 
SET estatus = 'Vencido', fecha_pago_real = NULL
WHERE expediente_id = 515 AND numero_recibo = 2
```

---

## ✅ Solución (Eliminar 1 validación)

**Ubicación:** Endpoint `POST /api/recibos/:expediente_id/:numero_recibo/pago`

**ELIMINAR:**
```javascript
if (!fecha_pago_real) {
  return res.status(400).json({ error: 'fecha_pago_real es requerida' });
}
```

**Resultado:** El endpoint acepta `fecha_pago_real: null` igual que cuando creas recibos.

---

## 📦 Frontend envía (igual que al crear):

```json
{
  "estatus": "Vencido",
  "fecha_pago_real": null
}
```

Backend guarda exactamente eso, como si fuera un recibo nuevo.

---

**Tiempo:** 30 segundos (borrar 3 líneas)

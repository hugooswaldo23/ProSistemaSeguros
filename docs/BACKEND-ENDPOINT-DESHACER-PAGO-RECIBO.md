# 🔙 Endpoint para Deshacer Pago de Recibo

## Objetivo

Crear un endpoint para deshacer (remover) un pago de un recibo específico en la tabla `recibos_pago`. Esto es necesario cuando se aplica un pago por error y se necesita revertirlo.

---

## Endpoint Requerido

### `POST /api/recibos/:expediente_id/:numero_recibo/deshacer-pago`

**Descripción:** Desmarca un recibo como pagado, limpiando los campos de pago.

**Parámetros de URL:**
- `expediente_id`: ID del expediente (VARCHAR)
- `numero_recibo`: Número del recibo a desmarcar (INT)

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Pago del recibo removido correctamente",
  "data": {
    "expediente_id": "510",
    "numero_recibo": 1,
    "estatus": "Vencido",
    "fecha_pago_real": null,
    "fecha_captura_pago": null,
    "comprobante_url": null,
    "comprobante_nombre": null
  }
}
```

---

## Implementación Backend (Node.js/Express)

```javascript
/**
 * POST /api/recibos/:expediente_id/:numero_recibo/deshacer-pago
 * Desmarca un recibo como pagado (revertir pago)
 */
app.post('/api/recibos/:expediente_id/:numero_recibo/deshacer-pago', async (req, res) => {
  const { expediente_id, numero_recibo } = req.params;
  
  try {
    console.log(`🔙 Deshaciendo pago de recibo ${numero_recibo} del expediente ${expediente_id}`);
    
    // 1. Verificar que el recibo existe
    const [recibos] = await pool.query(
      'SELECT * FROM recibos_pago WHERE expediente_id = ? AND numero_recibo = ?',
      [expediente_id, parseInt(numero_recibo)]
    );
    
    if (recibos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recibo no encontrado'
      });
    }
    
    const recibo = recibos[0];
    
    // 2. Verificar que el recibo estaba pagado
    if (!recibo.fecha_pago_real) {
      return res.status(400).json({
        success: false,
        error: 'Este recibo no tiene un pago registrado'
      });
    }
    
    // 3. Limpiar campos de pago del recibo
    await pool.query(
      `UPDATE recibos_pago 
       SET fecha_pago_real = NULL,
           fecha_captura_pago = NULL,
           comprobante_url = NULL,
           comprobante_nombre = NULL,
           estatus = CASE 
             WHEN fecha_vencimiento < CURDATE() THEN 'Vencido'
             WHEN DATEDIFF(fecha_vencimiento, CURDATE()) <= 15 THEN 'Pago por vencer'
             ELSE 'Pendiente'
           END
       WHERE expediente_id = ? AND numero_recibo = ?`,
      [expediente_id, parseInt(numero_recibo)]
    );
    
    // 4. Obtener el recibo actualizado
    const [recibosActualizados] = await pool.query(
      'SELECT * FROM recibos_pago WHERE expediente_id = ? AND numero_recibo = ?',
      [expediente_id, parseInt(numero_recibo)]
    );
    
    const reciboActualizado = recibosActualizados[0];
    
    console.log('✅ Pago del recibo removido correctamente');
    
    res.json({
      success: true,
      message: 'Pago del recibo removido correctamente',
      data: reciboActualizado
    });
    
  } catch (error) {
    console.error('❌ Error al deshacer pago del recibo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## Lógica del Estatus

Al deshacer un pago, el estatus del recibo se recalcula automáticamente:

| Condición | Estatus |
|-----------|---------|
| `fecha_vencimiento < HOY` | **Vencido** |
| `DÍAS_RESTANTES <= 15` | **Pago por vencer** |
| `DÍAS_RESTANTES > 15` | **Pendiente** |

Esto asegura que el recibo tenga el estatus correcto después de remover el pago.

---

## Flujo Completo

### Cuando el usuario remueve un pago:

1. **Frontend** llama a `pagosService.removerPago(expediente, numeroRecibo)`
2. **Backend** actualiza tabla `expedientes`:
   - `ultimo_recibo_pagado = numeroRecibo - 1`
   - `estatus_pago` recalculado
   - `fecha_vencimiento_pago` recalculada
3. **Backend** llama a `/api/recibos/:id/:numero/deshacer-pago`:
   - Limpia `fecha_pago_real`, `comprobante_url`, etc.
   - Recalcula `estatus` del recibo
4. **Frontend** recarga recibos desde `/api/recibos/:id`
5. **Frontend** actualiza el calendario en el formulario
6. **Usuario** ve cambios inmediatamente sin recargar página

---

## Testing

```bash
# Deshacer pago del recibo 1
curl -X POST http://localhost:3000/api/recibos/510/1/deshacer-pago

# Verificar que el recibo ya no tiene pago
curl http://localhost:3000/api/recibos/510/1
```

---

## Notas Importantes

1. ✅ El endpoint solo desmarca recibos que están pagados
2. ✅ Recalcula automáticamente el estatus según fecha de vencimiento
3. ✅ Limpia comprobante de pago (URL y nombre)
4. ✅ Compatible con el flujo de remover pagos del formulario
5. ⚠️ No elimina el recibo, solo limpia los campos de pago
6. ⚠️ El expediente se actualiza por separado (en pagosService.removerPago)

---

## Próximos Pasos

- [ ] Hugo implementa el endpoint `POST /api/recibos/:expediente_id/:numero_recibo/deshacer-pago`
- [ ] Hugo verifica que el estatus se recalcula correctamente
- [ ] Álvaro prueba remover pago desde el calendario
- [ ] Verificar que el listado se actualiza sin recargar página

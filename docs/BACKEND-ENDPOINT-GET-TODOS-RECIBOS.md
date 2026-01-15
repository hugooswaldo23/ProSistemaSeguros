# Backend: Endpoint GET /api/recibos (Todos los Recibos)

## Requerido Para

Panel Financiero del Dashboard - Optimización de rendimiento para cálculo de montos pagados, por vencer y vencidos.

## Problema Actual

Para calcular correctamente los montos en el panel financiero, se necesita acceder a todos los recibos. Actualmente solo existe `GET /api/recibos/:expediente_id` que requiere una petición por cada expediente.

Con 2000+ pólizas y 3500+ recibos, hacer peticiones individuales no es eficiente.

## Campos Necesarios por Recibo

El frontend necesita estos campos para cada recibo:

| Campo | Uso |
|-------|-----|
| `expediente_id` | Asociar recibo a su póliza |
| `numero_recibo` | Identificar qué recibo es (1, 2, 3...) |
| `monto` | Sumar montos para las tarjetas |
| `estatus` | Filtrar por Pagado/Por Vencer/Vencido/Pendiente |
| `fecha_vencimiento` | Saber cuándo vence el recibo |
| `fecha_pago_real` | Saber CUÁNDO se pagó (para filtrar pagados por mes) |
| `created_at` | **Fecha de emisión/creación del recibo** (para pintar en mes actual o anterior) |

## Solución Requerida

### Nuevo Endpoint: `GET /api/recibos`

Sin parámetros, devuelve TODOS los recibos de la tabla `recibos_pago`.

```javascript
// Endpoint en Express
app.get('/api/recibos', async (req, res) => {
  try {
    const [recibos] = await pool.query(`
      SELECT 
        id,
        expediente_id,
        numero_recibo,
        fecha_vencimiento,
        monto,
        estatus,
        fecha_pago_real,
        fecha_captura_pago,
        created_at
      FROM recibos_pago
      ORDER BY expediente_id, numero_recibo
    `);
    
    res.json(recibos);
  } catch (error) {
    console.error('Error al obtener recibos:', error);
    res.status(500).json({ error: 'Error al obtener recibos' });
  }
});
```

### Respuesta Esperada

```json
[
  {
    "id": 1,
    "expediente_id": "abc-123",
    "numero_recibo": 1,
    "fecha_vencimiento": "2026-01-15",
    "monto": 2500.00,
    "estatus": "Pagado",
    "fecha_pago_real": "2026-01-10",
    "fecha_captura_pago": "2026-01-10T15:30:00"
  },
  {
    "id": 2,
    "expediente_id": "abc-123",
    "numero_recibo": 2,
    "fecha_vencimiento": "2026-02-15",
    "monto": 2500.00,
    "estatus": "Pendiente",
    "fecha_pago_real": null,
    "fecha_captura_pago": null
  }
]
```

## Uso en Frontend

El Dashboard hace UNA sola petición para obtener todos los recibos:

```javascript
const [resExpedientes, resClientes, resRecibos] = await Promise.all([
  fetch(`${API_URL}/api/expedientes`),
  fetch(`${API_URL}/api/clientes`),
  fetch(`${API_URL}/api/recibos`)  // <-- Nueva petición
]);
```

Luego agrupa los recibos por `expediente_id` y calcula los montos pagados correctamente:

- **Pago Anual**: Si está pagado → cuenta el `total`
- **Pago Fraccionado**: Suma solo los recibos con `estatus = 'Pagado'`

## Prioridad

**ALTA** - Necesario para que el Panel Financiero muestre montos correctos.

## Notas

- El endpoint ya puede existir, solo necesita verificarse
- Si hay muchos recibos (3500+), considerar agregar paginación opcional
- Los índices `idx_expediente` y `idx_estatus` en la tabla ayudarán al rendimiento

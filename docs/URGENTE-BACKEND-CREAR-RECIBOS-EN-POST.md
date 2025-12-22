# 🚨 URGENTE: Backend NO está creando recibos al crear póliza

## Problema Detectado

Al hacer `POST /api/expedientes` para crear una póliza nueva con **Tipo de Pago = "Fraccionado"**, el backend:

✅ SÍ crea el registro en la tabla `expedientes`  
❌ NO crea los registros en la tabla `recibos_pago`

### Evidencia

```javascript
// Frontend - Consola del navegador
CalendarioPagos - Renderizando con: {
  tiene_onRemoverPago: true, 
  cantidad_recibos: 0,     // ❌ Debería ser 4
  recibos: undefined       // ❌ Debería ser Array(4)
}

✅ POST completado | ID: 512  // Póliza creada exitosamente
// Pero sin recibos
```

---

## Solución Requerida

El endpoint `POST /api/expedientes` debe crear automáticamente los recibos según el tipo de pago:

### 1. Importar función de cálculo

```javascript
const { calcularRecibos } = require('./utils/calcularRecibos');
```

### 2. Modificar el endpoint POST

```javascript
app.post('/api/expedientes', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1️⃣ Insertar expediente
    const [result] = await connection.query(
      'INSERT INTO expedientes (...) VALUES (...)',
      [...]
    );
    
    const expedienteId = result.insertId;
    console.log(`✅ Expediente ${expedienteId} creado`);
    
    // 2️⃣ Crear recibos si es pago fraccionado o anual
    const tipoPago = req.body.tipo_pago || req.body.forma_pago;
    const esFraccionado = tipoPago === 'Fraccionado';
    const esAnual = tipoPago === 'Anual' || tipoPago === 'Contado';
    
    if (esFraccionado || esAnual) {
      console.log(`💰 Creando recibos para póliza ${tipoPago}...`);
      
      // Calcular recibos
      const recibos = calcularRecibos({
        ...req.body,
        id: expedienteId
      });
      
      console.log(`📋 Recibos calculados: ${recibos.length}`);
      
      // 3️⃣ Insertar recibos en lote
      if (recibos.length > 0) {
        const values = recibos.map(r => 
          `(${expedienteId}, ${r.numero_recibo}, '${r.fecha_vencimiento}', ${r.monto}, '${r.estatus}')`
        ).join(',');
        
        await connection.query(`
          INSERT INTO recibos_pago (expediente_id, numero_recibo, fecha_vencimiento, monto, estatus)
          VALUES ${values}
        `);
        
        console.log(`✅ ${recibos.length} recibos insertados en BD`);
        
        // 4️⃣ Actualizar estatus_pago en expediente (primer recibo)
        const primerRecibo = recibos[0];
        await connection.query(
          'UPDATE expedientes SET estatus_pago = ?, fecha_vencimiento_pago = ? WHERE id = ?',
          [primerRecibo.estatus, primerRecibo.fecha_vencimiento, expedienteId]
        );
        
        console.log(`✅ Estatus actualizado: ${primerRecibo.estatus}`);
      }
    }
    
    await connection.commit();
    
    // 5️⃣ Devolver expediente con recibos
    const [expedienteCompleto] = await connection.query(
      'SELECT * FROM expedientes WHERE id = ?',
      [expedienteId]
    );
    
    const [recibosCreados] = await connection.query(
      'SELECT * FROM recibos_pago WHERE expediente_id = ? ORDER BY numero_recibo ASC',
      [expedienteId]
    );
    
    res.status(201).json({
      success: true,
      data: {
        ...expedienteCompleto[0],
        recibos: recibosCreados
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear expediente:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
```

---

## Archivo: `utils/calcularRecibos.js`

Este archivo YA está documentado en `docs/BACKEND-TABLA-RECIBOS-PAGO.md` líneas 54-128.

```javascript
// utils/calcularRecibos.js
function calcularRecibos(expediente) {
  const recibos = [];
  const esAnual = expediente.tipo_pago === 'Anual' || expediente.tipo_pago === 'Contado';
  const esFraccionado = expediente.tipo_pago === 'Fraccionado';
  
  if (!esAnual && !esFraccionado) return [];
  
  // Calcular número de pagos
  const numeroPagos = esAnual ? 1 : PAGOS_POR_FRECUENCIA[expediente.frecuencia_pago];
  
  // Calcular fechas y montos para cada recibo
  for (let i = 1; i <= numeroPagos; i++) {
    // ... (ver documentación completa)
    recibos.push({
      numero_recibo: i,
      fecha_vencimiento: fechaVencimiento,
      monto: monto,
      estatus: calcularEstatus(fechaVencimiento)
    });
  }
  
  return recibos;
}

module.exports = { calcularRecibos };
```

---

## Verificación

Después de implementar, crear una póliza de prueba:

```json
POST /api/expedientes
{
  "numero_poliza": "TEST001",
  "tipo_pago": "Fraccionado",
  "frecuencia_pago": "Trimestral",
  "inicio_vigencia": "2025-08-14",
  "primer_pago": "2033.19",
  "pagos_subsecuentes": "1290.81",
  "periodo_gracia": 14,
  "compania": "Qualitas",
  ...
}
```

**Debe retornar:**

```json
{
  "success": true,
  "data": {
    "id": 512,
    "numero_poliza": "TEST001",
    "recibos": [
      {
        "id": 132,
        "expediente_id": 512,
        "numero_recibo": 1,
        "fecha_vencimiento": "2025-08-28",
        "monto": "2033.19",
        "estatus": "Vencido",
        "fecha_pago_real": null
      },
      {
        "numero_recibo": 2,
        "fecha_vencimiento": "2025-11-14",
        "monto": "1290.81",
        "estatus": "Vencido"
      },
      // ... 2 recibos más
    ]
  }
}
```

---

## Impacto

**Sin recibos:**
- ❌ El calendario de pagos está vacío
- ❌ No se puede aplicar pagos
- ❌ El listado no muestra estado correcto
- ❌ Las notificaciones de vencimiento no funcionan

**Con recibos:**
- ✅ Calendario muestra todos los pagos pendientes
- ✅ Se pueden aplicar pagos individuales
- ✅ Listado muestra "X/Y Estado" correctamente
- ✅ Sistema de notificaciones funciona

---

## Referencias

- `docs/BACKEND-TABLA-RECIBOS-PAGO.md` - Documentación completa
- `docs/BACKEND-ENDPOINT-DESHACER-PAGO-RECIBO.md` - Para remover pagos

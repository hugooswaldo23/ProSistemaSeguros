# 📋 Implementación de Tabla `recibos_pago`

## Objetivo

Crear una tabla para almacenar cada recibo de pago de las pólizas, con su fecha de vencimiento, monto y estatus individual. Esto mejora el rendimiento y permite un mejor control de pagos fraccionados.

---

## 1️⃣ Crear la Tabla en MySQL

```sql
CREATE TABLE recibos_pago (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expediente_id VARCHAR(50) NOT NULL,
  numero_recibo INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  estatus ENUM('Pendiente', 'Pago por vencer', 'Vencido', 'Pagado') DEFAULT 'Pendiente',
  fecha_pago_real DATE NULL,
  fecha_captura_pago DATETIME NULL,
  comprobante_url VARCHAR(500) NULL,
  comprobante_nombre VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE,
  INDEX idx_expediente (expediente_id),
  INDEX idx_estatus (estatus),
  INDEX idx_fecha_vencimiento (fecha_vencimiento),
  UNIQUE KEY unique_recibo (expediente_id, numero_recibo)
);
```

### Explicación de Campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INT | ID único del recibo |
| `expediente_id` | VARCHAR(50) | Referencia al expediente |
| `numero_recibo` | INT | Número del recibo (1, 2, 3, 4) |
| `fecha_vencimiento` | DATE | Fecha límite de pago |
| `monto` | DECIMAL | Monto a pagar en este recibo |
| `estatus` | ENUM | Pendiente, Pago por vencer, Vencido, Pagado |
| `fecha_pago_real` | DATE | Fecha en que el cliente pagó |
| `fecha_captura_pago` | DATETIME | Fecha en que se registró en el sistema |
| `comprobante_url` | VARCHAR | URL del comprobante en S3 |
| `comprobante_nombre` | VARCHAR | Nombre del archivo del comprobante |

---

## 2️⃣ Función Helper para Calcular Fechas de Recibos

```javascript
// utils/calcularRecibos.js (Backend Node.js)

const MESES_POR_FRECUENCIA = {
  'Mensual': 1,
  'Bimestral': 2,
  'Trimestral': 3,
  'Cuatrimestral': 4,
  'Semestral': 6
};

const PAGOS_POR_FRECUENCIA = {
  'Mensual': 12,
  'Bimestral': 6,
  'Trimestral': 4,
  'Cuatrimestral': 3,
  'Semestral': 2
};

function calcularRecibos(expediente) {
  const recibos = [];
  const esAnual = expediente.tipo_pago === 'Anual' || expediente.tipo_pago === 'Contado';
  const esFraccionado = expediente.tipo_pago === 'Fraccionado';
  
  if (!esAnual && !esFraccionado) return [];
  
  const numeroPagos = esAnual ? 1 : PAGOS_POR_FRECUENCIA[expediente.frecuencia_pago];
  const periodoGracia = expediente.periodo_gracia || 
                        (expediente.compania?.toLowerCase().includes('qualitas') ? 14 : 30);
  
  const inicioVigencia = new Date(expediente.inicio_vigencia);
  const primerPagoMonto = parseFloat(expediente.primer_pago || expediente.total);
  const pagosSubsecuentesMonto = parseFloat(expediente.pagos_subsecuentes || expediente.total);
  
  for (let i = 1; i <= numeroPagos; i++) {
    let fechaVencimiento;
    let monto;
    
    if (i === 1) {
      // Primer recibo: inicio_vigencia + periodo_gracia
      fechaVencimiento = new Date(inicioVigencia);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + periodoGracia);
      monto = primerPagoMonto;
    } else {
      // Recibos subsecuentes: inicio_vigencia + N meses
      const mesesAAgregar = (i - 1) * MESES_POR_FRECUENCIA[expediente.frecuencia_pago];
      fechaVencimiento = new Date(inicioVigencia);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + mesesAAgregar);
      monto = pagosSubsecuentesMonto;
    }
    
    // Calcular estatus inicial
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaVencimiento.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
    
    let estatus = 'Pendiente';
    if (diasRestantes < 0) {
      estatus = 'Vencido';
    } else if (diasRestantes <= 15) {
      estatus = 'Pago por vencer';
    }
    
    recibos.push({
      numero_recibo: i,
      fecha_vencimiento: fechaVencimiento.toISOString().split('T')[0],
      monto: monto.toFixed(2),
      estatus: estatus
    });
  }
  
  return recibos;
}

module.exports = { calcularRecibos };
```

---

## 3️⃣ Modificar Endpoint: Crear Expediente

### `POST /api/expedientes`

```javascript
const { calcularRecibos } = require('./utils/calcularRecibos');

app.post('/api/expedientes', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Insertar expediente
    const [result] = await connection.query(
      'INSERT INTO expedientes (...) VALUES (...)',
      [...]
    );
    
    const expedienteId = result.insertId;
    
    // 2. Si es Anual o Fraccionado, calcular y crear recibos
    const tipoPago = req.body.tipo_pago || req.body.forma_pago;
    if (tipoPago === 'Anual' || tipoPago === 'Contado' || tipoPago === 'Fraccionado') {
      const recibos = calcularRecibos({
        ...req.body,
        id: expedienteId
      });
      
      // 3. Insertar recibos en lote
      if (recibos.length > 0) {
        const values = recibos.map(r => 
          `('${expedienteId}', ${r.numero_recibo}, '${r.fecha_vencimiento}', ${r.monto}, '${r.estatus}')`
        ).join(',');
        
        await connection.query(`
          INSERT INTO recibos_pago (expediente_id, numero_recibo, fecha_vencimiento, monto, estatus)
          VALUES ${values}
        `);
      }
      
      // 4. Actualizar estatus_pago_general en expediente (estatus del primer recibo)
      const primerRecibo = recibos[0];
      await connection.query(
        'UPDATE expedientes SET estatus_pago = ?, fecha_vencimiento_pago = ? WHERE id = ?',
        [primerRecibo.estatus, primerRecibo.fecha_vencimiento, expedienteId]
      );
    }
    
    await connection.commit();
    res.json({ success: true, id: expedienteId });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear expediente:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
```

---

## 4️⃣ Modificar Endpoint: Consultar Expedientes

### `GET /api/expedientes/:id`

```javascript
app.get('/api/expedientes/:id', async (req, res) => {
  try {
    // 1. Obtener expediente
    const [expedientes] = await pool.query(
      'SELECT * FROM expedientes WHERE id = ?',
      [req.params.id]
    );
    
    if (expedientes.length === 0) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }
    
    const expediente = expedientes[0];
    
    // 2. Obtener recibos de pago
    const [recibos] = await pool.query(
      'SELECT * FROM recibos_pago WHERE expediente_id = ? ORDER BY numero_recibo ASC',
      [req.params.id]
    );
    
    // 3. Devolver expediente con sus recibos
    res.json({
      ...expediente,
      recibos: recibos
    });
    
  } catch (error) {
    console.error('Error al obtener expediente:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### `GET /api/expedientes` (Listado)

```javascript
app.get('/api/expedientes', async (req, res) => {
  try {
    // 1. Obtener todos los expedientes
    const [expedientes] = await pool.query('SELECT * FROM expedientes');
    
    // 2. Para cada expediente, obtener su próximo recibo pendiente
    const expedientesConRecibos = await Promise.all(
      expedientes.map(async (exp) => {
        const [recibos] = await pool.query(
          `SELECT * FROM recibos_pago 
           WHERE expediente_id = ? 
           ORDER BY numero_recibo ASC`,
          [exp.id]
        );
        
        return {
          ...exp,
          recibos: recibos
        };
      })
    );
    
    res.json(expedientesConRecibos);
    
  } catch (error) {
    console.error('Error al obtener expedientes:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 5️⃣ Nuevo Endpoint: Aplicar Pago a Recibo

### `POST /api/expedientes/:id/recibos/:numero/pago`

```javascript
app.post('/api/expedientes/:id/recibos/:numero/pago', async (req, res) => {
  const { id: expedienteId, numero: numeroRecibo } = req.params;
  const { fecha_pago_real, comprobante_url, comprobante_nombre } = req.body;
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Marcar el recibo como pagado
    await connection.query(`
      UPDATE recibos_pago 
      SET estatus = 'Pagado',
          fecha_pago_real = ?,
          fecha_captura_pago = NOW(),
          comprobante_url = ?,
          comprobante_nombre = ?
      WHERE expediente_id = ? AND numero_recibo = ?
    `, [fecha_pago_real, comprobante_url, comprobante_nombre, expedienteId, numeroRecibo]);
    
    // 2. Actualizar ultimo_recibo_pagado en expediente
    await connection.query(
      'UPDATE expedientes SET ultimo_recibo_pagado = ? WHERE id = ?',
      [numeroRecibo, expedienteId]
    );
    
    // 3. Buscar el siguiente recibo pendiente
    const [siguienteRecibo] = await connection.query(`
      SELECT numero_recibo, fecha_vencimiento, estatus 
      FROM recibos_pago 
      WHERE expediente_id = ? AND estatus != 'Pagado'
      ORDER BY numero_recibo ASC
      LIMIT 1
    `, [expedienteId]);
    
    // 4. Actualizar estatus_pago del expediente
    if (siguienteRecibo.length > 0) {
      // Hay más recibos pendientes
      await connection.query(`
        UPDATE expedientes 
        SET estatus_pago = ?,
            fecha_vencimiento_pago = ?
        WHERE id = ?
      `, [siguienteRecibo[0].estatus, siguienteRecibo[0].fecha_vencimiento, expedienteId]);
    } else {
      // Ya no hay recibos pendientes - póliza completamente pagada
      await connection.query(`
        UPDATE expedientes 
        SET estatus_pago = 'Pagado',
            fecha_vencimiento_pago = NULL,
            etapa_activa = 'En Vigencia'
        WHERE id = ?
      `, [expedienteId]);
    }
    
    await connection.commit();
    res.json({ success: true, message: 'Pago aplicado correctamente' });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error al aplicar pago:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
```

---

## 6️⃣ Cron Job: Actualizar Estatus de Recibos

```javascript
// cron/actualizarEstatusRecibos.js

const cron = require('node-cron');

// Ejecutar todos los días a las 00:00
cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Ejecutando actualización de estatus de recibos...');
  
  try {
    await pool.query(`
      UPDATE recibos_pago
      SET estatus = CASE 
        WHEN DATEDIFF(fecha_vencimiento, CURDATE()) < 0 THEN 'Vencido'
        WHEN DATEDIFF(fecha_vencimiento, CURDATE()) <= 15 THEN 'Pago por vencer'
        ELSE 'Pendiente'
      END
      WHERE estatus != 'Pagado'
    `);
    
    // Actualizar estatus_pago en expedientes (basado en próximo recibo pendiente)
    await pool.query(`
      UPDATE expedientes e
      INNER JOIN (
        SELECT expediente_id, MIN(numero_recibo) as proximo_recibo
        FROM recibos_pago
        WHERE estatus != 'Pagado'
        GROUP BY expediente_id
      ) proximos ON e.id = proximos.expediente_id
      INNER JOIN recibos_pago r ON r.expediente_id = proximos.expediente_id 
                                AND r.numero_recibo = proximos.proximo_recibo
      SET e.estatus_pago = r.estatus,
          e.fecha_vencimiento_pago = r.fecha_vencimiento
    `);
    
    console.log('✅ Estatus de recibos actualizado');
  } catch (error) {
    console.error('❌ Error al actualizar estatus:', error);
  }
});
```

---

## 7️⃣ Migración de Datos Existentes

Para migrar las pólizas existentes que no tienen recibos creados:

```sql
-- Crear stored procedure para migrar
DELIMITER $$

CREATE PROCEDURE migrar_recibos_existentes()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE exp_id VARCHAR(50);
  DECLARE cur CURSOR FOR SELECT id FROM expedientes WHERE tipo_pago IN ('Anual', 'Contado', 'Fraccionado');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO exp_id;
    IF done THEN
      LEAVE read_loop;
    END IF;

    -- Aquí llamar a la función de Node.js o replicar la lógica en SQL
    -- (Es más fácil hacerlo desde Node.js con el helper calcularRecibos)
    
  END LOOP;

  CLOSE cur;
END$$

DELIMITER ;
```

O mejor, desde Node.js:

```javascript
// scripts/migrarRecibos.js

async function migrarRecibosPólizasExistentes() {
  const [expedientes] = await pool.query(`
    SELECT * FROM expedientes 
    WHERE tipo_pago IN ('Anual', 'Contado', 'Fraccionado')
      AND id NOT IN (SELECT DISTINCT expediente_id FROM recibos_pago)
  `);
  
  for (const exp of expedientes) {
    const recibos = calcularRecibos(exp);
    
    for (const recibo of recibos) {
      await pool.query(`
        INSERT INTO recibos_pago (expediente_id, numero_recibo, fecha_vencimiento, monto, estatus)
        VALUES (?, ?, ?, ?, ?)
      `, [exp.id, recibo.numero_recibo, recibo.fecha_vencimiento, recibo.monto, recibo.estatus]);
    }
    
    console.log(`✅ Recibos creados para póliza ${exp.numero_poliza}`);
  }
  
  console.log('✅ Migración completada');
}
```

---

## 8️⃣ Checklist de Implementación

- [ ] Crear tabla `recibos_pago` en MySQL
- [ ] Implementar función `calcularRecibos()` en utils
- [ ] Modificar `POST /api/expedientes` para crear recibos
- [ ] Modificar `GET /api/expedientes/:id` para incluir recibos
- [ ] Modificar `GET /api/expedientes` para incluir recibos
- [ ] Crear endpoint `POST /api/expedientes/:id/recibos/:numero/pago`
- [ ] Implementar cron job para actualizar estatus
- [ ] Migrar pólizas existentes
- [ ] Probar con póliza de prueba
- [ ] Verificar en frontend que todo funciona

---

**Fecha:** 10 de diciembre de 2025  
**Prioridad:** 🔴 ALTA  
**Estimación:** 4-6 horas de desarrollo

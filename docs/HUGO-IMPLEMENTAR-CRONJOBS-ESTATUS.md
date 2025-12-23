# 🤖 HUGO: Implementar Cronjobs para Actualización Automática de Estatus

## 📋 Objetivo

Implementar 3 cronjobs que actualicen automáticamente el campo `estatus_pago` de los recibos según su fecha de vencimiento. Estos cronjobs son **CRÍTICOS** para que el sistema de clasificación de pólizas funcione correctamente.

## ⚙️ Jobs Requeridos

### Job 1: Marcar Recibos "Por Vencer" (≤15 días)
**Frecuencia:** Diario a las 00:01 AM
**Acción:** Cambiar `estatus = 'Por vencer'` para recibos que vencen en ≤15 días

### Job 2: Marcar Recibos "Vencido" (fecha pasada)
**Frecuencia:** Diario a las 00:01 AM
**Acción:** Cambiar `estatus = 'Vencido'` para recibos con fecha_vencimiento < HOY

### Job 3: Mantener Recibos "Pendiente" (>15 días)
**Frecuencia:** Diario a las 00:01 AM
**Acción:** Asegurar que recibos con vencimiento >15 días tengan `estatus = 'Pendiente'`

### Job 4: Sincronizar estatus_pago del expediente
**Frecuencia:** Diario a las 00:05 AM (después de actualizar recibos)
**Acción:** Actualizar `expedientes.estatus_pago` con el estatus del próximo recibo pendiente

## 🔧 Implementación

### 1. Instalar node-cron

```bash
npm install node-cron
```

### 2. Crear archivo: `backend/jobs/actualizarEstatusRecibos.js`

```javascript
/**
 * ====================================================================
 * CRONJOB: Actualización Automática de Estatus de Recibos
 * ====================================================================
 * Actualiza diariamente el estatus de los recibos según su fecha de vencimiento
 * - Por vencer: ≤15 días para vencimiento
 * - Vencido: fecha de vencimiento pasada
 * - Pendiente: >15 días para vencimiento
 */

const cron = require('node-cron');
const pool = require('../config/database'); // Ajustar según tu configuración

/**
 * Job 1: Marcar recibos como "Por vencer" (≤15 días)
 */
const marcarRecibosPorVencer = async () => {
  try {
    console.log('🔄 [CRONJOB] Iniciando actualización de recibos "Por vencer"...');
    
    const query = `
      UPDATE recibos_pago 
      SET estatus = 'Por vencer',
          updated_at = NOW()
      WHERE fecha_pago_real IS NULL
        AND fecha_vencimiento IS NOT NULL
        AND DATEDIFF(fecha_vencimiento, CURDATE()) <= 15
        AND DATEDIFF(fecha_vencimiento, CURDATE()) >= 0
        AND estatus != 'Por vencer'
    `;
    
    const [result] = await pool.query(query);
    
    console.log(`✅ [CRONJOB] ${result.affectedRows} recibos marcados como "Por vencer"`);
    
    return result.affectedRows;
  } catch (error) {
    console.error('❌ [CRONJOB] Error al marcar recibos "Por vencer":', error);
    throw error;
  }
};

/**
 * Job 2: Marcar recibos como "Vencido" (fecha pasada)
 */
const marcarRecibosVencidos = async () => {
  try {
    console.log('🔄 [CRONJOB] Iniciando actualización de recibos "Vencido"...');
    
    const query = `
      UPDATE recibos_pago 
      SET estatus = 'Vencido',
          updated_at = NOW()
      WHERE fecha_pago_real IS NULL
        AND fecha_vencimiento IS NOT NULL
        AND fecha_vencimiento < CURDATE()
        AND estatus != 'Vencido'
    `;
    
    const [result] = await pool.query(query);
    
    console.log(`✅ [CRONJOB] ${result.affectedRows} recibos marcados como "Vencido"`);
    
    return result.affectedRows;
  } catch (error) {
    console.error('❌ [CRONJOB] Error al marcar recibos "Vencido":', error);
    throw error;
  }
};

/**
 * Job 3: Mantener recibos como "Pendiente" (>15 días)
 */
const mantenerRecibosPendientes = async () => {
  try {
    console.log('🔄 [CRONJOB] Iniciando actualización de recibos "Pendiente"...');
    
    const query = `
      UPDATE recibos_pago 
      SET estatus = 'Pendiente',
          updated_at = NOW()
      WHERE fecha_pago_real IS NULL
        AND fecha_vencimiento IS NOT NULL
        AND DATEDIFF(fecha_vencimiento, CURDATE()) > 15
        AND estatus != 'Pendiente'
    `;
    
    const [result] = await pool.query(query);
    
    console.log(`✅ [CRONJOB] ${result.affectedRows} recibos marcados como "Pendiente"`);
    
    return result.affectedRows;
  } catch (error) {
    console.error('❌ [CRONJOB] Error al mantener recibos "Pendiente":', error);
    throw error;
  }
};

/**
 * Job 4: Sincronizar estatus_pago del expediente con el próximo recibo pendiente
 */
const sincronizarEstatusExpedientes = async () => {
  try {
    console.log('🔄 [CRONJOB] Iniciando sincronización de estatus_pago en expedientes...');
    
    // Query para obtener el estatus del próximo recibo pendiente por expediente
    const query = `
      UPDATE expedientes e
      INNER JOIN (
        SELECT 
          expediente_id,
          MIN(numero_recibo) as proximo_recibo,
          estatus as estatus_proximo_recibo,
          fecha_vencimiento as fecha_vencimiento_proximo
        FROM recibos_pago
        WHERE fecha_pago_real IS NULL
        GROUP BY expediente_id
      ) r ON e.id = r.expediente_id
      INNER JOIN recibos_pago rp ON rp.expediente_id = r.expediente_id 
        AND rp.numero_recibo = r.proximo_recibo
      SET 
        e.estatus_pago = rp.estatus,
        e.fecha_vencimiento_pago = rp.fecha_vencimiento,
        e.updated_at = NOW()
      WHERE e.estatus_pago != rp.estatus
        OR e.fecha_vencimiento_pago != rp.fecha_vencimiento
    `;
    
    const [result] = await pool.query(query);
    
    console.log(`✅ [CRONJOB] ${result.affectedRows} expedientes sincronizados`);
    
    // También marcar como "Pagado" los expedientes sin recibos pendientes
    const queryPagados = `
      UPDATE expedientes e
      LEFT JOIN recibos_pago rp ON e.id = rp.expediente_id 
        AND rp.fecha_pago_real IS NULL
      SET 
        e.estatus_pago = 'Pagado',
        e.fecha_vencimiento_pago = NULL,
        e.updated_at = NOW()
      WHERE rp.id IS NULL
        AND e.estatus_pago != 'Pagado'
        AND e.etapa_activa != 'Cancelada'
    `;
    
    const [resultPagados] = await pool.query(queryPagados);
    
    console.log(`✅ [CRONJOB] ${resultPagados.affectedRows} expedientes marcados como "Pagado" (todos los recibos pagados)`);
    
    return result.affectedRows + resultPagados.affectedRows;
  } catch (error) {
    console.error('❌ [CRONJOB] Error al sincronizar estatus de expedientes:', error);
    throw error;
  }
};

/**
 * Ejecutar todos los jobs en secuencia
 */
const ejecutarActualizacionCompleta = async () => {
  const inicio = Date.now();
  console.log('\n' + '='.repeat(80));
  console.log('🚀 [CRONJOB] Iniciando actualización automática de estatus de recibos');
  console.log('📅 Fecha y hora:', new Date().toLocaleString('es-MX'));
  console.log('='.repeat(80) + '\n');
  
  try {
    // Ejecutar los 3 jobs de actualización de recibos en paralelo
    const [porVencer, vencidos, pendientes] = await Promise.all([
      marcarRecibosPorVencer(),
      marcarRecibosVencidos(),
      mantenerRecibosPendientes()
    ]);
    
    console.log('\n📊 Resumen de actualización de recibos:');
    console.log(`   - Por vencer: ${porVencer} recibos`);
    console.log(`   - Vencidos: ${vencidos} recibos`);
    console.log(`   - Pendientes: ${pendientes} recibos`);
    console.log(`   - Total: ${porVencer + vencidos + pendientes} recibos actualizados\n`);
    
    // Luego sincronizar expedientes (debe ser después de actualizar recibos)
    const expedientesSincronizados = await sincronizarEstatusExpedientes();
    
    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ [CRONJOB] Actualización completada exitosamente');
    console.log(`⏱️  Duración: ${duracion} segundos`);
    console.log(`📊 Total de cambios: ${porVencer + vencidos + pendientes + expedientesSincronizados}`);
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ [CRONJOB] Error durante la actualización:', error);
    throw error;
  }
};

/**
 * Programar los cronjobs
 */
const iniciarCronjobs = () => {
  // Ejecutar diariamente a las 00:01 AM
  cron.schedule('1 0 * * *', ejecutarActualizacionCompleta, {
    scheduled: true,
    timezone: "America/Mexico_City"
  });
  
  console.log('✅ Cronjobs programados:');
  console.log('   - Actualización de estatus de recibos: Diario a las 00:01 AM (Mexico City)');
  
  // Opcional: ejecutar inmediatamente al iniciar el servidor (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log('\n⚠️  Modo desarrollo: Ejecutando actualización inmediata...\n');
    ejecutarActualizacionCompleta();
  }
};

module.exports = {
  iniciarCronjobs,
  ejecutarActualizacionCompleta,
  marcarRecibosPorVencer,
  marcarRecibosVencidos,
  mantenerRecibosPendientes,
  sincronizarEstatusExpedientes
};
```

### 3. Modificar `backend/server.js` o `backend/app.js`

Agregar al inicio del archivo (después de imports):

```javascript
const { iniciarCronjobs } = require('./jobs/actualizarEstatusRecibos');

// ... código existente ...

// Iniciar cronjobs al arrancar el servidor
iniciarCronjobs();

console.log('✅ Servidor iniciado y cronjobs programados');
```

### 4. Crear endpoint para ejecutar manualmente (opcional pero recomendado)

En `backend/routes/cronjobs.js` (nuevo archivo):

```javascript
const express = require('express');
const router = express.Router();
const { 
  ejecutarActualizacionCompleta,
  marcarRecibosPorVencer,
  marcarRecibosVencidos,
  mantenerRecibosPendientes,
  sincronizarEstatusExpedientes
} = require('../jobs/actualizarEstatusRecibos');

/**
 * POST /api/cronjobs/actualizar-estatus
 * Ejecutar manualmente la actualización de estatus
 */
router.post('/actualizar-estatus', async (req, res) => {
  try {
    await ejecutarActualizacionCompleta();
    
    res.json({
      success: true,
      message: 'Actualización de estatus completada exitosamente'
    });
  } catch (error) {
    console.error('Error al ejecutar actualización manual:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estatus',
      details: error.message
    });
  }
});

/**
 * POST /api/cronjobs/test-por-vencer
 * Probar solo el job de "Por vencer"
 */
router.post('/test-por-vencer', async (req, res) => {
  try {
    const affected = await marcarRecibosPorVencer();
    res.json({ success: true, affected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cronjobs/test-vencidos
 * Probar solo el job de "Vencido"
 */
router.post('/test-vencidos', async (req, res) => {
  try {
    const affected = await marcarRecibosVencidos();
    res.json({ success: true, affected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cronjobs/test-pendientes
 * Probar solo el job de "Pendiente"
 */
router.post('/test-pendientes', async (req, res) => {
  try {
    const affected = await mantenerRecibosPendientes();
    res.json({ success: true, affected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/cronjobs/sincronizar-expedientes
 * Probar solo la sincronización de expedientes
 */
router.post('/sincronizar-expedientes', async (req, res) => {
  try {
    const affected = await sincronizarEstatusExpedientes();
    res.json({ success: true, affected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

Registrar la ruta en `backend/server.js`:

```javascript
const cronjobsRoutes = require('./routes/cronjobs');
app.use('/api/cronjobs', cronjobsRoutes);
```

## 🧪 Pruebas

### 1. Probar cada job individualmente

```bash
# Probar job "Por vencer"
curl -X POST http://localhost:3000/api/cronjobs/test-por-vencer

# Probar job "Vencido"
curl -X POST http://localhost:3000/api/cronjobs/test-vencidos

# Probar job "Pendiente"
curl -X POST http://localhost:3000/api/cronjobs/test-pendientes

# Probar sincronización de expedientes
curl -X POST http://localhost:3000/api/cronjobs/sincronizar-expedientes
```

### 2. Ejecutar actualización completa manualmente

```bash
curl -X POST http://localhost:3000/api/cronjobs/actualizar-estatus
```

### 3. Verificar en base de datos

```sql
-- Ver recibos pendientes con sus estatus
SELECT 
  expediente_id,
  numero_recibo,
  fecha_vencimiento,
  estatus,
  DATEDIFF(fecha_vencimiento, CURDATE()) as dias_restantes,
  CASE 
    WHEN fecha_vencimiento < CURDATE() THEN 'Debería ser Vencido'
    WHEN DATEDIFF(fecha_vencimiento, CURDATE()) <= 15 THEN 'Debería ser Por vencer'
    WHEN DATEDIFF(fecha_vencimiento, CURDATE()) > 15 THEN 'Debería ser Pendiente'
  END as estatus_esperado
FROM recibos_pago
WHERE fecha_pago_real IS NULL
ORDER BY fecha_vencimiento ASC
LIMIT 50;

-- Verificar que expedientes tengan el estatus correcto
SELECT 
  e.id,
  e.numero_poliza,
  e.estatus_pago as estatus_expediente,
  e.fecha_vencimiento_pago,
  rp.numero_recibo as proximo_recibo,
  rp.estatus as estatus_proximo_recibo,
  rp.fecha_vencimiento
FROM expedientes e
LEFT JOIN recibos_pago rp ON e.id = rp.expediente_id 
  AND rp.fecha_pago_real IS NULL
WHERE e.etapa_activa != 'Cancelada'
ORDER BY rp.fecha_vencimiento ASC
LIMIT 50;
```

## 📊 Logs y Monitoreo

Los cronjobs generarán logs en consola con este formato:

```
================================================================================
🚀 [CRONJOB] Iniciando actualización automática de estatus de recibos
📅 Fecha y hora: 23/12/2025 00:01:00
================================================================================

🔄 [CRONJOB] Iniciando actualización de recibos "Por vencer"...
✅ [CRONJOB] 15 recibos marcados como "Por vencer"

🔄 [CRONJOB] Iniciando actualización de recibos "Vencido"...
✅ [CRONJOB] 8 recibos marcados como "Vencido"

🔄 [CRONJOB] Iniciando actualización de recibos "Pendiente"...
✅ [CRONJOB] 45 recibos marcados como "Pendiente"

📊 Resumen de actualización de recibos:
   - Por vencer: 15 recibos
   - Vencidos: 8 recibos
   - Pendientes: 45 recibos
   - Total: 68 recibos actualizados

🔄 [CRONJOB] Iniciando sincronización de estatus_pago en expedientes...
✅ [CRONJOB] 23 expedientes sincronizados
✅ [CRONJOB] 5 expedientes marcados como "Pagado" (todos los recibos pagados)

================================================================================
✅ [CRONJOB] Actualización completada exitosamente
⏱️  Duración: 0.87 segundos
📊 Total de cambios: 96
================================================================================
```

## 🚨 Consideraciones Importantes

1. **Zona horaria:** Los cronjobs están configurados para `America/Mexico_City`. Ajusta según tu región.

2. **Rendimiento:** Con miles de recibos, considera:
   - Agregar índices: `CREATE INDEX idx_recibos_vencimiento ON recibos_pago(fecha_vencimiento, fecha_pago_real, estatus);`
   - Procesar en lotes si hay >10,000 recibos

3. **Notificaciones:** Considera agregar alertas cuando se marquen recibos como "Vencido"

4. **Backup:** Los cronjobs modifican datos. Asegúrate de tener backups automáticos de la BD

5. **Testing:** Prueba en ambiente de desarrollo antes de producción

## ✅ Checklist de Implementación

- [ ] Instalar `node-cron` con npm
- [ ] Crear archivo `backend/jobs/actualizarEstatusRecibos.js`
- [ ] Modificar `backend/server.js` para iniciar cronjobs
- [ ] Crear `backend/routes/cronjobs.js` con endpoints de prueba
- [ ] Registrar rutas en el servidor
- [ ] Agregar índices en base de datos
- [ ] Probar cada job individualmente
- [ ] Ejecutar actualización completa manual
- [ ] Verificar resultados en BD
- [ ] Esperar a las 00:01 AM para verificar ejecución automática
- [ ] Revisar logs del servidor

## 📝 Notas Finales

Una vez implementado, el sistema funcionará de la siguiente manera:

1. **00:01 AM** - Se ejecuta el cronjob automáticamente
2. Los recibos se actualizan según su fecha de vencimiento
3. Los expedientes se sincronizan con el estatus del próximo recibo pendiente
4. El frontend mostrará automáticamente las pólizas en las carpetas correctas:
   - **En Proceso:** Recibos con estatus "Pendiente" o "Por vencer"
   - **Vigentes:** Recibos con estatus "Pagado"
   - **Vencidas:** Recibos con estatus "Vencido"

¡El sistema estará completamente automatizado! 🎉

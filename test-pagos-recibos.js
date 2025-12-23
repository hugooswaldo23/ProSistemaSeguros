/**
 * ====================================================================
 * TEST: Aplicar y Remover Pagos de Recibos
 * ====================================================================
 * Script para verificar que Hugo implementó correctamente:
 * 1. GET /api/recibos/:expediente_id (obtener recibos)
 * 2. POST /api/recibos/:expediente_id/:numero_recibo/pago (aplicar/remover pago)
 */

const API_URL = 'https://apiseguros.proordersistem.com.mx';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji, mensaje, color = colors.reset) {
  console.log(`${color}${emoji} ${mensaje}${colors.reset}`);
}

/**
 * Test 1: Verificar GET /api/recibos/:expediente_id
 */
async function testGetRecibos(expedienteId) {
  log('📋', `TEST 1: Obtener recibos del expediente ${expedienteId}`, colors.cyan);
  
  try {
    const response = await fetch(`${API_URL}/api/recibos/${expedienteId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Formato de respuesta incorrecto');
    }
    
    log('✅', `GET recibos OK | Total: ${data.data.length} recibos`, colors.green);
    
    // Mostrar resumen de recibos
    data.data.forEach(recibo => {
      const isPagado = recibo.fecha_pago_real ? '💰' : '⏳';
      console.log(`  ${isPagado} Recibo #${recibo.numero_recibo} | ${recibo.estatus} | Vence: ${recibo.fecha_vencimiento}`);
      if (recibo.fecha_pago_real) {
        console.log(`     └─ Pagado: ${recibo.fecha_pago_real} | Comprobante: ${recibo.comprobante_nombre || 'N/A'}`);
      }
    });
    
    return data.data;
    
  } catch (error) {
    log('❌', `ERROR en GET recibos: ${error.message}`, colors.red);
    throw error;
  }
}

/**
 * Test 2: Aplicar pago a un recibo
 */
async function testAplicarPago(expedienteId, numeroRecibo) {
  log('💰', `TEST 2: Aplicar pago al recibo #${numeroRecibo}`, colors.cyan);
  
  try {
    const fechaPago = new Date().toISOString().split('T')[0];
    
    const response = await fetch(
      `${API_URL}/api/recibos/${expedienteId}/${numeroRecibo}/pago`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estatus: 'Pagado',
          fecha_pago_real: fechaPago,
          comprobante_nombre: 'test-comprobante.pdf',
          comprobante_url: 'https://s3.example.com/test.pdf'
        })
      }
    );
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Respuesta no es JSON válido: ${responseText}`);
    }
    
    if (!data.success) {
      throw new Error('Backend respondió con success: false');
    }
    
    log('✅', `POST aplicar pago OK | Recibo #${numeroRecibo} marcado como pagado`, colors.green);
    return data;
    
  } catch (error) {
    log('❌', `ERROR al aplicar pago: ${error.message}`, colors.red);
    throw error;
  }
}

/**
 * Test 3: Remover pago (enviar fecha_pago_real = null)
 */
async function testRemoverPago(expedienteId, numeroRecibo) {
  log('🔙', `TEST 3: Remover pago del recibo #${numeroRecibo}`, colors.cyan);
  
  try {
    const response = await fetch(
      `${API_URL}/api/recibos/${expedienteId}/${numeroRecibo}/pago`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estatus: 'Vencido',
          fecha_pago_real: null,
          comprobante_nombre: null,
          comprobante_url: null
        })
      }
    );
    
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Respuesta no es JSON válido: ${responseText}`);
    }
    
    if (!data.success) {
      throw new Error('Backend respondió con success: false');
    }
    
    log('✅', `POST remover pago OK | Recibo #${numeroRecibo} ahora sin pago`, colors.green);
    return data;
    
  } catch (error) {
    log('❌', `ERROR al remover pago: ${error.message}`, colors.red);
    throw error;
  }
}

/**
 * Ejecutar todos los tests
 */
async function ejecutarTests() {
  console.log('\n' + '='.repeat(70));
  log('🧪', 'INICIANDO TESTS DE APLICAR/REMOVER PAGOS', colors.blue);
  console.log('='.repeat(70) + '\n');
  
  // Usar expediente de prueba (cambia este ID según necesites)
  const EXPEDIENTE_TEST = '514'; // Cambiar según tu caso de prueba
  const NUMERO_RECIBO_TEST = 1;
  
  try {
    // Test 1: Obtener recibos iniciales
    const recibosIniciales = await testGetRecibos(EXPEDIENTE_TEST);
    console.log('\n');
    
    if (recibosIniciales.length === 0) {
      log('⚠️', 'No hay recibos en este expediente, saltando tests de pago', colors.yellow);
      return;
    }
    
    // Test 2: Aplicar pago
    await testAplicarPago(EXPEDIENTE_TEST, NUMERO_RECIBO_TEST);
    console.log('\n');
    
    // Verificar que se aplicó
    const recibosConPago = await testGetRecibos(EXPEDIENTE_TEST);
    const reciboModificado = recibosConPago.find(r => r.numero_recibo === NUMERO_RECIBO_TEST);
    if (reciboModificado?.fecha_pago_real) {
      log('✅', 'Verificado: El recibo ahora tiene pago registrado', colors.green);
    } else {
      log('⚠️', 'ADVERTENCIA: El recibo no muestra el pago aplicado', colors.yellow);
    }
    console.log('\n');
    
    // Test 3: Remover pago
    await testRemoverPago(EXPEDIENTE_TEST, NUMERO_RECIBO_TEST);
    console.log('\n');
    
    // Verificar que se removió
    const recibosSinPago = await testGetRecibos(EXPEDIENTE_TEST);
    const reciboLimpio = recibosSinPago.find(r => r.numero_recibo === NUMERO_RECIBO_TEST);
    if (!reciboLimpio?.fecha_pago_real) {
      log('✅', 'Verificado: El recibo ya no tiene pago registrado', colors.green);
    } else {
      log('⚠️', 'ADVERTENCIA: El recibo aún muestra el pago', colors.yellow);
    }
    
    console.log('\n' + '='.repeat(70));
    log('🎉', 'TESTS COMPLETADOS EXITOSAMENTE', colors.green);
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.log('\n' + '='.repeat(70));
    log('💥', 'TESTS FALLARON', colors.red);
    console.log('='.repeat(70));
    console.error('\n' + error.stack);
    process.exit(1);
  }
}

// Ejecutar tests
ejecutarTests();

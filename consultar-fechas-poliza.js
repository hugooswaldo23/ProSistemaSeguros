// Script para consultar las fechas de la póliza más reciente
const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';

async function consultarFechasPoliza() {
  try {
    console.log('🔍 Consultando expedientes en:', API_URL);
    
    const response = await fetch(`${API_URL}/api/expedientes`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const expedientes = await response.json();
    
    if (!expedientes || expedientes.length === 0) {
      console.log('❌ No se encontraron expedientes en la base de datos');
      return;
    }
    
    // Obtener el expediente más reciente
    const expediente = expedientes[expedientes.length - 1];
    
    console.log('\n📋 ═══════════════════════════════════════════════════════════');
    console.log('📄 FECHAS REGISTRADAS EN LA PÓLIZA');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('🏢 INFORMACIÓN GENERAL:');
    console.log(`   • Número de Póliza: ${expediente.numero_poliza || 'N/A'}`);
    console.log(`   • Compañía: ${expediente.compania || 'N/A'}`);
    console.log(`   • Cliente ID: ${expediente.cliente_id || 'N/A'}`);
    console.log(`   • Etapa Activa: ${expediente.etapa_activa || 'N/A'}`);
    
    console.log('\n📅 FECHAS DE VIGENCIA:');
    console.log(`   • Inicio de Vigencia: ${expediente.inicio_vigencia || 'No registrada'}`);
    console.log(`   • Término de Vigencia: ${expediente.termino_vigencia || 'No registrada'}`);
    console.log(`   • Fecha de Emisión: ${expediente.fecha_emision || 'No registrada'}`);
    
    console.log('\n💰 FECHAS DE CONTROL DE PAGOS:');
    console.log(`   • Fecha de Pago (proximoPago): ${expediente.fecha_pago || expediente.proximoPago || 'No calculada'}`);
    console.log(`   • Fecha Vencimiento Pago: ${expediente.fecha_vencimiento_pago || 'No registrada'}`);
    console.log(`   • Fecha Último Pago: ${expediente.fechaUltimoPago || 'Sin pagos registrados'}`);
    console.log(`   • Periodo de Gracia: ${expediente.periodo_gracia || 'No definido'} días`);
    
    console.log('\n📊 CONFIGURACIÓN DE PAGOS:');
    console.log(`   • Tipo de Pago: ${expediente.tipo_pago || 'No definido'}`);
    console.log(`   • Frecuencia de Pago: ${expediente.frecuenciaPago || 'No definida'}`);
    console.log(`   • Estatus de Pago: ${expediente.estatusPago || 'No definido'}`);
    console.log(`   • Primer Pago: $${expediente.primer_pago || '0.00'}`);
    console.log(`   • Pagos Subsecuentes: $${expediente.pagos_subsecuentes || '0.00'}`);
    
    console.log('\n⏰ FECHAS DE REGISTRO:');
    console.log(`   • Creado en (created_at): ${expediente.created_at || 'No registrado'}`);
    console.log(`   • Actualizado en (updated_at): ${expediente.updated_at || 'No registrado'}`);
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    
    // Calcular días restantes para el próximo pago
    if (expediente.fecha_vencimiento_pago || expediente.fecha_pago || expediente.proximoPago) {
      const fechaPago = expediente.fecha_vencimiento_pago || expediente.fecha_pago || expediente.proximoPago;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const [year, month, day] = fechaPago.split('-');
      const fechaObjetivo = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      fechaObjetivo.setHours(0, 0, 0, 0);
      
      const diasRestantes = Math.ceil((fechaObjetivo - hoy) / (1000 * 60 * 60 * 24));
      
      console.log('🔔 ANÁLISIS DE PRÓXIMO PAGO:');
      if (diasRestantes < 0) {
        console.log(`   ⚠️  VENCIDO hace ${Math.abs(diasRestantes)} días`);
      } else if (diasRestantes === 0) {
        console.log(`   ⚠️  VENCE HOY`);
      } else if (diasRestantes <= 15) {
        console.log(`   ⚡ Por vencer en ${diasRestantes} días`);
      } else {
        console.log(`   ✅ Faltan ${diasRestantes} días para el próximo pago`);
      }
      console.log('\n');
    }
    
    // Mostrar objeto completo en formato JSON para debugging
    console.log('🔍 DATOS COMPLETOS (JSON):');
    console.log(JSON.stringify({
      id: expediente.id,
      numero_poliza: expediente.numero_poliza,
      inicio_vigencia: expediente.inicio_vigencia,
      termino_vigencia: expediente.termino_vigencia,
      fecha_emision: expediente.fecha_emision,
      fecha_pago: expediente.fecha_pago,
      proximoPago: expediente.proximoPago,
      fecha_vencimiento_pago: expediente.fecha_vencimiento_pago,
      fechaUltimoPago: expediente.fechaUltimoPago,
      periodo_gracia: expediente.periodo_gracia,
      tipo_pago: expediente.tipo_pago,
      frecuenciaPago: expediente.frecuenciaPago,
      estatusPago: expediente.estatusPago,
      created_at: expediente.created_at,
      updated_at: expediente.updated_at
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Error al consultar fechas:', error.message);
    console.error('\n💡 Verifica que:');
    console.error('   1. El servidor backend esté corriendo en', API_URL);
    console.error('   2. La tabla expedientes exista en la base de datos');
    console.error('   3. Tengas conexión a la base de datos\n');
  }
}

// Ejecutar consulta
consultarFechasPoliza();

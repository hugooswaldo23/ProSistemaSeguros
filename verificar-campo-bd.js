import mysql from 'mysql2/promise';

async function verificarCampo() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'prosistema_seguros'
    });

    console.log('🔍 Verificando campo fecha_aviso_renovacion en BD...\n');

    // 1. Verificar si existe la columna
    const [columns] = await conn.execute(
      "SHOW COLUMNS FROM expedientes WHERE Field = 'fecha_aviso_renovacion'"
    );

    if (columns.length === 0) {
      console.log('❌ ERROR: El campo fecha_aviso_renovacion NO EXISTE en la tabla expedientes');
      console.log('\n📋 Acción requerida:');
      console.log('   Hugo debe ejecutar: scripts/agregar_fecha_aviso_renovacion.sql');
      await conn.end();
      return;
    }

    console.log('✅ Campo fecha_aviso_renovacion EXISTE en BD');
    console.log('   Tipo:', columns[0].Type);
    console.log('   Null:', columns[0].Null);
    console.log('   Default:', columns[0].Default);
    console.log('');

    // 2. Buscar la póliza específica
    const [poliza] = await conn.execute(
      "SELECT numero_poliza, inicio_vigencia, termino_vigencia, fecha_aviso_renovacion, estatus_pago FROM expedientes WHERE numero_poliza = 'LL45007654'"
    );

    if (poliza.length === 0) {
      console.log('⚠️ No se encontró la póliza LL45007654');
    } else {
      console.log('📋 Datos de póliza LL45007654 en BD:');
      console.log('   Inicio vigencia:', poliza[0].inicio_vigencia);
      console.log('   Término vigencia:', poliza[0].termino_vigencia);
      console.log('   Fecha aviso renovación:', poliza[0].fecha_aviso_renovacion);
      console.log('   Estatus pago:', poliza[0].estatus_pago);
    }

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarCampo();

import mysql from 'mysql2/promise';

async function verificarCampo() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'prosistema_seguros'
  });

  console.log('🔍 Verificando campo fecha_aviso_renovacion...\n');

  // Verificar si existe el campo
  const [columns] = await conn.execute(
    'SHOW COLUMNS FROM expedientes LIKE "fecha_aviso_renovacion"'
  );

  if (columns.length === 0) {
    console.log('❌ El campo NO existe en la tabla');
    await conn.end();
    return;
  }

  console.log('✅ Campo EXISTE:', columns[0]);
  console.log('');

  // Verificar cuántos registros tienen valor
  const [stats] = await conn.execute(`
    SELECT 
      COUNT(*) as total,
      COUNT(fecha_aviso_renovacion) as con_fecha,
      COUNT(*) - COUNT(fecha_aviso_renovacion) as sin_fecha
    FROM expedientes
  `);

  console.log('📊 Estadísticas:');
  console.log(`   Total expedientes: ${stats[0].total}`);
  console.log(`   Con fecha aviso: ${stats[0].con_fecha}`);
  console.log(`   Sin fecha aviso: ${stats[0].sin_fecha}`);
  console.log('');

  // Mostrar algunos ejemplos
  const [ejemplos] = await conn.execute(`
    SELECT 
      numero_poliza,
      inicio_vigencia,
      termino_vigencia,
      fecha_aviso_renovacion
    FROM expedientes
    WHERE fecha_aviso_renovacion IS NOT NULL
    LIMIT 5
  `);

  console.log('📋 Ejemplos de registros con fecha de aviso:');
  ejemplos.forEach(e => {
    console.log(`   Póliza: ${e.numero_poliza}`);
    console.log(`   Inicio: ${e.inicio_vigencia}`);
    console.log(`   Término: ${e.termino_vigencia}`);
    console.log(`   Aviso: ${e.fecha_aviso_renovacion}`);
    console.log('   ---');
  });

  await conn.end();
}

verificarCampo().catch(console.error);

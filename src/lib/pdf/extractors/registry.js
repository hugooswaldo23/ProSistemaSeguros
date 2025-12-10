/**
 * Registry de Extractores Automáticos
 * 
 * Carga dinámicamente el extractor específico según aseguradora y producto.
 */

/**
 * Carga el extractor específico para una aseguradora y producto
 * @param {string} company - Nombre de la aseguradora (MAYÚSCULAS)
 * @param {string} producto - Tipo de producto ('autos', 'vida', 'gmm', etc.)
 * @returns {Promise<Object|null>} Módulo del extractor o null
 */
export async function loadExtractor(company, producto = 'autos') {
  const aseguradora = (company || '').toUpperCase();
  const prod = (producto || 'autos').toLowerCase();
  
  console.log(`📦 Registry: Cargando extractor [${aseguradora}/${prod}]`);
  
  try {
    switch (aseguradora) {
      case 'QUALITAS':
        console.log(`   ✅ Cargando: ./qualitas/${prod}.js`);
        return await import(`./qualitas/${prod}.js`);
        
      case 'CHUBB':
        console.log(`   ✅ Cargando: ./chubb/${prod}.js`);
        return await import(`./chubb/${prod}.js`);
        
      case 'ELPOTOSI':
        console.log(`   ✅ Cargando: ./elpotosi/${prod}.js`);
        return await import(`./elpotosi/${prod}.js`);
        
      case 'HDI':
        console.log(`   ✅ Cargando: ./hdi/${prod}.js`);
        return await import(`./hdi/${prod}.js`);
        
      case 'GNP':
        console.log(`   ✅ Cargando: ./gnp/${prod}.js`);
        return await import(`./gnp/${prod}.js`);
        
      case 'MAPFRE':
        console.log(`   ✅ Cargando: ./mapfre/${prod}.js`);
        return await import(`./mapfre/${prod}.js`);
        
      case 'AXA':
        console.log(`   ✅ Cargando: ./axa/${prod}.js`);
        return await import(`./axa/${prod}.js`);
        
      case 'ZURICH':
        console.log(`   ✅ Cargando: ./zurich/${prod}.js`);
        return await import(`./zurich/${prod}.js`);
        
      default:
        console.warn(`   ⚠️ No hay extractor para ${aseguradora}/${prod}`);
        return null;
    }
  } catch (e) {
    console.error(`   ❌ Error cargando extractor ${aseguradora}/${prod}:`, e.message);
    return null;
  }
}

/**
 * Registry de Extractores Automáticos
 * 
 * Carga dinámicamente el extractor específico según aseguradora y producto.
 * 
 * NOTA: Los imports deben ser estáticos para que Vite/esbuild los pre-bundlee.
 * Por eso usamos imports directos en lugar de template literals dinámicos.
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
    // IMPORTANTE: Imports estáticos para compatibilidad con Vite/esbuild
    // Solo soportamos 'autos' por ahora. Para otros productos, agregar más cases.
    
    if (prod === 'autos') {
      switch (aseguradora) {
        case 'QUALITAS':
          console.log(`   ✅ Cargando: ./qualitas/autos.js`);
          return await import('./qualitas/autos.js');
          
        case 'CHUBB':
          console.log(`   ✅ Cargando: ./chubb/autos.js`);
          return await import('./chubb/autos.js');
          
        case 'ELPOTOSI':
          console.log(`   ✅ Cargando: ./elpotosi/autos.js`);
          return await import('./elpotosi/autos.js');
          
        case 'HDI':
          console.log(`   ✅ Cargando: ./hdi/autos.js`);
          return await import('./hdi/autos.js');
          
        case 'GNP':
          console.log(`   ✅ Cargando: ./gnp.js`);
          return await import('./gnp.js');
          
        case 'MAPFRE':
          console.log(`   ✅ Cargando: ./mapfre.js`);
          return await import('./mapfre.js');
          
        case 'AXA':
          console.log(`   ✅ Cargando: ./axa.js`);
          return await import('./axa.js');
          
        case 'ZURICH':
          console.log(`   ✅ Cargando: ./zurich/autos.js`);
          return await import('./zurich/autos.js');
          
        default:
          console.warn(`   ⚠️ No hay extractor para ${aseguradora}/${prod}`);
          return null;
      }
    }
    
    console.warn(`   ⚠️ Producto '${prod}' no soportado aún`);
    return null;
  } catch (e) {
    console.error(`   ❌ Error cargando extractor ${aseguradora}/${prod}:`, e.message);
    return null;
  }
}

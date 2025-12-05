/**
 * Extractor Zurich - Router
 * Redirige al extractor específico según el producto
 */

export async function extractZURICH(ctx) {
  console.log('🎯 Extractor Zurich - Router');
  
  // Por ahora, solo soportamos autos
  const { extraer } = await import('./zurich/autos.js');
  return extraer(ctx);
}

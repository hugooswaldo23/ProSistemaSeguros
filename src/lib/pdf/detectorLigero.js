/**
 * Detector Ligero de Aseguradora y Producto
 * 
 * Usa una vista previa (20-30 líneas de la página 1)
 * para determinar qué aseguradora y qué producto es.
 * 
 * Esto permite cargar el extractor específico correcto sin procesar
 * todo el documento.
 */

/**
 * Extrae las primeras N líneas del texto de un PDF
 * @param {string} textoPagina1 - Texto completo de la página 1
 * @param {number} numLineas - Número de líneas a extraer (default: 30)
 * @returns {string} Primeras N líneas
 */
export function extraerPrimerasLineas(textoPagina1, numLineas = 30) {
  if (!textoPagina1) return '';
  const lineas = textoPagina1.split('\n');
  return lineas.slice(0, numLineas).join('\n');
}

/**
 * Detecta la aseguradora en las primeras líneas
 * @param {string} textoInicial - Primeras 20-30 líneas
 * @returns {string} Nombre de la aseguradora en MAYÚSCULAS
 */
export function detectarAseguradora(textoInicial) {
  if (!textoInicial) return 'DESCONOCIDA';
  
  const texto = textoInicial.toUpperCase();
  
  // Orden de prioridad (más específico primero)
  if (/\bCHUBB\b/i.test(texto)) return 'CHUBB';
  if (/\bQU[AÁ]LITAS\b/i.test(texto)) return 'QUALITAS';
  if (/elpotosi\.com/i.test(texto)) return 'ELPOTOSI';
  if (/444[\s\-]?8349000/i.test(texto)) return 'ELPOTOSI'; // Teléfono como fallback
  if (/\bHDI\b/i.test(texto)) return 'HDI';
  if (/\bGNP\b/.test(texto)) return 'GNP';
  if (/\bMAPFRE\b/.test(texto)) return 'MAPFRE';
  if (/\bAXA\b/.test(texto)) return 'AXA';
  if (/\bZURICH\b/.test(texto)) return 'ZURICH';
  if (/\bANA\b/.test(texto)) return 'ANA';
  if (/\bINBURSA\b/.test(texto)) return 'INBURSA';
  if (/\bBANORTE\b/.test(texto)) return 'BANORTE';
  
  return 'DESCONOCIDA';
}

/**
 * Detecta el tipo de producto en las primeras líneas
 * @param {string} textoInicial - Primeras 20-30 líneas
 * @param {string} aseguradora - Aseguradora detectada (para reglas específicas)
 * @returns {string} Tipo de producto normalizado
 */
export function detectarProducto(textoInicial, aseguradora = '') {
  if (!textoInicial) return 'desconocido';
  
  const texto = textoInicial.toUpperCase();
  
  // Autos (más común) - Múltiples patrones
  if (
    /\bAUTOM[OÓ]VILES?\b|\bAUTOS?\b|\bVEH[IÍ]CULO/i.test(texto) ||
    /\bP[OÓ]LIZA\s+DE\s+AUTO/i.test(texto) ||
    /\bSEGURO\s+DE\s+AUTO/i.test(texto) ||
    /\bMARCA\s+Y\s+MODELO/i.test(texto) ||
    /\bN[UÚ]MERO\s+DE\s+SERIE/i.test(texto) ||
    /\bVIN\b/i.test(texto) ||
    /\bPLACAS?\b/i.test(texto) ||
    // Términos específicos de Chubb
    (aseguradora === 'CHUBB' && /ACCIDENTE\s+VITAL|ROBO|COLISI[OÓ]N/i.test(texto))
  ) {
    return 'autos';
  }
  
  // Vida
  if (/\bVIDA\b|\bSEGURO\s+DE\s+VIDA|\bBENEFICIARIO/i.test(texto)) {
    return 'vida';
  }
  
  // GMM (Gastos Médicos Mayores)
  if (/\bGMM\b|\bGASTOS\s+M[EÉ]DICOS?\s+MAYORES?/i.test(texto)) {
    return 'gmm';
  }
  
  // Daños
  if (/\bDA[ÑN]OS?\b|\bINCENDIO/i.test(texto)) {
    return 'danos';
  }
  
  // Transporte
  if (/\bTRANSPORTE\b|\bCARGA/i.test(texto)) {
    return 'transporte';
  }
  
  // Responsabilidad Civil
  if (/\bRESPONSABILIDAD\s+CIVIL\b/i.test(texto)) {
    return 'rc';
  }
  
  return 'desconocido';
}

/**
 * Función principal: Detecta aseguradora y producto
 * @param {string} textoPagina1 - Texto completo de página 1
 * @returns {{ aseguradora: string, producto: string, textoAnalizado: string }}
 */
export function detectarAseguradoraYProducto(textoPagina1) {
  const textoInicial = extraerPrimerasLineas(textoPagina1, 30);
  
  const aseguradora = detectarAseguradora(textoInicial);
  const producto = detectarProducto(textoInicial, aseguradora); // Pasar aseguradora
  
  console.log('🔍 Detector Ligero:');
  console.log('   Aseguradora detectada:', aseguradora);
  console.log('   Producto detectado:', producto);
  console.log('   Vista previa para detección (30 líneas):', textoInicial.substring(0, 200) + '...');
  
  return {
    aseguradora,
    producto,
    textoAnalizado: textoInicial
  };
}

/**
 * Extractor Especializado: Chubb - Autos
 * 
 * Extrae información de pólizas de autos de Chubb Seguros.
 * 
 * @module extractors/chubb/autos
 */

/**
 * Extrae un dato usando expresión regular
 * @param {RegExp} patron - Patrón regex
 * @param {string} texto - Texto donde buscar
 * @param {number} grupo - Grupo de captura (default: 1)
 * @returns {string} Valor extraído o cadena vacía
 */
function extraerDato(patron, texto, grupo = 1) {
  try {
    const match = texto.match(patron);
    return match && match[grupo] ? match[grupo].trim() : '';
  } catch (error) {
    console.warn('Error en extraerDato:', error, 'Patrón:', patron);
    return '';
  }
}

/**
 * Convierte fecha DD/MM/YYYY o DD-MMM-YYYY a YYYY-MM-DD
 * @param {string} fecha - Fecha en formato original
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function normalizarFecha(fecha) {
  if (!fecha) return '';
  
  const meses = {
    'ENE': '01', 'ENERO': '01',
    'FEB': '02', 'FEBRERO': '02',
    'MAR': '03', 'MARZO': '03',
    'ABR': '04', 'ABRIL': '04',
    'MAY': '05', 'MAYO': '05',
    'JUN': '06', 'JUNIO': '06',
    'JUL': '07', 'JULIO': '07',
    'AGO': '08', 'AGOSTO': '08',
    'SEP': '09', 'SEPTIEMBRE': '09',
    'OCT': '10', 'OCTUBRE': '10',
    'NOV': '11', 'NOVIEMBRE': '11',
    'DIC': '12', 'DICIEMBRE': '12'
  };
  
  // Formato: DD DE MESCOMPLET DE YYYY (13 DE NOVIEMBRE DE 2025)
  const matchMesCompleto = fecha.match(/(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(\d{4})/i);
  if (matchMesCompleto) {
    const dia = matchMesCompleto[1].padStart(2, '0');
    const mes = meses[matchMesCompleto[2].toUpperCase()] || '01';
    const anio = matchMesCompleto[3];
    return `${anio}-${mes}-${dia}`;
  }
  
  // Formato: DD-MMM-YYYY (15-ENE-2025)
  const matchMes = fecha.match(/(\d{1,2})[-\/]([A-Z]{3})[-\/](\d{4})/i);
  if (matchMes) {
    const dia = matchMes[1].padStart(2, '0');
    const mes = meses[matchMes[2].toUpperCase()] || '01';
    const anio = matchMes[3];
    return `${anio}-${mes}-${dia}`;
  }
  
  // Formato: DD/MM/YYYY
  const matchNum = fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchNum) {
    const dia = matchNum[1].padStart(2, '0');
    const mes = matchNum[2].padStart(2, '0');
    const anio = matchNum[3];
    return `${anio}-${mes}-${dia}`;
  }
  
  return fecha;
}

/**
 * Extrae información de póliza Chubb Autos
 * 
 * ESTRATEGIA:
 * - Página 1 (AVISO DE COBRO): Datos principales (asegurado, póliza, financiero, vigencia)
 * - Página 2 (CARÁTULA): Datos complementarios (coberturas, uso, servicio)
 * 
 * @param {Object} ctx - Contexto con texto del PDF
 * @param {string} ctx.textoCompleto - Texto completo del PDF
 * @param {string} ctx.textoPagina1 - Texto de página 1 (Aviso de Cobro)
 * @param {string} ctx.textoPagina2 - Texto de página 2 (Carátula)
 * @returns {Object} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🏢 EXTRACTOR CHUBB AUTOS - INICIANDO                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const { textoCompleto, textoPagina1, textoPagina2, textoAvisoDeCobro, todasLasPaginas } = ctx;
  
  // 🔍 DEBUG: MOSTRAR TEXTO COMPLETO DEL PDF PARA ANÁLISIS
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📄 TEXTO COMPLETO DEL PDF (primeros 3000 caracteres):');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(textoCompleto.substring(0, 3000));
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📊 Total caracteres: ${textoCompleto.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // ==================== PASO 1: RFC Y TIPO DE PERSONA ====================
  console.log('📋 PASO 1: EXTRACCIÓN DE RFC Y TIPO DE PERSONA');
  console.log('─────────────────────────────────────────────────────────');
  
  // 🔍 DEBUG: Info del texto disponible
  console.log(`📊 Texto completo: ${textoCompleto.length} caracteres`);
  console.log(`📊 Texto Aviso Cobro: ${textoAvisoDeCobro?.length || 0} caracteres`);
  
  // Buscar RFC con múltiples variantes y más flexible con espacios
  // Chubb usa formato: "R.F.C.: ADT200310 RF0" (con espacio en medio) o "ADT200310RF0"
  let rfcExtraido = '';
  
  // Capturar RFC que puede tener espacios internos o estar junto
  const rfcMatch = textoCompleto.match(/(?:RFC|R\.?\s*F\.?\s*C\.?)[:\s]+([A-Z&Ñ]{3,4})\s*(\d{6})\s*([A-Z0-9]{3})/i);
  
  if (rfcMatch) {
    // Combinar las tres partes del RFC (eliminar todos los espacios)
    rfcExtraido = (rfcMatch[1] + rfcMatch[2] + rfcMatch[3]).toUpperCase().replace(/\s/g, '').trim();
    console.log('🔍 RFC capturado en partes:', rfcMatch[1], rfcMatch[2], rfcMatch[3], '→', rfcExtraido);
  } else {
    // Fallback: buscar patrón continuo
    const rfcMatch2 = textoCompleto.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/);
    rfcExtraido = rfcMatch2 ? rfcMatch2[1].toUpperCase().replace(/\s/g, '').trim() : '';
    if (rfcExtraido) console.log('🔍 RFC capturado continuo:', rfcExtraido);
  }
  
  // Validar RFC
  let alertasRFC = [];
  if (!rfcExtraido) {
    alertasRFC.push('⚠️ RFC NO encontrado en el PDF');
  } else if (rfcExtraido.length !== 12 && rfcExtraido.length !== 13) {
    alertasRFC.push(`⚠️ RFC con longitud inválida: ${rfcExtraido.length} caracteres (esperado: 12 o 13)`);
  }
  
  const tipoPersona = rfcExtraido.length === 13 ? 'Fisica' : rfcExtraido.length === 12 ? 'Moral' : 'Fisica';
  
  console.log('RFC extraído:', rfcExtraido || '❌ NO ENCONTRADO');
  console.log('Tipo de persona:', tipoPersona);
  if (alertasRFC.length > 0) {
    alertasRFC.forEach(alerta => console.warn('  ', alerta));
  }
  
  // ==================== ASEGURADO ====================
  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';
  
  // Chubb usa: "Asegurado: NOMBRE" o "Propietario/Contratante: NOMBRE"
  const nombreMatch = textoCompleto.match(/(?:Asegurado|ASEGURADO|Propietario\/Contratante|PROPIETARIO)[:\s]+([A-ZÁÉÍÓÚÑ\s\.]+?)(?=\s+(?:Domicilio|R\.?F\.?C|Datos generales)|\n)/i);
  if (nombreMatch) {
    const nombreCompleto = nombreMatch[1].trim();
    
    if (tipoPersona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      const palabras = nombreCompleto.split(/\s+/);
      if (palabras.length >= 3) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
        apellido_materno = palabras.slice(2).join(' ');
      } else if (palabras.length === 2) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
      } else {
        nombre = nombreCompleto;
      }
    }
  }
  
  if (tipoPersona === 'Moral') {
    console.log('Razón Social:', razonSocial || '❌');
  } else {
    console.log('Nombre completo:', nombre, apellido_paterno, apellido_materno || '');
  }
  
  // ==================== UBICACIÓN ====================
  // Chubb usa formato: "Domicilio del asegurado y/o propietario: DIRECCION"
  const domicilio = extraerDato(/(?:Domicilio del asegurado|Domicilio|DOMICILIO|DIRECCI[OÓ]N)[:\s]+(.+?)(?=\s*(?:R\.F\.C|Datos generales|Póliza anterior)|$)/is, textoCompleto);
  const colonia = extraerDato(/(?:COLONIA)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Municipio|C\.P\.|CP:|\n))/i, textoCompleto);
  const municipio = extraerDato(/(?:MUNICIPIO|DELEGACI[OÓ]N)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Estado|C\.P\.|CP:|\n))/i, textoCompleto);
  const estado = extraerDato(/(?:ESTADO)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:C\.P\.|CP:|\n))/i, textoCompleto);
  const codigo_postal = extraerDato(/(?:C\.P\.|CP)[:\s]*(\d{5})/i, textoCompleto);
  
  // ==================== PÓLIZA ====================
  // Chubb usa formato: "Póliza: GE 45013353" o "Póliza: GE45013353"
  const polizaMatch = textoCompleto.match(/(?:Póliza|PÓLIZA|P[OÓ]LIZA)[:\s#]*([A-Z]{2}\s?\d+)/i);
  const numero_poliza = polizaMatch ? polizaMatch[1].replace(/\s/g, '') : '';
  const endoso = extraerDato(/(?:ENDOSO|Endoso)[:\s#]*(\d+)/i, textoCompleto) || '000000';
  const inciso = extraerDato(/(?:INCISO|Inciso)[:\s#]*(\d+)/i, textoCompleto) || '0001';
  
  // ==================== PASO 2: AGENTE ====================
  console.log('\n📋 PASO 2: EXTRACCIÓN DE AGENTE');
  console.log('─────────────────────────────────────────────────────────');
  
  // Chubb usa "Clave interna del agente: XXXXX" y "Conducto: N - NOMBRE"
  let agente = '';
  let clave_agente = '';
  
  // Estrategia 1: Capturar "Conducto: N - NOMBRE" (ej: "Conducto: 1 - RITA DINGELER CHAIRES")
  const conductoMatch = textoCompleto.match(/CONDUCTO[:\s]+\d+\s*[-–]\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Descripci[oó]n|Desglose|Datos|RFC|Domicilio|C\.P\.|Tel[eé]fono|\n\n))/i);
  
  // Estrategia 2: Capturar "Clave interna del agente: 141975"
  const claveInternaMatch = textoCompleto.match(/CLAVE\s+INTERNA\s+DEL\s+AGENTE[:\s]+(\d{3,})/i);
  
  // Estrategia 3: Capturar código + nombre en una sola línea (ej: "141975 - RITA DINGLER CHAIRES")
  const claveConNombreMatch = textoCompleto.match(/(?:CLAVE\s+INTERNA\s+DEL\s+AGENTE|CONDUCTO)[:\s]+(\d{3,})\s*[-–]\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Datos|RFC|Domicilio|Desglose|\n\n))/i);
  
  if (claveConNombreMatch) {
    // Caso ideal: código + nombre en una línea
    clave_agente = claveConNombreMatch[1];
    agente = claveConNombreMatch[2].trim();
  } else if (claveInternaMatch && conductoMatch) {
    // Caso común en Chubb: clave y nombre en líneas separadas
    clave_agente = claveInternaMatch[1];
    agente = conductoMatch[1].trim();
  } else if (claveInternaMatch) {
    // Solo tenemos la clave
    clave_agente = claveInternaMatch[1];
  } else if (conductoMatch) {
    // Solo tenemos el nombre
    agente = conductoMatch[1].trim();
  }
  
  console.log('Clave agente:', clave_agente || '❌ NO ENCONTRADO');
  console.log('Agente:', agente || '❌ NO ENCONTRADO');
  
  // ==================== PASO 3: DATOS DE LA PÓLIZA ====================
  console.log('\n📋 PASO 3: EXTRACCIÓN DE DATOS DE LA PÓLIZA');
  console.log('─────────────────────────────────────────────────────────');
  
  // Número de póliza ya extraído arriba
  console.log('Número de póliza:', numero_poliza || '❌');
  console.log('Endoso:', endoso);
  console.log('Inciso:', inciso);
  
  // ==================== VIGENCIA ====================
  // Chubb usa formato: "Vigencia: Del 13/Nov/2025 12:00 horas al 13/Nov/2026 12:00 horas"
  const vigenciaMatch = textoCompleto.match(/Vigencia[:\s]+Del\s+(\d{1,2}\/[A-Za-z]{3}\/\d{4}).*?al\s+(\d{1,2}\/[A-Za-z]{3}\/\d{4})/i);
  let fecha_inicio_vigencia = '';
  let fecha_fin_vigencia = '';
  
  if (vigenciaMatch) {
    fecha_inicio_vigencia = normalizarFecha(vigenciaMatch[1]);
    fecha_fin_vigencia = normalizarFecha(vigenciaMatch[2]);
  }
  
  console.log('Vigencia inicio:', fecha_inicio_vigencia || '❌');
  console.log('Vigencia fin:', fecha_fin_vigencia || '❌');

  // ==================== FECHA DE EMISIÓN ====================
  // Buscar fecha de emisión, si no se encuentra, usar fecha de captura
  const fechaEmisionMatch = textoCompleto.match(/(?:FECHA\s+DE\s+EMISI[OÓ]N|EMISI[OÓ]N)[:\s]+(\d{1,2}\s+(?:DE\s+)?[A-Z]{3,}(?:\s+DE\s+)?\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  let fecha_emision = '';
  
  if (fechaEmisionMatch) {
    fecha_emision = normalizarFecha(fechaEmisionMatch[1]);
  } else {
    // Si no encuentra fecha de emisión, usar fecha de captura
    const fechaHoy = new Date();
    fecha_emision = fechaHoy.toISOString().split('T')[0];
  }
  console.log('Fecha emisión:', fecha_emision);
  
  // Fecha de captura (siempre la fecha actual)
  const fecha_captura = new Date().toISOString().split('T')[0];

  // ==================== FECHA LÍMITE DE PAGO ====================
  const textoFinanciero = textoAvisoDeCobro || textoPagina1 || textoCompleto;
  
  // Helper: Monto desde línea con etiqueta, tolerando desfasado
  // CHUBB: Solo PRIMA NETA e IVA tienen valor ANTES de la etiqueta
  // El resto de campos tienen valor en misma línea o línea siguiente
  const obtenerMontoPorEtiqueta = (texto, etiquetasRegex, buscarLineaAnteriorPrimero = false) => {
    try {
      const lineas = texto.split(/\r?\n/);
      const esMonto = (linea) => {
        if (!linea) return '';
        // Capturar montos monetarios reales:
        // 1. Con símbolo $ (ej: $ 8,223.32 o $1443.58)
        // 2. Con separadores de miles (ej: 8,223.32 o 1,443.58)
        // 3. Con decimales .XX (ej: 1443.58 o 799.00)
        // No capturar números enteros simples sin decimales (777, 123) para evitar direcciones
        const m = linea.match(/\$\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d{2})?)|([0-9]{1,3}(?:,\d{3})+(?:\.\d{2})?)|(\d+\.\d{2})/);
        return m ? (m[1] || m[2] || m[3]) : '';
      };
      
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        
        // Verificar si la línea contiene alguna de las etiquetas
        if (etiquetasRegex.some((re) => re.test(l))) {
          console.log(`🔍 Etiqueta encontrada en línea ${i}:`, l.substring(0, 50));
          
          // 🎯 CASO ESPECIAL: Prima Neta e IVA (valor ANTES de etiqueta)
          if (buscarLineaAnteriorPrimero && i > 0) {
            const monto = esMonto(lineas[i - 1]);
            if (monto) {
              console.log(`   ✅ Monto en LÍNEA ANTERIOR (i-1=${i-1}): ${monto} [Prima Neta/IVA]`);
              return monto;
            }
          }
          
          // 1. Buscar en la MISMA línea después de la etiqueta
          let lineaSinEtiqueta = l;
          for (const re of etiquetasRegex) {
            if (re.test(l)) {
              lineaSinEtiqueta = l.replace(re, '');
              break;
            }
          }
          const montoMismaLinea = esMonto(lineaSinEtiqueta);
          if (montoMismaLinea) {
            console.log(`   ✅ Monto en MISMA línea: ${montoMismaLinea}`);
            return montoMismaLinea;
          }
          
          // 2. Buscar en la SIGUIENTE línea
          if (i + 1 < lineas.length) {
            const montoSiguiente = esMonto(lineas[i + 1]);
            if (montoSiguiente) {
              console.log(`   ✅ Monto en SIGUIENTE línea: ${montoSiguiente}`);
              return montoSiguiente;
            }
          }
          
          // 3. FALLBACK: Si no encontramos en misma/siguiente, probar línea anterior (solo si no se buscó antes)
          if (!buscarLineaAnteriorPrimero && i > 0) {
            const monto = esMonto(lineas[i - 1]);
            if (monto) {
              console.log(`   ⚠️ Monto en LÍNEA ANTERIOR (i-1=${i-1}): ${monto} [fallback]`);
              return monto;
            }
          }
        }
      }
      
      console.log('   ❌ No se encontró monto cerca de la etiqueta');
      return '';
    } catch (e) {
      console.error('Error en obtenerMontoPorEtiqueta:', e);
      return '';
    }
  };
  const fechaLimiteMatch = textoFinanciero.match(/Fecha\s+L[ií]mite\s+de\s+Pago[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  let fecha_limite_pago = '';
  if (fechaLimiteMatch) {
    // Formato encontrado: DD/MM/YYYY → convertir a YYYY-MM-DD
    const dia = fechaLimiteMatch[1].padStart(2, '0');
    const mes = fechaLimiteMatch[2].padStart(2, '0');
    const anio = fechaLimiteMatch[3];
    fecha_limite_pago = `${anio}-${mes}-${dia}`;
    console.log('💳 Fecha límite de pago:', fecha_limite_pago);
  } else {
    console.log('💳 Fecha límite de pago: ❌ NO ENCONTRADO');
  }

  // ==================== INFORMACIÓN FINANCIERA (Página 1 - Aviso de Cobro) ====================
  // NOTA: "Desglose de pago" es solo el TÍTULO de la sección, NO es un campo
  // Los campos reales son: Prima Neta, Otros descuentos, Financiamiento, Gastos, IVA, Total
  // 
  // 🎯 IMPORTANTE: En Chubb PDFs:
  //    - Prima Neta e IVA: valor ANTES de etiqueta (línea anterior)
  //    - Resto de campos: valor en misma línea o línea siguiente
  
  // Prima Neta: buscar en línea ANTERIOR primero (valor antes de etiqueta)
  const primaNeta = obtenerMontoPorEtiqueta(textoFinanciero, [/Prima\s+Neta/i, /PRIMA\s+NETA/i], true) 
    || extraerDato(/Prima\s+Neta[\s\$]+([\d,]+\.?\d*)/i, textoFinanciero) 
    || extraerDato(/PRIMA\s+NETA[:\s]*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero);
  
  // Otros descuentos: buscar normal (misma línea o siguiente)
  const otros_descuentos = obtenerMontoPorEtiqueta(textoFinanciero, [/Otros\s+descuentos?/i], false) 
    || extraerDato(/Otros\s+descuentos?[\s\$]*([\d,]+\.?\d*)/i, textoFinanciero);
  
  // Financiamiento: buscar normal (misma línea o siguiente)
  const financiamiento_fraccionado = obtenerMontoPorEtiqueta(textoFinanciero, [/Financiamiento\s+por\s+pago\s+fraccionado/i], false) 
    || extraerDato(/Financiamiento\s+por\s+pago\s+fraccionado[\s\$]+([\d,]+\.?\d*)/i, textoFinanciero);
  
  // IVA: buscar en línea ANTERIOR primero (valor antes de etiqueta)
  // Variantes: "I.V.A.", "IVA", "I V A", "Impuesto al Valor Agregado"
  console.log('🔍 Buscando IVA en texto financiero...');
  console.log('   Longitud texto:', textoFinanciero?.length);
  console.log('   Contiene "I.V.A."?', textoFinanciero?.includes('I.V.A.'));
  console.log('   Contiene "IVA"?', textoFinanciero?.includes('IVA'));
  
  const ivaExtraido = obtenerMontoPorEtiqueta(textoFinanciero, [
    /I\.V\.A\./i,  // Exacto: I.V.A.
    /I\s*V\s*A/i,  // Con espacios opcionales
    /\bIVA\b/i,    // Palabra completa
    /Impuesto\s+al\s+Valor\s+Agregado/i
  ], true) 
    || extraerDato(/I\.V\.A\.[\s\$:]+([\d,]+\.?\d*)/i, textoFinanciero)
    || extraerDato(/IVA[\s\$:]+([\d,]+\.?\d*)/i, textoFinanciero);
  
  console.log('   IVA extraído:', ivaExtraido || '❌ NO ENCONTRADO');
  
  // Gastos de expedición: buscar normal (misma línea o siguiente)
  const derecho = obtenerMontoPorEtiqueta(textoFinanciero, [/Gastos\s+de\s+expedici[oó]n/i], false) 
    || extraerDato(/Gastos\s+de\s+expedici[oó]n[\s\$]+([\d,]+\.?\d*)/i, textoFinanciero);
  
  // Total: buscar normal (misma línea o siguiente)
  const totalPagar = obtenerMontoPorEtiqueta(textoFinanciero, [/Total\s+a\s+pagar/i], false) 
    || (textoFinanciero.match(/Total\s+a\s+pagar[:\s]*\$?\s*([\d,]+\.?\d*)/i)?.[1] || '');

  // Usar let para permitir fallback desde carátula si algo falta
  let prima_pagada = primaNeta ? primaNeta.replace(/,/g, '') : '';
  let gastos_expedicion = derecho ? derecho.replace(/,/g, '') : '';
  let cargo_pago_fraccionado = financiamiento_fraccionado ? financiamiento_fraccionado.replace(/,/g, '') : '';
  let iva = ivaExtraido ? ivaExtraido.replace(/,/g, '') : '';
  let total = totalPagar ? totalPagar.replace(/,/g, '') : '';
  
  console.log('💰 INFORMACIÓN FINANCIERA (Página Aviso de Cobro):');
  console.log('1. Prima Neta:', prima_pagada || '0.00');
  console.log('2. Otros Descuentos:', otros_descuentos || '0.00');
  console.log('3. Financiamiento:', cargo_pago_fraccionado || '0.00');
  console.log('4. Gastos de expedición:', gastos_expedicion || '0.00');
  console.log('5. IVA:', iva || '0.00');
  console.log('6. Total a pagar:', total || '0.00');

  // ==================== TIPO DE PAGO ====================
  // Buscar "Serie del aviso: X/Y" para determinar forma de pago
  let tipo_pago = '';
  let frecuenciaPago = '';
  let forma_pago = '';
  
  const serieAvisoMatch = textoFinanciero.match(/Serie\s+del\s+aviso[:\s]*(\d+)\s*\/\s*(\d+)/i);
  
  if (serieAvisoMatch) {
    const serieActual = serieAvisoMatch[1];
    const serieTotal = serieAvisoMatch[2];
    
    console.log(`📊 Serie del aviso encontrada: ${serieActual}/${serieTotal}`);
    
    // Determinar tipo de pago según el total de pagos (denominador)
    // 1/1 = 1 pago único/anual
    // 1/2 = 2 pagos (semestral)
    // 1/3 = 3 pagos (cuatrimestral - cada 4 meses)
    // 1/4 = 4 pagos (trimestral - cada 3 meses)
    // 1/6 = 6 pagos (bimestral - cada 2 meses)
    // 1/12 = 12 pagos (mensual)
    
    if (serieTotal === '1') {
      tipo_pago = 'Anual';
      frecuenciaPago = 'Anual';
      // Mostrar como ANUAL en vez de CONTADO para el preview
      forma_pago = 'ANUAL';
      console.log('✅ Pago anual detectado (1/1)');
    } else if (serieTotal === '2') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Semestral';
      forma_pago = 'SEMESTRAL';
      console.log('✅ Pago semestral detectado (1/2)');
    } else if (serieTotal === '3') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Cuatrimestral';
      forma_pago = 'CUATRIMESTRAL';
      console.log('✅ Pago cuatrimestral detectado (1/3)');
    } else if (serieTotal === '4') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Trimestral';
      forma_pago = 'TRIMESTRAL';
      console.log('✅ Pago trimestral detectado (1/4)');
    } else if (serieTotal === '6') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Bimestral';
      forma_pago = 'BIMESTRAL';
      console.log('✅ Pago bimestral detectado (1/6)');
    } else if (serieTotal === '12') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Mensual';
      forma_pago = 'MENSUAL';
      console.log('✅ Pago mensual detectado (1/12)');
    }
    
    console.log(`📋 Tipo de pago FINAL: ${tipo_pago} | Frecuencia: ${frecuenciaPago}`);
  } else {
    console.log('⚠️ Serie del aviso NO encontrada en el PDF');
  }
  
  // ==================== PASO 4: VEHÍCULO (Página 2) ====================
  console.log('\n📋 PASO 4: EXTRACCIÓN DE DATOS DEL VEHÍCULO');
  console.log('─────────────────────────────────────────────────────────');
  
  // 🔍 DEBUG: Mostrar muestra del texto donde buscamos datos del vehículo
  const muestraVehiculo = textoCompleto.substring(textoCompleto.indexOf('Marca:'), textoCompleto.indexOf('Marca:') + 300);
  console.log('📄 MUESTRA DE TEXTO (sección vehículo):\n', muestraVehiculo);
  
  // Helper: Extraer valor después de etiqueta
  // El PDF de Chubb tiene formato mixto:
  // - A veces: "Etiqueta: VALOR" en la misma línea
  // - A veces: "Etiqueta:\nVALOR" en líneas separadas
  // - A veces: "Etiqueta:   Etiqueta2:" en la misma línea (valores en siguiente línea)
  const extraerCampoLinea = (etiqueta, texto) => {
    // Estrategia 1: Buscar "Etiqueta: VALOR" en la misma línea (valor directo después de los dos puntos)
    const regexMismaLinea = new RegExp(`\\b${etiqueta}:\\s+([A-Z0-9][^:\\r\\n]+?)(?=\\s{2,}[A-Za-zÁÉÍÓÚñÑ]+:|\\r|\\n|$)`, 'i');
    const matchMismaLinea = texto.match(regexMismaLinea);
    
    if (matchMismaLinea && matchMismaLinea[1].trim().length > 0) {
      return matchMismaLinea[1].trim();
    }
    
    // Estrategia 2: Buscar "Etiqueta:" seguido de salto de línea y luego el valor
    const regexSiguienteLinea = new RegExp(`\\b${etiqueta}:\\s*[\\r\\n]+\\s*([A-Z0-9][^:\\r\\n]+?)(?=\\s*\\r|\\n|$)`, 'i');
    const matchSiguienteLinea = texto.match(regexSiguienteLinea);
    
    if (matchSiguienteLinea && matchSiguienteLinea[1].trim().length > 0) {
      return matchSiguienteLinea[1].trim();
    }
    
    // Estrategia 3: Formato "Etiqueta:   Etiqueta2:   Etiqueta3:\nVALOR1  VALOR2  VALOR3"
    // Primero encontrar la posición de la etiqueta
    const regexPosicion = new RegExp(`\\b${etiqueta}:`, 'i');
    const matchPosicion = texto.match(regexPosicion);
    
    if (matchPosicion) {
      const indiceEtiqueta = texto.indexOf(matchPosicion[0]);
      const restoTexto = texto.substring(indiceEtiqueta);
      
      // Buscar salto de línea después de la etiqueta
      const matchLineaValores = restoTexto.match(/:\s*[\r\n]+(.+)/);
      if (matchLineaValores) {
        // Extraer la línea completa de valores
        const lineaValores = matchLineaValores[1];
        
        // Dividir por espacios múltiples (2 o más)
        const valores = lineaValores.split(/\s{2,}/);
        
        // Contar cuántas etiquetas hay en la línea de etiquetas antes de la nuestra
        const lineaEtiquetas = restoTexto.substring(0, restoTexto.indexOf('\n'));
        const etiquetasAntes = (lineaEtiquetas.substring(0, lineaEtiquetas.indexOf(matchPosicion[0])).match(/\w+:/g) || []).length;
        
        // El valor correspondiente está en la misma posición
        if (valores[etiquetasAntes]) {
          return valores[etiquetasAntes].trim();
        }
      }
    }
    
    return '';
  };
  
  // 1. MARCA
  const marca = extraerCampoLinea('Marca', textoCompleto);
  console.log('Marca:', marca || '❌');
  
  // 2. MODELO/Descripción del vehículo (descripción completa)
  const modelo = extraerCampoLinea('Descripci[óo]n\\s+del\\s+veh[íi]culo\\*?', textoCompleto);
  console.log('Descripción:', modelo || '❌');
  
  // 3. AÑO (campo "Modelo" en Chubb contiene el año)
  const anio = extraerCampoLinea('Modelo', textoCompleto);
  console.log('Año:', anio || '❌');
  
  // 4. SERIE/VIN
  const numero_serie = extraerCampoLinea('Serie', textoCompleto);
  console.log('Serie/VIN:', numero_serie || '❌');
  
  // 5. CAPACIDAD
  let capacidad = extraerCampoLinea('Capacidad', textoCompleto);
  // Validar que sea un número (5, 7, 2, etc.)
  if (capacidad && !/^\d+$/.test(capacidad.trim())) {
    // Si no es solo dígitos, está capturando texto equivocado
    capacidad = '';
  }
  console.log('Capacidad:', capacidad || '❌');
  
  // 6. MOTOR
  let motor = extraerCampoLinea('Motor', textoCompleto);
  // Limpiar si capturó la marca o capacidad por error
  // Motor debe ser alfanumérico sin espacios múltiples (ej: CLS441152)
  if (motor) {
    // Remover palabras que claramente son marcas
    motor = motor.replace(/VOLKSWAGEN|NISSAN|FORD|CHEVROLET|TOYOTA|HONDA/gi, '').trim();
    // Remover números sueltos al inicio (capacidad: 5, 7, 2, etc.)
    motor = motor.replace(/^\s*\d+\s+/, '').trim();
    // Limpiar espacios múltiples
    motor = motor.replace(/\s+/g, ' ').trim();
  }
  console.log('Motor:', motor || '❌');
  
  // 7. PLACAS (puede estar vacío)
  let placas = extraerCampoLinea('Placas', textoCompleto);
  // Validar que no sea texto inválido
  if (placas && (
    placas.includes('Uso') || 
    placas.includes('PRIVADO') || 
    placas.includes('Inspección') || 
    placas === 'No' ||
    placas.length < 3
  )) {
    placas = '';
  }
  console.log('Placas:', placas || '(vacío)');
  
  // 8. USO
  const uso = extraerCampoLinea('Uso', textoCompleto);
  console.log('Uso:', uso || '❌');
  
  // 9. SERVICIO
  const servicio = extraerCampoLinea('Servicio', textoCompleto);
  console.log('Servicio:', servicio || '❌');
  
  // 10. COLOR (si existe)
  const color = extraerCampoLinea('Color', textoCompleto);
  console.log('Color:', color || '❌');

  // ==================== PASO 5: DATOS FINANCIEROS ====================
  console.log('\n📋 PASO 5: EXTRACCIÓN DE DATOS FINANCIEROS');
  console.log('─────────────────────────────────────────────────────────');
  
  // ==================== PAGOS FRACCIONADOS: PRIMER Y SUBSECUENTES ====================
  // Intentar extraer explícitamente si el PDF lo indica
  // Variantes frecuentes: "Primer Pago", "Pago Inicial", "Pagos subsecuentes", "Pago subsecuente", "Mensualidad"
  const textoPagos = textoAvisoDeCobro || textoPagina1 || textoCompleto;
  const buscarMontoEnContexto = (lineas, idx) => {
    const esMonto = (s) => {
      if (!s) return '';
      const m = s.match(/\$\s*([0-9]{1,3}(?:,\d{3})*(?:\.\d{2})?)|([0-9]{1,3}(?:,\d{3})+(?:\.\d{2})?)|(\d+\.\d{2})/);
      return m ? (m[1] || m[2] || m[3]) : '';
    };
    // misma línea
    let monto = esMonto(lineas[idx]);
    if (monto) return monto;
    // siguiente
    if (idx + 1 < lineas.length) {
      monto = esMonto(lineas[idx + 1]);
      if (monto) return monto;
    }
    // anterior
    if (idx > 0) {
      monto = esMonto(lineas[idx - 1]);
      if (monto) return monto;
    }
    return '';
  };
  let primer_pago = '';
  let pagos_subsecuentes = '';
  try {
    const lineasFin = textoPagos.split(/\r?\n/);
    for (let i = 0; i < lineasFin.length; i++) {
      const l = lineasFin[i];
      if (/PRIMER\s+PAGO|PAGO\s+INICIAL/i.test(l)) {
        const monto = buscarMontoEnContexto(lineasFin, i);
        if (monto) {
          primer_pago = monto.replace(/,/g, '');
          console.log('💳 Primer pago detectado:', primer_pago);
        }
      }
      if (/PAGOS?\s+SUBSECUENTES?|SUBSECUENTE|MENSUALIDAD|CUOTA\s+SUBSECUENTE/i.test(l)) {
        const monto = buscarMontoEnContexto(lineasFin, i);
        if (monto) {
          pagos_subsecuentes = monto.replace(/,/g, '');
          console.log('💳 Pago subsecuente detectado:', pagos_subsecuentes);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Error extrayendo primer/subsecuentes:', e);
  }
  
  // ==================== USO Y SERVICIO ====================
  // Ya extraídos arriba en la sección de vehículo
  console.log('   ✅ Uso y Servicio ya extraídos en sección de vehículo');
  
  // ==================== COBERTURA Y PLAN ====================
  // Buscar paquete (INTEGRAL, LIMITADA, etc.)
  const paqueteMatch = textoCompleto.match(/(?:Paquete|PAQUETE)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Datos|DATOS|\n\n|$))/i);
  const plan = paqueteMatch ? paqueteMatch[1].trim().toUpperCase() : '';
  console.log('   Paquete/Plan:', plan || '❌');
  
  const tipoCoberturaMatch = textoCompleto.match(/(?:PLAN|COBERTURA)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\n|$)/i);
  let tipo_cobertura = 'Amplia';
  if (tipoCoberturaMatch) {
    const texto = tipoCoberturaMatch[1].toLowerCase();
    if (texto.includes('amplia')) tipo_cobertura = 'Amplia';
    else if (texto.includes('limitada')) tipo_cobertura = 'Limitada';
    else if (texto.includes('rc') || texto.includes('responsabilidad')) tipo_cobertura = 'RC (Responsabilidad Civil)';
  }
  // Si no se encontró tipo_cobertura pero sí plan, usar el plan como tipo_cobertura
  if (!tipoCoberturaMatch && plan) {
    tipo_cobertura = plan;
  }
  
  const suma_asegurada = extraerDato(/(?:SUMA\s+ASEGURADA|VALOR\s+COMERCIAL)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoCompleto)?.replace(/,/g, '') || '';
  const deducible = extraerDato(/(?:DEDUCIBLE)[:\s]+(\d+(?:\.\d+)?)%?/i, textoCompleto) || '5';

  // ==================== COBERTURAS AMPARADAS (Tabla) ====================
  const { coberturas, bloqueFinancieroCaratula } = (() => {
    try {
      const inicio = textoCompleto.search(/Coberturas\s+amparadas/i);
      if (inicio === -1) return { coberturas: [], bloqueFinancieroCaratula: '' };
      const resto = textoCompleto.slice(inicio);
      const finIdx = resto.search(/(?:\n\s*Notas?\b|\n\s*CONDICIONES\s+GENERALES\b|\n\s*Datos\s+de\s+la\s+p[oó]liza\b|\n\s*Vigencia\b)/i);
      const bloque = finIdx > 0 ? resto.slice(0, finIdx) : resto;

      const lineasRaw = bloque.split(/\r?\n/).map(l => l.replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
      const financialLabelRegex = /^(PRIMA\s+NETA|Prima\s+Neta|OTROS\s+DESCUENTOS|Otros\s+descuentos?|FINANCIAMIENTO|Financiamiento|GASTOS\s+DE\s+EXPEDICI|Gastos\s+de\s+expedici|I\.V\.A\.|IVA|TOTAL\s+A\s+PAGAR|Total\s+a\s+pagar)/i;

      // Encontrar punto de corte donde empiezan los costos de póliza
      let corte = lineasRaw.findIndex(l => financialLabelRegex.test(l));
      if (corte === -1) corte = lineasRaw.length; // si no hay, todo es coberturas

      const lineasCob = lineasRaw
        .slice(0, corte)
        .filter(l => !/^(Coberturas\s+amparadas|Desglose\s+de\s+coberturas|Suma\s+asegurada|Deducible|Prima)$/i.test(l));

      const esMonto = (s) => /\d{1,3}(?:,\d{3})*(?:\.\d{2})$/.test(s.trim());
      const normalizaMonto = (s) => {
        if (!s) return '';
        const t = s.trim();
        if (/^(AMPARADA|VALOR\s+COMERCIAL|VALOR\s+FACTURA)$/i.test(t)) return t.toUpperCase();
        const mm = t.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/);
        return mm ? mm[1].replace(/,/g, '') : t;
      };
      const tomarUltimo = (s, re) => {
        let m, last = null;
        while ((m = re.exec(s)) !== null) last = m[0];
        return last;
      };

      const filas = [];
      for (let i = 0; i < lineasCob.length; i++) {
        let l = lineasCob[i];
        // Unir líneas hasta que termine con un monto de prima
        while (i + 1 < lineasCob.length && !esMonto(l)) {
          const candidato = `${l} ${lineasCob[i + 1]}`.trim();
          if (esMonto(candidato)) { l = candidato; i++; break; }
          l = candidato; i++;
        }
        if (!esMonto(l)) continue;

        const mPrima = l.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s*$/);
        if (!mPrima) continue;
        const prima = mPrima[1].replace(/,/g, '');
        let antesPrima = l.slice(0, mPrima.index).trim();

        const dedu = tomarUltimo(antesPrima, /(NO\s+APLICA|SCGP|SCCP|A\)\s*\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%)/gi) || 'NO APLICA';
        if (dedu) {
          const posD = antesPrima.toUpperCase().lastIndexOf(dedu.toUpperCase());
          if (posD >= 0) antesPrima = antesPrima.slice(0, posD).trim();
        }

        let sumaStr = tomarUltimo(antesPrima, /(VALOR\s+COMERCIAL|VALOR\s+FACTURA|AMPARADA|\d{1,3}(?:,\d{3})*(?:\.\d{2}))/gi) || 'AMPARADA';
        if (sumaStr) {
          const posS = antesPrima.toUpperCase().lastIndexOf(sumaStr.toUpperCase());
          if (posS >= 0) antesPrima = antesPrima.slice(0, posS).trim();
        }
        const nombre = antesPrima.replace(/\s+/g, ' ').trim();
        if (!nombre) continue;

        filas.push({
          nombre,
          suma_asegurada: normalizaMonto(sumaStr),
          deducible: dedu.replace(/\s+/g, ' ').toUpperCase(),
          prima
        });
      }

      const bloqueFinanciero = lineasRaw.slice(corte).join('\n');
      return { coberturas: filas, bloqueFinancieroCaratula: bloqueFinanciero };
    } catch (e) {
      console.warn('⚠️ Error parseando coberturas:', e);
      return { coberturas: [], bloqueFinancieroCaratula: '' };
    }
  })();

  // Fallback financiero desde carátula si algún campo crítico falta
  if ((!prima_pagada || !iva || !total) && bloqueFinancieroCaratula) {
    console.log('🔄 Fallback: intentando obtener montos desde bloque financiero en carátula');
    const linesFin = bloqueFinancieroCaratula.split(/\r?\n/);
    const extraeMontoLinea = (labelRegex) => {
      for (const ln of linesFin) {
        if (labelRegex.test(ln)) {
          const m = ln.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g);
          if (m && m.length) return m[m.length - 1].replace(/,/g, '');
        }
      }
      return '';
    };
    prima_pagada = prima_pagada || extraeMontoLinea(/Prima\s+Neta/i);
    gastos_expedicion = gastos_expedicion || extraeMontoLinea(/Gastos\s+de\s+expedici/i);
    cargo_pago_fraccionado = cargo_pago_fraccionado || extraeMontoLinea(/Financiamiento\s+por\s+pago\s+fraccionado/i);
    iva = iva || extraeMontoLinea(/I\.V\.A\.|IVA/i);
    total = total || extraeMontoLinea(/Total\s+a\s+pagar/i);
    console.log('🔄 Fallback resultados:', { prima_pagada, gastos_expedicion, cargo_pago_fraccionado, iva, total });
  }
  
  console.log('Prima Neta:', prima_pagada || '0.00');
  console.log('Otros Descuentos:', otros_descuentos || '0.00');
  console.log('Cargo Fraccionado:', cargo_pago_fraccionado || '0.00');
  console.log('Gastos Expedición:', gastos_expedicion || '0.00');
  console.log('IVA:', iva || '0.00');
  console.log('TOTAL:', total || '0.00');
  console.log('Tipo de pago:', tipo_pago);
  console.log('Frecuencia:', frecuenciaPago);
  if (primer_pago) console.log('Primer pago:', primer_pago);
  if (pagos_subsecuentes) console.log('Pagos subsecuentes:', pagos_subsecuentes);
  
  // ==================== PASO 6: COBERTURAS ====================
  console.log('\n📋 PASO 6: EXTRACCIÓN DE COBERTURAS');
  console.log('─────────────────────────────────────────────────────────');
  
  // ==================== RESULTADO ====================
  const datosExtraidos = {
    // Asegurado (Página 1)
    tipo_persona: tipoPersona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc: rfcExtraido || '', // Asegurar que siempre sea string (nunca undefined)
    domicilio,
    colonia,
    municipio,
    estado,
    codigo_postal,
    pais: 'MEXICO',

    
    // Póliza (Página 1)
    compania: 'Chubb',
    producto: 'Autos Individual',
    plan, // Paquete (INTEGRAL, LIMITADA, etc.)
    etapa_activa: 'Emitida',
    clave_agente,
    agente,
    numero_poliza,
    endoso,
    inciso,
    inicio_vigencia: fecha_inicio_vigencia,
    termino_vigencia: fecha_fin_vigencia,
    fecha_emision,
    fecha_captura,
    
    // Financiero (Página 1 - Aviso de Cobro)
    prima_pagada,
    otros_descuentos: otros_descuentos ? otros_descuentos.replace(/,/g, '') : '',
    cargo_pago_fraccionado,
    gastos_expedicion,
    iva,
    total,
    primer_pago: primer_pago || undefined,
    pagos_subsecuentes: pagos_subsecuentes || undefined,
    tipo_pago,
    frecuenciaPago,
    forma_pago, // Extraído de Serie del aviso
    fecha_limite_pago, // Fecha límite de pago desde Aviso de Cobro
    
    // Vehículo (Página 2)
    marca,
    modelo,
    anio,
    numero_serie,
    motor,
    placas,
    capacidad,
    color,
    tipo_cobertura,
    suma_asegurada,
    deducible,
    uso, // Extraído de página 2
    servicio, // Extraído de página 2
    coberturas,
    
    // Metadata de validación
    alertas_extraccion: alertasRFC.length > 0 ? alertasRFC : undefined
  };
  
  console.log('Total de coberturas extraídas:', coberturas?.length || 0);
  if (coberturas && coberturas.length > 0) {
    coberturas.slice(0, 3).forEach((cob, i) => {
      console.log(`  ${i+1}. ${cob.nombre} - Suma: ${cob.suma_asegurada || 'N/A'}`);
    });
    if (coberturas.length > 3) {
      console.log(`  ... y ${coberturas.length - 3} más`);
    }
  }
  
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ EXTRACCIÓN COMPLETADA EXITOSAMENTE                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  return datosExtraidos;
}

export default { extraer };

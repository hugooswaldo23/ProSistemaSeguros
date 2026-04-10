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

  // ==================== INFORMACIÓN FINANCIERA ====================
  // En Chubb, las etiquetas están en UNA línea y los valores en OTRA:
  // "Prima neta Otros descuentos Financiamiento... Gastos... I.V.A.  Prima total"
  // "7,450.81 0.00 0.00 799.00 1,319.97  9,569.78"
  // PRIORIDAD 1: Parsear la línea con 6 montos consecutivos
  let prima_neta = '';
  let otros_servicios = '';
  let cargo_pago_fraccionado = '';
  let gastos_expedicion = '';
  let iva = '';
  let total = '';

  // Buscar línea con 6 valores numéricos (formato Chubb desglose financiero)
  const textosBusqueda = [textoAvisoDeCobro, textoCompleto].filter(Boolean);
  for (const txtBusca of textosBusqueda) {
    if (prima_neta) break;
    const lineas = txtBusca.split(/\r?\n/);
    for (let i = 0; i < lineas.length; i++) {
      // Buscar línea con exactamente 6 montos separados por espacios
      const montos = lineas[i].match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/g);
      if (montos && montos.length >= 6) {
        // Verificar que una línea cercana tenga "Prima" para confirmar contexto
        const contexto = lineas.slice(Math.max(0, i-5), i+1).join(' ');
        if (/Prima/i.test(contexto)) {
          const limpiar = (s) => s.replace(/,/g, '');
          prima_neta = limpiar(montos[0]);
          otros_servicios = limpiar(montos[1]);
          cargo_pago_fraccionado = limpiar(montos[2]);
          gastos_expedicion = limpiar(montos[3]);
          iva = limpiar(montos[4]);
          total = limpiar(montos[5]);
          console.log('💰 Montos de tabla desglose Chubb (línea', i, '):', {
            prima_neta, otros_servicios, cargo_pago_fraccionado, gastos_expedicion, iva, total
          });
          break;
        }
      }
    }
  }

  // PRIORIDAD 2: fallback con obtenerMontoPorEtiqueta si la tabla no se encontró
  if (!prima_neta) {
    prima_neta = (obtenerMontoPorEtiqueta(textoFinanciero, [/Prima\s+Neta/i], true)
      || extraerDato(/Prima\s+Neta[\s\$]+([\d,]+\.?\d*)/i, textoFinanciero) || '').replace(/,/g, '');
  }
  if (!gastos_expedicion) {
    gastos_expedicion = (obtenerMontoPorEtiqueta(textoFinanciero, [/Gastos\s+de\s+expedici[oó]n/i], false)
      || extraerDato(/Gastos\s+de\s+expedici[oó]n[\s\$]+([\d,]+\.?\d*)/i, textoFinanciero) || '').replace(/,/g, '');
  }
  if (!iva) {
    iva = (obtenerMontoPorEtiqueta(textoFinanciero, [/I\.V\.A\./i, /\bIVA\b/i], true)
      || extraerDato(/I\.V\.A\.[\s\$:]+([\d,]+\.?\d*)/i, textoFinanciero) || '').replace(/,/g, '');
  }
  if (!total) {
    total = (obtenerMontoPorEtiqueta(textoFinanciero, [/Total\s+a\s+pagar/i, /Prima\s+total/i], false)
      || extraerDato(/(?:Total\s+a\s+pagar|Prima\s+total)[:\s]*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero) || '').replace(/,/g, '');
  }

  let prima_pagada = prima_neta;
  
  console.log('💰 INFORMACIÓN FINANCIERA:');
  console.log('1. Prima Neta:', prima_neta || '0.00');
  console.log('2. Otros Descuentos:', otros_servicios || '0.00');
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
  
  // 8. USO - regex directo (extraerCampoLinea falla porque Strategy 3 salta a otras páginas)
  const usoMatch = textoCompleto.match(/\bUso:\s+([A-ZÁÉÍÓÚÑ]+)/i);
  const uso = usoMatch ? usoMatch[1].toUpperCase() : '';
  console.log('Uso:', uso || '❌');
  
  // 9. SERVICIO - regex directo
  const servicioMatch = textoCompleto.match(/\bServicio:\s+([A-ZÁÉÍÓÚÑ]+)/i);
  const servicio = servicioMatch ? servicioMatch[1].toUpperCase() : '';
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

  // ═══════════════════════════════════════════════════════════════
  // DETECCIÓN DE MONTOS ANUALES: "Prima total" (carátula) vs "Total a pagar" (aviso)
  // ═══════════════════════════════════════════════════════════════
  // En Chubb:
  //   - Carátula (pág 1): total ANUAL etiquetado como "Prima total"
  //   - Aviso de Cobro (pág 2): monto POR RECIBO etiquetado como "Total a pagar"
  // PRIORIDAD 1 pudo haber encontrado los montos del aviso (per-recibo).
  // Aquí buscamos "Prima total" para obtener el total anual real.
  {
    const lineasCompletas = textoCompleto.split(/\r?\n/);
    let totalAnualEncontrado = '';
    let lineaPrimaTotal = -1;

    for (let i = 0; i < lineasCompletas.length; i++) {
      if (!/Prima\s+total/i.test(lineasCompletas[i])) continue;
      // Ignorar si la línea también dice "Total a pagar" (sería un match ambiguo)
      if (/Total\s+a\s+pagar/i.test(lineasCompletas[i])) continue;
      lineaPrimaTotal = i;
      console.log(`🔍 "Prima total" encontrado en línea ${i}: "${lineasCompletas[i].substring(0, 100)}"`);

      // Caso 1: Formato vertical — "Prima total 6,355.43" (etiqueta + monto en misma línea)
      const montoMismaLinea = lineasCompletas[i].match(/Prima\s+total[\s:]*\$?\s*([\d,]+\.\d{2})/i);
      if (montoMismaLinea) {
        totalAnualEncontrado = montoMismaLinea[1].replace(/,/g, '');
        console.log(`  ✅ Caso 1 (vertical): total anual = $${totalAnualEncontrado}`);
        break;
      }

      // Caso 2: Formato horizontal (6 columnas) — etiquetas en línea i, valores en línea i+1
      if (i + 1 < lineasCompletas.length) {
        const valoresLinea = lineasCompletas[i + 1].match(/(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g);
        if (valoresLinea && valoresLinea.length >= 5) {
          // "Prima total" es la última columna → el último monto
          totalAnualEncontrado = valoresLinea[valoresLinea.length - 1].replace(/,/g, '');
          console.log(`  ✅ Caso 2 (horizontal ${valoresLinea.length}-col): total anual = $${totalAnualEncontrado}`);
          // Extraer también los otros campos de la misma línea de valores
          if (valoresLinea.length >= 6) {
            const limpiar = (s) => s.replace(/,/g, '');
            prima_neta = limpiar(valoresLinea[0]);
            otros_servicios = limpiar(valoresLinea[1]);
            cargo_pago_fraccionado = limpiar(valoresLinea[2]);
            gastos_expedicion = limpiar(valoresLinea[3]);
            iva = limpiar(valoresLinea[4]);
          }
          break;
        }

        // Caso 3: Monto solo en la siguiente línea (label/value separados)
        const siguienteMatch = lineasCompletas[i + 1].match(/([\d,]+\.\d{2})/);
        if (siguienteMatch) {
          totalAnualEncontrado = siguienteMatch[1].replace(/,/g, '');
          console.log(`  ✅ Caso 3 (siguiente línea): total anual = $${totalAnualEncontrado}`);
          break;
        }
      }
      break; // Solo procesar el primer "Prima total"
    }

    // Aplicar total anual si es mayor que el actual (confirma que el actual era per-recibo)
    const anualNum = parseFloat(totalAnualEncontrado) || 0;
    const actualNum = parseFloat(total) || 0;

    if (anualNum > actualNum) {
      console.log(`🔄 Total ANUAL ($${totalAnualEncontrado}) > total actual ($${total}) → corrigiendo`);
      total = totalAnualEncontrado;

      // Para formato vertical, buscar otros montos anuales en las líneas cercanas
      if (lineaPrimaTotal > 0) {
        const zonaAnual = lineasCompletas.slice(Math.max(0, lineaPrimaTotal - 10), lineaPrimaTotal + 1);
        for (const ln of zonaAnual) {
          if (/Prima\s+neta/i.test(ln)) {
            const m = ln.match(/([\d,]+\.\d{2})/);
            if (m) prima_neta = m[1].replace(/,/g, '');
          }
          if (/Gastos\s+de\s+expedici/i.test(ln)) {
            const m = ln.match(/([\d,]+\.\d{2})/);
            if (m) gastos_expedicion = m[1].replace(/,/g, '');
          }
          if (/Financiamiento/i.test(ln)) {
            const m = ln.match(/([\d,]+\.\d{2})/);
            if (m) cargo_pago_fraccionado = m[1].replace(/,/g, '');
          }
          if (/I\.V\.A\./i.test(ln)) {
            const m = ln.match(/([\d,]+\.\d{2})/);
            if (m) iva = m[1].replace(/,/g, '');
          }
        }
      }

      prima_pagada = prima_neta;
      console.log('✅ Montos ANUALES corregidos:', { prima_neta, gastos_expedicion, cargo_pago_fraccionado, iva, total });
    } else if (totalAnualEncontrado) {
      console.log(`ℹ️ "Prima total" ($${totalAnualEncontrado}) ≤ total actual ($${total}), no se requiere corrección`);
    } else {
      console.log('ℹ️ "Prima total" no encontrado en el texto, usando montos actuales');
    }
  }
  
  console.log('Prima Neta:', prima_neta || '0.00');
  console.log('Otros Descuentos:', otros_servicios || '0.00');
  console.log('Cargo Fraccionado:', cargo_pago_fraccionado || '0.00');
  console.log('Gastos Expedición:', gastos_expedicion || '0.00');
  console.log('IVA:', iva || '0.00');
  console.log('TOTAL:', total || '0.00');
  console.log('Tipo de pago:', tipo_pago);
  console.log('Frecuencia:', frecuenciaPago);
  if (primer_pago) console.log('Primer pago:', primer_pago);
  if (pagos_subsecuentes) console.log('Pagos subsecuentes:', pagos_subsecuentes);

  // ==================== PASO 5B: RECIBOS FRACCIONADOS DESDE AVISO DE COBRO ====================
  // Chubb: La carátula tiene montos ANUALES, el Aviso de Cobro tiene montos POR RECIBO.
  // Si es fraccionado, extraer "Total a pagar" del Aviso de Cobro como primer_pago.
  if (tipo_pago === 'Fraccionado' && textoAvisoDeCobro) {
    console.log('\n📋 PASO 5B: EXTRAER MONTOS DE RECIBO DESDE AVISO DE COBRO');
    console.log('─────────────────────────────────────────────────────────');

    // Buscar "Total a pagar" línea por línea (maneja formatos vertical y horizontal)
    const lineasAviso = textoAvisoDeCobro.split(/\r?\n/);
    let totalPrimerRecibo = '';

    for (let i = 0; i < lineasAviso.length; i++) {
      if (!/Total\s+a\s+pagar/i.test(lineasAviso[i])) continue;
      console.log(`🔍 "Total a pagar" en aviso línea ${i}: "${lineasAviso[i].substring(0, 80)}"`);

      // Caso 1: Monto en la misma línea (ej: "Total a pagar $ 2,461.57")
      const mismaLinea = lineasAviso[i].match(/Total\s+a\s+pagar[\s:]*\$?\s*([\d,]+\.\d{2})/i);
      if (mismaLinea) {
        totalPrimerRecibo = mismaLinea[1].replace(/,/g, '');
        console.log(`  ✅ Caso 1 (misma línea): primer recibo = $${totalPrimerRecibo}`);
        break;
      }

      // Caso 2: Formato 6 columnas — valores en la siguiente línea, "Total a pagar" es la última columna
      if (i + 1 < lineasAviso.length) {
        const valoresLinea = lineasAviso[i + 1].match(/(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g);
        if (valoresLinea && valoresLinea.length >= 5) {
          totalPrimerRecibo = valoresLinea[valoresLinea.length - 1].replace(/,/g, '');
          console.log(`  ✅ Caso 2 (horizontal ${valoresLinea.length}-col): primer recibo = $${totalPrimerRecibo}`);
          break;
        }
        // Caso 3: Monto solo en siguiente línea
        const siguiente = lineasAviso[i + 1].match(/([\d,]+\.\d{2})/);
        if (siguiente) {
          totalPrimerRecibo = siguiente[1].replace(/,/g, '');
          console.log(`  ✅ Caso 3 (siguiente línea): primer recibo = $${totalPrimerRecibo}`);
          break;
        }
      }
      break;
    }

    if (totalPrimerRecibo) {
      console.log('💰 Total a pagar del Aviso de Cobro (primer recibo):', totalPrimerRecibo);

      // Solo usar si es menor al total anual (confirma que es un recibo parcial)
      const totalAnual = parseFloat(total) || 0;
      const totalRecibo = parseFloat(totalPrimerRecibo) || 0;

      if (totalRecibo > 0 && totalRecibo < totalAnual) {
        primer_pago = totalPrimerRecibo;

        // Calcular pagos subsecuentes: (total anual - primer recibo) / (num_recibos - 1)
        const serieMatch = textoAvisoDeCobro.match(/Serie\s+del\s+aviso[:\s]*(\d+)\s*\/\s*(\d+)/i);
        const numRecibos = serieMatch ? parseInt(serieMatch[2]) : 0;

        if (numRecibos > 1) {
          const montoRestante = totalAnual - totalRecibo;
          const montoSubsecuente = (montoRestante / (numRecibos - 1)).toFixed(2);
          pagos_subsecuentes = montoSubsecuente;
          console.log(`💰 Pagos subsecuentes: ($${totalAnual} - $${totalRecibo}) / ${numRecibos - 1} = $${montoSubsecuente}`);
        }

        console.log('✅ primer_pago:', primer_pago);
        console.log('✅ pagos_subsecuentes:', pagos_subsecuentes);
      } else {
        console.log(`⚠️ Total del aviso ($${totalPrimerRecibo}) ≥ total anual ($${total}), no se usa como primer_pago`);
      }
    } else {
      console.log('⚠️ No se encontró "Total a pagar" en el Aviso de Cobro');
    }
  }
  
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
    producto: 'Autos',
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
    
    // Financiero
    prima_neta,
    prima_pagada,
    otros_servicios,
    cargo_pago_fraccionado,
    gastos_expedicion,
    iva,
    total,
    primer_pago: (() => {
      if (primer_pago) return primer_pago;
      if (!total || tipo_pago === 'Anual' || tipo_pago === 'Contado') return total || undefined;
      // Fraccionado sin primer_pago explícito: calcular a partir del total anual
      const totalNum = parseFloat(total) || 0;
      const gastosNum = parseFloat(gastos_expedicion) || 0;
      const frecMap = { Mensual: 12, Bimestral: 6, Trimestral: 4, Cuatrimestral: 3, Semestral: 2 };
      const numRecibos = frecMap[frecuenciaPago] || 4;
      const baseRepartible = totalNum - gastosNum;
      const montoSubsec = baseRepartible / numRecibos;
      return (montoSubsec + gastosNum).toFixed(2);
    })(),
    pagos_subsecuentes: (() => {
      if (pagos_subsecuentes) return pagos_subsecuentes;
      if (!total || tipo_pago === 'Anual' || tipo_pago === 'Contado') return '';
      // Fraccionado sin pagos_subsecuentes explícito: calcular
      const totalNum = parseFloat(total) || 0;
      const gastosNum = parseFloat(gastos_expedicion) || 0;
      const frecMap = { Mensual: 12, Bimestral: 6, Trimestral: 4, Cuatrimestral: 3, Semestral: 2 };
      const numRecibos = frecMap[frecuenciaPago] || 4;
      const baseRepartible = totalNum - gastosNum;
      return (baseRepartible / numRecibos).toFixed(2);
    })(),
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
    tipo_vehiculo: '',
    conductor_habitual: '',
    movimiento: endoso && endoso !== '000000' ? 'Endoso' : 'Emisión',
    moneda: 'MXN',
    periodo_gracia: '30',
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

/**
 * Extractor Especializado: HDI - Autos
 * 
 * Extrae información de pólizas de autos de HDI Seguros.
 * 
 * ESTRATEGIA: Se enfoca en la última página "FORMATO DE PAGO" que contiene
 * casi todos los datos estructurados excepto coberturas.
 * Las coberturas se extraen de las páginas interiores (póliza).
 * 
 * Formato típico HDI "FORMATO DE PAGO":
 *   FORMATO DE PAGO
 *   Ramo: AUTOS RESIDENTES
 *   ULISES ALVAREZ HERNANDEZ                   ← nombre (línea suelta)
 *   AAHU000521F86                               ← RFC (línea suelta)
 *   EROS No. Ext. 233 LA ERMITA C.P.:37358, LEON,
 *   GUANAJUATO TEL.: 3333000000                 ← dirección + tel
 *   PÓLIZA INDIVIDUAL: 5-508523 Cert. 1
 *   Frecuencia de pago de póliza: ANUAL
 *   Vigencia Desde las 12:00 hrs. Hasta las 12:00 hrs.
 *            02/Ene/2026        02/Ene/2027
 *   Marca:    NISSAN SENTRA
 *   Modelo:   2017
 *   Serie:    3N1AB7ADXHL701834
 *   Paquete:  HDI EN MI AUTO
 *   Agente: 053353 RITA DINGLER CHAIRES
 *   Prima Neta                 6,326.72
 *   Recargo Por Pago Fraccionado  0.00
 *   Derecho de Póliza            725.00
 *   I.V.A. 16.00%              1,128.28
 *   Total a pagar              8,180.00
 * 
 * @module extractors/hdi/autos
 */

/**
 * Extrae un dato usando expresión regular
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
 * Normaliza formato de fecha HDI.
 * Soporta:
 *   DD/Mmm/YYYY  (02/Ene/2026)  ← formato principal HDI
 *   DD/MM/YYYY
 *   DD-MM-YYYY
 *   DD DE MESCOMPLET DE YYYY
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
    'SEP': '09', 'SEPTIEMBRE': '09', 'SEPT': '09',
    'OCT': '10', 'OCTUBRE': '10',
    'NOV': '11', 'NOVIEMBRE': '11',
    'DIC': '12', 'DICIEMBRE': '12'
  };

  // Formato HDI: DD/Mmm/YYYY (02/Ene/2026) o DD-mmm.-YYYY (01-feb.-2026)
  const matchMesAbrev = fecha.match(/(\d{1,2})[\/-]([A-Za-z]{3,})\.?[\/-](\d{4})/i);
  if (matchMesAbrev) {
    const dia = matchMesAbrev[1].padStart(2, '0');
    const mesKey = matchMesAbrev[2].toUpperCase().substring(0, 3);
    const mes = meses[mesKey] || '01';
    const anio = matchMesAbrev[3];
    return `${anio}-${mes}-${dia}`;
  }

  // Formato: DD DE MESCOMPLET DE YYYY
  const matchMesCompleto = fecha.match(/(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(\d{4})/i);
  if (matchMesCompleto) {
    const dia = matchMesCompleto[1].padStart(2, '0');
    const mes = meses[matchMesCompleto[2].toUpperCase()] || '01';
    const anio = matchMesCompleto[3];
    return `${anio}-${mes}-${dia}`;
  }

  // Formato: DD/MM/YYYY o DD-MM-YYYY
  const matchNum = fecha.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (matchNum) {
    const dia = matchNum[1].padStart(2, '0');
    const mes = matchNum[2].padStart(2, '0');
    const anio = matchNum[3];
    return `${anio}-${mes}-${dia}`;
  }

  return fecha;
}

/**
 * Limpia y normaliza montos (quita $, comas, espacios)
 */
function limpiarMonto(texto) {
  if (!texto) return '';
  const limpio = texto.replace(/[$,\s]/g, '').trim();
  const numero = parseFloat(limpio);
  return !isNaN(numero) ? numero.toFixed(2) : '';
}

/**
 * Encuentra la página "FORMATO DE PAGO" en el PDF
 * @param {Object} ctx - Contexto del PDF
 * @returns {string} Texto de la página FORMATO DE PAGO, o textoCompleto como fallback
 */
function encontrarPaginaFormatoPago(ctx) {
  const { todasLasPaginas, textoCompleto, textoPagina1, textoPagina2 } = ctx;

  // Si tenemos todas las páginas, buscar la que contenga "FORMATO DE PAGO"
  // Nota: cada elemento es { numero, texto }
  if (todasLasPaginas && Array.isArray(todasLasPaginas)) {
    for (let i = todasLasPaginas.length - 1; i >= 0; i--) {
      const textoPage = todasLasPaginas[i].texto || todasLasPaginas[i];
      if (/FORMATO\s+DE\s+PAGO/i.test(textoPage)) {
        console.log(`📄 Página FORMATO DE PAGO encontrada: página ${i + 1}`);
        return textoPage;
      }
    }
  }

  // Fallback: buscar en textoCompleto
  const texto = textoCompleto || (textoPagina1 + '\n' + (textoPagina2 || ''));

  // Intentar aislar la sección FORMATO DE PAGO del texto completo
  const seccion = texto.match(/FORMATO\s+DE\s+PAGO[\s\S]*/i);
  if (seccion) {
    console.log('📄 Sección FORMATO DE PAGO extraída del texto completo');
    return seccion[0];
  }

  console.log('📄 No se encontró FORMATO DE PAGO, usando texto completo');
  return texto;
}

/**
 * Extrae información de póliza de HDI Autos
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🏢 EXTRACTOR HDI AUTOS - INICIANDO                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const { textoCompleto, textoPagina1, textoPagina2, todasLasPaginas } = ctx;
  const textoTotal = textoCompleto || (textoPagina1 + '\n' + (textoPagina2 || ''));

  // Buscar la página FORMATO DE PAGO (última hoja, tiene casi todos los datos)
  const txtPago = encontrarPaginaFormatoPago(ctx);
  
  // Texto de la póliza SIN la página FORMATO DE PAGO (para montos anuales)
  const txtPoliza = textoTotal.replace(txtPago, '').trim();

  // DEBUG: Mostrar textos para análisis
  console.log('📄 ========== TEXTO FORMATO DE PAGO HDI ==========');
  console.log(txtPago);
  console.log('📄 ==================================================');
  console.log('📄 ========== TEXTO COMPLETO HDI ==========');
  console.log(textoTotal);
  console.log('📄 ==================================================');

  const compania = 'HDI';

  // ==================== RFC ====================
  // En FORMATO DE PAGO: RFC aparece como línea suelta "AAHU000521F86" 
  // debajo del nombre y arriba de la dirección
  // También puede aparecer como "RFC: AAHU000521F86" en la página 1
  let rfc = '';

  // Patrón 1: "RFC: XXXX" (página 1 de póliza)
  let rfcMatch = textoTotal.match(/RFC[:\s]+([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3})/i);
  if (rfcMatch) {
    rfc = rfcMatch[1].toUpperCase();
  }

  // Patrón 2: línea suelta con formato RFC (en FORMATO DE PAGO)
  if (!rfc) {
    rfcMatch = txtPago.match(/^([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3})\s*$/im);
    if (rfcMatch) {
      rfc = rfcMatch[1].toUpperCase();
    }
  }

  // Patrón 3: Buscar RFC después del nombre (en la misma línea o siguiente)
  if (!rfc) {
    rfcMatch = textoTotal.match(/\b([A-Z&Ñ]{4}\d{6}[A-Z0-9]{3})\b/);
    if (!rfcMatch) rfcMatch = textoTotal.match(/\b([A-Z&Ñ]{3}\d{6}[A-Z0-9]{3})\b/);
    if (rfcMatch) rfc = rfcMatch[1].toUpperCase();
  }

  const tipo_persona = rfc.length === 12 ? 'Moral' : 'Fisica';
  console.log('🔍 RFC extraído:', rfc || '❌ NO ENCONTRADO', '- Tipo:', tipo_persona);

  // ==================== ASEGURADO ====================
  // En FORMATO DE PAGO: nombre aparece en línea suelta después de "Ramo: AUTOS..."
  // Ejemplo:
  //   Ramo: AUTOS RESIDENTES
  //   ULISES ALVAREZ HERNANDEZ
  //   AAHU000521F86
  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';

  // Estrategia 1: Línea después de "Ramo:" y antes del RFC
  let nombreMatch = txtPago.match(/Ramo:\s*[A-ZÁÉÍÓÚÑ\s]+?\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s*\n/i);

  // Estrategia 2: En página 1, nombre aparece en línea suelta antes del RFC
  if (!nombreMatch) {
    nombreMatch = textoTotal.match(/l[ií]mite\s+de\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)\s*(?:\n|RFC)/i);
  }

  // Estrategia 3: Buscar nombre en página 1 entre el bloque introductorio y RFC
  if (!nombreMatch) {
    nombreMatch = textoTotal.match(/(?:figuran\s+con\s+l[ií]mite\s+de|que\s+figuran\s+con)\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{5,40}?)(?=\s*(?:RFC|EROS|[A-Z]{3,4}\d{6}))/i);
  }

  // Estrategia 4: "Contratante:" o "Asegurado:"
  if (!nombreMatch) {
    nombreMatch = textoTotal.match(/(?:Contratante|Asegurado)[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:RFC|\n))/i);
  }

  if (nombreMatch) {
    const nombreCompleto = nombreMatch[1].trim();
    console.log('👤 Nombre HDI encontrado:', nombreCompleto);

    if (tipo_persona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      const palabras = nombreCompleto.split(/\s+/).filter(p => p.length > 1);

      if (palabras.length >= 3) {
        // HDI formato: NOMBRE APELLIDO_PATERNO APELLIDO_MATERNO
        nombre = palabras[0];
        apellido_paterno = palabras[1];
        apellido_materno = palabras.slice(2).join(' ');
      } else if (palabras.length === 2) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
      } else {
        nombre = nombreCompleto;
      }
      console.log('👤 Persona Física:', { nombre, apellido_paterno, apellido_materno });
    }
  } else {
    console.warn('⚠️ Nombre NO encontrado en PDF HDI');
  }

  // ==================== DIRECCIÓN Y TELÉFONO ====================
  // En FORMATO DE PAGO la dirección aparece debajo del RFC, todo junto:
  //   EROS No. Ext. 233 LA ERMITA C.P.:37358, LEON,
  //   GUANAJUATO TEL.: 3333000000
  // O en página 1:
  //   EROS No. Ext. 233 LA ERMITA, C.P 37358 Tel: 3333000000 LEÓN, GUANAJUATO
  let domicilio = '';
  let municipio = '';
  let estado = '';
  let colonia = '';
  let codigo_postal = '';
  let telefono_movil = '';
  const pais = 'MEXICO';

  // Extraer C.P. (puede ser "C.P.:37358" o "C.P 37358" o "C.P.: 37358")
  const cpMatch = textoTotal.match(/C\.?\s*P\.?\s*[:\.]?\s*(\d{5})/i);
  if (cpMatch) codigo_postal = cpMatch[1];

  // Extraer teléfono: "Tel: 3333000000" o "TEL.: 3333000000"
  const telMatch = textoTotal.match(/TEL[\.:]?\s*[:.]?\s*(\d{7,10})/i);
  if (telMatch) telefono_movil = telMatch[1];

  // Extraer dirección de FORMATO DE PAGO (líneas después del RFC, antes de PÓLIZA)
  // El RFC ya lo tenemos, buscar lo que hay entre RFC y "PÓLIZA"
  // NOTA: pdf.js mezcla columnas, así que debemos filtrar líneas que NO son dirección
  const patronesNoDir = /(?:Serie|Marca|Modelo|Paquete|M[oó]dulo|N[uú]mero\s+de\s+control|Recibo|Frecuencia|Forma\s+de\s+pago|Parcialidad|Prima|Agente|Cliente|Ramo|FORMATO|Vigencia|Condiciones|CGHAP|Versi[oó]n)[:\s]/i;

  const bloqueDir = txtPago.match(new RegExp(
    (rfc ? rfc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[A-Z]{3,4}\\d{6}[A-Z0-9]{2,3}') +
    '\\s*\\n([\\s\\S]+?)(?=P[OÓ]LIZA|Frecuencia|Marca|Serie|Paquete|M[oó]dulo)', 'i'
  ));

  if (bloqueDir) {
    // Filtrar líneas: solo quedarnos con las que parecen dirección
    const lineasDir = bloqueDir[1].split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3)
      .filter(l => !patronesNoDir.test(l))  // Excluir datos de vehículo/póliza
      .filter(l => !/^\d{4}$/.test(l))      // Excluir años sueltos
      .filter(l => !/^[A-Z0-9]{17}$/.test(l)); // Excluir VINs sueltos

    const dirCompleta = lineasDir.join(', ').replace(/,\s*,/g, ',');
    console.log('📍 Bloque dirección filtrado:', dirCompleta);

    // Extraer ciudad/municipio y estado de la dirección
    // Formato: "...LEON, GUANAJUATO TEL.:..."
    // Intentar varios patrones de ciudad, estado
    const ciudadEstadoMatch = 
      dirCompleta.match(/([A-ZÁÉÍÓÚÑ]{3,})\s*[,.]\s*\n?\s*([A-ZÁÉÍÓÚÑ]{4,})\s*(?:TEL|$)/i)
      || dirCompleta.match(/,\s*([A-ZÁÉÍÓÚÑ]{3,})\s*[,.]?\s*([A-ZÁÉÍÓÚÑ]{4,})\s*(?:TEL|$)/i);

    if (ciudadEstadoMatch) {
      municipio = ciudadEstadoMatch[1].trim();
      estado = ciudadEstadoMatch[2].trim();
    }

    // Domicilio: limpiar ciudad, estado y teléfono
    domicilio = dirCompleta
      .replace(/TEL[\.:]?\s*[:.]?\s*\d+/i, '')
      .replace(new RegExp(municipio ? `${municipio}\\s*,?\\s*${estado || ''}` : '$^', 'i'), '')
      .replace(/C\.?\s*P\.?\s*[:\.]?\s*\d{5}/i, '')
      .replace(/,\s*$/, '')
      .replace(/,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Fallback: buscar línea con C.P. en texto, excluyendo datos de vehículo
  if (!domicilio) {
    const dirPag1 = textoTotal.match(/([A-ZÁÉÍÓÚÑ0-9][A-Za-záéíóúñÁÉÍÓÚÑ0-9\s,\.#]+?)\s*C\.?\s*P\.?\s*[:\.]?\s*\d{5}/i);
    if (dirPag1 && !patronesNoDir.test(dirPag1[1])) {
      domicilio = dirPag1[1].trim();
    }
  }

  // Extraer colonia: buscar patrón "NOMBRE_COL" antes de C.P.
  // Ejemplo: "LA ERMITA C.P.:37358" → colonia = LA ERMITA
  if (!colonia) {
    const coloniaMatch = textoTotal.match(/(?:No\.?\s*(?:Ext|Int)\.?\s*\d+\s+)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,20})\s*(?:C\.?\s*P|,)/i)
      || txtPago.match(/(?:No\.?\s*(?:Ext|Int)\.?\s*\d+\s+)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,20})\s*(?:C\.?\s*P|,)/i);
    if (coloniaMatch) {
      colonia = coloniaMatch[1].trim();
      // Quitar la colonia del domicilio para evitar duplicado en el preview (domicilio + colonia)
      if (colonia && domicilio) {
        domicilio = domicilio
          .replace(new RegExp(',?\\s*' + colonia.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*,?', 'i'), ',')
          .replace(/,\s*$/, '')
          .replace(/^,\s*/, '')
          .replace(/,\s*,/g, ',')
          .trim();
      }
    }
  }

  // Fallback municipio: buscar ciudades conocidas PRIMERO en bloque dirección, luego en texto completo
  if (!municipio) {
    const patronMunicipio = /(?:ZAPOPAN|TLAQUEPAQUE|TONALA|TLAJOMULCO|EL\s+SALTO|LE[OÓ]N|LEON|GUADALAJARA|MONTERREY|M[EÉ]XICO|PUEBLA|QUER[EÉ]TARO|TIJUANA|CANCUN|MERIDA|CELAYA|IRAPUATO|SALAMANCA|AGUASCALIENTES|SAN\s+LUIS\s+POTOS[IÍ]|MORELIA|TOLUCA|NAUCALPAN|ECATEPEC|NEZAHUALCOYOTL|CUAUTITLAN)/i;
    const munMatch = (domicilio && domicilio.match(patronMunicipio)) || textoTotal.match(patronMunicipio);
    if (munMatch) municipio = munMatch[0].toUpperCase();
  }
  if (!estado) {
    const patronEstado = /(?:GUANAJUATO|JALISCO|NUEVO\s+LE[OÓ]N|ESTADO\s+DE\s+M[EÉ]XICO|CDMX|CIUDAD\s+DE\s+M[EÉ]XICO|PUEBLA|QUER[EÉ]TARO|BAJA\s+CALIFORNIA|QUINTANA\s+ROO|YUCAT[AÁ]N|CHIHUAHUA|SONORA|COAHUILA|TAMAULIPAS|MICHOACAN|MICHOAC[AÁ]N|TABASCO|VERACRUZ|OAXACA|CHIAPAS|GUERRERO|HIDALGO|TLAXCALA|MORELOS|NAYARIT|COLIMA|DURANGO|ZACATECAS|SAN\s+LUIS\s+POTOS[IÍ]|SINALOA|CAMPECHE|AGUASCALIENTES)/i;
    const edoMatch = (domicilio && domicilio.match(patronEstado)) || textoTotal.match(patronEstado);
    if (edoMatch) estado = edoMatch[0].toUpperCase();
  }

  console.log('📍 Ubicación:', { domicilio, colonia, municipio, estado, codigo_postal, telefono_movil });

  // ==================== NÚMERO DE PÓLIZA ====================
  // Formato FORMATO DE PAGO: "PÓLIZA INDIVIDUAL: 5-508523 Cert. 1"
  // Formato página 1: "Póliza: 5-508523-1"
  let numero_poliza = '';
  let endoso = '';
  let inciso = '';

  // Patrón 1: "PÓLIZA INDIVIDUAL: 5-508523 Cert. 1"
  const polizaCertMatch = txtPago.match(/P[OÓ]LIZA\s+(?:INDIVIDUAL|FLOTILLA)[:\s]+([A-Z0-9\-]+)\s+Cert\.?\s*(\d+)/i);
  if (polizaCertMatch) {
    numero_poliza = polizaCertMatch[1].trim() + '-' + polizaCertMatch[2];
    inciso = polizaCertMatch[2];
  }

  // Patrón 2: "Póliza: 5-508523-1"
  if (!numero_poliza) {
    const polizaMatch = textoTotal.match(/P[oó]liza[:\s]+([0-9][A-Z0-9\-]+)/i);
    if (polizaMatch) {
      numero_poliza = polizaMatch[1].trim();
      // Extraer inciso del sufijo si tiene formato X-NNNNNN-N
      const incisoSufijo = numero_poliza.match(/-(\d+)$/);
      if (incisoSufijo && !inciso) inciso = incisoSufijo[1];
    }
  }

  // Endoso
  const endosoMatch = textoTotal.match(/Endoso[:\s]+(\d+)/i);
  if (endosoMatch) endoso = endosoMatch[1];

  // Folio
  const folioMatch = textoTotal.match(/Folio[:\s]+(\d+)/i);

  console.log('📋 Póliza:', numero_poliza, 'Endoso:', endoso, 'Inciso:', inciso);

  // ==================== AGENTE ====================
  // Formato: "Agente: 053353 RITA DINGLER CHAIRES"
  let agente = '';
  let clave_agente = '';

  const agenteMatch = textoTotal.match(/Agente[:\s]+(\d{3,})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Tarifa|Vigencia|Desde|P[oó]liza|Ramo|\n|$))/i)
    || txtPago.match(/Agente[:\s]+(\d{3,})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Tarifa|Vigencia|Desde|P[oó]liza|Ramo|\n|$))/i);

  if (agenteMatch) {
    clave_agente = agenteMatch[1];
    agente = agenteMatch[2].trim();
  }

  console.log('🧑‍💼 Agente:', clave_agente, agente);

  // ==================== VIGENCIA ====================
  // PRIORIDAD: Página 1 de la póliza tiene la vigencia ANUAL real
  // FORMATO DE PAGO puede tener la vigencia del RECIBO (semestral/trimestral)
  let inicio_vigencia = '';
  let termino_vigencia = '';

  // Patrón 1 (PRIORIDAD): "Desde las 12:00 hrs. del DD/MM/YYYY Hasta ... del DD/MM/YYYY" (página 1)
  const desdeMatch = txtPoliza.match(/Desde\s+las?\s+\d{1,2}:\d{2}\s+hrs\.?\s+del\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
  const hastaMatch = txtPoliza.match(/Hasta\s+(?:las?\s+)?\d{1,2}:\d{2}\s+hrs\.?\s+del\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
  if (desdeMatch) inicio_vigencia = normalizarFecha(desdeMatch[1]);
  if (hastaMatch) termino_vigencia = normalizarFecha(hastaMatch[1]);

  // Patrón 2: Vigencia + dos fechas DD/Mmm/YYYY en FORMATO DE PAGO (fallback)
  if (!inicio_vigencia) {
    const vigenciaAbrev = txtPago.match(/Vigencia[\s\S]*?(\d{1,2}\/[A-Za-z]{3,}\/\d{4})\s+(\d{1,2}\/[A-Za-z]{3,}\/\d{4})/i);
    if (vigenciaAbrev) {
      inicio_vigencia = normalizarFecha(vigenciaAbrev[1]);
      termino_vigencia = normalizarFecha(vigenciaAbrev[2]);
    }
  }

  // Patrón 3: Fechas DD/MM/YYYY simples en FORMATO DE PAGO (último fallback)
  if (!inicio_vigencia) {
    const fechasNum = txtPago.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
    if (fechasNum) {
      inicio_vigencia = normalizarFecha(fechasNum[1]);
      termino_vigencia = normalizarFecha(fechasNum[2]);
    }
  }

  console.log('📅 Vigencia:', inicio_vigencia, '-', termino_vigencia);

  // ==================== FECHA DE EMISIÓN ====================
  let fecha_emision = '';
  const emisionMatch = textoTotal.match(/(?:Fecha\s+(?:de\s+)?Emisi[oó]n|Emitida?\s+el?)[:\s]+(\d{1,2}[\/-]\w+[\/-]\d{4})/i);
  if (emisionMatch) {
    fecha_emision = normalizarFecha(emisionMatch[1]);
  }
  if (!fecha_emision) {
    fecha_emision = inicio_vigencia || new Date().toISOString().split('T')[0];
  }

  // ==================== VEHÍCULO ====================
  // Formato FORMATO DE PAGO:
  //   Marca:    NISSAN SENTRA
  //   Modelo:   2017
  //   Serie:    3N1AB7ADXHL701834
  //   Paquete:  HDI EN MI AUTO
  // Formato página 1:
  //   NISSAN, SENTRA 2017 Clave: SEDNI034022-2017
  //   Version: ADVANCE L4 1.8L 129 CP 4 PUERTAS STD BA AA
  //   Serie: 3N1AB7ADXHL701834  Cilindros: 4  Servicio: PARTICULAR
  let marca = '';
  let modelo = '';
  let anio = '';
  let numero_serie = '';
  let motor = '';
  let placas = '';
  let color = '';
  let tipo_vehiculo = '';

  // Marca - FORMATO DE PAGO: "Marca: NISSAN SENTRA" (incluye marca + submarca)
  const marcaPagoMatch = txtPago.match(/Marca[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-]+)/i);
  if (marcaPagoMatch) {
    const marcaCompleta = marcaPagoMatch[1].trim();
    const partesMarca = marcaCompleta.split(/\s+/);
    marca = partesMarca[0]; // NISSAN
    if (partesMarca.length > 1) {
      modelo = partesMarca.slice(1).join(' '); // SENTRA
    }
  }

  // Fallback marca: página 1 "NISSAN, SENTRA 2017"
  if (!marca) {
    const marcaPag1 = textoTotal.match(/([A-ZÁÉÍÓÚÑ]+)\s*,\s*([A-ZÁÉÍÓÚÑ0-9\s\-]+?)\s+(\d{4})\s+Clave/i);
    if (marcaPag1) {
      marca = marcaPag1[1].trim();
      modelo = marcaPag1[2].trim();
      anio = marcaPag1[3];
    }
  }

  // Modelo (año) - "Modelo: 2017"
  const modeloAnioMatch = txtPago.match(/Modelo[:\s]+(\d{4})/i);
  if (modeloAnioMatch) {
    anio = modeloAnioMatch[1];
  }
  // Si "Modelo:" tiene nombre, usarlo
  if (!modelo) {
    const modeloTextoMatch = txtPago.match(/Modelo[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-]+)/i);
    if (modeloTextoMatch) modelo = modeloTextoMatch[1].trim();
  }

  // Serie/VIN - "Serie: 3N1AB7ADXHL701834"
  const serieMatch = textoTotal.match(/Serie[:\s]+([A-Z0-9]{17})/i)
    || txtPago.match(/Serie[:\s]+([A-Z0-9]{17})/i);
  if (serieMatch) numero_serie = serieMatch[1].toUpperCase();

  // Fallback VIN: buscar cualquier secuencia de 17 alfanuméricos
  if (!numero_serie) {
    const vinFallback = textoTotal.match(/\b((?:[A-Z0-9]){17})\b/);
    if (vinFallback && /[A-Z]/.test(vinFallback[1]) && /\d/.test(vinFallback[1])) {
      numero_serie = vinFallback[1].toUpperCase();
    }
  }

  // Motor: "Núm. de Motor: MRA8170049J"
  const motorMatch = textoTotal.match(/(?:N[uú]m\.?\s*(?:de\s+)?Motor|Motor)[:\s]+([A-Z0-9\-]{3,})/i);
  if (motorMatch) motor = motorMatch[1];

  // Placas
  const placasMatch = textoTotal.match(/Placas?[:\s]+([A-Z0-9\-]{3,10})/i);
  if (placasMatch) {
    const posiblePlaca = placasMatch[1].toUpperCase();
    const esInvalida = /^(VIGENCIA|AMPARADA|NA|N\/A|SIN|NINGUNA|TEMPORAL|PENDIENTE|NUEVO|NUEVA|\d+)$/i.test(posiblePlaca);
    if (!esInvalida && posiblePlaca.length >= 3) {
      placas = posiblePlaca;
    }
  }

  // Color
  const colorMatch = textoTotal.match(/Color[:\s]+([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)/i);
  if (colorMatch) color = colorMatch[1].trim();

  // Transmisión (HDI lo incluye): "Transmisión: MANUAL"
  const transmisionMatch = textoTotal.match(/Transmisi[oó]n[:\s]+([A-ZÁÉÍÓÚÑ]+)/i);

  // Puertas
  const puertasMatch = textoTotal.match(/Puertas[:\s]+(\d+)/i);

  console.log('🚗 Vehículo:', { marca, modelo, anio, numero_serie, placas, color, motor });

  // ==================== USO / SERVICIO ====================
  // Página 1: "Uso: AUTOMÓVILES RESIDENTES  Servicio: PARTICULAR"
  const uso = extraerDato(/Uso[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Servicio|Aire|Ocupantes|Transmisi|\n))/i, textoTotal);
  const servicio = extraerDato(/Servicio[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoTotal);
  const movimiento = extraerDato(/(?:Movimiento|Documento)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i, textoTotal);

  // ==================== FORMA DE PAGO ====================
  // "Frecuencia de pago de póliza: ANUAL"
  // "Forma de pago: PARCIALIDAD 1 de 1"
  let forma_pago = '';
  let tipo_pago = '';
  let frecuenciaPago = '';
  let primer_pago = '';
  let pagos_subsecuentes = '';

  // Frecuencia de la póliza
  const frecMatch = txtPago.match(/Frecuencia\s+de\s+pago\s+de\s+p[oó]liza[:\s]+([A-ZÁÉÍÓÚÑ]+)/i)
    || textoTotal.match(/Frecuencia\s+de\s+pago[:\s]+([A-ZÁÉÍÓÚÑ]+)/i);
  if (frecMatch) {
    forma_pago = frecMatch[1].trim().toUpperCase();
  }

  // Fallback: "Forma de Pago:"
  if (!forma_pago) {
    const fpMatch = textoTotal.match(/Forma\s+de\s+(?:Pago|pago)[:\s]+([A-ZÁÉÍÓÚÑ]+)/i);
    if (fpMatch) forma_pago = fpMatch[1].trim().toUpperCase();
  }

  // Detectar tipo y frecuencia
  if (forma_pago) {
    const f = forma_pago.toLowerCase();
    if (f.includes('tri')) {
      tipo_pago = 'Fraccionado'; frecuenciaPago = 'Trimestral';
    } else if (f.includes('men')) {
      tipo_pago = 'Fraccionado'; frecuenciaPago = 'Mensual';
    } else if (f.includes('sem')) {
      tipo_pago = 'Fraccionado'; frecuenciaPago = 'Semestral';
    } else if (f.includes('bim')) {
      tipo_pago = 'Fraccionado'; frecuenciaPago = 'Bimestral';
    } else if (f.includes('cuat')) {
      tipo_pago = 'Fraccionado'; frecuenciaPago = 'Cuatrimestral';
    } else if (f.includes('anu') || f.includes('contado')) {
      tipo_pago = 'Anual'; frecuenciaPago = 'Anual';
    } else {
      tipo_pago = 'Anual'; frecuenciaPago = 'Anual';
    }
  }

  // Primer pago / Pagos subsecuentes
  // HDI tiene tabla de recibos:
  //   Recibo | Vigencia del Recibo desde las 12:00 hrs. del | Importe | Páguese antes de
  //     1      06-ene.-2026 al 06-abr.-2026                   2,584.40   05-feb.-2026
  //     2      06-abr.-2026 al 06-jul.-2026                   1,743.40   21-abr.-2026
  // El primer recibo tiene el monto mayor (incluye gastos); los subsecuentes son menores
  
  // Extraer TODOS los recibos de la tabla
  const recibosExtraidos = [];
  
  // Patrón: número de recibo + fechas + importe + fecha páguese
  // Formato: "1  06-ene.-2026 al 06-abr.-2026  2,584.40  05-feb.-2026"
  const regexRecibo = /(\d+)\s+(\d{1,2}[-\/][a-záéíóúñ]{3,}\.?[-\/]\d{4})\s+al?\s+(\d{1,2}[-\/][a-záéíóúñ]{3,}\.?[-\/]\d{4})\s+([\d,]+\.\d{2})\s+(\d{1,2}[-\/][a-záéíóúñ]{3,}\.?[-\/]\d{4})/gi;
  
  let matchRecibo;
  while ((matchRecibo = regexRecibo.exec(textoTotal)) !== null) {
    recibosExtraidos.push({
      numero: parseInt(matchRecibo[1]),
      vigencia_desde: normalizarFecha(matchRecibo[2]),
      vigencia_hasta: normalizarFecha(matchRecibo[3]),
      importe: matchRecibo[4].replace(/,/g, ''),
      fecha_limite: normalizarFecha(matchRecibo[5])
    });
  }
  
  // Intentar también con formato numérico DD/MM/YYYY
  if (recibosExtraidos.length === 0) {
    const regexReciboNum = /(\d+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+al?\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+([\d,]+\.\d{2})\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/gi;
    while ((matchRecibo = regexReciboNum.exec(textoTotal)) !== null) {
      recibosExtraidos.push({
        numero: parseInt(matchRecibo[1]),
        vigencia_desde: normalizarFecha(matchRecibo[2]),
        vigencia_hasta: normalizarFecha(matchRecibo[3]),
        importe: matchRecibo[4].replace(/,/g, ''),
        fecha_limite: normalizarFecha(matchRecibo[5])
      });
    }
  }
  
  console.log('🧾 Recibos HDI extraídos:', recibosExtraidos);
  
  if (recibosExtraidos.length > 0) {
    // Primer pago = importe del recibo 1
    primer_pago = recibosExtraidos[0].importe;
    
    // Pagos subsecuentes = importe del recibo 2 (o mismos si solo hay 1)
    if (recibosExtraidos.length > 1) {
      pagos_subsecuentes = recibosExtraidos[1].importe;
    } else {
      pagos_subsecuentes = recibosExtraidos[0].importe;
    }
  } else {
    // Fallback: buscar "Primer Recibo" / "Pagos Subsecuentes" como texto
    const primerPagoMatch = textoTotal.match(/(?:Primer\s+(?:Recibo|Pago))[:\s]+\$?\s*([\d,]+\.?\d*)/i);
    if (primerPagoMatch) primer_pago = primerPagoMatch[1].replace(/,/g, '');

    const pagosSubMatch = textoTotal.match(/(?:Pago\(?s?\)?\s*Subsecuente\(?s?\)?|Recibos?\s+Subsecuente\(?s?\)?)[:\s]+\$?\s*([\d,]+\.?\d*)/i);
    if (pagosSubMatch) pagos_subsecuentes = pagosSubMatch[1].replace(/,/g, '');
  }
  
  console.log('💳 Primer pago:', primer_pago, '| Subsecuentes:', pagos_subsecuentes);

  // ==================== PERIODO DE GRACIA ====================
  // HDI tiene 30 días de periodo de gracia
  let periodo_gracia = '30';
  const plazoMatch = textoTotal.match(/(?:Plazo\s+(?:de\s+)?pago|Per[ií]odo\s+(?:de\s+)?gracia)[:\s]+(\d+)\s*d[ií]as/i);
  if (plazoMatch) periodo_gracia = plazoMatch[1];

  // ==================== FECHA LÍMITE DE PAGO (Páguese antes de) ====================
  // Priorizar la fecha del primer recibo extraído de la tabla
  let fecha_vencimiento_pago = '';
  
  if (recibosExtraidos.length > 0) {
    fecha_vencimiento_pago = recibosExtraidos[0].fecha_limite;
    console.log('📅 Fecha límite de pago (del recibo 1):', fecha_vencimiento_pago);
  }
  
  // Fallback: "Páguese antes de" como texto suelto
  if (!fecha_vencimiento_pago) {
    const paguese = textoTotal.match(/P[aá]guese\s+antes\s+de[:\s]*(\d{1,2}[-\/][a-záéíóú]{3,}\.?[-\/]\d{4})/i)
      || txtPago.match(/P[aá]guese\s+antes\s+de[:\s]*(\d{1,2}[-\/][a-záéíóú]{3,}\.?[-\/]\d{4})/i);
    if (paguese) {
      fecha_vencimiento_pago = normalizarFecha(paguese[1]);
    }
  }
  
  if (!fecha_vencimiento_pago) {
    const pagueseNum = textoTotal.match(/P[aá]guese\s+antes\s+de[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i)
      || txtPago.match(/P[aá]guese\s+antes\s+de[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
    if (pagueseNum) {
      fecha_vencimiento_pago = normalizarFecha(pagueseNum[1]);
    }
  }

  console.log('📅 Fecha límite de pago (Páguese antes de):', fecha_vencimiento_pago || '❌ NO ENCONTRADA');

  // ==================== MONTOS ====================
  // FORMATO DE PAGO tiene tabla con columnas "Descripción" e "Importe":
  //   Prima Neta                 6,326.72
  //   Prima de Módulos           0.00
  //   Recargo Por Pago Fraccionado 0.00
  //   Derecho de Póliza          725.00
  //   I.V.A. 16.00%            1,128.28
  //   Total a pagar            8,180.00
  // NOTA: pdf.js puede mezclar columnas, así que buscamos en AMBOS textos
  // y usamos patrones flexibles con [\s\S] para saltos de línea

  // Helper: buscar monto asociado a un label en el texto
  // IMPORTANTE: usar [^\n] en vez de \s para no cruzar líneas y matchear montos de otra fila
  function buscarMonto(label, texto) {
    // 1. Misma línea: label ... monto (sin cruzar newlines)
    const regexMismaLinea = new RegExp(label + '[^\\n\\d]*?(\\d[\\d,]*\\.\\d{2})', 'im');
    const m1 = texto.match(regexMismaLinea);
    if (m1) return m1[1];
    
    // 2. Siguiente línea: label al final de línea, monto al inicio de la siguiente
    const regexSigLinea = new RegExp(label + '[^\\n]*\\n[^\\S\\n]*(\\d[\\d,]*\\.\\d{2})', 'im');
    const m2 = texto.match(regexSigLinea);
    if (m2) return m2[1];
    
    return '';
  }

  // ==================== MONTOS FINANCIEROS ====================
  // PRIORIDAD 1: Tabla "Condiciones Particulares" en página 1 de HDI
  // El desglose tiene 8 columnas cuyos valores aparecen en UNA sola línea:
  // Prima Neta | Descuento | Prima Módulos | Recargo Fraccionado | Reducción | Derecho Póliza | IVA | Total
  // Ej: "18,201.99 -8,442.49   0.00 525.06 0.00 725.00 1,761.53   12,771.09"
  let prima_neta = '';
  let otros_servicios = '';
  let cargo_pago_fraccionado = '';
  let gastos_expedicion = '';
  let iva = '';
  let total = '';

  const tablaMontos = txtPoliza.match(
    /^\s*(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s+(-?\d[\d,]*\.\d{2})\s*$/m
  );

  if (tablaMontos) {
    const toNum = (s) => parseFloat(String(s).replace(/,/g, ''));
    const primaBruta = toNum(tablaMontos[1]);
    const descuento = Math.abs(toNum(tablaMontos[2]));
    prima_neta = descuento > 0 ? (primaBruta - descuento).toFixed(2) : primaBruta.toFixed(2);
    otros_servicios = descuento > 0 ? descuento.toFixed(2) : '';
    cargo_pago_fraccionado = limpiarMonto(tablaMontos[4]);
    gastos_expedicion = limpiarMonto(tablaMontos[6]);
    iva = limpiarMonto(tablaMontos[7]);
    total = limpiarMonto(tablaMontos[8]);
    console.log('💰 Montos de tabla Condiciones Particulares (pág 1):', {
      primaBruta, descuento, prima_neta, cargo_pago_fraccionado, gastos_expedicion, iva, total
    });
  }

  // PRIORIDAD 2: buscarMonto individual (FORMATO DE PAGO u otras páginas)
  if (!prima_neta) {
    prima_neta = limpiarMonto(buscarMonto('Prima\\s+Neta', txtPoliza))
      || limpiarMonto(buscarMonto('Prima\\s+Neta', txtPago));
  }

  if (!cargo_pago_fraccionado) {
    cargo_pago_fraccionado = limpiarMonto(buscarMonto('(?:Recargo|Cargo)\\s+(?:por\\s+)?(?:Pago\\s+)?Fraccionado', txtPoliza))
      || limpiarMonto(buscarMonto('Recargo', txtPoliza))
      || limpiarMonto(buscarMonto('Recargo\\s+(?:Por|por)\\s+Pago\\s+Fraccionado', txtPago));
  }

  if (!gastos_expedicion) {
    gastos_expedicion = limpiarMonto(buscarMonto('Derecho\\s+de\\s+P[oó]liza', txtPoliza))
      || limpiarMonto(buscarMonto('Gastos\\s+(?:de\\s+|por\\s+)?Expedici[oó]n', txtPoliza))
      || limpiarMonto(buscarMonto('Derecho\\s+de\\s+P[oó]liza', txtPago))
      || limpiarMonto(buscarMonto('Gastos\\s+(?:de\\s+|por\\s+)?Expedici[oó]n', txtPago));
  }

  if (!iva) {
    const ivaMatch = txtPoliza.match(/I\.?\s*V\.?\s*A\.?\s*(?:\d+[\.,]?\d*\s*%?\s*)?[\s\n]*\$?\s*([\d,]+\.\d{2})/i)
      || txtPago.match(/I\.?\s*V\.?\s*A\.?\s*(?:\d+[\.,]?\d*\s*%?\s*)?[\s\n]*\$?\s*([\d,]+\.\d{2})/i);
    if (ivaMatch) iva = limpiarMonto(ivaMatch[1]);
  }

  if (!total) {
    total = limpiarMonto(buscarMonto('Total\\s+a\\s+pagar', txtPoliza))
      || limpiarMonto(buscarMonto('(?:Total|Importe\\s+Total|Prima\\s+Total)', txtPoliza))
      || limpiarMonto(buscarMonto('Total\\s+a\\s+pagar', txtPago));
  }

  const subtotal = limpiarMonto(extraerDato(/(?:Sub\s*total|Subtotal)[:\s]+\$?\s*([\d,]+\.?\d*)/i, textoTotal));

  // Fallback: Si montos vinieron del FORMATO DE PAGO (primer recibo) y hay múltiples recibos,
  // recalcular para obtener montos anuales
  if (recibosExtraidos.length > 1 && !tablaMontos) {
    const totalRecibos = recibosExtraidos.reduce((sum, r) => sum + parseFloat(r.importe), 0);
    const primerReciboTotal = parseFloat(recibosExtraidos[0].importe);

    if (totalRecibos > 0 && primerReciboTotal > 0) {
      const totalActual = parseFloat(total) || 0;

      // Detectar si total actual ≈ primer recibo (vino de FORMATO DE PAGO)
      if (Math.abs(totalActual - primerReciboTotal) < 1) {
        const factor = totalRecibos / primerReciboTotal;
        if (prima_neta) prima_neta = (parseFloat(prima_neta) * factor).toFixed(2);
        if (cargo_pago_fraccionado) cargo_pago_fraccionado = (parseFloat(cargo_pago_fraccionado) * factor).toFixed(2);
        if (iva) iva = (parseFloat(iva) * factor).toFixed(2);
        console.log('💰 Montos recalculados para póliza anual (factor:', factor.toFixed(2), ')');
      }

      total = totalRecibos.toFixed(2);
      console.log('💰 Total recalculado desde recibos:', total, '(suma de', recibosExtraidos.length, 'recibos)');
    }
  }

  console.log('💰 Montos extraídos:', { prima_neta, otros_servicios, gastos_expedicion, iva, total, cargo_pago_fraccionado });

  // ==================== PLAN / PAQUETE ====================
  // "Paquete: HDI EN MI AUTO"
  let plan = '';
  let tipo_cobertura = '';

  const paqueteMatch = txtPago.match(/Paquete[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:M[oó]dulo|Agente|\n))/i)
    || textoTotal.match(/Paquete[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*\n)/i);
  if (paqueteMatch) {
    plan = paqueteMatch[1].trim();
  }

  // Fallback: buscar plan o versión
  if (!plan) {
    const planMatch = textoTotal.match(/(?:Plan|Versi[oó]n)[:\s]+([A-ZÁÉÍÓÚÑ0-9\s\-\.]+?)(?=\s*(?:\n|Transmisi|Puertas))/i);
    if (planMatch) plan = planMatch[1].trim();
  }

  // Condiciones generales: "Versión: CGHAP0925"
  const versionMatch = textoTotal.match(/Versi[oó]n[:\s]+([A-Z0-9]+)/i);

  // Detectar tipo de cobertura
  if (/amplia/i.test(plan) || /amplia/i.test(textoTotal)) {
    tipo_cobertura = 'Amplia';
  } else if (/limitada/i.test(plan) || /limitada/i.test(textoTotal)) {
    tipo_cobertura = 'Limitada';
  } else if (/responsabilidad\s+civil/i.test(plan) || /\bRC\b/.test(plan)) {
    tipo_cobertura = 'RC (Responsabilidad Civil)';
  }

  // ==================== CÓDIGO CLIENTE HDI ====================
  // "CLIENTE: 08199016"
  const codigo_cliente = extraerDato(/CLIENTE[:\s]+(\d+)/i, textoTotal)
    || extraerDato(/CLIENTE[:\s]+(\d+)/i, txtPago);

  // ==================== EMAIL ====================
  const email = extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoTotal);

  // ==================== CURP ====================
  const curp = extraerDato(/C\.?\s*U\.?\s*R\.?\s*P\.?\s*[:\s]+([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2})/i, textoTotal);

  // ==================== COBERTURAS ====================
  // Las coberturas están en las páginas interiores de la póliza, no en FORMATO DE PAGO
  let coberturas = [];

  const seccionCoberturas = textoTotal.match(/(?:COBERTURAS?\s+CONTRATADAS?|COBERTURAS?\s+Y\s+SUMAS?\s+ASEGURADAS?|DETALLE\s+DE\s+COBERTURAS?|Suma\s+Asegurada\s+Deducible\s+Prima)([\s\S]*?)(?=(?:CONDICIONES|EXCLUSIONES|Forma\s+de\s+Pago|FORMATO\s+DE\s+PAGO|ENDOSOS?|CL[AÁ]USULAS?|Aviso\s+de\s+Privacidad|$))/i);

  if (seccionCoberturas) {
    const textoCobertura = seccionCoberturas[1];
    const lineas = textoCobertura.split('\n').filter(l => l.trim().length > 5);

    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      if (!lineaLimpia || /^[-=]+$/.test(lineaLimpia)) continue;
      // Ignorar líneas que son headers o texto genérico
      if (/^(Cobertura|Suma|Deducible|Prima|Nota|Página|\d+\s*de\s*\d+)/i.test(lineaLimpia)) continue;

      // Patrón 1: Cobertura con monto y deducible porcentual
      let m = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s+\$?\s*([\d,]+\.?\d*)\s+(\d+)%\s+\$?\s*([\d,]+\.?\d*)/);
      if (m) {
        coberturas.push({ nombre: m[1].trim(), suma_asegurada: m[2].replace(/,/g, ''), deducible: m[3] + '%', prima: m[4].replace(/,/g, ''), tipo: 'monto' });
        continue;
      }

      // Patrón 2: Cobertura POR EVENTO
      m = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s+\$?\s*([\d,]+\.?\d*)\s+POR\s+EVENTO\s+(.+?)\s+([\d,]+\.?\d*)/i);
      if (m) {
        coberturas.push({ nombre: m[1].trim(), suma_asegurada: m[2].replace(/,/g, ''), deducible: m[3].trim(), prima: m[4].replace(/,/g, ''), tipo: 'por_evento' });
        continue;
      }

      // Patrón 3: Cobertura AMPARADA
      m = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s.]+?)\s+AMPARADA\s+\$?\s*([\d,]+\.?\d*)/i);
      if (m) {
        coberturas.push({ nombre: m[1].trim(), suma_asegurada: 'AMPARADA', deducible: 'N/A', prima: m[2].replace(/,/g, ''), tipo: 'amparada' });
        continue;
      }

      // Patrón 4: Cobertura con monto sin deducible
      m = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s+\$?\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/);
      if (m && m[1].length > 5) {
        coberturas.push({ nombre: m[1].trim(), suma_asegurada: m[2].replace(/,/g, ''), deducible: 'N/A', prima: m[3].replace(/,/g, ''), tipo: 'monto' });
        continue;
      }

      // Patrón 5: Solo cobertura y prima
      m = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s]{5,}?)\s+([\d,]+\.?\d{2})$/);
      if (m) {
        coberturas.push({ nombre: m[1].trim(), suma_asegurada: 'N/A', deducible: 'N/A', prima: m[2].replace(/,/g, ''), tipo: 'cobertura_basica' });
        continue;
      }
    }
  }

  console.log(`🛡️ Total coberturas HDI extraídas: ${coberturas.length}`);

  // ==================== SUMA ASEGURADA Y DEDUCIBLE PRINCIPAL ====================
  let suma_asegurada = '';
  let deducible = '5';

  const danosMaterialesMatch = textoTotal.match(/Da[ñn]os?\s+[Mm]ateriales?\s+\$?\s*([\d,]+\.?\d*)\s+(\d+)%/i);
  if (danosMaterialesMatch) {
    suma_asegurada = danosMaterialesMatch[1].replace(/,/g, '');
    deducible = danosMaterialesMatch[2];
  } else {
    const fallbackSuma = textoTotal.match(/\$\s*([\d,]+\.?\d*)\s+(\d+)%/);
    if (fallbackSuma) {
      suma_asegurada = fallbackSuma[1].replace(/,/g, '');
      deducible = fallbackSuma[2];
    }
  }

  // ==================== MONEDA ====================
  const monedaMatch = txtPago.match(/Moneda[:\s]+(MONEDA\s+NACIONAL|MXN|USD|PESOS?)/i)
    || textoTotal.match(/Moneda[:\s]+(MONEDA\s+NACIONAL|MXN|USD|PESOS?)/i);
  const moneda = monedaMatch ? (monedaMatch[1].toUpperCase().includes('NACIONAL') ? 'MXN' : monedaMatch[1].toUpperCase()) : 'MXN';

  // ==================== RESULTADO ====================
  const datosExtraidos = {
    // Asegurado
    tipo_persona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc,
    curp,
    domicilio,
    municipio,
    colonia,
    estado,
    codigo_postal,
    pais,
    email,
    telefono_movil,
    codigo_cliente,

    // Póliza
    compania,
    producto: 'Autos',
    etapa_activa: 'Emitida',
    clave_agente,
    agente,
    sub_agente: '',
    numero_poliza,
    endoso,
    inciso,
    plan,

    // Vigencia
    inicio_vigencia,
    termino_vigencia,
    fecha_emision,
    fecha_captura: new Date().toISOString().split('T')[0],

    // Financiero
    prima_neta,
    prima_pagada: prima_neta,
    otros_servicios,
    cargo_pago_fraccionado,
    gastos_expedicion,
    subtotal,
    iva,
    total,
    tipo_pago,
    frecuenciaPago,
    forma_pago,
    primer_pago,
    pagos_subsecuentes,
    periodo_gracia,
    fecha_vencimiento_pago,
    suma_asegurada,
    deducible,
    moneda,

    // Recibos extraídos del PDF (fechas reales de "Páguese antes de")
    recibos: recibosExtraidos.length > 0
      ? recibosExtraidos.map(r => ({
          numero_recibo: r.numero,
          fecha_vencimiento: r.fecha_limite,
          monto: parseFloat(r.importe).toFixed(2),
          estado_pago: (() => {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fv = new Date(r.fecha_limite);
            fv.setHours(0, 0, 0, 0);
            return fv < hoy ? 'Vencido' : 'Pendiente';
          })()
        }))
      : undefined,

    // Vehículo
    marca,
    modelo,
    anio,
    numero_serie,
    motor,
    placas,
    color,
    tipo_vehiculo,
    tipo_cobertura,

    // Coberturas
    coberturas,

    // HDI específico
    uso,
    servicio,
    movimiento,

    // Conductor
    conductor_habitual: tipo_persona === 'Fisica'
      ? `${nombre} ${apellido_paterno} ${apellido_materno}`.trim()
      : ''
  };

  // ==================== LOG FINAL ====================
  console.log('\n📊 Datos extraídos HDI completos:', {
    asegurado: {
      tipo: tipo_persona,
      nombre: tipo_persona === 'Moral' ? razonSocial : `${nombre} ${apellido_paterno} ${apellido_materno}`.trim(),
      rfc,
      telefono: telefono_movil,
      ubicacion: `${domicilio}, ${colonia}, ${municipio}, ${estado} CP ${codigo_postal}`
    },
    poliza: {
      numero: numero_poliza,
      endoso,
      inciso,
      plan,
      vigencia: `${inicio_vigencia} → ${termino_vigencia}`,
      agente: `${clave_agente} - ${agente}`
    },
    vehiculo: {
      descripcion: `${marca} ${modelo} ${anio}`.trim(),
      serie: numero_serie,
      motor,
      placas,
      color
    },
    financiero: {
      prima: prima_neta,
      gastos: gastos_expedicion,
      iva,
      total,
      formaPago: `${tipo_pago} / ${frecuenciaPago}`
    },
    coberturas: `${coberturas.length} extraídas`
  });

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ EXTRACTOR HDI AUTOS - COMPLETADO                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  return datosExtraidos;
}

/**
 * Extractor Especializado: Banorte - Autos
 * 
 * Extrae información de pólizas de autos de Seguros Banorte.
 * 
 * ESTRUCTURA DEL PDF:
 * - Página 1: Aviso de cobro (duplicado contratante + agente)
 * - Página 2: Carátula de póliza (asegurado, vehículo, datos financieros detallados)
 * - Página 3: Detalle de coberturas
 * - Página 4+: Condiciones legales / endosos
 * 
 * Referencia: docs/CAMPOS-EXTRACCION-POLIZAS.md
 * 
 * @module extractors/banorte/autos
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
 * Convierte fecha en distintos formatos Banorte a YYYY-MM-DD
 * Formatos conocidos:
 *   - 16/OCT/2025 ó 16/Oct/2025
 *   - 16/Octubre/2025
 *   - 15/Noviembre/2025
 *   - 14/10/2025
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

  // Formato: DD/MES_TEXTO/YYYY  (16/OCT/2025, 15/Noviembre/2025)
  const matchMes = fecha.match(/(\d{1,2})\/([A-ZÁÉÍÓÚa-záéíóú]+)\/(\d{4})/i);
  if (matchMes) {
    const dia = matchMes[1].padStart(2, '0');
    const mesTexto = matchMes[2].toUpperCase().substring(0, 3);
    const mes = meses[mesTexto] || meses[matchMes[2].toUpperCase()] || '01';
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

  // Formato: DD DE MES DE YYYY
  const matchDe = fecha.match(/(\d{1,2})\s+(?:DE\s+)?([A-ZÁÉÍÓÚ]+)\s+(?:DE\s+)?(\d{4})/i);
  if (matchDe) {
    const dia = matchDe[1].padStart(2, '0');
    const mesTexto = matchDe[2].toUpperCase().substring(0, 3);
    const mes = meses[mesTexto] || meses[matchDe[2].toUpperCase()] || '01';
    const anio = matchDe[3];
    return `${anio}-${mes}-${dia}`;
  }

  return fecha;
}

/**
 * Limpia un monto: quita $, comas y espacios
 * @param {string} monto - Monto con formato "$12,091.04"
 * @returns {string} Monto limpio "12091.04"
 */
function limpiarMonto(monto) {
  if (!monto) return '';
  return monto.replace(/[$,\s]/g, '').trim();
}

/**
 * Extrae información de póliza Banorte Autos
 * 
 * @param {Object} ctx - Contexto con texto del PDF
 * @param {string} ctx.textoCompleto - Texto completo del PDF
 * @param {string} ctx.textoPagina1 - Texto de página 1 (Aviso de Cobro)
 * @param {string} ctx.textoPagina2 - Texto de página 2 (Carátula)
 * @param {string[]} ctx.todasLasPaginas - Array con texto de cada página
 * @returns {Object} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🏦 EXTRACTOR BANORTE AUTOS - INICIANDO                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const { textoCompleto, textoPagina1, textoPagina2, todasLasPaginas } = ctx;

  // Identificar las páginas clave
  // Página 1 = Aviso de cobro
  // Página 2 = Carátula (DATOS DEL ASEGURADO + DATOS DE LA PÓLIZA + DATOS DEL VEHÍCULO)
  // Página 3 = Coberturas
  // NOTA: todasLasPaginas es array de { numero, texto }
  const textoAviso = textoPagina1 || '';
  const textoCaratula = textoPagina2 || '';
  const textoCoberturas = todasLasPaginas?.[2]?.texto || todasLasPaginas?.[2] || '';

  console.log(`📊 Texto completo: ${textoCompleto.length} caracteres`);
  console.log(`📊 Página 1 (Aviso): ${textoAviso.length} caracteres`);
  console.log(`📊 Página 2 (Carátula): ${textoCaratula.length} caracteres`);
  console.log(`📊 Página 3 (Coberturas): ${textoCoberturas.length} caracteres`);

  // ========================================================================
  // PASO 1: RFC Y TIPO DE PERSONA
  // ========================================================================
  console.log('\n📋 PASO 1: RFC Y TIPO DE PERSONA');
  console.log('─────────────────────────────────────────────────────────');

  // Banorte: "R.F.C.: GACH980123" — buscar el RFC del asegurado, NO el de Seguros Banorte
  // RFCs corporativos de Banorte a excluir: cualquier variante que empiece con SBG
  const esRfcBanorte = (rfc) => /^SBG/i.test(rfc);
  // Patrón RFC: permite underscores, tabs y espacios entre "R.F.C.:" y el valor
  // Homoclave (3 chars al final) es opcional — algunos RFCs vienen sin ella (ej: GACH980123 = 10 chars)
  const rfcPattern = /R\.?\s*F\.?\s*C\.?\s*[:.]?[_\s\t]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{0,3})\b/i;
  let rfcExtraido = '';

  // Estrategia 1: Buscar línea que contenga "Contratante" y un RFC (puede tener underscores entre)
  const lineas = textoCompleto.split('\n');
  for (const linea of lineas) {
    if (/contratante/i.test(linea)) {
      const rfcEnLinea = linea.match(rfcPattern);
      if (rfcEnLinea && !esRfcBanorte(rfcEnLinea[1])) {
        rfcExtraido = rfcEnLinea[1].toUpperCase().trim();
        console.log('  ✅ RFC encontrado en línea de Contratante:', rfcExtraido);
        break;
      }
    }
  }

  // Estrategia 2: Buscar línea que contenga "Asegurado" y un RFC
  if (!rfcExtraido) {
    for (const linea of lineas) {
      if (/asegurado/i.test(linea) && !/seguros banorte/i.test(linea)) {
        const rfcEnLinea = linea.match(rfcPattern);
        if (rfcEnLinea && !esRfcBanorte(rfcEnLinea[1])) {
          rfcExtraido = rfcEnLinea[1].toUpperCase().trim();
          console.log('  ✅ RFC encontrado en línea de Asegurado:', rfcExtraido);
          break;
        }
      }
    }
  }

  // Estrategia 3: Buscar cualquier línea con "R.F.C" seguido de RFC, excluyendo Banorte (SBG*)
  if (!rfcExtraido) {
    for (const linea of lineas) {
      const rfcEnLinea = linea.match(rfcPattern);
      if (rfcEnLinea && !esRfcBanorte(rfcEnLinea[1])) {
        rfcExtraido = rfcEnLinea[1].toUpperCase().trim();
        console.log('  ✅ RFC encontrado por búsqueda general:', rfcExtraido);
        break;
      }
    }
  }

  // Estrategia 4 (fallback): Buscar RFC como patrón suelto (sin etiqueta R.F.C.)
  if (!rfcExtraido) {
    // Primero intentar con homoclave (13 chars = persona física, 12 = moral)
    const rfcSuelto13 = textoCompleto.match(/\b([A-Z&Ñ]{4}\d{6}[A-Z0-9]{3})\b/g);
    if (rfcSuelto13) {
      for (const rfc of rfcSuelto13) {
        if (!esRfcBanorte(rfc) && rfc !== 'XAXX010101000' && rfc !== 'XEXX010101000') {
          rfcExtraido = rfc.toUpperCase().trim();
          console.log('  ✅ RFC encontrado como patrón suelto (13):', rfcExtraido);
          break;
        }
      }
    }
    // Luego intentar sin homoclave (10 chars)
    if (!rfcExtraido) {
      const rfcSuelto10 = textoCompleto.match(/\b([A-Z&Ñ]{4}\d{6})\b/g);
      if (rfcSuelto10) {
        for (const rfc of rfcSuelto10) {
          if (!esRfcBanorte(rfc) && rfc.length >= 10) {
            rfcExtraido = rfc.toUpperCase().trim();
            console.log('  ✅ RFC encontrado como patrón suelto (10, sin homoclave):', rfcExtraido);
            break;
          }
        }
      }
    }
  }

  // tipoPersona: 13=Física, 12=Moral, 10=Física sin homoclave
  const tipoPersona = rfcExtraido.length >= 12 
    ? (rfcExtraido.length === 12 ? 'Moral' : 'Fisica')
    : (rfcExtraido.length >= 10 ? 'Fisica' : 'Fisica');

  console.log('RFC extraído:', rfcExtraido || '❌ NO ENCONTRADO');
  console.log('Tipo de persona:', tipoPersona);

  // ========================================================================
  // PASO 2: DATOS DEL ASEGURADO
  // ========================================================================
  console.log('\n📋 PASO 2: DATOS DEL ASEGURADO');
  console.log('─────────────────────────────────────────────────────────');

  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';

  // pdfjs-dist extrae el texto por coordenadas X/Y agrupando items por línea.
  // IMPORTANTE: pdfjs-dist puede pegar "Agente", "Periodo", etc. en la misma línea.
  // Buscar línea por línea para mayor control y limpiar palabras residuales.
  let nombreCompleto = '';

  // Palabras clave que pdfjs-dist puede pegar al nombre por compartir coordenada Y
  const limpiarNombre = (txt) => {
    return txt
      .replace(/_+/g, '')
      .replace(/\s+(Agente|Contratante|Asegurado|R\.?\s*F\.?\s*C|Clave|Producto|Plan|Ramo|Oficina|Periodo|Conductor|Beneficiario|Nombre|Serie|Folio|Seguros|Banorte|Hidalgo|Monterrey|Intermediario|Modulo|Moneda|Forma)\b.*/i, '')
      .trim();
  };

  // Estrategia 1: Buscar línea por línea — "Contratante: NOMBRE"
  for (const linea of lineas) {
    const match = linea.match(/Contratante\s*:\s*[_\t ]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{3,})/i);
    if (match) {
      const candidato = limpiarNombre(match[1]);
      if (candidato.length >= 5 && !/^(SEGUROS|BANORTE|GRUPO|HIDALGO)/i.test(candidato)) {
        nombreCompleto = candidato;
        console.log('📌 Nombre encontrado (Contratante en línea):', nombreCompleto);
        break;
      }
    }
  }

  // Estrategia 2: "Nombre del Contratante:" en carátula
  if (!nombreCompleto) {
    for (const linea of lineas) {
      const match = linea.match(/Nombre\s+(?:y\s+domicilio\s+)?del?\s+(?:Contratante|Asegurado)\s*:?\s*[_\t ]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{3,})/i);
      if (match) {
        const candidato = limpiarNombre(match[1]);
        if (candidato.length >= 5 && !/^(SEGUROS|BANORTE|GRUPO|HIDALGO)/i.test(candidato)) {
          nombreCompleto = candidato;
          console.log('📌 Nombre encontrado (carátula en línea):', nombreCompleto);
          break;
        }
      }
    }
  }

  // Estrategia 3: "Conductor habitual:" como alternativa
  if (!nombreCompleto) {
    for (const linea of lineas) {
      const match = linea.match(/Conductor\s+habitual\s*:\s*[_\t ]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{3,})/i);
      if (match) {
        const candidato = limpiarNombre(match[1]);
        if (candidato.length >= 5) {
          nombreCompleto = candidato;
          console.log('📌 Nombre encontrado (conductor habitual):', nombreCompleto);
          break;
        }
      }
    }
  }

  if (nombreCompleto) {
    if (tipoPersona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      // Banorte formato: "JESUS GABRIEL ALONSO RODRIGUEZ"
      // Order: NOMBRE(s) APELLIDO_PATERNO APELLIDO_MATERNO
      const palabras = nombreCompleto.split(/\s+/).filter(Boolean);
      if (palabras.length >= 4) {
        // 4+ palabras: asumir últimas 2 son apellidos
        apellido_materno = palabras.pop();
        apellido_paterno = palabras.pop();
        nombre = palabras.join(' ');
      } else if (palabras.length === 3) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
        apellido_materno = palabras[2];
      } else if (palabras.length === 2) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
      } else {
        nombre = nombreCompleto;
      }
    }
  }

  console.log(tipoPersona === 'Moral' ? `Razón Social: ${razonSocial}` : `Nombre: ${nombre} ${apellido_paterno} ${apellido_materno}`);

  // ========================================================================
  // PASO 3: DOMICILIO
  // ========================================================================
  console.log('\n📋 PASO 3: DOMICILIO');
  console.log('─────────────────────────────────────────────────────────');

  // IMPORTANTE: buscar datos de dirección en la SECCIÓN DEL CLIENTE, no en todo el PDF,
  // porque el encabezado del aviso de cobro tiene la dirección de Banorte (C.P. 64000, Monterrey).
  //
  // pdfjs-dist agrupa por Y-coordinate, así que "Contratante:" y "Agente:" pueden estar
  // en la misma línea de texto. Por eso NO usamos "Agente" como delimitador de sección.
  //
  // Estrategia:
  //   1. Buscar "DATOS DEL ASEGURADO" en textoCompleto (carátula formal)
  //   2. Desde "Contratante:" en textoAviso hasta el final (salta header de Banorte)
  //   3. Último fallback: textoCompleto

  let seccionCliente = '';

  // Estrategia 1: sección "DATOS DEL ASEGURADO" en todo el PDF
  const secAsegurado = textoCompleto.match(/DATOS\s+DEL\s+ASEGURADO[\s\S]*?(?=DATOS\s+DE\s+LA\s+P[OÓ]LIZA|DATOS\s+DEL\s+VEH|$)/i);
  if (secAsegurado && secAsegurado[0].length > 100) {
    seccionCliente = secAsegurado[0];
    console.log('📍 Sección cliente: DATOS DEL ASEGURADO (' + seccionCliente.length + ' chars)');
  }

  // Estrategia 2: desde "Contratante:" en textoAviso (salta header Banorte con C.P. 64000)
  if (!seccionCliente) {
    const idxContratante = textoAviso.search(/Contratante\s*:/i);
    if (idxContratante >= 0) {
      seccionCliente = textoAviso.substring(idxContratante);
      console.log('📍 Sección cliente: Aviso desde Contratante (' + seccionCliente.length + ' chars)');
    }
  }

  // Último fallback
  if (!seccionCliente) {
    seccionCliente = textoCompleto;
    console.log('📍 Sección cliente: fallback textoCompleto (' + seccionCliente.length + ' chars)');
  }

  // Domicilio: "Calle y No.: VISTA..." — puede tener underscores/tabs entre etiqueta y valor
  let domicilio = '';
  const domMatch = seccionCliente.match(/Calle\s+y\s+(?:No?\.|n[uú]mero)\s*:\s*[_\s]*(.+)/im);
  if (domMatch) {
    domicilio = domMatch[1].replace(/_+/g, '').trim();
    // Si capturó algo después como "Colonia" en la misma línea, cortar
    domicilio = domicilio.replace(/\s*Colonia\s*:.*/i, '').trim();
  }

  // Colonia: capturar hasta fin de línea — puede haber underscores/tabs
  let colonia = '';
  const colMatch = seccionCliente.match(/Colonia\s*:\s*[_\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\d ]+)/i);
  if (colMatch) {
    colonia = colMatch[1].replace(/_+/g, '').trim();
    // Cortar si capturó la siguiente etiqueta o secciones del PDF
    colonia = colonia.replace(/\s*(Poblaci[oó]n|Municipio|Estado|C\.?P\.?|Detalle|Prima|Aviso|Cobro|Recibo|P[aá]gina|Resumen|Total)\b.*/i, '').trim();
  }

  // Estado: capturar texto después de "Estado:" — puede haber tabs y underscores entre etiqueta y valor
  let estado = '';
  const estMatch = seccionCliente.match(/Estado\s*:\s*[_\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{2,})/i);
  if (estMatch) {
    estado = estMatch[1].replace(/_+/g, '').trim();
    estado = estado.replace(/\s*(Tel[eé]?|C\.?P\.?|Municipio|Poblaci)\b.*/i, '').trim();
  }
  // Fallback: buscar nombre de estado mexicano en seccionCliente
  // pdfjs-dist puede separar "Estado:" del valor en líneas diferentes
  if (!estado) {
    const estadosMex = ['AGUASCALIENTES','BAJA CALIFORNIA SUR','BAJA CALIFORNIA','CAMPECHE','CHIAPAS','CHIHUAHUA','COAHUILA','COLIMA',
      'CIUDAD DE MEXICO','CDMX','DURANGO','GUANAJUATO','GUERRERO','HIDALGO','JALISCO','MICHOACAN',
      'MORELOS','NAYARIT','NUEVO LEON','OAXACA','PUEBLA','QUERETARO','QUINTANA ROO','SAN LUIS POTOSI',
      'SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA','VERACRUZ','YUCATAN','ZACATECAS'];
    // Función para buscar estado con word boundary (evita "VICENTE GUERRERO" → GUERRERO)
    const buscarEstadoEnTexto = (texto) => {
      for (const est of estadosMex) {
        const rgx = new RegExp(`\\b${est}\\b`);
        const m = rgx.exec(texto);
        if (m) {
          // Verificar que NO sea parte de un nombre de calle (precedido por nombre propio)
          const antes = texto.substring(Math.max(0, m.index - 15), m.index).trim();
          // Si antes hay un nombre propio como VICENTE, MIGUEL, etc., es calle, no estado
          if (/\b(VICENTE|MIGUEL|BENITO|FRANCISCO|EMILIANO|JOSE|IGNACIO|ADOLFO|NO|NUM|CALLE|AV|BLVD)\s*$/i.test(antes)) {
            continue; // falso positivo — es nombre de calle
          }
          return est;
        }
      }
      return '';
    };
    // Prioridad 1: buscar en seccionCliente (ya acotada a datos del asegurado)
    const textoSec = seccionCliente.toUpperCase();
    estado = buscarEstadoEnTexto(textoSec);
    // Prioridad 2: buscar en textoAviso (si la dirección está allí)
    if (!estado) {
      const textoAv = textoAviso.toUpperCase();
      // Solo buscar después de "Contratante" para evitar capturar datos de Banorte
      const idxC = textoAv.indexOf('CONTRATANTE');
      const zonaCliente = idxC >= 0 ? textoAv.substring(idxC) : '';
      estado = buscarEstadoEnTexto(zonaCliente);
    }
    // Nota: 'MEXICO' se omite de la lista para evitar falsos positivos con 'Ciudad de México'
    // Si es Estado de México, debería aparecer como 'ESTADO DE MEXICO' en el regex principal
    if (!estado) {
      const textoSec2 = seccionCliente.toUpperCase();
      if (/\bESTADO\s+DE\s+MEXICO\b/.test(textoSec2) || /\bMEXICO\b/.test(textoSec2)) {
        estado = 'MEXICO';
      }
    }
  }

  // Municipio: capturar texto después de "Municipio:" — puede haber underscores/tabs
  let municipio = '';
  const munMatch = seccionCliente.match(/(?:Poblaci[oó]n\/?\s*)?Municipio\s*:\s*[_\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]+)/i);
  if (munMatch) {
    municipio = munMatch[1].replace(/_+/g, '').trim();
    municipio = municipio.replace(/\s*(Estado|C\.?P\.?|Tel)\b.*/i, '').trim();
  }

  // Código postal — buscar en sección del cliente para evitar el C.P. de Banorte
  const codigo_postal = extraerDato(
    /C\.?\s*P\.?\s*:\s*[_\s]*(\d{5})/i,
    seccionCliente
  );

  console.log('Domicilio:', domicilio || '❌');
  console.log('Colonia:', colonia || '❌');
  console.log('Municipio:', municipio || '❌');
  console.log('Estado:', estado || '❌');
  console.log('C.P.:', codigo_postal || '❌');

  // ========================================================================
  // PASO 4: DATOS DE LA PÓLIZA
  // ========================================================================
  console.log('\n📋 PASO 4: DATOS DE LA PÓLIZA');
  console.log('─────────────────────────────────────────────────────────');

  // Número de póliza: "Póliza: 1021292" ó "No. de Póliza\n1021292"
  let numero_poliza = '';
  // Estrategia 1: "Póliza: 1021292" en aviso de cobro (más confiable)
  const polMatch = textoCompleto.match(/P[oó]liza\s*:\s*(\d+)/i);
  if (polMatch) {
    numero_poliza = polMatch[1];
  }
  // Estrategia 2: "No. de Póliza\n1021292" en carátula
  if (!numero_poliza) {
    const polMatch2 = textoCompleto.match(/No\.\s*de\s*P[oó]liza[\s\n]+(\d+)/i);
    if (polMatch2) {
      numero_poliza = polMatch2[1];
    }
  }
  // Limpiar: quitar ceros iniciales si tiene más de 6 dígitos con ceros al inicio
  if (numero_poliza && /^0+\d{6,}$/.test(numero_poliza)) {
    numero_poliza = numero_poliza.replace(/^0+/, '');
  }

  // Inciso
  const inciso = extraerDato(/Inciso\s*\n\s*(\d+)/i, textoCaratula) || 
                 extraerDato(/Inciso\s*:\s*(\d+)/i, textoCompleto) || '1';

  // Endoso: Banorte no suele ponerlo explícito, default vacío
  const endoso = extraerDato(/Endoso\s*:\s*(\d+)/i, textoCompleto) || '';

  // Plan: "Plan: A28-000"
  const plan = extraerDato(/Plan\s*:\s*([A-Z0-9\-]+)/i, textoCompleto);

  // Producto: "Producto: A003" ó "Producto\nA003"
  const productoCode = extraerDato(/Producto\s*[:\n]\s*([A-Z]\d{3})/i, textoCompleto);

  // Agente: "Agente: GLORIA BERENICE ESPARZA JAIME"
  // ó en carátula: "Intermediario: 3518 GLORIA BERENICE ESPARZA JAIME"
  let agente = '';
  let clave_agente = '';

  // Estrategia 1: "Intermediario: CLAVE NOMBRE"
  const intermediarioMatch = textoCompleto.match(/Intermediario\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Prima|\t|\n|$)/i);
  if (intermediarioMatch) {
    clave_agente = intermediarioMatch[1];
    agente = intermediarioMatch[2].trim();
  }

  // Estrategia 2: Campos separados
  if (!clave_agente) {
    clave_agente = extraerDato(/Clave\s+del\s+Agente\s*:\s*(\d+)/i, textoCompleto);
  }
  if (!agente) {
    agente = extraerDato(/Agente\s*:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*\n|\t|Clave|$)/im, textoCompleto);
  }

  console.log('Número de póliza:', numero_poliza || '❌');
  console.log('Inciso:', inciso);
  console.log('Plan:', plan || '❌');
  console.log('Producto:', productoCode || '❌');
  console.log('Clave agente:', clave_agente || '❌');
  console.log('Agente:', agente || '❌');

  // ========================================================================
  // PASO 5: VIGENCIA Y FECHAS
  // ========================================================================
  console.log('\n📋 PASO 5: VIGENCIA Y FECHAS');
  console.log('─────────────────────────────────────────────────────────');

  // Carátula formato: "Inicio de vigencia: 12:00hrs 16/OCT/2025"
  //                   "Fin de vigencia:    12:00hrs 16/OCT/2026"
  //                   "Fecha de emisión:   12:00hrs 14/OCT/2025"
  const inicioVigRaw = extraerDato(
    /Inicio\s+de\s+vigencia\s*:\s*(?:\d{1,2}:\d{2}\s*hrs?\s+)?(\d{1,2}\/[A-Za-záéíóú]+\/\d{4})/i,
    textoCompleto
  );
  const finVigRaw = extraerDato(
    /Fin\s+de\s+vigencia\s*:\s*(?:\d{1,2}:\d{2}\s*hrs?\s+)?(\d{1,2}\/[A-Za-záéíóú]+\/\d{4})/i,
    textoCompleto
  );
  const fechaEmisionRaw = extraerDato(
    /Fecha\s+de\s+emisi[oó]n\s*:\s*(?:\d{1,2}:\d{2}\s*hrs?\s+)?(\d{1,2}\/[A-Za-záéíóú]+\/\d{4})/i,
    textoCompleto
  );

  // Fallback desde aviso: "Periodo de cobertura del: 16/Oct/2025 al 16/Oct/2026"
  let inicio_vigencia = normalizarFecha(inicioVigRaw);
  let termino_vigencia = normalizarFecha(finVigRaw);

  if (!inicio_vigencia || !termino_vigencia) {
    const periodoMatch = textoCompleto.match(
      /Periodo\s+de\s+cobertura\s+del\s*:\s*(\d{1,2}\/[A-Za-záéíóú]+\/\d{4})\s+al\s+(\d{1,2}\/[A-Za-záéíóú]+\/\d{4})/i
    );
    if (periodoMatch) {
      inicio_vigencia = inicio_vigencia || normalizarFecha(periodoMatch[1]);
      termino_vigencia = termino_vigencia || normalizarFecha(periodoMatch[2]);
    }
  }

  const fecha_emision = normalizarFecha(fechaEmisionRaw) || inicio_vigencia;
  const fecha_captura = new Date().toISOString().split('T')[0];

  console.log('Inicio vigencia:', inicio_vigencia || '❌');
  console.log('Fin vigencia:', termino_vigencia || '❌');
  console.log('Fecha emisión:', fecha_emision || '❌');
  console.log('Fecha captura:', fecha_captura);

  // ========================================================================
  // PASO 6: DATOS FINANCIEROS
  // ========================================================================
  console.log('\n📋 PASO 6: DATOS FINANCIEROS');
  console.log('─────────────────────────────────────────────────────────');

  // Banorte carátula formato:
  //   "Prima neta:         $ 9,773.31"
  //   "Reducción:          $ 0.00"
  //   "Recargo: 0.00 %     $ 0.00"
  //   "Derecho de póliza:  $ 650.00"
  //   "Impuesto (I.V.A): 16.00%  1,667.73"
  //   "Prima total:        $ 12,091.04"
  //   "Prima 1er recibo (1):   $ 12,091.04"
  //   "Prima recibos subsecuentes (0):   $ 0.00"
  //
  // IMPORTANTE: Buscar en textoCaratula PRIMERO para obtener los montos TOTALES
  // (los avisos de cobro tienen montos POR RECIBO que son menores)

  // Texto de la carátula donde están los datos financieros totales
  // Buscar la sección "DATOS DE LA PÓLIZA" que contiene los montos totales
  let textoFinanciero = '';
  const seccionDatosPoliza = textoCompleto.match(/DATOS\s+DE\s+LA\s+P[OÓ]LIZA[\s\S]*?(?=DATOS\s+DEL\s+VEH[IÍ]CULO|$)/i);
  if (seccionDatosPoliza) {
    textoFinanciero = seccionDatosPoliza[0];
    console.log(`  📊 Sección DATOS DE LA PÓLIZA encontrada: ${textoFinanciero.length} chars`);
  } else {
    // Fallback: usar la carátula completa
    textoFinanciero = textoCaratula || textoCompleto;
    console.log(`  ⚠️ Sección DATOS DE LA PÓLIZA no encontrada, usando fallback`);
  }

  const prima_neta = limpiarMonto(
    extraerDato(/Prima\s+[Nn]eta\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Prima\s+[Nn]eta\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );

  const gastos_expedicion = limpiarMonto(
    extraerDato(/Derecho\s+(?:de\s+)?[Pp][oó]liza\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Derecho\s+(?:de\s+)?[Pp][oó]liza\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );

  const cargo_pago_fraccionado = limpiarMonto(
    extraerDato(/Recargo(?:s)?\s*:?\s*[\d.]+\s*%?\s*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Recargo(?:s)?\s*:?\s*[\d.]+\s*%?\s*\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );

  const iva = limpiarMonto(
    extraerDato(/(?:Impuesto\s*\(?\s*I\.?V\.?A\.?\s*\)?|Tasa\s+IVA\s*%?)\s*:?\s*(?:\d+\.?\d*\s*%?)?\s*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/(?:Impuesto\s*\(?\s*I\.?V\.?A\.?\s*\)?|Tasa\s+IVA\s*%?)\s*:?\s*(?:\d+\.?\d*\s*%?)?\s*\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );

  const total = limpiarMonto(
    extraerDato(/Prima\s+[Tt]otal\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Prima\s+[Tt]otal\s*:\s*\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );

  // Prima pagada = prima neta (campo legacy)
  const prima_pagada = prima_neta;

  // Subtotal = prima neta + gastos expedición + recargos (antes de IVA)
  let subtotal = '';
  if (prima_neta && gastos_expedicion) {
    const pn = parseFloat(prima_neta) || 0;
    const ge = parseFloat(gastos_expedicion) || 0;
    const cpf = parseFloat(cargo_pago_fraccionado) || 0;
    subtotal = (pn + ge + cpf).toFixed(2);
  }

  // Primer recibo y subsecuentes
  // Formatos posibles:
  //   "Prima 1er recibo (1): $ 12,091.04" — (N) antes del colon
  //   "Prima 1er Recibo: (1) $3,388.97"  — (N) después del colon
  //   pdfjs-dist puede separar etiqueta y monto en líneas distintas
  // IMPORTANTE: buscar primero en textoFinanciero (carátula) para obtener montos totales
  let primer_pago = limpiarMonto(
    extraerDato(/Prima\s+1er\s+[Rr]ecibo\s*(?:\(?\d+\)?\s*)?:\s*(?:\(?\d+\)?\s*)?\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Prima\s+1er\s+[Rr]ecibo\s*(?:\(?\d+\)?\s*)?:\s*(?:\(?\d+\)?\s*)?\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );
  if (!primer_pago) {
    // Fallback: buscar monto después de "1er Recibo" en hasta 80 caracteres
    const m1 = textoFinanciero.match(/1er\s+[Rr]ecibo[\s\S]{0,80}?\$\s*([\d,]+\.?\d*)/i)
            || textoCompleto.match(/1er\s+[Rr]ecibo[\s\S]{0,80}?\$\s*([\d,]+\.?\d*)/i);
    if (m1) primer_pago = limpiarMonto(m1[1]);
  }
  let pagos_subsecuentes = limpiarMonto(
    extraerDato(/Prima\s+[Rr]ecibos?\s+[Ss]ubsecuentes?\s*(?:\(?\d+\)?\s*)?:\s*(?:\(?\d+\)?\s*)?\$?\s*([\d,]+\.?\d*)/i, textoFinanciero)
  ) || limpiarMonto(
    extraerDato(/Prima\s+[Rr]ecibos?\s+[Ss]ubsecuentes?\s*(?:\(?\d+\)?\s*)?:\s*(?:\(?\d+\)?\s*)?\$?\s*([\d,]+\.?\d*)/i, textoCompleto)
  );
  if (!pagos_subsecuentes) {
    // Fallback: buscar monto después de "Subsecuente" en hasta 80 caracteres
    const m2 = textoFinanciero.match(/[Ss]ubsecuentes?[\s\S]{0,80}?\$\s*([\d,]+\.?\d*)/i)
            || textoCompleto.match(/[Ss]ubsecuentes?[\s\S]{0,80}?\$\s*([\d,]+\.?\d*)/i);
    if (m2) pagos_subsecuentes = limpiarMonto(m2[1]);
  }

  console.log('Prima neta:', prima_neta || '0.00');
  console.log('Derecho de póliza:', gastos_expedicion || '0.00');
  console.log('Recargos:', cargo_pago_fraccionado || '0.00');
  console.log('IVA:', iva || '0.00');
  console.log('Total:', total || '0.00');
  console.log('Primer pago:', primer_pago || '❌');
  console.log('Pagos subsecuentes:', pagos_subsecuentes || '❌');

  // ========================================================================
  // PASO 7: FORMA Y FRECUENCIA DE PAGO
  // ========================================================================
  console.log('\n📋 PASO 7: FORMA DE PAGO');
  console.log('─────────────────────────────────────────────────────────');

  // Forma de pago: "Forma de pago: ANUAL" ó "Forma de Pago: ANUAL"
  const formaPagoRaw = extraerDato(
    /Forma\s+de\s+[Pp]ago\s*:\s*([A-ZÁÉÍÓÚÑ]+)/i,
    textoCompleto
  ).toUpperCase();

  let tipo_pago = '';
  let frecuenciaPago = '';
  let forma_pago = formaPagoRaw;

  switch (formaPagoRaw) {
    case 'ANUAL':
      tipo_pago = 'Anual';
      frecuenciaPago = 'Anual';
      break;
    case 'SEMESTRAL':
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Semestral';
      break;
    case 'TRIMESTRAL':
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Trimestral';
      break;
    case 'CUATRIMESTRAL':
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Cuatrimestral';
      break;
    case 'MENSUAL':
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Mensual';
      break;
    default:
      tipo_pago = formaPagoRaw || '';
      frecuenciaPago = formaPagoRaw || '';
  }

  // Serie del aviso: "Serie:1/1" — complemento para validar
  const serieAvisoMatch = textoCompleto.match(/Serie\s*:\s*(\d+)\s*\/\s*(\d+)/i);
  if (serieAvisoMatch) {
    console.log(`Serie aviso: ${serieAvisoMatch[1]}/${serieAvisoMatch[2]}`);
  }

  // Conducto de cobro: "Conducto de cobro: EFECTIVO"
  const conductoCobro = extraerDato(
    /Conducto\s+de\s+cobro\s*:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Prima|\t|\n|$)/i,
    textoCompleto
  );

  // Moneda: "Moneda: PESOS"
  const monedaRaw = extraerDato(/Moneda\s*:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto);
  const moneda = monedaRaw === 'PESOS' ? 'MXN' : monedaRaw === 'DOLARES' ? 'USD' : monedaRaw || 'MXN';

  // Tipo de movimiento: "Tipo de movimiento: INDIVIDUAL"
  const movimiento = extraerDato(
    /Tipo\s+de\s+movimiento\s*:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Prima|\t|\n|$)/i,
    textoCompleto
  );

  // Fecha de vencimiento del aviso: "15/Noviembre/2025"
  // "Fecha de vencimiento \t Importe a Pagar" → siguiente línea tiene la fecha
  const fechaVencRaw = extraerDato(
    /(\d{1,2}\/[A-ZÁÉÍÓÚa-záéíóú]+\/\d{4})\s+\$\s*[\d,]+/,
    textoAviso
  );
  const fecha_limite_pago = normalizarFecha(fechaVencRaw);

  console.log('Forma de pago:', forma_pago || '❌');
  console.log('Tipo de pago:', tipo_pago || '❌');
  console.log('Frecuencia:', frecuenciaPago || '❌');
  console.log('Conducto cobro:', conductoCobro || '❌');
  console.log('Moneda:', moneda);
  console.log('Movimiento:', movimiento || '❌');
  console.log('Fecha límite pago:', fecha_limite_pago || '❌');

  // ========================================================================
  // PASO 8: DATOS DEL VEHÍCULO
  // ========================================================================
  console.log('\n📋 PASO 8: DATOS DEL VEHÍCULO');
  console.log('─────────────────────────────────────────────────────────');

  // Banorte carátula formato (valores después de __ separadores):
  // "Descripción: __...__ VERSA ADVANCE CA CE CD CB, 4 CILINDROS, 4 PUERTAS"
  // "Clave SB: _____ NI372 Marca: ________________________ NISSAN  Capacidad: ___ 5  Modelo: ____ 2016 Transmisión: __ MANUAL"
  // "Categoría: __ AUTOMOVIL RESIDENTE  Uso: __ SOCIO CONDUCTOR APP"
  // "Servicio: __ PARTICULAR  Placas: __ JNB3753  Serie: __ 3N1CN7AD0GK456370"
  // "REPUVE: __ Tonelaje: __ NO APLICA  Motor: __ HR16830546L"

  // Helper: Extraer valor después de etiqueta Banorte
  // pdfjs-dist puede formatear con/sin underscores, con tabs o espacios múltiples
  const extraerCampoBanorte = (etiqueta, texto) => {
    // Patrón 1: "Etiqueta: ___  VALOR" o "Etiqueta: VALOR" 
    const regex1 = new RegExp(`${etiqueta}\\s*:\\s*[_ ]*([A-Z0-9][A-Z0-9a-záéíóúñÑ ,./()]+?)(?=\\s{2,}[A-Za-zÁÉÍÓÚñÑ]+\\s*:|$)`, 'im');
    const match1 = texto.match(regex1);
    if (match1) return match1[1].replace(/_+/g, '').trim();
    
    // Patrón 2: más simple, capturar hasta fin de línea
    const regex2 = new RegExp(`${etiqueta}\\s*:\\s*[_ ]*(.+)`, 'im');
    const match2 = texto.match(regex2);
    if (match2) {
      let val = match2[1].replace(/_+/g, '').trim();
      // Cortar si hay otra etiqueta pegada
      val = val.replace(/\s{2,}[A-Za-zÁÉÍÓÚñÑ]+\s*:.*/i, '').trim();
      return val;
    }
    
    return '';
  };

  // Buscar datos del vehículo en la sección DATOS DEL VEHÍCULO
  // Extraer solo la sección de vehículo para evitar falsos positivos (ej: "Serie:1/1" del aviso)
  let textoVehiculo = '';
  const seccionVehiculo = textoCompleto.match(/DATOS\s+DEL\s+VEH[IÍ]CULO[\s\S]*?(?=DATOS\s+DE\s+LA|COBERTURAS|$)/i);
  if (seccionVehiculo) {
    textoVehiculo = seccionVehiculo[0];
    console.log(`📊 Sección DATOS DEL VEHÍCULO encontrada: ${textoVehiculo.length} chars`);
    // DEBUG: ver líneas de la sección vehículo
    const lineasVeh = textoVehiculo.split('\n');
    lineasVeh.forEach((l, i) => console.log(`  VEH[${i}]: ${l}`));
  } else {
    // Fallback: usar carátula (página 2) que contiene datos del vehículo
    textoVehiculo = textoCaratula || textoCompleto;
    console.log('⚠️ Sección DATOS DEL VEHÍCULO no encontrada, usando carátula/completo');
  }

  // Descripción completa del vehículo
  const descripcionVehiculo = extraerCampoBanorte('Descripci[oó]n', textoVehiculo);

  // Marca: "Marca: ________________________ NISSAN"
  const marca = extraerCampoBanorte('Marca', textoVehiculo);

  // Modelo (año): "Modelo: ____ 2016"  
  const anio = extraerDato(/Modelo\s*:\s*[_\s]*(\d{4})/i, textoVehiculo);

  // Modelo (descripción) = descripción del vehículo es la submarca/versión
  // Separar la primera parte antes de coma como modelo
  let modelo = descripcionVehiculo;
  if (modelo) {
    // "VERSA ADVANCE CA CE CD CB, 4 CILINDROS, 4 PUERTAS" → "VERSA ADVANCE CA CE CD CB"
    const commaIdx = modelo.indexOf(',');
    if (commaIdx > 0) {
      modelo = modelo.substring(0, commaIdx).trim();
    }
  }

  // Serie (VIN): "Serie: ___ MR2B29F37H1048425" — buscar específicamente en sección vehículo
  // El VIN tiene 17 caracteres alfanuméricos, validar formato
  let numero_serie = '';
  const serieMatch = textoVehiculo.match(/Serie\s*:\s*[_\s]*([A-Z0-9]{10,17})/i);
  if (serieMatch) {
    numero_serie = serieMatch[1].toUpperCase().trim();
  }
  // Fallback: buscar cualquier cadena de 17 chars alfanuméricos en la sección vehículo
  if (!numero_serie || numero_serie.length < 10) {
    const vinMatch = textoVehiculo.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (vinMatch) {
      numero_serie = vinMatch[1].toUpperCase();
    }
  }

  // Motor: "Motor: __________________________ HR16830546L"
  let motor = extraerCampoBanorte('Motor', textoVehiculo);

  // Placas: "Placas: __________________ JNB3753"
  let placas = extraerCampoBanorte('Placas', textoVehiculo);

  // Capacidad: "Capacidad: ___ 5"
  const capacidad = extraerDato(/Capacidad\s*:\s*[_\s]*(\d+)/i, textoVehiculo);

  // Color: Banorte no suele tenerlo explícitamente, buscar por si acaso
  const color = extraerCampoBanorte('Color', textoVehiculo);

  // Uso: "Uso: ____________________________________ SOCIO CONDUCTOR APP"
  let uso = extraerCampoBanorte('Uso', textoVehiculo);

  // Servicio: "Servicio: _________________________ PARTICULAR"
  let servicio = extraerCampoBanorte('Servicio', textoVehiculo);

  // Categoría: "Categoría: ___ AUTOMOVIL RESIDENTE"
  let tipo_vehiculo = extraerCampoBanorte('Categor[ií]a', textoVehiculo);

  // Transmisión (extra dato)
  const transmision = extraerDato(/Transmisi[oó]n\s*:\s*[_\s]*([A-ZÁÉÍÓÚÑ]+)/i, textoVehiculo);

  // ═══════════ POST-VALIDACIÓN DE CAMPOS VEHÍCULO ═══════════
  // pdfjs-dist agrupa por Y-coordinate, así que etiquetas y valores pueden
  // estar en líneas separadas, causando que extraerCampoBanorte capture basura.
  // Validamos cada campo y aplicamos fallback por formato si es necesario.

  // PLACAS: formato mexicano típico = 3 letras + 3-4 dígitos (ABC1234) o 2 letras + 3-4 dígitos
  // Siempre validar formato — la extracción inicial puede capturar claves internas de Banorte ("SB", etc.)
  const esPlacaValida = (p) => /^[A-Z]{2,3}\d{3,4}[A-Z]?$/i.test(p);
  if (!placas || !esPlacaValida(placas)) {
    // Buscar en textoVehiculo un patrón de placa mexicana
    const placaMatch = textoVehiculo.match(/\b([A-Z]{3}\d{3,4})\b/i) 
                    || textoVehiculo.match(/\b([A-Z]{2}\d{4})\b/i);
    if (placaMatch) placas = placaMatch[1].toUpperCase();
  }

  // MOTOR: alfanumérico 8-12 chars, NO es VIN (17), NO es placas
  if (!motor || /[:]/.test(motor) || motor.length < 5) {
    // Buscar patrones de motor: "2NR5066494", "HR16830546L"
    const motorCandidatos = textoVehiculo.match(/\b([A-Z0-9]{8,12})\b/gi) || [];
    const motorValido = motorCandidatos.find(m => 
      m.length >= 8 && m.length <= 12 && 
      m !== numero_serie && 
      !/^[A-Z]{3}\d{3,4}$/.test(m) && // no es placa
      /\d/.test(m) && /[A-Z]/i.test(m) // tiene letras Y dígitos
    );
    if (motorValido) motor = motorValido.toUpperCase();
  }

  // USO: limpiar si tiene VIN o placas concatenados
  if (uso && (uso.length > 30 || /[A-Z]{3}\d{3}/.test(uso) || /[A-Z0-9]{17}/.test(uso))) {
    uso = uso.replace(/\s+[A-Z]{2,3}\d{3,4}\b.*$/i, '').trim();
    uso = uso.replace(/\s+[A-Z0-9]{10,17}\b.*$/i, '').trim();
  }
  // Si uso sigue vacío o basura, buscar valores conocidos
  if (!uso || /[:]/.test(uso) || uso.length < 3) {
    if (/SOCIO\s+CONDUCTOR/i.test(textoVehiculo)) uso = 'SOCIO CONDUCTOR APP';
    else if (/PARTICULAR/i.test(textoVehiculo)) uso = 'PARTICULAR';
    else if (/COMERCIAL/i.test(textoVehiculo)) uso = 'COMERCIAL';
  }

  // SERVICIO: si tiene ":", es basura de otra etiqueta
  if (!servicio || /[:]/.test(servicio) || servicio.length < 3) {
    // Buscar en la línea que contiene valores sueltos
    if (/PARTICULAR/i.test(textoVehiculo)) servicio = 'PARTICULAR';
    else if (/P[UÚ]BLICO/i.test(textoVehiculo)) servicio = 'PÚBLICO';
  }

  // TIPO VEHÍCULO: cortar si tiene valores de otros campos pegados
  if (tipo_vehiculo && /\s{2,}/.test(tipo_vehiculo)) {
    tipo_vehiculo = tipo_vehiculo.split(/\s{2,}/)[0].trim();
  }

  console.log('Descripción:', descripcionVehiculo || '❌');
  console.log('Marca:', marca || '❌');
  console.log('Modelo:', modelo || '❌');
  console.log('Año:', anio || '❌');
  console.log('Serie/VIN:', numero_serie || '❌');
  console.log('Motor:', motor || '❌');
  console.log('Placas:', placas || '❌');
  console.log('Capacidad:', capacidad || '❌');
  console.log('Uso:', uso || '❌');
  console.log('Servicio:', servicio || '❌');
  console.log('Tipo vehículo:', tipo_vehiculo || '❌');

  // ========================================================================
  // PASO 9: CONDUCTOR HABITUAL
  // ========================================================================
  // "Conductor habitual: __...__ JESUS GABRIEL ALONSO RODRIGUEZ"
  const conductor_habitual = extraerCampoBanorte('Conductor\\s+habitual', textoCompleto);
  console.log('Conductor habitual:', conductor_habitual || '❌');

  // ========================================================================
  // PASO 10: TIPO DE COBERTURA Y SUMA ASEGURADA
  // ========================================================================
  console.log('\n📋 PASO 10: COBERTURA Y SUMA ASEGURADA');
  console.log('─────────────────────────────────────────────────────────');

  // Determinar tipo de cobertura basado en las coberturas presentes
  // Si tiene "DAÑOS MATERIALES" + "ROBO TOTAL" → Amplia
  // Si solo tiene "ROBO TOTAL" → Limitada
  // Si solo RC → RC
  let tipo_cobertura = 'Amplia'; // default
  if (textoCoberturas) {
    const tieneDM = /DA[NÑ]OS\s+MATERIALES/i.test(textoCoberturas);
    const tieneRT = /ROBO\s+TOTAL/i.test(textoCoberturas);
    if (tieneDM && tieneRT) tipo_cobertura = 'Amplia';
    else if (tieneRT && !tieneDM) tipo_cobertura = 'Limitada';
    else if (!tieneRT && !tieneDM) tipo_cobertura = 'RC (Responsabilidad Civil)';
  }

  // Suma asegurada: buscar "VALOR COMERCIAL" como referencia o monto específico
  let suma_asegurada = '';
  const sumaMatch = textoCompleto.match(/DA[NÑ]OS\s+MATERIALES\s+(?:VALOR\s+COMERCIAL|\$\s*([\d,]+\.?\d*))/i);
  if (sumaMatch && sumaMatch[1]) {
    suma_asegurada = limpiarMonto(sumaMatch[1]);
  } else {
    suma_asegurada = 'VALOR COMERCIAL';
  }

  // Deducible: buscar en la línea de Daños Materiales
  const deducible = extraerDato(
    /DA[NÑ]OS\s+MATERIALES\s+VALOR\s+COMERCIAL\s+(\d+%)/i,
    textoCoberturas
  ) || '10%';

  // Periodo de gracia: Banorte estándar 30 días
  const periodo_gracia = '30';

  console.log('Tipo cobertura:', tipo_cobertura);
  console.log('Suma asegurada:', suma_asegurada);
  console.log('Deducible:', deducible);

  // ========================================================================
  // PASO 11: RECIBOS — Extraer fechas reales de TODOS los avisos de cobro
  // ========================================================================
  // Cada "Aviso de Cobro" en el PDF tiene:
  //   - Fecha de vencimiento (ej: "27/Febrero/2026") + Importe ($2,692.97)
  //   - Periodo del recibo (ej: "28/Enero/2026 al 28/Julio/2026")
  //   - Serie: "1/2", "2/2" (indica número de recibo)
  //
  // Para pago Anual → 1 aviso, Semestral → 2, Trimestral → 4, Mensual → 12
  console.log('\n📋 PASO 11: EXTRACCIÓN DE RECIBOS');
  console.log('─────────────────────────────────────────────────────────');

  const recibos = [];
  const paginasArray = todasLasPaginas || [];
  
  for (let p = 0; p < paginasArray.length; p++) {
    const textoPag = paginasArray[p]?.texto || paginasArray[p] || '';
    
    // Detectar si esta página es un "Aviso de Cobro"
    if (!/AVISO\s+DE\s+COBRO/i.test(textoPag)) continue;
    
    // Extraer fecha de vencimiento e importe
    // Formato pdfjs-dist: "27/Febrero/2026 $ 2,692.97" en la misma línea
    // O separados: fecha en una línea, importe en otra
    const vencImporteMatch = textoPag.match(
      /(\d{1,2}\/[A-ZÁÉÍÓÚa-záéíóú]+\/\d{4})\s+\$\s*([\d,]+\.?\d*)/
    );
    
    if (!vencImporteMatch) continue;
    
    const fechaVenc = normalizarFecha(vencImporteMatch[1]);
    const monto = limpiarMonto(vencImporteMatch[2]);
    
    if (!fechaVenc) continue;
    
    // Extraer número de serie/recibo: "Serie: 1/2" ó "Serie:1/2"
    const serieMatch = textoPag.match(/Serie\s*:\s*(\d+)\s*\/\s*(\d+)/i);
    const numeroRecibo = serieMatch ? parseInt(serieMatch[1]) : (recibos.length + 1);
    
    // Extraer periodo del recibo
    const periodoMatch = textoPag.match(
      /Periodo\s+del\s+recibo\s+del\s*:\s*(\d{1,2}\/[A-ZÁÉÍÓÚa-záéíóú]+\/\d{4})\s+al\s+(\d{1,2}\/[A-ZÁÉÍÓÚa-záéíóú]+\/\d{4})/i
    );
    
    const recibo = {
      numero_recibo: numeroRecibo,
      fecha_vencimiento: fechaVenc,
      monto: monto || (numeroRecibo === 1 ? primer_pago : pagos_subsecuentes) || total,
      estatus: 'Pendiente'
    };
    
    if (periodoMatch) {
      recibo.periodo_inicio = normalizarFecha(periodoMatch[1]);
      recibo.periodo_fin = normalizarFecha(periodoMatch[2]);
    }
    
    recibos.push(recibo);
    console.log(`  📄 Recibo ${recibo.numero_recibo}: Vence ${recibo.fecha_vencimiento} | $${recibo.monto}`);
  }
  
  // Ordenar por número de recibo
  recibos.sort((a, b) => a.numero_recibo - b.numero_recibo);
  
  // Si hay recibos extraídos, calcular estatus basado en la fecha actual
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (const recibo of recibos) {
    const [y, m, d] = recibo.fecha_vencimiento.split('-');
    const fechaVenc = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    fechaVenc.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes < 0) {
      recibo.estatus = 'Vencido';
    } else if (diasRestantes <= 15) {
      recibo.estatus = 'Por vencer';
    } else {
      recibo.estatus = 'Pendiente';
    }
  }
  
  console.log(`📊 Total recibos extraídos del PDF: ${recibos.length}`);
  
  // Si no se encontraron recibos en las páginas, no pasa nada — 
  // el CalendarioPagos los calculará por fórmula como fallback

  // ========================================================================
  // PASO 12: COBERTURAS (tabla de la página 3)
  // ========================================================================
  console.log('\n📋 PASO 12: EXTRACCIÓN DE COBERTURAS');
  console.log('─────────────────────────────────────────────────────────');

  const coberturas = [];

  if (textoCoberturas) {
    // Banorte formato de coberturas:
    // "DAÑOS MATERIALES \tVALOR COMERCIAL \t10% \t$ 3,718.04"
    // "ROBO TOTAL \tVALOR COMERCIAL \t20% \t$ 1,196.30"
    // "RESPONSABILIDAD CIVIL POR DAÑOS A TERCEROS \t$4,000,000 \t50 UMA \t$ 3,734.49"
    // También puede haber líneas multi-línea como:
    // "MUERTE DEL CONDUCTOR POR ACCIDENTE\nAUTOMOVILÍSTICO"

    const lineas = textoCoberturas.split(/\r?\n/);

    // Buscar inicio de coberturas (después de "COBERTURAS PAQUETE:")
    let enCoberturas = false;

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      if (/COBERTURAS\s+PAQUETE/i.test(linea)) {
        enCoberturas = true;
        continue;
      }

      if (!enCoberturas) continue;

      // Fin de coberturas: cuando aparece "NÚMERO DE PÓLIZA" o línea vacía larga
      if (/N[UÚ]MERO\s+DE\s+P[OÓ]LIZA|La\s+Unidad\s+de\s+Medida/i.test(linea)) {
        break;
      }

      // Regex para capturar líneas de cobertura con prima al final
      // Formato: NOMBRE_COBERTURA \t SUMA_ASEGURADA \t DEDUCIBLE \t $ PRIMA
      const coberturaMatch = linea.match(
        /^([A-ZÁÉÍÓÚÑ\s,.\d/()]+?)\s{2,}((?:VALOR\s+COMERCIAL|VALOR\s+DEL\s+CRISTAL|AMPARADA|\$?[\d,]+(?:\.\d+)?(?:\s+POR\s+EVENTO)?|\d+,?\d*\s+UMA(?:\s+P\/PASAJERO)?))\s{2,}((?:NO\s+APLICA|\d+%|\d+\s+UMA))\s+\$?\s*([\d,]+\.?\d*)/i
      );

      if (coberturaMatch) {
        coberturas.push({
          nombre: coberturaMatch[1].trim(),
          suma_asegurada: coberturaMatch[2].trim(),
          deducible: coberturaMatch[3].trim(),
          prima: limpiarMonto(coberturaMatch[4])
        });
        continue;
      }

      // Manejar coberturas multi-línea: si la línea siguiente tiene el patrón de monto
      if (i + 1 < lineas.length && /^[A-ZÁÉÍÓÚÑ]/.test(linea) && linea.length > 5) {
        const lineaCombinada = (linea + ' ' + lineas[i + 1].trim()).trim();
        const cobMatch2 = lineaCombinada.match(
          /^([A-ZÁÉÍÓÚÑ\s,.\d/()]+?)\s{2,}((?:VALOR\s+COMERCIAL|AMPARADA|\$?[\d,]+(?:\.\d+)?(?:\s+POR\s+EVENTO)?|\d+,?\d*\s+UMA(?:\s+P\/PASAJERO)?))\s{2,}((?:NO\s+APLICA|\d+%|\d+\s+UMA))\s+\$?\s*([\d,]+\.?\d*)/i
        );
        if (cobMatch2) {
          coberturas.push({
            nombre: cobMatch2[1].trim(),
            suma_asegurada: cobMatch2[2].trim(),
            deducible: cobMatch2[3].trim(),
            prima: limpiarMonto(cobMatch2[4])
          });
          i++; // Saltar la línea siguiente ya procesada
        }
      }
    }
  }

  console.log(`Total coberturas extraídas: ${coberturas.length}`);
  coberturas.forEach((cob, i) => {
    console.log(`  ${i + 1}. ${cob.nombre} | SA: ${cob.suma_asegurada} | Ded: ${cob.deducible} | Prima: ${cob.prima}`);
  });

  // ========================================================================
  // RESULTADO FINAL
  // ========================================================================
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✅ EXTRACCIÓN BANORTE COMPLETADA                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const datosExtraidos = {
    // Asegurado
    tipo_persona: tipoPersona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc: rfcExtraido,
    domicilio,
    colonia,
    municipio,
    estado,
    codigo_postal,

    // Póliza
    compania: 'Banorte',
    producto: 'Autos',
    clave_agente,
    agente,
    numero_poliza,
    endoso,
    inciso,
    plan,

    // Vigencia
    inicio_vigencia,
    termino_vigencia,
    fecha_emision,
    fecha_captura,

    // Financiero
    prima_neta,
    prima_pagada,
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
    moneda,
    fecha_limite_pago,

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
    uso,
    servicio,
    capacidad,

    // Otros
    conductor_habitual,
    movimiento,

    // Coberturas
    coberturas,

    // Recibos extraídos del PDF (fechas reales de vencimiento)
    recibos,

    // Suma asegurada y deducible general
    suma_asegurada,
    deducible
  };

  // Log resumen
  const camposExtraidos = Object.entries(datosExtraidos)
    .filter(([k, v]) => v && v !== '' && !Array.isArray(v))
    .length;
  const camposVacios = Object.entries(datosExtraidos)
    .filter(([k, v]) => (v === '' || v === undefined) && !Array.isArray(v))
    .map(([k]) => k);

  console.log(`📊 Campos extraídos: ${camposExtraidos}/50`);
  if (camposVacios.length > 0) {
    console.log(`⚠️ Campos vacíos (${camposVacios.length}): ${camposVacios.join(', ')}`);
  }

  return datosExtraidos;
}

export default { extraer };

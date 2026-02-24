/**
 * Extractor Universal con Google Gemini 2.0 Flash
 * 
 * Usa IA para extraer datos de pólizas de CUALQUIER aseguradora.
 * Diseñado para aseguradoras sin extractor regex dedicado.
 * 
 * Costo: ~$0.002 por póliza (~$0.20/mes para 100 pólizas)
 * Velocidad: 2-4 segundos
 * 
 * Usa VITE_GEMINI_API_KEY del archivo .env
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Prompt del sistema para extracción de datos de pólizas de seguros.
 * Diseñado para ser universal — funciona con cualquier aseguradora y producto.
 */
const SYSTEM_PROMPT = `Eres un experto en seguros mexicanos. Tu tarea es extraer datos estructurados de pólizas de seguros.

REGLAS IMPORTANTES:
- Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks.
- Usa exactamente los nombres de campo indicados.
- Las fechas deben estar en formato YYYY-MM-DD.
- Los montos deben ser números sin signos de moneda ni comas (ej: 15000.00).
- Si un campo no se encuentra en el texto, usa cadena vacía "".
- Para tipo_persona: usa "Fisica" o "Moral".
- Para frecuenciaPago: usa "Anual", "Semestral", "Trimestral" o "Mensual".
- Para tipo_pago: usa "Contado" o "Fraccionado".
- Para coberturas, extrae TODAS las que aparezcan con su suma asegurada, deducible y prima.
- El campo "compania" debe ser el nombre completo de la aseguradora tal como aparece en la póliza.`;

/**
 * Template del JSON que Gemini debe devolver.
 * Coincide con la estructura flat que usan TODOS los extractores del sistema.
 */
const JSON_TEMPLATE = `{
  "tipo_persona": "",
  "nombre": "",
  "apellido_paterno": "",
  "apellido_materno": "",
  "razonSocial": "",
  "rfc": "",
  "curp": "",
  "domicilio": "",
  "colonia": "",
  "municipio": "",
  "estado": "",
  "codigo_postal": "",
  "email": "",
  "telefono_movil": "",

  "compania": "",
  "producto": "",
  "etapa_activa": "Emitida",
  "numero_poliza": "",
  "endoso": "",
  "inciso": "",
  "plan": "",
  "clave_agente": "",
  "agente": "",

  "inicio_vigencia": "",
  "termino_vigencia": "",
  "fecha_emision": "",

  "prima_pagada": "",
  "cargo_pago_fraccionado": "",
  "gastos_expedicion": "",
  "iva": "",
  "total": "",
  "subtotal": "",
  "tipo_pago": "",
  "frecuenciaPago": "",
  "forma_pago": "",
  "primer_pago": "",
  "pagos_subsecuentes": "",
  "suma_asegurada": "",
  "deducible": "",

  "marca": "",
  "modelo": "",
  "anio": "",
  "numero_serie": "",
  "motor": "",
  "placas": "",
  "color": "",
  "tipo_vehiculo": "",
  "uso": "",
  "servicio": "",

  "coberturas": [
    {
      "nombre": "",
      "suma_asegurada": "",
      "deducible": "",
      "prima": ""
    }
  ]
}`;

/**
 * Función principal de extracción con Gemini
 * Compatible con la interfaz de todos los extractores del sistema.
 * 
 * @param {Object} params - Parámetros del extractor
 * @param {string} params.textoCompleto - Texto completo extraído del PDF
 * @param {string} params.textoPagina1 - Texto de la primera página
 * @param {string} [params.textoPagina2] - Texto de la segunda página
 * @param {string} [params.textoAvisoDeCobro] - Texto del aviso de cobro
 * @param {Array} [params.todasLasPaginas] - Array con texto de cada página
 * @returns {Promise<Object>} Datos extraídos en formato flat
 */
export async function extraer({ textoCompleto, textoPagina1, textoPagina2, textoAvisoDeCobro, todasLasPaginas }) {
  console.log('🤖 Iniciando extracción con Gemini 2.0 Flash...');

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

  if (!API_KEY) {
    throw new Error(
      'No se encontró VITE_GEMINI_API_KEY ni VITE_GOOGLE_API_KEY. Agrega tu API key de Google AI Studio en el archivo .env.local'
    );
  }

  // Construir el texto a enviar (máximo ~30,000 chars para ser eficiente)
  let textoParaEnviar = '';

  if (textoCompleto && textoCompleto.trim().length > 200) {
    textoParaEnviar = textoCompleto.substring(0, 30000);
  } else if (todasLasPaginas && todasLasPaginas.length > 0) {
    textoParaEnviar = todasLasPaginas.join('\n--- NUEVA PÁGINA ---\n').substring(0, 30000);
  } else if (textoPagina1) {
    textoParaEnviar = [textoPagina1, textoPagina2 || '', textoAvisoDeCobro || ''].join('\n').substring(0, 30000);
  }

  if (textoParaEnviar.trim().length < 100) {
    throw new Error('Texto extraído del PDF insuficiente para análisis con IA');
  }

  console.log(`📄 Enviando ${textoParaEnviar.length} caracteres a Gemini...`);
  const start = Date.now();

  const userPrompt = `Extrae TODOS los datos de esta póliza de seguros y devuelve SOLO el JSON con esta estructura exacta:

${JSON_TEMPLATE}

TEXTO DE LA PÓLIZA:
${textoParaEnviar}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || response.statusText;
      throw new Error(`Gemini API error (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`⏱️ Gemini respondió en ${elapsed}s`);

    // Extraer el texto de la respuesta
    const textoRespuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textoRespuesta) {
      console.error('Respuesta Gemini sin contenido:', JSON.stringify(data).substring(0, 500));
      throw new Error('Gemini no devolvió contenido en la respuesta');
    }

    // Parsear JSON (Gemini con responseMimeType: 'application/json' devuelve JSON limpio)
    let datosExtraidos;
    try {
      datosExtraidos = JSON.parse(textoRespuesta);
    } catch (parseError) {
      // Fallback: intentar limpiar markdown por si acaso
      const jsonLimpio = textoRespuesta
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      datosExtraidos = JSON.parse(jsonLimpio);
    }

    // Normalizar y limpiar los datos
    const resultado = normalizarDatos(datosExtraidos);

    console.log('✅ Extracción Gemini completada:', {
      aseguradora: resultado.compania,
      poliza: resultado.numero_poliza,
      asegurado: resultado.nombre || resultado.razonSocial,
      coberturas: resultado.coberturas?.length || 0,
      tiempo: `${elapsed}s`
    });

    return resultado;

  } catch (error) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.error(`❌ Error Gemini (${elapsed}s):`, error.message);
    throw error;
  }
}

/**
 * Normaliza los datos devueltos por Gemini al formato estándar del sistema.
 * Limpia montos, asegura tipos correctos y aplica defaults.
 */
function normalizarDatos(datos) {
  return {
    // Asegurado
    tipo_persona: datos.tipo_persona || '',
    nombre: datos.nombre || '',
    apellido_paterno: datos.apellido_paterno || '',
    apellido_materno: datos.apellido_materno || '',
    razonSocial: datos.razonSocial || '',
    rfc: (datos.rfc || '').toUpperCase().trim(),
    curp: (datos.curp || '').toUpperCase().trim(),
    domicilio: datos.domicilio || '',
    colonia: datos.colonia || '',
    municipio: datos.municipio || '',
    estado: datos.estado || '',
    codigo_postal: datos.codigo_postal || '',
    email: datos.email || '',
    telefono_movil: datos.telefono_movil || '',

    // Póliza
    compania: datos.compania || '',
    producto: datos.producto || '',
    etapa_activa: datos.etapa_activa || 'Emitida',
    numero_poliza: datos.numero_poliza || '',
    endoso: datos.endoso || '',
    inciso: datos.inciso || '',
    plan: datos.plan || '',
    clave_agente: datos.clave_agente || '',
    agente: datos.agente || '',

    // Vigencia
    inicio_vigencia: normalizarFecha(datos.inicio_vigencia),
    termino_vigencia: normalizarFecha(datos.termino_vigencia),
    fecha_emision: normalizarFecha(datos.fecha_emision),
    fecha_captura: new Date().toISOString().split('T')[0],

    // Financiero
    prima_pagada: limpiarMonto(datos.prima_pagada),
    cargo_pago_fraccionado: limpiarMonto(datos.cargo_pago_fraccionado),
    gastos_expedicion: limpiarMonto(datos.gastos_expedicion),
    iva: limpiarMonto(datos.iva),
    total: limpiarMonto(datos.total),
    subtotal: limpiarMonto(datos.subtotal),
    tipo_pago: datos.tipo_pago || '',
    frecuenciaPago: datos.frecuenciaPago || '',
    forma_pago: datos.forma_pago || '',
    primer_pago: limpiarMonto(datos.primer_pago),
    pagos_subsecuentes: limpiarMonto(datos.pagos_subsecuentes),
    suma_asegurada: limpiarMonto(datos.suma_asegurada),
    deducible: limpiarDeducible(datos.deducible),

    // Vehículo
    marca: datos.marca || '',
    modelo: datos.modelo || '',
    anio: datos.anio || '',
    numero_serie: datos.numero_serie || '',
    motor: datos.motor || '',
    placas: datos.placas || '',
    color: datos.color || '',
    tipo_vehiculo: datos.tipo_vehiculo || '',
    uso: datos.uso || '',
    servicio: datos.servicio || '',

    // Coberturas
    coberturas: normalizarCoberturas(datos.coberturas)
  };
}

/**
 * Limpia un valor monetario: remueve $, comas, espacios, MXN
 * @param {*} valor 
 * @returns {string} Monto limpio como string (ej: "15000.00") o ""
 */
function limpiarMonto(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const str = String(valor).replace(/[$,\s]/g, '').replace(/MXN/gi, '').trim();
  const num = parseFloat(str);
  return !isNaN(num) ? num.toFixed(2) : '';
}

/**
 * Limpia un valor de deducible (puede ser % o monto)
 */
function limpiarDeducible(valor) {
  if (!valor) return '';
  const str = String(valor).trim();
  if (str.includes('%')) return str.replace(/\s/g, '');
  return limpiarMonto(str);
}

/**
 * Normaliza una fecha a formato YYYY-MM-DD
 */
function normalizarFecha(fecha) {
  if (!fecha) return '';
  const str = String(fecha).trim();

  // Ya en formato correcto
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD/MM/YYYY o DD-MM-YYYY
  const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  // Formato con nombre de mes: "15 de enero de 2026" o "15/ENE/2026"
  const meses = {
    'ENE': '01', 'ENERO': '01', 'FEB': '02', 'FEBRERO': '02',
    'MAR': '03', 'MARZO': '03', 'ABR': '04', 'ABRIL': '04',
    'MAY': '05', 'MAYO': '05', 'JUN': '06', 'JUNIO': '06',
    'JUL': '07', 'JULIO': '07', 'AGO': '08', 'AGOSTO': '08',
    'SEP': '09', 'SEPTIEMBRE': '09', 'SEPT': '09',
    'OCT': '10', 'OCTUBRE': '10', 'NOV': '11', 'NOVIEMBRE': '11',
    'DIC': '12', 'DICIEMBRE': '12'
  };

  const matchMes = str.toUpperCase().match(/(\d{1,2})\s*(?:DE\s+|\/)?(\w+)\s*(?:DE\s+|\/)?(\d{4})/);
  if (matchMes) {
    const [, dia, mesNombre, anio] = matchMes;
    const mesNum = meses[mesNombre];
    if (mesNum) {
      return `${anio}-${mesNum}-${dia.padStart(2, '0')}`;
    }
  }

  return str;
}

/**
 * Normaliza el array de coberturas
 */
function normalizarCoberturas(coberturas) {
  if (!Array.isArray(coberturas)) return [];
  return coberturas
    .filter(c => c && c.nombre)
    .map(c => ({
      nombre: c.nombre || '',
      suma_asegurada: limpiarMonto(c.suma_asegurada) || 'AMPARADA',
      deducible: limpiarDeducible(c.deducible) || '',
      prima: limpiarMonto(c.prima) || '',
      tipo: c.tipo || (limpiarMonto(c.suma_asegurada) ? 'monto' : 'amparada')
    }));
}

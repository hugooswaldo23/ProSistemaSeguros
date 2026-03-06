/**
 * Extractor: AXA Seguros - GMM (Gastos Médicos Mayores)
 * 
 * Estructura del PDF AXA GMM:
 * - Página 1: Recibo de primas (montos: Prima Neta, Recargo, Derecho de póliza, IVA, Total)
 * - Página 2: Carátula de póliza (datos contratante, asegurado titular, póliza, vigencia, condiciones)
 * - Página 3: Relación de Asegurados (tabla con nombre, parentesco, fecha nacimiento, prima)
 * 
 * Campos extraídos: 1-36 (universales) + asegurados[] + plan
 * 
 * @module extractors/axa/gmm
 */

// ==================== HELPERS ====================

function extraerDato(patron, texto, grupo = 1) {
  try {
    const match = texto.match(patron);
    return match && match[grupo] ? match[grupo].trim() : '';
  } catch (error) {
    console.warn('Error en extraerDato:', error);
    return '';
  }
}

function normalizarFecha(fecha) {
  if (!fecha) return '';
  const match = fecha.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return '';
}

function limpiarMonto(monto) {
  if (!monto) return '';
  return monto.replace(/[,$\s]/g, '').trim();
}

// ==================== CONTEXTO ====================

function prepararContexto(ctx) {
  const { textoCompleto, textoPagina1, todasLasPaginas } = ctx;

  // Buscar página de Recibo (contiene "Prima" o montos)
  let textoRecibo = '';
  let textoCaratula = '';
  let textoAsegurados = '';

  if (todasLasPaginas && todasLasPaginas.length > 0) {
    for (const pag of todasLasPaginas) {
      const t = pag.texto || '';
      if (/Prima\s+Neta|Prima\s+anual\s+total|Descuento\s+familiar/i.test(t) && !textoRecibo) {
        textoRecibo = t;
      }
      if (/Car[aá]tula\s+de\s+p[oó]liza|Datos\s+del\s+contratante/i.test(t) && !textoCaratula) {
        textoCaratula = t;
      }
      if (/Relaci[oó]n\s+de\s+Asegurados/i.test(t)) {
        textoAsegurados += '\n' + t;
      }
    }
  }

  // Fallbacks
  if (!textoRecibo) textoRecibo = textoPagina1 || textoCompleto || '';
  if (!textoCaratula) textoCaratula = textoCompleto || '';
  if (!textoAsegurados) textoAsegurados = textoCompleto || '';

  console.log('📄 AXA GMM - Recibo:', textoRecibo.length, 'chars');
  console.log('📄 AXA GMM - Carátula:', textoCaratula.length, 'chars');
  console.log('📄 AXA GMM - Asegurados:', textoAsegurados.length, 'chars');

  return { textoRecibo, textoCaratula, textoAsegurados, textoCompleto: textoCompleto || '' };
}

// ==================== EXTRACTOR PRINCIPAL ====================

export async function extraer(ctx) {
  console.log('🎯 Extractor AXA GMM - Iniciando...');

  const { textoRecibo, textoCaratula, textoAsegurados, textoCompleto } = prepararContexto(ctx);

  // ==================== RFC ====================
  let rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCaratula);
  if (!rfc) rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCompleto);
  const tipoPersona = rfc.length === 13 ? 'Fisica' : rfc.length === 12 ? 'Moral' : 'Fisica';

  // ==================== CONTRATANTE ====================
  // AXA GMM carátula tiene "Datos del contratante" seguido de "Nombre :"
  // Ej: "Nombre :   ALVAREZ PANTOJA CESAR OCTAVIO"
  // Ej: "Nombre :   OLIVARES IBARRA GUILLERMO GONZALEZ"
  // Intentar varias estrategias para capturar el nombre

  // Debug: mostrar primeras líneas de la carátula para diagnóstico
  console.log('🔍 AXA GMM - Carátula (primeros 500 chars):', textoCaratula.substring(0, 500));

  let nombreCompleto = '';

  // Estrategia 1: "Datos del contratante" seguido de "Nombre :" en la siguiente línea o misma sección
  const bloqueContratante = textoCaratula.match(/Datos\s+del\s+contratante[\s\S]*?Nombre\s*:\s*([^\n]+)/i)
    || textoCompleto.match(/Datos\s+del\s+contratante[\s\S]*?Nombre\s*:\s*([^\n]+)/i);
  if (bloqueContratante && bloqueContratante[1]) {
    nombreCompleto = bloqueContratante[1].trim();
  }

  // Estrategia 2: Primer "Nombre :" que encuentre (puede ser contratante o asegurado titular)
  if (!nombreCompleto) {
    nombreCompleto = extraerDato(/Nombre\s*:\s*([^\n]+)/i, textoCaratula);
  }
  if (!nombreCompleto) {
    nombreCompleto = extraerDato(/Nombre\s*:\s*([^\n]+)/i, textoCompleto);
  }

  // Estrategia 3: "Contratante :" directamente
  if (!nombreCompleto) {
    nombreCompleto = extraerDato(/Contratante\s*:\s*([^\n]+)/i, textoCaratula);
  }

  // Limpiar: quitar texto residual que no sea nombre
  if (nombreCompleto) {
    nombreCompleto = nombreCompleto
      .replace(/\s*Domicilio.*$/i, '')
      .replace(/\s*R\.?\s*F\.?\s*C\.?.*$/i, '')
      .replace(/\s*Tel[eé]fono.*$/i, '')
      // Quitar códigos alfanuméricos sueltos (ej: "9020AI01" que PDF.js mezcla de otra columna)
      .replace(/\b[A-Z0-9]*\d+[A-Z]+[A-Z0-9]*\b/gi, '')
      .replace(/\b[A-Z]+\d+[A-Z0-9]*\b/gi, '')
      // Quitar números sueltos
      .replace(/\b\d+\b/g, '')
      // Normalizar espacios y comas finales
      .replace(/\s+/g, ' ')
      .replace(/,\s*$/, '')
      .trim();
  }

  console.log('👤 AXA GMM - Nombre extraído:', nombreCompleto);

  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';

  if (nombreCompleto) {
    nombreCompleto = nombreCompleto.trim();
    if (tipoPersona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      // AXA tiene dos formatos:
      // Formato 1: "ONTIVEROS GONZALEZ, GERMAN"  (APELLIDOS, NOMBRE)
      // Formato 2: "ALVAREZ PANTOJA CESAR OCTAVIO" (APELLIDO_P APELLIDO_M NOMBRE(S))
      
      if (nombreCompleto.includes(',')) {
        // Formato con coma: "APELLIDOS, NOMBRE(S)"
        const [apellidos, nombres] = nombreCompleto.split(',').map(s => s.trim());
        nombre = nombres || '';
        const partesAp = (apellidos || '').split(/\s+/);
        apellido_paterno = partesAp[0] || '';
        apellido_materno = partesAp.slice(1).join(' ') || '';
      } else {
        // Formato sin coma: "APELLIDO_P APELLIDO_M NOMBRE(S)"
        const partes = nombreCompleto.split(/\s+/);
        if (partes.length >= 4) {
          apellido_paterno = partes[0];
          apellido_materno = partes[1];
          nombre = partes.slice(2).join(' ');
        } else if (partes.length === 3) {
          apellido_paterno = partes[0];
          apellido_materno = partes[1];
          nombre = partes[2];
        } else if (partes.length === 2) {
          apellido_paterno = partes[0];
          nombre = partes[1];
        } else {
          nombre = nombreCompleto;
        }
      }
    }
  }

  // ==================== DOMICILIO ====================
  // AXA: "Domicilio : CHIMBORAZO 1126 . LOMAS INDEPENDENCIA."
  const domicilio = extraerDato(/Domicilio\s*:\s*\n?\s*(.+?)(?:\n|$)/i, textoCaratula)
    || extraerDato(/Domicilio\s*:\s*(.+?)(?:\n|$)/i, textoCompleto);

  // Ciudad
  const ciudad = extraerDato(/Ciudad\s*:\s*\n?\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCaratula)
    || extraerDato(/Ciudad\s*:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCompleto);

  // Código Postal - buscar en domicilio o separado
  let codigoPostal = extraerDato(/C\.?\s*P\.?\s*(\d{5})/i, textoCaratula)
    || extraerDato(/C\.?\s*P\.?\s*(\d{5})/i, textoCompleto);
  if (!codigoPostal) {
    const cpMatch = (domicilio || '').match(/(\d{5})/);
    if (cpMatch) codigoPostal = cpMatch[1];
  }

  // Teléfono
  const telefono = extraerDato(/Tel[eé]fono\s*:\s*\n?\s*([\d\s\-\(\)]+)/i, textoCaratula)
    || extraerDato(/(?:Tel|Fono)\s*:\s*([\d\s\-\(\)]+)/i, textoCompleto);

  // ==================== NÚMERO DE PÓLIZA ====================
  let numeroPoliza = extraerDato(/P[oó]liza\s*\n\s*(\d[\w]+)/i, textoCaratula);
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza\s*:\s*(\d[\w]+)/i, textoCaratula);
  }
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza\s*:?\s*(\d[\w]+)/i, textoRecibo);
  }
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza\s*:?\s*(\d[\w]+)/i, textoCompleto);
  }

  // ==================== PLAN / TIPO DE PLAN ====================
  // AXA: "Tipo de plan" en una línea, "Flex Plus" en la siguiente (o misma)
  let plan = extraerDato(/Tipo\s+de\s+plan\s*\n\s*([^\n]+)/i, textoCaratula);
  if (!plan) {
    plan = extraerDato(/Tipo\s+de\s+plan\s*[:\s]+([^\n]+)/i, textoCaratula);
  }
  if (!plan) {
    plan = extraerDato(/Tipo\s+de\s+plan\s*\n\s*([^\n]+)/i, textoCompleto);
  }
  // Limpiar: puede traer "Flex Plus    Solicitud" si están en la misma fila
  if (plan) {
    plan = plan.replace(/\s*Solicitud.*$/i, '').replace(/\s*\d{6,}.*$/, '').trim();
  }

  // ==================== SOLICITUD ====================
  const solicitud = extraerDato(/Solicitud\s*\n?\s*(\d+)/i, textoCaratula)
    || extraerDato(/Solicitud\s*:\s*(\d+)/i, textoCompleto);

  // ==================== FECHAS ====================
  // AXA: "Fecha de inicio de vigencia   08/07/2025"
  const vigenciaDesdeRaw = extraerDato(/Fecha\s+de\s+inicio\s+de\s+vigencia\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula)
    || extraerDato(/Fecha\s+de\s+inicio\s+de\s+vigencia\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCompleto);
  const vigenciaHastaRaw = extraerDato(/Fecha\s+de\s+fin\s+de\s+vigencia\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula)
    || extraerDato(/Fecha\s+de\s+fin\s+de\s+vigencia\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCompleto);
  const fechaEmisionRaw = extraerDato(/Fecha\s+de\s+emisi[oó]n\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula)
    || extraerDato(/Fecha\s+de\s+emisi[oó]n\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCompleto);

  const inicioVigencia = normalizarFecha(vigenciaDesdeRaw);
  const terminoVigencia = normalizarFecha(vigenciaHastaRaw);
  const fechaEmision = normalizarFecha(fechaEmisionRaw) || new Date().toISOString().split('T')[0];

  // ==================== FRECUENCIA Y TIPO DE PAGO ====================
  // AXA: "Frecuencia de pago    Trimestral"
  const frecuenciaPagoRaw = extraerDato(/Frecuencia\s+de\s+pago\s*:?\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Frecuencia\s+de\s+pago\s*:?\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto);

  // "Tipo de pago    Efectivo"
  const tipoPagoRaw = extraerDato(/Tipo\s+de\s+pago\s*:?\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Tipo\s+de\s+pago\s*:?\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto);

  let tipoPago = 'Anual';
  let frecuenciaPago = 'Anual';
  const frecUpper = (frecuenciaPagoRaw || '').toUpperCase();

  if (frecUpper.includes('ANUAL') || frecUpper.includes('UNA SOLA')) {
    tipoPago = 'Anual';
    frecuenciaPago = 'Anual';
  } else if (frecUpper.includes('SEMEST')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Semestral';
  } else if (frecUpper.includes('TRIM')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Trimestral';
  } else if (frecUpper.includes('MENS')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Mensual';
  }

  // ==================== MONTOS (del Recibo) ====================
  // AXA GMM recibo: "Prima Neta  26,658.06"
  let primaNeta = limpiarMonto(extraerDato(/Prima\s+Neta\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));
  if (!primaNeta) {
    primaNeta = limpiarMonto(extraerDato(/Prima\s+Neta\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));
  }
  // Podría aparecer en línea siguiente si PDF.js separa label de valor
  if (!primaNeta) {
    primaNeta = limpiarMonto(extraerDato(/Prima\s+Neta\s*\n\s*([\d,]+\.\d{2})/i, textoRecibo));
  }
  if (!primaNeta) {
    primaNeta = limpiarMonto(extraerDato(/Prima\s+Neta\s*\n\s*([\d,]+\.\d{2})/i, textoCompleto));
  }

  // Recargo por pago fraccionado
  let recargo = limpiarMonto(extraerDato(/Recargo\s+por\s+pago\s+fraccionado\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));
  if (!recargo) recargo = limpiarMonto(extraerDato(/Recargo\s+por\s+pago\s+fraccionado\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));
  if (!recargo) recargo = limpiarMonto(extraerDato(/Recargo\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));

  // Derecho de póliza (gastos de expedición)
  let gastosExpedicion = limpiarMonto(extraerDato(/Derecho\s+de\s+p[oó]liza\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));
  if (!gastosExpedicion) gastosExpedicion = limpiarMonto(extraerDato(/Derecho\s+de\s+p[oó]liza\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));
  if (!gastosExpedicion) gastosExpedicion = limpiarMonto(extraerDato(/Gastos\s+de\s+expedici[oó]n\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));

  // I.V.A.
  let iva = limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));
  if (!iva) iva = limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));

  // Prima anual total
  let total = limpiarMonto(extraerDato(/Prima\s+anual\s+total\s*:?\s*([\d,]+\.\d{2})/i, textoRecibo));
  if (!total) total = limpiarMonto(extraerDato(/Prima\s+anual\s+total\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));
  if (!total) total = limpiarMonto(extraerDato(/Prima\s+total\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));
  if (!total) total = limpiarMonto(extraerDato(/Total\s+a\s+pagar\s*:?\s*([\d,]+\.\d{2})/i, textoCompleto));

  // Descuento familiar
  const descuento = limpiarMonto(extraerDato(/Descuento\s+familiar\s*:?\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Descuento\s+familiar\s*:?\s*([\d,]+\.?\d*)/i, textoCompleto));

  // Cesión de Comisión
  const cesionComision = limpiarMonto(extraerDato(/Cesi[oó]n\s+de\s+Comisi[oó]n\s*:?\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Cesi[oó]n\s+de\s+Comisi[oó]n\s*:?\s*([\d,]+\.?\d*)/i, textoCompleto));

  // Calcular primer pago y subsecuentes si es fraccionado
  let primerRecibo = '';
  let subsecuentes = '';
  if (tipoPago === 'Fraccionado' && total) {
    const totalNum = parseFloat(total);
    let numPagos = 1;
    if (frecuenciaPago === 'Mensual') numPagos = 12;
    else if (frecuenciaPago === 'Trimestral') numPagos = 4;
    else if (frecuenciaPago === 'Semestral') numPagos = 2;
    else if (frecuenciaPago === 'Bimestral') numPagos = 6;
    
    if (numPagos > 1) {
      const pagoCalculado = (totalNum / numPagos).toFixed(2);
      primerRecibo = pagoCalculado;
      subsecuentes = pagoCalculado;
    }
  }

  // ==================== CONDICIONES CONTRATADAS ====================
  // Suma Asegurada, Deducible, Coaseguro, etc.
  const sumaAsegurada = limpiarMonto(extraerDato(/Suma\s+Asegurada\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCaratula))
    || limpiarMonto(extraerDato(/Suma\s+Asegurada\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCompleto));
  
  const deducible = limpiarMonto(extraerDato(/Deducible\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCaratula))
    || limpiarMonto(extraerDato(/Deducible\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCompleto));

  const coaseguro = extraerDato(/Coaseguro\s*(\d+\s*%)/i, textoCaratula)
    || extraerDato(/Coaseguro\s*(\d+\s*%)/i, textoCompleto);

  const topeCoaseguro = limpiarMonto(extraerDato(/Tope\s+de\s+coaseguro\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCaratula))
    || limpiarMonto(extraerDato(/Tope\s+de\s+coaseguro\s*\$?\s*([\d,]+(?:\.?\d*))\s*M\.?\s*N\.?/i, textoCompleto));

  const tabuladorMedico = extraerDato(/Tabulador\s+M[eé]dico\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Tabulador\s+M[eé]dico\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCompleto);

  const gamaHospitalaria = extraerDato(/Gama\s+Hospitalaria\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Gama\s+Hospitalaria\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCompleto);

  const tipoRed = extraerDato(/Tipo\s+de\s+Red\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Tipo\s+de\s+Red\s*:?\s*([A-Za-záéíóúñÁÉÍÓÚÑ]+)/i, textoCompleto);

  // ==================== AGENTE ====================
  // AXA GMM tiene dos líneas:
  //   Agente:   000638182  CARMEN DEL R OCIO GONZALE Z VALDEZ   <-- AGENTE REAL
  //   Promotor: 608298     JAVRAM Y ASO CIADOS S.C.             <-- PROMOTOR (no es agente)
  // Prioridad: 1) "Agente:", 2) fallback "Número:", 3) último recurso "Promotor:"
  let agente = '';
  let claveAgente = '';

  // 1) Buscar línea "Agente:" — este es el agente real
  const agenteMatch = textoCaratula.match(/Agente\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i)
    || textoCompleto.match(/Agente\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i);
  if (agenteMatch) {
    claveAgente = agenteMatch[1].trim();
    agente = agenteMatch[2].trim();
  }

  // 2) Fallback: buscar "Número:" seguido de nombre
  if (!agente) {
    const numMatch = textoCaratula.match(/N[uú]mero\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i)
      || textoCompleto.match(/N[uú]mero\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i);
    if (numMatch) {
      claveAgente = numMatch[1].trim();
      agente = numMatch[2].trim();
    }
  }

  // 3) Último recurso: "Promotor:" (si no se encontró agente directo)
  if (!agente) {
    const promotorMatch = textoCaratula.match(/Promotor\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i)
      || textoCompleto.match(/Promotor\s*:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ&\s.]+?)(?:\s{2,}|\n|$)/i);
    if (promotorMatch) {
      claveAgente = promotorMatch[1].trim();
      agente = promotorMatch[2].trim();
    }
  }

  // Limpiar: quitar texto basura que pueda colarse (Deducible, Coberturas, etc.)
  if (agente) {
    agente = agente.replace(/\s*(Deducible|Coberturas|Cobertura|Suma|Prima|Incluidos).*$/i, '').trim();
  }

  // ==================== ZONA / TARIFICACIÓN ====================
  const zona = extraerDato(/Zona\s*:?\s*([^\n]+)/i, textoCaratula)
    || extraerDato(/Tarificaci[oó]n\s*:\s*([^\n]+)/i, textoCaratula);

  // ==================== ASEGURADOS (Relación de Asegurados) ====================
  let asegurados = [];

  // Buscar tabla de asegurados: Nombre, Sexo, Edad, Parentesco, Fecha nacimiento...
  const bloqueAseg = textoAsegurados.match(/Relaci[oó]n\s+de\s+Asegurados([\s\S]*?)(?:Coberturas|NOTA|Este\s+documento|Hoja\s+\d|$)/i);
  
  if (bloqueAseg) {
    const lineas = bloqueAseg[1].split('\n').filter(l => l.trim().length > 5);
    
    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      
      // Saltar headers
      if (/^Nombre\s|^Sexo\s|^Edad\s|^Parentesco/i.test(lineaLimpia)) continue;
      if (/Antiguedad|Antig[üu]edad|Prima\s+Neta|Fecha\s+de/i.test(lineaLimpia) && !/[A-Z]{3,}\s+[A-Z]/i.test(lineaLimpia)) continue;
      
      // Patrón AXA: "Alvarez Pantoja Cesar Octavio  M  44  Titular  29/05/1981 08/07/2024 ..."
      let match = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s+([MF])\s+(\d{1,3})\s+(Titular|Hijo|Hija|C[oó]nyuge|Dependiente|Padre|Madre)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (match) {
        asegurados.push({
          nombre: match[1].trim().toUpperCase(),
          sexo: match[2],
          edad: match[3],
          parentesco: match[4].toUpperCase(),
          fecha_nacimiento: normalizarFecha(match[5])
        });
        continue;
      }
      
      // Patrón más laxo: solo nombre y parentesco
      match = lineaLimpia.match(/^([A-Za-záéíóúñÁÉÍÓÚÑ]{2,}\s+[A-Za-záéíóúñÁÉÍÓÚÑ\s]+?)\s+(Titular|Hijo|Hija|C[oó]nyuge|Dependiente|Padre|Madre)/i);
      if (match && !/Nombre|Coberturas|Servicios|Protec/i.test(match[1])) {
        const fechaMatch = lineaLimpia.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        asegurados.push({
          nombre: match[1].trim().toUpperCase(),
          parentesco: match[2].toUpperCase(),
          fecha_nacimiento: fechaMatch ? normalizarFecha(fechaMatch[1]) : ''
        });
      }
    }
  }

  // Si no encontramos asegurados, usar contratante como titular
  if (asegurados.length === 0 && nombreCompleto) {
    asegurados.push({
      nombre: nombreCompleto.toUpperCase(),
      parentesco: 'TITULAR',
      fecha_nacimiento: ''
    });
  }

  // ==================== RESULTADO ====================
  console.log('📊 AXA GMM Extracción:', {
    contratante: nombreCompleto,
    poliza: numeroPoliza,
    plan,
    vigencia: `${inicioVigencia} - ${terminoVigencia}`,
    frecuencia: frecuenciaPago,
    primaNeta,
    total,
    asegurados: asegurados.length
  });

  return {
    // Asegurado / Contratante (1-11)
    tipo_persona: tipoPersona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc: rfc || '',
    curp: '',
    domicilio: domicilio || '',
    colonia: '',
    municipio: ciudad || '',
    estado: '',
    codigo_postal: codigoPostal || '',
    pais: 'MEXICO',
    telefono: telefono || '',

    // Póliza (12-19)
    compania: 'AXA SEGUROS, S.A. DE C.V.',
    producto: 'GMM',
    etapa_activa: 'Emitida',
    clave_agente: claveAgente || '',
    agente: agente || '',
    sub_agente: '',
    numero_poliza: numeroPoliza || '',
    endoso: '',
    inciso: '',
    plan: plan || '',

    // Vigencia (20-23)
    inicio_vigencia: inicioVigencia,
    termino_vigencia: terminoVigencia,
    fecha_emision: fechaEmision,
    fecha_captura: new Date().toISOString().split('T')[0],

    // Financiero (24-36)
    prima_neta: primaNeta || '',
    prima_pagada: primaNeta || '',
    cargo_pago_fraccionado: recargo || '0.00',
    gastos_expedicion: gastosExpedicion || '',
    iva: iva || '',
    subtotal: '',
    total: total || '',
    primer_pago: primerRecibo || '',
    pagos_subsecuentes: subsecuentes || '',
    tipo_pago: tipoPago,
    frecuenciaPago,
    forma_pago: frecuenciaPago,
    moneda: 'NAL',
    periodo_gracia: '30',
    suma_asegurada: sumaAsegurada || '',
    deducible: deducible || '',

    // Descuentos
    otros_descuentos: descuento || '0',
    cesion_comision: cesionComision || '0',

    // GMM específicos
    asegurados,
    coaseguro: coaseguro || '',
    tope_coaseguro: topeCoaseguro || '',
    tabulador_medico: tabuladorMedico || '',
    gama_hospitalaria: gamaHospitalaria || '',
    tipo_red: tipoRed || '',
    solicitud: solicitud || '',
    zona: zona || '',

    coberturas: []
  };
}

export default { extraer };

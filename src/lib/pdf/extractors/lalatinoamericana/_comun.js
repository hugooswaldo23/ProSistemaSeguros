/**
 * Módulo Común: La Latinoamericana Seguros
 * 
 * Funciones compartidas y extracción de campos universales (1-36)
 * para todos los productos (autos, vida, GMM, daños).
 * 
 * Ref: docs/CAMPOS-EXTRACCION-POLIZAS.md
 * 
 * @module extractors/lalatinoamericana/_comun
 */

// ==================== HELPERS ====================

/**
 * Extrae un dato usando expresión regular
 * @param {RegExp} patron - Patrón regex
 * @param {string} texto - Texto donde buscar
 * @param {number} grupo - Grupo de captura (default: 1)
 * @returns {string} Valor extraído o cadena vacía
 */
export function extraerDato(patron, texto, grupo = 1) {
  try {
    const match = texto.match(patron);
    return match && match[grupo] ? match[grupo].trim() : '';
  } catch (error) {
    console.warn('Error en extraerDato:', error, 'Patrón:', patron);
    return '';
  }
}

/**
 * Normaliza fecha de formato DD/MM/YYYY a YYYY-MM-DD
 * @param {string} fecha - Fecha en formato DD/MM/YYYY
 * @returns {string} Fecha en formato YYYY-MM-DD o cadena vacía
 */
export function normalizarFecha(fecha) {
  if (!fecha) return '';
  const match = fecha.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, dia, mes, anio] = match;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return '';
}

/**
 * Limpia un monto: quita comas y espacios
 * @param {string} monto - Valor con posibles comas
 * @returns {string} Monto limpio
 */
export function limpiarMonto(monto) {
  if (!monto) return '';
  return monto.replace(/[,\s]/g, '').trim();
}

// ==================== CONTEXTO ====================

/**
 * Prepara las fuentes de texto del PDF (recibo, carátula, prima, completo)
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Object} { textoRecibo, textoCaratula, textoPrima, textoCompleto }
 */
export function prepararContexto(ctx) {
  const { textoCompleto, textoPagina1, todasLasPaginas } = ctx;

  // Buscar la página que contiene "RECIBO DE PRIMAS"
  let textoRecibo = '';
  if (todasLasPaginas && todasLasPaginas.length > 0) {
    const paginaRecibo = todasLasPaginas.find(p =>
      /RECIBO\s+DE\s+PRIMAS/i.test(p.texto)
    );
    textoRecibo = paginaRecibo ? paginaRecibo.texto : todasLasPaginas[todasLasPaginas.length - 1].texto;
  }
  if (!textoRecibo) {
    textoRecibo = textoCompleto;
  }

  // Página 1 (carátula)
  const textoCaratula = textoPagina1 || '';

  // Página que contiene "PRIMA DEL SEGURO"
  let textoPrima = '';
  if (todasLasPaginas && todasLasPaginas.length > 0) {
    const paginaPrima = todasLasPaginas.find(p =>
      /PRIMA\s+DEL\s+SEGURO/i.test(p.texto)
    );
    if (paginaPrima) {
      textoPrima = paginaPrima.texto;
    }
  }

  console.log('📄 Recibo encontrado:', textoRecibo.length, 'chars');
  console.log('📄 Carátula:', textoCaratula.length, 'chars');
  console.log('📄 Página Prima:', textoPrima.length, 'chars');
  if (textoPrima) {
    const lineasPrima = textoPrima.split('\n');
    const idxPrima = lineasPrima.findIndex(l => /PRIMA\s+DEL\s+SEGURO/i.test(l));
    if (idxPrima >= 0) {
      const seccion = lineasPrima.slice(idxPrima, idxPrima + 20).map((l, i) => `  L${idxPrima + i}: "${l}"`).join('\n');
      console.log('📊 Sección PRIMA DEL SEGURO:\n' + seccion);
    }
  }

  return { textoRecibo, textoCaratula, textoPrima, textoCompleto };
}

// ==================== EXTRACCIÓN CAMPOS UNIVERSALES (1-36) ====================

/**
 * Extrae los campos universales 1-36 de una póliza La Latinoamericana
 * @param {Object} ctx - Contexto con textos del PDF
 * @param {string} [productoLabel=''] - Etiqueta del producto para el resultado
 * @returns {Object} Campos universales extraídos
 */
export function extraerCamposUniversales(ctx, productoLabel = '') {
  const { textoRecibo, textoCaratula, textoPrima, textoCompleto } = prepararContexto(ctx);

  // ==================== RFC ====================
  let rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoRecibo);
  if (!rfc) {
    rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCaratula);
  }
  const tipoPersona = rfc.length === 13 ? 'Fisica' : rfc.length === 12 ? 'Moral' : 'Fisica';

  // ==================== ASEGURADO ====================
  let nombreCompleto = extraerDato(/Nombre:\s*\n?\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoRecibo);
  if (!nombreCompleto) {
    nombreCompleto = extraerDato(/Nombre:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCaratula);
  }

  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';

  if (nombreCompleto) {
    nombreCompleto = nombreCompleto.trim();
    if (tipoPersona === 'Moral') {
      razonSocial = nombreCompleto;
    } else {
      const partes = nombreCompleto.split(/\s+/);
      if (partes.length >= 4) {
        apellido_materno = partes.pop();
        apellido_paterno = partes.pop();
        nombre = partes.join(' ');
      } else if (partes.length === 3) {
        nombre = partes[0];
        apellido_paterno = partes[1];
        apellido_materno = partes[2];
      } else if (partes.length === 2) {
        nombre = partes[0];
        apellido_paterno = partes[1];
      } else {
        nombre = nombreCompleto;
      }
    }
  }

  // ==================== NÚMERO DE PÓLIZA ====================
  let numeroPoliza = extraerDato(/N[uú]mero\s+de\s+P[oó]liza:\s*(\S+)/i, textoRecibo);
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza:\s*(\d[\d-]+)/i, textoRecibo);
  }
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza:\s*(\d[\d-]+)/i, textoCaratula);
  }
  numeroPoliza = (numeroPoliza || '').replace(/\s/g, '');

  // ==================== ENDOSO E INCISO ====================
  const endoso = extraerDato(/Endoso(?:\s+N[uú]m)?:\s*(\S+)/i, textoRecibo) || '000000';
  const inciso = extraerDato(/Inciso:\s*(\S+)/i, textoCaratula) || '0001';

  // ==================== DOMICILIO ====================
  const domicilio = extraerDato(/Domicilio\s+de\s+cobro:\s*(.+?)(?:,?\s*Poblaci[oó]n|\s+Estado:|\s+C[oó]digo\s*Postal:|\n|$)/i, textoRecibo)
    || extraerDato(/Calle\s+y\s+n[uú]mero:\s*(.+?)(?:,?\s*Poblaci[oó]n|\s+Estado:|\s+C[oó]digo\s*Postal:|\n|$)/i, textoCaratula);

  const codigoPostal = extraerDato(/C[oó]digo\s*Postal:\s*(\d{4,5})/i, textoRecibo)
    || extraerDato(/C[oó]digo\s*Postal:\s*(\d{4,5})/i, textoCaratula);

  const colonia = extraerDato(/Colonia:\s*(.+?)(?:\n|$)/i, textoCaratula);

  let estado = extraerDato(/Entidad:\s*(.+?)(?:\s+C[oó]digo\s*Postal:|\n|$)/i, textoRecibo);
  if (!estado) {
    estado = extraerDato(/Estado:\s*(.+?)(?:\s+C[oó]digo\s*Postal:|\n|$)/i, textoCaratula);
  }

  const municipio = extraerDato(/Poblaci[oó]n:\s*(.+?)(?:\s+Estado:|\s+C[oó]digo\s*Postal:|\n|$)/i, textoCaratula);

  // ==================== FECHAS ====================
  const fechaEmisionRaw = extraerDato(/Fecha\s+de\s+emisi[oó]n:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoRecibo)
    || extraerDato(/Fecha\s+de\s+emisi[oó]n:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoCaratula);
  const fechaEmision = normalizarFecha(fechaEmisionRaw);

  const fechaLimitePagoRaw = extraerDato(/Fecha\s+l[ií]mite\s+de\s+pago:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoRecibo);
  const fechaLimitePago = normalizarFecha(fechaLimitePagoRaw);

  const vigenciaDesdeRaw = extraerDato(/Desde\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoRecibo)
    || extraerDato(/Vigencia\s+Desde\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula);
  const vigenciaHastaRaw = extraerDato(/Hasta\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoRecibo)
    || extraerDato(/Hasta\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula);

  const inicioVigencia = normalizarFecha(vigenciaDesdeRaw);
  const terminoVigencia = normalizarFecha(vigenciaHastaRaw);

  // ==================== MONTOS ====================
  let primaNeta = '';
  const esRecibo = /RECIBO\s+DE\s+PRIMAS/i.test(textoRecibo);

  if (esRecibo) {
    const matchPrimaAntes = textoRecibo.match(/([\d,]+\.\d{2})\n.*PRIMA\s+DEL\s+SEGURO/i);
    if (matchPrimaAntes) {
      primaNeta = limpiarMonto(matchPrimaAntes[1]);
    }
  }
  if (!primaNeta) {
    primaNeta = limpiarMonto(extraerDato(/Prima\s+Neta:?\s+([\d,]+\.\d{2})/i, textoCaratula));
  }
  if (!primaNeta) {
    primaNeta = limpiarMonto(extraerDato(/Prima\s+neta:?\s+([\d,]+\.\d{2})/i, textoCompleto));
  }

  const gastosExpedicion = limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*\n?\s*([\d,]+\.?\d*)/i, textoPrima))
    || limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula))
    || limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*\n?\s*([\d,]+\.?\d*)/i, textoCompleto));

  const recargo = limpiarMonto(extraerDato(/Recargo(?:\s+por\s+Pago\s+Fraccionado)?:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Recargo(?:\s+por\s+Pago\s+Fraccionado)?:\s*\n?\s*([\d,]+\.?\d*)/i, textoPrima))
    || limpiarMonto(extraerDato(/Recargo\s+por\s+Pago\s+Fraccionado:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula))
    || limpiarMonto(extraerDato(/Recargo(?:\s+por\s+Pago\s+Fraccionado)?:\s*\n?\s*([\d,]+\.?\d*)/i, textoCompleto));

  // IVA — Estrategia 1: segundo número en línea de Prima Neta
  let iva = limpiarMonto(extraerDato(/Prima\s+Neta:\s*[\d,]+\.\d{2}\s+(\d[\d,]*\.\d{2})/i, textoPrima))
    || limpiarMonto(extraerDato(/Prima\s+Neta:\s*[\d,]+\.\d{2}\s+(\d[\d,]*\.\d{2})/i, textoCaratula))
    || limpiarMonto(extraerDato(/Prima\s+Neta:\s*[\d,]+\.\d{2}\s+(\d[\d,]*\.\d{2})/i, textoCompleto));

  // Estrategia 2: valor antes de "I. V. A.:"
  if (!iva) {
    const matchIvaAntes = (textoRecibo || textoCompleto).match(/(\d[\d,]*\.\d{2})\s*\n\s*I\.?\s*V\.?\s*A\.?\s*:?\s*$/im);
    if (matchIvaAntes) {
      iva = limpiarMonto(matchIvaAntes[1]);
    }
  }

  // Estrategia 3: "I.V.A.:" directo (solo si > 0)
  if (!iva) {
    const ivaDirecto = limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?\s*:\s*(\d[\d,]*\.\d{2})/i, textoRecibo))
      || limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?\s*:\s*(\d[\d,]*\.\d{2})/i, textoPrima))
      || limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?\s*:\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
    if (ivaDirecto && parseFloat(ivaDirecto) > 0) {
      iva = ivaDirecto;
    }
  }

  const subtotal = limpiarMonto(extraerDato(/Sub\s*total:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Sub\s*Total:\s*\n?\s*([\d,]+\.?\d*)/i, textoPrima))
    || limpiarMonto(extraerDato(/Sub\s*Total:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula))
    || limpiarMonto(extraerDato(/Sub\s*Total:\s*\n?\s*([\d,]+\.?\d*)/i, textoCompleto));

  // Total
  let total = limpiarMonto(extraerDato(/Prima\s+Total:\s*(\d[\d,]*\.\d{2})/i, textoRecibo));
  if (!total) {
    total = limpiarMonto(extraerDato(/Total\s+a\s+pagar:\s*(\d[\d,]*\.\d{2})/i, textoPrima))
      || limpiarMonto(extraerDato(/Total\s+a\s+pagar:\s*(\d[\d,]*\.\d{2})/i, textoCaratula))
      || limpiarMonto(extraerDato(/Total\s+a\s+pagar:\s*(\d[\d,]*\.\d{2})/i, textoCompleto))
      || limpiarMonto(extraerDato(/Prima\s+Total:\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  }
  if (!total) {
    total = limpiarMonto(extraerDato(/Total\s+a\s+pagar:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoPrima))
      || limpiarMonto(extraerDato(/Total\s+a\s+pagar:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  }

  // Primer recibo y subsecuentes
  let primerRecibo = limpiarMonto(extraerDato(/Primer\s+Recibo:\s*(\d[\d,]*\.\d{2})/i, textoRecibo))
    || limpiarMonto(extraerDato(/Primer\s+Recibo:\s*(\d[\d,]*\.\d{2})/i, textoPrima))
    || limpiarMonto(extraerDato(/Primer\s+Recibo:\s*(\d[\d,]*\.\d{2})/i, textoCaratula))
    || limpiarMonto(extraerDato(/Primer\s+Recibo:\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  if (!primerRecibo) {
    primerRecibo = limpiarMonto(extraerDato(/Primer\s+Recibo:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoPrima))
      || limpiarMonto(extraerDato(/Primer\s+Recibo:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoRecibo))
      || limpiarMonto(extraerDato(/Primer\s+Recibo:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  }

  let subsecuentes = limpiarMonto(extraerDato(/Subsecuentes:\s*(\d[\d,]*\.\d{2})/i, textoRecibo))
    || limpiarMonto(extraerDato(/Subsecuentes:\s*(\d[\d,]*\.\d{2})/i, textoPrima))
    || limpiarMonto(extraerDato(/Subsecuentes:\s*(\d[\d,]*\.\d{2})/i, textoCaratula))
    || limpiarMonto(extraerDato(/Subsecuentes:\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  if (!subsecuentes) {
    subsecuentes = limpiarMonto(extraerDato(/Subsecuentes:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoPrima))
      || limpiarMonto(extraerDato(/Subsecuentes:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoRecibo))
      || limpiarMonto(extraerDato(/Subsecuentes:[^\n]*\n\s*(\d[\d,]*\.\d{2})/i, textoCompleto));
  }

  console.log('🔍 DEBUG IVA:', iva, '| Primer Recibo:', primerRecibo, '| Subsecuentes:', subsecuentes);
  console.log('🔍 DEBUG Total:', total, '| Subtotal:', subtotal, '| Recargo:', recargo, '| Gastos:', gastosExpedicion);

  // ==================== FORMA Y PERIODO DE PAGO ====================
  const periodoPago = extraerDato(/Forma\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoRecibo)
    || extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoRecibo)
    || extraerDato(/Forma\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoPrima)
    || extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoPrima)
    || extraerDato(/Forma\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula)
    || extraerDato(/Forma\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto)
    || extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto)
    || extraerDato(/Periodo\s+de\s+pago:\s*\n\s*([A-ZÁÉÍÓÚÑ]+)/i, textoPrima)
    || extraerDato(/Periodo\s+de\s+pago:\s*\n\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto)
    || extraerDato(/Forma\s+de\s+pago:\s*\n\s*([A-ZÁÉÍÓÚÑ]+)/i, textoPrima)
    || extraerDato(/Forma\s+de\s+pago:\s*\n\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto);

  console.log('🔍 DEBUG periodoPago detectado:', periodoPago);

  let tipoPago = 'Anual';
  let frecuenciaPago = 'Anual';
  const periodoUpper = (periodoPago || '').toUpperCase();

  if (periodoUpper.includes('ANUAL') || periodoUpper.includes('UNA SOLA')) {
    tipoPago = 'Anual';
    frecuenciaPago = 'Anual';
  } else if (periodoUpper.includes('SEMEST')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Semestral';
  } else if (periodoUpper.includes('TRIM')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Trimestral';
  } else if (periodoUpper.includes('MENS')) {
    tipoPago = 'Fraccionado';
    frecuenciaPago = 'Mensual';
  }

  // Si hay subsecuentes, es fraccionado — inferir frecuencia
  if (subsecuentes && parseFloat(subsecuentes) > 0) {
    tipoPago = 'Fraccionado';

    if (frecuenciaPago === 'Anual') {
      let totalParaCalc = total ? parseFloat(total) : 0;
      if (!totalParaCalc && subtotal && iva) {
        totalParaCalc = parseFloat(subtotal) + parseFloat(iva);
      }
      const subsNum = parseFloat(subsecuentes);
      const primerNum = primerRecibo ? parseFloat(primerRecibo) : 0;
      if (totalParaCalc > 0 && subsNum > 0) {
        const numSubsecuentes = Math.round((totalParaCalc - primerNum) / subsNum);
        const numPagos = 1 + numSubsecuentes;
        if (numPagos >= 10 && numPagos <= 13) {
          frecuenciaPago = 'Mensual';
        } else if (numPagos >= 3 && numPagos <= 5) {
          frecuenciaPago = 'Trimestral';
        } else if (numPagos === 2) {
          frecuenciaPago = 'Semestral';
        } else if (numPagos >= 6 && numPagos <= 7) {
          frecuenciaPago = 'Bimestral';
        }
        console.log(`📊 Frecuencia inferida: ${frecuenciaPago} (${numPagos} pagos = 1 + ${numSubsecuentes}, totalCalc=${totalParaCalc})`);
      }
    }
  }

  // Calcular total si falta
  if (!total && primerRecibo && subsecuentes && tipoPago === 'Fraccionado') {
    let numPagos = 1;
    if (frecuenciaPago === 'Mensual') numPagos = 12;
    else if (frecuenciaPago === 'Trimestral') numPagos = 4;
    else if (frecuenciaPago === 'Semestral') numPagos = 2;
    else if (frecuenciaPago === 'Bimestral') numPagos = 6;
    if (numPagos > 1) {
      const totalCalc = parseFloat(primerRecibo) + (numPagos - 1) * parseFloat(subsecuentes);
      total = totalCalc.toFixed(2);
      console.log(`📊 Total calculado: ${total} = ${primerRecibo} + ${numPagos - 1} * ${subsecuentes}`);
    }
  }

  const formaPago = frecuenciaPago || periodoPago || '';
  console.log('📊 Tipo pago:', tipoPago, '| Forma pago:', formaPago, '| Periodo detectado:', periodoPago);

  const moneda = extraerDato(/Moneda:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoRecibo)
    || extraerDato(/Moneda:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoPrima)
    || extraerDato(/Moneda:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);

  // ==================== AGENTE ====================
  const agente = extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoRecibo)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoCaratula)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoCompleto)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s*\n|$)/i, textoRecibo)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s*\n|$)/i, textoCaratula);

  const claveAgente = extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoRecibo)
    || extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoCaratula)
    || extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoCompleto);

  // ==================== PERIODO DE GRACIA ====================
  let periodoGracia = '15';
  const periodoGraciaMatch = textoCompleto.match(/(\d+)\s+d[ií]as\s+naturales/i);
  if (periodoGraciaMatch) {
    periodoGracia = periodoGraciaMatch[1];
  }

  // ==================== RESULTADO UNIVERSAL (campos 1-36) ====================
  return {
    // Asegurado (1-11)
    tipo_persona: tipoPersona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc: rfc || '',
    curp: '',
    domicilio: domicilio || '',
    colonia: colonia || '',
    municipio: municipio || '',
    estado: estado || '',
    codigo_postal: codigoPostal || '',
    pais: 'MEXICO',

    // Póliza (12-19)
    compania: 'La Latinoamericana',
    producto: productoLabel,
    etapa_activa: 'Emitida',
    clave_agente: claveAgente || '',
    agente: agente || '',
    sub_agente: '',
    numero_poliza: numeroPoliza || '',
    endoso,
    inciso,
    plan: '',

    // Vigencia (20-23)
    inicio_vigencia: inicioVigencia,
    termino_vigencia: terminoVigencia,
    fecha_emision: fechaEmision,
    fecha_captura: new Date().toISOString().split('T')[0],
    fecha_limite_pago: fechaLimitePago,

    // Financiero (24-36)
    prima_pagada: primaNeta || '',
    prima_neta: primaNeta || '',
    cargo_pago_fraccionado: recargo || '0.00',
    gastos_expedicion: gastosExpedicion || '',
    iva: iva || '',
    subtotal: subtotal || '',
    total: total || '',
    primer_pago: primerRecibo || '',
    pagos_subsecuentes: subsecuentes || '',
    tipo_pago: tipoPago,
    frecuenciaPago,
    forma_pago: formaPago,
    moneda: moneda || 'NAL',
    periodo_gracia: periodoGracia,
    suma_asegurada: '',
    deducible: '',

    // Metadata interna (para uso de extractores de producto)
    _nombreCompleto: nombreCompleto || '',
    _textoRecibo: textoRecibo,
    _textoCaratula: textoCaratula,
    _textoPrima: textoPrima,
    _textoCompleto: textoCompleto,
  };
}

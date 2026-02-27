/**
 * Extractor Especializado: La Latinoamericana Seguros - Autos
 * 
 * Estrategia: La última página (RECIBO DE PRIMAS) contiene la mayoría de 
 * datos relevantes (asegurado, montos, fechas, vigencia, agente).
 * La página 1 (carátula) complementa con datos del vehículo y coberturas.
 * 
 * @module extractors/lalatinoamericana/autos
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
 * Normaliza fecha de formato DD/MM/YYYY a YYYY-MM-DD
 * @param {string} fecha - Fecha en formato DD/MM/YYYY
 * @returns {string} Fecha en formato YYYY-MM-DD o cadena vacía
 */
function normalizarFecha(fecha) {
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
function limpiarMonto(monto) {
  if (!monto) return '';
  return monto.replace(/[,\s]/g, '').trim();
}

/**
 * Extrae información de póliza de La Latinoamericana Autos
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor La Latinoamericana Autos - Iniciando...');

  const { textoCompleto, textoPagina1, todasLasPaginas } = ctx;

  // ==================== ESTRATEGIA: ÚLTIMA PÁGINA (RECIBO DE PRIMAS) ====================
  // Buscar la página que contiene "RECIBO DE PRIMAS" — es la más rica en datos
  let textoRecibo = '';
  if (todasLasPaginas && todasLasPaginas.length > 0) {
    const paginaRecibo = todasLasPaginas.find(p =>
      /RECIBO\s+DE\s+PRIMAS/i.test(p.texto)
    );
    textoRecibo = paginaRecibo ? paginaRecibo.texto : todasLasPaginas[todasLasPaginas.length - 1].texto;
  }
  // Fallback: si no encontramos recibo, usar texto completo
  if (!textoRecibo) {
    textoRecibo = textoCompleto;
  }

  // Página 1 (carátula) para vehículo y coberturas
  const textoCaratula = textoPagina1 || '';

  console.log('📄 Recibo encontrado:', textoRecibo.length, 'chars');
  console.log('📄 Carátula:', textoCaratula.length, 'chars');

  // ==================== RFC ====================
  let rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoRecibo);
  if (!rfc) {
    rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCaratula);
  }
  const tipoPersona = rfc.length === 13 ? 'Fisica' : rfc.length === 12 ? 'Moral' : 'Fisica';

  // ==================== ASEGURADO ====================
  // En el recibo: "Nombre:\nLAURA ANDREA LEON GARCIA" o "Nombre: LAURA ANDREA..."
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
      // Intentar separar: asumimos NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO
      const partes = nombreCompleto.split(/\s+/);
      if (partes.length >= 4) {
        // 4+ partes: últimas 2 son apellidos, el resto es nombre
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
  // Recibo: "Número de Póliza: 04-000112286" o "Póliza: 04-000112286"
  let numeroPoliza = extraerDato(/N[uú]mero\s+de\s+P[oó]liza:\s*(\S+)/i, textoRecibo);
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza:\s*(\d[\d-]+)/i, textoRecibo);
  }
  if (!numeroPoliza) {
    numeroPoliza = extraerDato(/P[oó]liza:\s*(\d[\d-]+)/i, textoCaratula);
  }
  // Limpiar espacios
  numeroPoliza = (numeroPoliza || '').replace(/\s/g, '');

  // ==================== ENDOSO E INCISO ====================
  const endoso = extraerDato(/Endoso(?:\s+N[uú]m)?:\s*(\S+)/i, textoRecibo) || '000000';
  const inciso = extraerDato(/Inciso:\s*(\S+)/i, textoCaratula) || '0001';

  // ==================== DOMICILIO ====================
  const domicilio = extraerDato(/Domicilio\s+de\s+cobro:\s*(.+?)(?:\n|$)/i, textoRecibo)
    || extraerDato(/Calle\s+y\s+n[uú]mero:\s*(.+?)(?:\n|$)/i, textoCaratula);

  const codigoPostal = extraerDato(/C[oó]digo\s*Postal:\s*(\d{4,5})/i, textoRecibo)
    || extraerDato(/C[oó]digo\s*Postal:\s*(\d{4,5})/i, textoCaratula);

  const colonia = extraerDato(/Colonia:\s*(.+?)(?:\n|$)/i, textoCaratula);

  // Entidad (estado) — en recibo puede ser "Entidad: ATIZAPÁN DE\nZARAGOZA"
  let estado = extraerDato(/Entidad:\s*(.+?)(?:\n|$)/i, textoRecibo);
  if (!estado) {
    estado = extraerDato(/Estado:\s*(.+?)(?:\n|$)/i, textoCaratula);
  }

  const municipio = extraerDato(/Poblaci[oó]n:\s*(.+?)(?:\n|$)/i, textoCaratula);

  // ==================== FECHAS ====================
  // Fecha de emisión
  const fechaEmisionRaw = extraerDato(/Fecha\s+de\s+emisi[oó]n:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoRecibo)
    || extraerDato(/Fecha\s+de\s+emisi[oó]n:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoCaratula);
  const fechaEmision = normalizarFecha(fechaEmisionRaw) || new Date().toISOString().split('T')[0];

  // Fecha límite de pago
  const fechaLimitePagoRaw = extraerDato(/Fecha\s+l[ií]mite\s+de\s+pago:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i, textoRecibo);
  const fechaLimitePago = normalizarFecha(fechaLimitePagoRaw);

  // Vigencia — "Desde las 12 hrs. del (día/mes/año): 29/10/2025 Hasta las 12 hrs. del (día/mes/año): 29/10/2026"
  const vigenciaDesdeRaw = extraerDato(/Desde\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoRecibo)
    || extraerDato(/Vigencia\s+Desde\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula);
  const vigenciaHastaRaw = extraerDato(/Hasta\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoRecibo)
    || extraerDato(/Hasta\s+las\s+12\s+hrs\.?\s+del\s+\(d[ií]a\/mes\/a[nñ]o\):\s*(\d{1,2}\/\d{1,2}\/\d{4})/i, textoCaratula);

  const inicioVigencia = normalizarFecha(vigenciaDesdeRaw);
  const terminoVigencia = normalizarFecha(vigenciaHastaRaw);

  // ==================== MONTOS (del RECIBO DE PRIMAS) ====================
  const primaNeta = limpiarMonto(extraerDato(/Prima\s+neta:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Prima\s+Neta:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));

  const gastosExpedicion = limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Gastos\s+de\s+Expedici[oó]n:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));

  const recargo = limpiarMonto(extraerDato(/Recargo(?:\s+por\s+Pago\s+Fraccionado)?:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Recargo\s+por\s+Pago\s+Fraccionado:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));

  const iva = limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/I\.?\s*V\.?\s*A\.?:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));

  const subtotal = limpiarMonto(extraerDato(/Sub\s*total:\s*([\d,]+\.?\d*)/i, textoRecibo))
    || limpiarMonto(extraerDato(/Sub\s*Total:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));

  // Total — "Prima Total:\n7,062.65" o "Total a pagar:\n7,062.65"
  let total = limpiarMonto(extraerDato(/Prima\s+Total:\s*\n?\s*([\d,]+\.?\d*)/i, textoRecibo));
  if (!total) {
    total = limpiarMonto(extraerDato(/Total\s+a\s+pagar:\s*\n?\s*([\d,]+\.?\d*)/i, textoCaratula));
  }

  // Primer recibo y subsecuentes (de la carátula o texto completo)
  const primerRecibo = limpiarMonto(extraerDato(/Primer\s+Recibo:\s*([\d,]+\.?\d*)/i, textoCaratula))
    || limpiarMonto(extraerDato(/Primer\s+Recibo:\s*([\d,]+\.?\d*)/i, textoCompleto));
  const subsecuentes = limpiarMonto(extraerDato(/Subsecuentes:\s*([\d,]+\.?\d*)/i, textoCaratula))
    || limpiarMonto(extraerDato(/Subsecuentes:\s*([\d,]+\.?\d*)/i, textoCompleto));

  // ==================== FORMA Y PERIODO DE PAGO ====================
  const periodoPago = extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoRecibo)
    || extraerDato(/Periodo\s+de\s+pago:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);

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

  // Si hay subsecuentes, es fraccionado
  if (subsecuentes && parseFloat(subsecuentes) > 0) {
    tipoPago = 'Fraccionado';
  }

  const formaPago = periodoPago || '';
  const moneda = extraerDato(/Moneda:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoRecibo)
    || extraerDato(/Moneda:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);

  // ==================== AGENTE ====================
  // "Agente ANGELICA VERONICA RAMIREZ SANABRIA Clave 11486 Clave Promotor 787"
  // Buscar en recibo, carátula y texto completo (algunas pólizas lo tienen solo en pág 1)
  const agente = extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoRecibo)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoCaratula)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)\s+Clave\s/i, textoCompleto)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s*\n|$)/i, textoRecibo)
    || extraerDato(/Agente\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\s*\n|$)/i, textoCaratula);
  // Para clave agente, buscar específicamente "Agente...Clave NNNN" para no confundir con "Clave:" del vehículo
  const claveAgente = extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoRecibo)
    || extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoCaratula)
    || extraerDato(/Agente\s+[A-ZÁÉÍÓÚÑ\s]+?Clave\s+(\d+)/i, textoCompleto);

  // ==================== NÚMERO DE RECIBO ====================
  const numeroRecibo = extraerDato(/N[uú]mero\s+de\s+recibo:\s*(\S+)/i, textoRecibo);

  // ==================== VEHÍCULO (de la CARÁTULA — página 1) ====================
  const marca = extraerDato(/Marca:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCaratula);

  // "Descripción: ENCORE LEATHERETTE 1.4L TURBO 138 RA18 IMP AUT ABS 05 05 AC VE..."
  const descripcion = extraerDato(/Descripci[oó]n:\s*(.+?)(?:\.\n|\n)/i, textoCaratula);

  // Modelo (año)
  const anio = extraerDato(/Modelo:\s*(\d{4})/i, textoCaratula);

  // Serie / VIN
  const serie = extraerDato(/Serie:\s*([A-Z0-9]+)/i, textoCaratula);

  // Motor
  const motor = extraerDato(/Motor:\s*(.+?)(?:\s{2,}|Ocupantes|$)/i, textoCaratula);

  // Placas
  const placas = extraerDato(/Placas:\s*([A-Z0-9]+)/i, textoCaratula);

  // Uso
  const uso = extraerDato(/Uso:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);

  // Tipo
  const tipoVehiculo = extraerDato(/Tipo:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);

  // Ocupantes
  const ocupantes = extraerDato(/Ocupantes:\s*(\d+)/i, textoCaratula);

  // Clave vehicular
  const claveVehicular = extraerDato(/Clave:\s*([A-Z0-9]+)/i, textoCaratula);

  // ==================== TIPO DE COBERTURA ====================
  // Buscar "COBERTURA AMPLIA", "COBERTURA LIMITADA", etc. en carátula
  let tipoCobertura = '';
  if (/COBERTURA\s+AMPLIA/i.test(textoCaratula)) {
    tipoCobertura = 'Amplia';
  } else if (/COBERTURA\s+LIMITADA/i.test(textoCaratula)) {
    tipoCobertura = 'Limitada';
  } else if (/RESPONSABILIDAD\s+CIVIL/i.test(textoCaratula) && !/COBERTURA\s+(AMPLIA|LIMITADA)/i.test(textoCaratula)) {
    tipoCobertura = 'RC';
  }

  // Suma asegurada — tomar de "Valor Comercial" en la primera cobertura de daños materiales
  const sumaAsegurada = limpiarMonto(
    extraerDato(/DA[NÑ]OS\s+MATERIALES\s+\d+\s+Valor\s+Comercial\s+([\d,]+\.?\d*)/i, textoCaratula)
  );

  // Deducible
  const deducible = extraerDato(/DA[NÑ]OS\s+MATERIALES\s+(\d+)/i, textoCaratula) || '5';

  // ==================== COBERTURAS (de la carátula) ====================
  let coberturas = [];
  // Patrón: "NOMBRE_COBERTURA  DEDUCIBLE%  SUMA_ASEGURADA  PRIMA"
  // La estructura de La Latino es: NOMBRE % | Valor Comercial | Amparada  + prima al final
  const bloqueCobert = textoCaratula.match(/Coberturas\s+Amparadas\s+Primas([\s\S]*?)(?:Agente|Prima\s+Neta|6\.\s+PRIMA)/i);
  if (bloqueCobert) {
    const lineas = bloqueCobert[1].split('\n').filter(l => l.trim().length > 0);
    let coberturaPendiente = null;

    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      if (!lineaLimpia) continue;

      // Patrón con monto: "DANOS MATERIALES 5      Valor Comercial 3,242.81"
      let match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+(\d+)\s+Valor\s+Comercial\s+([\d,]+\.?\d*)/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: match[2] + '%',
          suma_asegurada: 'VALOR COMERCIAL',
          prima: limpiarMonto(match[3])
        };
        continue;
      }

      // Patrón con monto fijo: "RESPONSABILIDAD CIVIL L.U.C.* 3,000,000.00 362.55"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.?\d*)$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: 'N/A',
          suma_asegurada: limpiarMonto(match[2]),
          prima: limpiarMonto(match[3])
        };
        continue;
      }

      // Patrón amparada con prima: "ROTURA DE CRISTALES 20  Amparada"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+(\d+)\s+Amparada/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: match[2] + '%',
          suma_asegurada: 'AMPARADA',
          prima: '0.00'
        };
        continue;
      }

      // Patrón amparada con prima al final: "ASESORIA LEGAL, FIANZAS Y/O CAUCIONES Amparada 650.00"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s,./]+?)\s+Amparada\s+([\d,]+\.?\d*)/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: 'N/A',
          suma_asegurada: 'AMPARADA',
          prima: limpiarMonto(match[2])
        };
        continue;
      }

      // Patrón solo amparada: "ASISTENCIA VIAL Amparada"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+Amparada\s*$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: 'N/A',
          suma_asegurada: 'AMPARADA',
          prima: '0.00'
        };
        continue;
      }

      // Patrón: "ACCIDENTES AL CONDUCTOR 100,000.00 12.34"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = {
          nombre: match[1].trim(),
          deducible: 'N/A',
          suma_asegurada: limpiarMonto(match[2]),
          prima: limpiarMonto(match[3])
        };
        continue;
      }

      // Línea de continuación (ej: "A TERCERAS PERSONAS")
      // Si empieza con letra y no matchea nada, es continuación del nombre anterior
      if (coberturaPendiente && /^[A-ZÁÉÍÓÚÑ]/.test(lineaLimpia)) {
        // Puede tener prima al final: "A TERCERAS PERSONAS\n3,000,000.00 339.95"
        match = lineaLimpia.match(/^([\d,]+\.\d{2})\s+([\d,]+\.?\d*)$/);
        if (match) {
          coberturaPendiente.suma_asegurada = limpiarMonto(match[1]);
          coberturaPendiente.prima = limpiarMonto(match[2]);
          continue;
        }
        // Solo texto: agregar al nombre
        coberturaPendiente.nombre += ' ' + lineaLimpia;
      }
    }
    if (coberturaPendiente) coberturas.push(coberturaPendiente);
  }

  // ==================== PERIODO DE GRACIA ====================
  // "el término máximo para el pago de la prima anual o primera fracción o subsecuentes será de 15 días naturales"
  let periodoGracia = '15'; // default para La Latinoamericana
  const periodoGraciaMatch = textoCompleto.match(/(\d+)\s+d[ií]as\s+naturales/i);
  if (periodoGraciaMatch) {
    periodoGracia = periodoGraciaMatch[1];
  }

  // ==================== RESULTADO ====================
  const datosExtraidos = {
    // Asegurado
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

    // Póliza
    compania: 'La Latinoamericana',
    producto: 'Autos',
    etapa_activa: 'Emitida',
    clave_agente: claveAgente || '',
    agente: agente || '',
    sub_agente: '',
    numero_poliza: numeroPoliza || '',
    endoso: endoso,
    inciso: inciso,
    plan: tipoCobertura || '',

    // Vigencia
    inicio_vigencia: inicioVigencia,
    termino_vigencia: terminoVigencia,
    fecha_emision: fechaEmision,
    fecha_captura: new Date().toISOString().split('T')[0],
    fecha_limite_pago: fechaLimitePago,

    // Financiero  
    prima_pagada: primaNeta || '',
    cargo_pago_fraccionado: recargo || '0.00',
    gastos_expedicion: gastosExpedicion || '',
    iva: iva || '',
    subtotal: subtotal || '',
    total: total || primerRecibo || '',
    primer_pago: primerRecibo || '',
    pagos_subsecuentes: subsecuentes || '',
    tipo_pago: tipoPago,
    frecuenciaPago: frecuenciaPago,
    forma_pago: formaPago,
    moneda: moneda || 'NAL',
    periodo_gracia: periodoGracia,
    suma_asegurada: sumaAsegurada || '',
    deducible: deducible,

    // Vehículo
    marca: marca || '',
    modelo: descripcion || '',
    anio: anio || '',
    numero_serie: serie || '',
    motor: motor || '',
    placas: placas || '',
    color: '',
    codigo_vehiculo: claveVehicular || '',
    tipo_vehiculo: tipoVehiculo || '',
    tipo_cobertura: tipoCobertura || '',
    uso: uso || '',
    servicio: '',
    capacidad: ocupantes || '',

    // Coberturas
    coberturas,

    // Conductor
    conductor_habitual: nombreCompleto || ''
  };

  console.log('✅ Extractor La Latinoamericana Autos - Completado');
  console.log('📊 Datos extraídos:', {
    asegurado: tipoPersona === 'Moral' ? razonSocial : `${nombre} ${apellido_paterno}`,
    poliza: numeroPoliza,
    vehiculo: `${marca} ${descripcion || ''}`.trim(),
    vigencia: `${inicioVigencia} - ${terminoVigencia}`,
    total: total,
    fechaLimite: fechaLimitePago
  });

  return datosExtraidos;
}

export default { extraer };

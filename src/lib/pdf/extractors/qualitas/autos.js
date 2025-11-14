/**
 * Extractor Especializado: Qualitas - Autos
 * 
 * Extrae información de pólizas de autos de Qualitas Seguros.
 * Migrado desde el código legacy en Expedientes.jsx
 * 
 * @module extractors/qualitas/autos
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
 * Extrae información de póliza de Qualitas Autos
 * @param {Object} ctx - Contexto con textos del PDF
 * @param {string} ctx.textoCompleto - Texto completo del PDF (ambas páginas)
 * @param {string} ctx.textoPagina1 - Texto de página 1
 * @param {string} ctx.textoPagina2 - Texto de página 2
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor Qualitas Autos - Iniciando...');
  
  const { textoCompleto, textoPagina1, textoPagina2 } = ctx;
  
  // Por compatibilidad con código legacy, usar textoPagina2 como textoCompleto principal
  const textoQualitas = textoPagina2 || textoCompleto;
  
  const compania = 'Qualitas';
  
  // ==================== MESES ====================
  const meses = {
    'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
  };
  
  // ==================== RFC Y TIPO DE PERSONA ====================
  const rfcMatch = textoQualitas.match(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i);
  let rfcExtraido = rfcMatch ? rfcMatch[1] : '';
  
  if (!rfcExtraido || rfcExtraido.trim() === '') {
    console.warn('⚠️ RFC no encontrado en el PDF de Qualitas');
    rfcExtraido = '';
  }
  
  const tipoPersona = rfcExtraido.length === 13 ? 'Fisica' : rfcExtraido.length === 12 ? 'Moral' : 'Fisica';
  
  console.log('🔍 RFC extraído:', rfcExtraido || '❌ NO ENCONTRADO', '- Tipo:', tipoPersona);
  
  // ==================== ASEGURADO ====================
  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';
  
  const nombreMatch = textoQualitas.match(/INFORMACI[OÓ]N\s+DEL\s+ASEGURADO\s+([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,10})(?=\s*Domicilio|\s*\n)/i);
  if (nombreMatch) {
    const nombreCompleto = nombreMatch[1].trim();
    
    if (tipoPersona === 'Moral') {
      razonSocial = nombreCompleto;
      console.log('🏢 Razón Social (Persona Moral):', razonSocial);
    } else {
      const palabras = nombreCompleto.split(/\s+/);
      
      if (palabras.length === 4) {
        nombre = `${palabras[0]} ${palabras[1]}`;
        apellido_paterno = palabras[2];
        apellido_materno = palabras[3];
      } else if (palabras.length === 3) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
        apellido_materno = palabras[2];
      } else if (palabras.length === 2) {
        nombre = palabras[0];
        apellido_paterno = palabras[1];
      } else {
        nombre = palabras[0] || nombreCompleto;
      }
      console.log('👤 Nombre (Persona Física):', { nombre, apellido_paterno, apellido_materno });
    }
  }
  
  // ==================== UBICACIÓN ====================
  const domicilioMatch = textoQualitas.match(/Domicilio:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,\.#\-]+?)(?=\s*R\.F\.C\.|C\.P\.|Estado:|\n\n)/i);
  const domicilio = domicilioMatch ? domicilioMatch[1].trim() : '';
  
  const cpMatch = textoQualitas.match(/C\.P\.:\s*(\d{5})/i);
  const municipioMatch = textoQualitas.match(/Municipio:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Estado:|\n)/i);
  const estadoMatch = textoQualitas.match(/Estado:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Colonia:|\n)/i);
  const coloniaMatch = textoQualitas.match(/Colonia:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s|$|\n)/i);
  const paisMatch = textoQualitas.match(/Pa[ií]s:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s|$|\n)/i);
  
  const codigo_postal = cpMatch ? cpMatch[1] : '';
  const municipio = municipioMatch ? municipioMatch[1].trim() : '';
  const estado = estadoMatch ? estadoMatch[1].trim() : '';
  const colonia = coloniaMatch ? coloniaMatch[1].trim() : '';
  const pais = paisMatch ? paisMatch[1].trim() : 'MEXICO';
  
  // ==================== AGENTE ====================
  let agente = '';
  const agenteMatch1 = textoPagina1.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
  const agenteMatch2 = textoQualitas.match(/Agente:\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s]+?)(?=Teléfono|Canal|\n|$)/i);
  
  if (agenteMatch1) {
    agente = `${agenteMatch1[1]} - ${agenteMatch1[2].trim()}`;
  } else if (agenteMatch2) {
    agente = `${agenteMatch2[1]} - ${agenteMatch2[2].trim()}`;
  }
  
  // ==================== PÓLIZA ====================
  let polizaNum = '', endosoNum = '', incisoNum = '';
  
  const lineaNumeros2 = textoQualitas.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
  const lineaNumeros1 = textoPagina1.match(/(\d{10})\s+(\d{6})\s+(\d{4})/);
  
  if (lineaNumeros2) {
    polizaNum = lineaNumeros2[1];
    endosoNum = lineaNumeros2[2];
    incisoNum = lineaNumeros2[3];
  } else if (lineaNumeros1) {
    polizaNum = lineaNumeros1[1];
    endosoNum = lineaNumeros1[2];
    incisoNum = lineaNumeros1[3];
  }
  
  const planMatch = textoQualitas.match(/PLAN:\s*([A-Z]+)/i) || textoPagina1.match(/PLAN:\s*([A-Z]+)/i);
  
  // ==================== CURP ====================
  const curpMatch = textoQualitas.match(/C\.?\s*U\.?\s*R\.?\s*P\.?\s*[:.\s]*([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2})/i);
  
  // ==================== VEHÍCULO ====================
  const descripcionMatch = textoQualitas.match(/(\d{3,6})\s*\(?[A-Z0-9]*\)?\s*([A-Z]+)\s+([A-Z0-9\s\-\.]+?)(?=Tipo:|Serie:|Motor:|Modelo:|$)/i);
  const serieMatch = textoQualitas.match(/Serie[:\s]+([A-Z0-9]{17})/i);
  const motorMatch = textoQualitas.match(/Motor[:\s]+([A-Z0-9\-]{3,})(?=\s|$)/i);
  const modeloAnioMatch = textoQualitas.match(/Modelo:\s*(\d{4})/i);
  
  let placasExtraidas = '';
  const placasMatch = textoQualitas.match(/Placas:\s*([A-Z0-9\-]{3,10})(?=\s|$|\n)/i);
  if (placasMatch) {
    const posiblePlaca = placasMatch[1].toUpperCase();
    const esPlacaValida = posiblePlaca.length >= 3 && 
                          posiblePlaca.length <= 10 && 
                          !/^(VIGENCIA|AMPARADA|NA|N\/A|SIN|NINGUNA|TEMPORAL|PENDIENTE)$/i.test(posiblePlaca);
    
    if (esPlacaValida) {
      placasExtraidas = posiblePlaca;
    }
  }
  
  const colorMatch = textoQualitas.match(/Color:\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)*?)(?=\s+Placas|\s+Ocupantes|\n|$)/i);
  
  let marca = '';
  let modeloCompleto = '';

  if (descripcionMatch) {
    marca = descripcionMatch[2];
    modeloCompleto = descripcionMatch[3].trim();
  } else {
    const altMatch = textoQualitas.match(/\d{3,6}\s*\(?[A-Z0-9]*\)?\s*([A-Z]+)\s+([A-Z0-9\s\-\.]+?)(?=\s*Tipo:|\s*Serie:|Motor:|Modelo:|\n)/i);
    if (altMatch) {
      marca = altMatch[1];
      modeloCompleto = altMatch[2].trim();
    } else {
      const marcasFallback = [
        'AUDI','BMW','CHEVROLET','CHRYSLER','DODGE','FIAT','FORD','HONDA','HYUNDAI','JEEP','KIA','MAZDA','MERCEDES','MERCEDES-BENZ','MITSUBISHI','NISSAN','PEUGEOT','PORSCHE','RENAULT','SEAT','SUZUKI','TOYOTA','VOLKSWAGEN','VOLVO'
      ];
      const marcasRegex = new RegExp(`\\b(${marcasFallback.join('|')})\\b\\s+([A-Z0-9][A-Z0-9\\s\-\.]{3,})`, 'i');
      const fallbackMatch = textoQualitas.match(marcasRegex);
      if (fallbackMatch) {
        marca = fallbackMatch[1];
        modeloCompleto = fallbackMatch[2]
          .split(/\s+(?:Tipo:|Serie:|Motor:|Modelo:)/i)[0]
          .trim();
      }
    }
  }
  
  // ==================== VIGENCIA ====================
  const desdeMatch = textoQualitas.match(/Desde\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
  const hastaMatch = textoQualitas.match(/Hasta\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
  
  // ==================== PERIODO DE GRACIA ====================
  const plazoMatch = textoQualitas.match(/Plazo\s+de\s+pago:\s*(\d+)\s*d[ií]as/i);
  const periodoGraciaExtraido = plazoMatch ? plazoMatch[1] : '14';
  
  // ==================== FORMA DE PAGO ====================
  const seccionGastosAPago = textoQualitas.match(/Gastos\s+por\s+Expedici[oó]n[.\s]+[\d,]+\.?\d*\s+([\s\S]{0,100}?)Pago:/i);
  
  let formaPagoEncontrada = null;
  
  if (seccionGastosAPago) {
    const textoEntreGastosYPago = seccionGastosAPago[1].trim();
    const match = textoEntreGastosYPago.match(/(TRIMESTRAL|MENSUAL|SEMESTRAL|ANUAL|BIMESTRAL|CUATRIMESTRAL|CONTADO)/i);
    
    if (match) {
      formaPagoEncontrada = match[1].toUpperCase();
    }
  }
  
  const formaPagoMatch = formaPagoEncontrada ? [null, formaPagoEncontrada] : null;
  
  const primerPagoMatch = textoQualitas.match(/Primer\s+pago\s+([\d,]+\.?\d*)/i);
  const pagosSubMatch =
    textoQualitas.match(/Pago\(s\)\s*Subsecuente\(s\)\s+([\d,]+\.?\d*)/i) ||
    textoQualitas.match(/Pagos?\s+subsecuentes?\s+([\d,]+\.?\d*)/i);

  const formaPagoDetectada = formaPagoMatch ? formaPagoMatch[1].trim().toUpperCase() : '';
  const primerPago = primerPagoMatch ? primerPagoMatch[1].replace(/,/g, '') : '';
  const pagosSubsecuentes = pagosSubMatch ? pagosSubMatch[1].replace(/,/g, '') : '';

  let tipoPagoDetectado = '';
  let frecuenciaPagoDetectada = '';
  
  if (formaPagoDetectada) {
    const f = formaPagoDetectada.toLowerCase();
    
    if (f.includes('tri')) {
      tipoPagoDetectado = 'Fraccionado';
      frecuenciaPagoDetectada = 'Trimestral';
    } else if (f.includes('men')) {
      tipoPagoDetectado = 'Fraccionado';
      frecuenciaPagoDetectada = 'Mensual';
    } else if (f.includes('sem')) {
      tipoPagoDetectado = 'Fraccionado';
      frecuenciaPagoDetectada = 'Semestral';
    } else if (f.includes('bim')) {
      tipoPagoDetectado = 'Fraccionado';
      frecuenciaPagoDetectada = 'Bimestral';
    } else if (f.includes('cuat')) {
      tipoPagoDetectado = 'Fraccionado';
      frecuenciaPagoDetectada = 'Cuatrimestral';
    } else if (f.includes('anu') || f.includes('contado')) {
      tipoPagoDetectado = 'Anual';
      frecuenciaPagoDetectada = 'Anual';
    } else {
      tipoPagoDetectado = 'Anual';
      frecuenciaPagoDetectada = 'Anual';
    }
  }
  
  // ==================== USO / SERVICIO / MOVIMIENTO ====================
  const usoMatch = textoQualitas.match(/Uso:\s*([A-ZÁÉÍÓÚÑ]+)/i);
  const servicioMatch = textoQualitas.match(/Servicio:\s*([A-ZÁÉÍÓÚÑ]+)/i);
  const movimientoMatch = textoQualitas.match(/Movimiento:\s*([A-ZÁÉÍÓÚÑ]+)/i);
  
  // ==================== COBERTURAS ====================
  const coberturasSeccion = textoQualitas.match(/COBERTURAS\s+CONTRATADAS\s+SUMA\s+ASEGURADA\s+DEDUCIBLE\s+\$\s+PRIMAS([\s\S]*?)(?=Para\s+RC\s+en\s+el\s+extranjero|Quedan\s+excluidos|Textos:|Forma\s+de|$)/i);
  
  let coberturasExtraidas = [];
  
  if (coberturasSeccion) {
    const textoCobertura = coberturasSeccion[1];
    const lineas = textoCobertura.split('\n').filter(l => l.trim().length > 0);
    
    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      if (!lineaLimpia) continue;
      
      let match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+(\d+)%\s+([\d,]+\.?\d*)/i);
      if (match) {
        coberturasExtraidas.push({
          nombre: match[1].trim(),
          suma_asegurada: match[2].replace(/,/g, ''),
          deducible: match[3] + '%',
          prima: match[4].replace(/,/g, ''),
          tipo: 'monto'
        });
        continue;
      }
      
      match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+POR\s+EVENTO\s+(.+?)\s+([\d,]+\.?\d*)/i);
      if (match) {
        coberturasExtraidas.push({
          nombre: match[1].trim(),
          suma_asegurada: match[2].replace(/,/g, ''),
          deducible: match[3].trim(),
          prima: match[4].replace(/,/g, ''),
          tipo: 'por_evento'
        });
        continue;
      }
      
      match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s.]+?)\s+AMPARADA\s+([\d,]+\.?\d*)/i);
      if (match) {
        coberturasExtraidas.push({
          nombre: match[1].trim(),
          suma_asegurada: 'AMPARADA',
          deducible: 'N/A',
          prima: match[2].replace(/,/g, ''),
          tipo: 'amparada'
        });
        continue;
      }
      
      match = lineaLimpia.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+?)\s+\$\s*([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/i);
      if (match) {
        coberturasExtraidas.push({
          nombre: match[1].trim(),
          suma_asegurada: match[2].replace(/,/g, ''),
          deducible: 'N/A',
          prima: match[3].replace(/,/g, ''),
          tipo: 'monto'
        });
      }
    }
  }
  
  // ==================== MONTOS ====================
  const sumaMatch = textoQualitas.match(/Daños\s+materiales\s+\$\s*([\d,]+\.?\d*)/i);
  const primaMatch = textoQualitas.match(/Prima\s+Neta\s+([\d,]+\.?\d*)/i);
  const tasaFinanciamientoMatch = textoQualitas.match(/Tasa\s+Financiamiento\s+([-]?[\d,]+\.?\d*)/i);
  const gastosExpedicionMatch = textoQualitas.match(/Gastos\s+por\s+Expedici[oó]n[.\s]+([\d,]+\.?\d*)/i);
  const subtotalMatch = textoQualitas.match(/Subtotal\s+([\d,]+\.?\d*)/i);
  const ivaMatch = textoQualitas.match(/I\.V\.A[.\s]*16%\s+([\d,]+\.?\d*)/i);
  const totalMatch = textoQualitas.match(/IMPORTE\s+TOTAL\s+([\d,]+\.?\d*)/i);
  const pagoUnicoMatch = textoQualitas.match(/Pago\s+[UÚ]nico\s+([\d,]+\.?\d*)/i);
  const deducibleMatch = textoQualitas.match(/(\d+)%\s+[\d,]+\.?\d*\s+Robo/i);
  
  // ==================== RESULTADO ====================
  const datosExtraidos = {
    // Asegurado
    tipo_persona: tipoPersona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc: rfcExtraido || '',
    curp: curpMatch ? curpMatch[1] : '',
    domicilio,
    municipio,
    colonia,
    estado,
    codigo_postal,
    pais,
    email: extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoQualitas),
    
    // Póliza
    compania,
    producto: 'Autos Individual',
    etapa_activa: 'Emitida',
    agente,
    sub_agente: '',
    numero_poliza: polizaNum,
    endoso: endosoNum,
    inciso: incisoNum,
    plan: planMatch ? planMatch[1] : '',
    
    // Vigencia
    inicio_vigencia: desdeMatch ? `${desdeMatch[3]}-${meses[desdeMatch[2]]}-${desdeMatch[1]}` : '',
    termino_vigencia: hastaMatch ? `${hastaMatch[3]}-${meses[hastaMatch[2]]}-${hastaMatch[1]}` : '',
    
    // Financiero
    prima_pagada: primaMatch ? primaMatch[1].replace(/,/g, '') : '',
    cargo_pago_fraccionado: tasaFinanciamientoMatch ? tasaFinanciamientoMatch[1].replace(/,/g, '') : '',
    gastos_expedicion: gastosExpedicionMatch ? gastosExpedicionMatch[1].replace(/,/g, '') : '',
    subtotal: subtotalMatch ? subtotalMatch[1].replace(/,/g, '') : '',
    iva: ivaMatch ? ivaMatch[1].replace(/,/g, '') : '',
    total: totalMatch ? totalMatch[1].replace(/,/g, '') : '',
    pago_unico: pagoUnicoMatch ? pagoUnicoMatch[1].replace(/,/g, '') : '',
    tipo_pago: tipoPagoDetectado,
    frecuenciaPago: frecuenciaPagoDetectada,
    forma_pago: formaPagoDetectada || '',
    primer_pago: primerPago,
    pagos_subsecuentes: pagosSubsecuentes,
    periodo_gracia: periodoGraciaExtraido,
    suma_asegurada: sumaMatch ? sumaMatch[1].replace(/,/g, '') : '',
    deducible: deducibleMatch ? deducibleMatch[1] : '5',
    
    // Vehículo
    marca,
    modelo: modeloCompleto,
    anio: modeloAnioMatch ? modeloAnioMatch[1] : '',
    numero_serie: serieMatch ? serieMatch[1] : '',
    motor: motorMatch ? motorMatch[1] : '',
    placas: placasExtraidas || '',
    color: colorMatch ? colorMatch[1].trim() : '',
    codigo_vehiculo: descripcionMatch ? descripcionMatch[1] : '',
    tipo_vehiculo: '',
    tipo_cobertura: planMatch ? planMatch[1] : '',
    
    // Coberturas
    coberturas: coberturasExtraidas,
    
    // Qualitas específico
    uso: usoMatch ? usoMatch[1].trim() : '',
    servicio: servicioMatch ? servicioMatch[1].trim() : '',
    movimiento: movimientoMatch ? movimientoMatch[1].trim() : '',
    
    // Conductor
    conductor_habitual: `${nombre} ${apellido_paterno} ${apellido_materno}`.trim()
  };
  
  console.log('✅ Extractor Qualitas Autos - Completado');
  console.log('📊 Datos extraídos:', {
    asegurado: tipoPersona === 'Moral' ? razonSocial : `${nombre} ${apellido_paterno}`,
    poliza: polizaNum,
    vehiculo: `${marca} ${modeloCompleto}`,
    vigencia: `${datosExtraidos.inicio_vigencia} - ${datosExtraidos.termino_vigencia}`
  });
  
  return datosExtraidos;
}

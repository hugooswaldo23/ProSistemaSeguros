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
  console.log('🎯 Extractor Chubb Autos - Iniciando... [v2.0]');
  
  const { textoCompleto, textoPagina1, textoPagina2 } = ctx;
  
  // DEBUG: Ver qué texto tenemos
  console.log('📄 Longitud textoCompleto:', textoCompleto?.length, 'caracteres');
  console.log('📄 Longitud textoPagina1:', textoPagina1?.length, 'caracteres');
  console.log('📄 Longitud textoPagina2:', textoPagina2?.length, 'caracteres');
  console.log('📄 ========== CONTENIDO PÁGINA 1 ==========');
  console.log(textoPagina1?.substring(0, 1000));
  console.log('📄 ==========================================');
  
  // ==================== RFC Y TIPO DE PERSONA ====================
  // Buscar RFC con múltiples variantes y más flexible con espacios
  // Chubb usa formato: "R.F.C.: ADT200310 RF0" (con espacio en medio)
  let rfcMatch = textoCompleto.match(/(?:RFC|R\.?\s*F\.?\s*C\.?)[:\s]+([A-Z&Ñ]{3,4}\d{6})\s*([A-Z0-9]{3})/i);
  
  let rfcExtraido = '';
  if (rfcMatch) {
    // Combinar las dos partes del RFC (eliminar espacio)
    rfcExtraido = (rfcMatch[1] + rfcMatch[2]).toUpperCase().replace(/\s/g, '').trim();
  } else {
    // Fallback: buscar patrón continuo
    const rfcMatch2 = textoCompleto.match(/\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b/);
    rfcExtraido = rfcMatch2 ? rfcMatch2[1].toUpperCase().replace(/\s/g, '').trim() : '';
  }
  
  // Validar RFC
  let alertasRFC = [];
  if (!rfcExtraido) {
    alertasRFC.push('⚠️ RFC NO encontrado en el PDF');
  } else if (rfcExtraido.length !== 12 && rfcExtraido.length !== 13) {
    alertasRFC.push(`⚠️ RFC con longitud inválida: ${rfcExtraido.length} caracteres (esperado: 12 o 13)`);
  }
  
  const tipoPersona = rfcExtraido.length === 13 ? 'Fisica' : rfcExtraido.length === 12 ? 'Moral' : 'Fisica';
  
  console.log('🔍 RFC:', rfcExtraido || '❌ NO ENCONTRADO', '- Tipo:', tipoPersona);
  if (alertasRFC.length > 0) {
    alertasRFC.forEach(alerta => console.warn(alerta));
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
  
  // ==================== AGENTE ====================
  // Chubb usa "Clave interna del agente: XXXXX" y "Conducto: X - NOMBRE"
  let agente = '';
  
  // Buscar clave del agente
  const claveAgenteMatch = textoCompleto.match(/(?:CLAVE\s+INTERNA\s+DEL\s+AGENTE|CLAVE\s+AGENTE|AGENTE)[:\s]+(\d+)/i);
  const claveAgente = claveAgenteMatch ? claveAgenteMatch[1] : '';
  
  // Buscar nombre del conducto/agente
  const conductoMatch = textoCompleto.match(/(?:CONDUCTO)[:\s]+\d+\s*[-–]\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Datos|RFC|Domicilio|\n\n))/i);
  const nombreAgente = conductoMatch ? conductoMatch[1].trim() : '';
  
  // Si encontramos ambos, combinarlos
  if (claveAgente && nombreAgente) {
    agente = `${claveAgente} - ${nombreAgente}`;
  } else if (claveAgente) {
    agente = claveAgente;
  } else {
    // Fallback: buscar patrón genérico
    const agenteMatch = textoCompleto.match(/(?:AGENTE|CLAVE\s+AGENTE)[:\s]+(\d+)[\s\-]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\n|$)/i);
    agente = agenteMatch ? `${agenteMatch[1]} - ${agenteMatch[2].trim()}` : '';
  }
  
  console.log('👔 Agente encontrado:', agente || '❌ NO ENCONTRADO');
  
  // ==================== VIGENCIA ====================
  // Chubb usa formato: "Vigencia: Del 13/Nov/2025 12:00 horas al 13/Nov/2026 12:00 horas"
  const vigenciaMatch = textoCompleto.match(/Vigencia[:\s]+Del\s+(\d{1,2}\/[A-Za-z]{3}\/\d{4}).*?al\s+(\d{1,2}\/[A-Za-z]{3}\/\d{4})/i);
  let fecha_inicio_vigencia = '';
  let fecha_fin_vigencia = '';
  
  if (vigenciaMatch) {
    fecha_inicio_vigencia = normalizarFecha(vigenciaMatch[1]);
    fecha_fin_vigencia = normalizarFecha(vigenciaMatch[2]);
  }
  
  console.log('📅 VIGENCIA:', { 
    inicio: fecha_inicio_vigencia || '❌ NO ENCONTRADO', 
    fin: fecha_fin_vigencia || '❌ NO ENCONTRADO' 
  });

  // ==================== FECHA DE EMISIÓN ====================
  // Buscar fecha de emisión, si no se encuentra, usar fecha de captura
  const fechaEmisionMatch = textoCompleto.match(/(?:FECHA\s+DE\s+EMISI[OÓ]N|EMISI[OÓ]N)[:\s]+(\d{1,2}\s+(?:DE\s+)?[A-Z]{3,}(?:\s+DE\s+)?\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  let fecha_emision = '';
  
  if (fechaEmisionMatch) {
    fecha_emision = normalizarFecha(fechaEmisionMatch[1]);
    console.log('📝 Fecha de emisión encontrada:', fecha_emision);
  } else {
    // Si no encuentra fecha de emisión, usar fecha de captura
    const fechaHoy = new Date();
    fecha_emision = fechaHoy.toISOString().split('T')[0];
    console.log('📝 Fecha de emisión NO encontrada, usando fecha de captura:', fecha_emision);
  }
  
  // Fecha de captura (siempre la fecha actual)
  const fecha_captura = new Date().toISOString().split('T')[0];

  // ==================== FECHA LÍMITE DE PAGO ====================
  const fechaLimiteMatch = (textoPagina1 || textoCompleto).match(/Fecha\s+L[ií]mite\s+de\s+Pago[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
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
  // Prima Neta - Buscar con múltiples variantes (el formato es "Prima Neta $ 8,223.32")
  let primaNeta = extraerDato(/Prima\s+Neta[\s\$]+([\d,]+\.?\d*)/i, textoPagina1 || textoCompleto);
  if (!primaNeta) {
    primaNeta = extraerDato(/PRIMA\s+NETA[:\s]*\$?\s*([\d,]+\.?\d*)/i, textoPagina1 || textoCompleto);
  }
  const prima_pagada = primaNeta?.replace(/,/g, '') || '';
  
  // IVA (formato: "I.V.A $ 1443.58")
  let ivaExtraido = extraerDato(/I\.?V\.?A\.?[\s\$]+([\d,]+\.?\d*)/i, textoPagina1 || textoCompleto);
  const iva = ivaExtraido?.replace(/,/g, '') || '';
  
  // Gastos de expedición
  let derecho = extraerDato(/Gastos\s+de\s+expedici[oó]n[\s\$]+([\d,]+\.?\d*)/i, textoPagina1 || textoCompleto);
  const gastos_expedicion = derecho?.replace(/,/g, '') || '';
  
  // Financiamiento por pago fraccionado
  let recargo = extraerDato(/Financiamiento\s+por\s+pago\s+fraccionado[\s\$]+([\d,]+\.?\d*)/i, textoPagina1 || textoCompleto);
  const cargo_pago_fraccionado = recargo?.replace(/,/g, '') || '';
  
  // Total a pagar (formato: "Total a pagar: $ 10,465.90")
  let primaTotalMatch = (textoPagina1 || textoCompleto).match(/Total\s+a\s+pagar[:\s]*\$?\s*([\d,]+\.?\d*)/i);
  const costo_poliza = primaTotalMatch ? primaTotalMatch[1].replace(/,/g, '') : '';
  const total = costo_poliza;
  
  console.log('💰 INFORMACIÓN FINANCIERA:', {
    primaNeta: prima_pagada || '❌',
    iva: iva || '❌',
    derecho: gastos_expedicion || '❌',
    recargo: cargo_pago_fraccionado || '❌',
    primaTotal: costo_poliza || '❌ NO ENCONTRADO'
  });

  // ==================== TIPO DE PAGO ====================
  // Buscar "Serie del aviso: X/Y" para determinar forma de pago
  let tipo_pago = '';
  let frecuenciaPago = '';
  let forma_pago = '';
  
  const serieAvisoMatch = (textoPagina1 || textoCompleto).match(/Serie\s+del\s+aviso[:\s]*(\d+)\s*\/\s*(\d+)/i);
  
  if (serieAvisoMatch) {
    const serieActual = serieAvisoMatch[1];
    const serieTotal = serieAvisoMatch[2];
    
    console.log(`📊 Serie del aviso: ${serieActual}/${serieTotal}`);
    
    // Determinar tipo de pago según el total de pagos
    if (serieTotal === '1') {
      tipo_pago = 'Anual';
      frecuenciaPago = 'Anual';
      forma_pago = 'CONTADO';
    } else if (serieTotal === '2') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Semestral';
      forma_pago = 'SEMESTRAL';
    } else if (serieTotal === '3') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Trimestral';
      forma_pago = 'TRIMESTRAL';
    } else if (serieTotal === '4') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Cuatrimestral';
      forma_pago = 'CUATRIMESTRAL';
    } else if (serieTotal === '6') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Bimestral';
      forma_pago = 'BIMESTRAL';
    } else if (serieTotal === '12') {
      tipo_pago = 'Fraccionado';
      frecuenciaPago = 'Mensual';
      forma_pago = 'MENSUAL';
    }
    
    console.log(`✅ Tipo de pago determinado: ${tipo_pago} (${frecuenciaPago})`);
  }
  
  // ==================== VEHÍCULO (Página 2) ====================
  // IMPORTANTE: En Chubb, los datos están en formato multi-línea (label\nvalue)
  
  console.log('🚗 Buscando datos del vehículo...');
  
  // Marca: "Marca:\nFORD"
  const marcaMatch = textoCompleto.match(/Marca[:\s]*\n([A-Z]+)/i);
  const marca = marcaMatch ? marcaMatch[1] : '';
  console.log('   Marca:', marca || '❌');
  
  // Modelo/Año: "Modelo:\n2016"
  const modeloAnioMatch = textoCompleto.match(/\bModelo[:\s]*\n(\d{4})/i);
  const anio = modeloAnioMatch ? modeloAnioMatch[1] : '';
  console.log('   Año:', anio || '❌');
  
  // Clave vehicular (después de Motor)
  const claveMatch = textoCompleto.match(/Motor[:\s]*\n[A-Z]+[\s]+(\d+)[\s]+([A-Z0-9]+)/i);
  const modelo = claveMatch ? claveMatch[2] : '';
  console.log('   Clave vehicular/Modelo:', modelo || '❌');
  
  // Serie/VIN
  const numero_serie = extraerDato(/(?:Serie|SERIE)[:\s]+([A-Z0-9]{17})/i, textoCompleto);
  console.log('   Serie/VIN:', numero_serie || '❌');
  
  // Motor (capacidad)
  const motor = claveMatch ? claveMatch[1] : '';
  console.log('   Capacidad:', motor || '❌');
  
  // Placas
  const placasMatch = textoCompleto.match(/Placas[:\s]+([A-Z0-9\-]{6,10})/i);
  const placas = placasMatch ? placasMatch[1] : '';
  console.log('   Placas:', placas || '❌');
  
  // Color
  const color = extraerDato(/(?:COLOR|Color)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Placas|\n))/i, textoCompleto);
  console.log('   Color:', color || '❌');
  
  // ==================== USO Y SERVICIO ====================
  const uso = extraerDato(/(?:USO|Uso)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Servicio|SERVICIO|\n))/i, textoCompleto);
  console.log('   Uso:', uso || '❌');
  
  const servicio = extraerDato(/(?:SERVICIO|Servicio)[:\s]+([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:Tipo|TIPO|\n))/i, textoCompleto);
  console.log('   Servicio:', servicio || '❌');
  
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
  const deducible = extraerDato(/(?:DEDUCIBLE)[:\s]+(\d+)%?/i, textoCompleto) || '5';
  
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
    email: extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoCompleto),
    
    // Póliza (Página 1)
    compania: 'Chubb',
    producto: 'Autos Individual',
    plan, // Paquete (INTEGRAL, LIMITADA, etc.)
    etapa_activa: 'Emitida',
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
    cargo_pago_fraccionado,
    gastos_expedicion,
    iva,
    total,
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
    color,
    tipo_cobertura,
    suma_asegurada,
    deducible,
    uso, // Extraído de página 2
    servicio, // Extraído de página 2
    
    // Metadata de validación
    alertas_extraccion: alertasRFC.length > 0 ? alertasRFC : undefined
  };
  
  console.log('✅ Extractor Chubb Autos - Completado');
  console.log('\n📋 ========== RESUMEN DE DATOS EXTRAÍDOS ==========');
  console.log('📑 Fuente de datos: Página 1 (Aviso de Cobro) + Página 2 (Carátula)');
  
  console.log('\n👤 INFORMACIÓN DEL ASEGURADO (Página 1):');
  console.log('   RFC:', rfcExtraido || '❌');
  console.log('   Tipo:', tipoPersona);
  if (tipoPersona === 'Moral') {
    console.log('   Razón Social:', razonSocial || '❌');
  } else {
    console.log('   Nombre:', nombre, apellido_paterno, apellido_materno || '❌');
  }
  console.log('   Domicilio:', domicilio || '❌');
  console.log('   CP:', codigo_postal || '❌');
  console.log('   Email:', extraerDato(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, textoCompleto) || '❌');
  
  console.log('\n📄 DATOS DE LA PÓLIZA (Página 1):');
  console.log('   Póliza:', numero_poliza || '❌');
  console.log('   Endoso:', endoso || '❌');
  console.log('   Inciso:', inciso || '❌');
  console.log('   Plan/Paquete:', plan || '❌');
  console.log('   Agente:', agente || '❌');
  
  console.log('\n🗓 VIGENCIA (Página 1):');
  console.log('   Inicio:', fecha_inicio_vigencia || '❌');
  console.log('   Término:', fecha_fin_vigencia || '❌');
  console.log('   Fecha de Emisión:', fecha_emision || '❌');
  console.log('   Fecha de Captura:', fecha_captura || '❌');
  
  console.log('\n🚗 VEHÍCULO ASEGURADO (Página 2):');
  console.log('   Marca:', marca || '❌');
  console.log('   Modelo/Clave:', modelo || '❌');
  console.log('   Año:', anio || '❌');
  console.log('   Serie:', numero_serie || '❌');
  console.log('   Placas:', placas || '❌');
  console.log('   Capacidad:', motor || '❌');
  console.log('   Uso:', uso || '❌');
  console.log('   Servicio:', servicio || '❌');
  
  console.log('\n💰 INFORMACIÓN FINANCIERA (Página 1 - Aviso de Cobro):');
  console.log('   Prima:', prima_pagada || '❌');
  console.log('   IVA:', iva || '❌');
  console.log('   Total:', total || '❌');
  console.log('   Fecha Límite de Pago:', fecha_limite_pago || '❌');
  console.log('   Serie del aviso → Forma de pago:', forma_pago || '❌');
  console.log('   Tipo:', tipo_pago, '/', frecuenciaPago);
  
  console.log('\n🛡 COBERTURA:');
  console.log('   Tipo:', tipo_cobertura || '❌');
  console.log('   Suma asegurada:', suma_asegurada || '❌');
  console.log('   Deducible:', deducible + '%' || '❌');
  
  console.log('\n==================================================\n');
  
  return datosExtraidos;
}

export default { extraer };

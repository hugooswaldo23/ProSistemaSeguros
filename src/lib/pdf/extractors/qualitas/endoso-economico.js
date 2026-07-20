/**
 * Extractor especializado: Qualitas Autos - Endoso economico / A-AJUSTE
 */

function extraerDato(patron, texto, grupo = 1) {
  try {
    const match = texto.match(patron);
    return match && match[grupo] ? match[grupo].trim() : '';
  } catch (error) {
    console.warn('Error en extraerDato endoso economico Qualitas:', error, 'Patrón:', patron);
    return '';
  }
}

function normalizarMonto(valor) {
  return String(valor || '').replace(/,/g, '').trim();
}

function aNumero(valor) {
  const numero = parseFloat(normalizarMonto(valor));
  return Number.isFinite(numero) ? numero : 0;
}

export function esEndosoEconomicoQualitas(ctx = {}) {
  const texto = `${ctx.textoCompleto || ''}\n${ctx.textoPagina1 || ''}\n${ctx.textoPagina2 || ''}`;
  return /Movimiento:\s*A-AJUSTE/i.test(texto)
    && /Tasa\s+Financiamiento\s+[-]?[\d,]+\.?\d*/i.test(texto)
    && /Pago\s+Inicial\s*:?[\s$]*[\d,]+\.?\d*/i.test(texto)
    && /Pagos?\s+Subsecuentes\s*:?[\s$]*[\d,]+\.?\d*/i.test(texto)
    && /IMPORTE\s+TOTAL/i.test(texto);
}

export async function extraerEndosoEconomicoQualitas(ctx) {
  console.log('🎯 Extractor Qualitas Endoso Economico - Iniciando...');

  const { textoCompleto = '', textoPagina1 = '', textoPagina2 = '' } = ctx;
  const textoQualitas = textoPagina2 || textoCompleto;
  const compania = 'Qualitas';

  const meses = {
    'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
  };

  const mesesCompletos = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'SETIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
  };

  const rfc = extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoCompleto)
    || extraerDato(/R\.?\s*F\.?\s*C\.?\s*[:.\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i, textoPagina1);
  const tipo_persona = rfc.length === 12 ? 'Moral' : 'Fisica';

  let nombre = '';
  let apellido_paterno = '';
  let apellido_materno = '';
  let razonSocial = '';

  if (tipo_persona === 'Moral') {
    razonSocial = extraerDato(/INFORMACI[OÓ]N\s+DEL\s+ASEGURADO\s+(.+?)(?=\s+Domicilio|\s+R\.?F\.?C\.?)/i, textoQualitas);
  } else {
    const nombreCompleto = extraerDato(/INFORMACI[OÓ]N\s+DEL\s+ASEGURADO\s+([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,10})(?=\s*Domicilio|\s*\n)/i, textoQualitas);
    const palabras = nombreCompleto.split(/\s+/).filter(Boolean);
    if (palabras.length >= 3) {
      apellido_materno = palabras[palabras.length - 1];
      apellido_paterno = palabras[palabras.length - 2];
      nombre = palabras.slice(0, -2).join(' ');
    } else if (palabras.length === 2) {
      nombre = palabras[0];
      apellido_paterno = palabras[1];
    } else {
      nombre = palabras[0] || '';
    }
  }

  const domicilio = extraerDato(/Domicilio:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s,.#ºª\-]+?)(?=\s*(?:R\.?F\.?C\.?|C\.?P\.?|$))/i, textoCompleto);
  const codigo_postal = extraerDato(/C\.?P\.?[:\s]*(\d{5})/i, textoCompleto);
  const municipio = extraerDato(/Municipio:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Estado:)/i, textoCompleto);
  const estado = extraerDato(/Estado:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s+Colonia:)/i, textoCompleto);
  const colonia = extraerDato(/Colonia:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?=\s*(?:\n|DESCRIPCION|R\.?F\.?C\.?|$))/i, textoCompleto);

  let agente = '';
  let clave_agente = '';
  const agenteMatch = textoCompleto.match(/([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){2,})\s+(\d{6,8})\s+\d{7,12}[\s\S]{0,80}?Agente:/i);
  if (agenteMatch) {
    agente = agenteMatch[1].trim();
    clave_agente = agenteMatch[2].trim();
  }

  let numero_poliza = '';
  let numero_endoso = '';
  let inciso = '';
  const polizaLabelMatch = textoCompleto.match(/P[ÓO]LIZA\s*(\d{8,12})[\s\S]{0,40}?ENDOSO\s*(\d{3,10})[\s\S]{0,20}?INCISO\s*(\d{1,4})/i);
  if (polizaLabelMatch) {
    numero_poliza = polizaLabelMatch[1];
    numero_endoso = polizaLabelMatch[2];
    inciso = polizaLabelMatch[3].padStart(4, '0');
  }

  const desdeMatch = textoQualitas.match(/Desde\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);
  const hastaMatch = textoQualitas.match(/Hasta\s+las.*?del[:\s]*(\d{2})\s*\/\s*([A-Z]{3})\s*\/\s*(\d{4})/i);

  let fecha_emision = '';
  const emisionMatch = textoCompleto.match(/A\s+(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÑ]+)\s+DE\s+(\d{4})/i);
  if (emisionMatch) {
    const dia = emisionMatch[1].padStart(2, '0');
    const mes = mesesCompletos[emisionMatch[2].toUpperCase()] || '01';
    fecha_emision = `${emisionMatch[3]}-${mes}-${dia}`;
  } else {
    fecha_emision = new Date().toISOString().split('T')[0];
  }

  const formaPagoDetectada = extraerDato(/Forma\s+de\s+Pago:\s*(SEMESTRAL|TRIMESTRAL|MENSUAL|ANUAL|BIMESTRAL|CUATRIMESTRAL|CONTADO)/i, textoCompleto)
    || extraerDato(/(SEMESTRAL|TRIMESTRAL|MENSUAL|ANUAL|BIMESTRAL|CUATRIMESTRAL|CONTADO)/i, textoQualitas);

  let tipo_pago = 'Anual';
  let frecuenciaPago = 'Anual';
  const f = formaPagoDetectada.toLowerCase();
  if (f.includes('sem')) { tipo_pago = 'Fraccionado'; frecuenciaPago = 'Semestral'; }
  else if (f.includes('tri')) { tipo_pago = 'Fraccionado'; frecuenciaPago = 'Trimestral'; }
  else if (f.includes('men')) { tipo_pago = 'Fraccionado'; frecuenciaPago = 'Mensual'; }
  else if (f.includes('bim')) { tipo_pago = 'Fraccionado'; frecuenciaPago = 'Bimestral'; }
  else if (f.includes('cuat')) { tipo_pago = 'Fraccionado'; frecuenciaPago = 'Cuatrimestral'; }

  const primer_pago = normalizarMonto(extraerDato(/Pago\s+Inicial\s*:?\s*\$\s*([\d,]+\.?\d*)/i, textoCompleto));
  const pagos_subsecuentes = normalizarMonto(extraerDato(/Pagos?\s+Subsecuentes\s*:?\s*\$\s*([\d,]+\.?\d*)/i, textoCompleto));
  const cargo_pago_fraccionado = normalizarMonto(extraerDato(/Tasa\s+Financiamiento\s+([-]?[\d,]+\.?\d*)/i, textoCompleto));
  const subtotal = normalizarMonto(extraerDato(/Subtotal\s+([\d,]+\.?\d*)/i, textoCompleto));
  const iva = normalizarMonto(extraerDato(/I\.V\.A[.\s]*16\s*%\s+([\d,]+\.?\d*)/i, textoCompleto));
  const totalExtraido = normalizarMonto(extraerDato(/IMPORTE\s+TOTAL\s+([\d,]+\.?\d*)/i, textoCompleto));
  const movimiento = extraerDato(/Movimiento:\s*([A-ZÁÉÍÓÚÑ\-]+)/i, textoCompleto);

  let total = totalExtraido;
  if (!total) {
    const numeroPagos = frecuenciaPago === 'Semestral' ? 2
      : frecuenciaPago === 'Trimestral' ? 4
      : frecuenciaPago === 'Mensual' ? 12
      : frecuenciaPago === 'Bimestral' ? 6
      : frecuenciaPago === 'Cuatrimestral' ? 3
      : 1;
    const totalCalculado = aNumero(primer_pago) + (Math.max(numeroPagos - 1, 0) * aNumero(pagos_subsecuentes));
    if (totalCalculado > 0) {
      total = totalCalculado.toFixed(2);
    }
  }

  const resultado = {
    tipo_persona,
    nombre,
    apellido_paterno,
    apellido_materno,
    razonSocial,
    rfc,
    curp: '',
    domicilio,
    municipio,
    colonia,
    estado,
    codigo_postal,
    pais: 'MEXICO',
    email: '',

    compania,
    producto: 'Autos',
    etapa_activa: 'Emitida',
    clave_agente,
    agente,
    sub_agente: '',
    numero_poliza,
    endoso: numero_endoso,
    numero_endoso,
    inciso,
    plan: '',
    es_endoso_economico: true,
    tipo_endoso: 'ajuste_economico',

    inicio_vigencia: desdeMatch ? `${desdeMatch[3]}-${meses[desdeMatch[2]]}-${desdeMatch[1]}` : '',
    termino_vigencia: hastaMatch ? `${hastaMatch[3]}-${meses[hastaMatch[2]]}-${hastaMatch[1]}` : '',
    fecha_emision,
    fecha_captura: new Date().toISOString().split('T')[0],

    prima_neta: '',
    cargo_pago_fraccionado,
    gastos_expedicion: '',
    subtotal,
    iva,
    total,
    pago_unico: '',
    tipo_pago,
    frecuenciaPago,
    forma_pago: formaPagoDetectada || '',
    primer_pago,
    pagos_subsecuentes,
    periodo_gracia: '14',
    suma_asegurada: '',
    deducible: '',

    marca: '',
    modelo: '',
    anio: '',
    numero_serie: '',
    motor: '',
    placas: '',
    color: '',
    codigo_vehiculo: '',
    tipo_vehiculo: '',
    tipo_cobertura: '',

    coberturas: [],

    uso: extraerDato(/Uso:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto),
    servicio: extraerDato(/Servicio:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCompleto),
    movimiento,
    conductor_habitual: `${nombre} ${apellido_paterno} ${apellido_materno}`.trim()
  };

  console.log('✅ Extractor Qualitas Endoso Economico - Completado');
  console.log('📊 Datos extraídos endoso económico:', {
    poliza: numero_poliza,
    endoso: numero_endoso,
    movimiento,
    forma_pago: resultado.forma_pago,
    primer_pago: resultado.primer_pago,
    pagos_subsecuentes: resultado.pagos_subsecuentes,
    total: resultado.total
  });

  return resultado;
}
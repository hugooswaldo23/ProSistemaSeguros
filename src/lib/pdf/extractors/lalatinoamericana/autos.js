/**
 * Extractor Especializado: La Latinoamericana Seguros - Autos
 * 
 * Usa _comun.js para campos universales (1-36) y agrega
 * campos específicos de vehículo (37-50) + coberturas.
 * 
 * @module extractors/lalatinoamericana/autos
 */

import { extraerDato, limpiarMonto, extraerCamposUniversales } from './_comun.js';

/**
 * Extrae información de póliza de La Latinoamericana Autos
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor La Latinoamericana Autos - Iniciando...');

  // ==================== CAMPOS UNIVERSALES (1-36) ====================
  const datos = extraerCamposUniversales(ctx, 'Autos');

  // Textos internos para extracción de vehículo y coberturas
  const textoCaratula = datos._textoCaratula;

  // ==================== VEHÍCULO (de la CARÁTULA — página 1) ====================
  const marca = extraerDato(/Marca:\s*([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCaratula);
  const descripcion = extraerDato(/Descripci[oó]n:\s*(.+?)(?:\.\n|\n)/i, textoCaratula);
  const anio = extraerDato(/Modelo:\s*(\d{4})/i, textoCaratula);
  const serie = extraerDato(/Serie:\s*([A-Z0-9]+)/i, textoCaratula);
  const motor = extraerDato(/Motor:\s*(.+?)(?:\s{2,}|Ocupantes|$)/i, textoCaratula);
  const placas = extraerDato(/Placas:\s*([A-Z0-9]+)/i, textoCaratula);
  const uso = extraerDato(/Uso:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);
  const tipoVehiculo = extraerDato(/Tipo:\s*([A-ZÁÉÍÓÚÑ]+)/i, textoCaratula);
  const ocupantes = extraerDato(/Ocupantes:\s*(\d+)/i, textoCaratula);
  const claveVehicular = extraerDato(/Clave:\s*([A-Z0-9]+)/i, textoCaratula);

  // ==================== TIPO DE COBERTURA ====================
  let tipoCobertura = '';
  if (/COBERTURA\s+AMPLIA/i.test(textoCaratula)) {
    tipoCobertura = 'Amplia';
  } else if (/COBERTURA\s+LIMITADA/i.test(textoCaratula)) {
    tipoCobertura = 'Limitada';
  } else if (/RESPONSABILIDAD\s+CIVIL/i.test(textoCaratula) && !/COBERTURA\s+(AMPLIA|LIMITADA)/i.test(textoCaratula)) {
    tipoCobertura = 'RC';
  }

  // Suma asegurada — "Valor Comercial" en la primera cobertura de daños materiales
  const sumaAsegurada = limpiarMonto(
    extraerDato(/DA[NÑ]OS\s+MATERIALES\s+\d+\s+Valor\s+Comercial\s+([\d,]+\.?\d*)/i, textoCaratula)
  );

  // Deducible
  const deducible = extraerDato(/DA[NÑ]OS\s+MATERIALES\s+(\d+)/i, textoCaratula) || '5';

  // ==================== COBERTURAS (de la carátula) ====================
  let coberturas = [];
  const bloqueCobert = textoCaratula.match(/Coberturas\s+Amparadas\s+Primas([\s\S]*?)(?:Agente|Prima\s+Neta|6\.\s+PRIMA)/i);
  if (bloqueCobert) {
    const lineas = bloqueCobert[1].split('\n').filter(l => l.trim().length > 0);
    let coberturaPendiente = null;

    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      if (!lineaLimpia) continue;

      // Patrón con monto: "DANOS MATERIALES 5  Valor Comercial 3,242.81"
      let match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+(\d+)\s+Valor\s+Comercial\s+([\d,]+\.?\d*)/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: match[2] + '%', suma_asegurada: 'VALOR COMERCIAL', prima: limpiarMonto(match[3]) };
        continue;
      }

      // Patrón con monto fijo: "RESPONSABILIDAD CIVIL L.U.C.* 3,000,000.00 362.55"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.?\d*)$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: 'N/A', suma_asegurada: limpiarMonto(match[2]), prima: limpiarMonto(match[3]) };
        continue;
      }

      // Patrón amparada con deducible: "ROTURA DE CRISTALES 20  Amparada"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s.*]+?)\s+(\d+)\s+Amparada/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: match[2] + '%', suma_asegurada: 'AMPARADA', prima: '0.00' };
        continue;
      }

      // Patrón amparada con prima al final
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s,./]+?)\s+Amparada\s+([\d,]+\.?\d*)/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: 'N/A', suma_asegurada: 'AMPARADA', prima: limpiarMonto(match[2]) };
        continue;
      }

      // Patrón solo amparada
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+Amparada\s*$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: 'N/A', suma_asegurada: 'AMPARADA', prima: '0.00' };
        continue;
      }

      // Patrón: "ACCIDENTES AL CONDUCTOR 100,000.00 12.34"
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/i);
      if (match) {
        if (coberturaPendiente) coberturas.push(coberturaPendiente);
        coberturaPendiente = { nombre: match[1].trim(), deducible: 'N/A', suma_asegurada: limpiarMonto(match[2]), prima: limpiarMonto(match[3]) };
        continue;
      }

      // Línea de continuación
      if (coberturaPendiente && /^[A-ZÁÉÍÓÚÑ]/.test(lineaLimpia)) {
        match = lineaLimpia.match(/^([\d,]+\.\d{2})\s+([\d,]+\.?\d*)$/);
        if (match) {
          coberturaPendiente.suma_asegurada = limpiarMonto(match[1]);
          coberturaPendiente.prima = limpiarMonto(match[2]);
          continue;
        }
        coberturaPendiente.nombre += ' ' + lineaLimpia;
      }
    }
    if (coberturaPendiente) coberturas.push(coberturaPendiente);
  }

  // ==================== RESULTADO ====================
  // Combinar campos universales (1-36) + campos de vehículo (37-50)
  const datosExtraidos = {
    ...datos,

    // Sobreescribir plan con tipo de cobertura
    plan: tipoCobertura || '',
    suma_asegurada: sumaAsegurada || '',
    deducible: deducible,

    // Vehículo (campos 37-50)
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
    conductor_habitual: datos._nombreCompleto || ''
  };

  // Limpiar metadata interna
  delete datosExtraidos._nombreCompleto;
  delete datosExtraidos._textoRecibo;
  delete datosExtraidos._textoCaratula;
  delete datosExtraidos._textoPrima;
  delete datosExtraidos._textoCompleto;

  console.log('✅ Extractor La Latinoamericana Autos - Completado');
  console.log('📊 Datos extraídos:', {
    asegurado: datos.tipo_persona === 'Moral' ? datos.razonSocial : `${datos.nombre} ${datos.apellido_paterno}`,
    poliza: datos.numero_poliza,
    vehiculo: `${marca} ${descripcion || ''}`.trim(),
    vigencia: `${datos.inicio_vigencia} - ${datos.termino_vigencia}`,
    total: datos.total,
    fechaLimite: datos.fecha_limite_pago
  });

  return datosExtraidos;
}

export default { extraer };

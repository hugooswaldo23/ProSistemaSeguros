/**
 * Extractor Especializado: La Latinoamericana Seguros - GMM (Gastos Médicos Mayores)
 * 
 * Usa _comun.js para campos universales (1-36).
 * Agrega campo `asegurados` (array) para la lista de personas aseguradas,
 * ya que en GMM el contratante puede ser diferente de los asegurados.
 * 
 * Los campos nombre/apellidos (1-4) se refieren al CONTRATANTE.
 * Los asegurados se guardan en el array `asegurados`.
 * 
 * @module extractors/lalatinoamericana/gmm
 */

import { extraerDato, extraerCamposUniversales } from './_comun.js';

/**
 * Extrae información de póliza GMM de La Latinoamericana
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor La Latinoamericana GMM - Iniciando...');

  // ==================== CAMPOS UNIVERSALES (1-36) ====================
  // nombre/apellidos = CONTRATANTE (quien paga la póliza)
  const datos = extraerCamposUniversales(ctx, 'GMM');

  const textoCaratula = datos._textoCaratula;
  const textoCompleto = datos._textoCompleto;
  const textoRecibo = datos._textoRecibo;

  // ==================== ASEGURADOS (lista de personas cubiertas) ====================
  // En GMM puede haber múltiples asegurados (titular + dependientes)
  // Buscar bloque de asegurados en la carátula o texto completo
  let asegurados = [];

  // Patrón 1: Tabla de asegurados: "NOMBRE  PARENTESCO  FECHA_NAC"
  const bloqueAseg = textoCaratula.match(/Asegurados?\s*:?([\s\S]*?)(?:Coberturas|Prima|Agente|Beneficiario|$)/i)
    || textoCompleto.match(/Asegurados?\s*:?([\s\S]*?)(?:Coberturas|Prima|Agente|Beneficiario|$)/i);

  if (bloqueAseg) {
    const lineas = bloqueAseg[1].split('\n').filter(l => l.trim().length > 3);
    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      // Intentar extraer: NOMBRE  PARENTESCO  DD/MM/YYYY
      let match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+(TITULAR|CONYUGE|CÓNYUGE|HIJO|HIJA|DEPENDIENTE|MADRE|PADRE)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
      if (match) {
        asegurados.push({
          nombre: match[1].trim(),
          parentesco: match[2].trim(),
          fecha_nacimiento: match[3].trim()
        });
        continue;
      }
      // Solo nombre y parentesco, sin fecha
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+(TITULAR|CONYUGE|CÓNYUGE|HIJO|HIJA|DEPENDIENTE|MADRE|PADRE)\s*$/i);
      if (match) {
        asegurados.push({
          nombre: match[1].trim(),
          parentesco: match[2].trim(),
          fecha_nacimiento: ''
        });
        continue;
      }
      // Solo nombre (asumimos titular si solo hay uno)
      match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ]{2,}\s+[A-ZÁÉÍÓÚÑ\s]+)$/i);
      if (match && !/(COBERTURAS|PRIMA|AGENTE|POLIZA|RECIBO|SEGURO)/i.test(lineaLimpia)) {
        asegurados.push({
          nombre: match[1].trim(),
          parentesco: asegurados.length === 0 ? 'TITULAR' : '',
          fecha_nacimiento: ''
        });
      }
    }
  }

  // Si no encontramos asegurados en bloque, el contratante es también el titular
  if (asegurados.length === 0 && datos._nombreCompleto) {
    asegurados.push({
      nombre: datos._nombreCompleto,
      parentesco: 'TITULAR',
      fecha_nacimiento: ''
    });
  }

  // ==================== PLAN / PRODUCTO GMM ====================
  // Buscar nombre del plan: "GMM INDIVIDUAL", "GMM FAMILIAR", etc.
  const planGMM = extraerDato(/(?:Plan|Producto):\s*(.+?)(?:\n|$)/i, textoCaratula)
    || extraerDato(/(?:Plan|Producto):\s*(.+?)(?:\n|$)/i, textoCompleto)
    || extraerDato(/GMM\s+([A-ZÁÉÍÓÚÑ\s]+?)(?:\n|$)/i, textoCaratula)
    || '';

  // ==================== RESULTADO ====================
  const datosExtraidos = {
    ...datos,
    producto: 'GMM',
    plan: planGMM,
    // Lista de asegurados (contratante ya está en campos 1-4)
    asegurados,
    // Sin campos de vehículo
    coberturas: []
  };

  // Limpiar metadata interna
  delete datosExtraidos._nombreCompleto;
  delete datosExtraidos._textoRecibo;
  delete datosExtraidos._textoCaratula;
  delete datosExtraidos._textoPrima;
  delete datosExtraidos._textoCompleto;

  console.log('✅ Extractor La Latinoamericana GMM - Completado');
  console.log('📊 Datos extraídos:', {
    contratante: datos.tipo_persona === 'Moral' ? datos.razonSocial : `${datos.nombre} ${datos.apellido_paterno}`,
    poliza: datos.numero_poliza,
    asegurados: asegurados.length,
    vigencia: `${datos.inicio_vigencia} - ${datos.termino_vigencia}`,
    total: datos.total
  });

  return datosExtraidos;
}

export default { extraer };

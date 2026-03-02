/**
 * Extractor Especializado: La Latinoamericana Seguros - Vida
 * 
 * Usa _comun.js para campos universales (1-36).
 * No tiene campos específicos adicionales por ahora.
 * Las coberturas/beneficiarios se consultan directamente en el PDF.
 * 
 * @module extractors/lalatinoamericana/vida
 */

import { extraerDato, extraerCamposUniversales } from './_comun.js';

/**
 * Extrae información de póliza de Vida de La Latinoamericana
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor La Latinoamericana Vida - Iniciando...');

  // ==================== CAMPOS UNIVERSALES (1-36) ====================
  const datos = extraerCamposUniversales(ctx, 'Vida');

  const textoCaratula = datos._textoCaratula;
  const textoCompleto = datos._textoCompleto;

  // ==================== PLAN / PRODUCTO VIDA ====================
  const planVida = extraerDato(/(?:Plan|Producto):\s*(.+?)(?:\n|$)/i, textoCaratula)
    || extraerDato(/(?:Plan|Producto):\s*(.+?)(?:\n|$)/i, textoCompleto)
    || '';

  // ==================== BENEFICIARIOS (bonus) ====================
  let beneficiarios = [];
  const bloqueBenef = textoCaratula.match(/Beneficiarios?\s*:?([\s\S]*?)(?:Coberturas|Prima|Agente|$)/i)
    || textoCompleto.match(/Beneficiarios?\s*:?([\s\S]*?)(?:Coberturas|Prima|Agente|$)/i);

  if (bloqueBenef) {
    const lineas = bloqueBenef[1].split('\n').filter(l => l.trim().length > 3);
    for (const linea of lineas) {
      const lineaLimpia = linea.trim();
      // NOMBRE  PARENTESCO  PORCENTAJE%
      let match = lineaLimpia.match(/^([A-ZÁÉÍÓÚÑ\s]+?)\s+([A-ZÁÉÍÓÚÑ]+)\s+(\d+)\s*%?/i);
      if (match && !/(COBERTURAS|PRIMA|AGENTE|POLIZA|SEGURO)/i.test(lineaLimpia)) {
        beneficiarios.push({
          nombre: match[1].trim(),
          parentesco: match[2].trim(),
          porcentaje: match[3] + '%'
        });
      }
    }
  }

  // ==================== RESULTADO ====================
  const datosExtraidos = {
    ...datos,
    producto: 'Vida',
    plan: planVida,
    beneficiarios,
    coberturas: []
  };

  // Limpiar metadata interna
  delete datosExtraidos._nombreCompleto;
  delete datosExtraidos._textoRecibo;
  delete datosExtraidos._textoCaratula;
  delete datosExtraidos._textoPrima;
  delete datosExtraidos._textoCompleto;

  console.log('✅ Extractor La Latinoamericana Vida - Completado');
  console.log('📊 Datos extraídos:', {
    asegurado: datos.tipo_persona === 'Moral' ? datos.razonSocial : `${datos.nombre} ${datos.apellido_paterno}`,
    poliza: datos.numero_poliza,
    vigencia: `${datos.inicio_vigencia} - ${datos.termino_vigencia}`,
    total: datos.total
  });

  return datosExtraidos;
}

export default { extraer };

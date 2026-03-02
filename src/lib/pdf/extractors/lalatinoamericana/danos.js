/**
 * Extractor Especializado: La Latinoamericana Seguros - Daños
 * 
 * Usa _comun.js para campos universales (1-36).
 * No tiene campos específicos adicionales por ahora.
 * Las coberturas se consultan directamente en el PDF.
 * 
 * @module extractors/lalatinoamericana/danos
 */

import { extraerCamposUniversales } from './_comun.js';

/**
 * Extrae información de póliza de Daños de La Latinoamericana
 * @param {Object} ctx - Contexto con textos del PDF
 * @returns {Promise<Object>} Datos extraídos de la póliza
 */
export async function extraer(ctx) {
  console.log('🎯 Extractor La Latinoamericana Daños - Iniciando...');

  // ==================== CAMPOS UNIVERSALES (1-36) ====================
  const datos = extraerCamposUniversales(ctx, 'Daños');

  // ==================== RESULTADO ====================
  const datosExtraidos = {
    ...datos,
    producto: 'Daños',
    coberturas: []
  };

  // Limpiar metadata interna
  delete datosExtraidos._nombreCompleto;
  delete datosExtraidos._textoRecibo;
  delete datosExtraidos._textoCaratula;
  delete datosExtraidos._textoPrima;
  delete datosExtraidos._textoCompleto;

  console.log('✅ Extractor La Latinoamericana Daños - Completado');
  console.log('📊 Datos extraídos:', {
    asegurado: datos.tipo_persona === 'Moral' ? datos.razonSocial : `${datos.nombre} ${datos.apellido_paterno}`,
    poliza: datos.numero_poliza,
    vigencia: `${datos.inicio_vigencia} - ${datos.termino_vigencia}`,
    total: datos.total
  });

  return datosExtraidos;
}

export default { extraer };

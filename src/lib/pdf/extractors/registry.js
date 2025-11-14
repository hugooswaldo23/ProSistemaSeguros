// Dynamic loader for per-company extractors. Qualitas is handled legacy-in-component.
export async function loadExtractor(company) {
  const c = (company || '').toUpperCase();
  try {
    switch (c) {
      case 'GNP':
        return (await import('./gnp.js')).extractGNP;
      case 'MAPFRE':
        return (await import('./mapfre.js')).extractMAPFRE;
      case 'AXA':
        return (await import('./axa.js')).extractAXA;
      case 'HDI':
        return (await import('./hdi.js')).extractHDI;
      default:
        return null; // QUALITAS or OTRA handled elsewhere
    }
  } catch (e) {
    console.warn('Extractor module load failed for', c, e);
    return null;
  }
}

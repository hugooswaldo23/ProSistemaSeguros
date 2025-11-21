// Simple company detection by regex on full text
export function detectCompany(textoCompleto) {
  if (!textoCompleto || typeof textoCompleto !== 'string') return 'OTRA';
  const t = textoCompleto;
  if (/qu[aá]litas/i.test(t)) return 'QUALITAS';
  if (/gnp/i.test(t)) return 'GNP';
  if (/mapfre/i.test(t)) return 'MAPFRE';
  if (/axa/i.test(t)) return 'AXA';
  if (/hdi/i.test(t)) return 'HDI';
  return 'OTRA';
}

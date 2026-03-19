import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const files = [
  'c:\\Users\\alvar\\Downloads\\Polizas para prueba sistema\\Terminados\\Autos terminados\\Chubb\\GE45013265 (2).pdf',
  'c:\\Users\\alvar\\Downloads\\Polizas para prueba sistema\\Terminados\\Autos terminados\\Chubb\\GE45013353.pdf',
  'c:\\Users\\alvar\\Downloads\\Polizas para prueba sistema\\Terminados\\Autos terminados\\Chubb\\LL45007654.pdf',
];

for (const file of files) {
  console.log('\n=== ' + file.split('\\').pop() + ' ===');
const data = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data }).promise;

const todasLasPaginas = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const lineas = {};
  content.items.forEach(item => {
    const y = Math.round(item.transform[5]);
    if (!lineas[y]) lineas[y] = [];
    lineas[y].push({ text: item.str, x: item.transform[4] });
  });
  const textoPagina = Object.keys(lineas)
    .sort((a, b) => b - a)
    .map(y => lineas[y].sort((a, b) => a.x - b.x).map(item => item.text).join(' '))
    .join('\n');
  todasLasPaginas.push({ numero: i, texto: textoPagina });
}

const textoCompleto = todasLasPaginas.map(p => p.texto).join('\n\n');

// Replicate extraerCampoLinea exactly as in chubb/autos.js
function extraerCampoLinea(etiqueta, texto) {
  // Strategy 1
  const regexMismaLinea = new RegExp(`\\b${etiqueta}:\\s+([A-Z0-9][^:\\r\\n]+?)(?=\\s{2,}[A-Za-zÁÉÍÓÚñÑ]+:|\\r|\\n|$)`, 'i');
  const matchMismaLinea = texto.match(regexMismaLinea);
  if (matchMismaLinea && matchMismaLinea[1].trim().length > 0) {
    console.log(`  Strategy 1 matched: "${matchMismaLinea[1].trim()}"`);
    return matchMismaLinea[1].trim();
  } else {
    console.log(`  Strategy 1 failed`);
  }

  // Strategy 2 
  const regexSiguienteLinea = new RegExp(`\\b${etiqueta}:\\s*[\\r\\n]+\\s*([A-Z0-9][^:\\r\\n]+?)(?=\\s*\\r|\\n|$)`, 'i');
  const matchSiguienteLinea = texto.match(regexSiguienteLinea);
  if (matchSiguienteLinea && matchSiguienteLinea[1].trim().length > 0) {
    console.log(`  Strategy 2 matched: "${matchSiguienteLinea[1].trim()}"`);
    return matchSiguienteLinea[1].trim();
  } else {
    console.log(`  Strategy 2 failed`);
  }

  // Strategy 3
  const regexPosicion = new RegExp(`\\b${etiqueta}:`, 'i');
  const matchPosicion = texto.match(regexPosicion);
  if (matchPosicion) {
    const indiceEtiqueta = texto.indexOf(matchPosicion[0]);
    const restoTexto = texto.substring(indiceEtiqueta);
    console.log(`  Strategy 3: found "${matchPosicion[0]}" at index ${indiceEtiqueta}`);
    console.log(`  Strategy 3: restoTexto starts with: "${restoTexto.substring(0, 100)}..."`);
    
    const matchLineaValores = restoTexto.match(/:\s*[\r\n]+(.+)/);
    if (matchLineaValores) {
      const lineaValores = matchLineaValores[1];
      console.log(`  Strategy 3: lineaValores: "${lineaValores.substring(0, 100)}"`);
      const lineaEtiquetas = restoTexto.substring(0, restoTexto.indexOf('\n'));
      console.log(`  Strategy 3: lineaEtiquetas: "${lineaEtiquetas.substring(0, 100)}"`);
      const etiquetasAntes = (lineaEtiquetas.substring(0, lineaEtiquetas.indexOf(matchPosicion[0])).match(/\w+:/g) || []).length;
      const valores = lineaValores.split(/\s{2,}/);
      console.log(`  Strategy 3: etiquetasAntes=${etiquetasAntes}, valores=`, valores.slice(0, 5));
      if (valores[etiquetasAntes]) {
        console.log(`  Strategy 3 result: "${valores[etiquetasAntes].trim()}"`);
        return valores[etiquetasAntes].trim();
      }
    } else {
      console.log('  Strategy 3: no matchLineaValores found');
    }
  } else {
    console.log(`  Strategy 3: "${etiqueta}:" not found`);
  }
  return '';
}

// NEW direct regex approach
const usoMatch = textoCompleto.match(/\bUso:\s+([A-ZÁÉÍÓÚÑ]+)/i);
const uso = usoMatch ? usoMatch[1].toUpperCase() : '';
console.log('uso:', JSON.stringify(uso));

const servicioMatch = textoCompleto.match(/\bServicio:\s+([A-ZÁÉÍÓÚÑ]+)/i);
const servicio = servicioMatch ? servicioMatch[1].toUpperCase() : '';
console.log('servicio:', JSON.stringify(servicio));
}

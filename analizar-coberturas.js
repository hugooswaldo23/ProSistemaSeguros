import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

// Utilidades para extraer y normalizar la Fecha de Emisión desde texto libre
function normalizarFechaDMY(d, m, y) {
  const dd = String(parseInt(d, 10)).padStart(2, '0');
  const mm = String(parseInt(m, 10)).padStart(2, '0');
  const yyyy = y.length === 2 ? (parseInt(y, 10) >= 70 ? '19' + y : '20' + y) : y;
  return `${yyyy}-${mm}-${dd}`; // ISO YYYY-MM-DD
}

function parseFechaEmision(texto) {
  if (!texto) return null;

  // Buscar el label y luego una fecha cercana
  const labelPatterns = [
    /Fecha\s*de\s*Emisi[oó]n\s*[:\-]?/i,
    /F\.?\s*Emisi[oó]n\s*[:\-]?/i,
    /Fecha\s*de\s*expedici[oó]n\s*[:\-]?/i,
    /Emisi[oó]n\s*[:\-]?/i
  ];

  // Patrones de fecha habituales
  const reDMY = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/; // 01/11/2025, 1-11-25, 01.11.2025
  const meses = {
    ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
    may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
    sep: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
    nov: 11, noviembre: 11, dic: 12, diciembre: 12
  };
  const reDMesY = new RegExp(
    `(\\d{1,2})\\s*(?:de)?\\s*(${Object.keys(meses).join('|')})[\\s,_-]*(\\d{2,4})`,
    'i'
  ); // 1 nov 2025, 01 de noviembre 25

  for (const label of labelPatterns) {
    const m = texto.match(label);
    if (!m) continue;
    const start = m.index + m[0].length;
    const ventana = texto.slice(start, start + 60); // buscar cerca del label

    const m1 = ventana.match(reDMY);
    if (m1) {
      return normalizarFechaDMY(m1[1], m1[2], m1[3]);
    }

    const m2 = ventana.match(reDMesY);
    if (m2) {
      const d = m2[1];
      const mesTxt = m2[2].toLowerCase();
      const mesNum = meses[mesTxt];
      const y = m2[3];
      return normalizarFechaDMY(d, String(mesNum), y);
    }
  }

  // Fallback: buscar una línea que contenga "Fecha de Emisión" y luego una fecha en la misma línea completa
  const lineas = texto.split(/\n|\r|\r\n/);
  for (const linea of lineas) {
    if (/Fecha\s*de\s*Emisi[oó]n/i.test(linea) || /Fecha\s*de\s*expedici[oó]n/i.test(linea) || /F\.?\s*Emisi[oó]n/i.test(linea)) {
      const m1 = linea.match(reDMY);
      if (m1) return normalizarFechaDMY(m1[1], m1[2], m1[3]);
      const m2 = linea.match(reDMesY);
      if (m2) {
        const d = m2[1];
        const mesTxt = m2[2].toLowerCase();
        const mesNum = meses[mesTxt];
        const y = m2[3];
        return normalizarFechaDMY(d, String(mesNum), y);
      }
    }
  }

  return null;
}

async function analizarCoberturas() {
  console.log('\n========================================');
  console.log('📄 PDF 1: Póliza 0971458956');
  console.log('========================================\n');

  const texto1 = await extractText('c:\\Users\\alvar\\Downloads\\Póliza 0971458956.pdf');

  // Fecha de emisión PDF 1
  const fechaEmision1 = parseFechaEmision(texto1);
  if (fechaEmision1) {
    console.log('🗓️ Fecha de Emisión detectada:', fechaEmision1);
  } else {
    console.log('⚠️ No se pudo detectar la Fecha de Emisión en PDF 1');
  }

  // Buscar sección de coberturas
  const coberturas1 = texto1.match(/COBERTURAS.*?(?=DEDUCIBLES|Prima Neta|Recibo)/is);
  if (coberturas1) {
    console.log('✅ COBERTURAS ENCONTRADAS:\n');
    console.log(coberturas1[0]);
  } else {
    console.log('⚠️ No se encontró sección de coberturas con ese patrón');
    console.log('\n--- Buscando patrones alternativos ---\n');

    // Buscar líneas que contengan montos con $
    const lineasConMontos = texto1.split('\n').filter(linea =>
      /\$\s*[\d,]+\.?\d*/i.test(linea) &&
      /(Da[ñn]os|Robo|Responsabilidad|Gastos|Asistencia|Cristales|M[ée]dicos)/i.test(linea)
    );

    console.log('Líneas con coberturas y montos:');
    lineasConMontos.forEach(linea => console.log('  -', linea.trim()));
  }

  console.log('\n\n========================================');
  console.log('📄 PDF 2: PolizaBoxter');
  console.log('========================================\n');

  const texto2 = await extractText('c:\\Users\\alvar\\Downloads\\PolizaBoxter.pdf');

  // Fecha de emisión PDF 2
  const fechaEmision2 = parseFechaEmision(texto2);
  if (fechaEmision2) {
    console.log('🗓️ Fecha de Emisión detectada:', fechaEmision2);
  } else {
    console.log('⚠️ No se pudo detectar la Fecha de Emisión en PDF 2');
  }

  const coberturas2 = texto2.match(/COBERTURAS.*?(?=DEDUCIBLES|Prima Neta|Recibo)/is);
  if (coberturas2) {
    console.log('✅ COBERTURAS ENCONTRADAS:\n');
    console.log(coberturas2[0]);
  } else {
    console.log('⚠️ No se encontró sección de coberturas con ese patrón');
    console.log('\n--- Buscando patrones alternativos ---\n');

    const lineasConMontos = texto2.split('\n').filter(linea =>
      /\$\s*[\d,]+\.?\d*/i.test(linea) &&
      /(Da[ñn]os|Robo|Responsabilidad|Gastos|Asistencia|Cristales|M[ée]dicos)/i.test(linea)
    );

    console.log('Líneas con coberturas y montos:');
    lineasConMontos.forEach(linea => console.log('  -', linea.trim()));
  }
}

analizarCoberturas().catch(console.error);

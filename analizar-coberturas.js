import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist';

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({data}).promise;
  let fullText = '';
  
  for(let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

async function analizarCoberturas() {
  console.log('\n========================================');
  console.log('📄 PDF 1: Póliza 0971458956');
  console.log('========================================\n');
  
  const texto1 = await extractText('c:\\Users\\alvar\\Downloads\\Póliza 0971458956.pdf');
  
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

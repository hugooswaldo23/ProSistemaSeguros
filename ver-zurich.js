import fs from 'fs';
import pdfParse from 'pdf-parse';

const pdfPath = 'c:\\Users\\alvar\\Downloads\\Polizas para prueba sistema\\Zurich\\111819309 RENOV.pdf';

fs.readFile(pdfPath, async (err, dataBuffer) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  try {
    const data = await pdfParse(dataBuffer);
    const lineas = data.text.split('\n');
    
    console.log('📄 PRIMERAS 80 LÍNEAS DEL PDF ZURICH:\n');
    lineas.slice(0, 80).forEach((linea, i) => {
      console.log(`${(i+1).toString().padStart(3, '0')}: ${linea}`);
    });
    
    console.log('\n\n📄 TOTAL DE LÍNEAS:', lineas.length);
  } catch (error) {
    console.error('Error procesando PDF:', error);
    process.exit(1);
  }
});

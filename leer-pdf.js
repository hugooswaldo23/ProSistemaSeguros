import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = process.argv[2] || 'c:\\Users\\alvar\\Downloads\\PolizaCayenne.pdf';

fs.readFile(pdfPath, (err, dataBuffer) => {
  if (err) {
    console.error('Error leyendo archivo:', err);
    return;
  }

  pdf(dataBuffer).then(function(data) {
    const pages = data.text.split('\f');
    
    console.log('===== PÁGINA 1 =====');
    console.log(pages[0]);
    console.log('\n\n===== PÁGINA 2 =====');
    console.log(pages[1]);
    
    if (pages[2]) {
      console.log('\n\n===== PÁGINA 3 =====');
      console.log(pages[2]);
    }
  }).catch(err => {
    console.error('Error procesando PDF:', err);
  });
});

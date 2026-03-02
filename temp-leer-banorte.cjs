const fs = require('fs');
const pdfParse = require('pdf-parse');

const pdfPath = process.argv[2] || 'C:\\Users\\alvar\\Downloads\\Polizas para prueba sistema\\Banorte\\1021292 anual.pdf';
const buf = fs.readFileSync(pdfPath);
const uint8 = new Uint8Array(buf);

const parser = new pdfParse.PDFParse(uint8);

parser.getText().then(result => {
  if (result && result.pages) {
    result.pages.forEach((p, i) => {
      console.log(`===== PAGINA ${i + 1} =====`);
      console.log(p.text);
    });
  } else {
    console.log(JSON.stringify(result).substring(0, 5000));
  }
}).catch(e => console.error('Error:', e));

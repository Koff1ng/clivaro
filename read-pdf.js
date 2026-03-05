const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync('pdf-output.txt', pdfParser.getRawTextContent());
});

pdfParser.loadPDF("c:\\Users\\Jumez\\OneDrive\\Escritorio\\Programacion\\Ferreteria\\NEA2395.pdf");

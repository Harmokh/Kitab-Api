const mupdf = require("mupdf-js");
const fs = require("fs");

module.exports = async ({ pdfPath, start, end }) => {
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Create document
    const doc = new mupdf.Document(pdfBuffer);

    const pages = [];
    for (let i = start - 1; i < end; i++) {
        const page = doc.loadPage(i); // loadPage returns a Page object
        pages.push(page);
    }

    // MuPDF.js doesn’t have PDFWriter in some versions.
    // You can render pages to images or extract text.
    // If you want a PDF output, you might need `pdf-lib` or `HummusJS`
    // to build a new PDF with these pages.

    return pages; // for now returns Page objects
};

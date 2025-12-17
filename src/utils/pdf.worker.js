const mupdf = require("mupdf-js");
const fs = require("fs");

module.exports = async ({ pdfPath, start, end }) => {
    const pdfBuffer = fs.readFileSync(pdfPath);

    const doc = mupdf.Document.openDocument(pdfBuffer, "pdf");

    const writer = new mupdf.PDFWriter();
    const out = writer.beginDocument();

    for (let i = start - 1; i < end; i++) {
        out.addPage(doc.loadPage(i));
    }

    writer.endDocument();

    return Buffer.from(writer.asBuffer());
};

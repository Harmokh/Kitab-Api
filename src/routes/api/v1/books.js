var express = require("express");
var router = express.Router();
var fs = require("fs");
var path = require("path");
var multer = require("multer");

module.exports = function (models, express) {
    const { Book, BookVersion } = models;
    const uploadDir = path.join(__dirname, "../../../../public/pdfs");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            const chunkIndex = req.headers["chunk-index"] || "0";
            const fileName = req.headers["file-name"] || file.originalname;
            cb(null, `${fileName}.part${chunkIndex}`);
        },
    });
    const upload = multer({ storage });


    // ---------------------------
    // Test endpoint
    // ---------------------------
    router.get("/test/test", function (req, res) {
        res.json({ message: "API is working" });
    });

    // ---------------------------
    // Create a Book
    // ---------------------------
    router.post("/books", async (req, res) => {
        try {
            const { title, author, description, publishedYear, isbn } = req.body;
            const book = await Book.create({ title, author, description, publishedYear, isbn });
            res.status(201).json(book);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    });

    // ---------------------------
    // Upload PDF chunk for a BookVersion
    // ---------------------------
    router.post(
        "/books/:bookId/versions/upload",
        upload.single("pdfChunk"),
        async (req, res) => {
            try {
                const { bookId } = req.params;
                const { language, totalChunks, fileName } = req.body;
                const chunkIndex = req.headers["chunk-index"];

                if (!bookId || !language || !totalChunks || !fileName || !chunkIndex) {
                    return res.status(400).json({ message: "Missing parameters" });
                }

                // Create BookVersion if first chunk
                let version = await BookVersion.findOne({
                    where: { bookId, language },
                });

                if (!version && chunkIndex == 0) {
                    version = await BookVersion.create({
                        bookId,
                        language,
                        pdfPath: null, // will update after assembly
                    });
                }

                res.json({ message: `Chunk ${chunkIndex} uploaded` });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: "Server error" });
            }
        }
    );

    // ---------------------------
    // Assemble chunks into final PDF
    // ---------------------------
    router.post("/books/:bookId/versions/assemble", async (req, res) => {
        try {
            const { bookId } = req.params;
            const { language, totalChunks, fileName } = req.body;

            const finalPath = path.join("./public/pdfs", fileName);
            const writeStream = fs.createWriteStream(finalPath);
            for (let i = 0; i < totalChunks; i++) {
                const chunkPath = path.join(uploadDir, `${fileName}.part${i}`);
                const data = fs.readFileSync(chunkPath);
                writeStream.write(data);
                fs.unlinkSync(chunkPath); // delete chunk after writing
            }
            writeStream.end();
            const version = await BookVersion.findOne({ where: { bookId, language } });
            version.pdfPath = finalPath;
            version.fileSize = fs.statSync(finalPath).size;
            await version.save();

            res.json({ message: "PDF assembled successfully", version });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    });

    // ---------------------------
    // Download PDF with byte-range support
    // ---------------------------
    router.get("/versions/:id/download", async (req, res) => {
        try {
            const version = await BookVersion.findByPk(req.params.id);
            if (!version || !version.pdfPath) return res.status(404).json({ message: "PDF not found" });

            const stat = fs.statSync(version.pdfPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunkSize = end - start + 1;

                const file = fs.createReadStream(version.pdfPath, { start, end });
                const head = {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunkSize,
                    "Content-Type": "application/pdf",
                };
                res.writeHead(206, head);
                file.pipe(res);
            } else {
                const head = {
                    "Content-Length": fileSize,
                    "Content-Type": "application/pdf",
                };
                res.writeHead(200, head);
                fs.createReadStream(version.pdfPath).pipe(res);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Server error" });
        }
    });
    

    return router;
};

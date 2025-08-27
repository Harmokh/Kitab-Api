var express = require("express");
var router = express.Router();
const data = [
    {
        "id": "1",
        "title": "Buzurgo ke Ahwal",
        "author": "Shaykh al-hadith Mawlana Yousuf Motala",
        "cover": "public/images/9.jpg",
        "description": "A comprehensive guide to the life and teachings of Shaykh al-hadith Mawlana Yousuf Motala.",
        "books": [
            {
                "id": "1",
                "title": "Buzurgo ke Ahwal",
                "language": "Bangla",
                "pdfUrl": "public/pdfs/bangla.pdf"
            },
            {
                "id": "2",
                "title": "Buzurgo ke Ahwal",
                "language": "English",
                "pdfUrl": "public/pdfs/english.pdf"
            },
            {
                "id": "3",
                "title": "Buzurgo ke Ahwal",
                "language": "Urdu",
                "pdfUrl": "public/pdfs/urdu.pdf"
            }
        ]
    }
];

module.exports = function (models, express) {
    // Test endpoint
    router.get("/test/test", function (req, res) {
        res.json({ message: "API is working" });
    });
    router.get("/test/books", function (req, res) {
        res.json({
            data: data,
            success: true,
            message: "Books fetched successfully"
        });
    });
    // Get a single book by ID
    router.get("/test/books/:id", function (req, res) {
        const bookId = req.params.id;
        const book = data.find(item => item.id === bookId);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }

        res.json({
            data: book,
            success: true,
            message: "Book fetched successfully"
        });
    });
    // Get a specific book version by book ID and language version
    router.get("/test/book/version/:id", function (req, res) {
        const bookId = req.params.id;
        const language = req.query.language;
        console.log(`Fetching book version for ID: ${bookId}, Language: ${language}`);
        const book = data.find(item => item.id === bookId);
       
        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }
        const version = book.books.find(b => b.language.toLowerCase() === (language || "").toLowerCase());
        console.log(version);
        if (!version) {
            return res.status(404).json({
                success: false,
                message: "Book version not found"
            });
        }
        res.json({
            data: version,
            success: true,
            message: "Book version fetched successfully"
        });
    });
    return router;
};

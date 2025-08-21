var express = require("express");
var router = express.Router();
const data = [
    {
        "id": "1",
        "title": "Buzurgo ke Ahwal",
        "author": "Shaykh al-hadith Mawlana Yousuf Motala",
        "cover": "https://raw.githubusercontent.com/Harmokh/Kitab-Api/refs/heads/main/public/images/9.jpg",
        "description": "A comprehensive guide to the life and teachings of Shaykh al-hadith Mawlana Yousuf Motala.",
        "books": [
            {
                "id": "1",
                "title": "Buzurgo ke Ahwal",
                "language": "Bangla",
                "url": "https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Bangla%20Book%20(17-10-2019).pdf"
            },
            {
                "id": "2",
                "title": "Buzurgo ke Ahwal",
                "language": "English",
                "url": "https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Final%20Moments%20of%20the%20Pious%20(BWA)%20(Eng%20Book).pdf"
            },
            {
                "id": "3",
                "title": "Buzurgo ke Ahwal",
                "language": "Urdu",
                "url": "https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Urdu%20Book.pdf"
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
    router.get("/test/book/:id", function (req, res) {
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
        const language = req.query.language; // e.g., /test/book/version/1?language=English

        const book = data.find(item => item.id === bookId);

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found"
            });
        }
        const version = book.books.find(b => b.language.toLowerCase() === (language || "").toLowerCase());
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

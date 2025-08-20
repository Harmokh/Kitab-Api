var express = require("express");
var router = express.Router();
module.exports = function (models, express) {
    router.get("/test/test", function (req, res) {
        res.json({ message: "API dsa is workingdasdsad sdaasdsa" });
    });

    // https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Bangla%20Book%20(17-10-2019).pdf
    // https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Urdu%20Book.pdf
    // https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Final%20Moments%20of%20the%20Pious%20(BWA)%20(Eng%20Book).pdf
    router.get("/test/books", function (req, res) {
        res.send({
            data: [
                {
                    id: '1',
                    title: 'Buzurgo ke Ahwal',
                    author: 'Shaykh al-hadith Mawlana Yousuf Motala',
                    cover: 'https://firebasestorage.googleapis.com/v0/b/quillblog-f5478.appspot.com/o/pdfs%2FBuzurgon-Ke-Wisal-Ke-Ahwal.jpg?alt=media&token=81c0012a-5be2-4b82-9c24-4a576bf09609',
                    description: 'A comprehensive guide to the life and teachings of Shaykh al-hadith Mawlana Yousuf Motala.',
                    books: [
                        { id: '1', title: 'Buzurgo ke Ahwal', language: 'Bangla', url: 'https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Bangla%20Book%20(17-10-2019).pdf' },
                        { id: '2', title: 'Buzurgo ke Ahwal', language: 'English', url: 'https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Final%20Moments%20of%20the%20Pious%20(BWA)%20(Eng%20Book).pdf' },
                        { id: '3', title: 'Buzurgo ke Ahwal', language: 'Urdu', url: 'https://github.com/Harmokh/Kitab-Api/blob/main/public/pdfs/Buzurgon%20ke%20Wisal%20ke%20Ahwal%20Urdu%20Book.pdf' },
                    ],
                },

            ]
        })
    });

    return router;
};
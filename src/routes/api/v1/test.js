var express = require("express");
var router = express.Router();
module.exports = function (models, express) {
    router.get("/test/test", function (req, res) {
        res.json({ message: "API dsa is workingdasdsad sdaasdsa" });
    });
    return router;
};
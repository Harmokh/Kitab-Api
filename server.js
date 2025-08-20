const express = require("express");
const http = require("http");
const logger = require("morgan");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || 'development';
const envFile = `.env.${environment}`;

require('dotenv').config({
    path: path.resolve(__dirname, envFile)
});

// Fallback to default .env if specific environment file doesn't exist
if (!fs.existsSync(path.resolve(__dirname, envFile))) {
    require('dotenv').config({
        path: path.resolve(__dirname, "./.env")
    });
}

console.log(`🚀 Running in ${process.env.NODE_ENV} environment`);
console.log(`📁 Using config file: ${envFile}`);
console.log(`🌐 API URL: ${process.env.API_URL}`);
console.log(`🔌 Port: ${process.env.API_PORT}`);

const routes = require("./src/routes/routes.js");
const app = express();
const server = http.createServer(app);

// Middleware
app.use(logger('dev', {
    skip: function (req, res) { return res.statusCode < 400 }
}));

app.use(express.json({ limit: "100mb" }));
app.use(
    express.urlencoded({
        limit: "100mb",
        extended: true,
    })
);

app.use(logger('common', {
    stream: fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
}));

// Static files
app.use("/public/images", express.static(__dirname + "/public/images"));
app.use("/public/pdfs", express.static(__dirname + "/public/pdfs"));

// CORS middleware
app.use(function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "X-Requested-With,content-type, Authorization"
    );
    next();
});

const corsOptions = {
    origin: "*",
    optionsSuccessStatus: 200,
    credentials: true,
};
app.use(cors(corsOptions));

// Routes
routes(app, express, "/api/v1");

// Error handling middleware
if (process.env.NODE_ENV === "development") {
    app.use(function (err, req, res, next) {
        console.error('Development Error:', err);
        res.status(err.status || 500).json({
            message: err.message,
            error: err,
            stack: err.stack
        });
    });
} else {
    app.use(function (err, req, res, next) {
        console.error('Production Error:', err.message);
        res.status(err.status || 500).json({
            message: err.message,
            error: {},
        });
    });
}

server.listen(process.env.API_PORT || 5010, function () {
    console.log("✅ Server running on port: " + process.env.API_PORT);
    console.log("📊 Environment: " + process.env.NODE_ENV);
});

module.exports = app;
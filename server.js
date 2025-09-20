const express = require("express"),
  logger = require("morgan"),
  // boom = require("express-boom"),
  cors = require("cors"),
  path = require("path"),
  bodyParser = require("body-parser"),
  dotenv = require("dotenv").config({
    path: path.resolve(__dirname, "./.env.development"),
  }),
  routes = require("./src/routes/routes.js");
const app = express();
app.use("/p", express.static(path.join(__dirname, "/public")));
app.use(logger("dev"));
// app.use(boom());
app.use(express.json({ limit: "50mb" }));
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  })
);

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "*");

  // If it's a preflight request (OPTIONS), end it here
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

routes(app, express, "/api");
if (app.get("env") === "development") {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500).json({
      message: err.message,
      error: err,
    });
  });
} else {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500).json({
      message: err.message,
      error: {},
    });
  });
}

app.listen(process.env.API_PORT || 5001, function () {
  console.log("Running on port: " + process.env.API_PORT);
});

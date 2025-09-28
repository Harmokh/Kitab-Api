var models = require("../models/models.js");
module.exports = function (app, express, routeStart) {
  app.use(routeStart, require("./user.js")(models, express));
  app.use(routeStart, require("./document.js")(models, express));
  app.use(routeStart, require("./book.js")(models, express));
};

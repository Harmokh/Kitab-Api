var models = require("../models/models.js");
module.exports = function (app, express, routeStart) {
  app.use(routeStart, require("./user.js")(models, express));
};

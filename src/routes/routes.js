var models = require("../models/models.js");
module.exports = function (app, express, routeStart) {
  app.use(routeStart, require("./user.js")(models, express));
  app.use(routeStart, require("./document.js")(models, express));
  app.use(routeStart, require("./book.js")(models, express));
  app.use(routeStart, require("./dashboard.js")(models, express));
  app.use(routeStart, require("./userEngagement.js")(models, express));
  app.use(routeStart, require("./favorite.js")(models, express));
  app.use(routeStart, require("./bookmark.js")(models, express));
  app.use(routeStart, require("./userFCMToken.js")(models, express));
  app.use(routeStart, require("./notification.js")(models, express));
  app.use(routeStart, require("./annotation.js")(models, express));
};

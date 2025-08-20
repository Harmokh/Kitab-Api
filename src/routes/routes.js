var models = require("../models/api/v1/models.js");
module.exports = function (app, express, routeStart) {
    app.use(routeStart, require("./api/v1/test")(models, express));
};
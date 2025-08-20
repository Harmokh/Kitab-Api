var Sequelize = require("sequelize");
var sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        pool: {
            max: 5,
            min: 0,
            idle: 10000,
        },
    }
);
var db = {};
db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;
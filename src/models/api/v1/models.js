const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");

const basename = path.basename(__filename);
console.log("models", basename);

const db = {};

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || 3306,
        dialect: process.env.DB_DIALECT || "mysql",
        logging: true,
    }
);

// ✅ Test DB connection first
sequelize
    .authenticate()
    .then(() => {
        console.log("✅ Database connection established.");
    })
    .catch((err) => {
        console.error("❌ Unable to connect to the database:", err);
    });

// Load all models
fs.readdirSync(__dirname)
    .filter(
        (file) =>
            file.indexOf(".") !== 0 &&
            file !== basename &&
            file.slice(-3) === ".js"
    )
    .forEach((file) => {
        const model = require(path.join(__dirname, file))(sequelize, DataTypes);
        db[model.name] = model;
    });

// Run associations
Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

// Sync models
sequelize
    .sync({ alter: true })
    .then(() => {
        console.log("✅ Models synced to DB!");
    })
    .catch((err) => {
        console.error("❌ Error syncing models:", err);
    });

// Export db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

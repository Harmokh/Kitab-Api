const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const basename = path.basename(__filename);
require("dotenv").config();

const db = {};

// Initialize Sequelize for PostgreSQL
const sequelize = new Sequelize(
  process.env.DATABASE_NAME,
  process.env.DATABASE_USER,
  process.env.DATABASE_PASSWORD,
  {
    host: process.env.DATABASE_SERVER,
    dialect: process.env.DATABASE_DIALECT || "postgres",
    port: process.env.DATABASE_PORT || 5432,
    logging: false, // Disable SQL logging
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// Load all model files in the same directory
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

// Apply associations (if any)
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Sync models to DB
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("All models synced with PostgreSQL database.");
  })
  .catch((err) => {
    console.error("Error syncing models:", err);
  });

// Export
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

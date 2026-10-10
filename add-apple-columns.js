const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "./.env.development"),
});

const models = require("./src/models/models.js");

// Adds the Sign in with Apple columns to the Users table.
// Safe to run more than once: a column is only added when it is missing.
async function addAppleColumns() {
    try {
        const { sequelize } = models;
        const queryInterface = sequelize.getQueryInterface();
        const { DataTypes } = models.Sequelize;

        console.log(
            `Database: ${sequelize.config.database} on ${sequelize.config.host}`
        );

        const tableDescription = await queryInterface.describeTable("Users");
        const results = [];

        // One transaction, so both columns are added or neither is. The lock
        // timeout makes this give up instead of queueing behind a busy table,
        // where it would hold up every login until it got its turn.
        await sequelize.transaction(async (transaction) => {
            await sequelize.query("SET LOCAL lock_timeout = '5s'", {
                transaction,
            });

            if (tableDescription.AppleId) {
                results.push("✓ AppleId column already exists");
            } else {
                await queryInterface.addColumn(
                    "Users",
                    "AppleId",
                    {
                        type: DataTypes.STRING(1000),
                        allowNull: true,
                        unique: true,
                    },
                    { transaction }
                );
                results.push("✓ Added AppleId column");
            }

            if (tableDescription.AppleRefreshToken) {
                results.push("✓ AppleRefreshToken column already exists");
            } else {
                await queryInterface.addColumn(
                    "Users",
                    "AppleRefreshToken",
                    {
                        type: DataTypes.TEXT,
                        allowNull: true,
                    },
                    { transaction }
                );
                results.push("✓ Added AppleRefreshToken column");
            }
        });

        results.forEach((line) => console.log(line));
        process.exit(0);
    } catch (error) {
        console.error("Error adding Apple columns (nothing was changed):", error.message);
        process.exit(1);
    }
}

addAppleColumns();

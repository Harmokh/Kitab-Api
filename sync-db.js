const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "./.env.development"),
});

const models = require("./src/models/models.js");

async function syncDatabase() {
    try {
        console.log("Starting database synchronization...");

        // Force sync the Notification model specifically
        await models.Notification.sync({ alter: true });
        console.log("✓ Notification table synced successfully");

        // Verify the table structure
        const tableDescription = await models.sequelize.getQueryInterface().describeTable('Notifications');
        console.log("\nNotifications table structure:");
        console.log(JSON.stringify(tableDescription, null, 2));

        if (tableDescription.UserId) {
            console.log("\n✓ UserId column exists!");
        } else {
            console.log("\n✗ UserId column is missing!");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error syncing database:", error);
        process.exit(1);
    }
}

syncDatabase();

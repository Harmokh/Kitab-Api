const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "./.env.development"),
});

const models = require("./src/models/models.js");

async function fixNotificationTable() {
    try {
        console.log("Starting Notification table fix...\n");

        const queryInterface = models.sequelize.getQueryInterface();

        // Step 1: Check current table structure
        console.log("1. Checking current table structure...");
        const tableDescription = await queryInterface.describeTable('Notifications');
        console.log("Current columns:", Object.keys(tableDescription));

        // Step 2: Check if there are any notifications
        const count = await models.sequelize.query(
            'SELECT COUNT(*) as count FROM "Notifications"',
            { type: models.Sequelize.QueryTypes.SELECT }
        );
        console.log(`\n2. Found ${count[0].count} existing notification(s)`);

        // Step 3: Delete all existing notifications (they're likely invalid/test data)
        if (count[0].count > 0) {
            console.log("\n3. Deleting existing notifications (invalid data)...");
            await models.sequelize.query('DELETE FROM "Notifications"');
            console.log("✓ Deleted all notifications");
        }

        // Step 4: Drop and recreate the table with correct schema
        console.log("\n4. Dropping and recreating Notifications table...");
        await queryInterface.dropTable('Notifications');
        console.log("✓ Dropped Notifications table");

        await models.Notification.sync({ force: true });
        console.log("✓ Recreated Notifications table with correct schema");

        // Step 5: Verify the new structure
        const newTableDescription = await queryInterface.describeTable('Notifications');
        console.log("\n5. New table structure:");
        console.log(JSON.stringify(newTableDescription, null, 2));

        if (newTableDescription.UserId) {
            console.log("\n✅ SUCCESS! UserId column exists with correct schema!");
        } else {
            console.log("\n❌ ERROR: UserId column is still missing!");
        }

        console.log("\n✅ Database fix completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error fixing database:", error.message);
        console.error(error);
        process.exit(1);
    }
}

fixNotificationTable();

const admin = require("firebase-admin");
const { UserDevice, Notification } = require("../models/models");

let isInitialized = false;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        isInitialized = true;
        console.log("Firebase Admin Initialized successfully.");
    } else if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }),
        });
        isInitialized = true;
        console.log("Firebase Admin Initialized with env vars.");
    } else {
        console.warn(
            "Firebase Admin NOT initialized. Missing credentials. Notifications will not be sent."
        );
    }
} catch (error) {
    console.error("Error initializing Firebase Admin:", error);
}

const notificationService = {
    /**
     * Send a notification to a specific device token
     * @param {string} token - The FCM device token
     * @param {object} notification - { title, body }
     * @param {object} data - Custom data payload (optional)
     */
    sendToDevice: async (token, notification, data = {}) => {
        if (!isInitialized) return { success: false, error: "Firebase not initialized" };

        const message = {
            notification,
            data,
            token,
        };

        try {
            const response = await admin.messaging().send(message);
            console.log("Successfully sent message:", response);
            return { success: true, messageId: response };
        } catch (error) {
            console.error("Error sending message:", error);
            if (error.code === 'messaging/registration-token-not-registered') {
                // Token is invalid, maybe remove it from DB?
                await UserDevice.update({ isActive: false }, { where: { token } });
            }
            return { success: false, error };
        }
    },

    /**
     * Send a notification to a user (all active devices)
     * @param {string} userId - The user ID
     * @param {object} notification - { title, body }
     * @param {object} data - Custom data payload
     */
    sendToUser: async (userId, notification, data = {}, type = 'general') => {
        // 1. Persist to Database
        let savedNotification = null;
        try {
            savedNotification = await Notification.create({
                userId,
                title: notification.title,
                body: notification.body,
                data,
                type,
                isRead: false
            });
        } catch (dbError) {
            console.error("Error saving notification to DB:", dbError);
            // We continue to send push even if DB save fails, or we could return error.
            // For now, let's log and continue, but ideally we want both.
        }

        if (!isInitialized) {
            return {
                success: true, // We consider it success if saved to DB, even if push fails (or is disabled)
                savedNotification,
                message: "Notification saved to DB. Firebase not initialized for push."
            };
        }

        try {
            const devices = await UserDevice.findAll({
                where: { userId, isActive: true },
            });

            if (!devices || devices.length === 0) {
                return {
                    success: true,
                    savedNotification,
                    message: "Notification saved to DB. No active devices found for push."
                };
            }

            const tokens = devices.map((d) => d.token);

            // Multicast message
            const message = {
                notification,
                data: { ...data, notificationId: savedNotification ? savedNotification.id : "" }, // Include ID in payload
                tokens,
            };

            const response = await admin.messaging().sendEachForMulticast(message);

            // Handle failed tokens
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(tokens[idx]);
                        if (resp.error.code === 'messaging/registration-token-not-registered') {
                            // Mark as inactive
                            UserDevice.update({ isActive: false }, { where: { token: tokens[idx] } });
                        }
                    }
                });
                console.log('List of tokens that caused failures: ' + failedTokens);
            }

            return { success: true, response, savedNotification };
        } catch (error) {
            console.error("Error sending to user:", error);
            return { success: false, error, savedNotification };
        }
    },
};

module.exports = notificationService;

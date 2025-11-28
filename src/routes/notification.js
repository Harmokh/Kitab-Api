const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const notificationService = require("../services/notificationService");

module.exports = (models, router) => {
    const notificationRouter = router.Router();

    // 📱 Register Device Token
    notificationRouter.post("/notifications/register-device", authenticate, async (req, res) => {
        try {
            const { token, deviceType } = req.body;
            const userId = req.user.id; // From authenticate middleware

            if (!token) {
                return warning(res, "Token is required", MessageType.Warning);
            }

            // Check if token already exists
            let device = await models.UserDevice.findOne({ where: { token } });

            if (device) {
                // Update user if changed (e.g. user logout/login on same device)
                if (device.userId !== userId) {
                    await device.update({ userId, isActive: true });
                } else if (!device.isActive) {
                    await device.update({ isActive: true });
                }
            } else {
                // Create new
                device = await models.UserDevice.create({
                    userId,
                    token,
                    deviceType: deviceType || "android",
                    isActive: true,
                });
            }

            return success(res, device, "Device registered successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🔔 Send Notification (For testing/admin purposes)
    notificationRouter.post("/notifications/send", authenticate, async (req, res) => {
        try {
            const { userId, title, body, data } = req.body;

            if (!userId || !title || !body) {
                return warning(res, "UserId, title, and body are required", MessageType.Warning);
            }

            const result = await notificationService.sendToUser(userId, { title, body }, data);

            if (result.success) {
                return success(res, result, "Notification sent successfully");
            } else {
                return error(res, result.error || result.message || "Failed to send notification");
            }
        } catch (err) {
            return error(res, err.message);
        }
    });

    return notificationRouter;
};

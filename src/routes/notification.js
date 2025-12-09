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
            const { userId, title, body, data, type } = req.body;

            if (!userId || !title || !body) {
                return warning(res, "UserId, title, and body are required", MessageType.Warning);
            }

            const result = await notificationService.sendToUser(userId, { title, body }, data, type);

            if (result.success) {
                return success(res, result, "Notification processed successfully");
            } else {
                return error(res, result.error || result.message || "Failed to send notification");
            }
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 📥 Get All Notifications for User (Paginated)
    notificationRouter.get("/notifications/getall", authenticate, async (req, res) => {
        try {
            const { pageSize = 20, currentPage = 1 } = req.query;
            const size = parseInt(pageSize);
            const page = parseInt(currentPage);

            const result = await models.Notification.findAndCountAll({
                where: {
                    userId: req.user.id,
                    isDeleted: false
                },
                limit: size,
                offset: (page - 1) * size,
                order: [["CreatedAt", "DESC"]]
            });

            return success(
                res,
                {
                    totalNotifications: result.count,
                    pageSize: size,
                    currentPage: page,
                    totalPages: Math.ceil(result.count / size),
                    hasMore: (page * size) < result.count,
                    data: result.rows,
                },
                "Notifications fetched successfully"
            );
        } catch (err) {
            return error(res, err.message);
        }
    });

    // ✅ Mark Notification as Read
    notificationRouter.put("/notifications/mark-read", authenticate, async (req, res) => {
        try {
            const { notificationId, markAll } = req.body;

            if (markAll) {
                await models.Notification.update(
                    { isRead: true },
                    {
                        where: {
                            userId: req.user.id,
                            isRead: false,
                            isDeleted: false
                        }
                    }
                );
                return success(res, null, "All notifications marked as read");
            }

            if (!notificationId) {
                return warning(res, "notificationId is required", MessageType.Warning);
            }

            const notification = await models.Notification.findOne({
                where: { id: notificationId, userId: req.user.id }
            });

            if (!notification) {
                return warning(res, "Notification not found", MessageType.Warning);
            }

            await notification.update({ isRead: true });
            return success(res, null, "Notification marked as read");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🗑️ Delete Notification (Soft Delete)
    notificationRouter.delete("/notifications/delete", authenticate, async (req, res) => {
        try {
            const { notificationId } = req.query;

            if (!notificationId) {
                return warning(res, "notificationId is required", MessageType.Warning);
            }

            const notification = await models.Notification.findOne({
                where: { id: notificationId, userId: req.user.id }
            });

            if (!notification) {
                return warning(res, "Notification not found", MessageType.Warning);
            }

            await notification.update({ isDeleted: true });
            return success(res, null, "Notification deleted successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🔢 Get Unread Count
    notificationRouter.get("/notifications/unread-count", authenticate, async (req, res) => {
        try {
            const count = await models.Notification.count({
                where: {
                    userId: req.user.id,
                    isRead: false,
                    isDeleted: false
                }
            });

            return success(res, { count }, "Unread count fetched successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // test server notification for a user 
    notificationRouter.post("/notifications/test/:userId", async (req, res) => {
        try {
            const { userId } = req.params;
            const result = await notificationService.sendToUser(userId, { title: "Test Notification", body: "This is a test notification" });
            return success(res, result, "Notification processed successfully");
        } catch (err) {
            return error(res, err.message);
        }
    })
    notificationRouter.get("/notifications/getdevicetoken/:userId", async (req, res) => {
        try {
            const { userId } = req.params;
            // get the device token of the user bu id 
            const device = await models.UserDevice.findOne({ where: { userId } });
            if (!device) {
                return warning(res, "Device not found", MessageType.Warning);
            }
            const token = device.token;
            return success(res, token, "Device token fetched successfully");

        } catch (err) {
            return error(res, err.message);
        }
    })

    return notificationRouter;
};

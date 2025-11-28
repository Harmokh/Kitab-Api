const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");

module.exports = (models, router) => {
  const userFCMRouter = router.Router();

  // ✅ Create or Update FCM Token
  // POST /fcm/save
  userFCMRouter.post("/fcm/save", authenticate, async (req, res) => {
    try {
      const { fcmToken, deviceType } = req.body;
      const userId = req.user.id;

      if (!fcmToken) return error(res, "FCM token required");

      // Check if token already exists
      let existing = await models.UserFcmToken.findOne({
        where: { userId, fcmToken },
      });

      if (!existing) {
        existing = await models.UserFcmToken.create({
          userId,
          fcmToken,
          deviceType,
          isActive: true,
        });
      } else {
        await existing.update({ isActive: true });
      }

      return success(res, existing, "Token saved");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ✅ Remove a specific FCM Token
  // POST /fcm/remove
  userFCMRouter.post("/fcm/remove", authenticate, async (req, res) => {
    try {
      const { fcmToken } = req.body;
      const userId = req.user.id;

      if (!fcmToken) return error(res, "FCM token required");

      const removed = await models.UserFcmToken.destroy({
        where: { userId, fcmToken },
      });

      return success(res, removed, "Token removed");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ✅ Remove ALL tokens for user (logout)
  // POST /fcm/remove-all
  userFCMRouter.post("/fcm/remove-all", authenticate, async (req, res) => {
    try {
      const userId = req.user.id;

      const removed = await models.UserFcmToken.destroy({
        where: { userId },
      });

      return success(res, removed, "All tokens removed");
    } catch (err) {
      return error(res, err.message);
    }
  });

  return userFCMRouter;
};

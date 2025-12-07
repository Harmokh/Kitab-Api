const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");
const { sendToUser } = require("../services/notificationService");

module.exports = (models, router) => {
  const announcementRouter = router.Router();
  // ⭐ POST – Add or Update Announcement
  announcementRouter.post(
    "/announcement/save",
    authenticate,
    async (req, res) => {
      try {
        const { id, title, description, imageUrl, startDate, endDate } =
          req.body;

        // 🔸 Validate Title
        if (!title) {
          return warning(res, "Title is required", MessageType.Warning);
        }

        // 🔸 Validate Description
        if (!description) {
          return warning(res, "Description is required", MessageType.Warning);
        }

        let announcement;

        // ==========================================
        // 🟢 CASE 1: UPDATE
        // ==========================================
        if (id) {
          const existing = await models.Announcement.findOne({
            where: { id, isDeleted: false },
          });

          if (!existing) {
            return warning(res, "Announcement not found", MessageType.Warning);
          }

          await models.Announcement.update(
            {
              title,
              description,
              imageUrl,
              startDate,
              endDate,
            },
            { where: { id } }
          );

          announcement = { id, title, description };

          return success(res, null, "Announcement updated successfully");
        }

        // ==========================================
        // 🟢 CASE 2: CREATE
        // ==========================================
        const created = await models.Announcement.create({
          title,
          description,
          imageUrl,
          startDate,
          endDate,
          isActive: true,
          isDeleted: false,
        });

        await sendNotificationOfAnnouncement(
          title,
          description,
          {
            announcementId: created.id,
            title,
            description,
          },
          "announcement"
        );

        return success(res, created, "Announcement created successfully");
      } catch (err) {
        console.error("Error in announcement save:", err);
        return error(res, err.message);
      }
    }
  );

  // ⭐ GETALL – Only Active & Within Start/End Date
  announcementRouter.get(
    "/announcement/getall",
    authenticate,
    async (req, res) => {
      try {
        const { pageSize = 10, currentPage = 1 } = req.query;
        const now = new Date();

        const data = await models.Announcement.findAndCountAll({
          where: {
            isDeleted: false,
            isActive: true,
            startDate: { [Op.lte]: now },
            endDate: { [Op.gte]: now },
          },
          limit: parseInt(pageSize),
          offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
          order: [["CreatedAt", "DESC"]],
        });

        return success(res, data, "Announcements fetched successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  // ⭐ GETBYID – Only if inside date range
  announcementRouter.get(
    "/announcement/getbyid",
    authenticate,
    async (req, res) => {
      try {
        const { id } = req.query;
        if (!id)
          return warning(
            res,
            "Announcement id is required",
            MessageType.Warning
          );

        const now = new Date();

        const data = await models.Announcement.findOne({
          where: {
            id,
            isDeleted: false,
            isActive: true,
            startDate: { [Op.lte]: now },
            endDate: { [Op.gte]: now },
          },
        });

        if (!data)
          return warning(res, "Announcement not found", MessageType.Warning);

        return success(res, data, "Announcement fetched successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  // ⭐ DELETE – Soft Delete
  announcementRouter.delete(
    "/announcement/delete",
    authenticate,
    async (req, res) => {
      try {
        const { id } = req.query;

        if (!id)
          return warning(
            res,
            "Announcement id is required",
            MessageType.Warning
          );

        const updated = await models.Announcement.update(
          { isDeleted: true },
          { where: { id } }
        );

        if (!updated[0])
          return warning(res, "Announcement not found", MessageType.Warning);

        return success(res, null, "Announcement deleted successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  const sendNotificationOfAnnouncement = async (title, body, data, type) => {
    try {
      const users = await models.User.findAll({
        where: { isActive: true, isVerified: true, isDeleted: false },
      });
      for (const user of users) {
        await sendToUser(user.id, { title, body }, data, type);
      }
    } catch (err) {
      console.error("Error sending announcement notifications:", err);
    }
  };

  return announcementRouter;
};

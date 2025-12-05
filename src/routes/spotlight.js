const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");

module.exports = (models, router) => {
  const spotlightRouter = router.Router();

  // ⭐ POST – Create or Update Spotlight
  spotlightRouter.post(
    "/spotlight/saveOrUpdate",
    authenticate,
    async (req, res) => {
      try {
        const {
          id,
          title,
          subtitle,
          buttonText,
          image,
          route,
          routeType,
          priority,
          backgroundColor,
          startDate,
          endDate,
          bookId,
        } = req.body;

        // --------------------------
        // 1️⃣ Validate Required Fields
        // --------------------------
        if (!title)
          return warning(res, "Title is required", MessageType.Warning);

        // --------------------------
        // 2️⃣ UPDATE Case
        // --------------------------
        if (id) {
          const updated = await models.Spotlight.update(
            {
              title,
              subtitle,
              buttonText,
              image,
              route,
              routeType,
              priority,
              backgroundColor,
              startDate,
              endDate,
              bookId,
              isActive: true,
              isDeleted: false,
            },
            { where: { id, isDeleted: false } }
          );

          if (!updated[0])
            return warning(res, "Spotlight not found", MessageType.Warning);

          return success(res, null, "Spotlight updated successfully");
        }

        // --------------------------
        // 3️⃣ CREATE Case
        // --------------------------
        const data = await models.Spotlight.create({
          title,
          subtitle,
          buttonText,
          image,
          route,
          routeType,
          priority,
          backgroundColor,
          startDate,
          endDate,
          bookId,
          isActive: true,
          isDeleted: false,
        });

        return success(res, data, "Spotlight created successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  // ⭐ GETALL – Active & Valid Date Range
  spotlightRouter.get("/spotlight/getall", authenticate, async (req, res) => {
    try {
      const { pageSize = 10, currentPage = 1 } = req.query;
      const now = new Date();

      const data = await models.Spotlight.findAndCountAll({
        where: {
          isDeleted: false,
          isActive: true,
          startDate: { [Op.lte]: now },
          endDate: { [Op.gte]: now },
        },
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [
          ["priority", "ASC"],
          ["CreatedAt", "DESC"],
        ],
      });

      return success(res, data, "Spotlights fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ⭐ GETBYID
  spotlightRouter.get("/spotlight/getbyid", authenticate, async (req, res) => {
    try {
      const { id } = req.query;

      if (!id)
        return warning(res, "Spotlight id is required", MessageType.Warning);

      const now = new Date();

      const data = await models.Spotlight.findOne({
        where: {
          id,
          isDeleted: false,
          isActive: true,
          startDate: { [Op.lte]: now },
          endDate: { [Op.gte]: now },
        },
      });

      if (!data)
        return warning(res, "Spotlight not found", MessageType.Warning);

      return success(res, data, "Spotlight fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ⭐ DELETE – Soft Delete
  spotlightRouter.delete(
    "/spotlight/delete",
    authenticate,
    async (req, res) => {
      try {
        const { id } = req.query;

        if (!id)
          return warning(res, "Spotlight id is required", MessageType.Warning);

        const updated = await models.Spotlight.update(
          { isDeleted: true },
          { where: { id } }
        );

        if (!updated[0])
          return warning(res, "Spotlight not found", MessageType.Warning);

        return success(res, null, "Spotlight deleted successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  return spotlightRouter;
};

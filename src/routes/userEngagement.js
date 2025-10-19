const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");

module.exports = (models, router) => {
  const engagementRouter = router.Router();

  engagementRouter.post("/engagement/save", authenticate, async (req, res) => {
    try {
      const { bookVersionId, actionType, pageNumber, additionalInfo } =
        req.body;
      if (!actionType)
        return warning(res, "actionType is required", MessageType.Warning);

      const engagement = await models.UserEngagement.create({
        userId: req.user.id,
        bookVersionId,
        action: actionType,
        pageNumber,
        additionalInfo,
      });

      return success(res, engagement, "User engagement recorded successfully");
    } catch (err) {
      return error(res, err.message || "Error recording user engagement");
    }
  });
  

  engagementRouter.get("/engagement/getall", authenticate, async (req, res) => {
    try {
      const {
        pageSize = 10,
        currentPage = 1,
        bookVersionId,
        actionType,
      } = req.query;
      const whereClause = { userId: req.user.id, isDeleted: false };
      if (bookVersionId) whereClause.bookVersionId = bookVersionId;
      if (actionType) whereClause.action = actionType;

      const result = await models.UserEngagement.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "bookId", "filePath", "originalName"],
            include: [
              {
                model: models.Book,
                as: "Book",
                attributes: ["id", "title", "author"],
              },
            ],
          },
        ],
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "User engagement fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  engagementRouter.get(
    "/engagement/getbyid",
    authenticate,
    async (req, res) => {
      try {
        const { id } = req.query;
        if (!id)
          return warning(res, "Engagement id is required", MessageType.Warning);

        const engagement = await models.UserEngagement.findOne({
          where: { id, userId: req.user.id, isDeleted: false },
          include: [
            {
              model: models.BookVersion,
              as: "BookVersion",
              attributes: ["id", "filePath", "originalName"],
              include: [
                {
                  model: models.Book,
                  as: "Book",
                  attributes: ["id", "title", "author"],
                },
              ],
            },
          ],
        });

        if (!engagement)
          return warning(res, "Engagement not found", MessageType.Warning);
        return success(res, engagement, "User engagement fetched successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  engagementRouter.delete(
    "/engagement/delete",
    authenticate,
    async (req, res) => {
      try {
        const { id } = req.query;
        if (!id)
          return warning(res, "Engagement id is required", MessageType.Warning);

        const [updated] = await models.UserEngagement.update(
          { isDeleted: true, isActive: false },
          { where: { id, userId: req.user.id } }
        );

        if (updated)
          return success(res, null, "User engagement removed successfully");
        else return warning(res, "Engagement not found", MessageType.Warning);
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  engagementRouter.get("/engagement/report", authenticate, async (req, res) => {
    try {
      const { bookVersionId } = req.query;
      if (!bookVersionId)
        return warning(res, "bookVersionId is required", MessageType.Warning);

      const report = await models.UserEngagement.findAll({
        where: { bookVersionId, isDeleted: false },
        include: [
          {
            model: models.User,
            as: "User",
            attributes: ["id", "name", "email"],
          },
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "filePath", "originalName"],
          },
        ],
        order: [["CreatedAt", "DESC"]],
      });

      return success(
        res,
        report,
        "User engagement report fetched successfully"
      );
    } catch (err) {
      return error(res, err.message);
    }
  });

  return engagementRouter;
};

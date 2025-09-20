const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");

module.exports = (models, router) => {
  const favoriteRouter = router.Router();

  // ✅ Add or Toggle Favorite
  // POST /favorite/save
  favoriteRouter.post("/favorite/save", authenticate, async (req, res) => {
    try {
      const { bookVersionId } = req.body;
      if (!bookVersionId) return warning(res, "bookVersionId is required", MessageType.Warning);

      // Check if already favorited
      let favorite = await models.Favorite.findOne({
        where: { userId: req.user.id, bookVersionId, isDeleted: false },
      });

      if (favorite) {
        return warning(res, "Already added to favorites", MessageType.Warning);
      }

      favorite = await models.Favorite.create({
        userId: req.user.id,
        bookVersionId,
      });

      return success(res, favorite, "Added to favorites successfully");
    } catch (err) {
      return error(res, err.message || "Error adding to favorites");
    }
  });

  // 🔍 Get All Favorites
  // GET /favorite/getall
  favoriteRouter.get("/favorite/getall", authenticate, async (req, res) => {
    try {
      const { pageSize = 10, currentPage = 1 } = req.query;

      const result = await models.Favorite.findAndCountAll({
        where: { userId: req.user.id, isDeleted: false },
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "bookId", "filePath", "originalName"],
            include: [
              {
                model: models.Book,
                as: "Book",
                attributes: ["id", "title", "author", "description"],
              },
            ],
          },
        ],
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Favorites fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🔍 Get Favorite by ID
  // GET /favorite/getbyid
  favoriteRouter.get("/favorite/getbyid", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) return warning(res, "Favorite id is required", MessageType.Warning);

      const favorite = await models.Favorite.findOne({
        where: { id, userId: req.user.id, isDeleted: false },
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "bookId", "filePath", "originalName"],
            include: [
              { model: models.Book, as: "Book", attributes: ["id", "title", "author", "description"] },
            ],
          },
        ],
      });

      if (!favorite) return warning(res, "Favorite not found", MessageType.Warning);
      return success(res, favorite, "Favorite fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🗑️ Delete Favorite (Soft Delete)
  // DELETE /favorite/delete
  favoriteRouter.delete("/favorite/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) return warning(res, "Favorite id is required", MessageType.Warning);

      const [updated] = await models.Favorite.update(
        { isDeleted: true, isActive: false },
        { where: { id, userId: req.user.id } }
      );

      if (updated) return success(res, null, "Favorite removed successfully");
      else return warning(res, "Favorite not found", MessageType.Warning);
    } catch (err) {
      return error(res, err.message);
    }
  });

  return favoriteRouter;
};

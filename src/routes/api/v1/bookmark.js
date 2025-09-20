const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");

module.exports = (models, router) => {
  const bookmarkRouter = router.Router();

  // ✅ Create or Update Bookmark
  // POST /bookmark/save
  bookmarkRouter.post("/bookmark/save", authenticate, async (req, res) => {
    try {
      const { bookVersionId, pageNumber, note } = req.body;
      if (!bookVersionId || !pageNumber)
        return warning(
          res,
          "bookVersionId and pageNumber are required",
          MessageType.Warning
        );

      // Check if bookmark already exists for this user + version + page
      let bookmark = await models.Bookmark.findOne({
        where: {
          userId: req.user.id,
          bookVersionId,
          pageNumber,
          isDeleted: false,
        },
      });

      if (bookmark) {
        // Update note if it exists
        await bookmark.update({ note });
        return success(res, bookmark, "Bookmark updated successfully");
      } else {
        bookmark = await models.Bookmark.create({
          userId: req.user.id,
          bookVersionId,
          pageNumber,
          note,
        });
        return success(res, bookmark, "Bookmark created successfully");
      }
    } catch (err) {
      console.error(err);
      return error(res, err.message || "Error saving bookmark");
    }
  });

  // 🔍 Get All Bookmarks for a User
  // GET /bookmark/getall
  bookmarkRouter.get("/bookmark/getall", authenticate, async (req, res) => {
    try {
      const { pageSize = 10, currentPage = 1, bookVersionId } = req.query;

      const whereClause = { userId: req.user.id, isDeleted: false };
      if (bookVersionId) whereClause.bookVersionId = bookVersionId;

      const result = await models.Bookmark.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "bookId", "filePath", "originalName"],
          },
        ],
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Bookmarks fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🔍 Get All Bookmarks for a Book Version
  // GET /bookmark/getbyversion
  bookmarkRouter.get(
    "/bookmark/getbyversion",
    authenticate,
    async (req, res) => {
      try {
        const { bookVersionId } = req.query;
        if (!bookVersionId)
          return warning(res, "bookVersionId is required", MessageType.Warning);

        const bookmarks = await models.Bookmark.findAll({
          where: { userId: req.user.id, bookVersionId, isDeleted: false },
          order: [["CreatedAt", "DESC"]],
        });

        return success(res, bookmarks, "Bookmarks fetched successfully");
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

  // 🔍 Get Single Bookmark by ID
  // GET /bookmark/getbyid
  bookmarkRouter.get("/bookmark/getbyid", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      if (!id)
        return warning(res, "Bookmark id is required", MessageType.Warning);

      const bookmark = await models.Bookmark.findOne({
        where: { id, userId: req.user.id, isDeleted: false },
        include: [
          {
            model: models.BookVersion,
            as: "BookVersion",
            attributes: ["id", "bookId", "filePath", "originalName"],
          },
        ],
      });

      if (!bookmark)
        return warning(res, "Bookmark not found", MessageType.Warning);
      return success(res, bookmark, "Bookmark fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🗑️ Delete Bookmark (Soft Delete)
  // DELETE /bookmark/delete
  bookmarkRouter.delete("/bookmark/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      if (!id)
        return warning(res, "Bookmark id is required", MessageType.Warning);

      const [updated] = await models.Bookmark.update(
        { isDeleted: true, isActive: false },
        { where: { id, userId: req.user.id } }
      );

      if (updated) return success(res, null, "Bookmark deleted successfully");
      else return warning(res, "Bookmark not found", MessageType.Warning);
    } catch (err) {
      return error(res, err.message);
    }
  });

  return bookmarkRouter;
};

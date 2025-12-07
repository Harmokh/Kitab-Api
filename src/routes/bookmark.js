const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { sendToUser } = require("../services/notificationService");

module.exports = (models, router) => {
  const bookmarkRouter = router.Router();

  // ✅ Create or Update Bookmark
  // POST /bookmark/save
  bookmarkRouter.post("/bookmark/save", authenticate, async (req, res) => {
    try {
      const { bookVersionId, pageNumber, note, bookId } = req.body;
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
        await sendToUser(
          req.user.id,
          {
            title: "Bookmark Added",
            body: `Bookmark added on page ${pageNumber} of your book version.`,
          },
          {
            bookmarkId: bookmark.id,
            versionId: bookVersionId,
            pageNumber: pageNumber,
            bookId: bookId,
          },
          "bookmark"
        );
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
            attributes: ["id", "bookId", "pdfPath", "versionName"],
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

  bookmarkRouter.get(
    "/bookmark/getgroupedbookmarks",
    authenticate,
    async (req, res) => {
      try {
        const { pageSize = 10, currentPage = 1, bookId } = req.query;

        const size = parseInt(pageSize);
        const page = parseInt(currentPage);

        const bookWhere = { isDeleted: false };
        if (bookId) bookWhere.id = bookId;

        const result = await models.Book.findAndCountAll({
          where: bookWhere,
          limit: size,
          offset: (page - 1) * size,
          order: [["CreatedAt", "DESC"]],

          include: [
            {
              model: models.BookVersion,
              as: "Versions",
              attributes: ["id", "versionName", "pdfPath", "image"],
              required: false,

              include: [
                {
                  model: models.Bookmark,
                  as: "Bookmarks",
                  attributes: ["id", "pageNumber", "CreatedAt"],
                  required: false,
                  where: {
                    userId: req.user.id,
                    isDeleted: false,
                  },
                },
              ],
            },
          ],
        });

        return success(
          res,
          {
            totalBooks: result.count,
            pageSize: size,
            currentPage: page,
            totalPages: Math.ceil(result.count / size),
            data: result.rows,
          },
          "Books with versions + bookmarks fetched successfully"
        );
      } catch (err) {
        return error(res, err.message);
      }
    }
  );

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
            attributes: ["id", "versionName", "pdfPath", "image"],
            include: [
              {
                model: models.Book,
                as: "Book",
                attributes: [
                  "id",
                  "title",
                  "coverImage",
                  "author",
                  "description",
                  "CreatedAt",
                ],
                required: false,
              },
            ],
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

  // 🗑️ Delete Bookmark (Hard Delete)
  // DELETE /bookmark/delete
  bookmarkRouter.delete("/bookmark/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      if (!id)
        return warning(res, "Bookmark id is required", MessageType.Warning);

      const updated = await models.Bookmark.destroy({
        where: { id, userId: req.user.id },
      });

      if (updated) return success(res, null, "Bookmark deleted successfully");
      else return warning(res, "Bookmark not found", MessageType.Warning);
    } catch (err) {
      return error(res, err.message);
    }
  });
  // 🔍 Get All Books with User's Bookmarks (Optimized Query)
  // GET /bookmark/getallgrouped
  bookmarkRouter.get(
    "/bookmark/getallgroupedforuser",
    authenticate,
    async (req, res) => {
      try {
        const { pageSize = 20, currentPage = 1 } = req.query;

        const size = parseInt(pageSize);
        const page = parseInt(currentPage);

        // Step 1: First get all bookmarks for this user with their book/version info
        const userBookmarks = await models.Bookmark.findAll({
          where: {
            userId: req.user.id,
            isDeleted: false,
          },
          include: [
            {
              model: models.BookVersion,
              as: "BookVersion",
              attributes: ["id", "versionName", "pdfPath", "image", "bookId"],
              required: true,
              include: [
                {
                  model: models.Book,
                  as: "Book",
                  attributes: [
                    "id",
                    "title",
                    "coverImage",
                    "author",
                    "description",
                  ],
                  required: true,
                },
              ],
            },
          ],
          order: [
            [
              { model: models.BookVersion, as: "BookVersion" },
              { model: models.Book, as: "Book" },
              "title",
              "ASC",
            ],
            ["bookVersionId", "ASC"],
            ["pageNumber", "ASC"],
          ],
        });

        // Step 2: Group bookmarks by Book → Version → Bookmarks
        const groupedData = {};

        userBookmarks.forEach((bookmark) => {
          const book = bookmark.BookVersion.Book;
          const version = bookmark.BookVersion;

          // Initialize book if not exists
          if (!groupedData[book.id]) {
            groupedData[book.id] = {
              id: book.id,
              title: book.title,
              coverImage: book.coverImage,
              author: book.author,
              description: book.description,
              versions: {},
            };
          }

          // Initialize version if not exists
          if (!groupedData[book.id].versions[version.id]) {
            groupedData[book.id].versions[version.id] = {
              id: version.id,
              versionName: version.versionName,
              pdfPath: version.pdfPath,
              image: version.image,
              bookId: version.bookId,
              bookmarks: [],
            };
          }

          // Add bookmark to version
          groupedData[book.id].versions[version.id].bookmarks.push({
            id: bookmark.id,
            pageNumber: bookmark.pageNumber,
            note: bookmark.note,
            createdAt: bookmark.CreatedAt,
            updatedAt: bookmark.UpdatedAt,
          });
        });

        // Step 3: Convert to array format
        const booksArray = Object.values(groupedData).map((book) => ({
          ...book,
          versions: Object.values(book.versions).map((version) => ({
            ...version,
            bookmarkCount: version.bookmarks.length,
          })),
          totalBookmarks: Object.values(book.versions).reduce(
            (sum, version) => sum + version.bookmarks.length,
            0
          ),
        }));

        // Step 4: Apply pagination
        const startIndex = (page - 1) * size;
        const endIndex = startIndex + size;
        const paginatedBooks = booksArray.slice(startIndex, endIndex);

        return success(
          res,
          {
            totalBooksWithBookmarks: booksArray.length,
            pageSize: size,
            currentPage: page,
            totalPages: Math.ceil(booksArray.length / size),
            hasMore: endIndex < booksArray.length,
            data: paginatedBooks,
          },
          "All books with user's bookmarks fetched successfully"
        );
      } catch (err) {
        console.error("Error in getallgrouped:", err);
        return error(res, err.message);
      }
    }
  );

  return bookmarkRouter;
};

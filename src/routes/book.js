const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const rootDir = path.resolve(__dirname, "../../");
module.exports = (models, router) => {
  const bookRouter = router.Router();

  // POST /book/save
  bookRouter.post("/book/save", authenticate, async (req, res) => {
    const {
      id,
      title,
      author,
      image,
      description,
      publishedYear,
      isbn,
      versions = [],
    } = req.body;

    try {
      const savedBook = await models.sequelize.transaction(async (t) => {
        // 🔹 Check unique ISBN
        // const existingBook = await models.Book.findOne({
        //   where: { isbn, ...(id ? { id: { [Op.ne]: id } } : {}) },
        //   transaction: t,
        // });

        // if (existingBook) {
        //   throw new Error("ISBN must be unique");
        // }

        let bookRecord;
        if (id) {
          // 🔹 Update Book
          bookRecord = await models.Book.findByPk(id, { transaction: t });
          if (bookRecord) {
            await bookRecord.update(
              { title, author, description, publishedYear, isbn, image },
              { transaction: t }
            );

            // 🔹 Remove old versions (if needed)
            await models.BookVersion.destroy({
              where: { bookId: id },
              transaction: t,
            });
          }
        }

        if (!bookRecord) {
          // 🔹 Create Book
          bookRecord = await models.Book.create(
            { title, author, description, publishedYear, isbn, image },
            { transaction: t }
          );
        }

        // 🔹 Create Versions if provided
        if (versions.length > 0) {
          const versionRecords = versions.map((v) => ({
            versionName: v.versionName,
            pdfPath: v.pdfPath,
            bookId: bookRecord.id,
          }));
          await models.BookVersion.bulkCreate(versionRecords, {
            transaction: t,
          });
        }

        // 🔹 Return Book with Versions
        return models.Book.findByPk(bookRecord.id, {
          include: [{ model: models.BookVersion, as: "Versions" }],
          transaction: t,
        });
      });

      return success(
        res,
        savedBook,
        id ? "Book updated successfully" : "Book created successfully"
      );
    } catch (err) {
      if (err.message === "ISBN must be unique") {
        return warning(res, err.message, MessageType.Warning);
      }
      return error(
        res,
        err.message || "An error occurred while saving the book."
      );
    }
  });

  // 🔍 Get Book by ID
  bookRouter.get("/book/getbyid", authenticate, async (req, res) => {
    try {
      const book = await models.Book.findByPk(req.query.id, {
        include: [{ model: models.BookVersion, as: "Versions" }],
      });
      if (!book) return warning(res, "Book not found", MessageType.Warning);

      return success(res, book, "Book fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 Get All Books with Pagination & Filters
  bookRouter.get("/book/getall", authenticate, async (req, res) => {
    try {
      const { pageSize = 10, currentPage = 1, ...filters } = req.query;
      const whereClause = {};

      // for (const key in filters) {
      //   if (filters[key])
      //     whereClause[key] = { [Op.iLike]: `%${filters[key]}%` };
      // }

      const result = await models.Book.findAndCountAll({
        // where: whereClause,
        include: [{ model: models.BookVersion, as: "Versions" }],
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Books fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 Get Master List (All Books without pagination)
  bookRouter.get("/book/getmaster", authenticate, async (req, res) => {
    try {
      const books = await models.Book.findAll({
        where: { isDeleted: false },
        include: [{ model: models.BookVersion, as: "versions" }],
        order: [["CreatedAt", "DESC"]],
      });
      return success(res, books, "Books fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 🗑️ Soft Delete Book
  bookRouter.delete("/book/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      const [updated] = await models.Book.update(
        { isDeleted: true, isActive: false },
        { where: { id } }
      );

      if (updated) return success(res, null, "Book deleted successfully");
      else return warning(res, "Book not found", MessageType.Warning);
    } catch (err) {
      return error(res, err.message);
    }
  });

  // 📄 Get PDF by Version ID and Page
  bookRouter.get("/book/version/getpage", authenticate, async (req, res) => {
    try {
      const { versionId, page = 1 } = req.query;
      if (!versionId)
        return warning(res, "versionId is required", MessageType.Warning);

      const version = await models.BookVersion.findByPk(versionId);
      if (!version)
        return warning(res, "Book version not found", MessageType.Warning);

      const pdfPath = path.join(rootDir, "public", "book", version.pdfPath);
      if (!fs.existsSync(pdfPath))
        return warning(res, "PDF file not found", MessageType.Warning);

      const pdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      if (page < 1 || page > totalPages)
        return warning(
          res,
          `Page number must be between 1 and ${totalPages}`,
          MessageType.Warning
        );

      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [
        parseInt(page) - 1,
      ]);
      newPdfDoc.addPage(copiedPage);

      const singlePageBytes = await newPdfDoc.save();
      const base64Pdf = Buffer.from(singlePageBytes).toString("base64");

      return success(
        res,
        { base64Pdf, page: parseInt(page), totalPages },
        "PDF page fetched successfully"
      );
    } catch (err) {
      console.error(err);
      return error(res, err.message || "Error fetching PDF page");
    }
  });

  // 🔍 Get all versions of a book
  bookRouter.get("/book/versions/getbybook", authenticate, async (req, res) => {
    try {
      const { bookId } = req.query;
      if (!bookId)
        return warning(res, "bookId is required", MessageType.Warning);

      const versions = await models.BookVersion.findAll({
        where: { bookId },
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, versions, "Book versions fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  return bookRouter;
};

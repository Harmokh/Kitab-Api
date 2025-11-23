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
      id, // BookId (for update)
      title,
      coverImage,
      description,
      author,
      versions = [], // Array of BookVersion details
    } = req.body;

    try {
      const savedBook = await models.sequelize.transaction(async (t) => {
        let bookRecord;

        if (id) {
          // 🔹 Update existing Book
          bookRecord = await models.Book.findByPk(id, { transaction: t });
          if (bookRecord) {
            await bookRecord.update({ title, coverImage, description, author }, { transaction: t });

            // 🔹 Remove old versions before inserting new ones
            await models.BookVersion.destroy({
              where: { bookId: id },
              transaction: t,
            });
          }
        }

        if (!bookRecord) {
          // 🔹 Create new Book
          bookRecord = await models.Book.create({ title, coverImage, description, author }, { transaction: t });
        }

        // 🔹 Create new BookVersions if provided
        if (versions.length > 0) {
          // Validate unique ISBNs before insert
          const isbnList = versions.map((v) => v.isbn).filter(Boolean);
          if (isbnList.length > 0) {
            const existingIsbn = await models.BookVersion.findOne({
              where: { isbn: isbnList },
              transaction: t,
            });
            if (existingIsbn) throw new Error("ISBN must be unique");
          }

          const versionRecords = versions.map((v) => ({
            versionName: v.versionName,
            pdfPath: v.pdfPath,
            bookId: bookRecord.id,
            author: v.author,
            description: v.description,
            publishedYear: v.publishedYear,
            isbn: v.isbn,
            image: v.image,
            uploadedBy: v.uploadedBy,
          }));

          await models.BookVersion.bulkCreate(versionRecords, {
            transaction: t,
          });
        }

        // 🔹 Return full Book with Versions
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
      console.error(err);
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

  bookRouter.get("/book/version/getpages", async (req, res) => {
    try {
      const { versionId, startPage = 1, endPage } = req.query;

      if (!versionId)
        return res
          .status(400)
          .json({ success: false, message: "versionId is required" });

      const version = await models.BookVersion.findByPk(versionId);
      if (!version)
        return res
          .status(404)
          .json({ success: false, message: "Book version not found" });

      const pdfPath = path.join(rootDir, "public", version.pdfPath);
      if (!fs.existsSync(pdfPath))
        return res
          .status(404)
          .json({ success: false, message: "PDF file not found" });

      const pdfDoc = await PDFDocument.load(fs.readFileSync(pdfPath));
      const totalPages = pdfDoc.getPageCount();

      const start = parseInt(startPage);
      const end = endPage ? parseInt(endPage) : start;

      if (start < 1 || end > totalPages || start > end)
        return res.status(400).json({
          success: false,
          message: `Page range must be between 1 and ${totalPages}`,
        });

      const newPdfDoc = await PDFDocument.create();
      const pagesToCopy = Array.from(
        { length: end - start + 1 },
        (_, i) => start - 1 + i
      );
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pagesToCopy);

      copiedPages.forEach((page) => newPdfDoc.addPage(page));

      const pdfBytes = await newPdfDoc.save();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=pages-${start}-${end}.pdf`
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message || "Error fetching PDF pages",
      });
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

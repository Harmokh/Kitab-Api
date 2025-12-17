const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");
const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { PDFDocument } = require("pdf-lib");
const { sendToUser } = require("../services/notificationService");
const rootDir = path.resolve(__dirname, "../../");
// ============================================================
// PRODUCTION-GRADE PDF CACHING SYSTEM
// ============================================================
class PDFCacheManager {
  constructor(options = {}) {
    this.pdfCache = new Map();
    this.metadataCache = new Map();
    this.maxPDFSize = options.maxPDFSize || 500 * 1024 * 1024; // 500MB
    this.maxPDFs = options.maxPDFs || 50;
    this.pdfTTL = options.pdfTTL || 30 * 60 * 1000; // 30 min
    this.metadataTTL = options.metadataTTL || 60 * 60 * 1000; // 60 min
    this.currentSize = 0;

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async getPDF(pdfPath) {
    const cached = this.pdfCache.get(pdfPath);
    if (cached && Date.now() - cached.timestamp < this.pdfTTL) {
      cached.hits++;
      return { pdfDoc: cached.pdfDoc, totalPages: cached.totalPages };
    }

    // Load and cache
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    this.set(pdfPath, { pdfDoc, totalPages, size: pdfBytes.length });
    return { pdfDoc, totalPages };
  }

  set(key, value) {
    // Evict if necessary
    while (
      (this.currentSize + value.size > this.maxPDFSize ||
        this.pdfCache.size >= this.maxPDFs) &&
      this.pdfCache.size > 0
    ) {
      this.evictLRU();
    }

    this.pdfCache.set(key, {
      ...value,
      timestamp: Date.now(),
      hits: 0,
    });
    this.currentSize += value.size;
  }

  evictLRU() {
    // Find least recently used with lowest hits
    let lruKey = null;
    let lruTime = Infinity;
    let lruHits = Infinity;

    for (const [key, value] of this.pdfCache.entries()) {
      if (
        value.hits < lruHits ||
        (value.hits === lruHits && value.timestamp < lruTime)
      ) {
        lruKey = key;
        lruTime = value.timestamp;
        lruHits = value.hits;
      }
    }

    if (lruKey) {
      const removed = this.pdfCache.get(lruKey);
      this.currentSize -= removed.size;
      this.pdfCache.delete(lruKey);
    }
  }

  getMetadata(key) {
    const cached = this.metadataCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.metadataTTL) {
      return cached.data;
    }
    return null;
  }

  setMetadata(key, data) {
    this.metadataCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  cleanup() {
    const now = Date.now();

    // Clean PDF cache
    for (const [key, value] of this.pdfCache.entries()) {
      if (now - value.timestamp > this.pdfTTL) {
        this.currentSize -= value.size;
        this.pdfCache.delete(key);
      }
    }

    // Clean metadata cache
    for (const [key, value] of this.metadataCache.entries()) {
      if (now - value.timestamp > this.metadataTTL) {
        this.metadataCache.delete(key);
      }
    }
  }

  clear() {
    this.pdfCache.clear();
    this.metadataCache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      pdfs: this.pdfCache.size,
      metadata: this.metadataCache.size,
      sizeBytes: this.currentSize,
      sizeMB: (this.currentSize / (1024 * 1024)).toFixed(2),
    };
  }
}

// Initialize cache manager
const cacheManager = new PDFCacheManager({
  maxPDFSize: 500 * 1024 * 1024,
  maxPDFs: 50,
  pdfTTL: 30 * 60 * 1000,
  metadataTTL: 60 * 60 * 1000,
});

// Graceful shutdown
process.on("SIGTERM", () => cacheManager.clear());
process.on("SIGINT", () => cacheManager.clear());

module.exports = (models, router) => {
  const bookRouter = router.Router();
  bookRouter.get("/book/version/newgetpages", async (req, res) => {
    const startTime = Date.now();

    try {
      const { versionId, startPage = "1", endPage } = req.query;

      // Input validation
      if (!versionId) {
        return res.status(400).json({
          success: false,
          message: "versionId is required",
        });
      }

      const start = parseInt(startPage, 10);
      const end = endPage ? parseInt(endPage, 10) : start;

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({
          success: false,
          message: "Invalid page numbers",
        });
      }

      // Check ETag for client caching
      const etag = `"${versionId}-${start}-${end}"`;
      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }

      // Get version with caching
      const cacheKey = `version:${versionId}`;
      let version = cacheManager.getMetadata(cacheKey);

      if (!version) {
        version = await models.BookVersion.findByPk(versionId, {
          attributes: ["id", "pdfPath"],
        });

        if (!version) {
          return res.status(404).json({
            success: false,
            message: "Book version not found",
          });
        }

        cacheManager.setMetadata(cacheKey, version);
      }

      // Build and verify PDF path
      const pdfPath = path.join(rootDir, "public", version.pdfPath);

      if (!fsSync.existsSync(pdfPath)) {
        return res.status(404).json({
          success: false,
          message: "PDF file not found",
        });
      }

      // Load PDF with smart caching
      const { pdfDoc, totalPages } = await cacheManager.getPDF(pdfPath);

      // Validate page range
      if (start < 1 || end > totalPages || start > end) {
        return res.status(400).json({
          success: false,
          message: `Page range must be between 1 and ${totalPages}`,
        });
      }

      // Optimization: Return original file if requesting all pages
      if (start === 1 && end === totalPages) {
        const originalBytes = await fs.readFile(pdfPath);
        res.setHeader("X-Total-Pages", totalPages);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", originalBytes.length);
        res.setHeader(
          "Content-Disposition",
          `inline; filename=pages-${start}-${end}.pdf`
        );
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.setHeader("ETag", etag);
        return res.send(originalBytes);
      }

      // Create new PDF with requested pages
      const newPdfDoc = await PDFDocument.create();

      // Build page indices efficiently
      const pageIndices = [];
      for (let i = start - 1; i < end; i++) {
        pageIndices.push(i);
      }

      // Copy and add pages
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => newPdfDoc.addPage(page));

      // Save with optimization
      const pdfBytes = await newPdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      // Set response headers
      res.setHeader("X-Total-Pages", totalPages);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdfBytes.length);
      res.setHeader(
        "Content-Disposition",
        `inline; filename=pages-${start}-${end}.pdf`
      );
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("ETag", etag);

      // Send response
      res.send(Buffer.from(pdfBytes));

      // Log performance in development
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `PDF pages ${start}-${end} (v${versionId}) served in ${Date.now() - startTime
          }ms | Cache: ${JSON.stringify(cacheManager.getStats())}`
        );
      }
    } catch (err) {
      console.error("PDF extraction error:", {
        message: err.message,
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
        versionId: req.query.versionId,
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        success: false,
        message:
          process.env.NODE_ENV === "production"
            ? "Error processing PDF"
            : err.message,
      });
    }
  });

  /**
   * @swagger
   * components:
   *   schemas:
   *     Book:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the book
   *         title:
   *           type: string
   *           description: The title of the book
   *         coverImage:
   *           type: string
   *           description: The URL of the cover image
   *         description:
   *           type: string
   *           description: The description of the book
   *         author:
   *           type: string
   *           description: The author of the book
   *         versions:
   *           type: array
   *           items:
   *             $ref: '#/components/schemas/BookVersion'
   *     BookVersion:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *           description: The auto-generated id of the version
   *         versionName:
   *           type: string
   *           description: The name of the version
   *         pdfPath:
   *           type: string
   *           description: The path to the PDF file
   *         bookId:
   *           type: integer
   *           description: The id of the book this version belongs to
   *         author:
   *           type: string
   *         description:
   *           type: string
   *         publishedYear:
   *           type: string
   *         isbn:
   *           type: string
   *         image:
   *           type: string
   *         uploadedBy:
   *           type: integer
   */

  // POST /book/save
  /**
   * @swagger
   * /book/save:
   *   post:
   *     summary: Create or update a book
   *     tags: [Books]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Book'
   *     responses:
   *       200:
   *         description: The book was successfully saved
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Book'
   *       500:
   *         description: Some server error
   */
  bookRouter.post("/book/save", authenticate, async (req, res) => {
    const {
      id,
      title,
      coverImage,
      description,
      author,
      versions = [],
    } = req.body;

    try {
      const savedBook = await models.sequelize.transaction(async (t) => {
        let bookRecord;

        if (id) {
          bookRecord = await models.Book.findByPk(id, { transaction: t });
          if (bookRecord) {
            await bookRecord.update(
              { title, coverImage, description, author },
              { transaction: t }
            );
          }
        }

        if (!bookRecord) {
          bookRecord = await models.Book.create(
            { title, coverImage, description, author },
            { transaction: t }
          );
          await sendNotificationOfBooktoAll(
            "New Book Added",
            `A new book titled "${title}" has been added to the library.`,
            {
              bookId: bookRecord.id,
              bookName: title,
              // versionId: v.id,
            },
            "book_update"
          );
        }

        const existingVersionRecords = await models.BookVersion.findAll({
          where: { bookId: bookRecord.id },
          transaction: t,
        });

        const existingVersionIds = existingVersionRecords.map((v) => v.id);
        const incomingVersionIds = versions
          .filter((v) => v.id)
          .map((v) => v.id);

        const versionsToDelete = existingVersionIds.filter(
          (oldId) => !incomingVersionIds.includes(oldId)
        );

        if (versionsToDelete.length > 0) {
          await models.BookVersion.destroy({
            where: { id: versionsToDelete },
            transaction: t,
          });
        }

        for (const v of versions) {
          if (v.id) {
            await models.BookVersion.update(
              {
                versionName: v.versionName,
                pdfPath: v.pdfPath,
                author: v.author,
                description: v.description,
                publishedYear: v.publishedYear,
                isbn: v.isbn,
                image: v.image,
                uploadedBy: v.uploadedBy,
              },
              { where: { id: v.id }, transaction: t }
            );
          } else {
            await models.BookVersion.create(
              {
                versionName: v.versionName,
                pdfPath: v.pdfPath,
                bookId: bookRecord.id,
                author: v.author,
                description: v.description,
                publishedYear: v.publishedYear,
                isbn: v.isbn,
                image: v.image,
                uploadedBy: v.uploadedBy,
              },
              { transaction: t }
            );

            await sendNotificationOfBooktoAll(
              "New Book Version Added",
              `A new version "${v.versionName}" has been added for the book "${bookRecord.title}".`,
              {
                bookId: bookRecord.id,
                versionName: v.versionName,
                versionId: v.id,
              },
              "new_version"
            );
          }
        }

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
      console.error(err);
      return error(
        res,
        err.message || "An error occurred while saving the book."
      );
    }
  });

  /**
   * @swagger
   * /book/getbyid:
   *   get:
   *     summary: Get a book by ID
   *     tags: [Books]
   *     parameters:
   *       - in: query
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The book ID
   *     responses:
   *       200:
   *         description: The book description by id
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Book'
   *       404:
   *         description: The book was not found
   */
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

  /**
   * @swagger
   * /book/getall:
   *   get:
   *     summary: Get all books
   *     tags: [Books]
   *     parameters:
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *         description: Number of books per page
   *       - in: query
   *         name: currentPage
   *         schema:
   *           type: integer
   *         description: Current page number
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         description: Search query
   *     responses:
   *       200:
   *         description: List of books
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: integer
   *                 rows:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Book'
   */
  bookRouter.get("/book/getall", authenticate, async (req, res) => {
    try {
      let { pageSize = 10, currentPage = 1, query } = req.query;

      const whereClause = {};

      if (query && query.trim() !== "") {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${query}%` } },
          { author: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
        ];
      }

      const includeClause = [
        {
          model: models.BookVersion,
          as: "Versions",
          required: false,
          where:
            query && query.trim() !== ""
              ? {
                [Op.or]: [
                  { versionName: { [Op.iLike]: `%${query}%` } },
                  { isbn: { [Op.iLike]: `%${query}%` } },
                  { description: { [Op.iLike]: `%${query}%` } },
                ],
              }
              : undefined,
        },
      ];

      const result = await models.Book.findAndCountAll({
        where: whereClause,
        include: includeClause,
        limit: parseInt(pageSize),
        offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Books fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  bookRouter.get("/book/getbookmaster", authenticate, async (req, res) => {
    try {
      const result = await models.Book.findAll({
        order: [["CreatedAt", "DESC"]],
      });

      return success(res, result, "Books fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

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

  /**
   * @swagger
   * /book/delete:
   *   delete:
   *     summary: Delete a book
   *     tags: [Books]
   *     parameters:
   *       - in: query
   *         name: id
   *         schema:
   *           type: integer
   *         required: true
   *         description: The book ID
   *     responses:
   *       200:
   *         description: The book was deleted
   *       404:
   *         description: The book was not found
   */
  bookRouter.delete("/book/delete", authenticate, async (req, res) => {
    try {
      const { id } = req.query;
      const updated = await models.Book.destroy({ where: { id } });

      if (updated) return success(res, null, "Book deleted successfully");
      else return warning(res, "Book not found", MessageType.Warning);
    } catch (err) {
      return error(res, err.message);
    }
  });

  // ============================================================
  // MUPDF IMPLEMENTATION (FOR BENCHMARKING)
  // ============================================================

  let mupdfLib;
  async function getMuPDF() {
    if (!mupdfLib) {
      mupdfLib = await import("mupdf");
    }
    return mupdfLib;
  }

  class MuPDFCacheManager {
    constructor(options = {}) {
      this.pdfCache = new Map();
      this.maxPDFSize = options.maxPDFSize || 500 * 1024 * 1024; // 500MB
      this.maxPDFs = options.maxPDFs || 50;
      this.pdfTTL = options.pdfTTL || 30 * 60 * 1000;
      this.currentSize = 0;
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    async getPDF(pdfPath) {
      const cached = this.pdfCache.get(pdfPath);
      if (cached && Date.now() - cached.timestamp < this.pdfTTL) {
        cached.hits++;
        return { pdfDoc: cached.pdfDoc, totalPages: cached.totalPages };
      }

      const mupdf = await getMuPDF();
      const pdfData = await fs.readFile(pdfPath);
      // Load document using mupdf
      const pdfDoc = mupdf.PDFDocument.open(pdfData);
      const totalPages = pdfDoc.countPages();

      this.set(pdfPath, { pdfDoc, totalPages, size: pdfData.length });
      return { pdfDoc, totalPages };
    }

    set(key, value) {
      // Evict if necessary
      while (
        (this.currentSize + value.size > this.maxPDFSize ||
          this.pdfCache.size >= this.maxPDFs) &&
        this.pdfCache.size > 0
      ) {
        this.evictLRU();
      }

      this.pdfCache.set(key, { ...value, timestamp: Date.now(), hits: 0 });
      this.currentSize += value.size;
    }

    evictLRU() {
      let lruKey = null;
      let lruTime = Infinity;
      let lruHits = Infinity;

      for (const [key, value] of this.pdfCache.entries()) {
        if (value.hits < lruHits || (value.hits === lruHits && value.timestamp < lruTime)) {
          lruKey = key;
          lruTime = value.timestamp;
          lruHits = value.hits;
        }
      }

      if (lruKey) {
        const removed = this.pdfCache.get(lruKey);
        this.currentSize -= removed.size;
        // Important: destroy the mupdf document to free WASM memory
        if (removed.pdfDoc && removed.pdfDoc.destroy) {
          removed.pdfDoc.destroy();
        }
        this.pdfCache.delete(lruKey);
      }
    }

    cleanup() {
      const now = Date.now();
      for (const [key, value] of this.pdfCache.entries()) {
        if (now - value.timestamp > this.pdfTTL) {
          this.currentSize -= value.size;
          if (value.pdfDoc && value.pdfDoc.destroy) {
            value.pdfDoc.destroy();
          }
          this.pdfCache.delete(key);
        }
      }
    }

    getStats() {
      return {
        pdfs: this.pdfCache.size,
        sizeMB: (this.currentSize / (1024 * 1024)).toFixed(2),
        impl: 'mupdf'
      };
    }
  }

  const muPdfCache = new MuPDFCacheManager();

  bookRouter.get("/book/version/getpages-mupdf", async (req, res) => {
    const startTime = Date.now();
    try {
      const { versionId, startPage = "1", endPage } = req.query;

      if (!versionId) return res.status(400).json({ success: false, message: "versionId required" });

      const start = parseInt(startPage, 10);
      const end = endPage ? parseInt(endPage, 10) : start;

      if (isNaN(start) || isNaN(end)) return res.status(400).json({ success: false, message: "Invalid pages" });

      const mupdf = await getMuPDF();

      // Get version info
      const version = await models.BookVersion.findByPk(versionId, { attributes: ["pdfPath"] });
      if (!version) return res.status(404).json({ success: false, message: "Version not found" });

      const pdfPath = path.join(rootDir, "public", version.pdfPath);
      if (!fsSync.existsSync(pdfPath)) return res.status(404).json({ success: false, message: "PDF not found" });

      // Get from cache
      const { pdfDoc, totalPages } = await muPdfCache.getPDF(pdfPath);

      if (start < 1 || end > totalPages || start > end) {
        return res.status(400).json({ success: false, message: `Range 1-${totalPages}` });
      }

      // Create new document
      const newDoc = new mupdf.PDFDocument();

      // Copy pages (graft)
      // mupdf pages are 0-indexed for some APIs, but let's check docs.
      // Usually graftPage takes srcDoc and pageIndex (0-based).
      // Input start is 1-based.
      for (let i = start - 1; i < end; i++) {
        newDoc.graftPage(-1, pdfDoc, i);
      }

      // Save to buffer
      // 'incremental' is false (full save), 'pretty' etc.
      // saveToBuffer returns Uint8Array
      const pdfBytes = newDoc.saveToBuffer("compress");

      // Important: newDoc is transient, destroy it
      newDoc.destroy();

      res.setHeader("X-Total-Pages", totalPages);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", pdfBytes.length);
      res.send(Buffer.from(pdfBytes));

      if (process.env.NODE_ENV !== "production") {
        console.log(`[MuPDF] Pages ${start}-${end} served in ${Date.now() - startTime}ms`);
      }

    } catch (err) {
      console.error("MuPDF Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });


  // Legacy endpoint (kept for backward compatibility)
  bookRouter.get("/book/version/getpages", async (req, res) => {
    try {
      const { versionId, startPage = 1, endPage } = req.query;

      if (!versionId) {
        return res.status(400).json({
          success: false,
          message: "versionId is required",
        });
      }

      const version = await models.BookVersion.findByPk(versionId);
      if (!version) {
        return res.status(404).json({
          success: false,
          message: "Book version not found",
        });
      }

      const pdfPath = path.join(rootDir, "public", version.pdfPath);

      try {
        await fs.access(pdfPath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "PDF file not found",
        });
      }

      const { pdfDoc, totalPages } = await cacheManager.getPDF(pdfPath);

      const start = parseInt(startPage, 10);
      const end = endPage ? parseInt(endPage, 10) : start;

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({
          success: false,
          message: "startPage & endPage must be numbers",
        });
      }

      if (start < 1 || end > totalPages || start > end) {
        return res.status(400).json({
          success: false,
          message: `Page range must be between 1 and ${totalPages}`,
        });
      }

      const newPdf = await PDFDocument.create();
      const pageIndices = [];

      for (let i = start - 1; i < end; i++) {
        pageIndices.push(i);
      }

      const copied = await newPdf.copyPages(pdfDoc, pageIndices);
      copied.forEach((p) => newPdf.addPage(p));

      const pdfBytes = await newPdf.save();

      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=pages-${start}-${end}.pdf`
      );

      return res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("GET PAGES ERROR:", err);
      res.status(500).json({
        success: false,
        message: err.message || "Error fetching PDF pages",
      });
    }
  });

  /**
   * @swagger
   * /book/versions/getbybook:
   *   get:
   *     summary: Get all versions of a book
   *     tags: [Books]
   *     parameters:
   *       - in: query
   *         name: bookId
   *         schema:
   *           type: integer
   *         required: true
   *         description: The book ID
   *     responses:
   *       200:
   *         description: List of book versions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/BookVersion'
   */
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

  /**
   * @swagger
   * /book/search:
   *   get:
   *     summary: Search for books
   *     tags: [Books]
   *     parameters:
   *       - in: query
   *         name: query
   *         schema:
   *           type: string
   *         required: true
   *         description: Search term
   *     responses:
   *       200:
   *         description: List of matching books
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Book'
   */
  bookRouter.get("/book/search", authenticate, async (req, res) => {
    try {
      const { query } = req.query;

      if (!query || query.trim() === "") {
        return warning(res, "Search query is required", MessageType.Warning);
      }

      const searchTerm = `%${query}%`;

      const books = await models.Book.findAll({
        where: {
          isDeleted: false,
          [Op.or]: [
            { title: { [Op.iLike]: searchTerm } },
            { author: { [Op.iLike]: searchTerm } },
            { description: { [Op.iLike]: searchTerm } },
          ],
        },
        include: [
          {
            model: models.BookVersion,
            as: "Versions",
            required: false,
            where: {
              [Op.or]: [
                { versionName: { [Op.iLike]: searchTerm } },
                Sequelize.where(
                  Sequelize.cast(Sequelize.col("Versions.isbn"), "TEXT"),
                  { [Op.iLike]: searchTerm }
                ),
                { description: { [Op.iLike]: searchTerm } },
                Sequelize.where(
                  Sequelize.cast(
                    Sequelize.col("Versions.publishedYear"),
                    "TEXT"
                  ),
                  { [Op.iLike]: searchTerm }
                ),
              ],
            },
          },
        ],
        order: [["CreatedAt", "DESC"]],
      });

      if (!books || books.length === 0) {
        return warning(
          res,
          "No books found matching your search",
          MessageType.Warning
        );
      }

      return success(res, books, "Search results fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  /**
   * @swagger
   * /book/recent:
   *   get:
   *     summary: Get recent books
   *     tags: [Books]
   *     responses:
   *       200:
   *         description: List of recent books
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Book'
   */
  bookRouter.get("/book/recent", authenticate, async (req, res) => {
    try {
      const books = await models.Book.findAll({
        limit: 3,
        order: [["CreatedAt", "DESC"]],
      });
      return success(res, books, "Recent books fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  // Optional: Cache statistics endpoint for monitoring
  bookRouter.get("/book/cache/stats", async (req, res) => {
    try {
      const stats = cacheManager.getStats();
      return success(res, stats, "Cache statistics fetched successfully");
    } catch (err) {
      return error(res, err.message);
    }
  });

  const sendNotificationOfBooktoAll = async (title, body, data, type) => {
    const users = await models.User.findAll({
      where: { isActive: true, isVerified: true, isDeleted: false },
    });
    for (const user of users) {
      await sendToUser(user.id, { title, body }, data, type);
    }
  };

  return bookRouter;
};

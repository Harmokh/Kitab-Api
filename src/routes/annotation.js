const { success, warning, error, MessageType } = require("../utils/response");
const authenticate = require("../middleware/authorize");

module.exports = (models, router) => {
    const annotationRouter = router.Router();

    // ✅ Create or Update Annotation
    // POST /annotation/save
    annotationRouter.post("/annotation/save", authenticate, async (req, res) => {
        try {
            const {
                id,
                versionId,
                pageNumber,
                text,
                type,
                rect,
                color,
                content,
            } = req.body;

            if (!versionId || !pageNumber || !rect)
                return warning(
                    res,
                    "versionId, pageNumber and rect are required",
                    MessageType.Warning
                );

            // Check if annotation already exists (if id provided) or create new
            let annotation;
            if (id) {
                annotation = await models.Annotation.findOne({
                    where: { id, userId: req.user.id, isDeleted: false }
                });
            }

            if (annotation) {
                // Update
                await annotation.update({
                    text,
                    type,
                    rect,
                    color,
                    content
                });
                return success(res, annotation, "Annotation updated successfully");
            } else {
                // Create
                annotation = await models.Annotation.create({
                    userId: req.user.id,
                    versionId,
                    pageNumber,
                    text,
                    type: type || 'highlight',
                    rect,
                    color,
                    content,
                });
                return success(res, annotation, "Annotation created successfully");
            }
        } catch (err) {
            console.error(err);
            return error(res, err.message || "Error saving annotation");
        }
    });

    // 🔍 Get All Annotations for a User
    // GET /annotation/getbyuser
    annotationRouter.get("/annotation/getbyuser", authenticate, async (req, res) => {
        try {
            const { userId } = req.query; // Optional: allow fetching for specific user if admin, otherwise current user
            const targetUserId = userId || req.user.id;

            const annotations = await models.Annotation.findAll({
                where: { userId: targetUserId, isDeleted: false },
                include: [
                    {
                        model: models.BookVersion,
                        as: "BookVersion",
                        attributes: ["id", "versionName", "pdfPath", "image", "bookId"],
                        include: [{
                            model: models.Book,
                            as: "Book",
                            attributes: ["id", "title", "coverImage"]
                        }]
                    }
                ],
                order: [["CreatedAt", "DESC"]],
            });

            return success(res, annotations, "Annotations fetched successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🔍 Get Annotations by Book (via Version)
    // GET /annotation/getbybook
    annotationRouter.get("/annotation/getbybook", authenticate, async (req, res) => {
        try {
            const { bookId } = req.query;
            if (!bookId) return warning(res, "bookId is required", MessageType.Warning);

            // Find all versions for this book
            const versions = await models.BookVersion.findAll({
                where: { bookId, isDeleted: false },
                attributes: ['id']
            });

            const versionIds = versions.map(v => v.id);

            const annotations = await models.Annotation.findAll({
                where: {
                    userId: req.user.id,
                    versionId: versionIds,
                    isDeleted: false
                },
                order: [["pageNumber", "ASC"], ["CreatedAt", "ASC"]]
            });

            return success(res, annotations, "Annotations for book fetched successfully");

        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🔍 Get Annotations by Version
    // GET /annotation/getbyversion
    annotationRouter.get("/annotation/getbyversion", authenticate, async (req, res) => {
        try {
            const { versionId } = req.query;
            if (!versionId)
                return warning(res, "versionId is required", MessageType.Warning);

            const annotations = await models.Annotation.findAll({
                where: { userId: req.user.id, versionId, isDeleted: false },
                order: [["pageNumber", "ASC"], ["CreatedAt", "ASC"]],
            });

            return success(res, annotations, "Annotations fetched successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🗑️ Delete Annotation
    // DELETE /annotation/delete
    annotationRouter.delete("/annotation/delete", authenticate, async (req, res) => {
        try {
            const { id } = req.query;
            if (!id)
                return warning(res, "Annotation id is required", MessageType.Warning);

            const annotation = await models.Annotation.findOne({
                where: { id, userId: req.user.id }
            });

            if (!annotation) return warning(res, "Annotation not found", MessageType.Warning);

            // Soft delete
            await annotation.update({ isDeleted: true });

            return success(res, null, "Annotation deleted successfully");
        } catch (err) {
            return error(res, err.message);
        }
    });

    // 🔍 Get All Books with User's Annotations (Grouped)
    // GET /annotation/getallgroupedforuser
    annotationRouter.get(
        "/annotation/getallgroupedforuser",
        authenticate,
        async (req, res) => {
            try {
                const { pageSize = 20, currentPage = 1 } = req.query;

                const size = parseInt(pageSize);
                const page = parseInt(currentPage);

                // Step 1: First get all annotations for this user with their book/version info
                const userAnnotations = await models.Annotation.findAll({
                    where: {
                        userId: req.user.id,
                        isDeleted: false
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
                                    attributes: ["id", "title", "coverImage", "author", "description"],
                                    required: true
                                }
                            ]
                        }
                    ],
                    order: [
                        [{ model: models.BookVersion, as: "BookVersion" }, { model: models.Book, as: "Book" }, "title", "ASC"],
                        ["versionId", "ASC"],
                        ["pageNumber", "ASC"]
                    ]
                });

                // Step 2: Group annotations by Book → Version → Annotations
                const groupedData = {};

                userAnnotations.forEach(annotation => {
                    const book = annotation.BookVersion.Book;
                    const version = annotation.BookVersion;

                    // Initialize book if not exists
                    if (!groupedData[book.id]) {
                        groupedData[book.id] = {
                            id: book.id,
                            title: book.title,
                            coverImage: book.coverImage,
                            author: book.author,
                            description: book.description,
                            versions: {}
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
                            annotations: []
                        };
                    }

                    // Add annotation to version
                    groupedData[book.id].versions[version.id].annotations.push({
                        id: annotation.id,
                        pageNumber: annotation.pageNumber,
                        text: annotation.text,
                        type: annotation.type,
                        rect: annotation.rect,
                        color: annotation.color,
                        content: annotation.content,
                        createdAt: annotation.CreatedAt,
                        updatedAt: annotation.UpdatedAt
                    });
                });

                // Step 3: Convert to array format
                const booksArray = Object.values(groupedData).map(book => ({
                    ...book,
                    versions: Object.values(book.versions).map(version => ({
                        ...version,
                        annotationCount: version.annotations.length
                    })),
                    totalAnnotations: Object.values(book.versions).reduce(
                        (sum, version) => sum + version.annotations.length, 0
                    )
                }));

                // Step 4: Apply pagination
                const startIndex = (page - 1) * size;
                const endIndex = startIndex + size;
                const paginatedBooks = booksArray.slice(startIndex, endIndex);

                return success(
                    res,
                    {
                        totalBooksWithAnnotations: booksArray.length,
                        pageSize: size,
                        currentPage: page,
                        totalPages: Math.ceil(booksArray.length / size),
                        hasMore: endIndex < booksArray.length,
                        data: paginatedBooks,
                    },
                    "All books with user's annotations fetched successfully"
                );
            } catch (err) {
                console.error("Error in getallgroupedforuser:", err);
                return error(res, err.message);
            }
        }
    );

    return annotationRouter;
};

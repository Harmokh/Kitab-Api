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

    return annotationRouter;
};

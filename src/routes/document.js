const multer = require("multer");
const fs = require("fs");
const path = require("path");
const authenticate = require("../middleware/authorize");
var dir = "";
/* =========================
   SAFE STORAGE CONFIG
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destination = path.basename(req.query.destination || "uploads");
    const uploadDir = path.join(dir, "public", destination);

    fs.mkdir(uploadDir, { recursive: true }, (err) => {
      cb(err, uploadDir);
    });
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

/* =========================
   FILE VALIDATION
========================= */
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type"), false);
  }

  cb(null, true);
};

/* =========================
   MULTER INSTANCE
========================= */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 * 1024, // 1 GB
  },
});

module.exports = (models, router) => {
  const documentRouter = router.Router();

  /* =========================
     MULTIPLE FILE UPLOAD
  ========================= */
  documentRouter
    .post(
      "/document/uploadmultiple",
      authenticate,
      upload.array("files", 10),
      (req, res) => {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        const destination = req.query.destination || "uploads";

        const files = req.files.map((file) =>
          path.join(destination, file.filename)
        );

        return res.json(files);
      }
    )

    /* =========================
     SINGLE FILE UPLOAD
  ========================= */
    .post(
      "/document/uploadsingle",
      authenticate,
      upload.single("file"),
      (req, res) => {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const destination = req.query.destination || "uploads";
        const file = destination + "/" + req.file.filename;
        return res.json(file);
      }
    )

    .delete("/document/deletefile", authenticate, async (req, res) => {
      try {
        const fileUrl = req.query.url;

        if (!fileUrl) {
          return res.status(400).json({ error: "File path is required" });
        }

        // Prevent directory traversal
        const safeFilePath = path
          .normalize(fileUrl)
          .replace(/^(\.\.(\/|\\|$))+/, "");
        const fullPath = path.join(dir, "public", safeFilePath);

        // Ensure file exists
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: "File not found" });
        }

        // Delete file
        await fs.promises.unlink(fullPath);

        return res.status(200).json({
          message: "File deleted successfully",
          file: fileUrl,
        });
      } catch (err) {
        return res.status(500).json({
          error: "Failed to delete file",
          details: err.message,
        });
      }
    })

    .post("/document/uploadfile", authenticate, (req, res) => {
      dir = "";
      dir = "./public/";
      dir = dir + req.query.destination;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      var uploadsingle = multer({ storage: storage }).single("file");
      uploadsingle(req, res, function (err) {
        if (req.fileValidationError) {
          return res.send(req.fileValidationError);
        } else if (!req.file) {
          return res.send("Please select an video to upload");
        } else if (err instanceof multer.MulterError) {
          return res.send(err);
        } else if (err) {
          return res.send(err);
        }
        const file =
          process.env.STATIC_FILE_URL +
          req.query.destination +
          "/" +
          req.file.filename;
        return res.json(file);
      });
    })
    .get("/document/getall", authenticate, async (req, res) => {
      try {
        const {
          pageSize = 10,
          currentPage = 1,
          uploadedBy,
          attachmentType,
          ...filters
        } = req.query;

        const whereClause = {
          isDeleted: false,
          isActive: true,
          advocateId: req.user.id,
        };

        const uuidFields = ["id", "referenceId"];

        for (const key in filters) {
          if (filters[key]) {
            if (uuidFields.includes(key)) {
              whereClause[key] = filters[key];
            } else {
              whereClause[key] = {
                [Op.iLike]: `%${filters[key]}%`,
              };
            }
          }
        }

        const includeClause = [
          {
            model: models.User,
            as: "UploadedByUser",
            attributes: ["fullName"],
            required: !!uploadedBy,
            where: uploadedBy
              ? {
                  fullName: {
                    [Op.iLike]: `%${uploadedBy}%`,
                  },
                }
              : undefined,
          },
          {
            model: models.AttachmentType,
            as: "AttachmentTypeDetail",
            attributes: ["name"],
            required: !!attachmentType,
            where: attachmentType
              ? {
                  name: {
                    [Op.iLike]: `%${attachmentType}%`,
                  },
                }
              : undefined,
          },
        ];

        const result = await models.Attachment.findAndCountAll({
          where: whereClause,
          include: includeClause,
          limit: parseInt(pageSize),
          offset: (parseInt(currentPage) - 1) * parseInt(pageSize),
          order: [["createdAt", "DESC"]],
          raw: true,
          nest: true,
        });

        const mappedRows = result.rows.map((row) => ({
          id: row.id,
          fileName: row.fileName,
          fileType: row.fileType,
          fileUrl: process.env.STATIC_FILE_URL + row.fileUrl,
          attachmentType: row.AttachmentTypeDetail?.name || "Unknown",
          referenceId: row.referenceId,
          uploadedBy: row.UploadedByUser?.fullName || "Unknown",
          createdAt: row.createdAt,
        }));

        return success(
          res,
          {
            count: result.count,
            rows: mappedRows,
          },
          "Documents fetched successfully"
        );
      } catch (err) {
        return error(res, err.message);
      }
    });
  return documentRouter;
};

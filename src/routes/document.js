var multer = require("multer");
var filenamedb;
var fs = require("fs");
const { success, error } = require("../utils/response");
const { Op } = require("sequelize");
const AttachmentType = require("../utils/attachmentType");
const authenticate = require("../middleware/authorize");
var dir = "";
var storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, dir);
  },
  filename: function (req, file, callback) {
    fileorignalname = file.originalname;
    filenamedb =
      new Date().getDate() +
      Math.floor(Math.random() * 10000000000000) +
      "-" +
      file.originalname;
    callback(null, filenamedb);
  },
});

var routes = (models, router) => {
  var documentRouter = router.Router();
  documentRouter
    .post("/document/uploadmultiple", authenticate, (req, res) => {
      dir = "";
      dir = "./public/";
      dir = dir + req.query.destination;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      var uploadmultiple = multer({ storage: storage }).array("files");
      uploadmultiple(req, res, function (err) {
        if (req.fileValidationError) {
          return res.send(req.fileValidationError);
        } else if (!req.files) {
          return res.send("Please select an image to upload");
        } else if (err instanceof multer.MulterError) {
          return res.send(err);
        } else if (err) {
          return res.send(err);
        }
        let files = [];
        for (var i = 0; i < req.files.length; i++) {
          files.push(req.query.destination + "/" + req.files[i].filename);
        }
        return res.json(files);
      });
    })
    .post("/document/uploadsingle", authenticate, (req, res) => {
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
          return res.send("Please select an image to upload");
        } else if (err instanceof multer.MulterError) {
          return res.send(err);
        } else if (err) {
          return res.send(err);
        }
        const file = req.query.destination + "/" + req.file.filename;
        return res.json(file);
      });
    })
    .delete("/document/deletefile", authenticate, async (req, res, next) => {
      try {
        var fs = require("fs");
        const index = req.query.url.indexOf("sp") + 3;
        // const filename = req.query.url.substring(index);
        var dir = "./public/" + req.query.url;
        fs.unlink(dir, (err) => {
          if (err) {
            res.json(err);
          } else {
            res.status(200).json("File Deleted");
          }
        });
      } catch (err) {
        res.status(500);
        res.send(err.message);
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

module.exports = routes;

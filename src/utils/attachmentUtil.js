var models = require("../models/models.js");
const { Op,Sequelize } = require("sequelize");
class AttachmentUtil {
  /**
   * Save or update attachments for a reference
   *
   * @param {{
   *   referenceId: string,
   *   attachmentType: number, // now INTEGER
   *   createdBy: number,
   *   existingAttachments: Array<{ id: string }>,
   *   newAttachments: Array<{
   *     fileName: string,
   *     fileType: string,
   *     fileUrl: string,
   *     additionalInfo?: string
   *   }>
   * }} options
   */
  static async saveOrUpdateAttachments({
    referenceId,
    attachmentType,
    createdBy,
    existingAttachments = [],
    newAttachments = [],
  }) {
    try {
      // Validate required parameters
      if (!referenceId || !attachmentType || !createdBy) {
        throw new Error(
          "Missing required fields: referenceId, attachmentType, or createdBy"
        );
      }

      const existingIds = Array.isArray(existingAttachments)
        ? existingAttachments.map((att) => att?.id).filter(Boolean)
        : [];

      const dbAttachments = await models.Attachment.findAll({
        where: {
          referenceId,
          attachmentType,
          isDeleted: false,
        },
      });

      const dbIds = dbAttachments.map((a) => a.id);

      // Soft-delete attachments that are in DB but not in input
      const toSoftDelete = dbIds.filter((id) => !existingIds.includes(id));
      if (toSoftDelete.length > 0) {
        await models.Attachment.update(
          { isDeleted: true, isActive: false },
          {
            where: {
              id: { [Op.in]: toSoftDelete },
            },
          }
        );
      }

      // Create new attachments
      const inserted = [];
      if (Array.isArray(newAttachments) && newAttachments.length > 0) {
        const records = newAttachments
          .filter((file) => file) // filter out null or undefined
          .map((file) => ({
            ...file,
            referenceId,
            attachmentType,
            isDeleted: false,
            isActive: true,
            uploadedAt: new Date(),
            uploadedBy: createdBy,
            advocateId: createdBy,
          }));

        if (records.length > 0) {
          const created = await models.Attachment.bulkCreate(records);
          inserted.push(...created);
        }
      }

      return {
        deletedIds: toSoftDelete,
        newAttachments: inserted,
      };
    } catch (err) {
      console.error("Error in saveOrUpdateAttachments:", err);
      throw new Error("Failed to save or update attachments: " + err.message);
    }
  }

  /**
   * Get all active attachments by referenceId and type
   * @param {string} referenceId
   * @param {number} attachmentType
   */
  static async getAttachmentsByReferenceId(referenceId, attachmentType) {
    return await models.Attachment.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(`'${process.env.STATIC_FILE_URL}' || "FileUrl"`),
            "fileUrl",
          ],
        ],
        exclude: ["fileUrl"],
      },
      where: {
        referenceId,
        attachmentType,
        isDeleted: false,
      },
    });
  }

  /**
   * Get attachments by IDs (including deleted if needed)
   * @param {string[]} ids
   */
  static async getAttachmentsById(ids) {
    return await models.Attachment.findAll({
      attributes: {
        include: [
          [
            Sequelize.literal(`'${process.env.STATIC_FILE_URL}' || "FileUrl"`),
            "FileUrl",
          ],
        ],
        exclude: ["FileUrl"],
      },
      where: {
        id: { [Op.in]: ids },
      },
    });
  }
}

module.exports = AttachmentUtil;

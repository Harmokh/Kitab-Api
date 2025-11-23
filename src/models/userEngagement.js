module.exports = (sequelize, Sequelize) => {
  const UserEngagement = sequelize.define(
    "UserEngagement",
    {
      id: {
        field: "UserEngagementId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      userId: { field: "UserId", type: Sequelize.UUID, allowNull: false },
      bookVersionId: { field: "BookVersionId", type: Sequelize.UUID }, // optional if action is not book-version specific
      action: {
        field: "Action",
        type: Sequelize.STRING,
        allowNull: false,
        comment: "READ_PAGE, BOOKMARK, FAVORITE, DOWNLOAD, etc.",
      },
      pageNumber: { field: "PageNumber", type: Sequelize.INTEGER }, // optional, only for page-specific actions
      additionalInfo: { field: "AdditionalInfo", type: Sequelize.JSONB }, // optional extra info
      isActive: {
        field: "IsActive",
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      isDeleted: {
        field: "IsDeleted",
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "UserEngagements",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  UserEngagement.associate = (models) => {
    UserEngagement.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
      as: "User",
    });
    UserEngagement.belongsTo(models.BookVersion, {
      foreignKey: "bookVersionId",
      targetKey: "id",
      as: "BookVersion",
    });
  };

  return UserEngagement;
};

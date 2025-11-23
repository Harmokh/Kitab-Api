module.exports = (sequelize, Sequelize) => {
  const Bookmark = sequelize.define(
    "Bookmark",
    {
      id: {
        field: "BookmarkId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      userId: { field: "UserId", type: Sequelize.UUID, allowNull: false },
      bookVersionId: {
        field: "BookVersionId",
        type: Sequelize.UUID,
        allowNull: false,
      },
      pageNumber: {
        field: "PageNumber",
        type: Sequelize.INTEGER,
        allowNull: false,
      },
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
      tableName: "Bookmarks",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      indexes: [
        { unique: true, fields: ["UserId", "BookVersionId", "PageNumber"] },
      ],
    }
  );

  Bookmark.associate = (models) => {
    Bookmark.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
      as: "User",
    });
    Bookmark.belongsTo(models.BookVersion, {
      foreignKey: "bookVersionId",
      targetKey: "id",
      as: "BookVersion",
    });
  };

  return Bookmark;
};

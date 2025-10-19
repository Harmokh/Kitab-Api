module.exports = (sequelize, Sequelize) => {
  const BookVersion = sequelize.define(
    "BookVersion",
    {
      id: {
        field: "BookVersionId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      bookId: { field: "BookId", type: Sequelize.UUID, allowNull: false },
      versionName: {
        field: "VersionName",
        type: Sequelize.STRING,
        allowNull: false,
      },
      image: { field: "Image", type: Sequelize.STRING, allowNull: false },
      author: { field: "Author", type: Sequelize.STRING },
      description: { field: "Description", type: Sequelize.TEXT },
      publishedYear: { field: "PublishedYear", type: Sequelize.INTEGER },
      isbn: { field: "ISBN", type: Sequelize.STRING, unique: true },
      pdfPath: { field: "PDFPath", type: Sequelize.STRING, allowNull: false },
      uploadedBy: { field: "UploadedBy", type: Sequelize.UUID },
    },
    {
      tableName: "BookVersions",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  BookVersion.associate = (models) => {
    BookVersion.belongsTo(models.Book, {
      foreignKey: "bookId",
      targetKey: "id",
      as: "Book",
    });
    BookVersion.belongsTo(models.User, {
      foreignKey: "uploadedBy",
      targetKey: "id",
      as: "Uploader",
    });
    BookVersion.hasMany(models.Bookmark, {
      foreignKey: "bookVersionId",
      as: "Bookmarks",
    });
    BookVersion.hasMany(models.UserEngagement, {
      foreignKey: "bookVersionId",
      as: "Engagements",
    });
    BookVersion.hasMany(models.Favorite, {
      foreignKey: "bookVersionId",
      as: "Favorites",
    });
  };

  return BookVersion;
};

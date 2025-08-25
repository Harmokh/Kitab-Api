// bookVersion.js
module.exports = (sequelize, DataTypes) => {
  const BookVersion = sequelize.define(
    "BookVersion",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      bookId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "books",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      language: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      pdfPath: {
        type: DataTypes.STRING, // store path or URL of uploaded PDF
        allowNull: true,
      },
      fileSize: {
        type: DataTypes.INTEGER, // optional: store size in bytes
      },
    },
    {
      tableName: "book_versions",
      timestamps: true,
    }
  );

  BookVersion.associate = (models) => {
    BookVersion.belongsTo(models.Book, { foreignKey: "bookId" });
  };

  return BookVersion;
};

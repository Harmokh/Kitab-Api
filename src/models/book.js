module.exports = (sequelize, Sequelize) => {
  const Book = sequelize.define(
    "Book",
    {
      id: {
        field: "BookId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      image: { field: "Image", type: Sequelize.STRING, allowNull: false },
      title: { field: "Title", type: Sequelize.STRING, allowNull: false },
      author: { field: "Author", type: Sequelize.STRING },
      description: { field: "Description", type: Sequelize.TEXT },
      publishedYear: { field: "PublishedYear", type: Sequelize.INTEGER },
      isbn: { field: "ISBN", type: Sequelize.STRING, unique: true },
    },
    {
      tableName: "Books",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  Book.associate = (models) => {
    Book.hasMany(models.BookVersion, {
      foreignKey: "bookId",
      as: "Versions",
      onDelete: "CASCADE",
    });
  };

  return Book;
};

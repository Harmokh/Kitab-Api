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
      title: { field: "Title", type: Sequelize.STRING, allowNull: false },
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

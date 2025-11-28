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
      coverImage: {
        field: "CoverImage",
        type: Sequelize.STRING(3000),
        allowNull: true,
      },
      author: {
        field: "Author",
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      description: {
        field: "Description",
        type: Sequelize.STRING(4000),
        allowNull: true,
      },
      title: { field: "Title", type: Sequelize.STRING, allowNull: false },
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

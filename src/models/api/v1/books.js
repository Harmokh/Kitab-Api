module.exports = (sequelize, DataTypes) => {
  const Book = sequelize.define(
    "Book",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      author: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
      },
      publishedYear: {
        type: DataTypes.INTEGER,
      },
      isbn: {
        type: DataTypes.STRING,
        unique: true,
      },
    },
    {
      tableName: "books",
      timestamps: true, // createdAt & updatedAt
    }
  );

  // Associations
  Book.associate = (models) => {
    // One book can have many versions
    Book.hasMany(models.BookVersion, { 
      foreignKey: "bookId", 
      as: "versions", // optional alias for easier eager loading
      onDelete: "CASCADE",
    });

    // Example: Book.belongsTo(models.User, { foreignKey: "userId" });
  };

  return Book;
};

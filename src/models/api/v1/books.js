// book.js
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

  // Associations (if needed later, e.g., Book belongsTo User)
  Book.associate = (models) => {
    // Example: Book.belongsTo(models.User, { foreignKey: "userId" });
  };

  return Book;
};

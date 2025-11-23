module.exports = (sequelize, Sequelize) => {
  const Favorite = sequelize.define(
    "Favorite",
    {
      id: {
        field: "FavoriteId",
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
      tableName: "Favorites",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      indexes: [{ unique: true, fields: ["UserId", "BookVersionId"] }],
    }
  );

  Favorite.associate = (models) => {
    Favorite.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
      as: "User",
    });
    Favorite.belongsTo(models.BookVersion, {
      foreignKey: "bookVersionId",
      targetKey: "id",
      as: "BookVersion",
    });
  };

  return Favorite;
};

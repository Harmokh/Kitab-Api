module.exports = (sequelize, Sequelize) => {
  const UserFcmToken = sequelize.define(
    "UserFcmToken",
    {
      id: {
        field: "FcmTokenId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      userId: {
        field: "UserId",
        type: Sequelize.UUID,
        allowNull: false,
      },
      fcmToken: {
        field: "FcmToken",
        type: Sequelize.TEXT,
        allowNull: false,
      },
      deviceType: {
        field: "DeviceType",
        type: Sequelize.STRING,
        allowNull: true,
      },
      isActive: {
        field: "IsActive",
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: "UserFcmTokens",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  UserFcmToken.associate = (models) => {
    UserFcmToken.belongsTo(models.User, {
      foreignKey: "userId",
      as: "User",
    });
  };

  return UserFcmToken;
};

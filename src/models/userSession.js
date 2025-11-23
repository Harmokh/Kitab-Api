module.exports = (sequelize, Sequelize) => {
  const UserSession = sequelize.define(
    "UserSession",
    {
      id: {
        field: "UserSessionId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      userId: {
        field: "UserId",
        type: Sequelize.UUID,
        allowNull: false,
      },
      loginTime: {
        field: "LoginTime",
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      logoutTime: { field: "LogoutTime", type: Sequelize.DATE },
      ipAddress: { field: "IPAddress", type: Sequelize.STRING },
      userAgent: { field: "UserAgent", type: Sequelize.TEXT },
    },
    {
      tableName: "UserSessions",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, {
      foreignKey: "userId",
      targetKey: "id",
      as: "User",
    });
  };

  return UserSession;
};

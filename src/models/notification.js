module.exports = (sequelize, Sequelize) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: {
        field: "Id",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      userId: {
        field: "UserId",
        type: Sequelize.UUID,
        allowNull: false,
      },
      title: {
        field: "Title",
        type: Sequelize.STRING,
        allowNull: false,
      },
      body: {
        field: "Body",
        type: Sequelize.TEXT,
        allowNull: false,
      },
      data: {
        field: "Data",
        type: Sequelize.JSONB,
        allowNull: true,
      },
      // -- screen / url / modal / custom
      type: {
        field: "Type",
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "general",
      },
      isRead: {
        field: "IsRead",
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      isDeleted: {
        field: "IsDeleted",
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "Notifications",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: "userId",
      as: "User",
    });
  };

  return Notification;
};

module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        field: "UserId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      name: {
        field: "Name",
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        field: "Email",
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      bio: {
        field: "Bio",
        type: Sequelize.STRING(4000),
        allowNull: true,
      },
      address: {
        field: "Address",
        type: Sequelize.STRING(4000),
        allowNull: true,
      },
      image: {
        field: "Image",
        type: Sequelize.STRING(4000),
        allowNull: true,
      },
      googleId: {
        field: "GoogleId",
        type: Sequelize.STRING(1000),
        allowNull: true,
        unique: true,
      },
      passwordHash: {
        field: "PasswordHash",
        type: Sequelize.STRING,
        allowNull: false,
      },
      roleId: {
        field: "RoleId",
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      isVerified: {
        field: "IsVerified",
        type: Sequelize.BOOLEAN,
        allowNull: true,
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
      tableName: "Users",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  User.associate = (models) => {
    User.belongsTo(models.Role, {
      foreignKey: "roleId",
      targetKey: "id",
      as: "Role",
    });
    User.hasMany(models.BookVersion, {
      foreignKey: "uploadedBy",
      as: "Uploads",
    });
    User.hasMany(models.Bookmark, { foreignKey: "userId", as: "Bookmarks" });
    User.hasMany(models.Favorite, { foreignKey: "userId", as: "Favorites" });
    User.hasMany(models.UserEngagement, {
      foreignKey: "userId",
      as: "Engagements",
    });
    User.hasMany(models.UserSession, { foreignKey: "userId", as: "Sessions" });
    User.hasMany(models.UserDevice, { foreignKey: "userId", as: "Devices" });
    User.hasMany(models.Notification, { foreignKey: "userId", as: "Notifications" });
  };


  return User;
};

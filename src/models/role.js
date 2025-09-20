module.exports = (sequelize, Sequelize) => {
  const Role = sequelize.define(
    "Role",
    {
      id: {
        field: "RoleId",
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        field: "Name",
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // 'Admin', 'User'
      },
      description: {
        field: "Description",
        type: Sequelize.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "Roles",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  Role.associate = (models) => {
    Role.hasMany(models.User, { foreignKey: "roleId", as: "Users" });
  };

  return Role;
};

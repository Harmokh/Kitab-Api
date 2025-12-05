module.exports = (sequelize, Sequelize) => {
  const Announcement = sequelize.define(
    "Announcement",
    {
      id: {
        field: "AnnouncementId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },

      title: {
        field: "Title",
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      description: {
        field: "Description",
        type: Sequelize.TEXT, // long description
        allowNull: true,
      },

      imageUrl: {
        field: "ImageUrl",
        type: Sequelize.STRING(800),
        allowNull: true,
      },
      startDate: {
        field: "StartDate",
        type: Sequelize.DATE,
        allowNull: true,
      },
      endDate: {
        field: "EndDate",
        type: Sequelize.DATE,
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
      tableName: "Announcements",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );
  return Announcement;
};

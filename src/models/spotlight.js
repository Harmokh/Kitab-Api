module.exports = (sequelize, Sequelize) => {
  const Spotlight = sequelize.define(
    "Spotlight",
    {
      id: {
        field: "SpotlightId",
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },

      title: {
        field: "Title",
        type: Sequelize.STRING(900),
        allowNull: false,
      },

      subtitle: {
        field: "Subtitle",
        type: Sequelize.TEXT,
        allowNull: true,
      },

      buttonText: {
        field: "ButtonText",
        type: Sequelize.STRING(400),
        allowNull: true,
      },
      bookId: {
        field: "BookId",
        type: Sequelize.UUID,
        allowNull: true,
      },
      image: {
        field: "Image",
        type: Sequelize.STRING(2000),
        allowNull: true,
      },

      route: {
        field: "Route",
        type: Sequelize.JSONB,
        allowNull: true, // e.g. "routeName,params:{}"
      },

      routeType: {
        field: "RouteType",
        type: Sequelize.STRING(50), // screen / url
        allowNull: true,
      },

      priority: {
        field: "Priority",
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },

      backgroundColor: {
        field: "BackgroundColor",
        type: Sequelize.STRING(90),
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
      tableName: "Spotlights",
      timestamps: true,
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
    }
  );

  return Spotlight;
};

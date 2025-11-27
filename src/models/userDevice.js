module.exports = (sequelize, Sequelize) => {
    const UserDevice = sequelize.define(
        "UserDevice",
        {
            id: {
                field: "UserDeviceId",
                type: Sequelize.UUID,
                primaryKey: true,
                defaultValue: sequelize.literal("gen_random_uuid()"),
            },
            userId: {
                field: "UserId",
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: "Users",
                    key: "UserId",
                },
            },
            token: {
                field: "Token",
                type: Sequelize.STRING(4000),
                allowNull: false,
                unique: true,
            },
            deviceType: {
                field: "DeviceType",
                type: Sequelize.ENUM("android", "ios", "web"),
                allowNull: false,
                defaultValue: "android",
            },
            isActive: {
                field: "IsActive",
                type: Sequelize.BOOLEAN,
                defaultValue: true,
            },
        },
        {
            tableName: "UserDevices",
            timestamps: true,
            createdAt: "CreatedAt",
            updatedAt: "UpdatedAt",
        }
    );

    UserDevice.associate = (models) => {
        UserDevice.belongsTo(models.User, {
            foreignKey: "userId",
            as: "User",
        });
    };

    return UserDevice;
};

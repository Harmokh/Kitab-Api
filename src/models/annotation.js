module.exports = (sequelize, Sequelize) => {
    const Annotation = sequelize.define(
        "Annotation",
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
            versionId: {
                field: "VersionId",
                type: Sequelize.UUID,
                allowNull: false,
            },
            pageNumber: {
                field: "PageNumber",
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            text: {
                field: "Text",
                type: Sequelize.TEXT,
                allowNull: true,
            },
            type: {
                field: "Type",
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "highlight",
            },
            rect: {
                field: "Rect",
                type: Sequelize.JSONB,
                allowNull: false,
            },
            color: {
                field: "Color",
                type: Sequelize.STRING,
                allowNull: true,
            },
            content: {
                field: "Content",
                type: Sequelize.TEXT,
                allowNull: true,
            },
            isDeleted: {
                field: "IsDeleted",
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
        },
        {
            tableName: "Annotations",
            timestamps: true,
            createdAt: "CreatedAt",
            updatedAt: "UpdatedAt",
        }
    );

    Annotation.associate = (models) => {
        Annotation.belongsTo(models.User, {
            foreignKey: "userId",
            as: "User",
        });
        Annotation.belongsTo(models.BookVersion, {
            foreignKey: "versionId",
            as: "BookVersion",
        });
    };

    return Annotation;
};

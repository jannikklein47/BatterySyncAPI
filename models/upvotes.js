"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class upvotes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Each upvote belongs to exactly one user and one issue.
      upvotes.belongsTo(models.User, { foreignKey: "userId" });
      upvotes.belongsTo(models.issue, { foreignKey: "issueId" });
    }
  }
  upvotes.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      issueId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "upvotes",
    }
  );
  return issue;
};

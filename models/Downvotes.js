"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Downvotes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Each upvote belongs to exactly one user and one issue.
      Downvotes.belongsTo(models.User, { foreignKey: "userId" });
      Downvotes.belongsTo(models.issue, { foreignKey: "issueId" });
    }
  }
  Downvotes.init(
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
      modelName: "Downvotes",
    }
  );
  return Downvotes;
};

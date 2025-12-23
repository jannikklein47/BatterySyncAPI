"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasMany(models.issue, {
        foreignKey: "userId",
        as: "issues",
      });

      User.belongsToMany(models.issue, {
        through: models.Upvotes,
        foreignKey: "userId",
        as: "upvotedIssues",
        otherKey: "issueId",
      });

      User.belongsToMany(models.issue, {
        through: models.Downvotes,
        foreignKey: "userId",
        as: "downvotedIssues",
        otherKey: "issueId",
      });

      User.belongsToMany(models.issue, {
        through: models.Comments,
        foreignKey: "userId",
        as: "commentedIssues",
        otherKey: "issueId",
      });
    }
  }
  User.init(
    {
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      admin: DataTypes.BOOLEAN,
      tester: DataTypes.BOOLEAN,
      lastRename: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};

"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class issue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      issue.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
      issue.belongsToMany(models.User, {
        through: models.Upvotes,
        foreignKey: "issueId",
        as: "upvoters",
        otherKey: "userId",
      });

      issue.hasMany(models.Upvotes, {
        foreignKey: "issueId",
        as: "UpvoteEntries",
      });

      issue.belongsToMany(models.User, {
        through: models.Downvotes,
        foreignKey: "issueId",
        as: "downvoters",
        otherKey: "userId",
      });

      issue.hasMany(models.Downvotes, {
        foreignKey: "issueId",
        as: "DownvoteEntries",
      });

      issue.belongsToMany(models.User, {
        through: models.Comments,
        foreignKey: "issueId",
        as: "commenters",
        otherKey: "userId",
      });

      issue.hasMany(models.Comments, {
        foreignKey: "issueId",
        as: "CommentEntries",
      });
    }
  }
  issue.init(
    {
      title: DataTypes.TEXT,
      description: DataTypes.TEXT,
      status: {
        allowNull: false,
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      category: DataTypes.INTEGER,
      priority: DataTypes.INTEGER,
      archived: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "issue",
    }
  );
  return issue;
};

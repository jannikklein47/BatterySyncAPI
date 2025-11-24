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
    },
    {
      sequelize,
      modelName: "issue",
    }
  );
  return issue;
};

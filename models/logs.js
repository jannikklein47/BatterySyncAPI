"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class logs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  logs.init(
    {
      text: DataTypes.TEXT,
      route: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      method: DataTypes.STRING,
      reqSize: DataTypes.INTEGER,
      resSize: DataTypes.INTEGER,
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "logs",
    }
  );
  return logs;
};

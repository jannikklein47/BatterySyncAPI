'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class batteryLogs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  batteryLogs.init({
    deviceId: DataTypes.INTEGER,
    battery: DataTypes.DOUBLE,
    chargingStatus: DataTypes.BOOLEAN,
    isPluggedIn: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'batteryLogs',
  });
  return batteryLogs;
};
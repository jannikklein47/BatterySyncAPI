'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderedNotifications extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.ScheduledNotifications, {
        foreignKey: 'notificationId',
        as: 'scheduledNotifications'
      })
      this.belongsTo(models.Devices, {
        foreignKey: 'deviceId',
        as: 'device'
      })
    }
  }
  OrderedNotifications.init({
    deviceId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'OrderedNotifications',
  });
  return OrderedNotifications;
};
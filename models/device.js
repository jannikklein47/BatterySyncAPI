'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Device extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Device.hasMany(models.ScheduledNotifications, {
        foreignKey: 'deviceId',
        as: 'scheduledNotifications'
      })
      Device.hasMany(models.OrderedNotifications, {
        foreignKey: 'deviceId',
        as: 'orderedNotifications'
      })
    }
  }
  Device.init({
    userId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    battery: DataTypes.DOUBLE,
    isShown: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    chargingStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      defaultValue: 'laptop',
      allowNull: false
    },
    color: {
      type: DataTypes.STRING,
      defaultValue: '#ffffff',
      allowNull: false,
    },
    isPluggedIn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    predictedZeroAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Device',
  });
  return Device;
};
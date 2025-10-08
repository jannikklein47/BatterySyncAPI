'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ScheduledNotifications extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Devices, {
        foreignKey: 'deviceId',
        as: 'device'
      })

      this.belongsTo(models.OrderedNotifications, {
        foreignKey: 'notificationId',
        as: 'notification'
      })
    }
  }
  ScheduledNotifications.init({
    notificationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'OrderedNotifications',
        key: 'id'
      }
    },
    deviceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Devices',
          key: 'id'
        }
      }
  }, {
    sequelize,
    modelName: 'ScheduledNotifications',
  });
  return ScheduledNotifications;
};
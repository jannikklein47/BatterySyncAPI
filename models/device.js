"use strict";
const { Model, Sequelize } = require("sequelize");

const OTP_REQUIRED_FOR = 12 * 60 * 60 * 1000;
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
        foreignKey: "deviceId",
        as: "scheduledNotifications",
      });
      Device.hasMany(models.OrderedNotifications, {
        foreignKey: "deviceId",
        as: "orderedNotifications",
      });
    }
  }
  Device.init(
    {
      userId: DataTypes.INTEGER,
      name: DataTypes.STRING,
      battery: DataTypes.DOUBLE,
      isShown: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      chargingStatus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        defaultValue: "laptop",
        allowNull: false,
      },
      color: {
        type: DataTypes.STRING,
        defaultValue: "#ffffff",
        allowNull: false,
      },
      isPluggedIn: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      predictedZeroAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      favorite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      uuid: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
      },
      otp: {
        type: DataTypes.STRING,
      },
      otpTime: {
        type: DataTypes.DATE,
      },
      lastActivity: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
        allowNull: false,
      },
      getsRegularReminder: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      build: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "2026032501",
      },
      requiresOtp: {
        type: DataTypes.VIRTUAL,
        get() {
          return (
            !!this.uuid &&
            new Date(this.lastActivity) >
              new Date(Date.now() - OTP_REQUIRED_FOR)
          );
        },
      },
    },
    {
      sequelize,
      modelName: "Device",
      defaultScope: {
        where: {
          deleted: false,
        },
      },
      scopes: {
        deleted: {
          where: {
            deleted: true,
          },
        },
      },
    },
  );
  return Device;
};

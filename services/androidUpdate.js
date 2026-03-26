const models = require("../models");
const downsampler = require("downsample-lttb");
const { Op, fn, col, QueryTypes } = require("sequelize");

const APIError = require("../utils/error");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const sequelize = models.sequelize;

const NotificationService = require("./notification");
const BatteryLogService = require("./batteryLogs");
const predict = require("./predictionService");

const GeneralUtils = require("../utils/general");

async function getLatestBuildInfo() {
  const latestBuildInfo = await models.AndroidUpdate.findOne({
    order: [["createdAt", "DESC"]],
  });

  return latestBuildInfo;
}

module.exports = {
  getLatestBuildInfo,
};

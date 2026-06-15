const models = require("../models");
const { Op, fn, col, QueryTypes } = require("sequelize");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const sequelize = models.sequelize;

const NotificationService = require("./notification");

const GeneralUtils = require("../utils/general");

/**
 * Adds a new battery log entry for a given device.
 * If the last battery log entry for the given device has the same
 * battery level, charging status, and plugged in status as the
 * given parameters, this function will not add a new entry.
 * @param {number} deviceId The ID of the device to add the battery log entry for.
 * @param {number} battery The current battery level of the device in percent.
 * @param {boolean} chargingStatus Whether the device is currently charging.
 * @param {boolean} isPluggedIn Whether the device is currently plugged in.
 * @returns {Promise<BatteryLog>} A promise that resolves with the added battery log entry.
 */
async function addBatteryLog(deviceId, battery, chargingStatus, isPluggedIn) {
  const lastBatteryState = await BatteryLogs.findOne({
    where: {
      deviceId: deviceId,
    },
    order: [["createdAt", "DESC"]],
  });

  if (
    lastBatteryState &&
    lastBatteryState.battery === battery &&
    lastBatteryState.chargingStatus === chargingStatus &&
    lastBatteryState.isPluggedIn === isPluggedIn
  ) {
    return;
  }

  const batteryLog = await BatteryLogs.create({
    battery,
    chargingStatus,
    isPluggedIn,
    deviceId,
  });

  return batteryLog;
}

/**
 * Predicts the oldest data point for a given device based on two known data points.
 * @param {number} oldestDate - The oldest known data point's Unix timestamp.
 * @param {number} oldestBattery - The oldest known data point's battery level in percent.
 * @param {number} newestDate - The newest known data point's Unix timestamp.
 * @param {number} newestBattery - The newest known data point's battery level in percent.
 * @param {number} targetDate - The Unix timestamp for which to predict the data point.
 * @returns {Object} - The predicted data point, with keys "battery" and "createdAt".
 */
function predictOldestDataPoint(
  oldestDate,
  oldestBattery,
  newestDate,
  newestBattery,
  targetDate,
) {
  oldestBattery = Math.round(oldestBattery * 100);
  newestBattery = Math.round(newestBattery * 100);

  // calculate slope of linear function PER MINUTE
  const m = (newestBattery - oldestBattery) / (newestDate - oldestDate);

  // y-achsenabschnitt
  const b = oldestBattery - m * oldestDate;

  const f = (x) => m * x + b;

  return {
    battery: Math.round(f(targetDate)) / 100,
    createdAt: targetDate,
  };
}

/**
 * Retrieves a list of battery logs for a given device within a given time interval.
 * If the interval is "day", it will retrieve logs from the last 24 hours. If the interval is "week", it will retrieve logs from the last week.
 * The returned list will be downsampled to reduce the number of data points.
 * @param {string} deviceId - ID of the device to retrieve logs for.
 * @param {string} [interval="day"] - Time interval to retrieve logs for. Can be either "day" or "week".
 * @returns {Promise<Array<number[]>>} - A list of downsampled data points in the format of [x, y] where x is the Unix timestamp and y is the battery level in percent.
 */
async function getBatteryLogs(deviceId, interval = "day") {
  let startDate;
  if (interval === "day") {
    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (interval === "week") {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else {
    throw new Error("Invalid interval");
  }

  const result = await BatteryLogs.findAll({
    where: {
      deviceId: deviceId,
      createdAt: {
        [Op.gte]: startDate,
      },
      chargingStatus: { [Op.ne]: null },
      battery: { [Op.ne]: null },
      isPluggedIn: { [Op.ne]: null },
    },
    order: [["createdAt", "DESC"]],
    attributes: ["createdAt", "chargingStatus", "battery", "isPluggedIn"],
    raw: true,
  });

  if (result.length < 1) return [];

  const firstOlderThanStartDate = await BatteryLogs.findOne({
    where: {
      deviceId: deviceId,
      createdAt: {
        [Op.lt]: startDate,
      },
      chargingStatus: { [Op.ne]: null },
      battery: { [Op.ne]: null },
      isPluggedIn: { [Op.ne]: null },
    },
    order: [["createdAt", "DESC"]],
    attributes: ["createdAt", "chargingStatus", "battery", "isPluggedIn"],
    raw: true,
  });

  if (firstOlderThanStartDate) {
    result.push({
      ...predictOldestDataPoint(
        firstOlderThanStartDate.createdAt,
        firstOlderThanStartDate.battery,
        result[result.length - 1].createdAt,
        result[result.length - 1].battery,
        startDate,
      ),
      chargingStatus: firstOlderThanStartDate.chargingStatus,
      isPluggedIn: firstOlderThanStartDate.isPluggedIn,
    });

    const device = await require("./device").getDevice(deviceId);

    result.unshift({
      createdAt: new Date(),
      battery: device.battery,
      chargingStatus: device.chargingStatus,
      isPluggedIn: device.isPluggedIn,
    });
  }

  const downsampled = GeneralUtils.downsample(result);

  return downsampled;
}

module.exports = {
  addBatteryLog,
  getBatteryLogs,
};

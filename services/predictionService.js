const models = require("../models");
const downsampler = require("downsample-lttb");
const { Op } = require("sequelize");

function analyzeSinceLastUnplug(log) {
  // 1. Clean up guard clause and cache log[0] immediately
  if (!log || log.length === 0) return null;

  const latest = log[0];
  if (latest.isPluggedIn) return null;

  // Cache the timestamp of the newest log entry
  const now = new Date(latest.createdAt).getTime();
  let startEntry = null;

  // 2. Performance optimization: Avoid allocating object variables inside the loop
  const loopLimit = log.length - 1;
  for (let i = 0; i < loopLimit; i++) {
    // Directly check properties instead of creating 'newer' and 'older' variables every iteration
    if (log[i + 1].isPluggedIn && !log[i].isPluggedIn) {
      startEntry = log[i];
      break;
    }
  }

  // Fallback: if never unplugged in log, use oldest entry
  if (!startEntry) {
    startEntry = log[loopLimit];
  }

  const startTime = new Date(startEntry.createdAt).getTime();
  const elapsedMs = now - startTime;
  if (elapsedMs <= 0) return null;

  // 3. Cache calculations
  const latestBattery = Math.floor(latest.battery * 100);
  const startBattery = Math.floor(startEntry.battery * 100);
  const deltaBattery = latestBattery - startBattery;
  const ratePerMs = deltaBattery / elapsedMs;

  let predictedZeroAt = null;

  if (ratePerMs < 0) {
    // Math.abs() is replaced with a simple negation since we already know ratePerMs is negative
    const timeToZeroMs = latestBattery / -ratePerMs;
    const predictedTimeMs = now + timeToZeroMs;

    // 4. Memory Optimization: Compare timestamps using primitive numbers instead of creating Date objects.
    // Only instantiate the Date object if the prediction is valid (in the future).
    if (predictedTimeMs >= Date.now()) {
      predictedZeroAt = new Date(predictedTimeMs);
    }
  }

  return {
    startEntry,
    elapsedMinutes: elapsedMs / 60000,
    avgRatePerHour: ratePerMs * 3600000, // % per hour
    predictedZeroAt,
  };
}

module.exports = async function (deviceId) {
  // 2. Fetch logs directly using the passed deviceId
  const result = await models.batteryLogs.findAll({
    where: {
      deviceId: deviceId,
      createdAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
      chargingStatus: { [Op.ne]: null },
      battery: { [Op.ne]: null },
      isPluggedIn: { [Op.ne]: null },
    },
    order: [["createdAt", "DESC"]],
    attributes: ["createdAt", "chargingStatus", "battery", "isPluggedIn"],
    raw: true,
  });

  if (!result || result.length === 0) return;

  const analysis = analyzeSinceLastUnplug(result);

  // 3. Determine value and update in a single, lightweight query (No transaction needed)
  const predictedZeroAt =
    analysis && analysis.predictedZeroAt ? analysis.predictedZeroAt : null;

  await models.Device.update({ predictedZeroAt }, { where: { id: deviceId } });
};

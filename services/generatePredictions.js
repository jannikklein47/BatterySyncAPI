const models = require("../models");
const downsampler = require("downsample-lttb");
const { Op } = require("sequelize");

function sameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function analyzeSinceLastUnplug(log, device) {
  if (!log || !log.length || log[0].isPluggedIn) return null;

  const now = new Date(log[0].createdAt).getTime();
  let startEntry = null;

  // newest entry at index 0
  for (let i = 0; i < log.length - 1; i++) {
    const newer = log[i];
    const older = log[i + 1];

    // detect unplug (charging ended)
    if (older.isPluggedIn === true && newer.isPluggedIn === false) {
      startEntry = newer;
      //console.log(i)
      break;
    }
  }

  // fallback: if never unplugged in log, use newest entry
  if (!startEntry) {
    startEntry = log[log.length - 1];
  }

  const startTime = new Date(startEntry.createdAt).getTime();
  const elapsedMs = now - startTime;
  if (elapsedMs <= 0) {
    return null;
  }

  const latest = log[0]; // newest entry
  const latestBattery = Math.floor(latest.battery * 100);
  const startBattery = Math.floor(startEntry.battery * 100);
  const deltaBattery = latestBattery - startBattery;
  const ratePerMs = deltaBattery / elapsedMs;

  let predictedZeroAt = null;
  if (ratePerMs < 0) {
    const timeToZeroMs = latestBattery / Math.abs(ratePerMs);
    predictedZeroAt = new Date(now + timeToZeroMs);

    if (predictedZeroAt < new Date()) {
      predictedZeroAt = null;
      console.log("Device " + device.id + " has a past prediction.");
    }
  }

  return {
    startEntry,
    elapsedMinutes: elapsedMs / 60000,
    avgRatePerHour: ratePerMs * 3600000, // % per hour
    predictedZeroAt,
  };
}

// When this is executed, the predicted Zero for the entire Database is calculated. This is fine for a very small userbase.
// But lets say we manage 1000 devices. Every device will have an average lifespan of 2 days. This means 100 Post requests in 2 Days.
// This is around 2.1 Post requests per hour per device. 2100 Requests per hour. 35 Requests per minute or a request every 2 seconds.
// --> The entire 24-hour history of 500 devices is processed PER SECOND! Only 1000 Devices, or 500 Users best case!
// FIXING RN
module.exports = async function (deviceId) {
  const device = await models.Device.findByPk(deviceId);

  if (!device) return;

  const deviceHistory = [];

  const targetDeviceId = device.id;

  const result = await models.batteryLogs.findAll({
    where: {
      deviceId: targetDeviceId,
      createdAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      chargingStatus: { [Op.ne]: null },
      battery: { [Op.ne]: null },
      isPluggedIn: { [Op.ne]: null },
    },
    order: [["createdAt", "DESC"]],
    attributes: ["createdAt", "chargingStatus", "battery", "isPluggedIn"],
    raw: true,
  });

  if (result.length < 1) return;

  deviceHistory[device.id] = result;

  await models.sequelize.transaction(async (t) => {
    const analysis = analyzeSinceLastUnplug(deviceHistory[device.id], device);
    if (analysis && analysis.predictedZeroAt) {
      await models.Device.update(
        { predictedZeroAt: analysis.predictedZeroAt },
        { where: { id: device.id } }
      );
    } else {
      await models.Device.update(
        { predictedZeroAt: null },
        { where: { id: device.id } }
      );
    }
  });
};

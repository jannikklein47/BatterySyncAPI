const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const BatteryLogsService = require("../../../services/batteryLogs");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

async function getUserDevices(req, res, next) {
  try {
    const validation = ValidationRules.optionalUUID.validate(req.query.uuid);
    if (validation.error)
      return next(APIError.errorValidation(validation.error.message));

    const devices = await DeviceService.getDevices(req.user.id);
    if (req.query.uuid) {
      const device = await DeviceService.getDeviceByUUID(req.query.uuid);
      await DeviceService.refreshLastActivity(device.id);
    }
    return res.send(devices);
  } catch (error) {
    return next(error);
  }
}
/**
 * Get all user devices
 */
router.get("/", getUserDevices);

/**
 * Get all user devices and refresh last activity of sender
 */
router.get("/secure", getUserDevices);

/**
 * Get all user devices with notification info
 */
router.get("/withNotificationInfo", async (req, res, next) => {
  try {
    const devices = await DeviceService.getDevices(req.user.id, true);
    return res.send(devices);
  } catch (error) {
    return next(error);
  }
});

/**
 * Get the 24 hour history of all user devices
 */
router.get("/history/all", async (req, res, next) => {
  try {
    const userDevices = await DeviceService.getDevices(req.user.id);
    const results = {};
    for (const device of userDevices) {
      const history = await BatteryLogsService.getBatteryLogs(device.id, "day");
      results[device.id] = history;
    }
    return res.send(results);
  } catch (error) {
    console.log(error);
    return next(error);
  }
});

/**
 * Get the 7 day history of all user devices
 */
router.get("/history/all/week", async (req, res, next) => {
  try {
    const userDevices = await DeviceService.getDevices(req.user.id);
    const results = {};
    for (const device of userDevices) {
      const history = await BatteryLogsService.getBatteryLogs(
        device.id,
        "week",
      );
      results[device.id] = history;
    }
    return res.send(results);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

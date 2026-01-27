const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

/**
 * Get all user devices
 */
router.get("/", async (req, res, next) => {
  try {
    const devices = await DeviceService.getDevices(req.user.id);
    if (req.query.uuid) {
      const device = await DeviceService.getDeviceByUUID(req.query.uuid);
      await DeviceService.refreshLastActivity(device.id);
    }
    return res.send(devices);
  } catch (error) {
    return next(error);
  }
});

/**
 * Check if a device can generate an one-time password
 */
router.get("/otpCreatable", async (req, res, next) => {
  try {
    const validation = ValidationRules.id.validate(req.query.id);
    if (validation.error)
      return next(APIError.errorValidation(validation.error.message));

    const otpCreatable = await DeviceService.checkOtpCreatable(req.query.id);
    return res.send({ status: otpCreatable });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const BatteryLogsService = require("../../../services/batteryLogs");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

router.post("/secure", async (req, res, next) => {
  try {
    const validationUUID = ValidationRules.uuid.validate(req.query.uuid);
    const validationBattery = ValidationRules.battery.validate(
      req.query.battery,
    );
    const validationChargingStatus = ValidationRules.chargingStatus.validate(
      req.query.chargingStatus,
    );
    const validationIsPluggedIn = ValidationRules.isPluggedIn.validate(
      req.query.isPluggedIn,
    );
    if (validationUUID.error)
      return next(APIError.errorValidation(validationUUID.error.message));
    if (validationBattery.error)
      return next(APIError.errorValidation(validationBattery.error.message));
    if (validationChargingStatus.error)
      return next(
        APIError.errorValidation(validationChargingStatus.error.message),
      );
    if (validationIsPluggedIn.error)
      return next(
        APIError.errorValidation(validationIsPluggedIn.error.message),
      );

    const device = await DeviceService.getDeviceByUUID(req.query.uuid);
    await DeviceService.updateDeviceBatteryStatus(
      device.id,
      req.query.battery,
      req.query.chargingStatus,
      req.query.isPluggedIn,
    );
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

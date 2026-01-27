const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

/**
 * Change the name of a device
 */
router.patch("/name", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    const validationUUID = ValidationRules.uuid.validate(req.query.uuid);
    const validationName = ValidationRules.name.validate(req.query.name);
    if (validationId.error && validationUUID.error)
      return next(
        APIError.errorValidation(
          validationId.error.message + " and " + validationUUID.error.message,
        ),
      );
    if (validationName.error)
      return next(APIError.errorValidation(validationName.error.message));

    if (validationId.error) {
      const device = await DeviceService.getDeviceByUUID(req.query.uuid);
      await DeviceService.updateDevice(device.id, {
        name: req.query.name,
      });
    } else {
      await DeviceService.updateDevice(req.query.id, {
        name: req.query.name,
      });
    }
    return res.send(req.query.name);
  } catch (error) {
    return next(error);
  }
});

/**
 * Change the "isShown" status of a device
 */
router.patch("/isShown", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    const validationIsShown = ValidationRules.isShown.validate(
      req.query.isShown,
    );
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    if (validationIsShown.error)
      return next(APIError.errorValidation(validationIsShown.error.message));

    await DeviceService.updateDevice(req.query.id, {
      isShown: req.query.isShown,
    });
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

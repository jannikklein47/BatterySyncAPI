const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

/**
 * Change the "favorite" status of a device
 */
router.post("/favorite", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.body.id);
    const validationFavorite = ValidationRules.favorite.validate(req.body.set);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    if (validationFavorite.error)
      return next(APIError.errorValidation(validationFavorite.error.message));

    await DeviceService.updateDevice(req.body.id, {
      favorite: req.body.set,
    });

    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * Register a new device with system and optional battery
 */
router.post("/register", async (req, res, next) => {
  try {
    const validationSystem = ValidationRules.system.validate(req.query.system);
    const validationBattery = ValidationRules.battery.validate(
      req.query.battery,
    );
    if (validationSystem.error)
      return next(APIError.errorValidation(validationSystem.error.message));
    if (validationBattery.error)
      return next(APIError.errorValidation(validationBattery.error.message));

    const createdDevice = await DeviceService.createDevice({
      type: req.query.system,
      userId: req.user.id,
      battery: req.query.battery || 0.0,
    });

    const createdUUID = createdDevice.uuid;

    return res.send(createdUUID);
  } catch (error) {
    return next(error);
  }
});

/**
 * Check if a uuid is valid
 */
router.post("/uuid", async (req, res, next) => {
  try {
    const validationUUID = ValidationRules.uuid.validate(req.query.uuid);
    if (validationUUID.error)
      return next(APIError.errorValidation(validationUUID.error.message));
    const validationBuildNumber = ValidationRules.buildNumber.validate(
      req.query.build,
    );
    if (validationBuildNumber.error)
      return next(
        APIError.errorValidation(validationBuildNumber.error.message),
      );

    const device = await DeviceService.getDeviceByUUID(req.query.uuid);

    if (req.query.build) {
      await DeviceService.updateDevice(device.id, {
        build: req.query.build,
      });
    }
    return res.send({ name: device.name, id: device.id });
  } catch (error) {
    return next(error);
  }
});

/**
 * Create and send a new one time password for a given device id
 */
router.post("/otp", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    if (await DeviceService.checkOtpCreatable(req.query.id)) {
      await DeviceService.createOneTimePassword(req.query.id);
      return res.send("Ok");
    } else {
      const device = await DeviceService.getDevice(req.query.id);
      return res.status(410).send(device.otpTime);
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * Reassign a device to a new uuid
 */
router.post("/newUuid", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    const validationOTP = ValidationRules.otp.validate(req.query.otp);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    if (await DeviceService.checkDeviceInactive(req.query.id)) {
      const newUUID = await DeviceService.reassignUUIDInactive(req.query.id);
      return res.send(newUUID);
    } else {
      if (validationOTP.error)
        return next(APIError.errorValidation(validationOTP.error.message));

      const newUUID = await DeviceService.reassignUUID(
        req.query.id,
        req.query.otp,
      );
      return res.send(newUUID);
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * Logout a device to inactive state
 */
router.post("/logout/inactive", async (req, res, next) => {
  try {
    const validationUUID = ValidationRules.uuid.validate(req.query.uuid);
    if (validationUUID.error)
      return next(APIError.errorValidation(validationUUID.error.message));

    const device = await DeviceService.getDeviceByUUID(req.query.uuid);

    await DeviceService.updateDevice(device.id, {
      uuid: null,
    });
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * Logout a device and permanently delete it
 */
router.post("/logout/delete", async (req, res, next) => {
  try {
    const validationUUID = ValidationRules.uuid.validate(req.query.uuid);
    if (validationUUID.error)
      return next(APIError.errorValidation(validationUUID.error.message));

    await DeviceService.deleteDeviceUUID(req.query.uuid);
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

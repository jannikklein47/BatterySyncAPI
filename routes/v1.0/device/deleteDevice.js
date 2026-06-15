const express = require("express");
const router = express.Router();
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

/**
 * Permanently delete device
 */
router.delete("/", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    await DeviceService.deleteDeviceId(req.query.id);
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

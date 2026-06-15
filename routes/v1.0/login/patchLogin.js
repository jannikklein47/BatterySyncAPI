const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const UserService = require("../../../services/user");
const router = express.Router();

router.patch("/renameUser", async (req, res, next) => {
  try {
    const validationEmail = ValidationRules.email.validate(req.body.name);
    if (validationEmail.error)
      return next(APIError.errorValidation(validationEmail.error.message));

    await UserService.updateUser(req.user.email, { email: req.body.name });
    return res.send("ok");
  } catch (error) {
    return next(error);
  }
});

router.patch("/resetPassword", async (req, res, next) => {
  try {
    const validationPassword = ValidationRules.email.validate(
      req.body.password,
    );
    if (validationPassword.error)
      return next(APIError.errorValidation(validationPassword.error.message));

    await UserService.resetPassword(req.user.email, req.body.password);
    await DeviceService.revokeAllDeviceRegistrations(req.user.id);
    return res.send("ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

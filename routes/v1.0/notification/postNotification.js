const express = require("express");
const router = express.Router();
const APIError = require("../../../utils/error");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const UserService = require("../../../services/user");

/**
 * Create a new notification
 */
router.post("/new", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.body.deviceId);
    const validationType = ValidationRules.type.validate(req.body.type);
    const validationPermanent = ValidationRules.permanent.validate(
      req.body.permanent,
    );
    const validationContent = ValidationRules.content.validate(
      req.body.content,
    );
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    if (validationType.error)
      return next(APIError.errorValidation(validationType.error.message));
    if (validationPermanent.error)
      return next(APIError.errorValidation(validationPermanent.error.message));
    if (validationContent.error)
      return next(APIError.errorValidation(validationContent.error.message));

    await NotificationService.createNewNotification(
      req.body.type,
      req.body.content,
      req.body.permanent,
      req.body.deviceId,
      req.user.id,
    );

    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * ONLY ADMIN
 * Create a new notification targeted to specific users
 */
router.post("/new/custom", async (req, res, next) => {
  try {
    if (!req.user.admin) return next(APIError.errorForbidden());
    const type = "CONTENT";
    const validationContent = ValidationRules.content.validate(
      req.body.content,
    );
    const validationTitle = ValidationRules.title.validate(req.body.title);
    const validationUsers = ValidationRules.users.validate(req.body.users);
    if (validationTitle.error)
      return next(APIError.errorValidation(validationTitle.error.message));
    if (validationContent.error)
      return next(APIError.errorValidation(validationContent.error.message));
    if (validationUsers.error)
      return next(APIError.errorValidation(validationUsers.error.message));

    let targetUsers = [];
    if (req.body.users === "all") {
      targetUsers = await UserService.getAllUsers();
    } else {
      targetUsers = await UserService.getUsersByIds(JSON.parse(req.body.users));
    }

    for (const user of targetUsers) {
      const devices = await DeviceService.getDevices(user.id);
      if (!devices[0]) continue;
      await NotificationService.createNewNotification(
        type,
        req.body.content,
        req.body.permanent,
        devices[0].id,
        user.id,
        req.body.title,
      );
    }
    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * Delete ordered charge reminders for a device
 */
router.post("/off", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.body.deviceId);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    const orderedNotifications =
      await NotificationService.getAllOrderedNotifcationsForDevice(
        req.body.deviceId,
        "CHARGEREMINDER",
      );

    await NotificationService.deleteOrderedNotifications(
      orderedNotifications.map((orderedNotification) => orderedNotification.id),
    );

    return res.send("Ok");
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

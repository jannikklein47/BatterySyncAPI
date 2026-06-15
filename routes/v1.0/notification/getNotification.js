const express = require("express");
const router = express.Router();
const APIError = require("../../../utils/error");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");

router.get("/due", async (req, res, next) => {
  try {
    const validateId = ValidationRules.id.validate(req.query.id);
    const validateUUID = ValidationRules.uuid.validate(req.query.uuid);
    if (validateId.error && validateUUID.error)
      return next(
        APIError.errorValidation(
          validateId.error.message + " and " + validateUUID.error.message,
        ),
      );

    let deviceId, canShowLinks;
    if (validateId.error) {
      const device = await DeviceService.getDeviceByUUID(req.query.uuid);
      deviceId = device.id;
      canShowLinks = device.build >= "2026032502";
    } else {
      const device = await DeviceService.getDevice(req.query.id);
      canShowLinks = device.build >= "2026032502";
      deviceId = req.query.id;
    }
    const notifications =
      await NotificationService.getScheduledNotificationsForDevice(deviceId, {
        due: true,
        type: "CHARGEREMINDER",
      });

    const otherNotifications =
      await NotificationService.getScheduledNotificationsForDevice(deviceId, {
        type: "CONTENT",
      });

    await NotificationService.deleteScheduledNotifications(
      notifications
        .map((notification) => notification.id)
        .concat(otherNotifications.map((notification) => notification.id)),
    );

    await NotificationService.deleteAllDisplayedOrderedNotifications();

    const data = [
      ...notifications.map((noti) => {
        const link =
          "https://batterysync.de/devices?id=" + noti.notification?.device?.id;
        return {
          targetName: noti.notification?.device?.name || "",
          predictedZeroAt: noti.notification?.device?.predictedZeroAt || "",
          content: noti.notification?.content || "",
          type: noti.notification?.type || "",
          title: noti.notification?.title || "",
          url: canShowLinks === true ? link : undefined,
        };
      }),
      ...otherNotifications.map((noti) => {
        return {
          targetName: "",
          predictedZeroAt: "",
          content: noti.notification?.content || "",
          type: noti.notification?.type || "",
          title: noti.notification?.title || "",
          url: canShowLinks === true ? noti.notification?.url || "" : undefined,
        };
      }),
    ];

    return res.send(data);
  } catch (error) {
    console.error(error);
    return next(error);
  }
});

module.exports = router;

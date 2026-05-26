const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const router = express.Router();

router.delete("/", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    await IssueService.archiveIssue(req.query.id);
    const result = await IssueService.getIssue(req.query.id);
    const userDevices = await DeviceService.getDevices(result.userId);
    if (userDevices[0]) {
      // Only send a notification if the user owns any devices
      await NotificationService.createNewNotification(
        "CONTENT",
        'Dein Issue "' + result.title.substring(0, 30) + '" wurde archiviert.',
        false,
        userDevices[0].id,
        req.user.id,
        "Issue Update",
      );
    }
    return res.send(result);
  } catch (error) {
    return next(error);
  }
});

router.delete("/comment", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));

    const deleted = await IssueService.deleteComment(req.query.id);
    return res.send(deleted);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

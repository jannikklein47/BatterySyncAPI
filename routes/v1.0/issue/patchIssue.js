const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const router = express.Router();

router.patch("/", async (req, res, next) => {
  try {
    const validationIssue = ValidationRules.updateIssue.validate(req.body);
    if (validationIssue.error)
      return next(APIError.errorValidation(validationIssue.error.message));

    await IssueService.updateIssue(req.body.id, req.body);
    const result = await IssueService.getIssue(req.body.id);
    const userDevices = await DeviceService.getDevices(req.user.id);
    if (userDevices[0]) {
      // Only send a notification if the user owns any devices
      await NotificationService.createNewNotification(
        "CONTENT",
        'Dein Issue "' +
          result.title +
          '" ist nun ' +
          (result.status === 0
            ? "nicht mehr in Bearbeitung."
            : result.status === 1
              ? "in Bearbeitung."
              : result.status === 2
                ? "umgesetzt worden. Vielen Dank für dein Feedback!"
                : " aktiv."),
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

module.exports = router;

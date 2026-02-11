const express = require("express");
const router = express.Router();
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const UserService = require("../../../services/user");
const DeviceService = require("../../../services/device");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

router.post("/", async (req, res, next) => {
  try {
    const validationIssue = ValidationRules.issue.validate(req.body);
    if (validationIssue.error)
      return next(APIError.errorValidation(validationIssue.error.message));

    const created = await IssueService.createIssue(req.body, req.user.id);

    if (req.body.notify && req.body.priority == 2) {
      const admin = await UserService.getAdmin();
      if (admin) {
        const devices = await DeviceService.getDevices(admin.id);

        if (devices[0])
          await NotificationService.createNewNotification(
            "CONTENT",
            "'" + created.title + "' erfordert deine Aufmerksamkeit.",
            false,
            devices[0].id,
            admin.id,
            "Kritisches Problem",
          );
      }
    }

    return res.send(created);
  } catch (error) {
    return next(error);
  }
});

router.post("/upvote", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    await IssueService.getIssue(req.query.id); // Does the issue exist?
    await IssueService.toggleUpvote(req.query.id, req.user.id);
    const result = await IssueService.getIssue(req.query.id);
    res.send(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/downvote", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.id);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    await IssueService.getIssue(req.query.id); // Does the issue exist?
    await IssueService.toggleDownvote(req.query.id, req.user.id);
    const result = await IssueService.getIssue(req.query.id);
    res.send(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/comment", async (req, res, next) => {
  try {
    const validationId = ValidationRules.id.validate(req.query.issueId);
    const validationText = ValidationRules.text.validate(req.body.text);
    if (validationId.error)
      return next(APIError.errorValidation(validationId.error.message));
    if (validationText.error)
      return next(APIError.errorValidation(validationText.error.message));

    await IssueService.getIssue(req.query.issueId); // Does the issue exist?
    const comment = await IssueService.createComment(
      { text: req.body.text },
      req.user.id,
      req.query.issueId,
    );

    return res.send(comment);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const router = express.Router();

router.put("/", async (req, res, next) => {
  try {
    const validationIssue = ValidationRules.updateIssue.validate(req.body);
    if (validationIssue.error)
      return next(APIError.errorValidation(validationIssue.error.message));

    await IssueService.updateIssue(req.body.id, req.body);
    const result = await IssueService.getIssue(req.body.id);
    return res.send(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

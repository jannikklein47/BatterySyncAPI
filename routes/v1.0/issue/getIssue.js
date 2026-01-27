const express = require("express");
const router = express.Router();
const IssueService = require("../../../services/issue");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");

router.get("/", async (req, res, next) => {
  try {
    const validationSearch = ValidationRules.search.validate(req.query.search);
    if (validationSearch.error)
      return next(APIError.errorValidation(validationSearch.error.message));
    const issues = await IssueService.getIssues(req.query.search, req.user?.id);

    return res.send(issues);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

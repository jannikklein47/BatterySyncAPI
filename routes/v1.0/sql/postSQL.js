const express = require("express");
const router = express.Router();
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const MetricService = require("../../../services/metrics");
const path = require("path");
const models = require("../../../models");

router.post("/", async (req, res, next) => {
  try {
    const validationSupercode = ValidationRules.string.validate(
      req.body.supercode,
    );
    const validateInput = ValidationRules.string.validate(req.body.input);
    if (validationSupercode.error)
      return next(APIError.errorValidation(validationSupercode.error.message));
    if (validateInput.error)
      return next(APIError.errorValidation(validateInput.error.message));

    if (!req.user.admin) return next(APIError.errorForbidden());
    if (!req.body.supercode === process.env.SUPERCODE)
      return next(APIError.errorValidation("Invalid supercode"));

    const result = await models.sequelize.query(req.body.input);
    res.send(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

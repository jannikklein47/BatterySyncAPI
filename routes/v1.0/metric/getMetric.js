const express = require("express");
const router = express.Router();
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const MetricService = require("../../../services/metrics");
const path = require("path");

router.get("/", async (req, res, next) => {
  try {
    const validationAccess = ValidationRules.string.validate(req.query.key);
    const validationTimeframe = ValidationRules.string.validate(
      req.query.timeframe,
    );
    const validationInterval = ValidationRules.string.validate(
      req.query.interval,
    );
    if (validationAccess.error)
      return next(APIError.errorValidation(validationAccess.error.message));
    if (validationTimeframe.error)
      return next(APIError.errorValidation(validationTimeframe.error.message));
    if (validationInterval.error)
      return next(APIError.errorValidation(validationInterval.error.message));

    if (
      req.query.key !== process.env.ADMIN_ACCESS &&
      req.query.key !== process.env.API_USAGE_KEY
    )
      return next(APIError.errorValidation("Invalid key"));

    const metrics = await MetricService.getApiUsage(
      req.query.timeframe || "1 day",
      req.query.interval || "30 minutes",
    );

    return res.send(metrics);
  } catch (error) {
    return next(error);
  }
});

router.get("/userStats", async (req, res, next) => {
  try {
    const stats = await MetricService.getUserStats(req.user.id);
    return res.send(stats);
  } catch (error) {
    console.log(error);
    return next(error);
  }
});

module.exports = router;

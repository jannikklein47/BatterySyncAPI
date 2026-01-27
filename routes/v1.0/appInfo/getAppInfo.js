const MetricService = require("../../../services/metrics");
const express = require("express");
const router = express.Router();

router.get("/syncs", async (req, res, next) => {
  try {
    const syncs = await MetricService.getSyncCount();
    return res.send(syncs);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

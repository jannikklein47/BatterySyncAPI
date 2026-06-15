const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const router = express.Router();

const multer = require("multer");
const models = require("../../../models");
const APIError = require("../../../utils/error");
const path = require("path");
const fs = require("fs");
const path_to_delete = "/usr/src/app/updates";

router.delete("/updates/all", async (req, res, next) => {
  try {
    await models.AndroidUpdate.destroy({
      where: {},
      truncate: { cascade: true },
    });
    fs.rmSync(path_to_delete, { recursive: true });
    res.status(201).json("ok");
  } catch (err) {
    console.error(err);
    next(APIError.errorUnknown());
  }
});

module.exports = router;

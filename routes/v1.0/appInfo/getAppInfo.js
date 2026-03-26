const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const models = require("../../../models");
const router = express.Router();
const path = require("path");
const fs = require("fs");

router.get("/syncs", async (req, res, next) => {
  try {
    const syncs = await MetricService.getSyncCount();
    return res.send(syncs);
  } catch (error) {
    return next(error);
  }
});

router.get("/updates/android/latest", async (req, res, next) => {
  try {
    const version = await AndroidUpdateService.getLatestBuildInfo();

    return res.send(version);
  } catch (error) {
    return next(error);
  }
});

router.get("/updates/download/:version", async (req, res) => {
  const update = await models.AndroidUpdate.findOne({
    where: { build: req.params.version },
  });

  if (!update) return res.status(404).send("Version not found.");

  const UPLOAD_DIR = "/usr/src/app/updates";

  if (!fs.existsSync(UPLOAD_DIR)) {
    console.error(
      `CRITICAL: Volume not found at ${UPLOAD_DIR}. Falling back to local folder.`,
    );
    next(APIError.errorUnknown());
  }

  const filePath = path.resolve(UPLOAD_DIR, update.name);

  // Essential for Android to recognize the APK
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.download(filePath, `batterysync-${update.build}.apk`);
});

module.exports = router;

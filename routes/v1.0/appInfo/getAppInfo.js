const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const AndroidUpdate = require("../../../models/AndroidUpdate");
const router = express.Router();

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
  const update = await AndroidUpdate.findOne({
    where: { version: req.params.version },
  });

  if (!update) return res.status(404).send("Version not found.");

  const filePath = path.resolve(__dirname, "updates", update.filename);

  // Essential for Android to recognize the APK
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.download(filePath, `batterysync-${update.version}.apk`);
});

module.exports = router;

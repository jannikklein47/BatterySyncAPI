const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const router = express.Router();

const multer = require("multer");
const models = require("../../../models");
const APIError = require("../../../utils/error");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "updates/");
  },
  filename: (req, file, cb) => {
    const version = req.body.version;
    cb(null, `batterysync-${version}.apk`);
  },
});
const upload = multer({ storage });

router.post(
  "/updates/android",
  upload.single("file"),
  async (req, res, next) => {
    const { version, notes } = req.body;
    console.log(req.body);
    try {
      const newUpdate = await models.AndroidUpdate.create({
        build: version,
        name: req.file.filename, // Multer's generated name
        notes: notes,
      });
      res.status(201).json(newUpdate);
    } catch (err) {
      console.error(err);
      next(APIError.errorUnknown());
    }
  },
);

module.exports = router;

const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const router = express.Router();

const multer = require("multer");
const AndroidUpdate = require("../../../models/AndroidUpdate");
const APIError = require("../../../utils/error");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "updates/"); // This points to your Docker volume
  },
  filename: (req, file, cb) => {
    // Save with version name to make it easy to identify on disk
    const version = req.body.version;
    cb(null, `${version}}.apk`);
  },
});
const upload = multer({ storage });

router.post("/updates/android", upload.single("file"), async (req, res) => {
  const { version, notes } = req.body;

  try {
    const newUpdate = await AndroidUpdate.create({
      build,
      name: req.file.filename, // Multer's generated name
      notes: notes,
    });
    res.status(201).json(newUpdate);
  } catch (err) {
    console.error(err);
    next(APIError.errorUnknown());
  }
});

module.exports = router;

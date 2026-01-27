const express = require("express");
const router = express.Router();
const APIError = require("../../../utils/error");
const FileService = require("../../../services/file");
const path = require("path");

router.get("/android", async (req, res, next) => {
  try {
    const file = await FileService.getFile(
      path.join(__dirname, "..", "batterysync-android.apk"),
    );
    res.send(file.data);
  } catch (error) {
    return next(error);
  }
});

router.get("/macos", async (req, res, next) => {
  try {
    const file = await FileService.getFile(
      path.join(__dirname, "..", "batterysync-macos.dmg"),
    );
    res.send(file.data);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

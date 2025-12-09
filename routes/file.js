const express = require("express");
const models = require("../models");

const fs = require("node:fs");

const path = require("path");

const log = require("../services/logsystem");

const Users = models.User;
const router = express.Router();

router.get("/android", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const filePath = path.join(__dirname, "..", "batterysync-android.apk");
      res.sendFile(filePath);
      const stats = fs.statSync(filePath);
      log(
        null,
        "/file/android",
        "GET",
        req.rawBodySize,
        stats.size || 0,
        user.id
      );
    } else {
      const filePath = path.join(__dirname, "..", "batterysync-android.apk");
      res.sendFile(filePath);
      const stats = fs.statSync(filePath);
      log(null, "/file/android", "GET", req.rawBodySize, stats.size || 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/macos", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const filePath = path.join(__dirname, "..", "batterysync-macos.dmg");
      res.sendFile(filePath);
      const stats = fs.statSync(filePath);
      log(
        null,
        "/file/macos",
        "GET",
        req.rawBodySize,
        stats.size || 0,
        user.id
      );
    } else {
      const filePath = path.join(__dirname, "..", "batterysync-macos.dmg");
      res.sendFile(filePath);
      const stats = fs.statSync(filePath);
      log(null, "/file/macos", "GET", req.rawBodySize, stats.size || 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

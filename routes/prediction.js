const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize } = require("sequelize");

const log = require("../services/logsystem");
const generatePredictions = require("../services/generatePredictions");

const users = models.User;
const devices = models.Device;
const batterylogs = models.batteryLogs;

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    if (req.query.email && req.query.masterkey) {
      if (req.query.masterkey !== process.env.ADMIN_ACCESS) {
        res.status(403).send("Wrong admin code");
        log("Access denied", "/prediction", "GET", req.rawBodySize, 0);
        return;
      }

      const allDevices = await devices.findAll();

      for (const device of allDevices) {
        generatePredictions(device.id);
      }

      res.send("Ok");
      log(null, "/prediction", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/prediction",
      "PATCH",
      req.rawBodySize,
      0,
      error
    );
  }
});

module.exports = router;

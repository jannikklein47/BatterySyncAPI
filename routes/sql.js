const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize } = require("sequelize");

const sequelize = models.sequelize;

const log = require("../services/logsystem");
const generatePredictions = require("../services/generatePredictions");

const users = models.User;
const devices = models.Device;
const batterylogs = models.batteryLogs;

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    if (
      req.headers.authorization &&
      req.body.supercode === process.env.supercode
    ) {
      let user = await users.findOne({
        where: { password: req.headers.authorization },
      });

      if (user && user.admin === true) {
        try {
          const result = await sequelize.query(req.body.input);
          res.send(result);
        } catch (error) {
          res.send("failed: " + error);
        }

        log(null, "/sql", "POST", req.rawBodySize, 0, user.id);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/sql", "POST", req.rawBodySize, 0, null);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/prediction",
      "PATCH",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

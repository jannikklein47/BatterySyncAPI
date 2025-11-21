const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const users = models.User;
const devices = models.Device;

const router = express.Router();

const log = require("../services/logsystem");

router.put("/", async (req, res) => {
  try {
    if (req.headers.authorization && req.body) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        let updated;
        if (
          (updated = await devices.update(req.body, {
            where: {
              userId: user.id,
              name: req.body.name,
            },
          }))
        ) {
          // console.log("Device update: ", device)
          if (updated > 0) {
            res.status(200).send("Ok");
            log(null, "/device", "PUT", req.rawBodySize, 0);
          } else {
            res.status(404).send("Device not found");
            log("Device not found", "/device", "PUT", req.rawBodySize, 0);
          }
        } else {
          res.status(400).send("Update failed");
          log("Update failed", "/device", "PUT", req.rawBodySize, 0);
        }
      } else {
        res.status(403).send("Invalid authToken");
        log("Access denied", "/device", "PUT", req.rawBodySize, 0);
      }
    } else {
      res.status(400).send("No authToken included");
      log("Access denied", "/device", "PUT", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log("Internal Server Error", "/device", "PUT", req.rawBodySize, 0, error);
  }
});

router.post("/favorite", async (req, res) => {
  try {
    const deviceId = req.body.deviceId;
    const set = req.body.set;

    if (!deviceId || typeof set != "boolean") {
      res.status(400).send("Invalid body");
      log("Invalid body", "/device/favorite", "POST", req.rawBodySize, 0);
      return;
    }

    if (req.headers.authorization && req.body) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        let device;
        if ((device = await devices.findOne({ where: { id: deviceId } }))) {
          await device.update({ favorite: set });
          res.status(200).send("Ok");
          log(null, "/device/favorite", "POST", req.rawBodySize, 0);
        } else {
          res.status(404).send("Device not found");
          log(
            "Device not found",
            "/device/favorite",
            "POST",
            req.rawBodySize,
            0
          );
        }
      } else {
        res.status(403).send("Invalid authToke");
        log("Access denied", "/device/favorite", "POST", req.rawBodySize, 0);
      }
    } else {
      res.status(400).send("No authToken included");
      log("Access denied", "/device/favorite", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/device/favorite",
      "POST",
      req.rawBodySize,
      0,
      error
    );
  }
});

router.delete("/", async (req, res) => {
  try {
    let user;
    if (
      (user = await users.findOne({
        where: { password: req.headers.authorization },
      }))
    ) {
      let deleted = await devices.destroy({
        where: { id: req.body.deviceId, userId: user.id },
      });
      if (deleted > 0) {
        res.send("Ok");
        log(null, "/device/favorite", "DELETE", req.rawBodySize, 0);
      } else {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/favorite",
          "DELETE",
          req.rawBodySize,
          0
        );
      }
    } else {
      res.status(403).send("Invalid authToken");
      log("Access denied", "/device/favorite", "DELETE", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/device/favorite",
      "DELETE",
      req.rawBodySize,
      0,
      error
    );
  }
});

module.exports = router;

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
            log(null, "/device", "PUT", req.rawBodySize, 0, user.id);
          } else {
            res.status(404).send("Device not found");
            log(
              "Device not found",
              "/device",
              "PUT",
              req.rawBodySize,
              0,
              user.id
            );
          }
        } else {
          res.status(400).send("Update failed");
          log("Update failed", "/device", "PUT", req.rawBodySize, 0, user.id);
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
    log(
      "Internal Server Error",
      "/device",
      "PUT",
      req.rawBodySize,
      0,
      null,
      error
    );
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
          log(null, "/device/favorite", "POST", req.rawBodySize, 0, user.id);
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
      null,
      error
    );
  }
});

router.post("/register", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/register", "POST", req.rawBodySize, 0);
      return;
    }

    if (req.query.system !== "phone" && req.query.system !== "laptop") {
      res.status(400).send("Invalid system");
      log("Access denied", "/device/register", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const createdDevice = await devices.create({
        type: req.query.system.toLowerCase(),
        userId: user.id,
      });

      const createdUUID = createdDevice.uuid;

      res.send(createdUUID);
      log(
        null,
        "/device/register",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(createdUUID)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/register", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/register",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

// more secure than get
router.post("/uuid", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/uuid", "POST", req.rawBodySize, 0);
      return;
    }

    if (!req.body.uuid) {
      res.status(400).send("Invalid uuid");
      log("Access denied", "/device/uuid", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          userId: user.id,
          uuid: req.body.uuid,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log("Device not found", "/device/uuid", "POST", req.rawBodySize, 0);
        return;
      }

      const stripped = JSON.parse(foundDevice.toJSON());
      delete stripped.id;

      res.send(stripped);
      log(
        null,
        "/device/uuid",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(stripped)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/uuid", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/uuid",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

router.get("/", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device", "GET", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevices = await devices.findAll({
        where: {
          userId: user.id,
        },
        attributes: ["id", "name"],
      });

      res.send(foundDevices);
      log(
        null,
        "/device",
        "GET",
        req.rawBodySize,
        new Blob([JSON.stringify(foundDevices)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");
      log(null, "/device", "GET", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});
/*
router.post("/register/replaceOld", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/register", "POST", req.rawBodySize, 0);
      return;
    }

    if (req.body.system !== "phone" && req.body.system !== "laptop") {
      res.status(400).send("Invalid system");
      log("Access denied", "/device/register", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const createdDevice = await devices.create({
        type: req.body.system.toLowerCase(),
        userId: user.id,
      });

      const createdUUID = createdDevice.uuid;

      res.send(createdUUID);
      log(
        null,
        "/device/register",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(createdUUID)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/register", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/register",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});
*/

router.delete("/", async (req, res) => {
  try {
    let user;
    if (
      (user = await users.findOne({
        where: { password: req.headers.authorization },
      }))
    ) {
      let deleted = await devices.destroy({
        where: { id: req.query.deviceId, userId: user.id },
      });
      if (deleted > 0) {
        res.send("Ok");
        log(null, "/device/favorite", "DELETE", req.rawBodySize, 0, user.id);
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
      null,
      error
    );
  }
});

module.exports = router;

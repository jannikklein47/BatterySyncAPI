const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize } = require("sequelize");

const users = models.User;
const devices = models.Device;
const sequelize = models.sequelize;

const router = express.Router();

const log = require("../services/logsystem");
const sendNotification = require("../services/sendNotification");

function generateRandomString(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    // Generate a random index based on the number of available characters
    const randomIndex = Math.floor(Math.random() * characters.length);
    // Append the character at that index to the result
    result += characters.charAt(randomIndex);
  }

  return result;
}

/**
 * Returns detailed battery health statistics including a score, total volume,
 * and a breakdown of safe vs. stressed charging.
 */
async function getDeviceHealthStats(deviceId) {
  const query = `
    WITH RawLogs AS (
      -- 1. Normalize Data (0.0-1.0 becomes 0-100)
      SELECT 
        "battery" * 100.0 as "battery_norm",
        "createdAt"
      FROM "batteryLogs"
      WHERE "deviceId" = :deviceId
    ),
    Logs AS (
      SELECT 
        "battery_norm" as "curr",
        LAG("battery_norm") OVER (ORDER BY "createdAt") as "prev"
      FROM RawLogs
    ),
    Analysis AS (
      SELECT 
        ("curr" - "prev") as "charged_amount",

        -- Calculate overlap with Safe Zone (20-80)
        -- Logic: Intersection of [prev, curr] with [20, 80]
        GREATEST(0, LEAST("curr", 80) - GREATEST("prev", 20)) as "safe_amount",
        
        -- Stress C(curr)
        (CASE 
          WHEN "curr" < 20 THEN (20 * "curr" - 0.5 * Power("curr", 2))
          WHEN "curr" <= 80 THEN 200
          ELSE (200 + 0.5 * Power("curr" - 80, 2))
        END) as "stress_at_curr",

        -- Stress C(prev)
        (CASE 
          WHEN "prev" < 20 THEN (20 * "prev" - 0.5 * Power("prev", 2))
          WHEN "prev" <= 80 THEN 200
          ELSE (200 + 0.5 * Power("prev" - 80, 2))
        END) as "stress_at_prev"

      FROM Logs
      WHERE 
        "curr" > "prev"         -- Only charging
        AND "curr" IS NOT NULL 
        AND "prev" IS NOT NULL
    )
    SELECT 
      SUM("charged_amount") as "totalCharged",
      SUM("safe_amount") as "safeCharged",
      SUM("stress_at_curr" - "stress_at_prev") as "totalStress"
    FROM Analysis;
  `;

  const result = await sequelize.query(query, {
    replacements: { deviceId },
    type: QueryTypes.SELECT
  });

  const row = result[0];
  const totalCharged = row?.totalCharged ? parseFloat(row.totalCharged) : 0;
  const safeCharged = row?.safeCharged ? parseFloat(row.safeCharged) : 0;
  const totalStress = row?.totalStress ? parseFloat(row.totalStress) : 0;

  // 1. Handle New/Empty Devices
  if (totalCharged < 100) {
    return {
      healthScore: 100,
      totalCharged: totalCharged.toFixed(0),
      explanation: {
        verdict: "New",
        safeZonePercent: 100,
        stressLevel: "None"
      }
    };
  }

  // 2. Calculate Stats
  const avgStress = totalStress / totalCharged;
  const safePercent = (safeCharged / totalCharged) * 100;
  
  // 3. Calculate Score (Multiplier 10)
  // Maps AvgStress 0->100, 4->80, 20->0
  let rawScore = 100 - (avgStress * 10);
  const healthScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // 4. Generate Text Verdict
  let verdict = "Gut";
  if (healthScore >= 90) verdict = "Exzellent";
  else if (healthScore >= 75) verdict = "Gut";
  else if (healthScore >= 50) verdict = "Mittelmäßig";
  else verdict = "Schlecht";

  return {
    healthScore,
    totalCharged: Math.round(totalCharged), // e.g., 15430 (%)
    explanation: {
      verdict,
      safeZonePercent: Math.round(safePercent), // e.g., 65 (%)
      avgStress: parseFloat(avgStress.toFixed(2)) // e.g., 3.4
    }
  };
}

router.put("/", async (req, res) => {
  try {
    if (req.headers.authorization && req.body) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        if (user.admin !== true) {
          res.status(403).send("User is not admin");
          log("Access denied", "/device", "PUT", req.rawBodySize, 0);
          return;
        }

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

    let battery = 0.0;
    if (req.query.battery) battery = req.query.battery;

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const createdDevice = await devices.create({
        uuid: sequelize.literal("gen_random_uuid()"),
        type: req.query.system.toLowerCase(),
        userId: user.id,
        battery: battery,
      });

      await createdDevice.reload();

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
    let auth = req.headers.authorization;
    if (!auth) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/uuid", "POST", req.rawBodySize, 0);
      return;
    }

    if (!req.query.uuid) {
      res.status(400).send("Invalid uuid");
      log("Access denied", "/device/uuid", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          userId: user.id,
          uuid: req.query.uuid,
        },
        attributes: ["name"],
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log("Device not found", "/device/uuid", "POST", req.rawBodySize, 0);
        return;
      }

      res.send(foundDevice);
      log(
        null,
        "/device/uuid",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(foundDevice)]).size,
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

router.post("/otp", async (req, res) => {
  try {
    let auth = req.headers.authorization;
    if (!auth) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/otp", "POST", req.rawBodySize, 0);
      return;
    }

    if (!req.query.id) {
      res.status(400).send("Invalid id");
      log("Access denied", "/device/otp", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          userId: user.id,
          id: req.query.id,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/otp",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      if (
        foundDevice.otpTime &&
        new Date(foundDevice.otpTime) > Date.now() - 5 * 60 * 1000
      ) {
        res.status(410).send(foundDevice.otpTime);
        log(
          "OTP Already generated",
          "/device/otp",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      let generated = generateRandomString();

      await foundDevice.update({
        otp: generated,
        otpTime: new Date(),
      });

      sendNotification(
        generated + " ist dein Einmalpasswort",
        "Gebe diesen Code niemals weiter. Er ist nur für 5 Minuten gültig.",
        user.id,
        foundDevice.id
      );

      res.send("ok");

      log(
        null,
        "/device/otp",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(0)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");

      log("Access denied", "/device/otp", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/otp",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

router.get("/otpCreatable", async (req, res) => {
  try {
    let auth = req.headers.authorization;
    if (!auth) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/otpCreatable", "GET", req.rawBodySize, 0);
      return;
    }

    if (!req.query.id) {
      res.status(400).send("Invalid id");
      log("Access denied", "/device/otpCreatable", "GET", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          userId: user.id,
          id: req.query.id,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/otpCreatable",
          "GET",
          req.rawBodySize,
          0
        );
        return;
      }

      if (
        foundDevice.otpTime &&
        new Date(foundDevice.otpTime) > Date.now() - 5 * 60 * 1000
      ) {
        res.send({ status: false });
        log(null, "/device/otpCreatable", "GET", req.rawBodySize, 0, user.id);
        return;
      } else {
        res.send({ status: true });
        log(null, "/device/otpCreatable", "GET", req.rawBodySize, 0, user.id);
        return;
      }
    } else {
      res.status(403).send("Access denied");

      log("Access denied", "/device/otp", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/otp",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

router.post("/newUuid", async (req, res) => {
  try {
    let auth = req.headers.authorization;
    if (!auth) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/newUuid", "POST", req.rawBodySize, 0);
      return;
    }

    if (!req.query.id) {
      res.status(400).send("Invalid id");
      log("Access denied", "/device/newUuid", "POST", req.rawBodySize, 0);
      return;
    }

    /* at this point it is not required (offline device?)
    if (!req.query.otp) {
      res.status(400).send("Missing One-Time-Password");
      log("Access denied", "/device/newUuid", "POST", req.rawBodySize, 0);
      return;
    }*/

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      if (req.query.otp) {
        const foundDevice = await devices.findOne({
          where: {
            userId: user.id,
            id: req.query.id,
            otp: req.query.otp,
            /*
            otpTime: {
              [Op.gte]: sequelize.literal(`NOW() - INTERVAL '5 minutes'`),
            },*/
          },
        });

        if (!foundDevice) {
          res.status(404).send("Device not found");
          log(
            "Device not found",
            "/device/newUuid",
            "POST",
            req.rawBodySize,
            0,
            user.id
          );
          return;
        }

        if (
          foundDevice.otpTime &&
          new Date(foundDevice.otpTime) < Date.now() - 5 * 60 * 1000
        ) {
          res.status(410).send("OTP expired. Generate a new one.");
          log(
            "OTP Expired",
            "/device/newUuid",
            "POST",
            req.rawBodySize,
            0,
            user.id
          );
          return;
        }

        if (foundDevice.otp === req.query.otp) {
          await foundDevice.update({
            uuid: sequelize.literal("gen_random_uuid()"),
            otp: null,
            otpTime: null,
          });

          // Reload, damit das ergebnis des literals gewählt wird
          await foundDevice.reload();

          const newUuid = foundDevice.uuid;

          res.send(newUuid);
        } else {
          res.status(403).send("Wrong One-Time-Password");
          log("Access denied", "/device/newUuid", "POST", req.rawBodySize, 0);
          return;
        }

        log(
          null,
          "/device/newUuid",
          "POST",
          req.rawBodySize,
          new Blob([JSON.stringify(foundDevice)]).size,
          user.id
        );
      } else {
        // Device must be longer offline than 12 hours or have no uuid assigned yet
        const foundDevice = await devices.findOne({
          where: {
            userId: user.id,
            id: req.query.id,

            [Op.or]: {
              lastActivity: {
                [Op.lte]: new Date(Date.now() - 12 * 60 * 60 * 1000),
              } /*
              [Op.and]: {
                battery: 0.0,
                lastActivity: {
                  [Op.lte]: new Date(Date.now() - 1 * 60 * 60 * 1000),
                },
              },*/,
              uuid: {
                [Op.is]: null,
              },
            },
          },
        });

        if (!foundDevice) {
          res
            .status(404)
            .send("Device does not exist or requires One-Time-Password");
          log(
            "Access denied",
            "/device/newUuid",
            "POST",
            req.rawBodySize,
            0,
            user.id
          );
          return;
        }
        await foundDevice.update({
          uuid: sequelize.literal("gen_random_uuid()"),
          otp: null,
          otpTime: null,
          lastActivity: new Date(),
        });

        // Reload, damit das ergebnis des literals gewählt wird
        await foundDevice.reload();

        const newUuid = foundDevice.uuid;

        res.send(newUuid);

        log(
          null,
          "/device/newUuid",
          "POST",
          req.rawBodySize,
          new Blob([JSON.stringify(foundDevice)]).size,
          user.id
        );
      }
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

router.patch("/name", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/name", "PATCH", req.rawBodySize, 0);
      return;
    }

    let uuid, id;
    if (!(uuid = req.query.uuid) && !(id = req.query.id)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/name", "PATCH", req.rawBodySize, 0);
      return;
    }

    if (!req.query.name || req.query.name.length < 2) {
      res.status(400).send("Invalid name");
      log("Access denied", "/device/name", "PATCH", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      let foundDevice;
      if (uuid) {
        foundDevice = await devices.findOne({
          where: {
            uuid: uuid,
            userId: user.id,
          },
        });
      }
      if (id) {
        foundDevice = await devices.findOne({
          where: {
            id: id,
            userId: user.id,
          },
        });
      }

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/name",
          "PATCH",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      foundDevice.update({ name: req.query.name });

      res.send(req.query.name);
      log(
        null,
        "/device/name",
        "PATCH",
        req.rawBodySize,
        new Blob([JSON.stringify(req.query.name)]).size,
        user.id
      );
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/name", "PATCH", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/name",
      "PATCH",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

router.patch("/isShown", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/isShown", "PATCH", req.rawBodySize, 0);
      return;
    }

    let id;
    if (!(id = req.query.id)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/isShown", "PATCH", req.rawBodySize, 0);
      return;
    }

    let isShown;
    if (!(isShown = req.query.isShown)) {
      res.status(403).send("Missing isShown");
      log("Access denied", "/device/isShown", "PATCH", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          id: id,
          userId: user.id,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/isShown",
          "PATCH",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      foundDevice.update({ isShown: isShown });

      res.send("Ok");
      log(null, "/device/isShown", "PATCH", req.rawBodySize, 0, user.id);
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/isShown", "PATCH", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/isShown",
      "PATCH",
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
        attributes: [
          "id",
          "name",
          "battery",
          "favorite",
          "lastActivity",
          "chargingStatus",
          "isPluggedIn",
          "uuid",
          "isShown",
        ],
        order: [["favorite", "DESC"]],
      });

      const devicesWithStatus = foundDevices.map((device) => {
        const mapped = {
          ...device.toJSON(),
          requiresOtp:
            device.uuid === null
              ? false
              : new Date(device.lastActivity).getTime() >
                Date.now() - 12 * 60 * 60 * 1000,
        };
        delete mapped.uuid;
        return mapped;
      });

      res.send(devicesWithStatus);
      log(
        null,
        "/device",
        "GET",
        req.rawBodySize,
        new Blob([JSON.stringify(devicesWithStatus)]).size,
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

router.post("/logout/inactive", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log(
        "Access denied",
        "/device/logout/inactive",
        "POST",
        req.rawBodySize,
        0
      );
      return;
    }

    let uuid;
    if (!(uuid = req.query.uuid)) {
      res.status(403).send("Missing uuid");
      log(
        "Access denied",
        "/device/logout/inactive",
        "POST",
        req.rawBodySize,
        0
      );
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          uuid: uuid,
          userId: user.id,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/logout/inactive",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      await foundDevice.update({ uuid: null });

      res.send("Ok");
      log(null, "/device/logout/inactive", "POST", req.rawBodySize, 0, user.id);
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/logout/inactive", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/logout/inactive",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

router.post("/logout/delete", async (req, res) => {
  try {
    let auth;
    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/device/logout/delete", "POST", req.rawBodySize, 0);
      return;
    }

    let uuid;
    if (!(uuid = req.query.uuid)) {
      res.status(403).send("Missing uuid");
      log("Access denied", "/device/logout/delete", "POST", req.rawBodySize, 0);
      return;
    }

    let user;
    if ((user = await users.findOne({ where: { password: auth } }))) {
      const foundDevice = await devices.findOne({
        where: {
          uuid: uuid,
          userId: user.id,
        },
      });

      if (!foundDevice) {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/device/logout/delete",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
        return;
      }

      await foundDevice.destroy();

      res.send("Ok");
      log(null, "/device/logout/delete", "POST", req.rawBodySize, 0, user.id);
    } else {
      res.status(403).send("Access denied");
      log(null, "/device/logout/delete", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/device/logout/delete",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
    return;
  }
});

module.exports = router;

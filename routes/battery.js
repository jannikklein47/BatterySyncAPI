const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, fn, col } = require("sequelize");

const users = models.User;
const devices = models.Device;
const batterylogs = models.batteryLogs;

const generatePredictions = require("../services/generatePredictions.js");

const router = express.Router();

router.get("/", async (req, res) => {
  console.log("GET /battery");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        let result;
        result = await devices.findAll({
          where: {
            userId: user.id,
          },
          attributes: [
            "name",
            "battery",
            "isShown",
            "chargingStatus",
            "id",
            "type",
            "color",
            "isPluggedIn",
            "predictedZeroAt",
            "favorite",
          ],
          raw: true,
          order: [["favorite", "DESC"]],
        });

        //console.log("Ergebnis von GET: ", result);
        res.send(result);
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});
router.get("/withNotificationInfo", async (req, res) => {
  console.log("GET /battery/withNotificationInfo");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        let result;
        result = await devices.findAll({
          where: {
            userId: user.id,
          },
          attributes: [
            "name",
            "battery",
            "isShown",
            "chargingStatus",
            "id",
            "type",
            "color",
            "isPluggedIn",
            "predictedZeroAt",
            "favorite",
            [
              fn("ARRAY_AGG", col("orderedNotifications.id")),
              "notificationIds",
            ],
          ],

          include: [
            {
              model: models.OrderedNotifications,
              as: "orderedNotifications",
              attributes: [],
            },
          ],
          group: ["Device.id"],
          raw: true,
          order: [["favorite", "DESC"]],
        });

        //console.log("Ergebnis von GET: ", result);
        res.send(result);
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});

router.post("/", async (req, res) => {
  console.log("POST /battery");

  try {
    let auth, name, deviceBattery, chargingStatus, isPluggedIn;

    if (req.body && req.headers.authorization) {
      auth = req.headers.authorization;
      name = req.body.device;
      deviceBattery = req.body.battery;
      chargingStatus =
        req.body.chargingStatus !== undefined
          ? req.body.chargingStatus
          : undefined;
      isPluggedIn =
        req.body.isPluggedIn !== undefined ? req.body.isPluggedIn : undefined;
    } else if (req.query && req.headers.authorization) {
      auth = req.headers.authorization;
      name = req.query.device;
      deviceBattery = req.query.battery;
      chargingStatus =
        req.query.chargingStatus !== undefined
          ? req.query.chargingStatus
          : undefined;
      isPluggedIn =
        req.query.isPluggedIn !== undefined ? req.query.isPluggedIn : undefined;
    }

    name = name.replace("+", " ");

    //console.log();

    let user = await users.findOne({
      where: {
        password: auth,
      },
    });
    //console.log(user);
    if (user) {
      await generatePredictions();

      let device;
      if (
        (device = await devices.findOne({
          where: {
            userId: user.id,
            name: name,
          },
        }))
      ) {
        await devices.update(
          {
            battery: deviceBattery,
            chargingStatus: chargingStatus,
            isPluggedIn: isPluggedIn,
          },
          {
            where: {
              name: name,
              userId: user.id,
            },
          }
        );

        await batterylogs.create({
          battery: deviceBattery,
          chargingStatus: chargingStatus,
          isPluggedIn: isPluggedIn,
          deviceId: device.id,
        });

        if (
          (chargingStatus === "true" ||
            chargingStatus === true ||
            isPluggedIn === "true" ||
            isPluggedIn === true) &&
          device.predictedZeroAt < new Date(Date.now() + 2 * 60 * 60 * 1000)
        ) {
          await models.OrderedNotifications.destroy({
            where: {
              deviceId: device.id,
            },
          });
        }
      } else {
        const newDevice = await devices.create({
          userId: user.id,
          name: name,
          battery: deviceBattery,
          chargingStatus: chargingStatus,
          isPluggedIn: isPluggedIn,
        });

        await batterylogs.create({
          battery: deviceBattery,
          chargingStatus: chargingStatus,
          deviceId: newDevice.id,
          isPluggedIn: isPluggedIn,
        });
      }

      res.send("Ok");
    } else {
      res.status(403).send("Access denied");
      return;
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Error");
  }
});

router.put("/", async (req, res) => {
  console.log("PUT /battery");
  try {
    let auth, name, deviceBattery, chargingStatus, isPluggedIn;

    if (req.body && req.headers.authorization) {
      auth = req.headers.authorization;
      name = req.body.device;
      deviceBattery = req.body.battery;
      chargingStatus = req.body.chargingStatus ? true : false;
      isPluggedIn = req.body.isPluggedIn ? true : false;
    } else if (req.query && req.headers.authorization) {
      auth = req.headers.authorization;
      name = req.query.device;
      deviceBattery = req.query.battery;
      chargingStatus = req.query.chargingStatus ? true : false;
      isPluggedIn = req.query.isPluggedIn ? true : false;
    }

    let updateObject = {
      battery: deviceBattery ? deviceBattery : undefined,
      chargingStatus: chargingStatus,
      isPluggedIn: isPluggedIn,
    };

    name = name.replace("+", " ");

    //console.log();

    let user = await users.findOne({
      where: {
        password: auth,
      },
    });
    //console.log(user);
    if (user) {
      if (
        await devices.findOne({
          where: {
            userId: user.id,
            name: name,
          },
        })
      ) {
        await devices.update(updateObject, {
          where: {
            name: name,
            userId: user.id,
          },
        });
      } else {
        res.status(404).send("No device to update");
        return;
      }

      res.status(200).send("Ok");
    } else {
      res.status(403).send("Access denied");
      return;
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    console.log(error);
  }
});

router.get("/history", async (req, res) => {
  console.log("GET /battery/history");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const name = req.body?.device || req.query?.device;

        let device;

        if (
          (device = await devices.findOne({
            where: {
              userId: user.id,
              name: name,
            },
          }))
        ) {
          // Zeitpunkt 24h zurück
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          // Dein spezifischer Wert
          const targetDeviceId = device.id;

          const result = await batterylogs.findAll({
            where: {
              deviceId: targetDeviceId,
              createdAt: {
                [Op.gte]: twentyFourHoursAgo,
              },
              chargingStatus: { [Op.ne]: null },
              battery: { [Op.ne]: null },
              isPluggedIn: { [Op.ne]: null },
            },
            order: [["createdAt", "DESC"]],
            attributes: [
              "createdAt",
              "chargingStatus",
              "battery",
              "isPluggedIn",
            ],
            raw: true,
          });

          res.send(results);
        } else {
          res.status(404).send("Device not found.");
        }
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});

router.get("/history/all", async (req, res) => {
  console.log("GET /battery/history/all");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const name = req.body?.device || req.query?.device;

        let foundDevices;

        if (
          (foundDevices = await devices.findAll({
            where: {
              userId: user.id,
            },
          }))
        ) {
          console.log(foundDevices, user.id);

          // Zeitpunkt 24h zurück
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          const results = {};

          for (let i in foundDevices) {
            // Dein spezifischer Wert
            const targetDeviceId = foundDevices[i].id;

            const result = await batterylogs.findAll({
              where: {
                deviceId: targetDeviceId,
                createdAt: {
                  [Op.gte]: twentyFourHoursAgo,
                },
                chargingStatus: { [Op.ne]: null },
                battery: { [Op.ne]: null },
                isPluggedIn: { [Op.ne]: null },
              },
              order: [["createdAt", "DESC"]],
              attributes: [
                "createdAt",
                "chargingStatus",
                "battery",
                "isPluggedIn",
              ],
              raw: true,
            });

            if (result.length < 1) continue;

            result.unshift({
              createdAt: Date.now(),
              battery: result[0].battery,
              chargingStatus: result[0].chargingStatus,
              isPluggedIn: result[0].isPluggedIn,
            });

            result.push({
              createdAt: Date.now() - 1000 * 60 * 60 * 24 - 1,
              battery: result[result.length - 1].battery,
              chargingStatus: result[result.length - 1].chargingStatus,
              isPluggedIn: result[result.length - 1].isPluggedIn,
            });

            results[foundDevices[i].id] = result;
          }

          res.send(results);
        } else {
          res.status(404).send("Device not found.");
        }
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});

router.get("/history/all/week", async (req, res) => {
  console.log("GET /battery/history/all/week");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const name = req.body?.device || req.query?.device;

        let foundDevices;

        if (
          (foundDevices = await devices.findAll({
            where: {
              userId: user.id,
            },
          }))
        ) {
          console.log(foundDevices, user.id);

          // Zeitpunkt 24h zurück
          const twentyFourHoursAgo = new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000
          );

          const results = {};

          for (let i in foundDevices) {
            // Dein spezifischer Wert
            const targetDeviceId = foundDevices[i].id;

            const result = await batterylogs.findAll({
              where: {
                deviceId: targetDeviceId,
                createdAt: {
                  [Op.gte]: twentyFourHoursAgo,
                },
                chargingStatus: { [Op.ne]: null },
                battery: { [Op.ne]: null },
                isPluggedIn: { [Op.ne]: null },
              },
              order: [["createdAt", "DESC"]],
              attributes: [
                "createdAt",
                "chargingStatus",
                "battery",
                "isPluggedIn",
              ],
              raw: true,
            });

            if (result.length < 1) continue;

            result.unshift({
              createdAt: Date.now(),
              battery: result[0].battery,
              chargingStatus: result[0].chargingStatus,
              isPluggedIn: result[0].isPluggedIn,
            });

            result.push({
              createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7 - 1,
              battery: result[result.length - 1].battery,
              chargingStatus: result[result.length - 1].chargingStatus,
              isPluggedIn: result[result.length - 1].isPluggedIn,
            });

            results[foundDevices[i].id] = result;
          }

          res.send(results);
        } else {
          res.status(404).send("Device not found.");
        }
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});

router.get("/history/all/fromStart", async (req, res) => {
  console.log("GET /battery/history/all/fromStart");
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const name = req.body?.device || req.query?.device;

        let foundDevices;

        if (
          (foundDevices = await devices.findAll({
            where: {
              userId: user.id,
            },
          }))
        ) {
          // Zeitpunkt 24h zurück
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          const results = {};

          for (let i in foundDevices) {
            // Dein spezifischer Wert
            const targetDeviceId = foundDevices[i].id;

            const result = await batterylogs.findAll({
              where: {
                deviceId: targetDeviceId,
                chargingStatus: { [Op.ne]: null },
                battery: { [Op.ne]: null },
                isPluggedIn: { [Op.ne]: null },
              },
              order: [["createdAt", "DESC"]],
              raw: true,
            });

            result.unshift({
              createdAt: Date.now(),
              battery: result[0].battery,
              chargingStatus: result[0].chargingStatus,
              isPluggedIn: result[0].isPluggedIn,
            });

            result.push({
              createdAt: Date.now() - 1000 * 60 * 60 * 24 - 1,
              battery: result[result.length - 1].battery,
              chargingStatus: result[result.length - 1].chargingStatus,
              isPluggedIn: result[result.length - 1].isPluggedIn,
            });

            results[foundDevices[i].id] = result;
          }

          res.send(results);
        } else {
          res.status(404).send("Device not found.");
        }
      } else {
        res.status(403).send("Access denied");
      }
    } else {
      res.status(403).send("Access denied");
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    console.log(error);
    res.status(500).send("Fehler");
  }
});

module.exports = router;

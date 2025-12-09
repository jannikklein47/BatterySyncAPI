const express = require("express");
const models = require("../models");
const downsampler = require("downsample-lttb");

const log = require("../services/logsystem.js");

const { Op, fn, col } = require("sequelize");

const users = models.User;
const devices = models.Device;
const batterylogs = models.batteryLogs;

const generatePredictions = require("../services/generatePredictions.js");

const router = express.Router();

function downsample(data) {
  const mapped = data.map((entry) => ({
    x: new Date(entry.createdAt).getTime(),
    y: entry.battery * 100,
    //charging: entry.chargingStatus,
  }));

  const standardized = mapped.map((entry) => [entry.x, entry.y]);

  const reduced = downsampler.processData(
    standardized,
    Math.floor(
      Math.sqrt(standardized.length) + 100 / (standardized.length + 10) + 10
    )
    //20,
  );

  return reduced;
}

function debouncePerId(fn, wait) {
  const timers = new Map();

  return function (id, ...args) {
    // If a timer exists for this id, clear it
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
    }

    // Set a new timer for this id
    timers.set(
      id,
      setTimeout(() => {
        fn(id, ...args);
        timers.delete(id); // Clean up
      }, wait)
    );
  };
}

const debouncePrediction = debouncePerId(generatePredictions, 2000);

router.get("/", async (req, res) => {
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
        log(
          null,
          "/battery",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size,
          user.id
        );
      } else {
        res.status(403).send("Access denied");
        log("Access denied", "/battery", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "GET", req.rawBodySize, 0);
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/battery",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});
router.get("/secure", async (req, res) => {
  try {
    if (!req.query.uuid) {
      res.status(403).send("Access denied");
      log("Access denied", "/battery/secure", "GET", req.rawBodySize, 0);
      return;
    }

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

        const fromDevice = await devices.findOne({
          where: {
            userId: user.id,
            uuid: req.query.uuid,
          },
        });

        if (fromDevice) {
          await fromDevice.update({ lastActivity: new Date() });
        }

        //console.log("Ergebnis von GET: ", result);
        res.send(result);
        log(
          null,
          "/battery",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size,
          user.id
        );
      } else {
        res.status(403).send("Access denied");
        log("Access denied", "/battery", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "GET", req.rawBodySize, 0);
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/battery",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});
router.get("/withNotificationInfo", async (req, res) => {
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
            "uuid",
            [
              fn("ARRAY_AGG", col("orderedNotifications.id")),
              "notificationIds",
            ],
          ],

          include: [
            {
              model: models.OrderedNotifications,
              as: "orderedNotifications",
              where: {
                type: "CHARGEREMINDER",
              },
              attributes: [],
              required: false,
            },
          ],
          group: ["Device.id"],
          raw: true,
          order: [["favorite", "DESC"]],
        });

        const processed = [];

        for (const device of result) {
          const isLegacy = device.uuid === null;
          delete device.uuid;

          const permanentNoti = await models.OrderedNotifications.findOne({
            where: {
              deviceId: device.id,
              type: "CHARGEREMINDER",
              permanent: true,
            },
          });

          processed.push({
            ...device,
            permanentNotification: permanentNoti !== null,
            isLegacy: isLegacy,
          });
        }

        //console.log("Ergebnis von GET: ", result);
        res.send(processed);
        log(
          null,
          "/battery/withNotificationInfo",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(processed)]).size,
          user.id
        );
      } else {
        res.status(403).send("Access denied");
        log(
          "Access denied",
          "/battery/withNotificationInfo",
          "GET",
          req.rawBodySize,
          0
        );
      }
    } else {
      res.status(403).send("Access denied");
      log(
        "Access denied",
        "/battery/withNotificationInfo",
        "GET",
        req.rawBodySize,
        0
      );
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Fehler");
    log(
      "Internal Server Error",
      "/battery/withNotificationInfo",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

// This post route is semi-deprecated. It currently is only needed for legacy devices or the macos app. When the MacOS App is finished, we do not need this route anymore (newer is also way more secure)
router.post("/", async (req, res) => {
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

    name = name.replace("+", " ").trim();

    //console.log();

    let user = await users.findOne({
      where: {
        password: auth,
      },
    });
    //console.log(user);
    if (user) {
      let device;
      if (
        (device = await devices.findOne({
          where: {
            userId: user.id,
            name: name,
            uuid: {
              [Op.is]: null,
            },
          },
        }))
      ) {
        if (device.battery !== deviceBattery) {
          await batterylogs.create({
            battery: deviceBattery,
            chargingStatus: chargingStatus,
            isPluggedIn: isPluggedIn,
            deviceId: device.id,
          });
        }

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

        debouncePrediction(device.id);

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
              type: "CHARGEREMINDER",
            },
          });
        }

        res.send("Ok");
        log(null, "/battery", "POST", req.rawBodySize, 0, user.id);
      } else {
        res.status(404).send("Device not found");
        log(
          "Device not found",
          "/battery",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
        /*
        const newDevice = await devices.create({
          userId: user.id,
          name: name.trim(),
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
        */
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Error");
    log(
      "Internal Server Error",
      "/battery",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.post("/secure", async (req, res) => {
  try {
    let auth, uuid, battery, chargingStatus, isPluggedIn;

    if (!(auth = req.headers.authorization)) {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "POST", req.rawBodySize, 0);
      return;
    }
    if (!(uuid = req.query.uuid)) {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "POST", req.rawBodySize, 0);
      return;
    }

    battery = req.query.battery || undefined;
    chargingStatus = req.query.chargingStatus || undefined;
    isPluggedIn = req.query.isPluggedIn || undefined;

    let user = await users.findOne({
      where: {
        password: auth,
      },
    });
    if (user) {
      let device;
      if (
        (device = await devices.findOne({
          where: {
            userId: user.id,
            uuid: uuid,
          },
        }))
      ) {
        await models.sequelize.transaction(async (t) => {
          await device.update(
            {
              battery: battery,
              chargingStatus: chargingStatus,
              isPluggedIn: isPluggedIn,
              lastActivity: new Date(),
            },
            { transaction: t }
          );

          await batterylogs.create(
            {
              battery: device.battery,
              chargingStatus: device.chargingStatus,
              isPluggedIn: device.isPluggedIn,
              deviceId: device.id,
            },
            { transaction: t }
          );

          debouncePrediction(device.id);

          if (
            (device.chargingStatus === "true" ||
              device.chargingStatus === true ||
              device.sPluggedIn === "true" ||
              device.isPluggedIn === true) &&
            device.predictedZeroAt < new Date(Date.now() + 2 * 60 * 60 * 1000)
          ) {
            const deviceOrderedNotifications =
              await models.OrderedNotifications.findAll(
                {
                  where: {
                    deviceId: device.id,
                    type: "CHARGEREMINDER",
                  },
                },
                { transaction: t }
              );

            for (const noti of deviceOrderedNotifications) {
              if (noti.permanent) {
                await models.ScheduledNotifications.destroy(
                  {
                    where: {
                      notificationId: noti.id,
                    },
                  },
                  { transaction: t }
                );
              } else {
                await noti.destroy({ transaction: t });
              }
            }
            await models.OrderedNotifications.destroy(
              {
                where: {
                  deviceId: device.id,
                  type: "CHARGEREMINDER",
                  permanent: {
                    [Op.ne]: true,
                  }, // only destroy the ordered notification if the user wanted it only one time!
                },
              },
              { transaction: t }
            );
          } else if (
            (device.chargingStatus === "false" ||
              device.chargingStatus === false) &&
            (device.sPluggedIn === "false" || device.isPluggedIn === false)
          ) {
            // Does the device have a permanent ordered notification?
            const permanentNoti = await models.OrderedNotifications.findOne(
              {
                where: {
                  deviceId: device.id,
                  permanent: true,
                  type: "CHARGEREMINDER",
                },
              },
              { transaction: t }
            );

            if (permanentNoti) {
              // Re-Create scheduled permanent notifications for the devices that have already displayed them
              const userDevices = await devices.findAll(
                { where: { userId: user.id } },
                { transaction: t }
              );
              //console.log("User devices:", userDevices.length)
              if (userDevices.length > 0) {
                const deviceThatNeedScheduling = userDevices.filter(
                  (dev) => dev.id !== device.id
                );
                //console.log("dev that need sched:", deviceThatNeedScheduling.length)
                for (const dev of deviceThatNeedScheduling) {
                  //console.log("Creating sched entry")

                  const hasScheduled =
                    await models.ScheduledNotifications.findOne(
                      {
                        where: {
                          notificationId: permanentNoti.id,
                          deviceId: dev.id,
                        },
                      },
                      { transaction: t }
                    );

                  if (!hasScheduled) {
                    await models.ScheduledNotifications.create(
                      {
                        deviceId: dev.id,
                        notificationId: permanentNoti.id,
                      },
                      { transaction: t }
                    );
                  }
                }
              }
            }
          }
        });

        res.send("Ok");
        log(null, "/battery/secure", "POST", req.rawBodySize, 0, user.id);
      } else {
        res.status(404).send("Invalid UUID");
        log(
          "Invalid UUID",
          "/battery/secure",
          "POST",
          req.rawBodySize,
          0,
          user.id
        );
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery/secure", "POST", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Error");
    log(
      "Internal Server Error",
      "/battery/secure",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

// Semi-security risk : Users can update battery information of devices with only their ID. As we switch to uuids, this imposes a security risk (id is publicly available, uuid is NOT)
router.put("/", async (req, res) => {
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
        log("Device not found", "/battery", "PUT", req.rawBodySize, 0);
        return;
      }

      res.status(200).send("Ok");
      log(null, "/battery", "PUT", req.rawBodySize, 0, user.id);
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery", "PUT", req.rawBodySize, 0);
      return;
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/battery",
      "PUT",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

// TODO: Add a name PATCH route

// TODO: Add a type PATCH route

router.get("/history", async (req, res) => {
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

          res.send(result);
          log(
            null,
            "/battery/history",
            "GET",
            req.rawBodySize,
            new Blob([JSON.stringify(result)]).size,
            user.id
          );
        } else {
          res.status(404).send("Device not found.");
          log(
            "Device not found",
            "/battery/history",
            "GET",
            req.rawBodySize,
            0,
            user.id
          );
        }
      } else {
        res.status(403).send("Access denied");
        log("Access denied", "/battery/history", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery/history", "GET", req.rawBodySize, 0);
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Fehler");
    log(
      "Internal Server Error",
      "/battery/history",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.get("/history/all", async (req, res) => {
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
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
                createdAt: {
                  [Op.gt]: twentyFourHoursAgo,
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

            const firstOlderThan24Hours = await batterylogs.findOne({
              where: {
                deviceId: targetDeviceId,
                createdAt: {
                  [Op.lte]: twentyFourHoursAgo,
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
            });

            if (firstOlderThan24Hours && result[result.length - 1]) {
              const oldestDate = firstOlderThan24Hours.createdAt;
              const newestDate = result[result.length - 1].createdAt;

              const oldestBattery = Math.round(
                firstOlderThan24Hours.battery * 100
              );
              const newestBattery = Math.round(
                result[result.length - 1].battery * 100
              );
              /*
              console.log(
                "Oldest:",
                oldestDate,
                oldestBattery,
                "Newest:",
                newestDate,
                newestBattery
              );*/

              // calculate slope of linear function PER MINUTE
              const m =
                (newestBattery - oldestBattery) / (newestDate - oldestDate);
              /*
              console.log(
                "Slope per ms:",
                m,
                " per minute:",
                m * 1000 * 60,
                "per hour",
                m * 1000 * 60 * 60
              );*/

              // y-achsenabschnitt
              const b = oldestBattery - m * oldestDate;

              //console.log("Y-axis cut", b);

              const f = (x) => m * x + b;
              /*
              console.log(
                "Interpolated at -24h:",
                f(twentyFourHoursAgo),
                "% or",
                f(twentyFourHoursAgo) / 100
              );*/

              const interpolatedBattery =
                Math.round(f(twentyFourHoursAgo)) / 100;

              result.push({
                createdAt: twentyFourHoursAgo,
                battery: interpolatedBattery,
                chargingStatus: firstOlderThan24Hours.chargingStatus,
                isPluggedIn: firstOlderThan24Hours.isPluggedIn,
              });
            }

            result.unshift({
              createdAt: new Date(),
              battery: foundDevices[i].battery,
              chargingStatus: foundDevices[i].chargingStatus,
              isPluggedIn: foundDevices[i].isPluggedIn,
            });

            /*
            if (result[0]) {
              result.unshift({
                createdAt: Date.now(),
                battery: result[0].battery,
                chargingStatus: result[0].chargingStatus,
                isPluggedIn: result[0].isPluggedIn,
              });
            }

            if (result[result.length - 1]) {
              result.push({
                createdAt: Date.now() - 1000 * 60 * 60 * 24 - 1,
                battery: result[result.length - 1].battery,
                chargingStatus: result[result.length - 1].chargingStatus,
                isPluggedIn: result[result.length - 1].isPluggedIn,
              });
            }
              */

            results[foundDevices[i].id] = downsample(result);
          }

          res.send(results);
          log(
            null,
            "/battery/history/all",
            "GET",
            req.rawBodySize,
            new Blob([JSON.stringify(results)]).size,
            user.id
          );
        } else {
          res.status(404).send("Device not found.");
          log(
            "Device not found",
            "/battery/history/all",
            "GET",
            req.rawBodySize,
            0,
            user.id
          );
        }
      } else {
        res.status(403).send("Access denied");
        log("Access denied", "/battery/history/all", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/battery/history/all", "GET", req.rawBodySize, 0);
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/battery/history/all",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.get("/history/all/week", async (req, res) => {
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

            if (result[0]) {
              result.unshift({
                createdAt: Date.now(),
                battery: result[0].battery,
                chargingStatus: result[0].chargingStatus,
                isPluggedIn: result[0].isPluggedIn,
              });
            }

            if (result[result.length - 1]) {
              result.push({
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7 - 1,
                battery: result[result.length - 1].battery,
                chargingStatus: result[result.length - 1].chargingStatus,
                isPluggedIn: result[result.length - 1].isPluggedIn,
              });
            }

            results[foundDevices[i].id] = downsample(result);
          }

          res.send(results);
          log(
            null,
            "/battery/history/all/week",
            "GET",
            req.rawBodySize,
            new Blob([JSON.stringify(results)]).size,
            user.id
          );
        } else {
          res.status(404).send("Device not found.");
          log(
            "Device not found",
            "/battery/history/all/week",
            "GET",
            req.rawBodySize,
            0
          );
        }
      } else {
        res.status(403).send("Access denied");
        log(
          "Access denied",
          "/battery/history/all/week",
          "GET",
          req.rawBodySize,
          0
        );
      }
    } else {
      res.status(403).send("Access denied");
      log(
        "Access denied",
        "/battery/history/all/week",
        "GET",
        req.rawBodySize,
        0
      );
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/battery/history/all/week",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.get("/history/all/fromStart", async (req, res) => {
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

            if (result[0]) {
              result.unshift({
                createdAt: Date.now(),
                battery: result[0].battery,
                chargingStatus: result[0].chargingStatus,
                isPluggedIn: result[0].isPluggedIn,
              });
            }

            results[foundDevices[i].id] = result;
          }

          res.send(results);
          log(
            null,
            "/battery/history/all/fromStart",
            "GET",
            req.rawBodySize,
            new Blob([JSON.stringify(results)]).size,
            user.id
          );
        } else {
          res.status(404).send("Device not found.");
          log(
            "Device not found",
            "/battery/history/all/week",
            "GET",
            req.rawBodySize,
            0
          );
        }
      } else {
        res.status(403).send("Access denied");
        log(
          "Access denied",
          "/battery/history/all/week",
          "GET",
          req.rawBodySize,
          0
        );
      }
    } else {
      res.status(403).send("Access denied");
      log(
        "Access denied",
        "/battery/history/all/week",
        "GET",
        req.rawBodySize,
        0
      );
    }

    //res.send('{"devices":[{"name":"MacBook Pro", "battery":0.2},{"name":"Iphone von Maya","battery":0.8}]}');
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/battery/history/all/week",
      "GET",
      req.rawBodySize,
      0,

      null,
      error
    );
  }
});

module.exports = router;

const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize } = require("sequelize");

const log = require("../services/logsystem");

const users = models.User;
const devices = models.Device;
const batterylogs = models.batteryLogs;

const router = express.Router();

/**
 * 
 * Returns:
[
    {
        "id": 22,
        "notificationId": 6,
        "deviceId": 8,
        "createdAt": "2025-10-08T17:42:11.692Z",
        "updatedAt": "2025-10-08T17:42:11.692Z",
        "notification": {
            "id": 6,
            "deviceId": 2,
            "createdAt": "2025-10-08T17:42:11.683Z",
            "updatedAt": "2025-10-08T17:42:11.683Z",
            "device": {
                "id": 2,
                "userId": 3,
                "name": "Macbook Pro von Jannik",
                "battery": 0.58,
                "isShown": true,
                "chargingStatus": false,
                "type": "laptop",
                "color": "#4dc900",
                "isPluggedIn": true,
                "predictedZeroAt": "2025-10-08T19:11:54.843Z",
                "createdAt": "2025-06-15T20:05:18.305Z",
                "updatedAt": "2025-10-09T06:12:14.710Z"
            }
        }
    }
]
    With .map(sched => sched.notification.device.name) you can access just the device name from this.
    sched.notification and sched.notification.device will never be null!
 */
router.get("/due", async (req, res) => {
  try {
    let auth = req.headers.authorization;
    let deviceToDisplay = req.query.deviceToDisplay || "";
    if (auth) {
      let user = await users.findOne({ where: { password: auth } });
      if (user) {
        let deviceId = (
          await devices.findOne({
            where: {
              name: deviceToDisplay,
              userId: user.id,
            },
          })
        )?.dataValues.id;
        if (req.query.deviceId) deviceId = req.query.deviceId;

        if (!deviceId) {
          console.error("Notification get due device not found: ", req.query);
          res.status(404).send("Device not found");
          return;
        }

        let scheduledNotificationsToDisplay =
          await models.ScheduledNotifications.findAll({
            where: {
              deviceId: deviceId,
            },
            include: [
              {
                model: models.OrderedNotifications,
                as: "notification",
                required: true,
                where: {
                  type: "CHARGEREMINDER",
                },
                include: [
                  {
                    model: devices,
                    as: "device",
                    where: {
                      predictedZeroAt: {
                        [Op.lte]: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
                      },
                    },
                    required: true,
                  },
                ],
              },
            ],
          });

        let otherNotificationsToDisplay =
          await models.ScheduledNotifications.findAll({
            where: {
              deviceId: deviceId,
            },
            include: [
              {
                model: models.OrderedNotifications,
                as: "notification",
                required: true,
                where: {
                  type: {
                    [Op.notLike]: "CHARGEREMINDER",
                  },
                },
              },
            ],
          });

        const idsToDelete = [
          ...scheduledNotificationsToDisplay.map((sn) => sn.id),
          ...otherNotificationsToDisplay.map((sn) => sn.id),
        ];
        if (idsToDelete.length > 0) {
          await models.sequelize.transaction(async (t) => {
            await models.ScheduledNotifications.destroy(
              {
                where: {
                  id: {
                    [Op.in]: idsToDelete,
                  },
                },
              },
              { transaction: t }
            );
            await models.OrderedNotifications.destroy(
              {
                where: {
                  id: {
                    [Op.notIn]: Sequelize.literal(
                      '(SELECT DISTINCT "notificationId" FROM "ScheduledNotifications")'
                    ),
                  },
                },
              },
              { transaction: t }
            );
          });
        }

        const data = [
          ...scheduledNotificationsToDisplay.map((sched) => {
            return {
              targetName: sched.notification.device.name || "",
              predictedZeroAt: sched.notification.device?.predictedZeroAt || "",
              content: sched.notification.content || "",
              type: sched.notification.type || "",
            };
          }),
          ...otherNotificationsToDisplay.map((sched) => {
            return {
              targetName: "",
              predictedZeroAt: "",
              content: sched.notification.content || "",
              type: sched.notification.type || "",
            };
          }),
        ];

        res.send(data);

        log(
          null,
          "/notification/due",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(data)]).size
        );
      }
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/notification/due",
      "GET",
      req.rawBodySize,
      0,
      error
    );
  }
});
router.post("/new", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    const deviceId = req.body.deviceId;
    let type = "";
    if (!req.body.type) {
      type = "CHARGEREMINDER";
    } else type = req.body.type;

    if (!deviceId && type === "CHARGEREMINDER") {
      res.status(400).send("No device id provided");
      log("Device not found", "/notification/new", "POST", req.rawBodySize, 0);
      return;
    }

    if (auth) {
      await models.sequelize.transaction(async (t) => {
        let user = await users.findOne({ where: { password: auth } });
        if (user) {
          //console.log("Creating new noti order")
          const newOrderedNotification =
            await models.OrderedNotifications.create(
              {
                deviceId: deviceId,
                type: type.toUpperCase(),
                content: req.body.content,
              },
              { transaction: t }
            );
          const userDevices = await devices.findAll(
            { where: { userId: user.id } },
            { transaction: t }
          );
          //console.log("User devices:", userDevices.length)
          if (userDevices.length > 0) {
            const deviceThatNeedScheduling = userDevices.filter(
              (dev) => dev.id !== deviceId
            );
            //console.log("dev that need sched:", deviceThatNeedScheduling.length)
            for (const dev of deviceThatNeedScheduling) {
              //console.log("Creating sched entry")

              await models.ScheduledNotifications.create(
                {
                  deviceId: dev.id,
                  notificationId: newOrderedNotification.id,
                },
                { transaction: t }
              );
            }
          }
          res.send("Ok");
          log(null, "/notification/new", "POST", req.rawBodySize, 0);
        } else {
          res.status(403).send("Access denied");
          log("Access denied", "/notification/new", "POST", req.rawBodySize, 0);
        }
      });
    } else {
      res.status(400).send("No authentication provided");
      log("Access denied", "/notification/new", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/notification/new",
      "POST",
      req.rawBodySize,
      0,
      error
    );
  }
});

router.post("/off", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    const deviceId = req.body.deviceId;
    if (!deviceId) {
      res.status(400).send("No device id provided");
      log("Device not found", "/notification/off", "POST", req.rawBodySize, 0);
      return;
    }

    if (auth) {
      await models.sequelize.transaction(async (t) => {
        let user = await users.findOne({ where: { password: auth } });
        if (user) {
          await models.OrderedNotifications.destroy({
            where: {
              deviceId: deviceId,
              type: "CHARGEREMINDER",
            },
          });

          res.send("Ok");
          log(null, "/notification/off", "POST", req.rawBodySize, 0);
        } else {
          res.status(403).send("Invalid authentication");
          log("Access denied", "/notification/off", "POST", req.rawBodySize, 0);
        }
      });
    } else {
      res.status(400).send("No authentication provided");
      log("Access denied", "/notification/off", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/notification/off",
      "POST",
      req.rawBodySize,
      0,
      error
    );
  }
});

// These routes were to test the system

router.post("/debug", async (req, res) => {
  await devices.update(
    { predictedZeroAt: new Date(Date.now() + 1.5 * 60 * 60 * 1000) },
    { where: { id: 9 } }
  );
});
router.post("/debug2", async (req, res) => {
  res.send(await models.OrderedNotifications.findAll());
  //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
});
router.post("/debug3", async (req, res) => {
  res.send(await models.ScheduledNotifications.findAll());
  //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
});
router.post("/debug4", async (req, res) => {
  res.send(
    await models.ScheduledNotifications.destroy({
      where: { id: { [Op.ne]: -1 } },
    })
  );
  res.send(
    await models.OrderedNotifications.destroy({
      where: { id: { [Op.ne]: -1 } },
    })
  );
  //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
});

module.exports = router;

const express = require("express");
const models = require("../models")
const bcrypt = require("bcrypt")

const { Op } = require('sequelize');

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
router.get('/due', async (req, res) => {
    let auth = req.headers.authorization;
    let deviceToDisplay = req.query.deviceToDisplay || "";
    if (auth) {
        let user = await users.findOne({where: {password: auth}});
        if (user) {

            
            let deviceId = await devices.findOne({where: {
                name: deviceToDisplay,
                userId: user.id
            }})
            if (req.query.deviceId) deviceId = req.query.deviceId

            let scheduledNotificationsToDisplay = await models.ScheduledNotifications.findAll({
                where: {
                    deviceId: deviceId
                },
                include: [
                    {
                        model: models.OrderedNotifications,
                        as: 'notification',
                        required: true,
                        include: [
                            {
                                model: devices,
                                as: 'device',
                                where: {
                                    predictedZeroAt: {
                                        [Op.lte]: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
                                    }
                                },
                                required: true
                            }
                        ]
                    }
                ]
            })

            const idsToDelete = scheduledNotificationsToDisplay.map(sn => sn.id);
            if (idsToDelete.length > 0) {
                await models.ScheduledNotifications.destroy({
                    where: {
                        id: {
                            [Op.in]: idsToDelete
                        }
                    }
                })
            }

            res.send(scheduledNotificationsToDisplay.map(sched => sched.notification.device.name))



        }
    }
})
router.post('/new', async (req, res) => {
    const auth = req.headers.authorization;
    
    const deviceId = req.body.deviceId;
    if (!deviceId) {
        res.status(400).send("No device id provided");
        return;
    }

    if (auth) {
        let user = await users.findOne({where: {password: auth}});
        if (user) {
            //console.log("Creating new noti order")
            const newOrderedNotification = await models.OrderedNotifications.create({
                deviceId: deviceId
            })
            const userDevices = await devices.findAll({where: {userId: user.id}})
            //console.log("User devices:", userDevices.length)
            if (userDevices.length > 0) {
                const deviceThatNeedScheduling = userDevices.filter(dev => dev.id !== deviceId);
                //console.log("dev that need sched:", deviceThatNeedScheduling.length)
                for (const dev of deviceThatNeedScheduling) {
                    //console.log("Creating sched entry")

                    await models.ScheduledNotifications.create({
                        deviceId: dev.id,
                        notificationId: newOrderedNotification.id
                    })
                }
            }
            res.send('Ok');
        } else {
            res.status(403).send("Invalid authentication")
        }
    } else {
        res.status(400).send("No authentication provided")
    }
 
})

// These routes were to test the system

router.post("/debug", async (req, res) => {
    await devices.update({predictedZeroAt: new Date(Date.now() + 1.5 * 60 * 60 * 1000)}, {where: {id: 2}})
})
router.post("/debug2", async (req, res) => {
    res.send(await models.OrderedNotifications.findAll())
    //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
})
router.post("/debug3", async (req, res) => {
    res.send(await models.ScheduledNotifications.findAll())
    //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
})
router.post("/debug4", async (req, res) => {
    res.send(await models.ScheduledNotifications.destroy({where: {id: {[Op.ne]: -1}}}))
    res.send(await models.OrderedNotifications.destroy({where: {id: {[Op.ne]: -1}}}))
    //await devices.update({predictedZeroAt: new Date(Date.now() + 1,5 * 60 * 60 * 1000)}, {where: {id: 2}})
})


module.exports = router
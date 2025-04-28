const express = require("express");
const models = require("../models")
const bcrypt = require("bcrypt")

const users = models.User;
const devices = models.Device;

const router = express.Router();

router.get("/", async (req, res) => {
    console.log("Request received.")
    try {

        if (!(await users.findOne())) {
            await users.create({
                email: "test",
                password: await bcrypt.hash("test", 11),
            })
        }
        if (!(await devices.findOne({
            where: {
                name: "Testgerät"
            }
        }))) {
            await devices.create({
                userId: 2,
                name: "Testgerät",
                battery: 0.47
            })
        }
        let auth;
        if(auth = req.headers.authorization) {
            
            let user;
            if (user = await users.findOne({where: {password: auth}})) {
                let result;
                result = await devices.findAll({
                    where: {
                        userId: user.id
                    },
                    attributes: ["name", "battery", "isShown", "chargingStatus"],
                    raw: true,
                    order: [
                        ["name", "ASC"]
                    ]
                })
                
                
                //console.log("Ergebnis von GET: ", result);
                res.send(result)
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

    try {
        let auth, name, deviceBattery, chargingStatus;
        
        if (req.body && req.headers.authorization) {
            auth = req.headers.authorization
            name = req.body.device;
            deviceBattery = req.body.battery;
            chargingStatus = req.body.chargingStatus !== undefined ? req.body.chargingStatus : undefined

        } else if (req.query && req.headers.authorization){
            auth = req.headers.authorization
            name = req.query.device;
            deviceBattery = req.query.battery;
            chargingStatus = req.query.chargingStatus !== undefined ? req.query.chargingStatus : undefined;
        }

        console.log("Battery POST for ", req.headers.authorization, chargingStatus)
        
        name = name.replace("+", " ");

        //console.log();

        let user = await users.findOne({
            where: {
                password: auth
            }
        })
        //console.log(user);
        if (user) {
            if (await devices.findOne({
                where: {
                    userId: user.id,
                    name: name
                }
            })) {
                await devices.update({
                    battery: deviceBattery,
                    chargingStatus: chargingStatus
                },{
                    where: {
                        name: name,
                        userId: user.id
                    }
                })
            } else {
                await devices.create({
                    userId: user.id,
                    name: name,
                    battery: deviceBattery,
                    chargingStatus: chargingStatus
                })
            }

            res.send("Ok");
        } else {
            res.status(403).send("Access denied");
            return;
        }


        
    } catch (error) {
        console.log(error)
        res.status(500).send("Error");
    }
})

router.put("/", async (req, res) => {
    try {
        let auth, name, deviceBattery, chargingStatus;
        
        if (req.body && req.headers.authorization) {
            auth = req.headers.authorization
            name = req.body.device;
            deviceBattery = req.body.battery;
            chargingStatus = req.body.chargingStatus ? true : false
        } else if (req.query && req.headers.authorization){
            auth = req.headers.authorization
            name = req.query.device;
            deviceBattery = req.query.battery;
            chargingStatus = req.query.chargingStatus ? true : false
        }

        let updateObject = { battery: deviceBattery ? deviceBattery : undefined, chargingStatus: chargingStatus}


        console.log("Battery PUT for ", req.headers.authorization)
        
        name = name.replace("+", " ");

        //console.log();

        let user = await users.findOne({
            where: {
                password: auth
            }
        })
        //console.log(user);
        if (user) {
            if (await devices.findOne({
                where: {
                    userId: user.id,
                    name: name
                }
            })) {
                await devices.update(updateObject,{
                    where: {
                        name: name,
                        userId: user.id
                    }
                })
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
})

module.exports = router;
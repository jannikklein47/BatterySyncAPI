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
                    attributes: ["name", "battery", "isShown"],
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
    console.log("POST: ", req.body)

    try {
        let auth, name, deviceBattery;
        
        if (req.body && req.headers.authorization) {
            auth = req.headers.authorization
            name = req.body.device;
            deviceBattery = req.body.battery;
        } else if (req.query && req.headers.authorization){
            auth = req.headers.authorization
            name = req.query.device;
            deviceBattery = req.query.battery;
        }

        console.log("Battery POST for ", req.headers.authorization)
        
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
                    battery: deviceBattery
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
                    battery: deviceBattery
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

module.exports = router;
const express = require("express");
const models = require("../models")
const bcrypt = require("bcrypt")

const users = models.User;
const devices = models.Device;

const router = express.Router();

router.put("/", async (req, res) => {
    try {
        if (req.headers.authorization && req.body) {
            let user;
            if (user = await users.findOne({where: {password: req.headers.authorization}})) {
                let updated;
                console.log(req.body, user.id)
                if(updated = await devices.update(req.body, {
                    where: {
                        userId: user.id,
                        name: req.body.name
                    }
                })) {
                   // console.log("Device update: ", device)
                    if (updated > 0) {
                        res.status(200).send("Ok")
                    } else {
                        res.status(404).send("Device not found")
                    }
                    
                } else {
                    res.status(400).send("Update failed")
                }
            } else {
                res.status(403).send("Invalid authToke")
            }
        } else {
            res.status(400).send("No authToken included")
        }
    } catch (error) {
        console.log("Update device error: ", error)
        res.status(500).send("Internal server error")
    }
})

router.delete("/", async (req, res) => {
    try {
        let user;
        if (user = await users.findOne({where: {password: req.headers.authorization}})) {
            let deleted = await devices.destroy({where: {name: req.body.name, userId: user.id}})
            if (deleted > 0) {
                res.send("Ok")
            } else {
                res.status(404).send("Device not found")
            }
            
        } else {
            res.status(403).send("Invalid authToken")
        }
    } catch (error) {
        console.log("Error deleting device: ", error);
        res.status(500).send("Internal server error");
    }
})

module.exports = router
const express = require("express");
const models = require("../models")
const bcrypt = require("bcrypt")

const { Op } = require('sequelize');

const AppInfos = models.AppInfos
const Users = models.User
const router = express.Router();


router.get("/", async (req, res) => {
    try {
        const auth = req.headers.authorization
        const user = await Users.findOne({where: {password: auth}})
        if (user) {
            const currentInfo = await AppInfos.findOne({order: [['id', 'DESC']]})
            res.send(currentInfo)
        } else {
            res.status(403).send("Invalid access token")
        }
    } catch (error) {
        console.error(error)
        res.status(500).send("Internal Server Error")
    }
})

router.post("/", async (req, res) => {
    try {
        const access = req.headers.adminCode
        if (access === process.env.adminCode) {

            let recent = await AppInfos.findOne({attributes: { exclude: ['createdAt', 'updatedAt']},order: [['id', 'DESC']]})
            recent = recent.dataValues
            delete recent.id
            
            console.log("Recent:", recent)
            
            console.log("Create:", {...recent.dataValues, ...req.body})

            await AppInfos.create({...recent.dataValues, ...req.body})
            res.status(200).send("Ok")

        } else res.status(403).send("Access denied")
    } catch (error) {
        console.error(error)
        res.status(500).send("Internal Server Error")
    }
})

module.exports = router
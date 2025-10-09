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
        const user = Users.findOne({where: {password: auth}})
        if (user) {
            const currentInfo = AppInfos.findAll({order: [['id', 'DESC']]})[0]
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

            const recent = await AppInfos.findAll({order: [["id", "DESC"]]})[0]

            console.log("Recent:", recent)
            console.log("Create:", {...req.body, ...recent})

            await AppInfos.create({...req.body, ...recent})
            res.status(200).send("Ok")

        } else res.status(403).send("Access denied")
    } catch (error) {
        console.error(error)
        res.status(500).send("Internal Server Error")
    }
})

module.exports = router
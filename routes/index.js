const express = require("express");
const router = express.Router();

const login = require("./login.js")
const battery = require("./battery.js")
const device = require("./device.js")
const notification = require("./notification.js")

router.use("/battery", battery);
router.use("/login", login)
router.use("/device", device)
router.use("/notification", notification)

module.exports = router;
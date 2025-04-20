const express = require("express");
const router = express.Router();

const login = require("./login.js")
const battery = require("./battery.js")
const device = require("./device.js")

router.use("/battery", battery);
router.use("/login", login)
router.use("/device", device)

module.exports = router;
const express = require("express");
const router = express.Router();

const login = require("./login.js");
const battery = require("./battery.js");
const device = require("./device.js");
const notification = require("./notification.js");
const appinfo = require("./appinfo.js");
const metrics = require("./metrics.js");
const issue = require("./issue.js");
const prediction = require("./prediction.js");

const file = require("./file.js");

router.use("/battery", battery);
router.use("/login", login);
router.use("/device", device);
router.use("/notification", notification);
router.use("/appinfo", appinfo);
router.use("/metrics", metrics);
router.use("/issue", issue);
router.use("/file", file);
router.use("/prediction", prediction);

module.exports = router;

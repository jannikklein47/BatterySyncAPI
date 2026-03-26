const express = require("express");
const router = express.Router();

const { verifyToken } = require("../../utils/auth");

// Neue Routen
const getLogin = require("./login/getLogin.js");
const postLogin = require("./login/postLogin.js");
const patchLogin = require("./login/patchLogin.js");

const getBattery = require("./battery/getBattery.js");
const postBattery = require("./battery/postBattery.js");

const getDevice = require("./device/getDevice.js");
const postDevice = require("./device/postDevice.js");
const patchDevice = require("./device/patchDevice.js");
const deleteDevice = require("./device/deleteDevice.js");

const getIssue = require("./issue/getIssue.js");
const postIssue = require("./issue/postIssue.js");
const putIssue = require("./issue/putIssue.js");
const patchIssue = require("./issue/patchIssue.js");
const deleteIssue = require("./issue/deleteIssue.js");

const getNotification = require("./notification/getNotification.js");
const postNotification = require("./notification/postNotification.js");

const getAppInfo = require("./appInfo/getAppInfo.js");
const postAppInfo = require("./appInfo/postAppInfo.js");
const deleteAppInfo = require("./appInfo/deleteAppInfo.js");

const getFile = require("./file/getFile.js");

const getMetric = require("./metric/getMetric.js");

const postSQL = require("./sql/postSQL.js");

router.use("/login", postLogin, verifyToken(), getLogin, patchLogin);

router.use("/battery", verifyToken(), getBattery, postBattery);

router.use(
  "/device",
  verifyToken(),
  getDevice,
  postDevice,
  patchDevice,
  deleteDevice,
);

router.use("/notification", verifyToken(), getNotification, postNotification);

router.use("/appInfo", getAppInfo, verifyToken(), postAppInfo, deleteAppInfo);

router.use("/file", getFile);

router.use("/metrics", verifyToken(), getMetric);

router.use(
  "/issue",
  verifyToken("optional"),
  getIssue,
  verifyToken(),
  postIssue,
  putIssue,
  patchIssue,
  deleteIssue,
);

router.use("/sql", verifyToken(), postSQL);

//

router.use("/debug", async (req, res) => {
  res.send("Ok");
});
/*
// Protected routes
router.use("/battery", verifyToken(), battery);
router.use("/device", device);
router.use("/notification", verifyToken(), notification);
router.use("/appinfo", verifyToken(), appinfo);
router.use("/metrics", verifyToken(), metrics);
router.use("/issue", verifyToken(), issue);
router.use("/prediction", verifyToken(), prediction);
router.use("/sql", sql);
*/

module.exports = router;

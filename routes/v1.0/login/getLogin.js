const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const UserService = require("../../../services/user");
const router = express.Router();

router.get("/auth", async (req, res, next) => {
  try {
    res.send(req.user.email);
  } catch (error) {
    return next(error);
  }
});

router.get("/auth/web", async (req, res, next) => {
  try {
    const user = JSON.parse(JSON.stringify(req.user));
    delete user.password;
    res.send({ email: user.email, data: user });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", async (req, res, next) => {
  try {
    res.send(req.user.admin);
  } catch (error) {
    return next(error);
  }
});

router.get("/userId", async (req, res, next) => {
  try {
    res.send(req.user.id);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

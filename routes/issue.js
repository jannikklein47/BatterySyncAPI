const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize } = require("sequelize");

const Issue = models.issue;
const Users = models.User;
const Notifications = models.OrderedNotifications;
const router = express.Router();

const log = require("../services/logsystem");

async function sendUpdateNotification(content, user) {
  await models.sequelize.transaction(async (t) => {
    //console.log("Creating new noti order")

    const userDevice = await models.Device.findOne({
      where: {
        userId: user.id,
      },
    });

    if (!userDevice) {
      console.log("NO USER DEVICE FOUND TO APPEND NOTIFICATION TO");
    }

    const newOrderedNotification = await Notifications.create(
      {
        deviceId: userDevice.id,
        type: "CONTENT",
        content: content,
      },
      { transaction: t }
    );
    const userDevices = await models.Device.findAll(
      { where: { userId: user.id } },
      { transaction: t }
    );

    for (const dev of userDevices) {
      //console.log("Creating sched entry")

      await models.ScheduledNotifications.create(
        {
          deviceId: dev.id,
          notificationId: newOrderedNotification.id,
        },
        { transaction: t }
      );
    }
  });
}

router.get("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const result = await Issue.findAll({
        where: {
          archived: false,
        },
        order: [
          // 1. Put status === 2 at the bottom
          [Sequelize.literal(`CASE WHEN status = 2 THEN 1 ELSE 0 END`), "ASC"],

          // 2. Then sort everything by newest updated first
          ["updatedAt", "DESC"],
        ],
      });
      res.send(result);
      log(
        null,
        "/issue",
        "GET",
        req.rawBodySize,
        new Blob([JSON.stringify(result)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "GET", req.rawBodySize, 0, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const data = req.body;
    delete data.id;
    delete data.userId;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const created = await Issue.create({ ...data, userId: user.id });

      res.send(created);

      sendUpdateNotification(
        "Eingangsbestätigung: dein Issue " +
          created.title.substring(0, 30) +
          "...' ist erfolgreich eingegangen.",
        user
      );
      log(
        null,
        "/issue",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "POST", req.rawBodySize, 0, error);
  }
});

router.patch("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const data = req.body;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const issue = await Issue.findByPk(data.id);
      delete data.id;
      await issue.update(data);

      res.send(issue);

      sendUpdateNotification(
        "Update: '" +
          issue.title.substring(0, 30) +
          "...' ist nun " +
          (issue.status === 0
            ? "nicht in Bearbeitung."
            : issue.status === 1
            ? "in Bearbeitung."
            : issue.status === 2
            ? "umgesetzt worden. Vielen Dank für dein Feedback!"
            : " aktiv."),
        user
      );
      log(
        null,
        "/issue",
        "PATCH",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "PATCH", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "PATCH", req.rawBodySize, 0, error);
  }
});

router.delete("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const id = req.query.id;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const toDelete = await Issue.findByPk(id);
      await toDelete.update({ archived: true });

      res.send(toDelete);
      sendUpdateNotification(
        "Dein Issue '" +
          toDelete.title.substring(0, 30) +
          "...' wurde von einem Entwickler archiviert.",
        user
      );
      log(
        null,
        "/issue",
        "DELETE",
        req.rawBodySize,
        new Blob([JSON.stringify(toDelete)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "DELETE", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "DELETE", req.rawBodySize, 0, error);
  }
});

module.exports = router;

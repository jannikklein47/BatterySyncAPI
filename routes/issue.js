const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op, Sequelize, where } = require("sequelize");

const Issue = models.issue;
const Users = models.User;
const Notifications = models.OrderedNotifications;
const router = express.Router();

const log = require("../services/logsystem");

async function sendUpdateNotification(title, content, userId) {
  await models.sequelize.transaction(async (t) => {
    //console.log("Creating new noti order")

    const userDevice = await models.Device.findOne(
      {
        where: {
          userId: userId,
        },
      },
      { transaction: t }
    );

    if (!userDevice) {
      return;
    }

    const newOrderedNotification = await Notifications.create(
      {
        deviceId: userDevice.id,
        type: "CONTENT",
        content: content,
        title: title,
      },
      { transaction: t }
    );
    const userDevices = await models.Device.findAll(
      { where: { userId: userId } },
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
    const auth = req.headers.authorization || "";
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const result = await Issue.findAll({
        where: {
          archived: false,
        },
        include: {
          model: models.User,
          attributes: ["email"],
          as: "user",
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
        new Blob([JSON.stringify(result)]).size,
        user.id
      );
    } else {
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
        new Blob([JSON.stringify(result)]).size,
        user.id
      );
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/issue",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const data = req.body;
    delete data.id;
    delete data.userId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.status;
    delete data.archived;

    let user;
    if (auth) {
      user = await Users.findOne({ where: { password: auth } });
    } else user = null;

    if (user) {
      const created = await Issue.create(
        { ...data, userId: user.id },
        {
          include: [
            {
              model: models.User,
              attributes: ["email"],
              as: "user",
            },
          ],
        }
      );

      res.send(created);

      sendUpdateNotification(
        "Eingangsbestätigung",
        'Dein Issue "' + created.title + '" ist erfolgreich eingegangen.',
        created.userId
      );

      if (req.body.notify) {
        const admin = await Users.findOne({ where: { admin: true } });
        sendUpdateNotification(
          "Kritisches Problem",
          "'" + created.title + "' erfordert deine Aufmerksamkeit.",
          admin.id
        );
      }

      log(
        null,
        "/issue",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size,
        user.id
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/issue",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
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
        "Issue Update",
        'Dein Issue "' +
          issue.title +
          '" ist nun ' +
          (issue.status === 0
            ? "nicht mehr in Bearbeitung."
            : issue.status === 1
            ? "in Bearbeitung."
            : issue.status === 2
            ? "umgesetzt worden. Vielen Dank für dein Feedback!"
            : " aktiv."),
        issue.userId
      );
      log(
        null,
        "/issue",
        "PATCH",
        req.rawBodySize,
        new Blob([JSON.stringify(issue)]).size,
        user.id
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "PATCH", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/issue",
      "PATCH",
      req.rawBodySize,
      0,
      null,
      error
    );
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
        "Issue Update",
        'Dein Issue "' +
          toDelete.title.substring(0, 30) +
          '" wurde von einem Entwickler archiviert.',
        toDelete.userId
      );
      log(
        null,
        "/issue",
        "DELETE",
        req.rawBodySize,
        new Blob([JSON.stringify(toDelete)]).size,
        user.id
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "DELETE", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/issue",
      "DELETE",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

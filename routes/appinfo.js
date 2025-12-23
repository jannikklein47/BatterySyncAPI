const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op } = require("sequelize");

const AppInfos = models.AppInfos;
const Users = models.User;
const router = express.Router();
const log = require("../services/logsystem");

router.get("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const currentInfo = await AppInfos.findOne({
        order: [["id", "DESC"]],
        attributes: { exclude: ["createdAt", "updatedAt"] },
      });
      res.send(currentInfo);
    } else {
      res.status(403).send("Invalid access token");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/", async (req, res) => {
  try {
    const access = req.headers.adminCode;
    if (access === process.env.adminCode) {
      let recent = await AppInfos.findOne({
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["id", "DESC"]],
      });
      recent = recent.dataValues;
      delete recent.id;

      await AppInfos.create({ ...recent, ...req.body });
      res.status(200).send("Ok");
    } else res.status(403).send("Access denied");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/syncs", async (req, res) => {
  try {
    const now = new Date();

    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(now.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayDurationMs = yesterdayEnd - yesterdayStart + 1;

    const countBeforeYesterday = await models.logs.count({
      where: {
        createdAt: {
          [Op.lt]: yesterdayStart,
        },
        text: {
          [Op.is]: null,
        },
      },
    });

    const countYesterday = await models.logs.count({
      where: {
        createdAt: {
          [Op.between]: [yesterdayStart, yesterdayEnd],
        },
        text: {
          [Op.is]: null,
        },
      },
    });

    const ratePerMs = countYesterday / yesterdayDurationMs;

    const result = {
      val: countBeforeYesterday,
      date: yesterdayStart,
      growth: ratePerMs,
    };

    res.send(result);

    log(
      null,
      "/appinfo/syncs",
      "GET",
      req.rawBodySize,
      new Blob([JSON.stringify(result)]).size
    );
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/appinfo/syncs",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

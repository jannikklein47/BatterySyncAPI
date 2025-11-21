const express = require("express");
const models = require("../models");
const users = models.User;
const sequelize = models.sequelize;
const { QueryTypes } = require("sequelize");

const log = require("../services/logsystem");

const logs = models.logs;

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        let result = {};
        const requestCounts = await sequelize.query(
          `
        SELECT
          DATE_TRUNC('minute', "createdAt") - 
          MOD(EXTRACT(MINUTE FROM "createdAt")::int, 30) * INTERVAL '1 minute'
            AS interval_start,
          method,
          COUNT(*) AS count
        FROM logs
        GROUP BY interval_start, method
        ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT }
        );

        const responseSizes = await sequelize.query(
          `
        SELECT
          DATE_TRUNC('minute', "createdAt") - 
            MOD(EXTRACT(MINUTE FROM "createdAt")::int, 30) * INTERVAL '1 minute'
              AS interval_start,
          SUM("resSize") AS total_res_size
        FROM logs
        GROUP BY interval_start
        ORDER BY interval_start ASC;
      `,
          { type: QueryTypes.SELECT }
        );

        const errorCounts = await sequelize.query(
          `
      SELECT
        DATE_TRUNC('minute', "createdAt") - 
          MOD(EXTRACT(MINUTE FROM "createdAt")::int, 30) * INTERVAL '1 minute'
            AS interval_start,
        COUNT(*) AS error_count
      FROM logs
      WHERE error IS NOT NULL
      GROUP BY interval_start
      ORDER BY interval_start ASC;`,
          { type: QueryTypes.SELECT }
        );

        const blockedCounts = await sequelize.query(
          `
          SELECT
            DATE_TRUNC('minute', "createdAt") - 
              MOD(EXTRACT(MINUTE FROM "createdAt")::int, 30) * INTERVAL '1 minute'
                AS interval_start,
            COUNT(*) AS text_present_count
          FROM logs
          WHERE text IS NOT NULL
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT }
        );

        const successCounts = await sequelize.query(
          `
      SELECT
        DATE_TRUNC('minute', "createdAt") - 
          MOD(EXTRACT(MINUTE FROM "createdAt")::int, 30) * INTERVAL '1 minute'
            AS interval_start,
        COUNT(*) AS text_missing_count
      FROM logs
      WHERE text IS NULL
      GROUP BY interval_start
      ORDER BY interval_start ASC;
    `,
          { type: QueryTypes.SELECT }
        );

        result = {
          requestCounts,
          responseSizes,
          errorCounts,
          blockedCounts,
          successCounts,
        };
        res.send(result);
        log(
          _,
          "/metrics",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size
        );
      } else {
        res.status(403).send("Access denied");
        log("Access denied", "/metrics", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/metrics", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/metrics", "GET", req.rawBodySize, 0, error);
  }
});

router.get("/raw", async (req, res) => {
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const result = await logs.findAll();
        res.send(result);
      }
    } else {
      res.status(403).send("Access denied");
    }
  } catch (error) {}
});

module.exports = router;

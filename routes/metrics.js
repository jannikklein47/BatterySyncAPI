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
    if (
      req.query.key !== process.env.ADMIN_ACCESS &&
      req.query.key !== process.env.API_USAGE_KEY
    ) {
      res.status(403).send("Access denied");
      log("Access denied", "/metrics", "GET", req.rawBodySize, 0);
      return;
    }

    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        let result = {};

        let timeframe = req.query.timeframe || "1 day";
        let interval = req.query.intervalMinutes || "30";
        let cumulate = req.query.cumulate || "minute";

        const requestCounts = await sequelize.query(
          `
        SELECT
          DATE_TRUNC(':cumulate', "createdAt") - 
          MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
            AS interval_start,
          method,
          COUNT(*) AS count
        FROM logs
        WHERE "createdAt" >= NOW() - INTERVAL :timeframe
        GROUP BY interval_start, method
        ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const responseSizes = await sequelize.query(
          `
        SELECT
          DATE_TRUNC(':cumulate', "createdAt") - 
            MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
              AS interval_start,
          SUM("resSize") AS count
        FROM logs
        WHERE "createdAt" >= NOW() - INTERVAL :timeframe
        GROUP BY interval_start
        ORDER BY interval_start ASC;
      `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const requestSizes = await sequelize.query(
          `
        SELECT
          DATE_TRUNC(':cumulate', "createdAt") - 
            MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
              AS interval_start,
          SUM("reqSize") AS count
        FROM logs
        WHERE "createdAt" >= NOW() - INTERVAL :timeframe
        GROUP BY interval_start
        ORDER BY interval_start ASC;
      `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const errorCounts = await sequelize.query(
          `
      SELECT
        DATE_TRUNC(':cumulate', "createdAt") - 
          MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
            AS interval_start,
        COUNT(*) AS count
      FROM logs
      WHERE error IS NOT NULL
      AND "createdAt" >= NOW() - INTERVAL :timeframe
      GROUP BY interval_start
      ORDER BY interval_start ASC;`,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const blockedCounts = await sequelize.query(
          `
          SELECT
            DATE_TRUNC(':cumulate', "createdAt") - 
              MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
                AS interval_start,
            COUNT(*) AS count
          FROM logs
          WHERE text IS NOT NULL
          AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const successCounts = await sequelize.query(
          `
      SELECT
        DATE_TRUNC(':cumulate', "createdAt") - 
          MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
            AS interval_start,
        COUNT(*) AS count
      FROM logs
      WHERE text IS NULL
      AND "createdAt" >= NOW() - INTERVAL :timeframe
      GROUP BY interval_start
      ORDER BY interval_start ASC;
    `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const routeUsage = await sequelize.query(
          `
          SELECT
            route,
            DATE_TRUNC(':cumulate',"createdAt") - 
              MOD(EXTRACT(:cumulate FROM "createdAt")::int, :interval) * INTERVAL '1 :cumulate'
              AS interval_start,
            COUNT(*) AS count
          FROM logs
          WHERE route IS NOT NULL
          AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY route, interval_start
          ORDER BY route, interval_start;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        const getRouteUsage = async () => {
          const rows = routeUsage;

          const result = {};

          for (const row of rows) {
            const route = row.route;

            if (!result[route]) {
              result[route] = [];
            }

            result[route].push({
              interval_start: row.interval_start,
              count: row.count,
            });
          }

          return result;
        };

        const perRouteUsage = await getRouteUsage();

        result = {
          requestCounts,
          responseSizes,
          requestSizes,
          errorCounts,
          blockedCounts,
          successCounts,
          ...perRouteUsage,
        };
        res.send(result);
        log(
          null,
          "/metrics",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size,
          user.id
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
    log(
      "Internal Server Error",
      "/metrics",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
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
        log(
          null,
          "/metrics/raw",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size,
          user.id
        );
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/metrics/raw", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/metrics/raw",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

const express = require("express");
const models = require("../models");
const users = models.User;
const sequelize = models.sequelize;
const { QueryTypes, Op } = require("sequelize");

const log = require("../services/logsystem");

const logs = models.logs;

const router = express.Router();

// Helper to make "172800 seconds" look like "2d 0h"
function formatDuration(seconds) {
  if (!seconds) return "0h";
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// stats.service.js

/**
 * Calculates the user's activity percentile based on the "logs" table.
 * Filter: text IS NULL and grouped by userId.
 */
async function getUserPercentile(targetUserId) {
  const query = `
    WITH UserActivity AS (
      -- 1. Count logs where text is null for every user
      SELECT 
        "userId", 
        COUNT("id") as "activityCount"
      FROM "logs"
      WHERE "text" IS NULL
      GROUP BY "userId"
    ),
    RankedUsers AS (
      -- 2. Calculate the percentile rank
      -- PERCENT_RANK returns a value from 0 to 1
      SELECT 
        "userId",
        PERCENT_RANK() OVER (ORDER BY "activityCount" ASC) as "rawPercentile"
      FROM UserActivity
    )
    -- 3. Get the rank for the specific user
    SELECT "rawPercentile"
    FROM RankedUsers
    WHERE "userId" = :targetUserId;
  `;

  try {
    const result = await sequelize.query(query, {
      replacements: { targetUserId },
      type: QueryTypes.SELECT,
    });

    if (!result || result.length === 0) {
      // If the user has 0 logs matching the criteria
      return "Top 100%";
    }

    const percentile = result[0].rawPercentile;

    // Logic: If percentile is 0.99 (better than 99% of people),
    // it becomes (1 - 0.99) * 100 = 1%.
    const topPercentage = Math.max(1, Math.round((1 - percentile) * 100));

    return `Top ${topPercentage}%`;
  } catch (error) {
    console.error("Database error in getUserPercentile:", error);
    return "Top 100%";
  }
}

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
        let interval = req.query.interval || "30 minutes";

        const timeBucket = `
          (
            to_timestamp(
              floor(
                extract(epoch from "createdAt")
                / extract(epoch from :interval::interval)
              ) * extract(epoch from :interval::interval)
            )
          ) AS interval_start
        `;

        // -----------------------------------------------------
        // Request Counts
        // -----------------------------------------------------
        const requestCounts = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            method,
            COUNT(*) AS count
          FROM logs
          WHERE "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start, method
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Response Sizes
        // -----------------------------------------------------
        const responseSizes = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            SUM("resSize") AS count
          FROM logs
          WHERE "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Request Sizes
        // -----------------------------------------------------
        const requestSizes = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            SUM("reqSize") AS count
          FROM logs
          WHERE "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Error Counts
        // -----------------------------------------------------
        const errorCounts = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            COUNT(*) AS count
          FROM logs
          WHERE error IS NOT NULL
            AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Blocked Counts
        // -----------------------------------------------------
        const blockedCounts = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            COUNT(*) AS count
          FROM logs
          WHERE text IS NOT NULL
            AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Success Counts
        // -----------------------------------------------------
        const successCounts = await sequelize.query(
          `
          SELECT
            ${timeBucket},
            COUNT(*) AS count
          FROM logs
          WHERE text IS NULL
            AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY interval_start
          ORDER BY interval_start ASC;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // Route Usage
        // -----------------------------------------------------
        const routeUsage = await sequelize.query(
          `
          SELECT
            route,
            ${timeBucket},
            COUNT(*) AS count
          FROM logs
          WHERE route IS NOT NULL
            AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY route, interval_start
          ORDER BY route, interval_start;
        `,
          { type: QueryTypes.SELECT, replacements: { interval, timeframe } }
        );

        // -----------------------------------------------------
        // User Id Usage
        // -----------------------------------------------------
        const userIdUsage = await sequelize.query(
          `
          SELECT
            logs."userId",
            ${timeBucket},
            COUNT(*) AS count
          FROM logs
          WHERE logs."userId" IS NOT NULL
            AND "createdAt" >= NOW() - INTERVAL :timeframe
          GROUP BY logs."userId", interval_start
          ORDER BY logs."userId", interval_start;
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

        const getUserIdUsage = async () => {
          const rows = userIdUsage;

          const result = {};

          for (const row of rows) {
            const userId = row.userId;

            if (!result["total_userId-" + userId]) {
              result["total_userId-" + userId] = [];
            }

            result["total_userId-" + userId].push({
              interval_start: row.interval_start,
              count: row.count,
            });
          }

          return result;
        };

        const perRouteUsage = await getRouteUsage();
        const perUserIdUsage = await getUserIdUsage();

        result = {
          requestCounts,
          responseSizes,
          requestSizes,
          errorCounts,
          blockedCounts,
          successCounts,
          ...perRouteUsage,
          ...perUserIdUsage,
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
    console.error(error);
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

router.get("/userStats", async (req, res) => {
  try {
    let auth;
    if ((auth = req.headers.authorization)) {
      let user;
      if ((user = await users.findOne({ where: { password: auth } }))) {
        const devices = await models.Device.findAll({
          where: { userId: user.id },
          attributes: ["id", "name"],
          raw: true,
        });

        if (devices.length === 0) {
          return {
            totalSyncs: 0,
            totalCharges: 0,
            longestWithoutCharge: { durationHours: 0, deviceName: "N/A" },
          };
        }

        const deviceIds = devices.map((d) => d.id);

        const totalSyncs = await logs.count({
          where: {
            userId: user.id,
            text: {
              [Op.is]: null,
            },
          },
        });

        // --- STAT 2: Total Charges (Complex: State Change Detection) ---
        // We look for rows where chargingStatus IS TRUE and the PREVIOUS row was FALSE
        const chargeCountQuery = `
          SELECT COUNT(*) as "chargeCount"
          FROM (
            SELECT 
              "chargingStatus",
              LAG("chargingStatus") OVER (PARTITION BY "deviceId" ORDER BY "createdAt") as "prevStatus"
            FROM "batteryLogs"
            WHERE "deviceId" IN (:deviceIds)
          ) as subquery
          WHERE "chargingStatus" = true AND ("prevStatus" = false OR "prevStatus" IS NULL);
        `;

        const totalChargesResult = await sequelize.query(chargeCountQuery, {
          replacements: { deviceIds },
          type: QueryTypes.SELECT,
        });

        const totalCharges = parseInt(totalChargesResult[0].chargeCount, 10);

        // --- STAT 3: Longest Period Without Charging (Complex: Time Gap) ---
        // We find 'islands' of consecutive non-charging logs and calculate the time diff between the start and end of that island.
        // Note: This approximates by taking the difference between min and max timestamp of a non-charging sequence.

        const longestPeriodQuery = `
          WITH Gaps AS (
            SELECT 
              "deviceId",
              "createdAt",
              "chargingStatus",
              -- Create a grouping ID that changes every time chargingStatus changes
              SUM(CASE WHEN "chargingStatus" = true THEN 1 ELSE 0 END) 
              OVER (PARTITION BY "deviceId" ORDER BY "createdAt") as "grp"
            FROM "batteryLogs"
            WHERE "deviceId" IN (:deviceIds)
          ),
          Durations AS (
            SELECT 
              "deviceId",
              MIN("createdAt") as "startTime",
              MAX("createdAt") as "endTime",
              EXTRACT(EPOCH FROM (MAX("createdAt") - MIN("createdAt"))) as "durationSeconds"
            FROM Gaps
            WHERE "chargingStatus" = false -- We only care about discharging periods
            GROUP BY "deviceId", "grp"
          )
          SELECT 
            "deviceId", 
            "durationSeconds"
          FROM Durations
          ORDER BY "durationSeconds" DESC
          LIMIT 1;
        `;

        const longestPeriodResult = await sequelize.query(longestPeriodQuery, {
          replacements: { deviceIds },
          type: QueryTypes.SELECT,
        });

        // Format the result for the frontend
        let longestStat = { durationSeconds: 0, deviceName: "None" };

        if (longestPeriodResult.length > 0) {
          const winner = longestPeriodResult[0];
          const winningDevice = devices.find((d) => d.id === winner.deviceId);

          longestStat = {
            durationSeconds: parseFloat(winner.durationSeconds),
            deviceName: winningDevice ? winningDevice.name : "Unknown Device",
            formatted: formatDuration(winner.durationSeconds),
          };
        }

        const communityRank = await getUserPercentile(user.id);

        const result = {
          totalSyncs,
          totalCharges,
          longestWithoutCharge: longestStat,
          communityRank,
        };

        res.send(result);

        log(
          null,
          "/metrics/userStats",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(result)]).size,
          user.id
        );
      }
    } else {
      res.status(403).send("Access denied");
      log("Access denied", "/metrics/userStats", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/metrics/userStats",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

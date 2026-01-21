const models = require("../models");
const { Op, fn, col, QueryTypes } = require("sequelize");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const sequelize = models.sequelize;

const NotificationService = require("./notification");
const DeviceService = require("./device");

const GeneralUtils = require("../utils/general");

/**
 * Returns the percentile rank of a user based on the count of logs where text is null.
 * The result is a string in the format "Top X%"
 * If the user has 0 logs matching the criteria, the result is "Top 100%"
 * If there is a database error, the result is also "Top 100%"
 * @param {number} targetUserId - The userId to calculate the percentile rank for
 * @returns {string} - The percentile rank of the user as a string in the format "Top X%"
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

/**
 * Retrieves API usage metrics for a given timeframe and interval.
 * The result is an object with the following properties:
 * - requestCounts: An array of objects containing the request count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - responseSizes: An array of objects containing the total response size for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - requestSizes: An array of objects containing the total request size for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - errorCounts: An array of objects containing the error count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - blockedCounts: An array of objects containing the blocked count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - successCounts: An array of objects containing the success count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - perRouteUsage: An object containing the route usage metrics, with each key being the route name and the value being an array of objects containing the request count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * - perUserIdUsage: An object containing the user ID usage metrics, with each key being the user ID and the value being an array of objects containing the request count for each interval, in the format { interval_start: <timestamp>, count: <number> }
 * @param {string} [timeframe="1 day"] - The timeframe to retrieve metrics for
 * @param {string} [interval="30 minutes"] - The interval to group metrics by
 * @returns {Promise<Object>} - An object containing the API usage metrics
 */
async function getApiUsage(timeframe = "1 day", interval = "30 minutes") {
  let result = {};

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

  return result;
}

module.exports = { getUserPercentile, getApiUsage };

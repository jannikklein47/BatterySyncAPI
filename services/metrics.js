const models = require("../models");
const { Op, fn, col, QueryTypes } = require("sequelize");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const Logs = models.logs;
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
 * @returns {Promise<string>} - The percentile rank of the user as a string in the format "Top X%"
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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
    { type: QueryTypes.SELECT, replacements: { interval, timeframe } },
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

/**
 * Returns statistics about a user, including:
 *   - Total syncs
 *   - Total charges
 *   - Longest period without charging (approximate)
 *   - Community rank (percentile rank of the user's activity relative to other users)
 *
 * @param {number} userId - The userId to fetch statistics for
 * @returns {Promise<Object>} - An object containing the user's statistics
 */
async function getUserStats(userId) {
  const devices = await DeviceService.getDevices(userId);
  const deviceIds = devices.map((d) => d.id);

  if (deviceIds.length === 0) {
    return {
      totalSyncs: 0,
      totalCharges: 0,
      longestWithoutCharge: { durationSeconds: 0, deviceName: "None" },
      communityRank: await getUserPercentile(userId),
    };
  }

  const totalSyncs = await Logs.count({
    where: {
      userId: userId,
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
      formatted: GeneralUtils.formatDuration(winner.durationSeconds),
    };
  }

  const communityRank = await getUserPercentile(userId);

  return {
    totalSyncs,
    totalCharges,
    longestWithoutCharge: longestStat,
    communityRank,
  };
}

/**
 * Retrieves the total count of logs with null text before yesterday and yesterday.
 * Calculates the growth rate per millisecond.
 * Returns an object with the following properties:
 * - val: The total count of logs with null text before yesterday
 * - date: The start of yesterday in the format of a Date object
 * - growth: The growth rate per millisecond
 */
async function getSyncCount() {
  const now = new Date();

  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(now.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayDurationMs = yesterdayEnd - yesterdayStart + 1;

  const countBeforeYesterday = await Logs.count({
    where: {
      createdAt: {
        [Op.lt]: yesterdayStart,
      },
      text: {
        [Op.is]: null,
      },
    },
  });

  const countYesterday = await Logs.count({
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

  return {
    val: countBeforeYesterday,
    date: yesterdayStart,
    growth: ratePerMs,
  };
}

module.exports = { getUserPercentile, getApiUsage, getUserStats, getSyncCount };

const express = require("express");
const models = require("../models");
const { QueryTypes } = require("sequelize");

const logs = models.logs;

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const requestCounts = await logs.query(
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

    const responseSizes = await logs.query(
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

    console.log(
      requestCounts,
      responseSizes,
      errorCounts,
      blockedCounts,
      successCounts
    );
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;

const models = require("../models");
const cron = require("node-cron");

const { Op } = require("sequelize");

const log = require("../services/logsystem");

/**
 * Schedules an hourly cronjob that cleans up old unreceived notifications
 */
module.exports = function () {
  cron.schedule("0 * * * *", async () => {
    try {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const deleted = await models.OrderedNotifications.destroy({
        where: {
          type: "CONTENT",
          createdAt: {
            [Op.lt]: twelveHoursAgo,
          },
        },
      });

      log("CRON: " + deleted + " notifications cleaned up.");
    } catch (error) {
      log("CRON failure", null, null, null, null, null, error);
    }
  });
  log("CRON 0 * * * * scheduled.");
};

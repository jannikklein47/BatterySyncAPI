const models = require("../models");
const cron = require("node-cron");

const { Op } = require("sequelize");

async function cleanup() {
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

    console.log("CRON: " + deleted + " notifications cleaned up.");
  } catch (error) {
    console.log("CRON failure", error);
  }
}

/**
 * Schedules an hourly cronjob that cleans up old unreceived notifications
 */
module.exports = function () {
  cleanup();
  cron.schedule("0 * * * *", async () => {
    await cleanup();
  });
  console.log("CRON 0 * * * * scheduled.");
};

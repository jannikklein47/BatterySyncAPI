const cron = require("node-cron");
const DeviceService = require("../services/device");
const NotificationService = require("../services/notification");

async function task() {
  try {
    const devices = await DeviceService.getAllDevicesAtZero();
    let sentNumber = 0;
    for (const device of devices) {
      if (!device.getsRegularReminder) continue;
      await NotificationService.createNewNotification(
        "CONTENT",
        `Dein Gerät ist leer, hier ist deine Erinnerung es zu laden.`,
        false,
        device.id,
        device.userId,
        `Dein ${device.name} ist leer.`,
      );
      sentNumber++;
    }
    console.log("CRON: Sent " + sentNumber + " reminder notifications.");
  } catch (error) {
    console.error("CRON Error: " + error.message);
  }
}

module.exports = function () {
  cron.schedule("0 */12 * * *", async () => {
    await task();
  });

  console.log("CRON 0 */12 * * * scheduled.");
};

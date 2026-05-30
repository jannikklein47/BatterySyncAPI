const cron = require("node-cron");
const DeviceService = require("../services/device");

async function task() {
  try {
    const devices = await DeviceService.getAllActiveDevices(
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    );

    for (device of devices) {
      await DeviceService.getDeviceHealthStats(device.id);
    }

    console.log(
      "CRON: calculated battery health stats for " +
        devices.length +
        " devices.",
    );
  } catch (error) {
    console.error("CRON Error: " + error.message);
  }
}

module.exports = async function () {
  await task();

  cron.schedule("0 */12 * * *", async () => {
    await task();
  });

  console.log("CRON 0 */6 * * * scheduled -> batteryHealthStats");
};

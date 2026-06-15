const models = require("../models");
const downsampler = require("downsample-lttb");
const { Op, fn, col, QueryTypes } = require("sequelize");

const APIError = require("../utils/error");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const sequelize = models.sequelize;

const NotificationService = require("./notification");
const BatteryLogService = require("./batteryLogs");
const predict = require("./predictionService");

const GeneralUtils = require("../utils/general");

const OTP_TTL = 5 * 60 * 1000;
const OTP_REQUIRED_FOR = 12 * 60 * 60 * 1000;
const OTP_LENGTH = 6;

function debouncePerId(fn, wait) {
  const timers = new Map();

  return function (id, ...args) {
    // If a timer exists for this id, clear it
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
    }

    // Set a new timer for this id
    timers.set(
      id,
      setTimeout(() => {
        fn(id, ...args);
        timers.delete(id); // Clean up
      }, wait),
    );
  };
}

const debouncePrediction = debouncePerId(predict, 2000);

/**
 * Calculates the health score of a device based on its battery charging history.
 * The health score is a number between 0 and 100, with higher values indicating better health.
 * The health score is based on the total amount of charge cycled through the battery, the amount of charge that was cycled through the safe zone of 20-80%, and the average stress (i.e., the amount of charge cycled through the battery per unit time) on the battery.
 * The function returns an object containing the health score, the total amount of charge cycled through the battery, and an explanation of the health score.
 * @param {number} deviceId - The ID of the device to calculate the health score for.
 * @returns {Promise<object>} - A promise that resolves to an object containing the health score and an explanation of the health score.
 */
async function getDeviceHealthStats(deviceId) {
  const query = `
    WITH RawLogs AS (
      SELECT 
        "id", -- Include the primary key
        CASE 
          WHEN "battery" > 1.0 THEN 100.0 
          WHEN "battery" < 0.0 THEN 0.0
          ELSE "battery" * 100.0 
        END as "battery_norm",
        "createdAt"
      FROM "batteryLogs"
      WHERE "deviceId" = :deviceId
    ),
    Logs AS (
      SELECT 
        "battery_norm" as "curr",
        -- ADD "id" HERE to force a deterministic sequence
        LAG("battery_norm") OVER (ORDER BY "createdAt" ASC, "id" ASC) as "prev"
      FROM RawLogs
    ),
    Analysis AS (
      SELECT 
        ("curr" - "prev") as "charged_amount",
        
        -- Intersection with the Safe Zone (20-80)
        GREATEST(0, LEAST("curr", 80) - GREATEST("prev", 20)) as "safe_amount",
        
        -- Stress C(curr) 
        (CASE 
          WHEN "curr" < 20 THEN (20 * "curr" - 0.5 * ("curr" * "curr"))
          WHEN "curr" <= 80 THEN 200
          ELSE (200 + 0.5 * (("curr" - 80) * ("curr" - 80)))
        END) as "stress_at_curr",

        -- Stress C(prev)
        (CASE 
          WHEN "prev" < 20 THEN (20 * "prev" - 0.5 * ("prev" * "prev"))
          WHEN "prev" <= 80 THEN 200
          ELSE (200 + 0.5 * (("prev" - 80) * ("prev" - 80)))
        END) as "stress_at_prev"

      FROM Logs
      WHERE 
        "curr" > "prev"             -- Only look at charging
        AND "curr" IS NOT NULL 
        AND "prev" IS NOT NULL
    )
    SELECT 
      COALESCE(SUM("charged_amount"), 0)::numeric as "totalCharged",
      COALESCE(SUM("safe_amount"), 0)::numeric as "safeCharged",
      COALESCE(SUM("stress_at_curr" - "stress_at_prev"), 0)::numeric as "totalStress"
    FROM Analysis;
  `;

  const result = await sequelize.query(query, {
    replacements: { deviceId },
    type: QueryTypes.SELECT,
  });

  const row = result[0];
  const totalCharged = row?.totalCharged ? parseFloat(row.totalCharged) : 0;
  const safeCharged = row?.safeCharged ? parseFloat(row.safeCharged) : 0;
  const totalStress = row?.totalStress ? parseFloat(row.totalStress) : 0;

  // 1. Handle New/Empty Devices
  if (totalCharged < 100) {
    return {
      healthScore: 100,
      totalCharged: totalCharged.toFixed(0),
      explanation: {
        verdict: "Neu",
        safeZonePercent: 100,
        avgStress: 0,
      },
    };
  }

  const avgStress = totalStress / totalCharged;
  const safePercent = (safeCharged / totalCharged) * 100;

  // Score mapping: 0 stress = 100, 4 stress (standard) = 80, 20 stress = 0
  let healthScore = Math.max(
    0,
    Math.min(100, Math.round(100 - avgStress * 10)),
  );

  // 4. Generate Text Verdict
  let verdict = "Gut";
  if (healthScore >= 90) verdict = "Exzellent";
  else if (healthScore >= 75) verdict = "Gut";
  else if (healthScore >= 50) verdict = "Mittelmäßig";
  else verdict = "Schlecht";

  // Update the device cache
  await updateDevice(deviceId, {
    batteryHealthScoreCached: healthScore,
    percentHealthyChargesCached: Math.round(safePercent),
    cyclesCached: Math.round(totalCharged / 100),
  });

  return {
    healthScore,
    totalCharged: Math.round(totalCharged), // e.g., 15430 (%)
    explanation: {
      verdict,
      safeZonePercent: Math.round(safePercent), // e.g., 65 (%)
      avgStress: parseFloat(avgStress.toFixed(2)), // e.g., 3.4
    },
  };
}

/**
 * Retrieves all devices belonging to a user.
 * @param {number} userId - The ID of the user whose devices should be retrieved.
 * @param {boolean} [includeChargereminders=false] - Whether to include chargereminders in the result.
 * @return {Promise<Array<Device>>} - A promise that resolves with an array of devices.
 */
async function getDevices(userId, includeChargereminders = false) {
  const optionsObj = {
    where: {
      userId,
    },
    order: [
      ["favorite", "DESC"],
      ["name", "ASC"],
    ],
  };

  if (includeChargereminders) {
    optionsObj.include = [
      {
        model: OrderedNotifications,
        as: "orderedNotifications",
        where: {
          type: "CHARGEREMINDER",
        },
        attributes: [],
        required: false,
      },
    ];
    optionsObj.group = ["Device.id"];
    optionsObj.attributes = [
      "name",
      "battery",
      "isShown",
      "chargingStatus",
      "id",
      "type",
      "color",
      "isPluggedIn",
      "predictedZeroAt",
      "favorite",
      "lastActivity",
      "requiresOtp",
      "batteryHealthScoreCached",
      "percentHealthyChargesCached",
      "cyclesCached",
      [fn("ARRAY_AGG", col("orderedNotifications.id")), "notificationIds"],
    ];
  }

  const devices = await Device.findAll(optionsObj);
  if (!includeChargereminders)
    return devices.map((device) => {
      const processedDevice = device.toJSON();
      delete processedDevice.uuid;
      return processedDevice;
    });

  const processed = [];

  for (const device of devices) {
    const permanentNotification =
      await NotificationService.getOrderedNotifcationsForDevice(
        device.id,
        "CHARGEREMINDER",
        true,
      );
    const processedDevice = device.toJSON();

    delete processedDevice.uuid;
    processed.push({
      ...processedDevice,
      permanentNotification: permanentNotification.length > 0,
    });
  }

  return processed;
}

/**
 * Retrieves all devices that are either inactive or empty.
 * @returns {Promise<Array<Device>>} - A promise that resolves with an array of devices.
 */
async function getAllDevicesAtZero() {
  const devices = await Device.findAll({
    where: {
      battery: 0.0,
    },
  });
  return devices;
}

/**
 * Retrieves a device by its ID.
 * @param {number} deviceId The ID of the device to retrieve.
 * @throws {APIError} If the device is not found.
 * @returns {Promise<Device>} A promise that resolves with the device.
 */
async function getDevice(deviceId) {
  const device = await Device.findByPk(deviceId);
  if (!device) throw APIError.errorNotFound();
  return device;
}

/**
 * Retrieves a device by its ID, if the user id matches
 * @param {number} deviceId The ID of the device to retrieve.
 * @param {number} userId The ID of the owning user.
 * @throws {APIError} If the device is not found.
 * @returns {Promise<Device>} A promise that resolves with the device.
 */
async function getDeviceWithUserId(deviceId, userId) {
  const device = await Device.findByPk(deviceId);
  if (!device) throw APIError.errorNotFound();
  if (device.userId !== userId) throw APIError.errorNotFound();
  return device;
}

/**
 * Retrieves a device by its UUID.
 * @param {string} uuid The UUID of the device to retrieve.
 * @throws {APIError} If the device is not found.
 * @returns {Promise<Device>} A promise that resolves with the device.
 */
async function getDeviceByUUID(uuid) {
  const device = await Device.findOne({
    where: {
      uuid,
    },
  });
  if (!device) throw APIError.errorNotFound();

  return device;
}

/**
 * Retrieves all devices that record an activity after the given date.
 * @param {Date} from
 * @returns
 */
async function getAllActiveDevices(from) {
  const devices = await Device.findAll({
    where: {
      lastActivity: {
        [Op.gt]: from,
      },
    },
  });
  return devices;
}

/**
 * Refreshes the last activity timestamp for a given device.
 * @param {number} deviceId The ID of the device to refresh the last activity timestamp for.
 */
async function refreshLastActivity(deviceId) {
  const updatedDevice = await Device.update(
    { lastActivity: new Date() },
    {
      where: {
        id: deviceId,
      },
    },
  );
  if (updatedDevice[0] === 0) throw APIError.errorNotFound();
}

/**
 * Checks if a device has a permanent charger reminder notification.
 * @param {number} deviceId The ID of the device to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the device has a permanent charger reminder notification, false otherwise.
 */
async function hasPermanentChargereminder(deviceId) {
  const hasChargereminder = await OrderedNotifications.findOne({
    where: {
      deviceId,
      type: "CHARGEREMINDER",
      permanent: true,
    },
  });
  return hasChargereminder !== null;
}

/**
 * Updates a device with the given data.
 * @param {number} deviceId The ID of the device to update.
 * @param {Object} data The data to update the device with.
 * @returns {Promise<Object[]>} A promise that resolves to the updated device.
 * @throws {APIError} If the device does not exist.
 */
async function updateDevice(deviceId, data) {
  const updated = await Device.update(
    { ...data, lastActivity: new Date() },
    {
      where: {
        id: deviceId,
      },
    },
  );
  if (updated[0] === 0) {
    throw APIError.errorNotFound();
  }
  return await getDevice(deviceId);
}

/**
 * Updates the battery status of a device and updates the battery log.
 * Also checks and updates the charger reminder notifications accordingly.
 * If the device has a predicted zero at time and the charger is plugged in or charging,
 * it deletes all temporary charger reminder notifications and all permanent charger reminder notifications scheduled for the device.
 * If the device is charging or plugged in and has a predicted zero at time, and it has a permanent charger reminder notification,
 * it reschedules the permanent charger reminder notification for the device.
 * @param {number} deviceId The ID of the device to update.
 * @param {number} battery The current battery level of the device in percent.
 * @param {boolean} chargingStatus Whether the device is currently charging.
 * @param {boolean} isPluggedIn Whether the device is currently plugged in.
 * @returns {Promise<void>} A promise that resolves when the device's battery status has been updated and the charger reminder notifications have been updated accordingly.
 * @throws {APIError} If the device does not exist.
 */
async function updateDeviceBatteryStatus(
  deviceId,
  battery,
  chargingStatus,
  isPluggedIn,
) {
  const device = await Device.findByPk(deviceId);
  await updateDevice(deviceId, { battery, chargingStatus, isPluggedIn });
  await BatteryLogService.addBatteryLog(
    deviceId,
    battery,
    chargingStatus,
    isPluggedIn,
  );
  debouncePrediction(deviceId);

  // Sanitize the boolean values to string to keep it consistent
  if (typeof chargingStatus === "boolean") {
    chargingStatus = chargingStatus.toString();
  }
  if (typeof isPluggedIn === "boolean") {
    isPluggedIn = isPluggedIn.toString();
  }

  if (
    (chargingStatus === "true" || isPluggedIn === "true") &&
    device.predictedZeroAt < new Date(Date.now() + 2 * 60 * 60 * 1000)
  ) {
    const tempNotifications =
      await NotificationService.getOrderedNotifcationsForDevice(
        deviceId,
        "CHARGEREMINDER",
        false,
      );
    const permanentNotifications =
      await NotificationService.getOrderedNotifcationsForDevice(
        deviceId,
        "CHARGEREMINDER",
        true,
      );
    for (const notification of permanentNotifications) {
      await NotificationService.descheduleNotifications(notification.id);
    }
    if (tempNotifications.length > 0) {
      await NotificationService.deleteOrderedNotifications(
        tempNotifications.map((n) => n.id),
      );
    }
  } else if (
    chargingStatus === "false" &&
    isPluggedIn === "false" &&
    (device.chargingStatus || device.isPluggedIn) &&
    (await hasPermanentChargereminder(deviceId))
  ) {
    const permanentNotification =
      await NotificationService.getOrderedNotifcationsForDevice(
        deviceId,
        "CHARGEREMINDER",
        true,
      );
    if (permanentNotification[0]) {
      await NotificationService.rescheduleNotifications(
        permanentNotification[0].id,
        device.userId,
      );
    }
  }
}

/**
 * Creates a new device with the given data.
 * The device's uuid is generated randomly.
 * @param {Object} data The data to create the device with.
 * @returns {Promise<Device>} A promise that resolves to the created device.
 */
async function createDevice(data) {
  const createdDevice = await Device.create({
    ...data,
    uuid: sequelize.literal("gen_random_uuid()"),
  });

  await createdDevice.reload();

  return createdDevice;
}

/**
 * Generates a one-time password for the given device.
 * If the device has an already generated one-time password that is valid for the next 5 minutes, an error is thrown.
 * The one-time password is sent to the device as a notification.
 * @param {number} deviceId The id of the device to generate the one-time password for.
 * @throws {Error} If the device does not exist or if an one-time password is already generated for the device.
 */
async function createOneTimePassword(deviceId) {
  const device = await getDevice(deviceId);
  if (device.otpTime && new Date(device.otpTime) > Date.now() - OTP_TTL) {
    throw APIError.errorOTPAlreadyGenerated();
  }

  const otp = GeneralUtils.generateRandomString(OTP_LENGTH);

  await updateDevice(deviceId, { otp, otpTime: new Date() });

  await NotificationService.createTargetedNotification(
    deviceId,
    otp + " ist dein Einmalpasswort",
    "Gib diesen Code niemals weiter. Er ist 5 Minuten lang gültig.",
  );
}

/**
 * Checks whether an one-time password can be generated for a given device.
 * An one-time password can be generated if no one-time password is already generated for the device or if the one-time password is older than 5 minutes.
 * @param {number} deviceId The id of the device to check.
 * @returns {Promise<boolean>} A promise that resolves to true if an one-time password can be generated, false otherwise.
 * @throws {Error} If the device does not exist.
 */

async function checkOtpCreatable(deviceId) {
  const device = await getDevice(deviceId);
  if (device.otpTime && new Date(device.otpTime) > Date.now() - OTP_TTL) {
    return false;
  }
  return true;
}

/**
 * Reassigns a new uuid to a device if the given one-time password is valid.
 * @param {number} deviceId The id of the device to reassign the uuid to.
 * @param {string} otp The one-time password to check.
 * @returns {Promise<string>} A promise that resolves to the new uuid of the device.
 * @throws {Error} If the device does not exist, if the one-time password is expired or invalid.
 */
async function reassignUUID(deviceId, otp) {
  const device = await getDevice(deviceId);
  if (device.otp && new Date(device.otpTime) < Date.now() - OTP_TTL) {
    throw new Error("OTP expired");
  } else if (device.otp !== otp) {
    throw new Error("Invalid OTP");
  }
  await refreshLastActivity(deviceId);
  const updatedDevice = await updateDevice(deviceId, {
    uuid: sequelize.literal("gen_random_uuid()"),
    otp: null,
    otpTime: null,
  });
  await updatedDevice.reload();
  return updatedDevice.uuid;
}

/**
 * Reassigns a new uuid to a device if the device has not been active in the last OTP_REQUIRED_FOR milliseconds.
 * If the device has been active in the last OTP_REQUIRED_FOR milliseconds, an Error is thrown.
 * @param {number} deviceId The id of the device to reassign the uuid to.
 * @returns {Promise<string>} A promise that resolves to the new uuid of the device.
 * @throws {Error} If the device does not exist or if the device has been active in the last OTP_REQUIRED_FOR milliseconds.
 */
async function reassignUUIDInactive(deviceId) {
  const device = await getDevice(deviceId);
  if (
    new Date(device.lastActivity) > Date.now() - OTP_REQUIRED_FOR &&
    device.uuid !== null
  ) {
    throw APIError.errorOTPAlreadyGenerated();
  }
  await refreshLastActivity(deviceId);
  const updatedDevice = await updateDevice(deviceId, {
    uuid: sequelize.literal("gen_random_uuid()"),
    otp: null,
    otpTime: null,
  });
  await updatedDevice.reload();
  return updatedDevice.uuid;
}

/**
 * Checks if a device has been inactive for the last OTP_REQUIRED_FOR milliseconds.
 * @param {number} deviceId The id of the device to check.
 * @returns {Promise<boolean>} A promise that resolves to true if the device has been inactive, false otherwise.
 */
async function checkDeviceInactive(deviceId) {
  const device = await getDevice(deviceId);
  if (
    new Date(device.lastActivity) > Date.now() - OTP_REQUIRED_FOR &&
    device.uuid !== null
  ) {
    return false;
  }
  return true;
}

/**
 * Deletes a device with the given ID.
 * @param {number} deviceId The ID of the device to delete.
 * @returns {Promise<number>} A promise that resolves to the number of deleted devices.
 * @throws {APIError} If the device does not exist.
 */
async function deleteDeviceId(deviceId) {
  const deleted = await Device.update(
    { deleted: true },
    { where: { id: deviceId } },
  );
  if (deleted === 0) {
    throw APIError.errorNotFound();
  }
  return deleted;
}

/**
 * Deletes a device with the given uuid.
 * @param {string} deviceUUID The uuid of the device to delete.
 * @returns {Promise<number>} A promise that resolves to the number of deleted devices.
 * @throws {APIError} If the device does not exist.
 */
async function deleteDeviceUUID(deviceUUID) {
  const deleted = await Device.update(
    { deleted: true },
    { where: { uuid: deviceUUID } },
  );
  if (deleted === 0) {
    throw APIError.errorNotFound();
  }
  return deleted;
}

async function revokeAllDeviceRegistrations(userId) {
  await Device.update({ uuid: null }, { where: { userId } });
}

/**
 * Retrieves an array of devices that have a build number matching the given build number and operator.
 * @param {number} buildNumber - The build number to search for.
 * @param {string} operator - The operator to use when searching for the build number. Can be one of: =, <, >, <=, >=.
 * @return {Promise<Array<Device>>} A promise that resolves with an array of devices.
 */
async function getDevicesByBuild(buildNumber, operator) {
  const devices = await Device.findAll({
    where: {
      build: {
        [operator]: buildNumber,
      },
    },
  });

  return devices;
}

module.exports = {
  getDevices,
  getAllDevicesAtZero,
  getDevice,
  refreshLastActivity,
  hasPermanentChargereminder,
  updateDevice,
  updateDeviceBatteryStatus,
  getDeviceHealthStats,
  createDevice,
  getDeviceByUUID,
  createOneTimePassword,
  checkOtpCreatable,
  reassignUUID,
  reassignUUIDInactive,
  deleteDeviceId,
  deleteDeviceUUID,
  checkDeviceInactive,
  revokeAllDeviceRegistrations,
  getAllActiveDevices,
  getDeviceWithUserId,
  getDevicesByBuild,
};

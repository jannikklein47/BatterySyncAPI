const models = require("../models");
const OrderedNotifications = models.OrderedNotifications;
const ScheduledNotifications = models.ScheduledNotifications;
const Device = models.Device;
const { Op } = require("sequelize");

/**
 * Gets scheduled notifications for a device with optional filters.
 * @param {string} deviceUUID The uuid of the device to get scheduled notifications for.
 * @param {Object} [options] Optional filters.
 * @param {string} [options.type] The type of notification to filter by.
 * @param {boolean} [options.due] If true, includes the device in the query so that only notifications that are due can be retrieved.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of scheduled notifications.
 * @throws {Error} If there is an error getting the scheduled notifications.
 */
async function getScheduledNotificationsForDevice(deviceUUID, options = {}) {
  const whereClause = { deviceUUID };

  if (options.type === "CHARGEREMINDER") {
    const includeClause = {
      model: OrderedNotifications,
      as: "notification",
      required: true,
      where: { type: options.type },
    };

    if (options.due) {
      includeClause.include = [
        {
          model: Device,
          as: "device",
          required: true,
          where: {
            predictedZeroAt: {
              [Op.lte]: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
            },
          },
        },
      ];
    }

    const queryOptions = { where: whereClause, include: [includeClause] };

    try {
      const scheduledNotifications =
        await ScheduledNotifications.findAll(queryOptions);
      return scheduledNotifications;
    } catch (error) {
      throw new Error(
        `Error getting scheduled notifications for device ${deviceId}: ${error.message}`
      );
    }
  } else {
    try {
      const scheduledNotifications = await ScheduledNotifications.findAll({
        where: whereClause,
        include: [
          {
            model: OrderedNotifications,
            as: "notification",
            required: true,
            where: { type: options.type },
          },
        ],
      });
      return scheduledNotifications;
    } catch (error) {
      throw new Error(
        `Error getting scheduled notifications for device ${deviceId}: ${error.message}`
      );
    }
  }
}

/**
 * Retrieves ordered notifications for a device with the given parameters.
 * @param {number} deviceId The id of the device to retrieve notifications for.
 * @param {string} type The type of notifications to retrieve.
 * @param {boolean} permanent If true, only permanent notifications are retrieved.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of ordered notifications.
 * @throws {Error} If there is an error retrieving the ordered notifications.
 */
async function getOrderedNotifcationsForDevice(deviceId, type, permanent) {
  try {
    const orderedNotifications = await OrderedNotifications.findAll({
      where: { deviceId, type, permanent },
    });
    return orderedNotifications;
  } catch (error) {
    throw new Error(
      `Error getting ordered notifications for device ${deviceId}: ${error.message}`
    );
  }
}

/**
 * Deletes scheduled notifications with the given ids.
 * @param {Array<number>} [scheduledNotificationIds] An array of ids of scheduled notifications to delete.
 * @returns {Promise<number>} A promise that resolves to the number of deleted scheduled notifications.
 * @throws {Error} If there is an error deleting the scheduled notifications.
 */
async function deleteScheduledNotifications(scheduledNotificationIds = []) {
  const deleted = await ScheduledNotifications.destroy({
    where: { id: { [Op.in]: scheduledNotificationIds } },
  });
  return deleted;
}

/**
 * Deletes all scheduled notifications of the given ordered notification.
 * @param {number} orderedNotificationId The id of the ordered notification to delete scheduled notifications for.
 * @returns {Promise<number>} A promise that resolves to the number of deleted scheduled notifications.
 * @throws {Error} If there is an error deleting the scheduled notifications.
 */
async function descheduleNotifications(orderedNotificationId) {
  const deleted = await ScheduledNotifications.destroy({
    where: { notificationId: orderedNotificationId },
  });
  return deleted;
}

/**
 * Reschedules the given ordered notification for all devices of the given user.
 * @param {number} orderedNotificationId The id of the ordered notification to reschedule.
 * @param {number} userId The id of the user to reschedule the notification for.
 * @returns {Promise<void>} A promise that resolves when the rescheduling is complete.
 * @throws {Error} If there is an error rescheduling the notification.
 */
async function rescheduleNotifications(orderedNotificationId, userId) {
  const orderedNotification = await OrderedNotifications.findByPk(
    orderedNotificationId
  );

  await descheduleNotifications(orderedNotificationId);

  const userDevices = await Device.findAll({ where: { userId } });

  for (const device of userDevices) {
    await ScheduledNotifications.create({
      deviceId: device.id,
      notificationId: orderedNotification.id,
    });
  }
}

/**
 * Deletes ordered notifications with the given ids.
 * @param {Array<number>} [orderedNotificationIds] An array of ids of ordered notifications to delete.
 * @returns {Promise<number>} A promise that resolves to the number of deleted ordered notifications.
 * @throws {Error} If there is an error deleting the ordered notifications.
 */
async function deleteOrderedNotifications(orderedNotificationIds = []) {
  const deleted = await OrderedNotifications.destroy({
    where: { id: { [Op.in]: orderedNotificationIds } },
  });
  return deleted;
}

/**
 * Deletes the charge reminder ordered notification for the given device id.
 * @param {number} deviceId The id of the device for which the charger reminder ordered notification should be deleted.
 * @returns {Promise<number>} A promise that resolves to the number of deleted ordered notifications.
 * @throws {Error} If there is an error deleting the ordered notification.
 */
async function deleteChargeReminder(deviceId) {
  const deleted = await OrderedNotifications.destroy({
    where: { type: "CHARGEREMINDER", deviceId },
  });
  return deleted;
}

/**
 * Deletes all displayed ordered notifications.
 * @returns {Promise<number>} A promise that resolves to the number of deleted ordered notifications.
 * @throws {Error} If there is an error deleting the ordered notifications.
 */

async function deleteAllDisplayedOrderedNotifications() {
  const idsToDelete = await ScheduledNotifications.findAll({
    attributes: ["notificationId"],
  }).then((rows) => rows.map((row) => row.notificationId));

  const deleted = await models.OrderedNotifications.destroy({
    where: { id: { [Op.notIn]: idsToDelete }, permanent: false },
  });
  return deleted;
}

/**
 * Creates a new notification order with the given type, content and permanent status.
 * Also creates a scheduled notification for each device of the user with the given userId.
 * @param {string} [type="CHARGEREMINDER"] The type of the notification.
 * @param {string} [content=""] The content of the notification.
 * @param {boolean} [permanent=false] Whether the notification should be permanent or not.
 * @param {number} deviceId The id of the device to create the notification for.
 * @param {number} userId The id of the user to create the notification for.
 * @returns {Promise<OrderedNotifications>} A promise that resolves to the created notification order.
 * @throws {Error} If there is an error creating the notification order.
 */
async function createNewNotification(
  type = "CHARGEREMINDER",
  content = "",
  permanent = false,
  deviceId,
  userId
) {
  if (type === "CHARGEREMINDER" && !deviceId) {
    throw new Error("No device id provided");
  }

  await models.sequelize.transaction(async (t) => {
    // Create the notification order
    const newOrderedNotification = await OrderedNotifications.create(
      {
        deviceId,
        type: type.toUpperCase(),
        content,
        permanent,
      },
      { transaction: t }
    );

    const userDevices = await Device.findAll(
      { where: { userId } },
      { transaction: t }
    );

    for (const device of userDevices) {
      await ScheduledNotifications.create(
        {
          deviceId: device.id,
          notificationId: newOrderedNotification.id,
        },
        { transaction: t }
      );
    }

    return newOrderedNotification;
  });
}

/**
 * Creates a new notification order with type CONTENT and creates a scheduled notification for the device with the given deviceId.
 * @param {number} deviceId The id of the device to create the notification for.
 * @param {string} content The content of the notification.
 * @param {string} title The title of the notification.
 * @returns {Promise<any>} Resolves if the notification order is created successfully.
 * @throws {Error} If there is an error creating the notification order.
 */
async function createTargetedNotification(deviceId, content, title) {
  await models.sequelize.transaction(
    async (t) => {
      const newOrderedNotification = await OrderedNotifications.create(
        {
          deviceId,
          type: "CONTENT",
          content,
          title,
        },
        { transaction: t }
      );

      await ScheduledNotifications.create({
        deviceId,
        notificationId: newOrderedNotification.id,
      });
    },
    { transaction: t }
  );
}

module.exports = {
  getScheduledNotificationsForDevice,
  getOrderedNotifcationsForDevice,
  deleteScheduledNotifications,
  descheduleNotifications,
  rescheduleNotifications,
  deleteOrderedNotifications,
  deleteChargeReminder,
  deleteAllDisplayedOrderedNotifications,
  createNewNotification,
  createTargetedNotification,
};

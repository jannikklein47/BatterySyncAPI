module.exports = async function (
  title,
  content,
  userId,
  targetDeviceId = null
) {
  await models.sequelize.transaction(async (t) => {
    if (!targetDeviceId) {
      const userDevice = await models.Device.findOne(
        {
          where: {
            userId: userId,
          },
        },
        { transaction: t }
      );

      if (!userDevice) {
        return;
      }

      const newOrderedNotification = await Notifications.create(
        {
          deviceId: userDevice.id,
          type: "CONTENT",
          content: content,
          title: title,
        },
        { transaction: t }
      );
      const userDevices = await models.Device.findAll(
        { where: { userId: userId } },
        { transaction: t }
      );

      for (const dev of userDevices) {
        //console.log("Creating sched entry")

        await models.ScheduledNotifications.create(
          {
            deviceId: dev.id,
            notificationId: newOrderedNotification.id,
          },
          { transaction: t }
        );
      }
    } else {
      const userDevice = await models.Device.findOne(
        {
          where: {
            userId: userId,
            id: targetDeviceId,
          },
        },
        { transaction: t }
      );

      if (!userDevice) {
        return;
      }

      const newOrderedNotification = await Notifications.create(
        {
          deviceId: userDevice.id,
          type: "CONTENT",
          content: content,
          title: title,
        },
        { transaction: t }
      );
      await models.ScheduledNotifications.create(
        {
          deviceId: userDevice.id,
          notificationId: newOrderedNotification.id,
        },
        { transaction: t }
      );
    }
  });
};

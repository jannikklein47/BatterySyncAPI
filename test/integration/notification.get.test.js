const request = require("supertest");
const express = require("express");
const models = require("../../models");
const notificationRouter = require("../../routes/v1.0/notification/getNotification");

const app = express();
app.use(express.json());

// Mock Auth
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/notification", notificationRouter);

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Notification GET /due Integration", () => {
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";
  const deviceId = 50;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "notif@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    // 1. Create Device
    const device = await models.Device.create({
      id: deviceId,
      name: "Office iPhone",
      userId: 1,
      uuid: testUuid,
      predictedZeroAt: new Date(Date.now() + 3600000), // 1 hour from now
    });

    // 2. Create Charge Reminder Notification Template
    const chargeTemplate = await models.OrderedNotifications.create({
      id: 100,
      deviceId: deviceId,
      type: "CHARGEREMINDER",
      content: "Battery is low!",
      title: "Battery Alert",
    });

    // 3. Create Content Notification Template
    const contentTemplate = await models.OrderedNotifications.create({
      id: 101,
      deviceId: deviceId,
      type: "CONTENT",
      content: "New feature available!",
      title: "Update",
    });

    // 4. Create Scheduled Instances
    await models.ScheduledNotifications.bulkCreate([
      {
        id: 1,
        orderedNotificationId: 100,
        deviceId,
        notificationId: chargeTemplate.id,
      },
      {
        id: 2,
        orderedNotificationId: 101,
        deviceId,
        notificationId: contentTemplate.id,
      },
    ]);
  });

  afterEach(async () => {
    // Clean up to prevent ID collisions
    await models.Device.destroy({ where: {}, truncate: { cascade: true } });
  });

  describe("GET /notification/due", () => {
    it("should return mapped notification data and delete them from schedule", async () => {
      const res = await request(app)
        .get("/notification/due")
        .query({ id: deviceId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);

      // Verify Charge Reminder Mapping
      const chargeNoti = res.body.find((n) => n.type === "CHARGEREMINDER");
      expect(chargeNoti.targetName).toBe("Office iPhone");
      expect(chargeNoti.content).toBe("Battery is low!");
      expect(chargeNoti.title).toBe("Battery Alert");

      // Verify Content Mapping (targetName should be empty per your code)
      const contentNoti = res.body.find((n) => n.type === "CONTENT");
      expect(contentNoti.targetName).toBe("");
      expect(contentNoti.title).toBe("Update");

      // Verify DB side effect: Scheduled records should be deleted
      const remaining = await models.ScheduledNotifications.findAll();
      expect(remaining.length).toBe(0);
    });

    it("should work using UUID fallback", async () => {
      const res = await request(app)
        .get("/notification/due")
        .query({ uuid: testUuid });

      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty("content");
    });

    it("should return 422 if validation fails for both ID and UUID", async () => {
      const res = await request(app)
        .get("/notification/due")
        .query({ id: "invalid", uuid: "invalid" });

      expect(res.status).toBe(422);
    });
  });
});

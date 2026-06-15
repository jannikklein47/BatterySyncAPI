const request = require("supertest");
const express = require("express");
const models = require("../../models");
const notificationRouter = require("../../routes/v1.0/notification/postNotification");

const app = express();
app.use(express.json());

let isAdmin = true;

// Mock Auth
app.use((req, res, next) => {
  req.user = { id: 1, admin: isAdmin }; // Mock an admin user
  next();
});

app.use("/notification", notificationRouter);

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Notification POST Routes Integration", () => {
  const deviceId = 60;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    // Create Admin User
    await models.User.create({
      id: 1,
      email: "admin@test.com",
      password: "hash",
    });
    // Create Secondary User for Custom Notification test
    await models.User.create({
      id: 2,
      email: "user@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    await models.Device.create({
      id: deviceId,
      name: "Test Device",
      userId: 1,
    });
    await models.Device.create({
      id: 61,
      name: "User 2 Device",
      userId: 2,
    });
  });

  afterEach(async () => {
    await models.Device.destroy({ where: {}, truncate: { cascade: true } });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("POST /notification/new", () => {
    it("should create a new notification record in the DB", async () => {
      const res = await request(app).post("/notification/new").send({
        deviceId: deviceId,
        type: "CHARGEREMINDER",
        permanent: true,
        content: "Plug in your phone!",
      });

      expect(res.status).toBe(200);
      expect(res.text).toBe("Ok");

      const created = await models.OrderedNotifications.findOne({
        where: { deviceId: deviceId, type: "CHARGEREMINDER" },
      });
      expect(created).not.toBeNull();
      expect(created.content).toBe("Plug in your phone!");
    });

    it("should return 422 for content not being a string", async () => {
      const res = await request(app).post("/notification/new").send({
        deviceId: deviceId,
        type: "CHARGEREMINDER",
        permanent: false,
        content: [],
      });

      expect(res.status).toBe(422);
    });
  });

  describe("POST /notification/new/custom", () => {
    // Update beforeEach inside your file to include build numbers
    beforeEach(async () => {
      // Clear out any leftovers first
      await models.Device.destroy({ where: {}, truncate: { cascade: true } });
      await models.OrderedNotifications.destroy({
        where: {},
        truncate: { cascade: true },
      });

      // Seed devices with specific build numbers for targeting tests
      await models.Device.create({
        id: deviceId,
        name: "Test Device Admin",
        userId: 1,
        build: 100, // Setup for operator testing
      });
      await models.Device.create({
        id: 61,
        name: "User 2 Device",
        userId: 2,
        build: 200, // Setup for operator testing
      });
    });

    const validPayload = {
      title: "Admin Message",
      content: "Hello Team",
      users: "all",
      url: "https://example.com",
      permanent: false,
    };

    it("should return 403 if the user is not an admin", async () => {
      isAdmin = false; // Toggle global mock flag
      const res = await request(app)
        .post("/notification/new/custom")
        .send({ ...validPayload, users: JSON.stringify([2]) });

      expect(res.status).toBe(403);
      isAdmin = true; // Reset flag for other tests
    });

    it('should create notifications for "all" users', async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({ ...validPayload, users: "all" });

      expect(res.status).toBe(200);
      expect(res.text).toBe("Ok");

      const count = await models.OrderedNotifications.count();
      // Both user 1 and user 2 have devices, so 2 notifications should be created
      expect(count).toBe(2);
    });

    it("should create notifications for specific users via standard JSON ID array", async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          ...validPayload,
          content: "Targeted to User 2",
          users: JSON.stringify([2]),
        });

      expect(res.status).toBe(200);

      const notif = await models.OrderedNotifications.findOne({
        where: {
          content: "Targeted to User 2",
        },
      });
      expect(notif).not.toBeNull();
      expect(notif.content).toBe("Targeted to User 2");
    });

    it("should target devices with build greater than a value (build>)", async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          ...validPayload,
          title: "Upgrade Notice",
          users: "build>150", // Should match device 61 (build 200) but skip device 60 (build 100)
        });

      expect(res.status).toBe(200);

      const notifications = await models.OrderedNotifications.findAll();
      expect(notifications.length).toBe(1);
      expect(notifications[0].deviceId).toBe(61);
    });

    it("should target devices with build less than a value (build<)", async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          ...validPayload,
          title: "Legacy Patch",
          users: "build<150", // Should match device 60 (build 100)
        });

      expect(res.status).toBe(200);

      const notifications = await models.OrderedNotifications.findAll();
      expect(notifications.length).toBe(1);
      expect(notifications[0].deviceId).toBe(deviceId); // deviceId is 60
    });

    it("should target devices with build exactly equal to a value (build=)", async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          ...validPayload,
          title: "Exact Build Match",
          users: "build=200", // Should match device 61
        });

      expect(res.status).toBe(200);

      const notifications = await models.OrderedNotifications.findAll();
      expect(notifications.length).toBe(1);
      expect(notifications[0].deviceId).toBe(61);
    });
  });

  describe("POST /notification/off", () => {
    it("should delete all charge reminders for a device", async () => {
      // Seed a reminder
      await models.OrderedNotifications.create({
        deviceId: deviceId,
        type: "CHARGEREMINDER",
        content: "Delete me",
        userId: 1,
      });

      const res = await request(app)
        .post("/notification/off")
        .send({ deviceId: deviceId });

      expect(res.status).toBe(200);

      const remaining = await models.OrderedNotifications.findAll({
        where: { deviceId: deviceId, type: "CHARGEREMINDER" },
      });
      expect(remaining.length).toBe(0);
    });
  });
});

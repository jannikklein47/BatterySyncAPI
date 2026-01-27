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
    it("should create notifications for specific users via ID array", async () => {
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          title: "Admin Message",
          content: "Hello User 2",
          users: JSON.stringify([2]), // Route expects a JSON string
          permanent: false,
        });

      expect(res.status).toBe(200);

      const notif = await models.OrderedNotifications.findOne({
        where: { title: "Admin Message", content: "Hello User 2" },
      });
      expect(notif.content).toBe("Hello User 2");
    });

    it('should create notifications for "all" users', async () => {
      const res = await request(app).post("/notification/new/custom").send({
        title: "Global Alert",
        content: "Maintenance tonight",
        users: "all",
        permanent: false,
      });

      expect(res.status).toBe(200);

      const count = await models.OrderedNotifications.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("should return 403 if the user is not an admin", async () => {
      isAdmin = false;
      const res = await request(app)
        .post("/notification/new/custom")
        .send({
          title: "Admin Message",
          content: "Hello User 2",
          users: JSON.stringify([2]), // Route expects a JSON string
          permanent: false,
        });

      expect(res.status).toBe(403);
      isAdmin = true;
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

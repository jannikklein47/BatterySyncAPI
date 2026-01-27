const request = require("supertest");
const express = require("express");
const models = require("../../models");
const batteryRouter = require("../../routes/v1.0/battery/getBattery");

// Create a small express app for testing the router
const app = express();
app.use(express.json());

// 1. MOCK AUTHENTICATION MIDDLEWARE
const mockUser = { id: 1, email: "tester@test.com" };
app.use((req, res, next) => {
  req.user = mockUser;
  next();
});

app.use("/battery", batteryRouter);

let deviceUUID;

describe("Battery GET Routes Integration", () => {
  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    // 2. SEED INITIAL DATA
    await models.User.create({
      id: 1,
      email: "tester@test.com",
      password: "hash",
    });
    const device = await models.Device.create({
      id: 10,
      name: "iPhone 15",
      userId: 1,
      uuid: models.sequelize.literal("gen_random_uuid()"),
      battery: 0.95,
    });
    await device.reload();
    deviceUUID = device.uuid;

    // Create logs to test history routes
    // One log within 24h, one outside for interpolation
    await models.batteryLogs.bulkCreate([
      {
        deviceId: 10,
        battery: 0.8,
        chargingStatus: false,
        isPluggedIn: false,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12h ago
      },
      {
        deviceId: 10,
        battery: 0.7,
        chargingStatus: false,
        isPluggedIn: false,
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30h ago (outside 24h window)
      },
    ]);
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("GET /battery", () => {
    it("should return all devices for the authenticated user", async () => {
      const res = await request(app).get("/battery");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe("iPhone 15");
      // Ensure UUID is excluded as per your service logic
      expect(res.body[0].uuid).toBeUndefined();
    });

    it("should refresh last activity if uuid is provided", async () => {
      const res = await request(app).get("/battery?uuid=" + deviceUUID);

      expect(res.status).toBe(200);
      const device = await models.Device.findByPk(10);
      expect(device.lastActivity).not.toBeNull();
    });
  });

  describe("GET /battery/history/all", () => {
    it("should return history object with device IDs as keys", async () => {
      const res = await request(app).get("/battery/history/all");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("10");

      // Verify downsampling/interpolation returned a list of points
      const history = res.body["10"];
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("GET /battery/withNotificationInfo", () => {
    it("should include notification info, healthStats, and if it has a permanent chargereminder in the response", async () => {
      // Create a charge reminder for this device
      await models.OrderedNotifications.create({
        deviceId: 10,
        type: "CHARGEREMINDER",
        content: "Charge me!",
        permanent: true,
      });

      const res = await request(app).get("/battery/withNotificationInfo");

      expect(res.status).toBe(200);

      expect(res.body[0]).toHaveProperty("notificationIds");
      expect(res.body[0]).toHaveProperty("healthStats");
      expect(res.body[0]).toHaveProperty("permanentNotification");
      expect(res.body[0].healthStats).toHaveProperty("healthScore");
      expect(res.body[0].healthStats).toHaveProperty("totalCharged");
    });
  });
});

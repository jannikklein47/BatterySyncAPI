const request = require("supertest");
const express = require("express");
const models = require("../../models");
const deviceRouter = require("../../routes/v1.0/device/getDevice");

const app = express();
app.use(express.json());

// 1. MOCK AUTHENTICATION
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/device", deviceRouter);

// 2. ERROR HANDLER (Required to catch next(error))
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Device GET Routes Integration", () => {
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";

  beforeAll(async () => {
    // Ensure DB is clean
    await models.sequelize.sync({ force: true });

    await models.User.create({
      id: 1,
      email: "test@test.com",
      password: "hash",
    });
    await models.Device.create({
      id: 10,
      name: "Office Phone",
      userId: 1,
      uuid: testUuid,
      lastActivity: new Date("2026-01-01"),
    });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("GET /device", () => {
    it("should return a list of devices for the user", async () => {
      const res = await request(app).get("/device");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe("Office Phone");
    });

    it("should refresh last activity when a valid uuid query is provided", async () => {
      const res = await request(app).get(`/device?uuid=${testUuid}`);

      expect(res.status).toBe(200);

      // Verify side effect in DB
      const device = await models.Device.findByPk(10);
      const activityDate = new Date(device.lastActivity).getTime();
      const now = new Date().getTime();

      // Should be updated to roughly "now"
      expect(now - activityDate < 5000).toBe(true);
    });
  });

  describe("GET /device/otpCreatable", () => {
    it("should return status true for a fresh device", async () => {
      const res = await request(app).get("/device/otpCreatable?id=10");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(true);
    });

    it("should return 422 for an invalid ID format (Validation Check)", async () => {
      const res = await request(app).get(
        "/device/otpCreatable?id=not-a-number",
      );

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty("error");
    });

    it("should return false if an OTP was recently created", async () => {
      // Manually set otpTime to 1 minute ago in DB
      await models.Device.update(
        { otpTime: new Date(Date.now() - 60000) },
        { where: { id: 10 } },
      );

      const res = await request(app).get("/device/otpCreatable?id=10");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(false);
    });
  });
});

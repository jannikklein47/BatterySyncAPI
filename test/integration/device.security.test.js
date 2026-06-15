const request = require("supertest");
const express = require("express");
const models = require("../../models");
const deviceRouter = require("../../routes/v1.0/device/postDevice");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/device", deviceRouter);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Device Security & UUID Lifecycle", () => {
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";
  const OTP_REQUIRED_FOR = 12 * 60 * 60 * 1000; // 12 hours

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "sec@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    await models.Device.create({
      id: 20,
      name: "Security Test Device",
      userId: 1,
      uuid: testUuid,
      otp: "123456",
      otpTime: new Date(),
      lastActivity: new Date(),
    });
  });

  afterEach(async () => {
    await models.Device.destroy({ where: {}, truncate: { cascade: true } });
  });

  describe("POST /device/newUuid (The Security Logic)", () => {
    it("should reassign UUID using OTP if device was RECENTLY active", async () => {
      // Device is active (lastActivity is "now" from beforeEach)
      const res = await request(app)
        .post("/device/newUuid")
        .query({ id: 20, otp: "123456" });

      expect(res.status).toBe(200);
      expect(res.text).not.toBe(testUuid); // Should be a new UUID

      const device = await models.Device.findByPk(20);
      expect(device.otp).toBeNull(); // OTP should be cleared after use
    });

    it("should fail reassignment if device is active and OTP is WRONG", async () => {
      const res = await request(app)
        .post("/device/newUuid")
        .query({ id: 20, otp: "wrong_otp" });

      // Assuming your service throws an error that results in a 500 or 400
      expect(res.status).not.toBe(200);
    });

    it("should reassign UUID WITHOUT OTP if device has been INACTIVE (>12h)", async () => {
      // Manually set device to inactive state
      await models.Device.update(
        { lastActivity: new Date(Date.now() - (OTP_REQUIRED_FOR + 1000)) },
        { where: { id: 20 } },
      );

      // We send a request WITHOUT an OTP
      const res = await request(app).post("/device/newUuid").query({ id: 20 });

      expect(res.status).toBe(200);
      expect(res.text).not.toBe(testUuid);
    });
  });

  describe("Utility Security Routes", () => {
    it("POST /device/uuid - should verify a UUID and return device name", async () => {
      const res = await request(app)
        .post("/device/uuid")
        .query({ uuid: testUuid });

      expect(res.status).toBe(200);
      expect(res.body.name).toBeDefined();
      expect(res.body.name).toBe("Security Test Device");
    });

    it("POST /device/logout/inactive - should set uuid to null", async () => {
      const res = await request(app)
        .post("/device/logout/inactive")
        .query({ uuid: testUuid });

      expect(res.status).toBe(200);

      const device = await models.Device.findByPk(20);
      expect(device.uuid).toBeNull();
    });
  });
});

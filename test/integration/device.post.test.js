const request = require("supertest");
const express = require("express");
const models = require("../../models");
const deviceRouter = require("../../routes/v1.0/device/postDevice");

const app = express();
app.use(express.json());

// Mock Auth
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/device", deviceRouter);

// Error Handler (ensures next(error) returns JSON)
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Device POST Routes Integration", () => {
  let testDevice;
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "admin@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    // Create a fresh device for each test to avoid OTP time conflicts
    testDevice = await models.Device.create({
      id: 10,
      name: "Primary Phone",
      userId: 1,
      uuid: testUuid,
      favorite: false,
    });
    jest.useFakeTimers();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    await models.Device.destroy({ where: {}, truncate: { cascade: true } });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("POST /device/register", () => {
    it("should register a new device and return a UUID", async () => {
      const res = await request(app)
        .post("/device/register")
        .query({ system: "phone", battery: 0.75 });

      expect(res.status).toBe(200);
      expect(typeof res.text).toBe("string");
      expect(res.text.length).toBeGreaterThan(10); // Check it's a UUID string
    });
  });

  describe("POST /device/favorite", () => {
    it("should update favorite status using req.body", async () => {
      const res = await request(app)
        .post("/device/favorite")
        .send({ id: 10, set: true }); // Using .send() for req.body

      expect(res.status).toBe(200);
      const updated = await models.Device.findByPk(10);
      expect(updated.favorite).toBe(true);
    });
  });

  describe("POST /device/otp", () => {
    it("should create an OTP if one is creatable", async () => {
      const res = await request(app).post("/device/otp").query({ id: 10 });

      expect(res.status).toBe(200);
      expect(res.text).toBe("Ok");
    });

    it("should return 410 if OTP was created too recently", async () => {
      // Manually set an existing OTP time
      await testDevice.update({ otpTime: new Date() });

      const res = await request(app).post("/device/otp").query({ id: 10 });

      expect(res.status).toBe(410);
    });
  });

  describe("POST /device/logout/delete", () => {
    it("should delete the device by UUID", async () => {
      const res = await request(app)
        .post("/device/logout/delete")
        .query({ uuid: testUuid });

      expect(res.status).toBe(200);
      const deleted = await models.Device.findByPk(10);
      expect(deleted).toBeNull();
    });
  });
});

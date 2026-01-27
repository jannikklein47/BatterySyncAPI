const request = require("supertest");
const express = require("express");
const models = require("../../models");
const batteryRouter = require("../../routes/v1.0/battery/postBattery");
const APIError = require("../../utils/error");

const app = express();
app.use(express.json());

// Mock Auth - assuming this route also requires a user context
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/battery", batteryRouter);

// Error handling middleware is CRUCIAL here to catch the next(APIError) calls
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Battery POST /secure Integration", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "test@test.com",
      password: "hash",
    });
    await models.Device.create({
      id: 10,
      name: "Test Device",
      userId: 1,
      uuid: validUUID,
      battery: 0.5,
    });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("POST /battery/secure", () => {
    it("should update battery status with valid query parameters", async () => {
      const res = await request(app).post("/battery/secure").query({
        uuid: validUUID,
        battery: 0.85,
        chargingStatus: true,
        isPluggedIn: true,
      });

      expect(res.status).toBe(200);

      // Verify DB update
      const updatedDevice = await models.Device.findByPk(10);
      expect(updatedDevice.battery).toBe(0.85);
      expect(updatedDevice.chargingStatus).toBe(true);
    });

    it("should return 422 if battery level is invalid (Validation Check)", async () => {
      const res = await request(app).post("/battery/secure").query({
        uuid: validUUID,
        battery: 1.5, // Assuming > 1.0 is invalid in your Joi rules
        chargingStatus: true,
        isPluggedIn: true,
      });

      expect(res.status).toBe(422);
      // This confirms your ValidationRules are working!
    });

    it("should return 404 if UUID does not exist in database", async () => {
      const res = await request(app).post("/battery/secure").query({
        uuid: "560a7189-1e3c-41ea-a602-3092b832e839",
        battery: 0.5,
        chargingStatus: false,
        isPluggedIn: false,
      });

      expect(res.status).toBe(404);
    });

    it("should return 422 if UUID is invalid", async () => {
      const res = await request(app).post("/battery/secure").query({
        uuid: "560a7189-1e3c-41ea-a602-asdasdasdasdasdasdasd",
        battery: 0.5,
        chargingStatus: false,
        isPluggedIn: false,
      });

      expect(res.status).toBe(422);
    });
  });
});

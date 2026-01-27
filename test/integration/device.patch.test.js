const request = require("supertest");
const express = require("express");
const models = require("../../models");
const deviceRouter = require("../../routes/v1.0/device/patchDevice");

const app = express();
app.use(express.json());

// Mock Auth
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/device", deviceRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Device PATCH Routes Integration", () => {
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";
  const deviceId = 10;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "test@test.com",
      password: "hash",
    });
    await models.Device.create({
      id: deviceId,
      name: "Old Name",
      userId: 1,
      uuid: testUuid,
      isShown: true,
    });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("PATCH /device/name", () => {
    it("should update name using device ID", async () => {
      const newName = "New Office Phone";
      const res = await request(app)
        .patch("/device/name")
        .query({ id: deviceId, name: newName });

      expect(res.status).toBe(200);
      expect(res.text).toBe(newName);

      const device = await models.Device.findByPk(deviceId);
      expect(device.name).toBe(newName);
    });

    it("should update name using UUID if ID is invalid/missing", async () => {
      const uuidName = "UUID Updated Phone";
      const res = await request(app)
        .patch("/device/name")
        .query({ uuid: testUuid, name: uuidName });

      expect(res.status).toBe(200);

      const device = await models.Device.findByPk(deviceId);
      expect(device.name).toBe(uuidName);
    });

    it("should return 422 if both ID and UUID are missing/invalid", async () => {
      const res = await request(app)
        .patch("/device/name")
        .query({ name: "Broken" });

      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /device/isShown", () => {
    it("should update the isShown status", async () => {
      const res = await request(app)
        .patch("/device/isShown")
        .query({ id: deviceId, isShown: false });

      expect(res.status).toBe(200);

      const device = await models.Device.findByPk(deviceId);
      expect(device.isShown).toBe(false);
    });

    it("should fail validation for non-boolean isShown", async () => {
      const res = await request(app)
        .patch("/device/isShown")
        .query({ id: deviceId, isShown: "not-a-boolean" });

      expect(res.status).toBe(422);
    });
  });
});

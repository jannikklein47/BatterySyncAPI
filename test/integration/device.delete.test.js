const request = require("supertest");
const express = require("express");
const models = require("../../models");
const deviceRouter = require("../../routes/v1.0/device/deleteDevice");

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

describe("Device DELETE Routes Integration", () => {
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

  describe("DELETE /device", () => {
    it("should set the deleted flag to true of a device by id", async () => {
      const res = await request(app).delete("/device").query({ id: 10 });

      console.log(res);
      expect(res.status).toBe(200);
      const deleted = await models.Device.findByPk(10);
      expect(deleted).toBeNull();

      console.log("ok");

      const softDeleted = await models.Device.scope("deleted").findOne({
        where: { id: 10 },
      });
      console.log(softDeleted);
      expect(softDeleted).not.toBeNull();
    });
  });
});

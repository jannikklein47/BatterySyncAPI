// 1. MOCK MODELS
jest.mock("../models", () => ({
  Device: {
    findByPk: jest.fn(),
    update: jest.fn(),
  },
  batteryLogs: {
    findAll: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((callback) => callback()),
  },
}));

const predictionService = require("../services/predictionService"); // adjust path
const { Device, batteryLogs, sequelize } = require("../models");
const { Op } = require("sequelize");

describe("Prediction Service", () => {
  const deviceId = 1;
  const mockNow = new Date("2026-01-25T12:00:00Z");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(mockNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("should calculate predictedZeroAt correctly when battery is discharging", async () => {
    // ARRANGE
    Device.findByPk.mockResolvedValue({ id: deviceId });

    // Log sequence (Index 0 is newest):
    // 12:00 -> 50% (Unplugged)
    // 11:00 -> 60% (Unplugged)
    // 10:00 -> 60% (Plugged In) <- This is the "Unplug Event" point
    const logs = [
      {
        createdAt: new Date("2026-01-25T12:00:00Z"),
        battery: 0.5,
        isPluggedIn: false,
      },
      {
        createdAt: new Date("2026-01-25T11:00:00Z"),
        battery: 0.6,
        isPluggedIn: false,
      },
      {
        createdAt: new Date("2026-01-25T10:00:00Z"),
        battery: 0.6,
        isPluggedIn: true,
      },
    ];
    batteryLogs.findAll.mockResolvedValue(logs);

    // ACT
    await predictionService(deviceId);

    // MATH:
    // Start point is index 0 (12:00) because unplug happened between 10:00 and 11:00.
    // Elapsed: 1 hour (from 11:00 to 12:00).
    // Delta: -10% (60 to 50). Rate: -10% per hour.
    // Time to zero: 50% / 10% = 5 hours.
    // Predicted zero: 12:00 + 5 hours = 17:00.
    const expectedTime = new Date("2026-01-25T17:00:00Z");

    // ASSERT
    expect(Device.update).toHaveBeenCalledWith(
      { predictedZeroAt: expectedTime },
      { where: { id: deviceId } },
    );
  });

  it("should set predictedZeroAt to null if the device is currently plugged in", async () => {
    Device.findByPk.mockResolvedValue({ id: deviceId });
    batteryLogs.findAll.mockResolvedValue([
      { createdAt: new Date(), battery: 0.9, isPluggedIn: true },
    ]);

    await predictionService(deviceId);

    expect(Device.update).toHaveBeenCalledWith(
      { predictedZeroAt: null },
      { where: { id: deviceId } },
    );
  });

  it("should handle the fallback startEntry when no unplug is detected in the 24h window", async () => {
    Device.findByPk.mockResolvedValue({ id: deviceId });
    // All logs are unplugged (no transition found)
    const logs = [
      {
        createdAt: new Date("2026-01-25T12:00:00Z"),
        battery: 0.5,
        isPluggedIn: false,
      },
      {
        createdAt: new Date("2026-01-25T10:00:00Z"),
        battery: 0.7,
        isPluggedIn: false,
      },
    ];
    batteryLogs.findAll.mockResolvedValue(logs);

    await predictionService(deviceId);

    // Rate: (50-70) / 2 hours = -10%/hr.
    // 50% / 10% = 5 hours from 12:00.
    expect(Device.update).toHaveBeenCalledWith(
      { predictedZeroAt: new Date("2026-01-25T17:00:00Z") },
      { where: { id: deviceId } },
    );
  });
});

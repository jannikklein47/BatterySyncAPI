// 1. MOCK MODELS
jest.mock("../models", () => {
  return {
    batteryLogs: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
    },
    Device: {},
    sequelize: { query: jest.fn() },
  };
});

// 2. MOCK SERVICES & UTILS
jest.mock("../services/device");
jest.mock("../utils/general", () => ({
  downsample: jest.fn((data) => data), // Return data as-is for easy verification
}));

const batteryLogService = require("../services/batteryLogs");
const { batteryLogs: BatteryLogs } = require("../models");
const DeviceService = require("../services/device");
const { Op } = require("sequelize");

describe("BatteryLogService", () => {
  const mockDeviceId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-01-25T12:00:00Z"));
  });

  describe("addBatteryLog", () => {
    it("should create a new log if the state has changed", async () => {
      // Previous state: 80% battery
      BatteryLogs.findOne.mockResolvedValue({
        battery: 80,
        chargingStatus: false,
        isPluggedIn: false,
      });

      // Current state: 81% battery
      await batteryLogService.addBatteryLog(mockDeviceId, 81, false, false);

      expect(BatteryLogs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          battery: 81,
          deviceId: mockDeviceId,
        }),
      );
    });

    it("should NOT create a new log if the state is identical to the last entry", async () => {
      const state = { battery: 80, chargingStatus: false, isPluggedIn: false };
      BatteryLogs.findOne.mockResolvedValue(state);

      await batteryLogService.addBatteryLog(mockDeviceId, 80, false, false);

      expect(BatteryLogs.create).not.toHaveBeenCalled();
    });
  });

  describe("getBatteryLogs", () => {
    it("should retrieve logs and perform interpolation for the start boundary", async () => {
      // 1. Setup mock data
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // The recent logs (within the last 24h)
      BatteryLogs.findAll.mockResolvedValue([
        {
          createdAt: new Date("2026-01-25T11:00:00Z"),
          battery: 0.9,
          chargingStatus: true,
          isPluggedIn: true,
        },
      ]);

      // The log just before the 24h window (for interpolation)
      BatteryLogs.findOne.mockResolvedValue({
        createdAt: new Date("2026-01-24T10:00:00Z"),
        battery: 0.8,
        chargingStatus: false,
        isPluggedIn: false,
      });

      DeviceService.getDevice.mockResolvedValue({
        battery: 0.95,
        chargingStatus: true,
        isPluggedIn: true,
      });

      // 2. Act
      const result = await batteryLogService.getBatteryLogs(
        mockDeviceId,
        "day",
      );

      // 3. Assert
      expect(BatteryLogs.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { [Op.gte]: startDate },
          }),
        }),
      );

      // Verify the result contains the unshifted current device state
      expect(result[0].battery).toBe(0.95);

      // Verify the pushed interpolated point
      // (The last element should be the predicted oldest data point)
      expect(result[result.length - 1]).toHaveProperty("battery");
    });

    it("should throw an error for an invalid interval", async () => {
      await expect(
        batteryLogService.getBatteryLogs(mockDeviceId, "month"),
      ).rejects.toThrow("Invalid interval");
    });
  });
});

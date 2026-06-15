// 1. MOCK MODELS FIRST
jest.mock("../models", () => {
  return {
    User: { findByPk: jest.fn(), findOne: jest.fn() },
    Device: {
      findByPk: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
    },
    OrderedNotifications: {
      findOne: jest.fn(),
      findAll: jest.fn(),
      destroy: jest.fn(),
    },
    batteryLogs: { create: jest.fn() },
    sequelize: {
      query: jest.fn(),
      transaction: jest.fn((callback) => callback()), // Auto-resolve transactions
      literal: jest.fn((val) => val),
    },
    QueryTypes: { SELECT: "SELECT" },
    Op: { in: Symbol("in"), notIn: Symbol("notIn"), lte: Symbol("lte") },
  };
});

// 2. NOW REQUIRE YOUR SERVICE
const deviceService = require("../services/device");

// 3. REQUIRE MODELS FOR MOCK MANIPULATION
// This gives you access to the same mocked objects defined above
const { Device, OrderedNotifications, sequelize } = require("../models");
const NotificationService = require("../services/notification");
const BatteryLogService = require("../services/batteryLogs");
const APIError = require("../utils/error");

// ... rest of your describe blocks

jest.mock("../services/notification");
jest.mock("../services/batteryLogs");
jest.mock("../utils/error");

describe("DeviceService", () => {
  const mockDeviceId = 1;
  const mockUserId = 100;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-01-25T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe("getDeviceHealthStats", () => {
    it('should return "Neu" verdict if total charged is less than 100', async () => {
      // Mock the raw SQL response
      sequelize.query.mockResolvedValue([
        {
          totalCharged: "50.5",
          safeCharged: "40.0",
          totalStress: "10.0",
        },
      ]);

      const result = await deviceService.getDeviceHealthStats(mockDeviceId);

      expect(result.explanation.verdict).toBe("Neu");
      expect(result.healthScore).toBe(100);
    });
  });

  describe("updateDeviceBatteryStatus", () => {
    it("should delete temporary notifications if charging and predictedZero is soon", async () => {
      // 1. Setup device state
      const mockDevice = {
        id: mockDeviceId,
        predictedZeroAt: new Date("2026-01-25T13:00:00Z"), // 1 hour from now (within 2hr window)
        userId: mockUserId,
      };
      Device.findByPk.mockResolvedValue(mockDevice);
      Device.update.mockResolvedValue([1]);

      // 2. Setup Notification mocks
      const mockTempNotifs = [{ id: 10 }];
      NotificationService.getOrderedNotifcationsForDevice
        .mockResolvedValueOnce(mockTempNotifs) // for false (temp)
        .mockResolvedValueOnce([]); // for true (perm)

      // 3. Act
      await deviceService.updateDeviceBatteryStatus(
        mockDeviceId,
        80,
        true,
        true,
      );

      // 4. Assert
      expect(
        NotificationService.deleteOrderedNotifications,
      ).toHaveBeenCalledWith([10]);
      expect(BatteryLogService.addBatteryLog).toHaveBeenCalled();
    });
  });

  describe("OTP and UUID Security", () => {
    it("reassignUUID should throw error if OTP is invalid", async () => {
      const mockDevice = {
        id: mockDeviceId,
        otp: "correct-code",
        otpTime: new Date(Date.now() - 1000),
      };
      Device.findByPk.mockResolvedValue(mockDevice);

      await expect(
        deviceService.reassignUUID(mockDeviceId, "wrong-code"),
      ).rejects.toThrow("Invalid OTP");
    });

    it("checkDeviceInactive should return false if device was active recently", async () => {
      const recentDate = new Date(Date.now() - 1000); // 1 second ago
      Device.findByPk.mockResolvedValue({ lastActivity: recentDate });

      const isInactive = await deviceService.checkDeviceInactive(mockDeviceId);
      expect(isInactive).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("getDevice should throw APIError if not found", async () => {
      Device.findByPk.mockResolvedValue(null);
      APIError.errorNotFound.mockReturnValue(new Error("Not Found"));

      await expect(deviceService.getDevice(mockDeviceId)).rejects.toThrow(
        "Not Found",
      );
    });
  });
});

const { getDevicesByBuild } = require("../services/device");

describe("getDevicesByBuild", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should call Device.findAll with the correct query parameters and return devices", async () => {
    // Arrange
    const mockBuildNumber = 1024;
    const mockOperator = "gte"; // In Sequelize, this could be Op.gte, which works perfectly as a dynamic key
    const mockDevices = [
      { id: 1, name: "Device A", build: 1024 },
      { id: 2, name: "Device B", build: 1025 },
    ];

    // Mock the resolved value of Device.findAll
    Device.findAll.mockResolvedValue(mockDevices);

    // Act
    const result = await getDevicesByBuild(mockBuildNumber, mockOperator);

    // Assert
    expect(Device.findAll).toHaveBeenCalledTimes(1);
    expect(Device.findAll).toHaveBeenCalledWith({
      where: {
        build: {
          [mockOperator]: mockBuildNumber,
        },
      },
    });
    expect(result).toEqual(mockDevices);
  });

  it("should throw an error if Device.findAll fails", async () => {
    // Arrange
    const mockBuildNumber = 500;
    const mockOperator = "eq";
    const databaseError = new Error("Database connection failed");

    Device.findAll.mockRejectedValue(databaseError);

    // Act & Assert
    await expect(
      getDevicesByBuild(mockBuildNumber, mockOperator),
    ).rejects.toThrow("Database connection failed");
  });
});

const { createNewNotification } = require("../services/notification");
const {
  OrderedNotifications,
  Device,
  ScheduledNotifications,
  sequelize,
} = require("../models");

const { Op } = require("sequelize");

// Mock the models
jest.mock("../models", () => ({
  OrderedNotifications: {
    create: jest.fn(),
    destroy: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Device: { findAll: jest.fn() },
  ScheduledNotifications: {
    create: jest.fn(),
    findAll: jest.fn(),
    destroy: jest.fn(),
  },
  sequelize: { transaction: jest.fn() },
}));

// 1. createNewNotification
describe("NotificationService - createNewNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate a successful transaction wrapper
    sequelize.transaction.mockImplementation(
      async (callback) => await callback("test-transaction-obj"),
    );
  });

  it("should throw error if type is CHARGEREMINDER and deviceId is missing", async () => {
    await expect(
      createNewNotification("CHARGEREMINDER", "msg", false, null, 1, "Title"),
    ).rejects.toThrow("No device id provided");
  });

  it("should create an order and scheduled notifications for all user devices", async () => {
    // ARRANGE
    const mockOrder = { id: 100, title: "Test" };
    const mockDevices = [{ id: 1 }, { id: 2 }];

    OrderedNotifications.create.mockResolvedValue(mockOrder);
    Device.findAll.mockResolvedValue(mockDevices);
    ScheduledNotifications.create.mockResolvedValue({});

    // ACT
    const result = await createNewNotification(
      "ALERT",
      "Msg",
      false,
      55,
      1,
      "Title",
    );

    // ASSERT
    // Check if the order was created with correct transaction
    expect(OrderedNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Title" }),
      { transaction: "test-transaction-obj" },
    );

    // Check if ScheduledNotifications were created for BOTH devices
    expect(ScheduledNotifications.create).toHaveBeenCalledTimes(2);
    expect(ScheduledNotifications.create).toHaveBeenNthCalledWith(
      1,
      { deviceId: 1, notificationId: 100 },
      { transaction: "test-transaction-obj" },
    );
  });
});

const {
  deleteAllDisplayedOrderedNotifications,
} = require("../services/notification");

// 2. deleteAllDisplayedOrderedNotifications
describe("NotificationService - deleteAllDisplayedOrderedNotifications", () => {
  it("should delete notifications that are NOT in the scheduled list and NOT permanent", async () => {
    // 1. ARRANGE
    // Simulate finding two scheduled notification IDs
    const mockScheduledRows = [{ notificationId: 10 }, { notificationId: 11 }];
    ScheduledNotifications.findAll.mockResolvedValue(mockScheduledRows);

    // Simulate Sequelize returning the count of deleted rows (e.g., 5 rows deleted)
    OrderedNotifications.destroy.mockResolvedValue(5);

    // 2. ACT
    const result = await deleteAllDisplayedOrderedNotifications();

    // 3. ASSERT
    // Verify the query for scheduled IDs was called
    expect(ScheduledNotifications.findAll).toHaveBeenCalledWith({
      attributes: ["notificationId"],
    });

    // Verify destroy was called with the correct logic:
    // id NOT IN [10, 11] AND permanent IS FALSE
    expect(OrderedNotifications.destroy).toHaveBeenCalledWith({
      where: {
        id: { [Op.notIn]: [10, 11] },
        permanent: false,
      },
    });

    // Verify the return value
    expect(result).toBe(5);
  });

  it("should throw an error if the database query fails", async () => {
    // ARRANGE
    ScheduledNotifications.findAll.mockRejectedValue(
      new Error("DB Connection Failed"),
    );

    // ACT & ASSERT
    await expect(deleteAllDisplayedOrderedNotifications()).rejects.toThrow(
      "DB Connection Failed",
    );
  });
});

const {
  getScheduledNotificationsForDevice,
} = require("../services/notification");

// 3. getScheduledNotificationsForDevice
describe("NotificationService - getScheduledNotificationsForDevice", () => {
  const deviceId = "123";

  beforeEach(() => {
    jest.clearAllMocks();
    // Use a fixed date for testing to avoid "shifting target" bugs with Date.now()
    jest.useFakeTimers().setSystemTime(new Date("2026-01-25T12:00:00Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("should filter by CONTENT type correctly", async () => {
    ScheduledNotifications.findAll.mockResolvedValue([{ id: 1 }]);
    const options = { type: "CONTENT" };

    await getScheduledNotificationsForDevice(deviceId, options);

    expect(ScheduledNotifications.findAll).toHaveBeenCalledWith({
      where: { deviceId },
      include: [
        {
          model: OrderedNotifications,
          as: "notification",
          required: true,
          where: { type: "CONTENT" },
        },
      ],
    });
  });

  it("should apply nested Device inclusion when type is CHARGEREMINDER and due is true", async () => {
    ScheduledNotifications.findAll.mockResolvedValue([]);
    const options = { type: "CHARGEREMINDER", due: true };

    // Calculate the expected timestamp (Current time + 2 hours)
    const expectedDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await getScheduledNotificationsForDevice(deviceId, options);

    // We check the nested structure
    const callArgs = ScheduledNotifications.findAll.mock.calls[0][0];

    expect(callArgs.include[0].where.type).toBe("CHARGEREMINDER");
    expect(callArgs.include[0].include[0].model).toBe(Device);
    expect(
      callArgs.include[0].include[0].where.predictedZeroAt[Op.lte],
    ).toEqual(expectedDate);
  });

  it("should wrap database errors with a custom message", async () => {
    ScheduledNotifications.findAll.mockRejectedValue(
      new Error("Query Timeout"),
    );

    await expect(
      getScheduledNotificationsForDevice(deviceId, { type: "ANY" }),
    ).rejects.toThrow(
      `Error getting scheduled notifications for device ${deviceId}: Query Timeout`,
    );
    await expect(
      getScheduledNotificationsForDevice(deviceId, {
        type: "CHARGEREMINDER",
        due: true,
      }),
    ).rejects.toThrow(
      `Error getting scheduled notifications for device ${deviceId}: Query Timeout`,
    );
  });
});

const { getOrderedNotifcationsForDevice } = require("../services/notification");

// 4. getOrderedNotifcationsForDevice
describe("NotificationService - getOrderedNotifcationsForDevice", () => {
  const mockDeviceId = 42;
  const mockType = "LOW_BATTERY";
  const mockPermanent = true;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call OrderedNotifications.findAll with correct filters", async () => {
    // ARRANGE
    const mockData = [{ id: 1, title: "Test Notif" }];
    OrderedNotifications.findAll.mockResolvedValue(mockData);

    // ACT
    const result = await getOrderedNotifcationsForDevice(
      mockDeviceId,
      mockType,
      mockPermanent,
    );

    // ASSERT
    expect(OrderedNotifications.findAll).toHaveBeenCalledWith({
      where: {
        deviceId: mockDeviceId,
        type: mockType,
        permanent: mockPermanent,
      },
    });
    expect(result).toEqual(mockData);
  });

  it("should return an empty array if no notifications match", async () => {
    // ARRANGE
    OrderedNotifications.findAll.mockResolvedValue([]);

    // ACT
    const result = await getOrderedNotifcationsForDevice(
      mockDeviceId,
      "NON_EXISTENT",
      false,
    );

    // ASSERT
    expect(result).toEqual([]);
  });

  it("should wrap and throw a custom error if the query fails", async () => {
    // ARRANGE
    const dbError = new Error("Connection lost");
    OrderedNotifications.findAll.mockRejectedValue(dbError);

    // ACT & ASSERT
    await expect(
      getOrderedNotifcationsForDevice(mockDeviceId, mockType, mockPermanent),
    ).rejects.toThrow(
      `Error getting ordered notifications for device ${mockDeviceId}: Connection lost`,
    );
  });
});

const {
  getAllOrderedNotifcationsForDevice,
} = require("../services/notification");

// 5. getAllOrderedNotifcationsForDevice
describe("NotificationService - getAllOrderedNotifcationsForDevice", () => {
  const mockDeviceId = 42;
  const mockType = "LOW_BATTERY";
  const mockPermanent = true;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call OrderedNotifications.findAll with correct filters", async () => {
    // ARRANGE
    const mockData = [{ id: 1, title: "Test Notif" }];
    OrderedNotifications.findAll.mockResolvedValue(mockData);

    // ACT
    const result = await getAllOrderedNotifcationsForDevice(
      mockDeviceId,
      mockType,
    );

    // ASSERT
    expect(OrderedNotifications.findAll).toHaveBeenCalledWith({
      where: {
        deviceId: mockDeviceId,
        type: mockType,
      },
    });
    expect(result).toEqual(mockData);
  });

  it("should return an empty array if no notifications match", async () => {
    // ARRANGE
    OrderedNotifications.findAll.mockResolvedValue([]);

    // ACT
    const result = await getAllOrderedNotifcationsForDevice(
      mockDeviceId,
      "NON_EXISTENT",
    );

    // ASSERT
    expect(result).toEqual([]);
  });

  it("should wrap and throw a custom error if the query fails", async () => {
    // ARRANGE
    const dbError = new Error("Connection lost");
    OrderedNotifications.findAll.mockRejectedValue(dbError);

    // ACT & ASSERT
    await expect(
      getAllOrderedNotifcationsForDevice(mockDeviceId, mockType),
    ).rejects.toThrow(
      `Error getting ordered notifications for device ${mockDeviceId}: Connection lost`,
    );
  });
});

const { descheduleNotifications } = require("../services/notification");

// 6. descheduleNotifications
describe("NotificationService - descheduleNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete scheduled notifications using the notificationId foreign key", async () => {
    // ARRANGE
    const mockId = 500;
    const mockDeletedCount = 3;
    ScheduledNotifications.destroy.mockResolvedValue(mockDeletedCount);

    // ACT
    const result = await descheduleNotifications(mockId);

    // ASSERT
    expect(ScheduledNotifications.destroy).toHaveBeenCalledWith({
      where: { notificationId: mockId },
    });

    // Verify it returns the number of rows deleted
    expect(result).toBe(mockDeletedCount);
  });

  it("should propagate errors if the database operation fails", async () => {
    // ARRANGE
    ScheduledNotifications.destroy.mockRejectedValue(
      new Error("Delete permission denied"),
    );

    // ACT & ASSERT
    await expect(descheduleNotifications(123)).rejects.toThrow(
      "Delete permission denied",
    );
  });
});

// We need to import the service itself to mock its internal methods
const notificationService = require("../services/notification");

// 7. rescheduleNotifications
describe("NotificationService - rescheduleNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // We mock descheduleNotifications specifically
    // to avoid running its logic during this test
    jest
      .spyOn(notificationService, "descheduleNotifications")
      .mockResolvedValue(true);
  });

  it("should find the order, clear old schedules, and create new ones for each device", async () => {
    // 1. ARRANGE
    const mockOrderId = 10;
    const mockUserId = 5;
    const mockOrder = { id: mockOrderId, title: "Re-sync" };
    const mockDevices = [{ id: 101 }, { id: 102 }];

    OrderedNotifications.findByPk.mockResolvedValue(mockOrder);
    Device.findAll.mockResolvedValue(mockDevices);
    ScheduledNotifications.create.mockResolvedValue({});
    ScheduledNotifications.destroy.mockResolvedValue(1);

    // 2. ACT
    await notificationService.rescheduleNotifications(mockOrderId, mockUserId);

    // 3. ASSERT
    // Did it find the right order?
    expect(OrderedNotifications.findByPk).toHaveBeenCalledWith(mockOrderId);

    // check the underlying model call
    expect(ScheduledNotifications.destroy).toHaveBeenCalledWith({
      where: { notificationId: mockOrderId },
    });

    // Did it find the user's devices?
    expect(Device.findAll).toHaveBeenCalledWith({
      where: { userId: mockUserId },
    });

    // Did it create a new notification for EVERY device?
    expect(ScheduledNotifications.create).toHaveBeenCalledTimes(2);
    expect(ScheduledNotifications.create).toHaveBeenNthCalledWith(1, {
      deviceId: 101,
      notificationId: mockOrderId,
    });
    expect(ScheduledNotifications.create).toHaveBeenNthCalledWith(2, {
      deviceId: 102,
      notificationId: mockOrderId,
    });
  });

  it("should throw an error if OrderedNotifications.findByPk fails", async () => {
    OrderedNotifications.findByPk.mockRejectedValue(
      new Error("Order not found"),
    );

    await expect(
      notificationService.rescheduleNotifications(1, 1),
    ).rejects.toThrow("Order not found");
  });
});

const { deleteOrderedNotifications } = require("../services/notification");

// 8. deleteOrderedNotifications
describe("NotificationService - deleteOrderedNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete notifications matching the provided IDs", async () => {
    // ARRANGE
    const ids = [1, 2, 3];
    OrderedNotifications.destroy.mockResolvedValue(3); // Simulate 3 rows deleted

    // ACT
    const result = await deleteOrderedNotifications(ids);

    // ASSERT
    expect(OrderedNotifications.destroy).toHaveBeenCalledWith({
      where: {
        id: { [Op.in]: ids },
      },
    });
    expect(result).toBe(3);
  });

  it("should return 0 when an empty array is provided", async () => {
    // ARRANGE
    OrderedNotifications.destroy.mockResolvedValue(0);

    // ACT
    const result = await deleteOrderedNotifications([]);

    // ASSERT
    expect(OrderedNotifications.destroy).toHaveBeenCalledWith({
      where: {
        id: { [Op.in]: [] },
      },
    });
    expect(result).toBe(0);
  });

  it("should use the default empty array if no argument is passed", async () => {
    // ARRANGE
    OrderedNotifications.destroy.mockResolvedValue(0);

    // ACT
    await deleteOrderedNotifications();

    // ASSERT
    expect(OrderedNotifications.destroy).toHaveBeenCalledWith({
      where: {
        id: { [Op.in]: [] },
      },
    });
  });

  it("should throw an error if the database operation fails", async () => {
    // ARRANGE
    OrderedNotifications.destroy.mockRejectedValue(
      new Error("Constraint violation"),
    );

    // ACT & ASSERT
    await expect(deleteOrderedNotifications([1])).rejects.toThrow(
      "Constraint violation",
    );
  });
});

const { deleteChargeReminder } = require("../services/notification");

// 9. deleteChargeReminder
describe("NotificationService - deleteChargeReminder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete only CHARGEREMINDER types for the specific device", async () => {
    // ARRANGE
    const mockDeviceId = 99;
    OrderedNotifications.destroy.mockResolvedValue(1);

    // ACT
    const result = await deleteChargeReminder(mockDeviceId);

    // ASSERT
    expect(OrderedNotifications.destroy).toHaveBeenCalledWith({
      where: {
        type: "CHARGEREMINDER",
        deviceId: mockDeviceId,
      },
    });
    expect(result).toBe(1);
  });

  it("should return 0 if no matching charge reminder is found", async () => {
    // ARRANGE
    OrderedNotifications.destroy.mockResolvedValue(0);

    // ACT
    const result = await deleteChargeReminder(123);

    // ASSERT
    expect(result).toBe(0);
  });

  it("should throw an error if the database query fails", async () => {
    // ARRANGE
    OrderedNotifications.destroy.mockRejectedValue(new Error("DB Error"));

    // ACT & ASSERT
    await expect(deleteChargeReminder(99)).rejects.toThrow("DB Error");
  });
});

const { createTargetedNotification } = require("../services/notification");

// 10. createTargetedNotification
describe("NotificationService - createTargetedNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock transaction to execute the callback
    sequelize.transaction.mockImplementation(
      async (callback) => await callback("test-t"),
    );
  });

  it("should create an order and a scheduled notification within a transaction", async () => {
    // 1. ARRANGE
    const mockOrder = { id: 500 };
    OrderedNotifications.create.mockResolvedValue(mockOrder);
    ScheduledNotifications.create.mockResolvedValue({});

    // 2. ACT
    await createTargetedNotification(1, "Hello World", "Title");

    // 3. ASSERT
    // Check OrderedNotification creation
    expect(OrderedNotifications.create).toHaveBeenCalledWith(
      {
        deviceId: 1,
        type: "CONTENT",
        content: "Hello World",
        title: "Title",
      },
      { transaction: "test-t" },
    );

    // Check ScheduledNotification creation
    // NOTE: This test will currently fail if you strictly check for the transaction,
    // which is GOOD because it reveals your bug!
    expect(ScheduledNotifications.create).toHaveBeenCalledWith(
      {
        deviceId: 1,
        notificationId: 500,
      },
      { transaction: "test-t" },
    );
  });

  it("should throw an error if the transaction fails", async () => {
    sequelize.transaction.mockRejectedValue(new Error("Transaction Failed"));

    await expect(createTargetedNotification(1, "c", "t")).rejects.toThrow(
      "Transaction Failed",
    );
  });
});

const { deleteScheduledNotifications } = require("../services/notification");

describe("NotificationService - deleteScheduledNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete scheduled notifications with the given ids", async () => {
    // ARRANGE
    const mockScheduledNotificationIds = [1, 2, 3];
    ScheduledNotifications.destroy.mockResolvedValue(3);

    // ACT
    const result = await deleteScheduledNotifications(
      mockScheduledNotificationIds,
    );

    // ASSERT
    expect(ScheduledNotifications.destroy).toHaveBeenCalledWith({
      where: { id: { [Op.in]: mockScheduledNotificationIds } },
    });
    expect(result).toBe(3);
  });
});

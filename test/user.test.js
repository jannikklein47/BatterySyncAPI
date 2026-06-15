// 1. MOCK MODELS FIRST
jest.mock("../models", () => {
  return {
    User: {
      findByPk: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // Mocking other imports found in your service
    Device: {},
    OrderedNotifications: {},
    batteryLogs: {},
    sequelize: { query: jest.fn() },
  };
});

// 2. MOCK BCRYPT
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const userService = require("../services/user");
const { User } = require("../models");
const bcrypt = require("bcryptjs");
const APIError = require("../utils/error");

jest.mock("../utils/error");

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createUser", () => {
    it("should throw error if user already exists", async () => {
      // ARRANGE
      User.findOne.mockResolvedValue({ id: 1, email: "exists@test.com" });
      APIError.errorUserAlreadyExists.mockReturnValue(new Error("Exists"));

      // ACT & ASSERT
      await expect(
        userService.createUser("exists@test.com", "pass123"),
      ).rejects.toThrow("Exists");

      expect(User.create).not.toHaveBeenCalled();
    });

    it("should hash password and create user if email is unique", async () => {
      // ARRANGE
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed_password");
      User.create.mockResolvedValue({ id: 2, email: "new@test.com" });

      // ACT
      await userService.createUser("new@test.com", "pass123", true);

      // ASSERT
      expect(bcrypt.hash).toHaveBeenCalledWith("pass123", 11);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@test.com",
          password: "hashed_password",
          admin: true,
        }),
      );
    });
  });

  describe("validateLogin", () => {
    it("should return true on valid credentials", async () => {
      // ARRANGE
      const mockUser = { email: "user@test.com", password: "hashed_in_db" };
      User.findOne.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      // ACT
      const result = await userService.validateLogin(
        "user@test.com",
        "plain_pass",
      );

      // ASSERT
      expect(bcrypt.compare).toHaveBeenCalledWith("plain_pass", "hashed_in_db");
      expect(result).toBe(true);
    });

    it("should return false if bcrypt.compare throws or returns false", async () => {
      // ARRANGE
      User.findOne.mockResolvedValue({ password: "hash" });
      bcrypt.compare.mockRejectedValue(new Error("Bcrypt Error"));

      // ACT
      const result = await userService.validateLogin("user@test.com", "pass");

      // ASSERT
      expect(result).toBe(false);
    });
  });

  describe("updateUser", () => {
    it("should use errorUserNotFound if update affects 0 rows", async () => {
      // ARRANGE
      User.update.mockResolvedValue([0]);
      APIError.errorUserNotFound.mockReturnValue(new Error("User Not Found"));

      // ACT & ASSERT
      await expect(
        userService.updateUser("none@test.com", { admin: true }),
      ).rejects.toThrow("User Not Found");
    });
  });
});

// 1. MOCK MODELS FIRST to prevent DB connection attempts
jest.mock("../models", () => {
  const mockSequelize = {
    fn: jest.fn((f, ...args) => ({ f, args })),
    col: jest.fn((c) => c),
    literal: jest.fn((l) => l),
    Op: {
      iLike: Symbol("iLike"),
      or: Symbol("or"),
      in: Symbol("in"),
    },
  };
  return {
    issue: {
      findAll: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    Upvotes: { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() },
    Downvotes: { findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() },
    Comments: { findAll: jest.fn(), create: jest.fn(), destroy: jest.fn() },
    User: { findByPk: jest.fn() },
    Sequelize: mockSequelize,
    sequelize: mockSequelize,
    Op: mockSequelize.Op,
  };
});

const issueService = require("../services/issue");
const { issue, Upvotes, Downvotes, Comments } = require("../models");
const { Op } = require("sequelize");
const APIError = require("../utils/error");

jest.mock("../utils/error");

describe("IssueService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getIssues", () => {
    it("should fetch issues and map comments correctly", async () => {
      // ARRANGE
      const mockIssues = [
        { id: 1, title: "Bug 1", "user.email": "test@test.com" },
      ];
      const mockComments = [
        { id: 101, issueId: 1, text: "Fix it!", "User.email": "dev@test.com" },
      ];
      const mockUserId = 1;

      issue.findAll.mockResolvedValue(mockIssues);
      Comments.findAll.mockResolvedValue(mockComments);

      // ACT
      const result = await issueService.getIssues("search", mockUserId);

      // ASSERT
      expect(issue.findAll).toHaveBeenCalled();
      expect(Comments.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { issueId: { [Op.in]: [1] } },
        }),
      );

      // Verify Mapping
      expect(result[0].comments).toHaveLength(1);
      expect(result[0].comments[0].username).toBe("dev@test.com");
    });

    it("should filter by user email if @ is provided", async () => {
      const mockIssues = [
        { id: 1, "user.email": "alice@test.com" },
        { id: 2, "user.email": "bob@test.com" },
      ];
      issue.findAll.mockResolvedValue(mockIssues);
      Comments.findAll.mockResolvedValue([]);

      const result = await issueService.getIssues("@alice");

      expect(result).toHaveLength(1);
      expect(result[0]["user.email"]).toBe("alice@test.com");
    });
  });

  describe("toggleUpvote", () => {
    it("should create an upvote and delete downvote if not already upvoted", async () => {
      // ARRANGE
      Upvotes.findOne.mockResolvedValue(null); // User hasn't upvoted yet

      // ACT
      await issueService.toggleUpvote(1, 99);

      // ASSERT
      expect(Upvotes.create).toHaveBeenCalledWith({ userId: 99, issueId: 1 });
      expect(Downvotes.destroy).toHaveBeenCalledWith({
        where: { issueId: 1, userId: 99 },
      });
    });

    it("should delete both if user has already upvoted", async () => {
      Upvotes.findOne.mockResolvedValue({ id: 1 }); // User HAS upvoted

      await issueService.toggleUpvote(1, 99);

      expect(Upvotes.destroy).toHaveBeenCalled();
      expect(Downvotes.destroy).toHaveBeenCalled();
    });
  });

  describe("updateIssue", () => {
    it("should throw 404 error if no rows updated", async () => {
      issue.update.mockResolvedValue([0]); // Sequelize returns [affectedCount]
      APIError.errorNotFound.mockReturnValue(new Error("Not Found"));

      await expect(
        issueService.updateIssue(1, { title: "New" }),
      ).rejects.toThrow("Not Found");
    });
  });
});

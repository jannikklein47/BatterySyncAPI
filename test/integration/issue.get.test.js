const request = require("supertest");
const express = require("express");
const models = require("../../models");
const issueRouter = require("../../routes/v1.0/issue/getIssue");

const app = express();
app.use(express.json());

// Mock Auth
app.use((req, res, next) => {
  req.user = { id: 1 };
  next();
});

app.use("/issue", issueRouter);

// Error Handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

describe("Issue GET Routes Integration", () => {
  beforeAll(async () => {
    // Force sync to ensure associations are fresh
    await models.sequelize.sync({ force: true });

    const user = await models.User.create({
      id: 1,
      email: "tester@test.com",
      password: "hash",
    });

    // Seed diverse issues for searching
    await models.issue.bulkCreate([
      {
        title: "Battery Drain",
        description: "iOS 17 issue",
        userId: user.id,
        category: 0,
        priority: 0,
        archived: false,
      },
      {
        title: "Screen Flicker",
        description: "Hardware problem",
        userId: user.id,
        category: 0,
        priority: 0,
        archived: false,
      },
      {
        title: "App Crash",
        description: "Crashes on startup",
        userId: user.id,
        category: 0,
        priority: 0,
        archived: false,
      },
    ]);
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("GET /issue", () => {
    it("should return all issues when no search term is provided", async () => {
      const res = await request(app).get("/issue");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
    });

    it("should filter issues based on the search query", async () => {
      // Searching for "Battery"
      const res = await request(app).get("/issue").query({ search: "Battery" });

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe("Battery Drain");
    });

    it("should return an empty array if no issues match the search", async () => {
      const res = await request(app)
        .get("/issue")
        .query({ search: "NonExistentIssue" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("should include associated user data (Eager Loading check)", async () => {
      const res = await request(app).get("/issue");

      // Checking if the IssueService.getIssues included the User model
      if (res.body.length > 0) {
        expect(res.body[0]["user.email"]).toBe("tester@test.com");
      }
    });

    it("should return 400 if search validation fails", async () => {
      // Assuming search validation fails if search is too short or wrong type
      // Adjust this based on your specific ValidationRules.search
      const res = await request(app)
        .get("/issue")
        .query({ search: [23, 1] }); // Sending an array instead of string

      // If your Joi rule allows this, the test will fail, which helps you refine rules!
      expect(res.status).toBe(422);
    });
  });
});

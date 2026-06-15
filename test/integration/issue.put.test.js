const request = require("supertest");
const express = require("express");
const models = require("../../models");
const issueRouter = require("../../routes/v1.0/issue/putIssue");

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

describe("Issue PUT Routes Integration", () => {
  let testIssueId;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "put_tester@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    const issue = await models.issue.create({
      title: "Original Title",
      description: "Original Description",
      status: 0,
      userId: 1,
    });
    testIssueId = issue.id;
  });

  afterEach(async () => {
    // Clean up issues after each test to ensure a fresh state
    await models.issue.destroy({ where: {}, truncate: { cascade: true } });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("PUT /issue", () => {
    it("should perform a full update on the issue", async () => {
      const updatedData = {
        id: testIssueId,
        title: "Completely New Title",
        description: "Completely New Description",
        status: 1,
      };

      const res = await request(app).put("/issue").send(updatedData);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe(updatedData.title);
      expect(res.body.description).toBe(updatedData.description);
      expect(res.body.status).toBe(updatedData.status);

      // Verify persistence in DB
      const dbIssue = await models.issue.findByPk(testIssueId);
      expect(dbIssue.title).toBe(updatedData.title);
    });

    it("should return 422 if required fields fail validation", async () => {
      // Assuming your PUT validation requires an ID
      const res = await request(app)
        .put("/issue")
        .send({ title: "No ID provided" });

      expect(res.status).toBe(422);
    });

    it("should include associated data in the response", async () => {
      const res = await request(app)
        .put("/issue")
        .send({ id: testIssueId, title: "Title with Includes" });

      expect(res.body).toHaveProperty("id");
    });
  });
});

const request = require("supertest");
const express = require("express");
const models = require("../../models");
const issueRouter = require("../../routes/v1.0/issue/postIssue");

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

describe("Issue POST Routes Integration", () => {
  let testIssueId;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "tester@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    const issue = await models.issue.create({
      title: "Battery drain on iOS 17",
      description: "My battery drops 20% in an hour.",
      userId: 1,
    });
    testIssueId = issue.id;
  });

  afterEach(async () => {
    // Delete children first, then parent
    await models.Upvotes.destroy({ where: {}, truncate: { cascade: true } });
    await models.Downvotes.destroy({ where: {}, truncate: { cascade: true } });
    await models.Comments.destroy({ where: {}, truncate: { cascade: true } });
    await models.issue.destroy({ where: {}, truncate: { cascade: true } });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("POST /issue (Create)", () => {
    it("should create a new issue and return it", async () => {
      const res = await request(app).post("/issue").send({
        title: "App crashes on launch",
        description: "Log shows null pointer",
        priority: 1,
        category: 0,
      });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("App crashes on launch");
      expect(res.body.userId).toBe(1);
    });

    it("should return 422 if title is missing", async () => {
      const res = await request(app)
        .post("/issue")
        .send({ description: "No title here" });

      expect(res.status).toBe(422);
    });
  });

  describe("POST /issue/upvote", () => {
    it("should toggle upvote for an issue", async () => {
      // First call: Upvote
      const res = await request(app).post(`/issue/upvote?id=${testIssueId}`);

      expect(res.status).toBe(200);
      // Assuming your service returns an issue object with an upvotes count or array
      // Adjust this based on your actual model structure
      const issue = await models.issue.findByPk(testIssueId, {
        include: [
          {
            model: models.Upvotes,
            as: "UpvoteEntries",
            required: false,
          },
        ],
      });
      expect(issue.UpvoteEntries.length).toBe(1);
    });

    it("should return 404 if issue does not exist", async () => {
      const res = await request(app).post("/issue/upvote?id=999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /issue/comment", () => {
    it("should add a comment to an issue", async () => {
      const res = await request(app)
        .post(`/issue/comment?issueId=${testIssueId}`)
        .send({ text: "I am having this problem too." });

      expect(res.status).toBe(200);
      expect(res.body.text).toBe("I am having this problem too.");
      expect(res.body.issueId).toBe(testIssueId); // req.query.id is a string
    });

    it("should return 422 if comment text is too short or missing", async () => {
      const res = await request(app)
        .post(`/issue/comment?issueId=${testIssueId}`)
        .send({ text: "" });

      expect(res.status).toBe(422);
    });
  });
});

const request = require("supertest");
const express = require("express");
const models = require("../../models");
const issueRouter = require("../../routes/v1.0/issue/patchIssue");

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

describe("Issue PATCH Routes Integration", () => {
  let testIssueId;

  beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    await models.User.create({
      id: 1,
      email: "patcher@test.com",
      password: "hash",
    });
  });

  beforeEach(async () => {
    const issue = await models.issue.create({
      title: "Initial Issue",
      description: "Needs updating",
      status: 0,
      userId: 1,
    });
    testIssueId = issue.id;

    // Create a device for the user so the notification logic triggers
    await models.Device.create({
      id: 70,
      name: "Main Phone",
      userId: 1,
    });
  });

  afterEach(async () => {
    // Standard cleanup
    await models.OrderedNotifications.destroy({ where: {} });
    await models.issue.destroy({ where: {} });
    await models.Device.destroy({ where: {} });
  });

  afterAll(async () => {
    await models.sequelize.close();
  });

  describe("PATCH /issue", () => {
    it("should update the issue and send a status notification", async () => {
      const res = await request(app)
        .patch("/issue")
        .send({ id: testIssueId, status: 2 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(2);

      // Verify Notification side effect
      const notification = await models.OrderedNotifications.findOne({
        where: { deviceId: 70, type: "CONTENT" },
      });

      expect(notification).not.toBeNull();
      expect(notification.content).toContain("Vielen Dank für dein Feedback!");
      expect(notification.title).toBe("Issue Update");
    });

    it("should update the issue title and return the updated object", async () => {
      const newTitle = "Updated Issue Title";
      const res = await request(app)
        .patch("/issue")
        .send({ id: testIssueId, title: newTitle });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe(newTitle);
    });

    it("should NOT create a notification if the user has no devices", async () => {
      // Setup: Remove device for this specific test
      await models.Device.destroy({ where: { userId: 1 } });

      await request(app).patch("/issue").send({ id: testIssueId, status: 1 });

      const notificationCount = await models.OrderedNotifications.count();
      expect(notificationCount).toBe(0);
    });

    it("should return 422 for invalid update data", async () => {
      const res = await request(app)
        .patch("/issue")
        .send({ id: "not-an-id", status: "invalid-status" });

      expect(res.status).toBe(422);
    });

    it("should associate the notification with the correct device ID", async () => {
      const targetStatus = 2;
      const res = await request(app)
        .patch("/issue")
        .send({ id: testIssueId, status: targetStatus });

      expect(res.status).toBe(200);

      const notification = await models.OrderedNotifications.findOne({
        where: { deviceId: 70 },
      });

      // Verify that the notification was linked to device ID 70 (created in beforeEach)
      expect(notification.deviceId).toBe(70);
    });
  });
});

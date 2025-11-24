const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

const { Op } = require("sequelize");

const Issue = models.issue;
const Users = models.User;
const router = express.Router();

const log = require("../services/logsystem");

router.get("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const result = await Issue.findAll();
      res.send(result);
      log(
        null,
        "/issue",
        "GET",
        req.rawBodySize,
        new Blob([JSON.stringify(result)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "GET", req.rawBodySize, 0, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const data = req.body;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const created = await Issue.create(data);

      res.send(created);
      log(
        null,
        "/issue",
        "POST",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "POST", req.rawBodySize, 0, error);
  }
});

router.patch("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const data = req.body;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const issue = await Issue.findByPk(data.id);
      delete data.id;
      await issue.update(data);

      res.send(issue);
      log(
        null,
        "/issue",
        "PATCH",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "PATCH", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "PATCH", req.rawBodySize, 0, error);
  }
});

router.delete("/", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const id = req.query.id;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      const deleted = await Issue.destroy({ where: { id: id } });

      res.send(deleted);
      log(
        null,
        "/issue",
        "DELETE",
        req.rawBodySize,
        new Blob([JSON.stringify(created)]).size
      );
    } else {
      res.status(403).send("Invalid access token");
      log("Access denied", "/issue", "DELETE", req.rawBodySize, 0);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/issue", "DELETE", req.rawBodySize, 0, error);
  }
});

module.exports = router;

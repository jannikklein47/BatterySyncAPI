const express = require("express");
const models = require("../models");
const bcrypt = require("bcryptjs");

const log = require("../services/logsystem");

const users = models.User;

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let email, password;

    if (req.body && req.body.password && req.body.email) {
      email = req.body.email;
      password = req.body.password;
    } else if (req.query && req.query.password && req.query.email) {
      email = req.query.email;
      password = req.query.password;
    }

    if (!password || !email) {
      res.status(400).send("Invalid request");
      log("Invalid request", "/login", "POST", req.rawBodySize, 0);
      return;
    }

    let existingUser;
    if ((existingUser = await users.findOne({ where: { email: email } }))) {
      //res.status(403).send("User already exists.");

      try {
        let access = bcrypt.compareSync(
          password,
          existingUser.dataValues.password
        );

        if (access) {
          res.send(existingUser.dataValues.password);
          log(
            null,
            "/login",
            "POST",
            req.rawBodySize,
            new Blob([JSON.stringify(existingUser.dataValues.password)]).size
          );
          return;
        } else {
          res.status(403).send("Wrong credentials.");
          log("Access denied", "/login", "POST", req.rawBodySize, 0);
        }
      } catch (error) {
        res.status(403).send("Wrong credentials.");
        log("Access denied", "/login", "POST", req.rawBodySize, 0);
      }

      return;
    }

    const hashedPw = await bcrypt.hash(password, 11);

    const user = await users.create({
      email: email,
      password: hashedPw,
    });

    res.send(hashedPw);
    log(
      null,
      "/login",
      "POST",
      req.rawBodySize,
      new Blob([JSON.stringify(hashedPw)]).size
    );
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log("Internal Server Error", "/login", "POST", req.rawBodySize, 0, error);
  }
});

router.get("/auth", async (req, res) => {
  try {
    if (req.headers.authorization) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        //console.log("Acces granted for user ", user)
        res.send(user.email);
        log(
          null,
          "/login/auth",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(user.email)]).size
        );
      } else {
        res.status(403).send("Invalid access token");
        log("Access denied", "/login/auth", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(400).send("Bad request");
      log("Access denied", "/login/auth", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/auth",
      "GET",
      req.rawBodySize,
      0,
      error
    );
  }
});

router.put("/user", async (req, res) => {
  try {
    if (req.query.email && req.query.password && req.query.masterkey) {
      if (req.query.masterkey !== "ahibUZ787tfgIUvfvgfd333") {
        res.status(403).send("Wrong masterkey");
        log("Access denied", "/login/user", "PUT", req.rawBodySize, 0);
        return;
      }
      let encrypted = await bcrypt.hash(req.query.password, 11);
      await users.update(
        {
          password: encrypted,
        },
        {
          where: { email: req.query.email },
        }
      );
      res.send("Ok");
      log(null, "/login/user", "PUT", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/user",
      "PUT",
      req.rawBodySize,
      0,
      error
    );
  }
});

module.exports = router;

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
    } else {
      res.status(400).send("Invalid request");
      log(
        "Invalid request",
        "/login",
        "POST",
        req.socket.bytesRead,
        res.socket.bytesWritten
      );
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
            _,
            "/login",
            "POST",
            req.socket.bytesRead,
            res.socket.bytesWritten
          );
          return;
        } else {
          res.status(403).send("Wrong credentials.");
          log(
            "Access denied",
            "/login",
            "POST",
            req.socket.bytesRead,
            res.socket.bytesWritten
          );
        }
      } catch (error) {
        res.status(403).send("Wrong credentials.");
        log(
          "Access denied",
          "/login",
          "POST",
          req.socket.bytesRead,
          res.socket.bytesWritten
        );
      }

      return;
    }

    const hashedPw = await bcrypt.hash(password, 11);

    const user = await users.create({
      email: email,
      password: hashedPw,
    });

    res.send(hashedPw);
    log(_, "/login", "POST", req.socket.bytesRead, res.socket.bytesWritten);
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/login",
      "POST",
      req.socket.bytesRead,
      res.socket.bytesWritten,
      error.message
    );
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
          _,
          "/login/auth",
          "GET",
          req.socket.bytesRead,
          res.socket.bytesWritten
        );
      } else {
        res.status(403).send("Invalid access token");
        log(
          "Access denied",
          "/login/auth",
          "GET",
          req.socket.bytesRead,
          res.socket.bytesWritten
        );
      }
    } else {
      res.status(400).send("Bad request");
      log(
        "Access denied",
        "/login/auth",
        "GET",
        req.socket.bytesRead,
        res.socket.bytesWritten
      );
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/auth",
      "GET",
      req.socket.bytesRead,
      res.socket.bytesWritten,
      error.message
    );
  }
});

router.put("/user", async (req, res) => {
  try {
    if (req.query.email && req.query.password && req.query.masterkey) {
      if (req.query.masterkey !== "ahibUZ787tfgIUvfvgfd333") {
        res.status(403).send("Wrong masterkey");
        log(
          "Access denied",
          "/login/user",
          "PUT",
          req.socket.bytesRead,
          res.socket.bytesWritten
        );
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
      log(
        _,
        "/login/user",
        "PUT",
        req.socket.bytesRead,
        res.socket.bytesWritten
      );
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/user",
      "PUT",
      req.socket.bytesRead,
      res.socket.bytesWritten,
      error.message
    );
  }
});

module.exports = router;

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
        let access = bcrypt.compareSync(password, existingUser.password);

        if (access) {
          res.send(existingUser.password);
          log(
            null,
            "/login",
            "POST",
            req.rawBodySize,
            new Blob([JSON.stringify(existingUser.password)]).size,
            existingUser.id
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
    } else {
      res.status(404).send("User does not exist.");
      log("Access denied", "/login", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/login",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.post("/web", async (req, res) => {
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
        let access = bcrypt.compareSync(password, existingUser.password);
        const data = JSON.parse(JSON.stringify(existingUser));
        delete data.password;
        if (access) {
          const result = { token: existingUser.password, data: data };
          res.send(result);
          log(
            null,
            "/login",
            "POST",
            req.rawBodySize,
            new Blob([JSON.stringify(result)]).size,
            existingUser.id
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
    } else {
      res.status(404).send("User does not exist.");
      log("Access denied", "/login", "POST", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/login",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.post("/register", async (req, res) => {
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
      res.status(403).send("User already exists.");
      log("Access denied", "/login/register", "POST", req.rawBodySize, 0);

      return;
    }

    if ((password || "").length < 8) {
      res.status(403).send("Password must be at least 8 characters long.");
      log("Access denied", "/login/register", "POST", req.rawBodySize, 0);

      return;
    }
    if ((email || "").length < 4) {
      res.status(403).send("Username must be at least 4 characters long.");
      log("Access denied", "/login/register", "POST", req.rawBodySize, 0);

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
      new Blob([JSON.stringify(hashedPw)]).size,
      user.id
    );
  } catch (error) {
    res.status(500).send("Internal Server Error");
    log(
      "Internal Server Error",
      "/login",
      "POST",
      req.rawBodySize,
      0,
      null,
      error
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
          null,
          "/login/auth",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(user.email)]).size,
          user.id
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
      null,
      error
    );
  }
});

router.get("/admin", async (req, res) => {
  try {
    if (req.headers.authorization) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        //console.log("Acces granted for user ", user)
        res.send(user.admin);
        log(
          null,
          "/login/admin",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(user.admin)]).size,
          user.id
        );
      } else {
        res.status(403).send("Invalid access token");
        log("Access denied", "/login/admin", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(400).send("Bad request");
      log("Access denied", "/login/admin", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/admin",
      "GET",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

router.get("/userId", async (req, res) => {
  try {
    if (req.headers.authorization) {
      let user;
      if (
        (user = await users.findOne({
          where: { password: req.headers.authorization },
        }))
      ) {
        //console.log("Acces granted for user ", user)
        res.send(user.id);
        log(
          null,
          "/login/userId",
          "GET",
          req.rawBodySize,
          new Blob([JSON.stringify(user.id)]).size,
          user.id
        );
      } else {
        res.status(403).send("Invalid access token");
        log("Access denied", "/login/userId", "GET", req.rawBodySize, 0);
      }
    } else {
      res.status(400).send("Bad request");
      log("Access denied", "/login/userId", "GET", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/userId",
      "GET",
      req.rawBodySize,
      0,
      null,
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
      null,
      error
    );
  }
});

router.patch("/user", async (req, res) => {
  try {
    if (req.query.email && req.query.masterkey) {
      if (req.query.masterkey !== process.env.ADMIN_ACCESS) {
        res.status(403).send("Wrong admin code");
        log("Access denied", "/login/user", "PATCH", req.rawBodySize, 0);
        return;
      }
      await users.update(req.body, {
        where: { email: req.query.email },
      });
      res.send("Ok");
      log(null, "/login/user", "PATCH", req.rawBodySize, 0);
    }
  } catch (error) {
    res.status(500).send("Internal server error");
    log(
      "Internal Server Error",
      "/login/user",
      "PATCH",
      req.rawBodySize,
      0,
      null,
      error
    );
  }
});

module.exports = router;

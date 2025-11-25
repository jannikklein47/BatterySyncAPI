const express = require("express");
const models = require("../models");

const Users = models.User;
const router = express.Router();

router.get("/android", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    const user = await Users.findOne({ where: { password: auth } });
    if (user) {
      res.sendFile("../batterysync-android.apk");
    } else {
      res.status(403).send("Invalid access token");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;

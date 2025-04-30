const express = require("express");
const models = require("../models");
const bcrypt = require("bcrypt");

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
            res.status(400).send("Invalid request")
            return
        }

        let existingUser;
        if (existingUser = await users.findOne({where: {email: email}})) {
            //res.status(403).send("User already exists.");
            console.log("Found user for login: ", existingUser);

            if (await bcrypt.compare(password, existingUser.password)) {
                res.send(existingUser.password);
                return
            } else {
                res.status(403).send("Wrong credentials.")
            }

            return;
        }

        const hashedPw = await bcrypt.hash(password, 11);

        const user = await users.create({
            email: email,
            password: hashedPw,
        })

        res.send(hashedPw);

    } catch (error) {
        console.log("Fehler: ", error);
        res.status(500).send("Internal Server Error");
    }

    
})

router.get("/auth", async (req, res) => {
    try {
        if (req.headers.authorization) {
            let user;
            if (user = await users.findOne({where: {password: req.headers.authorization}})) {
                //console.log("Acces granted for user ", user)
                res.send(user.email);
            } else {
                console.log("User not found")
                res.status(403).send("Invalid access token");
            }
        } else {
            console.log("The auth req is wrong")
            res.status(400).send("Bad request")
        }
        
    } catch (error) {
        res.status(500).send("Internal server error")
        console.log(error)
    }
})

router.put("/user", async (req, res) => {
    try {
        if (req.query.email && req.query.password && req.query.masterkey) {
            if (masterkey !== "ahibUZ787tfgIUvfvgfd333") {
                res.status(403).send("Wrong masterkey");
                return;
            }
            let encrypted = await bcrypt.hash(req.query.password, 11);
            await users.update({
                password: encrypted
            }, {
                where: { email: req.query.email}
            })
            res.send("Ok");
        }
    } catch (error) {
        console.log(error)
        res.status(500).send("Internal server error")
    }
})

module.exports = router
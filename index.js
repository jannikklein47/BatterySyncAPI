require("dotenv").config();

const cors = require("cors");

const express = require("express");
const routes = require("./routes");
const db = require("./models");
const fs = require("fs");
const path = require("path");
const https = require("https");

const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;

app.use(cors());
let corsOptions = {
  origin: "*",
  optionSuccessStatus: 200,
  methods: ["GET", "PUT", "POST", "DELETE"],
};

app.use(cors(corsOptions));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 1000, // 20 seconds
  max: 7, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
});

app.use(limiter);

app.use((req, res, next) => {
  req.rawBodySize = new Blob([
    JSON.stringify(req.query) + JSON.stringify(req.body),
  ]).size;
  next();
});

app.use(routes);

// When creating the SSL certificates, they need to be moved to home/ssl/batterysync!
const certPath = "/etc/ssl/batterysync";

let options;
try {
  options = {
    key: fs.readFileSync(`${certPath}/privkey.pem`),
    cert: fs.readFileSync(`${certPath}/fullchain.pem`),
  };
  console.log("✅ SSL certificates loaded.");
} catch (err) {
  console.error(
    "⚠️  SSL certificates not found, starting HTTP server instead.",
    err.message
  );
  options = null;
}

let server;
if (options) {
  const https = require("https");
  server = https.createServer(options, app);
} else {
  const http = require("http");
  server = http.createServer(app);
}

db.sequelize
  .sync()
  .then(() => {
    console.log("✅ Datenbank synchronisiert");
    server.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Fehler bei DB-Sync:", err);
  });

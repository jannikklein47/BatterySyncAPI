const dotenv = require("dotenv");
dotenv.config();
const Logger = require("./utils/logger");
const http = require("http");
const https = require("https");
const app = require("./app");
const cleanupJob = require("./jobs/notificationCleanup");
const reminderJob = require("./jobs/offlineReminder");
const port = process.env.PORT || 3000;
const fs = require("fs");
let server;

/**
 * Error handeling for the http server connection
 * @name onError
 * @listens error
 */
let onError = (error) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  switch (error.code) {
    case "EACCESS":
      Logger.error(`${port} requires priviliges rights`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      Logger.error(`${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
};
/**
 * Gives info about the connection when the connection is established
 * @name onListening
 * @listens listening
 */
let onListening = () => {
  let addr = server.address();
  Logger.info(`Server is listening at ${addr.address} :${addr.port}`);
  cleanupJob();
  reminderJob();
};

// Path of SSL ceritificates
const certPath = "/etc/ssl/batterysync";

let options;
try {
  options = {
    key: fs.readFileSync(`${certPath}/privkey.pem`),
    cert: fs.readFileSync(`${certPath}/fullchain.pem`),
  };
  Logger.info("✅ SSL certificates loaded.");
} catch (err) {
  Logger.error(
    "⚠️  SSL certificates not found, starting HTTP server instead.",
    err.message,
  );
  options = null;
}

if (options) {
  server = https
    .createServer(options, app)
    /**
     * @event error
     */
    .on("error", onError)
    /**
     * @event onListening
     */
    .on("listening", onListening)
    .listen({
      port: port,
    });
} else {
  server = http
    .createServer(app)
    /**
     * @event error
     */
    .on("error", onError)
    /**
     * @event onListening
     */
    .on("listening", onListening)
    .listen({
      port: port,
    });
}

module.exports = server;

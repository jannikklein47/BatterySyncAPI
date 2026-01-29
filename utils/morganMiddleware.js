"use strict";

const morgan = require("morgan");
const Logger = require("./logger");

var stream = {
  write: function (message) {
    return Logger.http(message.substring(0, message.lastIndexOf("\n")));
  },
};
var morganMiddleware = morgan(
  function (tokens, req, res) {
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens.res(req, res, "content-length"),
      "-",
      tokens["response-time"](req, res),
      "ms",
      req.user ? ` - User (${req.user.id}): ${req.user.email}` : "",
    ].join(" ");
  },

  ":method :url :status :res[content-length] - :response-time ms",
  { stream: stream },
);

module.exports = morganMiddleware;

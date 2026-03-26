"use strict";

const morgan = require("morgan");
const Logger = require("./logger");

"".padEnd(8, " ");
"".substring(0, 8);

var stream = {
  write: function (message) {
    return Logger.http(message.substring(0, message.lastIndexOf("\n")));
  },
};
var morganMiddleware = morgan(
  function (tokens, req, res) {
    return [
      tokens.method(req, res)?.padEnd(8, " ").substring(0, 8),
      tokens.status(req, res),
      tokens.url(req, res)?.padEnd(70, " ").substring(0, 70),
      (tokens.res(req, res, "content-length") || "0")
        .toString()
        .padEnd(11, " ")
        .substring(0, 11),
      tokens["response-time"](req, res)?.padEnd(8, " ").substring(0, 8),
      "ms",
      req.user ? `User (${req.user.id}): ${req.user.email}` : "",
    ].join(" ");
  },
  { stream: stream },
);

module.exports = morganMiddleware;

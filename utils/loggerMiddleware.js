const models = require("../models");
const Logs = models.logs;

const loggerMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on("finish", async () => {
    const requestBodySize = req.get("content-length") || 0;
    const requestHeaderSize = req.headersRaw
      ? JSON.stringify(req.headers).length
      : 0;

    const logData = {
      method: req.method,
      route: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      resSize: res.get("Content-Length") || 0,
      reqSize: parseInt(requestBodySize) + parseInt(requestHeaderSize),
      userId: req.user?.id || null,
      error:
        res.locals.error || req.error || res.statusCode >= 400
          ? res.statusMessage
          : null,
      duration: Date.now() - start,
    };

    await Logs.create(logData);
  });

  next();
};

module.exports = loggerMiddleware;

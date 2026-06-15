const v1_0 = require("./v1.0/v1Router");
const APIError = require("../utils/error");
const express = require("express");
const router = express.Router();
const Logger = require("../utils/logger");

module.exports = (app) => {
  router.use(v1_0);
  router.use(error404);
  router.use(errorHandler);

  app.use(router);
};

const error404 = (req, res, next) => {
  next(APIError.errorNotFound());
};

const errorHandler = (error, req, res, next) => {
  Logger.error(
    `${error.message}: responding with ${
      error.statusCode || 500
    } / success => ${error.success || false} | ${process.env.NODE_ENV !== "production" ? error.stack : "-"}`,
  );
  if (process.env.NODE_ENV !== "development") {
    delete error.stack;
  }
  res.status(error.statusCode || 500).send(error);
};

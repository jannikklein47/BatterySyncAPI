const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morganMiddleware = require("./utils/morganMiddleware");
const loggerMiddleware = require("./utils/loggerMiddleware");

const app = express();

let corsOptions = {
  origin: "*",
  optionSuccessStatus: 200,
  methods: ["GET", "PUT", "PATCH", "POST", "DELETE"],
};

app.use(helmet());
app.use(morganMiddleware);
app.use(loggerMiddleware);
app.use(cors(corsOptions));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 10000,
  max: 50,
});

app.use(limiter);

require("./models");
require("./routes")(app);

module.exports = app;

const express = require("express");
const ValidationRules = require("./validations");
const APIError = require("../../../utils/error");
const IssueService = require("../../../services/issue");
const NotificationService = require("../../../services/notification");
const DeviceService = require("../../../services/device");
const UserService = require("../../../services/user");
const router = express.Router();

// Register routes
router.post("/register", async (req, res, next) => {
  try {
    const validationEmail = ValidationRules.email.validate(
      req.query.email || req.body.email,
    );
    const validationPassword = ValidationRules.password.validate(
      req.query.password || req.body.password,
    );
    if (validationEmail.error)
      return next(APIError.errorValidation(validationEmail.error.message));
    if (validationPassword.error)
      return next(APIError.errorValidation(validationPassword.error.message));

    const user = await UserService.createUser(
      req.query.email || req.body.email,
      req.query.password || req.body.password,
      false,
      false,
    );

    return res.send(user.password);
  } catch (error) {
    return next(error);
  }
});

router.post("/register/web", async (req, res, next) => {
  try {
    const validationEmail = ValidationRules.email.validate(
      req.query.email || req.body.email,
    );
    const validationPassword = ValidationRules.password.validate(
      req.query.password || req.body.password,
    );
    if (validationEmail.error)
      return next(APIError.errorValidation(validationEmail.error.message));
    if (validationPassword.error)
      return next(APIError.errorValidation(validationPassword.error.message));

    const user = await UserService.createUser(
      req.query.email || req.body.email,
      req.query.password || req.body.password,
      false,
      false,
    );
    const hash = user.password;
    delete user.password;

    return res.send({ token: hash, data: user });
  } catch (error) {
    return next(error);
  }
});

// Login routes
router.post("/", async (req, res, next) => {
  try {
    const validationEmail = ValidationRules.string.validate(
      req.query.email || req.body.email,
    );
    const validationPassword = ValidationRules.string.validate(
      req.query.password || req.body.password,
    );

    if (validationEmail.error)
      return next(APIError.errorValidation(validationEmail.error.message));
    if (validationPassword.error)
      return next(APIError.errorValidation(validationPassword.error.message));

    if (
      await UserService.validateLogin(
        req.query.email || req.body.email,
        req.query.password || req.body.password,
      )
    ) {
      const user = await UserService.getUserByEmail(
        req.query.email || req.body.email,
      );
      return res.send(user.password);
    } else {
      return next(APIError.errorWrongCredentials());
    }
  } catch (error) {
    return next(error);
  }
});
router.post("/web", async (req, res, next) => {
  try {
    const validationEmail = ValidationRules.string.validate(
      req.query.email || req.body.email,
    );
    const validationPassword = ValidationRules.string.validate(
      req.query.password || req.body.password,
    );

    if (validationEmail.error)
      return next(APIError.errorValidation(validationEmail.error.message));
    if (validationPassword.error)
      return next(APIError.errorValidation(validationPassword.error.message));

    if (
      await UserService.validateLogin(
        req.query.email || req.body.email,
        req.query.password || req.body.password,
      )
    ) {
      const user = await UserService.getUserByEmail(
        req.query.email || req.body.email,
      );
      const hash = user.password;
      delete user.password;
      return res.send({ token: hash, data: user });
    } else {
      return next(APIError.errorWrongCredentials());
    }
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

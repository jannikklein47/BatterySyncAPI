const APIError = require("./error");
const models = require("../models");
const User = models.User;

/**
 * Middleware to verify the token passed in the Authorization header.
 * If the token is valid, it sets the req.user property to the corresponding User object.
 * If the token is invalid or missing, it returns an APIError with a 401 status code.
 * @function
 * @returns {Function} Middleware function to verify the token.
 */
const verifyToken = (optional = false) => {
  return async (req, res, next) => {
    try {
      let token = req.headers["authorization"];
      if (token) {
        const user = await User.findOne({ where: { password: token } });
        if (!user && !optional) {
          return next(APIError.errorTokenMalformed());
        } else if (optional === "optional" && user) {
          req.user = user;
          return next();
        } else if (optional === "optional" && !user) {
          return next();
        }
        req.user = user;
        return next();
      } else {
        if (optional === "optional") {
          return next();
        } else return next(APIError.errorTokenMissing());
      }
    } catch (error) {
      return next(new APIError(error.message, 401));
    }
  };
};

module.exports = {
  verifyToken,
};

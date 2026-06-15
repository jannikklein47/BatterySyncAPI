const joi = require("joi");

module.exports = {
  password: joi.string().min(8).required(),
  email: joi.string().min(4).required(),
  string: joi.string().required(),
};

const joi = require("joi");

module.exports = {
  notes: joi.string().required(),
};

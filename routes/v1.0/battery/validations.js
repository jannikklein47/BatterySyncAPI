const joi = require("joi");

module.exports = {
  id: joi.number().required(),
  favorite: joi.boolean().required(),
  system: joi.string().valid("phone", "laptop").required(),
  battery: joi.number().min(0).max(1.0),
  chargingStatus: joi.boolean().required(),
  isPluggedIn: joi.boolean().required(),
  otp: joi.string().length(6).required(),
  name: joi.string().min(2).required(),
  isShown: joi.boolean().required(),
  optionalUUID: joi.string().uuid({ version: ["uuidv4"] }),
  uuid: joi
    .string()
    .uuid({ version: ["uuidv4"] })
    .required(),
};

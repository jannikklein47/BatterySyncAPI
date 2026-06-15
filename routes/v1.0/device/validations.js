const joi = require("joi");

module.exports = {
  id: joi.number().required(),
  favorite: joi.boolean().required(),
  system: joi.string().valid("phone", "laptop").required(),
  battery: joi.number().min(0).max(1.0),
  otp: joi.string().length(6).required(),
  name: joi.string().min(2).required(),
  isShown: joi.boolean().required(),
  getsRegularReminder: joi.boolean().required(),
  uuid: joi
    .string()
    .uuid({ version: ["uuidv4"] })
    .required(),
  optionalUUID: joi.string().uuid({ version: ["uuidv4"] }),
  buildNumber: joi.string().alphanum(),
};

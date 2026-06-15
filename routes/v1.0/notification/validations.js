const joi = require("joi");

module.exports = {
  id: joi.number().required(),
  favorite: joi.boolean().required(),
  system: joi.string().valid("phone", "laptop").required(),
  battery: joi.number().min(0).max(1.0),
  otp: joi.string().length(6).required(),
  name: joi.string().min(2).required(),
  isShown: joi.boolean().required(),
  optionalUUID: joi.string().uuid({ version: ["uuidv4"] }),
  uuid: joi
    .string()
    .uuid({ version: ["uuidv4"] })
    .required(),

  permanent: joi.boolean(),
  type: joi.string().valid("CHARGEREMINDER", "CONTENT"),
  title: joi.string(),
  content: joi.string(),
  url: joi.string().uri(),
  users: joi.alternatives().try(
    joi.string().valid("all"),

    joi.string().custom((val, helpers) => {
      try {
        const parsed = JSON.parse(val);

        if (!Array.isArray(parsed)) {
          return helpers.error("any.invalid");
        }
        return val;
      } catch (error) {
        if (val.includes("build")) {
          return val;
        }
        return helpers.error("any.invalid");
      }
    }, "JSON Array Validation"),
  ),
};

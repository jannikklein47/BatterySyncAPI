const joi = require("joi");

module.exports = {
  search: joi.string().allow("", null),
  issue: joi.object({
    id: joi.forbidden(),
    userId: joi.forbidden(),
    createdAt: joi.forbidden(),
    updatedAt: joi.forbidden(),
    status: joi.forbidden(),
    archived: joi.forbidden(),
    title: joi.string().required(),
    description: joi.string().required(),
    status: joi.number(),
    priority: joi.number().required(),
    category: joi.number().required(),
    notify: joi.boolean(),
  }),
  id: joi.number(),
  text: joi.string(),
  updateIssue: joi.object({
    id: joi.number().required(),
    userId: joi.forbidden(),
    createdAt: joi.forbidden(),
    updatedAt: joi.forbidden(),
    status: joi.forbidden(),
    archived: joi.forbidden(),
    title: joi.string(),
    description: joi.string(),
    status: joi.number(),
    priority: joi.number(),
    category: joi.number(),
  }),
};

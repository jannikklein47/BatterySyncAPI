const MetricService = require("../../../services/metrics");
const AndroidUpdateService = require("../../../services/androidUpdate");
const express = require("express");
const models = require("../../../models");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const APIError = require("../../../utils/error");
const ValidationRules = require("./validations");

router.patch("/updates/android/:build", async (req, res) => {
  try {
    const validationNotes = ValidationRules.notes.validate(req.body.notes);
    if (validationNotes.error)
      return next(APIError.errorValidation(validationNotes.error.message));

    const update = await models.AndroidUpdate.findOne({
      where: { build: req.params.build },
    });

    if (!update) return next(APIError.errorNotFound());

    await update.update({ notes: req.body.notes });

    res.send(update);
  } catch (error) {
    if (error.statusCode) return next(error);
    return next(APIError.errorUnknown());
  }
});

module.exports = router;

const models = require("../models");
const logs = models.logs;

module.exports = async function (
  text = null,
  route = null,
  method = null,
  reqSize = null,
  resSize = null,
  error = null
) {
  let builder =
    "" +
    new Date(Date.now()).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  if (method) builder += " " + method.toUpperCase();
  if (route) builder += " | " + route;
  if (reqSize) builder += " Req: " + reqSize;
  if (resSize) builder += " Res: " + resSize;
  if (text) builder += " | " + text;
  if (error) builder += " | " + error;

  if (error) {
    console.error(builder);
  } else {
    console.log(builder);
  }

  await logs.create({
    text: text,
    route: route,
    method: method,
    reqSize: reqSize,
    resSize: resSize,
    error: error,
  });
};

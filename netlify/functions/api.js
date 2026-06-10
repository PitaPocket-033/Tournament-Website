const serverless = require("serverless-http");
const app = require("../../Backend/server");

exports.handler = serverless(app, {
  basePath: "/api",
});

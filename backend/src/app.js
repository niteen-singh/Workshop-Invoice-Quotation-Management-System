const express = require("express");
const healthRouter = require("./routes/health");
const costomeRouter = require("./routes/coustomer");

const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(express.json());
app.use("/", healthRouter);
app.use("/cust/", costomeRouter);

module.exports = app;

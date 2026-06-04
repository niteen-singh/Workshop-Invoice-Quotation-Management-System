const express = require("express");
const profileRouter = require("./routes/profile");
const invoicesRouter = require("./routes/invoices");
const healthRouter = require("./routes/health");
const costomeRouter = require("./routes/coustomer");
const quotationsRouter = require("./routes/quotations");

const app = express();

app.use(express.json());
app.use("/", healthRouter);
app.use("/customers", costomeRouter);
app.use("/profile", profileRouter);
app.use("/invoices", invoicesRouter);
app.use("/quotations", quotationsRouter);

module.exports = app;

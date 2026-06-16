const express = require("express");
const cookieParser = require("cookie-parser");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const invoicesRouter = require("./routes/invoices");
const customersRouter = require("./routes/coustomer");
const quotationsRouter = require("./routes/quotations");
const { requireAuth } = require("./middleware/auth");
const dashboardRouter = require("./routes/dashboard");

const app = express();

app.use(express.json());
app.use(cookieParser()); // ← must be before routes so req.cookies works

// Public routes — no auth needed
app.use("/", healthRouter);
app.use("/auth", authRouter);

// Protected routes — all require valid JWT cookie
app.use("/dashboard", requireAuth, dashboardRouter);
app.use("/customers", requireAuth, customersRouter);
app.use("/profile", requireAuth, profileRouter);
app.use("/invoices", requireAuth, invoicesRouter);
app.use("/quotations", requireAuth, quotationsRouter);

module.exports = app;

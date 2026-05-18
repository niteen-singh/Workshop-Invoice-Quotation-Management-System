const express = require("express");
const health = require("./routes/health");
const dotenv = require("dotenv");
const createUsersTable = require("../src/models/users");

dotenv.config();

const app = express();

createUsersTable();
app.use(express.json());
app.use("/health", health);

app.get("/", (req, res) => {
    res.json({ message: "hehehehehehehehehe noob" });
});

module.exports = app;

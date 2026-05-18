const express = require("express");
const health = require("./routes/health");

const app = express();

app.use(express.json());
app.use("/health", health);

app.get("/", (req, res) => {
    res.json({ message: "hehehehehehehehehe noob" });
});

module.exports = app;

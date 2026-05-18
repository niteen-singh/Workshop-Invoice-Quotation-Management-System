const express = require("express");

const router = express();

router.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "all good",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;

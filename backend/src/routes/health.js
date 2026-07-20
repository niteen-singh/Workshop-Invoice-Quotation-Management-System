const { Router } = require("express");
const { checkPostgres } = require("../lib/checks");

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "OK", uptime: Math.floor(process.uptime()) });
});

router.get("/ready", async (_req, res) => {
    const db = await checkPostgres();
    const allOk = db.ok;

    res.status(allOk ? 200 : 503).json({
        status: allOk ? "ready" : "unavailable",
        checks: { postgres: db },
    });
});

module.exports = router;

const { Router } = require("express");
const { checkPostgres, checkMinio } = require("../lib/checks");

const router = Router();

router.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: Math.floor(process.uptime()) });
});

router.get("/ready", async (_req, res) => {
    const [db, storage] = await Promise.all([checkPostgres(), checkMinio()]);
    const allOk = db.ok && storage.ok;

    res.status(allOk ? 200 : 503).json({
        status: allOk ? "ready" : "unavailable",
        checks: { postgres: db, minio: storage },
    });
});

module.exports = router;

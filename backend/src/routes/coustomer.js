const { Router } = require("express");
const { pool } = require("../lib/checks");

const router = Router();

router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM customers WHERE user_id = $1 ORDER BY created_at DESC",
            [req.userId],
        );
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    const { name, phone, email, address, gstin } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
        const { rows } = await pool.query(
            `INSERT INTO customers (name, phone, email, address, gstin, user_id)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [
                name,
                phone ?? null,
                email ?? null,
                address ?? null,
                gstin ?? null,
                req.userId,
            ],
        );
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM customers WHERE id = $1 AND user_id = $2",
            [req.params.id, req.userId],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Customer not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { name, phone, email, address, gstin } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
        const { rows } = await pool.query(
            `UPDATE customers SET
               name=$1, phone=$2, email=$3, address=$4, gstin=$5
             WHERE id=$6 AND user_id=$7 RETURNING *`,
            [
                name,
                phone ?? null,
                email ?? null,
                address ?? null,
                gstin ?? null,
                req.params.id,
                req.userId,
            ],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Customer not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            "DELETE FROM customers WHERE id=$1 AND user_id=$2",
            [req.params.id, req.userId],
        );
        if (!rowCount)
            return res.status(404).json({ error: "Customer not found" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

const { Router } = require("express");
const { pool } = require("../lib/check");

const router = Router();

// GET /customers — list all
// router.get("/", async (req, res) => {
//     try {
//         const { rows } = await pool.query(
//             "SELECT * FROM customers ORDER BY created_at DESC",
//         );
//         res.json({ data: rows, count: rows.length });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

router.get("/", async (_req, res) => {
    try {
        const { rows } = await pool.query(`
      SELECT i.*, c.name AS customer_name
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      ORDER BY i.created_at DESC
    `);
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /customers — create one
router.post("/", async (req, res) => {
    const { name, phone, email, address, gstin } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });

    try {
        const { rows } = await pool.query(
            `INSERT INTO customers (name, phone, email, address, gstin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [name, phone, email, address, gstin],
        );
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /customers/:id — get one
router.get("/:id", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM customers WHERE id = $1",
            [req.params.id],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Customer not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

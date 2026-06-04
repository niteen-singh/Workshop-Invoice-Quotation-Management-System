const { Router } = require("express");
const { pool } = require("../lib/checks");
const {
    buildQuotationData,
    renderQuotationHTML,
    generatePDF,
} = require("../lib/pdf");

const router = Router();

// GET /quotations/next-number
router.get("/next-number", async (_req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT quote_number FROM quotations ORDER BY created_at DESC LIMIT 1`,
        );
        if (!rows.length) return res.json({ number: "QT-001" });
        const num = parseInt(rows[0].quote_number.replace(/\D/g, "")) + 1;
        res.json({ number: `QT-${String(num).padStart(3, "0")}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /quotations
router.get("/", async (_req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT q.*, c.name AS customer_name
            FROM quotations q
            JOIN customers c ON c.id = q.customer_id
            ORDER BY q.created_at DESC
        `);
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /quotations/:id
router.get("/:id", async (req, res) => {
    try {
        const { rows: qRows } = await pool.query(
            `
            SELECT q.*, c.name AS customer_name, c.address AS customer_address, c.gstin AS customer_gstin
            FROM quotations q
            JOIN customers c ON c.id = q.customer_id
            WHERE q.id = $1
        `,
            [req.params.id],
        );
        if (!qRows.length)
            return res.status(404).json({ error: "Quotation not found" });

        const { rows: items } = await pool.query(
            `SELECT * FROM line_items WHERE quotation_id = $1 ORDER BY id`,
            [req.params.id],
        );
        res.json({ data: { ...qRows[0], line_items: items } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /quotations
router.post("/", async (req, res) => {
    const {
        customer_id,
        quote_number,
        quote_date,
        attention,
        subject,
        valid_until,
        notes,
        line_items,
    } = req.body;

    if (!customer_id || !quote_number || !line_items?.length)
        return res
            .status(400)
            .json({
                error: "customer_id, quote_number and line_items required",
            });

    const total_amount = line_items.reduce((s, i) => s + Number(i.total), 0);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `INSERT INTO quotations
             (customer_id, quote_number, status, total_amount,
              quote_date, attention, subject, valid_until, notes)
             VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
                customer_id,
                quote_number,
                total_amount,
                quote_date || null,
                attention || null,
                subject || null,
                valid_until || null,
                notes || null,
            ],
        );
        const quotation = rows[0];

        for (const item of line_items) {
            await client.query(
                `INSERT INTO line_items
                 (quotation_id, description, hsn, gst_percent, quantity, unit_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    quotation.id,
                    item.description,
                    item.hsn || null,
                    item.gst_percent || 0,
                    item.quantity,
                    item.unit_price,
                    item.total,
                ],
            );
        }

        await client.query("COMMIT");
        res.status(201).json({ data: quotation });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// PUT /quotations/:id/status
router.put("/:id/status", async (req, res) => {
    const { status } = req.body;
    const allowed = ["draft", "sent", "accepted", "rejected"];
    if (!allowed.includes(status))
        return res
            .status(400)
            .json({ error: `Status must be one of: ${allowed.join(", ")}` });

    try {
        const { rows } = await pool.query(
            `UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *`,
            [status, req.params.id],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Quotation not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /quotations/:id/pdf
router.get("/:id/pdf", async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows: qRows } = await client.query(
            `
            SELECT q.*, c.name, c.address, c.gstin
            FROM quotations q
            JOIN customers c ON c.id = q.customer_id
            WHERE q.id = $1
        `,
            [req.params.id],
        );
        if (!qRows.length)
            return res.status(404).json({ error: "Quotation not found" });

        const { rows: items } = await client.query(
            "SELECT * FROM line_items WHERE quotation_id = $1 ORDER BY id",
            [req.params.id],
        );

        const { rows: profileRows } = await client.query(
            "SELECT * FROM workshop_profile LIMIT 1",
        );
        if (!profileRows.length)
            return res
                .status(400)
                .json({ error: "Workshop profile not set up." });

        const quotation = qRows[0];
        const customer = {
            name: quotation.name,
            address: quotation.address,
            gstin: quotation.gstin,
        };

        const data = buildQuotationData(
            quotation,
            items,
            customer,
            profileRows[0],
        );
        const html = renderQuotationHTML(data);
        const pdf = await generatePDF(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${quotation.quote_number}.pdf"`,
        );
        res.send(pdf);
    } catch (err) {
        console.error("Quotation PDF error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;

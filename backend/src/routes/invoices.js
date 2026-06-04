const { Router } = require("express");
const { pool } = require("../lib/checks");
const { buildTemplateData, renderHTML, generatePDF } = require("../lib/pdf");

const router = Router();

router.put("/:id/status", async (req, res) => {
    const { status } = req.body;
    const allowed = ["unpaid", "paid", "overdue", "cancelled", "draft"];

    if (!allowed.includes(status))
        return res
            .status(400)
            .json({ error: `Status must be one of: ${allowed.join(", ")}` });

    try {
        const { rows } = await pool.query(
            `UPDATE invoices SET
                status  = $1,
                paid_at = $2
             WHERE id = $3 RETURNING *`,
            [status, status === "paid" ? new Date() : null, req.params.id],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Invoice not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /invoices/next-number ─────────────────────────────
router.get("/next-number", async (_req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1`,
        );
        if (!rows.length) return res.json({ number: "INV-001" });

        const last = rows[0].invoice_number;
        const num = parseInt(last.replace(/\D/g, "")) + 1;
        res.json({ number: `INV-${String(num).padStart(3, "0")}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /invoices ─────────────────────────────────────────
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

// ── GET /invoices/:id ─────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        const { rows: invRows } = await pool.query(
            `
            SELECT i.*, c.name AS customer_name, c.address, c.gstin
            FROM invoices i
            JOIN customers c ON c.id = i.customer_id
            WHERE i.id = $1
        `,
            [req.params.id],
        );

        if (!invRows.length)
            return res.status(404).json({ error: "Invoice not found" });

        const { rows: items } = await pool.query(
            `SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY id`,
            [req.params.id],
        );

        res.json({ data: { ...invRows[0], line_items: items } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /invoices ────────────────────────────────────────
router.post("/", async (req, res) => {
    const {
        customer_id,
        invoice_number,
        invoice_date,
        due_date,
        notes,
        line_items,
        challan_no,
        challan_date,
        po_no,
        po_date,
        vendor_code,
        vehicle_no,
    } = req.body;

    if (!customer_id || !invoice_number || !line_items?.length)
        return res.status(400).json({
            error: "customer_id, invoice_number and line_items required",
        });

    const total_amount = line_items.reduce((s, i) => s + Number(i.total), 0);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `INSERT INTO invoices
             (customer_id, invoice_number, status, total_amount,
              invoice_date, due_date, notes,
              challan_no, challan_date, po_no, po_date, vendor_code, vehicle_no)
             VALUES ($1,$2,'unpaid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                customer_id,
                invoice_number,
                total_amount,
                invoice_date || null,
                due_date || null,
                notes || null,
                challan_no || null,
                challan_date || null,
                po_no || null,
                po_date || null,
                vendor_code || null,
                vehicle_no || null,
            ],
        );
        const invoice = rows[0];

        for (const item of line_items) {
            await client.query(
                `INSERT INTO line_items
                 (invoice_id, description, hsn, gst_percent, quantity, unit_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    invoice.id,
                    item.description,
                    item.hsn || null,
                    item.gst_percent,
                    item.quantity,
                    item.unit_price,
                    item.total,
                ],
            );
        }

        await client.query("COMMIT");
        res.status(201).json({ data: invoice });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ── GET /invoices/:id/pdf ─────────────────────────────────
router.get("/:id/pdf", async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows: invRows } = await client.query(
            `SELECT i.*, c.name, c.address, c.gstin
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.id = $1`,
            [req.params.id],
        );
        if (!invRows.length)
            return res.status(404).json({ error: "Invoice not found" });

        const { rows: items } = await client.query(
            "SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY id",
            [req.params.id],
        );
        if (!items.length)
            return res.status(400).json({ error: "Invoice has no line items" });

        const { rows: profileRows } = await client.query(
            "SELECT * FROM workshop_profile LIMIT 1",
        );
        if (!profileRows.length)
            return res.status(400).json({
                error: "Workshop profile not set up. Go to Settings first.",
            });

        const invoice = invRows[0];
        const customer = {
            name: invoice.name,
            address: invoice.address,
            gstin: invoice.gstin,
        };

        const data = buildTemplateData(
            invoice,
            items,
            customer,
            profileRows[0],
        );
        const html = renderHTML(data);
        const pdf = await generatePDF(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${invoice.invoice_number}.pdf"`,
        );
        res.send(pdf);
    } catch (err) {
        console.error("PDF error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;

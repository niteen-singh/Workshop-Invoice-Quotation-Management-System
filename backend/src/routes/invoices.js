const { Router } = require("express");
const { pool } = require("../lib/checks");
const { buildTemplateData, renderHTML, generatePDF } = require("../lib/pdf");

const router = Router();

// GET /invoices/next-number
router.get("/next-number", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT invoice_number FROM invoices
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [req.userId],
        );
        if (!rows.length) return res.json({ number: "INV-001" });
        const num = parseInt(rows[0].invoice_number.replace(/\D/g, "")) + 1;
        res.json({ number: `INV-${String(num).padStart(3, "0")}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /invoices
router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT i.*, c.name AS customer_name
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.user_id = $1
             ORDER BY i.created_at DESC`,
            [req.userId],
        );
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /invoices/:id
router.get("/:id", async (req, res) => {
    try {
        const { rows: invRows } = await pool.query(
            `SELECT i.*, c.name AS customer_name, c.address, c.gstin
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.id = $1 AND i.user_id = $2`,
            [req.params.id, req.userId],
        );
        if (!invRows.length)
            return res.status(404).json({ error: "Invoice not found" });

        const { rows: items } = await pool.query(
            "SELECT * FROM line_items WHERE invoice_id = $1 ORDER BY id",
            [req.params.id],
        );
        res.json({ data: { ...invRows[0], line_items: items } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /invoices
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
              challan_no, challan_date, po_no, po_date,
              vendor_code, vehicle_no, user_id)
             VALUES ($1,$2,'unpaid',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
                req.userId,
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

// PUT /invoices/:id — update invoice + replace line items
router.put("/:id", async (req, res) => {
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
        return res
            .status(400)
            .json({
                error: "customer_id, invoice_number and line_items required",
            });

    const total_amount = line_items.reduce((s, i) => s + Number(i.total), 0);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // verify invoice belongs to this user
        const { rows: check } = await client.query(
            "SELECT id FROM invoices WHERE id=$1 AND user_id=$2",
            [req.params.id, req.userId],
        );
        if (!check.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Invoice not found" });
        }

        // update invoice
        const { rows } = await client.query(
            `UPDATE invoices SET
               customer_id=$1,    invoice_number=$2,
               total_amount=$3,   invoice_date=$4,
               due_date=$5,       notes=$6,
               challan_no=$7,     challan_date=$8,
               po_no=$9,          po_date=$10,
               vendor_code=$11,   vehicle_no=$12
             WHERE id=$13 AND user_id=$14 RETURNING *`,
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
                req.params.id,
                req.userId,
            ],
        );

        // delete old line items and re-insert
        await client.query("DELETE FROM line_items WHERE invoice_id=$1", [
            req.params.id,
        ]);

        for (const item of line_items) {
            await client.query(
                `INSERT INTO line_items
                 (invoice_id, description, hsn, gst_percent, quantity, unit_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    req.params.id,
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
        res.json({ data: rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// GET /invoices/:id/pdf
router.get("/:id/pdf", async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows: invRows } = await client.query(
            `SELECT i.*, c.name, c.address, c.gstin
             FROM invoices i
             JOIN customers c ON c.id = i.customer_id
             WHERE i.id = $1 AND i.user_id = $2`,
            [req.params.id, req.userId],
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
            "SELECT * FROM workshop_profile WHERE user_id = $1 LIMIT 1",
            [req.userId],
        );
        if (!profileRows.length)
            return res
                .status(400)
                .json({ error: "Workshop profile not set up." });

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

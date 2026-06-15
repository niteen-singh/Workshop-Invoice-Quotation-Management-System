const { Router } = require("express");
const { pool } = require("../lib/checks");
const {
    buildQuotationData,
    renderQuotationHTML,
    generatePDF,
} = require("../lib/pdf");

const router = Router();

router.get("/next-number", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT quote_number FROM quotations
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [req.userId],
        );
        if (!rows.length) return res.json({ number: "QT-001" });
        const num = parseInt(rows[0].quote_number.replace(/\D/g, "")) + 1;
        res.json({ number: `QT-${String(num).padStart(3, "0")}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT q.*, c.name AS customer_name
             FROM quotations q
             JOIN customers c ON c.id = q.customer_id
             WHERE q.user_id = $1
             ORDER BY q.created_at DESC`,
            [req.userId],
        );
        res.json({ data: rows, count: rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { rows: qRows } = await pool.query(
            `SELECT q.*, c.name AS customer_name,
                    c.address AS customer_address,
                    c.gstin AS customer_gstin
             FROM quotations q
             JOIN customers c ON c.id = q.customer_id
             WHERE q.id = $1 AND q.user_id = $2`,
            [req.params.id, req.userId],
        );
        if (!qRows.length)
            return res.status(404).json({ error: "Quotation not found" });

        const { rows: items } = await pool.query(
            "SELECT * FROM line_items WHERE quotation_id = $1 ORDER BY id",
            [req.params.id],
        );
        res.json({ data: { ...qRows[0], line_items: items } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        return res.status(400).json({
            error: "customer_id, quote_number and line_items required",
        });

    const total_amount = line_items.reduce((s, i) => s + Number(i.total), 0);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `INSERT INTO quotations
             (customer_id, quote_number, status, total_amount,
              quote_date, attention, subject, valid_until, notes, user_id)
             VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9)
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
                req.userId,
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

router.post("/:id/convert", async (req, res) => {
    const { invoice_date, due_date, vehicle_no } = req.body;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // fetch quotation + line items
        const { rows: qRows } = await client.query(
            `SELECT q.*, c.name AS customer_name
             FROM quotations q
             JOIN customers c ON c.id = q.customer_id
             WHERE q.id = $1 AND q.user_id = $2`,
            [req.params.id, req.userId],
        );
        if (!qRows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Quotation not found" });
        }

        const { rows: items } = await client.query(
            "SELECT * FROM line_items WHERE quotation_id = $1 ORDER BY id",
            [req.params.id],
        );
        if (!items.length) {
            await client.query("ROLLBACK");
            return res
                .status(400)
                .json({ error: "Quotation has no line items" });
        }

        const quotation = qRows[0];

        // generate next invoice number
        const { rows: lastInv } = await client.query(
            `SELECT invoice_number FROM invoices
             WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [req.userId],
        );
        const nextNum = lastInv.length
            ? parseInt(lastInv[0].invoice_number.replace(/\D/g, "")) + 1
            : 1;
        const invoice_number = `INV-${String(nextNum).padStart(3, "0")}`;

        // create invoice
        const { rows: invRows } = await client.query(
            `INSERT INTO invoices
             (customer_id, invoice_number, status, total_amount,
              invoice_date, due_date, vehicle_no,
              quotation_id, user_id)
             VALUES ($1,$2,'unpaid',$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
                quotation.customer_id,
                invoice_number,
                quotation.total_amount,
                invoice_date || null,
                due_date || null,
                vehicle_no || null,
                quotation.id,
                req.userId,
            ],
        );
        const invoice = invRows[0];

        // copy line items from quotation to invoice
        for (const item of items) {
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

        // mark quotation as accepted
        await client.query(
            `UPDATE quotations SET status = 'accepted'
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.userId],
        );

        await client.query("COMMIT");
        res.status(201).json({
            data: {
                invoice,
                invoice_number,
                message: `Invoice ${invoice_number} created from ${quotation.quote_number}`,
            },
        });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.put("/:id", async (req, res) => {
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
        return res.status(400).json({
            error: "customer_id, quote_number and line_items required",
        });

    const total_amount = line_items.reduce((s, i) => s + Number(i.total), 0);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows: check } = await client.query(
            "SELECT id FROM quotations WHERE id=$1 AND user_id=$2",
            [req.params.id, req.userId],
        );
        if (!check.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Quotation not found" });
        }

        const { rows } = await client.query(
            `UPDATE quotations SET
               customer_id=$1,  quote_number=$2,
               total_amount=$3, quote_date=$4,
               attention=$5,    subject=$6,
               valid_until=$7,  notes=$8
             WHERE id=$9 AND user_id=$10 RETURNING *`,
            [
                customer_id,
                quote_number,
                total_amount,
                quote_date || null,
                attention || null,
                subject || null,
                valid_until || null,
                notes || null,
                req.params.id,
                req.userId,
            ],
        );

        await client.query("DELETE FROM line_items WHERE quotation_id=$1", [
            req.params.id,
        ]);

        for (const item of line_items) {
            await client.query(
                `INSERT INTO line_items
                 (quotation_id, description, hsn, gst_percent, quantity, unit_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [
                    req.params.id,
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
        res.json({ data: rows[0] });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.put("/:id/status", async (req, res) => {
    const { status } = req.body;
    const allowed = ["draft", "sent", "accepted", "rejected"];
    if (!allowed.includes(status))
        return res
            .status(400)
            .json({ error: `Status must be one of: ${allowed.join(", ")}` });

    try {
        const { rows } = await pool.query(
            `UPDATE quotations SET status=$1
             WHERE id=$2 AND user_id=$3 RETURNING *`,
            [status, req.params.id, req.userId],
        );
        if (!rows.length)
            return res.status(404).json({ error: "Quotation not found" });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/:id/pdf", async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows: qRows } = await client.query(
            `SELECT q.*, c.name, c.address, c.gstin
             FROM quotations q
             JOIN customers c ON c.id = q.customer_id
             WHERE q.id = $1 AND q.user_id = $2`,
            [req.params.id, req.userId],
        );
        if (!qRows.length)
            return res.status(404).json({ error: "Quotation not found" });

        const { rows: items } = await client.query(
            "SELECT * FROM line_items WHERE quotation_id = $1 ORDER BY id",
            [req.params.id],
        );

        const { rows: profileRows } = await client.query(
            "SELECT * FROM workshop_profile WHERE user_id = $1 LIMIT 1",
            [req.userId],
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

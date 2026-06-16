const { Router } = require("express");
const { pool } = require("../lib/checks");

const router = Router();

router.get("/", async (req, res) => {
    const uid = req.userId;
    try {
        const [
            customerStats,
            invoiceStats,
            quotationStats,
            recentInvoices,
            monthlyRevenue,
        ] = await Promise.all([
            // ── Customers ─────────────────────────────────
            pool.query(
                `
                SELECT
                    COUNT(*)                                         AS total,
                    COUNT(*) FILTER (
                        WHERE DATE_TRUNC('month', created_at) =
                              DATE_TRUNC('month', NOW())
                    )                                                AS this_month
                FROM customers
                WHERE user_id = $1
            `,
                [uid],
            ),

            // ── Invoices ──────────────────────────────────
            pool.query(
                `
                SELECT
                    COUNT(*)                                         AS total,
                    COUNT(*) FILTER (WHERE status = 'unpaid')       AS unpaid_count,
                    COUNT(*) FILTER (WHERE status = 'paid')         AS paid_count,
                    COUNT(*) FILTER (WHERE status = 'overdue')      AS overdue_count,
                    COALESCE(SUM(total_amount)
                        FILTER (WHERE status = 'unpaid'), 0)        AS unpaid_amount,
                    COALESCE(SUM(total_amount)
                        FILTER (WHERE status = 'paid'
                            AND DATE_TRUNC('month', paid_at) =
                                DATE_TRUNC('month', NOW())), 0)     AS paid_this_month
                FROM invoices
                WHERE user_id = $1
            `,
                [uid],
            ),

            // ── Quotations ────────────────────────────────
            pool.query(
                `
                SELECT
                    COUNT(*)                                         AS total,
                    COUNT(*) FILTER (WHERE status = 'sent')         AS sent_count,
                    COUNT(*) FILTER (WHERE status = 'accepted')     AS accepted_count,
                    COUNT(*) FILTER (WHERE status = 'draft')        AS draft_count,
                    COALESCE(SUM(total_amount)
                        FILTER (WHERE status = 'accepted'), 0)      AS accepted_amount
                FROM quotations
                WHERE user_id = $1
            `,
                [uid],
            ),

            // ── Recent invoices (last 8) ──────────────────
            pool.query(
                `
                SELECT i.id, i.invoice_number, i.status,
                       i.total_amount, i.invoice_date, i.due_date,
                       c.name AS customer_name
                FROM invoices i
                JOIN customers c ON c.id = i.customer_id
                WHERE i.user_id = $1
                ORDER BY i.created_at DESC
                LIMIT 8
            `,
                [uid],
            ),

            // ── Revenue last 6 months ─────────────────────
            pool.query(
                `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon YY') AS month,
                    COALESCE(SUM(total_amount), 0)                        AS revenue
                FROM invoices
                WHERE user_id = $1
                  AND status  = 'paid'
                  AND invoice_date >= NOW() - INTERVAL '6 months'
                GROUP BY DATE_TRUNC('month', invoice_date)
                ORDER BY DATE_TRUNC('month', invoice_date)
            `,
                [uid],
            ),
        ]);

        res.json({
            customers: {
                total: parseInt(customerStats.rows[0].total),
                this_month: parseInt(customerStats.rows[0].this_month),
            },
            invoices: {
                total: parseInt(invoiceStats.rows[0].total),
                unpaid_count: parseInt(invoiceStats.rows[0].unpaid_count),
                paid_count: parseInt(invoiceStats.rows[0].paid_count),
                overdue_count: parseInt(invoiceStats.rows[0].overdue_count),
                unpaid_amount: parseFloat(invoiceStats.rows[0].unpaid_amount),
                paid_this_month: parseFloat(
                    invoiceStats.rows[0].paid_this_month,
                ),
            },
            quotations: {
                total: parseInt(quotationStats.rows[0].total),
                sent_count: parseInt(quotationStats.rows[0].sent_count),
                accepted_count: parseInt(quotationStats.rows[0].accepted_count),
                draft_count: parseInt(quotationStats.rows[0].draft_count),
                accepted_amount: parseFloat(
                    quotationStats.rows[0].accepted_amount,
                ),
            },
            recent_invoices: recentInvoices.rows,
            monthly_revenue: monthlyRevenue.rows,
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

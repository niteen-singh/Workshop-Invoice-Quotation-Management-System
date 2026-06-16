function fmtINR(amount) {
    if (amount >= 10000000) return "₹" + (amount / 10000000).toFixed(2) + "Cr";
    if (amount >= 100000) return "₹" + (amount / 100000).toFixed(1) + "L";
    if (amount >= 1000) return "₹" + (amount / 1000).toFixed(1) + "K";
    return "₹" + parseFloat(amount).toFixed(0);
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function statusBadge(status) {
    const map = {
        unpaid: "badge-amber",
        paid: "badge-green",
        draft: "badge-blue",
        overdue: "badge-red",
        cancelled: "badge-red",
    };
    const cls = map[status] ?? "badge-blue";
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="badge ${cls}">${label}</span>`;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

async function loadDashboard() {
    try {
        const res = await api.get("/dashboard");
        const data = res;

        const {
            customers,
            invoices,
            quotations,
            recent_invoices,
            monthly_revenue,
        } = data;

        // ── Customers ─────────────────────────────────────
        setText("stat-customers", customers.total);
        setText(
            "stat-customers-sub",
            customers.this_month > 0
                ? `+${customers.this_month} this month`
                : "No new this month",
        );

        // ── Open invoices (unpaid amount) ─────────────────
        setText("stat-unpaid-amount", fmtINR(invoices.unpaid_amount));
        setText(
            "stat-unpaid-sub",
            `${invoices.unpaid_count} unpaid` +
                (invoices.overdue_count > 0
                    ? ` · ${invoices.overdue_count} overdue`
                    : ""),
        );

        // ── Paid this month ───────────────────────────────
        setText("stat-paid-month", fmtINR(invoices.paid_this_month));
        setText(
            "stat-paid-month-sub",
            `${invoices.paid_count} invoices paid total`,
        );

        // ── Quotations sent (awaiting) ────────────────────
        setText(
            "stat-quotes-sent",
            invoices.total > 0 ? quotations.sent_count : "0",
        );
        setText(
            "stat-quotes-sub",
            quotations.draft_count > 0
                ? `${quotations.draft_count} draft`
                : "No drafts pending",
        );

        // ── Invoices total ────────────────────────────────
        setText("stat-invoices-total", invoices.total);
        setText(
            "stat-invoices-sub",
            `${invoices.paid_count} paid · ${invoices.unpaid_count} unpaid`,
        );

        // ── Quotations accepted ───────────────────────────
        setText("stat-quotes-accepted", quotations.accepted_count);
        setText(
            "stat-quotes-accepted-sub",
            quotations.accepted_amount > 0
                ? `${fmtINR(quotations.accepted_amount)}`
                : `${quotations.total} total quotations`,
        );

        // ── Recent invoices table ─────────────────────────
        const tbody = document.getElementById("recent-tbody");
        if (!recent_invoices.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5"
                        style="text-align:center;color:var(--muted);padding:2rem">
                        No invoices yet —
                        <a href="/invoices-new.html"
                           style="color:white">create one</a>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML = recent_invoices
                .map(
                    (inv) => `
                <tr onclick="window.location='/invoices-view.html?id=${inv.id}'"
                    style="cursor:pointer">
                    <td>${inv.customer_name ?? "—"}</td>
                    <td style="font-family:monospace;font-weight:600">
                        ${inv.invoice_number}
                    </td>
                    <td style="color:var(--muted)">${fmtDate(inv.invoice_date)}</td>
                    <td style="text-align:right;font-weight:500">
                        ₹${parseFloat(inv.total_amount).toLocaleString(
                            "en-IN",
                            {
                                minimumFractionDigits: 2,
                            },
                        )}
                    </td>
                    <td style="text-align:center">${statusBadge(inv.status)}</td>
                </tr>
            `,
                )
                .join("");
        }

        // ── Bar chart — monthly revenue ───────────────────
        renderBarChart(monthly_revenue);
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

function renderBarChart(months) {
    const chart = document.getElementById("bar-chart");

    if (!months.length) {
        chart.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;
                        justify-content:center;height:180px;gap:0.5rem">
                <span style="font-size:2rem">📊</span>
                <span style="color:var(--muted);font-size:0.85rem">
                    No paid invoices yet
                </span>
            </div>`;
        return;
    }

    const CHART_HEIGHT = 100; // px — fixed bar area height
    const max = Math.max(...months.map((m) => parseFloat(m.revenue)), 1);
    const total = months.reduce((s, m) => s + parseFloat(m.revenue), 0);
    const highest = months.reduce((a, b) =>
        parseFloat(a.revenue) > parseFloat(b.revenue) ? a : b,
    );

    chart.innerHTML = `
        <!-- Summary row -->
        <div style="display:flex;gap:2rem;margin-bottom:1.5rem;
                    padding-bottom:1.2rem;border-bottom:1px solid var(--border)">
            <div>
                <div style="font-size:0.75rem;color:var(--muted);
                            text-transform:uppercase;letter-spacing:0.06em;
                            margin-bottom:0.3rem">
                    6-month total
                </div>
                <div style="font-size:1.6rem;font-weight:700;color:var(--text)">
                    ${fmtINR(total)}
                </div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:var(--muted);
                            text-transform:uppercase;letter-spacing:0.06em;
                            margin-bottom:0.3rem">
                    Best month
                </div>
                <div style="font-size:1.6rem;font-weight:700;color:var(--text)">
                    ${fmtINR(highest.revenue)}
                    <span style="font-size:0.8rem;font-weight:400;
                                 color:var(--muted);margin-left:0.3rem">
                        ${highest.month}
                    </span>
                </div>
            </div>
        </div>

        <!-- Bars -->
        <div style="display:flex;align-items:flex-end;gap:1rem;
                    height:${CHART_HEIGHT + 48}px;
                    border-bottom:1px solid rgba(255,255,255,0.1);
                    padding-bottom:0">
            ${months
                .map((m) => {
                    const revenue = parseFloat(m.revenue);
                    const barHeight = Math.max(
                        Math.round((revenue / max) * CHART_HEIGHT),
                        6,
                    );
                    const isMax = revenue === parseFloat(highest.revenue);

                    return `
                    <div style="display:flex;flex-direction:column;
                                align-items:center;gap:6px;flex:1">

                        <!-- Amount label -->
                        <span style="font-size:11px;color:var(--text);
                                     font-weight:500;white-space:nowrap">
                            ${fmtINR(revenue)}
                        </span>

                        <!-- Bar -->
                        <div style="
                            width: 100%;
                            height: ${barHeight}px;
                            background: ${
                                isMax
                                    ? "rgba(255,255,255,0.85)"
                                    : "rgba(255,255,255,0.22)"
                            };
                            border-radius: 6px 6px 0 0;
                            min-height: 6px">
                        </div>

                        <!-- Month label -->
                        <span style="font-size:11px;color:var(--muted);
                                     white-space:nowrap">
                            ${m.month}
                        </span>
                    </div>
                `;
                })
                .join("")}
        </div>
    `;
}

loadDashboard();

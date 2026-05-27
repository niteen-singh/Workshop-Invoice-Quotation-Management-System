async function loadDashboard() {
    try {
        const [customers, invoices] = await Promise.all([
            api.get("/customers"),
            api.get("/invoices"),
        ]);

        // ── Stat: customers ───────────────────────────────────
        document.getElementById("stat-customers").textContent = customers.count;

        const thisMonth = customers.data.filter((c) => {
            const d = new Date(c.created_at);
            const now = new Date();
            return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        }).length;
        document.getElementById("stat-customers-sub").textContent =
            thisMonth > 0 ? `+${thisMonth} this month` : "No new this month";

        // ── Stat: open invoices ───────────────────────────────
        const unpaid = invoices.data.filter((i) => i.status === "unpaid");
        const totalUnpaid = unpaid.reduce(
            (s, i) => s + parseFloat(i.total_amount),
            0,
        );
        document.getElementById("stat-invoices").textContent =
            formatINR(totalUnpaid);
        document.getElementById("stat-invoices-sub").textContent =
            `${unpaid.length} pending`;

        // ── Stat: quotations sent ─────────────────────────────
        const sent = invoices.data.filter((i) => i.status === "sent").length;
        document.getElementById("stat-quotations").textContent = sent || "0";
        document.getElementById("stat-quotations-sub").textContent =
            "awaiting reply";

        // ── Recent invoices table ─────────────────────────────
        const recent = invoices.data.slice(0, 8);
        const tbody = document.getElementById("recent-tbody");

        if (!recent.length) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center" class="secondary">No invoices yet</td></tr>`;
            return;
        }

        tbody.innerHTML = recent
            .map(
                (inv) => `
      <tr onclick="window.location='/invoices-view.html?id=${inv.id}'" style="cursor:pointer">
        <td>${inv.customer_name ?? "—"}</td>
        <td>${inv.invoice_number}</td>
        <td style="text-align:right">${statusBadge(inv.status)}</td>
      </tr>
    `,
            )
            .join("");
    } catch (err) {
        console.error(err);
    }
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

function formatINR(amount) {
    if (amount >= 100000) return "₹" + (amount / 100000).toFixed(1) + "L";
    if (amount >= 1000) return "₹" + (amount / 1000).toFixed(1) + "K";
    return "₹" + amount.toFixed(0);
}

loadDashboard();

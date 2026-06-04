let allInvoices = [];

async function loadInvoices() {
    const tbody = document.getElementById("invoices-tbody");
    try {
        const res = await api.get("/invoices");
        allInvoices = res.data;
        renderTable(allInvoices);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7"
            style="text-align:center;color:var(--muted)">${err.message}</td></tr>`;
    }
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function fmtINR(n) {
    return (
        "₹" +
        parseFloat(n).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
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

function renderTable(invoices) {
    const tbody = document.getElementById("invoices-tbody");
    document.getElementById("invoice-count").textContent =
        `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`;

    if (!invoices.length) {
        tbody.innerHTML = `<tr><td colspan="7"
            style="text-align:center;color:var(--muted)">No invoices yet</td></tr>`;
        return;
    }

    tbody.innerHTML = invoices
        .map(
            (inv) => `
        <tr style="cursor:pointer"
            onclick="window.location='/invoices-view.html?id=${inv.id}'">
            <td style="font-family:monospace;font-weight:600">${inv.invoice_number}</td>
            <td>${inv.customer_name ?? "—"}</td>
            <td style="color:var(--muted)">${fmtDate(inv.invoice_date)}</td>
            <td style="color:var(--muted)">${fmtDate(inv.due_date)}</td>
            <td style="text-align:right;font-weight:500">${fmtINR(inv.total_amount)}</td>
            <td style="text-align:center">${statusBadge(inv.status)}</td>
            <td style="text-align:center">
                <a href="/invoices-view.html?id=${inv.id}"
                   style="color:var(--muted);font-size:1.1rem;text-decoration:none"
                   onclick="event.stopPropagation()">→</a>
            </td>
        </tr>
    `,
        )
        .join("");
}

function filterTable(q) {
    const lower = q.toLowerCase();
    const filtered = allInvoices.filter((inv) =>
        [inv.invoice_number, inv.customer_name].some((v) =>
            v?.toLowerCase().includes(lower),
        ),
    );
    renderTable(filtered);
}

loadInvoices();

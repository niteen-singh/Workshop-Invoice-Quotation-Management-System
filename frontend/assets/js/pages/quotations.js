let allQuotes = [];

async function loadQuotations() {
    const tbody = document.getElementById("quotes-tbody");
    try {
        const res = await api.get("/quotations");
        allQuotes = res.data;
        renderTable(allQuotes);
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
        draft: "badge-blue",
        sent: "badge-amber",
        accepted: "badge-green",
        rejected: "badge-red",
    };
    const cls = map[status] ?? "badge-blue";
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="badge ${cls}">${label}</span>`;
}

function renderTable(quotes) {
    const tbody = document.getElementById("quotes-tbody");
    document.getElementById("quote-count").textContent =
        `${quotes.length} quotation${quotes.length !== 1 ? "s" : ""}`;

    if (!quotes.length) {
        tbody.innerHTML = `<tr><td colspan="7"
            style="text-align:center;color:var(--muted)">No quotations yet</td></tr>`;
        return;
    }

    tbody.innerHTML = quotes
        .map(
            (q) => `
        <tr style="cursor:pointer"
            onclick="window.location='/quotations-view.html?id=${q.id}'">
            <td style="font-family:monospace;font-weight:600">${q.quote_number}</td>
            <td>${q.customer_name ?? "—"}</td>
            <td style="color:var(--muted);font-size:0.85rem">${q.subject ?? "—"}</td>
            <td style="color:var(--muted)">${fmtDate(q.quote_date)}</td>
            <td style="text-align:right;font-weight:500">${fmtINR(q.total_amount)}</td>
            <td style="text-align:center">${statusBadge(q.status)}</td>
            <td style="text-align:center">
                <a href="/quotations-view.html?id=${q.id}"
                   style="color:var(--muted);text-decoration:none"
                   onclick="event.stopPropagation()">→</a>
            </td>
        </tr>
    `,
        )
        .join("");
}

function filterTable(q) {
    const lower = q.toLowerCase();
    const filtered = allQuotes.filter((qt) =>
        [qt.quote_number, qt.customer_name, qt.subject].some((v) =>
            v?.toLowerCase().includes(lower),
        ),
    );
    renderTable(filtered);
}

loadQuotations();

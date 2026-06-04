const params = new URLSearchParams(window.location.search);
const quoteId = params.get("id");
let currentQuote = null;

if (!quoteId) window.location.href = "/quotations.html";

const STATUS_CYCLE = ["draft", "sent", "accepted", "rejected"];
const STATUS_NEXT = {
    draft: { next: "sent", label: "Mark as sent" },
    sent: { next: "accepted", label: "Mark as accepted" },
    accepted: { next: "rejected", label: "Mark as rejected" },
    rejected: { next: "draft", label: "Reset to draft" },
};

// ── Load ──────────────────────────────────────────────────
async function loadQuotation() {
    try {
        const res = await api.get(`/quotations/${quoteId}`);
        currentQuote = res.data;
        renderQuotation(currentQuote);
    } catch (err) {
        document.getElementById("loading").textContent =
            "Failed to load: " + err.message;
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

function renderQuotation(q) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("quote-detail").style.display = "block";

    document.title = `${q.quote_number} — Workshop IQ`;
    document.getElementById("topbar-title").textContent = q.quote_number;

    // Meta
    document.getElementById("v-customer").textContent = q.customer_name ?? "—";
    document.getElementById("v-number").textContent = q.quote_number;
    document.getElementById("v-date").textContent = fmtDate(q.quote_date);
    document.getElementById("v-valid").textContent = fmtDate(q.valid_until);
    document.getElementById("v-status").innerHTML = statusBadge(q.status);
    document.getElementById("v-total").textContent = fmtINR(q.total_amount);

    // Status button
    const action = STATUS_NEXT[q.status] ?? STATUS_NEXT["draft"];
    document.getElementById("status-btn").textContent = action.label;

    // Subject / Attention
    if (q.subject || q.attention) {
        document.getElementById("subject-section").style.display = "block";
        if (q.subject) {
            document.getElementById("subject-block").style.display = "block";
            document.getElementById("v-subject").textContent = q.subject;
        }
        if (q.attention) {
            document.getElementById("attention-block").style.display = "block";
            document.getElementById("v-attention").textContent = q.attention;
        }
    }

    // Line items
    const items = q.line_items ?? [];
    let grand = 0;

    document.getElementById("v-line-items").innerHTML = items
        .map((item, i) => {
            const amount =
                parseFloat(item.unit_price) * parseFloat(item.quantity);
            grand += amount;
            return `
            <tr>
                <td style="text-align:center;color:var(--muted)">${i + 1}</td>
                <td>${item.description}</td>
                <td style="text-align:center;font-family:monospace;
                           color:var(--muted)">${item.hsn ?? "—"}</td>
                <td style="text-align:center">${parseFloat(item.quantity)}</td>
                <td style="text-align:right">${fmtINR(item.unit_price)}</td>
                <td style="text-align:right;font-weight:500">${fmtINR(amount)}</td>
            </tr>
        `;
        })
        .join("");

    document.getElementById("v-grand").innerHTML =
        `<strong>${fmtINR(grand)}</strong>`;

    // Notes
    if (q.notes) {
        document.getElementById("notes-section").style.display = "block";
        document.getElementById("v-notes").textContent = q.notes;
    }
}

// ── Cycle status ──────────────────────────────────────────
async function cycleStatus() {
    if (!currentQuote) return;
    const action = STATUS_NEXT[currentQuote.status] ?? STATUS_NEXT["draft"];
    const newStatus = action.next;

    try {
        await api.put(`/quotations/${quoteId}/status`, { status: newStatus });
        currentQuote.status = newStatus;
        renderQuotation(currentQuote);
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
}

// ── PDF download ──────────────────────────────────────────
async function downloadPdf() {
    const btn = document.getElementById("pdf-btn");
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        const res = await fetch(`/api/quotations/${quoteId}/pdf`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentQuote?.quote_number ?? "quotation"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("PDF failed: " + err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

loadQuotation();

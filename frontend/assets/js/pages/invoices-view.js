const params = new URLSearchParams(window.location.search);
const invoiceId = params.get("id");
let currentInvoice = null;

if (!invoiceId) window.location.href = "/invoices.html";

// ── Load ──────────────────────────────────────────────────
async function loadInvoice() {
    try {
        const res = (currentInvoice = (await api.get(`/invoices/${invoiceId}`))
            .data);
        currentInvoice = res;
        renderInvoice(res);
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

function renderInvoice(inv) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("invoice-detail").style.display = "block";
    document.title = `${inv.invoice_number} — Workshop IQ`;
    document.getElementById("topbar-title").textContent = inv.invoice_number;

    document.getElementById("edit-btn").onclick = () => {
        window.location.href = `/invoices-edit.html?id=${invoiceId}`;
    };

    // Meta
    document.getElementById("v-customer").textContent =
        inv.customer_name ?? "—";
    document.getElementById("v-number").textContent = inv.invoice_number;
    document.getElementById("v-date").textContent = fmtDate(inv.invoice_date);
    document.getElementById("v-due").textContent = fmtDate(inv.due_date);
    document.getElementById("v-status").innerHTML = statusBadge(inv.status);
    document.getElementById("v-total").textContent = fmtINR(inv.total_amount);

    // Status button
    const statusBtn = document.getElementById("status-btn");
    if (inv.status === "paid") {
        statusBtn.textContent = "Mark as unpaid";
        statusBtn.classList.add("secondary");
    } else {
        statusBtn.textContent = "Mark as paid";
    }

    // Optional fields
    const optionals = [
        {
            label: "Challan No.",
            value: inv.challan_no,
            extra: inv.challan_date ? fmtDate(inv.challan_date) : null,
        },
        {
            label: "P.O. No.",
            value: inv.po_no,
            extra: inv.po_date ? fmtDate(inv.po_date) : null,
        },
        { label: "Vendor Code", value: inv.vendor_code, extra: null },
        { label: "Vehicle No.", value: inv.vehicle_no, extra: null },
    ].filter((o) => o.value);

    if (optionals.length) {
        document.getElementById("optional-meta").style.display = "block";
        document.getElementById("optional-meta-content").innerHTML = optionals
            .map(
                (o) => `
            <div>
                <div class="view-meta-label">${o.label}</div>
                <div class="view-meta-value" style="font-family:monospace">${o.value}
                    ${o.extra ? `<span style="color:var(--muted);font-size:0.8rem;margin-left:0.5rem">${o.extra}</span>` : ""}
                </div>
            </div>
        `,
            )
            .join("");
    }

    // Line items
    const items = inv.line_items ?? [];
    let subtotal = 0,
        totalGst = 0;

    document.getElementById("v-line-items").innerHTML = items
        .map((item, i) => {
            const taxable =
                parseFloat(item.unit_price) * parseFloat(item.quantity);
            const gstAmt = (taxable * parseFloat(item.gst_percent)) / 100;
            subtotal += taxable;
            totalGst += gstAmt;
            return `
            <tr>
                <td style="text-align:center;color:var(--muted)">${i + 1}</td>
                <td>${item.description}</td>
                <td style="text-align:center;font-family:monospace;color:var(--muted)">${item.hsn ?? "—"}</td>
                <td style="text-align:center">${item.gst_percent}%</td>
                <td style="text-align:center">${parseFloat(item.quantity)}</td>
                <td style="text-align:right">${fmtINR(item.unit_price)}</td>
                <td style="text-align:right;font-weight:500">${fmtINR(taxable + gstAmt)}</td>
            </tr>
        `;
        })
        .join("");

    // Totals
    const exact = subtotal + totalGst;
    const rounded = Math.round(exact);
    const roundOff = rounded - exact;

    document.getElementById("v-subtotal").textContent = fmtINR(subtotal);
    document.getElementById("v-cgst").textContent = fmtINR(totalGst / 2);
    document.getElementById("v-sgst").textContent = fmtINR(totalGst / 2);
    document.getElementById("v-roundoff").textContent =
        (roundOff >= 0 ? "+" : "") + fmtINR(Math.abs(roundOff));
    document.getElementById("v-grand").innerHTML =
        `<strong>${fmtINR(rounded)}</strong>`;

    // Notes
    if (inv.notes) {
        document.getElementById("notes-section").style.display = "block";
        document.getElementById("v-notes").textContent = inv.notes;
    }
}

// ── Mark paid / unpaid ────────────────────────────────────
async function cycleStatus() {
    if (!currentInvoice) return;
    const newStatus = currentInvoice.status === "paid" ? "unpaid" : "paid";

    try {
        await api.put(`/invoices/${invoiceId}/status`, { status: newStatus });
        currentInvoice.status = newStatus;
        renderInvoice(currentInvoice);
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
}

// Invocice delete
async function deleteInvoice() {
    if (!currentInvoice) return;

    if (
        !confirm(
            `Delete invoice ${currentInvoice.invoice_number}?\n\nThis cannot be undone.`,
        )
    )
        return;

    const btn = document.getElementById("delete-btn");
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        await api.delete(`/invoices/${invoiceId}`);
        window.location.href = "/invoices.html";
    } catch (err) {
        alert("Failed to delete: " + err.message);
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

// ── PDF download ──────────────────────────────────────────
async function downloadPdf() {
    const btn = document.getElementById("pdf-btn");
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentInvoice?.invoice_number ?? "invoice"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("PDF failed: " + err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

loadInvoice();

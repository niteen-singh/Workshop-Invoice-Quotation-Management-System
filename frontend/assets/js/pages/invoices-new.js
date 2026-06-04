const GST_RATES = [0, 5, 12, 18, 28];
let rowId = 0;

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    setDefaultDates();
    await loadCustomers();
    await setNextInvoiceNumber();
    addRow();
    addRow();
});

// ── Dates ─────────────────────────────────────────────────
function setDefaultDates() {
    const today = new Date().toISOString().split("T")[0];
    const due = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];
    document.getElementById("invoice-date").value = today;
    document.getElementById("due-date").value = due;
}

// ── Customers dropdown ────────────────────────────────────
async function loadCustomers() {
    const sel = document.getElementById("customer-select");
    try {
        const res = await api.get("/customers");
        sel.innerHTML = '<option value="">Select customer…</option>';
        res.data.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
    } catch (err) {
        sel.innerHTML = '<option value="">Failed to load customers</option>';
    }
}

// ── Auto invoice number ───────────────────────────────────
async function setNextInvoiceNumber() {
    try {
        const res = await api.get("/invoices/next-number");
        document.getElementById("invoice-number").value = res.number;
    } catch {
        document.getElementById("invoice-number").value = "INV-001";
    }
}

// ── Row management ────────────────────────────────────────
const MAX_ROWS = 12;

function addRow() {
    const body = document.getElementById("line-items-body");

    if (body.rows.length >= MAX_ROWS) {
        alert(`Maximum ${MAX_ROWS} line items per invoice to fit on one page.`);
        return;
    }

    rowId++;
    const id = rowId;
    const tr = document.createElement("tr");
    tr.id = "row-" + id;

    tr.innerHTML = `
        <td style="text-align:center;color:var(--muted);font-size:0.85rem" class="row-idx"></td>
        <td><input type="text" placeholder="e.g. Lathe work – MS shaft" oninput="recalc()" /></td>
        <td><input type="text" placeholder="8466" style="font-family:monospace" /></td>
        <td>
            <select onchange="recalc()">
                ${GST_RATES.map(
                    (r) =>
                        `<option value="${r}" ${r === 18 ? "selected" : ""}>${r}%</option>`,
                ).join("")}
            </select>
        </td>
        <td><input type="number" min="0" step="0.01" value="1"
                   style="text-align:right" oninput="recalc()" /></td>
        <td><input type="number" min="0" step="0.01" placeholder="0.00"
                   style="text-align:right" oninput="recalc()" /></td>
        <td class="row-total" id="row-total-${id}">₹0.00</td>
        <td style="text-align:center">
            <button onclick="removeRow(${id})"
                    style="background:none;border:none;cursor:pointer;
                           color:var(--muted);font-size:1.1rem;padding:0.2rem 0.5rem"
                    onmouseover="this.style.color='#f09a9a'"
                    onmouseout="this.style.color='var(--muted)'"
                    aria-label="Remove row">✕</button>
        </td>
    `;
    body.appendChild(tr);
    reindex();
    recalc();
}

function removeRow(id) {
    document.getElementById("row-" + id)?.remove();
    reindex();
    recalc();
}

function reindex() {
    const rows = document.querySelectorAll("#line-items-body tr");
    rows.forEach((tr, i) => {
        tr.querySelector(".row-idx").textContent = i + 1;
    });
    const counter = document.getElementById("row-counter");
    if (counter) counter.textContent = `${rows.length} / ${MAX_ROWS}`;
}

// ── Calculations ──────────────────────────────────────────
function fmt(n) {
    return (
        "₹" +
        parseFloat(n)
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
}

function recalc() {
    let subtotal = 0,
        totalGst = 0;

    document.querySelectorAll("#line-items-body tr").forEach((tr) => {
        const inputs = tr.querySelectorAll("input");
        const gstPct = parseFloat(tr.querySelector("select")?.value) || 0;
        const qty = parseFloat(inputs[2]?.value) || 0;
        const rate = parseFloat(inputs[3]?.value) || 0;

        const taxable = qty * rate;
        const gstAmt = (taxable * gstPct) / 100;

        subtotal += taxable;
        totalGst += gstAmt;

        const id = tr.id.replace("row-", "");
        const cell = document.getElementById("row-total-" + id);
        if (cell) cell.textContent = fmt(taxable + gstAmt);
    });

    const exact = subtotal + totalGst;
    const rounded = Math.round(exact);
    const roundOff = rounded - exact;

    document.getElementById("t-subtotal").textContent = fmt(subtotal);
    document.getElementById("t-cgst").textContent = fmt(totalGst / 2);
    document.getElementById("t-sgst").textContent = fmt(totalGst / 2);
    document.getElementById("t-roundoff").textContent =
        (roundOff >= 0 ? "+" : "") + fmt(Math.abs(roundOff));
    document.getElementById("t-grand").innerHTML =
        `<strong>${fmt(rounded)}</strong>`;
}

// ── Collect line items ────────────────────────────────────
function collectLineItems() {
    const items = [];
    let valid = true;

    document.querySelectorAll("#line-items-body tr").forEach((tr) => {
        const inputs = tr.querySelectorAll("input");
        const desc = inputs[0]?.value.trim();
        const hsn = inputs[1]?.value.trim();
        const gstPct = parseFloat(tr.querySelector("select")?.value) || 0;
        const qty = parseFloat(inputs[2]?.value) || 0;
        const rate = parseFloat(inputs[3]?.value) || 0;

        if (!desc) {
            valid = false;
            return;
        }

        const taxable = qty * rate;
        const total = taxable + (taxable * gstPct) / 100;

        items.push({
            description: desc,
            hsn: hsn || null,
            gst_percent: gstPct,
            quantity: qty,
            unit_price: rate,
            total: parseFloat(total.toFixed(2)),
        });
    });

    return { items, valid };
}

// ── Helper: get value or null ─────────────────────────────
function val(id) {
    return document.getElementById(id)?.value.trim() || null;
}

// ── Save ──────────────────────────────────────────────────
async function saveInvoice() {
    const btn = document.getElementById("save-btn");

    const customer_id = val("customer-select");
    const invoice_number = val("invoice-number");
    const invoice_date = val("invoice-date");

    if (!customer_id) return alert("Please select a customer.");
    if (!invoice_number) return alert("Invoice number is required.");
    if (!invoice_date) return alert("Invoice date is required.");

    const { items, valid } = collectLineItems();
    if (!valid || !items.length)
        return alert("Please add at least one line item with a description.");

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        await api.post("/invoices", {
            customer_id,
            invoice_number,
            invoice_date,
            due_date: val("due-date"),
            challan_no: val("challan_no"),
            challan_date: val("challan_date"),
            po_no: val("po_no"),
            po_date: val("po_date"),
            vendor_code: val("vendor_code"),
            vehicle_no: val("vehicle_no"),
            notes: val("notes"),
            line_items: items,
        });
        window.location.href = "/invoices.html";
    } catch (err) {
        alert("Failed to save: " + err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

// ── PDF preview ───────────────────────────────────────────
async function previewPdf() {
    const { items } = collectLineItems();
    if (!items.length)
        return alert("Add at least one line item before previewing.");
    alert(
        "Save the invoice first, then use the PDF button on the invoice view page.",
    );
}

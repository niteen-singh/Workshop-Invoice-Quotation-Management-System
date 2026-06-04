const MAX_ROWS = 15;
let rowId = 0;

document.addEventListener("DOMContentLoaded", async () => {
    setDefaultDates();
    await loadCustomers();
    await setNextQuoteNumber();
    addRow();
    addRow();
});

function setDefaultDates() {
    const today = new Date().toISOString().split("T")[0];
    const valid = new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0];
    document.getElementById("quote-date").value = today;
    document.getElementById("valid-until").value = valid;
}

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
        sel.innerHTML = '<option value="">Failed to load</option>';
    }
}

async function setNextQuoteNumber() {
    try {
        const res = await api.get("/quotations/next-number");
        document.getElementById("quote-number").value = res.number;
    } catch {
        document.getElementById("quote-number").value = "QT-001";
    }
}

function addRow() {
    const body = document.getElementById("line-items-body");
    if (body.rows.length >= MAX_ROWS) {
        alert(`Maximum ${MAX_ROWS} line items per quotation.`);
        return;
    }
    rowId++;
    const id = rowId;
    const tr = document.createElement("tr");
    tr.id = "row-" + id;
    tr.innerHTML = `
        <td style="text-align:center;color:var(--muted);font-size:0.85rem" class="row-idx"></td>
        <td><input type="text" placeholder="e.g. MS shaft turning" oninput="recalc()" /></td>
        <td><input type="text" placeholder="8466" style="font-family:monospace" /></td>
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
                    aria-label="Remove">✕</button>
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

function fmt(n) {
    return (
        "₹" +
        parseFloat(n)
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    );
}

function recalc() {
    let grand = 0;
    document.querySelectorAll("#line-items-body tr").forEach((tr) => {
        const inputs = tr.querySelectorAll("input");
        const qty = parseFloat(inputs[2]?.value) || 0;
        const price = parseFloat(inputs[3]?.value) || 0;
        const amount = qty * price;
        grand += amount;
        const id = tr.id.replace("row-", "");
        const cell = document.getElementById("row-total-" + id);
        if (cell) cell.textContent = fmt(amount);
    });
    document.getElementById("t-grand").innerHTML =
        `<strong>${fmt(grand)}</strong>`;
}

function collectLineItems() {
    const items = [];
    let valid = true;
    document.querySelectorAll("#line-items-body tr").forEach((tr) => {
        const inputs = tr.querySelectorAll("input");
        const desc = inputs[0]?.value.trim();
        const hsn = inputs[1]?.value.trim();
        const qty = parseFloat(inputs[2]?.value) || 0;
        const price = parseFloat(inputs[3]?.value) || 0;
        if (!desc) {
            valid = false;
            return;
        }
        items.push({
            description: desc,
            hsn: hsn || null,
            gst_percent: 0, // quotation doesn't need GST per line
            quantity: qty,
            unit_price: price,
            total: parseFloat((qty * price).toFixed(2)),
        });
    });
    return { items, valid };
}

function val(id) {
    return document.getElementById(id)?.value.trim() || null;
}

async function saveQuotation() {
    const btn = document.getElementById("save-btn");

    const customer_id = val("customer-select");
    const quote_number = val("quote-number");
    const quote_date = val("quote-date");

    if (!customer_id) return alert("Please select a customer.");
    if (!quote_number) return alert("Quote number is required.");
    if (!quote_date) return alert("Quote date is required.");

    const { items, valid } = collectLineItems();
    if (!valid || !items.length)
        return alert("Please add at least one line item.");

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        await api.post("/quotations", {
            customer_id,
            quote_number,
            quote_date,
            valid_until: val("valid-until"),
            attention: val("attention"),
            subject: val("subject"),
            notes: val("notes"),
            line_items: items,
        });
        window.location.href = "/quotations.html";
    } catch (err) {
        alert("Failed to save: " + err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

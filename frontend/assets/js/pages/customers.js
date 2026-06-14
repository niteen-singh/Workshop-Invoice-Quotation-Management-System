let allCustomers = [];
let editingId = null; // track which customer is being edited

const AVATAR_COLORS = [
    { bg: "#1e3a5f", color: "#90b8f8" },
    { bg: "#1a3d2b", color: "#6fcf97" },
    { bg: "#3d2b1a", color: "#f0b97a" },
    { bg: "#2e1a3d", color: "#c39af0" },
    { bg: "#3d1a1a", color: "#f09a9a" },
];

function avatarStyle(name) {
    const i = name.charCodeAt(0) % AVATAR_COLORS.length;
    const c = AVATAR_COLORS[i];
    return `background:${c.bg};color:${c.color}`;
}

function initials(name) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

function sinceDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
    });
}

async function loadCustomers() {
    const tbody = document.getElementById("customers-tbody");
    try {
        const res = await api.get("/customers");
        allCustomers = res.data;
        renderTable(allCustomers);
        document.getElementById("customer-count").textContent =
            `${allCustomers.length} customer${allCustomers.length !== 1 ? "s" : ""}`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5"
            style="text-align:center;color:var(--muted)">${err.message}</td></tr>`;
    }
}

function renderTable(customers) {
    const tbody = document.getElementById("customers-tbody");
    if (!customers.length) {
        tbody.innerHTML = `<tr><td colspan="5"
            style="text-align:center;color:var(--muted)">No customers found</td></tr>`;
        return;
    }
    tbody.innerHTML = customers
        .map(
            (c) => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.9rem">
                    <div style="width:42px;height:42px;border-radius:50%;
                                display:flex;align-items:center;justify-content:center;
                                font-weight:600;font-size:0.85rem;flex-shrink:0;
                                ${avatarStyle(c.name)}">
                        ${initials(c.name)}
                    </div>
                    <div>
                        <div style="font-weight:500;color:var(--text)">${c.name}</div>
                        ${
                            c.email
                                ? `<div style="font-size:0.82rem;color:var(--muted)">${c.email}</div>`
                                : ""
                        }
                    </div>
                </div>
            </td>
            <td style="color:var(--text)">${c.phone ?? "—"}</td>
            <td style="font-weight:600;color:var(--text)">${c.gstin ?? "—"}</td>
            <td style="color:var(--muted)">${sinceDate(c.created_at)}</td>
            <td>
                <div style="display:flex;gap:0.5rem;justify-content:flex-end">
                    <button onclick="openEditModal('${c.id}')"
                            style="background:none;border:1px solid var(--border);
                                   border-radius:8px;padding:0.25rem 0.6rem;
                                   color:var(--muted);cursor:pointer;font-size:0.8rem">
                        Edit
                    </button>
                    <button onclick="deleteCustomer('${c.id}','${c.name.replace(/'/g, "\\'")}')"
                            style="background:none;border:1px solid #6b2a2a;
                                   border-radius:8px;padding:0.25rem 0.6rem;
                                   color:#f09a9a;cursor:pointer;font-size:0.8rem">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `,
        )
        .join("");
}

function filterTable(q) {
    const lower = q.toLowerCase();
    const filtered = allCustomers.filter((c) =>
        [c.name, c.phone, c.gstin, c.email].some((v) =>
            v?.toLowerCase().includes(lower),
        ),
    );
    renderTable(filtered);
    document.getElementById("customer-count").textContent =
        `${filtered.length} customer${filtered.length !== 1 ? "s" : ""}`;
}

// ── Add customer ──────────────────────────────────────────
async function submitCustomer(e) {
    e.preventDefault();
    const btn = document.getElementById("save-btn");
    const data = Object.fromEntries(new FormData(e.target));

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        const res = await api.post("/customers", data);
        allCustomers.unshift(res.data);
        renderTable(allCustomers);
        document.getElementById("customer-count").textContent =
            `${allCustomers.length} customers`;
        e.target.reset();
        closeModal();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

// ── Edit customer ─────────────────────────────────────────
function openEditModal(id) {
    const customer = allCustomers.find((c) => c.id === id);
    if (!customer) return;

    editingId = id;

    // pre-fill the edit form
    document.getElementById("edit-name").value = customer.name ?? "";
    document.getElementById("edit-phone").value = customer.phone ?? "";
    document.getElementById("edit-email").value = customer.email ?? "";
    document.getElementById("edit-gstin").value = customer.gstin ?? "";
    document.getElementById("edit-address").value = customer.address ?? "";

    document.getElementById("customer-edit-modal").showModal();
}

function closeEditModal() {
    editingId = null;
    document.getElementById("customer-edit-modal").close();
}

async function submitEdit(e) {
    e.preventDefault();
    if (!editingId) return;

    const btn = document.getElementById("edit-save-btn");
    const data = Object.fromEntries(new FormData(e.target));

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        const res = await api.put(`/customers/${editingId}`, data);

        // update local array
        const idx = allCustomers.findIndex((c) => c.id === editingId);
        if (idx !== -1) allCustomers[idx] = res.data;

        renderTable(allCustomers);
        closeEditModal();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

// ── Delete customer ───────────────────────────────────────
async function deleteCustomer(id, name) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
        await api.delete(`/customers/${id}`);
        allCustomers = allCustomers.filter((c) => c.id !== id);
        renderTable(allCustomers);
        document.getElementById("customer-count").textContent =
            `${allCustomers.length} customers`;
    } catch (err) {
        alert(err.message);
    }
}

function openModal() {
    document.getElementById("customer-modal").showModal();
}
function closeModal() {
    document.getElementById("customer-modal").close();
}

loadCustomers();

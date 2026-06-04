let allCustomers = [];

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
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

async function loadCustomers() {
    const tbody = document.getElementById("customers-tbody");
    try {
        const res = await api.get("/customers");
        allCustomers = res.data;
        renderTable(allCustomers);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="secondary" style="text-align:center">${err.message}</td></tr>`;
    }
}

// function renderTable(customers) {
//     const tbody = document.getElementById("customers-tbody");
//     if (!customers.length) {
//         tbody.innerHTML = `<tr><td colspan="6" class="secondary" style="text-align:center">No customers found</td></tr>`;
//         return;
//     }
//     tbody.innerHTML = customers
//         .map(
//             (c, i) => `
//     <tr>
//       <td>${i + 1}</td>
//       <td>
//         <strong>${c.name}</strong>
//         ${c.email ? `<br><small class="secondary">${c.email}</small>` : ""}
//       </td>
//       <td>${c.phone ?? "—"}</td>
//       <td><code>${c.gstin ?? "—"}</code></td>
//       <td style="max-width:180px">${c.address ?? "—"}</td>
//       <td>
//         <button class="secondary outline" style="padding:0.2rem 0.6rem;font-size:0.75rem"
//                 onclick="deleteCustomer('${c.id}', '${c.name}')">Delete</button>
//       </td>
//     </tr>
//   `,
//         )
//         .join("");
// }

function renderTable(customers) {
    const tbody = document.getElementById("customers-tbody");
    if (!customers.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted)">No customers found</td></tr>`;
        return;
    }
    tbody.innerHTML = customers
        .map(
            (c) => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:0.9rem">
                    <div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;
                                justify-content:center;font-weight:600;font-size:0.85rem;flex-shrink:0;
                                ${avatarStyle(c.name)}">
                        ${initials(c.name)}
                    </div>
                    <div>
                        <div style="font-weight:500;color:var(--text)">${c.name}</div>
                        ${c.email ? `<div style="font-size:0.82rem;color:var(--muted)">${c.email}</div>` : ""}
                    </div>
                </div>
            </td>
            <td style="color:var(--text)">${c.phone ?? "—"}</td>
            <td style="font-weight:600;color:var(--text)">${c.gstin ?? "—"}</td>
            <td style="color:var(--muted)">${sinceDate(c.created_at)}</td>
        </tr>
    `,
        )
        .join("");
}

// function filterTable(q) {
//     const lower = q.toLowerCase();
//     const filtered = allCustomers.filter((c) =>
//         [c.name, c.phone, c.gstin, c.email, c.address].some((v) =>
//             v?.toLowerCase().includes(lower),
//         ),
//     );
//     renderTable(filtered);
// }

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

// async function submitCustomer(e) {
//     e.preventDefault();
//     const form = e.target;
//     const btn = document.getElementById("save-btn");
//     const data = Object.fromEntries(new FormData(form));

//     btn.setAttribute("aria-busy", "true");
//     btn.disabled = true;

//     try {
//         const res = await api.post("/customers", data);
//         allCustomers.unshift(res.data);
//         renderTable(allCustomers);
//         form.reset();
//         closeModal();
//     } catch (err) {
//         alert(err.message);
//     } finally {
//         btn.removeAttribute("aria-busy");
//         btn.disabled = false;
//     }
// }

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

async function deleteCustomer(id, name) {
    if (!confirm(`Delete ${name}?`)) return;
    try {
        await api.delete(`/customers/${id}`);
        allCustomers = allCustomers.filter((c) => c.id !== id);
        renderTable(allCustomers);
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

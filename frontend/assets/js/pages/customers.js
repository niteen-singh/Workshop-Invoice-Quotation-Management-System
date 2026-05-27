let allCustomers = [];

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

function renderTable(customers) {
    const tbody = document.getElementById("customers-tbody");
    if (!customers.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="secondary" style="text-align:center">No customers found</td></tr>`;
        return;
    }
    tbody.innerHTML = customers
        .map(
            (c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <strong>${c.name}</strong>
        ${c.email ? `<br><small class="secondary">${c.email}</small>` : ""}
      </td>
      <td>${c.phone ?? "—"}</td>
      <td><code>${c.gstin ?? "—"}</code></td>
      <td style="max-width:180px">${c.address ?? "—"}</td>
      <td>
        <button class="secondary outline" style="padding:0.2rem 0.6rem;font-size:0.75rem"
                onclick="deleteCustomer('${c.id}', '${c.name}')">Delete</button>
      </td>
    </tr>
  `,
        )
        .join("");
}

function filterTable(q) {
    const lower = q.toLowerCase();
    const filtered = allCustomers.filter((c) =>
        [c.name, c.phone, c.gstin, c.email, c.address].some((v) =>
            v?.toLowerCase().includes(lower),
        ),
    );
    renderTable(filtered);
}

async function submitCustomer(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("save-btn");
    const data = Object.fromEntries(new FormData(form));

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        const res = await api.post("/customers", data);
        allCustomers.unshift(res.data);
        renderTable(allCustomers);
        form.reset();
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

const FIELDS = [
    "company_name",
    "tagline",
    "office_address",
    "works_address",
    "email",
    "mobile1",
    "mobile2",
    "gstin",
    "state",
    "state_code",
    "pan",
    "bank_name",
    "account_name",
    "account_no",
    "bank_branch",
    "ifsc",
    "terms",
];

let profileExists = false;

function showToast(message, isError = false) {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 0.85rem 1.4rem;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 9999;
        transition: opacity 0.4s ease;
        background: ${isError ? "#3d1a1a" : "#1a3d2b"};
        color:      ${isError ? "#f09a9a" : "#6fcf97"};
        border: 1px solid ${isError ? "#6b2a2a" : "#2d6b4a"};
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

async function loadProfile() {
    if (new URLSearchParams(window.location.search).get("setup") === "1") {
        document.getElementById("setup-banner").style.display = "block";
    }

    try {
        const res = await api.get("/profile");
        if (!res.data) return;

        profileExists = true;
        FIELDS.forEach((key) => {
            const el = document.getElementById(key);
            if (el) el.value = res.data[key] ?? "";
        });
    } catch (err) {
        console.error("Failed to load profile:", err);
    }
}

async function saveProfile() {
    const btn = document.getElementById("save-btn");
    const body = {};
    FIELDS.forEach((key) => {
        const el = document.getElementById(key);
        if (el) body[key] = el.value.trim();
    });

    if (!body.company_name) return showToast("Company name is required.", true);
    if (!body.bank_name) return showToast("Bank name is required.", true);
    if (!body.account_no) return showToast("Account number is required.", true);
    if (!body.bank_branch) return showToast("Bank branch is required.", true);
    if (!body.ifsc) return showToast("IFSC code is required.", true);

    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    try {
        if (profileExists) {
            await api.put("/profile", body);
        } else {
            await api.post("/profile", body);
            profileExists = true;
        }

        const isSetup =
            new URLSearchParams(window.location.search).get("setup") === "1";
        if (isSetup) {
            window.location.href = "/index.html";
        } else {
            showToast("Settings saved successfully!");
        }
    } catch (err) {
        showToast("Failed to save: " + err.message, true);
    } finally {
        btn.removeAttribute("aria-busy");
        btn.disabled = false;
    }
}

loadProfile();

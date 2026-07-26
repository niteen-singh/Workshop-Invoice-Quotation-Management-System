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

// ── Logo preview helpers ────────────────────────────────────
// NOTE: uses the same `BASE` ("/api") constant that api.js declares at the
// top level — script tags on the same page share a global scope, so this
// is visible here as long as api.js loads before settings.js (it does, per
// settings.html's <script> order). This keeps logo requests going through
// whatever proxy/rewrite makes api.js's own "/api/..." calls reach the
// backend correctly.
function logoUrl(logoPath) {
    if (!logoPath) return null;
    const clean = logoPath.replace(/^\/+/, "");
    // Cache-bust so re-uploading under a new filename always shows fresh.
    return `${BASE}/${clean}?t=${Date.now()}`;
}

function renderLogoPreview(logoPath) {
    const img = document.getElementById("logo-preview");
    const empty = document.getElementById("logo-preview-empty");
    const removeBtn = document.getElementById("logo-remove-btn");

    const url = logoUrl(logoPath);
    if (url) {
        img.src = url;
        img.style.display = "block";
        empty.style.display = "none";
        removeBtn.style.display = "inline-block";
    } else {
        img.style.display = "none";
        img.removeAttribute("src");
        empty.style.display = "block";
        removeBtn.style.display = "none";
    }
}

async function onLogoSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast("Logo must be under 2MB.", true);
        event.target.value = "";
        return;
    }

    const uploadBtn = document.getElementById("logo-upload-btn");
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";

    try {
        const formData = new FormData();
        formData.append("logo", file);

        // Raw fetch (not the api.* JSON helper) since this is a
        // multipart/form-data upload — let the browser set the
        // Content-Type boundary itself, don't set it manually.
        // Routed through the same BASE prefix as api.js for consistency.
        const res = await fetch(`${BASE}/profile/logo`, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        if (res.status === 401) {
            window.location.href = "/login.html";
            return;
        }

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Upload failed");

        renderLogoPreview(body.logo_path);
        showToast("Logo uploaded.");
    } catch (err) {
        showToast("Failed to upload logo: " + err.message, true);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload logo";
        event.target.value = "";
    }
}

async function removeLogo() {
    const removeBtn = document.getElementById("logo-remove-btn");
    removeBtn.disabled = true;

    try {
        const res = await fetch(`${BASE}/profile/logo`, {
            method: "DELETE",
            credentials: "include",
        });

        if (res.status === 401) {
            window.location.href = "/login.html";
            return;
        }

        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to remove logo");

        renderLogoPreview(null);
        showToast("Logo removed.");
    } catch (err) {
        showToast("Failed to remove logo: " + err.message, true);
    } finally {
        removeBtn.disabled = false;
    }
}

// ── Profile load / save (unchanged text-field behavior) ────
async function loadProfile() {
    if (new URLSearchParams(window.location.search).get("setup") === "1") {
        document.getElementById("setup-banner").style.display = "block";
    }

    try {
        const res = await api.get("/profile");
        if (!res.data) {
            renderLogoPreview(null);
            return;
        }

        profileExists = true;
        FIELDS.forEach((key) => {
            const el = document.getElementById(key);
            if (el) el.value = res.data[key] ?? "";
        });
        renderLogoPreview(res.data.logo_path ?? null);
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

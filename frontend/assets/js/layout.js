async function loadSidebar(activePage) {
    // ── Step 1: auth check (skip on auth pages) ───────────
    const authPages = ["login", "signup"];
    if (!authPages.includes(activePage)) {
        try {
            await api.get("/auth/me");
        } catch {
            window.location.href = "/login.html";
            return;
        }
    }

    // ── Step 2: load sidebar ──────────────────────────────
    const sidebar = document.getElementById("sidebar-placeholder");
    try {
        const res = await fetch("/partials/sidebar.html");
        if (!res.ok) throw new Error("Failed to load sidebar");
        sidebar.innerHTML = await res.text();

        sidebar.querySelectorAll("[data-page]").forEach((link) => {
            if (link.dataset.page === activePage)
                link.setAttribute("aria-current", "page");
        });

        // inject user name into sidebar footer
        try {
            const me = await api.get("/auth/me");
            const nameEl = sidebar.querySelector("#sidebar-user-name");
            if (nameEl) nameEl.textContent = me.data.name;
        } catch {}
    } catch (err) {
        console.error("Sidebar load error:", err);
    }

    // ── Step 3: profile check ─────────────────────────────
    if (activePage === "settings") return;

    try {
        const res = await api.get("/profile");
        if (!res.data) {
            window.location.href = "/settings.html?setup=1";
        }
    } catch (err) {
        console.error("Profile check failed:", err);
    }
}

async function handleLogout() {
    try {
        await api.post("/auth/signout", {});
    } catch {}
    window.location.href = "/login.html";
}

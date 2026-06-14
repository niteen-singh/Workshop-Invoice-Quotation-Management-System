async function handleLogout() {
    try {
        await api.post("/auth/signout", {});
    } catch {}
    window.location.href = "/login.html";
}

function getInitials(name) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

async function loadSidebar(activePage) {
    // ── Step 1: auth check ────────────────────────────────
    const authPages = ["login", "signup"];
    if (!authPages.includes(activePage)) {
        try {
            await api.get("/auth/me");
        } catch {
            window.location.href = "/login.html";
            return;
        }
    }

    // ── Step 2: load sidebar HTML ─────────────────────────
    const sidebar = document.getElementById("sidebar-placeholder");
    try {
        const res = await fetch("/partials/sidebar.html");
        if (!res.ok) throw new Error("Failed to load sidebar");
        sidebar.innerHTML = await res.text();

        // mark active link
        sidebar.querySelectorAll("[data-page]").forEach((link) => {
            if (link.dataset.page === activePage)
                link.setAttribute("aria-current", "page");
        });

        // inject user info
        try {
            const me = await api.get("/auth/me");
            const user = me.data;

            const nameEl = sidebar.querySelector("#sidebar-user-name");
            const avatarEl = sidebar.querySelector("#sidebar-avatar");

            if (nameEl) nameEl.textContent = user.name;
            if (avatarEl) avatarEl.textContent = getInitials(user.name);
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

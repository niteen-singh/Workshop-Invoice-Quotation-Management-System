// async function loadSidebar(activePage) {
//     const sidebar = document.getElementById("sidebar-placeholder");

//     try {
//         const res = await fetch("/partials/sidebar.html"); // ← absolute

//         if (!res.ok) throw new Error("Failed to load sidebar");

//         sidebar.innerHTML = await res.text();

//         sidebar.querySelectorAll("[data-page]").forEach((link) => {
//             if (link.dataset.page === activePage) {
//                 link.setAttribute("aria-current", "page");
//             }
//         });
//     } catch (err) {
//         console.error("Sidebar load error:", err);
//     }
// }
async function loadSidebar(activePage) {
    const sidebar = document.getElementById("sidebar-placeholder");

    try {
        const res = await fetch("/partials/sidebar.html");
        if (!res.ok) throw new Error("Failed to load sidebar");
        sidebar.innerHTML = await res.text();

        sidebar.querySelectorAll("[data-page]").forEach((link) => {
            if (link.dataset.page === activePage)
                link.setAttribute("aria-current", "page");
        });
    } catch (err) {
        console.error("Sidebar load error:", err);
    }

    // ── First-time setup guard ────────────────────────────
    // Skip the check if user is already on settings page
    if (activePage === "settings") return;

    try {
        const res = await api.get("/profile");
        if (!res.data) {
            // Profile not set up yet — send to settings
            window.location.href = "/settings.html?setup=1";
        }
    } catch (err) {
        console.error("Profile check failed:", err);
    }
}

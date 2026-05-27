async function loadSidebar(activePage) {
    const sidebar = document.getElementById("sidebar-placeholder");

    try {
        const res = await fetch("/partials/sidebar.html"); // ← absolute

        if (!res.ok) throw new Error("Failed to load sidebar");

        sidebar.innerHTML = await res.text();

        sidebar.querySelectorAll("[data-page]").forEach((link) => {
            if (link.dataset.page === activePage) {
                link.setAttribute("aria-current", "page");
            }
        });
    } catch (err) {
        console.error("Sidebar load error:", err);
    }
}

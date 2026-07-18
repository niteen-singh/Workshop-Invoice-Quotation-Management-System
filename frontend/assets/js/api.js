const BASE = "/api";

async function request(method, path, body) {
    const url =
        method === "GET"
            ? `${BASE}${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
            : `${BASE}${path}`;

    const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // ── Global 401 handler ────────────────────────────────
    // If token expired or missing mid-session, redirect to login
    // Skip redirect if we're already on an auth page
    if (res.status === 401) {
        const authPages = ["/login.html", "/signup.html"];
        const isAuthPage = authPages.some((p) =>
            window.location.pathname.endsWith(p),
        );
        if (!isAuthPage) {
            window.location.href = "/login.html";
            return;
        }
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
}

const api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
};

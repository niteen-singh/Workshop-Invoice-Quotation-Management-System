const BASE = "/api"; // nginx proxies /api → backend:8000

async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });

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

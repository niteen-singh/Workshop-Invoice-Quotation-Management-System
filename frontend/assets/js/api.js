// const BASE = "/api"; // nginx proxies /api → backend:8000

// async function request(method, path, body) {
//     const res = await fetch(`${BASE}${path}`, {
//         method,
//         headers: { "Content-Type": "application/json" },
//         body: body ? JSON.stringify(body) : undefined,
//     });

//     const data = await res.json();
//     if (!res.ok) throw new Error(data.error ?? "Request failed");
//     return data;
// }

// const api = {
//     get: (path) => request("GET", path),
//     post: (path, body) => request("POST", path, body),
//     put: (path, body) => request("PUT", path, body),
//     delete: (path) => request("DELETE", path),
// };

const BASE = "/api";

async function request(method, path, body) {
    // append timestamp to GET requests to prevent 304 caching
    const url =
        method === "GET"
            ? `${BASE}${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`
            : `${BASE}${path}`;

    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        },
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

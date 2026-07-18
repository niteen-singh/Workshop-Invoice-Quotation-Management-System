document.addEventListener("DOMContentLoaded", async () => {
    // already logged in → go to dashboard
    try {
        await api.get("/auth/me");
        window.location.href = "/index.html";
        return;
    } catch {}

    // always show signup link — open registration
    document.getElementById("signup-link").style.display = "block";
});

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errorDiv = document.getElementById("login-error");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    errorDiv.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Signing in…";

    try {
        await api.post("/auth/signin", { email, password });

        try {
            const profile = await api.get("/profile");
            if (!profile.data) {
                window.location.href = "/settings.html?setup=1";
            } else {
                window.location.href = "/index.html";
            }
        } catch {
            window.location.href = "/index.html";
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Sign in";
    }
}

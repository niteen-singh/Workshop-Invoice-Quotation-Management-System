document.addEventListener("DOMContentLoaded", async () => {
    // if users already exist, signup is closed
    try {
        const res = await api.get("/auth/exists");
        if (res.exists) {
            window.location.href = "/login.html";
        }
    } catch {}
});

async function handleSignup(e) {
    e.preventDefault();
    const btn = document.getElementById("signup-btn");
    const errorDiv = document.getElementById("signup-error");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    errorDiv.style.display = "none";

    if (password !== confirmPassword) {
        errorDiv.textContent = "Passwords do not match";
        errorDiv.style.display = "block";
        return;
    }

    if (password.length < 8) {
        errorDiv.textContent = "Password must be at least 8 characters";
        errorDiv.style.display = "block";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Creating account…";

    try {
        await api.post("/auth/signup", { name, email, password });
        // redirect to settings on first login
        window.location.href = "/settings.html?setup=1";
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Create account";
    }
}

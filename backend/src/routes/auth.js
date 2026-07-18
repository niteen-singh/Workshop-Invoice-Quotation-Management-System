const { Router } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../lib/checks");

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production" ? true : false,
    maxAge: 24 * 60 * 60 * 1000,
};

// ── GET /auth/me ──────────────────────────────────────────
// Check if user is logged in — frontend calls this on every page load
router.get("/me", async (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const { rows } = await pool.query(
            "SELECT id, name, email, created_at FROM users WHERE id = $1",
            [payload.userId],
        );
        if (!rows.length)
            return res.status(401).json({ error: "User not found" });
        res.json({ data: rows[0] });
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
});

// ── GET /auth/exists ──────────────────────────────────────
// Check if ANY user exists — used on signup page to prevent
// anyone from creating a second account on a deployed instance
router.get("/exists", async (_req, res) => {
    try {
        const { rows } = await pool.query("SELECT COUNT(*) FROM users");
        res.json({ exists: parseInt(rows[0].count) > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /auth/signup ─────────────────────────────────────
router.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res
            .status(400)
            .json({ error: "Name, email and password are required" });

    if (password.length < 8)
        return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });

    try {
        const hash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3) RETURNING id, name, email`,
            [name, email.toLowerCase().trim(), hash],
        );
        const user = rows[0];
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
            expiresIn: "24h",
        });

        res.cookie("token", token, COOKIE_OPTS);
        res.status(201).json({
            data: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        if (err.code === "23505")
            return res.status(409).json({ error: "Email already registered" });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /auth/signin ─────────────────────────────────────
// Simple rate limiting — track attempts in memory
const loginAttempts = new Map();

router.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res
            .status(400)
            .json({ error: "Email and password are required" });

    // rate limit: max 5 attempts per email per 15 minutes
    const key = email.toLowerCase().trim();
    const now = Date.now();
    const window = 15 * 60 * 1000;
    const max = 5;

    const record = loginAttempts.get(key) ?? { count: 0, firstAttempt: now };
    if (now - record.firstAttempt > window) {
        record.count = 0;
        record.firstAttempt = now;
    }
    if (record.count >= max) {
        return res.status(429).json({
            error: "Too many attempts. Try again in 15 minutes.",
        });
    }

    try {
        const { rows } = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [key],
        );

        if (!rows.length) {
            record.count++;
            loginAttempts.set(key, record);
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            record.count++;
            loginAttempts.set(key, record);
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // success — reset attempts
        loginAttempts.delete(key);

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
            expiresIn: "24h",
        });
        res.cookie("token", token, COOKIE_OPTS);
        res.json({ data: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /auth/signout ────────────────────────────────────
router.post("/signout", (_req, res) => {
    res.clearCookie("token", { httpOnly: true, sameSite: "strict" });
    res.json({ success: true });
});

module.exports = router;

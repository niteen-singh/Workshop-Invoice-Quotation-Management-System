const { Router } = require("express");
const { pool } = require("../lib/checks");

const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = Router();

//---------------------------------------------------------------------------

const uploadDir = path.join(__dirname, "../uploads/logos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.userId}-${Date.now()}${ext}`);
    },
});

const ALLOWED_EXT = [".svg", ".png", ".jpg", ".jpeg", ".webp"];

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB cap
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
            return cb(new Error("Logo must be SVG, PNG, JPG, or WEBP"));
        }
        cb(null, true);
    },
});

// POST /profile/logo
router.post("/logo", upload.single("logo"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No logo file uploaded" });
    }

    const client = await pool.connect();
    try {
        // Look up any existing logo so we can delete the old file after
        // the DB update succeeds (avoids orphaned files piling up).
        const { rows } = await client.query(
            "SELECT logo_path FROM workshop_profile WHERE user_id = $1",
            [req.userId],
        );
        const oldPath = rows[0]?.logo_path;

        // Store the path relative to the project root so it matches what
        // getLogoDataUri() in lib/pdf.js expects.
        const relativePath = path.relative(
            path.join(__dirname, ".."),
            req.file.path,
        );

        await client.query(
            `UPDATE workshop_profile SET logo_path = $1 WHERE user_id = $2`,
            [relativePath, req.userId],
        );

        if (oldPath) {
            const absOld = path.join(__dirname, "..", oldPath);
            fs.unlink(absOld, (err) => {
                if (err)
                    console.warn("Could not remove old logo:", err.message);
            });
        }

        res.json({ success: true, logo_path: relativePath });
    } catch (err) {
        // Clean up the just-uploaded file if the DB write failed
        fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// DELETE /profile/logo — remove the logo, invoices fall back to no-logo
router.delete("/logo", async (req, res) => {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(
            "SELECT logo_path FROM workshop_profile WHERE user_id = $1",
            [req.userId],
        );
        const oldPath = rows[0]?.logo_path;

        await client.query(
            "UPDATE workshop_profile SET logo_path = NULL WHERE user_id = $1",
            [req.userId],
        );

        if (oldPath) {
            const absOld = path.join(__dirname, "..", oldPath);
            fs.unlink(absOld, (err) => {
                if (err)
                    console.warn("Could not remove logo file:", err.message);
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

//----------------------------------------------------------------------------

router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM workshop_profile WHERE user_id = $1 LIMIT 1",
            [req.userId],
        );
        res.json({ data: rows[0] ?? null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/", async (req, res) => {
    const {
        company_name,
        tagline,
        office_address,
        works_address,
        email,
        mobile1,
        mobile2,
        gstin,
        state,
        state_code,
        bank_name,
        account_no,
        bank_branch,
        ifsc,
        account_name,
        pan,
        terms,
    } = req.body;

    if (!company_name)
        return res.status(400).json({ error: "company_name is required" });

    try {
        const { rows } = await pool.query(
            `INSERT INTO workshop_profile
             (company_name, tagline, office_address, works_address,
              email, mobile1, mobile2, gstin, state, state_code,
              bank_name, account_no, bank_branch, ifsc,
              account_name, pan, terms, user_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [
                company_name,
                tagline,
                office_address,
                works_address,
                email,
                mobile1,
                mobile2,
                gstin,
                state,
                state_code,
                bank_name,
                account_no,
                bank_branch,
                ifsc,
                account_name ?? null,
                pan ?? null,
                terms ?? null,
                req.userId,
            ],
        );
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/", async (req, res) => {
    const {
        company_name,
        tagline,
        office_address,
        works_address,
        email,
        mobile1,
        mobile2,
        gstin,
        state,
        state_code,
        bank_name,
        account_no,
        bank_branch,
        ifsc,
        account_name,
        pan,
        terms,
    } = req.body;

    try {
        const { rows } = await pool.query(
            `UPDATE workshop_profile SET
               company_name=$1,   tagline=$2,
               office_address=$3, works_address=$4,
               email=$5,          mobile1=$6,
               mobile2=$7,        gstin=$8,
               state=$9,          state_code=$10,
               bank_name=$11,     account_no=$12,
               bank_branch=$13,   ifsc=$14,
               account_name=$15,  pan=$16,
               terms=$17,         updated_at=now()
             WHERE user_id=$18 RETURNING *`,
            [
                company_name,
                tagline,
                office_address,
                works_address,
                email,
                mobile1,
                mobile2,
                gstin,
                state,
                state_code,
                bank_name,
                account_no,
                bank_branch,
                ifsc,
                account_name ?? null,
                pan ?? null,
                terms ?? null,
                req.userId,
            ],
        );
        if (!rows.length)
            return res
                .status(404)
                .json({ error: "Profile not found. POST first." });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

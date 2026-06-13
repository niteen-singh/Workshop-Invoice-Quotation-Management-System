const { Router } = require("express");
const { pool } = require("../lib/checks");

const router = Router();

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

const { Pool } = require("pg");

let _pool = null;

function getPool() {
    if (!_pool) {
        _pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }, // ← required for Neon
            connectionTimeoutMillis: 3000,
        });
    }
    return _pool;
}

const pool = new Proxy(
    {},
    {
        get(_, prop) {
            return (...args) => getPool()[prop](...args);
        },
    },
);

async function checkPostgres() {
    let client;
    try {
        client = await getPool().connect();
        await client.query("SELECT 1");
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    } finally {
        if (client) client.release();
    }
}

module.exports = { pool, checkPostgres };

const pg = require("pg");
const Minio = require("minio");
// reads the DATABASE_URL already in your docker-compose
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
});

async function checkPostgres() {
    const client = await pool
        .connect()
        .catch((err) => ({ error: err.message }));
    if (client.error) return { ok: false, error: client.error };
    try {
        await client.query("SELECT 1");
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    } finally {
        client.release();
    }
}

// MINIO_ENDPOINT in your compose is "minio:9000" — split host/port here
const [minioHost, minioPort] = (
    process.env.MINIO_ENDPOINT ?? "minio:9000"
).split(":");

const minioClient = new Minio.Client({
    endPoint: minioHost,
    port: Number(minioPort ?? 9000),
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD,
});

async function checkMinio() {
    try {
        await minioClient.listBuckets();
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = {
    minioClient,
    pool,
    checkPostgres,
    checkMinio,
};

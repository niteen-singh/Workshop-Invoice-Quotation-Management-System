const pool = require("../db");

const createUsersTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(255)
        );
    `;

    try {
        await pool.query(query);
        console.log("Users table created");
    } catch (err) {
        console.error(err);
    }
};

module.exports = createUsersTable;

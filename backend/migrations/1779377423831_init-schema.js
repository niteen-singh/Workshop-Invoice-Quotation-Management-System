exports.up = (pgm) => {
    // Customers / workshops
    pgm.createTable("customers", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        name: { type: "varchar(255)", notNull: true },
        phone: { type: "varchar(20)" },
        email: { type: "varchar(255)" },
        address: { type: "text" },
        gstin: { type: "varchar(15)" },
        user_id: { type: "uuid", references: '"users"', onDelete: "CASCADE" },

        created_at: { type: "timestamptz", default: pgm.func("now()") },
    });

    // Indexes for common lookups
    pgm.createIndex("customers", "phone");
};

exports.down = (pgm) => {
    pgm.dropTable("customers");
};

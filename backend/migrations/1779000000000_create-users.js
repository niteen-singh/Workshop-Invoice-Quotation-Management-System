exports.up = (pgm) => {
    pgm.createTable("users", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        name: { type: "varchar(255)", notNull: true },
        email: { type: "varchar(255)", notNull: true, unique: true },
        password: { type: "varchar(255)", notNull: true },
        created_at: { type: "timestamptz", default: pgm.func("now()") },
    });

    pgm.createIndex("users", "email");
};

exports.down = (pgm) => {
    pgm.dropTable("users");
};

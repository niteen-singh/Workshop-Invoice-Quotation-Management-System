exports.up = (pgm) => {
    pgm.createTable("workshop_profile", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        // Company
        company_name: { type: "varchar(255)", notNull: true },
        tagline: { type: "varchar(255)" },
        office_address: { type: "text" },
        works_address: { type: "text" },
        email: { type: "varchar(255)" },
        mobile1: { type: "varchar(20)" },
        mobile2: { type: "varchar(20)" },
        // GST
        gstin: { type: "varchar(15)" },
        state: { type: "varchar(100)" },
        state_code: { type: "varchar(5)" },
        // Bank
        bank_name: { type: "varchar(255)" },
        account_no: { type: "varchar(50)" },
        bank_branch: { type: "varchar(255)" },
        ifsc: { type: "varchar(20)" },
        // additional
        pan: { type: "varchar(20)" },
        account_name: { type: "varchar(255)" },
        terms: { type: "text" },

        created_at: { type: "timestamptz", default: pgm.func("now()") },
        updated_at: { type: "timestamptz", default: pgm.func("now()") },
    });
};

exports.down = (pgm) => {
    pgm.dropTable("workshop_profile");
};

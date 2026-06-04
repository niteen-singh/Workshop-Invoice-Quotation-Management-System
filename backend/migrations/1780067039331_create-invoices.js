exports.up = (pgm) => {
    pgm.createTable("quotations", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        customer_id: {
            type: "uuid",
            notNull: true,
            references: '"customers"',
            onDelete: "RESTRICT",
        },
        quote_number: { type: "varchar(50)", notNull: true, unique: true },
        status: { type: "varchar(20)", notNull: true, default: "'draft'" },
        total_amount: { type: "numeric(12,2)", notNull: true, default: 0 },
        valid_until: { type: "date" },
        notes: { type: "text" },
        // ← add these
        quote_date: { type: "date" },
        attention: { type: "varchar(255)" },
        subject: { type: "text" },
        created_at: { type: "timestamptz", default: pgm.func("now()") },
    });

    pgm.createTable("invoices", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        customer_id: {
            type: "uuid",
            notNull: true,
            references: '"customers"',
            onDelete: "RESTRICT",
        },
        quotation_id: {
            type: "uuid",
            references: '"quotations"',
            onDelete: "SET NULL",
        },
        invoice_number: { type: "varchar(50)", notNull: true, unique: true },
        status: { type: "varchar(20)", notNull: true, default: "'unpaid'" },
        total_amount: { type: "numeric(12,2)", notNull: true, default: 0 },
        // optional fields — all in one place
        invoice_date: { type: "date" },
        due_date: { type: "date" },
        paid_at: { type: "timestamptz" },
        challan_no: { type: "varchar(50)" },
        challan_date: { type: "date" },
        po_no: { type: "varchar(50)" },
        po_date: { type: "date" },
        vendor_code: { type: "varchar(50)" },
        vehicle_no: { type: "varchar(30)" },
        notes: { type: "text" },
        created_at: { type: "timestamptz", default: pgm.func("now()") },
    });

    pgm.createTable("line_items", {
        id: {
            type: "uuid",
            primaryKey: true,
            default: pgm.func("gen_random_uuid()"),
        },
        quotation_id: {
            type: "uuid",
            references: '"quotations"',
            onDelete: "CASCADE",
        },
        invoice_id: {
            type: "uuid",
            references: '"invoices"',
            onDelete: "CASCADE",
        },
        description: { type: "text", notNull: true },
        hsn: { type: "varchar(10)" },
        quantity: { type: "numeric(10,2)", notNull: true, default: 1 },
        unit_price: { type: "numeric(12,2)", notNull: true },
        gst_percent: { type: "numeric(5,2)", default: 18 },
        total: { type: "numeric(12,2)", notNull: true },
    });

    pgm.createIndex("quotations", "customer_id");
    pgm.createIndex("invoices", "customer_id");
    pgm.createIndex("invoices", "quotation_id");
    pgm.createIndex("line_items", "quotation_id");
    pgm.createIndex("line_items", "invoice_id");
};

exports.down = (pgm) => {
    pgm.dropTable("line_items");
    pgm.dropTable("invoices");
    pgm.dropTable("quotations");
};

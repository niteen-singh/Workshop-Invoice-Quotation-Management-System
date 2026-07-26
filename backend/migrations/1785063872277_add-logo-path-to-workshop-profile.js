exports.up = (pgm) => {
    pgm.addColumn("workshop_profile", {
        logo_path: { type: "text" }, // nullable — logo is optional
    });
};

exports.down = (pgm) => {
    pgm.dropColumn("workshop_profile", "logo_path");
};

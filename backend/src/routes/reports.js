const { Router } = require("express");
const { pool } = require("../lib/checks");
const ExcelJS = require("exceljs");

const router = Router();

// ── Date range from period params ─────────────────────────
function getDateRange(query) {
    const { period, year, month, quarter, half, from, to } = query;
    const y = parseInt(year);

    switch (period) {
        case "monthly": {
            const m = parseInt(month) - 1; // 0-indexed
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0); // last day of month
            const label =
                start.toLocaleString("en-IN", { month: "long" }) + "_" + y;
            return { start, end, label };
        }

        case "quarterly": {
            // QRMP quarters (Indian FY starts Apr)
            // Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
            const q = parseInt(quarter);
            const ranges = {
                1: { sm: 3, em: 5, sy: y, ey: y }, // Apr-Jun
                2: { sm: 6, em: 8, sy: y, ey: y }, // Jul-Sep
                3: { sm: 9, em: 11, sy: y, ey: y }, // Oct-Dec
                4: { sm: 0, em: 2, sy: y + 1, ey: y + 1 }, // Jan-Mar next yr
            };
            const r = ranges[q];
            const start = new Date(r.sy, r.sm, 1);
            const end = new Date(r.ey, r.em + 1, 0);
            const fyEnd = String(y + 1).slice(-2);
            const label = `Q${q}_FY${y}-${fyEnd}`;
            return { start, end, label };
        }

        case "half_yearly": {
            const h = parseInt(half);
            const fyEnd = String(y + 1).slice(-2);
            if (h === 1) {
                return {
                    start: new Date(y, 3, 1), // Apr 1
                    end: new Date(y, 8, 30), // Sep 30
                    label: `H1_FY${y}-${fyEnd}`,
                };
            } else {
                return {
                    start: new Date(y, 9, 1), // Oct 1
                    end: new Date(y + 1, 2, 31), // Mar 31 next yr
                    label: `H2_FY${y}-${fyEnd}`,
                };
            }
        }

        case "yearly": {
            const fyEnd = String(y + 1).slice(-2);
            return {
                start: new Date(y, 3, 1), // Apr 1
                end: new Date(y + 1, 2, 31), // Mar 31 next yr
                label: `FY${y}-${fyEnd}`,
            };
        }

        case "custom": {
            return {
                start: new Date(from),
                end: new Date(to),
                label: `${from}_to_${to}`,
            };
        }

        default:
            throw new Error(
                "Invalid period. Use monthly/quarterly/half_yearly/yearly/custom",
            );
    }
}

// ── GST split logic ───────────────────────────────────────
function getGstSplit(sellerStateCode, buyerGstin, taxable, gstRatePct) {
    const buyerState = (buyerGstin || "").substring(0, 2);
    const isSameState =
        sellerStateCode &&
        buyerState &&
        sellerStateCode.trim() === buyerState.trim();

    const totalGst = (taxable * gstRatePct) / 100;

    if (isSameState) {
        return {
            igstCgstRate: gstRatePct / 2,
            cgst: totalGst / 2,
            sgst: totalGst / 2,
            igst: 0,
        };
    } else {
        return {
            igstCgstRate: gstRatePct,
            cgst: 0,
            sgst: 0,
            igst: totalGst,
        };
    }
}

// ── GET /reports/gst-sales ────────────────────────────────
router.get("/gst-sales", async (req, res) => {
    const uid = req.userId;

    try {
        const { start, end, label } = getDateRange(req.query);

        // One row per (invoice × gst_rate) — correct GST filing format
        const { rows } = await pool.query(
            `
            SELECT
                i.invoice_date,
                i.invoice_number,
                c.name                                                AS party_name,
                c.gstin                                               AS buyer_gstin,
                wp.state_code                                         AS seller_state_code,
                li.gst_percent,
                COALESCE(
                    ARRAY_AGG(DISTINCT li.hsn ORDER BY li.hsn)
                        FILTER (WHERE li.hsn IS NOT NULL AND li.hsn <> ''),
                    ARRAY[]::TEXT[]
                )                                                     AS hsn_codes,
                SUM(li.quantity)                                      AS total_qty,
                SUM(li.unit_price * li.quantity)                      AS taxable_amount
            FROM invoices i
            JOIN customers      c  ON c.id          = i.customer_id
            JOIN workshop_profile wp ON wp.user_id  = i.user_id
            JOIN line_items     li ON li.invoice_id = i.id
            WHERE i.user_id      = $1
              AND i.invoice_date >= $2
              AND i.invoice_date <= $3
              AND i.status       != 'cancelled'
            GROUP BY
                i.id, i.invoice_date, i.invoice_number,
                c.name, c.gstin, wp.state_code, li.gst_percent
            ORDER BY i.invoice_date, i.invoice_number, li.gst_percent
        `,
            [uid, start, end],
        );

        // ── Build workbook ────────────────────────────────
        const wb = new ExcelJS.Workbook();
        wb.creator = "Workshop IQ";
        wb.created = new Date();

        const ws = wb.addWorksheet("SALE");

        ws.columns = [
            { width: 14 }, // A INVOICE DATE
            { width: 14 }, // B INVOICE NO
            { width: 30 }, // C PARTY NAME
            { width: 20 }, // D GSTIN
            { width: 12 }, // E HSN/SAC
            { width: 8 }, // F QTY
            { width: 8 }, // G UOM
            { width: 10 }, // H GST RATE
            { width: 14 }, // I IGST/CGST RATE
            { width: 16 }, // J TAXABLE AMOUNT
            { width: 14 }, // K CGST AMT
            { width: 14 }, // L SGST AMT
            { width: 14 }, // M IGST AMT
        ];

        // ── Shared styles ─────────────────────────────────
        const thinBorder = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
        };

        const applyBorder = (cell) => {
            cell.border = thinBorder;
        };

        // ── Row 1: Headers ────────────────────────────────
        const HEADERS = [
            "INVOICE DATE",
            "INVOICE NO",
            "PARTY NAME",
            "GSTIN",
            "HSN/SAC",
            "QTY",
            "UOM",
            "GST RATE",
            "IGST/CGST RATE",
            "TAXABLE AMOUNT",
            "CGST AMT",
            "SGST AMT",
            "IGST AMT",
        ];

        const headerRow = ws.getRow(1);
        headerRow.height = 32;

        HEADERS.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, name: "Arial", size: 10 };
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
            };
            cell.border = thinBorder;
        });

        // Row 2 intentionally blank (matching original spacing)

        // ── Data rows start at 3 ──────────────────────────
        let rowNum = 3;
        const first = rowNum; // will update after loop

        for (const inv of rows) {
            const taxable = parseFloat(inv.taxable_amount || 0);
            const ratePct = parseFloat(inv.gst_percent || 0);
            const qty = parseFloat(inv.total_qty || 0);
            const hsnList = (inv.hsn_codes || []).join(", ");
            const date = inv.invoice_date ? new Date(inv.invoice_date) : null;

            const gst = getGstSplit(
                inv.seller_state_code,
                inv.buyer_gstin,
                taxable,
                ratePct,
            );

            const row = ws.getRow(rowNum);
            row.height = 18;
            row.font = { name: "Arial", size: 10 };

            // A: Date
            const aCell = row.getCell(1);
            aCell.value = date;
            aCell.numFmt = "mm-dd-yy";
            aCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(aCell);

            // B: Invoice No
            const bCell = row.getCell(2);
            bCell.value = inv.invoice_number;
            bCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(bCell);

            // C: Party Name
            const cCell = row.getCell(3);
            cCell.value = inv.party_name || "";
            cCell.alignment = { vertical: "middle" };
            applyBorder(cCell);

            // D: GSTIN
            const dCell = row.getCell(4);
            dCell.value = inv.buyer_gstin || "";
            dCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(dCell);

            // E: HSN/SAC
            const eCell = row.getCell(5);
            eCell.value = hsnList || null;
            eCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(eCell);

            // F: QTY
            const fCell = row.getCell(6);
            fCell.value = qty || null;
            fCell.numFmt = "#,##0.##";
            fCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(fCell);

            // G: UOM
            const gCell = row.getCell(7);
            gCell.value = null;
            applyBorder(gCell);

            // H: GST RATE
            const hCell = row.getCell(8);
            hCell.value = ratePct / 100;
            hCell.numFmt = "0%";
            hCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(hCell);

            // I: IGST/CGST RATE
            const iCell = row.getCell(9);
            iCell.value = gst.igstCgstRate / 100;
            iCell.numFmt = "0%";
            iCell.alignment = { horizontal: "center", vertical: "middle" };
            applyBorder(iCell);

            // J: TAXABLE AMOUNT
            const jCell = row.getCell(10);
            jCell.value = taxable;
            jCell.numFmt = "#,##0.00";
            jCell.alignment = { horizontal: "right", vertical: "middle" };
            applyBorder(jCell);

            // K: CGST AMT
            const kCell = row.getCell(11);
            kCell.value = gst.cgst > 0 ? gst.cgst : null;
            kCell.numFmt = "#,##0.00";
            kCell.alignment = { horizontal: "right", vertical: "middle" };
            applyBorder(kCell);

            // L: SGST AMT
            const lCell = row.getCell(12);
            lCell.value = gst.sgst > 0 ? gst.sgst : null;
            lCell.numFmt = "#,##0.00";
            lCell.alignment = { horizontal: "right", vertical: "middle" };
            applyBorder(lCell);

            // M: IGST AMT
            const mCell = row.getCell(13);
            mCell.value = gst.igst > 0 ? gst.igst : null;
            mCell.numFmt = "#,##0.00";
            mCell.alignment = { horizontal: "right", vertical: "middle" };
            applyBorder(mCell);

            rowNum++;
        }

        // ── TOTAL row ─────────────────────────────────────
        const lastData = rowNum - 1;

        if (lastData >= 3) {
            const totalRow = ws.getRow(rowNum);
            totalRow.height = 20;

            // A–I: label + empty bordered cells
            const tLabel = totalRow.getCell(1);
            tLabel.value = "TOTAL";
            tLabel.font = { bold: true, name: "Arial", size: 10 };
            tLabel.alignment = { horizontal: "center", vertical: "middle" };
            tLabel.border = thinBorder;

            for (let col = 2; col <= 9; col++) {
                const cell = totalRow.getCell(col);
                cell.border = thinBorder;
                cell.font = { bold: true, name: "Arial", size: 10 };
            }

            // J: SUM Taxable
            const tJ = totalRow.getCell(10);
            tJ.value = { formula: `SUM(J3:J${lastData})` };
            tJ.numFmt = "#,##0.00";
            tJ.font = { bold: true, name: "Arial", size: 10 };
            tJ.alignment = { horizontal: "right", vertical: "middle" };
            tJ.border = thinBorder;

            // K: SUM CGST
            const tK = totalRow.getCell(11);
            tK.value = { formula: `SUM(K3:K${lastData})` };
            tK.numFmt = "#,##0.00";
            tK.font = { bold: true, name: "Arial", size: 10 };
            tK.alignment = { horizontal: "right", vertical: "middle" };
            tK.border = thinBorder;

            // L: SUM SGST
            const tL = totalRow.getCell(12);
            tL.value = { formula: `SUM(L3:L${lastData})` };
            tL.numFmt = "#,##0.00";
            tL.font = { bold: true, name: "Arial", size: 10 };
            tL.alignment = { horizontal: "right", vertical: "middle" };
            tL.border = thinBorder;

            // M: SUM IGST
            const tM = totalRow.getCell(13);
            tM.value = { formula: `SUM(M3:M${lastData})` };
            tM.numFmt = "#,##0.00";
            tM.font = { bold: true, name: "Arial", size: 10 };
            tM.alignment = { horizontal: "right", vertical: "middle" };
            tM.border = thinBorder;
        }

        // ── Stream response ───────────────────────────────
        const filename = `GST_Sales_${label}.xlsx`;
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`,
        );

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("GST Report error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;

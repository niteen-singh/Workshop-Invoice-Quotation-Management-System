const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

// ── Amount in words (Indian system) ──────────────────────
const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
];
const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
];

function numToWords(n) {
    n = Math.round(n);
    if (n === 0) return "Zero";
    if (n < 20) return ones[n];
    if (n < 100)
        return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000)
        return (
            ones[Math.floor(n / 100)] +
            " Hundred" +
            (n % 100 ? " " + numToWords(n % 100) : "")
        );
    if (n < 100000)
        return (
            numToWords(Math.floor(n / 1000)) +
            " Thousand" +
            (n % 1000 ? " " + numToWords(n % 1000) : "")
        );
    if (n < 10000000)
        return (
            numToWords(Math.floor(n / 100000)) +
            " Lakh" +
            (n % 100000 ? " " + numToWords(n % 100000) : "")
        );
    return (
        numToWords(Math.floor(n / 10000000)) +
        " Crore" +
        (n % 10000000 ? " " + numToWords(n % 10000000) : "")
    );
}

function amountInWords(amount) {
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let words = numToWords(rupees) + " Rupees";
    if (paise) words += " and " + numToWords(paise) + " Paise";
    return words + " Only";
}

// ── Indian number format ──────────────────────────────────
function fmt(n) {
    return parseFloat(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

// ── Format date ───────────────────────────────────────────
function fmtDate(d) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

// ── Build data for template ───────────────────────────────
const MAX_INVOICE_ROWS = 24;

function buildTemplateData(invoice, lineItems, customer, profile) {
    const subtotal = lineItems.reduce(
        (s, i) => s + parseFloat(i.unit_price) * parseFloat(i.quantity),
        0,
    );
    const totalGst = lineItems.reduce((s, i) => {
        const taxable = parseFloat(i.unit_price) * parseFloat(i.quantity);
        return s + (taxable * parseFloat(i.gst_percent)) / 100;
    }, 0);

    const cgstRate = parseFloat(lineItems[0]?.gst_percent ?? 18) / 2;
    const exactTotal = subtotal + totalGst;
    const rounded = Math.round(exactTotal);
    const roundOff = rounded - exactTotal;

    const filledItems = lineItems.map((item, i) => {
        const taxable = parseFloat(item.unit_price) * parseFloat(item.quantity);
        return {
            no: i + 1,
            description: item.description,
            hsnCode: item.hsn ?? "",
            qty: parseFloat(item.quantity),
            rate: fmt(item.unit_price),
            total: fmt(taxable),
        };
    });

    // pad to MAX_INVOICE_ROWS so layout is consistent
    const emptyRows = Array(
        Math.max(0, MAX_INVOICE_ROWS - filledItems.length),
    ).fill({});

    return {
        seller: {
            companyName: profile.company_name ?? "",
            tagline: profile.tagline ?? "",
            officeAddress: profile.office_address ?? "",
            worksAddress: profile.works_address ?? "",
            email: profile.email ?? "",
            mobile1: profile.mobile1 ?? "",
            mobile2: profile.mobile2 ?? "",
            gstin: profile.gstin ?? "",
            state: profile.state ?? "",
            stateCode: profile.state_code ?? "",
        },
        buyer: {
            companyName: customer.name ?? "",
            address: customer.address ?? "",
            gstin: customer.gstin ?? "",
        },
        invoiceMeta: {
            invoiceNo: invoice.invoice_number,
            invoiceDate: fmtDate(invoice.invoice_date),
            challanNo: invoice.challan_no ?? "",
            challanDate: fmtDate(invoice.challan_date),
            poNo: invoice.po_no ?? "",
            poDate: fmtDate(invoice.po_date),
            vendorCode: invoice.vendor_code ?? "",
        },
        bankDetails: {
            bankName: profile.bank_name ?? "",
            accountNo: profile.account_no ?? "",
            branch: profile.bank_branch ?? "",
            ifsc: profile.ifsc ?? "",
        },
        shippingDetails: invoice.vehicle_no ?? "",
        items: filledItems,
        emptyRows: emptyRows,
        totals: {
            subtotal: fmt(subtotal),
            cgstRate: cgstRate,
            sgstRate: cgstRate,
            cgst: fmt(totalGst / 2),
            sgst: fmt(totalGst / 2),
            roundOff: (roundOff >= 0 ? "+" : "") + fmt(Math.abs(roundOff)),
            grandTotal: fmt(rounded),
            grandTotalWords: amountInWords(rounded),
        },
    };
}

// ── Compile Handlebars template ───────────────────────────
function renderHTML(data) {
    const templatePath = path.join(__dirname, "../templates/invoice.hbs");
    const source = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(source);
    return template(data);
}

// ── Puppeteer → PDF buffer ────────────────────────────────
async function generatePDF(html) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
    await browser.close();
    return pdf;
}

// Quotations

function buildQuotationData(quotation, lineItems, customer, profile) {
    const MAX_ROWS = 15;
    const grandTotal = lineItems.reduce(
        (s, i) => s + parseFloat(i.unit_price) * parseFloat(i.quantity),
        0,
    );

    const filledItems = lineItems.map((item, i) => ({
        srNo: i + 1,
        description: item.description,
        hsnCode: item.hsn ?? "",
        quantity: parseFloat(item.quantity),
        unitPrice: fmt(item.unit_price),
        amount: fmt(parseFloat(item.unit_price) * parseFloat(item.quantity)),
    }));

    const emptyRows = Array(Math.max(0, MAX_ROWS - filledItems.length)).fill(
        {},
    );

    return {
        seller: {
            companyName: profile.company_name ?? "",
            tagline: profile.tagline ?? "",
            address: profile.office_address ?? "",
            mobile: [profile.mobile1, profile.mobile2]
                .filter(Boolean)
                .join(" / "),
            email: profile.email ?? "",
            gstin: profile.gstin ?? "",
            pan: profile.pan ?? "",
            logo: null,
        },
        buyer: {
            companyName: customer.name ?? "",
            address: customer.address ?? "",
            attention: quotation.attention ?? "",
            subject: quotation.subject ?? "",
        },
        quotation: {
            refNo: quotation.quote_number,
            date: fmtDate(quotation.quote_date),
            validUntil: fmtDate(quotation.valid_until),
        },
        items: filledItems,
        emptyRows: emptyRows,
        totals: {
            grandTotal: fmt(grandTotal),
            grandTotalWords: amountInWords(Math.round(grandTotal)),
        },
        bank: {
            accountName: profile.account_name ?? "",
            accountNo: profile.account_no ?? "",
            ifsc: profile.ifsc ?? "",
            branch: profile.bank_branch ?? "",
        },
        terms: (
            profile.terms ??
            "Payment: 60% advanced and 40% against delivery.\nGST 18% or as applicable.\nWork will start after receiving final PO and delivered within 15-20 days from PO date."
        ).trim(),
    };
}

function renderQuotationHTML(data) {
    const path = require("path");
    const fs = require("fs");
    const templatePath = path.join(__dirname, "../templates/quotation.hbs");
    const source = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(source);
    return template(data);
}

module.exports = {
    buildTemplateData,
    renderHTML,
    buildQuotationData,
    renderQuotationHTML,
    generatePDF,
};

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const QUARTER_LABELS = {
    1: "Q1_FY",
    2: "Q2_FY",
    3: "Q3_FY",
    4: "Q4_FY",
};

function onPeriodChange() {
    const period = document.getElementById("period-type").value[
        // hide all, show selected
        ("monthly", "quarterly", "half_yearly", "yearly", "custom")
    ].forEach((p) => {
        document.getElementById(`input-${p}`).style.display = "none";
    });
    document.getElementById(`input-${period}`).style.display = "";

    updatePreview();
}

function updatePreview() {
    const period = document.getElementById("period-type").value;
    let filename = "GST_Sales_";

    try {
        switch (period) {
            case "monthly": {
                const m = parseInt(
                    document.getElementById("month-select").value,
                );
                const y = document.getElementById("monthly-year").value;
                filename += `${MONTH_NAMES[m - 1]}_${y}`;
                break;
            }
            case "quarterly": {
                const q = document.getElementById("quarter-select").value;
                const y = document.getElementById("quarterly-year").value;
                const end = String(parseInt(y) + 1).slice(-2);
                filename += `Q${q}_FY${y}-${end}`;
                break;
            }
            case "half_yearly": {
                const h = document.getElementById("half-select").value;
                const y = document.getElementById("half-year").value;
                const end = String(parseInt(y) + 1).slice(-2);
                filename += `H${h}_FY${y}-${end}`;
                break;
            }
            case "yearly": {
                const y = document.getElementById("yearly-year").value;
                const end = String(parseInt(y) + 1).slice(-2);
                filename += `FY${y}-${end}`;
                // update label
                document.getElementById("fy-label").textContent =
                    `FY ${y}-${end} (Apr ${y} – Mar ${parseInt(y) + 1})`;
                break;
            }
            case "custom": {
                const from = document.getElementById("custom-from").value;
                const to = document.getElementById("custom-to").value;
                filename += from && to ? `${from}_to_${to}` : "Custom_Range";
                break;
            }
        }
    } catch {}

    document.getElementById("filename-preview").textContent =
        filename + ".xlsx";
}

// attach listeners for live preview
document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll('select, input[type="number"], input[type="date"]')
        .forEach((el) => el.addEventListener("change", updatePreview));

    // set current month as default
    const now = new Date();
    document.getElementById("month-select").value = now.getMonth() + 1;
    document.getElementById("monthly-year").value = now.getFullYear();
    document.getElementById("quarterly-year").value = now.getFullYear();
    document.getElementById("half-year").value = now.getFullYear();
    document.getElementById("yearly-year").value = now.getFullYear();

    // default custom range: current FY
    const fyStart =
        now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    document.getElementById("custom-from").value = `${fyStart}-04-01`;
    document.getElementById("custom-to").value = `${fyStart + 1}-03-31`;

    updatePreview();
});

async function downloadReport() {
    const btn = document.getElementById("download-btn");
    const errorDiv = document.getElementById("report-error");
    const period = document.getElementById("period-type").value;

    errorDiv.style.display = "none";
    btn.textContent = "Generating…";
    btn.disabled = true;

    // build query params
    const params = new URLSearchParams({ period });

    switch (period) {
        case "monthly":
            params.set("year", document.getElementById("monthly-year").value);
            params.set("month", document.getElementById("month-select").value);
            break;
        case "quarterly":
            params.set("year", document.getElementById("quarterly-year").value);
            params.set(
                "quarter",
                document.getElementById("quarter-select").value,
            );
            break;
        case "half_yearly":
            params.set("year", document.getElementById("half-year").value);
            params.set("half", document.getElementById("half-select").value);
            break;
        case "yearly":
            params.set("year", document.getElementById("yearly-year").value);
            break;
        case "custom":
            params.set("from", document.getElementById("custom-from").value);
            params.set("to", document.getElementById("custom-to").value);
            if (
                !document.getElementById("custom-from").value ||
                !document.getElementById("custom-to").value
            ) {
                errorDiv.textContent = "Please select both From and To dates.";
                errorDiv.style.display = "block";
                btn.textContent = "⬇ Download GST Sales Report";
                btn.disabled = false;
                return;
            }
            break;
    }

    try {
        const res = await fetch(`/api/reports/gst-sales?${params}`);

        if (!res.ok) {
            const err = await res
                .json()
                .catch(() => ({ error: "Unknown error" }));
            throw new Error(err.error);
        }

        // trigger download
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const filename =
            document.getElementById("filename-preview").textContent;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        errorDiv.textContent = "Failed to generate report: " + err.message;
        errorDiv.style.display = "block";
    } finally {
        btn.textContent = "⬇ Download GST Sales Report";
        btn.disabled = false;
    }
}

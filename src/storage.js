// ─────────────────────────────────────────────────────────────────────────────
//  PER-USER STORAGE + CSV/XLSX EXPORT
//  Storage is keyed by `u__${nick}_${pin}__history` — one record per user.
//  Each record is an array of "snapshots" (one per researched SKU+country+date).
//  Records are flat: each competitor is its own row, linked via "competing_with".
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";

const STORAGE_KEY = "history";

function userKey(user) {
  return `u__${user.nick}_${user.pin}__${STORAGE_KEY}`;
}

export function loadHistory(user) {
  try {
    const raw = localStorage.getItem(userKey(user));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(user, history) {
  try {
    localStorage.setItem(userKey(user), JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}

export function appendSnapshot(user, snapshot) {
  const history = loadHistory(user);
  history.push(snapshot);
  saveHistory(user, history);
  return history;
}

export function clearHistory(user) {
  try { localStorage.removeItem(userKey(user)); } catch {}
}

// ─── Build flat row data ─────────────────────────────────────────────────────
// One row per SKU per snapshot. LORGAR rows have empty "competing_with".
// Competitor rows have "competing_with" = LORGAR SKU.
export function buildFlatRows(history) {
  const headers = [
    "Date",
    "Country",
    "Brand",
    "SKU",
    "Product",
    "Category",
    "Price",
    "Currency",
    "In Stock",
    "Retail Link",
    "Aggregator Link",
    "Competing With",
    "Price Index",
    "Win/Lose",
    "Band",
    "Score",
    "Score: Price",
    "Score: Brand",
    "Score: Features",
    "Recommended Price",
    "Price Move %",
    "Price Source",
    "Note",
  ];

  const rows = [];
  for (const snap of history) {
    // LORGAR row
    rows.push({
      "Date": snap.observed_at,
      "Country": snap.country,
      "Brand": "LORGAR",
      "SKU": snap.sku,
      "Product": snap.product_name,
      "Category": snap.category,
      "Price": snap.lorgar_price ?? "",
      "Currency": snap.currency,
      "In Stock": snap.lorgar_in_stock ? "yes" : (snap.lorgar_price ? "yes" : "no"),
      "Retail Link": snap.lorgar_retail_link || "",
      "Aggregator Link": snap.lorgar_comparison_link || "",
      "Competing With": "",
      "Price Index": "",
      "Win/Lose": "",
      "Band": "",
      "Score": "",
      "Score: Price": "",
      "Score: Brand": "",
      "Score: Features": "",
      "Recommended Price": "",
      "Price Move %": "",
      "Price Source": "",
      "Note": snap.availability_note || "",
    });
    // Competitor rows
    for (const c of snap.competitors || []) {
      rows.push({
        "Date": snap.observed_at,
        "Country": snap.country,
        "Brand": c.vendor,
        "SKU": "", // competitors don't always have a clean SKU
        "Product": c.product_name,
        "Category": snap.category,
        "Price": c.price ?? "",
        "Currency": c.currency || snap.currency,
        "In Stock": c.in_stock ? "yes" : "no",
        "Retail Link": c.retail_link || "",
        "Aggregator Link": c.comparison_link || "",
        "Competing With": snap.sku,
        "Price Index": c.price_index ?? "",
        "Win/Lose": c.win_lose || "",
        "Band": c.price_band || "",
        "Score": c._totalScore ?? "",
        "Score: Price": c._priceScore ?? "",
        "Score: Brand": c._brandScore ?? "",
        "Score: Features": c._featureScore ?? "",
        "Recommended Price": c.recommended_price ?? "",
        "Price Move %": c.price_move_pct ?? "",
        "Price Source": c.price_source || "",
        "Note": c.positioning || c.price_note || "",
      });
    }
  }
  return { headers, rows };
}

// ─── CSV export ──────────────────────────────────────────────────────────────
export function exportCSV(history) {
  const { headers, rows } = buildFlatRows(history);
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    csvRows.push(headers.map(h => {
      const v = row[h] == null ? "" : String(row[h]);
      const escaped = v.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(","));
  }
  const csvText = csvRows.join("\n");
  downloadFile(csvText, "lorgar-pricing.csv", "text/csv;charset=utf-8;");
}

// ─── XLSX export (using SheetJS) ─────────────────────────────────────────────
export function exportXLSX(history) {
  const { headers, rows } = buildFlatRows(history);
  // Convert array-of-objects into worksheet
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  // Set column widths heuristically
  ws["!cols"] = headers.map(h => {
    if (h === "Product" || h === "Note") return { wch: 40 };
    if (h.includes("Link")) return { wch: 50 };
    if (h === "Brand" || h === "Country" || h === "Category") return { wch: 16 };
    return { wch: 12 };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LORGAR Pricing");
  XLSX.writeFile(wb, "lorgar-pricing.xlsx");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

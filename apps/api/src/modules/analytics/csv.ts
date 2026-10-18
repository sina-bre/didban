// RFC 4180 CSV with a UTF-8 BOM (spreadsheets then read Persian and other non-Latin text right).
// Cells that a spreadsheet would run as a formula (= + - @, tab, CR) get a leading apostrophe:
// page paths, referrers and property values come from the public internet (CSV injection).

const BOM = String.fromCharCode(0xfeff);
const FORMULA = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const safe = FORMULA.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) || safe !== safe.trim() ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
): string {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => cell(row[c])).join(",")),
  ];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

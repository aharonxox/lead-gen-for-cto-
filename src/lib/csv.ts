// Minimal RFC-4180 CSV writer — stable, spreadsheet-friendly output.
// Fields are quoted only when needed; embedded quotes are doubled; embedded
// newlines are preserved inside quotes (Excel/Sheets handle both).
export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(header: string[], rows: Array<Array<unknown>>): string {
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // CRLF line endings per RFC 4180 — friendliest for Excel.
  return lines.join("\r\n") + "\r\n";
}

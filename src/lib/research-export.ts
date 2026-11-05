/** Export helpers for research reports. Output is aggregated/pseudonymised unless the caller opts in. */
export type Table = { title: string; headers: string[]; rows: (string | number | null)[][]; note?: string };
export type Report = { title: string; generated: string; filters: string[]; summary: string[]; tables: Table[] };

/** Prevents spreadsheet formula injection from free-text clinical fields. */
export function safeCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
const csvCell = (v: string | number | null) => `"${safeCell(v).replaceAll('"', '""')}"`;
const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

export function toCsv(r: Report): string {
  const out = [[r.title], [`Generated ${r.generated}`], ...r.filters.map((f) => [`Filter: ${f}`]), ...r.summary.map((s) => [s]), []].map((l) => l.map(csvCell).join(","));
  for (const t of r.tables) {
    out.push(csvCell(t.title), t.headers.map(csvCell).join(","), ...t.rows.map((row) => row.map(csvCell).join(",")));
    if (t.note) out.push(csvCell(t.note));
    out.push("");
  }
  return out.join("\r\n");
}

export function toExcelXml(r: Report): string {
  const cell = (v: string | number | null) => typeof v === "number" ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${xml(safeCell(v))}</Data></Cell>`;
  const sheet = (name: string, rows: (string | number | null)[][]) => `<Worksheet ss:Name="${xml(name.slice(0, 31).replace(/[\\/?*[\]:]/g, " "))}"><Table>${rows.map((row) => `<Row>${row.map(cell).join("")}</Row>`).join("")}</Table></Worksheet>`;
  const info = [[r.title], [`Generated ${r.generated}`], ...r.filters.map((f) => [`Filter: ${f}`]), ...r.summary.map((s) => [s])];
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet("Summary", info)}${r.tables.map((t, i) => sheet(`${i + 1} ${t.title}`, [t.headers, ...t.rows, ...(t.note ? [[t.note]] : [])])).join("")}</Workbook>`;
}

export function toHtml(r: Report): string {
  const h = (s: string | number | null) => xml(s == null ? "" : String(s));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${h(r.title)}</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:24px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}small{color:#555}</style></head><body><h1>${h(r.title)}</h1><small>Generated ${h(r.generated)} — confidential research output</small><ul>${r.filters.map((f) => `<li>${h(f)}</li>`).join("")}</ul>${r.summary.map((s) => `<p>${h(s)}</p>`).join("")}${r.tables.map((t) => `<h2>${h(t.title)}</h2><table><tr>${t.headers.map((x) => `<th>${h(x)}</th>`).join("")}</tr>${t.rows.map((row) => `<tr>${row.map((x) => `<td>${h(x)}</td>`).join("")}</tr>`).join("")}</table>${t.note ? `<small>${h(t.note)}</small>` : ""}`).join("")}</body></html>`;
}

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printPdf(r: Report) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Allow pop-ups to save the report as PDF.");
  w.document.write(toHtml(r));
  w.document.close();
  w.focus();
  w.print();
}

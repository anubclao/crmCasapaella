/**
 * Tiny CSV builder. No dependencies.
 * Escapes commas, quotes, and newlines per RFC 4180.
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns?: Array<{ header: string; key: keyof T | ((row: T) => unknown) }>
): string {
  if (rows.length === 0) return "";

  const cols =
    columns ??
    (Object.keys(rows[0]) as Array<keyof T>).map((k) => ({ header: String(k), key: k }));

  const headerLine = cols.map((c) => escapeCSV(c.header)).join(",");
  const lines = rows.map((row) =>
    cols
      .map((c) => {
        const value =
          typeof c.key === "function"
            ? (c.key as (row: T) => unknown)(row)
            : row[c.key as keyof T];
        return escapeCSV(value);
      })
      .join(",")
  );

  return [headerLine, ...lines].join("\r\n");
}

function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

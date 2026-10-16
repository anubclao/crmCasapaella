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

/**
 * Parse CSV text into rows (RFC 4180: quoted fields, "" escapes, newlines
 * inside quotes). The delimiter is detected from the header line, because
 * Excel in Spanish locales saves with ";" instead of ",".
 */
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [";", ",", "\t"]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

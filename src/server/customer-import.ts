/**
 * Bulk customer import from Excel (.xlsx) or CSV.
 *
 * Two steps, same code path:
 *   1. analyzeImport(file)  → validates every row and reports what would happen
 *                             (create / update / error) without touching the DB.
 *   2. commitImport(file)   → re-validates and writes the valid rows in one
 *                             transaction. Rows with errors are skipped.
 *
 * Existing customers are matched by WhatsApp number (E.164) and updated;
 * blank optional cells keep the stored value.
 */
import { readSheet } from "read-excel-file/node";
import { parseCSV } from "@/lib/csv";
import { withTransaction } from "@/lib/db";
import { normalizeText } from "@/lib/pipeline";
import { ensureCustomerColumns } from "./customer-schema";
import { validateCustomerInput, FIELD_LABELS, type CustomerField, type CustomerInput } from "./customer-input";
import { createCustomer, findCustomerIdsByPhones, updateCustomer } from "./customers";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Accepted spellings for each column header (compared accent/case-insensitively). */
const HEADER_ALIASES: Record<CustomerField, string[]> = {
  firstName: ["nombres", "nombre", "primer nombre", "first name", "firstname"],
  lastName: ["apellidos", "apellido", "last name", "lastname"],
  phone: ["whatsapp", "telefono", "celular", "movil", "phone", "numero", "numero whatsapp", "whatsapp / celular"],
  email: ["correo", "correo electronico", "email", "e-mail", "mail"],
  birthDate: ["fecha de nacimiento", "fecha nacimiento", "nacimiento", "cumpleanos", "birth date", "birthday"],
  stage: ["estado", "etapa", "pipeline", "estado pipeline", "estado en el pipeline", "stage"],
  notes: ["notas", "nota", "observaciones", "notes"],
};

const REQUIRED_COLUMNS: CustomerField[] = ["firstName", "lastName", "phone"];

export class ImportFileError extends Error {}

export type RowError = { row: number; messages: string[] };
export type PlannedRow = { row: number; action: "create" | "update"; data: CustomerInput; customerId?: number };

export type ImportAnalysis = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  errors: RowError[];
  preview: Array<{ row: number; action: "create" | "update"; name: string; phone: string; email: string | null; birthDate: string | null; stage: string | null }>;
  ignoredColumns: string[];
};

type Cell = unknown;

async function readRows(buffer: Buffer, filename: string): Promise<Cell[][]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    try {
      return (await readSheet(buffer)) as Cell[][];
    } catch {
      throw new ImportFileError("No se pudo leer el Excel. Guárdalo como .xlsx (Libro de Excel) e inténtalo de nuevo.");
    }
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    let text = new TextDecoder("utf-8").decode(buffer);
    // Excel on Windows saves "CSV" as Windows-1252 unless told otherwise.
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return parseCSV(text);
  }
  if (lower.endsWith(".xls")) {
    throw new ImportFileError("El formato .xls (Excel 97-2003) no es compatible. Guárdalo como .xlsx o .csv.");
  }
  throw new ImportFileError("Formato no compatible. Sube un archivo .xlsx o .csv.");
}

const isBlank = (v: Cell) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

function mapHeaders(header: Cell[]) {
  const columns = new Map<CustomerField, number>();
  const ignored: string[] = [];
  header.forEach((h, idx) => {
    if (isBlank(h)) return;
    const n = normalizeText(String(h)).replace(/[*:]/g, "").replace(/\s+/g, " ").trim();
    const field = (Object.keys(HEADER_ALIASES) as CustomerField[]).find((f) => HEADER_ALIASES[f].includes(n));
    if (field && !columns.has(field)) columns.set(field, idx);
    else ignored.push(String(h).trim());
  });
  const missing = REQUIRED_COLUMNS.filter((f) => !columns.has(f));
  if (missing.length > 0) {
    throw new ImportFileError(
      `Faltan columnas obligatorias: ${missing.map((f) => FIELD_LABELS[f]).join(", ")}. ` +
        "Descarga la plantilla para ver los encabezados esperados."
    );
  }
  return { columns, ignored };
}

async function plan(buffer: Buffer, filename: string) {
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new ImportFileError("El archivo supera 5 MB.");
  const rows = await readRows(buffer, filename);

  const headerIdx = rows.findIndex((r) => r.some((c) => !isBlank(c)));
  if (headerIdx === -1) throw new ImportFileError("El archivo está vacío.");
  const { columns, ignored } = mapHeaders(rows[headerIdx]);

  const dataRows = rows
    .map((cells, i) => ({ cells, row: i + 1 })) // 1-based, as Excel shows it
    .slice(headerIdx + 1)
    .filter(({ cells }) => cells.some((c) => !isBlank(c)));
  if (dataRows.length === 0) throw new ImportFileError("El archivo no tiene filas de clientes debajo de los encabezados.");
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(`Máximo ${MAX_IMPORT_ROWS} clientes por archivo (este tiene ${dataRows.length}). Divídelo en varios.`);
  }

  const errors: RowError[] = [];
  const valid: Array<{ row: number; data: CustomerInput }> = [];
  const firstRowByPhone = new Map<string, number>();

  for (const { cells, row } of dataRows) {
    const raw: Partial<Record<CustomerField, unknown>> = {};
    for (const [field, idx] of columns) raw[field] = cells[idx];
    const result = validateCustomerInput(raw);
    if (!result.ok) {
      errors.push({ row, messages: Object.values(result.errors) as string[] });
      continue;
    }
    const seen = firstRowByPhone.get(result.data.phone);
    if (seen) {
      errors.push({ row, messages: [`WhatsApp ${result.data.phone} repetido (ya está en la fila ${seen})`] });
      continue;
    }
    firstRowByPhone.set(result.data.phone, row);
    valid.push({ row, data: result.data });
  }

  await ensureCustomerColumns();
  const existing = await findCustomerIdsByPhones(valid.map((v) => v.data.phone));
  const planned: PlannedRow[] = valid.map((v) => {
    const customerId = existing.get(v.data.phone);
    return customerId ? { ...v, action: "update", customerId } : { ...v, action: "create" };
  });

  return { totalRows: dataRows.length, planned, errors, ignored };
}

export async function analyzeImport(buffer: Buffer, filename: string): Promise<ImportAnalysis> {
  const { totalRows, planned, errors, ignored } = await plan(buffer, filename);
  return {
    totalRows,
    toCreate: planned.filter((p) => p.action === "create").length,
    toUpdate: planned.filter((p) => p.action === "update").length,
    errors,
    ignoredColumns: ignored,
    preview: planned.slice(0, 50).map((p) => ({
      row: p.row,
      action: p.action,
      name: `${p.data.firstName} ${p.data.lastName}`,
      phone: p.data.phone,
      email: p.data.email,
      birthDate: p.data.birthDate,
      stage: p.data.stage,
    })),
  };
}

export async function commitImport(buffer: Buffer, filename: string) {
  const { planned, errors } = await plan(buffer, filename);
  let created = 0;
  let updated = 0;
  await withTransaction(async (conn) => {
    for (const p of planned) {
      if (p.action === "update" && p.customerId) {
        await updateCustomer(p.customerId, p.data, { keepBlanks: true }, conn);
        updated++;
      } else {
        await createCustomer(p.data, "import", conn);
        created++;
      }
    }
  });
  return { created, updated, skipped: errors.length, errors };
}

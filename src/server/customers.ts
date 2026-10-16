/**
 * Customer DB queries.
 * Keep all SQL in this layer; pages and API routes import these helpers.
 */
import type { PoolConnection } from "mysql2/promise";
import { query } from "@/lib/db";
import { DEFAULT_STAGE } from "@/lib/pipeline";
import { ensureCustomerColumns } from "./customer-schema";
import type { CustomerInput } from "./customer-input";

export type CustomerRow = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  email: string | null;
  birth_date: string | Date | null;
  source: string;
  pipeline_stage: string;
  total_reservations: number;
  total_orders: number;
  total_spent: string;
  last_activity_at: string | null;
  notes: string | null;
  created_at: string;
};

type ListFilters = { search?: string; stage?: string };

function whereFor(f: ListFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const search = f.search?.trim();
  if (search) {
    const like = `%${search}%`;
    clauses.push("(name LIKE ? OR phone LIKE ? OR email LIKE ?)");
    params.push(like, like, like);
  }
  if (f.stage) {
    clauses.push("pipeline_stage = ?");
    params.push(f.stage);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function listCustomers(opts: ListFilters & { limit?: number; offset?: number }) {
  await ensureCustomerColumns();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const where = whereFor(opts);
  return query<CustomerRow[]>(
    `SELECT * FROM customers ${where.sql}
     ORDER BY last_activity_at DESC, id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    where.params
  );
}

export async function getCustomer(id: number) {
  await ensureCustomerColumns();
  const rows = await query<CustomerRow[]>("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
  return rows[0] ?? null;
}

export async function countCustomers(filters: ListFilters = {}) {
  await ensureCustomerColumns();
  const where = whereFor(filters);
  const rows = await query<Array<{ c: number }>>(`SELECT COUNT(*) AS c FROM customers ${where.sql}`, where.params);
  return Number(rows[0]?.c ?? 0);
}

/** Customers per pipeline stage, for the filter chips. */
export async function countByStage(search?: string) {
  await ensureCustomerColumns();
  const where = whereFor({ search });
  const rows = await query<Array<{ pipeline_stage: string; c: number }>>(
    `SELECT pipeline_stage, COUNT(*) AS c FROM customers ${where.sql} GROUP BY pipeline_stage`,
    where.params
  );
  return new Map(rows.map((r) => [r.pipeline_stage, Number(r.c)]));
}

export async function findCustomerByPhone(phone: string) {
  await ensureCustomerColumns();
  const rows = await query<CustomerRow[]>("SELECT * FROM customers WHERE phone = ? LIMIT 1", [phone]);
  return rows[0] ?? null;
}

/** phone (E.164) → customer id, for the importer's create-vs-update preview. */
export async function findCustomerIdsByPhones(phones: string[]) {
  await ensureCustomerColumns();
  const map = new Map<string, number>();
  for (let i = 0; i < phones.length; i += 500) {
    const chunk = phones.slice(i, i + 500);
    if (chunk.length === 0) continue;
    const rows = await query<Array<{ id: number; phone: string }>>(
      `SELECT id, phone FROM customers WHERE phone IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );
    for (const r of rows) map.set(r.phone, r.id);
  }
  return map;
}

const fullName = (c: Pick<CustomerInput, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`.trim();

type Exec = Pick<PoolConnection, "execute"> | null;

async function run<T>(conn: Exec, sql: string, params: unknown[]): Promise<T> {
  if (conn) {
    const [result] = await conn.execute(sql, params as never[]);
    return result as T;
  }
  return query<T>(sql, params);
}

export async function createCustomer(
  c: CustomerInput,
  source: "manual" | "import" = "manual",
  conn: Exec = null
): Promise<number> {
  await ensureCustomerColumns();
  const res = await run<{ insertId: number }>(
    conn,
    `INSERT INTO customers (name, first_name, last_name, phone, email, birth_date, source, pipeline_stage, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [fullName(c), c.firstName, c.lastName, c.phone, c.email, c.birthDate, source, c.stage ?? DEFAULT_STAGE, c.notes]
  );
  return res.insertId;
}

/**
 * Update a customer. With `keepBlanks` (bulk import), empty optional fields
 * leave the stored value alone instead of erasing it; the form sends the
 * whole record, so there an empty field does clear it.
 */
export async function updateCustomer(id: number, c: CustomerInput, opts: { keepBlanks?: boolean } = {}, conn: Exec = null) {
  await ensureCustomerColumns();
  const keep = opts.keepBlanks ?? false;
  const opt = (col: string) => (keep ? `${col} = COALESCE(?, ${col})` : `${col} = ?`);
  await run(
    conn,
    `UPDATE customers SET name = ?, first_name = ?, last_name = ?, phone = ?,
       ${opt("email")}, ${opt("birth_date")}, ${opt("notes")},
       pipeline_stage = COALESCE(?, pipeline_stage)
     WHERE id = ?`,
    [fullName(c), c.firstName, c.lastName, c.phone, c.email, c.birthDate, c.notes, c.stage, id]
  );
}

export async function listCustomersForCampaign(target: {
  type: "all" | "tag" | "inactive_days";
  value?: string;
}) {
  if (target.type === "all") {
    return query<CustomerRow[]>(
      "SELECT * FROM customers WHERE phone IS NOT NULL AND phone != ''"
    );
  }
  if (target.type === "tag" && target.value) {
    return query<CustomerRow[]>(
      `SELECT c.* FROM customers c
       INNER JOIN customer_tags ct ON ct.customer_id = c.id
       INNER JOIN tags t ON t.id = ct.tag_id
       WHERE t.name = ? AND c.phone IS NOT NULL`,
      [target.value]
    );
  }
  if (target.type === "inactive_days" && target.value) {
    const days = Number(target.value);
    if (!Number.isFinite(days) || days <= 0) return [];
    return query<CustomerRow[]>(
      `SELECT * FROM customers
       WHERE phone IS NOT NULL AND phone != ''
         AND (last_activity_at IS NULL OR last_activity_at < (NOW() - INTERVAL ? DAY))`,
      [days]
    );
  }
  return [];
}

/** DATE column → "YYYY-MM-DD". mysql2 returns it as a local-midnight Date. */
export function birthDateISO(v: CustomerRow["birth_date"]): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
}

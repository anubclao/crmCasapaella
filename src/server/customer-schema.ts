/**
 * Self-applying version of drizzle/0002_customer_pipeline.sql.
 *
 * Hostinger deploys straight from GitHub and nobody runs migrations by hand,
 * so the customer queries call ensureCustomerColumns() first. It checks
 * information_schema once per process and adds whatever column is missing.
 */
import { query } from "@/lib/db";

const COLUMNS: Array<{ name: string; ddl: string; after?: string }> = [
  { name: "first_name", ddl: "ADD COLUMN `first_name` VARCHAR(120) NULL AFTER `name`" },
  { name: "last_name", ddl: "ADD COLUMN `last_name` VARCHAR(120) NULL AFTER `first_name`" },
  { name: "birth_date", ddl: "ADD COLUMN `birth_date` DATE NULL AFTER `email`" },
  {
    name: "pipeline_stage",
    ddl:
      "ADD COLUMN `pipeline_stage` VARCHAR(20) NOT NULL DEFAULT 'nuevo' AFTER `source`, " +
      "ADD KEY `customers_pipeline_stage_idx` (`pipeline_stage`)",
    after:
      "UPDATE customers SET pipeline_stage = CASE " +
      "WHEN total_orders + total_reservations >= 3 THEN 'frecuente' " +
      "WHEN total_orders + total_reservations >= 1 THEN 'cliente' ELSE 'nuevo' END",
  },
];

const globalForSchema = globalThis as unknown as { __customerSchemaReady?: Promise<void> };

async function migrate() {
  const rows = await query<Array<{ COLUMN_NAME: string }>>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers'"
  );
  const existing = new Set(rows.map((r) => r.COLUMN_NAME));
  for (const col of COLUMNS) {
    if (existing.has(col.name)) continue;
    // eslint-disable-next-line no-console
    console.log(`[db] adding customers.${col.name}`);
    await query(`ALTER TABLE customers ${col.ddl}`);
    if (col.after) await query(col.after);
  }
}

export function ensureCustomerColumns(): Promise<void> {
  if (!globalForSchema.__customerSchemaReady) {
    globalForSchema.__customerSchemaReady = migrate().catch((err) => {
      // Let the next request retry instead of caching the failure.
      globalForSchema.__customerSchemaReady = undefined;
      throw err;
    });
  }
  return globalForSchema.__customerSchemaReady;
}

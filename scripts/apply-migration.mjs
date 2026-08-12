/**
 * scripts/apply-migration.mjs
 * Run a SQL migration file against DATABASE_URL.
 *
 * Usage:  node --env-file=.env scripts/apply-migration.mjs drizzle/0001_users_roles.sql
 */
import mysql from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileArg = process.argv[2] ?? "drizzle/0001_users_roles.sql";
const filePath = path.isAbsolute(fileArg)
  ? fileArg
  : path.join(__dirname, "..", fileArg);

if (!process.env.DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL no está en el entorno. Usá: node --env-file=.env scripts/apply-migration.mjs",
  );
  process.exit(1);
}

// mysql2 URL parser: mysql://user:pass@host:port/db
const url = new URL(process.env.DATABASE_URL);
const config = {
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  multipleStatements: true,
};

const sqlText = await fs.readFile(filePath, "utf8");
console.log(
  `📄 Aplicando ${path.basename(filePath)} a ${config.database}@${config.host}:${config.port} …`,
);

const conn = await mysql.createConnection(config);
try {
  await conn.query(sqlText);
  const [cols] = await conn.query(
    "SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION",
    [config.database],
  );
  console.log("✅ Migración aplicada OK. Columnas actuales de `users`:");
  console.table(cols);
} catch (e) {
  console.error("❌ Error aplicando migración:", e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

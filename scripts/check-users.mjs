/**
 * scripts/check-users.mjs — quick DB check.
 * Usage: node --env-file=.env scripts/check-users.mjs
 */
import mysql from "mysql2/promise";

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
});
const [rows] = await conn.query(
  "SELECT id, email, name, role, is_active, created_at FROM users",
);
console.log("Users in DB:");
console.table(rows);
await conn.end();

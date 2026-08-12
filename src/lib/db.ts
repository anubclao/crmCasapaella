/**
 * MySQL connection pool for Casa Paella CRM.
 *
 * Uses mysql2/promise with the standalone Next.js process.
 *
 * Hostinger Shared quirk (documented in memory):
 *   The resolver sometimes returns `::1` (IPv6 localhost) before `127.0.0.1`
 *   when the host is `localhost`. MySQL grants are typically only for the
 *   IPv4 user, so the connection gets `Access denied for user 'x'@'::1'`.
 *
 *   Fix: normalize `localhost` → `127.0.0.1` in code. mysql2 v3 IGNORES the
 *   `family: 4` Pool option with a warning, so we can't rely on that.
 */
import mysql, { Pool, PoolOptions } from "mysql2/promise";
import { env } from "./env";

let pool: Pool | null = null;

function buildPoolConfig(): PoolOptions {
  // Parse mysql://USER:PASS@HOST:PORT/DB
  const url = new URL(env.DATABASE_URL);
  const rawHost = url.hostname;
  const host = rawHost === "localhost" ? "127.0.0.1" : rawHost;
  return {
    host,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: 5, // shared hosting: be polite
    queueLimit: 0,
    charset: "utf8mb4_unicode_ci",
    dateStrings: false,
    // mysql2 v3 dropped `timezone` (and `family`); use server session TZ or pass via SQL.
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(buildPoolConfig());
    // eslint-disable-next-line no-console
    console.log(`[db] pool initialized → ${env.DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  }
  return pool;
}

/**
 * Execute a parameterized query. Use this in route handlers and server code.
 */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  // mysql2's execute() is strict about param types; cast to keep callers free.
  const [rows] = await getPool().execute(sql, params as any[]);
  return rows as T;
}

/**
 * Run a function inside a transaction. Rolls back on throw.
 */
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Graceful shutdown helper. Call from server.js on SIGTERM/SIGINT. */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

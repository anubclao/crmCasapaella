/**
 * Strip `-->` statement-breakpoint comments from drizzle-generated SQL.
 *
 * Drizzle Kit's MySQL generator emits lines like:
 *   `--> statement-breakpoint`
 * between statements. PostgreSQL accepts `-->` as a comment, but MySQL
 * requires `-- ` (with a space) for a line comment. Without the space,
 * the `mysql` CLI / phpMyAdmin fail with:
 *   #1064 - Existe un error en su sintaxis SQL ... cerca de 'statement...'
 *
 * Run after `npm run db:generate`:
 *   npm run db:strip
 * Produces drizzle/0000_init.mysql.sql with the breakpoints removed.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const drizzleDir = "drizzle";
const files = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql") && !f.endsWith(".mysql.sql"));

for (const f of files) {
  const src = join(drizzleDir, f);
  const dst = join(drizzleDir, f.replace(/\.sql$/, ".mysql.sql"));
  const sql = readFileSync(src, "utf8");
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.includes("--> statement-breakpoint"))
    .join("\n");
  writeFileSync(dst, cleaned, "utf8");
  const before = statSync(src).size;
  const after = statSync(dst).size;
  // eslint-disable-next-line no-console
  console.log(`✓ ${src} (${before}B) → ${dst} (${after}B), removed ${before - after}B of breakpoints`);
}

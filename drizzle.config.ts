import type { Config } from "drizzle-kit";

/**
 * Drizzle Kit config — MySQL dialect.
 *
 * Connection is read from .env (or .env.production at deploy).
 * The DB module normalizes `localhost` → `127.0.0.1` to dodge the
 * Hostinger IPv6/IPv4 grant issue (see src/lib/db.ts).
 */
export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "mysql://root:root@127.0.0.1:3306/crm_casa_paella",
  },
  strict: true,
  verbose: true,
} satisfies Config;

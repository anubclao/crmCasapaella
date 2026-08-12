/**
 * GET /api/health — environment + DB readiness diagnostic.
 *
 * Returns:
 *   { ok: true, ... } — server alive, env valid, DB reachable.
 *   { ok: false, error: "..." } — first failing check.
 *
 * Safe to expose: doesn't leak secrets, only their presence.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const envChecks = {
    NODE_ENV: process.env.NODE_ENV ?? null,
    APP_URL: process.env.APP_URL ?? null,
    hasAuthSecret: !!env.AUTH_SECRET && env.AUTH_SECRET.length >= 32,
    authSecretLength: env.AUTH_SECRET?.length ?? 0,
    hasDatabaseUrl: !!env.DATABASE_URL,
    databaseUrlHost: (() => {
      try {
        return new URL(env.DATABASE_URL).host;
      } catch {
        return "invalid URL";
      }
    })(),
    whatsappProvider: env.WHATSAPP_PROVIDER,
  };

  const dbChecks: { reachable: boolean; error: string | null } = {
    reachable: false,
    error: null,
  };

  // Test DB connection
  try {
    const rows = (await query("SELECT 1 AS ok")) as Array<{ ok: number }>;
    if (rows?.[0]?.ok === 1) {
      dbChecks.reachable = true;
    } else {
      dbChecks.error = "Unexpected response from SELECT 1";
    }
  } catch (e) {
    dbChecks.error = e instanceof Error ? e.message : String(e);
  }

  const ok =
    envChecks.hasAuthSecret === true &&
    envChecks.hasDatabaseUrl === true &&
    dbChecks.reachable === true;

  return NextResponse.json(
    { ok, env: envChecks, db: dbChecks },
    { status: ok ? 200 : 503 },
  );
}

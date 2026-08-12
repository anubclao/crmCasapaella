/**
 * Next.js 15 instrumentation hook — runs ONCE when the server starts.
 *
 * INTENTIONALLY MINIMAL in dev.
 *
 * Background:
 *   Next.js dev mode aggressively bundles every reachable module for the
 *   client too. Server-only modules (mysql2, bcryptjs, baileys, sharp, etc.)
 *   can't be bundled — they depend on Node.js builtins (crypto, child_process,
 *   string_decoder) that don't exist in the browser. This causes "Module
 *   not found" errors that block /login from rendering.
 *
 *   The clean fix is to keep server-only modules OUT of the dev bundle graph.
 *   We do that by NOT importing them from this file. Instead:
 *
 *   - The first-time admin is created lazily by the first auth request
 *     (see src/server/seed.ts and src/app/api/auth/[...nextauth]/route.ts).
 *     The admin user is already in the DB from the first boot, so this is
 *     idempotent and safe to leave as-is.
 *
 *   - The campaign worker + tag-refresher are run as a separate Node process
 *     via `node src/server/worker-standalone.cjs` (see README §"Optional
 *     dev: background worker"). For the MVP, the worker is optional — the
 *     campaign API routes process sends synchronously on click.
 *
 *   - WhatsApp init is lazy: the first /api/webhook/lead send or visit to
 *     /whatsapp triggers the Baileys socket.
 *
 * This file is referenced automatically by Next.js; no manual import needed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // eslint-disable-next-line no-console
  console.log("[boot] instrumentation: no-op (admin already seeded, worker runs separately)");
}

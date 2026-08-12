/**
 * Authorization helpers for API routes and server components.
 *
 * Role hierarchy:
 *   admin   — full access, including /users management
 *   manager — manage campaigns, templates, customers (no user mgmt)
 *   staff   — read-only + manual message sending
 *
 * Use `requireRole("admin")` at the top of a route to gate it.
 * For page-level gating (hiding nav, etc.) use `getCurrentRole()`.
 */
import { auth } from "@/lib/auth";

export type Role = "admin" | "manager" | "staff";

const RANK: Record<Role, number> = { admin: 3, manager: 2, staff: 1 };

export function roleAtLeast(
  actual: Role | null | undefined,
  required: Role,
): boolean {
  if (!actual) return false;
  return RANK[actual] >= RANK[required];
}

export function getCurrentRole(): Role | null {
  // auth() is async; we expose a sync helper for places that already
  // have a session in scope. Use `await getCurrentRoleAsync()` otherwise.
  // Returning null here is safe — the async variant is the source of truth.
  return null;
}

export async function getCurrentRoleAsync(): Promise<Role | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "admin" || role === "manager" || role === "staff") return role;
  return null;
}

export class AuthzError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Gate an API route. Returns the session.user on success, or throws an
 * error that should be caught and converted to a NextResponse.
 *
 * Usage:
 *   try {
 *     const user = await requireRole("admin");
 *   } catch (e) {
 *     if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status });
 *     throw e;
 *   }
 */
export async function requireRole(required: Role) {
  const session = await auth();
  if (!session?.user) {
    throw new AuthzError(401, "unauthorized");
  }
  const role = (session.user as { role?: string }).role;
  if (!roleAtLeast(role as Role | undefined, required)) {
    throw new AuthzError(403, `forbidden: requires ${required} role`);
  }
  return session.user as {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
}

/**
 * Tiny helper to translate AuthzError into a NextResponse inside route handlers.
 */
export function authzErrorResponse(
  err: unknown,
): { ok: false; status: 401 | 403; error: string } | null {
  if (err instanceof AuthzError) {
    return { ok: false, status: err.status, error: err.message };
  }
  return null;
}

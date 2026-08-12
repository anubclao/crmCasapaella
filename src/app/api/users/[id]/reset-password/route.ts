/**
 * POST /api/users/[id]/reset-password
 * Admin-only: generates a new temporary password for the user and returns it
 * (one-shot, like the create flow). The user is expected to change it on next login.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import {
  generateTempPassword,
  getUserById,
  hashPassword,
  updateUser,
} from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("admin");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid id" },
      { status: 400 },
    );
  }

  const target = await getUserById(id);
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 },
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  // Re-use updateUser; the password column isn't in its whitelist, so do it directly.
  const { query } = await import("@/lib/db");
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [
    passwordHash,
    id,
  ]);
  void updateUser; // keep import used

  return NextResponse.json({ ok: true, tempPassword });
}

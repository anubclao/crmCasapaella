/**
 * /api/users/[id] — update + disable
 *
 * PATCH   /api/users/[id]   update name/role/is_active (admin only)
 * DELETE  /api/users/[id]   soft-disable (is_active=0) (admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import {
  countActiveAdmins,
  getUserById,
  setUserActive,
  updateUser,
} from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["admin", "manager", "staff"]).optional(),
  is_active: z.union([z.literal(0), z.literal(1)]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireRole("admin");
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

  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", details: parsed.error.flatten() },
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

  // Safety: don't allow disabling/demoting the last active admin
  if (target.role === "admin" && target.is_active === 1) {
    const willStayAdmin = parsed.data.role
      ? parsed.data.role === "admin"
      : true;
    const willStayActive =
      parsed.data.is_active === undefined ? true : parsed.data.is_active === 1;
    if (!(willStayAdmin && willStayActive)) {
      const activeAdmins = await countActiveAdmins();
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { ok: false, error: "cannot_demote_or_disable_last_admin" },
          { status: 409 },
        );
      }
    }
  }

  await updateUser(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireRole("admin");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }
  void current;

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
  if (target.role === "admin" && target.is_active === 1) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { ok: false, error: "cannot_disable_last_admin" },
        { status: 409 },
      );
    }
  }
  await setUserActive(id, false);
  return NextResponse.json({ ok: true });
}
